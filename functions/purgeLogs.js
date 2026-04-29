const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

/**
 * Scheduled function to maintain Firestore hygiene for audit logs.
 * 1. Removes request/response payloads (large blobs) older than 7 days.
 * 2. Deletes entire log documents older than 60 days.
 * Runs every 24 hours.
 */
exports.purgeLogs = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        const db = admin.firestore();
        const now = Date.now();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);

        const collections = ['llm_call_events', 'api_call_events'];

        for (const colName of collections) {
            console.log(`[Purge] Processing collection: ${colName}`);
            
            // 1. Delete entire documents older than 60 days
            // We use request_sent_at or timestamp as the time reference
            const sixtyDayQuery = await db.collection(colName)
                .where('timestamp', '<', sixtyDaysAgo)
                .limit(500)
                .get();

            if (!sixtyDayQuery.empty) {
                const batch = db.batch();
                sixtyDayQuery.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`[Purge] Deleted ${sixtyDayQuery.size} documents older than 60 days from ${colName}`);
            }

            // 2. Strip large payload fields from documents older than 7 days
            // This preserves the record (metadata, token counts, cost) but saves storage
            const sevenDayQuery = await db.collection(colName)
                .where('timestamp', '<', sevenDaysAgo)
                .where('timestamp', '>=', sixtyDaysAgo)
                .limit(500)
                .get();

            if (!sevenDayQuery.empty) {
                const batch = db.batch();
                let strippedCount = 0;
                
                sevenDayQuery.docs.forEach(doc => {
                    const data = doc.data();
                    // Identify fields to strip (request/response blobs)
                    const fieldsToStrip = {};
                    
                    if (data.raw_payload) fieldsToStrip.raw_payload = admin.firestore.FieldValue.delete();
                    if (data.raw_response) fieldsToStrip.raw_response = admin.firestore.FieldValue.delete();
                    if (data.params && Object.keys(data.params).length > 0) fieldsToStrip.params = admin.firestore.FieldValue.delete();
                    if (data.response && (typeof data.response === 'string' || Object.keys(data.response).length > 0)) fieldsToStrip.response = admin.firestore.FieldValue.delete();
                    
                    if (Object.keys(fieldsToStrip).length > 0) {
                        batch.update(doc.ref, {
                            ...fieldsToStrip,
                            payload_stripped: true,
                            stripped_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                        strippedCount++;
                    }
                });

                if (strippedCount > 0) {
                    await batch.commit();
                    console.log(`[Purge] Stripped large payloads from ${strippedCount} documents older than 7 days in ${colName}`);
                }
            }
        }

        console.log('[Purge] Firestore hygiene task complete.');
        return null;
    });
