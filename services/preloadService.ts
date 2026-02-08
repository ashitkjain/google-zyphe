
import { normalizeAddress, fetchPropertyDataFull, fetchPropertyImages } from './apiService.ts';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive, analyzeInvestmentResearch, AiResponseError } from './geminiService.ts';
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
import { analyzeGeneralMarketIntelligence } from './geminiService';
import { uploadRemoteImageToStorage } from './firebase/storage.ts';

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
  onLog?: (msg: string) => void
): Promise<string> => {
  try {
    // 1. Geocoding
    onProgress({ step: 'Geocoding', status: 'running', message: 'Normalizing address and generating maps...' });
    const radar = await normalizeAddress(rawAddress, providedZpid);
    const address = radar.formattedAddress;
    onLog?.(`[Geocode] Address normalized: ${address}`);
    onProgress({ step: 'Geocoding', status: 'completed', message: `Address normalized: ${address}` });

    // 2. Fresh Scan
    onProgress({ step: 'Status Check', status: 'running', message: 'Initiating fresh property scan...' });
    onProgress({ step: 'Status Check', status: 'completed', message: 'Ready for fresh ingestion.' });

    // 3. Property Data
    onProgress({ step: 'Property Data', status: 'running', message: 'Fetching specifications...' });

    // If we have a providedZpid, we use it directly to fetch data
    onLog?.(`[Pipeline] Fetching data for ${providedZpid || address}`);
    const propData = await fetchPropertyDataFull(providedZpid || address, !!providedZpid);
    const zpid = propData.zpid || providedZpid;
    onLog?.(`[Pipeline] Resolved ZPID: ${zpid}`);

    if (!zpid) throw new Error("Could not resolve ZPID for property.");

    // 4. Fetch Full Image Gallery (RapidAPI /property endpoint sometimes returns truncated images)
    onProgress({ step: 'Gallery', status: 'running', message: 'Fetching complete photo gallery...' });
    try {
      const fullImages = await fetchPropertyImages(zpid);
      if (fullImages && fullImages.length > (propData.images?.length || 0)) {
        onLog?.(`[Gallery] Discovered ${fullImages.length} images (found ${propData.images?.length || 0} in summary).`);
        propData.images = fullImages;
      }
    } catch (e) {
      console.warn("[Gallery] Failed to fetch extended gallery, falling back to summary images:", e);
    }

    // --- ASSET PERSISTENCE ---
    onProgress({ step: 'Property Data', status: 'running', message: 'Checking asset registry...' });

    // Try to restore from Asset Manifest first (Performance & Integrity check)
    const cachedAssets = await getPropertyAssetsFromCloud(zpid);
    let persistentImages: string[] = [];
    let persistentMapUrl = radar.mapZoomOut;
    let persistentMapZoomIn = radar.mapZoomIn;

    if (cachedAssets && cachedAssets.images?.length > 0) {
      onLog?.(`[Assets] Manifest found! Restoring ${cachedAssets.images.length} persistent image references.`);
      persistentImages = cachedAssets.images;
      persistentMapUrl = cachedAssets.mapZoomOut || radar.mapZoomOut;
      persistentMapZoomIn = cachedAssets.mapZoomIn || radar.mapZoomIn;
    } else {
      onProgress({ step: 'Property Data', status: 'running', message: 'Persisting images to secure storage...' });

      // 1. Persist Map Image
      if (radar.mapZoomOut) {
        try {
          persistentMapUrl = await uploadRemoteImageToStorage(
            radar.mapZoomOut,
            `properties/${zpid}/maps/location_context.png`
          );
          onLog?.(`[Assets] Map image saved to storage.`);
        } catch (e) {
          console.error("Failed to save map image:", e);
        }
      }

      // 2. Persist Gallery Images
      const rawImages = propData.images || [];
      const imagesToProcess = rawImages;
      const CHUNK_SIZE = 5;

      onLog?.(`[Assets] Processing ${imagesToProcess.length} images in batches of ${CHUNK_SIZE}...`);

      for (let i = 0; i < imagesToProcess.length; i += CHUNK_SIZE) {
        const chunk = imagesToProcess.slice(i, i + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (url, chunkIndex) => {
          const index = i + chunkIndex;
          try {
            if (url.includes('firebasestorage')) return url;
            return await uploadRemoteImageToStorage(
              url,
              `properties/${zpid}/gallery/img_${index + 1}.jpg`
            );
          } catch (e) {
            console.warn(`Failed to upload image ${index}:`, e);
            return url;
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        persistentImages.push(...chunkResults);
        onLog?.(`[Assets] Progress: ${persistentImages.length}/${imagesToProcess.length} images secured.`);
      }

      // Save new manifest
      await savePropertyAssetsToCloud(zpid, {
        zpid,
        images: persistentImages,
        mapZoomIn: persistentMapZoomIn,
        mapZoomOut: persistentMapUrl,
        lastVerified: null // Handled by serverTimestamp in service
      });
      onLog?.(`[Assets] Total ${persistentImages.length} images persisted and registered.`);
    }

    // Check if we have a mismatch
    const isMismatch = providedZpid && providedZpid !== zpid;
    const alternateIds = new Set<string>();
    if (zpid) alternateIds.add(zpid);
    if (providedZpid) alternateIds.add(providedZpid);

    const enrichedData: PropertyData = {
      ...propData,
      zpid: zpid, // Canonical ID
      feed_property_id: providedZpid, // Track what initiated this (e.g. 2056...)
      alternate_ids: Array.from(alternateIds),
      images: persistentImages, // Use the new persistent URLs
      coordinates: radar.coordinates,
      mapZoomIn: persistentMapZoomIn,
      mapZoomOut: persistentMapUrl,
      address: address
    };
    await savePropertyToCloud(zpid, enrichedData);
    onProgress({ step: 'Property Data', status: 'completed', message: 'Assets restored & specs saved.' });

    // 4. Gallery (Handled above)
    onProgress({ step: 'Gallery', status: 'completed', message: `${persistentImages.length} images secured in cloud storage.` });

    // Restore locally for downstream steps
    const images = enrichedData.images || [];

    // 5. Visual Intelligence
    onProgress({ step: 'Visual AI', status: 'running', message: 'Analyzing interior and style...' });

    let visualResult: CustomAIAnalysisResult;
    const cachedVisual = await getVisualAnalysisFromCloud(zpid);

    if (cachedVisual) {
      // BUST CACHE if the cached analysis was truncated (e.g. from the old 15-image limit)
      const cachedCount = cachedVisual.image_by_image_analysis?.length || 0;
      const currentCount = images.length;

      if (cachedCount < currentCount && currentCount > 15) {
        onLog?.(`[Visual] Cache found but truncated (${cachedCount} vs ${currentCount} images). Bypassing cache for full analysis...`);
        const result = await analyzePropertyImages(images, enrichedData);
        visualResult = result.data;
        onProgress({ step: 'Visual AI', status: 'completed', message: 'Full gallery analysis complete (Cache Bypassed).', usage: result.usage });
      } else {
        visualResult = cachedVisual;
        onLog?.(`[Visual] Restored analysis from cache for ${zpid} (${cachedCount} images analyzed)`);
        onProgress({ step: 'Visual AI', status: 'completed', message: 'Visual analysis restored from cache.' });
      }
    } else {
      onLog?.(`[Visual] Running fresh AI analysis for ${zpid}...`);
      const result = await analyzePropertyImages(images, enrichedData);
      visualResult = result.data;
      onProgress({ step: 'Visual AI', status: 'completed', message: 'Fresh visual analysis complete.', usage: result.usage });
    }

    // 6. Spatial AI
    onProgress({ step: 'Spatial AI', status: 'running', message: 'Analyzing neighborhood context...' });
    if (radar.mapZoomIn && radar.mapZoomOut) {
      const result = await analyzeNeighborhood(radar.mapZoomIn, radar.mapZoomOut, enrichedData);
      visualResult.neighborhood = result.data;
      onProgress({ step: 'Spatial AI', status: 'completed', message: 'Spatial context mapped.', usage: result.usage });
    } else {
      onProgress({ step: 'Spatial AI', status: 'completed', message: 'Spatial context skipped (missing map imagery).' });
    }

    // 7. Market AI (City Level Caching)
    onProgress({ step: 'Market AI', status: 'running', message: 'Gathering local sentiment...' });

    // Determine City/State for localized caching
    const city = radar.components?.city || enrichedData.city;
    const state = radar.components?.state || enrichedData.state;
    const cityStateKey = generateCityStateKey(city, state);

    if (cityStateKey) {
      const cachedPulse = await getCommunityPulseFromCloud(cityStateKey);
      if (cachedPulse) {
        visualResult.community_pulse = cachedPulse;
        onLog?.(`[Market] Community Pulse restored from city cache: ${cityStateKey}`);
        onProgress({ step: 'Market AI', status: 'completed', message: 'Market pulse restored from city cache.' });
      } else {
        const resultPulse = await analyzeCommunityPulse(enrichedData);
        visualResult.community_pulse = resultPulse.data;
        await saveCommunityPulseToCloud(cityStateKey, resultPulse.data);
        onLog?.(`[Market] Fresh pulse generated and cached for city: ${cityStateKey}`);
        onProgress({ step: 'Market AI', status: 'completed', message: 'Fresh market pulse analysis complete.', usage: resultPulse.usage });
      }
    } else {
      const resultPulse = await analyzeCommunityPulse(enrichedData);
      visualResult.community_pulse = resultPulse.data;
      onProgress({ step: 'Market AI', status: 'completed', message: 'Fresh market pulse analysis complete (Uncached).', usage: resultPulse.usage });
    }

    // 8. Quality Audit (Consolidated into Visual AI)
    onProgress({ step: 'Quality Audit', status: 'running', message: 'Finalizing picture quality scan...' });
    if (visualResult.image_quality_analysis) {
      // Save specifically to the new collection for legacy support/indexing
      await saveImageQualityAnalysisToCloud(zpid, visualResult.image_quality_analysis);
      onProgress({ step: 'Quality Audit', status: 'completed', message: 'Picture quality intelligence finalized.' });
    } else {
      onProgress({ step: 'Quality Audit', status: 'completed', message: 'Skipped (no quality data found).' });
    }

    await saveVisualAnalysisToCloud(zpid, visualResult);

    // 9. Investment Research (Property Specific & General Market)
    onProgress({ step: 'Investment AI', status: 'running', message: 'Analyzing investment potential...' });

    // Property Specific
    let propInvestment: PropertySpecificInvestmentResult;
    const cachedPropInv = await getPropertyInvestmentFromCloud(zpid);
    if (cachedPropInv) {
      propInvestment = cachedPropInv;
    } else {
      const res = await analyzeInvestmentResearch(enrichedData);
      propInvestment = res.data;
      await savePropertyInvestmentToCloud(zpid, propInvestment);
    }

    // General Market (City Level Caching)
    let generalMarket: GeneralMarketIntelligenceResult;
    if (cityStateKey) {
      const cachedGeneralMarket = await getGeneralMarketIntelligenceFromCloud(cityStateKey);
      if (cachedGeneralMarket) {
        generalMarket = cachedGeneralMarket;
        onLog?.(`[Investment] General Market Intelligence restored from city cache: ${cityStateKey}`);
      } else {
        const res = await analyzeGeneralMarketIntelligence(enrichedData);
        generalMarket = res.data;
        await saveGeneralMarketIntelligenceToCloud(cityStateKey, generalMarket);
        onLog?.(`[Investment] Fresh Market Intelligence generated and cached for city: ${cityStateKey}`);
      }
    } else {
      const res = await analyzeGeneralMarketIntelligence(enrichedData);
      generalMarket = res.data;
      // zpid fallback if city-state key generation fails (legacy/unreliable data)
      await saveGeneralMarketIntelligenceToCloud(zpid, generalMarket);
    }

    onProgress({ step: 'Investment AI', status: 'completed', message: 'Investment analysis complete.' });

    // 10. Narrative AI
    onProgress({ step: 'Narrative AI', status: 'running', message: 'Synthesizing professional report...' });
    const resultComp = await analyzeComprehensive(enrichedData, visualResult);
    const compResult = resultComp.data;
    await saveComprehensiveAnalysisToCloud(zpid, compResult);
    onProgress({ step: 'Narrative AI', status: 'completed', message: 'Comprehensive fresh report generated.', usage: resultComp.usage });

    onProgress({ step: 'Status', status: 'completed', message: 'Fresh Property Intelligence Suite is ready.' });
    return zpid;
  } catch (error: any) {
    let msg = error.message;
    if (error instanceof AiResponseError) {
      console.error("AI JSON Parse Error. Raw text follows:", error.rawResponse);
      msg = `${error.message} (Raw response logged to System terminal)`;
    }
    onProgress({ step: 'Error', status: 'error', message: msg });
    throw error;
  }
};
