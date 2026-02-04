
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, logFirestoreQuery, sanitizeForFirestore } from "./config";
import { StreetViewAnalysisResult } from "../../types";

export interface GoogleEnvironmentalData {
    zpid: string;
    solarData?: any;
    airQuality?: any;
    pollen?: any;
    streetViewAnalysis?: StreetViewAnalysisResult;
    lastUpdated?: any;
}

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
        return docSnap.exists() ? (docSnap.data() as GoogleEnvironmentalData) : null;
    } catch (error) {
        handleFirestoreError(error, "getGoogleDataFromCloud");
        return null;
    }
};
