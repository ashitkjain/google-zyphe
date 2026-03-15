import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, limit, where, Timestamp } from "firebase/firestore";
import { db, auth, sanitizeForFirestore } from "./config";

/**
 * Pipeline Audit Trail
 * Logs every pipeline action (button click) on the City Data page
 * with the event type, timestamp, target, and result summary.
 */

export interface PipelineAuditEntry {
    id?: string;
    action: string;           // e.g. "Launch Ingestion", "Refresh Zip Listing Caches"
    target: string;           // e.g. "Pleasanton, CA" or "85 properties"
    status: 'success' | 'partial' | 'error';
    summary: string;          // e.g. "Found 102 listings across 5 zips"
    details?: Record<string, any>;  // optional structured data (counts, errors, etc.)
    userId: string;
    userName: string;
    startedAt: any;           // serverTimestamp
    durationMs?: number;      // how long the action took
}

/**
 * Logs a pipeline audit event to Firestore.
 */
export const logPipelineAudit = async (
    action: string,
    target: string,
    status: 'success' | 'partial' | 'error',
    summary: string,
    durationMs?: number,
    details?: Record<string, any>
): Promise<string | null> => {
    if (!db) return null;
    try {
        const entry: Omit<PipelineAuditEntry, 'id'> = {
            action,
            target,
            status,
            summary,
            durationMs,
            details: details ? sanitizeForFirestore(details) : undefined,
            userId: auth?.currentUser?.uid || 'unknown',
            userName: auth?.currentUser?.displayName || auth?.currentUser?.email || 'Unknown',
            startedAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'pipeline_audit_trail'), sanitizeForFirestore(entry));
        return docRef.id;
    } catch (error) {
        console.error('[PipelineAudit] Failed to log:', error);
        return null;
    }
};

/**
 * Fetches recent pipeline audit entries, ordered by most recent first.
 * Optionally filter by action type.
 */
export const getPipelineAuditTrail = async (
    maxEntries: number = 100,
    actionFilter?: string
): Promise<PipelineAuditEntry[]> => {
    if (!db) return [];
    try {
        let q;
        if (actionFilter) {
            q = query(
                collection(db, 'pipeline_audit_trail'),
                where('action', '==', actionFilter),
                orderBy('startedAt', 'desc'),
                limit(maxEntries)
            );
        } else {
            q = query(
                collection(db, 'pipeline_audit_trail'),
                orderBy('startedAt', 'desc'),
                limit(maxEntries)
            );
        }
        const snap = await getDocs(q);
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                startedAt: data.startedAt instanceof Timestamp
                    ? data.startedAt.toDate().toISOString()
                    : data.startedAt,
            } as PipelineAuditEntry;
        });
    } catch (error) {
        console.error('[PipelineAudit] Failed to fetch audit trail:', error);
        return [];
    }
};
