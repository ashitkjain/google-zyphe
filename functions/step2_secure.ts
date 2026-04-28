import { securePropertyAssets } from '../services/assetService.js';
import admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

async function run() {
    console.log("Starting Secure Images (Step 2)...");
    const result = await securePropertyAssets('53050869', [], undefined, p => console.log(`   ${p.message}`));
    console.log(`Success! Secured ${result.images.length} images.`);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
