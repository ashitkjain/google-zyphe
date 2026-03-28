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

        // Group data by city-state key
        const cityGroups: Record<string, { city: string, state: string, zipsByState: Record<string, string[]> }> = {};

        data.forEach(item => {
            const cityNorm = item.city.toLowerCase().trim().replace(/\s+/g, '_');
            const stateNorm = item.state.toLowerCase().trim();
            const cityStateKey = `${cityNorm}_${stateNorm}`;
            
            if (!cityGroups[cityStateKey]) {
                cityGroups[cityStateKey] = {
                    city: item.city.trim(),
                    state: item.state,
                    zipsByState: {}
                };
            }
            if (!cityGroups[cityStateKey].zipsByState[item.state]) {
                cityGroups[cityStateKey].zipsByState[item.state] = [];
            }
            if (!cityGroups[cityStateKey].zipsByState[item.state].includes(item.zip)) {
                cityGroups[cityStateKey].zipsByState[item.state].push(item.zip);
            }
        });

        // Commit grouped changes
        for (const [key, info] of Object.entries(cityGroups)) {
            const payload = {
                city: info.city,
                state: info.state,
                zipsByState: info.zipsByState,
                timestamp: serverTimestamp()
            };

            // 1. Consolidated write (ONLY)
            const cityRef = doc(db, "cities", key, "index", "zips");
            batch.set(cityRef, payload, { merge: true });
        }

        logFirestoreQuery('writeBatch', 'cities/index', { cities: Object.keys(cityGroups).length });
        await batch.commit();

        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "saveZipMetadataBatch") };
    }
};

export const getZipsForCity = async (city: string, state: string): Promise<Record<string, string[]> | null> => {
    if (!db) return null;
    try {
        const cityNorm = city.toLowerCase().trim().replace(/\s+/g, '_');
        const stateNorm = state.toLowerCase().trim();
        const key = `${cityNorm}_${stateNorm}`;
        
        // 1. Consolidated path lookup (ONLY)
        const cityRef = doc(db, "cities", key, "index", "zips");
        logFirestoreQuery('getDoc', 'cities/index', { key });
        const citySnap = await getDoc(cityRef);
        
        if (citySnap.exists()) return citySnap.data().zipsByState || null;
        return null;
    } catch (error: any) {
        handleFirestoreError(error, "getZipsForCity");
        return null;
    }
};

/**
 * Saves listings for a specific zip code in Firestore
 */
/**
 * Saves listings for a specific zip code in Firestore
 */
export const saveZipListings = async (zipCode: string, listings: any[], cityStateKey?: string) => {
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const validListings = listings.filter(item => item.zpid);
        const payload = {
            zipCode,
            listings: sanitizeForFirestore(validListings),
            timestamp: serverTimestamp()
        };

        // 1. Legacy write
        const docRef = doc(db, "zip_listings_cache", zipCode);
        logFirestoreQuery('setDoc', 'zip_listings_cache', { zipCode });
        await setDoc(docRef, payload);

        // 2. Consolidated write
        // Attempt to resolve cityStateKey from listings if missing
        let csk = cityStateKey;
        if (!csk && validListings.length > 0) {
            const first = validListings[0];
            const city = (first.location?.address?.city || first.city || '').toLowerCase().trim().replace(/\s+/g, '_');
            const state = (first.location?.address?.state_code || first.state || '').toLowerCase().trim();
            if (city && state) csk = `${city}_${state}`;
        }

        if (csk) {
            const zipRef = doc(db, "cities", csk.toLowerCase(), "zips", zipCode, "active", "listings");
            logFirestoreQuery('setDoc', 'cities/zips/active', { zipCode, cityStateKey: csk });
            await setDoc(zipRef, payload);
        }

        return { success: true, filtered: listings.length - validListings.length };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "saveZipListings") };
    }
};

/**
 * Retrieves cached listings for a zip code from Firestore
 */
export const getZipListings = async (zipCode: string, cityStateKey?: string): Promise<ZipListingsCache | null> => {
    if (!db) return null;
    try {
        // 1. Try consolidated path first if context provided
        if (cityStateKey) {
            const zipRef = doc(db, "cities", cityStateKey.toLowerCase(), "zips", zipCode, "active", "listings");
            logFirestoreQuery('getDoc', 'cities/zips/active', { zipCode, cityStateKey });
            const snap = await getDoc(zipRef);
            if (snap.exists()) return snap.data() as ZipListingsCache;
        }

        // 2. Fallback to legacy path
        const docRef = doc(db, "zip_listings_cache", zipCode);
        logFirestoreQuery('getDoc', 'zip_listings_cache', { zipCode });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() as ZipListingsCache : null;
    } catch (error: any) {
        handleFirestoreError(error, "getZipListings");
        return null;
    }
};
/**
 * Removes a specific property from a zip code's listing cache.
 */
/**
 * Removes a specific property from a zip code's listing cache.
 */
export const removePropertyFromZipCache = async (zipCode: string, propertyId: string, cityStateKey?: string) => {
    if (!db || !zipCode || !propertyId) return { success: false };
    try {
        const cache = await getZipListings(zipCode, cityStateKey);
        if (cache) {
            const updatedListings = (cache.listings || []).filter(l => String(l.zpid) !== String(propertyId));
            await saveZipListings(zipCode, updatedListings, cityStateKey);
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
/**
 * Saves recently-sold listings for a zip code.
 */
export const saveZipSoldListings = async (zipCode: string, listings: any[], cityStateKey?: string) => {
    if (!db) return { success: false, error: 'Database not initialized' };
    try {
        const validListings = listings.filter(item => item.zpid);
        const payload = {
            zipCode,
            listings: sanitizeForFirestore(validListings),
            fetchedAt: serverTimestamp(),
        };

        // 1. Legacy write
        const docRef = doc(db, 'zip_sold_listings_cache', zipCode);
        logFirestoreQuery('setDoc', 'zip_sold_listings_cache', { zipCode });
        await setDoc(docRef, payload);

        // 2. Consolidated write
        let csk = cityStateKey;
        if (!csk && validListings.length > 0) {
            const first = validListings[0];
            const city = (first.location?.address?.city || first.city || '').toLowerCase().trim().replace(/\s+/g, '_');
            const state = (first.location?.address?.state_code || first.state || '').toLowerCase().trim();
            if (city && state) csk = `${city}_${state}`;
        }

        if (csk) {
            const zipRef = doc(db, "cities", csk.toLowerCase(), "zips", zipCode, "sold", "listings");
            logFirestoreQuery('setDoc', 'cities/zips/sold', { zipCode, cityStateKey: csk });
            await setDoc(zipRef, payload);
        }

        return { success: true, filtered: listings.length - validListings.length };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, 'saveZipSoldListings') };
    }
};

/**
 * Retrieves cached recently-sold listings for a zip code.
 */
export const getZipSoldListings = async (zipCode: string, cityStateKey?: string): Promise<{ zipCode: string; listings: any[]; fetchedAt?: any } | null> => {
    if (!db) return null;
    try {
        // 1. Try consolidated path
        if (cityStateKey) {
            const zipRef = doc(db, "cities", cityStateKey.toLowerCase(), "zips", zipCode, "sold", "listings");
            logFirestoreQuery('getDoc', 'cities/zips/sold', { zipCode, cityStateKey });
            const snap = await getDoc(zipRef);
            if (snap.exists()) return snap.data() as any;
        }

        // 2. Legacy fallback
        const docRef = doc(db, 'zip_sold_listings_cache', zipCode);
        logFirestoreQuery('getDoc', 'zip_sold_listings_cache', { zipCode });
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() as any : null;
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
