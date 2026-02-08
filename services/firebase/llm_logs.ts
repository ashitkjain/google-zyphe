import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs, Timestamp, orderBy } from "firebase/firestore";
import { db, auth, sanitizeForFirestore } from "./config";
import { LLMCallEvent } from "../../types/ai";

export const logLLMCall = async (event: Omit<LLMCallEvent, 'id' | 'timestamp'>): Promise<string | null> => {
    if (!db) return null;

    try {
        const uid = auth?.currentUser?.uid || 'unknown';

        let finalUserId = event.user_id;
        if (!finalUserId || finalUserId === 'unknown') {
            finalUserId = uid;
        }

        const docData = sanitizeForFirestore({
            ...event,
            user_id: finalUserId,
            timestamp: serverTimestamp()
        });

        const docRef = await addDoc(collection(db, "llm_call_events"), docData);
        console.log(`[LLM Log] Successfully created: ${docRef.id}`);
        return docRef.id;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("[LLM Log] Permission denied for 'llm_call_events'.");
        } else {
            console.error("Error creating LLM log:", error);
        }
        return null;
    }
};

export const updateLLMCall = async (id: string, updates: Partial<LLMCallEvent>): Promise<void> => {
    if (!db || !id) {
        console.warn("[LLM Log] Update skipped: Missing db or id");
        return;
    }

    try {
        console.log(`[LLM Log] Updating log: ${id}`);
        const docRef = doc(db, "llm_call_events", id);

        const sanitizedUpdates = { ...updates };
        if (sanitizedUpdates.raw_response && typeof sanitizedUpdates.raw_response === 'string' && sanitizedUpdates.raw_response.length > 500000) {
            sanitizedUpdates.raw_response = sanitizedUpdates.raw_response.substring(0, 5000) + "... [Truncated due to size]";
        }

        const sanitized = sanitizeForFirestore(sanitizedUpdates);
        await updateDoc(docRef, sanitized);
        console.log(`[LLM Log] Successfully updated: ${id}`);
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            // Silently ignore
        } else {
            console.error(`[LLM Log] Error updating ${id}:`, error.message || error);
        }
    }
};

export const getLLMLogsForTimeRange = async (userId: string, startTime: number, endTime: number): Promise<LLMCallEvent[]> => {
    if (!db) return [];
    try {
        const start = Timestamp.fromMillis(startTime);
        const end = Timestamp.fromMillis(endTime);
        const q = query(
            collection(db, "llm_call_events"),
            where("user_id", "==", userId),
            where("timestamp", ">=", start),
            where("timestamp", "<=", end),
            orderBy("timestamp", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LLMCallEvent));
    } catch (error: any) {
        if (error.code === 'failed-precondition') {
            console.warn("[LLM Log] Query failed: Missing index. Please click the link in the console to create it.");
        } else if (error.code === 'permission-denied') {
            console.warn("[LLM Log] Permission denied when fetching logs.");
        } else {
            console.error("Error fetching LLM logs:", error);
        }
        return [];
    }
};
