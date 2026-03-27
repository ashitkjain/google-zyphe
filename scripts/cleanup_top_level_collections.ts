
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

const collectionsToDelete = [
    'leads',
    'tasks',
    'transactions',
    'calendar_events',
    'templates',
    'journey_events',
    'reminder_rules',
    'whiteboards',
    'docs',
    'user_property_comment',
    'property_analyses_visual',
    'property_analyses_comprehensive',
    'image_quality_analysis',
    'property_investment_research',
    'property_assets',
    'transaction_documents',
    'transaction_parties'
];

async function cleanupOldCollections() {
    console.log('--- RECURSIVE CLEANUP START: Top-Level Collections ---');
    
    for (const collectionName of collectionsToDelete) {
        let totalDeleted = 0;
        console.log(`Auditing collection: ${collectionName}...`);
        
        while (true) {
            const snapshot = await db.collection(collectionName).limit(50).get();
            
            if (snapshot.empty) {
                if (totalDeleted > 0) {
                    console.log(`  Finished cleaning up "${collectionName}". Total deleted: ${totalDeleted}.`);
                } else {
                    console.log(`  Collection "${collectionName}" was already empty.`);
                }
                break;
            }

            console.log(`  Deleting batch of ${snapshot.size} documents from "${collectionName}"...`);
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            totalDeleted += snapshot.size;
        }
    }
    
    console.log('--- RECURSIVE CLEANUP COMPLETE ---');
}

cleanupOldCollections().then(() => process.exit(0)).catch(err => {
    console.error('Cleanup failed:', err);
    process.exit(1);
});
