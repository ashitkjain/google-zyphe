import { collection, addDoc } from "firebase/firestore";
import {
    db,
    logFirestoreQuery
} from "./config";

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
