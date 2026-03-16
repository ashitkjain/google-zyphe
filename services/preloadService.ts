
import { normalizeAddress, fetchPropertyDataFull, fetchPropertyImages } from './apiService.ts';
import {
  analyzePropertyImages,
  analyzeNeighborhood,
  analyzeCommunityPulse,
  analyzeComprehensive,
  analyzeInvestmentResearch,
  analyzeGeneralMarketIntelligence,
  analyzeLifestyleInsights,
  analyzeLifestyleFit,
  analyzeSchool,
  runBackgroundCityResearch,
  AiResponseError
} from './geminiService.ts';
import {
  savePropertyToCloud,
  saveVisualAnalysisToCloud,
  getVisualAnalysisFromCloud,
  saveComprehensiveAnalysisToCloud,
  getComprehensiveAnalysisFromCloud,
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
  generateCityStateKey,
  getPropertyFromCloud
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
    // --- CHECK FOR EXISTING PROPERTY DATA IN CACHE ---
    onProgress({ step: 'Discovery', status: 'running', message: 'Checking cache for existing data...' });
    let enrichedData: PropertyData | null = null;
    let zpid = providedZpid || '';

    // Try to load existing property from Firestore first
    if (zpid) {
      const cached = await getPropertyFromCloud(zpid);
      if (cached && cached.address && cached.images?.length && cached.coordinates && cached.mapZoomIn) {
        onLog?.(`[Discovery] Cache hit — loaded ${cached.address} from database (${cached.images?.length || 0} images, maps present).`);
        enrichedData = cached;
        onProgress({ step: 'Discovery', status: 'completed', message: `Loaded ${cached.address} from cache` });
      }
    }

    // Only hit external APIs if no usable cached data
    if (!enrichedData) {
      // 1 & 3. Geocoding & Property Data (Parallel)
      onProgress({ step: 'Discovery', status: 'running', message: 'Mapping location and fetching specifications...' });
      const [radar, propData] = await Promise.all([
        normalizeAddress(rawAddress, providedZpid),
        fetchPropertyDataFull(providedZpid || rawAddress, !!providedZpid, false)
      ]);

      const address = radar.formattedAddress;
      zpid = propData.zpid || providedZpid || '';
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

      enrichedData = {
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
    }

    if (!zpid) throw new Error("Could not resolve ZPID for property.");

    // --- PARALLEL AI INTELLIGENCE BLOCK ---
    onProgress({ step: 'Intelligence', status: 'running', message: 'Running parallel AI evaluation suite...' });

    const city = enrichedData.city;
    const state = enrichedData.state;
    const cityStateKey = generateCityStateKey(city, state);
    onLog?.(`[Pipeline] Location context: ${city}, ${state} (Key: ${cityStateKey})`);

    // Fetch existing visual analysis once for all sub-tasks
    const visualCache = await getVisualAnalysisFromCloud(zpid);

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
      // Cache validation: only hit if reasonably complete
      if (visualCache) {
        const check = isAnalysisComplete(visualCache, enrichedData.images?.length || 0);
        if (check.valid) {
          const cachedImgCount = visualCache.image_by_image_analysis?.length || 0;
          const currentImgCount = enrichedData.images?.length || 0;
          if (cachedImgCount >= currentImgCount) {
            onLog?.(`[Visual] Cache hit (${currentImgCount} images)`);
            return visualCache;
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
      const reason = result2._reason === 'structural_array'
        ? 'AI returned array instead of object'
        : `Missing fields: ${(result2._missing || []).join(', ')}`;
      onLog?.(`[Visual] Both attempts incomplete (${reason}). Saving partial data, pipeline will continue.`);
      const partialToSave = result2._reason === 'structural_array'
        ? { _structuralError: true, raw: result2.raw } as any
        : result2;
      await saveVisualAnalysisToCloud(zpid, partialToSave);
      throw new Error(`2 attempts incomplete — ${reason}`);
    };

    const neighborhoodTask = async () => {
      if (visualCache?.neighborhood) {
        onLog?.(`[Spatial] Cache hit.`);
        return visualCache.neighborhood;
      }
      if (!enrichedData.mapZoomIn || !enrichedData.mapZoomOut) return null;
      onLog?.(`[Spatial] Mapping neighborhood...`);
      const res = await analyzeNeighborhood(enrichedData.mapZoomIn, enrichedData.mapZoomOut, enrichedData, userId);
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


    const lifestyleTask = async () => {
      try {
        // Check cache first — lifestyle insights are stored inside property_analyses_comprehensive
        const { getLifestyleInsightsFromCloud, saveLifestyleInsightsToCloud } = await import('./firebase/properties');
        const cached = await getLifestyleInsightsFromCloud(zpid);
        if (cached?.outdoor) {
          onLog?.(`[Lifestyle] Cache hit — skipping.`);
          return { data: cached, fromCache: true };
        }
        onLog?.(`[Lifestyle] Generating lifestyle insights...`);
        const res = await analyzeLifestyleInsights(enrichedData, userId);
        if (res.data) {
          await saveLifestyleInsightsToCloud(zpid, res.data);
          onLog?.(`[Lifestyle] Insights saved.`);
        }
        return { data: res.data, fromCache: false };
      } catch (e: any) {
        onLog?.(`[Lifestyle] Failed (non-blocking): ${e.message}`);
        return { data: null, fromCache: false };
      }
    };

    const schoolsTask = async () => {
      try {
        const propertySchools = enrichedData.schools;
        if (!propertySchools?.length) {
          onLog?.(`[Schools] No schools associated with this property. Skipping.`);
          return null;
        }

        const { getSchoolAnalysisFromCloud, saveSchoolAnalysisToCloud } = await import('./firebase/properties');
        const { getSchoolCacheKey } = await import('../prompts/property/schoolsAnalysis');
        const city = enrichedData.city || '';
        const state = enrichedData.state || '';

        const analyzedSchools: any[] = [];
        let cachedCount = 0;
        let analyzedCount = 0;

        for (const school of propertySchools) {
          const cacheKey = getSchoolCacheKey(school.name, city, state);
          const cached = await getSchoolAnalysisFromCloud(cacheKey);

          if (cached?.name) {
            // Quality gate: count how many fields say "Current data not available"
            const fields = [
              cached.test_scores, cached.demographics_summary,
              cached.parent_sentiment_positive, cached.parent_sentiment_concerns,
              cached.extracurriculars, cached.recent_news, cached.overall_assessment
            ];
            const emptyCount = fields.filter(f =>
              (f || '').toLowerCase().includes('current data not available') ||
              (f || '').toLowerCase().includes('not possible') ||
              (f || '').toLowerCase().includes('data not available')
            ).length;

            if (emptyCount >= 3) {
              onLog?.(`[Schools] ⚠ Stale cache for ${school.name} (${emptyCount}/7 fields empty) — re-analyzing with Gemini 3.`);
              // Fall through to fresh analysis below
            } else {
              onLog?.(`[Schools] ✓ Cache hit: ${school.name}`);
              analyzedSchools.push({
                ...cached,
                distance_miles: parseFloat(String(school.distance).replace(/[^0-9.]/g, '')) || null,
                mls_rating: school.rating,
                is_assigned: true // from property's own school list
              });
              cachedCount++;
              continue;
            }
          }

          // Run analysis for this school
          try {
            onLog?.(`[Schools] Analyzing: ${school.name}...`);
            const res = await analyzeSchool(school, enrichedData, userId);
            if (res.data) {
              // Merge grounding sources into data if not already present from schema
              const schoolData = {
                ...res.data,
                sources: res.data.sources?.length ? res.data.sources : (res.sources || [])
              };
              await saveSchoolAnalysisToCloud(cacheKey, schoolData);
              analyzedSchools.push({
                ...schoolData,
                distance_miles: parseFloat(String(school.distance).replace(/[^0-9.]/g, '')) || null,
                mls_rating: school.rating,
                is_assigned: true
              });
              analyzedCount++;
            }
          } catch (e: any) {
            onLog?.(`[Schools] Failed for ${school.name}: ${e.message}`);
          }
        }

        onLog?.(`[Schools] Done — ${cachedCount} cached, ${analyzedCount} newly analyzed.`);

        return analyzedSchools.length > 0 ? {
          schools: analyzedSchools,
          district_name: analyzedSchools[0]?.district_name || '',
          _allCached: analyzedCount === 0 && cachedCount > 0,
        } : null;
      } catch (e: any) {
        onLog?.(`[Schools] Failed (non-blocking): ${e.message}`);
        return null;
      }
    };

    // Execute AI Tasks Parallelized for maximum speed
    // Visual, Spatial, Regional (city-level cache reads), Property Investment, Lifestyle, and Schools run simultaneously.
    // Deep Research is NOT included here — it runs separately via prefetchCityIntelligence (city-level).
    onLog?.(`[Pipeline] Launching parallel AI evaluation suite...`);
    let visualResult: any = null;
    let visualError: string | null = null;

    const [_visualResult, neighborhoodData, communityPulse, investmentSpecific, marketIntelligence, lifestyleResult, schoolsResult] = await Promise.all([
      visualTask().then(r => { visualResult = r; return r; }).catch(e => { visualError = e.message || String(e); onLog?.(`[Visual] ❌ Failed: ${visualError}`); return null; }),
      neighborhoodTask(),
      pulseTask(),
      propInvTask(),
      marketIntTask(),
      lifestyleTask(),
      schoolsTask()
    ]);

    const _lifestyleData = lifestyleResult?.data ?? null;
    const lifestyleFromCache = lifestyleResult?.fromCache ?? false;

    // Report per-task outcomes to the UI
    const reportSubtask = (name: string, result: any, cached: boolean, error?: string) => {
      if (error) {
        onProgress({ step: `AI:${name}`, status: 'error', message: error });
      } else if (!result) {
        onProgress({ step: `AI:${name}`, status: 'pending', message: 'Skipped' });
      } else if (cached) {
        onProgress({ step: `AI:${name}`, status: 'completed', message: 'Cache hit' });
      } else {
        onProgress({ step: `AI:${name}`, status: 'completed', message: 'Ran' });
      }
    };

    // Determine cache status for each task
    reportSubtask('Visual', visualResult, !!(visualCache && visualResult), visualError || undefined);
    reportSubtask('Spatial', neighborhoodData, !!(visualCache?.neighborhood && neighborhoodData));
    reportSubtask('Pulse', communityPulse, !!communityPulse); // always from cache or skipped
    reportSubtask('Investment', investmentSpecific, !!(await getPropertyInvestmentFromCloud(zpid) && investmentSpecific));
    reportSubtask('Market Intel', marketIntelligence, !!marketIntelligence); // always from cache or skipped
    reportSubtask('Lifestyle', _lifestyleData, lifestyleFromCache);
    reportSubtask('Schools', schoolsResult?.schools || schoolsResult, !!(schoolsResult && schoolsResult._allCached));

    // Track which subtasks had issues
    const warnings: string[] = [];
    if (!visualResult) warnings.push(`Visual AI${visualError ? `: ${visualError}` : ''}`);

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
      schools_intelligence: schoolsResult,
      // Deep Research is loaded from cache if available (set by prefetchCityIntelligence)
      deep_investment_research: cityStateKey ? await getDeepInvestmentResearchFromCloud(cityStateKey) : null
    };

    // 10. Lifestyle Fit Analysis (runs alongside narrative) — with cache check + quality gate
    const lifestyleFitTask = async () => {
      try {
        const { getLifestyleFitFromCloud, saveLifestyleFitToCloud } = await import('./firebase/properties');
        const cached = await getLifestyleFitFromCloud(zpid);

        // Quality gate: check if all 3 categories have verdicts and non-empty summaries
        const isComplete = cached?.working_professionals?.verdict
          && cached?.families_with_kids?.verdict
          && cached?.seniors?.verdict
          && cached?.working_professionals?.summary?.length > 20
          && cached?.families_with_kids?.summary?.length > 20
          && cached?.seniors?.summary?.length > 20;

        if (isComplete) {
          onLog?.(`[Lifestyle Fit] Cache hit — skipping.`);
          return { data: cached, fromCache: true };
        }

        onLog?.(`[Lifestyle Fit] ${cached ? 'Incomplete cache — re-analyzing.' : 'Generating lifestyle fit analysis...'}`);
        const streetView = enrichedData.streetViewAnalysis || null;
        const res = await analyzeLifestyleFit(enrichedData, visualResult, streetView, userId);
        if (res.data) {
          await saveLifestyleFitToCloud(zpid, res.data);
          onLog?.(`[Lifestyle Fit] Analysis saved.`);
        }
        return { data: res.data, fromCache: false };
      } catch (e: any) {
        onLog?.(`[Lifestyle Fit] Failed (non-blocking): ${e.message}`);
        return { data: null, fromCache: false };
      }
    };

    // 11. Narrative AI Synthesis (Final Step) — with cache check
    onProgress({ step: 'Narrative', status: 'running', message: 'Checking narrative cache...' });
    const isNarrativeComplete = (data: any): boolean => {
      if (!data) return false;
      const hasTop = !!data.summary && !!data.risks_considerations && !!data.schools_summary;
      const hasDetailed = !!data.detailed_analysis?.visual_appeal_condition
        && !!data.detailed_analysis?.outdoors_view_quality
        && !!data.detailed_analysis?.community_pulse;
      const hasInterior = !!data.interior_summary?.interior_summary
        && !!data.interior_summary?.rooms_summary
        && !!data.interior_summary?.vibe
        && Array.isArray(data.interior_summary?.objective_tags)
        && data.interior_summary.objective_tags.length > 0;
      return hasTop && hasDetailed && hasInterior;
    };

    // Run lifestyle fit and narrative in parallel
    const [lifestyleFitResult, existingNarrative] = await Promise.all([
      lifestyleFitTask(),
      getComprehensiveAnalysisFromCloud(zpid)
    ]);

    // Report lifestyle fit outcome
    reportSubtask('Lifestyle Fit', lifestyleFitResult?.data, lifestyleFitResult?.fromCache ?? false);

    if (isNarrativeComplete(existingNarrative)) {
      onLog?.(`[Narrative] Cache hit — comprehensive analysis already complete. Skipping.`);
      onProgress({ step: 'Narrative', status: 'completed', message: 'Report loaded from cache.' });
      onProgress({ step: 'AI:Narrative', status: 'completed', message: 'Cache hit' });
    } else {
      onLog?.(`[Narrative] ${existingNarrative ? 'Incomplete cache — re-running synthesis.' : 'No cache — running synthesis.'}`);
      onProgress({ step: 'Narrative', status: 'running', message: 'Synthesizing final report...' });
      const resultComp = await analyzeComprehensive(enrichedData, contextForComprehensive, userId);
      await saveComprehensiveAnalysisToCloud(zpid, resultComp.data);
      onProgress({ step: 'Narrative', status: 'completed', message: 'Report synthesized.', usage: resultComp.usage });
      onProgress({ step: 'AI:Narrative', status: 'completed', message: 'Ran' });
    }

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
  onLog?: (msg: string) => void,
  forceRefresh: boolean = false
): Promise<void> => {
  const { analyzeDeepInvestmentResearch } = await import('./geminiService.ts');
  const cityStateKey = generateCityStateKey(city, state);
  if (!cityStateKey) {
    onLog?.(`[Deep Research] Cannot determine city key for ${city}, ${state}`);
    return;
  }

  // Check cache first — skip if forceRefresh
  if (!forceRefresh) {
    const cached = await getDeepInvestmentResearchFromCloud(cityStateKey);
    const hasStructuredData = cached && cached.structured_report && (
      cached.status === 'completed' || !!(cached as any).content
    );
    if (hasStructuredData && cached?.status !== 'running') {
      onLog?.(`[Deep Research] Already completed for ${cityStateKey} (with structured_report). Skipping.`);
      return;
    }
    if (cached && !cached.structured_report) {
      onLog?.(`[Deep Research] Found legacy data for ${cityStateKey} (missing structured_report). Re-running...`);
    }
  } else {
    onLog?.(`[Deep Research] Force refresh — bypassing cache for ${cityStateKey}`);
  }

  onLog?.(`[Deep Research] Starting for ${cityStateKey}...`);
  try {
    const dummyProp = { city, state, address: `${city}, ${state}` } as PropertyData;
    const res = await analyzeDeepInvestmentResearch(dummyProp, userId, cityStateKey, onLog);
    await saveDeepInvestmentResearchToCloud(cityStateKey, res.data);
    onLog?.(`[Deep Research] Report saved for ${cityStateKey}. Extracting key insights...`);

    // Extract key insights from the report using Flash
    try {
      const { extractDeepResearchInsights } = await import('./geminiService.ts');
      const reportContent = res.data?.content || '';
      if (reportContent.length > 200) {
        const insightsRes = await extractDeepResearchInsights(reportContent, userId, cityStateKey);
        if (insightsRes.data) {
          // Save insights to the same Firestore document
          const { doc: firestoreDoc, setDoc: firestoreSetDoc } = await import('firebase/firestore');
          const { db } = await import('./firebase/config');
          if (db) {
            const docRef = firestoreDoc(db, "deep_investment_research", cityStateKey);
            await firestoreSetDoc(docRef, { key_insights: insightsRes.data }, { merge: true });
            onLog?.(`[Deep Research] Key insights extracted and saved for ${cityStateKey}.`);
          }
        }
      } else {
        onLog?.(`[Deep Research] Report content too short for insights extraction.`);
      }
    } catch (insightErr: any) {
      onLog?.(`[Deep Research] Insights extraction failed (non-blocking): ${insightErr.message}`);
    }

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

    // 2b. Fetch ArcGIS parcel polygon — skip if already cached in Firestore.
    // propData comes from fetchPropertyDataFull which reads Firestore first,
    // so parcelPolygon is populated if it was previously stored.
    let parcelData: Record<string, any> = {};
    const hasPolygon = Array.isArray((propData as any).parcelPolygon) && (propData as any).parcelPolygon.length > 3;
    let hasTaxSqft = !!(propData as any).taxSqft;
    let resolvedApn: string | undefined = (propData as any).parcelApn;
    let resolvedCounty: string | undefined = (propData as any).parcelCounty;

    if (hasPolygon) {
      onLog?.(`[Data] ArcGIS skipped — parcel polygon already cached (APN: ${resolvedApn || 'n/a'})`);
    } else if (radar.coordinates?.latitude && radar.coordinates?.longitude) {
      try {
        const { fetchParcelFromCounty, polygonToFirestore } = await import('./arcgis/countyParcels');
        const result = await fetchParcelFromCounty(
          radar.coordinates.latitude,
          radar.coordinates.longitude
        );

        if (result) {
          resolvedApn = result.apn;
          resolvedCounty = result.county;
          parcelData = {
            parcelPolygon: polygonToFirestore(result.polygon),
            parcelApn: result.apn,
            parcelAreaSqft: result.areaSqft,
            parcelCounty: result.county,
            parcelCachedAt: new Date().toISOString(),
          };

          // Tier 2: ArcGIS buildingSqft → taxSqft
          if (!hasTaxSqft && result.buildingSqft) {
            parcelData.taxSqft = result.buildingSqft;
            parcelData.taxSqftSource = `ArcGIS ${result.county}`;
            parcelData.taxSqftConfidence = 'high';
            parcelData.taxSqftCachedAt = new Date().toISOString();
            hasTaxSqft = true;
            onLog?.(`[Data] ${result.county} ArcGIS polygon: APN=${result.apn}, ${result.areaSqft}sqft, bldg=${result.buildingSqft}sf (saved as taxSqft)`);
          } else {
            onLog?.(`[Data] ${result.county} ArcGIS polygon: APN=${result.apn}, ${result.areaSqft}sqft${result.buildingSqft ? ` (taxSqft already cached, bldg=${result.buildingSqft}sf ignored)` : ', no buildingSqft from county'}`);
          }
        } else {
          onLog?.(`[Data] ArcGIS: no parcel found or county not supported at (${radar.coordinates.latitude.toFixed(4)}, ${radar.coordinates.longitude.toFixed(4)})`);
        }
      } catch (e: any) {
        onLog?.(`[Data] ArcGIS fetch skipped: ${e.message}`);
      }
    }

    // Tier 3: Gemini Search grounding fallback — only if taxSqft still missing after ArcGIS.
    // Uses the taxRecordLookup prompt (Gemini Flash + Google Search) to infer from
    // county assessor / Redfin / Zillow public facts records.
    if (!hasTaxSqft && propData.address) {
      try {
        onLog?.(`[Data] taxSqft not found in cache or ArcGIS — running Gemini tax record lookup...`);
        const { executeGeminiRequest, FLASH_MODEL } = await import('./geminiService');
        const { TAX_RECORD_LOOKUP_PROMPT, TAX_RECORD_LOOKUP_SYSTEM_INSTRUCTION } = await import('../prompts/property/taxRecordLookup');

        const prompt = TAX_RECORD_LOOKUP_PROMPT(
          propData.address,
          propData.city,
          propData.state,
          resolvedCounty,
          resolvedApn,
          propData.livingAreaValue ?? undefined,
        );

        const lookupPromise = executeGeminiRequest<any>({
          model: FLASH_MODEL,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            systemInstruction: TAX_RECORD_LOOKUP_SYSTEM_INSTRUCTION,
            maxOutputTokens: 1024,
          },
          userId: 'preload-pipeline',
          promptFilename: 'taxRecordLookup',
          zpid,
          address: propData.address,
          extractResultJson: true,
        });
        // Race against a 20s timeout — don't block the save if Gemini is slow
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000));
        const lookupResult = await Promise.race([lookupPromise, timeoutPromise]);

        if (lookupResult && (lookupResult as any).data?.tax_sqft > 0) {
          const taxData = (lookupResult as any).data;
          parcelData.taxSqft = taxData.tax_sqft;
          parcelData.taxSqftSource = taxData.source || 'gemini-lookup';
          parcelData.taxSqftConfidence = taxData.confidence || 'medium';
          parcelData.taxSqftCachedAt = new Date().toISOString();
          onLog?.(`[Data] Gemini tax lookup: ${taxData.tax_sqft} sf (source: ${taxData.source}, confidence: ${taxData.confidence})`);
        } else {
          onLog?.(`[Data] Gemini tax lookup: no result or timed out`);
        }
      } catch (e: any) {
        onLog?.(`[Data] Gemini tax lookup failed: ${e.message}`);
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
