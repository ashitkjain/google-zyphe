import { collection, addDoc, doc, serverTimestamp, query, where, orderBy, getDocs } from "firebase/firestore";
import { db, auth, sanitizeForFirestore } from "./config";
import { AuditEvent, AuditActionType, AuditEntityType } from "../../types";

export interface LogAuditOptions {
    transaction_id: string;
    entity_id: string;
    entity_type: AuditEntityType;
    action: AuditActionType;
    actor_user_id?: string;
    actor_name?: string;
    diff?: {
        before?: any;
        after?: any;
        summary?: string;
    };
}

/**
 * Logs an audit event to Firestore.
 * This should be called after any successful write operation (create, update, delete).
 */
export const logAuditEvent = async (options: LogAuditOptions): Promise<string | null> => {
    if (!db || !options.transaction_id) {
        if (!options.transaction_id) {
            console.warn("[AuditLog] Skipping audit log: transaction_id is required.");
        }
        return null;
    }

    try {
        const actor_user_id = options.actor_user_id || auth?.currentUser?.uid || 'system';
        const actor_name = options.actor_name || auth?.currentUser?.displayName || (actor_user_id === 'system' ? 'System' : 'Unknown User');

        const event: Omit<AuditEvent, 'id'> = {
            transaction_id: options.transaction_id,
            actor_user_id,
            actor_name,
            actor_type: actor_user_id === 'system' ? 'SYSTEM' : 'USER',
            action: options.action,
            entity_type: options.entity_type,
            entity_id: options.entity_id,
            occurred_at: serverTimestamp(),
            diff: options.diff
        };

        if ((options as any).batch) {
            const batch = (options as any).batch;
            const docRef = doc(collection(db, "audit_events"));
            batch.set(docRef, sanitizeForFirestore(event));
            return docRef.id;
        } else {
            const docRef = await addDoc(collection(db, "audit_events"), sanitizeForFirestore(event));
            return docRef.id;
        }

    } catch (error) {
        console.error("[AuditLog] Failed to log audit event:", error);
        return null;
    }
};

/**
 * Fetches audit events for a specific transaction.
 */
export const getAuditEvents = async (transactionId: string): Promise<AuditEvent[]> => {
    if (!db || !transactionId) return [];

    try {
        const q = query(
            collection(db, "audit_events"),
            where("transaction_id", "==", transactionId),
            orderBy("occurred_at", "desc")
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as AuditEvent));
    } catch (error) {
        console.error("[AuditLog] Failed to fetch audit events:", error);
        return [];
    }
};
