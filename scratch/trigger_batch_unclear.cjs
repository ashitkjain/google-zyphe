/**
 * trigger_batch_unclear.cjs
 * Queues a batch orientation job for the 3 remaining UNCLEAR Pleasanton properties.
 * These should pick up v9 fixes: Canelli Ct (corner lot), Amberwood Cir, Palomino Dr Unit D.
 */
const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TARGET_ZPIDS = [
    '25067032', // 4159 Amberwood Cir
    '25076980', // 3624 Canelli Ct
    '25077044', // 685 Palomino Dr Unit D
];

async function main() {
    const jobRef = db.collection('orientation_batch_jobs').doc();
    await jobRef.set({
        zpids: TARGET_ZPIDS,
        status: 'queued',
        total: TARGET_ZPIDS.length,
        done: 0,
        failed: 0,
        userId: 'admin-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Queued batch job: ${jobRef.id}`);
    console.log(`ZPIDs: ${TARGET_ZPIDS.join(', ')}`);
    console.log('Waiting 60s for Cloud Function to process...');

    await new Promise(r => setTimeout(r, 60000));

    const jobSnap = await jobRef.get();
    const job = jobSnap.data();
    console.log(`\nJob status: ${job.status} — done=${job.done}/${job.total}, failed=${job.failed}`);

    // Check results
    for (const zpid of TARGET_ZPIDS) {
        const propSnap = await db.collection('properties').doc(zpid).get();
        const p = propSnap.data() || {};
        const ai = p.orientation_ai || {};
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`ZPID: ${zpid}  ADDRESS: ${p.address}`);
        console.log(`final_orientation:  ${ai.final_orientation}`);
        console.log(`confidence:         ${ai.confidence}`);
        console.log(`batch_version:      ${ai.batch_version}`);
        console.log(`aerial_only_mode:   ${ai.aerial_only_mode}`);
        console.log(`shows_front:        ${ai.street_view_shows_front ?? 'null'}`);
        console.log(`layout:             ${ai.property_layout_type}`);
        console.log(`listing_photos:     ${Array.isArray(ai.listing_photos_used) ? ai.listing_photos_used.length + ' used' : 'none'}`);
        console.log(`azimuth_degrees:    ${ai.azimuth_degrees ?? 'null'}`);
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
