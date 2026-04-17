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
const ORIENTATION_MODEL_CF = 'gemini-2.5-flash';

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
            if (Math.sqrt(dlat * dlat + dlng * dlng) < 20) continue; // too close → skip
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
        return { bearing: bearings[0].bearing, streetSide };
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

function _buildOrientationPrompt(usesDualImage, address, description, streetBearing, streetSide) {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const sideLabel  = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' }[streetSide] || null;
    const sideFact   = (streetBearing == null && sideLabel)
        ? ` GPS confirms "${streetName || address}" is to the ${sideLabel} — the front likely faces ${sideLabel}.` : '';
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}"\nFront entrance MUST face "${streetName || address}".${sideFact}` : '';
    const descHint = (() => {
        if (!description) return '';
        const text = Array.isArray(description) ? description.join(' ') : description;
        return `\n\n🏷️ LISTING DESCRIPTION (seller-provided — highest-priority signal):\n"${text}"\nIf it states a cardinal facing direction, treat as ground truth.`;
    })();
    const bearingHint = streetBearing != null ? (() => {
        const p1 = (streetBearing + 90) % 360, p2 = (streetBearing - 90 + 360) % 360;
        return `\nGPS STREET BEARING PRIOR: Street runs at ~${Math.round(streetBearing)}°. Front most likely faces `
             + `${_dir8(p1)} (~${Math.round(p1)}°) or ${_dir8(p2)} (~${Math.round(p2)}°). `
             + `Use the driveway apron to confirm which of the two perpendicular directions is correct.`;
    })() : '';

    if (usesDualImage) {
        return [
            `You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and a Street View image (Image B) of a property.`,
            addressClue, descHint, bearingHint,
            `\nGUIDING PRINCIPLES:`,
            `1. IMAGE A IS THE ANCHOR: North is strictly at the top. Identify the building footprint, street, and driveway.`,
            `2. WALKWAY RULE: Trace the pedestrian walkway from the public sidewalk to the main door. That wall is the architectural FRONT.`,
            `3. DRIVEWAY/GARAGE (supporting): Garage and front door are usually on the SAME wall. Driveway runs from street to garage.`,
            `\nTASK:`,
            `Step 0: Quality/Construction check. Blurry → image_quality="blurry", UNCLEAR_IMAGE. Under construction → is_under_construction=true, UNDER_CONSTRUCTION.`,
            `Step 0b: Street View Usability. Mark street_view_shows_front=null (rely on aerial only) if Image B is: privacy blurred, solid wall/fence, OR house is too far away / obstructed by trees/vegetation. Do NOT apply heading math when street_view_shows_front=null.`,
            `  TOWNHOUSE/CONDO EXTRA GATE: set front_door_clearly_visible=true ONLY if: (a) clearly distinct unit front door visible, (b) direct pedestrian path from sidewalk to THAT door, (c) not shared lobby/rear gate/garage, (d) door is close and distinct enough to identify as THIS unit — not one of many identical doors far in the distance. DISTANCE/AMBIGUITY TRAP: if doors are far away behind a fence or parking lot, or multiple identical unit doors visible with no way to tell which is this address → front_door_clearly_visible=false.`,
            `Step 1: Layout detection — classify as standard, cul_de_sac, corner_lot, flag_lot, or other. CUL-DE-SAC DIRECTION: draw a vector from property center (P) → cul-de-sac center (C). Use BOTH axes: upper-left=NW, upper-right=NE, lower-left=SW, lower-right=SE. Do NOT collapse a diagonal to a cardinal (e.g. upper-left is NW ~315°, NOT west 270° or southwest 225°).`,
            `Step 2: Aerial front-wall identification — which compass direction does the front wall face? DIRECTION PRECISION: trace the driveway from the house toward the street using BOTH axes — upper-left=NW, upper-right=NE, lower-left=SW, lower-right=SE. Only use N/E/S/W when movement is almost entirely in one axis.`,
            `Step 3: Cross-check with Image B — street_view_shows_front = true/false/null.`,
            `Step 4: Finalize — output final_orientation, azimuth_degrees, confidence, property_layout_type.`,
            `ADDITIONAL: Assess privacy sightlines, lot coverage (hardscape/pervious %), pool/garage directions, buyer pro/con.`,
            `EXPLANATION FORMAT: (1) layout type, (2) front wall direction from aerial+driveway, (3) what Image B confirmed or contradicted, (4) final azimuth.`,
        ].join('\n').trim();
    }

    return [
        `You are a spatial analysis expert. I am providing one aerial satellite image (North-up).`,
        addressClue, bearingHint, descHint,
        `\nGUIDING PRINCIPLES:`,
        `1. NORTH IS UP: Use the top of the frame as 0° North.`,
        `2. WALKWAY RULE (MANDATORY): Front of property = where the pedestrian path from the public sidewalk leads to the main door.`,
        `3. ADDRESS STREET PRIORITY: When multiple streets are visible, give strong priority to the address street.`,
        `\nLAYOUT CLASSIFICATION (do FIRST):`,
        `Set standard_street_layout = FALSE if: corner lot, flag lot, curved/loop street (CT, CIR, LOOP, COURT in name), side-loading entry, or rural acreage.`,
        `Set standard_street_layout = TRUE only for simple rectangular lots on straight non-looping streets.`,
        `\nCONFIDENCE GATE (MANDATORY): If you cannot clearly identify driveway apron OR pedestrian walkway with HIGH confidence:`,
        `→ confidence='low', final_orientation='UNCLEAR', azimuth_degrees=null.`,
        `\nTASK:`,
        `Step 1 — Layout: classify lot type.`,
        `Step 2 — Driveway Apron: verify curb cut (driveway connects to public road with no gap or fence interruption).`,
        `Step 3 — Front Walk: look for pedestrian path to main door.`,
        `Step 4 — State compass direction the front wall faces (0°=N, 90°=E, 180°=S, 270°=W).`,
        `Step 5 — Assess: privacy sightlines, lot coverage (hardscape/pervious %), pool/garage/yard directions, buyer pro/con.`,
        `Step 6 — GPS Self-Check (only if bearing prior given): verify azimuth is within 45° of a perpendicular. Correct if ≥45° off; note if corrected.`,
        `\nEXPLANATION FORMAT: (1) standard_street_layout and why, (2) road name the driveway connects to, (3) confidence and why, (4) final azimuth or UNCLEAR, (5) GPS self-check outcome.`,
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

    // 5. Build prompt and call Gemini 2.5 Flash
    const prompt = _buildOrientationPrompt(usesDualImage, address, prop.description || null, streetBearing, streetSide);
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

    // 6. Cross-validate azimuth_degrees vs explanation text (matches browser-side fix)
    const DIRECTION_AZ = { north: 0, northeast: 45, east: 90, southeast: 135,
                            south: 180, southwest: 225, west: 270, northwest: 315 };
    const explanation  = data.explanation ?? '';
    const dirMatch     = explanation.match(/(?:final orientation is|front (?:of the house )?faces?)\s+([A-Z][a-z]+(?:east|west)?)/i);
    if (dirMatch) {
        const explainDir = dirMatch[1].toLowerCase();
        const explainAz  = DIRECTION_AZ[explainDir];
        const schemaAz   = data.azimuth_degrees;
        if (explainAz !== undefined && schemaAz != null && _angDiff(schemaAz, explainAz) > 90) {
            console.warn(`[Batch] Mismatch ${zpid}: schema=${schemaAz}° but "${explainDir}"~${explainAz}°. Trusting explanation.`);
            data.azimuth_degrees = explainAz;
        }
    }

    // 7. Confidence gate + street-bearing fallback (mirrors browser pipeline)
    const resultAzimuth        = data.azimuth_degrees ?? null;
    const aerialConfidenceFail = !usesDualImage && (data.confidence !== 'high' || resultAzimuth == null);
    let   finalAzimuth         = aerialConfidenceFail ? null : resultAzimuth;

    if (aerialConfidenceFail && data.standard_street_layout === true && streetBearing != null) {
        const p1 = (streetBearing + 90) % 360, p2 = (streetBearing - 90 + 360) % 360;
        finalAzimuth = resultAzimuth != null
            ? (_angDiff(resultAzimuth, p1) <= _angDiff(resultAzimuth, p2) ? p1 : p2)
            : p1;
    }

    let finalOrientation = finalAzimuth != null ? _azimuthToCompassLabel(finalAzimuth) : 'UNCLEAR';

    // Post-processing gate 1: ALL property types — non-standard layout + aerial-only → UNCLEAR
    // Curved roads, cul-de-sacs, corner lots, flag lots, etc. cannot be reliably oriented
    // from aerial alone. Requires a usable street view to resolve ambiguous frontage.
    const aerialOnlyMode = !usesDualImage || data.street_view_shows_front === null;
    if (aerialOnlyMode && data.standard_street_layout === false) {
        console.log(`[Batch] Override ${zpid}: non-standard layout + aerial_only_mode → UNCLEAR`);
        finalOrientation = 'UNCLEAR';
        finalAzimuth     = null;
    }

    // Post-processing gate 2: Townhouse → UNCLEAR when result is unreliable
    // (a) front_door_clearly_visible = false  — Gemini couldn't see the unit door
    // (b) cul_de_sac or corner_lot — shared wall + ambiguous frontage
    // (c) standard_street_layout = false — internal access road, not a public street
    if (isMultiUnit && finalOrientation !== 'UNCLEAR') {
        const layoutType            = data.property_layout_type;
        const frontDoorMissing      = data.front_door_clearly_visible === false;
        const complexLayout         = layoutType === 'cul_de_sac' || layoutType === 'corner_lot';
        const nonStandardStreet     = data.standard_street_layout === false;
        if (frontDoorMissing || complexLayout || nonStandardStreet) {
            const reason = frontDoorMissing    ? 'front_door_clearly_visible=false'
                         : nonStandardStreet   ? 'standard_street_layout=false'
                         : `layout=${layoutType}`;
            console.log(`[Batch] Override ${zpid}: townhouse + ${reason} → UNCLEAR`);
            finalOrientation = 'UNCLEAR';
            finalAzimuth     = null;
        }
    }

    // 8. Write orientation result to Firestore via Admin SDK
    const orientationAI = {
        final_orientation:       finalOrientation,
        azimuth_degrees:         finalAzimuth,
        visual_azimuth_estimate: data.azimuth_degrees ?? null,
        confidence:              data.confidence ?? 'low',
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
