import { normalizeAddress, fetchPropertyData, fetchPropertyImages } from './apiService';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive } from './geminiService';
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

    // 2. Pre-fetch all available caches
    onProgress({ step: 'Cache Audit', status: 'running', message: 'Scanning Zyphe Cloud for existing intelligence...' });
    const cachedProperty = await getPropertyByAddress(address);
    let cachedVisual: CustomAIAnalysisResult | null = null;
    let cachedComp: ComprehensiveAnalysisResult | null = null;
    
    if (cachedProperty && cachedProperty.zpid) {
      cachedVisual = await getVisualAnalysisFromCloud(cachedProperty.zpid);
      cachedComp = await getComprehensiveAnalysisFromCloud(cachedProperty.zpid);
    }
    onProgress({ step: 'Cache Audit', status: 'completed', message: 'Cache scan complete.' });

    // 3. Property Data
    onProgress({ step: 'Property Data', status: 'running', message: 'Fetching specifications...' });
    let propData: PropertyData;
    if (cachedProperty) {
      propData = cachedProperty;
      onProgress({ step: 'Property Data', status: 'completed', message: 'Data restored from cache.' });
    } else {
      propData = await fetchPropertyData(address);
      onProgress({ step: 'Property Data', status: 'completed', message: 'Specs and market data retrieved.' });
    }
    
    if (!propData.zpid) throw new Error("Could not resolve ZPID for property.");
    
    const enrichedData: PropertyData = {
      ...propData,
      coordinates: radar.coordinates,
      mapZoomIn: radar.mapZoomIn,
      mapZoomOut: radar.mapZoomOut,
      address: address
    };
    await savePropertyToCloud(propData.zpid, enrichedData);

    // 4. Image Gallery
    onProgress({ step: 'Gallery', status: 'running', message: 'Processing property images...' });
    let images = propData.images || [];
    if (images.length > 0) {
      onProgress({ step: 'Gallery', status: 'completed', message: `${images.length} images restored from cache.` });
    } else {
      images = await fetchPropertyImages(propData.zpid);
      if (images && images.length > 0) {
        await savePropertyToCloud(propData.zpid, { images });
        onProgress({ step: 'Gallery', status: 'completed', message: `${images.length} images indexed.` });
      } else {
        onProgress({ step: 'Gallery', status: 'completed', message: 'No images available.' });
      }
    }

    // 5. Visual Intelligence
    let visualResult: CustomAIAnalysisResult;
    onProgress({ step: 'Visual AI', status: 'running', message: 'Analyzing interior and style...' });
    if (cachedVisual && cachedVisual.home_interior?.overall_description) {
      visualResult = cachedVisual;
      onProgress({ step: 'Visual AI', status: 'completed', message: 'Visual intelligence restored from cache.' });
    } else {
      if (images && images.length > 0) {
        visualResult = await analyzePropertyImages(images, enrichedData);
      } else {
        visualResult = { 
          report_title: 'Limited Visual Analysis', 
          home_interior: { overall_description: 'No image data available for interior analysis.' } as any, 
          room_highlights: [], 
          exterior_and_neighborhood: {} as any 
        };
      }
      onProgress({ step: 'Visual AI', status: 'completed', message: 'Visual analysis complete.' });
    }

    // 6. Neighborhood Analysis (Spatial)
    onProgress({ step: 'Spatial AI', status: 'running', message: 'Analyzing neighborhood context...' });
    if (visualResult.neighborhood) {
      onProgress({ step: 'Spatial AI', status: 'completed', message: 'Spatial data restored from cache.' });
    } else if (radar.mapZoomOut) {
      const neighborhood = await analyzeNeighborhood(radar.mapZoomOut, enrichedData);
      visualResult.neighborhood = neighborhood;
      onProgress({ step: 'Spatial AI', status: 'completed', message: 'Neighborhood analysis finished.' });
    } else {
      onProgress({ step: 'Spatial AI', status: 'completed', message: 'No map data for spatial analysis.' });
    }

    // 7. Community Pulse
    onProgress({ step: 'Market AI', status: 'running', message: 'Gathering local sentiment...' });
    if (visualResult.community_pulse) {
      onProgress({ step: 'Market AI', status: 'completed', message: 'Community pulse restored from cache.' });
    } else {
      const pulse = await analyzeCommunityPulse(enrichedData);
      visualResult.community_pulse = pulse;
      onProgress({ step: 'Market AI', status: 'completed', message: 'Market pulse analysis complete.' });
    }

    // Save/Update intermediate visual intelligence
    await saveVisualAnalysisToCloud(propData.zpid, visualResult);

    // 8. Comprehensive Narrative AI
    onProgress({ step: 'Narrative AI', status: 'running', message: 'Finalizing narrative report...' });
    if (cachedComp) {
      onProgress({ step: 'Narrative AI', status: 'completed', message: 'Narrative report restored from cache.' });
    } else {
      const compResult = await analyzeComprehensive(enrichedData, visualResult);
      await saveComprehensiveAnalysisToCloud(propData.zpid, compResult);
      onProgress({ step: 'Narrative AI', status: 'completed', message: 'Comprehensive report generated.' });
    }
    
    onProgress({ step: 'Status', status: 'completed', message: 'Property Intelligence Suite is ready.' });
    return propData.zpid;
  } catch (error: any) {
    onProgress({ step: 'Error', status: 'error', message: error.message });
    throw error;
  }
};
