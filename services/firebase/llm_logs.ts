import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth, sanitizeForFirestore } from "./config";
import { LLMCallEvent } from "../../types/ai";

export const logLLMCall = async (event: Omit<LLMCallEvent, 'id' | 'timestamp'>): Promise<string | null> => {
    if (!db) return null;

    try {
        const uid = auth?.currentUser?.uid || 'unknown';
        console.log(`[LLM Log] Attempting creation for UID: ${uid}`);

        const docData = sanitizeForFirestore({
            ...event,
            user_id: event.user_id || uid,
            timestamp: serverTimestamp()
        });

        const docRef = await addDoc(collection(db, "llm_call_events"), docData);
        console.log(`[LLM Log] Successfully created: ${docRef.id}`);
        return docRef.id;
    } catch (error: any) {
        console.error("Error creating LLM log:", error);
        return null;
    }
};

export const updateLLMCall = async (id: string, updates: Partial<LLMCallEvent>): Promise<void> => {
    if (!db || !id) {
        console.warn("[LLM Log] Update skipped: Missing db or id");
        return;
    }

    try {
        console.log(`[LLM Log] Updating log: ${id}`, updates);
        const docRef = doc(db, "llm_call_events", id);
        const sanitized = sanitizeForFirestore(updates);
        await updateDoc(docRef, sanitized);
        console.log(`[LLM Log] Successfully updated: ${id}`);
    } catch (error: any) {
        console.error(`[LLM Log] Error updating ${id}:`, error.message || error);
    }
};
