const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const job = await db.collection('asset_secure_batch_jobs').add({
        zpids: ['79533474', '25064628'],
        status: 'queued', total: 2, done: 0, failed: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'manual_test'
    });
    console.log(`✅ asset_secure_batch_jobs: ${job.id}`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
