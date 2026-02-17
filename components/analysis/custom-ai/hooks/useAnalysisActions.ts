import { useState, useEffect } from 'react';
import { CustomAIAnalysisResult, PropertySpecificInvestmentResult, GeneralMarketIntelligenceResult } from '../../../../types';
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
    saveContextGraphToCloud
} from '../../../../services/firebaseService';
import {
    analyzePropertyImages as aiAnalyzeImages,
    analyzeInvestmentResearch as aiAnalyzeInvestment,
    analyzeGeneralMarketIntelligence as aiAnalyzeMarket,
    analyzeBiddingStrategy as aiAnalyzeBidding,
    analyzeCommunityPulse as aiAnalyzePulse,
    analyzeDeepInvestmentResearch as aiAnalyzeDeepResearch,
    extractContextGraphFactors as aiExtractGraphFactors
} from '../../../../services/geminiService';
import { ContextGraphExtractionResult } from '../../../../prompts/property/contextGraphExtraction';
import { APP_CONFIG } from '../../../../config';

export const useAnalysisActions = (
    analysis: CustomAIAnalysisResult | null,
    zpid: string | undefined,
    propertyData: any,
    propertyImages: string[],
    onUpdateAnalysis: (updated: CustomAIAnalysisResult) => void,
    addLog: (service: string, meta: { type: 'request' | 'response' | 'error' | 'info' }, content: any, usage?: any) => void,
    isInitialLoading?: boolean
) => {
    const [timer, setTimer] = useState(0);
    const [qualityLoading, setQualityLoading] = useState(false);
    const [investmentLoading, setInvestmentLoading] = useState(false);
    const [biddingLoading, setBiddingLoading] = useState(false);
    const [pulseLoading, setPulseLoading] = useState(false);
    const [deepLoading, setDeepLoading] = useState(false);
    useEffect(() => {
        let intervalId: any = null;

        if (isInitialLoading || qualityLoading || investmentLoading || biddingLoading || pulseLoading || deepLoading) {
            // Reset timer when a new loading state starts
            // But only if we are transitioning FROM a non-loading state to a loading state
            // Actually, the handlers call setTimer(0) already.

            intervalId = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } else {
            setTimer(0);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isInitialLoading, qualityLoading, investmentLoading, biddingLoading, pulseLoading, deepLoading]);

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

        setTimer(0);
        setDeepLoading(true);
        addLog('System', { type: 'info' }, { task: 'deep_investment_research_init', zpid });

        try {
            const city = propertyData?.city || (propertyData?.address && propertyData.address.split(',')[1]?.trim());
            const state = propertyData?.state || (propertyData?.address && propertyData.address.split(',')[2]?.split(' ')[1]?.trim());
            const cityStateKey = generateCityStateKey(city, state);

            let deepData = null;
            if (cityStateKey) {
                deepData = await getDeepInvestmentResearchFromCloud(cityStateKey);
            }

            // Polling logic: if it exists but is running, wait for it
            let attempts = 0;
            const MAX_ATTEMPTS = 30; // 5 minutes at 10s intervals

            while (deepData?.status === 'running' && attempts < MAX_ATTEMPTS) {
                if (attempts === 0) addLog('Cloud Cache', { type: 'info' }, { status: 'Waiting', task: 'deep_investment_research', message: 'Existing research in progress...' });
                await new Promise(r => setTimeout(r, 10000));
                if (cityStateKey) {
                    deepData = await getDeepInvestmentResearchFromCloud(cityStateKey);
                }
                attempts++;
            }

            if (deepData && deepData.status === 'completed') {
                addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'deep_investment_research', location: cityStateKey || zpid });
            } else if (deepData?.status === 'failed') {
                addLog('Cloud Cache', { type: 'error' }, { status: 'Failed', task: 'deep_investment_research', message: deepData.error || 'Previous run failed.' });
                // If it failed previously, we might want to retry, but for now we fallback to AI call
                deepData = null;
            }

            if (!deepData || !deepData.content) {
                addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'deep_investment_research', location: cityStateKey || zpid });
                const res = await aiAnalyzeDeepResearch(propertyData);
                deepData = res.data;
                if (cityStateKey) {
                    await saveDeepInvestmentResearchToCloud(cityStateKey, deepData);
                }
                addLog('Gemini AI', { type: 'response' }, { task: 'deep_investment_research', location: cityStateKey || zpid }, (res as any).usage);
            }

            onUpdateAnalysis({
                ...analysis,
                deep_investment_research: deepData
            });

        } catch (err: any) {
            console.error("Deep Investment Research Failed:", err);
            addLog('System', { type: 'error' }, { message: "Deep Investment Research Failed", error: err.message || err });
        } finally {
            setDeepLoading(false);
        }
    };

    const [graphLoading, setGraphLoading] = useState(false);
    const [graphResult, setGraphResult] = useState<ContextGraphExtractionResult | null>(null);

    const handleExtractContextGraph = async () => {
        if (!analysis || !propertyData || graphLoading) return;

        setTimer(0);
        setGraphLoading(true);
        addLog('System', { type: 'info' }, { task: 'context_graph_extraction', zpid });

        try {
            // 1. Check Firestore cache first
            if (zpid) {
                const cached = await getContextGraphFromCloud(zpid);
                if (cached && cached.factors && cached.factors.length > 0) {
                    addLog('Cloud Cache', { type: 'response' }, { status: 'Hit', task: 'context_graph', zpid, factors: cached.factors.length });
                    setGraphResult(cached as ContextGraphExtractionResult);
                    setGraphLoading(false);
                    return;
                }
                addLog('Cloud Cache', { type: 'info' }, { status: 'Miss', task: 'context_graph', zpid });
            }

            // 2. Extract via Gemini
            const visual = analysis;
            const comprehensive = null;

            addLog('Gemini AI', { type: 'request' }, { task: 'context_graph_extraction', zpid, model: 'gemini-2.0-flash' });
            const res = await aiExtractGraphFactors(propertyData, visual, comprehensive);
            setGraphResult(res.data);
            addLog('Gemini AI', { type: 'response' }, { task: 'context_graph_extraction', zpid, factors: res.data.factors?.length }, (res as any).usage);

            // 3. Save to Firestore cache
            if (zpid && res.data) {
                await saveContextGraphToCloud(zpid, res.data);
                addLog('Cloud Cache', { type: 'info' }, { status: 'Saved', task: 'context_graph', zpid });
            }
        } catch (err: any) {
            console.error("Context Graph Extraction Failed:", err);
            addLog('System', { type: 'error' }, { message: "Context Graph Extraction Failed", error: err.message || err });
        } finally {
            setGraphLoading(false);
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
        graphResult,
        handleRunQualityAnalysis,
        handleRunCommunityPulse,
        handleRunInvestmentResearch,
        handleRunBiddingStrategy,
        handleRunDeepInvestmentResearch,
        handleExtractContextGraph,
    };
};
