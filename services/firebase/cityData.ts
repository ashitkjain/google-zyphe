import { doc, setDoc, getDocs, getDoc, collection, query, where, writeBatch, serverTimestamp } from "firebase/firestore";
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
 * This effectively caches the "City -> Zip" breakup by storing each Zip as an individual node.
 */
export const saveZipMetadataBatch = async (data: { zip: string, city: string, state: string }[]) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const batch = writeBatch(db);

        data.forEach(item => {
            const docRef = doc(db, "city_zip_cache", item.zip);
            batch.set(docRef, {
                zipCode: item.zip,
                city: item.city,
                state: item.state,
                city_str_normalized: item.city.toLowerCase().trim(),
                timestamp: serverTimestamp()
            }, { merge: true }); // Merge to update timestamp or add missing fields if exists
        });

        logFirestoreQuery('writeBatch', 'city_zip_cache', { count: data.length });
        await batch.commit();

        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "saveZipMetadataBatch") };
    }
};

/**
 * Retrieves all zip codes for a given city name.
 * Returns them grouped by State for easier UI handling.
 */
export const getZipsForCity = async (city: string): Promise<Record<string, string[]> | null> => {
    if (!db) return null;
    try {
        const cityNormalized = city.toLowerCase().trim();
        const q = query(
            collection(db, "city_zip_cache"),
            where("city_str_normalized", "==", cityNormalized)
        );

        logFirestoreQuery('getDocs', 'city_zip_cache', { cityNormalized });
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) return null;

        const results: Record<string, string[]> = {};

        querySnapshot.forEach(doc => {
            const data = doc.data() as ZipCodeMetadata;
            const state = data.state || 'Unknown';
            if (!results[state]) results[state] = [];
            results[state].push(data.zipCode);
        });

        return results;
    } catch (error: any) {
        handleFirestoreError(error, "getZipsForCity");
        return null; // Return null on error to trigger fallback to API
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
