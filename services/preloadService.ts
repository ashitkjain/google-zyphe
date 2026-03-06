
import { normalizeAddress, fetchPropertyDataFull, fetchPropertyImages } from './apiService.ts';
import {
  analyzePropertyImages,
  analyzeNeighborhood,
  analyzeCommunityPulse,
  analyzeComprehensive,
  analyzeInvestmentResearch,
  analyzeGeneralMarketIntelligence,
  runBackgroundCityResearch,
  AiResponseError
} from './geminiService.ts';
import {
  savePropertyToCloud,
  saveVisualAnalysisToCloud,
  getVisualAnalysisFromCloud,
  saveComprehensiveAnalysisToCloud,
  saveImageQualityAnalysisToCloud,
  getImageQualityAnalysisFromCloud,
  savePropertyInvestmentToCloud,
  getPropertyInvestmentFromCloud,
  saveGeneralMarketIntelligenceToCloud,
  getGeneralMarketIntelligenceFromCloud,
  getDeepInvestmentResearchFromCloud,
  saveDeepInvestmentResearchToCloud,
  savePropertyAssetsToCloud,
  getPropertyAssetsFromCloud,
  saveCommunityPulseToCloud,
  getCommunityPulseFromCloud,
  generateCityStateKey
} from './firebaseService.ts';
import { PropertyData, CustomAIAnalysisResult, PropertySpecificInvestmentResult, GeneralMarketIntelligenceResult, AIUsage } from '../types';
import { uploadRemoteImageToStorage } from './firebase/storage.ts';
import { securePropertyAssets } from './assetService';

export interface PipelineProgress {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message: string;
  usage?: AIUsage;
}

export const runFullIntelligencePipeline = async (
  rawAddress: string,
  onProgress: (p: PipelineProgress) => void,
  providedZpid?: string,
  userId: string = 'unknown',
  onLog?: (msg: string) => void,
  skipMissingCityData: boolean = false
): Promise<{ zpid: string; warnings: string[] }> => {
  try {
    // 1 & 3. Geocoding & Property Data (Parallel)
    onProgress({ step: 'Discovery', status: 'running', message: 'Mapping location and fetching specifications...' });
    const [radar, propData] = await Promise.all([
      normalizeAddress(rawAddress, providedZpid),
      fetchPropertyDataFull(providedZpid || rawAddress, !!providedZpid, false)
    ]);

    const address = radar.formattedAddress;
    const zpid = propData.zpid || providedZpid;
    onLog?.(`[Geocode] Address: ${address}`);
    onLog?.(`[Pipeline] Resolved ZPID: ${zpid}`);

    if (!zpid) throw new Error("Could not resolve ZPID for property.");
    onProgress({ step: 'Discovery', status: 'completed', message: `Found ${address}` });

    // 4. Gallery Fetch
    onProgress({ step: 'Gallery', status: 'running', message: 'Syncing complete photo gallery...' });
    try {
      const fullImages = await fetchPropertyImages(zpid);
      if (fullImages && fullImages.length > (propData.images?.length || 0)) {
        onLog?.(`[Gallery] Discovered ${fullImages.length} images.`);
        propData.images = fullImages;
      }
    } catch (e) {
      console.warn("[Gallery] Gallery sync failed, using summary photos:", e);
    }

    // --- ASSET PERSISTENCE ---
    onProgress({ step: 'Cloud Storage', status: 'running', message: 'Securing imagery and maps...' });
    const assets = await securePropertyAssets(
      zpid,
      propData.images || [],
      { zoomIn: radar.mapZoomIn, zoomOut: radar.mapZoomOut },
      (p) => onLog?.(`[Assets] ${p.message}`)
    );

    const alternate_ids = [...(propData.alternate_ids || [])];
    if (providedZpid && providedZpid !== zpid && !alternate_ids.includes(providedZpid)) {
      alternate_ids.push(providedZpid);
    }

    const enrichedData: PropertyData = {
      ...propData,
      zpid: zpid,
      feed_property_id: providedZpid,
      alternate_ids,
      images: assets.images,
      coordinates: radar.coordinates,
      mapZoomIn: assets.mapZoomIn,
      mapZoomOut: assets.mapZoomOut,
      address: address
    };
    await savePropertyToCloud(zpid, enrichedData);
    onProgress({ step: 'Cloud Storage', status: 'completed', message: 'Assets secured.' });

    // --- PARALLEL AI INTELLIGENCE BLOCK ---
    onProgress({ step: 'Intelligence', status: 'running', message: 'Running parallel AI evaluation suite...' });

    const city = radar.components?.city || propData.city;
    const state = radar.components?.state || propData.state;
    const cityStateKey = generateCityStateKey(city, state);
    onLog?.(`[Pipeline] Location context: ${city}, ${state} (Key: ${cityStateKey})`);

    // Prepare Parallel Tasks
    const isAnalysisComplete = (res: any, imageCount: number = 0) => {
      if (!res) return { valid: false, missing: ["No data returned"] };
      const missing = [];
      const hasInterior = !!(res.home_interior?.overall_description && res.home_interior.overall_description.length > 50);
      const hasExterior = !!(res.exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style);

      // If we have no images, it's expected that room highlights will be empty.
      // If we HAVE images, the AI really should find rooms, but we shouldn't 
      // block the entire pipeline if it fails to extract them (we'll just have a warning).
      const hasRooms = !!(res.room_highlights && res.room_highlights.length > 0);

      if (!hasInterior) missing.push("Interior description (short or missing)");
      if (!hasExterior) missing.push("Exterior analysis");

      // We no longer Hard Block on room highlights if image count is low or AI is being difficult.
      // But we will log it if it's missing when we expected it.
      if (imageCount > 0 && !hasRooms) {
        onLog?.(`[Visual] Warning: 0 room highlights extracted despite having ${imageCount} images.`);
      }

      return {
        valid: missing.length === 0, // Only interior/exterior are hard requirements
        missing
      };
    };

    const visualTask = async () => {
      const cached = await getVisualAnalysisFromCloud(zpid);

      // Cache validation: only hit if reasonably complete
      if (cached) {
        const check = isAnalysisComplete(cached, enrichedData.images?.length || 0);
        if (check.valid) {
          const cachedImgCount = cached.image_by_image_analysis?.length || 0;
          const currentImgCount = enrichedData.images?.length || 0;
          if (cachedImgCount >= currentImgCount) {
            onLog?.(`[Visual] Cache hit (${currentImgCount} images)`);
            return cached;
          }
        }
      }

      const tryAnalysis = async (attempt: number): Promise<any> => {
        onLog?.(`[Visual] Running analysis (attempt ${attempt}/2)...`);
        const res = await analyzePropertyImages(enrichedData.images!, enrichedData, userId);

        if (res.data) {
          const dataStatus = Array.isArray(res.data) ? 'Array' : typeof res.data;
          const keys = Object.keys(res.data);
          onLog?.(`[Visual] Received ${dataStatus} from AI with ${keys.length} top-level fields.`);
        }

        const check = isAnalysisComplete(res.data, enrichedData.images?.length || 0);

        if (check.valid) {
          onLog?.(`[Visual] Analysis complete.`);
          return res.data;
        }

        // Structural mismatch (array instead of object)
        if (Array.isArray(res.data)) {
          onLog?.(`[Visual] Attempt ${attempt}: AI returned an array (${res.data.length} items) instead of object.`);
          return { _incomplete: true, _reason: 'structural_array', raw: res.data };
        }

        // Incomplete object
        onLog?.(`[Visual] Attempt ${attempt}: Incomplete — missing: ${check.missing?.join(', ')}.`);
        return { _incomplete: true, _reason: 'missing_fields', _missing: check.missing, ...(res.data || {}) };
      };

      // Attempt 1
      const result1 = await tryAnalysis(1);
      if (!result1?._incomplete) return result1;

      // Auto-retry after brief pause
      onLog?.(`[Visual] Retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));

      // Attempt 2
      const result2 = await tryAnalysis(2);
      if (!result2?._incomplete) return result2;

      // Both attempts failed — save partial and continue pipeline
      onLog?.(`[Visual] Both attempts incomplete. Saving partial data, pipeline will continue.`);
      const partialToSave = result2._reason === 'structural_array'
        ? { _structuralError: true, raw: result2.raw } as any
        : result2;
      await saveVisualAnalysisToCloud(zpid, partialToSave);
      return null;
    };

    const neighborhoodTask = async () => {
      if (!assets.mapZoomIn || !assets.mapZoomOut) return null;
      onLog?.(`[Spatial] Mapping neighborhood...`);
      const res = await analyzeNeighborhood(assets.mapZoomIn, assets.mapZoomOut, enrichedData, userId);
      onLog?.(`[Spatial] Mapping complete.`);
      return res.data;
    };

    const pulseTask = async () => {
      onLog?.(`[Market] Checking Urban Pulse for key: "${cityStateKey}"`);
      if (cityStateKey) {
        let cached = await getCommunityPulseFromCloud(cityStateKey);
        onLog?.(`[Market] Current DB status for ${cityStateKey}: ${cached?.status || 'NOT_FOUND'}`);

        // Stale check: if 'running' but started >15 mins ago, it crashed — don't wait
        const isStale = (rec: any) => {
          if (rec?.status !== 'running') return false;
          const lastRan = rec.lastRan?.seconds ? rec.lastRan.seconds * 1000 : rec.lastUpdated?.seconds ? rec.lastUpdated.seconds * 1000 : 0;
          return lastRan > 0 && (Date.now() - lastRan) > 15 * 60 * 1000;
        };

        // Wait only if running AND not stale
        let attempts = 0;
        while (cached?.status === 'running' && !isStale(cached) && attempts < 15) {
          onLog?.(`[Market] City Pulse research in progress for ${cityStateKey}, waiting 10s...`);
          await new Promise(r => setTimeout(r, 10000));
          cached = await getCommunityPulseFromCloud(cityStateKey);
          attempts++;
        }

        if (cached?.status === 'running' && isStale(cached)) {
          onLog?.(`[Market] City Pulse marked 'running' but is stale (>15min). Skipping wait.`);
        }

        if (cached?.status === 'completed') {
          onLog?.(`[Market] Pulse loaded for ${cityStateKey}.`);
          return cached;
        }
      }

      // Temporarily wired off due to Gemini concurrency limits (2 max)
      onLog?.(`[Market] Skipping Pulse research (Disabled)`);
      return null;
    };

    const propInvTask = async () => {
      const cached = await getPropertyInvestmentFromCloud(zpid);
      if (cached) return cached;
      const res = await analyzeInvestmentResearch(enrichedData, userId);
      await savePropertyInvestmentToCloud(zpid, res.data);
      return res.data;
    };

    const marketIntTask = async () => {
      const key = cityStateKey || zpid;
      onLog?.(`[Investment] Checking Market Intelligence for key: "${key}"`);
      let cached = await getGeneralMarketIntelligenceFromCloud(key);
      onLog?.(`[Investment] Current DB status for ${key}: ${cached?.status || 'NOT_FOUND'}`);

      // Stale check: if 'running' but started >15 mins ago, it crashed — don't wait
      const isStale = (rec: any) => {
        if (rec?.status !== 'running') return false;
        const lastRan = rec.lastRan?.seconds ? rec.lastRan.seconds * 1000 : rec.lastUpdated?.seconds ? rec.lastUpdated.seconds * 1000 : 0;
        return lastRan > 0 && (Date.now() - lastRan) > 15 * 60 * 1000;
      };

      // Wait only if running AND not stale
      let attempts = 0;
      while (cached?.status === 'running' && !isStale(cached) && attempts < 15) {
        onLog?.(`[Investment] General Market research in progress for ${key}, waiting 10s...`);
        await new Promise(r => setTimeout(r, 10000));
        cached = await getGeneralMarketIntelligenceFromCloud(key);
        attempts++;
      }

      if (cached?.status === 'running' && isStale(cached)) {
        onLog?.(`[Investment] Market Intelligence marked 'running' but is stale (>15min). Skipping wait.`);
      }

      if (cached?.status === 'completed') {
        onLog?.(`[Investment] General Market Intelligence loaded for ${key}.`);
        return cached;
      }

      // Temporarily wired off due to Gemini concurrency limits (2 max)
      onLog?.(`[Investment] Skipping General Market Intelligence (Disabled)`);
      return null;
    };


    // Execute AI Tasks Parallelized for maximum speed
    // Visual, Spatial, Regional (city-level cache reads), and Property Investment run simultaneously.
    // Deep Research is NOT included here — it runs separately via prefetchCityIntelligence (city-level).
    onLog?.(`[Pipeline] Launching parallel AI evaluation suite...`);
    const [visualResult, neighborhoodData, communityPulse, investmentSpecific, marketIntelligence] = await Promise.all([
      visualTask(),
      neighborhoodTask(),
      pulseTask(),
      propInvTask(),
      marketIntTask()
    ]);

    // Track which subtasks had issues
    const warnings: string[] = [];
    if (!visualResult) warnings.push('Visual AI');

    // Assembly - Keep visualResult lean (only item-specific data)
    const finalVisualResult: CustomAIAnalysisResult = {
      ...(visualResult || {}),
      neighborhood: neighborhoodData || undefined,
    };

    // Save final visual state (only if we have meaningful data)
    if (visualResult) {
      await saveVisualAnalysisToCloud(zpid, finalVisualResult);
    }

    // Assembly for Narrative (includes city-level cache reads for synthesis context)
    const contextForComprehensive = {
      ...finalVisualResult,
      community_pulse: communityPulse,
      property_investment: investmentSpecific,
      general_market_intelligence: marketIntelligence,
      // Deep Research is loaded from cache if available (set by prefetchCityIntelligence)
      deep_investment_research: cityStateKey ? await getDeepInvestmentResearchFromCloud(cityStateKey) : null
    };

    // 10. Narrative AI Synthesis (Final Step)
    onProgress({ step: 'Narrative', status: 'running', message: 'Synthesizing final report...' });
    const resultComp = await analyzeComprehensive(enrichedData, contextForComprehensive, userId);
    await saveComprehensiveAnalysisToCloud(zpid, resultComp.data);
    onProgress({ step: 'Narrative', status: 'completed', message: 'Report synthesized.', usage: resultComp.usage });

    if (warnings.length > 0) {
      onProgress({ step: 'Status', status: 'completed', message: `Intelligence Suite ready (with warnings: ${warnings.join(', ')} needs retry).` });
    } else {
      onProgress({ step: 'Status', status: 'completed', message: 'Property Intelligence Suite is ready.' });
    }

    return { zpid, warnings };
  } catch (error: any) {
    let msg = error.message;
    onLog?.(`[Pipeline Error] ${msg}`);
    if (error instanceof AiResponseError) {
      console.error("AI JSON Parse Error. Raw text follows:", error.rawResponse);
      msg = `AI response malformed: ${error.message}. The model might have truncated the result.`;
    }
    onProgress({ step: 'Error', status: 'error', message: msg });
    throw error;
  }
};

/**
 * Triggers high-level city/state intelligence (Community Pulse, General Market).
 * Deep Research is handled separately via runCityDeepResearch.
 */
export const prefetchCityIntelligence = async (
  city: string,
  state: string,
  userId: string = 'unknown',
  onLog?: (msg: string) => void
): Promise<void> => {
  onLog?.(`[City-Intelligence] Triggering background urban research for ${city}, ${state}...`);

  const dummyProp = {
    city,
    state,
    address: `${city}, ${state}`
  } as PropertyData;

  const result = await runBackgroundCityResearch(dummyProp, userId, onLog);

  if (result?.status === 'started') {
    onLog?.(`[City-Intelligence] Urban research pipeline engaged for ${city}. Waiting for completion...`);
    if (result.promise) await result.promise;
    onLog?.(`[City-Intelligence] Urban research complete for ${city}.`);
  } else {
    onLog?.(`[City-Intelligence] Urban research for ${city} is currently in progress. Attaching to existing stream...`);

    let cached = await getCommunityPulseFromCloud(result.cityStateKey);
    let attempts = 0;
    while (cached?.status === 'running' && attempts < 20) {
      if (attempts === 0) onLog?.(`[City-Intelligence] Waiting for existing urban research to land...`);
      await new Promise(r => setTimeout(r, 15000));
      cached = await getCommunityPulseFromCloud(result.cityStateKey);
      attempts++;
    }
    onLog?.(`[City-Intelligence] Prerequisites checked for ${city}.`);
  }
};

/**
 * Runs Deep Investment Research for a city — standalone, city-level only.
 * Call this explicitly (e.g. from a "Run Deep Research" button) rather than
 * embedding it in the per-property Full Intel Suite.
 */
export const runCityDeepResearch = async (
  city: string,
  state: string,
  userId: string = 'unknown',
  onLog?: (msg: string) => void
): Promise<void> => {
  const { analyzeDeepInvestmentResearch } = await import('./geminiService.ts');
  const cityStateKey = generateCityStateKey(city, state);
  if (!cityStateKey) {
    onLog?.(`[Deep Research] Cannot determine city key for ${city}, ${state}`);
    return;
  }

  // Check cache first
  const cached = await getDeepInvestmentResearchFromCloud(cityStateKey);
  const hasContent = cached && (
    cached.status === 'completed' ||
    !!(cached as any).content ||
    !!(cached as any).structured_report
  );
  if (hasContent && cached?.status !== 'running') {
    onLog?.(`[Deep Research] Already completed for ${cityStateKey}. Skipping.`);
    return;
  }

  onLog?.(`[Deep Research] Starting for ${cityStateKey}...`);
  try {
    const dummyProp = { city, state, address: `${city}, ${state}` } as PropertyData;
    const res = await analyzeDeepInvestmentResearch(dummyProp, userId, cityStateKey, onLog);
    await saveDeepInvestmentResearchToCloud(cityStateKey, res.data);
    onLog?.(`[Deep Research] Complete for ${cityStateKey}.`);
  } catch (e: any) {
    onLog?.(`[Deep Research] Failed for ${cityStateKey}: ${e.message}`);
    throw e;
  }
};

/**
 * Lean pipeline that only secures images and maps without running AI analysis.
 */
export const runImageOnlyPipeline = async (
  rawAddress: string,
  onProgress: (p: PipelineProgress) => void,
  providedZpid?: string,
  onLog?: (msg: string) => void
): Promise<string> => {
  try {
    let currentZpid = providedZpid;

    // 1. Discovery (Geocoding & Basic Facts)
    onProgress({ step: 'Discovery', status: 'running', message: 'Resolving location and property ID...' });
    const [radar, propData] = await Promise.all([
      normalizeAddress(rawAddress, providedZpid),
      fetchPropertyDataFull(providedZpid || rawAddress, !!providedZpid, false)
    ]);

    const zpid = propData.zpid || providedZpid;
    if (!zpid) throw new Error("Could not resolve ZPID.");
    onLog?.(`[Discovery] Resolved ${radar.formattedAddress} (ZPID: ${zpid})`);
    onProgress({ step: 'Discovery', status: 'completed', message: 'Location resolved.' });

    // 2. Gallery Fetch
    onProgress({ step: 'Gallery', status: 'running', message: 'Fetching listing photos...' });
    let imageUrls = propData.images || [];
    try {
      const fullImages = await fetchPropertyImages(zpid);
      if (fullImages?.length > imageUrls.length) {
        imageUrls = fullImages;
        onLog?.(`[Gallery] Found ${fullImages.length} images.`);
      }
    } catch (e) {
      onLog?.(`[Gallery] Photo sync warning: ${e}`);
    }

    // 3. Street View URL Generation
    const MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''; // Fallback to empty if not in meta
    // We should ideally use the config
    const configMapsKey = (await import('../config')).APP_CONFIG.maps.key;

    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(radar.formattedAddress)}&fov=90&radius=100&source=outdoor&key=${configMapsKey}`;

    // 4. Secure Assets
    onProgress({ step: 'Securing', status: 'running', message: 'Uploading to cloud storage...' });
    const assets = await securePropertyAssets(
      zpid,
      imageUrls,
      {
        zoomIn: radar.mapZoomIn,
        zoomOut: radar.mapZoomOut,
        streetView: streetViewUrl
      },
      (p) => onLog?.(`[Cloud] ${p.message}`)
    );

    // 5. Update Property Record with Persistent URLs
    const alternate_ids = [...(propData.alternate_ids || [])];
    if (providedZpid && providedZpid !== zpid && !alternate_ids.includes(providedZpid)) {
      alternate_ids.push(providedZpid);
    }

    const updatedData: Partial<PropertyData> = {
      ...propData,
      zpid,
      feed_property_id: providedZpid,
      alternate_ids,
      images: assets.images,
      mapZoomIn: assets.mapZoomIn,
      mapZoomOut: assets.mapZoomOut,
      streetViewAnalysis: {
        ...propData.streetViewAnalysis,
        imageUrl: assets.streetView || propData.streetViewAnalysis?.imageUrl
      } as any
    };

    await savePropertyToCloud(zpid, updatedData as PropertyData);
    onProgress({ step: 'Status', status: 'completed', message: 'Images and maps secured.' });

    return zpid;
  } catch (error: any) {
    onLog?.(`[Image Pipeline Error] ${error.message}`);
    onProgress({ step: 'Error', status: 'error', message: error.message });
    throw error;
  }
};

/**
 * RapidAPI + Radar only pipeline: fetches property specs (Zillow/RapidAPI) and
 * geocoding (Radar) ONLY. Performs a targeted merge into the existing Firestore
 * document — environmental data (solar, air quality, pollen, noise, street view),
 * AI analysis, and images are NOT touched.
 *
 * Use this to refresh core property specs without re-running expensive APIs.
 */
export const runRapidAPIOnlyPipeline = async (
  rawAddress: string,
  onProgress: (p: PipelineProgress) => void,
  providedZpid?: string,
  onLog?: (msg: string) => void
): Promise<string> => {
  try {
    onProgress({ step: 'Fetching', status: 'running', message: 'Fetching property specs from RapidAPI...' });

    // Fetch RapidAPI data and Radar geocoding in parallel
    const [radar, propData] = await Promise.all([
      normalizeAddress(rawAddress, providedZpid),
      fetchPropertyDataFull(providedZpid || rawAddress, !!providedZpid, false, undefined, true /* skipImages */)
    ]);

    const zpid = propData.zpid || providedZpid;
    if (!zpid) throw new Error('Could not resolve ZPID.');
    onLog?.(`[RapidAPI] Resolved ${radar.formattedAddress} (ZPID: ${zpid})`);

    // Build alternate_ids
    const alternate_ids = [...(propData.alternate_ids || [])];
    if (providedZpid && providedZpid !== zpid && !alternate_ids.includes(providedZpid)) {
      alternate_ids.push(providedZpid);
    }

    // Fields that come purely from RapidAPI + Radar — safe to overwrite.
    // Deliberately excludes: solarData, airQuality, pollen, noiseScore*, streetViewAnalysis,
    // images, mapZoomIn, mapZoomOut, comps — so existing enriched data is preserved.
    const rapidAPIFields: Partial<PropertyData> = {
      zpid,
      feed_property_id: providedZpid,
      alternate_ids,
      address: radar.formattedAddress,
      coordinates: radar.coordinates,
      city: propData.city,
      state: propData.state,
      zipCode: propData.zipCode,
      homeStatus: propData.homeStatus,
      homeType: propData.homeType,
      listingSubType: (propData as any).listingSubType ?? undefined,
      bedrooms: propData.bedrooms,
      bathrooms: propData.bathrooms,
      livingAreaValue: propData.livingAreaValue,
      yearBuilt: propData.yearBuilt,
      lotSize: propData.lotSize,
      price: propData.price ?? undefined,
      zestimate: propData.zestimate,
      rentZestimate: propData.rentZestimate,
      description: propData.description,
      attribution: (propData as any).attribution ?? undefined,
      schools: propData.schools,
      windRiskScore: (propData as any).windRiskScore,
      floodRiskScore: (propData as any).floodRiskScore,
      fireRiskScore: (propData as any).fireRiskScore,
      heatRiskScore: (propData as any).heatRiskScore,
      annualHomeownersInsurance: propData.annualHomeownersInsurance,
    };

    // Strip undefined so Firestore merge doesn't delete existing values
    const cleanFields = Object.fromEntries(
      Object.entries(rapidAPIFields).filter(([, v]) => v !== undefined)
    ) as Partial<PropertyData>;

    await savePropertyToCloud(zpid, cleanFields);
    onProgress({ step: 'Status', status: 'completed', message: 'RapidAPI property data refreshed.' });
    onLog?.(`[RapidAPI] Saved property specs for ${zpid}`);

    return zpid;
  } catch (error: any) {
    onLog?.(`[RapidAPI Pipeline Error] ${error.message}`);
    onProgress({ step: 'Error', status: 'error', message: error.message });
    throw error;
  }
};

/**
 * Ultra-lean pipeline: fetches property data from RapidAPI (specs, price, scores)
 * and saves it to Firestore. No images, no Firebase Storage, no AI.
 * Use this to refresh/seed property records without burning image or AI quotas.
 */
export const runPropertyDataOnlyPipeline = async (
  rawAddress: string,
  onProgress: (p: PipelineProgress) => void,
  providedZpid?: string,
  onLog?: (msg: string) => void
): Promise<string> => {
  try {
    // 1. Fetch property data + geocoding in parallel (RapidAPI + Radar)
    onProgress({ step: 'Fetching', status: 'running', message: 'Fetching property data from RapidAPI...' });
    const [radar, propData] = await Promise.all([
      normalizeAddress(rawAddress, providedZpid),
      fetchPropertyDataFull(providedZpid || rawAddress, !!providedZpid, false, undefined, true /* skipImages */)
    ]);

    const zpid = propData.zpid || providedZpid;
    if (!zpid) throw new Error('Could not resolve ZPID.');
    onLog?.(`[Data] Resolved ${radar.formattedAddress} (ZPID: ${zpid})`);

    // 2. Build alternate_ids
    const alternate_ids = [...(propData.alternate_ids || [])];
    if (providedZpid && providedZpid !== zpid && !alternate_ids.includes(providedZpid)) {
      alternate_ids.push(providedZpid);
    }

    // 2b. Fetch ArcGIS parcel polygon (free, auto-routes to correct county)
    let parcelData: Record<string, any> = {};
    if (radar.coordinates?.latitude && radar.coordinates?.longitude) {
      try {
        const { fetchParcelFromCounty, polygonToFirestore } = await import('./arcgis/countyParcels');
        const result = await fetchParcelFromCounty(
          radar.coordinates.latitude,
          radar.coordinates.longitude
        );

        if (result) {
          parcelData = {
            parcelPolygon: polygonToFirestore(result.polygon),
            parcelApn: result.apn,
            parcelAreaSqft: result.areaSqft,
            parcelCounty: result.county,
            parcelCachedAt: new Date().toISOString(),
          };
          onLog?.(`[Data] ${result.county} ArcGIS polygon: APN=${result.apn}, ${result.areaSqft}sqft, ${result.polygon.length} vertices`);
        } else {
          onLog?.(`[Data] ArcGIS: no parcel found or county not supported at (${radar.coordinates.latitude.toFixed(4)}, ${radar.coordinates.longitude.toFixed(4)})`);
        }
      } catch (e: any) {
        onLog?.(`[Data] ArcGIS fetch skipped: ${e.message}`);
      }
    }

    // 3. Save to Firestore — coordinates + property specs + parcel polygon
    const dataToSave: Partial<PropertyData> = {
      ...propData,
      ...parcelData,
      zpid,
      feed_property_id: providedZpid,
      alternate_ids,
      address: radar.formattedAddress,
      coordinates: radar.coordinates,
      mapZoomIn: radar.mapZoomIn,    // Radar road map URLs (low-cost, no Storage upload)
      mapZoomOut: radar.mapZoomOut,
    };

    await savePropertyToCloud(zpid, dataToSave as PropertyData);
    onProgress({ step: 'Status', status: 'completed', message: 'Property data saved.' });
    onLog?.(`[Data] Saved property data for ${zpid}${parcelData.parcelApn ? ` (APN: ${parcelData.parcelApn})` : ''}`);

    return zpid;
  } catch (error: any) {
    onLog?.(`[Data Pipeline Error] ${error.message}`);
    onProgress({ step: 'Error', status: 'error', message: error.message });
    throw error;
  }
};
