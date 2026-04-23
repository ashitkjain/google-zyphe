/**
 * trigger_v11_test.cjs
 * Tests v11 roadmap image feature on two properties with suppressed GPS bearing:
 *   - 4431 Duccio Pl, Dublin (GPS fails: short dead-end, Gemini said E-W when it's N-S)
 *   - 1515 Germano Way, Pleasanton (GPS fails: short cul-de-sac, Gemini said E-W when it's SW-NE)
 */
const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TARGETS = [
    { zpid: '116150136', label: '4431 Duccio Pl, Dublin' },
    // Find Germano Way zpid below
];

async function findGermano() {
    const snap = await db.collection('properties').where('city', '==', 'Pleasanton').get();
    const doc = snap.docs.find(d => (d.data().address || '').startsWith('1515 Germano'));
    return doc ? doc.id : null;
}

async function main() {
    const germanoZpid = await findGermano();
    if (germanoZpid) TARGETS.push({ zpid: germanoZpid, label: '1515 Germano Way, Pleasanton' });
    else console.log('Germano Way not found');

    const zpids = TARGETS.map(t => t.zpid);
    const jobRef = db.collection('orientation_batch_jobs').doc();
    await jobRef.set({
        zpids,
        status: 'queued',
        total: zpids.length,
        done: 0, failed: 0,
        userId: 'admin-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Queued job:', jobRef.id, 'for', zpids.join(', '));
    console.log('Waiting 90s...');

    await new Promise(r => setTimeout(r, 90000));

    const jobSnap = await jobRef.get();
    const job = jobSnap.data();
    console.log('Job:', job.status, `done=${job.done}/${job.total} failed=${job.failed}`);

    for (const { zpid, label } of TARGETS) {
        const snap = await db.collection('properties').doc(zpid).get();
        const ai = (snap.data() || {}).orientation_ai || {};
        console.log('\n' + '═'.repeat(60));
        console.log('PROPERTY:', label);
        console.log('batch_version:        ', ai.batch_version);
        console.log('final_orientation:    ', ai.final_orientation);
        console.log('azimuth_degrees:      ', ai.azimuth_degrees ?? 'null');
        console.log('confidence:           ', ai.confidence);
        console.log('street_bearing_from_map:', ai.street_bearing_from_map ?? 'null  ← should be ~0° (N-S) for Duccio, ~45° (SW-NE) for Germano');
        console.log('EXPLANATION (street context):');
        const expl = ai.explanation || '';
        const streetCtx = expl.match(/\(2\)[^(]*/)?.[0] || '(not found)';
        console.log(' ', streetCtx.slice(0, 200));
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
