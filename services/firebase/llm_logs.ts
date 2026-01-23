import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./config";
import { LLMCallEvent } from "../../types/ai";

export const logLLMCall = async (event: Omit<LLMCallEvent, 'id' | 'timestamp'>): Promise<string | null> => {
    if (!db) return null;

    try {
        const docData = {
            ...event,
            timestamp: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "llm_call_events"), docData);
        return docRef.id;
    } catch (error) {
        console.error("Error logging LLM call:", error);
        return null;
    }
};

export const updateLLMCall = async (id: string, updates: Partial<LLMCallEvent>): Promise<void> => {
    if (!db || !id) return;

    try {
        const docRef = doc(db, "llm_call_events", id);
        await updateDoc(docRef, updates);
    } catch (error) {
        console.error("Error updating LLM call:", error);
    }
};
