/**
 * diagnose_listing_photos.cjs
 *
 * For every Pleasanton property that is aerial-only UNCLEAR, checks:
 *   1. Does properties/{zpid}/analysis/visual exist?
 *   2. How many image_by_image_analysis entries does it have?
 *   3. How many pass the current EXTERIOR_KEYWORDS filter (score > 0)?
 *   4. For those with score === 0, prints their full analysis text so we
 *      can judge whether to expand the keyword list.
 *
 * Run:
 *   node scratch/diagnose_listing_photos.cjs
 */

const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Same keyword list as orientationBatch.js ──────────────────────────────────
const EXTERIOR_KEYWORDS = [
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb appeal',
    'front of the home', 'front of the house', 'front elevation', 'front facing', 'front walk',
    'front porch', 'front yard',
    'exterior', 'driveway', 'garage', 'porch', 'curb',
    'exterior view', 'outside', 'outdoor', 'landscaping',
    'aerial view', 'aerial photo', 'aerial image', "bird's eye", "bird's-eye", 'drone',
    'overhead view', 'overhead photo', 'top-down', 'top down', 'from above',
    'surrounding neighborhood', 'property location',
];

function score(analysis = '') {
    const lower = analysis.toLowerCase();
    return EXTERIOR_KEYWORDS.filter(kw => lower.includes(kw)).length;
}

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Pleasanton').get();

    const targets = [];
    snap.docs.forEach(d => {
        const p = d.data();
        if (p.deprecated) return;
        const ai = p.orientation_ai;
        if (!ai) return;
        if (ai.aerial_only_mode === true && ai.final_orientation === 'UNCLEAR') {
            targets.push({ zpid: d.id, address: p.address });
        }
    });

    console.log(`Found ${targets.length} aerial-only UNCLEAR properties in Pleasanton\n`);

    const buckets = {
        noVisualDoc: [],
        noImages: [],
        nonePass: [],       // has images but all score 0
        somePass: [],       // at least one image passes
    };

    // Collect all zero-score descriptions for keyword expansion analysis
    const zeroScoreDescriptions = [];

    for (const { zpid, address } of targets) {
        const visualSnap = await db
            .collection('properties').doc(zpid)
            .collection('analysis').doc('visual')
            .get();

        if (!visualSnap.exists) {
            buckets.noVisualDoc.push(address);
            continue;
        }

        const data = visualSnap.data() || {};
        const items = Array.isArray(data.image_by_image_analysis) ? data.image_by_image_analysis : [];

        if (items.length === 0) {
            buckets.noImages.push(address);
            continue;
        }

        const scored = items.map((item, idx) => ({
            idx,
            url: item.image_id || '',
            s: score(item.analysis || ''),
            text: (item.analysis || '').trim(),
        }));

        const passing = scored.filter(x => x.url && x.s > 0);
        const zeros   = scored.filter(x => x.s === 0 && x.text.length > 0);

        if (passing.length > 0) {
            buckets.somePass.push({ address, passing: passing.length, total: items.length });
        } else {
            buckets.nonePass.push({ address, total: items.length });
            zeros.forEach(x => zeroScoreDescriptions.push({ address, idx: x.idx, text: x.text }));
        }
    }

    // ── Report ────────────────────────────────────────────────────────────────

    console.log('══════════════════════════════════════════════');
    console.log(`BUCKET 1 — No analysis/visual subcollection: ${buckets.noVisualDoc.length}`);
    buckets.noVisualDoc.forEach(a => console.log(`  · ${a}`));

    console.log(`\nBUCKET 2 — Has visual doc but empty image_by_image_analysis: ${buckets.noImages.length}`);
    buckets.noImages.forEach(a => console.log(`  · ${a}`));

    console.log(`\nBUCKET 3 — Has images but NONE pass keyword filter: ${buckets.nonePass.length}`);
    buckets.nonePass.forEach(({ address, total }) => console.log(`  · ${address} (${total} images)`));

    console.log(`\nBUCKET 4 — Has images that DO pass keyword filter: ${buckets.somePass.length}`);
    buckets.somePass.forEach(({ address, passing, total }) =>
        console.log(`  · ${address} (${passing}/${total} pass)`));

    // ── Zero-score descriptions (expand keyword analysis) ─────────────────────
    if (zeroScoreDescriptions.length > 0) {
        console.log('\n══════════════════════════════════════════════');
        console.log(`ZERO-SCORE DESCRIPTIONS (${zeroScoreDescriptions.length} total — from Bucket 3 properties)`);
        console.log('These descriptions contain no current keywords. Review for expansion:\n');

        // Group by property
        const byAddr = {};
        zeroScoreDescriptions.forEach(({ address, idx, text }) => {
            if (!byAddr[address]) byAddr[address] = [];
            byAddr[address].push({ idx, text });
        });

        Object.entries(byAddr).forEach(([address, entries]) => {
            console.log(`--- ${address}`);
            entries.forEach(({ idx, text }) => console.log(`  [img ${idx}] ${text}`));
            console.log();
        });
    }

    console.log('\n══ Summary ══');
    console.log(`No visual doc:       ${buckets.noVisualDoc.length}`);
    console.log(`Empty image list:    ${buckets.noImages.length}`);
    console.log(`None pass filter:    ${buckets.nonePass.length}`);
    console.log(`Some pass filter:    ${buckets.somePass.length}  ← these SHOULD be getting photos`);
    console.log(`Total UNCLEAR:       ${targets.length}`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
