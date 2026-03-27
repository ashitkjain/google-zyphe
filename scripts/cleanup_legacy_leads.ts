
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function deleteCollection(path: string) {
    console.log(`Deleting collection: ${path}...`);
    const collectionRef = db.collection(path);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
        console.log(`  Collection ${path} is already empty.`);
        return;
    }

    console.log(`  Purging ${snapshot.size} documents...`);
    const batchSize = 100;
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = snapshot.docs.slice(i, i + batchSize);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    console.log(`  Purged ${path}.`);
}

async function cleanupLegacyData() {
    console.log('--- CLEANUP START: Legacy Lead/Metadata Collections ---');

    // 1. Delete Top-Level leads_documents
    await deleteCollection('leads_documents');

    // 2. Iterate through all realtors and delete their legacy subcollections
    const realtorsSnap = await db.collection('realtors').get();
    for (const realtorDoc of realtorsSnap.docs) {
        const rid = realtorDoc.id;
        const realtorPath = `realtors/${rid}`;
        
        console.log(`Cleaning up realtor: ${rid}...`);
        
        const legacyCollections = [
            'market_context',
            'reactivation_analysis_summary',
            'lead_plans',
            'messages',
            'journey_events'
        ];

        for (const col of legacyCollections) {
            await deleteCollection(`${realtorPath}/${col}`);
        }
    }

    console.log('--- CLEANUP COMPLETE ---');
}

cleanupLegacyData()
    .then(() => {
        console.log('Success.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    });
