
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migratePropertySubcollections() {
    console.log('--- MIGRATION START: Property-Specific Nesting ---');

    const MAPPINGS = [
        {
            legacy: 'property_assets',
            target: (zpid: string) => `properties/${zpid}/analysis/assets`
        },
        {
            legacy: 'property_analyses_visual',
            target: (zpid: string) => `properties/${zpid}/analysis/visual`
        },
        {
            legacy: 'property_analyses_comprehensive',
            target: (zpid: string) => `properties/${zpid}/analysis/comprehensive`
        },
        {
            legacy: 'image_quality_analysis',
            target: (zpid: string) => `properties/${zpid}/analysis/image_quality`
        },
        {
            legacy: 'property_investment_research',
            target: (zpid: string) => `properties/${zpid}/analysis/investment`
        },
        {
            legacy: 'google_environmental_data',
            target: (zpid: string) => `properties/${zpid}/environmental/google_data`
        }
    ];

    for (const mapping of MAPPINGS) {
        console.log(`Processing legacy collection: ${mapping.legacy}...`);
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
                const zpid = doc.id;
                const data = doc.data();
                const targetPath = mapping.target(zpid);
                const targetRef = db.doc(targetPath);
                batch.set(targetRef, data, { merge: true });
            }
            
            await batch.commit();
        }
        console.log(`  Completed ${mapping.legacy}.`);
    }

    console.log('--- MIGRATION COMPLETE ---');
}

migratePropertySubcollections()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
