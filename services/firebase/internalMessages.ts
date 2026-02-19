import {
    collection, addDoc, query, orderBy, limit,
    onSnapshot, serverTimestamp, Unsubscribe, where, getDocs
} from "firebase/firestore";
import { db, logFirestoreQuery } from "./config";

export interface InternalMessage {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    content: string;
    timestamp: any;
    // Optional property reference
    propertyZpid?: string;
    propertyAddress?: string;
}

const COLLECTION = "internal_messages";

/**
 * Send a message to the internal team message center.
 */
export const sendInternalMessage = async (
    senderId: string,
    senderName: string,
    senderRole: string,
    content: string,
    property?: { zpid: string; address: string }
): Promise<{ success: boolean; error?: string }> => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const payload: any = {
            senderId,
            senderName,
            senderRole,
            content: content.trim(),
            timestamp: serverTimestamp(),
        };
        if (property?.zpid) {
            payload.propertyZpid = property.zpid;
            payload.propertyAddress = property.address;
        }
        logFirestoreQuery("addDoc", COLLECTION, { senderId });
        await addDoc(collection(db, COLLECTION), payload);
        return { success: true };
    } catch (error) {
        console.error("[InternalMessages] Failed to send:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Subscribe to the latest N internal messages in real-time.
 */
export const subscribeToInternalMessages = (
    limitCount: number = 100,
    onMessages: (messages: InternalMessage[]) => void
): Unsubscribe => {
    if (!db) return () => { };
    const q = query(
        collection(db, COLLECTION),
        orderBy("timestamp", "asc"),
        limit(limitCount)
    );
    logFirestoreQuery("onSnapshot", COLLECTION, { limit: limitCount });
    return onSnapshot(q, (snapshot) => {
        const messages: InternalMessage[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<InternalMessage, "id">),
        }));
        onMessages(messages);
    });
};
