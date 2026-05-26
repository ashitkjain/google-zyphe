import { doc, setDoc, getDoc, serverTimestamp, query, collection, collectionGroup, where, documentId, getDocs, getCountFromServer, limit, deleteDoc } from "firebase/firestore";

import {
    db,
    auth,
    sanitizeForFirestore,
    logFirestoreQuery,
    handleFirestoreError,
    generateCityStateKey
} from "./config";
import { logAPICall, updateAPICall } from "./api_logs";
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
import { ALLOWED_HOME_TYPES } from "../../utils/propertyPolicies";

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
 * Aligns strictly with the PropertyData schema.
 */
export function normalizePropertyFields(doc: Record<string, any>): Record<string, any> {
    const out = { ...doc };

    // ── Price ──────────────────────────────────────────────────────────────────
    // Canonical field: `price`
    const price = out.price ?? out.listPrice ?? out.list_price ?? out.ListPrice ?? null;
    if (price != null) {
        out.price = typeof price === 'string' ? parseFloat(price.replace(/[^0-9.]/g, '')) || price : price;
    }
    delete out.listPrice;
    delete out.list_price;
    delete out.ListPrice;

    // ── Living Area ────────────────────────────────────────────────────────────
    // Canonical field: `livingAreaValue`
    const sqft = out.livingAreaValue ?? out.sqft ?? out.livingArea ?? out.square_footage ?? out.squareFootage ?? out.LivingArea ?? null;
    if (sqft != null) {
        out.livingAreaValue = typeof sqft === 'string' ? parseFloat(sqft) || sqft : sqft;
    }
    delete out.sqft;
    delete out.livingArea;
    delete out.square_footage;
    delete out.squareFootage;
    delete out.LivingArea;

    // ── Beds/Baths ─────────────────────────────────────────────────────────────
    // Canonical fields: `bedrooms`, `bathrooms`
    if (out.beds != null && out.bedrooms == null) {
        out.bedrooms = out.beds;
        delete out.beds;
    }
    if (out.baths != null && out.bathrooms == null) {
        out.bathrooms = out.baths;
        delete out.baths;
    }

    if (out.home_type != null && out.homeType == null) {
        out.homeType = out.home_type;
        delete out.home_type;
    }

    // ── Address Normalization ──────────────────────────────────────────────────
    if (out.address) {
        out.address = normalizeAddressString(out.address);
    }

    // ── Cleanup Moved Collections ──────────────────────────────────────────────
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
    delete out.streetViewAnalysis;

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
        property_layout_type?: string | null;
        explanation?: string | null;
        is_under_construction?: boolean;
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
            return normalizePropertyFields(docSnap.data()) as PropertyData;
        }
        return null;
    } catch (error: any) {
        handleFirestoreError(error, "getPropertyFromCloud");
        return null;
    }
};

/**
 * Fetches the environmental subcollection document which contains FEMA NRI,
 * seismic zones, and historical disaster data.
 */
export const getEnvironmentalDataFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db || !zpid) return null;
    try {
        const nestedRef = doc(db, "properties", String(zpid), "environmental", "thirdparty_data");
        logFirestoreQuery('getDoc', 'properties/environmental', { zpid, type: 'thirdparty_data' });
        const nestedSnap = await getDoc(nestedRef);
        return nestedSnap.exists() ? nestedSnap.data() : null;
    } catch (error) {
        handleFirestoreError(error, "getEnvironmentalDataFromCloud");
        return null;
    }
};

export const getFemaNriFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db || !zpid) return null;
    try {
        const nestedRef = doc(db, "properties", String(zpid), "environmental", "fema_nri");
        logFirestoreQuery('getDoc', 'properties/environmental', { zpid, type: 'fema_nri' });
        const nestedSnap = await getDoc(nestedRef);
        return nestedSnap.exists() ? nestedSnap.data() : null;
    } catch (error) {
        handleFirestoreError(error, "getFemaNriFromCloud");
        return null;
    }
};

/**
 * Standardizes an address string for consistent Firestore lookups.
 * Removes Radar's " US" suffix and ensures a consistent comma/space pattern 
 * between State and Zip.
 */
export const normalizeAddressString = (address: string): string => {
    if (!address) return '';
    const normalized = address
        .replace(/, US$/i, '')
        .replace(/\sUS$/i, '')
        .replace(/,?\s?([A-Z]{2}),?\s?(\d{5})/g, ', $1 $2')
        .replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .trim();
    // Truncate at the first state+zip — anything after is a repeated suffix
    const firstEnd = normalized.match(/^(.+?\b[A-Z]{2}\s+\d{5})/);
    return firstEnd ? firstEnd[1] : normalized;
};

/**
 * Lookup a property by its MLS ID string.
 * Used to resolve MLS ID -> ZPID without calling RapidAPI search.
 * Returns the first matching property or null.
 */
export const getPropertyByMlsId = async (mlsId: string): Promise<PropertyData | null> => {
    if (!db || !mlsId) return null;
    try {
        const q1 = query(
            collection(db, "properties"),
            where("mlsId", "==", mlsId),
            limit(1)
        );
        logFirestoreQuery('getDocs', 'properties', { mlsId, scope: 'mlsid_lookup' });
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
            return normalizePropertyFields(snap1.docs[0].data()) as PropertyData;
        }

        const q2 = query(
            collection(db, "properties"),
            where("mlsid", "==", mlsId),
            limit(1)
        );
        logFirestoreQuery('getDocs', 'properties', { mlsId, scope: 'mlsid_lookup_fallback' });
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
            return normalizePropertyFields(snap2.docs[0].data()) as PropertyData;
        }

        return null;
    } catch (error: any) {
        handleFirestoreError(error, "getPropertyByMlsId");
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
        const normalized = normalizeAddressString(address);
        const variants = [
            address,
            normalized,
            // Format: "Street, City, State, Zip" (Commas everywhere)
            normalized.replace(/,?\s?([A-Z]{2})\s(\d{5})/, ', $1, $2')
        ];

        // Unique set of variants to try
        const uniqueVariants = Array.from(new Set(variants.filter(Boolean)));

        for (const variant of uniqueVariants) {
            const q = query(
                collection(db, "properties"),
                where("address", "==", variant),
                limit(1)
            );
            logFirestoreQuery('getDocs', 'properties', { variant, scope: 'address_lookup' });
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                return normalizePropertyFields(snapshot.docs[0].data()) as PropertyData;
            }
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
    zypheNoiseScore?: number | null;  // Zyphe proprietary noise score 0-100
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
        // Fetch ground-truth orientations in parallel (single batch — small collection)
        const [snapshot, gtSnap] = await Promise.all([
            getDocs(q),
            getDocs(collection(db, 'orientation_ground_truth')).catch(() => null),
        ]);
        // Build zpid → expected_orientation lookup from ground truth
        const gtMap: Record<string, string> = {};
        gtSnap?.docs.forEach(d => {
            const gt = d.data().expected_orientation;
            if (gt) gtMap[d.id] = gt;
        });
        const mapped = snapshot.docs
            .filter(d => !d.data().deprecated)
            .map(d => {
                const raw = d.data();
                const data = normalizePropertyFields(raw);
                const coords = data.coordinates ? { latitude: data.coordinates.latitude, longitude: data.coordinates.longitude } : undefined;
                const resolvedNeighborhood = (data as any).neighborhood_identity?.resolved_name || '';
                return {
                    zpid: d.id,
                    address: data.address || '',
                    zipcode: data.zipCode || '',
                    listPrice: data.price || 0,
                    bedrooms: data.bedrooms || 0,
                    bathrooms: data.bathrooms || 0,
                    livingArea: data.livingAreaValue || 0,
                    lotSize: data.lotSize || '',
                    homeType: data.homeType || '',
                    neighborhood: resolvedNeighborhood,
                    coordinates: coords,
                    images: data.images?.slice(0, 1) || [],
                    yearBuilt: data.yearBuilt || undefined,
                    stories: data.stories || data.resoFacts?.stories || undefined,
                    garage: data.garageSpaces || data.resoFacts?.garageSpaces || undefined,
                    pool: data.resoFacts?.hasPool === true || data.pool === true || false,
                    homeStatus: data.homeStatus || '',
                    daysOnZillow: data.timeOnZillow || undefined,
                    listedDate: data.listedDate || undefined,
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
                    // Prefer ground truth on doc > separate GT collection > AI result
                    orientation: (data as any).orientation_ground_truth?.expected_orientation
                        || gtMap[d.id]
                        || data.orientation_ai?.final_orientation
                        || '',
                    zypheNoiseScore: raw.zypheNoiseScore ?? null,
                };
            });
        const withOrientation = mapped.filter(p => p.orientation);
        console.log(`[getPropertiesByCity] ${mapped.length} props, ${withOrientation.length} have orientation. Sample:`,
            withOrientation.slice(0, 5).map(p => ({ zpid: p.zpid, orientation: p.orientation })));
        return mapped;
    } catch (error: any) {
        handleFirestoreError(error, "getPropertiesByCity");
        return [];
    }
};

/**
 * Get lightweight property summaries for a given ZIP code.
 */
export const getPropertiesByZip = async (zip: string, maxResults: number = 200): Promise<CityPropertySummary[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, "properties"),
            where("zipCode", "==", zip),
            limit(maxResults)
        );
        logFirestoreQuery('getDocs', 'properties', { zip, maxResults, scope: 'browse_by_zip' });
        const [snapshot, gtSnap] = await Promise.all([
            getDocs(q),
            getDocs(collection(db, 'orientation_ground_truth')).catch(() => null),
        ]);
        const gtMap: Record<string, string> = {};
        gtSnap?.docs.forEach(d => {
            const gt = d.data().expected_orientation;
            if (gt) gtMap[d.id] = gt;
        });
        return snapshot.docs
            .filter(d => !d.data().deprecated)
            .map(d => {
                const raw = d.data();
                const data = normalizePropertyFields(raw);
                const coords = data.coordinates ? { latitude: data.coordinates.latitude, longitude: data.coordinates.longitude } : undefined;
                const resolvedNeighborhood = (data as any).neighborhood_identity?.resolved_name || '';
                return {
                    zpid: d.id,
                    address: data.address || '',
                    zipcode: data.zipCode || '',
                    listPrice: data.price || 0,
                    bedrooms: data.bedrooms || 0,
                    bathrooms: data.bathrooms || 0,
                    livingArea: data.livingAreaValue || 0,
                    lotSize: data.lotSize || '',
                    homeType: data.homeType || '',
                    neighborhood: resolvedNeighborhood,
                    coordinates: coords,
                    images: data.images?.slice(0, 1) || [],
                    yearBuilt: data.yearBuilt || undefined,
                    stories: data.stories || data.resoFacts?.stories || undefined,
                    garage: data.garageSpaces || data.resoFacts?.garageSpaces || undefined,
                    pool: data.resoFacts?.hasPool === true || data.pool === true || false,
                    homeStatus: data.homeStatus || '',
                    daysOnZillow: data.timeOnZillow || undefined,
                    listedDate: data.listedDate || undefined,
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
                    // Prefer ground truth on doc > separate GT collection > AI result
                    orientation: (data as any).orientation_ground_truth?.expected_orientation
                        || gtMap[d.id]
                        || data.orientation_ai?.final_orientation
                        || '',
                    zypheNoiseScore: raw.zypheNoiseScore ?? null,
                };
            });
    } catch (error: any) {
        handleFirestoreError(error, "getPropertiesByZip");
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

export const getVisionExtensionFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db) return null;
    try {
        const nestedRef = doc(db, "properties", zpid, "analysis", "vision_v2");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'vision_v2' });
        const nestedSnap = await getDoc(nestedRef);
        return nestedSnap.exists() ? nestedSnap.data() : null;
    } catch (error) {
        handleFirestoreError(error, "getVisionExtensionFromCloud");
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

        const cityRef = doc(db, 'cities', cityStateKey.toLowerCase(), 'data', 'market_intelligence');
        logFirestoreQuery('setDoc', 'cities/data/market_intelligence', { cityStateKey });
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
        const data = await getCityDoc('general_market_intelligence', cityStateKey);
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

        const cityRef = doc(db, 'cities', cityStateKey.toLowerCase(), 'data', 'community_pulse');
        logFirestoreQuery('setDoc', 'cities/data/community_pulse', { cityStateKey });
        await setDoc(cityRef, payload, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveCommunityPulseToCloud") as string };
    }
};


// Flat map: logical name → document ID under cities/{key}/data/
const CITY_DOC_MAP: Record<string, string> = {
    'city_neighborhoods': 'neighborhoods',
    'city_context_graph': 'context_graph',
    'deep_investment_research': 'deep_research',
    'general_market_intelligence': 'market_intelligence',
    'community_pulse': 'community_pulse',
};

async function getCityDoc(collectionName: string, cityStateKey: string): Promise<any | null> {
    if (!db || !cityStateKey) return null;
    const docId = CITY_DOC_MAP[collectionName];
    if (!docId) return null;
    const ref = doc(db, 'cities', cityStateKey, 'data', docId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

export const getCommunityPulseFromCloud = async (cityStateKey: string): Promise<CommunityPulseResult | null> => {
    if (!db || !cityStateKey) return null;
    try {
        logFirestoreQuery('getDoc', 'community_pulse', { cityStateKey });
        const data = await getCityDoc('community_pulse', cityStateKey);
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

        const cityRef = doc(db, 'cities', cityStateKey.toLowerCase(), 'data', 'deep_research');
        logFirestoreQuery('setDoc', 'cities/data/deep_research', { cityStateKey });
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
        const data = await getCityDoc('deep_investment_research', cityStateKey);
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

        const cityRef = doc(db, 'cities', cityStateKey.toLowerCase(), 'data', 'context_graph');
        logFirestoreQuery('setDoc', 'cities/data/context_graph', { cityStateKey });
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
        const data = await getCityDoc('city_context_graph', cityStateKey);
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
        // Canonical path: same doc that intelBatch writes to
        const fitRef = doc(db, "properties", String(zpid), "analysis", "lifestyle_fit");
        logFirestoreQuery('setDoc', 'properties/analysis', { zpid, type: 'lifestyle_fit' });
        await setDoc(fitRef, {
            ...sanitizeForFirestore(fit),
            lastUpdated: serverTimestamp()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveLifestyleFitToCloud") as string };
    }
};

export const getLifestyleFitFromCloud = async (zpid: string): Promise<any | null> => {
    if (!db || !zpid) return null;
    try {
        // 1. Canonical path — written by intelBatch and the frontend save flow
        const batchRef = doc(db, "properties", String(zpid), "analysis", "lifestyle_fit");
        logFirestoreQuery('getDoc', 'properties/analysis', { zpid, type: 'lifestyle_fit' });
        const batchSnap = await getDoc(batchRef);
        if (batchSnap.exists()) {
            const data = batchSnap.data();
            if (data?.working_professionals || data?.families_with_kids || data?.seniors) return data;
        }

        // 2. Legacy nested path (comprehensive doc)
        const nestedRef = doc(db, "properties", String(zpid), "analysis", "comprehensive");
        const nestedSnap = await getDoc(nestedRef);
        if (nestedSnap.exists()) {
            const data = nestedSnap.data() as ComprehensiveAnalysisResult;
            if (data.lifestyle_fit) return data.lifestyle_fit;
        }

        // 3. Older legacy collection
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
        const key = cityStateKey.toLowerCase();
        const payload = {
            ...sanitizeForFirestore(data),
            cityStateKey: key,
            lastUpdated: serverTimestamp()
        };

        await setDoc(doc(db, 'cities', key, 'data', 'neighborhoods'), payload);
        logFirestoreQuery('setDoc', 'cities/data/neighborhoods', { cityStateKey: key });

        // Write parent city doc so getAllMinedCities() can list this city.
        await setDoc(doc(db, 'cities', key), {
            city: data.city || key,
            state: data.state || '',
            total_neighborhoods: data.neighborhoods?.length || 0,
            lastUpdated: serverTimestamp(),
        }, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveCityNeighborhoodsToCloud") as string };
    }
};

export const getCityNeighborhoodsFromCloud = async (cityStateKey: string): Promise<any | null> => {
    if (!db || !cityStateKey) return null;
    try {
        const ref = doc(db, 'cities', cityStateKey.toLowerCase(), 'data', 'neighborhoods');
        logFirestoreQuery('getDoc', 'cities/data/neighborhoods', { cityStateKey });
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
    } catch (error) {
        handleFirestoreError(error, "getCityNeighborhoodsFromCloud");
        return null;
    }
};

export const getAllMinedCities = async (): Promise<{ key: string; city: string; state: string; count: number; lastUpdated?: any }[]> => {
    if (!db) return [];
    try {
        logFirestoreQuery('getDocs', 'cities', { action: 'listAll' });
        const snap = await getDocs(collection(db, 'cities'));
        return snap.docs.map(d => {
            const data = d.data();
            return {
                key: d.id,
                city: data.city || d.id,
                state: data.state || '',
                count: data.total_neighborhoods || 0,
                lastUpdated: data.lastUpdated,
            };
        });
    } catch (error) {
        handleFirestoreError(error, "getAllMinedCities");
        return [];
    }
};

// ── MIT Living Wage Cache ─────────────────────────────────────────────────────
// Keyed by metro CBSA code (preferred) or county FIPS (fallback).
//   Metro path:  metros/{metroCode}/data/living_wage
//   County path: cities/{countyFipsKey}/data/living_wage   (e.g. "fips_06001")
//
// MIT data is metro/county-scoped — shared across ALL properties in the same area.
// No need to re-fetch per ZPID. Data updated annually (MIT publishes ~Feb each year).

/**
 * Saves MIT Living Wage data to Firestore.
 * @param cacheKey  - metroCode (e.g. "41860") or countyFips (e.g. "06001")
 * @param geoLevel  - "metro" | "county"
 * @param data      - MitLivingWageResult
 */
export const saveLivingWageToCloud = async (
    cacheKey: string,
    geoLevel: 'metro' | 'county',
    data: any
): Promise<{ success: boolean; error?: string }> => {
    if (!db || !cacheKey) return { success: false, error: 'DB not initialized or missing cache key' };
    try {
        const collection = geoLevel === 'metro' ? 'metros' : 'cities';
        const docKey = geoLevel === 'metro' ? cacheKey : `fips_${cacheKey}`;
        const ref = doc(db, collection, docKey, 'data', 'living_wage');
        logFirestoreQuery('setDoc', `${collection}/data/living_wage`, { cacheKey, geoLevel });
        await setDoc(ref, {
            ...sanitizeForFirestore(data),
            cacheKey,
            geoLevel,
            cachedAt: serverTimestamp(),
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, 'saveLivingWageToCloud') as string };
    }
};

/**
 * Loads MIT Living Wage data from Firestore.
 * @param cacheKey  - metroCode or countyFips
 * @param geoLevel  - "metro" | "county"
 * @param maxAgeDays - how old is acceptable (default 300 days — MIT updates annually)
 */
export const getLivingWageFromCloud = async (
    cacheKey: string,
    geoLevel: 'metro' | 'county',
    maxAgeDays: number = 300
): Promise<any | null> => {
    if (!db || !cacheKey) return null;
    try {
        const collection = geoLevel === 'metro' ? 'metros' : 'cities';
        const docKey = geoLevel === 'metro' ? cacheKey : `fips_${cacheKey}`;
        const ref = doc(db, collection, docKey, 'data', 'living_wage');
        logFirestoreQuery('getDoc', `${collection}/data/living_wage`, { cacheKey, geoLevel });
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;

        const cached = snap.data();

        // Freshness check — MIT data is annual; 300 days default is safe
        if (cached.cachedAt?.seconds) {
            const ageDays = (Date.now() - cached.cachedAt.seconds * 1000) / (1000 * 60 * 60 * 24);
            if (ageDays > maxAgeDays) {
                console.log(`[Living Wage] Cache stale (${Math.round(ageDays)} days old > ${maxAgeDays}d limit) — will refresh`);
                return null;
            }
        }

        return cached;
    } catch (error) {
        handleFirestoreError(error, 'getLivingWageFromCloud');
        return null;
    }
};

// ── Schools Intelligence Cache (keyed by school name + city, shared across properties) ──
//
// ⚠️  cityStateKey MUST be passed explicitly — never re-derive it by splitting the cache key.
// The cache key uses underscores for every word, so for a city like "San Jose" the key looks
// like "some_school_san_jose_ca" and a naive split().pop() gives "jose_ca" not "san_jose_ca".

export const saveSchoolAnalysisToCloud = async (
    cacheKey: string,
    data: any,
    cityStateKey: string   // e.g. "pleasanton_ca" — pass from generateCityStateKey(city, state)
) => {
    if (!db || !cacheKey || !cityStateKey) return { success: false, error: "Database not initialized or missing cache key / cityStateKey" };
    try {
        const payload = {
            ...sanitizeForFirestore(data),
            cache_key: cacheKey,
            timestamp: serverTimestamp()
        };

        const schoolRef = doc(db, "cities", cityStateKey.toLowerCase(), "schools", cacheKey);
        logFirestoreQuery('setDoc', 'cities/schools', { cacheKey, cityStateKey });
        await setDoc(schoolRef, payload);

        return { success: true };
    } catch (error) {
        return { success: false, error: handleFirestoreError(error, "saveSchoolAnalysisToCloud") as string };
    }
};

export const getSchoolAnalysisFromCloud = async (
    cacheKey: string,
    cityStateKey: string   // e.g. "pleasanton_ca" — pass from generateCityStateKey(city, state)
): Promise<any | null> => {
    if (!db || !cacheKey || !cityStateKey) return null;
    try {
        const schoolRef = doc(db, "cities", cityStateKey.toLowerCase(), "schools", cacheKey);
        logFirestoreQuery('getDoc', 'cities/schools', { cacheKey, cityStateKey });
        const snap = await getDoc(schoolRef);
        return snap.exists() ? snap.data() : null;
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
    isDeprecated?: boolean;
    deprecationReason?: string;
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
    comprehensive?: { timestamp: any };
    environmental?: { timestamp: any };
    realEstateApi?: { timestamp: any };
    visionExtension?: { timestamp: any };
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

        // Fetch assets and visual analysis for canonical ZPIDs (if any resolved)
        if (canonicalZpids.size > 0) {
            const canonicalList = Array.from(canonicalZpids);
            const canonicalChunks: string[][] = [];
            for (let i = 0; i < canonicalList.length; i += chunkSize) {
                canonicalChunks.push(canonicalList.slice(i, i + chunkSize));
            }

            // Step 2: Fetch assets and visual analysis for canonical ZPIDs
            const canonicalStatuses: Record<string, PropertyStatusDetails> = {};

            await Promise.all(canonicalChunks.map(async (chunk) => {
                const snapProps = await getDocs(query(collection(db, "properties"), where(documentId(), "in", chunk)));

                snapProps.forEach(doc => {
                    const propData = doc.data();
                    if (!canonicalStatuses[doc.id]) canonicalStatuses[doc.id] = {};
                    canonicalStatuses[doc.id].property = { timestamp: propData.lastUpdated };

                    if (!canonicalStatuses[doc.id].assets) canonicalStatuses[doc.id].assets = {} as any;

                    // Satellite URL is stored on the property doc OR assets
                    if (propData.satelliteImageUrl?.includes('firebasestorage')) {
                        canonicalStatuses[doc.id].assets!.satellite = true;
                    }

                    // Orientation check
                    if (propData.orientation_ai?.final_orientation && propData.orientation_ai.final_orientation !== 'UNCLEAR_IMAGE') {
                        (canonicalStatuses[doc.id].assets as any).orientation = true;
                    }
                });

                // Read assets and visual from new nested paths; fallback to legacy for assets
                await Promise.all(chunk.map(async (zpid) => {
                    // Assets: new nested path → legacy fallback
                    let assetData: any = null;
                    const assetSnap = await getDoc(doc(db, "properties", zpid, "analysis", "assets"));
                    if (assetSnap.exists()) {
                        assetData = assetSnap.data();
                    } else {
                        const legacySnap = await getDoc(doc(db, "property_assets", zpid));
                        if (legacySnap.exists()) assetData = legacySnap.data();
                    }

                    // If still missing, check properties doc itself for some fields (backup)
                    const propDoc = snapProps.docs.find(d => d.id === zpid);
                    const propData = propDoc?.data();

                    if (assetData || propData) {
                        if (!canonicalStatuses[zpid]) canonicalStatuses[zpid] = {};

                        const imagesArr = assetData?.images || propData?.images || [];
                        const imagesSecured = imagesArr.length > 0 && imagesArr[0]?.includes('firebasestorage');

                        // streetView: root doc (prop.streetView) is the single source of truth
                        const hasStreetView = !!(propData?.streetView && propData.streetView.includes('firebasestorage'));

                        canonicalStatuses[zpid].assets = {
                            ...canonicalStatuses[zpid].assets,
                            images: imagesSecured,
                            imageCount: imagesSecured ? imagesArr.filter((u: string) => u?.includes('firebasestorage')).length : 0,
                            map: (!!assetData?.mapZoomIn && assetData.mapZoomIn.includes('firebasestorage')) || (!!propData?.mapZoomIn && propData.mapZoomIn.includes('firebasestorage')),
                            streetView: hasStreetView,
                            satellite: canonicalStatuses[zpid].assets?.satellite || (!!assetData?.satelliteImageUrl && assetData.satelliteImageUrl.includes('firebasestorage')),
                            timestamp: assetData?.lastVerified || propData?.lastUpdated,
                            thumbnailUrl: imagesSecured ? imagesArr[0] : undefined
                        };
                    }

                    // Visual (AI RUN)
                    const visualSnap = await getDoc(doc(db, "properties", zpid, "analysis", "visual"));
                    if (visualSnap.exists()) {
                        if (!canonicalStatuses[zpid]) canonicalStatuses[zpid] = {};
                        canonicalStatuses[zpid].visual = { timestamp: visualSnap.data().timestamp };
                    }

                    // Comprehensive (Full Intel)
                    const compSnap = await getDoc(doc(db, "properties", zpid, "analysis", "comprehensive"));
                    if (compSnap.exists()) {
                        if (!canonicalStatuses[zpid]) canonicalStatuses[zpid] = {};
                        canonicalStatuses[zpid].comprehensive = { timestamp: compSnap.data().timestamp };
                    }

                    // Environmental (Google Data)
                    const envSnap = await getDoc(doc(db, "properties", zpid, "environmental", "thirdparty_data"));
                    if (envSnap.exists()) {
                        if (!canonicalStatuses[zpid]) canonicalStatuses[zpid] = {};
                        canonicalStatuses[zpid].environmental = { timestamp: envSnap.data().lastUpdated || envSnap.data().timestamp };
                    }

                    // Vision Extension (Chrome extension data page analysis)
                    const visionExtSnap = await getDoc(doc(db, "properties", zpid, "analysis", "vision_v2"));
                    if (visionExtSnap.exists()) {
                        if (!canonicalStatuses[zpid]) canonicalStatuses[zpid] = {};
                        canonicalStatuses[zpid].visionExtension = { timestamp: visionExtSnap.data().timestamp };
                    }

                    // RealEstateAPI cache
                    const propData2 = snapProps.docs.find(d => d.id === zpid)?.data();
                    if (propData2) {
                        const reapiId = propData2.resoFacts?.mlsid || propData2.address || '';
                        if (reapiId) {
                            const reapiCacheKey = reapiId.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 100);
                            const reapiSnap = await getDoc(doc(db, "realestateapi_cache", reapiCacheKey));
                            if (reapiSnap.exists()) {
                                const rd = reapiSnap.data() as any;
                                if (!canonicalStatuses[zpid]) canonicalStatuses[zpid] = {};
                                canonicalStatuses[zpid].realEstateApi = { timestamp: rd.fetchedAt };
                            }
                        }
                    }
                }));
            }));

            // Step 3: Map canonical statuses back to requested IDs
            requestedIds.forEach(reqId => {
                const canonicalZpid = idMap[reqId];
                if (canonicalZpid && canonicalStatuses[canonicalZpid]) {
                    statuses[reqId] = canonicalStatuses[canonicalZpid];
                }
            });
        }

        // Step 4: For any requested IDs that are not in statuses, check sold_or_unlisted_properties
        const missingIds = requestedIds.filter(id => !statuses[id]);
        if (missingIds.length > 0) {
            const missingChunks: string[][] = [];
            for (let i = 0; i < missingIds.length; i += chunkSize) {
                missingChunks.push(missingIds.slice(i, i + chunkSize));
            }
            await Promise.all(missingChunks.map(async (chunk) => {
                const snapDeprecated = await getDocs(query(collection(db, "sold_or_unlisted_properties"), where(documentId(), "in", chunk)));
                snapDeprecated.forEach(doc => {
                    const data = doc.data();
                    statuses[doc.id] = {
                        isDeprecated: true,
                        deprecationReason: data.movedReason || 'not_in_active_listings'
                    };
                });
            }));
        }

    } catch (e) {
        console.warn("Failed to get property statuses batch", e);
    }

    return statuses;
};

/**
 * Manually refresh Street View imagery for a specific property.
 * Hits the Google Street View Metadata API to check availability and triggers re-analysis if found.
 */
export const refreshStreetView = async (zpid: string, address: string): Promise<{ success: boolean; status: string; detail?: string }> => {
    try {
        console.log(`[Manual Refresh] Street View re-validation for ${address} (${zpid})...`);

        // 1. Fetch live metadata to see if imagery is available
        const { APP_CONFIG } = await import('../../config');
        const apiKey = APP_CONFIG.maps.key;

        // Load property first to get coordinates for higher precision
        const property = await getPropertyFromCloud(zpid);
        const hasCoords = !!(property?.coordinates?.latitude && property?.coordinates?.longitude);
        const locationParam = hasCoords
            ? `${property!.coordinates!.latitude},${property!.coordinates!.longitude}`
            : encodeURIComponent(address);

        // Increase radius for suburban setbacks
        const checkRadius = 150;
        const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${locationParam}&radius=${checkRadius}&source=outdoor&key=${apiKey}`;

        const logId = await logAPICall({
            user_id: auth?.currentUser?.uid || 'unknown',
            zpid: zpid,
            address: address,
            api_name: 'Google Maps',
            endpoint: 'streetview/metadata',
            params: { location: locationParam, radius: checkRadius, source: 'outdoor', mode: 'manual-refresh' },
            status: 'pending'
        });
        const start = Date.now();

        const metaResponse = await fetch(metaUrl);

        if (logId) {
            updateAPICall(logId, {
                status: metaResponse.ok ? 'completed' : 'failed',
                response_time_ms: Date.now() - start,
                error: metaResponse.ok ? undefined : `Status ${metaResponse.status}`
            });
        }

        if (!metaResponse.ok) throw new Error(`Google API returned status ${metaResponse.status}`);

        const meta = await metaResponse.json();
        const available = meta.status === 'OK';

        if (!available) {
            return {
                success: false,
                status: meta.status,
                detail: meta.status === 'ZERO_RESULTS' ? 'No outdoor imagery found within 100m' : `Google API Error: ${meta.status}`
            };
        }

        // 2. If available, trigger the full fetch pipeline with forceEnvironment=true
        // This will run the Gemini analysis and store the image.
        const { fetchPropertyDataFull } = await import('../api/propertyDataFull');
        await fetchPropertyDataFull(zpid, true, true);

        // 3. Trigger Orientation re-analysis now that we have fresh Street View
        if (property?.coordinates?.latitude && property?.coordinates?.longitude) {
            console.log(`[Manual Refresh] Re-running Orientation analysis for ${zpid}...`);
            try {
                const { runSatellitaryAnalysis } = await import('../satellitaryService');
                const streetViewUrl = property?.streetView || null;

                await runSatellitaryAnalysis(
                    property.coordinates.latitude,
                    property.coordinates.longitude,
                    streetViewUrl,
                    'manual-refresh',
                    zpid,
                    address,
                    property.description || null
                );
            } catch (orientErr) {
                console.error('[Manual Refresh] Orientation re-analysis failed:', orientErr);
                // Non-blocking for the imagery refresh
            }
        }

        return { success: true, status: 'OK', detail: 'Imagery secured, AI analysis updated, and Orientation re-calibrated' };
    } catch (e: any) {
        console.error('[Manual Refresh] Failed:', e);
        return { success: false, status: 'ERROR', detail: e.message };
    }
};



export const deletePropertyAnalysis = async (zpid: string, mode: 'all' | 'intelligence' | 'assets' = 'all') => {
    if (!db || !zpid) return { success: false, error: "Database not initialized or missing ZPID", tables: [] };

    const { deleteDoc } = await import("firebase/firestore");
    const deleted: string[] = [];

    try {
        console.log(`[Firestore] Deleting mode "${mode}" for ZPID: "${zpid}"...`);

        // New nested paths (primary)
        const nestedDocs: { path: string; ref: any }[] = [];

        if (mode === 'all' || mode === 'intelligence') {
            nestedDocs.push(
                { path: `properties/${zpid}/analysis/visual`, ref: doc(db, "properties", zpid, "analysis", "visual") },
                { path: `properties/${zpid}/analysis/comprehensive`, ref: doc(db, "properties", zpid, "analysis", "comprehensive") },
                { path: `properties/${zpid}/analysis/image_quality`, ref: doc(db, "properties", zpid, "analysis", "image_quality") },
                { path: `properties/${zpid}/analysis/investment`, ref: doc(db, "properties", zpid, "analysis", "investment") },
            );
        }

        if (mode === 'all' || mode === 'assets') {
            nestedDocs.push(
                { path: `properties/${zpid}/analysis/assets`, ref: doc(db, "properties", zpid, "analysis", "assets") },
                { path: `properties/${zpid}/environmental/thirdparty_data`, ref: doc(db, "properties", zpid, "environmental", "thirdparty_data") },
                { path: `properties/${zpid}/environmental/google_data`, ref: doc(db, "properties", zpid, "environmental", "google_data") }, // legacy env fallback
            );
        }

        if (mode === 'all') {
            // Delete root property doc last (subcollection docs must be deleted individually in Firestore)
            nestedDocs.push({ path: `properties/${zpid}`, ref: doc(db, "properties", zpid) });
        }

        await Promise.all(nestedDocs.map(({ path, ref }) => {
            logFirestoreQuery('deleteDoc', path, { zpid });
            deleted.push(path);
            return deleteDoc(ref).catch(() => { /* doc may not exist — silently ignore */ });
        }));

        // Also attempt legacy flat collections silently (clean up any pre-migration data)
        const legacyCollections: string[] = [];
        if (mode === 'all' || mode === 'intelligence') {
            legacyCollections.push("property_analyses_comprehensive", "property_analyses_visual", "image_quality_analysis", "property_investment_research");
        }
        if (mode === 'all' || mode === 'assets') {
            legacyCollections.push("property_assets");
        }
        await Promise.all(legacyCollections.map(coll =>
            deleteDoc(doc(db, coll, zpid)).catch(() => { /* not found — expected post-migration */ })
        ));

        console.log(`[Firestore] SUCCESS: Deleted ZPID "${zpid}" (mode=${mode}).`);
        return { success: true, tables: deleted };
    } catch (error) {
        return {
            success: false,
            error: handleFirestoreError(error, "deletePropertyAnalysis") as string,
            tables: deleted
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
                    await deletePropertyAnalysis(zpid, 'all').catch(() => { });
                    deprecated.push(zpid);
                    return;
                }

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
 *
 * Promises are deduplicated per session by city-set key so that App.tsx's auth
 * effect and useSearchTrie don't both hit Firestore for the same data.
 */
const _addressIndexCache = new Map<string, Promise<AddressIndexEntry[]>>();
export const loadAddressIndex = async (cities: string[]): Promise<AddressIndexEntry[]> => {
    if (!db || cities.length === 0) return [];
    const cacheKey = cities.map(c => c.toLowerCase().trim()).sort().join('|');
    const inflight = _addressIndexCache.get(cacheKey);
    if (inflight) return inflight;

    const promise = (async () => {
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
            _addressIndexCache.delete(cacheKey); // Allow retry on failure
            return [];
        }
    })();
    _addressIndexCache.set(cacheKey, promise);
    return promise;
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

/**
 * Deletes all storage assets associated with a specific ZPID.
 * Path: properties/{zpid}/
 */
export const deletePropertyStorageAssets = async (zpid: string): Promise<{ success: boolean, count: number, error?: string }> => {
    const storage = (await import('./config')).storage;
    if (!storage) return { success: false, count: 0, error: 'Storage not initialized' };

    try {
        const { ref, listAll, deleteObject } = await import('firebase/storage');
        const folderRef = ref(storage, `properties/${zpid}`);

        // 1. Recursive list and delete helper
        const deleteFolderRecursive = async (folderRef: any): Promise<number> => {
            let deletedCount = 0;
            const listResult = await listAll(folderRef);

            // Delete files
            const fileDeletes = listResult.items.map(async (item) => {
                await deleteObject(item);
                deletedCount++;
            });

            // Recurse subfolders
            const subfolderDeletes = listResult.prefixes.map(async (prefix) => {
                deletedCount += await deleteFolderRecursive(prefix);
            });

            await Promise.all([...fileDeletes, ...subfolderDeletes]);
            return deletedCount;
        };

        const totalDeleted = await deleteFolderRecursive(folderRef);
        console.log(`[Storage] Purged ${totalDeleted} assets for ZPID: ${zpid}`);
        return { success: true, count: totalDeleted };
    } catch (error: any) {
        // storage/object-not-found is common if the folder doesn't exist
        if (error?.code === 'storage/object-not-found') {
            return { success: true, count: 0 };
        }
        return { success: false, count: 0, error: error.message };
    }
};
