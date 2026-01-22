import { collection, addDoc, setDoc, doc } from "firebase/firestore";
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
