import { doc, setDoc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import {
    db,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";

/**
 * Interface for Individual Zip Metadata
 * Key is the Zip Code itself.
 */
export interface ZipCodeMetadata {
    zipCode: string;
    city: string;
    state: string;
    city_str_normalized: string; // for case-insensitive querying
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
 * Saves a batch of zip code metadata to Firestore.
 * Key is the normalized City Name.
 * The document contains all zips for that city, grouped by state.
 */
export const saveZipMetadataBatch = async (data: { zip: string, city: string, state: string }[]) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const batch = writeBatch(db);

        // Group data by city (normalized)
        const cityGroups: Record<string, { city: string, zipsByState: Record<string, string[]> }> = {};

        data.forEach(item => {
            const cityNorm = item.city.toLowerCase().trim();
            if (!cityGroups[cityNorm]) {
                cityGroups[cityNorm] = {
                    city: item.city.trim(),
                    zipsByState: {}
                };
            }
            if (!cityGroups[cityNorm].zipsByState[item.state]) {
                cityGroups[cityNorm].zipsByState[item.state] = [];
            }
            if (!cityGroups[cityNorm].zipsByState[item.state].includes(item.zip)) {
                cityGroups[cityNorm].zipsByState[item.state].push(item.zip);
            }
        });

        // Commit grouped changes as merged documents
        for (const [cityNorm, info] of Object.entries(cityGroups)) {
            const docRef = doc(db, "city_zip_cache", cityNorm);
            batch.set(docRef, {
                city: info.city,
                zipsByState: info.zipsByState,
                timestamp: serverTimestamp()
            }, { merge: true });
        }

        logFirestoreQuery('writeBatch', 'city_zip_cache', { cities: Object.keys(cityGroups).length });
        await batch.commit();

        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "saveZipMetadataBatch") };
    }
};

/**
 * Retrieves all zip codes for a given city name.
 * Uses a direct document lookup by normalized city name.
 */
export const getZipsForCity = async (city: string): Promise<Record<string, string[]> | null> => {
    if (!db) return null;
    try {
        const cityNormalized = city.toLowerCase().trim();
        const docRef = doc(db, "city_zip_cache", cityNormalized);

        logFirestoreQuery('getDoc', 'city_zip_cache', { cityNormalized });
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) return null;

        const data = docSnap.data();
        return data.zipsByState || null;
    } catch (error: any) {
        handleFirestoreError(error, "getZipsForCity");
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

        // Optimization: Cache ID, Location, Price, and Description (needed for UI)
        const optimizedListings = listings.map(l => ({
            property_id: l.property_id,
            listing_id: l.listing_id,
            location: l.location,
            list_price: l.list_price,
            description: l.description
        }));

        logFirestoreQuery('setDoc', 'zip_listings_cache', { zipCode });
        await setDoc(docRef, {
            zipCode,
            listings: sanitizeForFirestore(optimizedListings),
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
            return data as ZipListingsCache;
        }
        return null;
    } catch (error: any) {
        handleFirestoreError(error, "getZipListings");
        return null;
    }
};
/**
 * Removes a specific property from a zip code's listing cache.
 */
export const removePropertyFromZipCache = async (zipCode: string, propertyId: string) => {
    if (!db || !zipCode || !propertyId) return { success: false };
    try {
        const docRef = doc(db, "zip_listings_cache", zipCode);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as ZipListingsCache;
            const updatedListings = (data.listings || []).filter(l =>
                String(l.property_id || l.listing_id || l.zpid) !== String(propertyId)
            );

            await setDoc(docRef, {
                ...data,
                listings: updatedListings,
                timestamp: serverTimestamp()
            });
            return { success: true };
        }
        return { success: false };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "removePropertyFromZipCache") };
    }
};
