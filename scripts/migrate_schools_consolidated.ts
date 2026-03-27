
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateSchools() {
    console.log('--- MIGRATION START: School Intelligence Consolidation ---');

    console.log('Processing schools_intelligence...');
    const snapshot = await db.collection('schools_intelligence').get();
    
    if (snapshot.empty) {
        console.log('  Collection is empty.');
        return;
    }

    console.log(`  Migrating ${snapshot.size} schools...`);
    const batchSize = 100;
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = snapshot.docs.slice(i, i + batchSize);
        
        for (const doc of chunk) {
            const cacheKey = doc.id;
            const data = doc.data();
            
            // Extract city_state from cacheKey ({w1}_{w2}_{city}_{state})
            const parts = cacheKey.split('_');
            const state = parts.pop();
            const city = parts.pop();
            
            if (city && state) {
                const cityStateKey = `${city}_${state}`;
                const targetRef = db.doc(`cities/${cityStateKey}/schools/${cacheKey}`);
                batch.set(targetRef, data, { merge: true });
            } else {
                console.warn(`    Skipping invalid key: ${cacheKey}`);
            }
        }
        
        await batch.commit();
    }

    console.log('--- MIGRATION COMPLETE ---');
}

migrateSchools()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
