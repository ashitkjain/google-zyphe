/**
 * useExploreTabData
 *
 * Custom hook encapsulating all state, side-effect data fetching, and derived values
 * for the ExploreTab component. Extracted to keep ExploreTab.tsx focused on rendering.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, generateCityStateKey } from '../../../services/firebase/config';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, DeepResearchInsights } from '../../../types';
import { NeighborhoodAnalysis } from '../../../types/ai';
import {
    getCityNeighborhoodsFromCloud,
    getComprehensiveAnalysisFromCloud,
    getVisualAnalysisFromCloud,
    getPropertyInvestmentFromCloud,
    getDeepInvestmentResearchFromCloud,
    getInteriorSummaryFromCloud,
    getLifestyleInsightsFromCloud,
    getLifestyleFitFromCloud,
    getSchoolAnalysisFromCloud,
    saveLifestyleInsightsToCloud,
} from '../../../services/firebase/properties';
import { getSchoolCacheKey } from '../../../prompts/property/schoolsAnalysis';
import { fetchCensusDemographics, fetchMicroclimateDelta, CensusDemographics, MicroclimateDelta } from '../../../services/api/environmental';
import { extractDeepResearchInsights, analyzeLifestyleInsights } from '../../../services/geminiService';

type InternalTab = 'property-data' | 'visual-ai' | 'comprehensive';

interface UseExploreTabDataParams {
    propertyData: PropertyData | null;
    viewMode: string;
    customAnalysis: CustomAIAnalysisResult | null;
    comprehensiveAnalysis: ComprehensiveAnalysisResult | null;
    onRunCustomAnalysis: (force?: boolean) => Promise<any>;
}

export function useExploreTabData({
    propertyData,
    viewMode,
    customAnalysis,
    comprehensiveAnalysis,
    onRunCustomAnalysis,
}: UseExploreTabDataParams) {
    // ── Tab navigation ──────────────────────────────────────────
    const mapViewToTab = (vm: string): InternalTab => {
        if (vm === 'visual-report') return 'visual-ai';
        if (vm === 'comprehensive-report') return 'comprehensive';
        return 'property-data';
    };

    const [activeTab, setActiveTab] = useState<InternalTab>(mapViewToTab(viewMode));
    const [activeSubTab, setActiveSubTab] = useState<string>('interior');

    useEffect(() => { setActiveTab(mapViewToTab(viewMode)); }, [viewMode]);

    const stickyNoteActiveTab = useMemo(() => {
        if (activeTab === 'property-data') return 'overview';
        if (activeTab === 'visual-ai') return activeSubTab;
        if (activeTab === 'comprehensive') return 'comprehensive';
        return 'overview';
    }, [activeTab, activeSubTab]);

    // ── UI state ────────────────────────────────────────────────
    const [isRefreshingPulse, setIsRefreshingPulse] = useState(false);
    const [pulseExpanded, setPulseExpanded] = useState(false);
    const [showTimings, setShowTimings] = useState(false);
    const [isSatelliteExpanded, setIsSatelliteExpanded] = useState(false);
    const [compReportTab, setCompReportTab] = useState<number>(0);
    const [groundTruthMapTab, setGroundTruthMapTab] = useState<'parcel' | 'satellite'>('parcel');

    // ── Environmental data ──────────────────────────────────────
    const [census, setCensus] = useState<CensusDemographics | null>(null);
    const [micro, setMicro] = useState<MicroclimateDelta | null>(null);

    useEffect(() => {
        if (propertyData?.coordinates) {
            fetchCensusDemographics(
                propertyData.coordinates.latitude, propertyData.coordinates.longitude,
                (propertyData as any).zpid, propertyData.address
            ).then(r => { if (r) setCensus(r); });
        }
    }, [propertyData?.coordinates?.latitude, propertyData?.coordinates?.longitude]);

    useEffect(() => {
        if (propertyData?.coordinates) {
            fetchMicroclimateDelta(
                propertyData.coordinates.latitude, propertyData.coordinates.longitude,
                propertyData.city, (propertyData as any).zpid, propertyData.address
            ).then(r => { if (r) setMicro(r); });
        }
    }, [propertyData?.coordinates?.latitude, propertyData?.coordinates?.longitude]);

    // ── Neighbourhood identity (city-level data) ─────────────────
    const [cityNhEntryOverview, setCityNhEntryOverview] = useState<any>(null);

    useEffect(() => {
        const resolvedName = (propertyData as any)?.neighborhood_identity?.resolved_name;

        if (!resolvedName || !propertyData?.city || !propertyData?.state) return;
        (async () => {
            try {
                const key = generateCityStateKey(propertyData.city, propertyData.state);
                if (!key) return;
                const cityData = await getCityNeighborhoodsFromCloud(key);
                if (cityData?.neighborhoods?.length) {
                    const match = cityData.neighborhoods.find((n: any) =>
                        n.neighborhood_name?.toLowerCase() === resolvedName.toLowerCase()
                    );
                    if (match) setCityNhEntryOverview(match);
                }
            } catch (e) {
                console.warn('[ExploreTab] City neighborhoods lookup failed:', e);
            }
        })();
    }, [(propertyData as any)?.neighborhood_identity?.resolved_name, propertyData?.city, propertyData?.state]);


    // ── Lifestyle insights ───────────────────────────────────────
    const [lifestyleInsights, setLifestyleInsights] = useState<any>(null);
    const [lifestyleLoading, setLifestyleLoading] = useState(false);
    const [lifestyleFit, setLifestyleFit] = useState<any>(null);
    const [lifestyleFitTab, setLifestyleFitTab] = useState<string>('working_professionals');

    useEffect(() => {
        setLifestyleInsights(null);
        setLifestyleFit(null);
        const load = async () => {
            const zpid = propertyData?.zpid;
            if (!zpid) return;
            try {
                const [cached, fitCached] = await Promise.all([
                    getLifestyleInsightsFromCloud(zpid),
                    getLifestyleFitFromCloud(zpid),
                ]);
                if (cached?.outdoor) setLifestyleInsights(cached);
                if (fitCached?.working_professionals) setLifestyleFit(fitCached);
            } catch (_) { /* optional */ }
        };
        load();
    }, [propertyData?.zpid]);

    const handleGenerateLifestyle = async () => {
        if (!propertyData || lifestyleLoading) return;
        setLifestyleLoading(true);
        try {
            const { data } = await analyzeLifestyleInsights(propertyData, auth?.currentUser?.uid || 'unknown');
            setLifestyleInsights(data);
            if (propertyData.zpid) await saveLifestyleInsightsToCloud(propertyData.zpid, data);
        } catch (e: any) {
            console.error('[Lifestyle Insights] Failed:', e.message);
        }
        setLifestyleLoading(false);
    };

    // ── Schools intelligence ─────────────────────────────────────
    const [schoolsIntelligence, setSchoolsIntelligence] = useState<any>(null);
    const [schoolsExpanded, setSchoolsExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        setSchoolsIntelligence(null);
        setSchoolsExpanded({});
        const load = async () => {
            const schools = propertyData?.schools;
            const city = propertyData?.city;
            const state = propertyData?.state;
            if (!schools?.length || !city) return;
            try {
                const results: any[] = [];
                for (const school of schools) {
                    const cacheKey = getSchoolCacheKey(school.name, city, state || '');
                    const cached = await getSchoolAnalysisFromCloud(cacheKey);
                    if (cached?.name) {
                        results.push({
                            ...cached,
                            distance_miles: parseFloat(String(school.distance).replace(/[^0-9.]/g, '')) || null,
                            mls_rating: school.rating,
                            is_assigned: true,
                        });
                    }
                }
                if (results.length > 0) {
                    setSchoolsIntelligence({
                        schools: results,
                        district_name: results[0]?.district_name || '',
                    });
                }
            } catch (_) { /* optional */ }
        };
        load();
    }, [propertyData?.zpid]);

    // ── Cloud cache (visual analysis + investment + deep research) ─
    const [cachedDesignStyle, setCachedDesignStyle] = useState<{ style?: string; reasoning?: string } | null>(null);
    const [cachedMarketDynamics, setCachedMarketDynamics] = useState<{ summary?: string; details?: string[] } | null>(null);
    const [cachedLtrAnalysis, setCachedLtrAnalysis] = useState<{ monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null>(null);
    const [cachedKeyInsights, setCachedKeyInsights] = useState<DeepResearchInsights | null>(null);
    const [cachedNeighborhoodOverview, setCachedNeighborhoodOverview] = useState<string | null>(null);
    const [cachedVisualPoi, setCachedVisualPoi] = useState<NeighborhoodAnalysis['visual_poi'] | null>(null);
    const [cachedMapLabels, setCachedMapLabels] = useState<string[] | null>(null);
    const [cachedComprehensiveAnalysis, setCachedComprehensiveAnalysis] = useState<ComprehensiveAnalysisResult | null>(null);
    const [cachedVisualAnalysis, setCachedVisualAnalysis] = useState<CustomAIAnalysisResult | null>(null);
    const [interiorSummary, setInteriorSummary] = useState<any | null>(null);

    // Guard: track which zpids have already had a Gemini backfill attempted
    // so we never fire a live AI call more than once per property per session.
    const backfilledZpids = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!propertyData?.zpid) return;

        const _t0 = performance.now();
        const _elapsed = () => `${(performance.now() - _t0).toFixed(0)}ms`;
        console.log(`[⏱ ExploreTab] Cache fetch START for zpid=${propertyData.zpid}`);

        let cancelled = false;
        (async () => {
            try {
                const cityStateKey = generateCityStateKey(propertyData.city, propertyData.state);
                console.log(`[⏱ ExploreTab] +${_elapsed()} — parallel cache read start`);

                const [visualCache, investmentCache, deepResearchCache, interiorCache] = await Promise.all([
                    getVisualAnalysisFromCloud(String(propertyData.zpid)),
                    getPropertyInvestmentFromCloud(String(propertyData.zpid)),
                    cityStateKey ? getDeepInvestmentResearchFromCloud(cityStateKey) : Promise.resolve(null),
                    getInteriorSummaryFromCloud(String(propertyData.zpid)),
                ]);
                console.log(`[⏱ ExploreTab] +${_elapsed()} — parallel cache read done`);

                if (cancelled) return;

                if (visualCache) {
                    setCachedVisualAnalysis(visualCache);
                    if (visualCache.home_interior?.design_style) setCachedDesignStyle(visualCache.home_interior.design_style);
                }
                if (visualCache?.neighborhood?.overview) setCachedNeighborhoodOverview(visualCache.neighborhood.overview);
                if (visualCache?.neighborhood?.visual_poi) setCachedVisualPoi(visualCache.neighborhood.visual_poi);
                if (visualCache?.neighborhood?.map_labels) setCachedMapLabels(visualCache.neighborhood.map_labels);
                if (deepResearchCache?.structured_report?.market_dynamics) setCachedMarketDynamics(deepResearchCache.structured_report.market_dynamics);
                if ((deepResearchCache as any)?.key_insights) setCachedKeyInsights((deepResearchCache as any).key_insights);
                if (investmentCache?.ltr_analysis) setCachedLtrAnalysis(investmentCache.ltr_analysis);
                if (interiorCache) setInteriorSummary(interiorCache);

                // Comprehensive analysis
                try {
                    const compCache = await getComprehensiveAnalysisFromCloud(String(propertyData.zpid));
                    if (compCache && !cancelled) setCachedComprehensiveAnalysis(compCache);
                } catch (ce) {
                    console.warn('[ExploreTab Cache] Comprehensive analysis fetch failed:', ce);
                }

                // Backfill key insights from raw research if missing.
                // ONLY fires once per zpid per session — never re-runs on analysis updates.
                const zpidStr = String(propertyData.zpid);
                const alreadyBackfilled = backfilledZpids.current.has(zpidStr);
                if (
                    !alreadyBackfilled &&
                    !(deepResearchCache as any)?.key_insights &&
                    deepResearchCache?.content?.length > 200 &&
                    cityStateKey
                ) {
                    backfilledZpids.current.add(zpidStr);
                    try {
                        const insightsRes = await extractDeepResearchInsights(deepResearchCache.content, 'cache-backfill', cityStateKey);
                        if (insightsRes.data && !cancelled) {
                            setCachedKeyInsights(insightsRes.data);
                            if (db) {
                                const docRef = doc(db, 'deep_investment_research', cityStateKey);
                                await setDoc(docRef, { key_insights: insightsRes.data }, { merge: true });
                            }
                        }
                    } catch (insightErr) {
                        console.warn('[ExploreTab Cache] On-the-fly insights extraction failed:', insightErr);
                    }
                }
            } catch (e) {
                console.error('[ExploreTab Cache] Error fetching cache:', e);
            }
            console.log(`%c[⏱ ExploreTab] +${_elapsed()} — ALL cache fetches COMPLETE`, 'color: #22c55e; font-weight: bold;');
        })();
        return () => { cancelled = true; };
    // NOTE: customAnalysis is intentionally excluded from deps.
    // Adding it would re-trigger this effect every time analysis loads,
    // causing duplicate API calls and potential Gemini re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propertyData?.zpid]);

    // ── Handlers ────────────────────────────────────────────────
    const handleFullRefresh = async () => {
        await onRunCustomAnalysis(true);
    };

    // ── Derived values ───────────────────────────────────────────
    const designStyle = customAnalysis?.home_interior?.design_style || cachedDesignStyle || null;
    const marketDynamics = customAnalysis?.deep_investment_research?.structured_report?.market_dynamics || cachedMarketDynamics || null;
    const ltrAnalysis = customAnalysis?.property_investment?.ltr_analysis || cachedLtrAnalysis || null;
    const keyInsights = cachedKeyInsights || null;
    const neighborhoodOverview = customAnalysis?.neighborhood?.overview || cachedNeighborhoodOverview || null;
    const visualPoi = customAnalysis?.neighborhood?.visual_poi || cachedVisualPoi || undefined;
    const mapLabels = customAnalysis?.neighborhood?.map_labels || cachedMapLabels || undefined;
    const currentInteriorSummary = interiorSummary || comprehensiveAnalysis?.interior_summary || cachedComprehensiveAnalysis?.interior_summary;
    const analysis = comprehensiveAnalysis || cachedComprehensiveAnalysis;

    return {
        // Tab state
        activeTab, setActiveTab,
        activeSubTab, setActiveSubTab,
        stickyNoteActiveTab,
        // UI state
        isRefreshingPulse, setIsRefreshingPulse,
        pulseExpanded, setPulseExpanded,
        showTimings, setShowTimings,
        isSatelliteExpanded, setIsSatelliteExpanded,
        compReportTab, setCompReportTab,
        groundTruthMapTab, setGroundTruthMapTab,
        // Environmental
        census, micro,
        // Neighbourhood
        cityNhEntryOverview,
        // Lifestyle
        lifestyleInsights, lifestyleLoading, lifestyleFit,
        lifestyleFitTab, setLifestyleFitTab,
        handleGenerateLifestyle,
        // Schools
        schoolsIntelligence, setSchoolsIntelligence,
        schoolsExpanded, setSchoolsExpanded,
        // Cache
        cachedVisualAnalysis,
        // Derived
        designStyle, marketDynamics, ltrAnalysis, keyInsights,
        neighborhoodOverview, visualPoi, mapLabels,
        currentInteriorSummary, analysis,
        // Actions
        handleFullRefresh,
    };
}
