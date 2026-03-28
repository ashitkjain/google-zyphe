
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateOrphanedAnalysis() {
    console.log('--- START: Moving Orphaned Property Metadata to deprecated_properties ---');
    
    // We'll use the collectionGroup strategy as listDocuments was flaky
    const snapshot = await db.collectionGroup('analysis').get();
    console.log(`Scanning ${snapshot.size} metadata documents...`);

    let orphansMigrated = 0;
    
    for (const docSnap of snapshot.docs) {
        const docId = docSnap.id; // e.g. 'visual', 'comprehensive'
        const zpid = docSnap.ref.parent.parent?.id;
        if (!zpid) continue;

        const mainPropSnap = await db.collection('properties').doc(zpid).get();
        
        if (!mainPropSnap.exists) {
            // Found an orphan! Move metadata to deprecated_properties/{zpid}/analysis/{docId}
            const data = docSnap.data();
            const targetRef = db.collection('deprecated_properties').doc(zpid).collection('analysis').doc(docId);
            
            console.log(`  📦 Migrating ${zpid}/analysis/${docId} to deprecated_properties...`);
            
            const batch = db.batch();
            batch.set(targetRef, {
                ...data,
                deprecated_at: admin.firestore.FieldValue.serverTimestamp(),
                original_zpid: zpid
            });
            batch.delete(docSnap.ref);
            
            await batch.commit();
            orphansMigrated++;
        }
    }

    console.log(`--- COMPLETE: Migrated ${orphansMigrated} analysis documents for orphaned properties ---`);
}

migrateOrphanedAnalysis()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
