/**
 * investigate_unclear_three.js  (CommonJS — runs in functions/ which is type:commonjs)
 *
 * Answers three questions per property:
 *   Q1. Are there photos in image_by_image_analysis that qualify as "front" candidates?
 *   Q2. Were they actually passed to Gemini? (checks orientation_ai.listing_photos_used)
 *   Q3. Does sending those photos to Gemini change the result vs current UNCLEAR?
 */

'use strict';

const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();
const db = admin.firestore();

// ── Target properties ─────────────────────────────────────────────────────────
const TARGET_ADDRESSES = [
    '1265 Kolln',
    '1296 Vintner Way',
    '1380 Brookline Loop',
];

// ── Keyword sets ─────────────────────────────────────────────────────────────

const OLD_KEYWORDS = [
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb appeal',
    'exterior', 'driveway', 'garage', 'front yard', 'front porch', 'porch', 'curb',
    'street view', 'front facing', 'front walk', 'landscaping', 'front elevation',
    'exterior view', 'outside', 'outdoor', 'front of the home', 'front of the house',
];

const NEW_KEYWORDS = [
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb appeal',
    'front of the home', 'front of the house', 'front elevation', 'front facing', 'front walk',
    'front porch', 'front yard',
    'exterior', 'driveway', 'garage', 'porch', 'curb',
    'exterior view', 'outside', 'outdoor', 'landscaping',
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
            return {
                url: item.image_id || '',
                index: idx,
                score,
                matched,
                analysisSnippet: (item.analysis || '').slice(0, 200),
            };
        })
        .filter(item => item.url && item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCount);
}

async function downloadBase64(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return {
        data: Buffer.from(buf).toString('base64'),
        mimeType: res.headers.get('content-type') || 'image/jpeg',
    };
}

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

function banner(title) {
    console.log('\n' + '═'.repeat(80));
    console.log('  ' + title);
    console.log('═'.repeat(80));
}

function section(title) {
    console.log(`\n  ── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

async function main() {
    // Resolve Gemini key
    const keysSnap = await db.collection('app_config').doc('api_keys').get();
    const geminiKey = keysSnap.exists ? keysSnap.data().gemini_key : process.env.GEMINI_API_KEY;
    if (!geminiKey) { console.error('No Gemini key found.'); process.exit(1); }
    const gemini = new GoogleGenerativeAI(geminiKey);

    console.log('Fetching Pleasanton properties from Firestore...');
    const propSnap = await db.collection('properties').where('city', '==', 'Pleasanton').get();
    console.log(`Found ${propSnap.size} Pleasanton properties.`);

    const targets = [];
    for (const docSnap of propSnap.docs) {
        const p = docSnap.data();
        const addr = (p.address || '').toLowerCase();
        if (TARGET_ADDRESSES.some(t => addr.includes(t.toLowerCase()))) {
            targets.push({ zpid: docSnap.id, prop: p });
        }
    }

    if (targets.length === 0) {
        console.error('None of the target properties found. Check address spellings.');
        process.exit(1);
    }
    console.log(`Matched ${targets.length} target properties.\n`);

    for (const { zpid, prop } of targets) {
        const address = prop.address || '';
        const currentAI = prop.orientation_ai || null;

        banner(`${address}  (ZPID: ${zpid})`);

        // ── Q2: What Firestore says was passed to Gemini ──────────────────────
        section('Q2: orientation_ai.listing_photos_used in Firestore');
        if (!currentAI) {
            console.log('  ⚠  No orientation_ai stored yet.');
        } else {
            console.log(`  Current result:       ${currentAI.final_orientation || 'n/a'}  (confidence: ${currentAI.confidence || '?'})`);
            console.log(`  aerial_only_mode:     ${currentAI.aerial_only_mode}`);
            const lpu = currentAI.listing_photos_used;
            if (lpu === null || lpu === undefined) {
                console.log('  listing_photos_used:  null → field not present (predates feature, or street view was used)');
            } else if (Array.isArray(lpu) && lpu.length === 0) {
                console.log('  listing_photos_used:  [] → aerial-only, no exterior photos found at time of last batch run');
            } else if (Array.isArray(lpu)) {
                console.log(`  listing_photos_used:  ${lpu.length} photo(s) were sent to Gemini:`);
                lpu.forEach(p => console.log(`    → #${p.index}  score=${p.score}  "${(p.analysisSnippet || '').slice(0, 100)}"`));
            } else {
                console.log(`  listing_photos_used:  unexpected → ${JSON.stringify(lpu)}`);
            }
        }

        // ── Q1: Scan image_by_image_analysis ─────────────────────────────────
        section('Q1: Qualifying photos in image_by_image_analysis');
        let imageByImage = [];
        try {
            const visSnap = await db.collection('properties').doc(zpid).collection('analysis').doc('visual').get();
            if (!visSnap.exists) {
                console.log('  ⚠  No property_analyses_visual document found.');
            } else {
                imageByImage = visSnap.data().image_by_image_analysis || [];
                console.log(`  Total images: ${imageByImage.length}`);

                const oldCandidates = findBestPhotos(imageByImage, OLD_KEYWORDS, 3);
                const newCandidates = findBestPhotos(imageByImage, NEW_KEYWORDS, 3);

                console.log(`\n  OLD keywords (${OLD_KEYWORDS.length} terms): ${oldCandidates.length} candidate(s)`);
                if (oldCandidates.length === 0) {
                    console.log('    → None qualify.');
                } else {
                    oldCandidates.forEach(c => {
                        console.log(`    Photo #${c.index}  score=${c.score}  matched=[${c.matched.join(', ')}]`);
                        console.log(`      "${c.analysisSnippet}"`);
                    });
                }

                console.log(`\n  NEW keywords (${NEW_KEYWORDS.length} terms, +aerial): ${newCandidates.length} candidate(s)`);
                if (newCandidates.length === 0) {
                    console.log('    → None qualify even with expanded keywords.');
                } else {
                    newCandidates.forEach(c => {
                        const isAerial = /aerial|drone|bird|overhead|top.?down|from above/i.test(c.analysisSnippet);
                        console.log(`    Photo #${c.index}  score=${c.score}  type=${isAerial ? 'AERIAL' : 'GROUND'}  matched=[${c.matched.join(', ')}]`);
                        console.log(`      "${c.analysisSnippet}"`);
                    });
                }

                // Full dump of all photos so we can spot false negatives
                console.log(`\n  All ${imageByImage.length} photo analyses (old→new score):`);
                imageByImage.forEach((item, i) => {
                    const oldS = scoreWith(item.analysis || '', OLD_KEYWORDS).score;
                    const newS = scoreWith(item.analysis || '', NEW_KEYWORDS).score;
                    const flag = newS > 0 && oldS === 0 ? ' ← NEW hit' : (newS > 0 ? ' ← qualified' : '');
                    const snippet = (item.analysis || 'n/a').slice(0, 100);
                    console.log(`    [${String(i).padStart(2)}] ${oldS}→${newS}${flag}`);
                    console.log(`         "${snippet}"`);
                });
            }
        } catch (e) {
            console.warn(`  Error fetching visual doc: ${e.message}`);
        }

        // ── Q3: Does Gemini get better results with the new candidates? ───────
        section('Q3: Fresh Gemini call — does sending photos change result?');

        const newCandidates = findBestPhotos(imageByImage, NEW_KEYWORDS, 3);
        const aerialUrl = prop.satelliteImageUrl;

        if (!aerialUrl) {
            console.log('  ⚠  No aerial URL — skipping Gemini test.');
            continue;
        }

        let aerialImg;
        try {
            aerialImg = await downloadBase64(aerialUrl);
            console.log('  ✓  Aerial image downloaded successfully.');
        } catch (e) {
            console.log(`  ✗  Aerial download failed: ${e.message} — skip.`);
            continue;
        }

        const listingImgs = [];
        for (const c of newCandidates) {
            try {
                const img = await downloadBase64(c.url);
                listingImgs.push({ img, candidate: c });
                const isAerial = /aerial|drone|bird|overhead|top.?down|from above/i.test(c.analysisSnippet);
                console.log(`  ✓  Listing photo #${c.index} downloaded (score=${c.score}, type=${isAerial ? 'AERIAL' : 'GROUND'}).`);
            } catch (e) {
                console.log(`  ✗  Listing photo #${c.index} failed: ${e.message}`);
            }
        }

        const mode = listingImgs.length > 0 ? `LISTING_PHOTOS (${listingImgs.length})` : 'AERIAL_ONLY';
        console.log(`\n  Gemini call mode: ${mode}`);

        let prompt;
        if (listingImgs.length > 0) {
            const photoMeta = listingImgs.map(({ candidate }) => candidate);
            const photoLabels = photoMeta.map((p, i) => {
                const letter = String.fromCharCode(66 + i);
                const isA = /aerial|drone|bird|overhead|top.?down|from above/i.test(p.analysisSnippet);
                const type = isA
                    ? 'AERIAL/DRONE listing photo — shows building footprint from above'
                    : 'exterior/ground-level listing photo';
                return `  Image ${letter} = Listing photo #${p.index + 1} (${type}): "${p.analysisSnippet.trim()}"`;
            }).join('\n');
            const streetName = address.split(',')[0].replace(/^\d+[A-Za-z]?\s+/, '').trim();
            prompt = [
                `You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and ${listingImgs.length} listing photo(s).`,
                `IMAGE GUIDE:\n  Image A = cached satellite aerial — North is UP.\n${photoLabels}`,
                `⚠️ LISTING PHOTOS: use aerial/drone photos to confirm building layout; use ground-level photos to identify front door/porch.`,
                `PROPERTY ADDRESS: "${address}"\nFront MUST face "${streetName}".`,
                `TASK: Identify the front orientation. Set street_view_shows_front=true only if front door is clearly visible.`,
            ].join('\n');
        } else {
            prompt = `You are a spatial analysis expert. Aerial satellite image (North-up).\nPROPERTY ADDRESS: "${address}"\nDetermine front orientation.`;
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

            const prev = currentAI?.final_orientation || 'NONE';
            const next = result.final_orientation || 'UNCLEAR';
            const changed = prev.toLowerCase() !== next.toLowerCase();

            console.log(`\n  Previous (stored):  ${prev} (${currentAI?.confidence || '?'})`);
            console.log(`  New (this run):     ${next} (${result.confidence || '?'})`);
            console.log(`  Changed:            ${changed ? '✅ YES — photos made a difference' : '⬜ NO — same result'}`);
            console.log(`  street_view_shows_front: ${result.street_view_shows_front}`);
            console.log(`\n  Explanation:\n${(result.explanation || '').split('\n').map(l => '    ' + l).join('\n')}`);
        } catch (e) {
            console.log(`  ✗ Gemini call failed: ${e.message}`);
        }
    }

    banner('DONE');
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
