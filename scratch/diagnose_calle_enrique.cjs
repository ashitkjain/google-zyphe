/**
 * diagnose_calle_enrique.cjs
 * Checks ground truth, listing photo availability, and exactly why Pass 2
 * is being skipped for 1421 and 1558 Calle Enrique.
 */
const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const MULTI_UNIT_TYPES = ['TOWNHOUSE', 'CONDO', 'APARTMENT', 'MULTI_FAMILY'];
const EXTERIOR_KEYWORDS = [
    'front door', 'entryway', 'entry door', 'entrance', 'front of', 'facade', 'curb appeal',
    'front of the home', 'front of the house', 'front elevation', 'front facing', 'front walk',
    'front porch', 'front yard', 'exterior', 'driveway', 'garage', 'porch', 'curb',
    'exterior view', 'outside', 'outdoor', 'landscaping',
    'aerial view', 'aerial photo', 'aerial image', "bird's eye", "bird's-eye", 'drone',
    'overhead view', 'overhead photo', 'top-down', 'top down', 'from above',
    'surrounding neighborhood', 'property location',
];
function score(analysis = '') {
    return EXTERIOR_KEYWORDS.filter(kw => analysis.toLowerCase().includes(kw)).length;
}

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Pleasanton').get();

    for (const d of snap.docs) {
        const p = d.data();
        if (!['1421 Calle Enrique', '1558 Calle Enrique'].some(a => (p.address || '').startsWith(a))) continue;

        const ai = p.orientation_ai || {};
        const homeType = (p.homeType || p.home_type || '').toUpperCase();
        const isMultiUnit = MULTI_UNIT_TYPES.includes(homeType);

        // Ground truth
        const gtSnap = await db.collection('orientation_ground_truth').doc(d.id).get();
        const gt = gtSnap.exists ? gtSnap.data() : null;

        // Visual analysis subcollection
        const visualSnap = await db.collection('properties').doc(d.id)
            .collection('analysis').doc('visual').get();
        const items = visualSnap.exists
            ? (visualSnap.data().image_by_image_analysis || [])
            : [];
        const passing = items.filter(x => x.image_id && score(x.analysis || '') > 0);

        console.log('\n' + '═'.repeat(60));
        console.log(`ADDRESS:  ${p.address}`);
        console.log(`ZPID:     ${d.id}`);
        console.log(`homeType: ${homeType}  →  isMultiUnit=${isMultiUnit}`);
        console.log('');
        console.log('─── Ground Truth ───');
        if (gt) {
            console.log(`  expected_orientation: ${gt.expected_orientation}`);
            console.log(`  gt_source:            ${gt.gt_source}`);
        } else {
            console.log('  (no ground truth record)');
        }
        console.log('');
        console.log('─── What Gemini returned (v6) ───');
        console.log(`  final_orientation (text): ${ai.final_orientation}`);
        console.log(`  azimuth_degrees (schema):  ${ai.azimuth_degrees ?? 'null  ← BUG: null despite confident answer'}`);
        console.log(`  confidence:                ${ai.confidence}`);
        console.log(`  Gemini said in explanation: "${(ai.explanation || '').slice(-100)}"`);
        console.log('');
        console.log('─── Why Pass 2 (listing photos) was skipped ───');
        console.log(`  isMultiUnit gate:      ${isMultiUnit} (homeType=${homeType})  ← blocks Pass 2`);
        console.log(`  Images passing filter: ${passing.length} of ${items.length}`);
        console.log('');
        console.log('─── Available exterior images (would be sent in Pass 2) ───');
        passing.forEach((x, i) => {
            const idx = items.indexOf(items.find(it => it.image_id === x.image_id));
            console.log(`  [img ${idx}] score=${score(x.analysis||'')}  "${(x.analysis||'').slice(0, 120)}"`);
        });
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
