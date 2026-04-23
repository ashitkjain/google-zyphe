/**
 * investigate_unclear_three.js
 *
 * Targeted investigation for three UNCLEAR Pleasanton properties that are showing
 * no listing photos in the Orientation Audit UI.
 *
 * Answers three questions per property:
 *   Q1. Are there photos in image_by_image_analysis that qualify as "front" candidates?
 *       (using BOTH old and new keyword sets so we can see the delta)
 *   Q2. Were they actually passed to Gemini?
 *       (checks orientation_ai.listing_photos_used in Firestore)
 *   Q3. Did the listing photos impact Gemini's analysis?
 *       (runs a fresh Gemini call with listing photos attached, compare vs current result)
 *
 * Run:
 *   cd /Users/ashitjain/colorado/zyphe/google-zyphe
 *   GOOGLE_APPLICATION_CREDENTIALS=<path-to-key.json> npx tsx scratch/investigate_unclear_three.js
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

initializeApp();
const db = getFirestore();

// ── Target properties (addresses from UI screenshot) ─────────────────────────
const TARGET_ADDRESSES = [
    '1205 Kolb St',
    '1296 Vintner Way',
    '1300 Brookline Loop',
];

// ── Keyword sets ─────────────────────────────────────────────────────────────

const OLD_KEYWORDS = [
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb appeal',
    'exterior', 'driveway', 'garage', 'front yard', 'front porch', 'porch', 'curb',
    'street view', 'front facing', 'front walk', 'landscaping', 'front elevation',
    'exterior view', 'outside', 'outdoor', 'front of the home', 'front of the house',
];

const NEW_KEYWORDS = [
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

function scoreWith(analysis = '', keywords) {
    const lower = analysis.toLowerCase();
    const matched = keywords.filter(kw => lower.includes(kw));
    return { score: matched.length, matched };
}

function findBestPhotos(imageByImage, keywords, maxCount = 3) {
    if (!Array.isArray(imageByImage) || imageByImage.length === 0) return [];
    return imageByImage
        .map((item, idx) => {
            const { score, matched } = scoreWith(item.analysis || '', keywords);
            return { url: item.image_id || '', index: idx, score, matched, analysisSnippet: (item.analysis || '').slice(0, 200) };
        })
        .filter(item => item.url && item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCount);
}

async function downloadBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return { data: Buffer.from(buf).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' };
}

const SCHEMA = {
    type: 'object',
    properties: {
        image_quality:          { type: 'string', enum: ['clear', 'acceptable', 'blurry'] },
        final_orientation:      { type: 'string' },
        azimuth_degrees:        { type: 'number', nullable: true },
        property_layout_type:   { type: 'string', enum: ['corner_lot', 'cul_de_sac', 'flag_lot', 'irregular_lot', 'standard', 'other'] },
        confidence:             { type: 'string', enum: ['high', 'medium', 'low'] },
        is_under_construction:  { type: 'boolean' },
        explanation:            { type: 'string' },
        street_view_shows_front:{ type: 'boolean', nullable: true },
        privacy_insight:        { type: 'string' },
    },
    required: ['property_layout_type', 'image_quality', 'final_orientation', 'confidence', 'explanation', 'privacy_insight'],
};

function banner(title) {
    console.log('\n' + '═'.repeat(80));
    console.log(`  ${title}`);
    console.log('═'.repeat(80));
}

function section(title) {
    console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    // Resolve Gemini key
    const keysSnap = await db.collection('app_config').doc('api_keys').get();
    const geminiKey = keysSnap.exists ? keysSnap.data().gemini_key : process.env.GEMINI_API_KEY;
    if (!geminiKey) { console.error('No Gemini key found.'); process.exit(1); }
    const gemini = new GoogleGenerativeAI(geminiKey);

    // Fetch all Pleasanton properties  
    console.log('Fetching Pleasanton properties from Firestore...');
    const propSnap = await db.collection('properties').where('city', '==', 'Pleasanton').get();
    console.log(`Found ${propSnap.size} Pleasanton properties.`);

    // Find our three targets by address prefix match
    const targets = [];
    for (const doc of propSnap.docs) {
        const p = doc.data();
        const addr = (p.address || '').toLowerCase();
        const isTarget = TARGET_ADDRESSES.some(t => addr.startsWith(t.toLowerCase()));
        if (isTarget) {
            targets.push({ zpid: doc.id, prop: p });
        }
    }

    if (targets.length === 0) {
        console.error('None of the target properties found. Check address spellings.');
        process.exit(1);
    }
    console.log(`\nFound ${targets.length} target properties.`);

    for (const { zpid, prop } of targets) {
        const address = prop.address || '';
        const currentAI = prop.orientation_ai || null;

        banner(`${address}  (ZPID: ${zpid})`);

        // ── Q2 check: what's already stored in Firestore ─────────────────────
        section('Q2: What Firestore says was passed to Gemini (orientation_ai.listing_photos_used)');
        if (!currentAI) {
            console.log('  ⚠  No orientation_ai document stored yet.');
        } else {
            console.log(`  Current result:      ${currentAI.final_orientation || 'n/a'}  (confidence: ${currentAI.confidence || '?'})`);
            console.log(`  aerial_only_mode:    ${currentAI.aerial_only_mode}`);
            const lpu = currentAI.listing_photos_used;
            if (lpu === null || lpu === undefined) {
                console.log('  listing_photos_used: null → street view was used, or field predates this feature');
            } else if (Array.isArray(lpu) && lpu.length === 0) {
                console.log('  listing_photos_used: [] → aerial-only mode, no exterior photos found (at time of last batch run)');
            } else if (Array.isArray(lpu)) {
                console.log(`  listing_photos_used: ${lpu.length} photo(s) were passed to Gemini:`);
                lpu.forEach(p => console.log(`    #${p.index}  score=${p.score}  "${p.analysisSnippet}"`));
            } else {
                console.log(`  listing_photos_used: unexpected value → ${JSON.stringify(lpu)}`);
            }
        }

        // ── Q1: Scan image_by_image_analysis with old vs new keywords ─────────
        section('Q1: Qualifying photos in image_by_image_analysis');
        let imageByImage = [];
        try {
            const visSnap = await db.collection('property_analyses_visual').doc(zpid).get();
            if (!visSnap.exists) {
                console.log('  ⚠  No property_analyses_visual document.');
            } else {
                const visData = visSnap.data();
                imageByImage = visData.image_by_image_analysis || [];
                console.log(`  Total images in image_by_image_analysis: ${imageByImage.length}`);

                const oldCandidates = findBestPhotos(imageByImage, OLD_KEYWORDS, 3);
                const newCandidates = findBestPhotos(imageByImage, NEW_KEYWORDS, 3);

                console.log(`\n  With OLD keywords (${OLD_KEYWORDS.length} terms): ${oldCandidates.length} candidates`);
                if (oldCandidates.length === 0) {
                    console.log('    None.');
                } else {
                    oldCandidates.forEach(c => {
                        console.log(`    Photo #${c.index}  score=${c.score}  matched=[${c.matched.join(', ')}]`);
                        console.log(`      "${c.analysisSnippet}"`);
                    });
                }

                console.log(`\n  With NEW keywords (${NEW_KEYWORDS.length} terms, includes aerial): ${newCandidates.length} candidates`);
                if (newCandidates.length === 0) {
                    console.log('    None — no photos qualify even with expanded keywords.');
                } else {
                    newCandidates.forEach(c => {
                        console.log(`    Photo #${c.index}  score=${c.score}  matched=[${c.matched.join(', ')}]`);
                        console.log(`      "${c.analysisSnippet}"`);
                    });
                }

                // Show ALL photos with their raw analysis so we can spot false negatives
                if (imageByImage.length > 0) {
                    console.log(`\n  Full image_by_image_analysis dump (all ${imageByImage.length} photos):`);
                    imageByImage.forEach((item, i) => {
                        const oldScore = scoreWith(item.analysis || '', OLD_KEYWORDS).score;
                        const newScore = scoreWith(item.analysis || '', NEW_KEYWORDS).score;
                        const flag = newScore > 0 ? (oldScore === 0 ? ' ← NEW keyword hit' : '') : '';
                        console.log(`    [${i}] oldScore=${oldScore} newScore=${newScore}${flag}`);
                        console.log(`         URL: ${(item.image_id || '').slice(0, 80)}...`);
                        console.log(`         Analysis: "${(item.analysis || '').slice(0, 180)}"`);
                    });
                }
            }
        } catch (e) {
            console.warn(`  Visual doc fetch error: ${e.message}`);
        }

        // ── Q3: Does sending the new candidates to Gemini change the result? ──
        section('Q3: Fresh Gemini call with new-keyword candidates → does it change the result?');

        const newCandidates = findBestPhotos(imageByImage, NEW_KEYWORDS, 3);
        const aerialUrl = prop.satelliteImageUrl;

        if (!aerialUrl) {
            console.log('  ⚠  No aerial image URL — cannot run Gemini test.');
            continue;
        }

        let aerialImg;
        try {
            aerialImg = await downloadBase64(aerialUrl);
            console.log('  ✓ Aerial image downloaded.');
        } catch (e) {
            console.log(`  ✗ Aerial download failed: ${e.message} — skipping Gemini test.`);
            continue;
        }

        const listingImgs = [];
        for (const candidate of newCandidates) {
            try {
                const img = await downloadBase64(candidate.url);
                listingImgs.push({ img, candidate });
                console.log(`  ✓ Listing photo #${candidate.index} downloaded (score=${candidate.score}).`);
            } catch (e) {
                console.log(`  ✗ Listing photo #${candidate.index} download failed: ${e.message}`);
            }
        }

        const mode = listingImgs.length > 0 ? `LISTING_PHOTOS (${listingImgs.length})` : 'AERIAL_ONLY';
        console.log(`\n  Mode used for Gemini call: ${mode}`);

        // Build prompt
        let prompt;
        if (listingImgs.length > 0) {
            const photoMeta = listingImgs.map(({ candidate }) => ({
                index: candidate.index,
                score: candidate.score,
                analysisSnippet: candidate.analysisSnippet,
            }));
            const isAerial = (snippet) => /aerial|drone|bird|overhead|top.?down|from above/i.test(snippet);
            const photoLabels = photoMeta.map((p, i) => {
                const letter = String.fromCharCode(66 + i);
                const type = isAerial(p.analysisSnippet)
                    ? 'AERIAL/DRONE listing photo — shows building footprint from above'
                    : 'exterior/ground-level listing photo';
                return `  Image ${letter} = Listing photo #${p.index + 1} (${type}): "${p.analysisSnippet.trim()}"`;
            }).join('\n');

            const streetName = address.split(',')[0].replace(/^\d+[A-Za-z]?\s+/, '').trim();
            prompt = [
                `You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and ${listingImgs.length} listing photo(s).`,
                `IMAGE GUIDE:\n  Image A = cached satellite aerial — North is UP.\n${photoLabels}`,
                `⚠️ LISTING PHOTOS KEY RULES:`,
                `  • AERIAL/DRONE listing photos: compare with Image A to confirm which face is the front.`,
                `  • GROUND-LEVEL exterior photos: look for front door/porch. Set street_view_shows_front accordingly.`,
                `PROPERTY ADDRESS: "${address}"\nFront MUST face "${streetName}".`,
                `TASK: Identify front orientation. Output final_orientation, azimuth_degrees, confidence, explanation.`,
            ].join('\n');
        } else {
            prompt = `You are a spatial analysis expert. I am providing one aerial satellite image (North-up).\n\nPROPERTY ADDRESS: "${address}"\n\nDetermine the front orientation (compass direction the front door faces). Set final_orientation, azimuth_degrees, confidence.`;
        }

        const parts = [
            { text: prompt },
            { inlineData: { mimeType: aerialImg.mimeType, data: aerialImg.data } },
            ...listingImgs.map(({ img }) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
        ];

        try {
            const model = gemini.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
            });
            const response = await model.generateContent({ contents: [{ role: 'user', parts }] });
            const result = JSON.parse(response.response.text());

            const prevOrientation = currentAI?.final_orientation || 'NONE';
            const newOrientation = result.final_orientation || 'UNCLEAR';
            const changed = prevOrientation.toLowerCase() !== newOrientation.toLowerCase();

            console.log(`\n  Previous Gemini result: ${prevOrientation} (confidence: ${currentAI?.confidence || '?'})`);
            console.log(`  New Gemini result:      ${newOrientation} (confidence: ${result.confidence || '?'})`);
            console.log(`  Result changed:         ${changed ? '✅ YES — listing photos made a difference!' : '⬜ NO — same result'}`);
            console.log(`\n  New explanation:\n${(result.explanation || '').split('\n').map(l => '    ' + l).join('\n')}`);
        } catch (e) {
            console.log(`  ✗ Gemini call failed: ${e.message}`);
        }
    }

    banner('INVESTIGATION COMPLETE');
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
