import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, logFirestoreQuery, sanitizeForFirestore } from "./config";
import { StreetViewAnalysisResult } from "../../types";
import type { HistoricalDisasterData } from "../api/disasters";

export interface ThirdPartyData {
    zpid: string;
    solarData?: any;
    airQuality?: any;
    pollen?: any;
    streetViewAnalysis?: StreetViewAnalysisResult;
    noiseScore?: number | null;
    noiseScoreDesc?: string | null;
    noiseTrafficScore?: number | null;
    noiseTrafficDesc?: string | null;
    noiseLocalScore?: number | null;
    noiseLocalDesc?: string | null;
    noiseAirportScore?: number | null;
    noiseAirportDesc?: string | null;
    /** ISO timestamp of the last HowLoud API attempt. Set even when score is null so we don't re-call on every run. */
    noiseFetchedAt?: string | null;
    /** Google Places Nearby Search results. 30-day TTL — set when data is first fetched. */
    google_places?: any;
    /** Historical disaster data (USGS + FEMA). 365-day TTL. */
    historical_disasters?: HistoricalDisasterData | null;
    /** NREL nearby EV charging station data. 60-day TTL. */
    evChargers?: import('../api/environmental').EVChargerData | null;
    /** US Drought Monitor data. 7-day TTL. */
    drought?: any;
    /** FCC Broadband data. 90-day TTL. */
    broadband?: any;
    lastUpdated?: any;
}

/**
 * One-time field migration for env docs written before the rename.
 * Apply on read until all docs have been re-written. Then delete this function.
 */
export const normalizeEnvDoc = (data: Record<string, any>): ThirdPartyData => {
    if (data.neighborhoodPlaces && !data.google_places) {
        data.google_places = data.neighborhoodPlaces;
        delete data.neighborhoodPlaces;
    }
    return data as ThirdPartyData;
};

export const saveThirdPartyDataToCloud = async (zpid: string, data: Partial<ThirdPartyData>) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };

    try {
        const payload = {
            ...sanitizeForFirestore(data),
            zpid: String(zpid),
            lastUpdated: serverTimestamp()
        };

        // 1. Nested write (ONLY)
        const nestedRef = doc(db, "properties", String(zpid), "environmental", "thirdparty_data");
        logFirestoreQuery('setDoc', 'properties/environmental', { zpid, type: 'thirdparty' });
        await setDoc(nestedRef, payload, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveThirdPartyDataToCloud") as string };
    }
};

export const getThirdPartyDataFromCloud = async (zpid: string): Promise<ThirdPartyData | null> => {
    if (!db) return null;
    try {
        // 1. Try new path first
        const nestedRef = doc(db, "properties", zpid, "environmental", "thirdparty_data");
        logFirestoreQuery('getDoc', 'properties/environmental', { zpid, type: 'thirdparty' });
        const nestedSnap = await getDoc(nestedRef);
        
        if (nestedSnap.exists()) return normalizeEnvDoc(nestedSnap.data() as Record<string, any>);
        
        // 2. Fallback to legacy path for backward compatibility
        const legacyRef = doc(db, "properties", zpid, "environmental", "google_data");
        logFirestoreQuery('getDoc', 'properties/environmental', { zpid, type: 'legacy_google' });
        const legacySnap = await getDoc(legacyRef);
        
        if (legacySnap.exists()) return normalizeEnvDoc(legacySnap.data() as Record<string, any>);
        
        return null;
    } catch (error) {
        handleFirestoreError(error, "getThirdPartyDataFromCloud");
        return null;
    }
};

/** @deprecated Use getThirdPartyDataFromCloud — renamed for consistency */
export const getGoogleDataFromCloud = getThirdPartyDataFromCloud;
