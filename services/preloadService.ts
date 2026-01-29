
import { normalizeAddress, fetchPropertyData, fetchPropertyImages } from './apiService.ts';
import { analyzePropertyImages, analyzeNeighborhood, analyzeCommunityPulse, analyzeComprehensive, analyzeImageQuality, analyzeInvestmentResearch, analyzeBiddingStrategy, AiResponseError } from './geminiService.ts';
import {
  savePropertyToCloud,
  saveVisualAnalysisToCloud,
  saveComprehensiveAnalysisToCloud,
  saveImageQualityAnalysisToCloud,
  getImageQualityAnalysisFromCloud,
  saveInvestmentResearchToCloud,
  getInvestmentResearchFromCloud,
  saveBiddingStrategyToCloud,
  getBiddingStrategyFromCloud
} from './firebaseService.ts';
import { PropertyData, CustomAIAnalysisResult } from '../types';

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

    // 4. Gallery (Handled by Step 3)
    onProgress({ step: 'Gallery', status: 'running', message: 'Processing property images...' });
    const images = enrichedData.images || [];
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

    // 8.5 Investment AI
    onProgress({ step: 'Investment AI', status: 'running', message: 'Analyzing local STR market performance...' });
    const cachedInvestment = await getInvestmentResearchFromCloud(zpid);
    if (cachedInvestment) {
      visualResult.investment_research = cachedInvestment;
      onProgress({ step: 'Investment AI', status: 'completed', message: 'Investment research restored from cache.' });
    } else {
      const investmentResult = await analyzeInvestmentResearch(enrichedData);
      visualResult.investment_research = investmentResult;
      await saveInvestmentResearchToCloud(zpid, investmentResult);
      onProgress({ step: 'Investment AI', status: 'completed', message: 'Market performance analysis complete.' });
    }

    // 8.6 Bidding AI
    onProgress({ step: 'Bidding AI', status: 'running', message: 'Calculating strategic bidding floor...' });
    const cachedBidding = await getBiddingStrategyFromCloud(zpid);
    if (cachedBidding) {
      visualResult.bidding_strategy = cachedBidding;
      onProgress({ step: 'Bidding AI', status: 'completed', message: 'Bidding strategy restored from cache.' });
    } else {
      const biddingResult = await analyzeBiddingStrategy(enrichedData);
      visualResult.bidding_strategy = biddingResult;
      await saveBiddingStrategyToCloud(zpid, biddingResult);
      onProgress({ step: 'Bidding AI', status: 'completed', message: 'Strategic bidding model generated.' });
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
