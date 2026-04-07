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

        // Group by city-state key
        const cityGroups: Record<string, { city: string; state: string; zips: string[] }> = {};
        data.forEach(item => {
            const cityNorm = item.city.toLowerCase().trim().replace(/\s+/g, '_');
            const stateNorm = item.state.toLowerCase().trim();
            const key = `${cityNorm}_${stateNorm}`;
            if (!cityGroups[key]) cityGroups[key] = { city: item.city.trim(), state: item.state, zips: [] };
            if (!cityGroups[key].zips.includes(item.zip)) cityGroups[key].zips.push(item.zip);
        });

        for (const [key, info] of Object.entries(cityGroups)) {
            // Write one doc per zip code under cities/{key}/zips/{zipCode}
            for (const zip of info.zips) {
                const zipRef = doc(db, 'cities', key, 'zips', zip);
                batch.set(zipRef, {
                    zipCode: zip,
                    city: info.city,
                    state: info.state,
                    timestamp: serverTimestamp()
                }, { merge: true });
            }
            // Keep the parent city doc up to date
            const cityRef = doc(db, 'cities', key);
            batch.set(cityRef, { city: info.city, state: info.state, lastUpdated: serverTimestamp() }, { merge: true });
        }

        logFirestoreQuery('writeBatch', 'cities/zips', { cities: Object.keys(cityGroups).length });
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "saveZipMetadataBatch") };
    }
};

export const getZipsForCity = async (city: string, state?: string): Promise<Record<string, string[]> | null> => {
    if (!db) return null;
    try {
        const cityNorm = city.toLowerCase().trim().replace(/\s+/g, '_');

        const tryKey = async (key: string): Promise<Record<string, string[]> | null> => {
            const snap = await getDocs(collection(db!, 'cities', key, 'zips'));
            if (snap.empty) return null;
            // Group zip codes by state
            const byState: Record<string, string[]> = {};
            snap.docs.forEach(d => {
                const st: string = d.data().state || state || '';
                if (!byState[st]) byState[st] = [];
                byState[st].push(d.id);
            });
            return Object.keys(byState).length > 0 ? byState : null;
        };

        if (state) {
            const key = `${cityNorm}_${state.toLowerCase().trim()}`;
            logFirestoreQuery('getDocs', 'cities/zips', { key });
            return await tryKey(key);
        }

        // State not provided — try each supported state
        const { SUPPORTED_STATES } = await import("../../config");
        for (const st of SUPPORTED_STATES) {
            const key = `${cityNorm}_${st.toLowerCase()}`;
            logFirestoreQuery('getDocs', 'cities/zips', { key });
            const result = await tryKey(key);
            if (result) return result;
        }

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
 * Returns all city names from the cities collection that have a known state,
 * filtered to supportedStates, sorted alphabetically.
 */
export const getCachedCities = async (supportedStates: string[]): Promise<string[]> => {
    if (!db) return [];
    try {
        logFirestoreQuery('getDocs', 'cities', { supportedStates });
        const snap = await getDocs(collection(db, 'cities'));
        const supportedNorm = new Set(supportedStates.map(s => s.toLowerCase()));
        const cities: string[] = [];

        snap.docs.forEach(d => {
            const data = d.data();
            // Only include cities whose key ends with a supported state code
            const parts = d.id.split('_');
            const stateCode = parts[parts.length - 1]?.toLowerCase();
            if (!stateCode || !supportedNorm.has(stateCode)) return;

            const cityName = data.city
                || parts.slice(0, -1).join(' ').replace(/\b\w/g, l => l.toUpperCase());
            const stateUpper = stateCode.toUpperCase();
            cities.push(`${cityName}, ${stateUpper}`);
        });

        return cities.sort((a, b) => a.localeCompare(b));
    } catch (error: any) {
        handleFirestoreError(error, 'getCachedCities');
        return [];
    }
};
