import { useState, useEffect } from 'react';
import {
    CustomAIAnalysisResult,
    PropertySpecificInvestmentResult,
    GeneralMarketIntelligenceResult
} from '../../../../types';
import { 
    ContextGraphExtractionResult, 
    mergeCityFactors,
    CITY_LEVEL_FACTOR_IDS
} from '../../../../constants/contextGraphFactors';
import {
    getImageQualityAnalysisFromCloud,
    getCommunityPulseFromCloud,
    saveCommunityPulseToCloud,
    saveVisualAnalysisToCloud,
    saveImageQualityAnalysisToCloud,
    getPropertyInvestmentFromCloud,
    savePropertyInvestmentToCloud,
    generateCityStateKey,
    getGeneralMarketIntelligenceFromCloud,
    saveGeneralMarketIntelligenceToCloud,
    getDeepInvestmentResearchFromCloud,
    saveDeepInvestmentResearchToCloud,
    getContextGraphFromCloud,
    saveContextGraphToCloud,
    saveThirdPartyDataToCloud,
    getCityContextGraphFromCloud,
    saveCityContextGraphToCloud
} from '../../../../services/firebaseService';
import { fetchNearbyPlaces } from '../../../../services/apiService';
import {
    analyzePropertyImages as aiAnalyzeImages,
    analyzeInvestmentResearch as aiAnalyzeInvestment,
    analyzeGeneralMarketIntelligence as aiAnalyzeMarket,

    analyzeCommunityPulse as aiAnalyzePulse,
    analyzeNeighborhood as aiAnalyzeNeighborhood,
    analyzeDeepInvestmentResearch as aiAnalyzeDeepResearch,
    extractContextGraphFactors as aiExtractGraphFactors,
    extractCityContextGraph as aiExtractCityContextGraph
} from '../../../../services/geminiService';
import { APP_CONFIG } from '../../../../config';
export const useAnalysisActions = (
    analysis: CustomAIAnalysisResult | null,
    zpid: string | undefined,
    propertyData: any,
    propertyImages: string[],
    onUpdateAnalysis: (updated: CustomAIAnalysisResult) => void,
    addLog: (service: string, meta: { type: 'request' | 'response' | 'error' | 'info' }, content: any, usage?: any) => void,
    isInitialLoading?: boolean,
    comprehensiveResult?: any
) => {
    const [timer, setTimer] = useState(0);
    const [qualityLoading, setQualityLoading] = useState(false);
    const [investmentLoading, setInvestmentLoading] = useState(false);

    const [pulseLoading, setPulseLoading] = useState(false);
    const [deepLoading, setDeepLoading] = useState(false);
    const [neighborhoodLoading, setNeighborhoodLoading] = useState(false);
    useEffect(() => {
        let intervalId: any = null;

        if (isInitialLoading || qualityLoading || investmentLoading || pulseLoading || deepLoading || neighborhoodLoading || graphLoading) {
            // Reset timer when a new loading state starts
            intervalId = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } else {
            setTimer(0);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isInitialLoading, qualityLoading, investmentLoading, pulseLoading, deepLoading, neighborhoodLoading]);

    const handleRunQualityAnalysis = async () => {
        if (!analysis || analysis.image_quality_analysis || !propertyImages.length || qualityLoading) {
            return;
        }

        setTimer(0);
        setQualityLoading(true);
        addLog('Cloud Cache', { type: 'request' }, { zpid, task: 'image_quality_analysis' });
        try {
            if (zpid) {
                const cloudCached = await getImageQualityAnalysisFromCloud(zpid);
                if (cloudCached) {
                    addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'image_quality_analysis', zpid, data: cloudCached });
                    onUpdateAnalysis({
                        ...analysis,
                        image_quality_analysis: cloudCached
                    });
                    setQualityLoading(false);
                    return;
                }
                addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'image_quality_analysis', zpid });
            }

            // MANDATORY ASSET SECURING
            let securedImages = propertyImages;
            if (zpid) {
                try {
                    const { securePropertyAssets } = await import('../../../../services/assetService');
                    const assets = await securePropertyAssets(zpid, propertyImages, {
                        zoomIn: propertyData.mapZoomIn,
                        zoomOut: propertyData.mapZoomOut
                    });
                    securedImages = assets.images;
                } catch (e) {
                    console.warn("[useAnalysisActions] Asset securing failed:", e);
                }
            }

            addLog('Gemini AI', { type: 'request' }, { task: 'visual_analysis_consolidated', zpid });
            const res = await aiAnalyzeImages(securedImages, propertyData);
            const result = res.data;

            onUpdateAnalysis(result);
            addLog('Gemini AI', { type: 'response' }, { task: 'visual_analysis_consolidated', zpid, data: result }, (res as any).usage);

            if (zpid) {
                addLog('Cloud Cache', { type: 'info' }, { task: 'saving_visual_results', zpid });
                await saveVisualAnalysisToCloud(zpid, result);

                if (result.image_quality_analysis) {
                    await saveImageQualityAnalysisToCloud(zpid, result.image_quality_analysis);
                }
            }
        } catch (err: any) {
            console.error("Picture Quality Analysis Failed:", err);
            addLog('System', { type: 'error' }, { message: "Picture Quality Analysis Failed", error: err.message || err });
        } finally {
            setQualityLoading(false);
        }
    };

    const handleRunCommunityPulse = async (force = false) => {
        if (!analysis || !propertyData || pulseLoading) return;

        setTimer(0);
        setPulseLoading(true);
        addLog('System', { type: 'info' }, { task: 'community_pulse_init', zpid, action: force ? 'refresh' : 'load' });

        try {
            const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
            const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
            const cityStateKey = generateCityStateKey(city, state);

            let pulseData = null;
            if (cityStateKey && !force) {
                pulseData = await getCommunityPulseFromCloud(cityStateKey);
            }

            if (pulseData && !force) {
                addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'community_pulse', location: cityStateKey || zpid });
            } else {
                if (force) {
                    addLog('Cloud Cache', { type: 'info' }, { status: 'Bypassed', task: 'community_pulse', reason: 'Force refresh requested' });
                } else {
                    addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'community_pulse', location: cityStateKey || zpid });
                }
                const res = await aiAnalyzePulse(propertyData);
                pulseData = res.data;
                if (cityStateKey) {
                    await saveCommunityPulseToCloud(cityStateKey, pulseData);
                }
                addLog('Gemini AI', { type: 'response' }, { task: 'community_pulse', location: cityStateKey || zpid }, (res as any).usage);
            }

            onUpdateAnalysis({
                ...analysis,
                community_pulse: pulseData
            });

        } catch (err: any) {
            console.error("Community Pulse Failed:", err);
            addLog('System', { type: 'error' }, { message: "Community Pulse Failed", error: err.message || err });
        } finally {
            setPulseLoading(false);
        }
    };

    const handleRunInvestmentResearch = async () => {
        if (!analysis || !zpid || !propertyData || investmentLoading) return;

        setTimer(0);
        setInvestmentLoading(true);
        addLog('System', { type: 'info' }, { task: 'investment_research_parallel_init', zpid });

        try {
            let propInvestment: PropertySpecificInvestmentResult | null = await getPropertyInvestmentFromCloud(zpid);
            if (propInvestment) {
                addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'property_investment', zpid });
            } else {
                addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'property_investment', zpid });
                const res = await aiAnalyzeInvestment(propertyData);
                propInvestment = res.data;
                await savePropertyInvestmentToCloud(zpid, propInvestment);
                addLog('Gemini AI', { type: 'response' }, { task: 'property_investment', zpid }, (res as any).usage);
            }

            const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
            const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
            const cityStateKey = generateCityStateKey(city, state);

            let generalMarket: GeneralMarketIntelligenceResult | null = null;
            if (cityStateKey) {
                generalMarket = await getGeneralMarketIntelligenceFromCloud(cityStateKey);
            }

            if (generalMarket) {
                addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'general_market_intelligence', location: cityStateKey || zpid });
            } else {
                addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'general_market_intelligence', location: cityStateKey || zpid });
                const res = await aiAnalyzeMarket(propertyData);
                generalMarket = res.data;
                if (cityStateKey) {
                    await saveGeneralMarketIntelligenceToCloud(cityStateKey, generalMarket);
                } else {
                    await saveGeneralMarketIntelligenceToCloud(zpid, generalMarket!);
                }
                addLog('Gemini AI', { type: 'response' }, { task: 'general_market_intelligence', location: cityStateKey || zpid }, (res as any).usage);
            }

            onUpdateAnalysis({
                ...analysis,
                property_investment: propInvestment,
                general_market_intelligence: generalMarket
            });

        } catch (err: any) {
            console.error("Investment Research Failed:", err);
            addLog('System', { type: 'error' }, { message: "Investment Research Failed", error: err.message || err });
        } finally {
            setInvestmentLoading(false);
        }
    };




    const handleRunDeepInvestmentResearch = async (forceRefresh = false) => {
        if (!analysis || !propertyData || deepLoading) return;

        setTimer(0);
        setDeepLoading(true);
        addLog('System', { type: 'info' }, { task: 'deep_investment_research', zpid, action: forceRefresh ? 'force_refresh' : 'load' });

        try {
            const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
            const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
            const cityStateKey = generateCityStateKey(city, state);

            if (!cityStateKey) {
                addLog('System', { type: 'error' }, { message: 'Cannot generate city-state key', city, state });
                return;
            }

            // 1. Check cache first (skip if force refresh)
            if (!forceRefresh) {
                addLog('Cloud Cache', { type: 'request' }, { task: 'deep_investment_research', location: cityStateKey });
                const deepData = await getDeepInvestmentResearchFromCloud(cityStateKey);
                if (deepData && deepData.structured_report) {
                    addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'deep_investment_research', location: cityStateKey, hasStructuredReport: !!deepData.structured_report });
                    onUpdateAnalysis({ ...analysis, deep_investment_research: deepData });
                    return;
                }
                addLog('Cloud Cache', { type: 'info' }, { status: deepData ? 'Hit (missing structured_report — re-running)' : 'Miss', task: 'deep_investment_research', location: cityStateKey });
            } else {
                addLog('Cloud Cache', { type: 'info' }, { status: 'Bypassed', task: 'deep_investment_research', reason: 'Force refresh' });
            }

            // 2. Run actual AI deep research
            addLog('Gemini AI', { type: 'request' }, { task: 'deep_investment_research', location: cityStateKey, model: 'deep-research-pro-preview' });
            const deepRes = await aiAnalyzeDeepResearch(propertyData, 'unknown', cityStateKey, (msg) => {
                addLog('System', { type: 'info' }, { message: msg });
            });

            addLog('Gemini AI', { type: 'response' }, {
                task: 'deep_investment_research',
                location: cityStateKey,
                hasStructuredReport: !!deepRes.data?.structured_report,
                contentLength: deepRes.data?.content?.length || 0
            }, deepRes.usage);

            // 3. Save to Firestore
            await saveDeepInvestmentResearchToCloud(cityStateKey, deepRes.data);
            addLog('Cloud Cache', { type: 'info' }, { task: 'deep_investment_research_saved', location: cityStateKey });

            // 4. Update UI
            onUpdateAnalysis({ ...analysis, deep_investment_research: deepRes.data });

        } catch (err: any) {
            console.error("Deep Investment Research Failed:", err);
            addLog('System', { type: 'error' }, { message: "Deep Investment Research Failed", error: err.message || err });
        } finally {
            setDeepLoading(false);
        }
    };

    const [graphLoading, setGraphLoading] = useState(false);
    const [graphResult, setGraphResult] = useState<ContextGraphExtractionResult | null>(analysis?.context_graph || null);

    useEffect(() => {
        if (analysis?.context_graph) {
            setGraphResult(analysis.context_graph);
        }
    }, [analysis?.context_graph]);

    const handleExtractContextGraph = async (forceRefresh = false) => {
        if (!analysis || !propertyData || graphLoading) return;

        setTimer(0);
        setGraphLoading(true);
        addLog('System', { type: 'info' }, { task: 'context_graph_extraction', zpid, forceRefresh });

        try {
            // 1. Check Firestore cache first — skip if forceRefresh (Re-Extract)
            if (zpid && !forceRefresh) {
                const cached = await getContextGraphFromCloud(zpid);
                if (cached && cached.factors && cached.factors.length > 0) {
                    addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'context_graph', zpid, factors: cached.factors.length });
                    
                    // Always ensure latest city context is merged into the cached property graph
                    const finalGraph = await handleCityMerge(cached as ContextGraphExtractionResult);
                    setGraphResult(finalGraph);
                    setGraphLoading(false);
                    return;
                }
                addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'context_graph', zpid });
            } else if (forceRefresh) {
                addLog('Cloud Cache', { type: 'info' }, { status: 'Bypassed', task: 'context_graph', zpid, reason: 'Re-Extract forced' });
            }

            // 2. Proactively enrich 'analysis' with city-level data from cloud if missing
            const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
            const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
            const cityStateKey = generateCityStateKey(city, state);

            let enrichedAnalysis = { ...analysis } as any;
            let enrichedAny = false;

            if (cityStateKey) {
                const [pulseData, marketData, deepData] = await Promise.all([
                    !analysis.community_pulse ? getCommunityPulseFromCloud(cityStateKey) : Promise.resolve(null),
                    !analysis.general_market_intelligence ? getGeneralMarketIntelligenceFromCloud(cityStateKey) : Promise.resolve(null),
                    !analysis.deep_investment_research ? getDeepInvestmentResearchFromCloud(cityStateKey) : Promise.resolve(null)
                ]);

                if (pulseData) {
                    enrichedAnalysis.community_pulse = pulseData;
                    enrichedAny = true;
                }
                if (marketData) {
                    enrichedAnalysis.general_market_intelligence = marketData;
                    enrichedAny = true;
                }
                if (deepData && (deepData.status === 'completed' || deepData.content)) {
                    enrichedAnalysis.deep_investment_research = deepData;
                    enrichedAny = true;
                }
            }

            // Fetch lifestyle_fit from Firestore if not already on the analysis object
            if (!enrichedAnalysis.lifestyle_fit && zpid) {
                try {
                    const { getLifestyleFitFromCloud } = await import('../../../../services/firebase/properties');
                    const lifestyleFit = await getLifestyleFitFromCloud(zpid);
                    if (lifestyleFit) {
                        enrichedAnalysis.lifestyle_fit = lifestyleFit;
                        enrichedAny = true;
                    }
                } catch (e) {
                    console.warn('[Context Graph] lifestyle_fit fetch failed:', e);
                }
            }

            // Fetch schools_intelligence from Firestore if not already on the analysis object
            if (!enrichedAnalysis.schools_intelligence && propertyData?.schools?.length) {
                try {
                    const { getSchoolAnalysisFromCloud } = await import('../../../../services/firebase/properties');
                    const { getSchoolCacheKey } = await import('../../../../prompts/property/schoolsAnalysis');
                    const city = propertyData.city || '';
                    const state = propertyData.state || '';
                    const schoolResults: any[] = [];
                    for (const school of propertyData.schools) {
                        const cacheKey = getSchoolCacheKey(school.name, city, state);
                        const cached = await getSchoolAnalysisFromCloud(cacheKey);
                        if (cached?.name) {
                            schoolResults.push({
                                ...cached,
                                distance_miles: parseFloat(String(school.distance).replace(/[^0-9.]/g, '')) || null,
                                mls_rating: school.rating,
                                is_assigned: true
                            });
                        }
                    }
                    if (schoolResults.length > 0) {
                        enrichedAnalysis.schools_intelligence = { schools: schoolResults, district_name: schoolResults[0]?.district_name || '' };
                        enrichedAny = true;
                        console.log(`[Context Graph] Loaded schools_intelligence for ${schoolResults.length} schools`);
                    }
                } catch (e) {
                    console.warn('[Context Graph] schools_intelligence fetch failed:', e);
                }
            }

            if (enrichedAny) {
                addLog('Cloud Cache', { type: 'info' }, { task: 'enriched_context_for_graph', cityStateKey });
                onUpdateAnalysis(enrichedAnalysis);
            }

            // 3. Extract via Gemini
            addLog('Gemini AI', { type: 'request' }, { task: 'context_graph_extraction', zpid, model: 'gemini-2.0-flash' });
            
            // 3.0 Pre-extraction check: Ensure city context graph exists, auto-extract if missing
            // If the city data (pulse/research) was just loaded, we might need to fill those factors
            if (cityStateKey) {
                const cityGraph = await getCityContextGraphFromCloud(cityStateKey);
                if (!cityGraph && enrichedAnalysis.deep_investment_research && enrichedAnalysis.community_pulse) {
                    addLog('Gemini AI', { type: 'request' }, { status: 'City_Factors_Auto_Spawn', cityStateKey });
                    const cityCity = propertyData?.city;
                    const cityState = propertyData?.state;
                    if (cityCity && cityState) {
                        try {
                            const spawned = await aiExtractCityContextGraph(
                                cityCity, cityState, 
                                enrichedAnalysis.deep_investment_research, 
                                enrichedAnalysis.community_pulse,
                                auth.currentUser?.uid || 'anon'
                            );
                            if (spawned.data) {
                                await saveCityContextGraphToCloud(cityStateKey, spawned.data);
                                addLog('Cloud Cache', { type: 'info' }, { status: 'City_Factors_Saved', cityStateKey });
                            }
                        } catch (e) {
                            console.warn('[Context Graph] Automatic city factor extraction failed:', e);
                        }
                    }
                }
            }

            const res = await aiExtractGraphFactors(propertyData, enrichedAnalysis, comprehensiveResult || null);

            if (res.data) {
                // Merge latest city factors after fresh extraction
                const finalGraph = await handleCityMerge(res.data);
                setGraphResult(finalGraph);
                addLog('Gemini AI', { type: 'response' }, { task: 'context_graph_extraction', zpid, factors: finalGraph.factors?.length }, (res as any).usage);

                // 4. Save to Firestore cache (overwrite on re-extract)
                // Note: We save the property-specific graph res.data (NOT the merged graph)
                // to keep the property doc clean and allow read-time city updates.
                if (zpid) {
                    await saveContextGraphToCloud(zpid, res.data, propertyData?.city, propertyData?.state, {
                        price: propertyData?.price ?? propertyData?.zestimate,
                        beds: propertyData?.bedrooms,
                        baths: propertyData?.bathrooms,
                        sqft: propertyData?.livingAreaValue,
                        yearBuilt: propertyData?.yearBuilt,
                        homeType: propertyData?.homeType,
                        address: propertyData?.address
                    });
                    addLog('Cloud Cache', { type: 'info' }, { status: 'Saved', task: 'context_graph', zpid });
                }

                // 5. Sync back to main analysis state
                onUpdateAnalysis({
                    ...enrichedAnalysis,
                    context_graph: finalGraph
                });
            }
        } catch (err: any) {
            console.error("Context Graph Extraction Failed:", err);
            addLog('System', { type: 'error' }, { message: "Context Graph Extraction Failed", error: err.message || err });
        } finally {
            setGraphLoading(false);
        }
    };

    /** Unified helper to merge current city intelligence into any property-level graph */
    const handleCityMerge = async (graph: ContextGraphExtractionResult): Promise<ContextGraphExtractionResult> => {
        const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
        const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
        const cityStateKey = generateCityStateKey(city, state);
        
        if (!cityStateKey) return graph;
        
        try {
            const cityGraph = await getCityContextGraphFromCloud(cityStateKey);
            if (!cityGraph) return graph;
            
            const merged = mergeCityFactors(graph, cityGraph);
            console.log(`[Context Graph] Merged ${CITY_LEVEL_FACTOR_IDS.length} city-level factors for ${city}`);
            return merged;
        } catch (e) {
            console.warn('[Context Graph] City factor merge failed:', e);
            return graph;
        }
    };

    const handleReExtractContextGraph = () => handleExtractContextGraph(true);

    const handleRunNeighborhoodAnalysis = async () => {
        if (!analysis || !propertyData || neighborhoodLoading) return;
        if (!propertyData.mapZoomIn || !propertyData.mapZoomOut) {
            addLog('System', { type: 'error' }, { message: "Neighborhood Analysis failed: Zoom In/Out maps missing." });
            return;
        }

        setTimer(0);
        setNeighborhoodLoading(true);

        try {
            // 1. Proactively refresh/unify nearby places (Google + Foursquare) to ensure the prompt has fresh context
            addLog('Places Intelligence', { type: 'info' }, { task: 'places_refresh_start', zpid });
            let places = propertyData.google_places;
            if (propertyData.coordinates?.latitude && propertyData.coordinates?.longitude) {
                addLog('Local Search', { type: 'request' }, { task: 'refreshing_unified_places', zpid });
                const freshPlaces = await fetchNearbyPlaces(
                    propertyData.coordinates.latitude,
                    propertyData.coordinates.longitude,
                    zpid,
                    propertyData.address,
                    places,
                    true // forceRefresh
                );
                if (freshPlaces) {
                    places = freshPlaces;
                    addLog('Local Search', { type: 'response' }, { task: 'refreshing_unified_places', status: 'success', venue_count: Object.values(freshPlaces).flat().length });
                    // Persist to cloud environmental doc so UI sees it on next poll/refresh
                    saveThirdPartyDataToCloud(String(zpid), { google_places: freshPlaces } as any)
                        .catch(e => console.warn('[handleRunNeighborhoodAnalysis] Places save failed:', e));
                } else {
                    addLog('Local Search', { type: 'info' }, { task: 'refreshing_unified_places', status: 'no_update', message: 'Proceeding with cached places.' });
                }
            }

            // 2. Trigger Gemini Visual Analysis
            addLog('Gemini AI', { type: 'request' }, { task: 'neighborhood_analysis', zpid, model: APP_CONFIG.models.flash, message: "Synthesizing visual and place context..." });
            const res = await aiAnalyzeNeighborhood(propertyData.mapZoomIn, propertyData.mapZoomOut, { ...propertyData, google_places: places });
            const result = res.data;

            if (!result || !result.overview) {
                throw new Error("Invalid response received from AI analysis.");
            }

            const updatedAnalysis = { ...analysis, neighborhood: result };
            onUpdateAnalysis(updatedAnalysis);
            addLog('Gemini AI', { type: 'response' }, { task: 'neighborhood_analysis', zpid, status: 'success' }, (res as any).usage);

            if (zpid) {
                await saveVisualAnalysisToCloud(zpid, updatedAnalysis);
            }
        } catch (err: any) {
            console.error("Neighborhood Analysis Failed:", err);
            addLog('System', { type: 'error' }, { message: "Neighborhood Analysis Failed", error: err.message || err });
        } finally {
            setNeighborhoodLoading(false);
        }
    };

    return {
        timer,
        qualityLoading,
        investmentLoading,

        pulseLoading,
        deepLoading,
        graphLoading,
        neighborhoodLoading,
        graphResult,
        handleRunQualityAnalysis,
        handleRunCommunityPulse,
        handleRunInvestmentResearch,

        handleRunDeepInvestmentResearch,
        handleExtractContextGraph,
        handleReExtractContextGraph,
        handleRunNeighborhoodAnalysis,
    };
};
