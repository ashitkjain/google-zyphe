
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateTransactionData() {
    console.log('--- MIGRATION START: Transaction Nested Subcollections ---');

    const realtorsSnap = await db.collection('realtors').get();
    console.log(`Found ${realtorsSnap.size} realtors.`);

    for (const realtorDoc of realtorsSnap.docs) {
        const rid = realtorDoc.id;
        console.log(`Processing realtor: ${rid}...`);

        // 1. Migrate Parties
        await migrateSubcollection(
            db.collection('realtors').doc(rid).collection('transaction_parties'),
            (doc) => {
                const tid = doc.data().transaction_id;
                if (!tid) return null;
                return db.collection('realtors').doc(rid).collection('transactions').doc(tid).collection('parties').doc(doc.id);
            }
        );

        // 2. Migrate Documents (and versions)
        await migrateSubcollection(
            db.collection('realtors').doc(rid).collection('transaction_documents'),
            (doc) => {
                const tid = doc.data().transaction_id;
                if (!tid) return null;
                return db.collection('realtors').doc(rid).collection('transactions').doc(tid).collection('documents').doc(doc.id);
            },
            async (oldDoc, newDoc) => {
                // Migrate versions subcollection
                const versionsSnap = await oldDoc.ref.collection('versions').get();
                if (!versionsSnap.empty) {
                    const batch = db.batch();
                    versionsSnap.docs.forEach(v => {
                        batch.set(newDoc.collection('versions').doc(v.id), v.data());
                    });
                    await batch.commit();
                }
            }
        );

        // 3. Migrate Tasks (transaction-specific)
        await migrateSubcollection(
            db.collection('realtors').doc(rid).collection('tasks'),
            (doc) => {
                const tid = doc.data().transaction_id;
                if (!tid) return null;
                return db.collection('realtors').doc(rid).collection('transactions').doc(tid).collection('tasks').doc(doc.id);
            }
        );

        // 4. Migrate Audit Events
        await migrateSubcollection(
            db.collection('realtors').doc(rid).collection('audit_events'),
            (doc) => {
                const tid = doc.data().transaction_id;
                if (!tid) return null;
                return db.collection('realtors').doc(rid).collection('transactions').doc(tid).collection('audit_events').doc(doc.id);
            }
        );
    }

    console.log('--- MIGRATION COMPLETE ---');
}

async function migrateSubcollection(
    oldCol: admin.firestore.CollectionReference,
    getNewRef: (doc: admin.firestore.QueryDocumentSnapshot) => admin.firestore.DocumentReference | null,
    onDocMigrated?: (oldDoc: admin.firestore.QueryDocumentSnapshot, newRef: admin.firestore.DocumentReference) => Promise<void>
) {
    const snapshot = await oldCol.get();
    if (snapshot.empty) return;

    console.log(`  Migrating ${snapshot.size} docs from ${oldCol.path}...`);
    
    for (let i = 0; i < snapshot.docs.length; i += 50) {
        const batch = db.batch();
        const chunk = snapshot.docs.slice(i, i + 50);
        
        for (const doc of chunk) {
            const newRef = getNewRef(doc);
            if (newRef) {
                batch.set(newRef, doc.data(), { merge: true });
                if (onDocMigrated) await onDocMigrated(doc, newRef);
            }
        }
        await batch.commit();
    }
}

migrateTransactionData().then(() => process.exit(0)).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
