import { collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp as FsTimestamp, query, where, getDocs, Timestamp, orderBy } from "firebase/firestore";
import { db, auth, sanitizeForFirestore } from "./config";

export interface APICallEvent {
    id?: string;
    user_id: string;
    zpid?: string;
    address?: string;
    api_name: string;
    endpoint: string;
    params: any;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
    response_time_ms?: number;
    timestamp?: any;
    fieldsPopulated?: string[];  // fields that returned with data
    fieldsNull?: string[];       // fields that were null/empty from the source
}

export const logAPICall = async (event: Omit<APICallEvent, 'id' | 'timestamp'>): Promise<string | null> => {
    if (!db) return null;

    try {
        const uid = auth?.currentUser?.uid || 'unknown';

        let finalUserId = event.user_id;
        if (!finalUserId || finalUserId === 'unknown') {
            finalUserId = uid;
        }

        const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
        const docData = sanitizeForFirestore({
            ...event,
            user_id: finalUserId,
            timestamp: serverTimestamp(),
            expireAt: FsTimestamp.fromMillis(Date.now() + NINETY_DAYS_MS),
        });

        const docRef = await addDoc(collection(db, "api_call_events"), docData);
        return docRef.id;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn("[API Log] Permission denied. Please update Firestore rules for 'api_call_events'.");
        } else {
            console.error("Error creating API log:", error);
        }
        return null;
    }
};
export const updateAPICall = async (id: string, updates: Partial<APICallEvent>): Promise<void> => {
    if (!db || !id) return;
    try {
        const docRef = doc(db, "api_call_events", id);
        const sanitized = sanitizeForFirestore(updates);
        await updateDoc(docRef, sanitized);
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            // Silently ignore or warn once
        } else {
            console.error(`[API Log] Error updating ${id}:`, error.message || error);
        }
    }
};

export const getAPILogsForTimeRange = async (userId: string, startTime: number, endTime: number): Promise<APICallEvent[]> => {
    if (!db) return [];
    try {
        const start = Timestamp.fromMillis(startTime);
        const end = Timestamp.fromMillis(endTime);
        const q = query(
            collection(db, "api_call_events"),
            where("user_id", "==", userId),
            where("timestamp", ">=", start),
            where("timestamp", "<=", end),
            orderBy("timestamp", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as APICallEvent));
    } catch (error: any) {
        if (error.code === 'failed-precondition') {
            console.warn("[API Log] Query failed: Missing index. Please click the link in the console to create it.");
        } else if (error.code === 'permission-denied') {
            console.warn("[API Log] Permission denied when fetching logs.");
        } else {
            console.error("Error fetching API logs:", error);
        }
        return [];
    }
};
