#!/usr/bin/env node
/**
 * Property Data Batch CF — Validation Test
 *
 * Usage:
 *   node functions/testPropertyBatch.js
 *
 * What it does:
 *   1. Creates a property_data_batch_jobs document (status='queued')
 *   2. The Cloud Function triggers automatically
 *   3. Polls for completion and logs summary
 */
'use strict';

const admin = require('firebase-admin');

// Try with local credentials or default
try {
    admin.initializeApp({ projectId: 'zyphe-af0bf' });
} catch (e) {
    // Already initialized
}
const db = admin.firestore();

// Test ZPIDs (example set)
const TEST_ZPIDS = [
    '25032512', // 1039 Hopkins Way
    '2121111685', // 1131 Mataro Ct
    '25032128'  // 1149 Hopkins Way
];

async function main() {
    console.log('══════════════════════════════════════════════════════');
    console.log('  Property Data Batch CF — Validation Test            ');
    console.log('══════════════════════════════════════════════════════\n');

    console.log(`Target ZPIDs: ${TEST_ZPIDS.join(', ')}`);

    // 1. Create the batch job document
    console.log('\nCreating batch job in Firestore...');
    const jobRef = await db.collection('property_data_batch_jobs').add({
        zpids: TEST_ZPIDS,
        status: 'queued',
        total: TEST_ZPIDS.length,
        done: 0,
        failed: 0,
        userId: 'test-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Job: property_data_batch_jobs/${jobRef.id}`);
    console.log('   Cloud Function should trigger now...\n');

    // 2. Poll for progress
    const start = Date.now();
    let lastStatus = '';
    let lastDone = -1;
    const MAX_WAIT_MS = 10 * 60 * 1000; // 10 mins

    while (Date.now() - start < MAX_WAIT_MS) {
        await new Promise(r => setTimeout(r, 3000));

        const jobSnap = await jobRef.get();
        const d = jobSnap.data();
        if (!d) break;

        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        if (d.done !== lastDone || d.status !== lastStatus) {
            lastDone = d.done;
            lastStatus = d.status;
            const bar = '██'.repeat(d.done) + '░░'.repeat(TEST_ZPIDS.length - d.done);
            console.log(`[${String(elapsed).padStart(3, ' ')}s] ${d.status.padEnd(10)} │ ${bar} │ ${d.done}/${TEST_ZPIDS.length} done, ${d.failed || 0} failed`);
        }

        if (d.status === 'completed' || d.status === 'failed') {
            const finalElapsed = ((Date.now() - start) / 1000).toFixed(0);
            console.log(`\n── Infrastructure Cycle Complete in ${finalElapsed}s ────────────────\n`);
            
            if (d.results) {
                console.log('Results Matrix:');
                Object.entries(d.results).forEach(([zpid, res]) => {
                    console.log(`  ${zpid}: ${res.status.toUpperCase()} — ${res.message}`);
                });
            }
            break;
        }
    }

    // 3. Final Verification of one field (e.g. taxSqft)
    console.log('\nVerifying field state...');
    for (const zpid of TEST_ZPIDS) {
        const propSnap = await db.collection('properties').doc(zpid).get();
        const data = propSnap.exists ? propSnap.data() : null;
        if (data) {
            console.log(`  ${zpid}: ${data.address || 'No Address'}`);
            console.log(`     SQFT: ${data.livingAreaValue || 'N/A'}`);
            console.log(`     TAX SQFT: ${data.taxSqft || 'N/A'}`);
            console.log(`     UPDATED: ${data.updatedAt?.toDate()?.toISOString() || 'N/A'}`);
        } else {
            console.log(`  ${zpid}: NOT FOUND in database`);
        }
    }

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  Testing Complete');
    console.log('══════════════════════════════════════════════════════\n');
}

main().catch(e => {
    console.error('\n❌ Execution Error:', e.message);
    process.exit(1);
});
