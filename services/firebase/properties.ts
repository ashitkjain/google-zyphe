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
    InvestmentResearchResult,
    PropertySpecificInvestmentResult,
    GeneralMarketIntelligenceResult,
    PropertyAssets,
    CommunityPulseResult
} from "../../types";

export const savePropertyAssetsToCloud = async (zpid: string, assets: PropertyAssets) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        const docRef = doc(db, "property_assets", String(zpid));
        logFirestoreQuery('setDoc', 'property_assets', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(assets),
            zpid: String(zpid),
            lastVerified: serverTimestamp()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "savePropertyAssetsToCloud") as string };
    }
};

export const getPropertyAssetsFromCloud = async (zpid: string): Promise<PropertyAssets | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "property_assets", zpid);
        logFirestoreQuery('getDoc', 'property_assets', { zpid });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as PropertyAssets) : null;
    } catch (error) {
        handleFirestoreError(error, "getPropertyAssetsFromCloud");
        return null;
    }
};

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

        // Remove community_pulse and image_quality_analysis from the property doc 
        // to maintain single source of truth in their respective tables.
        const { community_pulse, image_quality_analysis, ...persistentData } = analysis;

        await setDoc(docRef, {
            ...sanitizeForFirestore(persistentData),
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

export const savePropertyInvestmentToCloud = async (zpid: string, research: PropertySpecificInvestmentResult) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        const docRef = doc(db, "property_investment_research", String(zpid));
        logFirestoreQuery('setDoc', 'property_investment_research', { zpid });
        await setDoc(docRef, {
            ...sanitizeForFirestore(research),
            zpid: String(zpid),
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "savePropertyInvestmentToCloud") as string };
    }
};

export const getPropertyInvestmentFromCloud = async (zpid: string): Promise<PropertySpecificInvestmentResult | null> => {
    if (!db) return null;
    try {
        const docRef = doc(db, "property_investment_research", zpid);
        logFirestoreQuery('getDoc', 'property_investment_research', { zpid });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as PropertySpecificInvestmentResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getPropertyInvestmentFromCloud");
        return null;
    }
};

export const saveGeneralMarketIntelligenceToCloud = async (cityStateKey: string, research: GeneralMarketIntelligenceResult) => {
    if (!db || !cityStateKey) return { success: false, error: "Database not initialized or missing City-State Key" };
    try {
        const docRef = doc(db, "general_market_intelligence", cityStateKey);
        logFirestoreQuery('setDoc', 'general_market_intelligence', { cityStateKey });
        await setDoc(docRef, research, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveGeneralMarketIntelligenceToCloud") as string };
    }
};

export const getGeneralMarketIntelligenceFromCloud = async (cityStateKey: string): Promise<GeneralMarketIntelligenceResult | null> => {
    if (!db || !cityStateKey) return null;
    try {
        const docRef = doc(db, "general_market_intelligence", cityStateKey);
        logFirestoreQuery('getDoc', 'general_market_intelligence', { cityStateKey });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as GeneralMarketIntelligenceResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getGeneralMarketIntelligenceFromCloud");
        return null;
    }
};

export const saveCommunityPulseToCloud = async (cityStateKey: string, pulse: CommunityPulseResult) => {
    if (!db || !cityStateKey) return { success: false, error: "Database not initialized or missing City-State Key" };
    try {
        const docRef = doc(db, "community_pulse", cityStateKey);
        logFirestoreQuery('setDoc', 'community_pulse', { cityStateKey });
        await setDoc(docRef, pulse, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveCommunityPulseToCloud") as string };
    }
};

export const getCommunityPulseFromCloud = async (cityStateKey: string): Promise<CommunityPulseResult | null> => {
    if (!db || !cityStateKey) return null;
    try {
        const docRef = doc(db, "community_pulse", cityStateKey);
        logFirestoreQuery('getDoc', 'community_pulse', { cityStateKey });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as CommunityPulseResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getCommunityPulseFromCloud");
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
        // Run lookups in parallel
        await Promise.all(chunks.map(async (chunk) => {
            // Check 1: Direct ID Match
            const qPrimary = query(
                collection(db, "properties"),
                where(documentId(), "in", chunk)
            );

            // Check 2: Alternate/Feed ID Match
            const qAlt = query(
                collection(db, "properties"),
                where("alternate_ids", "array-contains-any", chunk)
            );

            const [snapPrimary, snapAlt] = await Promise.all([
                getDocs(qPrimary),
                getDocs(qAlt)
            ]);

            // Combine findings
            const allDocs = [...snapPrimary.docs, ...snapAlt.docs];

            allDocs.forEach(doc => {
                const data = doc.data();

                // If the doc ID itself was requested, mark it found
                if (zpids.includes(doc.id)) existing.add(doc.id);

                // If any of its aliases were requested, mark them found
                // (e.g. requested '2056', doc is '2508' but alternate_ids has '2056')
                if (data.alternate_ids && Array.isArray(data.alternate_ids)) {
                    data.alternate_ids.forEach((alias: string) => {
                        if (chunk.includes(alias)) {
                            existing.add(alias);
                        }
                    });
                }
            });
        }));

    } catch (e) {
        console.warn("Failed to check existence for batch", e);
    }

    return existing;
};

export const deletePropertyAnalysis = async (zpid: string) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID", tables: [] };

    const collections = [
        "properties",
        "property_analyses_comprehensive",
        "property_analyses_visual",
        "image_quality_analysis",
        "property_assets",
        "property_investment_research"
    ];

    try {
        console.log(`[Firestore] Deleting all data for ZPID: "${zpid}"...`);

        // Use proper deleteDoc for clean removal
        const { deleteDoc } = await import("firebase/firestore");
        await Promise.all(collections.map(coll => {
            logFirestoreQuery('deleteDoc', coll, { zpid });
            return deleteDoc(doc(db, coll, String(zpid)));
        }));

        console.log(`[Firestore] SUCCESS: Fully removed ZPID "${zpid}" from cache.`);
        return { success: true, tables: collections };
    } catch (error) {
        return {
            success: false,
            error: handleFirestoreError(error, "deletePropertyAnalysis") as string,
            tables: collections
        };
    }
};
