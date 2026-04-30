const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const ZPIDS = ['79533474', '25064628'];

async function main() {
    // Set updatedAt to 31 days ago to bypass the 30-day isFresh cache
    const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    console.log(`Setting updatedAt to ${staleDate.toISOString()} to force fresh RapidAPI fetch\n`);

    for (const zpid of ZPIDS) {
        await db.collection('properties').doc(zpid).update({ updatedAt: staleDate });
        console.log(`  ✓ Expired cache for ${zpid}`);
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // Queue property + orientation + intel batches for both
    const [propJob, orientJob, intelJob, assetJob] = await Promise.all([
        db.collection('property_data_batch_jobs').add({
            zpids: ZPIDS, status: 'queued', total: ZPIDS.length, done: 0, failed: 0,
            createdAt: now, source: 'manual_test'
        }),
        db.collection('orientation_batch_jobs').add({
            zpids: ZPIDS, status: 'queued', total: ZPIDS.length, done: 0, failed: 0,
            createdAt: now, source: 'manual_test'
        }),
        db.collection('full_intel_batch_jobs').add({
            zpids: ZPIDS, status: 'queued', total: ZPIDS.length, done: 0, failed: 0,
            force: false, createdAt: now, source: 'manual_test'
        }),
        db.collection('asset_batch_jobs').add({
            zpids: ZPIDS, status: 'queued', total: ZPIDS.length, done: 0, failed: 0,
            createdAt: now, source: 'manual_test'
        }),
    ]);

    console.log(`\n✅ property_data_batch_jobs: ${propJob.id}`);
    console.log(`✅ orientation_batch_jobs:   ${orientJob.id}`);
    console.log(`✅ full_intel_batch_jobs:    ${intelJob.id}`);
    console.log(`✅ asset_batch_jobs:         ${assetJob.id}`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
