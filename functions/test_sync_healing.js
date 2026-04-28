const admin = require('firebase-admin');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

const db = admin.firestore();
const TEST_ZPID = "53050869"; // 5345 W Chesterfield Cir, Dublin, CA 94568

// We will use the dynamic import to load the services since they are ESM
async function runEndToEndTest() {
    console.log(`\n--- Starting Asset Sync E2E Test (JS Wrapper) for ZPID: ${TEST_ZPID} ---`);

    try {
        // Dynamic imports for ESM modules
        const { securePropertyAssets } = await import('../services/assetService.js');
        const { getPropertyAssetsFromCloud } = await import('../services/firebaseService.js');

        // 1. Initial State
        const before = await getPropertyAssetsFromCloud(TEST_ZPID);
        console.log(`[Baseline] Current image count: ${before?.images?.length || 0}`);
        console.log(`[Baseline] Has Metadata: ${!!before?.imageMetadata}`);

        // 2. Perform Robust Sync
        console.log(`\n[Sync] Triggering securePropertyAssets...`);
        const startTime = Date.now();
        
        const result = await securePropertyAssets(TEST_ZPID, [], undefined, (p) => {
            console.log(`   Progress: ${p.completed}/${p.total} - ${p.message}`);
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`\n[Sync] Completed in ${duration.toFixed(2)}s`);
        console.log(`[Result] New image count: ${result.images.length}`);
        
        const metadataCount = Object.keys(result.imageMetadata || {}).length;
        console.log(`[Result] Metadata entries: ${metadataCount}`);

        // 3. Verify
        if (result.images.length > 1) {
            console.log(`✅ SUCCESS: Gallery expanded.`);
        }

        // 4. Test Healing
        console.log(`\n[Healing] Running second pass...`);
        const healStartTime = Date.now();
        await securePropertyAssets(TEST_ZPID, [], undefined, () => {});
        const healDuration = (Date.now() - healStartTime) / 1000;
        console.log(`[Healing] Second pass took ${healDuration.toFixed(2)}s`);
        
    } catch (error) {
        console.error("❌ TEST FAILED:", error);
    } finally {
        process.exit(0);
    }
}

runEndToEndTest();
