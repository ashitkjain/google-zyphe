
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, logFirestoreQuery, sanitizeForFirestore } from "./config";
import { StreetViewAnalysisResult } from "../../types";
import type { HistoricalDisasterData } from "../api/disasters";

export interface GoogleEnvironmentalData {
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
export const normalizeEnvDoc = (data: Record<string, any>): GoogleEnvironmentalData => {
    if (data.neighborhoodPlaces && !data.google_places) {
        data.google_places = data.neighborhoodPlaces;
        delete data.neighborhoodPlaces;
    }
    return data as GoogleEnvironmentalData;
};

export const saveGoogleDataToCloud = async (zpid: string, data: Partial<GoogleEnvironmentalData>) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };

    try {
        const docRef = doc(db, "google_environmental_data", String(zpid));
        logFirestoreQuery('setDoc', 'google_environmental_data', { zpid });

        await setDoc(docRef, {
            ...sanitizeForFirestore(data),
            zpid: String(zpid),
            lastUpdated: serverTimestamp()
        }, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveGoogleDataToCloud") as string };
    }
};

export const getGoogleDataFromCloud = async (zpid: string): Promise<GoogleEnvironmentalData | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "google_environmental_data", zpid);
        logFirestoreQuery('getDoc', 'google_environmental_data', { zpid });
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return normalizeEnvDoc(docSnap.data() as Record<string, any>);
    } catch (error) {
        handleFirestoreError(error, "getGoogleDataFromCloud");
        return null;
    }
};
