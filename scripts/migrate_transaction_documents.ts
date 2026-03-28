
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateTransactionDocuments() {
    console.log('--- MIGRATION START: transaction_documents → transactions/{tid}/documents ---');
    
    // Get all realtor IDs
    const realtorsSnap = await db.collection('realtors').get();
    console.log(`Found ${realtorsSnap.size} realtors.`);

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const realtorDoc of realtorsSnap.docs) {
        const rid = realtorDoc.id;
        const legacySnap = await db.collection('realtors').doc(rid).collection('transaction_documents').get();
        
        if (legacySnap.empty) continue;
        console.log(`\n  Realtor ${rid}: ${legacySnap.size} legacy documents`);

        for (const docSnap of legacySnap.docs) {
            const data = docSnap.data();
            const tid = data.transaction_id;
            
            if (!tid) {
                console.log(`    ⚠️  Doc ${docSnap.id} has no transaction_id, skipping.`);
                totalSkipped++;
                continue;
            }

            // Check if already exists in nested path
            const nestedRef = db.collection('realtors').doc(rid)
                .collection('transactions').doc(tid)
                .collection('documents').doc(docSnap.id);
            const nestedSnap = await nestedRef.get();

            if (!nestedSnap.exists) {
                // Migrate the document
                await nestedRef.set(data);
                console.log(`    📦 Migrated ${docSnap.id} → transactions/${tid}/documents/`);
                totalMigrated++;
            } else {
                totalSkipped++;
            }

            // Now migrate versions subcollection
            const legacyVersionsSnap = await db.collection('realtors').doc(rid)
                .collection('transaction_documents').doc(docSnap.id)
                .collection('versions').get();

            if (!legacyVersionsSnap.empty) {
                for (const vSnap of legacyVersionsSnap.docs) {
                    const nestedVersionRef = db.collection('realtors').doc(rid)
                        .collection('transactions').doc(tid)
                        .collection('documents').doc(docSnap.id)
                        .collection('versions').doc(vSnap.id);
                    const nestedVersionSnap = await nestedVersionRef.get();
                    
                    if (!nestedVersionSnap.exists) {
                        await nestedVersionRef.set(vSnap.data());
                        console.log(`      📄 Migrated version ${vSnap.id}`);
                    }
                }
            }
        }
    }

    console.log(`\n--- MIGRATION COMPLETE: ${totalMigrated} migrated, ${totalSkipped} already existed/skipped ---`);
}

migrateTransactionDocuments()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
