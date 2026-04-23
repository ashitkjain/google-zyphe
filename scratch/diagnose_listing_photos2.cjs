/**
 * diagnose_listing_photos2.cjs
 *
 * For Bucket 4 properties (aerial-only UNCLEAR with images that pass keyword filter),
 * checks whether Pass 2 actually ran, and if blocked, why.
 */
const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

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

const MULTI_UNIT_TYPES = ['TOWNHOUSE', 'CONDO', 'APARTMENT', 'MULTI_FAMILY'];

function score(analysis = '') {
    const lower = analysis.toLowerCase();
    return EXTERIOR_KEYWORDS.filter(kw => lower.includes(kw)).length;
}

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Pleasanton').get();

    const results = [];

    for (const d of snap.docs) {
        const p = d.data();
        if (p.deprecated) continue;
        const ai = p.orientation_ai;
        if (!ai) continue;
        if (!(ai.aerial_only_mode === true && ai.final_orientation === 'UNCLEAR')) continue;

        const homeType = (p.homeType || p.home_type || '').toUpperCase();
        const isMultiUnit = MULTI_UNIT_TYPES.includes(homeType);

        const visualSnap = await db
            .collection('properties').doc(d.id)
            .collection('analysis').doc('visual')
            .get();

        const items = visualSnap.exists
            ? (visualSnap.data()?.image_by_image_analysis || [])
            : [];

        const passing = items.filter(item => item.image_id && score(item.analysis || '') > 0);

        if (passing.length === 0) continue; // Bucket 3, skip

        const photosUsed = ai.listing_photos_used;
        const pass2Ran = Array.isArray(photosUsed) && photosUsed.length > 0;
        const batchVer = ai.batch_version || 'unknown';

        let blockedReason = null;
        if (!pass2Ran) {
            if (isMultiUnit) blockedReason = `isMultiUnit (homeType=${homeType})`;
            else blockedReason = `unknown — images available but Pass 2 did not run`;
        }

        results.push({
            address: p.address,
            zpid: d.id,
            homeType: homeType || '(none)',
            isMultiUnit,
            passingImages: passing.length,
            pass2Ran,
            blockedReason,
            batchVer,
            explanation: (ai.explanation || '').slice(0, 120),
        });
    }

    const blocked = results.filter(r => !r.pass2Ran);
    const ranStillUnclear = results.filter(r => r.pass2Ran);

    console.log(`\n══ Pass 2 BLOCKED (${blocked.length} properties) ══`);
    const byReason = {};
    blocked.forEach(r => {
        const k = r.blockedReason || 'unknown';
        if (!byReason[k]) byReason[k] = [];
        byReason[k].push(r);
    });
    Object.entries(byReason).forEach(([reason, props]) => {
        console.log(`\n  Reason: ${reason} (${props.length})`);
        props.forEach(r => console.log(`    · [${r.homeType}] ${r.address} — batch ${r.batchVer}, ${r.passingImages} images available`));
    });

    console.log(`\n══ Pass 2 RAN but still UNCLEAR (${ranStillUnclear.length} properties) ══`);
    ranStillUnclear.forEach(r => {
        console.log(`  · ${r.address}`);
        console.log(`    homeType=${r.homeType}, ${r.passingImages} images passed filter, batch=${r.batchVer}`);
        console.log(`    explanation: ${r.explanation}…`);
    });

    console.log(`\n══ Summary ══`);
    console.log(`Pass 2 blocked:          ${blocked.length}`);
    console.log(`Pass 2 ran, still UNCLEAR: ${ranStillUnclear.length}`);
    console.log(`Total Bucket 4:          ${results.length}`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
