
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

const MIGRATIONS = [
    { from: 'property_analyses_visual',        toSub: 'analysis', toDoc: 'visual' },
    { from: 'property_analyses_comprehensive', toSub: 'analysis', toDoc: 'comprehensive' },
    { from: 'image_quality_analysis',          toSub: 'analysis', toDoc: 'image_quality' },
    { from: 'property_investment_research',    toSub: 'analysis', toDoc: 'investment' },
    { from: 'property_assets',                 toSub: 'analysis', toDoc: 'assets' }
];

async function migratePropertyData() {
    console.log('--- MIGRATION START: Property Subcollections ---');

    for (const m of MIGRATIONS) {
        console.log(`Migrating "${m.from}"...`);
        const snapshot = await db.collection(m.from).get();
        
        if (snapshot.empty) {
            console.log(`  No documents found in "${m.from}".`);
            continue;
        }

        console.log(`  Found ${snapshot.size} documents. Moving to properties/{zpid}/${m.toSub}/${m.toDoc}...`);
        
        // Process in smaller batches to avoid payload limits (large analysis docs)
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 10) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + 10);
            
            chunk.forEach(doc => {
                const zpid = doc.id;
                const newRef = db.collection('properties').doc(zpid).collection(m.toSub).doc(m.toDoc);
                batch.set(newRef, doc.data(), { merge: true });
            });
            
            await batch.commit();
            console.log(`  Processed ${i + chunk.length} / ${docs.length}...`);
        }
    }
    
    console.log('--- MIGRATION COMPLETE ---');
}

migratePropertyData().then(() => process.exit(0)).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
