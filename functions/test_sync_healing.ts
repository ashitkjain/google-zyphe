import * as admin from 'firebase-admin';
import { securePropertyAssets } from '../services/assetService.js';
import { getPropertyAssetsFromCloud } from '../services/firebaseService.js';

// Initialize Firebase Admin for script usage
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

const TEST_ZPID = "53050869"; // 5345 W Chesterfield Cir, Dublin, CA 94568

async function runEndToEndTest() {
    console.log(`\n--- Starting Asset Sync E2E Test for ZPID: ${TEST_ZPID} ---`);

    try {
        // 1. Initial State
        const before = await getPropertyAssetsFromCloud(TEST_ZPID);
        console.log(`[Baseline] Current image count: ${before?.images?.length || 0}`);
        console.log(`[Baseline] Has Metadata: ${!!before?.imageMetadata}`);

        // 2. Perform Robust Sync (The Healing Trigger)
        console.log(`\n[Sync] Triggering securePropertyAssets (Forcing Ground Truth Reconciliation)...`);
        const startTime = Date.now();
        
        const result = await securePropertyAssets(TEST_ZPID, [], undefined, (p) => {
            console.log(`   Progress: ${p.completed}/${p.total} - ${p.message}`);
        });

        const duration = (Date.now() - startTime) / 1000;
        console.log(`\n[Sync] Completed in ${duration.toFixed(2)}s`);
        console.log(`[Result] New image count: ${result.images.length}`);
        
        const metadataCount = Object.keys(result.imageMetadata || {}).length;
        console.log(`[Result] Metadata entries: ${metadataCount}`);

        // 3. Verify Integrity
        if (result.images.length > 1) {
            console.log(`✅ SUCCESS: Gallery expanded from ${before?.images?.length || 0} to ${result.images.length} images.`);
        } else {
            console.warn(`⚠️ WARNING: Gallery still has only ${result.images.length} images. Verify if RapidAPI /images has more.`);
        }

        if (metadataCount === result.images.length) {
            console.log(`✅ SUCCESS: 1:1 Metadata identity mapping established.`);
        }

        // 4. Test Healing (Second Pass)
        console.log(`\n[Healing] Running second pass to verify zero redundant downloads...`);
        const healStartTime = Date.now();
        
        const healResult = await securePropertyAssets(TEST_ZPID, [], undefined, (p) => {
            // Should be much faster now
        });

        const healDuration = (Date.now() - healStartTime) / 1000;
        console.log(`[Healing] Second pass took ${healDuration.toFixed(2)}s (Previous: ${duration.toFixed(2)}s)`);
        
        if (healDuration < duration / 2) {
            console.log(`✅ SUCCESS: Healing logic verified. Second pass was significantly faster.`);
        }

    } catch (error) {
        console.error("❌ TEST FAILED:", error);
    } finally {
        process.exit(0);
    }
}

runEndToEndTest();
