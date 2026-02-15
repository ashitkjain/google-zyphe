import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, documentId, getDocs, getCountFromServer, limit } from "firebase/firestore";
import {
    db,
    auth,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError,
    generateCityStateKey
} from "./config";
import {
    PropertyData,
    CustomAIAnalysisResult,
    ComprehensiveAnalysisResult,
    ImageQualityAnalysisResult,
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

        // SAFETY: Ensure shared/regional data is NOT duplicated into the property-specific record
        const cleanAnalysis = { ...analysis };
        delete cleanAnalysis.community_pulse;
        delete cleanAnalysis.property_investment;
        delete cleanAnalysis.general_market_intelligence;

        await setDoc(docRef, {
            ...sanitizeForFirestore(cleanAnalysis),
            zpid: String(zpid),
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
        await setDoc(docRef, {
            ...research,
            status: 'completed',
            lastUpdated: serverTimestamp()
        }, { merge: true });
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
        await setDoc(docRef, {
            ...pulse,
            status: 'completed',
            lastUpdated: serverTimestamp()
        }, { merge: true });
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

export const setCityResearchFlag = async (cityStateKey: string, status: 'running' | 'completed' | 'failed', error?: string) => {
    if (!db || !cityStateKey) return { success: false };
    try {
        const pulseRef = doc(db, "community_pulse", cityStateKey);
        const marketRef = doc(db, "general_market_intelligence", cityStateKey);

        const updateData = {
            status,
            lastRan: serverTimestamp(),
            error: error || null
        };

        logFirestoreQuery('setDoc', 'community_pulse/market_intel', { cityStateKey, status });

        await Promise.all([
            setDoc(pulseRef, updateData, { merge: true }),
            setDoc(marketRef, updateData, { merge: true })
        ]);

        return { success: true };
    } catch (err: any) {
        return { success: false, error: handleFirestoreError(err, "setCityResearchFlag") };
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

export interface PropertyStatusDetails {
    property?: { timestamp: any };
    assets?: {
        images: boolean;
        map: boolean;
        streetView: boolean;
        timestamp: any;
        thumbnailUrl?: string;
    };
    visual?: { timestamp: any };
}

export const getPropertyStatusesBatch = async (requestedIds: string[]): Promise<Record<string, PropertyStatusDetails>> => {
    if (!db || requestedIds.length === 0) return {};
    const statuses: Record<string, PropertyStatusDetails> = {};
    const idMap: Record<string, string> = {}; // requestedId -> canonicalZpid
    const canonicalZpids = new Set<string>();

    const chunkSize = 10;
    const requestedChunks: string[][] = [];
    for (let i = 0; i < requestedIds.length; i += chunkSize) {
        requestedChunks.push(requestedIds.slice(i, i + chunkSize));
    }

    try {
        // Step 1: Resolve canonical ZPIDs for all requested IDs
        await Promise.all(requestedChunks.map(async (chunk) => {
            const [snapPrimary, snapAlt] = await Promise.all([
                getDocs(query(collection(db, "properties"), where(documentId(), "in", chunk))),
                getDocs(query(collection(db, "properties"), where("alternate_ids", "array-contains-any", chunk)))
            ]);

            const processDocs = (docs: any[]) => {
                docs.forEach(doc => {
                    const data = doc.data();
                    const zpid = String(doc.id);
                    canonicalZpids.add(zpid);

                    // Map requested IDs to this canonical ZPID
                    if (chunk.includes(zpid)) {
                        idMap[zpid] = zpid;
                    }
                    if (data.alternate_ids && Array.isArray(data.alternate_ids)) {
                        data.alternate_ids.forEach((alias: string) => {
                            if (chunk.includes(alias)) {
                                idMap[alias] = zpid;
                            }
                        });
                    }
                    // Also check feed_property_id if present
                    if (data.feed_property_id && chunk.includes(data.feed_property_id)) {
                        idMap[data.feed_property_id] = zpid;
                    }
                });
            };

            processDocs(snapPrimary.docs);
            processDocs(snapAlt.docs);
        }));

        // If no properties found at all, we can't have assets/visual
        if (canonicalZpids.size === 0) {
            // But we should still return empty statuses for requested IDs to be safe
            return statuses;
        }

        const canonicalList = Array.from(canonicalZpids);
        const canonicalChunks: string[][] = [];
        for (let i = 0; i < canonicalList.length; i += chunkSize) {
            canonicalChunks.push(canonicalList.slice(i, i + chunkSize));
        }

        // Step 2: Fetch assets and visual analysis for canonical ZPIDs
        const canonicalStatuses: Record<string, PropertyStatusDetails> = {};

        await Promise.all(canonicalChunks.map(async (chunk) => {
            const [snapProps, snapAssets, snapVisual] = await Promise.all([
                getDocs(query(collection(db, "properties"), where(documentId(), "in", chunk))),
                getDocs(query(collection(db, "property_assets"), where(documentId(), "in", chunk))),
                getDocs(query(collection(db, "property_analyses_visual"), where(documentId(), "in", chunk)))
            ]);

            snapProps.forEach(doc => {
                if (!canonicalStatuses[doc.id]) canonicalStatuses[doc.id] = {};
                canonicalStatuses[doc.id].property = { timestamp: doc.data().lastUpdated };
            });

            snapAssets.forEach(doc => {
                if (!canonicalStatuses[doc.id]) canonicalStatuses[doc.id] = {};
                const data = doc.data();
                const imagesSecured = data.images?.length > 0 && data.images[0].includes('firebasestorage');
                canonicalStatuses[doc.id].assets = {
                    images: imagesSecured,
                    map: !!data.mapZoomIn && data.mapZoomIn.includes('firebasestorage'),
                    streetView: !!data.streetView && data.streetView.includes('firebasestorage'),
                    timestamp: data.lastVerified,
                    thumbnailUrl: imagesSecured ? data.images[0] : undefined
                };
            });

            snapVisual.forEach(doc => {
                if (!canonicalStatuses[doc.id]) canonicalStatuses[doc.id] = {};
                canonicalStatuses[doc.id].visual = { timestamp: doc.data().timestamp };
            });
        }));

        // Step 3: Map canonical statuses back to requested IDs
        requestedIds.forEach(reqId => {
            const canonicalZpid = idMap[reqId];
            if (canonicalZpid && canonicalStatuses[canonicalZpid]) {
                statuses[reqId] = canonicalStatuses[canonicalZpid];
            }
        });

    } catch (e) {
        console.warn("Failed to get property statuses batch", e);
    }

    return statuses;
};

export const deletePropertyAnalysis = async (zpid: string, mode: 'all' | 'intelligence' | 'assets' = 'all') => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID", tables: [] };

    const intelligenceTables = [
        "property_analyses_comprehensive",
        "property_analyses_visual",
        "image_quality_analysis",
        "property_investment_research"
    ];

    const collections: string[] = [];

    if (mode === 'all' || mode === 'intelligence') {
        collections.push(...intelligenceTables);
    }

    if (mode === 'all') {
        collections.push("properties");
    }

    if (mode === 'all' || mode === 'assets') {
        collections.push("property_assets");
    }

    try {
        console.log(`[Firestore] Deleting mode "${mode}" for ZPID: "${zpid}"...`);

        // Use proper deleteDoc for clean removal
        const { deleteDoc } = await import("firebase/firestore");
        await Promise.all(collections.map(coll => {
            logFirestoreQuery('deleteDoc', coll, { zpid });
            return deleteDoc(doc(db, coll, String(zpid)));
        }));

        console.log(`[Firestore] SUCCESS: Removed ZPID "${zpid}" from ${collections.length} collections.`);
        return { success: true, tables: collections };
    } catch (error) {
        return {
            success: false,
            error: handleFirestoreError(error, "deletePropertyAnalysis") as string,
            tables: collections
        };
    }
};

export const getProjectCollectionStats = async () => {
    if (!db) return null;
    const collections = [
        "properties",
        "property_analyses_comprehensive",
        "property_analyses_visual",
        "image_quality_analysis",
        "property_investment_research",
        "property_assets",
        "community_pulse",
        "general_market_intelligence",
        "llm_call_events",
        "api_call_events"
    ];

    const stats: Record<string, { count: number, estimatedSizeKB: number }> = {};

    await Promise.all(collections.map(async (collName) => {
        try {
            const collRef = collection(db, collName);
            const countSnap = await getCountFromServer(collRef);
            const count = countSnap.data().count;

            let sizeKB = 0;
            if (count > 0) {
                const sampleQuery = query(collRef, limit(5));
                const sampleSnap = await getDocs(sampleQuery);
                let totalSampleCharCount = 0;
                sampleSnap.forEach(doc => {
                    totalSampleCharCount += JSON.stringify(doc.data()).length;
                });
                const avgSizePerDoc = totalSampleCharCount / (sampleSnap.size || 1);
                sizeKB = (avgSizePerDoc * count) / 1024;
            }

            stats[collName] = {
                count,
                estimatedSizeKB: Math.round(sizeKB * 100) / 100
            };
        } catch (error) {
            console.warn(`[Stats] Failed to get stats for ${collName}:`, error);
        }
    }));

    return stats;
};
