import React, { useState, useEffect, useMemo } from 'react';
import { NeighborhoodAnalysis } from '../../types/ai';
import PropertyHeader from './PropertyHeader';
import PropertyImages from './PropertyImages';
import PropertyFacts from './PropertyFacts';
import AirQualitySection from './AirQualitySection';
import PropertyDescription from './PropertyDescription';
import StreetViewAnalysisSection from './StreetViewAnalysisSection';
import PropertyMaps from './PropertyMaps';
import Logo from '../shared/Logo';
import CustomAIAnalysis from '../analysis/CustomAIAnalysis';
import ComprehensiveAnalysis from '../analysis/ComprehensiveAnalysis';
import ComplianceAttribution from './ComplianceAttribution';
import NeighborhoodPlacesSection from './NeighborhoodPlacesSection';
import StaticParcelMap from './StaticParcelMap';
import ParcelValidationCard from './ParcelValidationCard';
import HistoricalDisasterSection from './HistoricalDisasterSection';
import LifestyleInsightsSection from './LifestyleInsightsSection';
import { StickyNotesLayer } from '../analysis/custom-ai/components/StickyNotesLayer';


import ChatInterface from '../shared/ChatInterface';
import { auth } from '../../services/firebase/config';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, LogEntry, DeepResearchInsights } from '../../types';
import { getPropertiesByCity, CityPropertySummary } from '../../services/firebase/properties';
import { hasEssentialData } from '../../utils/propertyValidation';

interface ExploreTabProps {
    propertyData: PropertyData | null;
    loading: boolean;
    loadingSublabel: string;
    viewMode: 'main' | 'visual-report' | 'comprehensive-report';
    setViewMode: (mode: 'main' | 'visual-report' | 'comprehensive-report') => void;
    imagesLoading: boolean;
    isFavorited: boolean;
    onToggleFavorite: () => void;
    onRunCustomAnalysis: (force?: boolean) => Promise<any>;
    customAnalysis: CustomAIAnalysisResult | null;
    customAnalysisLoading: boolean;
    onRunComprehensive: (force?: boolean) => void;
    comprehensiveAnalysis: ComprehensiveAnalysisResult | null;
    comprehensiveLoading: boolean;
    onUpdateAnalysis: (updated: any) => void;
    onUpdatePropertyData?: (updatedFields: Partial<PropertyData>) => void;
    addLog: (service: string, meta: any, content: any) => void;
    logs: LogEntry[];
    userRole?: string;
    searchBar?: React.ReactNode;
    address?: string;
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
    onRefreshCommunityPulse?: () => Promise<void>;
}

const ExploreTab: React.FC<ExploreTabProps> = ({
    propertyData,
    loading,
    loadingSublabel,
    viewMode,
    setViewMode,
    imagesLoading,
    isFavorited,
    onToggleFavorite,
    onRunCustomAnalysis,
    customAnalysis,
    customAnalysisLoading,
    onRunComprehensive,
    comprehensiveAnalysis,
    comprehensiveLoading,
    onUpdateAnalysis,
    onUpdatePropertyData,
    addLog,
    logs,
    userRole,
    searchBar,
    address: currentAddress,
    onRefreshEnvironment,
    environmentRefreshing,
    onRefreshCommunityPulse
}) => {
    // Internal tab state — syncs with external viewMode
    type InternalTab = 'property-data' | 'visual-ai' | 'comprehensive';
    const mapViewToTab = (vm: string): InternalTab => {
        if (vm === 'visual-report') return 'visual-ai';
        if (vm === 'comprehensive-report') return 'comprehensive';
        return 'property-data';
    };
    const [activeTab, setActiveTab] = useState<InternalTab>(mapViewToTab(viewMode));
    const [activeSubTab, setActiveSubTab] = useState<string>('interior');
    const [isRefreshingPulse, setIsRefreshingPulse] = useState(false);
    const [pulseExpanded, setPulseExpanded] = useState(false);
    const [lifestyleInsights, setLifestyleInsights] = useState<any>(null);
    const [lifestyleLoading, setLifestyleLoading] = useState(false);
    const [lifestyleFit, setLifestyleFit] = useState<any>(null);
    const [lifestyleFitTab, setLifestyleFitTab] = useState<string>('working_professionals');
    const [schoolsIntelligence, setSchoolsIntelligence] = useState<any>(null);
    const [schoolsExpanded, setSchoolsExpanded] = useState<Record<number, boolean>>({});

    // Sync external viewMode changes to internal tab
    React.useEffect(() => {
        setActiveTab(mapViewToTab(viewMode));
    }, [viewMode]);

    // Fetch design_style, market dynamics, and LTR from cloud cache if customAnalysis is not loaded
    const [cachedDesignStyle, setCachedDesignStyle] = useState<{ style?: string; reasoning?: string } | null>(null);
    const [cachedMarketDynamics, setCachedMarketDynamics] = useState<{ summary?: string; details?: string[] } | null>(null);
    const [cachedLtrAnalysis, setCachedLtrAnalysis] = useState<{ monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null>(null);
    const [cachedKeyInsights, setCachedKeyInsights] = useState<DeepResearchInsights | null>(null);
    const [cachedNeighborhoodOverview, setCachedNeighborhoodOverview] = useState<string | null>(null);
    const [cachedVisualPoi, setCachedVisualPoi] = useState<NeighborhoodAnalysis['visual_poi'] | null>(null);
    const [cachedMapLabels, setCachedMapLabels] = useState<string[] | null>(null);
    const [cachedComprehensiveAnalysis, setCachedComprehensiveAnalysis] = useState<ComprehensiveAnalysisResult | null>(null);
    const [groundTruthMapTab, setGroundTruthMapTab] = useState<'parcel' | 'satellite'>('parcel');
    const [cityNhEntryOverview, setCityNhEntryOverview] = React.useState<any>(null);

    // Fetch city-level neighborhood details for the overview card
    React.useEffect(() => {
        const resolvedName = propertyData?.neighborhood_identity?.resolved_name;
        if (!resolvedName || !propertyData?.city || !propertyData?.state) return;
        (async () => {
            try {
                const { generateCityStateKey } = await import('../../services/firebase/config');
                const { getCityNeighborhoodsFromCloud } = await import('../../services/firebase/properties');
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
    }, [propertyData?.neighborhood_identity?.resolved_name, propertyData?.city, propertyData?.state]);

    // Load lifestyle insights + lifestyle fit from cache on mount
    React.useEffect(() => {
        setLifestyleInsights(null);
        setLifestyleFit(null);
        const loadLifestyle = async () => {
            const zpid = propertyData?.zpid;
            if (!zpid) return;
            try {
                const { getLifestyleInsightsFromCloud, getLifestyleFitFromCloud } = await import('../../services/firebase/properties');
                const [cached, fitCached] = await Promise.all([
                    getLifestyleInsightsFromCloud(zpid),
                    getLifestyleFitFromCloud(zpid)
                ]);
                if (cached?.outdoor) setLifestyleInsights(cached);
                if (fitCached?.working_professionals) setLifestyleFit(fitCached);
            } catch (_) { /* optional */ }
        };
        loadLifestyle();
    }, [propertyData?.zpid]);

    // Load schools intelligence from per-school cache
    React.useEffect(() => {
        setSchoolsIntelligence(null);
        setSchoolsExpanded({});
        const loadSchools = async () => {
            const schools = propertyData?.schools;
            const city = propertyData?.city;
            const state = propertyData?.state;
            if (!schools?.length || !city) return;
            try {
                const { getSchoolAnalysisFromCloud } = await import('../../services/firebase/properties');
                const { getSchoolCacheKey } = await import('../../prompts/property/schoolsAnalysis');

                const results: any[] = [];
                for (const school of schools) {
                    const cacheKey = getSchoolCacheKey(school.name, city, state || '');
                    const cached = await getSchoolAnalysisFromCloud(cacheKey);
                    if (cached?.name) {
                        results.push({
                            ...cached,
                            distance_miles: parseFloat(String(school.distance).replace(/[^0-9.]/g, '')) || null,
                            mls_rating: school.rating,
                            is_assigned: true
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
        loadSchools();
    }, [propertyData?.zpid]);

    const handleGenerateLifestyle = async () => {
        if (!propertyData || lifestyleLoading) return;
        setLifestyleLoading(true);
        try {
            const { analyzeLifestyleInsights } = await import('../../services/geminiService');
            const { saveLifestyleInsightsToCloud } = await import('../../services/firebase/properties');
            const { data } = await analyzeLifestyleInsights(propertyData, auth?.currentUser?.uid || 'unknown');
            setLifestyleInsights(data);
            if (propertyData.zpid) await saveLifestyleInsightsToCloud(propertyData.zpid, data);
        } catch (e: any) {
            console.error('[Lifestyle Insights] Failed:', e.message);
        }
        setLifestyleLoading(false);
    };
    const [isSatelliteExpanded, setIsSatelliteExpanded] = useState(false);
    const [compReportTab, setCompReportTab] = useState<number>(0);
    const [cachedVisualAnalysis, setCachedVisualAnalysis] = useState<CustomAIAnalysisResult | null>(null);
    const [interiorSummary, setInteriorSummary] = useState<any | null>(null);

    useEffect(() => {
        if (!propertyData?.zpid) return;

        const _t0 = performance.now();
        const _elapsed = () => `${(performance.now() - _t0).toFixed(0)}ms`;
        console.log(`[⏱ ExploreTab] Cache fetch START for zpid=${propertyData.zpid}`);

        let cancelled = false;
        (async () => {
            try {
                const {
                    getVisualAnalysisFromCloud,
                    getPropertyInvestmentFromCloud,
                    getDeepInvestmentResearchFromCloud,
                    getInteriorSummaryFromCloud
                } = await import('../../services/firebase/properties');
                const { generateCityStateKey } = await import('../../services/firebase/config');

                // Build city-state key for city-level collections
                const cityStateKey = generateCityStateKey(propertyData.city, propertyData.state);
                console.log('[ExploreTab Cache] Fetching cache data:', {
                    zpid: propertyData.zpid,
                    city: propertyData.city,
                    state: propertyData.state,
                    cityStateKey
                });

                console.log(`[⏱ ExploreTab] +${_elapsed()} — parallel cache read start`);
                const [visualCache, investmentCache, deepResearchCache, interiorCache] = await Promise.all([
                    getVisualAnalysisFromCloud(String(propertyData.zpid)),
                    getPropertyInvestmentFromCloud(String(propertyData.zpid)),
                    cityStateKey ? getDeepInvestmentResearchFromCloud(cityStateKey) : Promise.resolve(null),
                    getInteriorSummaryFromCloud(String(propertyData.zpid))
                ]);
                console.log(`[⏱ ExploreTab] +${_elapsed()} — parallel cache read done (visual=${!!visualCache}, investment=${!!investmentCache}, deepResearch=${!!deepResearchCache}, interior=${!!interiorCache})`);

                console.log('[ExploreTab Cache] hasDeepResearch:', !!deepResearchCache);
                console.log('[ExploreTab Cache] deepResearch keys:', deepResearchCache ? Object.keys(deepResearchCache) : 'null');
                console.log('[ExploreTab Cache] hasStructuredReport:', !!deepResearchCache?.structured_report);
                console.log('[ExploreTab Cache] structuredReport keys:', deepResearchCache?.structured_report ? Object.keys(deepResearchCache.structured_report) : 'none');
                console.log('[ExploreTab Cache] hasMarketDynamics:', !!deepResearchCache?.structured_report?.market_dynamics);
                console.log('[ExploreTab Cache] marketDynamics:', deepResearchCache?.structured_report?.market_dynamics);

                if (cancelled) return;

                if (visualCache) {
                    setCachedVisualAnalysis(visualCache);
                    if (visualCache.home_interior?.design_style) {
                        setCachedDesignStyle(visualCache.home_interior.design_style);
                    }
                }
                if (visualCache?.neighborhood?.overview) {
                    setCachedNeighborhoodOverview(visualCache.neighborhood.overview);
                }
                if (visualCache?.neighborhood?.visual_poi) {
                    setCachedVisualPoi(visualCache.neighborhood.visual_poi);
                }
                if (visualCache?.neighborhood?.map_labels) {
                    setCachedMapLabels(visualCache.neighborhood.map_labels);
                }
                if (deepResearchCache?.structured_report?.market_dynamics) {
                    setCachedMarketDynamics(deepResearchCache.structured_report.market_dynamics);
                }
                if ((deepResearchCache as any)?.key_insights) {
                    setCachedKeyInsights((deepResearchCache as any).key_insights);
                }

                // Also fetch comprehensive analysis if not in full view mode
                try {
                    console.log(`[⏱ ExploreTab] +${_elapsed()} — comprehensive cache read start`);
                    const { getComprehensiveAnalysisFromCloud } = await import('../../services/firebase/properties');
                    const compCache = await getComprehensiveAnalysisFromCloud(String(propertyData.zpid));
                    console.log(`[⏱ ExploreTab] +${_elapsed()} — comprehensive cache read done (hit=${!!compCache})`);
                    if (compCache && !cancelled) {
                        setCachedComprehensiveAnalysis(compCache);
                    }
                } catch (ce) {
                    console.warn('[ExploreTab Cache] Comprehensive analysis fetch failed:', ce);
                }

                if (!((deepResearchCache as any)?.key_insights) && deepResearchCache?.content && deepResearchCache.content.length > 200 && cityStateKey) {
                    // Backfill: extract key insights on-the-fly from existing research
                    console.log('[ExploreTab Cache] No key_insights found — extracting on-the-fly...');
                    try {
                        const { extractDeepResearchInsights } = await import('../../services/geminiService');
                        const insightsRes = await extractDeepResearchInsights(deepResearchCache.content, 'cache-backfill', cityStateKey);
                        if (insightsRes.data && !cancelled) {
                            setCachedKeyInsights(insightsRes.data);
                            // Save back to Firestore for next time
                            const { doc: firestoreDoc, setDoc: firestoreSetDoc } = await import('firebase/firestore');
                            const { db } = await import('../../services/firebase/config');
                            if (db) {
                                const docRef = firestoreDoc(db, "deep_investment_research", cityStateKey);
                                await firestoreSetDoc(docRef, { key_insights: insightsRes.data }, { merge: true });
                                console.log('[ExploreTab Cache] Key insights extracted and saved.');
                            }
                        }
                    } catch (insightErr) {
                        console.warn('[ExploreTab Cache] On-the-fly insights extraction failed:', insightErr);
                    }
                }
                if (investmentCache?.ltr_analysis) {
                    setCachedLtrAnalysis(investmentCache.ltr_analysis);
                }
                if (interiorCache) {
                    setInteriorSummary(interiorCache);
                }
            } catch (e) {
                console.error('[ExploreTab Cache] Error fetching cache:', e);
            }
            console.log(`%c[⏱ ExploreTab] +${_elapsed()} — ALL cache fetches COMPLETE`, 'color: #22c55e; font-weight: bold;');
        })();
        return () => { cancelled = true; };
    }, [propertyData?.zpid, customAnalysis]);



    const handleFullRefresh = async () => {
        await onRunCustomAnalysis(true);
        // handleRunComprehensive(true) is automatically triggered by onRunCustomAnalysis(true) in App.tsx
        // Interior analysis is now merged into the comprehensive analysis prompt.
    };

    const designStyle = customAnalysis?.home_interior?.design_style || cachedDesignStyle || null;
    const marketDynamics = customAnalysis?.deep_investment_research?.structured_report?.market_dynamics || cachedMarketDynamics || null;
    const ltrAnalysis = customAnalysis?.property_investment?.ltr_analysis || cachedLtrAnalysis || null;
    const keyInsights = cachedKeyInsights || null;
    const neighborhoodOverview = customAnalysis?.neighborhood?.overview || cachedNeighborhoodOverview || null;
    const visualPoi = customAnalysis?.neighborhood?.visual_poi || cachedVisualPoi || undefined;
    const mapLabels = customAnalysis?.neighborhood?.map_labels || cachedMapLabels || undefined;
    const currentInteriorSummary = interiorSummary || comprehensiveAnalysis?.interior_summary || cachedComprehensiveAnalysis?.interior_summary;

    const analysis = comprehensiveAnalysis || cachedComprehensiveAnalysis;
    const isForSale = !propertyData || !propertyData.homeStatus ||
        propertyData.homeStatus.toUpperCase().includes('FOR_SALE');

    if (propertyData && !isForSale) {
        const statusLabel = propertyData.homeStatus?.replace(/_/g, ' ') ?? 'Not For Sale';
        return (
            <div className="flex flex-col items-center px-6 select-none">
                {/* Search bar at top */}
                {searchBar && (
                    <div className="w-full max-w-4xl mx-auto pt-8 pb-4 sticky top-0 z-[40] bg-slate-50/80 backdrop-blur-md">
                        {searchBar}
                    </div>
                )}

                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    {/* Icon */}
                    <div className="relative mb-10">
                        <div className="w-36 h-36 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-xl shadow-slate-300/50">
                            <i className="fa-solid fa-house-lock text-5xl text-slate-400"></i>
                        </div>
                        {/* Status pill */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.18em] px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                            {statusLabel}
                        </div>
                    </div>

                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-2">
                        Not Available for Sale
                    </h2>
                    {propertyData.address && (
                        <p className="text-base font-semibold text-slate-500 mt-3 max-w-md leading-snug">
                            {propertyData.address}
                        </p>
                    )}
                </div>
            </div>
        );
    }


    if (loading && !propertyData) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                <div className="animate-pulse">
                    <i className="fa-solid fa-house-signal text-8xl text-indigo-200"></i>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mt-10">Analyzing Property DNA...</h2>
                {currentAddress && (
                    <p className="text-lg font-bold text-slate-500 mt-2 max-w-lg text-center leading-tight">
                        {currentAddress}
                    </p>
                )}
                <p className="text-sm font-black text-indigo-600 mt-4 uppercase tracking-[0.2em]">{loadingSublabel}</p>
            </div>
        );
    }

    return (
        <>
            <div className="animate-in fade-in duration-500 px-5">
                {propertyData && (
                    <>
                        {/* Deprecated banner */}
                        {propertyData.deprecated && (
                            <div className="max-w-4xl mx-auto px-4 pt-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border-2 border-amber-200 rounded-2xl shadow-sm">
                                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-circle-exclamation text-amber-600 text-sm"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-black text-amber-700 uppercase tracking-widest">Deprecated Property</div>
                                        <div className="text-xs font-medium text-amber-600 mt-0.5">
                                            This property is no longer listed as active in the market. It may have been sold or de-listed.
                                            {propertyData.deprecatedAt && (
                                                <span className="ml-2 opacity-60 font-mono text-[10px]">
                                                    (flagged {(() => {
                                                        const d = propertyData.deprecatedAt;
                                                        const date = d?.toDate ? d.toDate() : new Date(d);
                                                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                                    })()})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-200/60 rounded-xl border border-amber-300/40 shrink-0">
                                        <i className="fa-solid fa-ban text-amber-600 text-[10px]"></i>
                                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Off Market</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Property Header (left) + Search Bar (right) in one row ── */}
                        <div className="bg-white px-5 py-3 md:px-6 rounded-t-[1.5rem] border-x border-t border-slate-100 shadow-sm">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <PropertyHeader
                                        data={propertyData}
                                        isFavorited={isFavorited}
                                        onToggleFavorite={onToggleFavorite}
                                        onRunAnalysis={() => onRunCustomAnalysis(false)}
                                        designStyle={designStyle}
                                        marketDynamics={marketDynamics}
                                        section="top"
                                        parcelPolygon={
                                            propertyData.parcelPolygon && propertyData.parcelPolygon.length > 3
                                                ? propertyData.parcelPolygon.map((pt: any) =>
                                                    Array.isArray(pt) ? pt : [pt.lon, pt.lat]
                                                )
                                                : undefined
                                        }
                                    />
                                </div>
                                {searchBar && (
                                    <div className="lg:w-[420px] xl:w-[500px] shrink-0">
                                        {searchBar}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Tab Navigation Bar ── */}
                        <div className="bg-white border-x border-b border-slate-100 px-6 py-3 flex items-center gap-3">
                            {/* Overview tab — full size */}
                            <button
                                onClick={() => setActiveTab('property-data')}
                                className={`flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest whitespace-nowrap transition-all flex-shrink-0 ${activeTab === 'property-data'
                                    ? 'bg-gradient-to-r from-indigo-700 to-slate-900 text-white shadow-xl shadow-indigo-300/40'
                                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                    }`}
                            >
                                <i className="fa-solid fa-database text-sm"></i>
                                Overview
                            </button>

                            {/* Divider */}
                            <div className="w-px h-8 bg-slate-200 flex-shrink-0"></div>

                            {/* AI sub-tabs — two rows */}
                            <div className="flex-1 space-y-1">
                                {/* Row 1 */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {([
                                        { id: 'interior', label: 'Interior', icon: 'fa-couch' },
                                        { id: 'rooms', label: 'Rooms', icon: 'fa-star' },
                                        { id: 'exterior_and_neighborhood', label: 'Exterior', icon: 'fa-house' },
                                        { id: 'neighborhood', label: 'Neighborhood', icon: 'fa-map-location-dot' },
                                        { id: 'schools', label: 'Schools', icon: 'fa-graduation-cap' },
                                        { id: 'pulse', label: 'Community Pulse', icon: 'fa-users-viewfinder' },
                                    ]).map(tab => {
                                        const isSelected = activeTab === 'visual-ai' && activeSubTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveTab('visual-ai');
                                                    setActiveSubTab(tab.id);
                                                    onRunCustomAnalysis(false);
                                                }}
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${isSelected
                                                    ? 'bg-indigo-600 text-white border border-indigo-700 border-b-[3px] border-b-indigo-800 shadow-[0_2px_4px_rgba(79,70,229,0.3)]'
                                                    : 'bg-white text-slate-500 border border-slate-200 border-b-[3px] border-b-slate-300 shadow-[0_2px_3px_rgba(0,0,0,0.06)] hover:border-indigo-300 hover:text-indigo-600 hover:shadow-[0_2px_6px_rgba(99,102,241,0.15)] active:translate-y-[1px] active:border-b-[2px] active:shadow-none'
                                                    }`}
                                            >
                                                <i className={`fa-solid ${tab.icon} text-[9px]`}></i>
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* Row 2 */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {([
                                        { id: 'deep_research', label: 'Investment Research', icon: 'fa-magnifying-glass-chart' },
                                        { id: 'city_neighborhoods', label: 'City Neighborhoods', icon: 'fa-mountain-city' },
                                        { id: 'investment', label: 'Property Economics', icon: 'fa-chart-pie' },
                                        { id: 'context_graph', label: 'Context Graph', icon: 'fa-diagram-project' },
                                    ]).map(tab => {
                                        const isSelected = activeTab === 'visual-ai' && activeSubTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    setActiveTab('visual-ai');
                                                    setActiveSubTab(tab.id);
                                                    onRunCustomAnalysis(false);
                                                }}
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${isSelected
                                                    ? 'bg-indigo-600 text-white border border-indigo-700 border-b-[3px] border-b-indigo-800 shadow-[0_2px_4px_rgba(79,70,229,0.3)]'
                                                    : 'bg-white text-slate-500 border border-slate-200 border-b-[3px] border-b-slate-300 shadow-[0_2px_3px_rgba(0,0,0,0.06)] hover:border-indigo-300 hover:text-indigo-600 hover:shadow-[0_2px_6px_rgba(99,102,241,0.15)] active:translate-y-[1px] active:border-b-[2px] active:shadow-none'
                                                    }`}
                                            >
                                                <i className={`fa-solid ${tab.icon} text-[9px]`}></i>
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                    {userRole === 'admin' && (
                                        <button
                                            onClick={handleFullRefresh}
                                            title="Full Refresh"
                                            className="flex items-center justify-center w-7 h-7 rounded-lg text-indigo-500 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                                        >
                                            <i className="fa-solid fa-sync text-[9px]"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Tab Content ── */}
                        {activeTab === 'property-data' && (
                            <StickyNotesLayer zpid={propertyData?.zpid || ''} activeTab="overview">
                                <div className="flex flex-col gap-2.5">


                                    {/* Property Images + MLS Details — side by side */}
                                    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-2.5">
                                        {propertyData.images && propertyData.images.length > 0 && (
                                            <div className="rounded-2xl overflow-hidden">
                                                <PropertyImages images={propertyData.images} loading={imagesLoading} attribution={propertyData.attribution} />
                                            </div>
                                        )}
                                        <PropertyHeader
                                            data={propertyData}
                                            isFavorited={isFavorited}
                                            onToggleFavorite={onToggleFavorite}
                                            onRunAnalysis={() => onRunCustomAnalysis(false)}
                                            designStyle={designStyle}
                                            marketDynamics={marketDynamics}
                                            section="details"
                                            parcelPolygon={
                                                propertyData.parcelPolygon && propertyData.parcelPolygon.length > 3
                                                    ? propertyData.parcelPolygon.map((pt: any) =>
                                                        Array.isArray(pt) ? pt : [pt.lon, pt.lat]
                                                    )
                                                    : undefined
                                            }
                                        />
                                    </div>

                                    {(propertyData.airQuality || propertyData.solarData || propertyData.noiseData || propertyData.climateRisk || propertyData.pollenIndex || propertyData.historical_disasters || propertyData.broadband || propertyData.drought) && (
                                        <>
                                            {/* 3rd Party Data heading */}
                                            <div className="flex items-center gap-2 mt-6 mb-2">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                    <i className="fa-solid fa-database text-emerald-600 text-[11px]"></i>
                                                </div>
                                                <span className="text-lg font-black text-slate-900 tracking-tight">3rd Party Data</span>
                                            </div>
                                            <div className="rounded-2xl border-2 border-indigo-200 overflow-visible">
                                                <AirQualitySection data={propertyData} neighborhoodOverview={neighborhoodOverview} disasterData={propertyData.historical_disasters} onRefresh={onRefreshEnvironment} refreshing={environmentRefreshing} />
                                            </div>
                                        </>
                                    )}

                                    {/* AI Insights heading */}
                                    <div className="flex items-center gap-2 mt-6 mb-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                            <i className="fa-solid fa-brain text-indigo-600 text-[11px]"></i>
                                        </div>
                                        <span className="text-lg font-black text-slate-900 tracking-tight">AI Insights</span>
                                    </div>




                                    {/* Horizontal Insight Strip */}

                                    {(designStyle || keyInsights || ltrAnalysis || (propertyData as any).orientation_ai || neighborhoodOverview || analysis) && (
                                        <div className="flex flex-col gap-3">
                                            {/* Executive Summary */}
                                            {(() => {
                                                if (!analysis) return null;

                                                const parts = [
                                                    { text: analysis.summary },
                                                    { text: analysis.strategic_insights },
                                                    { text: analysis.risks_considerations, type: 'risk' }
                                                ].filter(p => p.text);

                                                if (parts.length === 0) return null;

                                                return (
                                                    <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden bg-white px-2 mb-1 shadow-sm">
                                                        <div className="flex flex-col gap-3 bg-slate-50/30 rounded-xl p-3">
                                                            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                                                <div className="p-4">
                                                                    {/* Header */}
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                                            <i className="fa-solid fa-bolt-lightning text-indigo-600 text-[11px]"></i>
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="text-[16px] font-black text-slate-700 tracking-tight">Executive Summary</h3>
                                                                        </div>
                                                                    </div>

                                                                    {/* Content Area */}
                                                                    <div className="text-[13px] text-slate-600 leading-relaxed text-left flex flex-col gap-4">
                                                                        {parts.map((p: any, i: number) => {
                                                                            const text = p.text || '';
                                                                            return (
                                                                                <div
                                                                                    key={i}
                                                                                    className={p.type === 'risk' ? 'bg-rose-50 p-6 rounded-2xl border border-rose-100 flex gap-4 shadow-sm mt-2' : ''}
                                                                                >
                                                                                    {p.type === 'risk' && <i className="fa-solid fa-flag text-rose-500 mt-1 flex-shrink-0"></i>}
                                                                                    <div className="flex-1">
                                                                                        {text.split('\n\n').filter(Boolean).map((para: string, pi: number) => (
                                                                                            <p key={pi} className={pi > 0 ? 'mt-4' : ''}>
                                                                                                {para.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                                    j % 2 === 1 ? <strong key={j} className="font-black text-slate-900 drop-shadow-sm">{chunk}</strong> : chunk
                                                                                                ))}
                                                                                            </p>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Interior Summary Intelligence */}
                                            {(customAnalysis || currentInteriorSummary || analysis) && (
                                                <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden bg-white px-2 mb-1 shadow-sm">
                                                    <div className="flex flex-col gap-3 bg-slate-50/30 rounded-xl p-3">
                                                        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                                            <div className="p-4">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                                            <i className="fa-solid fa-wand-magic-sparkles text-indigo-600 text-[11px]"></i>
                                                                        </div>
                                                                        <h3 className="text-[16px] font-black text-slate-700 tracking-tight">Interiors</h3>
                                                                    </div>

                                                                </div>

                                                                {!currentInteriorSummary ? (
                                                                    <div className="py-8 flex flex-col items-center justify-center gap-3">
                                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                                            <i className="fa-solid fa-magnifying-glass-plus text-sm"></i>
                                                                        </div>
                                                                        <div className="text-center">
                                                                            <div className="text-[12px] font-bold text-slate-500">No interior analysis found</div>

                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <div className="flex items-center gap-2 mb-1.5 opacity-0 h-0 overflow-hidden">
                                                                                    <i className="fa-solid fa-house-user text-indigo-400"></i>
                                                                                    Overall Interior
                                                                                </div>
                                                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                                                                                    {currentInteriorSummary.interior_summary}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                                                    <i className="fa-solid fa-door-open text-indigo-400"></i>
                                                                                    Spaces
                                                                                </div>
                                                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                                                                                    {currentInteriorSummary.rooms_summary}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="space-y-4">
                                                                            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                                                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                                    <i className="fa-solid fa-palette"></i>
                                                                                    Aesthetic Vibe
                                                                                </div>
                                                                                <div className="text-[14px] font-black text-indigo-900 tracking-tight leading-snug">
                                                                                    {currentInteriorSummary.vibe}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                                    <i className="fa-solid fa-tags"></i>
                                                                                    Physical Attributes
                                                                                </div>
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    {currentInteriorSummary.objective_tags?.map((tag: string, idx: number) => (
                                                                                        <span key={idx} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-600 shadow-sm">
                                                                                            {tag}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Row 1: Property & Neighborhood Context */}
                                            <div className="w-full px-2 -mt-1 rounded-2xl border-2 border-indigo-200 overflow-hidden">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                                                    {/* Front Orientation */}
                                                    {(propertyData as any).orientation_ai && (propertyData as any).orientation_ai.final_orientation !== 'UNCLEAR_IMAGE' && (() => {
                                                        const sat = (propertyData as any).orientation_ai;
                                                        return (
                                                            <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-compass text-amber-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Front Orientation</span>
                                                                        </div>
                                                                        {sat.orientation_highlights && (
                                                                            <p className="text-[12px] text-slate-600 leading-relaxed mb-2">
                                                                                The front of the home likely faces <strong>{sat.final_orientation}</strong>. {sat.orientation_highlights}
                                                                            </p>
                                                                        )}
                                                                        <div className="space-y-2">
                                                                            {sat.lot_coverage_hardscape != null && (
                                                                                <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                                                    <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1">Lot Coverage</div>
                                                                                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                                                        <div className="h-full bg-slate-400 rounded-full" style={{ width: `${sat.lot_coverage_hardscape}%` }} />
                                                                                    </div>
                                                                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-0.5">
                                                                                        <span>{sat.lot_coverage_hardscape}% hard</span>
                                                                                        <span className="text-emerald-600">{sat.lot_coverage_pervious ?? (100 - sat.lot_coverage_hardscape)}% green</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {sat.buyer_pro && (
                                                                                <div className="flex items-start gap-1.5 p-2 bg-emerald-50/50 rounded-lg border border-emerald-100">
                                                                                    <i className="fa-solid fa-plus text-[8px] text-emerald-500 mt-0.5"></i>
                                                                                    <div className="text-[11px] text-emerald-700 font-medium leading-snug">{sat.buyer_pro}</div>
                                                                                </div>
                                                                            )}
                                                                            {sat.buyer_con && (
                                                                                <div className="flex items-start gap-1.5 p-2 bg-rose-50/50 rounded-lg border border-rose-100">
                                                                                    <i className="fa-solid fa-minus text-[8px] text-rose-500 mt-0.5"></i>
                                                                                    <div className="text-[11px] text-rose-700 font-medium leading-snug">{sat.buyer_con}</div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Outdoors & Privacy */}
                                                    {(analysis?.detailed_analysis?.outdoors_view_quality || analysis?.detailed_analysis?.privacy_layout) && (
                                                        <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                            <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                <div className="p-4">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                                            <i className="fa-solid fa-tree text-emerald-600 group-hover:text-white text-[11px]"></i>
                                                                        </div>
                                                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Outdoors</span>
                                                                    </div>
                                                                    <p className="text-[13px] text-slate-600 leading-relaxed">
                                                                        {analysis.detailed_analysis.outdoors_view_quality && (
                                                                            <span className="block">
                                                                                {analysis.detailed_analysis.outdoors_view_quality.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                    j % 2 === 1 ? <strong key={j} className="font-black text-slate-900 drop-shadow-sm">{chunk}</strong> : chunk
                                                                                ))}
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Schools Intelligence */}
                                                    {schoolsIntelligence?.schools?.length > 0 && (
                                                        <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                            <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                <div className="p-4">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-graduation-cap text-blue-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Schools</span>
                                                                        </div>
                                                                        {schoolsIntelligence.district_rating && (
                                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${schoolsIntelligence.district_rating.startsWith('A') ? 'bg-emerald-100 text-emerald-700' :
                                                                                schoolsIntelligence.district_rating.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                                                                                    schoolsIntelligence.district_rating.startsWith('C') ? 'bg-amber-100 text-amber-700' :
                                                                                        'bg-rose-100 text-rose-700'
                                                                                }`}>
                                                                                {schoolsIntelligence.district_name} · {schoolsIntelligence.district_rating}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* District overview */}
                                                                    {schoolsIntelligence.district_overview && (
                                                                        <p className="text-[12px] text-slate-500 leading-relaxed mb-3">
                                                                            {schoolsIntelligence.district_overview}
                                                                        </p>
                                                                    )}

                                                                    {/* Desirability badge */}
                                                                    {schoolsIntelligence.is_desirable_zone !== undefined && (
                                                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 ${schoolsIntelligence.is_desirable_zone ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                                                                            <i className={`fa-solid ${schoolsIntelligence.is_desirable_zone ? 'fa-circle-check text-emerald-500' : 'fa-triangle-exclamation text-amber-500'} text-[11px]`}></i>
                                                                            <span className={`text-[11px] font-bold ${schoolsIntelligence.is_desirable_zone ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                                                {schoolsIntelligence.is_desirable_zone ? 'Desirable School Zone' : 'School Zone Concerns'}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {/* School tabs — stacked, max 3 */}
                                                                    <div className="flex flex-col gap-1.5 mb-2">
                                                                        {schoolsIntelligence.schools.slice(0, 3).map((school: any, idx: number) => {
                                                                            const isActive = (schoolsExpanded.__activeIdx ?? 0) === idx;
                                                                            const ratingNum = parseFloat(String(school.mls_rating)) || 0;
                                                                            const ratingColor = ratingNum >= 7 ? 'emerald' : ratingNum >= 5 ? 'amber' : 'rose';
                                                                            const levelIcon = school.level?.includes('element') ? 'fa-child' :
                                                                                school.level?.includes('middle') ? 'fa-school' : 'fa-building-columns';
                                                                            return (
                                                                                <button
                                                                                    key={idx}
                                                                                    onClick={() => setSchoolsExpanded(prev => ({ ...prev, __activeIdx: idx }))}
                                                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all w-full ${isActive
                                                                                        ? 'bg-indigo-600 shadow-sm border border-indigo-700'
                                                                                        : 'bg-white border border-slate-200 hover:bg-slate-50'
                                                                                        }`}
                                                                                >
                                                                                    <i className={`fa-solid ${levelIcon} text-[9px] ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}></i>
                                                                                    <span className={`text-[12px] font-bold flex-1 ${isActive ? 'text-white' : 'text-slate-600'}`}>{school.name}</span>
                                                                                    {school.mls_rating && (
                                                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded bg-${ratingColor}-100 text-${ratingColor}-700`}>
                                                                                            {school.mls_rating}/10
                                                                                        </span>
                                                                                    )}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>

                                                                    {/* Active school content */}
                                                                    {(() => {
                                                                        const activeIdx = schoolsExpanded.__activeIdx ?? 0;
                                                                        const school = schoolsIntelligence.schools[activeIdx];
                                                                        if (!school) return null;
                                                                        const isDetailOpen = schoolsExpanded[`detail_${activeIdx}`];
                                                                        return (
                                                                            <div className="border border-slate-100 rounded-xl overflow-hidden bg-white animate-in fade-in duration-200">
                                                                                {/* Summary — always visible */}
                                                                                {school.overall_assessment && (
                                                                                    <div className="p-3 bg-indigo-50/50 border-b border-indigo-100/50">
                                                                                        <p className="text-[13px] text-slate-600 leading-relaxed">{school.overall_assessment}</p>
                                                                                    </div>
                                                                                )}

                                                                                {/* Show Details toggle */}
                                                                                <button
                                                                                    onClick={() => setSchoolsExpanded(prev => ({ ...prev, [`detail_${activeIdx}`]: !prev[`detail_${activeIdx}`] }))}
                                                                                    className="w-full flex items-center justify-center gap-1 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                                                                >
                                                                                    <span>{isDetailOpen ? 'Hide Details' : 'Show Details'}</span>
                                                                                    <i className={`fa-solid fa-chevron-${isDetailOpen ? 'up' : 'down'} text-[8px]`}></i>
                                                                                </button>

                                                                                {/* Expandable details */}
                                                                                {isDetailOpen && (
                                                                                    <div className="px-3 pb-3 space-y-2 border-t border-slate-50">
                                                                                        {/* Stat pills */}
                                                                                        <div className="flex flex-wrap gap-1.5 pt-2">
                                                                                            {school.enrollment && (
                                                                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                                                                                    Enrollment: {school.enrollment?.toLocaleString()}
                                                                                                </span>
                                                                                            )}
                                                                                            {school.student_teacher_ratio && (
                                                                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                                                                                    Ratio: {school.student_teacher_ratio}
                                                                                                </span>
                                                                                            )}
                                                                                            {school.graduation_rate && school.graduation_rate !== 'N/A' && (
                                                                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                                                                                    Graduation: {school.graduation_rate}
                                                                                                </span>
                                                                                            )}
                                                                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full capitalize">
                                                                                                {school.type || 'Public'}
                                                                                            </span>
                                                                                        </div>

                                                                                        {/* Test Scores */}
                                                                                        {school.test_scores && (
                                                                                            <div>
                                                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Test Scores</div>
                                                                                                <p className="text-[11px] text-slate-600 leading-relaxed">{school.test_scores}</p>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* College Readiness */}
                                                                                        {school.college_readiness && school.college_readiness !== 'N/A' && (
                                                                                            <div>
                                                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">College Readiness</div>
                                                                                                <p className="text-[11px] text-slate-600 leading-relaxed">{school.college_readiness}</p>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* AP/IB Programs */}
                                                                                        {school.ap_ib_programs && school.ap_ib_programs !== 'N/A' && (
                                                                                            <div>
                                                                                                <div className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mb-1">AP/IB Programs</div>
                                                                                                <p className="text-[11px] text-slate-600 leading-relaxed">{school.ap_ib_programs}</p>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Parent Sentiment */}
                                                                                        <div className="grid grid-cols-2 gap-2">
                                                                                            {school.parent_sentiment_positive && (
                                                                                                <div className="p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                                                                                                    <div className="text-[9px] font-black text-emerald-600 uppercase mb-1">
                                                                                                        <i className="fa-solid fa-thumbs-up mr-1"></i>Parent Loves
                                                                                                    </div>
                                                                                                    <p className="text-[10px] text-emerald-800 leading-relaxed">{school.parent_sentiment_positive}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {school.parent_sentiment_concerns && (
                                                                                                <div className="p-2 bg-pink-50/50 rounded-lg border border-pink-100/50">
                                                                                                    <div className="text-[9px] font-black text-pink-600 uppercase mb-1">
                                                                                                        <i className="fa-solid fa-flag mr-1"></i>Parent Concerns
                                                                                                    </div>
                                                                                                    <p className="text-[10px] text-pink-800 leading-relaxed">{school.parent_sentiment_concerns}</p>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* Activities & Strengths */}
                                                                                        {school.extracurriculars && (
                                                                                            <div>
                                                                                                <div className="text-[9px] font-black text-violet-500 uppercase tracking-wider mb-1">
                                                                                                    <i className="fa-solid fa-trophy mr-1"></i>Activities & Strengths
                                                                                                </div>
                                                                                                <p className="text-[11px] text-slate-600 leading-relaxed">{school.extracurriculars}</p>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Recent News */}
                                                                                        {school.recent_news && (
                                                                                            <div>
                                                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Recent News</div>
                                                                                                <p className="text-[11px] text-slate-500 leading-relaxed italic">{school.recent_news}</p>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Demographics */}
                                                                                        {school.demographics_summary && (
                                                                                            <div>
                                                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                                                                                    <i className="fa-solid fa-users mr-1"></i>Demographics
                                                                                                </div>
                                                                                                <p className="text-[11px] text-slate-600 leading-relaxed">{school.demographics_summary}</p>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()}

                                                                    {/* Education Verdict */}
                                                                    {schoolsIntelligence.education_verdict && (
                                                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                                                            <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Education Verdict</div>
                                                                            <p className="text-[12px] text-slate-600 leading-relaxed">
                                                                                {schoolsIntelligence.education_verdict.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                    j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                                                                                ))}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Schools Summary from Comprehensive Analysis (fallback when no full schools data) */}
                                                    {!schoolsIntelligence?.schools?.length && analysis?.schools_summary && (
                                                        <div className="flex flex-col gap-3 bg-slate-50/30 rounded-xl border border-slate-100/80 p-3">
                                                            <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                <div className="p-4">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                                                            <i className="fa-solid fa-graduation-cap text-blue-600 text-[11px]"></i>
                                                                        </div>
                                                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Schools</span>
                                                                    </div>
                                                                    <p className="text-[13px] text-slate-600 leading-relaxed">
                                                                        {analysis.schools_summary.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                            j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                                                                        ))}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Architecture Appeal */}
                                                    {(designStyle?.style || analysis?.detailed_analysis?.visual_appeal_condition) && (
                                                        <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                            <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                <div className="p-4">
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                                            <i className="fa-solid fa-archway text-indigo-600 group-hover:text-white text-[11px]"></i>
                                                                        </div>
                                                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">Architecture Appeal</span>
                                                                    </div>
                                                                    {designStyle?.style && (
                                                                        <span className="inline-block bg-indigo-100 text-indigo-700 text-[11px] font-black uppercase px-2.5 py-1 rounded-full mb-2">{designStyle.style}</span>
                                                                    )}
                                                                    {(analysis?.detailed_analysis?.visual_appeal_condition || designStyle?.reasoning) && (
                                                                        <p className="text-[13px] text-slate-600 leading-relaxed text-left">
                                                                            {(analysis?.detailed_analysis?.visual_appeal_condition || designStyle?.reasoning)?.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                j % 2 === 1 ? <strong key={j} className="font-black text-slate-900 drop-shadow-sm">{chunk}</strong> : chunk
                                                                            ))}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Neighborhood Identity */}
                                                    {propertyData?.neighborhood_identity?.resolved_name && (() => {
                                                        const nid = propertyData.neighborhood_identity;
                                                        const gem = cityNhEntryOverview || nid.gemini;
                                                        const tierColors: Record<string, string> = {
                                                            'Entry-Level': 'bg-emerald-100 text-emerald-700',
                                                            'Mid-Range': 'bg-blue-100 text-blue-700',
                                                            'Upper Mid-Range': 'bg-indigo-100 text-indigo-700',
                                                            'Premium': 'bg-amber-100 text-amber-700',
                                                            'Ultra-Luxury': 'bg-purple-100 text-purple-700',
                                                        };
                                                        return (
                                                            <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-map-location-dot text-violet-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">{nid.resolved_name}</span>
                                                                        </div>
                                                                        {gem?.character?.description && (
                                                                            <p className="text-[11px] text-slate-600 leading-relaxed mb-3">{gem.character.description}</p>
                                                                        )}
                                                                        {/* Tags */}
                                                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                                                            {gem?.price_context?.tier && (
                                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tierColors[gem.price_context.tier] || 'bg-gray-100 text-gray-700'}`}>
                                                                                    <i className="fa-solid fa-tag mr-1 text-[8px]" />{gem.price_context.tier}
                                                                                </span>
                                                                            )}
                                                                            {gem?.price_context?.typical_range && (
                                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                                                    <i className="fa-solid fa-dollar-sign mr-1 text-[8px]" />{gem.price_context.typical_range}
                                                                                </span>
                                                                            )}
                                                                            {gem?.character?.community_type && (
                                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                                                                    {gem.character.community_type}
                                                                                </span>
                                                                            )}
                                                                            {gem?.character?.era_built && (
                                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                                                    Built {gem.character.era_built}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {/* Standout Features */}
                                                                        {gem?.unique_features?.length > 0 && (
                                                                            <div className="mt-2">
                                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Standout Features</div>
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {gem.unique_features.map((feat: string, i: number) => (
                                                                                        <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-white border border-violet-100 text-violet-700 shadow-sm">
                                                                                            {feat}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {gem?.price_context?.context && (
                                                                            <div className="mt-2">
                                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Market Position</div>
                                                                                <p className="text-[10px] text-slate-600 leading-relaxed">{gem.price_context.context}</p>
                                                                            </div>
                                                                        )}
                                                                        {gem?.infrastructure_quality && (
                                                                            <div className="mt-2">
                                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Infrastructure</div>
                                                                                <p className="text-[10px] text-slate-600 leading-relaxed">{gem.infrastructure_quality}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Row: Unified Lifestyle Fit */}
                                            {(() => {
                                                const NEIGHBORHOOD_KEY_MAP: Record<string, string> = {
                                                    working_professionals: 'professionals',
                                                    families_with_kids: 'family',
                                                    seniors: 'senior',
                                                };
                                                const ALL_TABS = [
                                                    { key: 'working_professionals', label: 'Working Professionals', icon: 'fa-briefcase', bg: 'bg-sky-100', text: 'text-sky-600', type: 'fit' as const },
                                                    { key: 'families_with_kids', label: 'Families with Kids', icon: 'fa-children', bg: 'bg-blue-100', text: 'text-blue-600', type: 'fit' as const },
                                                    { key: 'seniors', label: 'Seniors', icon: 'fa-heart-pulse', bg: 'bg-rose-100', text: 'text-rose-600', type: 'fit' as const },
                                                    { key: 'outdoor', label: 'Outdoor & Recreation', icon: 'fa-mountain-sun', bg: 'bg-emerald-100', text: 'text-emerald-600', type: 'neighborhood' as const },
                                                    { key: 'pets', label: 'Pet Friendly', icon: 'fa-paw', bg: 'bg-amber-100', text: 'text-amber-600', type: 'neighborhood' as const },
                                                    { key: 'food', label: 'Food & Entertainment', icon: 'fa-utensils', bg: 'bg-violet-100', text: 'text-violet-600', type: 'neighborhood' as const },
                                                ];
                                                const verdictColors: Record<string, string> = {
                                                    'Excellent Fit': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                                    'Good Fit': 'bg-sky-100 text-sky-700 border-sky-200',
                                                    'Moderate Fit': 'bg-amber-100 text-amber-700 border-amber-200',
                                                    'Poor Fit': 'bg-orange-100 text-orange-700 border-orange-200',
                                                    'Not Recommended': 'bg-rose-100 text-rose-700 border-rose-200',
                                                };

                                                // Check if anything to show
                                                const hasFitData = lifestyleFit && (lifestyleFit.working_professionals || lifestyleFit.families_with_kids || lifestyleFit.seniors);
                                                const hasNeighborhoodData = lifestyleInsights && (lifestyleInsights.outdoor || lifestyleInsights.pets || lifestyleInsights.food);
                                                if (!hasFitData && !hasNeighborhoodData && !lifestyleLoading) return null;

                                                const activeTab = ALL_TABS.find(t => t.key === lifestyleFitTab) || ALL_TABS[0];

                                                return (
                                                    <div className="w-full px-2 rounded-2xl border-2 border-indigo-200 overflow-hidden">
                                                        <div className="p-4">
                                                            {/* Header */}
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                                                                    <i className="fa-solid fa-people-roof text-indigo-600 text-sm" />
                                                                </div>
                                                                <div>
                                                                    <span className="text-[16px] font-black text-slate-700 tracking-tight">Lifestyle Fit and Interests</span>
                                                                    <div className="text-[10px] text-slate-400">Property analysis + neighborhood context for each lifestyle</div>
                                                                </div>
                                                            </div>

                                                            {/* Compact horizontal tabs */}
                                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                                {ALL_TABS.map(tab => {
                                                                    const isActive = tab.key === lifestyleFitTab;
                                                                    const hasContent = tab.type === 'fit'
                                                                        ? !!lifestyleFit?.[tab.key]
                                                                        : !!lifestyleInsights?.[tab.key as keyof typeof lifestyleInsights];
                                                                    const fitData = tab.type === 'fit' ? lifestyleFit?.[tab.key] : null;
                                                                    return (
                                                                        <button
                                                                            key={tab.key}
                                                                            onClick={() => setLifestyleFitTab(tab.key)}
                                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-left ${isActive
                                                                                ? `${tab.bg} border-current ${tab.text} shadow-sm`
                                                                                : hasContent
                                                                                    ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer'
                                                                                    : 'bg-slate-50/30 border-slate-100 opacity-40 cursor-not-allowed'
                                                                                }`}
                                                                            disabled={!hasContent}
                                                                        >
                                                                            <i className={`fa-solid ${tab.icon} ${tab.text} text-[11px]`} />
                                                                            <span className={`text-[11px] font-bold whitespace-nowrap ${isActive ? 'text-slate-900' : 'text-slate-500'
                                                                                }`}>{tab.label}</span>
                                                                            {fitData?.verdict && (
                                                                                <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold border ${verdictColors[fitData.verdict] || 'bg-slate-100 text-slate-500'}`}>
                                                                                    {fitData.verdict}
                                                                                </span>
                                                                            )}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Content panel — adapts based on tab type */}
                                                            {activeTab.type === 'fit' ? (() => {
                                                                const fitData = lifestyleFit?.[activeTab.key];
                                                                if (!fitData) return (
                                                                    <div className="bg-slate-50/30 rounded-xl border border-slate-100 p-8 flex flex-col items-center justify-center text-center">
                                                                        <div className={`w-10 h-10 rounded-full ${activeTab.bg} flex items-center justify-center mb-3`}>
                                                                            <i className={`fa-solid ${activeTab.icon} ${activeTab.text} text-sm`} />
                                                                        </div>
                                                                        <div className="text-[12px] font-bold text-slate-400">No analysis available for {activeTab.label}</div>
                                                                    </div>
                                                                );
                                                                return (
                                                                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                                                                        <div className="p-5 flex flex-col gap-3">
                                                                            {/* Verdict badge */}
                                                                            <div className="flex justify-end">
                                                                                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${verdictColors[fitData.verdict] || 'bg-slate-100 text-slate-600'}`}>
                                                                                    {fitData.verdict}
                                                                                </span>
                                                                            </div>

                                                                            {/* Summary */}
                                                                            <p className="text-[13px] text-slate-600 leading-relaxed">{fitData.summary}</p>

                                                                            {/* Strengths + Concerns side by side */}
                                                                            <div className="grid grid-cols-2 gap-4">
                                                                                {fitData.strengths?.length > 0 && (
                                                                                    <div>
                                                                                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5">Strengths</div>
                                                                                        <div className="flex flex-col gap-1">
                                                                                            {fitData.strengths.map((s: string, i: number) => (
                                                                                                <div key={i} className="flex items-start gap-2">
                                                                                                    <i className="fa-solid fa-circle-check text-[9px] text-emerald-400 mt-[5px] flex-shrink-0" />
                                                                                                    <span className="text-[12px] text-slate-700 leading-snug">{s}</span>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                {fitData.concerns?.length > 0 && (
                                                                                    <div>
                                                                                        <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">Concerns</div>
                                                                                        <div className="flex flex-col gap-1">
                                                                                            {fitData.concerns.map((c: string, i: number) => (
                                                                                                <div key={i} className="flex items-start gap-2">
                                                                                                    <i className="fa-solid fa-triangle-exclamation text-[9px] text-amber-400 mt-[5px] flex-shrink-0" />
                                                                                                    <span className="text-[12px] text-slate-700 leading-snug">{c}</span>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Tip */}
                                                                            {fitData.tip && (
                                                                                <div className="flex items-start gap-2 bg-indigo-50/50 rounded-lg p-3 border border-indigo-100">
                                                                                    <i className="fa-solid fa-lightbulb text-[11px] text-indigo-400 mt-0.5" />
                                                                                    <span className="text-[12px] text-indigo-700 leading-snug">{fitData.tip}</span>
                                                                                </div>
                                                                            )}

                                                                            {/* Neighborhood context paragraph */}
                                                                            {(() => {
                                                                                const nbKey = NEIGHBORHOOD_KEY_MAP[activeTab.key];
                                                                                const nbText = nbKey && lifestyleInsights?.[nbKey as keyof typeof lifestyleInsights];
                                                                                if (!nbText) return null;
                                                                                return (
                                                                                    <div className="mt-1 bg-emerald-50/40 rounded-xl border border-emerald-100 p-4">
                                                                                        <div className="flex items-center gap-1.5 mb-2">
                                                                                            <i className="fa-solid fa-map-location-dot text-[10px] text-emerald-500" />
                                                                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Neighborhood Context</span>
                                                                                        </div>
                                                                                        <p className="text-[13px] text-slate-600 leading-relaxed text-left">
                                                                                            {String(nbText).split(/\*\*(.*?)\*\*/g).map((chunk: string, j: number) => (
                                                                                                j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                                                                                            ))}
                                                                                        </p>
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })() : (() => {
                                                                // Neighborhood tab — show paragraph text
                                                                const nbText = lifestyleInsights?.[activeTab.key as keyof typeof lifestyleInsights];
                                                                if (!nbText) return (
                                                                    <div className="bg-slate-50/30 rounded-xl border border-slate-100 p-8 flex flex-col items-center justify-center text-center">
                                                                        <div className={`w-10 h-10 rounded-full ${activeTab.bg} flex items-center justify-center mb-3`}>
                                                                            <i className={`fa-solid ${activeTab.icon} ${activeTab.text} text-sm`} />
                                                                        </div>
                                                                        <div className="text-[12px] font-bold text-slate-400">No insights available for {activeTab.label}</div>
                                                                    </div>
                                                                );
                                                                return (
                                                                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                                                                        <div className="p-5">
                                                                            <p className="text-[13px] text-slate-600 leading-relaxed text-left">
                                                                                {String(nbText).split(/\*\*(.*?)\*\*/g).map((chunk: string, j: number) => (
                                                                                    j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                                                                                ))}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            <div className="text-[8px] text-slate-700 mt-2 text-right">MLS + AI Photo Analysis • Google Places • Gemini</div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Row 2: Investment Insights */}
                                            {(keyInsights || ltrAnalysis || analysis?.detailed_analysis?.community_pulse) && (
                                                <div className="w-full px-2 rounded-2xl border-2 border-indigo-200 overflow-hidden">
                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                                        {/* Community Pulse */}
                                                        {(customAnalysis?.community_pulse || analysis?.detailed_analysis?.community_pulse) && (
                                                            <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                                                    <i className="fa-solid fa-users text-blue-600 group-hover:text-white text-[11px]"></i>
                                                                                </div>
                                                                                <span className="text-[16px] font-black text-slate-700 tracking-tight">Community Pulse</span>
                                                                            </div>
                                                                            {userRole === 'admin' && onRefreshCommunityPulse && (
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        setIsRefreshingPulse(true);
                                                                                        await onRefreshCommunityPulse();
                                                                                        setIsRefreshingPulse(false);
                                                                                    }}
                                                                                    disabled={isRefreshingPulse}
                                                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isRefreshingPulse ? 'bg-blue-50 text-blue-400 animate-spin' : 'bg-blue-50 text-blue-500 hover:bg-blue-100'}`}
                                                                                    title="Refresh Community Pulse"
                                                                                >
                                                                                    <i className="fa-solid fa-arrows-rotate text-[10px]"></i>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {/* Structured green/red points from raw community_pulse */}
                                                                        {(() => {
                                                                            const cp = customAnalysis?.community_pulse as any;
                                                                            if (!cp) {
                                                                                // Fallback: show comprehensive analysis paragraph
                                                                                return analysis?.detailed_analysis?.community_pulse ? (
                                                                                    <p className="text-[13px] text-slate-600 leading-relaxed text-left">
                                                                                        {analysis.detailed_analysis.community_pulse.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                            j % 2 === 1 ? <strong key={j} className="font-black text-slate-900 drop-shadow-sm">{chunk}</strong> : chunk
                                                                                        ))}
                                                                                    </p>
                                                                                ) : null;
                                                                            }
                                                                            const positives = cp.what_residents_like?.points || [];
                                                                            const negatives = [
                                                                                ...(cp.common_complaints?.points || []),
                                                                                ...(cp.safety_and_concerns?.points || []).filter((p: string) => {
                                                                                    const lower = p.toLowerCase();
                                                                                    return lower.includes('concern') || lower.includes('crime') || lower.includes('complaint') || lower.includes('issue') || lower.includes('risk') || lower.includes('noise') || lower.includes('traffic');
                                                                                }),
                                                                            ];
                                                                            const PULSE_LIMIT = 3;
                                                                            const showPos = pulseExpanded ? positives : positives.slice(0, PULSE_LIMIT);
                                                                            const showNeg = pulseExpanded ? negatives : negatives.slice(0, PULSE_LIMIT);
                                                                            const hasMore = positives.length > PULSE_LIMIT || negatives.length > PULSE_LIMIT;
                                                                            return (
                                                                                <div>
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                                        {positives.length > 0 && (
                                                                                            <div className="space-y-1.5">
                                                                                                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">What Residents Love</div>
                                                                                                {showPos.map((item: string, i: number) => (
                                                                                                    <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-[12px] text-emerald-800 flex items-start gap-2">
                                                                                                        <i className="fa-solid fa-circle-check text-emerald-400 text-[10px] mt-0.5 flex-shrink-0"></i>
                                                                                                        {item}
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                        {negatives.length > 0 && (
                                                                                            <div className="space-y-1.5">
                                                                                                <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Common Complaints</div>
                                                                                                {showNeg.map((item: string, i: number) => (
                                                                                                    <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-800 flex items-start gap-2">
                                                                                                        <i className="fa-solid fa-circle-exclamation text-red-400 text-[10px] mt-0.5 flex-shrink-0"></i>
                                                                                                        {item}
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    {hasMore && (
                                                                                        <button
                                                                                            onClick={() => setPulseExpanded(!pulseExpanded)}
                                                                                            className="mt-2 text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                                                                                        >
                                                                                            <i className={`fa-solid ${pulseExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[8px]`}></i>
                                                                                            {pulseExpanded ? 'Show less' : 'Show more'}
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Market Insights */}
                                                        {keyInsights && (
                                                            <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center group-hover:bg-violet-600 transition-colors">
                                                                                <i className="fa-solid fa-microscope text-violet-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Market Insights</span>
                                                                        </div>
                                                                        {keyInsights.executive_summary && keyInsights.executive_summary !== 'N/A' && (
                                                                            <p className="text-[13px] text-slate-600 leading-relaxed mb-3 italic">{keyInsights.executive_summary}</p>
                                                                        )}
                                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                                                            {[
                                                                                { label: 'Median', value: keyInsights.median_price_range },
                                                                                { label: 'PPSF', value: keyInsights.ppsf_benchmark },
                                                                                { label: 'Supply', value: keyInsights.months_of_supply },
                                                                                { label: 'DOM', value: keyInsights.dom_range },
                                                                            ].filter(m => m.value && m.value !== 'N/A').map((m, i) => (
                                                                                <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                                    <div className="min-w-0">
                                                                                        <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{m.label}</div>
                                                                                        <div className="text-[13px] font-normal text-slate-800 leading-snug">{m.value}</div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        {keyInsights.risk_tags && keyInsights.risk_tags.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1.5 mt-3">
                                                                                {keyInsights.risk_tags.slice(0, 3).map((tag, i) => (
                                                                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 border border-rose-100 rounded-lg text-[11px] font-semibold text-rose-600">
                                                                                        <i className="fa-solid fa-triangle-exclamation text-[9px] opacity-50"></i>
                                                                                        {tag}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Long Term Rental */}
                                                        {ltrAnalysis && (ltrAnalysis.monthly_rent || ltrAnalysis.vacancy_rate) && (
                                                            <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                                                                                <i className="fa-solid fa-house-circle-check text-emerald-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Long Term Rental</span>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            {ltrAnalysis.monthly_rent && (
                                                                                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                                    <i className="fa-solid fa-dollar-sign text-[10px] text-emerald-400"></i>
                                                                                    <div className="min-w-0">
                                                                                        <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Monthly Rent</div>
                                                                                        <div className="text-[13px] font-normal text-slate-800 leading-snug">{ltrAnalysis.monthly_rent}</div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {ltrAnalysis.vacancy_rate && (
                                                                                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                                    <i className="fa-solid fa-chart-pie text-[10px] text-slate-300"></i>
                                                                                    <div className="min-w-0">
                                                                                        <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Vacancy Rate</div>
                                                                                        <div className="text-[13px] font-normal text-slate-800 leading-snug">{ltrAnalysis.vacancy_rate}</div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                    }


                                    {/* Street View + Ground Truth Engine — side by side */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                                        {propertyData.streetViewAnalysis && propertyData.streetViewAnalysis.isImageryAvailable !== false && (
                                            <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                                <StreetViewAnalysisSection
                                                    data={propertyData}
                                                    onRefresh={onRefreshEnvironment}
                                                    refreshing={environmentRefreshing}
                                                />
                                            </div>
                                        )}
                                        <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden bg-white p-4 flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                            {/* Ground Truth Engine intro */}
                                            <div className="flex items-center gap-3 bg-slate-50/50 rounded-xl border border-slate-100/80 px-4 py-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-shield-halved text-indigo-600 text-[11px]"></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[13px] font-black text-slate-900 uppercase tracking-[0.2em]">The Ground Truth Engine</div>
                                                    <p className="text-[13px] text-slate-700 leading-relaxed font-normal mt-0.5">
                                                        Zyphe's verification system cross-references active real estate listings against municipal and federal databases to detect discrepancies and structural risks before you invest.
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Parcel Map + Validation side by side */}
                                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 flex-1">
                                                <div className="lg:col-span-3 aspect-square flex flex-col">
                                                    {/* Tabs — only show if satellite image exists */}
                                                    {propertyData.satelliteImageUrl && (
                                                        <div className="flex items-center gap-1 mb-2">
                                                            <button
                                                                onClick={() => setGroundTruthMapTab('parcel')}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groundTruthMapTab === 'parcel'
                                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                    }`}
                                                            >
                                                                <i className="fa-solid fa-map text-[9px]"></i>
                                                                Parcel
                                                            </button>
                                                            <button
                                                                onClick={() => setGroundTruthMapTab('satellite')}
                                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groundTruthMapTab === 'satellite'
                                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                    }`}
                                                            >
                                                                <i className="fa-solid fa-satellite text-[9px]"></i>
                                                                Satellite
                                                            </button>
                                                        </div>
                                                    )}
                                                    {/* Map content */}
                                                    <div className="flex-1 min-h-0 relative">
                                                        {groundTruthMapTab === 'parcel' ? (
                                                            <StaticParcelMap data={propertyData} parcelPolygon={
                                                                propertyData.parcelPolygon && propertyData.parcelPolygon.length > 3
                                                                    ? propertyData.parcelPolygon.map((pt: any) =>
                                                                        Array.isArray(pt) ? pt : [pt.lon, pt.lat]
                                                                    )
                                                                    : undefined
                                                            } />
                                                        ) : (
                                                            <>
                                                                <div
                                                                    className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden h-full relative group cursor-pointer"
                                                                    onClick={() => setIsSatelliteExpanded(true)}
                                                                >
                                                                    <img
                                                                        src={propertyData.satelliteImageUrl}
                                                                        alt="Satellite View"
                                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                                                                    />
                                                                    <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100 z-10">
                                                                        Satellite View
                                                                    </div>
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
                                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                                                            <i className="fa-solid fa-expand text-slate-700 text-sm"></i>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Expanded Satellite Overlay */}
                                                                {isSatelliteExpanded && (
                                                                    <div
                                                                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300"
                                                                        onClick={() => setIsSatelliteExpanded(false)}
                                                                    >
                                                                        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl"></div>
                                                                        <div
                                                                            className="relative max-w-5xl w-full bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col"
                                                                            style={{ maxHeight: '90vh' }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <button
                                                                                onClick={() => setIsSatelliteExpanded(false)}
                                                                                className="absolute top-6 right-6 z-20 w-11 h-11 bg-white/90 backdrop-blur-sm text-slate-900 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-all border border-slate-100 active:scale-95"
                                                                            >
                                                                                <i className="fa-solid fa-xmark text-lg"></i>
                                                                            </button>

                                                                            {/* Top white border */}
                                                                            <div className="h-16 bg-white w-full flex-shrink-0" />

                                                                            <div className="flex-1 overflow-hidden bg-slate-50 flex items-center justify-center relative p-4">
                                                                                <img
                                                                                    src={propertyData.satelliteImageUrl}
                                                                                    alt="Expanded Satellite View"
                                                                                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-2xl"
                                                                                />
                                                                            </div>

                                                                            {/* Bottom white border */}
                                                                            <div className="h-16 bg-white w-full flex-shrink-0" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="lg:col-span-2 h-full bg-slate-50/50 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
                                                    <ParcelValidationCard propertyData={propertyData} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {propertyData.neighborhoodPlaces && (
                                        <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden">
                                            <NeighborhoodPlacesSection data={propertyData} visualPoi={visualPoi} mapLabels={mapLabels} mapZoomOut={propertyData.mapZoomOut} address={propertyData.address} neighborhoodOverview={neighborhoodOverview} hoaAmenities={propertyData.hoa?.amenities} />
                                        </div>
                                    )}

                                    {propertyData.resoFacts && (
                                        <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden">
                                            <PropertyFacts facts={propertyData.resoFacts} />
                                        </div>
                                    )}

                                    <ComplianceAttribution data={propertyData} />
                                </div>
                            </StickyNotesLayer>
                        )}

                        {activeTab === 'visual-ai' && (
                            <CustomAIAnalysis
                                analysis={customAnalysis}
                                loading={customAnalysisLoading}
                                onBack={() => setActiveTab('property-data')}
                                onRefresh={() => onRunCustomAnalysis(true)}
                                onFullRefresh={handleFullRefresh}
                                onRunComprehensive={() => { setActiveTab('comprehensive'); onRunComprehensive(false); }}
                                comprehensiveResult={comprehensiveAnalysis}
                                hasImages={(propertyData?.images?.length || 0) > 0}
                                userRole={userRole}
                                propertyImages={propertyData?.images}
                                zpid={propertyData?.zpid}
                                propertyData={propertyData}
                                onUpdateAnalysis={onUpdateAnalysis}
                                onUpdatePropertyData={onUpdatePropertyData}
                                addLog={addLog}
                                isFavorited={isFavorited}
                                onToggleFavorite={onToggleFavorite}
                                activeSubTab={activeSubTab}
                            />
                        )}

                        {activeTab === 'comprehensive' && (
                            <ComprehensiveAnalysis
                                analysis={comprehensiveAnalysis}
                                loading={comprehensiveLoading}
                                onBack={() => setActiveTab('visual-ai')}
                                isFavorited={isFavorited}
                                onToggleFavorite={onToggleFavorite}
                            />
                        )}
                    </>
                )}

                {!propertyData && !loading && (
                    <BrowseHomeSection searchBar={searchBar} setViewMode={setViewMode} />
                )}
            </div>

            {propertyData && (
                <ChatInterface property={propertyData} visual={customAnalysis} comprehensive={comprehensiveAnalysis} />
            )
            }
        </>
    );
};

/* ══════════════════════════════════════════════════════════════════
   Browse by City — self-contained section for the Explore home
   ══════════════════════════════════════════════════════════════════ */

const BROWSE_CITIES = ['Pleasanton', 'Dublin'] as const;

const BrowseHomeSection: React.FC<{ searchBar: React.ReactNode; setViewMode: any }> = ({ searchBar, setViewMode }) => {
    const [browseHasResults, setBrowseHasResults] = useState(false);

    return (
        <div className="w-full px-6 py-6 text-center space-y-8">
            {/* Search bar always centered at top */}
            {searchBar && (
                <div className="w-full max-w-2xl mx-auto">
                    {searchBar}
                </div>
            )}

            {/* Browse by City — controls + results */}
            <BrowseByCitySection
                onPropertyClick={(addr) => {
                    if (typeof (setViewMode as any) === 'function') {
                        (setViewMode as any)('explore', addr);
                    }
                }}
                onHasResults={setBrowseHasResults}
            />

            {!browseHasResults && (
                <>
                    <p className="text-2xl text-slate-500 font-medium leading-relaxed">The world's most advanced property analysis suite.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                        {[
                            { title: 'For Buyers', icon: 'fa-shopping-bag', desc: "Navigate the market with unmatched clarity. Our AI cross-references public records, maps and property pictures, and resident sentiment to uncover hidden structural risks, neighborhood, community pulse on what people like and don't, and score lifestyle compatibility for your family." },
                            { title: 'For Sellers', icon: 'fa-money-bill-trend-up', desc: 'Discover how to maximize your home value with AI-driven staging and market insights.' },
                            { title: 'For Realtors', icon: 'fa-briefcase', desc: 'Provide comprehensive home report, concierge chat box to your clients and track their preferences. Generate professional multi-source reports and compelling marketing copy in seconds.' }
                        ].map((item, i) => (
                            <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:-translate-y-2 transition-all group">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <i className={`fa-solid ${item.icon} text-2xl`}></i>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-4">{item.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed font-medium">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

const BUYER_STORY_EXAMPLES = [
    { title: 'Tech Couple, First Home', icon: 'fa-solid fa-laptop-code', story: "We're a dual-income tech couple (Google + Apple) in our early 30s, no kids yet. Budget $1.2-1.6M. We both work from home 3 days a week so need fast internet and 2 separate office spaces. Love cooking — a great kitchen is a must. Walkable dining and nightlife are important. Low maintenance yard preferred." },
    { title: 'Growing Family, Schools', icon: 'fa-solid fa-graduation-cap', story: "Family with 3 kids (ages 4, 7, 10). Top-rated schools are non-negotiable — need 8+ rated elementary and middle. Want 4+ bedrooms, big backyard for the kids, and a quiet cul-de-sac. Budget $1.5-2M. Neighborhood safety is critical. Would love a pool." },
    { title: 'Multi-Gen Living', icon: 'fa-solid fa-people-roof', story: "Indian family looking for multi-gen living. My parents will live with us — need a bedroom and bathroom on the ground floor, separate entrance preferred. East-facing (Vastu) is very important. 4+ beds, modern kitchen. Budget up to $2.5M. Good schools for our 2 teenagers." },
    { title: 'Investor — Cash Flow', icon: 'fa-solid fa-chart-line', story: "Real estate investor looking for properties with ADU potential or house-hacking opportunity. Prefer homes with separate entrances, guest houses, or large lots that allow ADU construction. Budget $1-1.8M. Strong rental demand area. Don't care about schools." },
    { title: 'Retiring, Single-Story', icon: 'fa-solid fa-couch', story: "We're in our 60s, downsizing from a 4-bedroom. Need single-story living — no stairs. 2-3 beds, 2+ baths. Low maintenance landscape (drought-tolerant preferred). Walking distance to medical facilities and parks. Budget $900K-1.3M. Quiet neighborhood." },
    { title: 'Outdoor Lifestyle', icon: 'fa-solid fa-person-hiking', story: "Active family of 4. Trail access and parks are our top priority. Need space for bikes, kayaks, RV parking if possible. Big garage or extra storage. Solar panels already installed would be great. Budget $1.4-1.9M. Don't mind fixer-uppers if the location is right." },
    { title: 'WFH Entrepreneur', icon: 'fa-solid fa-house-laptop', story: "I run an e-commerce business from home. Need a dedicated office or den plus extra garage/workshop space for inventory. Fast fiber internet is critical. Prefer newer construction with smart home features. 3+ beds for when family visits. Budget $1.1-1.5M. Don't need great schools." },
    { title: 'Safety-Conscious', icon: 'fa-solid fa-shield-halved', story: "Moving from out of state, very concerned about natural disasters. Low wildfire risk is #1 priority. Also want low flood and seismic risk. Prefer flat terrain, not hillside. Newer construction (2000+) for modern building codes. Good air quality. Budget $1.3-1.8M. Family with 2 young kids." },
    { title: 'Luxury Entertainer', icon: 'fa-solid fa-champagne-glasses', story: "We entertain frequently. Need a chef's kitchen, open floor plan, resort-style backyard with pool and outdoor kitchen. Views would be amazing — hills or valley. High-end finishes throughout. 5+ beds, 4+ baths. Don't mind higher HOA if the community is gated. Budget $2.5M+." },
    { title: 'First-Time, Value', icon: 'fa-solid fa-piggy-bank', story: "First-time buyer, single income software engineer. Budget is tight: $800K-1.1M. Looking for best value — maybe a fixer with renovation upside. Townhomes OK. Need at least 2 beds. Close to BART or highway for commute to SF. Walkable to grocery and coffee shops. Low HOA preferred." },
];

const BrowseByCitySection: React.FC<{ onPropertyClick: (address: string) => void; onHasResults?: (has: boolean) => void }> = ({ onPropertyClick, onHasResults }) => {
    const [selectedCity, setSelectedCity] = useState<string>('');
    const [browsing, setBrowsing] = useState(false);
    const [results, setResults] = useState<CityPropertySummary[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // View, sort, filter, pagination state
    const [viewMode, setViewModeLocal] = useState<'zypheai' | 'gallery' | 'table'>('gallery');
    const [sortField, setSortField] = useState<'address' | 'listPrice' | 'bedrooms' | 'bathrooms' | 'livingArea'>('address');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [filterMinPrice, setFilterMinPrice] = useState('');
    const [filterMaxPrice, setFilterMaxPrice] = useState('');
    const [filterBeds, setFilterBeds] = useState('');
    const [filterBaths, setFilterBaths] = useState('');
    const [filterNeighborhood, setFilterNeighborhood] = useState('');
    const [page, setPage] = useState(1);
    const PER_PAGE = 20;

    // Listen for browse-city events from the search bar Browse button
    useEffect(() => {
        const handler = (e: Event) => {
            const city = (e as CustomEvent).detail?.city;
            if (city && typeof city === 'string') {
                setSelectedCity(city);
                // Auto-trigger browse after state update
                setTimeout(async () => {
                    setBrowsing(true);
                    setHasSearched(true);
                    setPage(1);
                    try {
                        const data = await getPropertiesByCity(city);
                        setResults(data);
                    } catch (err) {
                        console.error('Browse by city failed:', err);
                        setResults([]);
                    } finally {
                        setBrowsing(false);
                    }
                }, 100);
            }
        };
        window.addEventListener('browse-city', handler);
        return () => window.removeEventListener('browse-city', handler);
    }, []);

    // Factor ID → Name lookup (Firestore stores {i, t} without names)
    const FACTOR_NAMES: Record<number, string> = {
        1: 'Price', 2: 'HOA', 4: 'Carrying Cost', 5: 'Seller Motivation', 6: 'ADU Potential', 7: 'STR', 8: 'Rental Yield', 9: 'Appreciation',
        14: 'Sqft', 17: 'Home Office', 19: 'Foundation', 20: 'Construction Era', 21: 'Move-In Ready', 22: 'Renovation Upside',
        23: 'Architecture', 24: 'Natural Light', 25: 'Open Concept', 26: 'Kitchen', 27: 'Bathroom', 28: 'Flooring', 29: 'Ceilings', 30: 'Finishes',
        31: 'Fenced Yard', 32: 'Outdoor Entertainment', 33: 'Privacy', 34: 'Curb Appeal', 35: 'Topography', 36: 'View', 37: 'Street Noise',
        38: 'Visual Clutter', 39: 'Yard Space', 40: 'Low Maintenance', 41: 'Exterior Style', 42: 'Commute', 43: 'Walkability', 44: 'Greenery', 45: 'Sidewalks',
        46: 'Fire Risk', 47: 'Flood Risk', 48: 'Solar', 49: 'Pollen', 50: 'HVAC', 51: 'Orientation/Vastu', 52: 'Air Quality', 54: 'Slope',
        57: 'WFH Score', 58: 'Multi-Gen', 59: 'Laundry', 60: 'Water/Air Systems', 61: 'Security', 62: 'Presentation',
        64: 'Job Hubs', 65: 'Dev Impact', 66: 'Soil/Geo', 67: 'Luxury Finishes', 68: 'Backyard Potential', 69: 'Streetscape', 70: 'Market Momentum',
        71: 'Development', 72: 'Complaints', 73: 'Satisfaction', 74: 'Safety', 75: 'Market Velocity', 76: 'Internet', 77: 'Noise', 78: 'Drought', 79: 'Disasters',
        80: 'Professional Fit', 81: 'Family Fit', 82: 'Senior Fit', 83: 'Neighborhood', 84: 'Walkable Amenities', 85: 'Medical', 86: 'EV Infrastructure',
        87: 'Pet Friendly', 88: 'Dining Scene', 89: 'Market Signals', 90: 'Growth Catalysts', 91: 'Investment Risk', 92: 'Market Friction', 93: 'Zoning',
        94: 'Street Character', 95: 'Curbside Risks', 96: 'Landscaping', 97: 'Parking', 98: 'Neighborhood Condition',
        100: 'Agent Highlights', 101: 'Schools', 102: 'Sentiment', 103: 'Market Narrative', 104: 'Condition', 105: 'Convenience',
        106: 'Seismic', 107: 'Flood Zone', 108: 'Sqft Discrepancy', 109: 'Lot Verification', 110: 'Listing Flags', 111: 'Distressed Signal',
        113: 'Room Character', 114: 'Interior Vibe', 115: 'Materials', 116: 'Layout', 120: 'Amenities Profile', 112: 'FEMA'
    };

    // Buyer Story Search
    const [buyerStory, setBuyerStory] = useState('');
    const [buyerSearching, setBuyerSearching] = useState(false);
    const [buyerResults, setBuyerResults] = useState<{ zpid: string; address: string; score: number; reasons: string[]; misses: string[]; highlight: string }[] | null>(null);
    const [showBuyerSearch, setShowBuyerSearch] = useState(false);
    const [buyerError, setBuyerError] = useState<string | null>(null);
    const [buyerExtracted, setBuyerExtracted] = useState<{ priceMin: number; priceMax: number; beds?: number; baths?: number; homeType?: string; mustHaves: string[]; niceToHaves: string[] } | null>(null);
    const [showExamples, setShowExamples] = useState(false);
    const [sliderIdx, setSliderIdx] = useState(0);
    const [buyerTimings, setBuyerTimings] = useState<{ step: string; ms: number; detail?: string }[] | null>(null);

    // City Neighborhood Mining state
    const [mining, setMining] = useState(false);
    const [miningStatus, setMiningStatus] = useState<string>('');
    const [cachedNeighborhoodCount, setCachedNeighborhoodCount] = useState<number | null>(null);

    const handleBrowse = async (city?: string) => {
        const target = city || selectedCity;
        if (!target) return;
        if (city) setSelectedCity(city);
        setBrowsing(true);
        setHasSearched(true);
        setPage(1);
        try {
            const data = await getPropertiesByCity(target);
            setResults(data);
        } catch (e) {
            console.error('Browse by city failed:', e);
            setResults([]);
        } finally {
            setBrowsing(false);
        }
    };

    // Check if neighborhoods are already cached when city changes
    useEffect(() => {
        if (!selectedCity) { setCachedNeighborhoodCount(null); return; }
        (async () => {
            try {
                const { generateCityStateKey } = await import('../../services/firebase/config');
                const { getCityNeighborhoodsFromCloud } = await import('../../services/firebase/properties');
                const key = generateCityStateKey(selectedCity, 'CA');
                if (!key) return;
                const cached = await getCityNeighborhoodsFromCloud(key);
                setCachedNeighborhoodCount(cached?.neighborhoods?.length || 0);
            } catch { setCachedNeighborhoodCount(null); }
        })();
    }, [selectedCity]);

    const handleMineNeighborhoods = async () => {
        if (!selectedCity || mining) return;
        setMining(true);
        setMiningStatus('Starting neighborhood mining...');
        try {
            const { mineCityNeighborhoods } = await import('../../services/geminiService');
            const result = await mineCityNeighborhoods(
                selectedCity,
                'CA',
                'admin',
                (msg) => setMiningStatus(msg)
            );
            const count = result.data?.neighborhoods?.length || 0;
            setCachedNeighborhoodCount(count);
            setMiningStatus(`✓ Mined ${count} neighborhoods for ${selectedCity}`);
        } catch (err: any) {
            setMiningStatus(`✗ Failed: ${err.message}`);
        } finally {
            setMining(false);
        }
    };

    // Available neighborhoods for filter dropdown
    const availableNeighborhoods = useMemo(() => {
        const hoods = new Set<string>();
        results.forEach(p => { if (p.neighborhood) hoods.add(p.neighborhood); });
        return Array.from(hoods).sort();
    }, [results]);

    // Filtered + sorted flat list
    const processed = useMemo(() => {
        let list = [...results];
        // Filters
        const minP = filterMinPrice ? parseFloat(filterMinPrice) : 0;
        const maxP = filterMaxPrice ? parseFloat(filterMaxPrice) : Infinity;
        const minBeds = filterBeds ? parseInt(filterBeds) : 0;
        const minBaths = filterBaths ? parseInt(filterBaths) : 0;
        if (minP > 0) list = list.filter(p => (p.listPrice || 0) >= minP);
        if (maxP < Infinity) list = list.filter(p => (p.listPrice || 0) <= maxP);
        if (minBeds > 0) list = list.filter(p => (p.bedrooms || 0) >= minBeds);
        if (minBaths > 0) list = list.filter(p => (p.bathrooms || 0) >= minBaths);
        if (filterNeighborhood) list = list.filter(p => p.neighborhood === filterNeighborhood);
        // Sort
        list.sort((a, b) => {
            const av = a[sortField] ?? '';
            const bv = b[sortField] ?? '';
            if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === 'asc' ? (Number(av) - Number(bv)) : (Number(bv) - Number(av));
        });
        return list;
    }, [results, sortField, sortDir, filterMinPrice, filterMaxPrice, filterBeds, filterBaths, filterNeighborhood]);

    // Notify parent about results state
    useEffect(() => {
        onHasResults?.(results.length > 0);
    }, [results.length, onHasResults]);

    // Build match lookup from buyer results
    const matchMap = useMemo(() => {
        const map: Record<string, { score: number; reasons: string[]; highlight: string; rank: number }> = {};
        buyerResults?.forEach((m, i) => { map[m.zpid] = { score: m.score, reasons: m.reasons, highlight: m.highlight, rank: i + 1 }; });
        return map;
    }, [buyerResults]);

    // When buyer results exist, reorder: matched first (by score desc), then rest
    const displayList = useMemo(() => {
        if (!buyerResults || buyerResults.length === 0) return processed;
        // Only show matched properties when AI search is active
        return buyerResults
            .map(m => processed.find(p => p.zpid === m.zpid))
            .filter(Boolean) as typeof processed;
    }, [processed, buyerResults]);

    const totalPages = Math.ceil(displayList.length / PER_PAGE);
    const pageItems = displayList.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    // Tooltip state for hover
    const [hoveredZpid, setHoveredZpid] = useState<string | null>(null);

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
        setPage(1);
    };

    const sortIcon = (field: typeof sortField) => {
        if (sortField !== field) return 'fa-sort text-slate-300';
        return sortDir === 'asc' ? 'fa-sort-up text-indigo-600' : 'fa-sort-down text-indigo-600';
    };

    const fmt = (n?: number) => n ? `$${n.toLocaleString()}` : '—';

    const handleBuyerSearch = async () => {
        if (!buyerStory.trim() || results.length === 0) return;
        setBuyerSearching(true);
        setBuyerResults(null);
        setBuyerError(null);
        setBuyerExtracted(null);
        setBuyerTimings(null);
        const timings: { step: string; ms: number; detail?: string }[] = [];

        try {
            const { executeGeminiRequest } = await import('../../services/geminiService');
            const { Type } = await import('@google/genai');
            const { auth } = await import('../../services/firebase/config');

            // ── STEP 0: Extract structured attributes via Gemini Flash Lite ──
            const t0 = performance.now();
            const { FLASH_LITE_MODEL } = await import('../../services/geminiService');
            const extractionPrompt = `Extract from: "${buyerStory}"
Prices→dollars($1M=1000000). beds/baths→minimums. home_type→SINGLE_FAMILY|TOWNHOUSE|CONDO|"".
must_haves→requirements with "need","must","require","no stairs". nice_to_haves→preferences with "prefer","would be great","if possible".`;

            type ExtResult = { price_min: number; price_max: number; beds: number; baths: number; home_type: string; must_haves: string[]; nice_to_haves: string[] };
            const extractionSchema = {
                type: Type.OBJECT,
                properties: {
                    price_min: { type: Type.NUMBER },
                    price_max: { type: Type.NUMBER },
                    beds: { type: Type.NUMBER },
                    baths: { type: Type.NUMBER },
                    home_type: { type: Type.STRING },
                    must_haves: { type: Type.ARRAY, items: { type: Type.STRING } },
                    nice_to_haves: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['price_min', 'price_max', 'beds', 'baths', 'home_type', 'must_haves', 'nice_to_haves']
            };

            const extractResult = await executeGeminiRequest<ExtResult>({
                model: FLASH_LITE_MODEL,
                contents: extractionPrompt,
                config: { temperature: 0.1, maxOutputTokens: 512 },
                userId: auth.currentUser?.uid || 'anon',
                promptFilename: 'buyerStoryExtraction',
                extractResultJson: true,
                schema: extractionSchema
            });
            timings.push({ step: 'Gemini Extract', ms: Math.round(performance.now() - t0), detail: `model: ${FLASH_LITE_MODEL}` });

            const ext = extractResult.data;
            if (!ext || (ext.price_min === 0 && ext.price_max === 0)) {
                setBuyerError('Please mention a budget or price range in your story. For example: "Budget is $1.5M" or "Looking for homes up to $2M".');
                setBuyerSearching(false);
                return;
            }

            // Build final price range — only compute ±20% when one bound is missing
            let priceMin = ext.price_min;
            let priceMax = ext.price_max;
            if (priceMin > 0 && priceMax > 0 && priceMin === priceMax) {
                // "around X" case: expand ±15%
                priceMin = priceMin * 0.85;
                priceMax = priceMax * 1.15;
            } else if (priceMin > 0 && priceMax === 0) {
                // Only lower bound: expand +20%
                priceMax = priceMin * 1.2;
            } else if (priceMax > 0 && priceMin === 0) {
                // Only upper bound: expand -20%
                priceMin = priceMax * 0.8;
            }
            // else: both bounds specified — use as-is

            // Build search tags from must_haves + nice_to_haves for local ranking
            const searchTags = [...(ext.must_haves || []), ...(ext.nice_to_haves || [])].map(t => t.toLowerCase().trim());

            const extracted = {
                priceMin, priceMax,
                beds: ext.beds > 0 ? ext.beds : undefined,
                baths: ext.baths > 0 ? ext.baths : undefined,
                homeType: ext.home_type || undefined,
                mustHaves: ext.must_haves || [],
                niceToHaves: ext.nice_to_haves || []
            };
            setBuyerExtracted(extracted);

            // ── STEP 1: Query Firestore directly with server-side filters ──
            // Single round trip: city + price range + beds + baths filtered at Firestore level
            const t1 = performance.now();
            const cityForQuery = selectedCity || results[0]?.city || '';
            if (!cityForQuery) {
                setBuyerError('No city selected. Please browse a city first.');
                setBuyerSearching(false);
                return;
            }

            const { queryContextGraphs } = await import('../../services/firebase/properties');
            const graphMap = await queryContextGraphs({
                city: cityForQuery,
                priceMin: priceMin > 0 ? priceMin : undefined,
                priceMax: priceMax > 0 ? priceMax : undefined,
                minBeds: extracted.beds,
                minBaths: extracted.baths,
                maxResults: 50
            });

            if (graphMap.size === 0) {
                setBuyerError(`No context graphs found matching criteria (${fmt(priceMin)}–${fmt(priceMax)}, ${extracted.beds || 'any'}+ beds in ${cityForQuery}). Run "Context Graphs" batch first from City Data.`);
                setBuyerSearching(false);
                return;
            }
            timings.push({ step: `Firestore (${graphMap.size} docs)`, ms: Math.round(performance.now() - t1) });

            // ── STEP 1b: Rank by search_tags + numeric_filters ──
            const t1b = performance.now();
            const MAX = 20;
            let graphEntries = Array.from(graphMap.entries()).map(([zpid, graph]) => {
                let score = 0;
                const searchText = [
                    graph.summary?.propertyHighlight || '',
                    ...(graph.summary?.topStrengths || []),
                    ...(graph.factors || []).flatMap((f: any) => (f.tags || f.t || []).map(String))
                ].join(' ').toLowerCase();

                // Must-have tag matches (weight: 3 points each)
                for (const tag of searchTags) {
                    if (searchText.includes(tag)) score += 3;
                }


                return { zpid, graph, score };
            });

            // Sort by score, take top N
            graphEntries.sort((a, b) => b.score - a.score);
            graphEntries = graphEntries.slice(0, MAX);

            const graphs: { zpid: string; address: string; graph: any; listing: any }[] = graphEntries
                .filter(e => e.graph?.factors?.length > 0)
                .filter(e => hasEssentialData(e.graph))
                .map(e => ({
                    zpid: e.zpid,
                    address: e.graph.address || e.zpid,
                    graph: e.graph,
                    listing: {
                        price: e.graph.price || e.graph.keyMetrics?.price,
                        beds: e.graph.beds || e.graph.keyMetrics?.beds,
                        baths: e.graph.baths || e.graph.keyMetrics?.baths,
                        sqft: e.graph.sqft || e.graph.keyMetrics?.sqft,
                    }
                }));

            if (graphs.length === 0) {
                setBuyerError('No context graphs found for matching properties. Run "Context Graphs" batch first from City Data.');
                setBuyerSearching(false);
                return;
            }
            timings.push({ step: `Rank (${graphs.length} kept)`, ms: Math.round(performance.now() - t1b) });

            // ── STEP 3: Parallel Gemini matching (chunked) ──
            const t3 = performance.now();


            const CHUNK_SIZE = 5;
            const chunks: typeof graphs[] = [];
            for (let i = 0; i < graphs.length; i += CHUNK_SIZE) {
                chunks.push(graphs.slice(i, i + CHUNK_SIZE));
            }

            // Warmup: high-temperature flush to prime Gemini backend
            await executeGeminiRequest<any>({
                model: FLASH_LITE_MODEL,
                contents: 'Say hi',
                config: { temperature: 2.0, maxOutputTokens: 1 },
                userId: auth.currentUser?.uid || 'anon',
                promptFilename: 'warmup',
                skipWatchdog: true
            }).catch(() => { }); // ignore errors

            const schema = {
                type: Type.OBJECT,
                properties: {
                    matches: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                zpid: { type: Type.STRING },
                                score: { type: Type.NUMBER },
                                reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
                                misses: { type: Type.ARRAY, items: { type: Type.STRING } },
                                highlight: { type: Type.STRING }
                            },
                            required: ['zpid', 'score', 'reasons', 'misses', 'highlight']
                        }
                    }
                },
                required: ['matches']
            };

            // Fire all chunks in parallel
            const chunkPromises = chunks.map((chunk, idx) => {
                const summaries = chunk.map(g => {
                    // Lean format: ["Factor Name: tag1, tag2", ...] — flat strings, minimal tokens
                    const rawFactors = g.graph.factors || [];
                    const factors: string[] = [];
                    for (const f of rawFactors) {
                        const tags = (f.tags || f.t || [])
                            .filter((t: string) => t && !t.includes('Data Not Available') && !t.includes('Estimated'));
                        if (tags.length > 0) {
                            const id = f.id ?? f.i;
                            const name = f.name || FACTOR_NAMES[id] || `F${id}`;
                            factors.push(`${name}: ${tags.join(', ')}`);
                        }
                    }
                    return {
                        zpid: g.zpid, address: g.address,
                        summary: g.graph.summary,
                        keyMetrics: g.graph.keyMetrics,
                        factors
                    };
                });

                console.log(`[Buyer Match] Chunk ${idx + 1}/${chunks.length}:`, summaries.map(s => ({ zpid: s.zpid, factorCount: Object.keys(s.factors).length, hasKeyMetrics: !!s.keyMetrics, hasSummary: !!s.summary })));
                const mustHavesList = (extracted.mustHaves || []).map((m, i) => `${i + 1}. ${m}`).join('\n');
                const niceToHavesList = (extracted.niceToHaves || []).map((n, i) => `${i + 1}. ${n}`).join('\n');
                const prompt = `Score each property 0-100 against the buyer story.

## BUYER STORY
${buyerStory}

## MUST-HAVES (weight heavily, earlier = more important)
${mustHavesList || 'None specified'}

## NICE-TO-HAVES (lower weight, earlier = more important)
${niceToHavesList || 'None specified'}

## PROPERTIES (${summaries.length})
${JSON.stringify(summaries)}

## INSTRUCTIONS
- score: 0-100 match quality
- Must-haves weigh 3× more than nice-to-haves
- Earlier items in each list are more important than later ones
- reasons: the facts about what MATCHES
- misses: buyer criteria this property does NOT satisfy. Empty array if none.
- highlight: one sentence summary
- Neutral tone. Return ALL ${summaries.length} properties.`;

                return executeGeminiRequest<{ matches: { zpid: string; score: number; reasons: string[]; misses: string[]; highlight: string }[] }>({
                    model: FLASH_LITE_MODEL,
                    contents: prompt,
                    config: { temperature: 0.3, maxOutputTokens: 4096 },
                    userId: auth.currentUser?.uid || 'anon',
                    promptFilename: 'buyerStorySearch',
                    extractResultJson: true,
                    schema
                });
            });

            const chunkResults = await Promise.all(chunkPromises);

            // Merge all matches from all chunks, sort by score
            const zpidToAddr: Record<string, string> = {};
            graphs.forEach(g => { zpidToAddr[g.zpid] = g.address; });

            const allMatches = chunkResults
                .flatMap(r => r.data?.matches || [])
                .map(m => ({ ...m, address: zpidToAddr[m.zpid] || m.zpid }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);

            timings.push({ step: `Gemini ×${chunks.length}`, ms: Math.round(performance.now() - t3), detail: `${allMatches.length} matches` });
            const totalMs = timings.reduce((s, t) => s + t.ms, 0);
            timings.push({ step: 'TOTAL', ms: totalMs });
            setBuyerTimings(timings);

            if (allMatches.length > 0) {
                setBuyerResults(allMatches);
                setSliderIdx(0);
            }
        } catch (err: any) {
            console.error('[Buyer Search]', err);
            setBuyerError(`Search failed: ${err.message}`);
        } finally {
            setBuyerSearching(false);
        }
    };

    return (
        <div className="text-left">
            {/* Controls row */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Browse:</span>
                {BROWSE_CITIES.map((c, i) => (
                    <span key={c} className="flex items-center gap-2">
                        {i > 0 && <span className="text-slate-300">|</span>}
                        <button
                            onClick={() => { setPage(1); handleBrowse(c); }}
                            disabled={browsing}
                            className={`text-sm font-bold transition-all ${browsing && selectedCity === c
                                ? 'text-indigo-400 cursor-wait'
                                : selectedCity === c && results.length > 0
                                    ? 'text-indigo-700 underline underline-offset-4'
                                    : 'text-indigo-600 hover:text-indigo-800 hover:underline underline-offset-4'
                                }`}
                        >
                            {browsing && selectedCity === c ? (
                                <><i className="fa-solid fa-spinner animate-spin mr-1"></i>{c}</>
                            ) : c}
                        </button>
                    </span>
                ))}
            </div>

            {/* Results area */}
            {browsing && (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                </div>
            )}

            {!browsing && hasSearched && results.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 mt-6">
                    <i className="fa-solid fa-house-circle-xmark text-4xl text-slate-200 mb-3"></i>
                    <p className="text-sm font-bold text-slate-400">No properties found in {selectedCity}</p>
                </div>
            )}

            {!browsing && results.length > 0 && (
                <div className="mt-6 space-y-4">
                    {/* Toolbar: view toggle, filters, sort, count */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* View toggle */}
                        <div className="flex bg-slate-100 rounded-xl p-1">
                            <button
                                onClick={() => { setViewModeLocal('zypheai'); setShowBuyerSearch(true); }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'zypheai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <i className="fa-solid fa-wand-magic-sparkles mr-1"></i> ZypheAI
                            </button>
                            <button
                                onClick={() => setViewModeLocal('gallery')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'gallery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <i className="fa-solid fa-grid-2 mr-1"></i> Gallery
                            </button>
                            <button
                                onClick={() => setViewModeLocal('table')}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <i className="fa-solid fa-table-list mr-1"></i> Table
                            </button>
                        </div>

                        {/* Sort */}
                        <select
                            value={`${sortField}-${sortDir}`}
                            onChange={e => {
                                const [f, d] = e.target.value.split('-') as [typeof sortField, 'asc' | 'desc'];
                                setSortField(f); setSortDir(d); setPage(1);
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none cursor-pointer"
                        >
                            <option value="address-asc">Address A→Z</option>
                            <option value="address-desc">Address Z→A</option>
                            <option value="listPrice-asc">Price Low→High</option>
                            <option value="listPrice-desc">Price High→Low</option>
                            <option value="bedrooms-desc">Beds Most→Least</option>
                            <option value="bathrooms-desc">Baths Most→Least</option>
                            <option value="livingArea-desc">Sqft Largest</option>
                            <option value="livingArea-asc">Sqft Smallest</option>
                        </select>

                        {/* Filters */}
                        <input
                            type="number"
                            placeholder="Min $"
                            value={filterMinPrice}
                            onChange={e => { setFilterMinPrice(e.target.value); setPage(1); }}
                            className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-300"
                        />
                        <input
                            type="number"
                            placeholder="Max $"
                            value={filterMaxPrice}
                            onChange={e => { setFilterMaxPrice(e.target.value); setPage(1); }}
                            className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none placeholder:text-slate-300"
                        />
                        <select
                            value={filterBeds}
                            onChange={e => { setFilterBeds(e.target.value); setPage(1); }}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none cursor-pointer"
                        >
                            <option value="">Beds</option>
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+ bd</option>)}
                        </select>
                        <select
                            value={filterBaths}
                            onChange={e => { setFilterBaths(e.target.value); setPage(1); }}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none cursor-pointer"
                        >
                            <option value="">Baths</option>
                            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+ ba</option>)}
                        </select>
                        {availableNeighborhoods.length > 0 && (
                            <select
                                value={filterNeighborhood}
                                onChange={e => { setFilterNeighborhood(e.target.value); setPage(1); }}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 outline-none cursor-pointer max-w-[160px]"
                            >
                                <option value="">Neighborhood</option>
                                {availableNeighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        )}

                        {/* Count */}
                        <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {displayList.length} {displayList.length === 1 ? 'property' : 'properties'}
                            {displayList.length !== results.length && ` (of ${results.length})`}
                        </span>


                    </div>

                    {/* ── BUYER STORY SEARCH PANEL (ZypheAI mode only) ── */}
                    {viewMode === 'zypheai' && showBuyerSearch && (
                        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-magnifying-glass-location text-indigo-500"></i>
                                <span className="text-sm font-black text-indigo-800">Tell Your Story</span>
                                <button
                                    onClick={() => setShowExamples(!showExamples)}
                                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-1"
                                >
                                    <i className={`fa-solid ${showExamples ? 'fa-chevron-up' : 'fa-lightbulb'} text-[9px]`}></i>
                                    {showExamples ? 'Hide' : 'Examples'}
                                </button>
                                <span className="text-[10px] font-bold text-indigo-400 ml-auto">AI extracts filters from your story · Max 20 properties</span>
                            </div>

                            {/* Examples Grid */}
                            {showExamples && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {BUYER_STORY_EXAMPLES.map((ex, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setBuyerStory(ex.story); setShowExamples(false); setBuyerError(null); }}
                                            className="text-left bg-white border border-indigo-100 hover:border-indigo-300 hover:shadow-md rounded-xl p-3 transition-all group"
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <i className={`${ex.icon} text-[10px] text-indigo-400 group-hover:text-indigo-600`}></i>
                                                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">{ex.title}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{ex.story}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <textarea
                                value={buyerStory}
                                onChange={e => { setBuyerStory(e.target.value); setBuyerError(null); }}
                                placeholder="Example: I'm a tech worker at Google with 2 young kids. We need good schools, a home office, and a big backyard. Budget is $1.5M. Low wildfire risk is important."
                                className="w-full h-24 p-3 bg-white border border-indigo-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 outline-none resize-none"
                            />
                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    onClick={handleBuyerSearch}
                                    disabled={buyerSearching || !buyerStory.trim() || results.length === 0}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {buyerSearching ? (
                                        <><i className="fa-solid fa-spinner animate-spin"></i>Analyzing story &amp; matching...</>
                                    ) : (
                                        <><i className="fa-solid fa-wand-magic-sparkles"></i>Find My Match</>
                                    )}
                                </button>
                                {buyerResults && (
                                    <>
                                        <span className="text-xs font-bold text-indigo-600">{buyerResults.length} matches — results sorted below</span>
                                        <button onClick={() => { setBuyerResults(null); setBuyerExtracted(null); }} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors ml-1">
                                            <i className="fa-solid fa-xmark"></i> Clear
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Error */}
                            {buyerError && (
                                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                                    <i className="fa-solid fa-circle-exclamation text-rose-500 mt-0.5"></i>
                                    <p className="text-xs font-bold text-rose-700">{buyerError}</p>
                                </div>
                            )}

                            {/* Extracted criteria */}
                            {buyerExtracted && !buyerError && (
                                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                    <span className="font-bold text-slate-500 uppercase tracking-wider">AI Extracted:</span>
                                    <span className="font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                                        {fmt(buyerExtracted.priceMin)}–{fmt(buyerExtracted.priceMax)}
                                    </span>
                                    {buyerExtracted.beds && (
                                        <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{buyerExtracted.beds}+ beds</span>
                                    )}
                                    {buyerExtracted.baths && (
                                        <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{buyerExtracted.baths}+ baths</span>
                                    )}
                                    {buyerExtracted.homeType && (
                                        <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{buyerExtracted.homeType.replace(/_/g, ' ')}</span>
                                    )}
                                    {buyerExtracted.singleStory && (
                                        <span className="font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">⚡ single story</span>
                                    )}
                                    {buyerExtracted.mustHaves.map((mh, i) => (
                                        <span key={`mh-${i}`} className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">{mh}</span>
                                    ))}
                                    {buyerExtracted.niceToHaves.map((nth, i) => (
                                        <span key={`nth-${i}`} className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">{nth}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── STEP TIMINGS ── */}
                    {buyerTimings && (
                        <div className="flex flex-wrap items-center gap-2 text-[10px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                            <span className="font-black text-slate-500 uppercase tracking-wider mr-1">
                                <i className="fa-solid fa-stopwatch text-teal-500 mr-1"></i>Pipeline:
                            </span>
                            {buyerTimings.map((t, i) => (
                                <span
                                    key={i}
                                    className={`font-bold px-2 py-0.5 rounded-md border ${t.step === 'TOTAL'
                                        ? t.ms < 5000
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black'
                                            : t.ms < 8000
                                                ? 'bg-amber-100 text-amber-800 border-amber-300 font-black'
                                                : 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                                        : 'bg-white text-slate-700 border-slate-200'
                                        }`}
                                    title={t.detail || ''}
                                >
                                    {t.step}: {t.ms < 1000 ? `${t.ms}ms` : `${(t.ms / 1000).toFixed(1)}s`}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* ── AI MATCH RESULTS (VERTICAL SCROLL) ── */}
                    {viewMode === 'zypheai' && buyerResults && buyerResults.length > 0 && (
                        <div className="space-y-3">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl px-5 py-3 flex items-center gap-3">
                                <i className="fa-solid fa-trophy text-amber-300"></i>
                                <span className="text-sm font-black text-white">AI Match Results</span>
                                <span className="text-[10px] font-bold text-indigo-200 ml-1">{buyerResults.length} matches</span>
                                <button
                                    onClick={() => { setBuyerResults(null); setBuyerExtracted(null); setSliderIdx(0); }}
                                    className="ml-auto text-[10px] font-bold text-indigo-200 hover:text-white transition-colors flex items-center gap-1"
                                >
                                    <i className="fa-solid fa-xmark"></i> Clear & Show All
                                </button>
                            </div>

                            {/* Scrollable results list */}
                            <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin' }}>
                                {buyerResults.map((match, idx) => {
                                    const prop = processed.find(p => p.zpid === match.zpid);
                                    if (!prop) return null;
                                    const img = prop.imgSrc || prop.images?.[0] || '';
                                    return (
                                        <div
                                            key={match.zpid}
                                            className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all overflow-hidden"
                                        >
                                            <div className="flex flex-col sm:flex-row">
                                                {/* Image */}
                                                {img && (
                                                    <div
                                                        className="sm:w-56 h-40 sm:h-auto flex-shrink-0 bg-cover bg-center cursor-pointer relative"
                                                        style={{ backgroundImage: `url(${img})`, minHeight: 160 }}
                                                        onClick={() => window.open(`/explore?q=${encodeURIComponent(match.address || prop.address)}`, '_blank')}
                                                    >
                                                        {/* Rank badge */}
                                                        <span className={`absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-lg shadow-md ${idx === 0 ? 'bg-amber-400 text-white' : idx < 3 ? 'bg-indigo-600 text-white' : 'bg-white/95 text-slate-600 border border-slate-200'
                                                            }`}>
                                                            #{idx + 1}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Content */}
                                                <div className="flex-1 p-4 space-y-3">
                                                    {/* Address + Score row */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <button
                                                                onClick={() => window.open(`/explore?q=${encodeURIComponent(match.address || prop.address)}`, '_blank')}
                                                                className="text-sm font-black text-slate-800 hover:text-indigo-600 transition-colors text-left"
                                                            >
                                                                {prop.address}
                                                            </button>
                                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                {prop.listPrice && <span className="text-sm font-black text-emerald-600">{fmt(prop.listPrice)}</span>}
                                                                {prop.bedrooms && <span className="text-[11px] text-slate-500 font-bold">{prop.bedrooms} bd</span>}
                                                                {prop.bathrooms && <span className="text-[11px] text-slate-500 font-bold">{prop.bathrooms} ba</span>}
                                                                {prop.livingArea && <span className="text-[11px] text-slate-500 font-bold">{prop.livingArea.toLocaleString()} sqft</span>}
                                                            </div>
                                                        </div>
                                                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${match.score >= 80 ? 'bg-emerald-50 border border-emerald-200' : match.score >= 60 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}>
                                                            <span className={`text-lg font-black ${match.score >= 80 ? 'text-emerald-600' : match.score >= 60 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                                {match.score}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Highlight */}
                                                    <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 italic leading-relaxed">
                                                        "{match.highlight}"
                                                    </p>

                                                    {/* Reasons */}
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {match.reasons.map((r, ri) => (
                                                            <span key={ri} className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-bold">
                                                                <i className="fa-solid fa-check text-[7px] text-emerald-500"></i>
                                                                {r}
                                                            </span>
                                                        ))}
                                                        {match.misses && match.misses.length > 0 && match.misses.map((m, mi) => (
                                                            <span key={`miss-${mi}`} className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-600 px-2 py-1 rounded-md text-[10px] font-bold">
                                                                <i className="fa-solid fa-xmark text-[7px] text-rose-400"></i>
                                                                {m}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── GALLERY VIEW ── */}
                    {viewMode === 'gallery' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {pageItems.map(prop => {
                                const match = matchMap[prop.zpid];
                                return (
                                    <div
                                        key={prop.zpid}
                                        className="relative"
                                        onMouseEnter={() => match && setHoveredZpid(prop.zpid)}
                                        onMouseLeave={() => setHoveredZpid(null)}
                                    >
                                        <button
                                            onClick={() => onPropertyClick(prop.address)}
                                            className={`group w-full bg-white rounded-2xl border transition-all text-left overflow-hidden ${match ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-md' : 'border-slate-100 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50'}`}
                                        >
                                            {/* Score badge overlay */}
                                            {match && (
                                                <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm ${match.rank === 1 ? 'bg-amber-400 text-white' : match.rank <= 3 ? 'bg-indigo-600 text-white' : 'bg-white/90 text-slate-600 border border-slate-200'}`}>
                                                        #{match.rank}
                                                    </span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm ${match.score >= 80 ? 'bg-emerald-500 text-white' : match.score >= 60 ? 'bg-amber-500 text-white' : 'bg-white/90 text-slate-600 border border-slate-200'}`}>
                                                        {match.score}
                                                    </span>
                                                </div>
                                            )}
                                            {prop.images?.[0] ? (
                                                <div className="h-28 bg-slate-100 overflow-hidden">
                                                    <img src={prop.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                                                </div>
                                            ) : (
                                                <div className="h-28 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                                    <i className="fa-solid fa-house text-2xl text-slate-300"></i>
                                                </div>
                                            )}
                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2 flex-1">
                                                        {prop.address}
                                                    </div>
                                                </div>
                                                {prop.neighborhood && (
                                                    <div className="mb-1.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{prop.neighborhood}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold flex-wrap">
                                                    {prop.listPrice && <span className="text-indigo-600 font-black">{fmt(prop.listPrice)}</span>}
                                                    {prop.bedrooms && <span>{prop.bedrooms} bd</span>}
                                                    {prop.bathrooms && <span>{prop.bathrooms} ba</span>}
                                                    {prop.livingArea && <span>{prop.livingArea.toLocaleString()} sqft</span>}
                                                    {prop.lotSize && <span>Lot {prop.lotSize}</span>}
                                                    {prop.homeType && <span>{prop.homeType.replace(/_/g, ' ')}</span>}
                                                </div>
                                            </div>
                                        </button>
                                        {/* Hover tooltip */}
                                        {match && hoveredZpid === prop.zpid && (
                                            <div className="absolute left-0 right-0 -bottom-2 translate-y-full z-20 bg-white border border-indigo-200 rounded-xl shadow-xl p-3 space-y-1.5 animate-in fade-in duration-150">
                                                <p className="text-[11px] text-indigo-600 font-semibold italic">&ldquo;{match.highlight}&rdquo;</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {match.reasons.map((r, i) => (
                                                        <span key={i} className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{r}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── TABLE VIEW ── */}
                    {viewMode === 'table' && (
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleSort('address')}>
                                            Address <i className={`fa-solid ${sortIcon('address')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-right" onClick={() => toggleSort('listPrice')}>
                                            Price <i className={`fa-solid ${sortIcon('listPrice')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-center" onClick={() => toggleSort('bedrooms')}>
                                            Beds <i className={`fa-solid ${sortIcon('bedrooms')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-center" onClick={() => toggleSort('bathrooms')}>
                                            Baths <i className={`fa-solid ${sortIcon('bathrooms')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors text-right" onClick={() => toggleSort('livingArea')}>
                                            Sq Ft <i className={`fa-solid ${sortIcon('livingArea')} ml-1`}></i>
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                                            Lot
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                                            Type
                                        </th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                                            Neighborhood
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageItems.map((prop, i) => {
                                        const match = matchMap[prop.zpid];
                                        return (
                                            <tr
                                                key={prop.zpid}
                                                onClick={() => onPropertyClick(prop.address)}
                                                onMouseEnter={() => match && setHoveredZpid(prop.zpid)}
                                                onMouseLeave={() => setHoveredZpid(null)}
                                                className={`cursor-pointer transition-colors relative ${match ? 'bg-indigo-50/40 hover:bg-indigo-50' : i % 2 === 0 ? 'bg-white hover:bg-indigo-50/50' : 'bg-slate-50/30 hover:bg-indigo-50/50'}`}
                                            >
                                                <td className="px-4 py-3 text-xs font-bold text-slate-900 hover:text-indigo-600 max-w-[320px] relative">
                                                    <div className="flex items-center gap-2">
                                                        {match && (
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 ${match.rank === 1 ? 'bg-amber-400 text-white' : match.rank <= 3 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                #{match.rank}
                                                            </span>
                                                        )}
                                                        <span className="truncate">{prop.address}</span>
                                                    </div>
                                                    {/* Hover tooltip for table row */}
                                                    {match && hoveredZpid === prop.zpid && (
                                                        <div className="absolute left-0 top-full z-30 w-[400px] bg-white border border-indigo-200 rounded-xl shadow-xl p-3 space-y-1.5 animate-in fade-in duration-150">
                                                            <p className="text-[11px] text-indigo-600 font-semibold italic">&ldquo;{match.highlight}&rdquo;</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {match.reasons.map((r, ri) => (
                                                                    <span key={ri} className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{r}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-black text-indigo-600 text-right">
                                                    {fmt(prop.listPrice)}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 text-center">
                                                    {prop.bedrooms || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 text-center">
                                                    {prop.bathrooms || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                                                    {prop.livingArea ? prop.livingArea.toLocaleString() : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-600 text-right">
                                                    {prop.lotSize || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-bold text-slate-400 text-center">
                                                    {prop.homeType || '—'}
                                                </td>
                                                {match ? (
                                                    <td className="px-4 py-3">
                                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${match.score >= 80 ? 'bg-emerald-100 text-emerald-700' : match.score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {match.score}/100
                                                        </span>
                                                    </td>
                                                ) : (
                                                    <td className="px-4 py-3 text-xs font-bold text-emerald-600">
                                                        {prop.neighborhood || '—'}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── PAGINATION ── */}
                    {totalPages > 1 && !buyerResults && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <i className="fa-solid fa-chevron-left"></i>
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                                .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis');
                                    acc.push(p);
                                    return acc;
                                }, [])
                                .map((p, i) =>
                                    p === 'ellipsis' ? (
                                        <span key={`e${i}`} className="text-xs text-slate-300 px-1">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${page === p
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ExploreTab;
