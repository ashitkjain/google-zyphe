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

export const fetchScores = async (zpid: string): Promise<{
    walkScore?: number; walkScoreDesc?: string;
    transitScore?: number; transitScoreDesc?: string;
    bikeScore?: number; bikeScoreDesc?: string;
}> => {
    const cacheKey = `scores-${zpid}`;
    if (ongoingRequests.has(cacheKey)) return ongoingRequests.get(cacheKey)!;

    const url = `https://${RAPID_API_HOST}/walkAndTransitScore?zpid=${zpid}`;
    const promise = (async () => {
        try {
            const logId = await logAPICall({
                user_id: auth?.currentUser?.uid || 'unknown',
                zpid: zpid,
                api_name: 'RapidAPI',
                endpoint: 'walkAndTransitScore',
                params: { zpid },
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

            if (!response.ok) return {};
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
            console.error('Failed to fetch walk/transit scores', e);
            return {};
        }
    })();

    ongoingRequests.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        ongoingRequests.delete(cacheKey);
    }
};

// ─── Property Comps ───────────────────────────────────────────────────────────

export const fetchPropertyComps = async (zpid: string): Promise<PropertyComp[]> => {
    const cacheKey = `comps-${zpid}`;
    if (ongoingRequests.has(cacheKey)) return ongoingRequests.get(cacheKey)!;

    const url = `https://${RAPID_API_HOST}/propertyComps?zpid=${zpid}`;
    const promise = (async () => {
        try {
            const logId = await logAPICall({
                user_id: auth?.currentUser?.uid || 'unknown',
                zpid: zpid,
                api_name: 'RapidAPI',
                endpoint: 'propertyComps',
                params: { zpid },
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

            if (!response.ok) return [];
            const data = await response.json();

            let comps: any[] = [];
            if (Array.isArray(data)) comps = data;
            else if (data.comps && Array.isArray(data.comps)) comps = data.comps;
            else if (data.props?.comps && Array.isArray(data.props.comps)) comps = data.props.comps;

            return comps.map((c: any) => {
                const price = extractNumericValue(c.price);
                const livingArea = extractNumericValue(c.livingAreaValue || c.livingArea);
                const ppsf = price > 0 && livingArea > 0 ? Math.round(price / livingArea) : undefined;

                return {
                    zpid: String(c.zpid),
                    address: formatAddress(c.address),
                    price: price,
                    listPrice: extractNumericValue(c.listPrice || c.originalPrice),
                    bedrooms: extractNumericValue(c.bedrooms),
                    bathrooms: extractNumericValue(c.bathrooms),
                    livingAreaValue: livingArea,
                    yearBuilt: extractNumericValue(c.yearBuilt),
                    distance: extractNumericValue(c.distance),
                    daysOnMarket: extractNumericValue(c.daysOnMarket || c.daysOnZillow),
                    status: c.homeStatus || c.statusText || c.status,
                    images: Array.isArray(c.images) ? c.images : [c.imgSrc].filter(Boolean),
                    homeType: c.homeType,
                    lastSoldPrice: extractNumericValue(c.lastSoldPrice || c.last_sold_price),
                    lastSoldDate: c.lastSoldDate || c.last_sold_date,
                    lotAreaValue: extractNumericValue(c.lotAreaValue),
                    lotAreaUnit: c.lotAreaUnit,
                    lotSize: c.lotAreaValue ? `${c.lotAreaValue} ${c.lotAreaUnit || 'sqft'}` : undefined,
                    garageSpaces: extractNumericValue(c.garageSpaces),
                    pricePerSqFt: ppsf,
                    description: c.description || c.hsh_notes,
                    hoaFees: extractNumericValue(c.hoaFee || c.monthlyHoaFee)
                };
            }).slice(0, 6);
        } catch (e) {
            console.error('Failed to fetch property comps', e);
            return [];
        }
    })();

    ongoingRequests.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        ongoingRequests.delete(cacheKey);
    }
};

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

// ─── Lightweight Property Specs (comp enrichment) ────────────────────────────

export const fetchPropertySpecs = async (zpid: string): Promise<Record<string, any> | null> => {
    const url = `https://${RAPID_API_HOST}/property?zpid=${zpid}`;
    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid,
        api_name: 'RapidAPI',
        endpoint: 'property-specs',
        params: { zpid },
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
        if (!response.ok) {
            await logAPICall({ user_id: auth?.currentUser?.uid || 'unknown', zpid, api_name: 'RapidAPI', endpoint: 'property-specs', params: { zpid }, status: 'failed', response_time_ms: Date.now() - start, error: `HTTP ${response.status}` });
            return null;
        }
        const data = await response.json();
        await logAPICall({ user_id: auth?.currentUser?.uid || 'unknown', zpid, api_name: 'RapidAPI', endpoint: 'property-specs', params: { zpid }, status: 'completed', response_time_ms: Date.now() - start });
        const root = data.property || data.props || data;
        const addrRoot = root.address || data.address;
        return {
            zpid,
            address: formatAddress(addrRoot) || undefined,
            city: addrRoot?.city,
            state: addrRoot?.state,
            zipCode: addrRoot?.zipcode || addrRoot?.zipCode,
            homeStatus: root.homeStatus,
            homeType: root.homeType,
            bedrooms: extractNumericValue(root.bedrooms),
            bathrooms: extractNumericValue(root.bathrooms),
            livingAreaValue: extractNumericValue(root.livingAreaValue || root.livingArea),
            yearBuilt: extractNumericValue(root.yearBuilt),
            lotSize: root.resoFacts?.lotSize || root.lotSize || undefined,
            price: extractNumericValue(root.price || root.listPrice),
            zestimate: extractNumericValue(root.zestimate),
            rentZestimate: extractNumericValue(root.rentZestimate),
            lastSoldDate: root.datePosted || null,
            coordinates: root.longitude && root.latitude ? { latitude: root.latitude, longitude: root.longitude } : undefined,
        };
    } catch (e: any) {
        console.warn(`[fetchPropertySpecs] ${zpid} failed:`, e.message);
        return null;
    }
};
