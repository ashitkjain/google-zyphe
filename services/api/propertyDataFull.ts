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
import { fetchScores, fetchPropertyImages } from './property';
import { fetchNearbyPlaces } from './places';
import { fetchSolarData, fetchAirQuality, fetchPollenData, fetchNoiseScore } from './environmental';
import { fetchHistoricalDisasters } from './disasters';
import { fetchBroadbandData } from './broadband';
import { fetchDroughtData } from './drought';

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
        const _t0 = performance.now();
        const _elapsed = () => `${(performance.now() - _t0).toFixed(0)}ms`;
        const _elapsedMs = () => Math.round(performance.now() - _t0);
        const _timings: { step: string; ms: number; dur?: number }[] = [];
        const _mark = (step: string) => { _timings.push({ step, ms: _elapsedMs() }); };
        console.log(`[⏱ DataPipeline] START fetchPropertyDataFull: "${addressOrZpid}" (isZpid=${isZpid})`);
        let mappedData: PropertyData | null = null;

        if (isZpid) {
            const cached = await getPropertyFromCloud(addressOrZpid);
            if (cached) {
                mappedData = cached;
                _mark('Firestore cache HIT (ZPID)');
                console.log(`[⏱ DataPipeline] +${_elapsed()} — Firestore cache HIT for ZPID: ${addressOrZpid}`);
            } else {
                console.log(`[⏱ DataPipeline] +${_elapsed()} — Firestore cache MISS for ZPID: ${addressOrZpid}`);
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
            console.log(`[⏱ DataPipeline] +${_elapsed()} — RapidAPI response received`);
            _mark('RapidAPI response');
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
                    _mark('Firestore cache HIT (resolved ZPID)');
                    console.log(`[⏱ DataPipeline] +${_elapsed()} — Firestore cache HIT for resolved ZPID: ${zpidStr}`);
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

            const needsScores = !mappedData.walkScore && !mappedData.transitScore;
            const needsImages = !skipImages && (!mappedData.images || mappedData.images.length === 0);
            const storageKeyForEnv = mappedData.zpid || (mappedData.address ? mappedData.address.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined);
            const coordsForPlaces = mappedData.coordinates;

            // Cache guard for Google Places: skip if already fetched within 30 days.
            const envDocForPlaces = storageKeyForEnv ? await getGoogleDataFromCloud(storageKeyForEnv).catch(() => null) : null;
            const cachedPlaces = (envDocForPlaces as any)?.neighborhoodPlaces as NeighborhoodPlaces | undefined;
            const placesCachedAt = cachedPlaces?.fetchedAt;
            const placesFresh = placesCachedAt && (Date.now() - placesCachedAt) < 30 * 24 * 60 * 60 * 1000; // 30 days

            const needsPlacesFetch = coordsForPlaces && (!placesFresh || forceEnvironment || !cachedPlaces?.isUnified);

            console.log(`[⏱ DataPipeline] +${_elapsed()} — scores/images/places parallel fetch start`);
            _mark('Scores/images/places start');
            const [scores, images, nearbyPlaces] = await Promise.all([
                needsScores ? fetchScores(mappedData.zpid) : Promise.resolve(null),
                needsImages ? fetchPropertyImages(mappedData.zpid) : Promise.resolve(mappedData.images ?? []),
                needsPlacesFetch
                    ? fetchNearbyPlaces(coordsForPlaces!.latitude, coordsForPlaces!.longitude, mappedData.zpid, mappedData.address, cachedPlaces, forceEnvironment).catch(() => null)
                    : Promise.resolve(cachedPlaces ?? null),
            ]);
            console.log(`[⏱ DataPipeline] +${_elapsed()} — scores/images/places done`);
            _mark('Scores/images/places done');

            const cachedEnvEarly = envDocForPlaces;

            if (scores) {
                mappedData.walkScore = scores.walkScore;
                mappedData.walkScoreDesc = scores.walkScoreDesc;
                mappedData.transitScore = scores.transitScore;
                mappedData.transitScoreDesc = scores.transitScoreDesc;
                mappedData.bikeScore = scores.bikeScore;
                mappedData.bikeScoreDesc = scores.bikeScoreDesc;
            }

            if (needsImages && images.length > 0) mappedData.images = images;
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

            const TTL_ENV = 60 * 24 * 60 * 60 * 1000; // 60 days for all environmental data
            const TTL_SOLAR = TTL_ENV;
            const TTL_AIR_QUALITY = TTL_ENV;
            const TTL_POLLEN = TTL_ENV;
            const TTL_NOISE = TTL_ENV;
            const TTL_DISASTERS = TTL_ENV;
            const TTL_BROADBAND = TTL_ENV;
            const TTL_DROUGHT = TTL_ENV;

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
            const needsDisasters = !cachedEnvData?.historical_disasters || forceEnvironment || isCacheExpired(cachedEnvData?.historical_disasters?.fetchedAt, TTL_DISASTERS);
            const needsBroadband = !cachedEnvData?.broadband || forceEnvironment || isCacheExpired(cachedEnvData?.broadband?.fetchedAt, TTL_BROADBAND);
            const needsDrought = !cachedEnvData?.drought || forceEnvironment || isCacheExpired(cachedEnvData?.drought?.fetchedAt, TTL_DROUGHT);

            if (needsSolar || needsAirQual || needsPollen || needsNoise || needsDisasters || needsBroadband || needsDrought) {
                onStep?.('Fetching environmental data...');
            }

            console.log(`[⏱ DataPipeline] +${_elapsed()} — environmental parallel fetch start (solar=${needsSolar} air=${needsAirQual} pollen=${needsPollen} noise=${needsNoise} disasters=${needsDisasters} broadband=${needsBroadband} drought=${needsDrought})`);
            _mark(`Environmental start (${[needsSolar && 'solar', needsAirQual && 'air', needsPollen && 'pollen', needsNoise && 'noise', needsDisasters && 'disasters', needsBroadband && 'broadband', needsDrought && 'drought'].filter(Boolean).join(', ') || 'all cached'})`);
            const [freshSolar, freshAirQual, freshPollenRaw, freshNoise, freshDisasters, freshBroadband, freshDrought] = await Promise.all([
                needsSolar ? fetchSolarData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsAirQual ? fetchAirQuality(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsPollen ? fetchPollenData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsNoise ? fetchNoiseScore(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsDisasters ? fetchHistoricalDisasters(lat, lng, mappedData.state, mappedData.city, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsBroadband ? fetchBroadbandData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsDrought ? fetchDroughtData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
            ]);
            console.log(`[⏱ DataPipeline] +${_elapsed()} — environmental parallel fetch done`);
            _mark('Environmental done');

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

            // 5. Historical Disasters
            if (needsDisasters && freshDisasters) {
                mappedData.historical_disasters = freshDisasters;
            } else if (!needsDisasters && cachedEnvData?.historical_disasters) {
                mappedData.historical_disasters = cachedEnvData.historical_disasters;
            }

            // 6. Broadband
            if (needsBroadband && freshBroadband) {
                mappedData.broadband = freshBroadband;
            } else if (!needsBroadband && cachedEnvData?.broadband) {
                mappedData.broadband = cachedEnvData.broadband;
            }

            // 7. Drought
            if (needsDrought && freshDrought) {
                mappedData.drought = freshDrought;
            } else if (!needsDrought && cachedEnvData?.drought) {
                mappedData.drought = cachedEnvData.drought;
            }

            // 6. AI Street View Analysis
            if (cachedEnvData?.streetViewAnalysis?.imageUrl && cachedEnvData?.streetViewAnalysis?.privacyRating && !forceEnvironment) {
                console.log('[fetchPropertyDataFull] Using cached Street View analysis.');
                mappedData.streetViewAnalysis = cachedEnvData.streetViewAnalysis;
                _mark('Street View (cached)');
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
                    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x800&location=${encodedAddress}&fov=90&radius=100&source=outdoor&return_error_code=true&key=${MAPS_API_KEY}`;
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
                _mark('Street View analysis done');
            }

            // Save back to cache (merge with existing)
            if (storageKey) {
                console.log(`[EnvironmentalCache] Saving data to cache key: ${storageKey}`);
                await saveGoogleDataToCloud(storageKey, {
                    solarData: mappedData.solarData,
                    airQuality: mappedData.airQuality,
                    pollen: mappedData.pollen,
                    streetViewAnalysis: mappedData.streetViewAnalysis,
                    historical_disasters: mappedData.historical_disasters ?? null,
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
            _mark('Environmental cache saved');
        }

        // ── PARCEL DATA (previously lazy-loaded by ParcelValidationCard) ────────
        // Fetch ArcGIS parcel polygon, APN, and area if not already cached.
        if (mappedData.coordinates && mappedData.zpid && !mappedData.parcelPolygon) {
            onStep?.('Fetching parcel data from ArcGIS...');
            _mark('Parcel fetch start');
            console.log(`[⏱ DataPipeline] +${_elapsed()} — parcel fetch start`);
            try {
                const { fetchParcelFromCounty, polygonToFirestore } = await import('../arcgis/countyParcels');
                const parcelResult = await fetchParcelFromCounty(
                    mappedData.coordinates.latitude,
                    mappedData.coordinates.longitude
                );
                if (parcelResult) {
                    (mappedData as any).parcelPolygon = polygonToFirestore(parcelResult.polygon);
                    (mappedData as any).parcelApn = parcelResult.apn;
                    (mappedData as any).parcelAreaSqft = parcelResult.areaSqft;
                    (mappedData as any).parcelCounty = parcelResult.county;
                    (mappedData as any).parcelCachedAt = new Date().toISOString();
                    if (parcelResult.buildingSqft && parcelResult.buildingSqft > 0) {
                        (mappedData as any).taxSqft = parcelResult.buildingSqft;
                        (mappedData as any).taxSqftSource = `ArcGIS ${parcelResult.county}`;
                    }
                    console.log(`[Pipeline] Parcel data fetched: APN=${parcelResult.apn}, area=${parcelResult.areaSqft}sf, county=${parcelResult.county}`);
                }
            } catch (e: any) {
                console.warn('[Pipeline] ArcGIS parcel fetch failed (non-blocking):', e.message);
            }
        }

        // ── SATELLITE IMAGE (previously lazy-loaded by orientation UI) ────────
        // Fetch Google satellite image and upload to Firebase Storage if not already cached.
        if (mappedData.coordinates && mappedData.zpid && !mappedData.satelliteImageUrl) {
            onStep?.('Caching satellite image...');
            _mark('Satellite image start');
            console.log(`[⏱ DataPipeline] +${_elapsed()} — satellite image fetch start`);
            try {
                const { getOrCacheAerialSatelliteUrl } = await import('../satellitaryService');
                const satUrl = await getOrCacheAerialSatelliteUrl(
                    mappedData.zpid,
                    mappedData.coordinates.latitude,
                    mappedData.coordinates.longitude
                );
                if (satUrl) {
                    mappedData.satelliteImageUrl = satUrl;
                    console.log('[Pipeline] Satellite image cached:', satUrl.substring(0, 80) + '...');
                }
            } catch (e: any) {
                console.warn('[Pipeline] Satellite image fetch failed (non-blocking):', e.message);
            }
        }

        // Final save attempt if we have a ZPID (in case we added environmental data)
        if (mappedData.zpid) {
            await savePropertyToCloud(mappedData.zpid, mappedData);
        }

        _mark('COMPLETE');
        // Compute per-step durations
        for (let i = 1; i < _timings.length; i++) {
            _timings[i].dur = _timings[i].ms - _timings[i - 1].ms;
        }
        (mappedData as any).__pipeline_timings = _timings;
        console.log(`%c[⏱ DataPipeline] +${_elapsed()} — COMPLETE`, 'color: #22c55e; font-weight: bold;');
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
