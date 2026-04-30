#!/usr/bin/env node
/**
 * Single-property pipeline smoke test for Pleasanton ZPID 25083385
 * (1131 Mataro Ct — ground-truth orientation: East)
 *
 * Sequence: property_data → full_intel → narrative → orientation → smoke-test
 */
'use strict';

const admin = require('firebase-admin');
try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch (_) {}
const db = admin.firestore();

const ZPID = '25083385';
const GROUND_TRUTH_ORIENTATION = 'East';

async function pollJob(jobRef, label, timeoutMs = 8 * 60 * 1000) {
    const start = Date.now();
    let lastDone = -1;
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 4000));
        const snap = await jobRef.get();
        const d = snap.data();
        if (!d) throw new Error(`${label}: job document disappeared`);
        if (d.done !== lastDone) {
            lastDone = d.done;
            const elapsed = ((Date.now() - start) / 1000).toFixed(0);
            process.stdout.write(`  [${elapsed}s] ${label}: ${d.status} ${d.done}/${d.total}\n`);
        }
        if (d.status === 'completed') return d;
        if (d.status === 'failed') throw new Error(`${label} failed: ${d.error || JSON.stringify(d.results)}`);
    }
    throw new Error(`${label}: timed out after ${timeoutMs / 1000}s`);
}

async function enqueue(collection, extra = {}) {
    return db.collection(collection).add({
        zpids: [ZPID],
        status: 'queued',
        total: 1,
        done: 0,
        failed: 0,
        userId: 'smoke-test-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...extra,
    });
}

async function smokeTest() {
    const propRef = db.collection('properties').doc(ZPID);
    const [propSnap, assetsSnap, visualSnap, compSnap, insightsSnap, fitSnap, envSnap] = await Promise.all([
        propRef.get(),
        propRef.collection('analysis').doc('assets').get(),
        propRef.collection('analysis').doc('visual').get(),
        propRef.collection('analysis').doc('comprehensive').get(),
        propRef.collection('analysis').doc('lifestyle_insights').get(),
        propRef.collection('analysis').doc('lifestyle_fit').get(),
        propRef.collection('environmental').doc('thirdparty_data').get(),
    ]);

    const data = propSnap.data() || {};
    const assets = assetsSnap.data() || {};
    const visual = visualSnap.data() || {};
    const env = envSnap.data() || {};

    const orientationAI = data.orientation_ai?.final_orientation;
    const orientationMatch = orientationAI &&
        orientationAI.toLowerCase().includes(GROUND_TRUTH_ORIENTATION.toLowerCase());

    const checks = [
        { label: 'Core Address',               pass: !!data.address },
        { label: 'Coordinates',                pass: !!data.coordinates?.latitude },
        { label: 'APN / Tax Data',             pass: !!(data.apn || data.taxSqft) },
        { label: 'Images Registered',          pass: (assets.images?.length || 0) > 0 },
        { label: 'Map Assets',                 pass: !!(assets.mapZoomIn && assets.streetView) },
        { label: 'Environmental (Solar/AQI)',   pass: !!(env.solarData || env.airQuality) },
        { label: 'AI Visual (Interior)',        pass: !!visual.home_interior?.overall_description },
        { label: 'AI Neighborhood',            pass: !!(visual.exterior_and_neighborhood?.neighborhood_street_insights || compSnap.data()?.detailed_analysis?.location_neighborhood) },
        { label: 'Narrative (Comprehensive)',   pass: !!(compSnap.exists && compSnap.data()?.summary) },
        { label: 'Lifestyle Insights',         pass: !!(insightsSnap.exists && insightsSnap.data()?.outdoor) },
        { label: 'Lifestyle Fit',              pass: !!(fitSnap.exists && fitSnap.data()?.working_professionals) },
        { label: 'Orientation AI',             pass: !!orientationAI },
        { label: `Orientation Match (${GROUND_TRUTH_ORIENTATION})`, pass: orientationMatch },
    ];

    let pass = 0, fail = 0;
    for (const c of checks) {
        const icon = c.pass ? '✅' : '❌';
        console.log(`  ${icon} ${c.label.padEnd(35)} ${c.pass ? 'OK' : 'MISSING'}`);
        c.pass ? pass++ : fail++;
    }

    if (orientationAI) {
        console.log(`\n  Detected orientation: "${orientationAI}" — expected "${GROUND_TRUTH_ORIENTATION}"`);
    }

    return fail === 0;
}

async function main() {
    console.log('══════════════════════════════════════════════════════');
    console.log('  Pipeline Smoke Test — ZPID ' + ZPID);
    console.log('  Property: 1131 Mataro Ct, Pleasanton, CA');
    console.log('══════════════════════════════════════════════════════\n');

    // Step 1: Property Data Batch
    console.log('Step 1: Property Data Batch');
    const propJob = await enqueue('property_data_batch_jobs');
    console.log('  Job:', propJob.id);
    await pollJob(propJob, 'property_data');

    // Step 2: Full Intel Batch
    console.log('\nStep 2: Full Intel Batch');
    const intelJob = await enqueue('full_intel_batch_jobs', { force: true });
    console.log('  Job:', intelJob.id);
    await pollJob(intelJob, 'full_intel', 10 * 60 * 1000);

    // Step 3: Narrative Batch
    console.log('\nStep 3: Narrative Batch');
    const narrativeJob = await enqueue('narrative_batch_jobs');
    console.log('  Job:', narrativeJob.id);
    await pollJob(narrativeJob, 'narrative', 6 * 60 * 1000);

    // Step 4: Orientation Batch
    console.log('\nStep 4: Orientation Batch');
    const orientJob = await enqueue('orientation_batch_jobs');
    console.log('  Job:', orientJob.id);
    await pollJob(orientJob, 'orientation', 6 * 60 * 1000);

    // Step 5: Smoke Test
    console.log('\n── Smoke Test ──────────────────────────────────────\n');
    await new Promise(r => setTimeout(r, 3000)); // brief settle
    const allPass = await smokeTest();

    console.log('\n══════════════════════════════════════════════════════');
    if (allPass) {
        console.log('  🎉 PIPELINE CLEAN — ALL CHECKS PASSED');
    } else {
        console.log('  ❌ PIPELINE HAS GAPS — SEE ABOVE');
    }
    console.log('══════════════════════════════════════════════════════\n');
    process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
