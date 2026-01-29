import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, documentId, getDocs } from "firebase/firestore";
import {
    db,
    auth,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError
} from "./config";
import {
    PropertyData,
    CustomAIAnalysisResult,
    ComprehensiveAnalysisResult,
    ImageQualityAnalysisResult,
    InvestmentResearchResult
} from "../../types";

export const savePropertyToCloud = async (zpid: string, data: Partial<PropertyData>) => {
    if (!db) return { success: false, error: "Database not initialized" };
    if (!zpid) {
        console.error("[Firestore] Blocked savePropertyToCloud call with missing ZPID");
        return { success: false, error: "Missing ZPID" };
    }

    try {
        const docRef = doc(db, "properties", String(zpid));
        const sanitized = sanitizeForFirestore(data);
        logFirestoreQuery('setDoc', 'properties', { zpid });

        await setDoc(docRef, {
            ...sanitized,
            zpid: String(zpid), // Ensure zpid is internally set
            lastUpdated: serverTimestamp()
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, "savePropertyToCloud") };
    }
};

export const getPropertyFromCloud = async (zpid: string): Promise<PropertyData | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "properties", zpid);
        logFirestoreQuery('getDoc', 'properties', { zpid });
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as PropertyData;
        }
        return null;
    } catch (error: any) {
        handleFirestoreError(error, "getPropertyFromCloud");
        return null;
    }
};

export const saveVisualAnalysisToCloud = async (zpid: string, analysis: CustomAIAnalysisResult) => {
    if (!db) return { success: false, error: "Database not initialized" };
    if (!zpid) return { success: false, error: "Missing ZPID" };

    try {
        const docRef = doc(db, "property_analyses_visual", String(zpid));
        logFirestoreQuery('setDoc', 'property_analyses_visual', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(analysis),
            zpid: String(zpid), // Explicitly include zpid as key field
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveVisualAnalysisToCloud") };
    }
};

export const getVisualAnalysisFromCloud = async (zpid: string): Promise<CustomAIAnalysisResult | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "property_analyses_visual", zpid);
        logFirestoreQuery('getDoc', 'property_analyses_visual', { zpid });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as CustomAIAnalysisResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getVisualAnalysisFromCloud");
        return null;
    }
};

export const saveComprehensiveAnalysisToCloud = async (zpid: string, analysis: ComprehensiveAnalysisResult) => {
    if (!db || !zpid) return false;
    try {
        const docRef = doc(db, "property_analyses_comprehensive", String(zpid));
        logFirestoreQuery('setDoc', 'property_analyses_comprehensive', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(analysis),
            zpid: String(zpid), // Explicitly include zpid as key field
            timestamp: serverTimestamp()
        });
        return true;
    } catch (error) {
        return handleFirestoreError(error, "saveComprehensiveAnalysisToCloud");
    }
};

export const getComprehensiveAnalysisFromCloud = async (zpid: string): Promise<ComprehensiveAnalysisResult | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "property_analyses_comprehensive", zpid);
        logFirestoreQuery('getDoc', 'property_analyses_comprehensive', { zpid });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as ComprehensiveAnalysisResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getComprehensiveAnalysisFromCloud");
        return null;
    }
};

export const saveImageQualityAnalysisToCloud = async (zpid: string, analysis: ImageQualityAnalysisResult) => {
    if (!db || !zpid) {
        return { success: false, error: "Database not initialized or missing ZPID" };
    }
    try {
        const user = auth?.currentUser;
        console.log(`[Firestore] Attempting save picture quality audit for ZPID: "${zpid}". Current Auth: ${user ? user.email : 'NOT_LOGGED_IN'}`);
        const docRef = doc(db, "image_quality_analysis", String(zpid));
        logFirestoreQuery('setDoc', 'image_quality_analysis', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(analysis),
            zpid: String(zpid),
            timestamp: serverTimestamp()
        });
        console.log(`[Firestore] SUCCESS: picture quality audit saved for ZPID: "${zpid}"`);
        return { success: true };
    } catch (error) {
        console.error(`[Firestore] FAILED to save audit for ${zpid}:`, error);
        return { success: false, error: handleFirestoreError(error, "saveImageQualityAnalysisToCloud") as string };
    }
};

export const getImageQualityAnalysisFromCloud = async (zpid: string): Promise<ImageQualityAnalysisResult | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "image_quality_analysis", zpid);
        logFirestoreQuery('getDoc', 'image_quality_analysis', { zpid });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as ImageQualityAnalysisResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getImageQualityAnalysisFromCloud");
        return null;
    }
};

export const saveInvestmentResearchToCloud = async (zpid: string, research: InvestmentResearchResult) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        const user = auth?.currentUser;
        console.log(`[Firestore] Saving investment research for ZPID: "${zpid}". Auth: ${user ? user.email : 'GUEST'}`);
        const docRef = doc(db, "market_research", String(zpid));
        logFirestoreQuery('setDoc', 'market_research', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(research),
            zpid: String(zpid),
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveInvestmentResearchToCloud") as string };
    }
};

export const getInvestmentResearchFromCloud = async (zpid: string): Promise<InvestmentResearchResult | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "market_research", zpid);
        logFirestoreQuery('getDoc', 'market_research', { zpid });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as InvestmentResearchResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getInvestmentResearchFromCloud");
        return null;
    }
};

export const verifyFirestoreConnection = async () => {
    if (!db) return { success: false, message: "Database not initialized" };
    const user = auth?.currentUser;
    const authStatus = user ? `LOGGED_IN (${user.email})` : "NOT_LOGGED_IN";

    console.log(`[Firestore] Connection check. Auth Status: ${authStatus}`);

    try {
        const testRef = doc(db, "system_test", "connectivity");
        logFirestoreQuery('setDoc', 'system_test', { id: 'connectivity' });
        await setDoc(testRef, {
            lastTest: serverTimestamp(),
            status: "online",
            authStatus
        });
        return { success: true, message: `Firestore verified. Status: ${authStatus}. Collection 'system_test' updated.` };
    } catch (error: any) {
        return { success: false, message: `${error.message}. Auth was: ${authStatus}` };
    }
};

export const checkExistingPropertiesBatch = async (zpids: string[]): Promise<Set<string>> => {
    if (!db || zpids.length === 0) return new Set();
    const existing = new Set<string>();

    const chunkSize = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < zpids.length; i += chunkSize) {
        chunks.push(zpids.slice(i, i + chunkSize));
    }

    try {
        // Run all chunk lookups in parallel for maximum speed
        const results = await Promise.all(chunks.map(async (chunk) => {
            const q = query(
                collection(db, "properties"),
                where(documentId(), "in", chunk)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.id);
        }));

        results.flat().forEach(id => existing.add(id));
    } catch (e) {
        console.warn("Failed to check existence for batch", e);
    }

    return existing;
};
