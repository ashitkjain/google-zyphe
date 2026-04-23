const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TARGETS = ['3624 Canelli Ct', '3825 Brockton Dr'];

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Pleasanton').get();

    for (const d of snap.docs) {
        const p = d.data();
        if (!TARGETS.some(a => (p.address || '').startsWith(a))) continue;

        const ai = p.orientation_ai || {};
        const gtSnap = await db.collection('orientation_ground_truth').doc(d.id).get();
        const gt = gtSnap.exists ? gtSnap.data() : null;

        const visualSnap = await db.collection('properties').doc(d.id)
            .collection('analysis').doc('visual').get();
        const items = visualSnap.exists ? (visualSnap.data().image_by_image_analysis || []) : [];
        const photosUsed = ai.listing_photos_used;

        console.log('\n' + '═'.repeat(60));
        console.log(`ADDRESS:          ${p.address}`);
        console.log(`homeType:         ${p.homeType || '(none)'}`);
        console.log(`layout:           ${ai.property_layout_type}`);
        console.log(`confidence:       ${ai.confidence}`);
        console.log(`final_orientation:${ai.final_orientation}`);
        console.log(`azimuth_degrees:  ${ai.azimuth_degrees ?? 'null'}`);
        console.log(`aerial_only_mode: ${ai.aerial_only_mode}`);
        console.log(`sv_shows_front:   ${ai.street_view_shows_front ?? 'null'}`);
        console.log(`listing_photos:   ${Array.isArray(photosUsed) ? photosUsed.length + ' used' : 'none'}`);
        console.log(`batch_version:    ${ai.batch_version}`);
        console.log(`ground_truth:     ${gt?.expected_orientation ?? '(none)'}`);
        console.log(`visual images:    ${items.length} total`);
        console.log(`_debug:           ${JSON.stringify(ai._debug ?? {})}`);
        console.log(`\nEXPLANATION:\n${ai.explanation || '(none)'}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
