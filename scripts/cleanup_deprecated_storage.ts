
import admin from 'firebase-admin';

// Initialize Firebase Admin
const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId,
        storageBucket: 'zyphe-af0bf.firebasestorage.app'
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function cleanupStorage() {
    console.log('--- Starting Storage Cleanup for Sold/Unlisted Properties ---');

    // 1. Fetch all properties in sold_or_unlisted_properties
    console.log('Fetching deprecated properties from Firestore...');
    const snapshot = await db.collection('sold_or_unlisted_properties').get();
    const deprecatedZpids = snapshot.docs.map(doc => doc.id);

    console.log(`Found ${deprecatedZpids.length} deprecated properties.`);

    if (deprecatedZpids.length === 0) {
        console.log('No deprecated properties found. Exiting.');
        return;
    }

    let deletedCount = 0;
    let errorCount = 0;

    // 2. Iterate and delete photos from Storage
    for (const zpid of deprecatedZpids) {
        const prefix = `properties/${zpid}/`;
        console.log(`Processing ZPID: ${zpid} (Path: ${prefix})...`);

        try {
            // Delete all files under properties/{zpid}/
            // This includes gallery/, maps/, etc.
            await bucket.deleteFiles({ prefix });
            console.log(`  Successfully deleted storage files for ${zpid}`);
            deletedCount++;
        } catch (err) {
            console.error(`  Failed to delete storage files for ${zpid}:`, err.message);
            errorCount++;
        }
    }

    console.log('--- Cleanup Summary ---');
    console.log(`Total properties processed: ${deprecatedZpids.length}`);
    console.log(`Successfully cleaned up: ${deletedCount}`);
    console.log(`Failures: ${errorCount}`);
}

cleanupStorage()
    .then(() => {
        console.log('Cleanup script finished.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Cleanup script failed:', err);
        process.exit(1);
    });
