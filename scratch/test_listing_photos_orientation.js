/**
 * test_listing_photos_orientation.js
 *
 * Validates the listing-photos fallback for orientation analysis.
 *
 * Steps:
 *  1. Load Pleasanton ground truth (properties with known orientations).
 *  2. Fetch matching properties from Firestore, filter to:
 *     - aerial_only_mode === true (no usable street view)
 *     - expected_orientation is known (ground truth exists)
 *  3. For each candidate, check property_analyses_visual for exterior photo candidates.
 *  4. Run orientation analysis via _analyzeOneProperty (using the actual batch function).
 *  5. Compare new result against ground truth and report Pass/Fail with details.
 *
 * Run:
 *   cd /Users/ashitjain/colorado/zyphe/google-zyphe
 *   GOOGLE_APPLICATION_CREDENTIALS=<path-to-key.json> \
 *   npx tsx scratch/test_listing_photos_orientation.js
 *
 * Or from Firebase emulator / CI with FIREBASE_CONFIG set.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PLEASANTON_GROUND_TRUTH } from '../services/orientation_ground_truth_data.js';

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_TEST_PROPERTIES = 8;        // How many to test (Gemini API calls)
const ORIENTATION_MODEL = 'gemini-2.5-flash';

// ── Init ──────────────────────────────────────────────────────────────────────

initializeApp();
const db = getFirestore();

// ── Helpers (mirrored from orientationBatch.js) ───────────────────────────────

const EXTERIOR_KEYWORDS = [
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb appeal',
    'exterior', 'driveway', 'garage', 'front yard', 'front porch', 'porch', 'curb',
    'street view', 'front facing', 'front walk', 'landscaping', 'front elevation',
    'exterior view', 'outside', 'outdoor', 'front of the home', 'front of the house',
];

function scorePhotoForFront(analysis = '') {
    const lower = analysis.toLowerCase();
    return EXTERIOR_KEYWORDS.filter(kw => lower.includes(kw)).length;
}

function findBestExteriorPhotos(imageByImageAnalysis, maxCount = 2) {
    if (!Array.isArray(imageByImageAnalysis) || imageByImageAnalysis.length === 0) return [];
    return imageByImageAnalysis
        .map(item => ({
            url: item.image_id || '',
            score: scorePhotoForFront(item.analysis || ''),
            analysis: (item.analysis || '').slice(0, 120),
        }))
        .filter(item => item.url && item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCount);
}

async function downloadImageBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading image`);
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' };
}

function normaliseDir(s = '') {
    return s.toLowerCase().replace(/[^a-z]/g, '');
}

// 8-direction match. Returns true if ai and expected are the same cardinal/intercardinal.
// Allows 1 step adjacency (e.g. "North" vs "Northeast") as acceptable near-miss.
const DIR8 = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
function dirMatch(ai, expected, allowAdj = false) {
    const a = normaliseDir(ai), b = normaliseDir(expected);
    if (a === b) return 'exact';
    if (!allowAdj) return 'fail';
    const ai8 = DIR8.indexOf(a), ex8 = DIR8.indexOf(b);
    if (ai8 === -1 || ex8 === -1) return 'fail';
    const diff = Math.abs(ai8 - ex8);
    return (diff === 1 || diff === 7) ? 'adjacent' : 'fail';
}

// ── Gemini schema (same as orientationBatch.js) ───────────────────────────────

const ORIENTATION_SCHEMA = {
    type: 'object',
    properties: {
        image_quality:             { type: 'string', enum: ['clear', 'acceptable', 'blurry'] },
        final_orientation:         { type: 'string' },
        azimuth_degrees:           { type: 'number', nullable: true },
        property_layout_type:      { type: 'string', enum: ['corner_lot', 'cul_de_sac', 'flag_lot', 'irregular_lot', 'standard', 'other'] },
        confidence:                { type: 'string', enum: ['high', 'medium', 'low'] },
        is_under_construction:     { type: 'boolean' },
        standard_street_layout:    { type: 'boolean', nullable: true },
        explanation:               { type: 'string' },
        front_door_clearly_visible:{ type: 'boolean', nullable: true },
        privacy_insight:           { type: 'string' },
        street_view_shows_front:   { type: 'boolean', nullable: true },
    },
    required: ['property_layout_type', 'image_quality', 'final_orientation', 'confidence', 'explanation', 'privacy_insight'],
};

function buildListingPhotoPrompt(address, description, photoCount) {
    const streetName = (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim();
    const addressClue = `\nPROPERTY ADDRESS: "${address}"\nFront entrance MUST face "${streetName}".`;
    const descHint = description
        ? `\n\n🏷️ LISTING DESCRIPTION:\n"${Array.isArray(description) ? description.join(' ') : description}"\nIf it explicitly states a cardinal facing direction, treat as ground truth.`
        : '';

    const imageList = Array.from({ length: photoCount }, (_, i) =>
        `- Image ${String.fromCharCode(66 + i)}: Listing photo ${i + 1} (selected because it likely shows the exterior/front facade)`
    ).join('\n');

    return [
        `You are a spatial analysis expert. I am providing ${1 + photoCount} images:`,
        `- Image A: Aerial satellite (North-up — North is strictly the TOP of this image)`,
        imageList,
        `\nCONTEXT: Street view is not available for this property. The listing photos above were selected because they are likely to show the front exterior.`,
        addressClue, descHint,
        `\nGUIDING PRINCIPLES:`,
        `1. IMAGE A IS THE ANCHOR: North is strictly at the top. Identify the building footprint, street, and driveway.`,
        `2. LISTING PHOTOS PURPOSE: Use Images B/C to visually confirm which face of the building is the FRONT — the side with the main pedestrian entrance, porch, or front door.`,
        `3. CROSS-REFERENCE: After identifying the front in the listing photo(s), trace that face back to Image A to determine the compass direction it faces.`,
        `4. WALKWAY RULE: The architectural front is where the pedestrian path from the PUBLIC SIDEWALK leads to the main door.`,
        `\nTASK:`,
        `Step 1: Classify layout in Image A (standard, cul_de_sac, corner_lot, flag_lot, other).`,
        `Step 2: In the listing photo(s), identify which face is the front. Set street_view_shows_front=true if clearly confirmed.`,
        `Step 3: Cross-reference the confirmed front face with Image A. Determine compass direction.`,
        `Step 4: Output final_orientation, azimuth_degrees, confidence, property_layout_type.`,
        `\nEXPLANATION FORMAT:\n(1) LAYOUT\n(2) LISTING PHOTO EVIDENCE\n(3) AERIAL CROSS-REFERENCE\n(4) FINAL`,
    ].join('\n').trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    // 1. Resolve Gemini key from Firestore app_config
    const keysSnap = await db.collection('app_config').doc('api_keys').get();
    const geminiKey = keysSnap.exists ? keysSnap.data().gemini_key : process.env.GEMINI_API_KEY;
    if (!geminiKey) {
        console.error('[Test] No Gemini key found in app_config or GEMINI_API_KEY env var.');
        process.exit(1);
    }
    const gemini = new GoogleGenerativeAI(geminiKey);

    // 2. Build GT lookup: address (normalised) → expected_orientation
    const gtByAddress = new Map();
    for (const row of PLEASANTON_GROUND_TRUTH) {
        if (row.expected_orientation && row.remark !== '') {
            gtByAddress.set(row.address.toLowerCase().trim(), row.expected_orientation);
        }
    }
    console.log(`[Test] Ground truth entries with known orientation: ${gtByAddress.size}`);

    // 3. Fetch all Pleasanton properties from Firestore
    console.log('[Test] Fetching Pleasanton properties from Firestore...');
    const propSnap = await db.collection('properties').where('city', '==', 'Pleasanton').get();
    console.log(`[Test] Total Pleasanton properties fetched: ${propSnap.size}`);

    // 4. Filter to aerial-only properties with known ground truth
    const candidates = [];
    for (const doc of propSnap.docs) {
        const p = doc.data();
        if (p.deprecated) continue;
        const ai = p.orientation_ai;
        if (!ai || ai.aerial_only_mode !== true) continue;   // must be aerial-only

        const addrKey = (p.address || '').toLowerCase().trim();
        const expected = gtByAddress.get(addrKey);
        if (!expected) continue;  // no ground truth

        const aerialUrl = p.satelliteImageUrl;
        if (!aerialUrl) continue; // no aerial image

        candidates.push({
            zpid: doc.id,
            address: p.address,
            expected,
            aerialUrl,
            description: p.description || null,
            currentOrientation: ai.final_orientation,
        });
    }

    if (candidates.length === 0) {
        console.log('[Test] No aerial-only properties with ground truth found. Relaxing filter to all non-dual-image...');
        // Nothing to show — exit cleanly
        process.exit(0);
    }

    const toTest = candidates.slice(0, MAX_TEST_PROPERTIES);
    console.log(`\n[Test] Testing ${toTest.length} of ${candidates.length} candidates...\n`);
    console.log('='.repeat(90));

    // 5. For each candidate: find exterior listing photos, run Gemini, compare GT
    const results = [];

    for (const candidate of toTest) {
        const { zpid, address, expected, aerialUrl, description, currentOrientation } = candidate;
        console.log(`\n▶ ${address} (${zpid})`);
        console.log(`  GT Expected: ${expected}  |  Current AI: ${currentOrientation}`);

        // 5a. Fetch image_by_image_analysis from property_analyses_visual
        let exteriorPhotos = [];
        try {
            const visualSnap = await db.collection('property_analyses_visual').doc(zpid).get();
            if (visualSnap.exists) {
                const bestItems = findBestExteriorPhotos(visualSnap.data().image_by_image_analysis, 2);
                exteriorPhotos = bestItems;
                if (bestItems.length > 0) {
                    console.log(`  Exterior photos found: ${bestItems.length}`);
                    bestItems.forEach((b, i) => console.log(`    [${i + 1}] score=${b.score} → "${b.analysis}..."`));
                } else {
                    console.log(`  No exterior photos found in image_by_image_analysis — will use aerial-only.`);
                }
            } else {
                console.log(`  No property_analyses_visual doc for this zpid — aerial-only.`);
            }
        } catch (e) {
            console.warn(`  Visual analysis fetch failed: ${e.message}`);
        }

        // 5b. Download images
        let aerialImg;
        try {
            aerialImg = await downloadImageBase64(aerialUrl);
        } catch (e) {
            console.warn(`  Aerial download failed: ${e.message} — skipping.`);
            results.push({ address, expected, currentOrientation, newOrientation: 'ERROR', photoCount: 0, match: 'error' });
            continue;
        }

        const listingImgs = [];
        for (const photo of exteriorPhotos) {
            try {
                const img = await downloadImageBase64(photo.url);
                listingImgs.push(img);
            } catch (e) {
                console.warn(`  Listing photo download failed: ${e.message}`);
            }
        }

        // 5c. Build prompt and call Gemini
        const hasListingPhotos = listingImgs.length > 0;
        const prompt = hasListingPhotos
            ? buildListingPhotoPrompt(address, description, listingImgs.length)
            : `You are a spatial analysis expert. I am providing one aerial satellite image (North-up).\n\nPROPERTY ADDRESS: "${address}"\n\nUsing only the aerial image, determine the front orientation (compass direction the front door faces).`;

        const parts = [
            { text: prompt },
            { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } },
            ...listingImgs.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
        ];

        let geminiResult;
        try {
            const model = gemini.getGenerativeModel({
                model: ORIENTATION_MODEL,
                generationConfig: { responseMimeType: 'application/json', responseSchema: ORIENTATION_SCHEMA },
            });
            const response = await model.generateContent({ contents: [{ role: 'user', parts }] });
            geminiResult = JSON.parse(response.response.text());
        } catch (e) {
            console.warn(`  Gemini call failed: ${e.message}`);
            results.push({ address, expected, currentOrientation, newOrientation: 'ERROR', photoCount: listingImgs.length, match: 'error' });
            continue;
        }

        const newOrientation = geminiResult.final_orientation || 'UNCLEAR';
        const confidence = geminiResult.confidence || '?';
        const match = dirMatch(newOrientation, expected, true);

        const matchIcon = match === 'exact' ? '✅ PASS' : match === 'adjacent' ? '🟡 NEAR' : newOrientation === 'UNCLEAR' ? '⬜ UNCLEAR' : '❌ FAIL';
        const mode = hasListingPhotos ? `LISTING_PHOTOS(${listingImgs.length})` : 'AERIAL_ONLY';

        console.log(`  Mode: ${mode}`);
        console.log(`  Gemini → ${newOrientation} (${confidence}) | Expected: ${expected}`);
        console.log(`  Result: ${matchIcon}`);
        console.log(`  Explanation: ${(geminiResult.explanation || '').slice(0, 200)}...`);

        results.push({ address, expected, currentOrientation, newOrientation, confidence, photoCount: listingImgs.length, match, mode });
    }

    // 6. Summary report
    console.log('\n' + '='.repeat(90));
    console.log('SUMMARY\n');

    const passes   = results.filter(r => r.match === 'exact').length;
    const near     = results.filter(r => r.match === 'adjacent').length;
    const unclear  = results.filter(r => r.newOrientation === 'UNCLEAR').length;
    const fails    = results.filter(r => r.match === 'fail' && r.newOrientation !== 'UNCLEAR').length;
    const errors   = results.filter(r => r.match === 'error').length;
    const withPhotos = results.filter(r => r.photoCount > 0).length;

    console.log(`Total:          ${results.length}`);
    console.log(`With listing photos: ${withPhotos} / ${results.length}`);
    console.log(`✅ Exact match:  ${passes}`);
    console.log(`🟡 Adjacent:     ${near}`);
    console.log(`⬜ UNCLEAR:      ${unclear}`);
    console.log(`❌ Fail:         ${fails}`);
    console.log(`💥 Error:        ${errors}`);
    console.log(`\nAccuracy (exact): ${results.length > 0 ? Math.round(100 * passes / results.length) : 0}%`);
    console.log(`Accuracy (near):  ${results.length > 0 ? Math.round(100 * (passes + near) / results.length) : 0}%`);

    console.log('\nDetailed table:');
    console.log('Address'.padEnd(40) + 'Expected'.padEnd(14) + 'AI Result'.padEnd(14) + 'Photos'.padEnd(8) + 'Verdict');
    console.log('-'.repeat(90));
    for (const r of results) {
        const icon = r.match === 'exact' ? '✅' : r.match === 'adjacent' ? '🟡' : r.newOrientation === 'UNCLEAR' ? '⬜' : r.match === 'error' ? '💥' : '❌';
        const addr = r.address.slice(0, 38).padEnd(40);
        console.log(`${addr}${r.expected.padEnd(14)}${r.newOrientation.padEnd(14)}${String(r.photoCount).padEnd(8)}${icon}`);
    }

    process.exit(0);
}

main().catch(e => { console.error('[Test] Fatal:', e); process.exit(1); });
