import { collection, query, where, getDocs, writeBatch, Timestamp, limit } from "firebase/firestore";
import { db } from "./config";

/**
 * Manually purge logs older than a specific duration.
 * Keeps data for 2 days max as requested.
 */
export const runLogArchival = async (maxDays = 2) => {
    if (!db) return { success: false, error: "Database not initialized" };

    const collections = ["llm_call_events", "api_call_events"];
    const results: Record<string, number> = {};
    
    try {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - maxDays);
        const thresholdTs = Timestamp.fromDate(threshold);

        for (const colName of collections) {
            let deletedCount = 0;
            let hasMore = true;

            // Delete in batches to avoid Firestore limits
            while (hasMore) {
                const q = query(
                    collection(db, colName),
                    where("timestamp", "<", thresholdTs),
                    limit(500)
                );

                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    hasMore = false;
                    break;
                }

                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                
                deletedCount += snapshot.size;
                if (snapshot.size < 500) hasMore = false;
                
                console.log(`[Archival] Deleted ${snapshot.size} logs from ${colName}. Total: ${deletedCount}`);
            }
            results[colName] = deletedCount;
        }

        return { success: true, stats: results };
    } catch (error: any) {
        console.error("[Archival] Failed to run log archival:", error);
        return { success: false, error: error.message };
    }
};
