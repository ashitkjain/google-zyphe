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
const { _extractJson, _enrichStreetInsights } = require('./shared/propertyUtils');
const UsageLogger = require('./shared/usageLogger');

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
// v21: NEW CONSTRUCTION & CORNER LOT STABILITY — forced is_under_construction=false if photos show finished home; explicit single-street rule for corner lots (no averaging); refined "Toward Rule" vectoring.
// v22: SPATIAL REASONING OPTIMIZATION — Anchor Feature cross-referencing (prevents North-hallucinations); 3x3 Grid mental mapping; Clock-Face geometric verification check (road vs door hours).
// v23: CURVED ROAD / CUL-DE-SAC REFINEMENT — Tie-breaker rule for wrap-around roads; mandatory side-by-side consistency check (garage + door).
// v24: SIDE-STREET & FENCE REJECTION — Strict rule against side-wall false positives in Street View; fixes 90-degree cul-de-sac hallucinations.
// v27: FRONT DOOR MANDATORY — If front door/entry is not visible in ground-level imagery, result MUST be UNCLEAR. Added side-by-side verification between door and driveway.
// v28: CUL-DE-SAC PROXIMITY TRAP — Added strict 'Straight Line Verification' to prevent cul-de-sac hallucinations on straight road segments leading to bulbs.
// v29: FENCE = SIDE & CARDINAL EXCLUSION — Mandates rejection of road frontages separated by fences/lawns; forces check of all cardinal directions for better driveway connections.
// v30: TOWNHOUSE/CONDO HARD STOP — Forces UNCLEAR when street view shows only a garage for multi-unit properties to prevent hallucinating ambiguous aerial pathways.
const BATCH_VERSION = 'v31'; // Modularized prompts

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
async function _getStreetBearing(address, mapsKey, propLat = null, propLng = null, logger = null) {
    const match = address.match(/^(\d+)/);
    if (!match || !mapsKey) return null;
    const houseNum = parseInt(match[1], 10);

    const geocode = async (addr) => {
        if (logger) logger.logAPICall('google_maps', 'geocoding', null);
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
    if (!url) return null;
    try {
        if (url.startsWith('gs://')) {
            const bucketName = url.split('/')[2];
            const filePath = url.split('/').slice(3).join('/');
            const [buffer] = await admin.storage().bucket(bucketName).file(filePath).download();
            const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
            return { data: Buffer.from(buffer).toString('base64'), mimeType };
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        return { data: Buffer.from(buf).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' };
    } catch (e) {
        throw new Error(`Image download ${e.message}`);
    }
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
async function _fetchRoadmapImage(lat, lng, radarKey, logger = null) {
    if (!radarKey) throw new Error("Radar API key missing for roadmap fetch");
    if (logger) logger.logAPICall('radar', 'static_map', null);
    // Radar zoom 19 is a cross-over: shows parcel/building detail + enough street context for labels.
    const url = `https://api.radar.io/maps/static?publishableKey=${radarKey}&center=${lat},${lng}&zoom=19&width=800&height=800&style=radar-default-v1&scale=1&markers=color:0x000257%7C${lat},${lng}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Radar Roadmap fetch HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mimeType: 'image/png' };
}

/**
 * Re-fetches the aerial satellite image from Google Maps Static API,
 * uploads it to Firebase Storage, and persists the fresh URL to Firestore.
 * Mirrors client-side getOrCacheAerialSatelliteUrl (Admin SDK equivalent).
 */
async function _refreshAerialUrl(zpid, lat, lng, mapsKey, db, bucket, logger = null) {
    const googleUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=20&size=640x640&scale=2&maptype=satellite` +
        `&markers=color:red%7Csize:tiny%7C${lat},${lng}` +
        `&markers=color:blue%7Csize:tiny%7Clabel:N%7C${Math.round((lat + 0.00027) * 1e7) / 1e7},${lng}` +
        `&key=${mapsKey}`;

    if (logger) logger.logAPICall('google_maps', 'static_map_aerial', zpid);
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
async function _refreshStreetViewUrl(zpid, lat, lng, mapsKey, db, bucket, address = null, logger = null) {
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

    if (logger) logger.logAPICall('google_maps', 'street_view', zpid);
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

    // Persist fresh URL + heading to root doc AND mirror to analysis/assets so Intel Batch visual pass can use it.
    await Promise.all([
        db.collection('properties').doc(zpid).update({
            streetView: freshUrl,
            streetViewHeadingDeg: heading,
        }),
        db.collection('properties').doc(zpid).collection('analysis').doc('assets').set(
            { streetView: freshUrl },
            { merge: true }
        )
    ]);
    console.log(`[Batch] Street view re-cached for ${zpid} (heading=${heading}°): ${freshUrl.slice(0, 80)}...`);
    return freshUrl;
}

// ─── Prompt builder (Now using modular prompts from ./prompts) ────────────────

// ─── Core: analyze a single property ─────────────────────────────────────────


async function _analyzeOneProperty(zpid, db, geminiKey, mapsKey, radarKey, logger = null) {
    // 1. Read property from Firestore (Admin SDK)
    const propSnap = await db.collection('properties').doc(zpid).get();
    if (!propSnap.exists) throw new Error(`Property ${zpid} not found`);
    const prop = propSnap.data();
    const address = prop.address || '';
    const homeType = (prop.homeType || '').toUpperCase();

    // Cache check: skip if we already have any orientation result from this version
    const existingAi = prop.orientation_ai || {};
    if (existingAi.final_orientation && existingAi.batch_version === BATCH_VERSION) {
        console.log(`[Batch] Skipping ${zpid}: ${BATCH_VERSION} result already exists (${existingAi.final_orientation}).`);
        return {
            status: 'cached',
            orientation: existingAi.final_orientation,
            steps: ['Cache Check: Previous result found (Skipping regardless of confidence)'],
            apis: []
        };
    }

    let aerialUrl = prop.satelliteImageUrl || null;
    let svUrl = prop.streetView || prop.streetViewAnalysis?.imageUrl || null;

    if (!aerialUrl) throw new Error(`No cached aerial image for ${zpid}`);

    const steps = [];
    const apis = [];

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
        steps.push('Maps Geocoding: Fetching street bearing');
        apis.push('Google Maps Geocoding');
        const br = await _getStreetBearing(address, mapsKey, propLat, propLng, logger);
        streetBearing = br?.bearing ?? null;
        streetSide = br?.streetSide ?? null;
        if (streetBearing !== null) steps.push(`Street bearing resolved: ${Math.round(streetBearing)}°`);
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
        steps.push('Aerial Image: Refreshing dead URL');
        apis.push('Google Maps Static (Aerial)');
        console.warn(`[Batch] ${zpid}: Aerial URL expired/dead — re-fetching from Google Maps Static API.`);
        try { aerialUrl = await _refreshAerialUrl(zpid, propLat, propLng, mapsKey, db, bucket, logger); }
        catch (e) { console.warn(`[Batch] ${zpid}: Aerial re-fetch failed:`, e.message); }
    } else if (!aerialAlive) {
        console.warn(`[Batch] ${zpid}: Aerial URL dead but no coordinates available — cannot refresh.`);
    }

    if (svUrl && !svAlive && propLat != null) {
        steps.push('Street View: Refreshing dead URL');
        apis.push('Google Street View (Metadata/Static)');
        console.warn(`[Batch] ${zpid}: Street view URL expired/dead — re-fetching from Street View API.`);
        try {
            const freshSv = await _refreshStreetViewUrl(zpid, propLat, propLng, mapsKey, db, bucket, address, logger);
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
    const isTownhouse = homeType === 'TOWNHOUSE';
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
    if (propLat != null && propLng != null && radarKey) {
        try {
            steps.push('Radar Maps: Fetching roadmap context');
            apis.push('Radar Static Maps');
            roadmapImg = await _fetchRoadmapImage(propLat, propLng, radarKey, logger);
            console.log(`[Batch] ${zpid}: Radar Roadmap image fetched.`);
        } catch (e) {
            console.warn(`[Batch] ${zpid}: Radar Roadmap fetch failed (non-blocking):`, e.message);
        }
    }
    // Image labeling:
    // A = Aerial satellite
    // B = Street View (if dual image) OR first listing photo (if primary listing photo mode) OR roadmap (if neither)
    // Roadmap = the next available letter.
    let roadmapLabel = null;
    if (roadmapImg) {
        let nextChar = 66; // 'B'
        if (usesDualImage) nextChar++;
        else if (!usesDualImage && listingPhotoImgs.length > 0) nextChar += listingPhotoImgs.length;
        roadmapLabel = String.fromCharCode(nextChar);
    }

    // 5. Build prompt and call Gemini 2.5 Flash
    const { getOrientationPrompt, getListingPhotoPrompt, satellitarySchema } = await import('./prompts/property/satellitaryAnalysis.js');
    
    let usesListingPhotos = !usesDualImage && listingPhotoImgs.length > 0;
    const prompt = usesListingPhotos
        ? getListingPhotoPrompt({ address, description: prop.description || null, streetBearing, streetSide, photoCount: listingPhotoImgs.length, photoMeta: listingPhotosUsed, roadmapLabel, homeType })
        : getOrientationPrompt({ usesDualImage, address, description: prop.description || null, streetBearing, streetSide, svHeading, roadmapLabel, homeType });

    const parts = [
        { text: prompt },
        { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } },
        ...(usesDualImage
            ? [{ inlineData: { mimeType: svImg.mimeType, data: svImg.data } }]
            : []
        ),
        ...(usesListingPhotos
            ? listingPhotoImgs.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } }))
            : []
        ),
        ...(roadmapImg
            ? [{ inlineData: { mimeType: roadmapImg.mimeType, data: roadmapImg.data } }]
            : []
        ),
    ];

    const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({
        model: ORIENTATION_MODEL_CF,
        generationConfig: { responseMimeType: 'application/json', responseSchema: satellitarySchema },
    });

    steps.push(`Gemini Pass 1: ${usesListingPhotos ? 'Aerial + Listing Photos' : usesDualImage ? 'Aerial + Street View' : 'Aerial Only'}`);
    apis.push(`Gemini (${ORIENTATION_MODEL_CF})`);
    const geminiResult = await model.generateContent({ contents: [{ role: 'user', parts }] });
    if (logger) logger.logLLMCall(ORIENTATION_MODEL_CF, geminiResult.response.usageMetadata?.promptTokenCount, geminiResult.response.usageMetadata?.candidatesTokenCount, zpid, 'orientation.js');
    let data;
    let responseText = '';
    try {
        responseText = geminiResult.response.text();
        data = _extractJson(responseText);
        if (usesListingPhotos) {
            const confirmedLabels = Array.isArray(data.listing_photos_showing_front) ? data.listing_photos_showing_front : [];
            listingPhotosUsed = listingPhotosUsed.map((photo, i) => ({
                ...photo,
                confirmed_front: confirmedLabels.includes(String.fromCharCode(66 + i)),
            }));
        }
    } catch (e) {
        console.error(`[Batch] Gemini response for ${zpid}:`, responseText);
        throw new Error(`Gemini parse error for ${zpid}: ${responseText.slice(0, 200)}`);
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

    // No cul-de-sac SVFailed gate — cul-de-sac rule: front faces the circle, aerial tells us which way.
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


    // Post-processing gate 2: Townhouse/Shared-wall → UNCLEAR
    // Policy:
    //   aerial-only  + shared-wall → ALWAYS UNCLEAR (aerial alone cannot distinguish unit orientation).
    //   cul-de-sac   + shared-wall → ALWAYS UNCLEAR (curved/loop street makes direction unreliable).
    //   corner lot   + shared-wall → ALWAYS UNCLEAR (two frontages, shared walls add ambiguity).
    //   non-standard street        → ALWAYS UNCLEAR (internal roads, flag lots, curved streets).
    //   dual-image + shared-wall + standard-straight-street → allow IF front door confirmed.
    if ((isMultiUnit || isTownhouse) && finalOrientation !== 'UNCLEAR') {
        const layoutType = data.property_layout_type;
        const complexLayout = layoutType === 'cul_de_sac' || layoutType === 'corner_lot';
        const frontDoorMissing = data.front_door_clearly_visible === false;
        const nonStandardStreet = data.standard_street_layout === false;
        const explanationLower = (data.explanation || '').toLowerCase();
        const facesInternal = explanationLower.includes('internal street') ||
            explanationLower.includes('internal road') ||
            explanationLower.includes('common area') ||
            explanationLower.includes('greenbelt') ||
            explanationLower.includes('walkway') ||
            explanationLower.includes('shared driveway') ||
            explanationLower.includes('private road') ||
            explanationLower.includes('widened curve') ||
            explanationLower.includes('eyebrow');
        const hasUnitNumber = address.includes('#') || /\b(UNIT|APT|STE)\b/i.test(address);

        if (aerialOnlyMode) {
            // Aerial-only shared-wall: always UNCLEAR
            console.log(`[Batch] Override ${zpid}: townhouse/multi-unit + aerial_only_mode \u2192 UNCLEAR (always)`);
            finalOrientation = 'UNCLEAR';
            finalAzimuth = null;
        } else if (complexLayout || nonStandardStreet || frontDoorMissing || facesInternal || hasUnitNumber) {
            const reason = frontDoorMissing ? 'front door not clearly visible'
                : facesInternal ? 'faces internal street/common area/shared driveway'
                    : hasUnitNumber ? 'has unit number (complex multi-unit logic)'
                        : nonStandardStreet ? 'non-standard street layout (internal access road)'
                            : `complex lot layout (${layoutType})`;
            console.log(`[Batch] Override ${zpid}: townhouse/multi-unit + ${reason} \u2192 UNCLEAR`);
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
            steps.push(`Gemini Pass 2: Listing Photo Retry (${listingPhotoImgs.length} photos)`);
            apis.push(`Gemini (${ORIENTATION_MODEL_CF})`);
            const { getListingPhotoPrompt } = await import('./prompts/property/satellitaryAnalysis.js');
            const retryPrompt = getListingPhotoPrompt({ address, description: prop.description || null, streetBearing, streetSide, photoCount: listingPhotoImgs.length, photoMeta: listingPhotosUsed });
            const retryParts = [
                { text: retryPrompt },
                { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } },
                ...listingPhotoImgs.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
            ];
            const retryResult = await model.generateContent({ contents: [{ role: 'user', parts: retryParts }] });
            if (logger) logger.logLLMCall(ORIENTATION_MODEL_CF, retryResult.response.usageMetadata?.promptTokenCount, retryResult.response.usageMetadata?.candidatesTokenCount, zpid, 'orientation.js');
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
        steps: steps || [],
        apis: Array.from(new Set(apis || [])),
        batch_version: BATCH_VERSION,
        // Listing photo provenance — which image_by_image_analysis entries were sent to Gemini.
        // null when street view was used; [] when aerial-only with no exterior photos found.
        listing_photos_used: usesListingPhotos ? listingPhotosUsed : null,
        // Function version — increment BATCH_VERSION when analysis logic changes.
        // Lets the audit UI show whether a result is from old or new code.
        batch_version: BATCH_VERSION,
        street_bearing_from_map: data.street_bearing_from_map ?? null,
        smoke_test_results: {
            has_orientation: finalOrientation !== 'UNCLEAR',
            confidence_high: finalConfidence === 'high',
            version: BATCH_VERSION,
            is_v30: true, // Legacy flag support
            is_under_construction: !!data.is_under_construction
        }
    };

    await db.collection('properties').doc(zpid).set(
        { orientation_ai: orientationAI, orientation_calculated_at: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
    );

    // 9a. Street Insights: run targeted Gemini on the street view while it's already downloaded
    if (svUrl && svImg && geminiKey) {
        try {
            const visualSnap = await db.collection('properties').doc(zpid).collection('analysis').doc('visual').get();
            const hasInsights = !!(visualSnap.data()?.exterior_and_neighborhood?.neighborhood_street_insights?.length > 20);
            if (!hasInsights) {
                await _enrichStreetInsights(zpid, db, geminiKey, svUrl, logger, { inlineData: { data: svImg.data, mimeType: svImg.mimeType } });
            }
        } catch (e) {
            console.warn(`[Batch] Street insights failed for ${zpid}:`, e.message);
        }
    }

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
    return {
        status: 'success',
        orientation: finalOrientation,
        steps,
        apis: Array.from(new Set(apis))
    };
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
        const mapsKey = keys.google_maps_key || process.env.MAPS_API_KEY || '';
        const radarKey = keys.radar_key || keys.radar_publishable_key || process.env.RADAR_API_KEY || '';
        const logger = new UsageLogger(snap.ref);
        await logger.initialize();

        let done = 0, failed = 0, cached = 0;

        // Process zpids in waves of BATCH_CONCURRENCY (20).
        // Promise.allSettled ensures one failure doesn't cancel the rest of the wave.
        for (let i = 0; i < zpids.length; i += BATCH_CONCURRENCY) {
            // Check for cancellation before each wave
            const freshJob = await snap.ref.get();
            if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                console.log(`[Orientation Batch] ${context.params.jobId} cancelled. Terminating.`);
                return null;
            }
            const wave = zpids.slice(i, i + BATCH_CONCURRENCY);
            await Promise.allSettled(
                wave.map(async (zpid) => {
                    // Check for cancellation before processing each property
                    const freshJob = await snap.ref.get();
                    if (freshJob.exists && freshJob.data()?.status === 'cancelled') {
                        return;
                    }

                    try {
                        const result = await _analyzeOneProperty(zpid, db, geminiKey, mapsKey, radarKey, logger);
                        if (result.status === 'cached') cached++;
                        else done++;

                        const updateData = {
                            done,
                            failed,
                            cached,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        };
                        updateData[`results.${zpid}`] = result;
                        await snap.ref.update(updateData);
                    } catch (e) {
                        console.error(`[Batch] ✗ ${zpid}:`, e.message);
                        failed++;
                        const failResult = { status: 'failed', error: e.message, steps: ['Execution failed'], apis: [] };
                        const updateData = {
                            done,
                            failed,
                            cached,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        };
                        updateData[`results.${zpid}`] = failResult;
                        await snap.ref.update(updateData);
                    }
                    await logger.flush();
                }),
            );
        }

        await snap.ref.update({
            status: 'completed', done, failed, cached,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[Batch] Job ${context.params.jobId} complete — ${done} ok, ${cached} cached, ${failed} failed / ${zpids.length} total`);
        return null;
    });

exports._analyzeOneProperty = _analyzeOneProperty;
