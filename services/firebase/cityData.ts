import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";

/**
 * Interface for City to Zip Mapping Cache
 */
export interface CityZipMapping {
    city: string;
    state?: string;
    zipCodes: string[];
    timestamp?: any;
}

/**
 * Interface for Zip to Listings Cache
 */
export interface ZipListingsCache {
    zipCode: string;
    listings: any[];
    timestamp?: any;
}

/**
 * Saves a city to zip code mapping in Firestore
 */
export const saveCityZipMapping = async (city: string, state: string, zipCodes: string[]) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const docId = `${city.toLowerCase().replace(/\s+/g, '_')}_${state.toLowerCase()}`;
        const docRef = doc(db, "city_zip_mappings", docId);

        logFirestoreQuery('setDoc', 'city_zip_mappings', { docId });
        await setDoc(docRef, {
            city,
            state,
            zipCodes,
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "saveCityZipMapping") };
    }
};

/**
 * Retrieves a city to zip code mapping from Firestore
 */
export const getCityZipMapping = async (city: string, state: string): Promise<CityZipMapping | null> => {
    if (!db) return null;
    try {
        const docId = `${city.toLowerCase().replace(/\s+/g, '_')}_${state.toLowerCase()}`;
        const docRef = doc(db, "city_zip_mappings", docId);

        logFirestoreQuery('getDoc', 'city_zip_mappings', { docId });
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Optional: Add TTL check here (e.g. 7 days)
            return data as CityZipMapping;
        }
        return null;
    } catch (error: any) {
        handleFirestoreError(error, "getCityZipMapping");
        return null;
    }
};

/**
 * Saves listings for a specific zip code in Firestore
 */
export const saveZipListings = async (zipCode: string, listings: any[]) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const docRef = doc(db, "zip_listings_cache", zipCode);

        logFirestoreQuery('setDoc', 'zip_listings_cache', { zipCode });
        await setDoc(docRef, {
            zipCode,
            listings: sanitizeForFirestore(listings),
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "saveZipListings") };
    }
};

/**
 * Retrieves cached listings for a zip code from Firestore
 */
export const getZipListings = async (zipCode: string): Promise<ZipListingsCache | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "zip_listings_cache", zipCode);

        logFirestoreQuery('getDoc', 'zip_listings_cache', { zipCode });
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Optional: Add TTL check here (e.g. 24 hours)
            return data as ZipListingsCache;
        }
        return null;
    } catch (error: any) {
        handleFirestoreError(error, "getZipListings");
        return null;
    }
};
