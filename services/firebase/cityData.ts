import { doc, setDoc, getDoc, getDocs, collection, writeBatch, serverTimestamp } from "firebase/firestore";
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
        // Filter out properties without a zpid
        const validListings = listings.filter(item => item.zpid);

        const docRef = doc(db, "zip_listings_cache", zipCode);

        logFirestoreQuery('setDoc', 'zip_listings_cache', { zipCode, total: listings.length, valid: validListings.length });
        await setDoc(docRef, {
            zipCode,
            listings: sanitizeForFirestore(validListings),
            timestamp: serverTimestamp()
        });
        return { success: true, filtered: listings.length - validListings.length };
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
                String(l.zpid) !== String(propertyId)
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

// ─── Sold / Recently-Sold Listings Cache ──────────────────────────────────────

/**
 * Saves recently-sold listings for a zip code to `zip_sold_listings_cache`.
 * Stores the full raw listing objects so the ingestion pipeline can use all fields.
 */
export const saveZipSoldListings = async (zipCode: string, listings: any[]) => {
    if (!db) return { success: false, error: 'Database not initialized' };
    try {
        // Filter out properties without a zpid
        const validListings = listings.filter(item => item.zpid);

        const docRef = doc(db, 'zip_sold_listings_cache', zipCode);
        logFirestoreQuery('setDoc', 'zip_sold_listings_cache', { zipCode, total: listings.length, valid: validListings.length });
        await setDoc(docRef, {
            zipCode,
            listings: sanitizeForFirestore(validListings),
            fetchedAt: serverTimestamp(),
        });
        return { success: true, filtered: listings.length - validListings.length };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, 'saveZipSoldListings') };
    }
};

/**
 * Retrieves cached recently-sold listings for a zip code.
 */
export const getZipSoldListings = async (zipCode: string): Promise<{ zipCode: string; listings: any[]; fetchedAt?: any } | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, 'zip_sold_listings_cache', zipCode);
        logFirestoreQuery('getDoc', 'zip_sold_listings_cache', { zipCode });
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return snap.data() as any;
    } catch (error: any) {
        handleFirestoreError(error, 'getZipSoldListings');
        return null;
    }
};

/**
 * Returns all city names from city_zip_cache that have at least one zip
 * in any of the provided supportedStates, sorted alphabetically.
 * Uses case-insensitive state key comparison and also accepts full state names.
 * Falls back to returning ALL cached cities if no supported-state match is found.
 */
export const getCachedCities = async (supportedStates: string[]): Promise<string[]> => {
    if (!db) return [];
    try {
        const snap = await getDocs(collection(db, 'city_zip_cache'));
        const allCities: string[] = [];
        const matchedCities: string[] = [];

        // Build a set of lowercase abbreviations AND common full-name variants
        const STATE_NAME_MAP: Record<string, string> = {
            ca: 'CA', california: 'CA', tx: 'TX', texas: 'TX',
            az: 'AZ', arizona: 'AZ', nv: 'NV', nevada: 'NV',
            or: 'OR', oregon: 'OR', wa: 'WA', washington: 'WA',
            co: 'CO', colorado: 'CO', ut: 'UT', utah: 'UT',
        };
        const supportedNorm = new Set(supportedStates.map(s => s.toLowerCase()));

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const cityName: string = data.city || docSnap.id;
            const zipsByState: Record<string, string[]> = data.zipsByState || {};
            allCities.push(cityName);

            // Check each key in zipsByState against the supported states (case-insensitive + full name)
            const matches = Object.keys(zipsByState).some(key => {
                const keyLower = key.toLowerCase();
                const normalized = STATE_NAME_MAP[keyLower] || key.toUpperCase();
                return (
                    supportedNorm.has(keyLower) ||
                    supportedStates.includes(normalized)
                ) && Array.isArray(zipsByState[key]) && zipsByState[key].length > 0;
            });
            if (matches) matchedCities.push(cityName);
        });

        return matchedCities.sort((a, b) => a.localeCompare(b));

    } catch (error: any) {
        handleFirestoreError(error, 'getCachedCities');
        return [];
    }
};
