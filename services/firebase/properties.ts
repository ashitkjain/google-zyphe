import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
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
    try {
        const docRef = doc(db, "properties", zpid);
        const sanitized = sanitizeForFirestore(data);
        logFirestoreQuery('setDoc', 'properties', { zpid });
        await setDoc(docRef, {
            ...sanitized,
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
    try {
        const docRef = doc(db, "property_analyses_visual", zpid);
        logFirestoreQuery('setDoc', 'property_analyses_visual', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(analysis),
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
    if (!db) return false;
    try {
        const docRef = doc(db, "property_analyses_comprehensive", zpid);
        logFirestoreQuery('setDoc', 'property_analyses_comprehensive', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(analysis),
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
    if (!db) {
        return { success: false, error: "Database not initialized" };
    }
    try {
        const user = auth?.currentUser;
        console.log(`[Firestore] Attempting save picture quality audit for ZPID: "${zpid}". Current Auth: ${user ? user.email : 'NOT_LOGGED_IN'}`);
        const docRef = doc(db, "image_quality_analysis", zpid);
        logFirestoreQuery('setDoc', 'image_quality_analysis', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(analysis),
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
    if (!db) return { success: false, error: "Database not initialized" };
    try {
        const user = auth?.currentUser;
        console.log(`[Firestore] Saving investment research for ZPID: "${zpid}". Auth: ${user ? user.email : 'GUEST'}`);
        const docRef = doc(db, "market_research", zpid);
        logFirestoreQuery('setDoc', 'market_research', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(research),
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
