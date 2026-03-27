/**
 * IDX Lead Capture & Saved Searches — Firebase service
 * Stores tour requests, info requests, and saved searches
 * under /realtors/{rid}/idx_leads and /realtors/{rid}/saved_searches
 */

import {
    collection, addDoc, getDocs, deleteDoc, doc,
    serverTimestamp, query, where, orderBy, limit
} from 'firebase/firestore';
import { db, sanitizeForFirestore, handleFirestoreError, logFirestoreQuery } from './config';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IDXLeadRequest {
    id?: string;
    type: 'tour' | 'info';
    name: string;
    email: string;
    phone?: string;
    message?: string;
    /** Property this request is about */
    propertyAddress: string;
    propertyZpid?: string;
    propertyPrice?: number;
    /** City being browsed */
    city?: string;
    /** ISO timestamp */
    createdAt?: any;
    source: 'idx_map' | 'idx_gallery' | 'property_detail';
    /** Tour-specific */
    preferredDate?: string;
    preferredTime?: string;
}

export interface SavedSearch {
    id?: string;
    name: string;
    city: string;
    filters: {
        minPrice?: string;
        maxPrice?: string;
        beds?: string;
        baths?: string;
        homeType?: string;
        stories?: string;
        minSchoolRating?: string;
        neighborhood?: string;
        minSqft?: string;
        maxSqft?: string;
        minYear?: string;
        maxYear?: string;
        garage?: string;
        maxHoa?: string;
        maxDom?: string;
    };
    alertFrequency: 'instant' | 'daily' | 'weekly' | 'none';
    notifyEmail?: string;
    createdAt?: any;
    lastRunAt?: any;
    resultCount?: number;
}

// ── Lead Capture ───────────────────────────────────────────────────────────────

/**
 * Save an IDX lead request (tour or info) under the realtor's collection.
 * The realtorId comes from the branded domain / URL context.
 */
export const saveIDXLeadRequest = async (
    realtorId: string,
    request: Omit<IDXLeadRequest, 'id' | 'createdAt'>
): Promise<{ success: boolean; leadId?: string; error?: string }> => {
    if (!db) return { success: false, error: 'DB not initialized' };
    try {
        const col = collection(db, 'realtors', realtorId, 'idx_leads');
        logFirestoreQuery('addDoc', 'idx_leads', { type: request.type, city: request.city });
        const docRef = await addDoc(col, sanitizeForFirestore({
            ...request,
            createdAt: serverTimestamp(),
            status: 'New',
            followedUp: false,
        }));
        return { success: true, leadId: docRef.id };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, 'saveIDXLeadRequest') as string };
    }
};

// ── Saved Searches ─────────────────────────────────────────────────────────────

/**
 * Save a search for a user/anonymous session under a realtor.
 * Stored at: /realtors/{rid}/saved_searches/{id}
 */
export const saveSearch = async (
    realtorId: string,
    search: Omit<SavedSearch, 'id' | 'createdAt'>
): Promise<{ success: boolean; searchId?: string; error?: string }> => {
    if (!db) return { success: false, error: 'DB not initialized' };
    try {
        const col = collection(db, 'realtors', realtorId, 'saved_searches');
        logFirestoreQuery('addDoc', 'saved_searches', { city: search.city, name: search.name });
        const docRef = await addDoc(col, sanitizeForFirestore({
            ...search,
            createdAt: serverTimestamp(),
            lastRunAt: serverTimestamp(),
        }));
        return { success: true, searchId: docRef.id };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, 'saveSearch') as string };
    }
};

export const getSavedSearches = async (realtorId: string): Promise<SavedSearch[]> => {
    if (!db) return [];
    try {
        const col = collection(db, 'realtors', realtorId, 'saved_searches');
        logFirestoreQuery('getDocs', 'saved_searches', { realtorId });
        const snap = await getDocs(query(col, orderBy('createdAt', 'desc'), limit(50)));
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedSearch));
    } catch (error) {
        handleFirestoreError(error, 'getSavedSearches');
        return [];
    }
};

export const deleteSavedSearch = async (realtorId: string, searchId: string): Promise<boolean> => {
    if (!db) return false;
    try {
        const docRef = doc(db, 'realtors', realtorId, 'saved_searches', searchId);
        logFirestoreQuery('deleteDoc', 'saved_searches', { searchId });
        await deleteDoc(docRef);
        return true;
    } catch (error) {
        handleFirestoreError(error, 'deleteSavedSearch');
        return false;
    }
};
