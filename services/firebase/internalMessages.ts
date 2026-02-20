import {
    collection, addDoc, query, orderBy,
    getDocs, serverTimestamp, where, limit
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
}

const COLLECTION = "internal_messages";

/**
 * Send a message to one or more specific users.
 * Writes once to Firestore — no listener needed.
 */
export const sendInternalMessage = async (
    senderId: string,
    senderName: string,
    senderRole: string,
    recipientIds: string[],
    content: string,
    property?: { zpid?: string; address: string }
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
            orderBy("timestamp", "desc"), // newest first — limit(n) gives the n most recent
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
