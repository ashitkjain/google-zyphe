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
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const BATCH_CONCURRENCY = 20;
const ORIENTATION_MODEL_CF = 'gemini-2.5-flash';
// Increment when the analysis logic changes so the audit UI can show which
// version produced a given result. Useful for distinguishing stale results
// from re-runs after a code change.
// v1: original release
// v2: listing photo primary mode (aerial-only + photos → listing photo prompt)
// v3: Pattern B/C retry (SV uninformative or any UNCLEAR triggers photo retry)
// v4: listing photos removed from primary call
// v5: strict two-pass — listing photos ONLY for aerial-only UNCLEAR (no SV)
// v6: street_bearing_visual_degrees — Gemini outputs visual road bearing; GPS/visual conflict detection; stability-check no longer suppresses bearing early
// v7: TOWNHOUSE removed from isMultiUnit — townhouses now get street view + listing photo Pass 2 like single-family homes
// v8: Pass 2 now also fires when street view ran but was uninformative (street_view_shows_front=null) — fixes corner lots and cul-de-sacs where SV showed only a fence/carport
// v9: svWasUninformative extended to shows_front=false; complexLayoutForcedUnclear — corner/cul-de-sac always get Pass 2 regardless of what SV returned
// v10: Gemini reports listing_photos_showing_front (image labels that showed exterior/front door); listing_photos_used now includes confirmed_front flag per photo; UI filters to confirmed photos only
// v11: roadmap image (Google Maps Static, zoom 16) sent to Gemini — Gemini reads address street bearing from labeled map; street_bearing_from_map stored in result
// v12: roadmap is primary source for street direction; explicit instruction not to estimate bearing from satellite; guiding principles updated
// v13: roadmap-first with satellite fallback — if map label unclear, fall back to satellite estimate rather than failing
// v14: sideFact upgraded to mandatory PERPENDICULAR TIE-BREAKER — prevents 180° flip when GPS bearing is suppressed but streetSide is known (e.g. Shelton St NE vs SW)
// v15: sideFact softened to advisory — aerial takes precedence; GPS hint only used when aerial is genuinely ambiguous (prevents hallucination on curved streets like Canelli Ct)
// v15b: curved road detection in _getStreetBearing — if bearing(+50) vs bearing(+100) differ >20°, GPS hint suppressed entirely; Gemini reads direction from roadmap only
// v16: address-suffix hint — streets ending in Ct/Court/Cir/Circle pre-alert Gemini to look for dead-end/cul-de-sac on map and skip the perpendicular rule
// v16b: smarter curve detection — require dist12>30m between the two geocoded points to avoid false positives on short/noisy streets
// v17: restore mandatory tie-breaker — safe now because curve detection already suppresses it for curved roads; straight short streets (Shelton St) get mandatory hint again
// v18: CORNER LOT/BEND EXCEPTION in roadmap step — if GPS tie-breaker direction is parallel to local road bearing, face that direction directly (fixes Shelton St corner lot bend)
// v19: GPS DIRECT ANSWER — gives Gemini an exact azimuth degree (not just direction name) so roadmap bearing inconsistency can't override a reliable GPS streetSide
const BATCH_VERSION = 'v19';

// ─── Gemini response schema ───────────────────────────────────────────────────
// Uses plain string type names (compatible with all @google/generative-ai versions).

const ORIENTATION_SCHEMA = {
    type: 'object',
    properties: {
        image_quality: { type: 'string', enum: ['clear', 'acceptable', 'blurry'] },
        final_orientation: { type: 'string' },
        azimuth_degrees: { type: 'number', nullable: true },
        property_layout_type: { type: 'string', enum: ['corner_lot', 'cul_de_sac', 'flag_lot', 'irregular_lot', 'standard', 'other'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        is_under_construction: { type: 'boolean' },
        standard_street_layout: { type: 'boolean', nullable: true },
        explanation: { type: 'string' },
        front_door_clearly_visible: { type: 'boolean', nullable: true },
        feng_shui_vastu: { type: 'string', nullable: true },
        privacy_insight: { type: 'string' },
        lot_coverage_hardscape: { type: 'number', nullable: true },
        lot_coverage_pervious: { type: 'number', nullable: true },
        buyer_pro: { type: 'string' },
        buyer_con: { type: 'string' },
        orientation_highlights: { type: 'string' },
        street_view_shows_front: { type: 'boolean', nullable: true },
        pool_visible: { type: 'boolean', nullable: true },
        pool_direction: { type: 'string', nullable: true },
        garage_direction: { type: 'string', nullable: true },
        open_sky_direction: { type: 'string', nullable: true },
        listing_photos_showing_front: { type: 'array', items: { type: 'string' }, nullable: true },
        street_bearing_from_map: { type: 'number', nullable: true },
    },
    required: [
        'property_layout_type', 'image_quality', 'final_orientation', 'confidence',
        'explanation', 'privacy_insight', 'buyer_pro', 'buyer_con', 'orientation_highlights',
    ],
};

// ─── Pure-math helpers ────────────────────────────────────────────────────────

function _computeBearing(lat1, lng1, lat2, lng2) {
    const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180;
    const dl = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dl) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dl);
    return Math.round(((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360);
}

const _angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Azimuth → compass label with intercardinal snap (matches browser-side logic). */
function _azimuthToCompassLabel(azimuth) {
    if (azimuth == null) return 'Unknown';
    const az = ((azimuth % 360) + 360) % 360;
    // Within 5° of a cardinal↔intercardinal boundary → snap to intercardinal corner.
    const SNAP = [
        [22.5, 'Northeast'], [67.5, 'Northeast'],
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
const _dir8 = (az) => ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][
    Math.round(((az % 360) + 360) % 360 / 45) % 8
];

// ─── Maps Geocoding: street bearing ──────────────────────────────────────────

/**
 * Port of browser-side getStreetBearing.
 * Geocodes address + neighbour 50/100 numbers away to compute the street's bearing.
 * Returns { bearing, streetSide } or null.
 */
async function _getStreetBearing(address, mapsKey, propLat = null, propLng = null) {
    const match = address.match(/^(\d+)/);
    if (!match || !mapsKey) return null;
    const houseNum = parseInt(match[1], 10);

    const geocode = async (addr) => {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${mapsKey}`;
        const res = await fetch(url).then(r => r.json());
        const result = res.results?.[0];
        if (!result) return null;
        const loc = result.geometry?.location;
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

        // Curved road detection: if bearing(+50) and bearing(+100) differ by >25° AND the two
        // geocoded points are genuinely far apart (>30m from each other), the road curves here.
        // Require the distance check to avoid false positives on short/dead-end streets where
        // +50 and +100 snap to nearby locations with noise but the road itself is straight.
        if (bearings.length >= 2) {
            const b0 = bearings[0], b1 = bearings[1];
            const dlat12 = (b1.p2lat - b0.p2lat) * 111320;
            const dlng12 = (b1.p2lng - b0.p2lng) * 111320 * Math.cos(p1.lat * Math.PI / 180);
            const dist12 = Math.sqrt(dlat12 * dlat12 + dlng12 * dlng12);
            const curveDiff = _angDiff(b0.bearing, b1.bearing);
            if (dist12 > 30 && curveDiff > 25) {
                console.log(`[Batch] _getStreetBearing: road curved (bearing+50=${Math.round(b0.bearing)}°, bearing+100=${Math.round(b1.bearing)}°, diff=${Math.round(curveDiff)}°, dist12=${Math.round(dist12)}m) — GPS hint suppressed`);
                return { bearing: null, streetSide: null };
            }
        }

        // Compute streetSide using signed perpendicular: cross-product of road direction × property offset.
        // This correctly identifies which side of the road the property is on for diagonal streets.
        // For a 315° road (NW-SE), the old 'which way is my neighbour' approach gives N or W (along road),
        // not SW or NE (perpendicular to road). The cross-product gives the correct perp direction.
        const best = bearings[0];
        let streetSide;
        if (propLat != null && propLng != null) {
            // v = road direction unit vector (p1 → p2), w = property centroid relative to p1
            const vDlat = (bearings[0].p2lat - p1.lat);
            const vDlng = (bearings[0].p2lng - p1.lng) * Math.cos(p1.lat * Math.PI / 180); // equalize for lon compression
            const wDlat = (propLat - p1.lat);
            const wDlng = (propLng - p1.lng) * Math.cos(p1.lat * Math.PI / 180);
            // 2D cross product (z-component): positive = w is to the LEFT of v (CCW), negative = RIGHT (CW)
            const cross = vDlng * wDlat - vDlat * wDlng;
            // Direction from PROPERTY toward ROAD = perpendicular that points from property to road
            // If property is to RIGHT of road (cross<0): road is to the LEFT of property → perpTowardStreet = roadBearing - 90
            // If property is to LEFT of road (cross>0): road is to the RIGHT of property → perpTowardStreet = roadBearing + 90
            const perpTowardStreet = ((best.bearing + (cross < 0 ? -90 : 90)) % 360 + 360) % 360;
            const DIR8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            streetSide = DIR8[Math.round(((perpTowardStreet % 360) + 360) % 360 / 45) % 8];
            console.log(`[Batch] _getStreetBearing: cross=${cross.toFixed(4)}, roadBearing=${Math.round(best.bearing)}°, perpTowardStreet=${Math.round(perpTowardStreet)}° → streetSide=${streetSide}`);
        } else {
            // Fallback: neighbour direction (less accurate for diagonal roads)
            const avgDlat = bearings.reduce((s, b) => s + (b.p2lat - p1.lat), 0) / bearings.length;
            const avgDlng = bearings.reduce((s, b) => s + (b.p2lng - p1.lng), 0) / bearings.length;
            streetSide = Math.abs(avgDlat) >= Math.abs(avgDlng * Math.cos(p1.lat * Math.PI / 180)) ? (avgDlat > 0 ? 'N' : 'S') : (avgDlng > 0 ? 'E' : 'W');
            console.log(`[Batch] _getStreetBearing: no propLat/Lng → neighbour fallback streetSide=${streetSide}`);
        }

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

// ─── Exterior photo scoring ───────────────────────────────────────────────────

// Keywords that indicate a listing photo shows the building exterior / front door.
// Scored by counting how many match — higher score = stronger front-door candidate.
// Aerial/drone photos are valuable — they show the full footprint including which side is the front.
const EXTERIOR_KEYWORDS = [
    // Front door / entry — strongest signal
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb appeal',
    'front of the home', 'front of the house', 'front elevation', 'front facing', 'front walk',
    'front porch', 'front yard',
    // General exterior
    'exterior', 'driveway', 'garage', 'porch', 'curb',
    'exterior view', 'outside', 'outdoor', 'front walk', 'landscaping',
    // Aerial / overhead — these show the full building layout, useful for front identification
    'aerial view', 'aerial photo', 'aerial image', 'bird\'s eye', 'bird\'s-eye', 'drone',
    'overhead view', 'overhead photo', 'top-down', 'top down', 'from above',
    'surrounding neighborhood', 'property location',
];

/**
 * Score a listing photo's text description for likelihood of showing the front exterior.
 * Returns 0 if no exterior keywords found, higher numbers = stronger candidate.
 */
function _scorePhotoForFront(analysis = '') {
    const lower = analysis.toLowerCase();
    return EXTERIOR_KEYWORDS.filter(kw => lower.includes(kw)).length;
}

/**
 * Given an image_by_image_analysis array (from property_analyses_visual),
 * returns the top N entries most likely to show the front exterior.
 * Returns objects with { url, index, score, analysisSnippet } for full traceability.
 * maxCount=3: allows 1 aerial listing photo + up to 2 ground-level exterior photos.
 */
function _findBestExteriorPhotos(imageByImageAnalysis, maxCount = 3) {
    if (!Array.isArray(imageByImageAnalysis) || imageByImageAnalysis.length === 0) return [];
    return imageByImageAnalysis
        .map((item, idx) => ({
            url: item.image_id || '',
            index: idx,
            score: _scorePhotoForFront(item.analysis || ''),
            analysisSnippet: (item.analysis || '').slice(0, 150),
        }))
        .filter(item => item.url && item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCount);
}

// ─── Image utilities ──────────────────────────────────────────────────────────

async function _downloadImageBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Image download HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' };
}

/**
 * Checks whether a Firebase Storage URL is still alive (i.e. token hasn't expired).
 * Uses a cheap HEAD request — no image bytes transferred.
 * Returns false for 401/403/404, true for 200.
 */
async function _isUrlAlive(url) {
    if (!url) return false;
    try {
        const res = await fetch(url, { method: 'HEAD' });
        return res.ok;
    } catch { return false; }
}

/**
 * Fetches a Google Maps Static roadmap tile centered on the property.
 * Returns base64 image data for inclusion in the Gemini prompt.
 * Zoom 16 gives ~400m field of view — enough to see street names and road geometry.
 */
async function _fetchRoadmapImage(lat, lng, mapsKey) {
    const url =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=16&size=640x640&scale=2&maptype=roadmap` +
        `&markers=color:red%7Csize:tiny%7C${lat},${lng}` +
        `&key=${mapsKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Roadmap fetch HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mimeType: 'image/png' };
}

/**
 * Re-fetches the aerial satellite image from Google Maps Static API,
 * uploads it to Firebase Storage, and persists the fresh URL to Firestore.
 * Mirrors client-side getOrCacheAerialSatelliteUrl (Admin SDK equivalent).
 */
async function _refreshAerialUrl(zpid, lat, lng, mapsKey, db, bucket) {
    const googleUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=20&size=640x640&scale=2&maptype=satellite` +
        `&markers=color:red%7Csize:tiny%7C${lat},${lng}` +
        `&markers=color:blue%7Csize:tiny%7Clabel:N%7C${Math.round((lat + 0.00027) * 1e7) / 1e7},${lng}` +
        `&key=${mapsKey}`;

    const storagePath = `properties/${zpid}/maps/aerial_satellite_scale2.jpg`;
    const file = bucket.file(storagePath);

    console.log(`[Batch] Re-fetching aerial for ${zpid}...`);
    const res = await fetch(googleUrl);
    if (!res.ok) throw new Error(`Google Maps Static API ${res.status} for ${zpid}`);
    const buf = Buffer.from(await res.arrayBuffer());

    await file.save(buf, { metadata: { contentType: 'image/jpeg' }, resumable: false });
    await file.makePublic();
    const [metadata] = await file.getMetadata();
    const freshUrl = metadata.mediaLink ||
        `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Persist to Firestore
    await db.collection('properties').doc(zpid).update({ satelliteImageUrl: freshUrl });
    console.log(`[Batch] Aerial re-cached for ${zpid}: ${freshUrl.slice(0, 80)}...`);
    return freshUrl;
}

/**
 * Re-fetches the street view image using the Metadata API for heading,
 * uploads to Firebase Storage, and persists the fresh URL + heading to Firestore.
 * Mirrors client-side forceRefreshStreetViewUrl (Admin SDK equivalent).
 * Returns '' if Street View is unavailable at this location.
 */
async function _refreshStreetViewUrl(zpid, lat, lng, mapsKey, db, bucket, address = null) {
    const storagePath = `properties/${zpid}/maps/street_view.jpg`;

    // Step 1: Metadata call to verify SV availability and get heading
    const metaUrl =
        `https://maps.googleapis.com/maps/api/streetview/metadata` +
        `?location=${lat},${lng}&radius=100&source=outdoor&key=${mapsKey}`;
    const meta = await fetch(metaUrl).then(r => r.json()).catch(() => null);
    if (!meta || meta.status !== 'OK') {
        console.log(`[Batch] No Street View coverage for ${zpid} (status=${meta?.status || 'error'}). Skipping SV refresh.`);
        return '';
    }

    // Compute heading from pano coords → property
    const panoLat = meta.location?.lat ?? lat;
    const panoLng = meta.location?.lng ?? lng;
    const heading = Math.round(_computeBearing(panoLat, panoLng, lat, lng));

    // Step 2: Fetch street view image
    const svApiUrl =
        `https://maps.googleapis.com/maps/api/streetview` +
        `?size=640x640&location=${lat},${lng}` +
        `&fov=90&radius=100&source=outdoor&return_error_code=true` +
        `&heading=${heading}&key=${mapsKey}`;

    console.log(`[Batch] Re-fetching street view for ${zpid} (heading=${heading}°)...`);
    const res = await fetch(svApiUrl);
    if (!res.ok) {
        console.warn(`[Batch] Street View image API ${res.status} for ${zpid}.`);
        return '';
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const file = bucket.file(storagePath);
    await file.save(buf, { metadata: { contentType: 'image/jpeg' }, resumable: false });
    await file.makePublic();
    const [fileMetadata] = await file.getMetadata();
    const freshUrl = fileMetadata.mediaLink ||
        `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Persist fresh URL + heading to Firestore
    await db.collection('properties').doc(zpid).update({
        streetView: freshUrl,
        streetViewHeadingDeg: heading,
    });
    console.log(`[Batch] Street view re-cached for ${zpid} (heading=${heading}°): ${freshUrl.slice(0, 80)}...`);
    return freshUrl;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function _buildOrientationPrompt(usesDualImage, address, description, streetBearing, streetSide, svHeading, roadmapLabel) {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const sideLabel = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST', NE: 'NORTHEAST', NW: 'NORTHWEST', SE: 'SOUTHEAST', SW: 'SOUTHWEST' }[streetSide] || null;
    // GPS direct azimuth suggestion — only fires when streetSide is non-null.
    // Curve detection suppresses it for curved roads; this is safe for short straight streets.
    // Gives Gemini an actual degree value so it works even when the roadmap reads an inconsistent bearing.
    const SIDE_AZ_MAP = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    const sideAzimuth = streetSide ? SIDE_AZ_MAP[streetSide] : null;
    const sideFact = (streetBearing == null && sideLabel && sideAzimuth != null)
        ? ` ⚠️ GPS DIRECT ANSWER (override roadmap perpendicular rule): GPS road-offset geometry confirms "${streetName || address}" is to the ${sideLabel} of this property. Set azimuth_degrees ≈ ${sideAzimuth}° (${sideLabel}). Only override this if the aerial driveway/walkway CLEARLY exits toward a completely different direction — otherwise trust the GPS.`
        : '';
    // Streets ending in Ct/Court/Cir/Circle are almost always dead-end or cul-de-sac — pre-alert Gemini.
    const lastWord = (streetName || '').trim().split(/\s+/).pop()?.toLowerCase() || '';
    const culDeSacSuffix = /^(ct|court|cir|circle|pl|place)$/.test(lastWord);
    const culDeSacSuffixHint = culDeSacSuffix
        ? `\n⚠️ CUL-DE-SAC / DEAD-END ALERT: "${streetName}" ends in "${lastWord.charAt(0).toUpperCase() + lastWord.slice(1)}" — streets with this suffix are almost always cul-de-sacs or dead-end courts. On the road map image, look for a circular loop or dead-end terminus for "${streetName}". If found (even if not a perfect circle): classify as cul_de_sac, SKIP the perpendicular rule, and derive the front direction by drawing a vector from the property center toward the dead-end/loop center.`
        : '';
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}"\nFront entrance MUST face "${streetName || address}".${sideFact}${culDeSacSuffixHint}\n• DRIVEWAY CONNECTION REQUIRED: A road is only a valid front street if a driveway or walkway directly connects the property to it with no barrier. If a road is separated by a green belt, tree row, or park strip with NO driveway crossing, it is NOT the front street.\n• Do NOT default to the largest or nearest road — look for where the driveway actually exits.` : '';
    const descHint = (() => {
        if (!description) return '';
        const text = Array.isArray(description) ? description.join(' ') : description;
        return `\n\n🏷️ LISTING DESCRIPTION (seller-provided — highest-priority signal):\n"${text}"\nIf it states a cardinal facing direction, treat as ground truth.`;
    })();
    const bearingHint = streetBearing != null ? (() => {
        const p1 = (streetBearing + 90) % 360, p2 = (streetBearing - 90 + 360) % 360;
        const p3 = (streetBearing + 180) % 360;
        return `\nGPS STREET BEARING ADVISORY — READ BEFORE USING:\n`
            + `⛔ CUL-DE-SAC / DEAD-END COURT OVERRIDE (MANDATORY — check FIRST):\n`
            + `   Before using this bearing, look at Image A: is this a cul-de-sac (circular dead-end) or dead-end court?\n`
            + `   YES → DISCARD this GPS bearing completely. Do NOT use it AT ALL. Derive the front direction\n`
            + `          purely from aerial: draw a vector from the property center to the cul-de-sac circle center\n`
            + `          — that direction is the front. The GPS bearing is from the approach road, NOT the circle.\n`
            + `   NO  → Street runs at ~${Math.round(streetBearing)}°. Front most likely faces `
            + `${_dir8(p1)} (~${Math.round(p1)}°) or ${_dir8(p2)} (~${Math.round(p2)}°) — perpendicular to road.\n`
            + `⛔ FORBIDDEN (straight standard lot only): ~${Math.round(streetBearing)}° and ~${Math.round(p3)}° are road-parallel. Do NOT output these unless the visual override applies.`;
    })() : '';

    const streetName2 = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : 'the address street';
    const roadmapStep = roadmapLabel
        ? `\nSTREET DIRECTION — MAP FIRST (Image ${roadmapLabel}):\n` +
          `  Image ${roadmapLabel} is a labeled road map (North-up, zoom 16) centered on the property (red dot).\n` +
          `  1. Find "${streetName2}" on Image ${roadmapLabel} by reading the street name labels.\n` +
          `     → If the label is clearly readable: read the bearing the road travels (0°=N, 90°=E, 180°=S, 270°=W) and set street_bearing_from_map to this value. This is more reliable than estimating from satellite texture.\n` +
          `     → If the label is NOT visible or the street cannot be identified on the map: set street_bearing_from_map=null and estimate the bearing from Image A (satellite) as a fallback.\n` +
          `  2. PERPENDICULAR RULE: your final azimuth_degrees must be ~perpendicular (±45°) to street_bearing_from_map (or your satellite estimate if map was unclear).\n` +
          `     If your azimuth is within 15° of the road bearing (road-parallel), you have made the most common error — correct to the nearest perpendicular.\n` +
          `     → TIE-BREAKER: a road has two perpendiculars (e.g. NE and SW). If a GPS TIE-BREAKER is stated in the PROPERTY ADDRESS section above, use it to pick the correct perpendicular.\n` +
          `  ⚠️ CORNER LOT / BEND EXCEPTION: On curved streets or at road bends, the local road segment may run roughly TOWARD the property — in that case the front faces the road directly (not perpendicular to it). If a GPS TIE-BREAKER gives a direction that is approximately PARALLEL to the local road bearing (within 45°), trust the GPS direction — it is telling you the road arrives at your face, so face it directly.\n` +
          `  ⚠️ CUL-DE-SAC EXCEPTION: if the map shows "${streetName2}" terminates in a circular dead-end, IGNORE the perpendicular rule — derive direction from aerial (property center → cul-de-sac center).`
        : '';

    if (usesDualImage) {
        return [
            `You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up), a Street View image (Image B)${roadmapLabel ? `, and a labeled Road Map (Image ${roadmapLabel}, North-up)` : ''} of a property.`,
            svHeading != null ? `\n\nCAMERA HEADING: ${Math.round(svHeading)}\u00b0 (0\u00b0=North, 90\u00b0=East, 180\u00b0=South, 270\u00b0=West)\nThe camera was pointing in direction ${Math.round(svHeading)}\u00b0 when it captured Image B.` : '',
            addressClue, descHint, bearingHint,
            roadmapStep,
            `\nGUIDING PRINCIPLES:`,
            `1. IMAGE A IS THE ANCHOR: North is strictly at the top. Identify the building footprint and driveway. For street direction, prefer the road map — use Image A as fallback only if the map label is unclear.`,
            `2. WALKWAY RULE: Trace the pedestrian walkway from the public sidewalk to the main door. That wall is the architectural FRONT.`,
            `3. DRIVEWAY/GARAGE (supporting): Garage and front door are usually on the SAME wall. Driveway runs from street to garage.`,
            `\nTASK:`,
            `Step 0: Quality/Construction check. Blurry → image_quality="blurry", UNCLEAR_IMAGE. Under construction → is_under_construction=true, UNDER_CONSTRUCTION.`,
            `Step 0b: Street View Usability. Mark street_view_shows_front=null (rely on aerial only) if Image B is: privacy blurred, solid wall/fence, OR house is too far away / obstructed by trees/vegetation. Do NOT apply heading math when street_view_shows_front=null.`,
            `  TOWNHOUSE/CONDO EXTRA GATE: set front_door_clearly_visible=true ONLY if ALL are true: (a) clearly distinct residential PEDESTRIAN door visible — a walk-through door with a handle. A GARAGE DOOR (vehicle roller/sectional door) is NEVER a front door even if it faces the main road. (b) direct pedestrian path from sidewalk to THAT door. (c) not a garage roller door, shared lobby, or rear gate. (d) close enough to identify as THIS unit.\n  GARAGE-ONLY TRAP (most common failure for modern townhouses): If Image B shows only garage/roller doors filling the ground floor with NO walk-through pedestrian door visible — even if the garage faces the main road — set front_door_clearly_visible=false IMMEDIATELY. Do not look for workarounds.\n  DISTANCE/AMBIGUITY TRAP: if doors are far or multiple identical unit doors visible with no way to tell which is this address → front_door_clearly_visible=false.`,
            `Step 1: Layout detection — classify as standard, cul_de_sac, corner_lot, flag_lot, or other.\n   CORNER LOT (look carefully — this is the most commonly mis-classified type):\n     A property is a corner lot when TWO named public roads form its boundary, meeting at an intersection adjacent to the lot.\n     HOW TO IDENTIFY (use traffic-lane signals, NOT curb corner geometry):\n       (a) Can you see two distinct traffic lanes (lane markings, consistent road width, curbs/sidewalks along each) meeting at a junction or T-intersection?\n       (b) Does one edge of the property border each of these two roads?\n       ⚠️ CURVED CURBS DO NOT DISQUALIFY: Modern intersections have CURVED corner curbs (rounded radius turns) — the curbs do NOT meet at a sharp right angle. A rounded corner curve at the lot corner is NORMAL for corner lots, NOT evidence it is standard. Look for TWO road surfaces forming a junction — not for sharp perpendicular curb lines.\n     NOT a corner lot: private internal roads, parking aisles, alleys, shared courtyards — even if road-like.\n     KEY TEST: Are there two distinct public road surfaces forming a junction that is adjacent to or touches this lot? If yes → corner_lot.\n     CUL-DE-SAC PRECEDENCE: if one of the two streets terminates as a circular dead-end (cul-de-sac circle) AND the property driveway directly connects to that circle, classify as cul_de_sac — NOT corner_lot.\n   CUL-DE-SAC DIRECTION: draw a vector from property center (P) → cul-de-sac center (C). Use BOTH axes: upper-left=NW, upper-right=NE, lower-left=SW, lower-right=SE. Do NOT collapse a diagonal to a cardinal (e.g. upper-left is NW ~315°, NOT west 270° or southwest 225°).`,
            `Step 2: Aerial front-wall identification. FACING CONVENTION (CRITICAL — all 8 directions valid): front faces TOWARD the street. South=180°, SE=135°, SW=225°, N=0°, NE=45°, NW=315°, E=90°, W=270°. NEVER collapse diagonal to cardinal (if street is lower-right=SE, face SE not south). NEVER invert (street south=face south, not north). DIRECTION PRECISION: trace driveway toward street using BOTH axes — upper-left=NW, upper-right=NE, lower-left=SW, lower-right=SE. Only use N/E/S/W when movement is almost entirely one-axis. DRIVEWAY CONNECTION RULE: only count a road as the front street if a driveway physically connects to it — a road blocked by a green belt, tree row, or barrier with no driveway crossing is NOT the front street.`,
            `Step 3: Image B judgment ONLY. Look at Image B — does it show the FRONT (door, porch, entry) or BACK (blank wall, fence)? Judge from the image alone, NOT from your Step 2 aerial conclusion. Set street_view_shows_front = true (front visible) or false (back/side visible) or null (obstructed/blurred/too far). The system computes the final azimuth from GPS heading + your answer. Do NOT compute azimuth yourself or adjust this field to match your Step 2 guess.`,
            `Step 4: Finalize — output final_orientation, azimuth_degrees, confidence, property_layout_type.\n   IF street_view_shows_front = FALSE (set in Step 3): ⚠️ GARAGE-SIDE CORRECTION. The camera confirmed it was NOT seeing the front. This means the driveway you traced in Step 2 connects to the GARAGE, NOT the front entrance. The Step 2 azimuth is the GARAGE direction — do NOT use it as the final answer. Re-examine Image A: (a) look for a pedestrian walkway on any OTHER face of the house. (b) If a clear pedestrian path is visible on another face, set azimuth_degrees to THAT face. (c) If no other face shows a clear walkway, set final_orientation='UNCLEAR', azimuth_degrees=null, confidence='low'.`,
            `ADDITIONAL: Assess privacy sightlines, lot coverage (hardscape/pervious %), pool/garage directions, buyer pro/con.`,
            `EXPLANATION FORMAT — use this EXACT structure:\n(1) LAYOUT: layout type and one visual reason.\n(2) STREET CONTEXT: name the address street, its bearing as read from the road map (Image C/B), and which edge of the property it runs along.\n(3) AERIAL EVIDENCE: what the driveway/walkway shows, which road edge it connects to, and the raw aerial azimuth estimate.\n(4) IMAGE B EVIDENCE: state the camera heading in degrees, what Image B shows (front/back/uninformative), and how street_view_shows_front was set.\n(5) FINAL: final azimuth in degrees and compass label, confidence.`,
        ].join('\n').trim();
    }

    return [
        `You are a spatial analysis expert. I am providing one aerial satellite image (Image A, North-up)${roadmapLabel ? ` and a labeled Road Map (Image ${roadmapLabel}, North-up)` : ''}.`,
        addressClue, bearingHint, descHint,
        roadmapStep,
        `\nGUIDING PRINCIPLES:`,
        `1. NORTH IS UP: Use the top of the frame as 0° North.`,
        `2. WALKWAY RULE (MANDATORY): Front of property = where the pedestrian path from the public sidewalk leads to the main door.`,
        `3. ADDRESS STREET PRIORITY: When multiple streets are visible, give strong priority to the address street.`,
        `4. TOWARD RULE (most common error): The front faces TOWARD the road — in the direction FROM the lot center TO the road. The direction the road TRAVELS is irrelevant. Road on the NE edge → front faces NE (~45°), NOT NW or SE. Road on N edge → front faces N (~0°). TRAP: "road runs NW/SE along NE edge" → front faces NE, never NW or SE.`,
        roadmapLabel ? `5. STREET DIRECTION: prefer Image ${roadmapLabel} (road map labels) for road bearing — only fall back to satellite texture in Image A if the street label is not clearly readable on the map.` : '',
        `\nLAYOUT CLASSIFICATION (do FIRST):`,
        `CORNER LOT: A property is a corner lot when TWO named public roads form its boundary, meeting at an intersection adjacent to the lot.\n  HOW TO IDENTIFY — use traffic-lane signals, NOT curb corner geometry:\n  (a) Can you see two distinct traffic lanes (lane markings, consistent road width, curbs/sidewalks) meeting at a junction or T-intersection?\n  (b) Does one edge of the property border each of these two roads?\n  ⚠️ CURVED CURBS DO NOT DISQUALIFY: Modern intersections have CURVED corner curbs (rounded radius turns). A rounded corner curve at the lot corner is NORMAL for corner lots — do not read it as evidence the lot is standard.\n  KEY TEST: Two distinct public road surfaces forming a junction adjacent to this lot? If yes → corner_lot.\n  NOT a corner lot: private internal roads, parking aisles, alleys, shared courtyards.`,
        `Set standard_street_layout = FALSE if: corner lot, flag lot, curved/loop street (CT, CIR, LOOP, COURT in name), side-loading entry, or rural acreage.`,
        `Set standard_street_layout = TRUE only for simple rectangular lots on straight non-looping streets.`,

        `\nCONFIDENCE GATE (MANDATORY): If you cannot clearly identify driveway apron OR pedestrian walkway with HIGH confidence:`,
        `→ confidence='low', final_orientation='UNCLEAR', azimuth_degrees=null.`,
        `\nTASK:`,
        `Step 1 — Layout: classify lot type using the CORNER LOT criteria above.`,
        `Step 2 — Driveway Apron: verify curb cut (driveway connects to public road with no gap or fence interruption).`,
        `Step 3 — Front Walk: look for pedestrian path to main door.`,
        `Step 4 — State compass direction the front wall faces (0°=N, 90°=E, 180°=S, 270°=W). PERPENDICULAR RULE (MANDATORY): azimuth must be ~perpendicular (±45°) to street_bearing_from_map (read from the road map) — never parallel to it. If street_bearing_from_map≈315°, valid azimuths are ~45° or ~225°. If street_bearing_from_map≈90°, valid azimuths are ~0° or ~180°. If your azimuth is within 15° of street_bearing_from_map you have made an error — correct to the nearest perpendicular.`,
        `Step 5 — Assess: privacy sightlines, lot coverage (hardscape/pervious %), pool/garage/yard directions, buyer pro/con.`,
        `Step 6 — GPS Self-Check (only if bearing prior given): verify azimuth is within 45° of a perpendicular. Correct if ≥45° off; note if corrected. PARALLEL CHECK (always run): if your azimuth is within 15° of the road bearing itself (not the perpendicular), you have made the most common error — correct to nearest perpendicular or set UNCLEAR.`,
        `\nEXPLANATION FORMAT — use this EXACT structure:\n(1) LAYOUT: standard_street_layout=true/false and one specific visual reason.\n(2) STREET CONTEXT: name the address street, its bearing as read from the road map, and which edge of the property it runs along.\n(3) AERIAL EVIDENCE: what the driveway/walkway shows and which road edge it connects to; include the raw aerial azimuth estimate.\n(4) GPS SELF-CHECK: whether a correction was applied; if yes: "GPS self-check: adjusted from X° to Y°"; if no: "No correction needed".\n(5) FINAL: final orientation and confidence.`,


    ].join('\n').trim();
}

/**
 * Prompt for the listing-photos fallback mode.
 * Called when no usable street view is available but we found exterior/aerial listing photos.
 * Image order sent to Gemini:
 *   Image A = aerial satellite (cached, North-up)
 *   Image B..D = listing gallery photos (exterior / aerial, from image_by_image_analysis)
 *
 * @param photoMeta - metadata for selected photos [{index, url, score, analysisSnippet}]
 */
function _buildListingPhotoPrompt(address, description, streetBearing, streetSide, photoCount, photoMeta = []) {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const sideLabel = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST', NE: 'NORTHEAST', NW: 'NORTHWEST', SE: 'SOUTHEAST', SW: 'SOUTHWEST' }[streetSide] || null;
    const SIDE_AZ_MAP2 = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    const sideAzimuth2 = streetSide ? SIDE_AZ_MAP2[streetSide] : null;
    const sideFact = (streetBearing == null && sideLabel && sideAzimuth2 != null)
        ? ` \u26a0\ufe0f GPS DIRECT ANSWER (override roadmap perpendicular rule): GPS road-offset geometry confirms "${streetName || address}" is to the ${sideLabel} of this property. Set azimuth_degrees \u2248 ${sideAzimuth2}\u00b0 (${sideLabel}). Only override if the aerial driveway/walkway CLEARLY exits in a completely different direction.`
        : '';
    const lastWord2 = (streetName || '').trim().split(/\s+/).pop()?.toLowerCase() || '';
    const culDeSacSuffix2 = /^(ct|court|cir|circle|pl|place)$/.test(lastWord2);
    const culDeSacSuffixHint2 = culDeSacSuffix2
        ? `\n\u26a0\ufe0f CUL-DE-SAC / DEAD-END ALERT: "${streetName}" ends in "${lastWord2.charAt(0).toUpperCase() + lastWord2.slice(1)}" \u2014 streets with this suffix are almost always cul-de-sacs or dead-end courts. Look for a circular loop or dead-end terminus for "${streetName}". If found: classify as cul_de_sac and derive the front direction by drawing a vector from property center toward the dead-end/loop center.`
        : '';
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}"\nFront entrance MUST face "${streetName || address}".${sideFact}${culDeSacSuffixHint2}\n\u2022 DRIVEWAY CONNECTION REQUIRED: A road is only a valid front street if a driveway or walkway directly connects the property to it with no barrier.` : '';
    const descHint = (() => {
        if (!description) return '';
        const text = Array.isArray(description) ? description.join(' ') : description;
        return `\n\n\uD83C\uDFF7\uFE0F LISTING DESCRIPTION (seller-provided \u2014 highest-priority signal):\n"${text}"\nIf it states a cardinal facing direction, treat as ground truth.`;
    })();
    const bearingHint = streetBearing != null ? (() => {
        const p1 = (streetBearing + 90) % 360, p2 = (streetBearing - 90 + 360) % 360;
        const p3 = (streetBearing + 180) % 360;
        return `\nGPS STREET BEARING ADVISORY — READ BEFORE USING:\n`
            + `⛔ CUL-DE-SAC / DEAD-END COURT OVERRIDE (MANDATORY — check FIRST):\n`
            + `   Before using this bearing, look at Image A: is this a cul-de-sac (circular dead-end) or dead-end court?\n`
            + `   YES → DISCARD this GPS bearing completely. Do NOT use it AT ALL. Derive the front direction\n`
            + `          purely from aerial: draw a vector from property center to cul-de-sac circle center.\n`
            + `   NO  → Street runs at ~${Math.round(streetBearing)}°. Front most likely faces `
            + `${_dir8(p1)} (~${Math.round(p1)}°) or ${_dir8(p2)} (~${Math.round(p2)}°).\n`
            + `⛔ FORBIDDEN (straight standard lot only): ~${Math.round(streetBearing)}° and ~${Math.round(p3)}° are road-parallel.`;
    })() : '';

    // Build per-photo labels so Gemini knows what each image is (aerial vs ground-level)
    const photoLabels = photoMeta.map((p, i) => {
        const isAerial = /aerial|drone|bird|overhead|top.?down|from above/i.test(p.analysisSnippet || '');
        const imgLetter = String.fromCharCode(66 + i); // B, C, D...
        const typeLabel = isAerial
            ? 'AERIAL/DRONE listing photo \u2014 shows building footprint from above (different angle than Image A)'
            : 'exterior/ground-level listing photo';
        return `  Image ${imgLetter} = Listing photo #${p.index + 1} (${typeLabel}): "${(p.analysisSnippet || '').trim()}"`;
    }).join('\n');

    return [
        `You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and ${photoCount} listing photo(s) from the property gallery.`,
        `\nIMAGE GUIDE:\n  Image A = cached satellite aerial \u2014 North is UP. Use as authoritative layout reference.`,
        photoLabels ? photoLabels : '',
        `\n\u26A0\uFE0F LISTING PHOTOS KEY RULES:`,
        `  \u2022 AERIAL/DRONE listing photos: compare with Image A to confirm which face of the building has the main entry/driveway toward the address street. They may show the property at a different zoom/angle than the cached satellite.`,
        `  \u2022 GROUND-LEVEL exterior photos: look for front door, porch, entryway, or driveway apron. Set street_view_shows_front=true if the main entry is clearly visible; false if only garage/side/back; null if inconclusive.`,
        `  \u2022 Do NOT set street_view_shows_front=true unless you can clearly see the front door or main pedestrian entry.`,
        addressClue, descHint, bearingHint,
        `\nGUIDING PRINCIPLES:`,
        `1. Image A IS THE ANCHOR: North is strictly at the top. Identify the building footprint, street, and driveway.`,
        `2. WALKWAY RULE: Trace the pedestrian walkway from the public sidewalk to the main door. That wall is the architectural FRONT.`,
        `3. LISTING PHOTOS supplement the aerial by confirming which face of the building matches the front entry.`,
        `\nLAYOUT CLASSIFICATION (do FIRST):`,
        `CORNER LOT: Two named public roads meeting at an intersection adjacent to the lot \u2192 corner_lot.`,
        `CUL-DE-SAC: Circular dead-end street; driveway connects to the circle \u2192 cul_de_sac.`,
        `Set standard_street_layout=FALSE for: corner lot, flag lot, curved/loop street, cul-de-sac.`,
        `\nCONFIDENCE GATE (MANDATORY): If you cannot clearly identify driveway apron OR pedestrian walkway from aerial + listing photos combined:`,
        `\u2192 confidence='low', final_orientation='UNCLEAR', azimuth_degrees=null.`,
        `\nTASK:`,
        `Step 1 \u2014 Layout: classify lot type.`,
        `Step 2 \u2014 Aerial analysis: identify building footprint, driveway, and candidate front wall from Image A.`,
        `Step 3 \u2014 Listing photo confirmation: for each listing photo (Images B, C, D…), decide if it shows the building exterior or front door \u2014 NOT an interior room (kitchen, bedroom, bathroom, living area, etc.). Set street_view_shows_front based on the best exterior photo found. Set listing_photos_showing_front to an array of image labels (e.g. [\"B\",\"C\"]) for every photo that showed the exterior or front door; use an empty array if none did.`,
        `Step 4 \u2014 Front wall compass direction (0\u00b0=N, 90\u00b0=E, 180\u00b0=S, 270\u00b0=W). PERPENDICULAR RULE: azimuth must be ~perpendicular (\u00b145\u00b0) to the road bearing. If parallel \u2192 correct or set UNCLEAR.`,
        `Step 5 \u2014 Assess: privacy sightlines, lot coverage (hardscape/pervious %), pool/garage directions, buyer pro/con.`,
        `\nEXPLANATION FORMAT \u2014 use this EXACT structure:\n(1) LAYOUT: type and one visual reason.\n(2) STREET CONTEXT: address street, which edge, approximate bearing.\n(3) AERIAL EVIDENCE: driveway/walkway on Image A, which road edge it connects to, raw aerial azimuth.\n(4) LISTING PHOTO EVIDENCE: what each listing photo shows, whether aerial vs ground-level, and how street_view_shows_front was set.\n(5) FINAL: final orientation and confidence.`,
    ].join('\n').trim();
}

// ─── Core: analyze a single property ─────────────────────────────────────────


async function _analyzeOneProperty(zpid, db, geminiKey, mapsKey) {
    // 1. Read property from Firestore (Admin SDK)
    const propSnap = await db.collection('properties').doc(zpid).get();
    if (!propSnap.exists) throw new Error(`Property ${zpid} not found`);
    const prop = propSnap.data();

    const address = prop.address || '';
    const homeType = (prop.homeType || '').toUpperCase();
    let aerialUrl = prop.satelliteImageUrl || null;
    let svUrl = prop.streetView || prop.streetViewAnalysis?.imageUrl || null;

    if (!aerialUrl) throw new Error(`No cached aerial image for ${zpid}`);

    // 2. Street bearing via Maps Geocoding API
    // Extract property centroid from satelliteImageUrl (center=lat,lng param) or Firestore fields.
    // Used by _getStreetBearing for cross-product streetSide computation on diagonal roads.
    let propLat = prop.latitude ?? prop.location?.latitude ?? null;
    let propLng = prop.longitude ?? prop.location?.longitude ?? null;
    if ((propLat == null || propLng == null) && aerialUrl) {
        const m = aerialUrl.match(/[?&]center=([-\d.]+),([-\d.]+)/);
        if (m) { propLat = parseFloat(m[1]); propLng = parseFloat(m[2]); }
    }
    if (propLat != null) console.log(`[Batch] Property centroid ${zpid}: ${propLat.toFixed(5)},${propLng.toFixed(5)}`);

    let streetBearing = null, streetSide = null;
    try {
        const br = await _getStreetBearing(address, mapsKey, propLat, propLng);
        streetBearing = br?.bearing ?? null;
        streetSide = br?.streetSide ?? null;
    } catch (e) { console.warn(`[Batch] Street bearing failed for ${zpid}:`, e.message); }

    // 2b. Resolve storage bucket for image re-caching
    const bucket = admin.storage().bucket();

    // 3. Health-check cached image URLs. If expired (404/403), re-fetch from Google APIs.
    // This avoids silent aerial-only fallback caused purely by expired Firebase Storage tokens.
    const [aerialAlive, svAlive] = await Promise.all([
        _isUrlAlive(aerialUrl),
        _isUrlAlive(svUrl),
    ]);

    if (!aerialAlive && propLat != null) {
        console.warn(`[Batch] ${zpid}: Aerial URL expired/dead — re-fetching from Google Maps Static API.`);
        try { aerialUrl = await _refreshAerialUrl(zpid, propLat, propLng, mapsKey, db, bucket); }
        catch (e) { console.warn(`[Batch] ${zpid}: Aerial re-fetch failed:`, e.message); }
    } else if (!aerialAlive) {
        console.warn(`[Batch] ${zpid}: Aerial URL dead but no coordinates available — cannot refresh.`);
    }

    if (svUrl && !svAlive && propLat != null) {
        console.warn(`[Batch] ${zpid}: Street view URL expired/dead — re-fetching from Street View API.`);
        try {
            const freshSv = await _refreshStreetViewUrl(zpid, propLat, propLng, mapsKey, db, bucket, address);
            svUrl = freshSv || null;
        } catch (e) { console.warn(`[Batch] ${zpid}: Street view re-fetch failed:`, e.message); svUrl = null; }
    } else if (!svAlive) {
        svUrl = null;
    }

    // 3b. Download (now using fresh/valid URLs)
    const aerialImg = await _downloadImageBase64(aerialUrl);
    let svImg = null;
    if (svUrl) {
        try { svImg = await _downloadImageBase64(svUrl); }
        catch (e) { console.warn(`[Batch] SV download failed for ${zpid}:`, e.message); }
    }

    // 4. Multi-unit gate: shared-building types where street view/listing photos can't
    //    reliably identify a specific unit's entrance. Townhouses are excluded — they have
    //    their own front door, driveway, and exterior and behave like single-family homes.
    const isMultiUnit = ['CONDO', 'APARTMENT', 'MULTI_FAMILY'].includes(homeType);
    const usesDualImage = svImg !== null && !isMultiUnit;

    // 4a. Listing photos fallback: fetch exterior listing photos from the gallery for ALL
    // single-family properties. These are used:
    //   (a) PRIMARY mode — when there is no street view at all (aerial-only)
    //   (b) FALLBACK mode — when street view was sent but Gemini found it uninformative
    //       (shows_front=null, e.g. blurry/obstructed/privacy-blurred). In this case we
    //       retry Gemini with aerial + listing photos instead of forcing UNCLEAR.
    // Multi-unit properties remain aerial-only (listing photos won't reliably show «s unit front).
    let listingPhotoImgs = [];
    let listingPhotosUsed = [];  // [{index, url, score, analysisSnippet}]
    if (!isMultiUnit) {
        try {
            const visualSnap = await db.collection('properties').doc(zpid).collection('analysis').doc('visual').get();
            if (visualSnap.exists) {
                const visualData = visualSnap.data();
                const bestItems = _findBestExteriorPhotos(visualData.image_by_image_analysis, 3);
                if (bestItems.length > 0) {
                    const results = await Promise.allSettled(bestItems.map(item => _downloadImageBase64(item.url)));
                    listingPhotoImgs = results
                        .filter(r => r.status === 'fulfilled')
                        .map(r => r.value);
                    listingPhotosUsed = bestItems
                        .filter((_, i) => results[i]?.status === 'fulfilled')
                        .map(item => ({
                            index: item.index,
                            url: item.url,
                            score: item.score,
                            analysisSnippet: item.analysisSnippet,
                        }));
                    if (listingPhotoImgs.length > 0) {
                        const mode = usesDualImage ? 'pre-fetched for SV-fallback' : 'primary listing-photo mode';
                        console.log(`[Batch] ${zpid}: Found ${listingPhotoImgs.length} listing photo(s) (indices: [${listingPhotosUsed.map(i => i.index).join(', ')}]) — ${mode}.`);
                    }
                    if (listingPhotoImgs.length < results.length) {
                        console.warn(`[Batch] ${zpid}: ${results.filter(r => r.status !== 'fulfilled').length} listing photo(s) failed to download.`);
                    }
                }
            }
        } catch (e) {
            console.warn(`[Batch] ${zpid}: Listing photos lookup failed (non-blocking):`, e.message);
        }
    }

    // 4b. Resolve street-view camera heading BEFORE building the prompt.
    // Priority: (1) streetViewHeadingDeg Firestore field (set by backfillStreetViewHeadingDeg),
    //           (2) &heading= embedded in the SV URL (set by test infrastructure).
    // This MUST come before step 5 so the heading can be injected into the Gemini prompt.
    const svHeadingFromField = typeof prop.streetViewHeadingDeg === 'number' ? prop.streetViewHeadingDeg : null;
    const svHeadingUrlMatch = (svUrl ?? '').match(/[&?]heading=([\d.]+)/);
    let svHeading = svHeadingFromField ?? (svHeadingUrlMatch ? parseFloat(svHeadingUrlMatch[1]) : null);
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
        const SIDE_AZ = { N: 0, S: 180, E: 90, W: 270, NE: 45, SE: 135, SW: 225, NW: 315 };
        const sideAz = SIDE_AZ[streetSide];
        if (sideAz !== undefined) {
            const candidateFront = (svHeading + 180) % 360;
            const candidateBack = svHeading;
            const frontAligned = _angDiff(candidateFront, sideAz) <= 75;
            const backAligned = _angDiff(candidateBack, sideAz) <= 75;
            if (!frontAligned && !backAligned) {
                console.warn(`[Batch] ${zpid}: cached heading ${Math.round(svHeading)}\u00b0 is inconsistent with streetSide=${streetSide} (road is to the ${streetSide}). candidateFront=${Math.round(candidateFront)}\u00b0 is ${Math.round(_angDiff(candidateFront, sideAz))}\u00b0 away \u2014 heading discarded. Gemini will judge from image only.`);
                svHeading = null;
            }
        }
    }


    // 4d. Fetch labeled roadmap image for Gemini street-direction reading.
    // Google Maps Static roadmap at zoom 16 shows street names — Gemini reads the address
    // street bearing from it instead of guessing from satellite texture.
    let roadmapImg = null;
    if (propLat != null && propLng != null && mapsKey) {
        try {
            roadmapImg = await _fetchRoadmapImage(propLat, propLng, mapsKey);
            console.log(`[Batch] ${zpid}: Roadmap image fetched.`);
        } catch (e) {
            console.warn(`[Batch] ${zpid}: Roadmap fetch failed (non-blocking):`, e.message);
        }
    }
    // Image labeling: aerial=A, then street-view=B (dual-image) or roadmap=B (aerial-only),
    // and roadmap=C for dual-image.
    const roadmapLabel = roadmapImg ? (usesDualImage ? 'C' : 'B') : null;

    // 5. Build prompt and call Gemini 2.5 Flash
    // Listing photos are NEVER used in the primary call — only as a fallback for UNCLEAR results.
    // Pattern B (SV uninformative) and Pattern C (catch-all UNCLEAR) handle the retry.
    let usesListingPhotos = false;
    const prompt = _buildOrientationPrompt(usesDualImage, address, prop.description || null, streetBearing, streetSide, svHeading, roadmapLabel);
    const parts = [
        { text: prompt },
        { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } },
        ...(usesDualImage
            ? [{ inlineData: { mimeType: svImg.mimeType, data: svImg.data } }]
            : []
        ),
        ...(roadmapImg
            ? [{ inlineData: { mimeType: roadmapImg.mimeType, data: roadmapImg.data } }]
            : []
        ),
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
        const candidateBack = svHeading % 360;           // face toward camera = face camera can't see
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
    const resultAzimuth = headingAzimuth ?? (data.azimuth_degrees ?? null);
    const aerialConfidenceFail = !usesDualImage && (data.confidence !== 'high' || resultAzimuth == null);
    let finalAzimuth = aerialConfidenceFail ? null : resultAzimuth;

    // Policy: if imagery was inconclusive, always emit UNCLEAR — never guess from street
    // bearing alone. The street-bearing fallback azimuth is discarded.
    if (aerialConfidenceFail) {
        finalAzimuth = null;
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
        const SIDE_AZ = { N: 0, S: 180, E: 90, W: 270, NE: 45, SE: 135, SW: 225, NW: 315 };
        const sideAz = SIDE_AZ[streetSide];
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
                finalAzimuth = corrected;
                data.confidence = 'medium';
            }
        }

    }


    let finalOrientation = finalAzimuth != null ? _azimuthToCompassLabel(finalAzimuth) : 'UNCLEAR';

    // Post-processing gate 1: ALL property types — aerial-only with ambiguous layout → UNCLEAR
    // (a) non-standard layout (curved road, flag lot, etc.)
    // (b) corner lot — two frontages, cannot pick primary without street view
    // (c) cul-de-sac — faces outward toward the court; cannot confirm without street view
    // Listing photos mode gives us front-facade confirmation similar to street view.
    // For layout/confidence policy gates, treat it like dual-image mode.
    const aerialOnlyMode = !usesDualImage && !usesListingPhotos || data.street_view_shows_front === null;
    const layoutType = data.property_layout_type;
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
    const isCulDeSac = layoutType === 'cul_de_sac';

    // Corner lot exception: if listing photos VISUALLY confirmed the front door (shows_front=true)
    // with high confidence, the "two frontages ambiguous" argument is resolved by photographic evidence.
    // We still force UNCLEAR for aerial-only corner lots (no photo proof).
    // Street view confirmation alone is not sufficient here — GPS heading math for corner lots can
    // produce wrong azimuths (camera on approach road gives incorrect candidateFront). Listing photos
    // are used in Pass 2 to confirm the correct face. See Pass 2 gate below.
    const listingPhotoConfirmedFront = usesListingPhotos && data.street_view_shows_front === true && data.confidence === 'high';
    const cornerlotUnclear = isCornerLot && !listingPhotoConfirmedFront;

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
            const reason = (isCornerLot && !cornerlotUnclear)
                ? null  // listing photo exception — skip this block entirely
                : isCornerLot ? 'corner_lot (aerial-only, two frontages ambiguous)'
                    : data.standard_street_layout === false ? 'non-standard layout'
                        : 'cul_de_sac (no azimuth from aerial)';
            if (reason) {
                console.log(`[Batch] Override ${zpid}: ${reason} → UNCLEAR`);
                finalOrientation = 'UNCLEAR';
                finalAzimuth = null;
            } else {
                console.log(`[Batch] ${zpid}: corner_lot BUT listing photo confirmed front (shows_front=true, high confidence) — trusting orientation.`);
            }
        }
    }


    // Post-processing gate 2: Townhouse → UNCLEAR
    // Policy:
    //   aerial-only  + shared-wall → ALWAYS UNCLEAR (aerial alone cannot distinguish unit orientation).
    //   cul-de-sac   + townhouse   → ALWAYS UNCLEAR (curved/loop street makes direction unreliable).
    //   corner lot   + townhouse   → ALWAYS UNCLEAR (two frontages, shared walls add ambiguity).
    //   listing photos + townhouse + complex layout → ALWAYS UNCLEAR (photos confirm front face but
    //     not reliable enough on curved roads where bearing calculation is the failure point).
    //   dual-image + shared-wall + standard-straight-street → allow if front door visible.
    if (isMultiUnit && finalOrientation !== 'UNCLEAR') {
        const layoutType = data.property_layout_type;
        const complexLayout = layoutType === 'cul_de_sac' || layoutType === 'corner_lot';
        const frontDoorMissing = data.front_door_clearly_visible === false;
        const nonStandardStreet = data.standard_street_layout === false;

        if (aerialOnlyMode) {
            // Aerial-only townhouse: always UNCLEAR
            console.log(`[Batch] Override ${zpid}: townhouse + aerial_only_mode → UNCLEAR (always)`);
            finalOrientation = 'UNCLEAR';
            finalAzimuth = null;
        } else if (complexLayout) {
            // Cul-de-sac or corner lot townhouse: always UNCLEAR regardless of image mode.
            // Curved/multi-frontage roads make the bearing calculation unreliable even with photos.
            console.log(`[Batch] Override ${zpid}: townhouse + ${layoutType} → UNCLEAR (always, regardless of image mode)`);
            finalOrientation = 'UNCLEAR';
            finalAzimuth = null;
        } else if (frontDoorMissing || nonStandardStreet) {
            // Standard-ish lot but door missing or non-standard street → UNCLEAR
            const reason = frontDoorMissing ? 'front_door_clearly_visible=false' : 'standard_street_layout=false';
            console.log(`[Batch] Override ${zpid}: townhouse + ${reason} → UNCLEAR`);
            finalOrientation = 'UNCLEAR';
            finalAzimuth = null;
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
        finalAzimuth = null;
    }

    // Listing photo retry: two-pass design.
    //
    //   Pass 1: aerial + SV (or aerial-alone if no SV available)  ← done above
    //   Pass 2: triggered when Pass 1 returned UNCLEAR AND any of:
    //     a) No street view was available (!usesDualImage), OR
    //     b) Street view ran but was uninformative (street_view_shows_front === null)
    //        — camera showed a fence/carport/blank wall, contributed nothing useful.
    //     c) Street view ran but showed the wrong side (street_view_shows_front === false)
    //        — camera confirmed it was NOT the front, causing Pattern A to force UNCLEAR.
    //        Listing photos may still show the front exterior and resolve orientation.
    //     d) Complex layout (corner lot or cul-de-sac) forced UNCLEAR by the post-processing gate
    //        even when SV ran — because for these layouts GPS heading math is unreliable
    //        (camera on approach road gives wrong candidateFront) and two-frontage ambiguity
    //        is best resolved by listing photos that visually show the correct front face.
    //
    // Listing photos are NOT mixed with street view when SV was informative and confirmed
    // the front on a STANDARD lot (shows_front=true, standard layout) — doing so causes
    // hallucinations. But complex layouts and unhelpful SV all qualify for Pass 2.
    const svWasUninformative = usesDualImage && (data.street_view_shows_front === null || data.street_view_shows_front === false);
    // Complex layout (corner/cul-de-sac) forced UNCLEAR by post-processing gate — SV may have
    // run and appeared informative (shows_front=true) but GPS heading math is unreliable for
    // these layouts, so listing photos should get a chance to visually confirm the front.
    const complexLayoutForcedUnclear = isCornerOrCulDeSac;
    if (finalOrientation === 'UNCLEAR' && (!usesDualImage || svWasUninformative || complexLayoutForcedUnclear) && !isMultiUnit && !usesListingPhotos && listingPhotoImgs.length > 0) {
        console.log(`[Batch] ${zpid}: UNCLEAR (shows_front=${data.street_view_shows_front}, complexLayout=${complexLayoutForcedUnclear}) — Pass 2 with ${listingPhotoImgs.length} listing photo(s).`);
        try {
            const retryPrompt = _buildListingPhotoPrompt(address, prop.description || null, streetBearing, streetSide, listingPhotoImgs.length, listingPhotosUsed);
            const retryParts = [
                { text: retryPrompt },
                { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } },
                ...listingPhotoImgs.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
            ];
            const retryResult = await model.generateContent({ contents: [{ role: 'user', parts: retryParts }] });
            const retryData = JSON.parse(retryResult.response.text());
            // Annotate each sent photo with whether Gemini confirmed it showed the exterior/front.
            // Image labels: aerial = A, listing photos = B, C, D…
            const confirmedLabels = Array.isArray(retryData.listing_photos_showing_front)
                ? retryData.listing_photos_showing_front : [];
            listingPhotosUsed = listingPhotosUsed.map((photo, i) => ({
                ...photo,
                confirmed_front: confirmedLabels.includes(String.fromCharCode(66 + i)), // 'B','C','D'…
            }));
            if (retryData.final_orientation && retryData.final_orientation !== 'UNCLEAR') {
                console.log(`[Batch] ${zpid}: Pass 2 → ${retryData.final_orientation}. Confirmed photos: [${confirmedLabels.join(',')}]. Replacing UNCLEAR.`);
                data = retryData;
                finalAzimuth = retryData.azimuth_degrees ?? null;
                finalOrientation = finalAzimuth != null ? _azimuthToCompassLabel(finalAzimuth) : retryData.final_orientation;
                usesListingPhotos = true;
            } else {
                console.log(`[Batch] ${zpid}: Pass 2 → still UNCLEAR.`);
            }
        } catch (e) {
            console.warn(`[Batch] ${zpid}: Pass 2 listing photo retry failed:`, e.message);
        }
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
        final_orientation: finalOrientation,
        azimuth_degrees: finalAzimuth,
        visual_azimuth_estimate: data.azimuth_degrees ?? null,
        confidence: finalConfidence,
        aerial_only_mode: aerialOnlyMode,
        image_quality: data.image_quality ?? 'acceptable',
        feng_shui_vastu: data.feng_shui_vastu ?? null,
        privacy_insight: data.privacy_insight ?? '',
        lot_coverage_hardscape: (data.lot_coverage_hardscape != null && data.lot_coverage_hardscape > 0 && data.lot_coverage_hardscape <= 1) ? Math.round(data.lot_coverage_hardscape * 100) : (data.lot_coverage_hardscape ?? null),
        lot_coverage_pervious: (data.lot_coverage_pervious != null && data.lot_coverage_pervious > 0 && data.lot_coverage_pervious <= 1) ? Math.round(data.lot_coverage_pervious * 100) : (data.lot_coverage_pervious ?? null),
        buyer_pro: data.buyer_pro ?? '',
        buyer_con: data.buyer_con ?? '',
        orientation_highlights: data.orientation_highlights ?? '',
        pool_visible: data.pool_visible ?? null,
        pool_direction: data.pool_direction ?? null,
        garage_direction: data.garage_direction ?? null,
        open_sky_direction: data.open_sky_direction ?? null,
        property_layout_type: data.property_layout_type ?? null,
        explanation: data.explanation ?? null,
        is_under_construction: data.is_under_construction ?? false,
        // Listing photo provenance — which image_by_image_analysis entries were sent to Gemini.
        // null when street view was used; [] when aerial-only with no exterior photos found.
        listing_photos_used: usesListingPhotos ? listingPhotosUsed : null,
        // Function version — increment BATCH_VERSION when analysis logic changes.
        // Lets the audit UI show whether a result is from old or new code.
        batch_version: BATCH_VERSION,
        street_bearing_from_map: data.street_bearing_from_map ?? null,
    };

    await db.collection('properties').doc(zpid).set(
        { orientation_ai: orientationAI, orientation_calculated_at: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
    );

    // 9. Log orientation version (port of browser-side logOrientationVersion)
    const city = (prop.city || 'Unknown').trim();
    const zip = (prop.zipCode || prop.zip || 'Unknown').trim();
    const gtRef = db.collection('orientation_ground_truth').doc(zpid);
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

        const db = admin.firestore();
        const keysSnap = await db.collection('app_config').doc('api_keys').get();
        const keys = keysSnap.exists ? keysSnap.data() : {};
        const geminiKey = keys.gemini_key || process.env.GEMINI_API_KEY || '';
        const mapsKey = keys.maps_key || process.env.MAPS_API_KEY || '';

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
