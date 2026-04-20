'use strict';
/**
 * Orientation Batch Processing — Cloud Function
 *
 * Triggered by document creation in orientation_batch_jobs/{jobId}.
 * Processes wpids server-side with 20-way concurrency using Gemini 2.5 Flash.
 * Tab-independent: continues running even if the triggering browser tab is closed.
 *
 * Client writes:
 *   { zpids: string[], status: 'queued', total: N, done: 0, failed: 0, userId: string }
 *
 * CF updates:
 *   { status: 'running' | 'completed', done: N, failed: N, ... }
 */

const functions = require('firebase-functions/v1');
const admin     = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const BATCH_CONCURRENCY   = 20;
const ORIENTATION_MODEL_CF = 'gemini-2.0-flash';

// ─── Gemini response schema ───────────────────────────────────────────────────
// Uses plain string type names (compatible with all @google/generative-ai versions).

const ORIENTATION_SCHEMA = {
    type: 'object',
    properties: {
        image_quality:              { type: 'string', enum: ['clear', 'acceptable', 'blurry'] },
        final_orientation:          { type: 'string' },
        azimuth_degrees:            { type: 'number', nullable: true },
        property_layout_type:       { type: 'string', enum: ['corner_lot', 'cul_de_sac', 'flag_lot', 'irregular_lot', 'standard', 'other'] },
        confidence:                 { type: 'string', enum: ['high', 'medium', 'low'] },
        is_under_construction:      { type: 'boolean' },
        standard_street_layout:     { type: 'boolean', nullable: true },
        explanation:                { type: 'string' },
        front_door_clearly_visible: { type: 'boolean', nullable: true },
        feng_shui_vastu:            { type: 'string', nullable: true },
        privacy_insight:            { type: 'string' },
        lot_coverage_hardscape:     { type: 'number', nullable: true },
        lot_coverage_pervious:      { type: 'number', nullable: true },
        buyer_pro:                  { type: 'string' },
        buyer_con:                  { type: 'string' },
        orientation_highlights:     { type: 'string' },
        street_view_shows_front:    { type: 'boolean', nullable: true },
        pool_visible:               { type: 'boolean', nullable: true },
        pool_direction:             { type: 'string', nullable: true },
        garage_direction:           { type: 'string', nullable: true },
        open_sky_direction:         { type: 'string', nullable: true },
    },
    required: [
        'property_layout_type', 'image_quality', 'final_orientation', 'confidence',
        'explanation', 'privacy_insight', 'buyer_pro', 'buyer_con', 'orientation_highlights',
    ],
};

// ─── Pure-math helpers ────────────────────────────────────────────────────────

function _computeBearing(lat1, lng1, lat2, lng2) {
    const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
    const dl   = (lng2 - lng1) * Math.PI / 180;
    const y    = Math.sin(dl) * Math.cos(phi2);
    const x    = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dl);
    return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
}

const _angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Azimuth → compass label with intercardinal snap (matches browser-side logic). */
function _azimuthToCompassLabel(azimuth) {
    if (azimuth == null) return 'Unknown';
    const az = ((azimuth % 360) + 360) % 360;
    // Within 5° of a cardinal↔intercardinal boundary → snap to intercardinal corner.
    const SNAP = [
        [22.5, 'Northeast'], [67.5,  'Northeast'],
        [112.5, 'Southeast'], [157.5, 'Southeast'],
        [202.5, 'Southwest'], [247.5, 'Southwest'],
        [292.5, 'Northwest'], [337.5, 'Northwest'],
    ];
    for (const [boundary, label] of SNAP) {
        if (Math.abs(((az - boundary + 540) % 360) - 180) <= 5) return `${label} (~${Math.round(az)}°)`;
    }
    const dirs = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    return `${dirs[Math.round(az / 45) % 8]} (~${Math.round(az)}°)`;
}

/** Simple 8-direction label for use inside prompt text (no degree suffix). */
const _dir8 = (az) => ['North','Northeast','East','Southeast','South','Southwest','West','Northwest'][
    Math.round(((az % 360) + 360) % 360 / 45) % 8
];

// ─── Maps Geocoding: street bearing ──────────────────────────────────────────

/**
 * Port of browser-side getStreetBearing.
 * Geocodes address + neighbour 50/100 numbers away to compute the street's bearing.
 * Returns { bearing, streetSide } or null.
 */
async function _getStreetBearing(address, mapsKey) {
    const match = address.match(/^(\d+)/);
    if (!match || !mapsKey) return null;
    const houseNum = parseInt(match[1], 10);

    const geocode = async (addr) => {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${mapsKey}`;
        const res = await fetch(url).then(r => r.json());
        const result = res.results?.[0];
        if (!result) return null;
        const loc  = result.geometry?.location;
        const road = (result.address_components?.find(c => c.types.includes('route'))?.long_name ?? '')
            .toLowerCase().replace(/[^a-z0-9]/g, '');
        return loc ? { lat: loc.lat, lng: loc.lng, road } : null;
    };

    try {
        const p1 = await geocode(address);
        if (!p1) return null;

        const bearings = [];
        for (const offset of [50, 100]) {
            const p2 = await geocode(address.replace(/^\d+/, String(houseNum + offset)));
            if (!p2) continue;
            if (p1.road && p2.road && p1.road !== p2.road) continue; // different road → skip
            const dlat = (p2.lat - p1.lat) * 111320;
            const dlng = (p2.lng - p1.lng) * 111320 * Math.cos(p1.lat * Math.PI / 180);
            const dist = Math.sqrt(dlat * dlat + dlng * dlng);
            if (dist < 20) continue; // too close → geocoding artifact
            bearings.push({ bearing: _computeBearing(p1.lat, p1.lng, p2.lat, p2.lng), p2lat: p2.lat, p2lng: p2.lng });
        }

        if (bearings.length === 0) return null;

        // Derive rough cardinal street side from aggregate neighbour position.
        const avgDlat = bearings.reduce((s, b) => s + (b.p2lat - p1.lat), 0) / bearings.length;
        const avgDlng = bearings.reduce((s, b) => s + (b.p2lng - p1.lng), 0) / bearings.length;
        const streetSide = Math.abs(avgDlat) >= Math.abs(avgDlng * Math.cos(p1.lat * Math.PI / 180))
            ? (avgDlat > 0 ? 'N' : 'S')
            : (avgDlng > 0 ? 'E' : 'W');

        // Stability check: if two bearings disagree by >30°, road is curved — suppress bearing.
        if (bearings.length >= 2 && _angDiff(bearings[0].bearing, bearings[1].bearing) > 30) {
            return { bearing: null, streetSide };
        }

        const best = bearings[0];

        // Bidirectional cross-validation: bearing(-50) must be ~180° opposite to bearing(+50).
        // Two forward offsets (+50,+100) can both be wrong on a curved/diagonal road.
        if (houseNum > 50) {
            try {
                const pMinus = await geocode(address.replace(/^\d+/, String(houseNum - 50)));
                if (pMinus && (!p1.road || !pMinus.road || p1.road === pMinus.road)) {
                    const bearingMinus = _computeBearing(p1.lat, p1.lng, pMinus.lat, pMinus.lng);
                    const expectedMinus = (best.bearing + 180) % 360;
                    const bidirDiff = _angDiff(bearingMinus, expectedMinus);
                    console.log(`[Batch] _getStreetBearing: bidir check — +50=${Math.round(best.bearing)}°, -50=${Math.round(bearingMinus)}° (expected ${Math.round(expectedMinus)}°), diff=${Math.round(bidirDiff)}°`);
                    if (bidirDiff > 25) {
                        console.log(`[Batch] _getStreetBearing: bidir FAILED — bearing suppressed, streetSide=${streetSide} kept`);
                        return { bearing: null, streetSide };
                    }
                }
            } catch { /* non-fatal */ }
        }

        return { bearing: best.bearing, streetSide };
    } catch (e) { return null; }
}

// ─── Image utilities ──────────────────────────────────────────────────────────

async function _downloadImageBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Image download HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function _buildOrientationPrompt(usesDualImage, address, description, streetBearing, streetSide, svHeading) {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const sideLabel  = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' }[streetSide] || null;
    const sideFact   = (streetBearing == null && sideLabel)
        ? ` GPS confirms "${streetName || address}" is to the ${sideLabel} — the front likely faces ${sideLabel}.` : '';
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}"\nFront entrance MUST face "${streetName || address}".${sideFact}\n• DRIVEWAY CONNECTION REQUIRED: A road is only a valid front street if a driveway or walkway directly connects the property to it with no barrier. If a road is separated by a green belt, tree row, or park strip with NO driveway crossing, it is NOT the front street.\n• Do NOT default to the largest or nearest road — look for where the driveway actually exits.` : '';
    const descHint = (() => {
        if (!description) return '';
        const text = Array.isArray(description) ? description.join(' ') : description;
        return `\n\n🏷️ LISTING DESCRIPTION (seller-provided — highest-priority signal):\n"${text}"\nIf it states a cardinal facing direction, treat as ground truth.`;
    })();
    const bearingHint = streetBearing != null ? (() => {
        const p1 = (streetBearing + 90) % 360, p2 = (streetBearing - 90 + 360) % 360;
        const p3 = (streetBearing + 180) % 360;
        return `\nGPS STREET BEARING ADVISORY: Street runs at ~${Math.round(streetBearing)}°.\n`
             + `⚠ VISUAL OVERRIDE — Before using this hint, look at the aerial: if the road is curved, a cul-de-sac/dead-end loop, or this is a corner lot with two distinct street frontages, IGNORE this hint entirely and determine orientation from the aerial visually.\n`
             + `If the road IS straight and the lot IS standard: front most likely faces `
             + `${_dir8(p1)} (~${Math.round(p1)}°) or ${_dir8(p2)} (~${Math.round(p2)}°) — perpendicular to road.\n`
             + `⛔ FORBIDDEN (straight standard lot only): ~${Math.round(streetBearing)}° and ~${Math.round(p3)}° are road-parallel. Do NOT output these unless the visual override applies.`;
    })() : '';

    if (usesDualImage) {
        return [
            `You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and a Street View image (Image B) of a property.`,
            svHeading != null ? `\n\nCAMERA HEADING: ${Math.round(svHeading)}\u00b0 (0\u00b0=North, 90\u00b0=East, 180\u00b0=South, 270\u00b0=West)\nThe camera was pointing in direction ${Math.round(svHeading)}\u00b0 when it captured Image B.` : '',
            addressClue, descHint, bearingHint,
            `\nGUIDING PRINCIPLES:`,
            `1. IMAGE A IS THE ANCHOR: North is strictly at the top. Identify the building footprint, street, and driveway.`,
            `2. WALKWAY RULE: Trace the pedestrian walkway from the public sidewalk to the main door. That wall is the architectural FRONT.`,
            `3. DRIVEWAY/GARAGE (supporting): Garage and front door are usually on the SAME wall. Driveway runs from street to garage.`,
            `\nTASK:`,
            `Step 0: Quality/Construction check. Blurry → image_quality="blurry", UNCLEAR_IMAGE. Under construction → is_under_construction=true, UNDER_CONSTRUCTION.`,
            `Step 0b: Street View Usability. Mark street_view_shows_front=null (rely on aerial only) if Image B is: privacy blurred, solid wall/fence, OR house is too far away / obstructed by trees/vegetation. Do NOT apply heading math when street_view_shows_front=null.`,
            `  TOWNHOUSE/CONDO EXTRA GATE: set front_door_clearly_visible=true ONLY if ALL are true: (a) clearly distinct residential PEDESTRIAN door visible — a walk-through door with a handle. A GARAGE DOOR (vehicle roller/sectional door) is NEVER a front door even if it faces the main road. (b) direct pedestrian path from sidewalk to THAT door. (c) not a garage roller door, shared lobby, or rear gate. (d) close enough to identify as THIS unit.\n  GARAGE-ONLY TRAP (most common failure for modern townhouses): If Image B shows only garage/roller doors filling the ground floor with NO walk-through pedestrian door visible — even if the garage faces the main road — set front_door_clearly_visible=false IMMEDIATELY. Do not look for workarounds.\n  DISTANCE/AMBIGUITY TRAP: if doors are far or multiple identical unit doors visible with no way to tell which is this address → front_door_clearly_visible=false.`,
            `Step 1: Layout detection — classify as standard, cul_de_sac, corner_lot, flag_lot, or other.\n   CORNER LOT (look carefully — this is the most commonly mis-classified type):\n     A property is a corner lot when TWO named public streets form its boundary at an intersection.\n     Visual signals in the aerial: (a) two perpendicular or angled curb lines meeting at the lot corner, (b) sidewalks along both edges, (c) through-traffic lanes of consistent width on BOTH sides.\n     NOT a corner lot: a property that shares a boundary with a private internal road, parking aisle, alley behind a garage, or a shared courtyard — even if those surfaces look road-like from above.\n     KEY TEST: can you see a named public street touching TWO different sides of this lot? If yes → corner_lot.\n     CUL-DE-SAC PRECEDENCE: if one of the two streets terminates as a circular dead-end (cul-de-sac circle) AND the property driveway directly connects to that circle, classify as cul_de_sac — NOT corner_lot. The cul-de-sac identity takes priority.\n   CUL-DE-SAC DIRECTION: draw a vector from property center (P) → cul-de-sac center (C). Use BOTH axes: upper-left=NW, upper-right=NE, lower-left=SW, lower-right=SE. Do NOT collapse a diagonal to a cardinal (e.g. upper-left is NW ~315°, NOT west 270° or southwest 225°).`,
            `Step 2: Aerial front-wall identification. FACING CONVENTION (CRITICAL — all 8 directions valid): front faces TOWARD the street. South=180°, SE=135°, SW=225°, N=0°, NE=45°, NW=315°, E=90°, W=270°. NEVER collapse diagonal to cardinal (if street is lower-right=SE, face SE not south). NEVER invert (street south=face south, not north). DIRECTION PRECISION: trace driveway toward street using BOTH axes — upper-left=NW, upper-right=NE, lower-left=SW, lower-right=SE. Only use N/E/S/W when movement is almost entirely one-axis. DRIVEWAY CONNECTION RULE: only count a road as the front street if a driveway physically connects to it — a road blocked by a green belt, tree row, or barrier with no driveway crossing is NOT the front street.`,
            `Step 3: Image B judgment ONLY. Look at Image B — does it show the FRONT (door, porch, entry) or BACK (blank wall, fence)? Judge from the image alone, NOT from your Step 2 aerial conclusion. Set street_view_shows_front = true (front visible) or false (back/side visible) or null (obstructed/blurred/too far). The system computes the final azimuth from GPS heading + your answer. Do NOT compute azimuth yourself or adjust this field to match your Step 2 guess.`,
            `Step 4: Finalize — output final_orientation, azimuth_degrees, confidence, property_layout_type.\n   IF street_view_shows_front = FALSE (set in Step 3): ⚠️ GARAGE-SIDE CORRECTION. The camera confirmed it was NOT seeing the front. This means the driveway you traced in Step 2 connects to the GARAGE, NOT the front entrance. The Step 2 azimuth is the GARAGE direction — do NOT use it as the final answer. Re-examine Image A: (a) look for a pedestrian walkway on any OTHER face of the house. (b) If a clear pedestrian path is visible on another face, set azimuth_degrees to THAT face. (c) If no other face shows a clear walkway, set final_orientation='UNCLEAR', azimuth_degrees=null, confidence='low'.`,
            `ADDITIONAL: Assess privacy sightlines, lot coverage (hardscape/pervious %), pool/garage directions, buyer pro/con.`,
            `EXPLANATION FORMAT — use this EXACT structure:\n(1) LAYOUT: layout type and one visual reason.\n(2) STREET CONTEXT: name the address street, which edge it runs along, and its approximate bearing.\n(3) AERIAL EVIDENCE: what the driveway/walkway shows, which road edge it connects to, and the raw aerial azimuth estimate.\n(4) IMAGE B EVIDENCE: state the camera heading in degrees, what Image B shows (front/back/uninformative), and how street_view_shows_front was set.\n(5) FINAL: final azimuth in degrees and compass label, confidence.`,
        ].join('\n').trim();
    }

    return [
        `You are a spatial analysis expert. I am providing one aerial satellite image (North-up).`,
        addressClue, bearingHint, descHint,
        `\nGUIDING PRINCIPLES:`,
        `1. NORTH IS UP: Use the top of the frame as 0° North.`,
        `2. WALKWAY RULE (MANDATORY): Front of property = where the pedestrian path from the public sidewalk leads to the main door.`,
        `3. ADDRESS STREET PRIORITY: When multiple streets are visible, give strong priority to the address street.`,
        `4. TOWARD RULE (most common error): The front faces TOWARD the road — in the direction FROM the lot center TO the road. The direction the road TRAVELS is irrelevant. Road on the NE edge → front faces NE (~45°), NOT NW or SE. Road on N edge → front faces N (~0°). TRAP: "road runs NW/SE along NE edge" → front faces NE, never NW or SE.`,
        `\nLAYOUT CLASSIFICATION (do FIRST):`,
        `Set standard_street_layout = FALSE if: corner lot, flag lot, curved/loop street (CT, CIR, LOOP, COURT in name), side-loading entry, or rural acreage.`,
        `Set standard_street_layout = TRUE only for simple rectangular lots on straight non-looping streets.`,
        `\nCONFIDENCE GATE (MANDATORY): If you cannot clearly identify driveway apron OR pedestrian walkway with HIGH confidence:`,
        `→ confidence='low', final_orientation='UNCLEAR', azimuth_degrees=null.`,
        `\nTASK:`,
        `Step 2 — Street edge identification (DO THIS FIRST before any compass labeling):
   Look at the aerial image and identify the physical edge of the image that the address street touches.
   Use ONLY: top-edge, bottom-edge, left-edge, right-edge (or two edges for diagonal).
   Then convert: top-edge=North, bottom-edge=South, left-edge=West, right-edge=East.
   ⚠️ COMMON ERROR: If the road is visible at the BOTTOM of the image, the street is on the SOUTH side → front faces SOUTH (~180°), NOT north.
   State this explicitly: "Road is at [edge] → [compass direction] → front faces [compass direction] (~[degrees]°)".`,
        `Step 3 — Driveway Apron: verify curb cut (driveway connects to public road with no gap or fence interruption).`,
        `Step 4 — Front Walk: look for pedestrian path to main door.`,
        `Step 5 — State compass direction the front wall faces (0°=N, 90°=E, 180°=S, 270°=W). PERPENDICULAR RULE (MANDATORY): azimuth must be ~perpendicular (±45°) to the road — never parallel to it. If road runs at ~315°, valid azimuths are ~45° or ~225°, NOT 315°. If road runs at ~90°, valid azimuths are ~0° or ~180°, NOT 90°. If your azimuth is within 15° of the road bearing you have made an error — correct to the nearest perpendicular.`,
        `Step 6 — Assess: privacy sightlines, lot coverage (hardscape/pervious %), pool/garage/yard directions, buyer pro/con.`,
        `Step 7 — GPS Self-Check (only if bearing prior given): verify azimuth is within 45° of a perpendicular. Correct if ≥45° off; note if corrected. PARALLEL CHECK (always run): if your azimuth is within 15° of the road bearing itself (not the perpendicular), you have made the most common error — correct to nearest perpendicular or set UNCLEAR.`,
        `\nEXPLANATION FORMAT — use this EXACT structure:\n(1) LAYOUT: standard_street_layout=true/false and one specific visual reason.\n(2) STREET CONTEXT: name the address street, which image edge it touches (top/bottom/left/right), convert to compass direction, and the approximate bearing.\n(3) AERIAL EVIDENCE: what the driveway/walkway shows and which road edge it connects to; include the raw aerial azimuth estimate.\n(4) GPS SELF-CHECK: whether a correction was applied; if yes: "GPS self-check: adjusted from X° to Y°"; if no: "No correction needed".\n(5) FINAL: final orientation and confidence.`,

    ].join('\n').trim();
}

// ─── Core: analyze a single property ─────────────────────────────────────────

async function _analyzeOneProperty(zpid, db, geminiKey, mapsKey) {
    // 1. Read property from Firestore (Admin SDK)
    const propSnap = await db.collection('properties').doc(zpid).get();
    if (!propSnap.exists) throw new Error(`Property ${zpid} not found`);
    const prop = propSnap.data();

    const address  = prop.address || '';
    const homeType = (prop.homeType || '').toUpperCase();
    const aerialUrl = prop.satelliteImageUrl || null;
    const svUrl     = prop.streetView || prop.streetViewAnalysis?.imageUrl || null;

    if (!aerialUrl) throw new Error(`No cached aerial image for ${zpid}`);

    // 2. Street bearing via Maps Geocoding API
    let streetBearing = null, streetSide = null;
    try {
        const br  = await _getStreetBearing(address, mapsKey);
        streetBearing = br?.bearing ?? null;
        streetSide    = br?.streetSide ?? null;
    } catch (e) { console.warn(`[Batch] Street bearing failed for ${zpid}:`, e.message); }

    // 3. Download images to base64 (Firebase Storage URLs with tokens are publicly accessible)
    const aerialImg = await _downloadImageBase64(aerialUrl);
    let svImg = null;
    if (svUrl) {
        try { svImg = await _downloadImageBase64(svUrl); }
        catch (e) { console.warn(`[Batch] SV download failed for ${zpid}:`, e.message); }
    }

    // 4. Townhouse/condo gate: force aerial-only for shared-wall properties
    const isMultiUnit   = ['TOWNHOUSE', 'CONDO', 'APARTMENT', 'MULTI_FAMILY'].includes(homeType);
    const usesDualImage = svImg !== null && !isMultiUnit;

    // 4b. Resolve street-view camera heading BEFORE building the prompt.
    // Priority: (1) streetViewHeadingDeg Firestore field (set by backfillStreetViewHeadingDeg),
    //           (2) &heading= embedded in the SV URL (set by test infrastructure).
    // This MUST come before step 5 so the heading can be injected into the Gemini prompt.
    const svHeadingFromField = typeof prop.streetViewHeadingDeg === 'number' ? prop.streetViewHeadingDeg : null;
    const svHeadingUrlMatch  = (svUrl ?? '').match(/[&?]heading=([\d.]+)/);
    let   svHeading          = svHeadingFromField ?? (svHeadingUrlMatch ? parseFloat(svHeadingUrlMatch[1]) : null);
    if (svHeading != null) console.log(`[Batch] SV heading for ${zpid}: ${Math.round(svHeading)}\u00b0 (source: ${svHeadingFromField != null ? 'Firestore.streetViewHeadingDeg' : 'URL param'})`);
    else if (usesDualImage) console.warn(`[Batch] No SV heading for ${zpid} \u2014 Gemini will not receive camera heading context; GPS math will be skipped.`);

    // 4c. Validate cached heading against streetSide (CF equivalent of multi-pano priority fix).
    // The browser resolves this by running a live N/S/E/W multi-pano analysis when the
    // primary pano is on the wrong road. The CF doesn't have that live fetch, so we use
    // the streetSide result from _getStreetBearing as a proxy:
    //   If candidateFront (heading+180°) doesn't point generally TOWARD the road, the
    //   heading was captured from the wrong side of the house → discard it.
    //   The SV image is still sent to Gemini for visual judgment, but without a misleading
    //   CAMERA HEADING directive, so GPS math is skipped and Gemini uses the image visually.
    if (svHeading != null && streetSide != null) {
        const SIDE_AZ = { N: 0, S: 180, E: 90, W: 270 };
        const sideAz  = SIDE_AZ[streetSide];
        if (sideAz !== undefined) {
            const candidateFront = (svHeading + 180) % 360;
            const candidateBack  = svHeading;
            const frontAligned   = _angDiff(candidateFront, sideAz) <= 75;
            const backAligned    = _angDiff(candidateBack,  sideAz) <= 75;
            if (!frontAligned && !backAligned) {
                console.warn(`[Batch] ${zpid}: cached heading ${Math.round(svHeading)}\u00b0 is inconsistent with streetSide=${streetSide} (road is to the ${streetSide}). candidateFront=${Math.round(candidateFront)}\u00b0 is ${Math.round(_angDiff(candidateFront, sideAz))}\u00b0 away \u2014 heading discarded. Gemini will judge from image only.`);
                svHeading = null;
            }
        }
    }


    // 5. Build prompt and call Gemini 2.5 Flash
    const prompt = _buildOrientationPrompt(usesDualImage, address, prop.description || null, streetBearing, streetSide, svHeading);
    const parts  = [
        { text: prompt },
        { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } },
        ...(usesDualImage ? [{ inlineData: { mimeType: svImg.mimeType, data: svImg.data } }] : []),
    ];

    const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({
        model: ORIENTATION_MODEL_CF,
        generationConfig: { responseMimeType: 'application/json', responseSchema: ORIENTATION_SCHEMA },
    });

    const geminiResult = await model.generateContent({ contents: [{ role: 'user', parts }] });
    let data;
    try {
        data = JSON.parse(geminiResult.response.text());
    } catch (e) {
        throw new Error(`Gemini parse error for ${zpid}: ${geminiResult.response.text().slice(0, 200)}`);
    }

    // 6. GPS Heading Math.
    const showsFront = data.street_view_shows_front;  // true | false | null from Gemini
    let headingAzimuth = null;
    if (usesDualImage && svHeading !== null && showsFront !== null && showsFront !== undefined) {
        const candidateFront = (svHeading + 180) % 360;  // face opposite camera = face camera sees
        const candidateBack  = svHeading % 360;           // face toward camera = face camera can't see
        if (showsFront === true) {
            // When Gemini VISUALLY confirmed the camera is on the front side (shows_front=true),
            // the GPS candidateFront is the most direct and reliable signal.
            // We trust it outright — the aerial analysis is secondary and can be wrong
            // (e.g. confused by garage aprons, shadow patterns, or misread driveway direction)
            // while the combination of "camera sees front door" + GPS heading is unambiguous.
            headingAzimuth = Math.round(candidateFront);

            // CUL-DE-SAC EXCEPTION: the front MUST face the cul-de-sac circle (architectural rule).
            // The aerial driveway trace (Gemini's azimuth_degrees) reliably shows which direction
            // the house opens toward the cul-de-sac. GPS is NOT reliable here:
            //   • The Street View camera is often on the APPROACH ROAD, not on the cul-de-sac circle.
            //   • A camera on the approach road sees the side/northeast face of the house and
            //     calls it "front", but candidateFront then points at the approach road direction
            //     (e.g. 354° North), not at the cul-de-sac circle (e.g. 135° SE).
            // Safe fix: skip GPS for cul-de-sac, fall back to aerial.
            // shows_front is still preserved for the culdesacSVFailed UNCLEAR gate.
            if (data.property_layout_type === 'cul_de_sac') {
                console.log(`[Batch] GPS heading math ${zpid}: cul-de-sac → skipping GPS candidateFront (${Math.round(candidateFront)}°), using aerial driveway trace instead.`);
                headingAzimuth = null;
            }
        } else {

            // shows_front=false: camera did NOT confirm the front.
            //
            // The old candidateBack formula (headingAzimuth = svHeading) was only correct
            // when the camera was on the WRONG ROAD — but that case is already handled by
            // the 4c heading validation: wrong-road headings get discarded (svHeading=null),
            // and Pattern A then fires → UNCLEAR.
            //
            // When 4c KEEPS the heading (camera IS on the address street), candidateBack points
            // AWAY from the street — the exact opposite of correct (e.g. 11418 Betlen Dr: camera
            // on south-side street, candidateBack=345° North when front faces South).
            //
            // Safe approach: leave headingAzimuth=null, fall through to aerial.
            // Gemini's garage-side correction prompt already re-derives azimuth from the walkway.
            headingAzimuth = null;
            console.log(`[Batch] GPS heading math ${zpid}: shows_front=false → skipping GPS candidateBack, using aerial`);
        }
        if (headingAzimuth != null) console.log(`[Batch] GPS heading math ${zpid}: final headingAz=${headingAzimuth}°`);
    }

    // 7. Confidence gate + street-bearing fallback (mirrors browser pipeline)
    const resultAzimuth        = headingAzimuth ?? (data.azimuth_degrees ?? null);
    const aerialConfidenceFail = !usesDualImage && (data.confidence !== 'high' || resultAzimuth == null);
    let   finalAzimuth         = aerialConfidenceFail ? null : resultAzimuth;

    if (aerialConfidenceFail && data.standard_street_layout === true && streetBearing != null) {
        const p1 = (streetBearing + 90) % 360, p2 = (streetBearing - 90 + 360) % 360;
        // Pick the perp closest to Gemini's weak azimuth, then cross-check against streetSide.
        let chosen = resultAzimuth != null
            ? (_angDiff(resultAzimuth, p1) <= _angDiff(resultAzimuth, p2) ? p1 : p2)
            : p1;
        // If chosen perp faces >90° away from the road, the weak azimuth was inverted too — flip it.
        if (streetSide != null) {
            const SIDE_AZ = { N: 0, S: 180, E: 90, W: 270 };
            const sz = SIDE_AZ[streetSide];
            if (sz !== undefined && _angDiff(chosen, sz) > 90) {
                const flipped = chosen === p1 ? p2 : p1;
                console.log(`[Batch] Fallback streetSide cross-check ${zpid}: perp ${Math.round(chosen)}° faces away from road (${streetSide}=${sz}°, ${Math.round(_angDiff(chosen, sz))}° off) — flipping to ${Math.round(flipped)}°.`);
                chosen = flipped;
            }
        }
        finalAzimuth = chosen;
    }

    // 7b. StreetSide cross-check for inverted aerial results.
    // If the aerial azimuth points >90° away from the road (streetSide direction),
    // Gemini analyzed the wrong building face. Correct it.
    // Works in two modes:
    //   (a) streetBearing available → perp-snap to the road perpendicular facing the street (precise)
    //   (b) streetSide only (no bearing) → snap to sideAz cardinal (catches clear 0↔180 / 90↔270 inversions)
    // Guard: no usesDualImage (aerial-only), standard layout, streetSide known, azimuth available.
    if (!aerialConfidenceFail && !usesDualImage &&
        data.standard_street_layout === true &&
        streetSide != null && finalAzimuth != null) {
        const SIDE_AZ = { N: 0, S: 180, E: 90, W: 270 };
        const sideAz  = SIDE_AZ[streetSide];
        if (sideAz !== undefined) {
            const distFromRoad = _angDiff(finalAzimuth, sideAz);
            if (distFromRoad > 90) {
                let corrected;
                if (streetBearing != null) {
                    // Precise: pick the road perpendicular closest to the street side.
                    const p1 = (streetBearing + 90) % 360, p2 = (streetBearing - 90 + 360) % 360;
                    corrected = _angDiff(p1, sideAz) <= _angDiff(p2, sideAz) ? p1 : p2;
                } else {
                    // Fallback: snap to the street-side cardinal direction.
                    // Less precise but always fixes clear inversions (e.g. N=0° when road is south → 180°).
                    corrected = sideAz;
                }
                console.log(`[Batch] StreetSide cross-check ${zpid}: aerial ${Math.round(finalAzimuth)}° is ${Math.round(distFromRoad)}° from streetSide=${streetSide} (${sideAz}°). Correcting to ${Math.round(corrected)}° (${_azimuthToCompassLabel(corrected)}).${streetBearing == null ? ' [no bearing, cardinal snap]' : ''}`);
                finalAzimuth    = corrected;
                data.confidence = 'medium';
            }
        }

    }

    let finalOrientation = finalAzimuth != null ? _azimuthToCompassLabel(finalAzimuth) : 'UNCLEAR';

    // Post-processing gate 1: ALL property types — aerial-only with ambiguous layout → UNCLEAR
    // (a) non-standard layout (curved road, flag lot, etc.)
    // (b) corner lot — two frontages, cannot pick primary without street view
    // (c) cul-de-sac — faces outward toward the court; cannot confirm without street view
    const aerialOnlyMode = !usesDualImage || data.street_view_shows_front === null;
    const layoutType     = data.property_layout_type;
    const isCornerOrCulDeSac = layoutType === 'corner_lot' || layoutType === 'cul_de_sac';

    // For complex lot types: split policy by type.
    //
    // CORNER LOT → always UNCLEAR.
    //   Two frontages make the primary-street question unanswerable.
    //
    // CUL-DE-SAC → TRUST the aerial driveway azimuth (never UNCLEAR purely because of layout).
    //   Architectural rule: front ALWAYS faces the cul-de-sac circle.
    //   GPS is already skipped for cul-de-sac (skipped above in GPS math block).
    //   The aerial driveway trace IS the authoritative direction — show it.
    //   Only fall back to UNCLEAR if Gemini returned no azimuth at all (finalAzimuth==null)
    //   or the property is aerial-only with genuinely no usable direction.
    const isCornerLot = layoutType === 'corner_lot';
    const isCulDeSac  = layoutType === 'cul_de_sac';
    const cornerlotUnclear = isCornerLot;
    // No culdesacSVFailed gate — cul-de-sac rule: front faces the circle, aerial tells us which way.
    const complexLayoutSVFailed = cornerlotUnclear ||
        // legacy: non-cul-de-sac complex layouts when SV is uninformative
        (usesDualImage && isCornerOrCulDeSac && !isCulDeSac && data.street_view_shows_front !== true);

    if ((aerialOnlyMode && (data.standard_street_layout === false || isCornerOrCulDeSac)) || complexLayoutSVFailed) {
        // For cul-de-sac in aerial-only mode: only mark UNCLEAR if we have NO azimuth.
        // If there IS an azimuth, the cul-de-sac rule applies and we show the direction.
        if (isCulDeSac && finalAzimuth != null) {
            console.log(`[Batch] ${zpid}: cul-de-sac aerial azimuth ${finalAzimuth}° — trusting architectural rule (front faces cul-de-sac circle).`);
            // Do not override — let finalAzimuth / finalOrientation stand.
        } else {
        const reason = isCornerLot                      ? 'corner_lot (always UNCLEAR — two frontages ambiguous)'
            : data.standard_street_layout === false     ? 'non-standard layout'
            :                                             'cul_de_sac (no azimuth from aerial)';
        console.log(`[Batch] Override ${zpid}: ${reason} → UNCLEAR`);
        finalOrientation = 'UNCLEAR';
        finalAzimuth     = null;
        }
    }


    // Post-processing gate 2: Townhouse → UNCLEAR
    // Policy:
    //   aerial-only + shared-wall → ALWAYS UNCLEAR (aerial alone is too unreliable
    //   to distinguish a unit's front from shared party walls or walkways).
    //   dual-image + shared-wall → UNCLEAR if front door missing / complex layout /
    //   non-standard street.
    if (isMultiUnit && finalOrientation !== 'UNCLEAR') {
        if (aerialOnlyMode) {
            console.log(`[Batch] Override ${zpid}: townhouse + aerial_only_mode → UNCLEAR (always)`);
            finalOrientation = 'UNCLEAR';
            finalAzimuth     = null;
        } else {
            const layoutType        = data.property_layout_type;
            const frontDoorMissing  = data.front_door_clearly_visible === false;
            const complexLayout     = layoutType === 'cul_de_sac' || layoutType === 'corner_lot';
            const nonStandardStreet = data.standard_street_layout === false;
            if (frontDoorMissing || complexLayout || nonStandardStreet) {
                const reason = frontDoorMissing  ? 'front_door_clearly_visible=false'
                             : nonStandardStreet ? 'standard_street_layout=false'
                             : `layout=${layoutType}`;
                console.log(`[Batch] Override ${zpid}: townhouse + ${reason} → UNCLEAR`);
                finalOrientation = 'UNCLEAR';
                finalAzimuth     = null;
            }
        }
    }

    // Post-processing gate 3: Unresolvable orientation → UNCLEAR
    // Two targeted patterns that produce high-confidence wrong answers in practice.
    // These mirror the Pattern A/B overrides in satellitaryService.ts.

    // Pattern A: Gemini confirmed shows_front=false (garage/side visible) AND GPS wasn't used
    // to recover the correct direction (headingAzimuth===null, i.e. the result falls through
    // to aerial alone). The garage-side correction prompt may have Gemini "find" a walkway on
    // the aerial, but this is speculative — on standard lots the front door is often on the
    // SAME wall as the garage (beside it, not visible from the garage-side camera angle).
    // The aerial walkway identification is insufficiently reliable to override to UNCLEAR.
    if (finalOrientation !== 'UNCLEAR' && usesDualImage && data.street_view_shows_front === false && headingAzimuth === null) {
        console.log(`[Batch] Override ${zpid}: shows_front=false + no GPS heading used → UNCLEAR (aerial walkway redirect unreliable)`);
        finalOrientation = 'UNCLEAR';
        finalAzimuth     = null;
    }

    // Pattern B: street view was sent (svHeading proves this) but Gemini could not
    // determine shows_front from it (null = blurry/obstructed/uninformative).
    // aerial_only_mode=true in this case. The aerial estimate is unverified and if
    // wrong, we have no runtime way to detect it. UNCLEAR is more honest.
    if (finalOrientation !== 'UNCLEAR' && usesDualImage && data.street_view_shows_front === null && svHeading !== null) {
        console.log(`[Batch] Override ${zpid}: shows_front=null (SV uninformative) + aerial_only_mode → UNCLEAR`);
        finalOrientation = 'UNCLEAR';
        finalAzimuth     = null;
    }

    // Confidence cap: aerial-only analysis cannot be HIGH confidence.
    // When headingAzimuth===null (no GPS-confirmed heading was used), the result comes
    // entirely from Gemini's aerial image interpretation. Driveway/walkway tracing from
    // a satellite image, without street-view visual confirmation, is inherently medium
    // confidence at best — even if Gemini says high. Cap it.
    let finalConfidence = data.confidence ?? 'low';
    if (finalOrientation !== 'UNCLEAR' && headingAzimuth === null && finalConfidence === 'high') {
        finalConfidence = 'medium';
        console.log(`[Batch] Confidence cap ${zpid}: aerial-only result (no GPS) downgraded high → medium`);
    }

    // 8. Write orientation result to Firestore via Admin SDK
    const orientationAI = {
        final_orientation:       finalOrientation,
        azimuth_degrees:         finalAzimuth,
        visual_azimuth_estimate: data.azimuth_degrees ?? null,
        confidence:              finalConfidence,
        aerial_only_mode:        aerialOnlyMode,
        image_quality:           data.image_quality ?? 'acceptable',
        feng_shui_vastu:         data.feng_shui_vastu ?? null,
        privacy_insight:         data.privacy_insight ?? '',
        lot_coverage_hardscape:  data.lot_coverage_hardscape ?? null,
        lot_coverage_pervious:   data.lot_coverage_pervious ?? null,
        buyer_pro:               data.buyer_pro ?? '',
        buyer_con:               data.buyer_con ?? '',
        orientation_highlights:  data.orientation_highlights ?? '',
        pool_visible:            data.pool_visible ?? null,
        pool_direction:          data.pool_direction ?? null,
        garage_direction:        data.garage_direction ?? null,
        open_sky_direction:      data.open_sky_direction ?? null,
        property_layout_type:    data.property_layout_type ?? null,
        explanation:             data.explanation ?? null,
        is_under_construction:   data.is_under_construction ?? false,
    };

    await db.collection('properties').doc(zpid).set(
        { orientation_ai: orientationAI, orientation_calculated_at: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
    );

    // 9. Log orientation version (port of browser-side logOrientationVersion)
    const city   = (prop.city || 'Unknown').trim();
    const zip    = (prop.zipCode || prop.zip || 'Unknown').trim();
    const gtRef  = db.collection('orientation_ground_truth').doc(zpid);
    const gtSnap = await gtRef.get();
    const existing = gtSnap.exists ? gtSnap.data() : {};
    const prevAuto = (existing?.test_results ?? []).filter(r => r.tester === 'automated');
    const newEntry = {
        remark: null, ai_assessed_orientation: finalOrientation, ai_assessed_azimuth: finalAzimuth,
        ai_layout_type: data.property_layout_type || null, notes: null, tester: 'automated',
        date: new Date().toISOString(), city, zip, zpid, version: prevAuto.length + 1,
    };
    if (gtSnap.exists) {
        await gtRef.update({ test_results: admin.firestore.FieldValue.arrayUnion(newEntry) });
    } else {
        await gtRef.set({ zpid, city, address, expected_orientation: null, expected_azimuth_deg: null, test_results: [newEntry] });
    }

    console.log(`[Batch] ✓ ${zpid} → ${finalOrientation}`);
    return finalOrientation;
}

// ─── Exported Cloud Function ──────────────────────────────────────────────────

/**
 * Firestore onCreate trigger for orientation_batch_jobs/{jobId}.
 *
 * The browser writes a 'queued' document with a list of zpids. This function
 * picks it up, runs orientation analysis for all zpids in parallel, and writes
 * progress back to the same document in real time. Because this runs server-side,
 * the browser tab can be closed while the job continues.
 *
 * Memory set to 1GB to handle 20 concurrent base64 image downloads.
 * Timeout: 540s (9 min) → handles ~500 properties at 20×25s concurrency.
 */
exports.runOrientationBatchOnCreate = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .firestore
    .document('orientation_batch_jobs/{jobId}')
    .onCreate(async (snap, context) => {
        const jobData = snap.data();
        if (jobData.status !== 'queued') return null; // Ignore non-queued documents

        const { zpids } = jobData;
        if (!Array.isArray(zpids) || zpids.length === 0) {
            await snap.ref.update({
                status: 'completed', done: 0, failed: 0,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return null;
        }

        // Mark as running so the UI shows the spinner immediately
        await snap.ref.update({ status: 'running', startedAt: admin.firestore.FieldValue.serverTimestamp() });

        const db        = admin.firestore();
        const keysSnap  = await db.collection('app_config').doc('api_keys').get();
        const keys      = keysSnap.exists ? keysSnap.data() : {};
        const geminiKey = keys.gemini_key || process.env.GEMINI_API_KEY || '';
        const mapsKey   = keys.maps_key   || process.env.MAPS_API_KEY   || '';

        let done = 0, failed = 0;

        // Process zpids in waves of BATCH_CONCURRENCY (20).
        // Promise.allSettled ensures one failure doesn't cancel the rest of the wave.
        for (let i = 0; i < zpids.length; i += BATCH_CONCURRENCY) {
            const wave = zpids.slice(i, i + BATCH_CONCURRENCY);
            await Promise.allSettled(
                wave.map(async (zpid) => {
                    try {
                        await _analyzeOneProperty(zpid, db, geminiKey, mapsKey);
                        done++;
                    } catch (e) {
                        console.error(`[Batch] ✗ ${zpid}:`, e.message);
                        failed++;
                    }
                    // Real-time progress update after each property completes
                    await snap.ref.update({ done, failed, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                }),
            );
        }

        await snap.ref.update({
            status: 'completed', done, failed,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[Batch] Job ${context.params.jobId} complete — ${done} ok, ${failed} failed / ${zpids.length} total`);
        return null;
    });
