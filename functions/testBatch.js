#!/usr/bin/env node
/**
 * Orientation Batch CF — Pleasanton validation test
 *
 * Usage:
 *   node functions/testBatch.js
 *
 * What it does:
 *   1. Queries `properties` collection for Pleasanton properties with
 *      cached aerial images (satelliteImageUrl set)
 *   2. Creates an orientation_batch_jobs document (status='queued')
 *   3. The Cloud Function triggers automatically on Google's servers
 *   4. Polls for completion and validates results against ground truth
 */
'use strict';

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'zyphe-af0bf' });
const db = admin.firestore();

// ─── Pleasanton Ground Truth (subset) ────────────────────────────────────────
// Keyed by canonical address → expected orientation
const GROUND_TRUTH = {
    '1039 Hopkins Way, Pleasanton, CA 94566 US':       'North',
    '1131 Mataro Ct, Pleasanton, CA 94566 US':         'East',
    '1149 Hopkins Way, Pleasanton, CA 94566 US':       'Northwest',
    '1237 Concord St, Pleasanton, CA 94566 US':        'Northeast',
    '1224 Harvest Rd, Pleasanton, CA 94566 US':        'Northeast',
    '1421 Calle Enrique, Pleasanton, CA 94566 US':     'Southeast',
    '1450 Finley Rd, Pleasanton, CA 94588 US':         'East',
    '215 Mavis Dr, Pleasanton, CA 94566 US':           'East',
    '3550 Vine St, Pleasanton, CA 94566 US':           'North',
    '4022 Silver St, Pleasanton, CA 94566 US':         'North',
    '4034 Francisco St, Pleasanton, CA 94566 US':      'North',
    '4034 Rennellwood Way, Pleasanton, CA 94566 US':   'Southeast',
    '4071 Walnut Dr, Pleasanton, CA 94566 US':         'Southeast',
    '4073 Stanley Blvd, Pleasanton, CA 94566 US':      'North',
    '4127 Alvarado St, Pleasanton, CA 94566 US':       'South',
    '5207 Crestline Way, Pleasanton, CA 94566 US':     'North',
    '535 San Gabriel Ct, Pleasanton, CA 94566 US':     'North',
    '6168 Inglewood Dr, Pleasanton, CA 94588 US':      'North',
    '7738 Fairoaks Dr, Pleasanton, CA 94588 US':       'North',
    '4726 Black Ave, Pleasanton, CA 94566 US':         'North',
};

const TARGET_COUNT = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeOrientation(raw) {
    if (!raw) return null;
    // Strip degree suffixes like "(~50°)" and trim
    return raw.replace(/\s*\(~.*?\)/, '').trim();
}

function orientationsMatch(actual, expected) {
    if (!actual || !expected) return false;
    return normalizeOrientation(actual).toLowerCase() === expected.toLowerCase();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('══════════════════════════════════════════════════════');
    console.log('  Orientation Batch CF — Pleasanton Validation Test   ');
    console.log('══════════════════════════════════════════════════════\n');

    // 1. Find Pleasanton properties with cached aerial images
    console.log(`Querying Firestore for Pleasanton properties with cached images...`);
    const snap = await db.collection('properties')
        .where('city', '==', 'Pleasanton')
        .limit(100)
        .get();

    // Filter client-side for valid cached aerial URLs (no composite index needed)
    const gtAddresses = Object.keys(GROUND_TRUTH);
    let candidates = snap.docs.filter(d => {
        const data = d.data();
        return (
            data.satelliteImageUrl &&
            data.satelliteImageUrl.startsWith('http') &&
            data.address &&
            gtAddresses.some(a => data.address.toLowerCase().includes(a.toLowerCase().split(',')[0]))
        );
    });

    // Prefer properties we have ground truth for
    const withGT = candidates.filter(d => {
        return gtAddresses.some(a =>
            d.data().address?.toLowerCase().includes(a.toLowerCase().split(',')[0])
        );
    });

    // Take up to TARGET_COUNT; fill with any Pleasanton props if not enough GT matches
    const selected = withGT.slice(0, TARGET_COUNT);
    if (selected.length < TARGET_COUNT) {
        const others = candidates.filter(d => !selected.includes(d));
        selected.push(...others.slice(0, TARGET_COUNT - selected.length));
    }

    if (selected.length === 0) {
        console.error('❌ No Pleasanton properties found with cached aerial images.');
        console.error('   Run the Orientation Audit UI first to cache images for Pleasanton properties.');
        process.exit(1);
    }

    console.log(`\n✅ Selected ${selected.length} Pleasanton properties:\n`);
    const testRows = selected.map(d => {
        const prop        = d.data();
        const address     = prop.address || '?';
        const currentAI   = prop.orientation_ai?.final_orientation || '(none)';
        const normalizedA = normalizeOrientation(currentAI);
        // Find matching ground truth
        const gtKey       = gtAddresses.find(a =>
            address.toLowerCase().includes(a.toLowerCase().split(',')[0])
        );
        const expected    = gtKey ? GROUND_TRUTH[gtKey] : null;
        return { zpid: d.id, address, currentAI, normalizedAI: normalizedA, expected };
    });

    testRows.forEach((r, i) => {
        const gt = r.expected ? `expected: ${r.expected}` : 'no GT entry';
        console.log(`  ${i + 1}. ${r.zpid} — ${r.address}`);
        console.log(`     Current AI: ${r.currentAI}  │  ${gt}`);
    });

    // 2. Create the batch job document (triggers Cloud Function)
    const zpids = testRows.map(r => r.zpid);
    console.log('\nCreating batch job in Firestore...');
    const jobRef = await db.collection('orientation_batch_jobs').add({
        zpids,
        status:    'queued',
        total:     zpids.length,
        done:      0,
        failed:    0,
        userId:    'test-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Job: orientation_batch_jobs/${jobRef.id}`);
    console.log('   Cloud Function is running on Google\'s servers...\n');

    // 3. Poll for progress
    const start       = Date.now();
    let   lastStatus  = '';
    let   lastDone    = -1;
    const MAX_WAIT_MS = 5 * 60 * 1000;

    while (Date.now() - start < MAX_WAIT_MS) {
        await new Promise(r => setTimeout(r, 5000));

        const jobSnap = await jobRef.get();
        const d       = jobSnap.data();
        if (!d) break;

        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        if (d.done !== lastDone || d.status !== lastStatus) {
            lastDone   = d.done;
            lastStatus = d.status;
            const bar  = '██'.repeat(d.done) + '░░'.repeat(zpids.length - d.done);
            console.log(`[${String(elapsed).padStart(3, ' ')}s] ${d.status.padEnd(10)} │ ${bar} │ ${d.done}/${zpids.length} done, ${d.failed || 0} failed`);
        }

        if (d.status === 'completed' || d.status === 'failed') {
            const elapsed2 = ((Date.now() - start) / 1000).toFixed(0);
            console.log(`\n── Completed in ${elapsed2}s ─────────────────────────────\n`);
            break;
        }
    }

    // 4. Read fresh results and validate against ground truth
    console.log('Results vs Ground Truth:\n');
    let pass = 0, fail = 0, unclear = 0, noGT = 0;

    for (const row of testRows) {
        const propSnap = await db.collection('properties').doc(row.zpid).get();
        const prop     = propSnap.data();
        const newAI    = prop?.orientation_ai?.final_orientation || 'N/A';
        const conf     = prop?.orientation_ai?.confidence || '?';
        const newNorm  = normalizeOrientation(newAI);

        let verdict = '';
        if (!row.expected) {
            noGT++;
            verdict = '  ○ no GT';
        } else if (newNorm === 'UNCLEAR') {
            unclear++;
            verdict = `  ? UNCLEAR (expected: ${row.expected})`;
        } else if (orientationsMatch(newNorm, row.expected)) {
            pass++;
            verdict = `  ✅ PASS`;
        } else {
            fail++;
            verdict = `  ❌ FAIL  (expected: ${row.expected}, got: ${newNorm})`;
        }

        console.log(`  ${row.zpid} — ${row.address.split(',')[0]}`);
        console.log(`    CF result:  ${newAI}  (${conf})`);
        console.log(`    ${verdict}`);
        console.log();
    }

    const total = testRows.length;
    const gtTotal = pass + fail + unclear;
    console.log('══════════════════════════════════════════════════════');
    console.log(`  SUMMARY: ${pass}/${gtTotal} correct  │  ${fail} wrong  │  ${unclear} unclear  │  ${noGT} no GT`);
    console.log(`  Accuracy: ${gtTotal > 0 ? Math.round(pass / gtTotal * 100) : 'N/A'}%`);
    console.log('══════════════════════════════════════════════════════\n');
    console.log(`Full CF logs: https://console.firebase.google.com/project/zyphe-af0bf/functions`);
}

main().catch(e => {
    console.error('\n❌ Error:', e.message);
    if (e.message.includes('credential') || e.message.includes('auth')) {
        console.error('\nFix: Run `gcloud auth application-default login` or set GOOGLE_APPLICATION_CREDENTIALS');
    }
    process.exit(1);
});
