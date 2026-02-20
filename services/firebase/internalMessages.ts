import {
    collection, addDoc, query, orderBy,
    getDocs, serverTimestamp, where, limit, doc, getDoc,
    deleteDoc, writeBatch
} from "firebase/firestore";
import { db, logFirestoreQuery } from "./config";

export interface InternalMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    recipientIds: string[];
    participants: string[];      // [senderId, ...recipientIds] — used for array-contains query
    content: string;
    timestamp: any;
    propertyZpid?: string;
    propertyAddress?: string;
    // Thread / reply fields
    /** ID of the message this is a reply to (if any) */
    replyToId?: string;
    /** Snapshot of the replied-to message's text (for quick display) */
    replyToContent?: string;
    /** Display name of the replied-to message's sender */
    replyToSenderName?: string;
    /** Thread root ID — equals replyToId of the root message, or its own id if it IS the root */
    threadId?: string;
}

const COLLECTION = "internal_messages";

/**
 * Send a message to one or more specific users.
 * Optionally include a replyTo reference to display threaded conversations.
 */
export const sendInternalMessage = async (
    senderId: string,
    senderName: string,
    senderRole: string,
    recipientIds: string[],
    content: string,
    property?: { zpid?: string; address: string },
    replyTo?: Pick<InternalMessage, "id" | "content" | "senderName" | "threadId">
): Promise<{ success: boolean; error?: string }> => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const participants = Array.from(new Set([senderId, ...recipientIds]));
        const payload: any = {
            senderId,
            senderName,
            senderRole,
            recipientIds,
            participants,
            content: content.trim(),
            timestamp: serverTimestamp(),
        };
        if (property?.address) {
            payload.propertyAddress = property.address;
            if (property.zpid) payload.propertyZpid = property.zpid;
        }
        if (replyTo) {
            payload.replyToId = replyTo.id;
            payload.replyToContent = replyTo.content;
            payload.replyToSenderName = replyTo.senderName;
            // propagate the root thread id (use replyTo.threadId if it exists, else replyTo.id)
            payload.threadId = replyTo.threadId ?? replyTo.id;
        }
        logFirestoreQuery("addDoc", COLLECTION, { senderId, recipientIds });
        await addDoc(collection(db, COLLECTION), payload);
        return { success: true };
    } catch (error) {
        console.error("[InternalMessages] Failed to send:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Fetch all messages the current user is part of (sent or received).
 * One-time read — call this on mount and on manual refresh.
 * Results are returned newest-first.
 */
export const getMyMessages = async (
    userId: string,
    limitCount: number = 20
): Promise<InternalMessage[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, COLLECTION),
            where("participants", "array-contains", userId),
            orderBy("timestamp", "desc"),
            limit(limitCount)
        );
        logFirestoreQuery("getDocs", COLLECTION, { participants: userId });
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<InternalMessage, "id">),
        }));
    } catch (error) {
        console.error("[InternalMessages] Failed to fetch:", error);
        return [];
    }
};

/** Fetch a single message by id (used to lazily load reply context). */
export const getMessageById = async (
    msgId: string
): Promise<InternalMessage | null> => {
    if (!db) return null;
    try {
        const ref = doc(db, COLLECTION, msgId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        return { id: snap.id, ...(snap.data() as Omit<InternalMessage, "id">) };
    } catch (error) {
        console.error("[InternalMessages] Failed to fetch message:", error);
        return null;
    }
};

/**
 * Delete a single message by id.
 * The caller must be a participant (enforced by Firestore rules).
 */
export const deleteMessage = async (
    msgId: string
): Promise<{ success: boolean; error?: string }> => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        logFirestoreQuery("deleteDoc", COLLECTION, { msgId });
        await deleteDoc(doc(db, COLLECTION, msgId));
        return { success: true };
    } catch (error) {
        console.error("[InternalMessages] Failed to delete message:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Delete all messages that share the given threadId (or whose id equals threadId for root messages).
 * Uses a batched write (max 500 ops — sufficient for typical thread sizes).
 */
export const deleteThread = async (
    threadId: string,
    messageIds: string[]
): Promise<{ success: boolean; error?: string }> => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const batch = writeBatch(db);
        for (const id of messageIds) {
            batch.delete(doc(db, COLLECTION, id));
        }
        logFirestoreQuery("batchDelete", COLLECTION, { threadId, count: messageIds.length });
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("[InternalMessages] Failed to delete thread:", error);
        return { success: false, error: (error as Error).message };
    }
};
