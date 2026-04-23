import { PropertyData } from '../../types';
import { savePropertyToCloud, getPropertyFromCloud, getPropertyByAddress } from '../firebaseService';
import { APP_CONFIG } from '../../config';
import { auth } from '../firebase/config';
import { getThirdPartyDataFromCloud, saveThirdPartyDataToCloud } from '../firebaseService';
import { analyzeStreetView, analyzePollen } from '../geminiService';
import { NeighborhoodPlaces } from './places';
import { normalizeAddress } from './geocoding';
import { fetchScores, fetchPropertyImages, fetchPropertySpecs } from './property';
import { fetchNearbyPlaces } from './places';
import { fetchSolarData, fetchAirQuality, fetchPollenData, fetchNoiseScore, fetchNearbyEVChargers } from './environmental';
import { fetchHistoricalDisasters } from './disasters';
import { fetchBroadbandData } from './broadband';
import { fetchDroughtData } from './drought';
import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { getPropertyGroundTruth } from '../firebase/orientation_history';

const MAPS_API_KEY = APP_CONFIG.maps.key;

// In-memory deduplication for concurrent requests
const ongoingRequests = new Map<string, Promise<any>>();

export const fetchPropertyDataFull = async (
    addressOrZpid: string,
    isZpid: boolean = false,
    forceEnvironment: boolean = false,
    onStep?: (step: string) => void,
    skipImages: boolean = false,
    skipEnvironment: boolean = false,
    skipParcel: boolean = false
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

        // ── STEP 1: Resolve property from Firestore (no RapidAPI) ─────────────
        if (isZpid) {
            onStep?.('Looking up property by ID...');
            const cached = await getPropertyFromCloud(addressOrZpid);
            if (cached) {
                mappedData = cached;
                _mark('Firestore cache HIT (ZPID)');
                console.log(`[⏱ DataPipeline] +${_elapsed()} — Firestore cache HIT for ZPID: ${addressOrZpid}`);
            } else {
                _mark('Firestore cache MISS (ZPID)');
                console.log(`[⏱ DataPipeline] +${_elapsed()} — Firestore cache MISS for ZPID: ${addressOrZpid}`);
            }
        } else {
            // Address-based search: query Firestore properties by address field
            onStep?.('Looking up property...');
            const cached = await getPropertyByAddress(addressOrZpid);
            if (cached) {
                mappedData = cached;
                _mark('Firestore cache HIT (address)');
                console.log(`[⏱ DataPipeline] +${_elapsed()} — Firestore cache HIT for address: "${addressOrZpid}"`);
            } else {
                _mark('Firestore cache MISS (address)');
                console.log(`[⏱ DataPipeline] +${_elapsed()} — Firestore cache MISS for address: "${addressOrZpid}"`);
            }
        }

        // If neither lookup found the property, try RapidAPI to create a new record
        if (!mappedData) {
            const zpidToFetch = isZpid ? addressOrZpid : null;
            if (zpidToFetch) {
                console.log(`[DataPipeline] Property not in Firestore — fetching from RapidAPI: ${zpidToFetch}`);
                onStep?.('New property — fetching from RapidAPI...');
                try {
                    const freshSpecs = await fetchPropertySpecs(zpidToFetch);
                    if (freshSpecs) {
                        mappedData = freshSpecs as PropertyData;
                        _mark('RapidAPI fetch (new property)');
                        console.log(`[⏱ DataPipeline] +${_elapsed()} — Created new property from RapidAPI: ${zpidToFetch}`);
                    }
                } catch (e: any) {
                    console.warn(`[DataPipeline] RapidAPI fetch failed for ${zpidToFetch}:`, e.message);
                }
            }

            if (!mappedData) {
                throw new Error(
                    `Property not found in Zyphe database or RapidAPI. We currently support properties in Pleasanton and Dublin. ` +
                    `Please search using the Browse feature or autocomplete suggestions.`
                );
            }
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
            const envDocForPlaces = storageKeyForEnv ? await getThirdPartyDataFromCloud(storageKeyForEnv).catch(() => null) : null;
            const cachedPlaces = (envDocForPlaces as any)?.google_places as NeighborhoodPlaces | undefined;
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
            if (placesForUI) mappedData.google_places = placesForUI;

            // Fire-and-forget save — don't block the rest of the pipeline on a write.
            if (nearbyPlaces && needsPlacesFetch) {
                saveThirdPartyDataToCloud(String(mappedData.zpid), { google_places: nearbyPlaces } as any)
                    .catch(e => console.warn('[fetchPropertyDataFull] Places save to env doc failed:', e));
            }
            savePropertyToCloud(mappedData.zpid, mappedData).catch(e => console.warn('[fetchPropertyDataFull] Non-blocking save failed:', e));

            (mappedData as any).__cachedEnvEarly = cachedEnvEarly;
        }

        // Even if we don't have a ZPID, if we have coordinates, we can fetch Solar/Air/Pollen/AI.
        let parcelDirty = false;
        let satelliteDirty = false;
        if (mappedData.coordinates && !skipEnvironment) {
            const storageKey = mappedData.zpid || (mappedData.address ? mappedData.address.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined);

            const TTL_ENV = 60 * 24 * 60 * 60 * 1000; // 60 days for all environmental data
            const TTL_SOLAR = TTL_ENV;
            const TTL_AIR_QUALITY = TTL_ENV;
            const TTL_POLLEN = TTL_ENV;
            const TTL_NOISE = TTL_ENV;
            const TTL_DISASTERS = TTL_ENV;
            const TTL_BROADBAND = TTL_ENV;
            const TTL_DROUGHT = TTL_ENV;
            const TTL_EV = TTL_ENV;

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
                    cachedEnvData = await getThirdPartyDataFromCloud(storageKey);
                } catch (e) {
                    console.warn('Failed to check cached environmental data', e);
                }
            }
            if (cachedEnvData) onStep?.('Checking data freshness...');

            const lat = mappedData.coordinates.latitude;
            const lng = mappedData.coordinates.longitude;

            // google_environmental_data is the single source of truth for all env fields.
            // Do NOT check mappedData (properties doc) — it's not the canonical location.
            const needsSolar = !cachedEnvData?.solarData || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_SOLAR);
            const needsAirQual = !cachedEnvData?.airQuality || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_AIR_QUALITY);
            const needsPollen = !cachedEnvData?.pollen?.analysis || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_POLLEN);
            // noiseScore == null ≠ never fetched. Use noiseFetchedAt to distinguish.
            const needsNoise = !cachedEnvData?.noiseFetchedAt || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_NOISE);
            const needsDisasters = !cachedEnvData?.historical_disasters || forceEnvironment || isCacheExpired(cachedEnvData?.historical_disasters?.fetchedAt, TTL_DISASTERS);
            const needsBroadband = !cachedEnvData?.broadband || forceEnvironment || isCacheExpired(cachedEnvData?.broadband?.fetchedAt, TTL_BROADBAND);
            const needsDrought = !cachedEnvData?.drought || forceEnvironment || isCacheExpired(cachedEnvData?.drought?.fetchedAt, TTL_DROUGHT);
            const needsEV = !cachedEnvData?.evChargers || forceEnvironment || isCacheExpired(cachedEnvData?.evChargers?.fetchedAt, TTL_EV);

            const envDirty = needsSolar || needsAirQual || needsPollen || needsNoise || needsDisasters || needsBroadband || needsDrought || needsEV;
            let streetViewDirty = false;

            if (envDirty) {
                onStep?.('Fetching environmental data...');
            }

            console.log(`[⏱ DataPipeline] +${_elapsed()} — environmental parallel fetch start (solar=${needsSolar} air=${needsAirQual} pollen=${needsPollen} noise=${needsNoise} disasters=${needsDisasters} broadband=${needsBroadband} drought=${needsDrought} ev=${needsEV})`);
            _mark(`Environmental start (${[needsSolar && 'solar', needsAirQual && 'air', needsPollen && 'pollen', needsNoise && 'noise', needsDisasters && 'disasters', needsBroadband && 'broadband', needsDrought && 'drought', needsEV && 'ev'].filter(Boolean).join(', ') || 'all cached'})`);
            const [freshSolar, freshAirQual, freshPollenRaw, freshNoise, freshDisasters, freshBroadband, freshDrought, freshEV] = await Promise.all([
                needsSolar ? fetchSolarData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsAirQual ? fetchAirQuality(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsPollen ? fetchPollenData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsNoise ? fetchNoiseScore(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsDisasters ? fetchHistoricalDisasters(lat, lng, mappedData.state, mappedData.city, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsBroadband ? fetchBroadbandData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsDrought ? fetchDroughtData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsEV ? fetchNearbyEVChargers(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
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

            // 8. EV Chargers (NREL)
            if (needsEV && freshEV) {
                (mappedData as any).evChargers = freshEV;
            } else if (!needsEV && cachedEnvData?.evChargers) {
                (mappedData as any).evChargers = cachedEnvData.evChargers;
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
                    await saveThirdPartyDataToCloud(storageKey, { streetViewAnalysis: undefined });
                    mappedData.streetViewAnalysis = undefined;
                }

                const hasCoords = !!(mappedData.coordinates?.latitude && mappedData.coordinates?.longitude);
                const locationParam = hasCoords 
                    ? `${mappedData.coordinates!.latitude},${mappedData.coordinates!.longitude}`
                    : encodeURIComponent(mappedData.address);
                
                // Increase radius to 150m for suburban setbacks
                const checkRadius = 150;

                // Check Street View Metadata API first — free JSON call, no image quota.
                let imageryAvailable = false;
                try {
                    const logId = await logAPICall({
                        user_id: auth?.currentUser?.uid || 'unknown',
                        zpid: mappedData.zpid,
                        address: mappedData.address,
                        api_name: 'Google Maps',
                        endpoint: 'streetview/metadata',
                        params: { location: locationParam, radius: checkRadius, source: 'outdoor' },
                        status: 'pending'
                    });
                    const start = Date.now();

                    const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${locationParam}&radius=${checkRadius}&source=outdoor&key=${MAPS_API_KEY}`;
                    const metaResponse = await fetch(metaUrl);
                    
                    if (logId) {
                        updateAPICall(logId, {
                            status: metaResponse.ok ? 'completed' : 'failed',
                            response_time_ms: Date.now() - start,
                            error: metaResponse.ok ? undefined : `Status ${metaResponse.status}`
                        });
                    }

                    if (metaResponse.ok) {
                        const meta = await metaResponse.json();
                        imageryAvailable = meta.status === 'OK';
                        console.log(`[fetchPropertyDataFull] Street View metadata status: ${meta.status} for ${mappedData.address}`);
                    }
                } catch (metaErr: any) {
                    console.warn('[fetchPropertyDataFull] Street View metadata check failed, skipping.', metaErr.message);
                }

                if (imageryAvailable) {
                    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x800&location=${locationParam}&fov=90&radius=${checkRadius}&source=outdoor&return_error_code=true&key=${MAPS_API_KEY}`;
                    try {
                        const userId = auth?.currentUser?.uid || 'unknown';
                        const svAnalysis = await analyzeStreetView(streetViewUrl, mappedData, userId);
                        mappedData.streetViewAnalysis = svAnalysis.data;
                        console.log('[fetchPropertyDataFull] Street View analysis complete. Image URL:', mappedData.streetViewAnalysis?.imageUrl);
                        streetViewDirty = true; // Definitive: AI succeeded
                    } catch (e: any) {
                        console.warn('[fetchPropertyDataFull] Street View analysis failed.', e.message || e);
                        // DON'T set streetViewDirty — this was an AI failure, not "source unavailable"
                    }
                } else {
                    // --- STORAGE DISCOVERY FALLBACK ---
                    // Metadata check failed, but let's check if we already have it in storage
                    let storageUrl: string | null = null;
                    try {
                        const { ref, getDownloadURL } = await import('firebase/storage');
                        const { storage } = await import('../firebase/config');
                        if (storage) {
                            const svRef = ref(storage, `properties/${mappedData.zpid}/maps/street_view.jpg`);
                            storageUrl = await getDownloadURL(svRef);
                        }
                    } catch { /* ignore discovery errors */ }

                    if (storageUrl) {
                        console.log(`[fetchPropertyDataFull] Discovered existing street view in storage for ${mappedData.zpid}. Running AI analysis...`);
                        try {
                            const userId = auth?.currentUser?.uid || 'unknown';
                            const svAnalysis = await analyzeStreetView(storageUrl, mappedData, userId);
                            mappedData.streetViewAnalysis = svAnalysis.data;
                            streetViewDirty = true;
                        } catch (e: any) {
                            console.warn('[fetchPropertyDataFull] AI analysis on storage image failed:', e.message);
                        }
                    } else {
                        console.log('[fetchPropertyDataFull] No Street View imagery available (API & Storage) — skipping AI analysis.');
                        mappedData.streetViewAnalysis = undefined;
                        streetViewDirty = true; // Definitive: imagery confirmed unavailable
                    }
                }
                _mark('Street View analysis done');
            }

            // Save back to cache ONLY if something was freshly fetched
            if ((envDirty || streetViewDirty) && storageKey) {
                console.log(`[EnvironmentalCache] Saving data to cache key: ${storageKey} (envDirty=${envDirty}, svDirty=${streetViewDirty})`);
                const envPayload: Record<string, any> = {
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
                    // Timestamp lets us skip HowLoud on future runs even when score is null
                    noiseFetchedAt: needsNoise ? new Date().toISOString() : (cachedEnvData?.noiseFetchedAt ?? null),
                    zpid: mappedData.zpid || storageKey,
                    evChargers: (mappedData as any).evChargers ?? null,
                    drought: mappedData.drought ?? null,
                    broadband: (mappedData as any).broadband ?? null,
                };

                // Generic field-level audit: only mark a field as source-null if the API
                // was actually called for it (needsXXX was true) AND the result was null.
                const envFieldsPopulated: string[] = [];
                const envFieldsNull: string[] = [];
                const envFetchedFields: Record<string, { wasFetched: boolean; value: any }> = {
                    solarData:              { wasFetched: needsSolar,     value: freshSolar },
                    airQuality:             { wasFetched: needsAirQual,   value: freshAirQual },
                    pollen:                 { wasFetched: needsPollen,    value: freshPollenRaw },
                    streetViewAnalysis:     { wasFetched: streetViewDirty, value: mappedData.streetViewAnalysis },
                    historical_disasters:   { wasFetched: needsDisasters, value: freshDisasters },
                    noiseScore:             { wasFetched: needsNoise,     value: freshNoise },
                    evChargers:             { wasFetched: needsEV,        value: freshEV },
                    drought:                { wasFetched: needsDrought,   value: freshDrought },
                    broadband:              { wasFetched: needsBroadband, value: freshBroadband },
                };
                for (const [key, { wasFetched, value }] of Object.entries(envFetchedFields)) {
                    if (!wasFetched) continue; // Not fetched this run → don't record opinion
                    (value == null ? envFieldsNull : envFieldsPopulated).push(key);
                }
                envPayload._fetchMeta = {
                    environmental: {
                        lastFetched: new Date().toISOString(),
                        fieldsPopulated: envFieldsPopulated,
                        fieldsNull: envFieldsNull,
                    }
                };

                await saveThirdPartyDataToCloud(storageKey, envPayload);
                _mark('Environmental cache saved');
            } else {
                console.log(`[EnvironmentalCache] Skipping save — all data was cached, nothing new to write.`);
                _mark('Environmental cache skipped (clean)');
            }
        }

        // ── PARCEL DATA (previously lazy-loaded by ParcelValidationCard) ────────
        // Fetch ArcGIS parcel polygon, APN, and area if not already cached.
        // Skip if parcelNotFound is stamped — ArcGIS confirmed it has no record for this address.
        if (mappedData.coordinates && mappedData.zpid && !mappedData.parcelPolygon && !(mappedData as any).parcelNotFound && !skipParcel) {
            onStep?.('Fetching parcel data from ArcGIS...');
            _mark('Parcel fetch start');
            console.log(`[⏱ DataPipeline] +${_elapsed()} — parcel fetch start`);
            try {
                const { fetchParcelFromCounty, polygonToFirestore } = await import('../arcgis/countyParcels');
                const parcelResult = await fetchParcelFromCounty(
                    mappedData.coordinates.latitude,
                    mappedData.coordinates.longitude
                );
                // Always stamp fetchedAt so the smoke check can distinguish
                // "never fetched" from "fetched but ArcGIS has no record"
                (mappedData as any).parcelFetchedAt = new Date().toISOString();
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
                    parcelDirty = true;
                } else {
                    // ArcGIS returned no record — stamp as not-found to skip future redundant fetches
                    (mappedData as any).parcelNotFound = true;
                    console.log(`[Pipeline] Parcel data: ArcGIS has no record for these coordinates.`);
                    parcelDirty = true;
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
                    satelliteDirty = true;
                    console.log('[Pipeline] Satellite image cached:', satUrl.substring(0, 80) + '...');
                }
            } catch (e: any) {
                console.warn('[Pipeline] Satellite image fetch failed (non-blocking):', e.message);
            }
        }

        // Final save ONLY if parcel or satellite data was freshly fetched
        if (mappedData.zpid && (parcelDirty || satelliteDirty)) {
            console.log(`[Pipeline] Saving property (parcelDirty=${parcelDirty}, satelliteDirty=${satelliteDirty})`);
            await savePropertyToCloud(mappedData.zpid, mappedData);
        } else {
            console.log(`[Pipeline] Skipping final property save — nothing new to write.`);
        }

        _mark('COMPLETE');
        // Compute per-step durations
        for (let i = 1; i < _timings.length; i++) {
            _timings[i].dur = _timings[i].ms - _timings[i - 1].ms;
        }
        (mappedData as any).__pipeline_timings = _timings;

        // ── STEP 13: Fetch Orientation Ground Truth ──────────────────────────
        const zpid = mappedData.zpid || (isZpid ? addressOrZpid : null);
        if (zpid) {
            try {
                const gt = await getPropertyGroundTruth(zpid);
                if (gt) {
                    mappedData.orientation_ground_truth = gt;
                    console.log(`[DataPipeline] Attached orientation ground truth for ${zpid}`);
                }
            } catch (e) {
                console.warn('[DataPipeline] Failed to fetch orientation ground truth:', e);
            }
        }

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
