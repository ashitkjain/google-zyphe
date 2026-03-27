
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateCityData() {
    console.log('--- MIGRATION START: City Consolidation ---');

    const MAPPINGS = [
        {
            legacy: 'city_neighborhoods',
            type: 'index',
            docId: 'neighborhoods'
        },
        {
            legacy: 'city_context_graph',
            type: 'index',
            docId: 'context_graph'
        },
        {
            legacy: 'deep_investment_research',
            type: 'intel',
            docId: 'deep_research'
        },
        {
            legacy: 'general_market_intelligence',
            type: 'intel',
            docId: 'market_intelligence'
        },
        {
            legacy: 'community_pulse',
            type: 'intel',
            docId: 'community_pulse'
        }
    ];

    // 1. Migrate Standard City-Keyed Collections
    for (const mapping of MAPPINGS) {
        console.log(`Processing ${mapping.legacy}...`);
        const snapshot = await db.collection(mapping.legacy).get();
        if (snapshot.empty) {
            console.log(`  ${mapping.legacy} is empty.`);
            continue;
        }

        console.log(`  Migrating ${snapshot.size} docs...`);
        const batchSize = 100;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
            const batch = db.batch();
            const chunk = snapshot.docs.slice(i, i + batchSize);
            
            for (const doc of chunk) {
                const key = doc.id.toLowerCase().replace('-', '_');
                const data = doc.data();
                const targetRef = db.doc(`cities/${key}/${mapping.type}/${mapping.docId}`);
                batch.set(targetRef, data, { merge: true });
            }
            
            await batch.commit();
        }
    }

    // 2. Migrate Zip Cache (Special Case: Keys were city-only)
    console.log(`Processing city_zip_cache...`);
    const zipSnapshot = await db.collection('city_zip_cache').get();
    if (!zipSnapshot.empty) {
        process.stdout.write(`  Migrating ${zipSnapshot.size} zip docs...`);
        const batchSize = 100;
        for (let i = 0; i < zipSnapshot.docs.length; i += batchSize) {
            const batch = db.batch();
            const chunk = zipSnapshot.docs.slice(i, i + batchSize);
            
            for (const doc of chunk) {
                const data = doc.data();
                const city = data.city?.toLowerCase().replace(/\s+/g, '_');
                // Use first found state in zipsByState if available
                const states = data.zipsByState ? Object.keys(data.zipsByState) : [];
                const state = states[0]?.toLowerCase() || 'unknown';
                const key = `${city}_${state}`;
                
                const targetRef = db.doc(`cities/${key}/index/zips`);
                batch.set(targetRef, data, { merge: true });
            }
            await batch.commit();
        }
        console.log(' Done.');
    }

    console.log('--- MIGRATION COMPLETE ---');
}

migrateCityData()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
