
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function checkOrphanedProperties() {
    console.log('--- Checking for orphaned analysis (properties with subcollections but no data) ---');
    
    // Iterate all documents in properties collection
    const snapshot = await db.collection('properties').get();
    
    let orphanedCount = 0;
    let totalCount = snapshot.size;

    console.log(`Found ${totalCount} property documents.`);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        if (Object.keys(data).length === 0) {
            // Document exists but has no fields (likely a shell for subcollections)
            console.log(`  Orphaned shell: ${doc.id}`);
            orphanedCount++;
        }
    }

    console.log(`--- Total Orphaned Shells: ${orphanedCount} / ${totalCount} ---`);
}

checkOrphanedProperties()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Check failed:', err);
        process.exit(1);
    });
