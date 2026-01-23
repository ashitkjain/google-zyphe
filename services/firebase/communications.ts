import { collection, addDoc, setDoc, doc, query, getDocs, orderBy, where, limit } from "firebase/firestore";
import {
    db,
    logFirestoreQuery
} from "./config";
import { MessageEvent } from "../../types";

export const sendInviteEmail = async (email: string, subject: string, html: string) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const mailCol = collection(db, "mail");
        logFirestoreQuery('addDoc', 'mail', { to: email });
        await addDoc(mailCol, {
            to: email,
            message: {
                subject: subject,
                html: html,
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Error queueing email:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Logs a message event to the 'message_events' collection.
 * This tracks the granular lifecycle of messages (sent, delivered, failed, etc).
 */
export const logMessageEvent = async (event: MessageEvent) => {
    if (!db) return { success: false, error: "Database not initialized" };

    try {
        // Use event_id as the document ID if possible, otherwise let Firestore generate one
        // and ensure the field is present.
        const collectionName = "message_events";

        if (event.event_id) {
            const eventRef = doc(db, collectionName, event.event_id);
            logFirestoreQuery('setDoc', collectionName, { id: event.event_id, type: event.event_type });
            await setDoc(eventRef, event);
        } else {
            // Fallback if no UUID provided, though type definition expects it.
            const colRef = collection(db, collectionName);
            logFirestoreQuery('addDoc', collectionName, { type: event.event_type });
            await addDoc(colRef, event);
        }

        return { success: true };
    } catch (error) {
        console.error("Error logging message event:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Saves a reactivation message record to the 'reactivation_messages' collection.
 */
export const saveReactivationMessage = async (data: {
    message_id: string;
    lead_id: string;
    realtorId: string;
    channel: string;
    content: string;
    sent_at: any;
    reply_received: boolean;
    sentiment: string;
}) => {
    if (!db) return { success: false, error: "Database not initialized" };

    try {
        const collectionName = "reactivation_messages";
        const msgRef = doc(db, collectionName, data.message_id);
        logFirestoreQuery('setDoc', collectionName, { id: data.message_id, lead_id: data.lead_id, realtorId: data.realtorId });
        await setDoc(msgRef, data);
        return { success: true };
    } catch (error) {
        console.error("Error saving reactivation message:", error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Retrieves reactivation messages for a realtor or specific lead.
 */
export const getReactivationMessages = async (realtorId: string, leadId?: string, limitCount: number = 50) => {
    if (!db) return [];

    try {
        const collectionName = "reactivation_messages";
        const colRef = collection(db, collectionName);

        let q;
        if (leadId) {
            q = query(
                colRef,
                where("realtorId", "==", realtorId),
                where("lead_id", "==", leadId),
                orderBy("sent_at", "desc"),
                limit(limitCount)
            );
        } else {
            q = query(
                colRef,
                where("realtorId", "==", realtorId),
                orderBy("sent_at", "desc"),
                limit(limitCount)
            );
        }

        logFirestoreQuery('getDocs', collectionName, { realtorId, leadId, limit: limitCount });
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error("Error fetching reactivation messages:", error);
        return [];
    }
};
