import {
    collection, addDoc, query, orderBy, limit,
    onSnapshot, serverTimestamp, Unsubscribe, where
} from "firebase/firestore";
import { db, logFirestoreQuery } from "./config";

export interface InternalMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    recipientIds: string[];      // explicit recipient user IDs
    participants: string[];      // [senderId, ...recipientIds] — used for array-contains query
    content: string;
    timestamp: any;
    propertyZpid?: string;
    propertyAddress?: string;
}

const COLLECTION = "internal_messages";

/**
 * Send a message to one or more specific users.
 * Only the sender + chosen recipients will be able to see it.
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
 * Subscribe in real-time to messages the current user is part of
 * (either as sender or recipient).
 * Requires a Firestore composite index on: participants (array) + timestamp (asc).
 */
export const subscribeToMyMessages = (
    userId: string,
    onMessages: (messages: InternalMessage[]) => void
): Unsubscribe => {
    if (!db) return () => { };
    const q = query(
        collection(db, COLLECTION),
        where("participants", "array-contains", userId),
        orderBy("timestamp", "asc"),
        limit(200)
    );
    logFirestoreQuery("onSnapshot", COLLECTION, { participants: userId });
    return onSnapshot(q, (snapshot) => {
        const messages: InternalMessage[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<InternalMessage, "id">),
        }));
        onMessages(messages);
    });
};
