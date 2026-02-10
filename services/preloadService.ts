
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
  onLog?: (msg: string) => void
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

    const enrichedData: PropertyData = {
      ...propData,
      zpid: zpid,
      feed_property_id: providedZpid,
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

    const city = radar.components?.city || enrichedData.city;
    const state = radar.components?.state || enrichedData.state;
    const cityStateKey = generateCityStateKey(city, state);

    // Prepare Parallel Tasks
    const isAnalysisComplete = (res: any) => {
      if (!res) return { valid: false, missing: ["No data returned"] };
      const missing = [];
      const hasInterior = !!(res.home_interior?.overall_description && res.home_interior.overall_description.length > 50);
      const hasExterior = !!(res.exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style);
      const hasRooms = !!(res.room_highlights && res.room_highlights.length > 0);

      if (!hasInterior) missing.push("Interior description (short or missing)");
      if (!hasExterior) missing.push("Exterior analysis");
      if (!hasRooms) missing.push("Room highlights/analysis");

      return {
        valid: missing.length === 0,
        missing
      };
    };

    const visualTask = async () => {
      const cached = await getVisualAnalysisFromCloud(zpid);

      // Cache validation: only hit if reasonably complete
      if (cached) {
        const check = isAnalysisComplete(cached);
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
      const res = await analyzePropertyImages(enrichedData.images!, enrichedData);

      const check = isAnalysisComplete(res.data);
      if (!check.valid) {
        const keys = res.data ? Object.keys(res.data) : 'null/undefined';
        const errorMsg = `Visual Intelligence synthesis was incomplete: ${check.missing?.join(', ')}. (Received: ${typeof keys === 'string' ? keys : keys.join(', ')})`;
        onLog?.(`[Visual] ERROR: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      onLog?.(`[Visual] Analysis complete.`);
      return res.data;
    };

    const neighborhoodTask = async () => {
      if (!assets.mapZoomIn || !assets.mapZoomOut) return null;
      onLog?.(`[Spatial] Mapping neighborhood...`);
      const res = await analyzeNeighborhood(assets.mapZoomIn, assets.mapZoomOut, enrichedData);
      onLog?.(`[Spatial] Mapping complete.`);
      return res.data;
    };

    const pulseTask = async () => {
      if (cityStateKey) {
        const cached = await getCommunityPulseFromCloud(cityStateKey);
        if (cached) {
          onLog?.(`[Market] Pulse cache hit: ${cityStateKey}`);
          return cached;
        }
      }
      onLog?.(`[Market] Analyzing resident sentiment...`);
      const res = await analyzeCommunityPulse(enrichedData);
      if (cityStateKey) await saveCommunityPulseToCloud(cityStateKey, res.data);
      onLog?.(`[Market] Sentiment analysis complete.`);
      return res.data;
    };

    const investmentTask = async () => {
      const propInvTask = async () => {
        const cached = await getPropertyInvestmentFromCloud(zpid);
        if (cached) return cached;
        const res = await analyzeInvestmentResearch(enrichedData);
        await savePropertyInvestmentToCloud(zpid, res.data);
        return res.data;
      };

      const marketIntTask = async () => {
        const key = cityStateKey || zpid;
        const cached = await getGeneralMarketIntelligenceFromCloud(key);
        if (cached) return cached;
        const res = await analyzeGeneralMarketIntelligence(enrichedData);
        await saveGeneralMarketIntelligenceToCloud(key, res.data);
        return res.data;
      };

      onLog?.(`[Investment] Scouring market historics...`);
      const specific = await propInvTask();
      const general = await marketIntTask();
      onLog?.(`[Investment] Market research complete.`);
      return { specific, general };
    };

    // Execute AI Tasks Sequentially to prevent race conditions & improve reliability
    const visualResult = await visualTask();
    const neighborhoodData = await neighborhoodTask();
    const communityPulse = await pulseTask();
    const investmentData = await investmentTask();

    // Assembly
    const finalVisualResult: CustomAIAnalysisResult = {
      ...visualResult,
      neighborhood: neighborhoodData || undefined,
      community_pulse: communityPulse,
      property_investment: investmentData.specific,
      general_market_intelligence: investmentData.general
    };

    // Save final visual state
    await saveVisualAnalysisToCloud(zpid, finalVisualResult);
    if (finalVisualResult.image_quality_analysis) {
      await saveImageQualityAnalysisToCloud(zpid, finalVisualResult.image_quality_analysis);
    }
    onProgress({ step: 'Intelligence', status: 'completed', message: 'AI Evaluations complete.' });

    // 10. Narrative AI Synthesis (Final Step)
    onProgress({ step: 'Narrative', status: 'running', message: 'Synthesizing final report...' });
    const resultComp = await analyzeComprehensive(enrichedData, finalVisualResult);
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
