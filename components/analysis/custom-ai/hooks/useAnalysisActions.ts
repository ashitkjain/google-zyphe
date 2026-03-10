import { useState, useEffect } from 'react';
import {
    CustomAIAnalysisResult,
    PropertySpecificInvestmentResult,
    GeneralMarketIntelligenceResult,
    ContextGraphExtractionResult
} from '../../../../types';
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
    saveGoogleDataToCloud
} from '../../../../services/firebaseService';
import { fetchNearbyPlaces } from '../../../../services/apiService';
import {
    analyzePropertyImages as aiAnalyzeImages,
    analyzeInvestmentResearch as aiAnalyzeInvestment,
    analyzeGeneralMarketIntelligence as aiAnalyzeMarket,
    analyzeBiddingStrategy as aiAnalyzeBidding,
    analyzeCommunityPulse as aiAnalyzePulse,
    analyzeNeighborhood as aiAnalyzeNeighborhood,
    analyzeDeepInvestmentResearch as aiAnalyzeDeepResearch,
    extractContextGraphFactors as aiExtractGraphFactors
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
    const [biddingLoading, setBiddingLoading] = useState(false);
    const [pulseLoading, setPulseLoading] = useState(false);
    const [deepLoading, setDeepLoading] = useState(false);
    const [neighborhoodLoading, setNeighborhoodLoading] = useState(false);
    useEffect(() => {
        let intervalId: any = null;

        if (isInitialLoading || qualityLoading || investmentLoading || biddingLoading || pulseLoading || deepLoading || neighborhoodLoading || graphLoading) {
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
    }, [isInitialLoading, qualityLoading, investmentLoading, biddingLoading, pulseLoading, deepLoading, neighborhoodLoading]);

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

    const handleRunCommunityPulse = async () => {
        if (!analysis || !propertyData || pulseLoading) return;

        setTimer(0);
        setPulseLoading(true);
        addLog('System', { type: 'info' }, { task: 'community_pulse_init', zpid });

        try {
            const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
            const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
            const cityStateKey = generateCityStateKey(city, state);

            let pulseData = null;
            if (cityStateKey) {
                pulseData = await getCommunityPulseFromCloud(cityStateKey);
            }

            if (pulseData) {
                addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'community_pulse', location: cityStateKey || zpid });
            } else {
                addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'community_pulse', location: cityStateKey || zpid });
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
        addLog('System', { type: 'info' }, { message: "Market Intelligence (Regional) is currently DISABLED." });
        setInvestmentLoading(false);
        return;
        /*
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
        */
    };

    const handleRunBiddingStrategy = async () => {
        if (!analysis || !zpid || !propertyData || biddingLoading) return;

        setTimer(0);
        setBiddingLoading(true);

        try {
            addLog('Gemini AI', { type: 'request' }, { task: 'bidding_strategy', zpid, model: APP_CONFIG.models.flash });
            const res = await aiAnalyzeBidding(propertyData);
            const result = res.data;

            onUpdateAnalysis({ ...analysis, bidding_strategy: result });
            addLog('Gemini AI', { type: 'response' }, { task: 'bidding_strategy', zpid, data: result }, (res as any).usage);
        } catch (err: any) {
            console.error("Bidding Strategy Failed:", err);
            addLog('System', { type: 'error' }, { message: "Bidding Strategy Failed", error: err.message || err });
        } finally {
            setBiddingLoading(false);
        }
    };


    const handleRunDeepInvestmentResearch = async () => {
        if (!analysis || !propertyData || deepLoading) return;

        setDeepLoading(true);
        try {
            const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
            const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
            const cityStateKey = generateCityStateKey(city, state);

            if (!cityStateKey) return;

            const deepData = await getDeepInvestmentResearchFromCloud(cityStateKey);
            if (deepData) {
                addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'deep_investment_research', location: cityStateKey });
                onUpdateAnalysis({ ...analysis, deep_investment_research: deepData });
            } else {
                addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'deep_investment_research', location: cityStateKey });
                // No data — UI will show "Not Available". Run City Research in Market Discovery to generate it.
            }
        } catch (err: any) {
            console.error("Deep Investment Research load failed:", err);
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
                    setGraphResult(cached as ContextGraphExtractionResult);
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

            let enrichedAnalysis = { ...analysis };
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

            if (enrichedAny) {
                addLog('Cloud Cache', { type: 'info' }, { task: 'enriched_context_for_graph', cityStateKey });
                onUpdateAnalysis(enrichedAnalysis);
            }

            // 3. Extract via Gemini
            addLog('Gemini AI', { type: 'request' }, { task: 'context_graph_extraction', zpid, model: 'gemini-2.0-flash' });
            const res = await aiExtractGraphFactors(propertyData, enrichedAnalysis, comprehensiveResult || null);

            if (res.data) {
                setGraphResult(res.data);
                addLog('Gemini AI', { type: 'response' }, { task: 'context_graph_extraction', zpid, factors: res.data.factors?.length }, (res as any).usage);

                // 4. Save to Firestore cache (overwrite on re-extract)
                if (zpid) {
                    await saveContextGraphToCloud(zpid, res.data);
                    addLog('Cloud Cache', { type: 'info' }, { status: 'Saved', task: 'context_graph', zpid });
                }

                // 5. Sync back to main analysis state
                onUpdateAnalysis({
                    ...enrichedAnalysis,
                    context_graph: res.data
                });
            }
        } catch (err: any) {
            console.error("Context Graph Extraction Failed:", err);
            addLog('System', { type: 'error' }, { message: "Context Graph Extraction Failed", error: err.message || err });
        } finally {
            setGraphLoading(false);
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
            let places = propertyData.neighborhoodPlaces;
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
                    saveGoogleDataToCloud(String(zpid), { neighborhoodPlaces: freshPlaces })
                        .catch(e => console.warn('[handleRunNeighborhoodAnalysis] Places save failed:', e));
                } else {
                    addLog('Local Search', { type: 'info' }, { task: 'refreshing_unified_places', status: 'no_update', message: 'Proceeding with cached places.' });
                }
            }

            // 2. Trigger Gemini Visual Analysis
            addLog('Gemini AI', { type: 'request' }, { task: 'neighborhood_analysis', zpid, model: APP_CONFIG.models.flash, message: "Synthesizing visual and place context..." });
            const res = await aiAnalyzeNeighborhood(propertyData.mapZoomIn, propertyData.mapZoomOut, { ...propertyData, neighborhoodPlaces: places });
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
        biddingLoading,
        pulseLoading,
        deepLoading,
        graphLoading,
        neighborhoodLoading,
        graphResult,
        handleRunQualityAnalysis,
        handleRunCommunityPulse,
        handleRunInvestmentResearch,
        handleRunBiddingStrategy,
        handleRunDeepInvestmentResearch,
        handleExtractContextGraph,
        handleReExtractContextGraph,
        handleRunNeighborhoodAnalysis,
    };
};
