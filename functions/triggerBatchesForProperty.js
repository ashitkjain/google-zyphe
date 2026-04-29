'use strict';
/**
 * Triggers Property Data, Orientation, and Full Intel batches for a single ZPID.
 * Usage: node triggerBatchesForProperty.js <zpid>
 */

const admin = require('firebase-admin');

async function main() {
    const zpid = process.argv[2] || '53050869';
    console.log(`Triggering all 3 batches for ZPID: ${zpid}`);

    if (!admin.apps.length) {
        admin.initializeApp();
    }
    const db = admin.firestore();

    const now = admin.firestore.FieldValue.serverTimestamp();

    const [propJob, orientJob, intelJob] = await Promise.all([
        db.collection('property_data_batch_jobs').add({
            zpids: [zpid],
            status: 'queued',
            total: 1,
            done: 0,
            failed: 0,
            createdAt: now,
            source: 'manual_heal'
        }),
        db.collection('orientation_batch_jobs').add({
            zpids: [zpid],
            status: 'queued',
            total: 1,
            done: 0,
            failed: 0,
            createdAt: now,
            source: 'manual_heal'
        }),
        db.collection('full_intel_batch_jobs').add({
            zpids: [zpid],
            status: 'queued',
            total: 1,
            done: 0,
            failed: 0,
            force: false,
            createdAt: now,
            source: 'manual_heal'
        })
    ]);

    console.log(`✅ Property Data Batch job: ${propJob.id}`);
    console.log(`✅ Orientation Batch job:   ${orientJob.id}`);
    console.log(`✅ Full Intel Batch job:    ${intelJob.id}`);
    console.log('\nAll 3 batch jobs queued. Check Firebase Console for status.');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
