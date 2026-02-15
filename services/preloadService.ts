
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
): Promise<string> => {
  try {
    // 1 & 3. Geocoding & Property Data (Parallel)
    onProgress({ step: 'Discovery', status: 'running', message: 'Mapping location and fetching specifications...' });
    const [radar, propData] = await Promise.all([
      normalizeAddress(rawAddress, providedZpid),
      fetchPropertyDataFull(providedZpid || rawAddress, !!providedZpid)
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

      onLog?.(`[Visual] Running fresh analysis...`);
      const res = await analyzePropertyImages(enrichedData.images!, enrichedData, userId);

      // Diagnostic logging for schema validation
      if (res.data) {
        const keys = Object.keys(res.data);
        const dataStatus = Array.isArray(res.data) ? 'Array' : typeof res.data;
        onLog?.(`[Visual] Received ${dataStatus} from AI with ${keys.length} top-level fields.`);
      }

      const check = isAnalysisComplete(res.data, enrichedData.images?.length || 0);
      if (!check.valid) {
        const keys = res.data ? Object.keys(res.data) : 'null/undefined';
        const errorMsg = `Visual Intelligence synthesis was incomplete: ${check.missing?.join(', ')}. (Received: ${typeof keys === 'string' ? keys : keys.join(', ')})`;
        onLog?.(`[Visual] ERROR: ${errorMsg}`);

        // If it's an array but should be an object, it's a structural failure
        if (Array.isArray(res.data)) {
          onLog?.(`[Visual] Structural mismatch: AI returned an array of ${res.data.length} items instead of the expected report object.`);
        }

        throw new Error(errorMsg);
      }

      onLog?.(`[Visual] Analysis complete.`);
      return res.data;
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

        // Wait if currently running
        let attempts = 0;
        while (cached?.status === 'running' && attempts < 15) {
          onLog?.(`[Market] City Pulse research in progress for ${cityStateKey}, waiting 10s...`);
          await new Promise(r => setTimeout(r, 10000));
          cached = await getCommunityPulseFromCloud(cityStateKey);
          attempts++;
        }

        if (cached?.status === 'completed') {
          onLog?.(`[Market] Pulse loaded for ${cityStateKey}.`);
          return cached;
        }
      }

      if (skipMissingCityData) {
        onLog?.(`[Market] Skipping Pulse (Not pre-generated for "${cityStateKey}")`);
        return null;
      }

      onLog?.(`[Market] Analyzing resident sentiment...`);
      const res = await analyzeCommunityPulse(enrichedData, userId);
      if (cityStateKey) await saveCommunityPulseToCloud(cityStateKey, res.data);
      onLog?.(`[Market] Sentiment analysis complete.`);
      return res.data;
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

      // Wait if currently running
      let attempts = 0;
      while (cached?.status === 'running' && attempts < 15) {
        onLog?.(`[Investment] General Market research in progress for ${key}, waiting 10s...`);
        await new Promise(r => setTimeout(r, 10000));
        cached = await getGeneralMarketIntelligenceFromCloud(key);
        attempts++;
      }

      if (cached?.status === 'completed') {
        onLog?.(`[Investment] General Market Intelligence loaded for ${key}.`);
        return cached;
      }

      if (skipMissingCityData) {
        onLog?.(`[Investment] Skipping General Market Logic (Not pre-generated for "${key}")`);
        return null;
      }

      const res = await analyzeGeneralMarketIntelligence(enrichedData, userId);
      await saveGeneralMarketIntelligenceToCloud(key, res.data);
      return res.data;
    };

    // Execute AI Tasks Parallelized for maximum speed
    // This starts all independent evaluations (Visual, Spatial, Regional, Financial) simultaneously.
    onLog?.(`[Pipeline] Launching parallel AI evaluation suite...`);
    const [visualResult, neighborhoodData, communityPulse, investmentSpecific, marketIntelligence] = await Promise.all([
      visualTask(),
      neighborhoodTask(),
      pulseTask(),
      propInvTask(),
      marketIntTask()
    ]);

    // Assembly - Keep visualResult lean (only item-specific data)
    const finalVisualResult: CustomAIAnalysisResult = {
      ...visualResult,
      neighborhood: neighborhoodData || undefined,
      // Removed: community_pulse, property_investment, general_market_intelligence (these are stored in their own tables)
    };

    // Save final visual state
    await saveVisualAnalysisToCloud(zpid, finalVisualResult);

    // Assembly for Narrative (includes shared research for synthesis)
    const contextForComprehensive = {
      ...finalVisualResult,
      community_pulse: communityPulse,
      property_investment: investmentSpecific,
      general_market_intelligence: marketIntelligence
    };

    // 10. Narrative AI Synthesis (Final Step)
    onProgress({ step: 'Narrative', status: 'running', message: 'Synthesizing final report...' });
    const resultComp = await analyzeComprehensive(enrichedData, contextForComprehensive, userId);
    await saveComprehensiveAnalysisToCloud(zpid, resultComp.data);
    onProgress({ step: 'Narrative', status: 'completed', message: 'Report synthesized.', usage: resultComp.usage });

    onProgress({ step: 'Status', status: 'completed', message: 'Property Intelligence Suite is ready.' });
    return zpid;
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
 * Triggers high-level city/state intelligence (Community Pulse & General Market)
 * to be shared across all properties in that region.
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

  const result = await runBackgroundCityResearch(dummyProp, userId);

  if (result?.status === 'started') {
    onLog?.(`[City-Intelligence] Urban research pipeline engaged for ${city}. Waiting for completion...`);
    if (result.promise) await result.promise;
    onLog?.(`[City-Intelligence] Urban research complete for ${city}.`);
  } else {
    onLog?.(`[City-Intelligence] Urban research for ${city} already in progress or recently completed.`);

    // Safety: If it's currently running, we should still wait for it before proceeding
    // to ensure Phase 2 has the data available.
    let cached = await getCommunityPulseFromCloud(result.cityStateKey);
    let attempts = 0;
    while (cached?.status === 'running' && attempts < 20) {
      if (attempts === 0) onLog?.(`[City-Intelligence] Waiting for existing urban research to land...`);
      await new Promise(r => setTimeout(r, 15000)); // Staggered wait
      cached = await getCommunityPulseFromCloud(result.cityStateKey);
      attempts++;
    }
    onLog?.(`[City-Intelligence] Prerequisites checked for ${city}.`);
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
      fetchPropertyDataFull(providedZpid || rawAddress, !!providedZpid)
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
