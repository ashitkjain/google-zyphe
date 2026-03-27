
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

async function cleanupPropertyLegacyCollections() {
    console.log('--- CLEANUP START: Legacy Top-Level Property Metadata ---');

    const legacyCollections = [
        'property_assets',
        'property_analyses_visual',
        'property_analyses_comprehensive',
        'image_quality_analysis',
        'property_investment_research',
        'google_environmental_data'
    ];

    for (const col of legacyCollections) {
        await deleteCollection(col);
    }

    console.log('--- CLEANUP COMPLETE ---');
}

cleanupPropertyLegacyCollections()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    });
