import { PropertyData } from '../../types';
import { savePropertyToCloud, getPropertyFromCloud, getUserProfile } from '../firebaseService';
import { APP_CONFIG } from '../../config';
import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';
import { getGoogleDataFromCloud, saveGoogleDataToCloud } from '../firebaseService';
import { analyzeStreetView, analyzePollen } from '../geminiService';
import { fetchResoPropertyData } from '../resoService';
import { NeighborhoodPlaces } from './places';
import { extractNumericValue, safeStringify, formatAddress } from './utils';
import { normalizeAddress } from './geocoding';
import { fetchScores, fetchPropertyComps, fetchPropertyImages } from './property';
import { fetchNearbyPlaces } from './places';
import { fetchSolarData, fetchAirQuality, fetchPollenData, fetchNoiseScore } from './environmental';

const MAPS_API_KEY = APP_CONFIG.maps.key;

// In-memory deduplication for concurrent requests
const ongoingRequests = new Map<string, Promise<any>>();

export const fetchPropertyDataFull = async (
    addressOrZpid: string,
    isZpid: boolean = false,
    forceEnvironment: boolean = false,
    onStep?: (step: string) => void,
    skipImages: boolean = false
): Promise<PropertyData> => {
    const cacheKey = `data-full-${addressOrZpid}`;

    const promise = (async () => {
        let mappedData: PropertyData | null = null;

        if (isZpid) {
            const cached = await getPropertyFromCloud(addressOrZpid);
            if (cached) {
                mappedData = cached;
                console.log('[fetchPropertyDataFull] Found cached property data for ZPID:', addressOrZpid);
            }
        }

        if (!mappedData) {
            // Hybrid Ingest Logic: Try RESO Web API first if the user (Realtor) has provided keys
            const uid = auth?.currentUser?.uid;
            if (uid) {
                const profile = await getUserProfile(uid);
                const resoConfig = profile?.realtor?.resoConfig;

                if (resoConfig) {
                    onStep?.('Accessing RESO Web API...');
                    try {
                        const resoData = await fetchResoPropertyData(resoConfig, addressOrZpid, isZpid);
                        if (resoData) {
                            console.log('[fetchPropertyDataFull] RESO API Success:', addressOrZpid);
                            mappedData = resoData;
                        }
                    } catch (e) {
                        console.warn('[RESO] Fetch failed, falling back to legacy ingest:', e);
                    }
                }
            }
        }

        if (!mappedData) {
            const RAPID_API_KEY = APP_CONFIG.usHousingApi.key;
            const RAPID_API_HOST = APP_CONFIG.usHousingApi.host;

            const url = isZpid
                ? `https://${RAPID_API_HOST}/property?zpid=${addressOrZpid}`
                : `https://${RAPID_API_HOST}/property?address=${encodeURIComponent(addressOrZpid)}`;

            let response;
            const retries = 3;
            for (let attempt = 1; attempt <= retries; attempt++) {
                onStep?.(`Fetching property facts... ${attempt > 1 ? `(Retry ${attempt - 1})` : ''}`);

                const logId = await logAPICall({
                    user_id: auth?.currentUser?.uid || 'unknown',
                    zpid: isZpid ? addressOrZpid : undefined,
                    address: isZpid ? undefined : addressOrZpid,
                    api_name: 'RapidAPI',
                    endpoint: 'property',
                    params: { addressOrZpid, isZpid, attempt },
                    status: 'pending'
                });
                const start = Date.now();

                response = await fetch(url, {
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

                if (response.ok) break;

                if (response.status === 429 && attempt < retries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.warn(`[API] Rate limit (429) hit on attempt ${attempt}. Retrying in ${delay / 1000}s...`);
                    onStep?.(`Rate limit hit. Retrying in ${delay / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                throw new Error(`Property API error: ${response.status}`);
            }

            if (!response || !response.ok) throw new Error(`Property API error: ${response?.status || 'Unknown'}`);
            const data = await response.json();

            // Universal ZPID extraction: Check root, property wrapper, or props wrapper
            const rawZpid = data.zpid || data.property?.zpid || data.props?.zpid;
            const zpidStr = rawZpid ? String(rawZpid) : undefined;

            if (!zpidStr) {
                console.warn("API Warning: Response missing 'zpid'. Proceeding with limited data.", JSON.stringify(data, null, 2));
            }

            if (!isZpid && zpidStr) {
                const cached = await getPropertyFromCloud(zpidStr);
                if (cached) {
                    mappedData = cached;
                    console.log('[fetchPropertyDataFull] Found cached property data for found ZPID:', zpidStr);
                }
            }

            if (!mappedData) {
                const root = data.property || data.props || data;
                const addrRoot = root.address || data.address;

                mappedData = {
                    address: formatAddress(addrRoot) || (isZpid ? '' : addressOrZpid),
                    city: (addrRoot && typeof addrRoot === 'object') ? addrRoot.city : undefined,
                    state: (addrRoot && typeof addrRoot === 'object') ? addrRoot.state : undefined,
                    zipCode: (addrRoot && typeof addrRoot === 'object') ? (addrRoot.zipcode || addrRoot.zipCode) : undefined,
                    zpid: zpidStr,
                    homeStatus: root.homeStatus,
                    homeType: root.homeType,
                    listingSubType: root.listingSubType ?? null,
                    livingAreaValue: extractNumericValue(root.livingAreaValue || root.livingArea),
                    bedrooms: extractNumericValue(root.bedrooms),
                    bathrooms: extractNumericValue(root.bathrooms),
                    yearBuilt: extractNumericValue(root.yearBuilt),
                    lotSize: safeStringify(root.resoFacts?.lotSize || root.lotSize) || 'N/A',
                    price: extractNumericValue(root.price || root.listPrice),
                    zestimate: extractNumericValue(root.zestimate),
                    rentZestimate: extractNumericValue(root.rentZestimate),
                    annualHomeownersInsurance: extractNumericValue(root.annualHomeownersInsurance),
                    windRiskScore: extractNumericValue(root.climate?.windSources?.primary?.riskScore),
                    floodRiskScore: extractNumericValue(root.climate?.floodSources?.primary?.riskScore),
                    fireRiskScore: extractNumericValue(root.climate?.fireSources?.primary?.riskScore),
                    heatRiskScore: extractNumericValue(root.climate?.heatRiskScore),
                    description: root.description || 'No description available.',
                    images: Array.isArray(root.images) ? root.images : (Array.isArray(root.photos) ? root.photos : []),
                    schools: Array.isArray(root.schools) ? root.schools : [],
                    listedDate: root.datePosted || null,
                    priceHistory: (Array.isArray(root.priceHistory) ? root.priceHistory : []).map((item: any) => ({
                        date: item.date || 'N/A',
                        price: extractNumericValue(item.price),
                        event: item.event || 'Price Change'
                    })),
                    resoFacts: {
                        flooring: safeStringify(root.resoFacts?.flooring),
                        foundationDetails: safeStringify(root.resoFacts?.foundationDetails),
                        rooms: safeStringify(root.resoFacts?.rooms),
                        roomTypes: safeStringify(root.resoFacts?.roomTypes),
                        feesAndDues: safeStringify(root.resoFacts?.feesAndDues),
                        exteriorFeatures: safeStringify(root.resoFacts?.exteriorFeatures),
                        architecturalStyle: safeStringify(root.resoFacts?.architecturalStyle),
                        garageParkingCapacity: extractNumericValue(root.resoFacts?.garageParkingCapacity),
                        lotFeatures: safeStringify(root.resoFacts?.lotFeatures),
                        roofType: safeStringify(root.resoFacts?.roofType),
                        daysOnZillow: extractNumericValue(root.daysOnZillow || root.resoFacts?.daysOnZillow),
                        constructionMaterials: safeStringify(root.resoFacts?.constructionMaterials),
                        fireplaceFeatures: safeStringify(root.resoFacts?.fireplaceFeatures),
                        appliances: safeStringify(root.resoFacts?.appliances),
                        fencing: safeStringify(root.resoFacts?.fencing),
                        cooling: safeStringify(root.resoFacts?.cooling),
                        laundryFeatures: safeStringify(root.resoFacts?.laundryFeatures),
                        heating: safeStringify(root.resoFacts?.heating),
                        basement: safeStringify(root.resoFacts?.basement),
                        utilities: safeStringify(root.resoFacts?.utilities),
                        sewer: safeStringify(root.resoFacts?.sewer),
                        waterSource: safeStringify(root.resoFacts?.waterSource),
                        securityFeatures: safeStringify(root.resoFacts?.securityFeatures),
                        windowFeatures: safeStringify(root.resoFacts?.windowFeatures),
                        roomFeatures: safeStringify(root.resoFacts?.roomFeatures),
                    },
                    // ─── HOA / Association ───────────────────────────────────────────────
                    hoa: (() => {
                        const rf = root.resoFacts;
                        if (!rf) return undefined;
                        const assoc = Array.isArray(rf.associations) && rf.associations.length > 0
                            ? rf.associations[0]
                            : null;
                        const name = assoc?.name || rf.associationName || undefined;
                        const fee = assoc?.feeFrequency || rf.associationFee || undefined;
                        const phone = assoc?.phone || rf.associationPhone || undefined;
                        const amenities: string[] = Array.isArray(rf.associationAmenities) ? rf.associationAmenities.filter(Boolean) : [];
                        const feeIncludes: string[] = Array.isArray(rf.associationFeeIncludes) ? rf.associationFeeIncludes.filter(Boolean) : [];
                        if (!name && !fee && amenities.length === 0) return undefined;
                        return { name, fee, phone, amenities, feeIncludes };
                    })(),
                    coordinates: root.longitude && root.latitude ? { latitude: root.latitude, longitude: root.longitude } : undefined,
                    attribution: root.attributionInfo || data.attributionInfo ? {
                        listingAgentName: (root.attributionInfo || data.attributionInfo)?.agentName,
                        listingAgentNumber: data.attributionInfo?.agentPhoneNumber || data.props?.attributionInfo?.agentPhoneNumber,
                        brokerageName: data.attributionInfo?.brokerageName || data.props?.attributionInfo?.brokerageName,
                        mlsName: data.attributionInfo?.mlsName || data.props?.attributionInfo?.mlsName,
                        mlsId: data.attributionInfo?.mlsId || data.props?.attributionInfo?.mlsId,
                    } : undefined
                };
            }
        }

        // At this point, mappedData is populated either from Cache or API.
        if (!mappedData) {
            throw new Error('Failed to resolve property data.');
        }

        // Ensure fallback coordinate geocoding runs if needed (even for cached data if they are missing)
        if ((!mappedData.coordinates || !mappedData.mapZoomOut) && mappedData.address) {
            try {
                console.log('[Solar Fallback] Geocoding address for solar data...');
                const geocoded = await normalizeAddress(mappedData.address, mappedData.zpid);
                if (geocoded.coordinates) {
                    mappedData.coordinates = geocoded.coordinates;
                    mappedData.mapZoomIn = geocoded.mapZoomIn;
                    mappedData.mapZoomOut = geocoded.mapZoomOut;
                    // NOTE: We intentionally do NOT overwrite mappedData.address here.
                    // The address identity is resolved upstream (in App.tsx performSearch).
                    // Overwriting it here caused city-flipping bugs (e.g., Dublin → Pleasanton)
                    // because Radar's geocoder may return a neighboring city as its top result.
                }
            } catch (e) {
                console.warn('[Solar Fallback] Failed to geocode address:', e);
            }
        }

        if (mappedData.zpid) {
            onStep?.('Loading property data...');

            const needsImages = !skipImages && (!mappedData.images || mappedData.images.length === 0);
            const storageKeyForEnv = mappedData.zpid || (mappedData.address ? mappedData.address.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined);
            const coordsForPlaces = mappedData.coordinates;

            // Cache guard for Google Places: skip if already fetched within 30 days.
            const envDocForPlaces = storageKeyForEnv ? await getGoogleDataFromCloud(storageKeyForEnv).catch(() => null) : null;
            const cachedPlaces = (envDocForPlaces as any)?.neighborhoodPlaces as NeighborhoodPlaces | undefined;
            const placesCachedAt = cachedPlaces?.fetchedAt;
            const placesFresh = placesCachedAt && (Date.now() - placesCachedAt) < 30 * 24 * 60 * 60 * 1000; // 30 days

            const needsPlacesFetch = coordsForPlaces && (!placesFresh || forceEnvironment || !cachedPlaces?.isUnified);

            const [scores, images, comps, nearbyPlaces] = await Promise.all([
                fetchScores(mappedData.zpid),
                needsImages ? fetchPropertyImages(mappedData.zpid) : Promise.resolve(mappedData.images ?? []),
                fetchPropertyComps(mappedData.zpid),
                needsPlacesFetch
                    ? fetchNearbyPlaces(coordsForPlaces!.latitude, coordsForPlaces!.longitude, mappedData.zpid, mappedData.address, cachedPlaces, forceEnvironment).catch(() => null)
                    : Promise.resolve(cachedPlaces ?? null),
            ]);

            const cachedEnvEarly = envDocForPlaces;

            mappedData.walkScore = scores.walkScore;
            mappedData.walkScoreDesc = scores.walkScoreDesc;
            mappedData.transitScore = scores.transitScore;
            mappedData.transitScoreDesc = scores.transitScoreDesc;
            mappedData.bikeScore = scores.bikeScore;
            mappedData.bikeScoreDesc = scores.bikeScoreDesc;
            if (needsImages && images.length > 0) mappedData.images = images;
            mappedData.comps = comps;
            const placesForUI = nearbyPlaces ?? cachedPlaces ?? null;
            if (placesForUI) mappedData.neighborhoodPlaces = placesForUI;

            // Fire-and-forget save — don't block the rest of the pipeline on a write.
            if (nearbyPlaces && needsPlacesFetch) {
                saveGoogleDataToCloud(String(mappedData.zpid), { neighborhoodPlaces: nearbyPlaces })
                    .catch(e => console.warn('[fetchPropertyDataFull] Places save to env doc failed:', e));
            }
            savePropertyToCloud(mappedData.zpid, mappedData).catch(e => console.warn('[fetchPropertyDataFull] Non-blocking save failed:', e));

            (mappedData as any).__cachedEnvEarly = cachedEnvEarly;
        }

        // INDEPENDENT ENVIRONMENTAL CHECK:
        // Even if we don't have a ZPID, if we have coordinates, we can fetch Solar/Air/Pollen/AI.
        if (mappedData.coordinates) {
            const storageKey = mappedData.zpid || (mappedData.address ? mappedData.address.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined);

            // Google Maps Platform Terms of Service Caching Limits (TTLs)
            const TTL_SOLAR = 30 * 24 * 60 * 60 * 1000;
            const TTL_AIR_QUALITY = 24 * 60 * 60 * 1000;
            const TTL_POLLEN = 365 * 24 * 60 * 60 * 1000;
            const TTL_NOISE = 30 * 24 * 60 * 60 * 1000;

            const isCacheExpired = (lastUpdated: any, ttl: number) => {
                if (!lastUpdated) return true;
                const now = Date.now();
                const updatedMs = lastUpdated.toMillis ? lastUpdated.toMillis() : new Date(lastUpdated).getTime();
                return (now - updatedMs) > ttl;
            };

            // Re-use the env cache already fetched in parallel above (if available), otherwise fetch now.
            let cachedEnvData: any = (mappedData as any).__cachedEnvEarly ?? null;
            delete (mappedData as any).__cachedEnvEarly;
            if (!cachedEnvData && storageKey) {
                try {
                    console.log(`[EnvironmentalCache] Checking cache for key: ${storageKey}`);
                    cachedEnvData = await getGoogleDataFromCloud(storageKey);
                } catch (e) {
                    console.warn('Failed to check cached environmental data', e);
                }
            }
            if (cachedEnvData) onStep?.('Checking data freshness...');

            const lat = mappedData.coordinates.latitude;
            const lng = mappedData.coordinates.longitude;

            const needsSolar = !cachedEnvData?.solarData || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_SOLAR);
            const needsAirQual = !cachedEnvData?.airQuality || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_AIR_QUALITY);
            const needsPollen = !cachedEnvData?.pollen?.analysis || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_POLLEN);
            const needsNoise = cachedEnvData?.noiseScore == null || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_NOISE);

            if (needsSolar || needsAirQual || needsPollen || needsNoise) {
                onStep?.('Fetching environmental data...');
            }

            const [freshSolar, freshAirQual, freshPollenRaw, freshNoise] = await Promise.all([
                needsSolar ? fetchSolarData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsAirQual ? fetchAirQuality(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsPollen ? fetchPollenData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsNoise ? fetchNoiseScore(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
            ]);

            // 1. Solar
            mappedData.solarData = needsSolar ? freshSolar : cachedEnvData.solarData;

            // 2. Air Quality
            mappedData.airQuality = needsAirQual ? freshAirQual : cachedEnvData.airQuality;

            // 3. Pollen — if fresh raw data arrived, run Gemini analysis on it
            if (needsPollen) {
                if (freshPollenRaw) {
                    try {
                        const userId = auth?.currentUser?.uid || 'unknown';
                        const pollenAnalysis = await analyzePollen(freshPollenRaw, mappedData, userId);
                        mappedData.pollen = { ...freshPollenRaw, analysis: pollenAnalysis.data };
                    } catch (e) {
                        console.warn('Pollen analysis failed, using raw data only:', e);
                        mappedData.pollen = freshPollenRaw;
                    }
                }
            } else {
                mappedData.pollen = cachedEnvData.pollen;
            }

            // 4. Noise
            if (needsNoise && freshNoise) {
                mappedData.noiseScore = freshNoise.score;
                mappedData.noiseScoreDesc = freshNoise.description ?? undefined;
                mappedData.noiseTrafficScore = freshNoise.trafficScore;
                mappedData.noiseTrafficDesc = freshNoise.trafficDesc ?? undefined;
                mappedData.noiseLocalScore = freshNoise.localScore;
                mappedData.noiseLocalDesc = freshNoise.localDesc ?? undefined;
                mappedData.noiseAirportScore = freshNoise.airportScore;
                mappedData.noiseAirportDesc = freshNoise.airportDesc ?? undefined;
            } else if (!needsNoise) {
                mappedData.noiseScore = cachedEnvData.noiseScore;
                mappedData.noiseScoreDesc = cachedEnvData.noiseScoreDesc;
                mappedData.noiseTrafficScore = cachedEnvData.noiseTrafficScore;
                mappedData.noiseTrafficDesc = cachedEnvData.noiseTrafficDesc;
                mappedData.noiseLocalScore = cachedEnvData.noiseLocalScore;
                mappedData.noiseLocalDesc = cachedEnvData.noiseLocalDesc;
                mappedData.noiseAirportScore = cachedEnvData.noiseAirportScore;
                mappedData.noiseAirportDesc = cachedEnvData.noiseAirportDesc;
            }

            // 5. AI Street View Analysis
            if (cachedEnvData?.streetViewAnalysis?.imageUrl && cachedEnvData?.streetViewAnalysis?.privacyRating && !forceEnvironment) {
                console.log('[fetchPropertyDataFull] Using cached Street View analysis.');
                mappedData.streetViewAnalysis = cachedEnvData.streetViewAnalysis;
            } else {
                onStep?.('Analyzing curb appeal with AI...');

                if (forceEnvironment && storageKey && cachedEnvData?.streetViewAnalysis) {
                    console.log('[fetchPropertyDataFull] Clearing stale streetViewAnalysis from cache before re-analysis.');
                    await saveGoogleDataToCloud(storageKey, { streetViewAnalysis: undefined });
                    mappedData.streetViewAnalysis = undefined;
                }

                const encodedAddress = encodeURIComponent(mappedData.address);

                // Check Street View Metadata API first — free JSON call, no image quota.
                let imageryAvailable = false;
                try {
                    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodedAddress}&radius=100&source=outdoor&key=${MAPS_API_KEY}`;
                    const metaResponse = await fetch(metaUrl);
                    if (metaResponse.ok) {
                        const meta = await metaResponse.json();
                        imageryAvailable = meta.status === 'OK';
                        console.log(`[fetchPropertyDataFull] Street View metadata status: ${meta.status} for ${mappedData.address}`);
                    }
                } catch (metaErr: any) {
                    console.warn('[fetchPropertyDataFull] Street View metadata check failed, skipping.', metaErr.message);
                }

                if (imageryAvailable) {
                    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${encodedAddress}&fov=90&radius=100&source=outdoor&return_error_code=true&key=${MAPS_API_KEY}`;
                    try {
                        const userId = auth?.currentUser?.uid || 'unknown';
                        const svAnalysis = await analyzeStreetView(streetViewUrl, mappedData, userId);
                        mappedData.streetViewAnalysis = svAnalysis.data;
                        console.log('[fetchPropertyDataFull] Street View analysis complete. Image URL:', mappedData.streetViewAnalysis?.imageUrl);
                    } catch (e: any) {
                        console.warn('[fetchPropertyDataFull] Street View analysis failed.', e.message || e);
                    }
                } else {
                    console.log('[fetchPropertyDataFull] No Street View imagery available — skipping AI analysis.');
                    mappedData.streetViewAnalysis = undefined;
                }
            }

            // Save back to cache (merge with existing)
            if (storageKey) {
                console.log(`[EnvironmentalCache] Saving data to cache key: ${storageKey}`);
                await saveGoogleDataToCloud(storageKey, {
                    solarData: mappedData.solarData,
                    airQuality: mappedData.airQuality,
                    pollen: mappedData.pollen,
                    streetViewAnalysis: mappedData.streetViewAnalysis,
                    noiseScore: mappedData.noiseScore ?? null,
                    noiseScoreDesc: mappedData.noiseScoreDesc ?? null,
                    noiseTrafficScore: mappedData.noiseTrafficScore ?? null,
                    noiseTrafficDesc: mappedData.noiseTrafficDesc ?? null,
                    noiseLocalScore: mappedData.noiseLocalScore ?? null,
                    noiseLocalDesc: mappedData.noiseLocalDesc ?? null,
                    noiseAirportScore: mappedData.noiseAirportScore ?? null,
                    noiseAirportDesc: mappedData.noiseAirportDesc ?? null,
                    zpid: mappedData.zpid || storageKey
                });
            } else {
                console.warn('[EnvironmentalCache] Skipping save: No ZPID or Address available for key.');
            }
        }

        // Final save attempt if we have a ZPID (in case we added environmental data)
        if (mappedData.zpid) {
            await savePropertyToCloud(mappedData.zpid, mappedData);
        }

        return mappedData;
    })();

    ongoingRequests.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        ongoingRequests.delete(cacheKey);
    }
};

export const fetchPropertyData = async (address: string): Promise<PropertyData> => {
    return fetchPropertyDataFull(address, false, false);
};
