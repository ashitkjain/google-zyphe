
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function deleteCollection(rid: string, path: string) {
    const collectionRef = db.collection('realtors').doc(rid).collection(path);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) return 0;

    let deleted = 0;
    for (const docSnap of snapshot.docs) {
        // First delete any subcollections (versions)
        const versionsSnap = await docSnap.ref.collection('versions').get();
        if (!versionsSnap.empty) {
            const batch = db.batch();
            versionsSnap.docs.forEach(v => batch.delete(v.ref));
            await batch.commit();
            deleted += versionsSnap.size;
        }
        await docSnap.ref.delete();
        deleted++;
    }
    return deleted;
}

async function cleanupTransactionDocuments() {
    console.log('--- CLEANUP START: Legacy transaction_documents ---');
    
    const realtorsSnap = await db.collection('realtors').get();
    let totalDeleted = 0;

    for (const realtorDoc of realtorsSnap.docs) {
        const rid = realtorDoc.id;
        const count = await deleteCollection(rid, 'transaction_documents');
        if (count > 0) {
            console.log(`  Purged ${count} documents/versions from realtor ${rid}`);
            totalDeleted += count;
        }
    }

    console.log(`--- CLEANUP COMPLETE: ${totalDeleted} total records purged ---`);
}

cleanupTransactionDocuments()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    });
