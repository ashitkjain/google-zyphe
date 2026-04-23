/**
 * trigger_v15_test.cjs
 * Tests v15 (softened GPS hint) on:
 *   - 3624 Canelli Ct (GT=North, v14 hallucinated SW)
 *   - 4866 Shelton St (GT=Northeast, v14 fixed correctly — must not regress)
 *   - 4153 Alba Ct (GT=Northwest, v14 gave SE)
 *   - 7518 Rosedale Ct (GT=Northeast, v14 gave SE)
 */
const admin = require('firebase-admin');
const sa = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const TARGETS = [
    { zpid: '25076980', label: '3624 Canelli Ct, Pleasanton', gt: 'North' },
    { zpid: '89033258', label: '4866 Shelton St, Dublin', gt: 'Northeast' },
    { zpid: '25073252', label: '4153 Alba Ct, Pleasanton', gt: 'Northwest' },
    { zpid: '25867804', label: '7518 Rosedale Ct, Pleasanton', gt: 'Northeast' },
];

async function main() {
    const zpids = TARGETS.map(t => t.zpid);
    const jobRef = db.collection('orientation_batch_jobs').doc();
    await jobRef.set({
        zpids, status: 'queued', total: zpids.length,
        done: 0, failed: 0, userId: 'admin-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Queued job:', jobRef.id);
    TARGETS.forEach(t => console.log(`  ${t.zpid} → ${t.label} (GT: ${t.gt})`));
    console.log('\nWaiting 90s...');
    await new Promise(r => setTimeout(r, 90000));

    const jobSnap = await jobRef.get();
    const job = jobSnap.data();
    console.log(`\nJob: ${job.status}  done=${job.done}/${job.total}  failed=${job.failed}`);

    for (const t of TARGETS) {
        const snap = await db.collection('properties').doc(t.zpid).get();
        const ai = (snap.data() || {}).orientation_ai || {};
        const pass = ai.final_orientation?.toLowerCase().startsWith(t.gt.toLowerCase()) ? '✓' : '✗';
        console.log(`\n${pass} ${t.label}`);
        console.log(`  GT:      ${t.gt}`);
        console.log(`  AI:      ${ai.final_orientation} (${ai.azimuth_degrees ?? 'null'}°)  conf=${ai.confidence}  ver=${ai.batch_version}`);
        console.log(`  layout:  ${ai.property_layout_type}`);
        console.log(`  map_brg: ${ai.street_bearing_from_map ?? 'null'}`);
        const expl = ai.explanation || '';
        const street = expl.match(/\(2\)[^(]*/)?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 180) || '';
        const aerial = expl.match(/\(3\)[^(]*/)?.[0]?.replace(/\s+/g, ' ').trim().slice(0, 180) || '';
        if (street) console.log(`  street:  ${street}`);
        if (aerial) console.log(`  aerial:  ${aerial}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
