import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, documentId, getDocs, getCountFromServer, limit, deleteDoc } from "firebase/firestore";

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
    CommunityPulseResult,
    DeepInvestmentResearchResult
} from "../../types";
import { ALLOWED_HOME_TYPES } from "../../utils/propertyValidation";

export const savePropertyAssetsToCloud = async (zpid: string, assets: PropertyAssets) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        // 1. Nested write (ONLY)
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "assets");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'assets' });
        await setDoc(nestedRef, {
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
        // 1. Use nested path (ONLY)
        const nestedRef = doc(db, "properties", zpid, "analysis", "assets");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'assets' });
        const nestedSnap = await getDoc(nestedRef);
        return nestedSnap.exists() ? (nestedSnap.data() as PropertyAssets) : null;
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
        const sanitized = normalizePropertyFields(sanitizeForFirestore(data));
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

/**
 * Normalizes inconsistent field names before any write to the `properties` collection.
 *
 * The `properties` table is populated by multiple independent sources:
 *   - RESO MLS API        → writes `price`      (from raw.ListPrice)
 *   - Zillow/city scan    → writes `list_price`  (snake_case as-is)
 *   - RapidAPI            → writes `price`       (sometimes both)
 *   - Legacy ingestion    → writes `listPrice`   (camelCase)
 *
 * This function collapses all variants into a single canonical `price` field
 * and removes the redundant aliases so reads never need a fallback chain.
 */
function normalizePropertyFields(doc: Record<string, any>): Record<string, any> {
    const out = { ...doc };

    // ── Price ──────────────────────────────────────────────────────────────────
    // Canonical field: `listPrice`
    // Aliases: price, list_price, ListPrice
    const listPrice =
        out.listPrice ??
        out.price ??
        out.list_price ??
        out.ListPrice ??
        null;

    if (listPrice != null) {
        out.listPrice = typeof listPrice === 'string' ? parseFloat(listPrice.replace(/[^0-9.]/g, '')) || listPrice : listPrice;
    }
    // Remove aliases so the doc stays clean
    delete out.price;
    delete out.list_price;
    delete out.ListPrice;

    // ── Square footage ─────────────────────────────────────────────────────────
    // Canonical field: `squareFootage`
    // Aliases: square_footage, sqft, LivingArea
    const sqft =
        out.squareFootage ??
        out.square_footage ??
        out.sqft ??
        out.LivingArea ??
        null;

    if (sqft != null) {
        out.squareFootage = typeof sqft === 'string' ? parseFloat(sqft) || sqft : sqft;
    }
    delete out.square_footage;
    delete out.sqft;
    delete out.LivingArea;

    // ── Moved Collections ──────────────────────────────────────────────────────
    // The following fields have been moved to dedicated collections (like 
    // thirdparty_data / environmental sub-collection) to avoid the 
    // 1MB Firestore limit, but may still be present on the data object for 
    // frontend rendering. We strip them here to keep the `properties` collection lean.
    delete out.google_places;
    delete out.airQuality;
    delete out.pollen;
    delete out.solarData;
    delete out.noiseScore;
    delete out.noiseScoreDesc;
    delete out.noiseTrafficScore;
    delete out.noiseTrafficDesc;
    delete out.noiseLocalScore;
    delete out.noiseLocalDesc;
    delete out.noiseAirportScore;
    delete out.noiseAirportDesc;
    delete out.historical_disasters;
    delete out.evChargers;
    delete out.drought;
    delete out.broadband;
    delete out.streetViewAnalysis; // Also moved to environmental


    return out;
}

/**
 * Persists computed orientation results into the property document.
 * Uses merge:true — only writes the orientation subfields, never touching other data.
 */
export const savePropertyOrientationToCloud = async (
    zpid: string,
    orientationAI: {
        final_orientation: string;
        azimuth_degrees: number | null;
        visual_azimuth_estimate?: number | null;
        confidence: 'high' | 'medium' | 'low';
        aerial_only_mode: boolean;
        aerial_url: string;
        street_view_url: string;
        image_quality?: 'clear' | 'acceptable' | 'blurry';
        feng_shui_vastu?: string | null;
        privacy_insight?: string;
        lot_coverage_hardscape?: number | null;
        lot_coverage_pervious?: number | null;
        buyer_pro?: string;
        buyer_con?: string;
        orientation_highlights?: string;
        pool_visible?: boolean | null;
        pool_direction?: string | null;
        garage_direction?: string | null;
        open_sky_direction?: string | null;
    } | null
): Promise<{ success: boolean; error?: string }> => {
    if (!db || !zpid) return { success: false, error: 'Missing db or zpid' };
    try {
        const docRef = doc(db, 'properties', String(zpid));
        const payload: Record<string, any> = {};
        if (orientationAI) {
            payload.orientation_ai = sanitizeForFirestore(orientationAI);
            payload.orientation_calculated_at = serverTimestamp();
        }
        logFirestoreQuery('setDoc', 'properties', { zpid, fields: Object.keys(payload) });
        await setDoc(docRef, payload, { merge: true });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, 'savePropertyOrientationToCloud') as string };
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

/**
 * Lookup a property by its address string.
 * Used to resolve address→ZPID without calling RapidAPI.
 * Returns the first matching property or null.
 */
export const getPropertyByAddress = async (address: string): Promise<PropertyData | null> => {
    if (!db || !address) return null;
    try {
        const q = query(
            collection(db, "properties"),
            where("address", "==", address),
            limit(1)
        );
        logFirestoreQuery('getDocs', 'properties', { address, scope: 'address_lookup' });
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return snapshot.docs[0].data() as PropertyData;
        }
        return null;
    } catch (error: any) {
        handleFirestoreError(error, "getPropertyByAddress");
        return null;
    }
};

/**
 * Get all property zpids that belong to a given city.
 * Queries the 'properties' collection filtering by city field.
 */
export const getPropertyZpidsByCity = async (city: string, maxResults: number = 50): Promise<string[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, "properties"),
            where("city", "==", city),
            limit(maxResults)
        );
        logFirestoreQuery('getDocs', 'properties', { city, maxResults });
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.id);
    } catch (error: any) {
        handleFirestoreError(error, "getPropertyZpidsByCity");
        return [];
    }
};

export interface CityPropertySummary {
    zpid: string;
    address: string;
    zipcode: string;
    listPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    livingArea?: number;
    lotSize?: string;
    homeType?: string;
    neighborhood?: string;
    coordinates?: { latitude: number; longitude: number };
    images?: string[];
    // Additional MLS fields for advanced filters
    yearBuilt?: number;
    stories?: number;
    garage?: number;
    pool?: boolean;
    homeStatus?: string;
    daysOnZillow?: number;
    hoa?: number;
    city?: string;
    maxSchoolRating?: number;  // Best nearby school rating (1-10)
    orientation?: string;     // Front orientation (AI resolved)
    listedDate?: string | number;
}

/**
 * Get lightweight property summaries for a given city.
 * Returns address, zpid, zip, price, beds/baths for the Browse by City feature.
 */
export const getPropertiesByCity = async (city: string, maxResults: number = 200): Promise<CityPropertySummary[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, "properties"),
            where("city", "==", city),
            limit(maxResults)
        );
        logFirestoreQuery('getDocs', 'properties', { city, maxResults, scope: 'browse_by_city' });
        const snapshot = await getDocs(q);
        return snapshot.docs
            .filter(d => !d.data().deprecated)
            .map(d => {
            const data = d.data();
            const coords = data.coordinates ? { latitude: data.coordinates.latitude, longitude: data.coordinates.longitude } : undefined;
            // Prefer AI-resolved neighborhood name (actual neighborhoods), fall back to geo-based school zone lookup
            const resolvedNeighborhood = data.neighborhood_identity?.resolved_name || '';
            return {
                zpid: d.id,
                address: data.address || '',
                zipcode: data.zipcode || data.zip || '',
                listPrice: data.listPrice ?? data.list_price ?? data.price,
                bedrooms: data.bedrooms,
                bathrooms: data.bathrooms,
                livingArea: data.squareFootage ?? data.livingAreaValue ?? data.livingArea ?? data.living_area ?? undefined,
                lotSize: data.lotSize || data.lot_size || data.resoFacts?.lotSize || '',
                homeType: data.homeType || data.home_type || data.propertyType || data.property_type || '',
                neighborhood: resolvedNeighborhood,
                coordinates: coords,
                images: data.images?.slice(0, 1) || [],
                // Additional MLS fields
                yearBuilt: data.yearBuilt ?? data.year_built ?? undefined,
                stories: data.stories ?? data.resoFacts?.stories ?? undefined,
                garage: data.garageSpaces ?? data.resoFacts?.garageSpaces ?? undefined,
                pool: data.resoFacts?.hasPool === true || data.pool === true || false,
                homeStatus: data.homeStatus || data.home_status || '',
                daysOnZillow: data.daysOnZillow ?? data.days_on_zillow ?? undefined,
                listedDate: data.listedDate ?? undefined,
                hoa: data.monthlyHoaFee ?? data.hoaFee ?? undefined,
                city: data.city || '',
                maxSchoolRating: (() => {
                    const schools = data.schools as { rating?: string | number }[] | undefined;
                    if (!schools?.length) return undefined;
                    let best = 0;
                    for (const s of schools) {
                        const r = parseFloat(String(s.rating).replace(/\/.*/, '')) || 0;
                        if (r > best) best = r;
                    }
                    return best > 0 ? best : undefined;
                })(),
                orientation: data.orientation_ai?.final_orientation || '',
            };
        });
    } catch (error: any) {
        handleFirestoreError(error, "getPropertiesByCity");
        return [];
    }
};


export const saveVisualAnalysisToCloud = async (zpid: string, analysis: CustomAIAnalysisResult) => {
    if (!db) return { success: false, error: "Database not initialized" };
    if (!zpid) return { success: false, error: "Missing ZPID" };

    try {
        // 1. Nested write (ONLY)
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "visual");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'visual' });
        await setDoc(nestedRef, {
            ...sanitizeForFirestore(analysis),
            zpid: String(zpid),
            timestamp: serverTimestamp()
        }, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveVisualAnalysisToCloud") };
    }
};

export const getVisualAnalysisFromCloud = async (zpid: string): Promise<CustomAIAnalysisResult | null> => {
    if (!db) return null;
    try {
        // 1. Use nested path (ONLY)
        const nestedRef = doc(db, "properties", zpid, "analysis", "visual");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'visual' });
        const nestedSnap = await getDoc(nestedRef);
        return nestedSnap.exists() ? (nestedSnap.data() as CustomAIAnalysisResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getVisualAnalysisFromCloud");
        return null;
    }
};

export const saveComprehensiveAnalysisToCloud = async (zpid: string, analysis: ComprehensiveAnalysisResult) => {
    if (!db || !zpid) return false;
    try {
        // 1. Nested write (ONLY)
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "comprehensive");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'comprehensive' });
        await setDoc(nestedRef, {
            ...sanitizeForFirestore(analysis),
            zpid: String(zpid),
            timestamp: serverTimestamp()
        }, { merge: true });
        return true;
    } catch (error) {
        return handleFirestoreError(error, "saveComprehensiveAnalysisToCloud");
    }
};

export const getComprehensiveAnalysisFromCloud = async (zpid: string): Promise<ComprehensiveAnalysisResult | null> => {
    if (!db) return null;
    try {
        // 1. Use nested path (ONLY)
        const nestedRef = doc(db, "properties", zpid, "analysis", "comprehensive");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'comprehensive' });
        const nestedSnap = await getDoc(nestedRef);
        return nestedSnap.exists() ? (nestedSnap.data() as ComprehensiveAnalysisResult) : null;
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
        // 1. Nested write (ONLY)
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "image_quality");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'image_quality' });
        await setDoc(nestedRef, {
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
        // 1. Use nested path (ONLY)
        const nestedRef = doc(db, "properties", zpid, "analysis", "image_quality");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'image_quality' });
        const nestedSnap = await getDoc(nestedRef);
        return nestedSnap.exists() ? (nestedSnap.data() as ImageQualityAnalysisResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getImageQualityAnalysisFromCloud");
        return null;
    }
};

export const savePropertyInvestmentToCloud = async (zpid: string, research: PropertySpecificInvestmentResult) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        // 1. Nested write (ONLY)
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "investment");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'investment' });
        await setDoc(nestedRef, {
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
        // 1. Use nested path (ONLY)
        const nestedRef = doc(db, "properties", zpid, "analysis", "investment");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'investment' });
        const nestedSnap = await getDoc(nestedRef);
        return nestedSnap.exists() ? (nestedSnap.data() as PropertySpecificInvestmentResult) : null;
    } catch (error) {
        handleFirestoreError(error, "getPropertyInvestmentFromCloud");
        return null;
    }
};

export const saveInteriorSummaryToCloud = async (zpid: string, summary: any) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        // 1. Nested write (ONLY)
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "comprehensive");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'interior_summary' });
        await setDoc(nestedRef, {
            interior_summary: sanitizeForFirestore(summary),
            zpid: String(zpid),
            timestamp: serverTimestamp()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveInteriorSummaryToCloud") as string };
    }
};

export const getInteriorSummaryFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db || !zpid) return null;
    try {
        // 1. Use nested path (ONLY)
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "comprehensive");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'interior_summary' });
        const nestedSnap = await getDoc(nestedRef);
        if (nestedSnap.exists()) {
            const data = nestedSnap.data() as ComprehensiveAnalysisResult;
            return data.interior_summary || null;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, "getInteriorSummaryFromCloud");
        return null;
    }
};

export const saveGeneralMarketIntelligenceToCloud = async (cityStateKey: string, research: GeneralMarketIntelligenceResult) => {
    if (!db || !cityStateKey) return { success: false, error: "Database not initialized or missing City-State Key" };
    try {
        const researchData = typeof research === 'string' ? { market_dynamics: { summary: research } } : research;
        const payload = {
            ...researchData,
            status: 'completed',
            lastUpdated: serverTimestamp()
        };

        // 1. Consolidated write (ONLY)
        const cityRef = doc(db, "cities", cityStateKey.toLowerCase(), "intel", "market_intelligence");
        logFirestoreQuery('setDoc', 'cities/intel', { cityStateKey });
        await setDoc(cityRef, payload, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveGeneralMarketIntelligenceToCloud") as string };
    }
};

export const getGeneralMarketIntelligenceFromCloud = async (cityStateKey: string): Promise<GeneralMarketIntelligenceResult | null> => {
    if (!db || !cityStateKey) return null;
    try {
        logFirestoreQuery('getDoc', 'general_market_intelligence', { cityStateKey });
        const data = await getCityDocWithFallback('general_market_intelligence', cityStateKey);
        return data as GeneralMarketIntelligenceResult | null;
    } catch (error) {
        handleFirestoreError(error, "getGeneralMarketIntelligenceFromCloud");
        return null;
    }
};

export const saveCommunityPulseToCloud = async (cityStateKey: string, pulse: CommunityPulseResult) => {
    if (!db || !cityStateKey) return { success: false, error: "Database not initialized or missing City-State Key" };
    try {
        const pulseData = typeof pulse === 'string' ? { investment_insights: { summary: pulse } } : pulse;
        const payload = {
            ...pulseData,
            status: 'completed',
            lastUpdated: serverTimestamp()
        };

        // 1. Consolidated write (ONLY)
        const cityRef = doc(db, "cities", cityStateKey.toLowerCase(), "intel", "community_pulse");
        logFirestoreQuery('setDoc', 'cities/intel', { cityStateKey });
        await setDoc(cityRef, payload, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveCommunityPulseToCloud") as string };
    }
};

/**
 * Case-robust city document reader.
 * Prioritizes the consolidated `cities` collection.
 */
async function getCityDocWithFallback(collectionName: string, cityStateKey: string): Promise<any | null> {
    if (!db || !cityStateKey) return null;

    // Mapping legacy collections to new consolidated subcollection paths
    const CONSOLIDATED_MAP: Record<string, { type: 'index' | 'intel', docId: string }> = {
        'city_zip_cache': { type: 'index', docId: 'zips' },
        'city_neighborhoods': { type: 'index', docId: 'neighborhoods' },
        'city_context_graph': { type: 'index', docId: 'context_graph' },
        'deep_investment_research': { type: 'intel', docId: 'deep_research' },
        'general_market_intelligence': { type: 'intel', docId: 'market_intelligence' },
        'community_pulse': { type: 'intel', docId: 'community_pulse' },
    };

    // Build case and formatting variants
    const variants = new Set<string>();
    const normalized = cityStateKey.toLowerCase().trim();
    variants.add(normalized);
    variants.add(normalized.replace('-', '_'));
    variants.add(normalized.replace('_', '-'));
    
    // Add versions with all special chars/spaces removed for extreme robustness
    const ultraFlat = normalized.replace(/[^a-z0-9]/g, '');
    if (ultraFlat !== normalized) {
        variants.add(ultraFlat);
    }

    const nested = CONSOLIDATED_MAP[collectionName];

    // 1. Prioritize the Consolidated "cities" collection
    if (nested) {
        for (const key of variants) {
            try {
                const nestedRef = doc(db, "cities", key, nested.type, nested.docId);
                const nestedSnap = await getDoc(nestedRef);
                if (nestedSnap.exists()) {
                    console.log(`[getCityDocWithFallback] Hit: cities/${key}/${nested.type}/${nested.docId}`);
                    return nestedSnap.data();
                }
            } catch (e) { /* continue */ }
        }
    }

    // 2. Fallback to the Legacy Top-Level Collection
    for (const key of variants) {
        try {
            const legacyRef = doc(db, collectionName, key);
            const legacySnap = await getDoc(legacyRef);
            if (legacySnap.exists()) {
                console.log(`[getCityDocWithFallback] Hit legacy: ${collectionName}/${key}`);
                return legacySnap.data();
            }
        } catch (e) { /* continue */ }
    }

    console.warn(`[getCityDocWithFallback] Missed all variants for: ${collectionName} / ${cityStateKey}`);
    return null;
}

export const getCommunityPulseFromCloud = async (cityStateKey: string): Promise<CommunityPulseResult | null> => {
    if (!db || !cityStateKey) return null;
    try {
        logFirestoreQuery('getDoc', 'community_pulse', { cityStateKey });
        const data = await getCityDocWithFallback('community_pulse', cityStateKey);
        return data as CommunityPulseResult | null;
    } catch (error) {
        handleFirestoreError(error, "getCommunityPulseFromCloud");
        return null;
    }
};

export const saveDeepInvestmentResearchToCloud = async (cityStateKey: string, research: DeepInvestmentResearchResult) => {
    if (!db || !cityStateKey) return { success: false, error: "Database not initialized or missing City-State Key" };
    try {
        const researchData = typeof research === 'string' ? { content: research } : research;
        const payload = {
            ...researchData,
            status: 'completed',
            lastUpdated: serverTimestamp()
        };

        // 1. Consolidated write (ONLY)
        const cityRef = doc(db, "cities", cityStateKey.toLowerCase(), "intel", "deep_research");
        logFirestoreQuery('setDoc', 'cities/intel', { cityStateKey });
        await setDoc(cityRef, payload, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveDeepInvestmentResearchToCloud") as string };
    }
};

export const getDeepInvestmentResearchFromCloud = async (cityStateKey: string): Promise<DeepInvestmentResearchResult | null> => {
    if (!db || !cityStateKey) return null;
    try {
        logFirestoreQuery('getDoc', 'deep_investment_research', { cityStateKey });
        const data = await getCityDocWithFallback('deep_investment_research', cityStateKey);
        return data as DeepInvestmentResearchResult | null;
    } catch (error) {
        handleFirestoreError(error, "getDeepInvestmentResearchFromCloud");
        return null;
    }
};
// ── City-Level Context Graph (keyed by cityStateKey e.g. "dublin_ca") ──

export const saveCityContextGraphToCloud = async (cityStateKey: string, data: any) => {
    if (!db || !cityStateKey) return { success: false, error: "Database not initialized or missing key" };
    try {
        const payload = {
            ...sanitizeForFirestore(data),
            lastUpdated: serverTimestamp()
        };

        // 1. Consolidated write (ONLY)
        const cityRef = doc(db, "cities", cityStateKey.toLowerCase(), "index", "context_graph");
        logFirestoreQuery('setDoc', 'cities/index', { cityStateKey });
        await setDoc(cityRef, payload, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveCityContextGraphToCloud") as string };
    }
};

export const getCityContextGraphFromCloud = async (cityStateKey: string): Promise<any | null> => {
    if (!db || !cityStateKey) return null;
    try {
        logFirestoreQuery('getDoc', 'city_context_graph', { cityStateKey });
        const data = await getCityDocWithFallback('city_context_graph', cityStateKey);
        return data || null;
    } catch (error) {
        handleFirestoreError(error, "getCityContextGraphFromCloud");
        return null;
    }
};

// ── Context Graph Extraction Cache (per-property, keyed by zpid) ──

// ── Lifestyle Insights Cache (stored in property_analyses_comprehensive, keyed by zpid) ──

export const saveLifestyleInsightsToCloud = async (zpid: string, insights: any) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        const docRef = doc(db, "property_analyses_comprehensive", String(zpid));
        logFirestoreQuery('setDoc', 'property_analyses_comprehensive (lifestyle_insights)', { zpid });
        // 2. Also save to new nested path
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "comprehensive");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'lifestyle_insights' });
        await setDoc(nestedRef, {
            lifestyle_insights: sanitizeForFirestore(insights),
            zpid: String(zpid),
            timestamp: serverTimestamp()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveLifestyleInsightsToCloud") as string };
    }
};

export const getLifestyleInsightsFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db || !zpid) return null;
    try {
        // 1. Try new nested path
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "comprehensive");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'lifestyle_insights' });
        const nestedSnap = await getDoc(nestedRef);
        if (nestedSnap.exists()) {
            const data = nestedSnap.data() as ComprehensiveAnalysisResult;
            if (data.lifestyle_insights) return data.lifestyle_insights;
        }

        // 2. Fallback to legacy path
        const docRef = doc(db, "property_analyses_comprehensive", String(zpid));
        logFirestoreQuery('getDoc', 'property_analyses_comprehensive (lifestyle_insights)', { zpid });
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as ComprehensiveAnalysisResult;
            return data.lifestyle_insights || null;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, "getLifestyleInsightsFromCloud");
        return null;
    }
};

// ── Lifestyle Fit Cache (stored in property_analyses_comprehensive, keyed by zpid) ──

export const saveLifestyleFitToCloud = async (zpid: string, fit: any) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        const docRef = doc(db, "property_analyses_comprehensive", String(zpid));
        logFirestoreQuery('setDoc', 'property_analyses_comprehensive (lifestyle_fit)', { zpid });
        // 2. Also save to new nested path
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "comprehensive");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'lifestyle_fit' });
        await setDoc(nestedRef, {
            lifestyle_fit: sanitizeForFirestore(fit),
            zpid: String(zpid),
            timestamp: serverTimestamp()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveLifestyleFitToCloud") as string };
    }
};

export const getLifestyleFitFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db || !zpid) return null;
    try {
        // 1. Try new nested path
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "comprehensive");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'lifestyle_fit' });
        const nestedSnap = await getDoc(nestedRef);
        if (nestedSnap.exists()) {
            const data = nestedSnap.data() as ComprehensiveAnalysisResult;
            if (data.lifestyle_fit) return data.lifestyle_fit;
        }

        // 2. Fallback to legacy path
        const docRef = doc(db, "property_analyses_comprehensive", String(zpid));
        logFirestoreQuery('getDoc', 'property_analyses_comprehensive (lifestyle_fit)', { zpid });
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.lifestyle_fit || null;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, "getLifestyleFitFromCloud");
        return null;
    }
};

// ── Neighborhood Identity Cache (stored directly on the properties document, keyed by zpid) ──

export const saveNeighborhoodIdentityToCloud = async (zpid: string, identityData: any) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        const docRef = doc(db, "properties", String(zpid));
        logFirestoreQuery('setDoc', 'properties (neighborhood_identity)', { zpid });
        await setDoc(docRef, {
            neighborhood_identity: sanitizeForFirestore(identityData),
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveNeighborhoodIdentityToCloud") as string };
    }
};

export const getNeighborhoodIdentityFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db || !zpid) return null;
    try {
        const docRef = doc(db, "properties", String(zpid));
        logFirestoreQuery('getDoc', 'properties (neighborhood_identity)', { zpid });
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.neighborhood_identity || null;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, "getNeighborhoodIdentityFromCloud");
        return null;
    }
};

// ── City Neighborhoods Cache (keyed by cityStateKey, shared across all properties in a city) ──

export const saveCityNeighborhoodsToCloud = async (cityStateKey: string, data: any) => {
    if (!db || !cityStateKey) return { success: false, error: "Database not initialized or missing city key" };
    try {
        const payload = {
            ...sanitizeForFirestore(data),
            cityStateKey,
            lastUpdated: serverTimestamp()
        };

        // 1. Consolidated write (ONLY)
        const cityRef = doc(db, "cities", cityStateKey.toLowerCase(), "index", "neighborhoods");
        logFirestoreQuery('setDoc', 'cities/index', { cityStateKey });
        await setDoc(cityRef, payload);

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveCityNeighborhoodsToCloud") as string };
    }
};

export const getCityNeighborhoodsFromCloud = async (cityStateKey: string): Promise<any | null> => {
    if (!db || !cityStateKey) return null;
    try {
        logFirestoreQuery('getDoc', 'city_neighborhoods', { cityStateKey });
        const data = await getCityDocWithFallback('city_neighborhoods', cityStateKey);
        return data || null;
    } catch (error) {
        handleFirestoreError(error, "getCityNeighborhoodsFromCloud");
        return null;
    }
};

export const getAllMinedCities = async (): Promise<{ key: string; city: string; state: string; count: number; lastUpdated?: any }[]> => {
    if (!db) return [];
    try {
        // Query both legacy and consolidated collections
        logFirestoreQuery('getDocs', 'city_neighborhoods', { action: 'listAll' });
        const legacySnap = await getDocs(collection(db, "city_neighborhoods"));
        
        logFirestoreQuery('getDocs', 'cities', { action: 'listAll' });
        const consolidatedSnap = await getDocs(collection(db, "cities"));
        
        const citiesMap = new Map<string, { key: string; city: string; state: string; count: number; lastUpdated?: any }>();
        
        // Process legacy first
        legacySnap.docs.forEach(d => {
            const data = d.data();
            citiesMap.set(d.id, {
                key: d.id,
                city: data.city || d.id.split('_')[0] || 'Unknown',
                state: data.state || d.id.split('_')[1] || '',
                count: data.neighborhoods?.length || data.total_neighborhoods || 0,
                lastUpdated: data.lastUpdated
            });
        });
        
        // Merging consolidated documents
        consolidatedSnap.docs.forEach(d => {
            const data = d.data();
            const existing = citiesMap.get(d.id);
            if (!existing) {
                citiesMap.set(d.id, {
                    key: d.id,
                    city: data.city || d.id.split('_')[0] || 'Unknown',
                    state: data.state || d.id.split('_')[1] || '',
                    count: data.total_neighborhoods || 0,
                    lastUpdated: data.lastUpdated
                });
            } else if (data.lastUpdated) {
                // If consolidated exists, just updating metadata if newer
                existing.lastUpdated = data.lastUpdated;
            }
        });
        
        return Array.from(citiesMap.values());
    } catch (error) {
        handleFirestoreError(error, "getAllMinedCities");
        return [];
    }
};

// ── Schools Intelligence Cache (keyed by school name + city, shared across properties) ──

export const saveSchoolAnalysisToCloud = async (cacheKey: string, data: any) => {
    if (!db || !cacheKey) return { success: false, error: "Database not initialized or missing cache key" };
    try {
        const payload = {
            ...sanitizeForFirestore(data),
            cache_key: cacheKey,
            timestamp: serverTimestamp()
        };

        // 1. Consolidated write (ONLY)
        // Cache key format is: {w1}_{w2}_{city}_{state} (all lower, separated by underscores)
        const parts = cacheKey.split('_');
        const state = parts.pop();
        const city = parts.pop();
        if (city && state) {
            const cityStateKey = `${city}_${state}`;
            const schoolRef = doc(db, "cities", cityStateKey, "schools", cacheKey);
            logFirestoreQuery('setDoc', 'cities/schools', { cacheKey });
            await setDoc(schoolRef, payload);
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveSchoolAnalysisToCloud") as string };
    }
};

export const getSchoolAnalysisFromCloud = async (cacheKey: string): Promise<any | null> => {
    if (!db || !cacheKey) return null;
    try {
        // 1. Consolidated path lookup (ONLY)
        const parts = cacheKey.split('_');
        const state = parts.pop();
        const city = parts.pop();
        if (city && state) {
            const cityStateKey = `${city}_${state}`;
            const schoolRef = doc(db, "cities", cityStateKey, "schools", cacheKey);
            logFirestoreQuery('getDoc', 'cities/schools', { cacheKey });
            const nestedSnap = await getDoc(schoolRef);
            if (nestedSnap.exists()) return nestedSnap.data();
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, "getSchoolAnalysisFromCloud");
        return null;
    }
};


export const saveContextGraphToCloud = async (zpid: string, data: any, city?: string, state?: string, propertyMeta?: { price?: number; beds?: number; baths?: number; sqft?: number; yearBuilt?: number; homeType?: string; address?: string }) => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID" };
    try {
        const docRef = doc(db, "context_graph", String(zpid));
        logFirestoreQuery('setDoc', 'context_graph', { zpid });
        const saveData: any = {
            ...sanitizeForFirestore(data),
            lastUpdated: serverTimestamp()
        };
        // Store city for city-scoped queries (auto-indexed by Firestore)
        if (city) saveData.city = city.toLowerCase().trim();
        if (state) saveData.state = state.toUpperCase().trim();

        // Promote key attributes to top-level for Firestore indexing & filtering
        // These are auto-indexed individually; composite indexes (city + price range) 
        // will be auto-suggested by Firestore on first query attempt
        const km = data?.keyMetrics || {};
        const meta = propertyMeta || {};
        saveData.price = meta.price ?? km.price ?? null;
        saveData.beds = meta.beds ?? km.beds ?? null;
        saveData.baths = meta.baths ?? km.baths ?? null;
        saveData.sqft = meta.sqft ?? km.sqft ?? null;
        saveData.yearBuilt = meta.yearBuilt ?? km.yearBuilt ?? null;
        saveData.homeType = meta.homeType ?? null;
        saveData.address = meta.address ?? null;

        await setDoc(docRef, saveData, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveContextGraphToCloud") as string };
    }
};

export const getContextGraphFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db || !zpid) return null;
    try {
        const docRef = doc(db, "context_graph", String(zpid));
        logFirestoreQuery('getDoc', 'context_graph', { zpid });
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        handleFirestoreError(error, "getContextGraphFromCloud");
        return null;
    }
};

/**
 * Query context graphs with Firestore-level filtering.
 * Pushes price/beds/baths filtering to Firestore so only matching docs are transferred.
 * 
 * COMPOSITE INDEX REQUIRED: city ASC + price ASC + beds ASC + baths ASC
 * Firestore auto-suggests the creation URL on first query attempt.
 * If the index doesn't exist yet, falls back to city-only query + JS filtering.
 */
export interface ContextGraphQuery {
    city: string;
    priceMin?: number;
    priceMax?: number;
    minBeds?: number;
    minBaths?: number;
    maxResults?: number;  // default 50
}

export const queryContextGraphs = async (filters: ContextGraphQuery): Promise<Map<string, any>> => {
    const results = new Map<string, any>();
    if (!db || !filters.city) return results;

    const normalizedCity = filters.city.toLowerCase().trim();
    const maxResults = filters.maxResults || 50;

    try {
        // Build composite query — push as many filters to Firestore as possible
        const constraints: any[] = [
            where("city", "==", normalizedCity)
        ];

        // Price range (inequality on same field — always works)
        if (filters.priceMin && filters.priceMin > 0) {
            constraints.push(where("price", ">=", filters.priceMin));
        }
        if (filters.priceMax && filters.priceMax > 0) {
            constraints.push(where("price", "<=", filters.priceMax));
        }

        // Beds/baths — require composite index with price
        // If index doesn't exist, Firestore error will contain URL to create it
        if (filters.minBeds && filters.minBeds > 0) {
            constraints.push(where("beds", ">=", filters.minBeds));
        }
        if (filters.minBaths && filters.minBaths > 0) {
            constraints.push(where("baths", ">=", filters.minBaths));
        }

        constraints.push(limit(maxResults));

        logFirestoreQuery('getDocs', 'context_graph', { 
            city: normalizedCity, 
            priceMin: filters.priceMin, 
            priceMax: filters.priceMax,
            minBeds: filters.minBeds,
            minBaths: filters.minBaths 
        });

        const q = query(collection(db, "context_graph"), ...constraints);
        const snap = await getDocs(q);
        snap.forEach(d => {
            results.set(d.id, d.data());
        });
        console.log(`[Context Graph] Server-filtered query: ${results.size} results for "${normalizedCity}" (price: ${filters.priceMin || 0}–${filters.priceMax || '∞'}, beds≥${filters.minBeds || 0}, baths≥${filters.minBaths || 0})`);
        return results;

    } catch (error: any) {
        // If composite index missing, Firestore error contains creation URL
        if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
            console.warn(`[Context Graph] Composite index needed. Falling back to city-only query + JS filter.`);
            console.warn(`[Context Graph] Create index at: ${error.message}`);

            // Fallback: city-only query + JS filtering
            try {
                const fallbackQuery = query(
                    collection(db, "context_graph"),
                    where("city", "==", normalizedCity),
                    limit(200)
                );
                const snap = await getDocs(fallbackQuery);
                snap.forEach(d => {
                    const data = d.data();
                    // Apply filters in JS — exclude properties that violate constraints
                    // If buyer specified price and property has no price, skip it
                    const hasPrice = data.price != null && data.price > 0;
                    if ((filters.priceMin && filters.priceMin > 0) || (filters.priceMax && filters.priceMax > 0)) {
                        if (!hasPrice) return; // No price data → can't match price filter
                    }
                    if (filters.priceMin && filters.priceMin > 0 && hasPrice && data.price < filters.priceMin) return;
                    if (filters.priceMax && filters.priceMax > 0 && hasPrice && data.price > filters.priceMax) return;
                    if (filters.minBeds && filters.minBeds > 0 && data.beds && data.beds < filters.minBeds) return;
                    if (filters.minBaths && filters.minBaths > 0 && data.baths && data.baths < filters.minBaths) return;
                    results.set(d.id, data);
                });
                console.log(`[Context Graph] Fallback: ${results.size} results after JS filtering (from ${snap.size} city docs)`);
                return results;
            } catch (fallbackErr) {
                handleFirestoreError(fallbackErr, "queryContextGraphs-fallback");
                return results;
            }
        }
        handleFirestoreError(error, "queryContextGraphs");
        return results;
    }
};

/**
 * Fetch multiple context graphs by zpid in a single Firestore round trip.
 * Uses documentId() IN query (max 30 per batch, handles chunking).
 */
export const getContextGraphsBatch = async (zpids: string[]): Promise<Map<string, any>> => {
    const results = new Map<string, any>();
    if (!db || zpids.length === 0) return results;
    try {
        const BATCH = 30; // Firestore 'in' limit
        for (let i = 0; i < zpids.length; i += BATCH) {
            const chunk = zpids.slice(i, i + BATCH);
            logFirestoreQuery('getDocs', 'context_graph', { batch: chunk.length });
            const q = query(
                collection(db, "context_graph"),
                where(documentId(), "in", chunk)
            );
            const snap = await getDocs(q);
            snap.forEach(d => {
                results.set(d.id, d.data());
            });
        }
        console.log(`[Context Graph] Batch fetch: loaded ${results.size}/${zpids.length} graphs`);
        return results;
    } catch (error) {
        handleFirestoreError(error, "getContextGraphsBatch");
        return results;
    }
};

/**
 * Backfill top-level metadata fields on existing context_graph docs.
 * Reads property data from the `properties` collection and merges
 * city, state, price, beds, baths, sqft, yearBuilt, homeType, address
 * onto each context_graph doc WITHOUT touching factors/summary/keyMetrics.
 * 
 * Skips docs that already have the `city` field set.
 */
export const backfillContextGraphMetadata = async (
    zpids: string[],
    onProgress?: (done: number, skipped: number, total: number) => void
): Promise<{ updated: number; skipped: number; failed: number }> => {
    if (!db || zpids.length === 0) return { updated: 0, skipped: 0, failed: 0 };

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const CHUNK = 10;

    for (let i = 0; i < zpids.length; i += CHUNK) {
        const chunk = zpids.slice(i, i + CHUNK);

        await Promise.allSettled(chunk.map(async (zpid) => {
            try {
                // 1. Read current context_graph doc
                const graphRef = doc(db, "context_graph", String(zpid));
                const graphSnap = await getDoc(graphRef);
                if (!graphSnap.exists()) {
                    skipped++;
                    return;
                }

                const graphData = graphSnap.data();

                // Skip if already backfilled (has city field)
                if (graphData.city) {
                    skipped++;
                    return;
                }

                // 2. Read property data from properties collection
                const propRef = doc(db, "properties", String(zpid));
                const propSnap = await getDoc(propRef);
                if (!propSnap.exists()) {
                    // No property data available — still try keyMetrics
                    const km = graphData.keyMetrics || {};
                    if (km.price || km.beds) {
                        await setDoc(graphRef, {
                            price: km.price ?? null,
                            beds: km.beds ?? null,
                            baths: km.baths ?? null,
                            sqft: km.sqft ?? null,
                            yearBuilt: km.yearBuilt ?? null,
                        }, { merge: true });
                        updated++;
                    } else {
                        skipped++;
                    }
                    return;
                }

                const prop = propSnap.data();

                // 3. Merge metadata fields
                const km = graphData.keyMetrics || {};
                await setDoc(graphRef, {
                    city: (prop.city || '').toLowerCase().trim() || null,
                    state: (prop.state || '').toUpperCase().trim() || null,
                    price: prop.price ?? prop.zestimate ?? km.price ?? null,
                    beds: prop.bedrooms ?? km.beds ?? null,
                    baths: prop.bathrooms ?? km.baths ?? null,
                    sqft: prop.livingAreaValue ?? km.sqft ?? null,
                    yearBuilt: prop.yearBuilt ?? km.yearBuilt ?? null,
                    homeType: prop.homeType ?? null,
                    address: prop.address ?? null,
                }, { merge: true });

                updated++;
            } catch (e) {
                failed++;
                console.warn(`[Backfill] Error for ${zpid}:`, e);
            }
        }));

        onProgress?.(updated + skipped + failed, skipped, zpids.length);
    }

    console.log(`[Context Graph Backfill] Done: ${updated} updated, ${skipped} skipped, ${failed} failed / ${zpids.length} total`);
    return { updated, skipped, failed };
};

export const setCityResearchFlag = async (cityStateKey: string, status: 'running' | 'completed' | 'failed', error?: string) => {
    if (!db || !cityStateKey) return { success: false };
    try {
        const pulseRef = doc(db, "community_pulse", cityStateKey);
        const marketRef = doc(db, "general_market_intelligence", cityStateKey);
        const deepRef = doc(db, "deep_investment_research", cityStateKey);

        const updateData = {
            status,
            lastRan: serverTimestamp(),
            error: error || null
        };

        logFirestoreQuery('setDoc', 'city_research_flags', { cityStateKey, status });

        await Promise.all([
            setDoc(pulseRef, updateData, { merge: true }),
            setDoc(marketRef, updateData, { merge: true }),
            setDoc(deepRef, updateData, { merge: true })
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
        imageCount: number;
        map: boolean;
        streetView: boolean;
        satellite: boolean;  // Google satellite image (2× fidelity) cached in Firebase Storage
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
                const securedImageCount = imagesSecured ? data.images.filter((u: string) => u?.includes('firebasestorage')).length : 0;
                canonicalStatuses[doc.id].assets = {
                    images: imagesSecured,
                    imageCount: securedImageCount,
                    map: !!data.mapZoomIn && data.mapZoomIn.includes('firebasestorage'),
                    streetView: !!data.streetView && data.streetView.includes('firebasestorage'),
                    satellite: !!data.satelliteImageUrl && data.satelliteImageUrl.includes('firebasestorage'),
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

// ─── Deprecation Management ───────────────────────────────────────────────────

/**
 * Moves a property from `properties` to `sold_or_unlisted_properties`.
 * The full document is written to `sold_or_unlisted_properties/<zpid>` and
 * then deleted from `properties`. Nothing is left behind in the active table.
 */
export const markPropertyAsDeprecated = async (
    zpid: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> => {
    if (!db || !zpid) return { success: false, error: 'Missing db or zpid' };
    try {
        // 1. Read full property doc
        const propRef = doc(db, 'properties', String(zpid));
        const propSnap = await getDoc(propRef);
        const propData = propSnap.exists() ? propSnap.data() : {};

        // 2. Write to sold_or_unlisted_properties (full snapshot + metadata)
        const soldRef = doc(db, 'sold_or_unlisted_properties', String(zpid));
        logFirestoreQuery('setDoc', 'sold_or_unlisted_properties', { zpid });
        await setDoc(soldRef, {
            ...sanitizeForFirestore(propData),
            zpid: String(zpid),
            movedAt: serverTimestamp(),
            movedReason: reason || 'not_in_active_listings',
        });

        // 3. Hard-delete from active properties (true move, not a soft flag)
        logFirestoreQuery('deleteDoc', 'properties', { zpid });
        await deleteDoc(propRef);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, 'markPropertyAsDeprecated') as string };
    }
};

/**
 * Restores a sold/unlisted property back to active status.
 * Reads the full doc from `sold_or_unlisted_properties`, writes it back to
 * `properties`, then deletes it from `sold_or_unlisted_properties`.
 */
export const restoreDeprecatedProperty = async (zpid: string): Promise<{ success: boolean; error?: string }> => {
    if (!db || !zpid) return { success: false, error: 'Missing db or zpid' };
    try {
        const soldRef = doc(db, 'sold_or_unlisted_properties', String(zpid));
        const soldSnap = await getDoc(soldRef);
        if (!soldSnap.exists()) {
            return { success: false, error: 'Document not found in sold_or_unlisted_properties' };
        }

        const soldData = soldSnap.data();
        // Strip the move metadata fields before restoring
        const { movedAt, movedReason, deprecated, deprecatedAt, deprecatedReason, ...restoredData } = soldData as any;

        // Write full doc back to active properties
        const propRef = doc(db, 'properties', String(zpid));
        logFirestoreQuery('setDoc', 'properties', { zpid });
        await setDoc(propRef, sanitizeForFirestore(restoredData));

        // Delete from sold_or_unlisted_properties
        logFirestoreQuery('deleteDoc', 'sold_or_unlisted_properties', { zpid });
        await deleteDoc(soldRef);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: handleFirestoreError(error, 'restoreDeprecatedProperty') as string };
    }
};

/**
 * Scans the `properties` collection filtered by city, cross-references against
 * all active ZPIDs found in the `zip_listings_cache` for that city's zip codes,
 * and marks any property NOT present in the listings cache as deprecated.
 *
 * Returns a summary object.
 */
export const runDeprecationSweep = async (
    activeZpids: Set<string>,
    scopedCities: Set<string>,          // Only deprecate properties from these cities
    label: string = 'loaded listings',
    onProgress?: (msg: string) => void
): Promise<{ deprecated: string[]; skipped: string[]; errors: string[] }> => {
    if (!db) return { deprecated: [], skipped: [], errors: ['Database not initialized'] };

    const log = (msg: string) => {
        if (onProgress) onProgress(msg);
    };

    // Normalise city names for case-insensitive comparison
    const normalise = (s: string) => s.trim().toLowerCase();
    const scopedNormalised = new Set(Array.from(scopedCities).map(normalise));

    const deprecated: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    try {
        log(`[Sweep] Scoped to cities: ${Array.from(scopedCities).join(', ')}`);
        log(`[Sweep] Querying all properties in Firestore (${activeZpids.size} active ZPIDs from ${label})...`);
        logFirestoreQuery('getDocs', 'properties', { label });
        const snapshot = await getDocs(collection(db, 'properties'));

        log(`[Sweep] Found ${snapshot.docs.length} total properties in Firestore.`);

        const CHUNK_SIZE = 10;
        const docs = snapshot.docs;

        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
            const chunk = docs.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (d) => {
                const zpid = d.id;
                const data = d.data();

                // ── INVALID TYPE CHECK ───────────────────────────────────────
                // Delete properties with unsupported homeTypes (LOT, LAND, etc.)
                // that were ingested before the filter existed.
                const homeType = data.homeType || '';
                if (homeType && !ALLOWED_HOME_TYPES.includes(homeType)) {
                    log(`[Sweep] Deleting unsupported type (${homeType}): ${data.address || zpid}`);
                    await deletePropertyAnalysis(zpid, 'all').catch(() => {});
                    deprecated.push(zpid);
                    return;
                }

                // ── SCOPE CHECK ──────────────────────────────────────────────
                // Only evaluate properties whose city is in the loaded listings.
                // Properties from other cities are completely ignored so we don't
                // accidentally deprecate cities we never searched.
                const propertyCity = normalise(data.city || '');
                if (!scopedNormalised.has(propertyCity)) {
                    // Not in scope — leave untouched
                    return;
                }

                // Skip if already deprecated
                if (data.deprecated === true) {
                    skipped.push(zpid);
                    return;
                }

                // Check primary zpid AND alternate_ids
                const isActive = activeZpids.has(zpid) ||
                    (data.alternate_ids && Array.isArray(data.alternate_ids) &&
                        data.alternate_ids.some((alias: string) => activeZpids.has(String(alias))));

                if (!isActive) {
                    log(`[Sweep] Marking deprecated: ${data.address || zpid}`);
                    const result = await markPropertyAsDeprecated(
                        zpid,
                        'not_in_active_listings'
                    );
                    if (result.success) {
                        deprecated.push(zpid);
                    } else {
                        errors.push(zpid);
                    }
                } else {
                    skipped.push(zpid);
                }
            }));
        }

        log(`[Sweep] Complete. Deprecated: ${deprecated.length}, Active: ${skipped.length}, Errors: ${errors.length}.`);
    } catch (error: any) {
        const msg = handleFirestoreError(error, 'runDeprecationSweep') as string;
        errors.push(msg);
    }

    return { deprecated, skipped, errors };
};



/**
 * Fetches all documents from the `sold_or_unlisted_properties` collection.
 */
export const getDeprecatedProperties = async (): Promise<any[]> => {
    if (!db) return [];
    try {
        logFirestoreQuery('getDocs', 'sold_or_unlisted_properties', {});
        const snapshot = await getDocs(collection(db, 'sold_or_unlisted_properties'));
        return snapshot.docs.map(d => ({ zpid: d.id, ...d.data() }));
    } catch (error) {
        handleFirestoreError(error, 'getDeprecatedProperties');
        return [];
    }
};

// ── Address Index (lightweight address→ZPID lookup for autocomplete) ──────

export interface AddressIndexEntry {
    /** Short address string */
    a: string;
    /** ZPID */
    z: string;
}

/**
 * Build (or rebuild) the address index for a city.
 * Reads all property docs for the city and writes a compact {address, zpid}[]
 * to a single `address_index/{city}` document.
 */
export const buildAddressIndex = async (city: string): Promise<number> => {
    if (!db || !city) return 0;
    try {
        const props = await getPropertiesByCity(city, 500);
        const entries: AddressIndexEntry[] = props.map(p => ({ a: p.address, z: p.zpid }));
        const cityKey = city.toLowerCase().trim();
        await setDoc(doc(db, "address_index", cityKey), {
            entries,
            count: entries.length,
            lastUpdated: serverTimestamp()
        });
        console.log(`[AddressIndex] Built index for "${cityKey}" — ${entries.length} entries`);
        return entries.length;
    } catch (error) {
        handleFirestoreError(error, "buildAddressIndex");
        return 0;
    }
};

/**
 * Load address index entries for one or more cities.
 * Returns a flat array of {address, zpid} pairs for instant client-side search.
 */
export const loadAddressIndex = async (cities: string[]): Promise<AddressIndexEntry[]> => {
    if (!db || cities.length === 0) return [];
    try {
        const all: AddressIndexEntry[] = [];
        for (const city of cities) {
            const cityKey = city.toLowerCase().trim();
            logFirestoreQuery('getDoc', 'address_index', { cityKey });
            const snap = await getDoc(doc(db, "address_index", cityKey));
            if (snap.exists()) {
                const data = snap.data();
                if (Array.isArray(data.entries)) {
                    all.push(...data.entries);
                }
            }
        }
        console.log(`[AddressIndex] Loaded ${all.length} entries from ${cities.length} cities`);
        return all;
    } catch (error) {
        handleFirestoreError(error, "loadAddressIndex");
        return [];
    }
};

/**
 * Add a single property to the address index (fire-and-forget after saving a new property).
 */
export const updateAddressIndex = async (city: string, address: string, zpid: string): Promise<void> => {
    if (!db || !city || !address || !zpid) return;
    try {
        const cityKey = city.toLowerCase().trim();
        const indexRef = doc(db, "address_index", cityKey);
        const snap = await getDoc(indexRef);
        const entries: AddressIndexEntry[] = snap.exists() ? (snap.data().entries || []) : [];
        // Don't duplicate
        if (entries.some(e => e.z === zpid)) return;
        entries.push({ a: address, z: zpid });
        await setDoc(indexRef, { entries, count: entries.length, lastUpdated: serverTimestamp() });
        console.log(`[AddressIndex] Added "${address}" (${zpid}) to "${cityKey}" index`);
    } catch (error) {
        handleFirestoreError(error, "updateAddressIndex");
    }
};
