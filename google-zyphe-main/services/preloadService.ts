import { normalizeAddress, fetchPropertyData, fetchPropertyImages } from './apiService';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive, AiResponseError } from './geminiService';
import { 
  savePropertyToCloud, 
  saveVisualAnalysisToCloud,
  saveComprehensiveAnalysisToCloud,
  getPropertyByAddress,
  getVisualAnalysisFromCloud,
  getComprehensiveAnalysisFromCloud
} from './firebaseService';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult } from '../types';

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

    // 2. Cache Audit
    onProgress({ step: 'Cache Audit', status: 'running', message: 'Scanning Zyphe Cloud for existing intelligence...' });
    const cachedProperty = await getPropertyByAddress(address);
    let propData: PropertyData | null = cachedProperty;
    let zpid = propData?.zpid;
    
    let cachedVisual = zpid ? await getVisualAnalysisFromCloud(zpid) : null;
    let cachedComp = zpid ? await getComprehensiveAnalysisFromCloud(zpid) : null;
    onProgress({ step: 'Cache Audit', status: 'completed', message: 'Cache scan complete.' });

    // 3. Property Data
    onProgress({ step: 'Property Data', status: 'running', message: 'Fetching specifications...' });
    if (!propData) {
      propData = await fetchPropertyData(address);
      zpid = propData.zpid;
    }
    
    if (!zpid) throw new Error("Could not resolve ZPID for property.");
    
    const enrichedData: PropertyData = {
      ...propData,
      coordinates: radar.coordinates,
      mapZoomIn: radar.mapZoomIn,
      mapZoomOut: radar.mapZoomOut,
      address: address
    };
    await savePropertyToCloud(zpid, enrichedData);
    onProgress({ step: 'Property Data', status: 'completed', message: 'Specs and market data retrieved.' });

    // 4. Gallery
    onProgress({ step: 'Gallery', status: 'running', message: 'Processing property images...' });
    let images = enrichedData.images || [];
    if (images.length === 0) {
      images = await fetchPropertyImages(zpid);
      if (images && images.length > 0) {
        enrichedData.images = images;
        await savePropertyToCloud(zpid, { images });
      }
    }
    onProgress({ step: 'Gallery', status: 'completed', message: images.length > 0 ? `${images.length} images indexed.` : 'No images available.' });

    // 5. Visual Intelligence
    let visualResult: CustomAIAnalysisResult;
    onProgress({ step: 'Visual AI', status: 'running', message: 'Analyzing interior and style...' });
    
    if (cachedVisual) {
      visualResult = cachedVisual;
      onProgress({ step: 'Visual AI', status: 'completed', message: 'Visual intelligence restored from cache.' });
    } else {
      visualResult = await analyzePropertyImages(images, enrichedData);
      onProgress({ step: 'Visual AI', status: 'completed', message: 'Visual analysis complete.' });
    }

    // 6. Spatial AI
    onProgress({ step: 'Spatial AI', status: 'running', message: 'Analyzing neighborhood context...' });
    if (!visualResult.neighborhood && radar.mapZoomOut) {
      const neighborhood = await analyzeNeighborhood(radar.mapZoomOut, enrichedData);
      visualResult.neighborhood = neighborhood;
    }
    onProgress({ step: 'Spatial AI', status: 'completed', message: 'Spatial context mapped.' });

    // 7. Market AI
    onProgress({ step: 'Market AI', status: 'running', message: 'Gathering local sentiment...' });
    if (!visualResult.community_pulse) {
      const pulse = await analyzeCommunityPulse(enrichedData);
      visualResult.community_pulse = pulse;
    }
    onProgress({ step: 'Market AI', status: 'completed', message: 'Market pulse analysis complete.' });

    await saveVisualAnalysisToCloud(zpid, visualResult);

    // 8. Narrative AI
    onProgress({ step: 'Narrative AI', status: 'running', message: 'Finalizing narrative report...' });
    if (cachedComp) {
      onProgress({ step: 'Narrative AI', status: 'completed', message: 'Narrative report restored from cache.' });
    } else {
      const compResult = await analyzeComprehensive(enrichedData, visualResult);
      await saveComprehensiveAnalysisToCloud(zpid, compResult);
      onProgress({ step: 'Narrative AI', status: 'completed', message: 'Comprehensive report generated.' });
    }
    
    onProgress({ step: 'Status', status: 'completed', message: 'Property Intelligence Suite is ready.' });
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