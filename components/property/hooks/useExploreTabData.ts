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
import { fetchFemaRiskIndex } from '../../../services/api/disasters';
import {
    getCityNeighborhoodsFromCloud,
    getComprehensiveAnalysisFromCloud,
    getVisualAnalysisFromCloud,
    getPropertyInvestmentFromCloud,
    getDeepInvestmentResearchFromCloud,
    getCommunityPulseFromCloud,
    getInteriorSummaryFromCloud,
    getLifestyleInsightsFromCloud,
    getLifestyleFitFromCloud,
    getSchoolAnalysisFromCloud,
    saveLifestyleInsightsToCloud,
    saveLifestyleFitToCloud,
    saveSchoolAnalysisToCloud,
    getEnvironmentalDataFromCloud,
    getFemaNriFromCloud,
} from '../../../services/firebase/properties';
import { getPropertyGroundTruth } from '../../../services/firebase/orientation_history';
import { getSchoolCacheKey } from '../../../prompts/property/schoolsAnalysis';
import { fetchCensusDemographics, fetchMicroclimateDelta, CensusDemographics, MicroclimateDelta } from '../../../services/api/environmental';
import { extractDeepResearchInsights, analyzeLifestyleInsights, analyzeLifestyleFit, analyzeSchool } from '../../../services/geminiService';
import { prefetchExploreCache } from '../../../services/exploreCachePrefetch';

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
    const [isHealingFema, setIsHealingFema] = useState(false);

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
    const [lifestyleInterestTab, setLifestyleInterestTab] = useState<string>('outdoor');
    // Guard: prevent infinite retry if auto-triggered lifestyle generation yields no data
    const lifestyleAutoAttempted = useRef(false);

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
            const uid = auth?.currentUser?.uid || 'unknown';
            // 1. Lifestyle Insights (Neighborhood/Location focus)
            const insightsRes = await analyzeLifestyleInsights(propertyData, uid);
            setLifestyleInsights(insightsRes.data);
            if (propertyData.zpid) await saveLifestyleInsightsToCloud(propertyData.zpid, insightsRes.data);

            // 2. Lifestyle Fit (Property specifics focus)
            const fitRes = await analyzeLifestyleFit(
                propertyData,
                customAnalysis, // pass current visual analysis if any
                (propertyData as any).streetViewAnalysis, // pass street view if any
                uid,
                comprehensiveAnalysis?.summary || null
            );
            if (fitRes.data) {
                setLifestyleFit(fitRes.data);
                if (propertyData.zpid) await saveLifestyleFitToCloud(propertyData.zpid, fitRes.data);
            }
        } catch (e: any) {
            console.error('[Lifestyle Generation] Failed:', e.message);
        }
        setLifestyleLoading(false);
    };

    // Reset attempt guard when property changes
    useEffect(() => { lifestyleAutoAttempted.current = false; }, [propertyData?.zpid]);

    // Auto-trigger lifestyle analysis if comprehensive is done but fit is missing
    useEffect(() => {
        if (comprehensiveAnalysis && !lifestyleFit && !lifestyleLoading && propertyData?.zpid && !lifestyleAutoAttempted.current) {
            lifestyleAutoAttempted.current = true;
            console.log(`[Lifestyle] Auto-triggering fit analysis for ${propertyData.zpid} using comprehensive context...`);
            handleGenerateLifestyle();
        }
    }, [comprehensiveAnalysis, lifestyleFit, lifestyleLoading, propertyData?.zpid]);

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

            // cityStateKey is the Firestore parent doc (e.g. "pleasanton_ca").
            // Always derive it from city+state — never by splitting the cache key.
            const cityStateKey = generateCityStateKey(city, state || '');
            if (!cityStateKey) return;

            try {
                const results: any[] = [];
                for (const school of schools) {
                    const cacheKey = getSchoolCacheKey(school.name, city, state || '');
                    const cached = await getSchoolAnalysisFromCloud(cacheKey, cityStateKey);
                    if (cached?.name) {
                        results.push({
                            ...cached,
                            distance_miles: parseFloat(String(school.distance).replace(/[^0-9.]/g, '')) || null,
                            mls_rating: school.rating,
                            is_assigned: true,
                        });
                    } else {
                        // Cache miss — run fresh Gemini analysis so deleted/missing entries self-heal
                        // without needing a full pipeline re-run.
                        console.log(`[Schools] Cache miss for "${school.name}" — running fresh analysis...`);
                        try {
                            const res = await analyzeSchool(school, propertyData, auth?.currentUser?.uid || 'unknown');
                            if (res.data) {
                                const schoolData = {
                                    ...res.data,
                                    sources: res.data.sources?.length ? res.data.sources : (res as any).sources || [],
                                };
                                await saveSchoolAnalysisToCloud(cacheKey, schoolData, cityStateKey);
                                results.push({
                                    ...schoolData,
                                    distance_miles: parseFloat(String(school.distance).replace(/[^0-9.]/g, '')) || null,
                                    mls_rating: school.rating,
                                    is_assigned: true,
                                });
                                console.log(`[Schools] ✓ Fresh analysis saved for "${school.name}"`);
                            }
                        } catch (analysisErr: any) {
                            console.warn(`[Schools] Fresh analysis failed for "${school.name}":`, analysisErr.message);
                        }
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
    const [cachedCommunityPulse, setCachedCommunityPulse] = useState<any | null>(null);
    const [interiorSummary, setInteriorSummary] = useState<any | null>(null);
    const [cachedDeepResearch, setCachedDeepResearch] = useState<DeepInvestmentResearchResult | null>(null);
    const [orientationGroundTruth, setOrientationGroundTruth] = useState<{ expected_orientation: string; expected_azimuth_deg: number | null; gt_source: string } | null>(null);
    const [environmentalData, setEnvironmentalData] = useState<any | null>(null);

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
            const zpid = propertyData.zpid ? String(propertyData.zpid) : null;
            if (!zpid || zpid === 'undefined') {
                console.warn('[ExploreTab Cache] Aborting fetch: Invalid ZPID');
                return;
            }

            try {
                console.log(`[⏱ ExploreTab] +${_elapsed()} — awaiting prefetched cache bundle for zpid=${zpid}`);

                // Reuses the in-flight promise kicked off by fetchPropertyDataFull
                // the moment the zpid was known — typically already resolved by the
                // time we get here, so this is effectively a no-op await.
                const {
                    visualCache,
                    investmentCache,
                    deepResearchCache,
                    communityPulseCache,
                    interiorCache,
                    orientationGTCache,
                    envCache,
                    femaNriCache,
                } = await prefetchExploreCache(zpid, propertyData.city, propertyData.state);
                console.log(`[⏱ ExploreTab] +${_elapsed()} — cache bundle ready. Env: ${!!envCache ? 'Found' : 'Missing'}, FEMA: ${!!femaNriCache ? 'Found' : 'Missing'}`);

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
                if (deepResearchCache) setCachedDeepResearch(deepResearchCache);
                if (communityPulseCache) setCachedCommunityPulse(communityPulseCache);
                if (investmentCache?.ltr_analysis) setCachedLtrAnalysis(investmentCache.ltr_analysis);
                if (interiorCache) setInteriorSummary(interiorCache);
                if (orientationGTCache) setOrientationGroundTruth(orientationGTCache);

                // ── SELF-HEALING: Legacy FEMA NRI Data ────────────────────────
                // Detect if FEMA data is missing or in the old format.
                let activeNri = femaNriCache;
                const fema = activeNri || envCache?.historical_disasters?.femaRiskIndex;
                const isLegacy = fema && (
                    typeof fema.hazards?.flood === 'number' ||
                    !fema.hazards?.earthquake ||
                    !fema.hazards?.tornado
                );
                console.log(`[FEMA Debug] zpid=${zpid} femaNriCache=${JSON.stringify(femaNriCache)?.substring(0, 80)} envFema=${JSON.stringify(envCache?.historical_disasters?.femaRiskIndex)?.substring(0, 80)} isLegacy=${isLegacy} hasCoords=${!!propertyData?.coordinates}`);

                if (isLegacy || !fema) {
                    if (propertyData.coordinates) {
                        console.log(`[ExploreTab] 🩹 Healing legacy FEMA NRI data for ${zpid}...`);
                        setIsHealingFema(true);
                        try {
                            const freshFema = await fetchFemaRiskIndex(
                                propertyData.coordinates.latitude,
                                propertyData.coordinates.longitude,
                                zpid,
                                propertyData.address
                            );
                            console.log(`[FEMA Debug] freshFema=${JSON.stringify(freshFema)?.substring(0, 100)}`);
                            if (freshFema) {
                                console.log(`[ExploreTab] ✓ FEMA NRI healed and saved to dedicated doc`);
                                activeNri = freshFema;
                                if (db) {
                                    const nriRef = doc(db, "properties", zpid, "environmental", "fema_nri");
                                    await setDoc(nriRef, freshFema, { merge: true });
                                }
                            } else {
                                // Healing failed — keep whatever partial data we had rather than regressing to null
                                activeNri = activeNri ?? fema ?? null;
                                console.warn(`[ExploreTab] FEMA NRI fetch returned null, retaining existing data`);
                            }
                        } catch (err) {
                            activeNri = activeNri ?? fema ?? null;
                            console.warn('[ExploreTab] FEMA healing failed:', err);
                        } finally {
                            setIsHealingFema(false);
                        }
                    } else {
                        console.warn(`[FEMA Debug] Skipping heal — no coordinates for zpid=${zpid}`);
                    }
                } else {
                    console.log(`[FEMA Debug] No healing needed — using existing fema data, hazards keys: ${Object.keys(fema?.hazards || {}).join(',')}`);
                }

                // Merge seismic + healed FEMA NRI
                // activeNri may still be null if fema_nri doc doesn't exist yet but
                // thirdparty_data already has valid non-legacy data — fall back to fema.
                const mergedEnv = {
                    ...envCache,
                    historical_disasters: {
                        ...(envCache?.historical_disasters || {}),
                        femaRiskIndex: activeNri ?? fema
                    }
                };
                setEnvironmentalData(mergedEnv);

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
    const deepResearch = customAnalysis?.deep_investment_research || cachedDeepResearch || null;
    const keyInsights = cachedKeyInsights || null;
    const neighborhoodOverview = propertyData?.neighborhood_narrative || customAnalysis?.neighborhood?.overview || cachedNeighborhoodOverview || null;
    const communityPulse = customAnalysis?.community_pulse || cachedCommunityPulse || null;
    const visualPoi = customAnalysis?.neighborhood?.visual_poi || cachedVisualPoi || undefined;
    const mapLabels = customAnalysis?.neighborhood?.map_labels || cachedMapLabels || undefined;
    const currentInteriorSummary = interiorSummary || comprehensiveAnalysis?.interior_summary || cachedComprehensiveAnalysis?.interior_summary;
    const analysis = comprehensiveAnalysis || cachedComprehensiveAnalysis;

    // Merge environmental data (FEMA NRI, etc.) into a synthetic property object for child components
    const mergedPropertyData = useMemo(() => {
        if (!propertyData) return null;
        return {
            ...propertyData,
            ...environmentalData, // Includes historical_disasters, etc.
        };
    }, [propertyData, environmentalData]);

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
        lifestyleInterestTab, setLifestyleInterestTab,
        handleGenerateLifestyle,
        // Schools
        schoolsIntelligence, setSchoolsIntelligence,
        schoolsExpanded, setSchoolsExpanded,
        // Cache
        cachedVisualAnalysis,
        // Derived
        designStyle, marketDynamics, ltrAnalysis, deepResearch, keyInsights,
        neighborhoodOverview, communityPulse, visualPoi, mapLabels,
        currentInteriorSummary, analysis,
        orientationGroundTruth,
        mergedPropertyData,
        isHealingFema,
        // Actions
        handleFullRefresh,
    };
}
