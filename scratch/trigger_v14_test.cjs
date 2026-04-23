/**
 * trigger_v14_test.cjs
 * Tests v14 PERPENDICULAR TIE-BREAKER fix on properties with known 180° flip:
 *   - 4866 Shelton St, Dublin   (GT=Northeast, v13 gave SW)
 *   - Melissa Ln, Dublin        (GT unknown, v13 had flip)
 * Looks up zpids by address prefix in Firestore.
 */
const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/Downloads/zyphe-af0bf-firebase-adminsdk-fbsvc-7b27dbc99e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TARGETS = [
    { prefix: '4866 Shelton', label: '4866 Shelton St, Dublin', gt: 'Northeast' },
    { prefix: 'Melissa Ln', label: 'Melissa Ln, Dublin', gt: '?' },
    { prefix: '4431 Duccio', label: '4431 Duccio Pl, Dublin', gt: 'N-S street, should be E or W facing' },
];

async function findZpids() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();
    const results = [];
    for (const t of TARGETS) {
        const doc = snap.docs.find(d => (d.data().address || '').includes(t.prefix));
        if (doc) results.push({ zpid: doc.id, ...t });
        else console.log(`NOT FOUND: ${t.prefix}`);
    }
    return results;
}

async function main() {
    const targets = await findZpids();
    if (targets.length === 0) { console.log('No targets found'); process.exit(1); }

    const zpids = targets.map(t => t.zpid);
    const jobRef = db.collection('orientation_batch_jobs').doc();
    await jobRef.set({
        zpids,
        status: 'queued',
        total: zpids.length,
        done: 0, failed: 0,
        userId: 'admin-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Queued job:', jobRef.id, 'for zpids:', zpids.join(', '));
    targets.forEach(t => console.log(`  ${t.zpid} → ${t.label} (GT: ${t.gt})`));
    console.log('\nWaiting 90s...');

    await new Promise(r => setTimeout(r, 90000));

    const jobSnap = await jobRef.get();
    const job = jobSnap.data();
    console.log(`\nJob: ${job.status}  done=${job.done}/${job.total}  failed=${job.failed}`);

    for (const t of targets) {
        const snap = await db.collection('properties').doc(t.zpid).get();
        const ai = (snap.data() || {}).orientation_ai || {};
        console.log('\n' + '═'.repeat(60));
        console.log(`PROPERTY:            ${t.label}`);
        console.log(`GROUND TRUTH:        ${t.gt}`);
        console.log(`batch_version:       ${ai.batch_version}`);
        console.log(`final_orientation:   ${ai.final_orientation}`);
        console.log(`azimuth_degrees:     ${ai.azimuth_degrees ?? 'null'}`);
        console.log(`confidence:          ${ai.confidence}`);
        console.log(`layout:              ${ai.property_layout_type}`);
        console.log(`street_bearing_map:  ${ai.street_bearing_from_map ?? 'null'}`);
        const expl = ai.explanation || '';
        const streetCtx = expl.match(/\(2\)[^(]*/)?.[0] || '(not found)';
        console.log(`STREET CONTEXT:\n  ${streetCtx.slice(0, 250)}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
