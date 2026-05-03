import { PropertyData } from '../../types';
import { savePropertyToCloud, getPropertyFromCloud, getPropertyByAddress, getPropertyAssetsFromCloud } from '../firebaseService';
import { APP_CONFIG } from '../../config';
import { auth } from '../firebase/config';
import { getThirdPartyDataFromCloud, saveThirdPartyDataToCloud } from '../firebaseService';
import { analyzeStreetView, analyzePollen } from '../geminiService';
import { NeighborhoodPlaces } from './places';
import { normalizeAddress } from './geocoding';
import { fetchScores, fetchPropertySpecs } from './property';
import { fetchNearbyPlaces } from './places';
import { fetchSolarData, fetchAirQuality, fetchPollenData, fetchNearbyEVChargers } from './environmental';
import { fetchHistoricalDisasters } from './disasters';
import { fetchBroadbandData } from './broadband';
import { fetchDroughtData } from './drought';
import { fetchNearbyFaults } from './faults';
import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { getPropertyGroundTruth } from '../firebase/orientation_history';
import { calculateZypheNoiseScore } from './osmNoise';
import { prefetchExploreCache } from '../exploreCachePrefetch';

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

            // Kick off ExploreTab cache reads in parallel with the rest of the
            // pipeline. The hook will await the same promise and skip its own
            // Firestore round-trips. Fire-and-forget — failures are handled by
            // the consumer.
            void prefetchExploreCache(String(mappedData.zpid), mappedData.city, mappedData.state);

            const needsScores = !mappedData.walkScore && !mappedData.transitScore;
            const needsImagesFromAssets = !skipImages && (!mappedData.images || mappedData.images.length === 0);
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
            const [scores, assetImages, nearbyPlaces] = await Promise.all([
                needsScores ? fetchScores(mappedData.zpid) : Promise.resolve(null),
                // Read pre-secured Firebase Storage URLs from the assets doc.
                // We never call the RapidAPI /images endpoint at page-load time —
                // image ingestion happens via the batch / heal pipeline (assetService).
                needsImagesFromAssets
                    ? getPropertyAssetsFromCloud(mappedData.zpid).then(a => a?.images ?? []).catch(() => [])
                    : Promise.resolve(mappedData.images ?? []),
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

            const imagesUpdated = needsImagesFromAssets && assetImages.length > 0;
            if (imagesUpdated) mappedData.images = assetImages;
            const placesForUI = nearbyPlaces ?? cachedPlaces ?? null;
            if (placesForUI) mappedData.google_places = placesForUI;

            // Fire-and-forget save — don't block the rest of the pipeline on a write.
            if (nearbyPlaces && needsPlacesFetch) {
                saveThirdPartyDataToCloud(String(mappedData.zpid), { google_places: nearbyPlaces } as any)
                    .catch(e => console.warn('[fetchPropertyDataFull] Places save to env doc failed:', e));
            }
            // Skip the property-doc rewrite when nothing on the main doc changed.
            // (Environmental fields live in `thirdparty_data`, not on the property doc.)
            const mainDocDirty = !!scores || imagesUpdated;
            if (mainDocDirty) {
                savePropertyToCloud(mappedData.zpid, mappedData).catch(e => console.warn('[fetchPropertyDataFull] Non-blocking save failed:', e));
            }

            (mappedData as any).__cachedEnvEarly = cachedEnvEarly;
        }

        // Even if we don't have a ZPID, if we have coordinates, we can fetch Solar/Air/Pollen/AI.
        if (mappedData.coordinates && !skipEnvironment) {
            const storageKey = mappedData.zpid || (mappedData.address ? mappedData.address.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined);

            const TTL_ENV = 60 * 24 * 60 * 60 * 1000; // 60 days for all environmental data
            const TTL_SOLAR = TTL_ENV;
            const TTL_AIR_QUALITY = TTL_ENV;
            const TTL_POLLEN = TTL_ENV;
            const TTL_DISASTERS = TTL_ENV;
            const TTL_BROADBAND = TTL_ENV;
            const TTL_DROUGHT = TTL_ENV;
            const TTL_EV = TTL_ENV;
            const TTL_ZYPHE_NOISE = TTL_ENV;

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
            // Each "needs*" flag uses its own per-field timestamp so a single field
            // refresh doesn't cascade into refetching everything via the doc-wide
            // `lastUpdated`. HowLoud is intentionally not fetched at load time —
            // Zyphe's proprietary noise simulation is the canonical noise source.
            const needsSolar = !cachedEnvData?.solarData || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_SOLAR);
            const needsAirQual = !cachedEnvData?.airQuality || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_AIR_QUALITY);
            const needsPollen = !cachedEnvData?.pollen?.analysis || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_POLLEN);
            const needsDisasters = !cachedEnvData?.historical_disasters || forceEnvironment || isCacheExpired(cachedEnvData?.historical_disasters?.fetchedAt, TTL_DISASTERS);
            const needsBroadband = !cachedEnvData?.broadband || forceEnvironment || isCacheExpired(cachedEnvData?.broadband?.fetchedAt, TTL_BROADBAND);
            const needsDrought = !cachedEnvData?.drought || forceEnvironment || isCacheExpired(cachedEnvData?.drought?.fetchedAt, TTL_DROUGHT);
            const needsFaults = !cachedEnvData?.faults || forceEnvironment || isCacheExpired(cachedEnvData?.faults?.fetchedAt, TTL_ENV);
            const needsEV = !cachedEnvData?.evChargers || forceEnvironment || isCacheExpired(cachedEnvData?.evChargers?.fetchedAt, TTL_EV);
            const needsZypheNoise = !cachedEnvData?.noiseSimulationFetchedAt || forceEnvironment || isCacheExpired(cachedEnvData?.noiseSimulationFetchedAt, TTL_ZYPHE_NOISE);

            const envDirty = needsSolar || needsAirQual || needsPollen || needsDisasters || needsBroadband || needsDrought || needsFaults || needsEV || needsZypheNoise;
            let streetViewDirty = false;

            if (envDirty) {
                onStep?.('Fetching environmental data...');
            }

            console.log(`[⏱ DataPipeline] +${_elapsed()} — environmental parallel fetch start (solar=${needsSolar} air=${needsAirQual} pollen=${needsPollen} disasters=${needsDisasters} broadband=${needsBroadband} drought=${needsDrought} faults=${needsFaults} ev=${needsEV} zypheNoise=${needsZypheNoise})`);
            _mark(`Environmental start (${[needsSolar && 'solar', needsAirQual && 'air', needsPollen && 'pollen', needsDisasters && 'disasters', needsBroadband && 'broadband', needsDrought && 'drought', needsFaults && 'faults', needsEV && 'ev', needsZypheNoise && 'zypheNoise'].filter(Boolean).join(', ') || 'all cached'})`);
            const [freshSolar, freshAirQual, freshPollenRaw, freshDisasters, freshBroadband, freshDrought, freshFaults, freshEV, freshZypheNoise] = await Promise.all([
                needsSolar ? fetchSolarData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsAirQual ? fetchAirQuality(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsPollen ? fetchPollenData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsDisasters ? fetchHistoricalDisasters(lat, lng, mappedData.state, mappedData.city, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsBroadband ? fetchBroadbandData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsDrought ? fetchDroughtData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsFaults ? fetchNearbyFaults(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsEV ? fetchNearbyEVChargers(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
                needsZypheNoise ? calculateZypheNoiseScore(lat, lng) : Promise.resolve(null),
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

            // 4. HowLoud noise — read cached values only. Load-time fetching has been
            // removed; Zyphe's proprietary noise simulation (below) is canonical.
            if (cachedEnvData) {
                mappedData.noiseScore = cachedEnvData.noiseScore ?? undefined;
                mappedData.noiseScoreDesc = cachedEnvData.noiseScoreDesc ?? undefined;
                mappedData.noiseTrafficScore = cachedEnvData.noiseTrafficScore ?? undefined;
                mappedData.noiseTrafficDesc = cachedEnvData.noiseTrafficDesc ?? undefined;
                mappedData.noiseLocalScore = cachedEnvData.noiseLocalScore ?? undefined;
                mappedData.noiseLocalDesc = cachedEnvData.noiseLocalDesc ?? undefined;
                mappedData.noiseAirportScore = cachedEnvData.noiseAirportScore ?? undefined;
                mappedData.noiseAirportDesc = cachedEnvData.noiseAirportDesc ?? undefined;
            }

            // 4b. Zyphe Proprietary Noise Simulation
            if (needsZypheNoise && freshZypheNoise) {
                mappedData.zypheNoiseScore = freshZypheNoise.score;
                mappedData.noiseCharacterization = freshZypheNoise.characterization;
                mappedData.primaryNoiseSource = freshZypheNoise.primarySource;
            } else if (!needsZypheNoise) {
                mappedData.zypheNoiseScore = cachedEnvData.zypheNoiseScore;
                mappedData.noiseCharacterization = cachedEnvData.noiseCharacterization;
                mappedData.primaryNoiseSource = cachedEnvData.primaryNoiseSource;
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

            // 8. Faults
            if (needsFaults && freshFaults) {
                (mappedData as any).faults = freshFaults;
            } else if (!needsFaults && cachedEnvData?.faults) {
                (mappedData as any).faults = cachedEnvData.faults;
            }

            // 8. EV Chargers (NREL)
            if (needsEV && freshEV) {
                (mappedData as any).evChargers = freshEV;
            } else if (!needsEV && cachedEnvData?.evChargers) {
                (mappedData as any).evChargers = cachedEnvData.evChargers;
            }
            
            // 9. Commute Destinations — read from batch-pre-generated cache only (no browser fetch)
            if (cachedEnvData?.commuteDestinations) {
                (mappedData as any).commuteDestinations = cachedEnvData.commuteDestinations;
            }

            // 6. AI Street View Analysis
            // Gate on imageUrl only — re-running Gemini at page-load time just to
            // backfill an optional sub-field (e.g. privacyRating) blows ~10s+ on
            // every visit. Heal pipelines are responsible for filling missing
            // sub-fields, not the read path.
            if (cachedEnvData?.streetViewAnalysis?.imageUrl && !forceEnvironment) {
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
                    // HowLoud is no longer fetched at load time; preserve any
                    // historic noiseFetchedAt so cache forensics still work.
                    noiseFetchedAt: cachedEnvData?.noiseFetchedAt ?? null,
                    zpid: mappedData.zpid || storageKey,
                    evChargers: (mappedData as any).evChargers ?? null,
                    drought: mappedData.drought ?? null,
                    faults: (mappedData as any).faults ?? null,
                    broadband: (mappedData as any).broadband ?? null,
                    commuteDestinations: (mappedData as any).commuteDestinations ?? null,
                    zypheNoiseScore: mappedData.zypheNoiseScore ?? null,
                    noiseCharacterization: mappedData.noiseCharacterization ?? null,
                    primaryNoiseSource: mappedData.primaryNoiseSource ?? null,
                    noiseSimulationFetchedAt: needsZypheNoise ? new Date().toISOString() : (cachedEnvData?.noiseSimulationFetchedAt ?? null),
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
                    evChargers:             { wasFetched: needsEV,        value: freshEV },
                    drought:                { wasFetched: needsDrought,   value: freshDrought },
                    faults:                 { wasFetched: needsFaults,    value: freshFaults },
                    broadband:              { wasFetched: needsBroadband, value: freshBroadband },
                    commuteDestinations:    { wasFetched: false,          value: null },
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

        // Parcel + satellite ingestion live in the heal pipeline
        // (functions/shared/propertyUtils.js: _enrichParcelData, _enrichSatelliteImage).
        // The page-load path is read-only; if a property is missing parcel or satellite
        // data, it surfaces as a smoke-test failure and gets healed out-of-band.
        void skipParcel;

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
