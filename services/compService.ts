import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebaseService';
import { APP_CONFIG } from '../config';
import { normalizeAddress } from './api/geocoding';
import { getZipSoldListings, saveZipSoldListings } from './firebase/cityData';
import { COMP_NORMALIZATION_PROMPT, COMP_NORMALIZATION_SYSTEM_INSTRUCTION } from '../prompts/property/compNormalization';
import { executeGeminiRequest, FLASH_MODEL, FLASH_LITE_MODEL } from './geminiService';
import { executeLandUtilityAnalysis } from '../prompts/property/landUtility';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SubjectProperty {
    zpid?: string;
    address: string;
    latitude?: number;
    longitude?: number;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    lotSize?: number;
    yearBuilt?: number;
    homeType?: string;
    listPrice?: number;
    description?: string;
    zestimate?: number;
}

export interface SaleComp {
    id: string;
    formattedAddress: string;
    imageUrl?: string;
    rentZestimate?: number;
    addressLine1?: string;
    addressLine2?: string;
    city: string;
    state: string;
    stateFips?: string;
    zipCode: string;
    county?: string;
    countyFips?: string;
    latitude?: number;
    longitude?: number;
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    lotSize?: number;
    yearBuilt?: number;
    assessorID?: string;
    legalDescription?: string;
    subdivision?: string;
    zoning?: string;
    lastSaleDate?: string;   // ISO date-time from Rentcast /properties or zip sold cache
    lastSalePrice?: number;
    hoa?: Record<string, any>;
    features?: Record<string, any>;
    taxAssessments?: Record<string, any>;
    propertyTaxes?: Record<string, any>;
    history?: Record<string, any>;
    owner?: Record<string, any>;
    ownerOccupied?: boolean;
    distance?: number;
    correlation?: number;
    daysOnMarket?: number;
    tier?: number;           // 1=ideal, 2=strong, 3=good, 4=acceptable
    adjustedPrice?: number;  // time-adjusted sale price
    isOutlier?: boolean;     // flagged by IQR in regression
    priceUnverified?: boolean; // true if sold ≤60 days and price diverges >10% from zestimate
    zestimate?: number;        // Zillow zestimate for the comp property
}

export interface FindCompsOptions {
    forceRefresh?: boolean;
    useZipCache?: boolean;
    onProgress?: (step: string) => void;
    userId?: string;
    skipGemini?: boolean;
}

export interface CompAnalysisResult {
    rawComps: SaleComp[];
    eligibleComps: SaleComp[];
    geminiResult: any;
    monthlyAppreciationRate: number;
    subjectProperty: SubjectProperty;
}

// ─── Mathematical Utility Functions ──────────────────────────────────────────

/** Haversine formula — returns distance in miles between two lat/lng points */
export function haversineDistanceMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cacheKey(address: string): string {
    return address.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 200);
}

function stripUndefined(obj: any): any {
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, stripUndefined(v)])
        );
    }
    return obj;
}

function toDateSafe(val: any): Date | null {
    if (!val) return null;
    if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val?.toDate === 'function') return val.toDate() as Date; // Firestore Timestamp
    if (val instanceof Date) return val;
    return null;
}

// ─── Master Pipeline ─────────────────────────────────────────────────────────

export async function findComps(
    subject: SubjectProperty,
    options: FindCompsOptions = {}
): Promise<CompAnalysisResult> {
    const {
        forceRefresh = false,
        useZipCache = false,
        onProgress = () => {},
        userId = 'unknown',
        skipGemini = false
    } = options;

    onProgress('Resolving subject property details...');
    let subjectData = { ...subject };

    // 1. Resolve ZPID lookup if only ZPID is provided
    if (subjectData.zpid && !subjectData.address) {
        const subjSnap = await getDoc(doc(db, 'properties', subjectData.zpid));
        if (subjSnap.exists()) {
            const d = subjSnap.data();
            subjectData.address = d.address || '';
        }
    }

    if (!subjectData.address) {
        throw new Error('Subject property address is required.');
    }

    // 2. Geocode / Normalize Subject Address
    onProgress('Normalizing address...');
    subjectData.address = radarResult.formattedAddress.replace(/(?:\s*,?\s*)(?:US|USA|United States)$/i, '');
    subjectData.latitude = subjectData.latitude ?? radarResult.coordinates.latitude;
    subjectData.longitude = subjectData.longitude ?? radarResult.coordinates.longitude;

    // Extract Zip Code from normalized address
    let zipCode = radarResult.components?.zipCode || undefined;
    if (!zipCode) {
        const zipMatch = subjectData.address.match(/(\d{5})(?:\s|,|$)/);
        if (zipMatch) zipCode = zipMatch[1];
    }

    // 3. Enrich Subject Attributes from US Housing API (if ZPID is missing) or Local DB
    if (!subjectData.zpid) {
        onProgress('Searching county records for subject property specs...');
        try {
            const config = APP_CONFIG.usHousingApi;
            const searchUrl = `https://${config.host}/propertyExtendedSearch?location=${encodeURIComponent(subjectData.address)}`;
            const searchResp = await fetch(searchUrl, {
                method: 'GET',
                headers: { 'x-rapidapi-host': config.host, 'x-rapidapi-key': config.key },
            });
            if (searchResp.ok) {
                const searchData = await searchResp.json();
                const matched = (searchData.props || searchData.results || searchData || [])[0];
                if (matched && matched.zpid) {
                    console.log(`[CompService] Resolved subject ZPID via live search: ${matched.zpid}`);
                    subjectData.zpid = String(matched.zpid);
                    subjectData.bedrooms = subjectData.bedrooms ?? matched.bedrooms ?? matched.beds;
                    subjectData.bathrooms = subjectData.bathrooms ?? matched.bathrooms ?? matched.baths;
                    subjectData.squareFootage = subjectData.squareFootage ?? matched.livingArea ?? matched.squareFootage ?? matched.livingAreaValue;
                    subjectData.lotSize = subjectData.lotSize ?? matched.lotSize ?? matched.lotAreaValue;
                    subjectData.yearBuilt = subjectData.yearBuilt ?? matched.yearBuilt;
                    subjectData.homeType = subjectData.homeType ?? matched.propertyType ?? matched.homeType;
                    subjectData.listPrice = subjectData.listPrice ?? matched.price ?? matched.listPrice;
                    subjectData.zestimate = subjectData.zestimate ?? matched.zestimate;
                }
            }
        } catch (e: any) {
            console.warn('[CompService] Subject property ZPID search failed:', e.message);
        }
    }

    if (subjectData.zpid) {
        const subjSnap = await getDoc(doc(db, 'properties', subjectData.zpid));
        if (subjSnap.exists()) {
            const d = subjSnap.data();
            subjectData = {
                ...subjectData,
                bedrooms: subjectData.bedrooms ?? d.bedrooms,
                bathrooms: subjectData.bathrooms ?? d.bathrooms,
                squareFootage: subjectData.squareFootage ?? d.livingAreaValue ?? d.livingArea,
                lotSize: subjectData.lotSize ?? d.lotAreaValue ?? d.lotSize,
                yearBuilt: subjectData.yearBuilt ?? d.yearBuilt,
                homeType: subjectData.homeType ?? d.homeType ?? d.propertyType,
                listPrice: subjectData.listPrice ?? d.listPrice ?? d.price ?? d.list_price,
                description: subjectData.description ?? d.description ?? d.homeDescription,
                zestimate: subjectData.zestimate ?? d.zestimate,
            };
        }
    }



    const subjectSqft = subjectData.squareFootage || 0;
    const subjectType = (subjectData.homeType || '').toString().toUpperCase().trim();
    const subjectLat = subjectData.latitude;
    const subjectLng = subjectData.longitude;
    const subjectLot = subjectData.lotSize || 0;

    if (subjectLat == null || subjectLng == null) {
        throw new Error(`Coordinates could not be resolved for address: ${subjectData.address}`);
    }

    // 4. Retrieve Raw Comparables
    const now = Date.now();
    let rawCompsList: any[] = [];
    let cacheRef = doc(db, 'rentcast_comps', cacheKey(subjectData.address));

    // A. Check Firestore Cache
    if (!forceRefresh) {
        onProgress('Checking local cache...');
        const snap = await getDoc(cacheRef);
        if (snap.exists()) {
            const d = snap.data() as any;
            if (d.comps && Array.isArray(d.comps)) {
                rawCompsList = d.comps.map((c: any) => ({
                    ...c,
                    distance: c.distance != null
                        ? c.distance
                        : (subjectLat != null && subjectLng != null && c.latitude != null && c.longitude != null)
                            ? Math.round(haversineDistanceMi(subjectLat, subjectLng, c.latitude, c.longitude) * 10) / 10
                            : undefined,
                }));
            }
        }
    }

    // B. Fetch sold listings if Cache Miss
    if (rawCompsList.length === 0) {
        if (useZipCache && zipCode) {
            onProgress(`Fetching sold listings from local zip cache for ${zipCode}...`);
            const soldCache = await getZipSoldListings(zipCode);
            if (soldCache?.listings && Array.isArray(soldCache.listings)) {
                rawCompsList = soldCache.listings;
            }
        }

        // Live sold listings retrieval from US Housing API (RapidAPI)
        if (rawCompsList.length === 0 && zipCode) {
            onProgress(`Fetching live sold properties from US Housing API for zip ${zipCode}...`);
            try {
                const config = APP_CONFIG.usHousingApi;
                const baseUrl = `https://${config.host}/propertyExtendedSearch?location=${zipCode}&status_type=RecentlySold&soldInLast=6m`;
                const resp = await fetch(baseUrl, {
                    headers: { 'X-RapidAPI-Key': config.key, 'X-RapidAPI-Host': config.host }
                });
                if (!resp.ok) {
                    throw new Error(`US Housing API returned status ${resp.status}`);
                }
                const result = await resp.json();
                const items = Array.isArray(result) ? result : (result.props || result.results || []);
                rawCompsList = items;
                if (items.length > 0) {
                    // Cache it for the next run
                    await saveZipSoldListings(zipCode, items);
                }
            } catch (err: any) {
                console.warn('[CompService] Live US Housing API fetch failed:', err.message);
                throw new Error(`Comparable retrieval failed: ${err.message}`);
            }
        }
    }

    // 5. Calculate Regression Trend & IQR Outliers
    onProgress('Running regression trend modeling...');
    const sixMonthsAgo = now - 180 * 86_400_000;
    const trendData: { monthIdx: number; psfMedian: number }[] = [];
    const allPsf: number[] = [];
    const psfByMonth = new Map<number, number[]>();

    for (const listing of rawCompsList) {
        if (subjectType) {
            const compType = (listing.homeType || listing.propertyType || '').toString().toUpperCase().trim();
            if (compType && compType !== subjectType) continue;
        }
        const rawD = listing.dateSold || listing.lastSoldDate || listing.soldDate || listing.lastSaleDate ||
                     listing.date_sold || listing.sold_date || listing.contractDate || listing.closedDate;
        if (!rawD) continue;
        const dMs = typeof rawD === 'number' ? (rawD > 1e12 ? rawD : rawD * 1000) : new Date(String(rawD)).getTime();
        if (isNaN(dMs) || dMs < sixMonthsAgo) continue;
        const price = listing.price || listing.list_price || listing.lastSoldPrice || listing.soldPrice || listing.lastSalePrice;
        const sqft = listing.livingArea || listing.squareFootage || listing.description?.sqft;
        if (typeof price !== 'number' || typeof sqft !== 'number' || sqft <= 0 || price <= 0) continue;
        const psf = price / sqft;
        allPsf.push(psf);

        const monthIdx = Math.floor((now - dMs) / (30.44 * 86_400_000));
        if (!psfByMonth.has(monthIdx)) psfByMonth.set(monthIdx, []);
        psfByMonth.get(monthIdx)!.push(psf);
    }

    let monthlyRate = 0;
    let iqrLo = -Infinity;
    let iqrHi = Infinity;

    if (allPsf.length >= 5) {
        allPsf.sort((a, b) => a - b);
        const q1 = allPsf[Math.floor(allPsf.length * 0.25)];
        const q3 = allPsf[Math.floor(allPsf.length * 0.75)];
        const iqr = q3 - q1;
        iqrLo = q1 - 1.5 * iqr;
        iqrHi = q3 + 1.5 * iqr;

        for (const [mIdx, vals] of psfByMonth) {
            const clean = vals.filter(v => v >= iqrLo && v <= iqrHi);
            if (clean.length === 0) continue;
            clean.sort((a, b) => a - b);
            const med = clean[Math.floor(clean.length / 2)];
            trendData.push({ monthIdx: mIdx, psfMedian: med });
        }

        if (trendData.length >= 2) {
            const n = trendData.length;
            const sumX = trendData.reduce((s, d) => s + d.monthIdx, 0);
            const sumY = trendData.reduce((s, d) => s + d.psfMedian, 0);
            const sumXY = trendData.reduce((s, d) => s + d.monthIdx * d.psfMedian, 0);
            const sumXX = trendData.reduce((s, d) => s + d.monthIdx ** 2, 0);
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX ** 2);
            const avgPsf = sumY / n;
            monthlyRate = avgPsf > 0 ? -slope / avgPsf : 0;
            monthlyRate = Math.max(-0.02, Math.min(0.02, monthlyRate)); // Cap at ±2%/mo
        }
    }

    // 6. Categorize, adjust, and score each Comparable Property
    onProgress('Tiering and modeling comps...');
    const mappedComps: SaleComp[] = [];

    for (const listing of rawCompsList) {
        const cLat = listing.latitude ?? listing.location?.address?.coordinate?.lat;
        const cLng = listing.longitude ?? listing.location?.address?.coordinate?.lon;
        if (cLat == null || cLng == null) continue;

        const dist = haversineDistanceMi(subjectLat, subjectLng, cLat, cLng);
        if (dist > 1.0) continue;

        const compBeds = listing.bedrooms ?? listing.beds ?? undefined;
        const compBaths = listing.bathrooms ?? listing.baths ?? undefined;
        const compSqft = listing.squareFootage ?? listing.livingArea ?? listing.description?.sqft ?? undefined;
        const compHomeType = (listing.propertyType || listing.homeType || listing.description?.type || '').toString().toUpperCase().trim();

        if (subjectType && compHomeType && compHomeType !== subjectType) continue;
        if (subjectData.bedrooms != null && compBeds != null && Math.abs(compBeds - subjectData.bedrooms) > 1) continue;

        const rawDate = listing.dateSold || listing.lastSoldDate || listing.soldDate || listing.lastSaleDate ||
                        listing.date_sold || listing.sold_date || listing.contractDate || listing.closedDate;
        let soldDateStr: string | undefined;
        let soldMs = 0;
        if (rawDate != null) {
            if (typeof rawDate === 'number') {
                soldMs = rawDate > 1e12 ? rawDate : rawDate * 1000;
            } else {
                soldMs = new Date(String(rawDate)).getTime();
            }
            if (!isNaN(soldMs)) soldDateStr = new Date(soldMs).toISOString();
        }
        const daysAgo = soldMs > 0 ? Math.floor((now - soldMs) / 86_400_000) : 9999;

        const salePrice = typeof (listing.price || listing.list_price || listing.lastSoldPrice || listing.soldPrice || listing.lastSalePrice) === 'number'
            ? (listing.price || listing.list_price || listing.lastSoldPrice || listing.soldPrice || listing.lastSalePrice)
            : undefined;

        if (salePrice == null) continue;

        // Verify recent sales price against Zestimate
        let priceUnverified = false;
        const compZestimate = listing.zestimate;
        if (daysAgo <= 60 && typeof salePrice === 'number' && typeof compZestimate === 'number' && compZestimate > 0) {
            const pctDiff = Math.abs(salePrice - compZestimate) / compZestimate;
            if (pctDiff > 0.10) {
                priceUnverified = true;
            }
        }

        // Grading tiers
        const sqftPctDiff = subjectSqft > 0 && compSqft ? Math.abs(compSqft - subjectSqft) / subjectSqft : 1;
        const compLot = listing.lotSize ?? listing.lotAreaValue ?? undefined;
        let tier = 4;
        if (dist <= 0.25 && sqftPctDiff <= 0.10 && daysAgo <= 30) tier = 1;
        else if (dist <= 0.50 && sqftPctDiff <= 0.15 && daysAgo <= 90) tier = 2;
        else if (dist <= 0.75 && sqftPctDiff <= 0.20 && daysAgo <= 180) tier = 3;

        // Lot size penalty: demote if comp lot is >2x or <0.5x of the subject lot
        if (subjectLot > 0 && compLot > 0) {
            if (compLot > subjectLot * 2 || compLot < subjectLot * 0.5) {
                tier = Math.min(tier + 1, 4);
            }
        }

        // Time-adjusted price
        const monthsSince = daysAgo / 30.44;
        const adjPrice = Math.round(salePrice * (1 + monthlyRate) ** monthsSince);

        // IQR Outlier check
        const compPsf = compSqft && compSqft > 0 ? salePrice / compSqft : null;
        const isOutlier = compPsf != null && (compPsf < iqrLo || compPsf > iqrHi);

        mappedComps.push({
            id: String(listing.zpid || listing.id || Math.random()),
            formattedAddress: listing.formattedAddress || listing.address || '—',
            city: listing.city || '',
            state: listing.state || '',
            zipCode: listing.zipCode || '',
            latitude: cLat,
            longitude: cLng,
            bedrooms: compBeds,
            bathrooms: compBaths,
            squareFootage: compSqft,
            lotSize: compLot,
            yearBuilt: listing.yearBuilt,
            lastSaleDate: soldDateStr,
            lastSalePrice: salePrice,
            distance: Math.round(dist * 10) / 10,
            tier,
            adjustedPrice: adjPrice,
            isOutlier,
            priceUnverified,
            zestimate: compZestimate,
            imageUrl: listing.imgSrc || listing.imageUrl || undefined,
            rentZestimate: listing.rentZestimate || undefined,
            daysOnMarket: listing.daysOnZillow ?? listing.daysOnMarket ?? undefined,
        });
    }

    // Tighten comps if too many candidates
    if (mappedComps.length > 10 && subjectSqft > 0) {
        const lo = subjectSqft * 0.8;
        const hi = subjectSqft * 1.2;
        const filtered = mappedComps.filter(c => !c.squareFootage || (c.squareFootage >= lo && c.squareFootage <= hi));
        if (filtered.length >= 3) {
            mappedComps.length = 0;
            mappedComps.push(...filtered);
        }
    }

    mappedComps.sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || (a.distance ?? 99) - (b.distance ?? 99));

    try {
        // Cache the flat comps list to rentcast_comps
        await setDoc(cacheRef, stripUndefined({
            address: subjectData.address,
            comps: mappedComps.map(({ taxAssessments, propertyTaxes, ...rest }: any) => rest),
            queriedAt: Timestamp.now(),
        }));
    } catch (err: any) {
        console.warn('[CompService] Warning: Failed to write to rentcast_comps cache:', err.message);
    }

    // Filter to top eligible comps for Gemini Enrichment (tier 1-3, non-outlier, non-unverified)
    let eligibleComps = mappedComps
        .filter(c => !c.isOutlier && !c.priceUnverified && (c.tier === 1 || c.tier === 2 || c.tier === 3))
        .slice(0, 10);

    // Resilient Fallback: If no strict Tier 1-3 comps exist, relax filters to include Tier 4 comps
    if (eligibleComps.length === 0 && mappedComps.length > 0) {
        console.log('[CompService] Resilient Fallback: No Tier 1-3 comps found. Relaxing filter to allow Tier 4 matches.');
        eligibleComps = mappedComps
            .filter(c => !c.isOutlier && !c.priceUnverified)
            .slice(0, 5);
    }

    if (skipGemini) {
        return {
            rawComps: mappedComps,
            eligibleComps: eligibleComps,
            geminiResult: null,
            monthlyAppreciationRate: monthlyRate,
            subjectProperty: subjectData
        };
    }

    if (eligibleComps.length === 0) {
        return {
            rawComps: mappedComps,
            eligibleComps: [],
            geminiResult: null,
            monthlyAppreciationRate: monthlyRate,
            subjectProperty: subjectData
        };
    }

    // 7. Comp Property Specifications Enrichment
    onProgress('Enriching comp records...');
    const compDataMap = new Map<string, { description?: string; resoFacts?: any; homeType?: string }>();
    const config = APP_CONFIG.usHousingApi;

    await Promise.all(eligibleComps.map(async (c) => {
        try {
            // Check if already cached in Firestore
            for (const collectionName of ['sold_or_unlisted_properties', 'properties']) {
                const snap = await getDoc(doc(db, collectionName, c.id));
                if (snap.exists()) {
                    const d = snap.data();
                    if (d?.description && typeof d.description === 'string') {
                        compDataMap.set(c.id, {
                            description: d.description.slice(0, 500),
                            resoFacts: d.resoFacts,
                            homeType: d.homeType || d.propertyType
                        });
                        return;
                    }
                }
            }

            // Otherwise, fetch dynamically from RapidAPI US Housing
            const url = `https://${config.host}/property?zpid=${c.id}`;
            const resp = await fetch(url, {
                method: 'GET',
                headers: { 'x-rapidapi-host': config.host, 'x-rapidapi-key': config.key },
            });
            if (resp.ok) {
                const data = await resp.json();
                const root = data.property || data.props || data;
                const addrRoot = root.address || data.address;
                const description = root.description || null;
                const resoFacts = root.resoFacts || null;

                const cacheData: any = {
                    zpid: String(c.id),
                    address: c.formattedAddress,
                    city: addrRoot?.city || c.city,
                    state: addrRoot?.state || c.state,
                    description: description || null,
                    homeType: root.homeType || null,
                    bedrooms: root.bedrooms || c.bedrooms || null,
                    bathrooms: root.bathrooms || c.bathrooms || null,
                    livingAreaValue: root.livingAreaValue || root.livingArea || c.squareFootage || null,
                    yearBuilt: root.yearBuilt || c.yearBuilt || null,
                    lotSize: root.resoFacts?.lotSize || root.lotSize || null,
                    lastSalePrice: c.lastSalePrice || null,
                    lastSaleDate: c.lastSaleDate || null,
                    zestimate: root.zestimate || null,
                    resoFacts: resoFacts || null,
                    cachedAt: Timestamp.now(),
                    source: 'comp_enrichment',
                };

                await setDoc(doc(db, 'sold_or_unlisted_properties', c.id), cacheData, { merge: true });
                if (description) {
                    compDataMap.set(c.id, { description: description.slice(0, 500), resoFacts, homeType: root.homeType || undefined });
                }
            }
        } catch (e: any) {
            console.warn(`[CompService] Enrichment failed for comp ${c.id}:`, e.message);
        }
    }));

    // 8. Run parallel Gemini Normalization and USGS/ArcGIS Land Utility Analysis
    onProgress('Analyzing comparables via Gemini AI...');
    const compsListForPrompt = eligibleComps.map(c => ({
        address: c.formattedAddress,
        city: c.city,
        state: c.state,
        zpid: c.id,
        latitude: c.latitude,
        longitude: c.longitude,
        soldPrice: c.lastSalePrice,
        soldDate: c.lastSaleDate,
        listingSqFt: c.squareFootage,
        beds: c.bedrooms,
        baths: c.bathrooms,
        yearBuilt: c.yearBuilt,
        lotSize: c.lotSize,
        distance: c.distance,
        tier: c.tier,
        zestimate: c.zestimate,
        description: compDataMap.get(c.id)?.description ?? null,
        homeType: c.propertyType || compDataMap.get(c.id)?.homeType || null,
    }));

    let subjectDescription = '';
    let subjectTaxSqft: number | undefined;
    if (subjectData.zpid) {
        try {
            const subjSnap = await getDoc(doc(db, 'properties', subjectData.zpid));
            if (subjSnap.exists()) {
                const subjData = subjSnap.data();
                subjectDescription = (subjData?.description || subjData?.homeDescription || '').slice(0, 600);
                subjectTaxSqft = subjData?.livingAreaValue || subjData?.livingArea || undefined;
            }
        } catch {}
    }

    const subjectInfoStr = `${subjectData.address}, ${subjectSqft ?? '?'} sqft, ${subjectData.bedrooms ?? '?'} bed, ${subjectData.bathrooms ?? '?'} bath, ${subjectData.homeType ?? 'Single Family'}, Built ${subjectData.yearBuilt ?? '?'}, Listed at $${subjectData.listPrice?.toLocaleString() ?? '?'}, Lot ${subjectLot?.toLocaleString() ?? '?'} sqft`;
    const prompt = COMP_NORMALIZATION_PROMPT(eligibleComps.length, subjectInfoStr, subjectDescription, JSON.stringify(compsListForPrompt, null, 2));

    const [normResult, landResult] = await Promise.allSettled([
        executeGeminiRequest<any>({
            model: FLASH_LITE_MODEL,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: COMP_NORMALIZATION_SYSTEM_INSTRUCTION,
                maxOutputTokens: 8192,
            },
            userId,
            promptFilename: 'compNormalization',
            zpid: subjectData.zpid,
            address: subjectData.address,
            extractResultJson: true,
        }),
        executeLandUtilityAnalysis(
            eligibleComps.length,
            subjectInfoStr,
            compsListForPrompt,
            subjectData.zpid,
            subjectData.address,
            subjectLat,
            subjectLng,
            subjectLot,
            subjectDescription,
            subjectTaxSqft
        )
    ]);

    const normData = normResult.status === 'fulfilled' ? normResult.value.data : null;
    const landData = landResult.status === 'fulfilled' ? landResult.value.data : null;

    if (!normData && !landData) {
        throw new Error('Both AI comparable normalization and land utility analyses failed.');
    }

    // 9. Merge Results & Post-Gemini sanity checks
    onProgress('Finalizing statistical sanity checks...');
    const isSingleFamily = (homeType: string | null | undefined): boolean => {
        if (!homeType) return true;
        const ht = homeType.toLowerCase();
        const nonSFR = ['townhouse', 'townhome', 'condo', 'condominium', 'co-op', 'coop', 'apartment', 'multi', 'duplex', 'triplex', 'fourplex', 'manufactured', 'mobile'];
        return !nonSFR.some(t => ht.includes(t));
    };

    const calcUsableLot = (grossSqft: number | null | undefined, slopeCategory: string | null | undefined, slopePct: number | null | undefined) => {
        if (typeof grossSqft !== 'number' || grossSqft <= 0) return null;
        const cappedLot = Math.min(grossSqft, 30000);
        const setbackDeduction = cappedLot <= 12000 ? cappedLot * 0.25 : 3000 + (cappedLot - 12000) * 0.01;
        const afterSetback = grossSqft - setbackDeduction;

        let slopeDeductionPct = 0;
        if (typeof slopePct === 'number') {
            if (slopePct > 30) slopeDeductionPct = 85;
            else if (slopePct >= 16) slopeDeductionPct = 60;
            else if (slopePct >= 6) slopeDeductionPct = 10;
        } else {
            const cat = (slopeCategory ?? '').toLowerCase();
            if (cat.includes('heavy')) slopeDeductionPct = 85;
            else if (cat.includes('steep')) slopeDeductionPct = 60;
            else if (cat.includes('moderate')) slopeDeductionPct = 10;
        }
        const slopeDeduction = afterSetback * (slopeDeductionPct / 100);
        return {
            gross: Math.round(grossSqft),
            setback_deduction: Math.round(setbackDeduction),
            after_setback: Math.round(afterSetback),
            slope_deduction_pct: slopeDeductionPct,
            slope_deduction: Math.round(slopeDeduction),
            usable: Math.round(afterSetback - slopeDeduction),
        };
    };

    const mergedComps = (normData?.comp_analysis || []).map((ca: any) => {
        const landComp = (landData?.properties ?? []).find((lp: any) => lp.zpid === ca.zpid || lp.address === ca.address);
        const compHomeType = ca.homeType || compsListForPrompt.find((cl: any) => cl.zpid === ca.zpid || cl.address === ca.address)?.homeType || null;
        const sfOnly = isSingleFamily(compHomeType);
        const lotCalc = (sfOnly && landComp?.lot_utility) ? calcUsableLot(landComp.lot_utility.gross_lot_sqft, landComp.lot_utility.slope_category, landComp.lot_utility.slope_percent) : null;
        const lotUtil = landComp?.lot_utility ? {
            ...landComp.lot_utility,
            usable_sqft: lotCalc?.usable ?? null,
            lot_calc: lotCalc,
        } : null;
        return {
            ...ca,
            lot_utility: lotUtil,
            land_valuation: landComp?.valuation ?? null,
            _homeType: compHomeType,
        };
    });

    const subjectIsSF = isSingleFamily(subjectData.homeType);
    const subjectLotCalc = subjectIsSF ? calcUsableLot(subjectLot, landData?.subject_audit?.slope_category, landData?.subject_audit?.slope_percent) : null;
    const normSubjectAudit = normData?.subject_audit;
    const landSubjectAudit = landData?.subject_audit;
    const subjectAudit = (landSubjectAudit || normSubjectAudit) ? {
        ...(landSubjectAudit ?? {}),
        tax_sqft: normSubjectAudit?.tax_sqft ?? landSubjectAudit?.tax_sqft ?? null,
        adjustments: (() => {
            const raw = [
                ...(landSubjectAudit?.adjustments ?? []),
                ...(normSubjectAudit?.adjustments ?? []),
            ].filter(Boolean);
            const deduped: string[] = [];
            for (const item of raw) {
                const lower = item.toLowerCase().trim();
                const existingIdx = deduped.findIndex(d => {
                    const dl = d.toLowerCase().trim();
                    return dl === lower || dl.includes(lower) || lower.includes(dl);
                });
                if (existingIdx === -1) {
                    deduped.push(item.trim());
                } else if (item.trim().length < deduped[existingIdx].length) {
                    deduped[existingIdx] = item.trim();
                }
            }
            return deduped.slice(0, 8);
        })().filter(f => {
            const fl = f.toLowerCase();
            const banned = ['year built', 'lot size', 'square footage', 'sqft', 'sq ft', 'bedrooms', 'bathrooms', 'beds', 'baths', 'built in'];
            return !banned.some(b => fl.includes(b));
        }),
        usable_lot: subjectLotCalc?.usable ?? null,
        lot_calc: subjectLotCalc,
    } : null;

    // Apply statistical outlier deviation filter
    const MEDIAN_DEV_THRESHOLD = 0.20;
    const includedComps = mergedComps.filter((c: any) => c.include_in_avg && typeof c.normalized_psf === 'number');
    if (includedComps.length >= 3) {
        const psfValues = includedComps.map((c: any) => c.normalized_psf as number).sort((a: number, b: number) => a - b);
        const median = psfValues[Math.floor(psfValues.length / 2)];
        for (const c of mergedComps) {
            if (c.include_in_avg && typeof c.normalized_psf === 'number') {
                const deviation = Math.abs(c.normalized_psf - median) / median;
                if (deviation > MEDIAN_DEV_THRESHOLD) {
                    c.zyphe_excluded = true;
                    c.zyphe_exclude_reason = `$/sqft ($${Math.round(c.normalized_psf)}) deviates ${Math.round(deviation * 100)}% from median ($${Math.round(median)})`;
                }
            }
        }

        const finalComps = mergedComps
            .filter((c: any) => c.include_in_avg && !c.zyphe_excluded && typeof c.normalized_psf === 'number')
            .sort((a: any, b: any) => {
                const scA = eligibleComps.find(sc => String(sc.id) === String(a.zpid));
                const scB = eligibleComps.find(sc => String(sc.id) === String(b.zpid));
                return ((scA?.tier ?? 4) - (scB?.tier ?? 4)) || ((scA?.distance ?? 99) - (scB?.distance ?? 99));
            })
            .slice(0, 3);

        if (finalComps.length > 0) {
            for (const fc of finalComps) {
                fc.zyphe_in_avg = true;
            }
            const zypheAvgPsf = finalComps.reduce((sum: number, c: any) => sum + c.normalized_psf, 0) / finalComps.length;
            const zypheValuation = subjectSqft > 0 ? Math.round(zypheAvgPsf * subjectSqft) : null;
            if (normData) {
                normData.final_summary = {
                    ...normData.final_summary,
                    recommended_avg_psf: Math.round(zypheAvgPsf),
                    subject_valuation: zypheValuation,
                    outliers_dropped: mergedComps.filter((c: any) => c.zyphe_excluded).length,
                    comps_in_avg: finalComps.length,
                };
            }
        }
    }

    const merged = {
        ...normData,
        comp_analysis: mergedComps,
        subject_audit: subjectAudit,
        land_confidence: landData?.confidence_score ?? null,
        land_avg_psf: landData?.final_average_psf ?? null,
    };

    // Save final distress analysis back to cloud
    if (subjectData.zpid) {
        try {
            await setDoc(doc(db, 'distress_analysis', subjectData.zpid), {
                compNormalization: stripUndefined(merged),
                compNormalizationAt: new Date().toISOString(),
            }, { merge: true });
        } catch (err) {
            console.warn('[CompService] Failed to cache final analysis:', err);
        }
    }

    onProgress('Done!');
    return {
        rawComps: mappedComps,
        eligibleComps,
        geminiResult: merged,
        monthlyAppreciationRate: monthlyRate,
        subjectProperty: subjectData
    };
}
