import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    getDocs,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import { db } from './config';
import { UserPropertyComment, StickyNoteColor } from '../../types/stickyNotes';

const COLLECTION_NAME = 'user_property_comment';

export const saveStickyNote = async (data: Omit<UserPropertyComment, 'id' | 'createdAt' | 'lastUpdated'>) => {
    if (!db) return null;
    try {
        const userId = data.userId;
        if (!userId) { console.error('saveStickyNote: userId required'); return null; }
        const docRef = await addDoc(collection(db, "users", userId, "property_comments"), {
            ...data,
            createdAt: serverTimestamp(),
            lastUpdated: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving sticky note:", error);
        return null;
    }
};

export const updateStickyNote = async (id: string, updates: Partial<UserPropertyComment>) => {
    if (!db) return false;
    try {
        const userId = updates.userId;
        if (!userId) { console.error('updateStickyNote: userId required'); return false; }
        const docRef = doc(db, "users", userId, "property_comments", id);
        await updateDoc(docRef, {
            ...updates,
            lastUpdated: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Error updating sticky note:", error);
        return false;
    }
};

export const deleteStickyNote = async (id: string, userId?: string) => {
    if (!db) return false;
    try {
        if (!userId) { console.error('deleteStickyNote: userId required'); return false; }
        const docRef = doc(db, "users", userId, "property_comments", id);
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        console.error("Error deleting sticky note:", error);
        return false;
    }
};

export const getStickyNotes = async (zpid: string, userId: string, tab: string): Promise<UserPropertyComment[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, "users", userId, "property_comments"),
            where('zpid', '==', String(zpid)),
            where('tab', '==', tab)
        );
        const querySnapshot = await getDocs(q);
        const notes = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as UserPropertyComment));

        // Sort in memory to avoid needing a composite index in Firestore
        return notes.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeA - timeB;
        });
    } catch (error) {
        console.error("Error getting sticky notes:", error);
        return [];
    }
};

export const getAllUserNotes = async (userId: string): Promise<UserPropertyComment[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, "users", userId, "property_comments")
        );
        const querySnapshot = await getDocs(q);
        const notes = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as UserPropertyComment));

        return notes.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA; // Descending for summary table
        });
    } catch (error) {
        console.error("Error getting all user notes:", error);
        return [];
    }
};
