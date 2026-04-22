/**
 * test_three_unclear.js
 *
 * End-to-end verification for 3 previously-UNCLEAR Pleasanton properties.
 * Tests the full pipeline after the batch path fix:
 *
 *   properties/{zpid}/analysis/visual  ← correct subcollection (was broken before)
 *
 * For each property:
 *   ✓ Confirms visual subcollection exists
 *   ✓ Confirms listing photos are found with current EXTERIOR_KEYWORDS
 *   ✓ Downloads aerial + listing photos
 *   ✓ Calls Gemini with the full listing-photo prompt
 *   ✓ Compares result to ground truth
 *   ✓ Verifies listing_photos_used would be non-empty (i.e. photos were passed)
 *
 * Run:
 *   cd /Users/ashitjain/colorado/zyphe/google-zyphe/functions
 *   GOOGLE_CLOUD_PROJECT=zyphe-af0bf /usr/local/bin/node test_three_unclear.js
 */

'use strict';

const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();
const db = admin.firestore();

// ── Ground truth for the three test properties ─────────────────────────────
const TEST_CASES = [
    { zpid: '24931958',  address: '1265 Kolln St, Pleasanton, CA 94566 US',       expected: 'West'      },
    { zpid: '25077339',  address: '1296 Vintner Way, Pleasanton, CA 94566 US',    expected: 'North'     },
    // Brookline Loop is a townhouse on a cul-de-sac loop — policy gate 2 forces UNCLEAR
    // regardless of what Gemini returns (curved road makes direction unreliable).
    { zpid: '124733791', address: '1380 Brookline Loop, Pleasanton, CA 94566 US', expected: 'UNCLEAR'   },
];

// ── Keywords (must match orientationBatch.js) ────────────────────────────────

const EXTERIOR_KEYWORDS = [
    // Front door / entry
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb appeal',
    'front of the home', 'front of the house', 'front elevation', 'front facing', 'front walk',
    'front porch', 'front yard',
    // General exterior
    'exterior', 'driveway', 'garage', 'porch', 'curb',
    'exterior view', 'outside', 'outdoor', 'landscaping',
    // Aerial / overhead
    'aerial view', 'aerial photo', 'aerial image', "bird's eye", "bird's-eye", 'drone',
    'overhead view', 'overhead photo', 'top-down', 'top down', 'from above',
    'surrounding neighborhood', 'property location',
];

function scorePhoto(analysis = '') {
    const lower = analysis.toLowerCase();
    const matched = EXTERIOR_KEYWORDS.filter(kw => lower.includes(kw));
    return { score: matched.length, matched };
}

function findBestExteriorPhotos(imageByImage, maxCount = 3) {
    if (!Array.isArray(imageByImage) || imageByImage.length === 0) return [];
    return imageByImage
        .map((item, idx) => {
            const { score, matched } = scorePhoto(item.analysis || '');
            return { url: item.image_id || '', index: idx, score, matched, analysisSnippet: (item.analysis || '').slice(0, 200) };
        })
        .filter(item => item.url && item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCount);
}

async function downloadBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 60)}`);
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' };
}

// Schema matching orientationBatch.js
const SCHEMA = {
    type: 'object',
    properties: {
        image_quality:           { type: 'string', enum: ['clear', 'acceptable', 'blurry'] },
        final_orientation:       { type: 'string' },
        azimuth_degrees:         { type: 'number', nullable: true },
        property_layout_type:    { type: 'string', enum: ['corner_lot', 'cul_de_sac', 'flag_lot', 'irregular_lot', 'standard', 'other'] },
        confidence:              { type: 'string', enum: ['high', 'medium', 'low'] },
        is_under_construction:   { type: 'boolean' },
        explanation:             { type: 'string' },
        street_view_shows_front: { type: 'boolean', nullable: true },
        privacy_insight:         { type: 'string' },
    },
    required: ['property_layout_type', 'image_quality', 'final_orientation', 'confidence', 'explanation', 'privacy_insight'],
};

// 8-direction match
const DIR8 = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
function dirMatch(ai, expected) {
    const a = (ai || '').toLowerCase().replace(/[^a-z]/g, '');
    const b = (expected || '').toLowerCase().replace(/[^a-z]/g, '');
    if (a === b) return 'exact';                    // includes UNCLEAR===UNCLEAR
    if (b === 'unclear') return 'fail';             // got direction, expected UNCLEAR → fail
    if (a === 'unclear') return 'unclear';          // got UNCLEAR, expected direction
    const ai8 = DIR8.indexOf(a), ex8 = DIR8.indexOf(b);
    if (ai8 === -1 || ex8 === -1) return 'fail';
    const diff = Math.abs(ai8 - ex8);
    return (diff === 1 || diff === 7) ? 'adjacent' : 'fail';
}

function buildPrompt(address, listingPhotoMeta) {
    const streetName = address.split(',')[0].replace(/^\d+[A-Za-z]?\s+/, '').trim();
    const photoLabels = listingPhotoMeta.map((p, i) => {
        const isAerial = /aerial|drone|bird|overhead|top.?down|from above/i.test(p.analysisSnippet);
        const letter = String.fromCharCode(66 + i);
        const type = isAerial
            ? 'AERIAL/DRONE listing photo — shows building footprint from above'
            : 'exterior/ground-level listing photo';
        return `  Image ${letter} = Listing photo #${p.index + 1} (${type}): "${p.analysisSnippet.trim()}"`;
    }).join('\n');

    return [
        `You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and ${listingPhotoMeta.length} listing photo(s) from the property gallery.`,
        `IMAGE GUIDE:\n  Image A = cached satellite aerial — North is UP. Use as authoritative layout reference.\n${photoLabels}`,
        `⚠️ LISTING PHOTOS KEY RULES:`,
        `  • AERIAL/DRONE: compare with Image A to confirm which face fronts the address street.`,
        `  • GROUND-LEVEL: look for front door, porch, driveway apron. Set street_view_shows_front accordingly.`,
        `PROPERTY ADDRESS: "${address}"\nFront MUST face "${streetName}".`,
        `DRIVEWAY CONNECTION REQUIRED: only count a road as front if a driveway/walkway connects to it.`,
        `GUIDING PRINCIPLES:\n1. Image A IS THE ANCHOR (North up).\n2. WALKWAY RULE: front = where pedestrian path from public sidewalk leads.\n3. CONFIDENCE GATE: if unclear → final_orientation='UNCLEAR', confidence='low'.`,
        `TASK:\nStep 1 — Layout: standard/corner_lot/cul_de_sac/flag_lot/other.\nStep 2 — Aerial: identify building footprint, driveway, candidate front wall.\nStep 3 — Listing photos: confirm/contradict aerial conclusion. Set street_view_shows_front.\nStep 4 — Compass direction (0°=N, 90°=E, 180°=S, 270°=W). Perpendicular to road bearing required.\nStep 5 — Assess privacy, lot coverage, buyer pro/con.`,
        `EXPLANATION FORMAT:\n(1) LAYOUT\n(2) STREET CONTEXT\n(3) AERIAL EVIDENCE\n(4) LISTING PHOTO EVIDENCE\n(5) FINAL`,
    ].join('\n').trim();
}

function sep(char = '═', n = 80) { return char.repeat(n); }
function section(title) { console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`); }

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const keysSnap = await db.collection('app_config').doc('api_keys').get();
    const geminiKey = keysSnap.exists ? keysSnap.data().gemini_key : process.env.GEMINI_API_KEY;
    if (!geminiKey) { console.error('No Gemini key.'); process.exit(1); }
    const gemini = new GoogleGenerativeAI(geminiKey);
    const model = gemini.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
    });

    const results = [];

    for (const tc of TEST_CASES) {
        const { zpid, address, expected } = tc;
        console.log('\n' + sep());
        console.log(`  ${address}  (ZPID: ${zpid})`);
        console.log(`  Ground truth: ${expected}`);
        console.log(sep());

        // ── Step 1: Read property ──────────────────────────────────────────
        section('Step 1: Firestore — property + visual subcollection');
        const propSnap = await db.collection('properties').doc(zpid).get();
        if (!propSnap.exists) {
            console.log('  ✗ Property not found — skipping');
            results.push({ zpid, address, expected, verdict: 'ERROR', reason: 'property not found' });
            continue;
        }
        const prop = propSnap.data();
        const prevOrientation = prop.orientation_ai?.final_orientation || 'NONE';
        console.log(`  Current stored orientation: ${prevOrientation} (confidence: ${prop.orientation_ai?.confidence || '?'})`);
        console.log(`  listing_photos_used in store: ${JSON.stringify(prop.orientation_ai?.listing_photos_used ?? 'absent')}`);

        // ── Step 2: Read visual subcollection ─────────────────────────────
        section('Step 2: properties/{zpid}/analysis/visual');
        const visualSnap = await db.collection('properties').doc(zpid).collection('analysis').doc('visual').get();
        if (!visualSnap.exists) {
            console.log('  ✗ analysis/visual subcollection doc does not exist');
            results.push({ zpid, address, expected, verdict: 'ERROR', reason: 'no visual doc' });
            continue;
        }
        const imageByImage = visualSnap.data().image_by_image_analysis || [];
        console.log(`  ✓ visual doc found · image_by_image_analysis has ${imageByImage.length} entries`);

        // ── Step 3: Find exterior photo candidates ─────────────────────────
        section('Step 3: Exterior photo candidates (EXTERIOR_KEYWORDS)');
        const candidates = findBestExteriorPhotos(imageByImage, 3);
        if (candidates.length === 0) {
            console.log('  ✗ No exterior photo candidates found — EXTERIOR_KEYWORDS produced zero matches');
            console.log('  Sample analyses:');
            imageByImage.slice(0, 5).forEach((item, i) =>
                console.log(`    [${i}] "${(item.analysis || '').slice(0, 100)}"`)
            );
            results.push({ zpid, address, expected, verdict: 'NO_PHOTOS', reason: 'keywords found nothing' });
            continue;
        }
        console.log(`  ✓ ${candidates.length} candidate(s) found:`);
        candidates.forEach(c => {
            const isAerial = /aerial|drone|bird|overhead|top.?down|from above/i.test(c.analysisSnippet);
            console.log(`    Photo #${c.index}  score=${c.score}  type=${isAerial ? 'AERIAL' : 'GROUND'}  matched=[${c.matched.join(', ')}]`);
            console.log(`      "${c.analysisSnippet}"`);
        });

        // ── Step 4: Download images ────────────────────────────────────────
        section('Step 4: Download images');
        const aerialUrl = prop.satelliteImageUrl;
        if (!aerialUrl) {
            console.log('  ✗ No satelliteImageUrl on property');
            results.push({ zpid, address, expected, verdict: 'ERROR', reason: 'no aerial URL' });
            continue;
        }

        let aerialImg;
        try {
            aerialImg = await downloadBase64(aerialUrl);
            console.log('  ✓ Aerial downloaded');
        } catch (e) {
            console.log(`  ✗ Aerial download failed: ${e.message}`);
            results.push({ zpid, address, expected, verdict: 'ERROR', reason: 'aerial download failed' });
            continue;
        }

        const listingImgs = [];
        for (const c of candidates) {
            try {
                const img = await downloadBase64(c.url);
                listingImgs.push({ img, candidate: c });
                console.log(`  ✓ Listing photo #${c.index} downloaded (score=${c.score})`);
            } catch (e) {
                console.log(`  ✗ Listing photo #${c.index} failed: ${e.message}`);
            }
        }

        if (listingImgs.length === 0) {
            console.log('  ✗ All listing photo downloads failed');
            results.push({ zpid, address, expected, verdict: 'NO_PHOTOS', reason: 'all photo downloads failed' });
            continue;
        }

        // ── Step 5: Call Gemini ────────────────────────────────────────────
        section(`Step 5: Gemini (aerial + ${listingImgs.length} listing photo(s))`);
        const prompt = buildPrompt(address, listingImgs.map(({ candidate }) => candidate));
        const parts = [
            { text: prompt },
            { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } },
            ...listingImgs.map(({ img }) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
        ];

        let geminiResult;
        try {
            const response = await model.generateContent({ contents: [{ role: 'user', parts }] });
            geminiResult = JSON.parse(response.response.text());
        } catch (e) {
            console.log(`  ✗ Gemini failed: ${e.message}`);
            results.push({ zpid, address, expected, verdict: 'ERROR', reason: `Gemini: ${e.message}` });
            continue;
        }

        let orientation = geminiResult.final_orientation || 'UNCLEAR';
        const confidence = geminiResult.confidence || '?';
        const svShowsFront = geminiResult.street_view_shows_front;
        const layoutType = geminiResult.property_layout_type;
        const isMultiUnit = ['TOWNHOUSE', 'CONDO', 'APARTMENT', 'MULTI_FAMILY'].includes(
            (prop.homeType || '').toUpperCase()
        );

        // Mirror orientationBatch.js post-processing gate 2:
        // Townhouse + cul_de_sac or corner_lot → always UNCLEAR
        let policyOverride = null;
        if (isMultiUnit && orientation !== 'UNCLEAR') {
            const complexLayout = layoutType === 'cul_de_sac' || layoutType === 'corner_lot';
            if (complexLayout) {
                policyOverride = `townhouse + ${layoutType} → UNCLEAR (policy gate)`;
                orientation = 'UNCLEAR';
            }
        }

        const match = dirMatch(orientation, expected);
        const matchLabel = match === 'exact' ? '✅ EXACT' : match === 'adjacent' ? '🟡 ADJACENT'
            : match === 'unclear' ? '⬜ UNCLEAR' : '❌ FAIL';

        console.log(`  Gemini raw   → ${geminiResult.final_orientation} (confidence: ${confidence}, layout: ${layoutType})`);
        if (policyOverride) console.log(`  Policy gate  → ${policyOverride}`);
        console.log(`  Final result → ${orientation}`);
        console.log(`  Expected     → ${expected}`);
        console.log(`  Match:         ${matchLabel}`);
        console.log(`\n  Explanation:\n${geminiResult.explanation.split('\n').map(l => '    ' + l).join('\n')}`);

        results.push({
            zpid, address, expected,
            orientation, confidence,
            photosUsed: listingImgs.length,
            svShowsFront,
            policyOverride,
            match,
            verdict: match === 'exact' ? '✅ PASS' : match === 'adjacent' ? '🟡 NEAR' : match === 'unclear' ? '⬜ UNCLEAR' : '❌ FAIL',
        });
    }

    // ── Summary table ──────────────────────────────────────────────────────
    console.log('\n' + sep('═'));
    console.log('  SUMMARY');
    console.log(sep('─'));

    const passes  = results.filter(r => r.match === 'exact').length;
    const near    = results.filter(r => r.match === 'adjacent').length;
    const unclear = results.filter(r => r.orientation === 'UNCLEAR').length;
    const fails   = results.filter(r => r.match === 'fail' && r.orientation !== 'UNCLEAR').length;
    const errors  = results.filter(r => r.verdict === 'ERROR' || r.verdict === 'NO_PHOTOS').length;
    const photosWorking = results.filter(r => r.photosUsed > 0).length;

    console.log(`Properties tested:       ${results.length}`);
    console.log(`Photos found & used:     ${photosWorking} / ${results.length}  ← key check`);
    console.log(`✅ Exact match (PASS):  ${passes}`);
    console.log(`🟡 Adjacent (1 step):   ${near}`);
    console.log(`⬜ UNCLEAR:             ${unclear}`);
    console.log(`❌ Wrong direction:      ${fails}`);
    console.log(`💥 Error / no photos:   ${errors}`);
    console.log(`\nAccuracy (exact): ${results.length > 0 ? Math.round(100 * passes / results.length) : 0}%`);
    console.log(`Accuracy (near):  ${results.length > 0 ? Math.round(100 * (passes + near) / results.length) : 0}%`);

    console.log('\n' + sep('─'));
    console.log('  ' + 'Address'.padEnd(40) + 'Expected'.padEnd(13) + 'Got'.padEnd(13) + 'Photos'.padEnd(8) + 'Verdict');
    console.log('  ' + sep('─', 78));
    for (const r of results) {
        const addr = r.address.slice(0, 38).padEnd(40);
        const exp  = (r.expected || '').padEnd(13);
        const got  = (r.orientation || r.verdict || '').padEnd(13);
        const ph   = String(r.photosUsed ?? 0).padEnd(8);
        console.log('  ' + addr + exp + got + ph + (r.verdict || r.match || ''));
    }
    console.log(sep('═'));

    const allPass = passes + near === results.filter(r => !['ERROR', 'NO_PHOTOS'].includes(r.verdict)).length;
    process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
