import { APP_CONFIG } from '../../config';
import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';
import { PropertyComp } from '../../types';
import { extractNumericValue, formatAddress } from './utils';

const RAPID_API_KEY = APP_CONFIG.usHousingApi.key;
const RAPID_API_HOST = APP_CONFIG.usHousingApi.host;

// In-memory deduplication for concurrent requests
const ongoingRequests = new Map<string, Promise<any>>();

// ─── Walk & Transit Scores ────────────────────────────────────────────────────

export const fetchScores = async (zpid: string, retries = 3): Promise<{
    walkScore?: number; walkScoreDesc?: string;
    transitScore?: number; transitScoreDesc?: string;
    bikeScore?: number; bikeScoreDesc?: string;
}> => {
    const cacheKey = `scores-${zpid}`;
    if (ongoingRequests.has(cacheKey)) return ongoingRequests.get(cacheKey)!;

    const url = `https://${RAPID_API_HOST}/walkAndTransitScore?zpid=${zpid}`;
    const promise = (async () => {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const logId = await logAPICall({
                    user_id: auth?.currentUser?.uid || 'unknown',
                    zpid: zpid,
                    api_name: 'RapidAPI',
                    endpoint: 'walkAndTransitScore',
                    params: { zpid, attempt },
                    status: 'pending'
                });
                const start = Date.now();

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'x-rapidapi-host': RAPID_API_HOST,
                        'x-rapidapi-key': RAPID_API_KEY,
                    },
                    cache: 'no-store'
                });

                if (logId) {
                    updateAPICall(logId, {
                        status: response.ok ? 'completed' : 'failed',
                        response_time_ms: Date.now() - start,
                        error: response.ok ? undefined : `Status ${response.status}`
                    });
                }

                if (!response.ok) {
                    if (response.status === 429 && attempt < retries) {
                        const delay = Math.pow(2, attempt) * 500;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    return {};
                }
                const data = await response.json();

                return {
                    walkScore: extractNumericValue(data.walkScore?.walkscore),
                    walkScoreDesc: data.walkScore?.description,
                    transitScore: extractNumericValue(data.transitScore?.transit_score),
                    transitScoreDesc: data.transitScore?.description,
                    bikeScore: extractNumericValue(data.bikeScore?.bikescore),
                    bikeScoreDesc: data.bikeScore?.description,
                };
            } catch (e) {
                if (attempt === retries) {
                    console.error('Final attempt to fetch walk/transit scores failed', e);
                    return {};
                }
                const delay = Math.pow(2, attempt) * 500;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return {};
    })();

    ongoingRequests.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        ongoingRequests.delete(cacheKey);
    }
};


// ─── Property Comps ───────────────────────────────────────────────────────────




// ─── Property Images ──────────────────────────────────────────────────────────

export const fetchPropertyImages = async (zpid: string, retries = 3): Promise<string[]> => {
    const cacheKey = `images-${zpid}`;
    if (ongoingRequests.has(cacheKey)) return ongoingRequests.get(cacheKey)!;

    const promise = (async () => {
        // Hybrid Logic: Try RESO first if keys exist
        const uid = auth?.currentUser?.uid;
        if (uid) {
            const { getUserProfile } = await import('../firebaseService');
            const profile = await getUserProfile(uid);
            const resoConfig = profile?.realtor?.resoConfig;
            if (resoConfig) {
                try {
                    const { fetchResoPropertyData } = await import('../resoService');
                    const resoData = await fetchResoPropertyData(resoConfig, zpid, true);
                    if (resoData && resoData.images && resoData.images.length > 0) {
                        console.log('[fetchPropertyImages] RESO Image Success:', zpid);
                        return resoData.images;
                    }
                } catch (e) {
                    console.warn('[RESO] Image fetch failed, falling back:', e);
                }
            }
        }

        const url = `https://${RAPID_API_HOST}/images?zpid=${zpid}`;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const logId = await logAPICall({
                    user_id: auth?.currentUser?.uid || 'unknown',
                    zpid: zpid,
                    api_name: 'RapidAPI',
                    endpoint: 'images',
                    params: { zpid, attempt },
                    status: 'pending'
                });
                const start = Date.now();

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'x-rapidapi-host': RAPID_API_HOST,
                        'x-rapidapi-key': RAPID_API_KEY,
                    },
                    cache: 'no-store'
                });

                if (logId) {
                    updateAPICall(logId, {
                        status: response.ok ? 'completed' : 'failed',
                        response_time_ms: Date.now() - start,
                        error: response.ok ? undefined : `Status ${response.status}`
                    });
                }

                if (!response.ok) {
                    if (response.status === 429 && attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    throw new Error(`Images API Error: ${response.status}`);
                }

                const data = await response.json();

                let images: any[] = [];
                if (Array.isArray(data)) images = data;
                else if (data.images && Array.isArray(data.images)) images = data.images;
                else if (data.props?.images && Array.isArray(data.props.images)) images = data.props.images;
                else if (data.property?.images && Array.isArray(data.property.images)) images = data.property.images;
                else if (data.photos && Array.isArray(data.photos)) images = data.photos;
                else if (data.props?.photos && Array.isArray(data.props.photos)) images = data.props.photos;
                else if (data.property?.photos && Array.isArray(data.property.photos)) images = data.property.photos;

                return images.map((img: any) => {
                    if (typeof img === 'string') return img;
                    if (typeof img === 'object' && img !== null) {
                        return img.url || img.uri || img.src || img.href || JSON.stringify(img);
                    }
                    return String(img);
                }).filter((img: string) => typeof img === 'string' && img.startsWith('http'));

            } catch (e) {
                if (attempt === retries) {
                    console.error(`Final attempt to fetch images failed for ZPID ${zpid}:`, e);
                    return [];
                }
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            }
        }
        return [];
    })();

    ongoingRequests.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        ongoingRequests.delete(cacheKey);
    }
};

// ─── Climate Risk Extractor ──────────────────────────────────────────────────

function extractClimateRiskDetail(climate: any) {
    if (!climate) return undefined;

    const extractDetail = (src: any) => {
        if (!src?.primary?.riskScore) return undefined;
        const p = src.primary;
        return {
            label: p.riskScore.label || undefined,
            insuranceRec: p.insuranceRecommendation || undefined,
            insuranceSeparatePolicy: p.insuranceSeparatePolicy || undefined,
            historicCount: p.historicCountAll ?? p.historicCountPropertyAll ?? undefined,
            femaZone: p.femaZone || undefined,
            probability: Array.isArray(p.probability) && p.probability.length > 0 ? p.probability : undefined,
            sourceUrl: p.source?.url || undefined,
        };
    };

    const heat = climate.heatSources?.primary;
    const air = climate.airSources?.primary;

    const result: any = {};
    if (climate.floodSources) result.flood = extractDetail(climate.floodSources);
    if (climate.fireSources) result.fire = extractDetail(climate.fireSources);
    if (climate.windSources) result.wind = extractDetail(climate.windSources);
    if (heat?.riskScore) {
        result.heat = {
            label: heat.riskScore.label || undefined,
            percentile98Temp: heat.percentile98Temp ?? undefined,
            hotDays: Array.isArray(heat.hotDays) && heat.hotDays.length > 0 ? heat.hotDays : undefined,
            sourceUrl: heat.source?.url || undefined,
        };
    }
    if (air?.riskScore) {
        result.air = {
            label: air.riskScore.label || undefined,
            badAirDays: Array.isArray(air.badAirDays) && air.badAirDays.length > 0 ? air.badAirDays : undefined,
            sourceUrl: air.source?.url || undefined,
        };
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

// ─── Lightweight Property Specs (comp enrichment) ────────────────────────────

export const fetchPropertySpecs = async (zpid: string, retries = 3): Promise<Record<string, any> | null> => {
    const url = `https://${RAPID_API_HOST}/property?zpid=${zpid}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        const logId = await logAPICall({
            user_id: auth?.currentUser?.uid || 'unknown',
            zpid,
            api_name: 'RapidAPI',
            endpoint: 'property-specs',
            params: { zpid, attempt },
            status: 'pending'
        });
        const start = Date.now();

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-rapidapi-host': RAPID_API_HOST,
                    'x-rapidapi-key': RAPID_API_KEY,
                },
                cache: 'no-store'
            });

            if (logId) {
                updateAPICall(logId, {
                    status: response.ok ? 'completed' : 'failed',
                    response_time_ms: Date.now() - start,
                    error: response.ok ? undefined : `Status ${response.status}`
                });
            }

            if (!response.ok) {
                if (response.status === 429 && attempt < retries) {
                    const delay = Math.pow(2, attempt) * 500;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                return null;
            }

            const data = await response.json();
            const root = data.property || data.props || data;
            const addrRoot = root.address || data.address;
            const resoRaw = root.resoFacts || {};

            // Map ALL available fields from RapidAPI to PropertyData schema
            const mapped: Record<string, any> = {
                // Identity
                zpid,
                address: formatAddress(addrRoot) || undefined,
                city: addrRoot?.city,
                state: addrRoot?.state,
                zipCode: addrRoot?.zipcode || addrRoot?.zipCode,
                subdivision: addrRoot?.subdivision || addrRoot?.community || undefined,
                county: root.county || undefined,
                countyFIPS: root.countyFIPS || root.countyFips || undefined,
                pageViewCount: extractNumericValue(root.pageViewCount),
                favoriteCount: extractNumericValue(root.favoriteCount),

                // Core Specs
                homeStatus: root.homeStatus,
                homeType: root.homeType,
                bedrooms: extractNumericValue(root.bedrooms),
                bathrooms: extractNumericValue(root.bathrooms),
                livingAreaValue: extractNumericValue(root.livingAreaValue || root.livingArea),
                yearBuilt: extractNumericValue(root.yearBuilt),
                lotSize: resoRaw.lotSize || root.lotSize || undefined,
                description: root.description || undefined,

                // Pricing
                price: extractNumericValue(root.price || root.listPrice),
                zestimate: extractNumericValue(root.zestimate),
                rentZestimate: extractNumericValue(root.rentZestimate),
                propertyTaxRate: extractNumericValue(root.propertyTaxRate),
                annualHomeownersInsurance: extractNumericValue(root.annualHomeownersInsurance),

                // Risk Scores — mapper normalizes from various RapidAPI response shapes into flat fields
                windRiskScore: extractNumericValue(root.windRiskScore ?? root.climate?.windSources?.primary?.riskScore?.value),
                floodRiskScore: extractNumericValue(root.floodRiskScore ?? root.climate?.floodSources?.primary?.riskScore?.value),
                fireRiskScore: extractNumericValue(root.fireRiskScore ?? root.climate?.fireSources?.primary?.riskScore?.value),
                heatRiskScore: extractNumericValue(root.heatRiskScore ?? root.climate?.heatSources?.primary?.riskScore?.value),

                // Full climate risk detail (First Street Foundation)
                climateRiskDetail: root.climate ? extractClimateRiskDetail(root.climate) : undefined,

                // Dates
                lastSoldDate: root.dateSold || null,
                listedDate: root.datePosted || root.listingDateTimeOnMarket || undefined,
                timeOnZillow: extractNumericValue(root.timeOnZillow || resoRaw.daysOnZillow),

                // Location
                coordinates: root.longitude && root.latitude
                    ? { latitude: root.latitude, longitude: root.longitude }
                    : undefined,

                // Images from the property endpoint
                images: root.images || root.responsivePhotos?.map((p: any) => p.mixedSources?.jpeg?.[0]?.url || p.url) || undefined,

                // Schools
                schools: root.schools?.map((s: any) => ({
                    name: s.name || s.link?.split('/')?.pop()?.replace(/-/g, ' ') || 'Unknown',
                    level: s.level || s.grades || 'N/A',
                    rating: s.rating ?? s.score ?? 'N/A',
                    distance: s.distance ? `${s.distance} mi` : 'N/A',
                })) || undefined,

                // Price History
                priceHistory: root.priceHistory?.map((ph: any) => ({
                    date: ph.date || '',
                    price: extractNumericValue(ph.price),
                    event: ph.event || ph.priceChangeRate ? `${ph.event || 'Change'} (${ph.priceChangeRate})` : (ph.event || ''),
                })) || undefined,

                // ResoFacts (detailed property features)
                resoFacts: Object.keys(resoRaw).length > 0 ? {
                    flooring: resoRaw.flooring,
                    foundationDetails: resoRaw.foundationDetails,
                    rooms: resoRaw.rooms,
                    roomTypes: resoRaw.roomTypes,
                    feesAndDues: resoRaw.feesAndDues,
                    exteriorFeatures: resoRaw.exteriorFeatures,
                    architecturalStyle: resoRaw.architecturalStyle,
                    garageParkingCapacity: resoRaw.garageParkingCapacity,
                    lotFeatures: resoRaw.lotFeatures,
                    roofType: resoRaw.roofType,
                    daysOnZillow: extractNumericValue(resoRaw.daysOnZillow),
                    zoningDescription: resoRaw.zoningDescription,
                    constructionMaterials: resoRaw.constructionMaterials,
                    fireplaceFeatures: resoRaw.fireplaceFeatures,
                    appliances: resoRaw.appliances,
                    fencing: resoRaw.fencing,
                    cooling: resoRaw.cooling,
                    laundryFeatures: resoRaw.laundryFeatures,
                    heating: resoRaw.heating,
                    mlsid: resoRaw.mlsid,
                    utilities: resoRaw.utilities,
                    sewer: resoRaw.sewer,
                    waterSource: resoRaw.waterSource,
                    basement: resoRaw.basement,
                    securityFeatures: resoRaw.securityFeatures,
                    windowFeatures: resoRaw.windowFeatures,
                    roomFeatures: resoRaw.roomFeatures,
                    // New fields
                    numberOfUnitsInCommunity: extractNumericValue(resoRaw.numberOfUnitsInCommunity),
                    stories: extractNumericValue(resoRaw.stories ?? resoRaw.storiesDecimal),
                    parkingFeatures: resoRaw.parkingFeatures || undefined,
                    interiorFeatures: resoRaw.interiorFeatures || undefined,
                    propertyCondition: resoRaw.propertyCondition || undefined,
                    electric: resoRaw.electric || undefined,
                } : undefined,

                // HOA
                hoa: (root.monthlyHoaFee || root.hoaFee || resoRaw.associationAmenities) ? {
                    fee: root.monthlyHoaFee ? `$${root.monthlyHoaFee} monthly` : (root.hoaFee || resoRaw.hoaFee || undefined),
                    name: resoRaw.associationName || undefined,
                    phone: resoRaw.associationPhone || undefined,
                    amenities: resoRaw.associationAmenities || undefined,
                    feeIncludes: resoRaw.associationFeeIncludes || undefined,
                } : undefined,

                // Attribution
                attribution: root.attributionInfo ? {
                    listingAgentName: root.attributionInfo.agentName || undefined,
                    listingAgentNumber: root.attributionInfo.agentPhoneNumber || undefined,
                    brokerageName: root.attributionInfo.brokerName || undefined,
                    mlsName: root.attributionInfo.mlsName || undefined,
                    mlsId: root.attributionInfo.mlsId || resoRaw.mlsid || undefined,
                } : undefined,

                // Listing subtype flags
                listingSubType: root.listingSubType || undefined,
            };

            // Strip undefined values to avoid overwriting existing data with undefined on merge
            return Object.fromEntries(Object.entries(mapped).filter(([_, v]) => v !== undefined));
        } catch (e: any) {
            if (logId) {
                updateAPICall(logId, {
                    status: 'failed',
                    response_time_ms: Date.now() - start,
                    error: e.message
                });
            }
            if (attempt === retries) {
                console.warn(`[fetchPropertySpecs] ${zpid} final attempt failed:`, e.message);
                return null;
            }
            const delay = Math.pow(2, attempt) * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
};

