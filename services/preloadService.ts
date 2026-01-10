
import { normalizeAddress, fetchPropertyData, fetchPropertyImages } from './apiService.ts';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive, analyzeImageQuality, AiResponseError } from './geminiService.ts';
import { 
  savePropertyToCloud, 
  saveVisualAnalysisToCloud,
  saveComprehensiveAnalysisToCloud,
  saveImageQualityAnalysisToCloud
} from './firebaseService.ts';
import { PropertyData, CustomAIAnalysisResult } from '../types.ts';

export interface PipelineProgress {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message: string;
}

export const runFullIntelligencePipeline = async (
  rawAddress: string, 
  onProgress: (p: PipelineProgress) => void
): Promise<string> => {
  try {
    // 1. Geocoding
    onProgress({ step: 'Geocoding', status: 'running', message: 'Normalizing address and generating maps...' });
    const radar = await normalizeAddress(rawAddress);
    const address = radar.formattedAddress;
    onProgress({ step: 'Geocoding', status: 'completed', message: `Address normalized: ${address}` });

    // 2. Fresh Scan
    onProgress({ step: 'Status Check', status: 'running', message: 'Initiating fresh property scan...' });
    onProgress({ step: 'Status Check', status: 'completed', message: 'Ready for fresh ingestion.' });

    // 3. Property Data
    onProgress({ step: 'Property Data', status: 'running', message: 'Fetching specifications...' });
    const propData = await fetchPropertyData(address, true);
    const zpid = propData.zpid;
    
    if (!zpid) throw new Error("Could not resolve ZPID for property.");
    
    const enrichedData: PropertyData = {
      ...propData,
      coordinates: radar.coordinates,
      mapZoomIn: radar.mapZoomIn,
      mapZoomOut: radar.mapZoomOut,
      address: address
    };
    await savePropertyToCloud(zpid, enrichedData);
    onProgress({ step: 'Property Data', status: 'completed', message: 'Fresh specs and market data retrieved.' });

    // 4. Gallery
    onProgress({ step: 'Gallery', status: 'running', message: 'Processing property images...' });
    const images = await fetchPropertyImages(zpid);
    if (images && images.length > 0) {
      enrichedData.images = images;
      await savePropertyToCloud(zpid, { images });
    }
    onProgress({ step: 'Gallery', status: 'completed', message: images.length > 0 ? `${images.length} fresh images indexed.` : 'No images available.' });

    // 5. Visual Intelligence
    onProgress({ step: 'Visual AI', status: 'running', message: 'Analyzing interior and style...' });
    const visualResult = await analyzePropertyImages(images, enrichedData);
    onProgress({ step: 'Visual AI', status: 'completed', message: 'Fresh visual analysis complete.' });

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
      const qualityResult = await analyzeImageQuality(images);
      visualResult.image_quality_analysis = qualityResult;
      // Save specifically to the new collection
      await saveImageQualityAnalysisToCloud(zpid, qualityResult);
      onProgress({ step: 'Quality Audit', status: 'completed', message: 'Picture quality intelligence generated.' });
    } else {
      onProgress({ step: 'Quality Audit', status: 'completed', message: 'Skipped (no images).' });
    }

    await saveVisualAnalysisToCloud(zpid, visualResult);

    // 9. Narrative AI
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
