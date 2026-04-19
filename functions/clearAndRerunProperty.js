#!/usr/bin/env node
/**
 * clearAndRerunProperty.js
 *
 * Clears the cached orientation_ai from a specific property and re-queues
 * it through the orientation batch Cloud Function for a fresh analysis run.
 *
 * Usage:
 *   node functions/clearAndRerunProperty.js "3208 Touriga Dr"
 */
'use strict';

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'zyphe-af0bf' });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const searchTerm = (process.argv[2] || '3208 Touriga Dr').toLowerCase();

async function main() {
    console.log(`\n🔍 Searching for property matching: "${searchTerm}"\n`);

    // Query Pleasanton properties (broad, filter client-side)
    const snap = await db.collection('properties')
        .where('city', '==', 'Pleasanton')
        .limit(200)
        .get();

    const match = snap.docs.find(d => {
        const addr = (d.data().address || '').toLowerCase();
        return addr.includes(searchTerm);
    });

    if (!match) {
        console.error(`❌ No property found matching "${searchTerm}" in Pleasanton.`);
        process.exit(1);
    }

    const zpid = match.id;
    const data = match.data();
    console.log(`✅ Found: ${data.address}`);
    console.log(`   zpid: ${zpid}`);
    console.log(`   Current orientation_ai: ${data.orientation_ai?.final_orientation || '(none)'}`);
    console.log(`   Current explanation snippet: ${(data.orientation_ai?.explanation || '').slice(0, 80)}...\n`);

    // 1. Clear the cached orientation fields
    console.log('🗑  Clearing cached orientation_ai from Firestore...');
    await db.collection('properties').doc(zpid).update({
        orientation_ai: FieldValue.delete(),
        orientation_calculated_at: FieldValue.delete(),
    });
    console.log('   ✅ Cleared.\n');

    // 2. Create a batch job to re-run analysis via the Cloud Function
    console.log('⚡ Creating orientation batch job to re-run analysis...');
    const jobRef = await db.collection('orientation_batch_jobs').add({
        zpids: [zpid],
        status: 'queued',
        total: 1,
        done: 0,
        failed: 0,
        userId: 'manual-rerun',
        createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`   ✅ Job created: orientation_batch_jobs/${jobRef.id}`);
    console.log('   Cloud Function is now running on Google\'s servers...\n');

    // 3. Poll for completion
    const start = Date.now();
    const MAX_WAIT_MS = 3 * 60 * 1000;

    while (Date.now() - start < MAX_WAIT_MS) {
        await new Promise(r => setTimeout(r, 5000));

        const jobSnap = await jobRef.get();
        const job = jobSnap.data();
        if (!job) break;

        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        console.log(`[${elapsed}s] status=${job.status}  done=${job.done}/${job.total}  failed=${job.failed || 0}`);

        if (job.status === 'completed' || job.status === 'failed') {
            console.log('\n── Done! Reading fresh result from Firestore... ──\n');
            break;
        }
    }

    // 4. Print fresh result
    const freshSnap = await db.collection('properties').doc(zpid).get();
    const fresh = freshSnap.data();
    const newAI = fresh?.orientation_ai;

    if (!newAI) {
        console.error('❌ orientation_ai still not set — Cloud Function may have failed.');
        console.log('   Check: https://console.firebase.google.com/project/zyphe-af0bf/functions');
    } else {
        console.log(`✅ New orientation:  ${newAI.final_orientation}`);
        console.log(`   Confidence:       ${newAI.confidence}`);
        console.log(`   Azimuth:          ${newAI.azimuth_degrees}°`);
        console.log(`\n   Explanation:\n${newAI.explanation}\n`);
    }
}

main().catch(e => {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
});
