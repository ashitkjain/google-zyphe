#!/usr/bin/env node
/**
 * End-to-End Backend Test
 * 
 * ZPIDs: 89030212, 25087482
 * 
 * Steps:
 * 1. Wipe: Delete properties and sub-collections
 * 2. Secure Assets: Simulate storage re-linking
 * 3. Property Data Batch: Trigger and wait
 * 4. Full Intel Batch: Trigger and wait
 * 5. Smoke Test: Verify results
 */
'use strict';

const admin = require('firebase-admin');

// 1. Initialize
try {
    admin.initializeApp({ 
        projectId: 'zyphe-af0bf',
        storageBucket: 'zyphe-af0bf.appspot.com'
    });
} catch (e) {
    // already initialized
}
const db = admin.firestore();
const storage = admin.storage().bucket('zyphe-af0bf.firebasestorage.app');

const TEST_ZPIDS = ['89030212', '25087482'];

async function wipeProperty(zpid) {
    console.log(`[Wipe] Cleaning up ${zpid}...`);
    const propRef = db.collection('properties').doc(zpid);
    
    // Delete sub-collections (simplified for test)
    const subcols = ['analysis', 'environmental', 'assets'];
    for (const sub of subcols) {
        const snap = await propRef.collection(sub).get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    
    // Delete main doc
    await propRef.delete();
    console.log(`  ✅ Wiped ${zpid}`);
}

async function secureAssets(zpid) {
    console.log(`[Secure Assets] Scanning Storage for ${zpid}...`);
    
    // Check for maps
    const mapZoomIn = `properties/${zpid}/maps/zoom_in.png`;
    const mapZoomOut = `properties/${zpid}/maps/location_context.png`;
    const streetView = `properties/${zpid}/maps/street_view.jpg`;
    const aerialSat = `properties/${zpid}/maps/aerial_satellite_scale2.jpg`;
    
    const getUrl = async (path) => {
        const file = storage.file(path);
        const [exists] = await file.exists();
        if (exists) {
            return `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodeURIComponent(path)}?alt=media`;
        }
        return null;
    };

    const assets = {
        zpid,
        images: [],
        mapZoomIn: await getUrl(mapZoomIn),
        mapZoomOut: await getUrl(mapZoomOut),
        streetView: await getUrl(streetView),
        satelliteImageUrl: await getUrl(aerialSat),
        lastVerified: new Date().toISOString()
    };

    console.log(`  🔍 Map URLs: SV=${!!assets.streetView}, Sat=${!!assets.satelliteImageUrl}`);

    // Check gallery
    const [files] = await storage.getFiles({ prefix: `properties/${zpid}/gallery/` });
    assets.images = files
        .filter(f => f.name.endsWith('.jpg'))
        .sort((a, b) => {
            const numA = parseInt(a.name.match(/img_(\d+)/)?.[1] || '0');
            const numB = parseInt(b.name.match(/img_(\d+)/)?.[1] || '0');
            return numA - numB;
        })
        .map(f => `https://firebasestorage.googleapis.com/v0/b/${storage.name}/o/${encodeURIComponent(f.name)}?alt=media`);

    console.log(`  ✅ Found ${assets.images.length} images for ${zpid}`);
    await db.collection('properties').doc(zpid).collection('analysis').doc('assets').set(assets);
    
    // Also update main doc for Orientation/Intel to find them
    await db.collection('properties').doc(zpid).set({
        satelliteImageUrl: assets.satelliteImageUrl,
        streetView: assets.streetView
    }, { merge: true });
}

async function runBatchJob(collectionName, zpids) {
    console.log(`\n[Batch] Starting ${collectionName} for ${zpids.length} ZPIDs...`);
    const jobRef = await db.collection(collectionName).add({
        zpids,
        status: 'queued',
        total: zpids.length,
        done: 0,
        failed: 0,
        userId: 'e2e-test-script',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`  🚀 Job ID: ${jobRef.id}`);

    const start = Date.now();
    const MAX_WAIT = 15 * 60 * 1000; // 15 mins
    let lastDone = -1;

    while (Date.now() - start < MAX_WAIT) {
        await new Promise(r => setTimeout(r, 5000));
        const snap = await jobRef.get();
        const d = snap.data();
        if (!d) break;

        if (d.done !== lastDone) {
            console.log(`    Progress: ${d.done}/${zpids.length} (${d.status})`);
            lastDone = d.done;
        }

        if (d.status === 'completed' || d.status === 'failed') {
            console.log(`  ✅ Batch Complete: ${d.status}`);
            if (d.status === 'failed') console.error('    Error:', d.error);
            return d;
        }
    }
    throw new Error(`${collectionName} timed out`);
}

async function runSmokeTest(zpid) {
    console.log(`\n[Smoke Test] Verifying ${zpid}...`);
    const propRef = db.collection('properties').doc(zpid);
    const propSnap = await propRef.get();
    const assetsSnap = await propRef.collection('analysis').doc('assets').get();
    const visualSnap = await propRef.collection('analysis').doc('visual').get();
    const compSnap = await propRef.collection('analysis').doc('comprehensive').get();
    const insightsSnap = await propRef.collection('analysis').doc('lifestyle_insights').get();
    const fitSnap = await propRef.collection('analysis').doc('lifestyle_fit').get();
    const envSnap = await propRef.collection('environmental').doc('thirdparty_data').get();

    const data = propSnap.data() || {};
    const assets = assetsSnap.data() || {};
    const visual = visualSnap.data() || {};
    const env = envSnap.data() || {};

    const checks = [
        { label: 'Core Address', pass: !!data.address },
        { label: 'Coordinates', pass: !!data.coordinates?.latitude },
        { label: 'APN / Tax Data', pass: !!(data.apn || data.taxSqft) },
        { label: 'Images Registered', pass: assets.images?.length > 0 },
        { label: 'Map Assets', pass: !!(assets.mapZoomIn && assets.streetView) },
        { label: 'Environmental (Solar/AQI)', pass: !!(env.solarData || env.airQuality) },
        { label: 'AI Visual (Interior)', pass: !!visual.home_interior?.overall_description },
        { label: 'AI Neighborhood', pass: !!(visual.exterior_and_neighborhood?.neighborhood_street_insights || compSnap.data()?.detailed_analysis?.location_neighborhood) },
        { label: 'Orientation AI', pass: !!data.orientation_ai?.final_orientation }
    ];

    let allPass = true;
    for (const c of checks) {
        if (!c.pass) {
            console.log(`  ❌ ${c.label.padEnd(25)} : MISSING`);
            allPass = false;
        } else {
            console.log(`  ✅ ${c.label.padEnd(25)} : OK`);
        }
    }

    if (!allPass) {
        console.log('    Debug Info:');
        console.log('      - Address:', !!data.address);
        console.log('      - Coordinates:', !!data.coordinates?.latitude);
        console.log('      - Tax Sqft:', !!data.taxSqft);
        console.log('      - APN:', !!data.apn);
        console.log('      - Images:', assets.images?.length);
        console.log('      - Environmental:', JSON.stringify(env));
        console.log('      - Visual Interior:', !!visual.home_interior?.overall_description);
        console.log('      - Visual Neighborhood:', !!visual.exterior_and_neighborhood?.neighborhood_street_insights);
        console.log('      - Comp Neighborhood:', !!compSnap.data()?.detailed_analysis?.location_neighborhood);
        console.log('      - Orientation:', !!data.orientation_ai?.final_orientation);
    }

    return allPass;
}

async function main() {
    console.log('══════════════════════════════════════════════════════');
    console.log('  END-TO-END SYSTEM TEST                              ');
    console.log('══════════════════════════════════════════════════════\n');

    // 1. Wipe
    for (const zpid of TEST_ZPIDS) {
        await wipeProperty(zpid);
    }

    // 2. Secure Assets
    for (const zpid of TEST_ZPIDS) {
        await secureAssets(zpid);
    }

    // 3. Property Data Batch
    await runBatchJob('property_data_batch_jobs', TEST_ZPIDS);

    // 4. Full Intel Batch
    await runBatchJob('full_intel_batch_jobs', TEST_ZPIDS);

    // 5. Orientation Batch
    await runBatchJob('orientation_batch_jobs', TEST_ZPIDS);

    // 6. Smoke Test
    console.log('\nWait 5s for Firestore sync...');
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('\nFINAL RESULTS:');
    let overallSuccess = true;
    for (const zpid of TEST_ZPIDS) {
        const pass = await runSmokeTest(zpid);
        if (!pass) overallSuccess = false;
    }

    console.log('\n══════════════════════════════════════════════════════');
    if (overallSuccess) {
        console.log('  🎉 E2E TEST PASSED — ALL SYSTEMS GREEN');
    } else {
        console.error('  ❌ E2E TEST FAILED — GAPS DETECTED');
    }
    console.log('══════════════════════════════════════════════════════\n');
}

main().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
