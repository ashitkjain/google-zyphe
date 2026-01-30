
import { normalizeAddress, fetchPropertyDataFull, fetchPropertyImages } from './apiService.ts';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive, analyzeImageQuality, analyzeInvestmentResearch, AiResponseError } from './geminiService.ts';
import {
  savePropertyToCloud,
  saveVisualAnalysisToCloud,
  getVisualAnalysisFromCloud,
  saveComprehensiveAnalysisToCloud,
  saveImageQualityAnalysisToCloud,
  getImageQualityAnalysisFromCloud,
  saveInvestmentResearchToCloud,
  getInvestmentResearchFromCloud
} from './firebaseService.ts';
import { PropertyData, CustomAIAnalysisResult, InvestmentResearchResult } from '../types';
import { uploadRemoteImageToStorage } from './firebase/storage.ts';

export interface PipelineProgress {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message: string;
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
    const radar = await normalizeAddress(rawAddress);
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
    onProgress({ step: 'Property Data', status: 'running', message: 'Persisting images to secure storage...' });

    // 1. Persist Map Image
    let persistentMapUrl = radar.mapZoomOut;
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

    // 2. Persist Gallery Images (Chunked processing to avoid network congestion)
    const rawImages = propData.images || [];
    const imagesToProcess = rawImages; // Now processing all available photos
    const persistentImages: string[] = [];
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

    onLog?.(`[Assets] Total ${persistentImages.length} images persisted to storage.`);

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
      mapZoomIn: radar.mapZoomIn,
      mapZoomOut: persistentMapUrl,
      address: address
    };
    await savePropertyToCloud(zpid, enrichedData);
    onProgress({ step: 'Property Data', status: 'completed', message: 'Assets persisted & specs saved.' });

    // 4. Gallery (Handled above)
    onProgress({ step: 'Gallery', status: 'completed', message: `${persistentImages.length} images secured in cloud storage.` });

    // Restore locally for downstream steps
    const images = enrichedData.images || [];

    // 5. Visual Intelligence
    onProgress({ step: 'Visual AI', status: 'running', message: 'Analyzing interior and style...' });

    let visualResult: CustomAIAnalysisResult;
    const cachedVisual = await getVisualAnalysisFromCloud(zpid);

    if (cachedVisual) {
      visualResult = cachedVisual;
      onLog?.(`[Visual] Restored analysis from cache for ${zpid}`);
      onProgress({ step: 'Visual AI', status: 'completed', message: 'Visual analysis restored from cache.' });
    } else {
      onLog?.(`[Visual] Running fresh AI analysis for ${zpid}...`);
      visualResult = await analyzePropertyImages(images, enrichedData);
      onProgress({ step: 'Visual AI', status: 'completed', message: 'Fresh visual analysis complete.' });
    }

    // 6. Spatial AI
    onProgress({ step: 'Spatial AI', status: 'running', message: 'Analyzing neighborhood context...' });
    if (radar.mapZoomOut) {
      const neighborhood = await analyzeNeighborhood(radar.mapZoomOut, enrichedData);
      visualResult.neighborhood = neighborhood;
    }
    onProgress({ step: 'Spatial AI', status: 'completed', message: 'Spatial context mapped.' });

    // 7. Market AI
    onProgress({ step: 'Market AI', status: 'running', message: 'Gathering local sentiment...' });
    const pulse = await analyzeCommunityPulse(enrichedData);
    visualResult.community_pulse = pulse;
    onProgress({ step: 'Market AI', status: 'completed', message: 'Fresh market pulse analysis complete.' });

    // 8. Quality Audit (New Pipeline Step)
    onProgress({ step: 'Quality Audit', status: 'running', message: 'Performing deep picture quality scan...' });
    if (images.length > 0) {
      // Check for cached analysis first
      const cachedQuality = await getImageQualityAnalysisFromCloud(zpid);
      if (cachedQuality) {
        visualResult.image_quality_analysis = cachedQuality;
        onProgress({ step: 'Quality Audit', status: 'completed', message: 'Picture quality audit restored from cache.' });
      } else {
        const qualityResult = await analyzeImageQuality(images);
        visualResult.image_quality_analysis = qualityResult;
        // Save specifically to the new collection
        await saveImageQualityAnalysisToCloud(zpid, qualityResult);
        onProgress({ step: 'Quality Audit', status: 'completed', message: 'Picture quality intelligence generated.' });
      }
    } else {
      onProgress({ step: 'Quality Audit', status: 'completed', message: 'Skipped (no images).' });
    }

    await saveVisualAnalysisToCloud(zpid, visualResult);

    // 9. Investment Research (New Pipeline Step)
    onProgress({ step: 'Investment AI', status: 'running', message: 'Analyzing investment potential...' });
    const cachedInvestment = await getInvestmentResearchFromCloud(zpid);
    let investmentResult: InvestmentResearchResult;

    if (cachedInvestment) {
      investmentResult = cachedInvestment;
      onProgress({ step: 'Investment AI', status: 'completed', message: 'Investment research restored from cache.' });
    } else {
      investmentResult = await analyzeInvestmentResearch(enrichedData);
      await saveInvestmentResearchToCloud(zpid, investmentResult);
      onProgress({ step: 'Investment AI', status: 'completed', message: 'Investment analysis complete.' });
    }

    // 10. Narrative AI
    onProgress({ step: 'Narrative AI', status: 'running', message: 'Synthesizing professional report...' });
    const compResult = await analyzeComprehensive(enrichedData, visualResult);
    await saveComprehensiveAnalysisToCloud(zpid, compResult);
    onProgress({ step: 'Narrative AI', status: 'completed', message: 'Comprehensive fresh report generated.' });

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
