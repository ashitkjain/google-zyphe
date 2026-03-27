
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function migrateLeadData() {
    console.log('--- MIGRATION START: Lead-Specific Nesting ---');

    // 1. Move Top-Level leads_documents to Realtor Scale
    console.log('Migrating leads_documents to realtor-scope...');
    const leadsDocsSnap = await db.collection('leads_documents').get();
    for (const doc of leadsDocsSnap.docs) {
        const data = doc.data();
        const rid = data.realtorId;
        if (rid) {
            await db.collection('realtors').doc(rid).collection('leads_documents').doc(doc.id).set(data);
        }
    }

    const realtorsSnap = await db.collection('realtors').get();
    for (const realtorDoc of realtorsSnap.docs) {
        const rid = realtorDoc.id;
        console.log(`Processing realtor: ${rid}...`);

        // 2. Migrate plans
        await migrateSubcollection(
            db.collection('realtors').doc(rid).collection('lead_plans'),
            (doc) => {
                const lid = doc.data().lead_id;
                if (!lid) return null;
                return db.collection('realtors').doc(rid).collection('leads').doc(lid).collection('plans').doc(doc.id);
            }
        );

        // 3. Migrate journey events
        await migrateSubcollection(
            db.collection('realtors').doc(rid).collection('journey_events'),
            (doc) => {
                const lid = doc.data().clientId;
                if (!lid) return null;
                return db.collection('realtors').doc(rid).collection('leads').doc(lid).collection('journey_events').doc(doc.id);
            }
        );

        // 4. Migrate messages
        await migrateSubcollection(
            db.collection('realtors').doc(rid).collection('messages'),
            (doc) => {
                const lid = doc.data().lead_id;
                if (!lid) return null;
                return db.collection('realtors').doc(rid).collection('leads').doc(lid).collection('messages').doc(doc.id);
            }
        );
        // 5. Migrate Reactivation Summaries (to leads_documents/{docId}/analysis_summary/current_summary)
        const summaryCol = db.collection('realtors').doc(rid).collection('reactivation_analysis_summary');
        const summarySnap = await summaryCol.get();
        for (const summaryDoc of summarySnap.docs) {
            const data = summaryDoc.data();
            const docId = data.leads_documents;
            if (docId) {
                await db.collection('realtors').doc(rid).collection('leads_documents').doc(docId)
                    .collection('analysis_summary').doc('current_summary').set(data);
            }
        }

        // 6. Migrate Market Contexts (to leads_documents/{docId}/market_context)
        const marketCol = db.collection('realtors').doc(rid).collection('market_context');
        const marketSnap = await marketCol.get();
        for (const marketDoc of marketSnap.docs) {
            const data = marketDoc.data();
            const summaryId = data.reactivation_analysis_summary_id;
            
            // Find the summary to get the docId
            if (summaryId) {
                const sDoc = await summaryCol.doc(summaryId).get();
                if (sDoc.exists) {
                    const docId = sDoc.data()?.leads_documents;
                    if (docId) {
                        await db.collection('realtors').doc(rid).collection('leads_documents').doc(docId)
                            .collection('market_context').doc(marketDoc.id).set(data);
                    }
                }
            }
        }
    }

    console.log('--- MIGRATION COMPLETE ---');
}

async function migrateSubcollection(
    oldCol: admin.firestore.CollectionReference,
    getNewRef: (doc: admin.firestore.QueryDocumentSnapshot) => admin.firestore.DocumentReference | null
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
            }
        }
        await batch.commit();
    }
}

migrateLeadData().then(() => process.exit(0)).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
