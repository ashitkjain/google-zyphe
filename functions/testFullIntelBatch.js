#!/usr/bin/env node
/**
 * Full Intel Batch — Validation Test
 *
 * Usage:
 *   node functions/testFullIntelBatch.js
 *
 * What it does:
 *   1. Queries Firestore for properties with secured images.
 *   2. Creates a full_intel_batch_jobs document.
 *   3. Polls for progress.
 *   4. Runs a "Smoke Test" on results to ensure AI fields are populated.
 */
'use strict';

const admin = require('firebase-admin');

try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch (e) {}
const db = admin.firestore();

async function main() {
    console.log('══════════════════════════════════════════════════════');
    console.log('  Full Intel Batch — Validation Test                  ');
    console.log('══════════════════════════════════════════════════════\n');

    // 1. Find properties with secured images
    console.log('Finding properties with secured images...');
    const snap = await db.collection('properties')
        .limit(20)
        .get();

    const candidates = snap.docs.filter(d => {
        const data = d.data();
        return Array.isArray(data.images) && data.images.length > 0 && data.images[0].includes('firebasestorage');
    });

    if (candidates.length === 0) {
        console.error('❌ No properties found with secured images in Storage.');
        console.log('   Please secure some images first (e.g. by running a property fetch in the UI).');
        process.exit(1);
    }

    const testZpids = candidates.slice(0, 3).map(d => d.id);
    console.log(`✅ Found candidates: ${testZpids.join(', ')}`);

    // 2. Create the job
    console.log('\nCreating full_intel_batch_job...');
    const jobRef = await db.collection('full_intel_batch_jobs').add({
        zpids: testZpids,
        status: 'queued',
        total: testZpids.length,
        done: 0,
        failed: 0,
        userId: 'test-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Job: full_intel_batch_jobs/${jobRef.id}`);

    // 3. Poll for progress
    const start = Date.now();
    let lastDone = -1;
    while (Date.now() - start < 10 * 60 * 1000) {
        await new Promise(r => setTimeout(r, 5000));
        const jobSnap = await jobRef.get();
        const d = jobSnap.data();
        if (!d) break;

        if (d.done !== lastDone) {
            lastDone = d.done;
            console.log(`Progress: ${d.done}/${testZpids.length} completed, ${d.failed || 0} failed (Status: ${d.status})`);
        }

        if (d.status === 'completed' || d.status === 'failed') break;
    }

    // 4. Smoke Test
    console.log('\n── Smoke Test: AI Analysis Audit ───────────────────\n');
    for (const zpid of testZpids) {
        console.log(`ZPID: ${zpid}`);
        
        // Check analysis subdocs
        const [visual, comp, invest] = await Promise.all([
            db.collection('properties').doc(zpid).collection('analysis').doc('visual').get(),
            db.collection('properties').doc(zpid).collection('analysis').doc('comprehensive').get(),
            db.collection('properties').doc(zpid).collection('analysis').doc('investment').get()
        ]);

        const checks = [
            { id: 'visual', label: 'Visual Analysis', pass: visual.exists },
            { id: 'comprehensive', label: 'Comprehensive Narrative', pass: comp.exists },
            { id: 'investment', label: 'Investment Research', pass: invest.exists }
        ];

        checks.forEach(c => {
            console.log(`  ${c.pass ? '✅' : '❌'} ${c.label}`);
        });
        
        if (comp.exists) {
            const summary = comp.data().summary || '';
            console.log(`     Summary: ${summary.substring(0, 100)}...`);
        }
        console.log();
    }

    console.log('══════════════════════════════════════════════════════');
    console.log('  Done');
}

main().catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
});
