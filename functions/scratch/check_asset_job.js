const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('asset_batch_jobs').doc('AJGfr0f1nQkEx2KqYhkj').get();
    console.log('Asset job status:', JSON.stringify(snap.data(), null, 2));
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
