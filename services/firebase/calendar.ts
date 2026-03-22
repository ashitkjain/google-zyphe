import { collection, query, where, getDocs, addDoc, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import { requireTenantId } from "./tenantContext";
import { CalendarEvent } from "../../types";

export const getCalendarEvents = async (realtorId: string) => {
    if (!db) return [];
    try {
        const rid = requireTenantId(realtorId);
        const q = query(collection(db, "realtors", rid, "calendar_events"));
        logFirestoreQuery('getDocs', 'calendar_events', { realtorId });
        const snap = await getDocs(q);
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                start: data.start?.toDate() || new Date(),
                end: data.end?.toDate() || new Date()
            } as CalendarEvent;
        });
    } catch (error) {
        handleFirestoreError(error, "getCalendarEvents");
        return [];
    }
};

export const saveCalendarEvent = async (event: Partial<CalendarEvent>, realtorId?: string) => {
    if (!db) return null;
    try {
        const rid = requireTenantId(realtorId || event.realtorId);
        const eventId = event.id;
        const sanitized = sanitizeForFirestore(event);

        if (eventId && !eventId.startsWith('new-')) {
            const docRef = doc(db, "realtors", rid, "calendar_events", eventId);
            logFirestoreQuery('setDoc', 'calendar_events', { eventId });
            await setDoc(docRef, {
                ...sanitized,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return eventId;
        } else {
            const { id, ...rest } = sanitized;
            logFirestoreQuery('addDoc', 'calendar_events', rest);
            const docRef = await addDoc(collection(db, "realtors", rid, "calendar_events"), {
                ...rest,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        }
    } catch (error) {
        handleFirestoreError(error, "saveCalendarEvent");
        return null;
    }
};

export const deleteCalendarEvent = async (eventId: string, realtorId?: string) => {
    if (!db) return false;
    try {
        const rid = requireTenantId(realtorId);
        const docRef = doc(db, "realtors", rid, "calendar_events", eventId);
        logFirestoreQuery('deleteDoc', 'calendar_events', { eventId });
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        handleFirestoreError(error, "deleteCalendarEvent");
        return false;
    }
};

export const getClientCalendarEvents = async (realtorId: string, clientId: string) => {
    if (!db) return [];
    try {
        const rid = requireTenantId(realtorId);
        const q = query(
            collection(db, "realtors", rid, "calendar_events"),
            where("clientId", "==", clientId)
        );
        logFirestoreQuery('getDocs', 'calendar_events', { realtorId, clientId });
        const snap = await getDocs(q);
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                start: data.start?.toDate() || new Date(),
                end: data.end?.toDate() || new Date()
            } as CalendarEvent;
        });
    } catch (error) {
        handleFirestoreError(error, "getClientCalendarEvents");
        return [];
    }
};
