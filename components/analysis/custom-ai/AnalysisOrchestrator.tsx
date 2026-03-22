import React, { useState, useEffect, useRef, useMemo } from 'react';
import { setCurrentPage } from '../../../services/analytics/posthog';
import {
    CustomAIAnalysisResult,
    ComprehensiveAnalysisResult
} from '../../../types';

export type TabType = 'interior' | 'rooms' | 'exterior_and_neighborhood' | 'neighborhood' | 'schools' | 'pulse' | 'city_neighborhoods' | 'quality' | 'investment' | 'image_analysis' | 'deep_research' | 'context_graph';
import { APP_CONFIG } from '../../../config';
import { useAnalysisActions } from './hooks/useAnalysisActions';
import { EmptyState } from './components/CommonComponents';
import { InvestmentView } from './components/InvestmentView';

import { QualityAnalysisView } from './components/QualityAnalysisView';
import { CommunityPulseView } from './components/CommunityPulseView';
import { DeepInvestmentView } from './components/DeepInvestmentView';
import { ImageAnalysisView } from './components/ImageAnalysisView';
import { InteriorView, RoomsView, ExteriorView } from './components/InteriorExteriorViews';
import { NeighborhoodView } from './components/NeighborhoodView';
import { AnalysisLoading, GeneralAnalysisLoading } from './components/AnalysisLoading';
import { HoverPreview } from './components/HoverPreview';
import { ContextGraphView } from './components/ContextGraphView';
import { StickyNotesLayer } from './components/StickyNotesLayer';
import SatellitaryView from './components/SatellitaryView';
import { CityNeighborhoodsView } from './components/CityNeighborhoodsView';

import { VastuCard } from '../../property/VastuCard';
import { runSatellitaryAnalysis } from '../../../services/satellitaryService';

interface Props {
    analysis: CustomAIAnalysisResult | null;
    loading: boolean;
    onBack: () => void;
    onRefresh: () => void;
    onFullRefresh?: () => void;
    onRunComprehensive: () => void;
    comprehensiveResult: ComprehensiveAnalysisResult | null;
    mapUrl?: string;
    hasImages: boolean;
    userRole?: string;
    propertyImages?: string[];
    zpid?: string;
    propertyData?: any;
    onUpdateAnalysis: (updated: CustomAIAnalysisResult) => void;
    onUpdatePropertyData?: (updatedFields: any) => void;
    addLog: (service: string, meta: { type: 'request' | 'response' | 'error' | 'info' }, content: any, usage?: any) => void;
    isFavorited?: boolean;
    onToggleFavorite?: () => void;
    activeSubTab?: string;
}

const AnalysisOrchestrator: React.FC<Props> = ({
    analysis,
    loading,
    onBack,
    onRefresh,
    onFullRefresh,
    onRunComprehensive,
    comprehensiveResult,
    mapUrl,
    hasImages,
    userRole,
    propertyImages = [],
    zpid,
    propertyData,
    onUpdateAnalysis,
    onUpdatePropertyData,
    addLog,
    isFavorited,
    onToggleFavorite,
    activeSubTab
}) => {
    const role = (userRole as 'buyer' | 'seller' | 'realtor' | 'investor' | 'auditor') || 'buyer';
    const allowedTabs = (APP_CONFIG as any).roleTabs[role] || (APP_CONFIG as any).roleTabs.buyer;

    // Live-patched orientation_ai — starts from Firestore cache, updated when Satellitary tab runs
    const [orientationAI, setOrientationAI] = React.useState<any>(propertyData?.orientation_ai ?? null);

    // Keep in sync if propertyData changes (e.g. navigating to a different property)
    React.useEffect(() => {
        setOrientationAI(propertyData?.orientation_ai ?? null);
    }, [propertyData?.orientation_ai]);



    // Memoize the available tabs objects to avoid unnecessary re-renders and ensure stable first-tab lookup
    const tabs = useMemo(() => [
        { id: 'interior', label: 'Interior', icon: 'fa-couch' },
        { id: 'rooms', label: 'Rooms', icon: 'fa-star' },
        { id: 'exterior_and_neighborhood', label: 'Exterior', icon: 'fa-house' },
        { id: 'neighborhood', label: 'Neighborhood', icon: 'fa-map-location-dot' },
        { id: 'schools', label: 'Schools', icon: 'fa-graduation-cap' },
        { id: 'pulse', label: 'Community Pulse', icon: 'fa-users-viewfinder' },
        { id: 'city_neighborhoods', label: 'City Neighborhoods', icon: 'fa-mountain-city' },
        { id: 'deep_research', label: 'Investment Research', icon: 'fa-magnifying-glass-chart' },
        { id: 'investment', label: 'Property Economics', icon: 'fa-chart-pie' },
        { id: 'image_analysis', label: 'Image by Image analysis', icon: 'fa-images' },
        { id: 'quality', label: 'Picture Quality Audit', icon: 'fa-camera-rotate' },
        { id: 'context_graph', label: 'Context Graph', icon: 'fa-diagram-project' },
    ].filter(tab => allowedTabs.includes(tab.id)), [allowedTabs]);

    // Initialize activeTab to the first TRULY available tab, fallback to 'interior'
    const [activeTab, setActiveTab] = useState<TabType>((activeSubTab as TabType) || (tabs[0]?.id as TabType) || 'interior');

    // Sync internal tab with parent's activeSubTab prop
    React.useEffect(() => {
        if (activeSubTab && tabs.find(t => t.id === activeSubTab)) {
            setActiveTab(activeSubTab as TabType);
        }
    }, [activeSubTab, tabs]);

    // Schools intelligence state
    const [schoolsData, setSchoolsData] = useState<any>(null);
    const [activeSchoolIdx, setActiveSchoolIdx] = useState<number>(0);

    // Load schools from per-school cache when propertyData changes
    useEffect(() => {
        setSchoolsData(null);
        setActiveSchoolIdx(0);
        const loadSchools = async () => {
            const schools = propertyData?.schools;
            const city = propertyData?.city;
            const state = propertyData?.state;
            if (!schools?.length || !city) return;
            try {
                const { getSchoolAnalysisFromCloud } = await import('../../../services/firebase/properties');
                const { getSchoolCacheKey } = await import('../../../prompts/property/schoolsAnalysis');
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
                    setSchoolsData({ schools: results, district_name: results[0]?.district_name || '' });
                }
            } catch (_) { /* optional */ }
        };
        loadSchools();
    }, [propertyData?.zpid]);

    // Keep activeTab in sync if role/tabs change and current tab becomes invalid
    useEffect(() => {
        if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
            setActiveTab(tabs[0].id as TabType);
        }
    }, [tabs, activeTab]);

    // Update PostHog super properties with the deepest sub-tab
    useEffect(() => {
        const tabLabel = tabs.find(t => t.id === activeTab)?.label || activeTab;
        setCurrentPage(activeTab, `Explore > ${tabLabel}`);
    }, [activeTab, tabs]);

    // Auto-run satellite analysis when Exterior tab is active and no orientation_ai cached
    const [satelliteLoading, setSatelliteLoading] = React.useState(false);
    const satelliteTriggeredRef = React.useRef(false);

    React.useEffect(() => {
        // Run if: no orientation data at all, OR orientation_ai exists but is missing orientation_highlights (stale cache)
        const isMissingData = !orientationAI;
        const isStaleCache = orientationAI && !orientationAI.orientation_highlights;

        const shouldAutoRun =
            activeTab === 'exterior_and_neighborhood' &&
            (isMissingData || isStaleCache) &&
            !satelliteLoading &&
            !satelliteTriggeredRef.current &&
            propertyData?.coordinates?.latitude &&
            propertyData?.coordinates?.longitude;

        if (!shouldAutoRun) return;

        satelliteTriggeredRef.current = true;
        setSatelliteLoading(true);

        runSatellitaryAnalysis(
            propertyData.coordinates.latitude,
            propertyData.coordinates.longitude,
            propertyData?.streetViewAnalysis?.imageUrl || propertyData?.streetView || null,
            'unknown',
            zpid || undefined,
            propertyData?.address,
            propertyData?.description ?? null
        )
            .then(res => {
                setOrientationAI({
                    final_orientation: res.final_orientation,
                    azimuth_degrees: res.azimuth_degrees,
                    confidence: res.confidence,
                    aerial_only_mode: res.aerial_only_mode,
                    image_quality: res.image_quality,
                    feng_shui_vastu: res.feng_shui_vastu ?? null,
                    privacy_insight: res.privacy_insight,
                    lot_coverage_hardscape: res.lot_coverage_hardscape,
                    lot_coverage_pervious: res.lot_coverage_pervious,
                    buyer_pro: res.buyer_pro,
                    buyer_con: res.buyer_con,
                    orientation_highlights: res.orientation_highlights,
                    pool_visible: res.pool_visible ?? null,
                    pool_direction: res.pool_direction ?? null,
                    garage_direction: res.garage_direction ?? null,
                    open_sky_direction: res.open_sky_direction ?? null,
                });
                if (onUpdatePropertyData) {
                    onUpdatePropertyData({
                        orientation_ai: {
                            final_orientation: res.final_orientation,
                            azimuth_degrees: res.azimuth_degrees,
                            confidence: res.confidence,
                            aerial_only_mode: res.aerial_only_mode,
                            image_quality: res.image_quality,
                            feng_shui_vastu: res.feng_shui_vastu ?? null,
                            privacy_insight: res.privacy_insight,
                            lot_coverage_hardscape: res.lot_coverage_hardscape,
                            lot_coverage_pervious: res.lot_coverage_pervious,
                            buyer_pro: res.buyer_pro,
                            buyer_con: res.buyer_con,
                            orientation_highlights: res.orientation_highlights,
                            pool_visible: res.pool_visible ?? null,
                            pool_direction: res.pool_direction ?? null,
                            garage_direction: res.garage_direction ?? null,
                            open_sky_direction: res.open_sky_direction ?? null,
                        }
                    });
                }
            })
            .catch(e => console.warn('[Exterior] Auto satellite analysis failed:', e))
            .finally(() => setSatelliteLoading(false));
    }, [activeTab, orientationAI]);

    // Manual re-trigger: clear the guard + clear cached result + re-run immediately
    const refreshOrientation = React.useCallback(() => {
        if (satelliteLoading) return;
        satelliteTriggeredRef.current = false;   // clear guard
        setOrientationAI(null);                  // clear display → triggers useEffect
    }, [satelliteLoading]);

    // Hover preview state
    const [hoveredImage, setHoveredImage] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const previewTimerRef = useRef<number | null>(null);

    const {
        timer,
        qualityLoading,
        investmentLoading,

        pulseLoading,
        deepLoading,
        handleRunQualityAnalysis,
        handleRunCommunityPulse,
        handleRunInvestmentResearch,

        handleRunDeepInvestmentResearch,
        handleExtractContextGraph,
        handleReExtractContextGraph,
        graphLoading,
        graphResult,
        neighborhoodLoading,
        handleRunNeighborhoodAnalysis
    } = useAnalysisActions(analysis, zpid, propertyData, propertyImages, onUpdateAnalysis, addLog, loading, comprehensiveResult);

    // Auto-trigger side effects when tabs change
    useEffect(() => {
        if (activeTab === 'quality' && !analysis?.image_quality_analysis && !qualityLoading && propertyImages.length > 0) {
            handleRunQualityAnalysis();
        }
    }, [activeTab, analysis?.image_quality_analysis, qualityLoading, propertyImages.length]);

    useEffect(() => {
        if (activeTab === 'investment' && (!analysis?.property_investment || !analysis?.general_market_intelligence) && !investmentLoading) {
            handleRunInvestmentResearch();
        }
    }, [activeTab, analysis?.property_investment, analysis?.general_market_intelligence, investmentLoading]);

    useEffect(() => {
        if (activeTab === 'pulse' && !analysis?.community_pulse && !pulseLoading) {
            handleRunCommunityPulse();
        }
    }, [activeTab, analysis?.community_pulse, pulseLoading]);

    // Deep Research is NOT auto-triggered — data must be pre-populated via "City Research" in the ingestion tab.
    // useEffect removed intentionally.



    useEffect(() => {
        if (activeTab === 'context_graph' && !graphResult && !graphLoading) {
            handleExtractContextGraph();
        }
    }, [activeTab, graphResult, graphLoading]);

    useEffect(() => {
        if (activeTab === 'neighborhood' && !analysis?.neighborhood && !neighborhoodLoading) {
            handleRunNeighborhoodAnalysis();
        }
    }, [activeTab, analysis?.neighborhood, neighborhoodLoading]);

    const clearPreviewTimer = () => {
        if (previewTimerRef.current) {
            window.clearTimeout(previewTimerRef.current);
            previewTimerRef.current = null;
        }
    };

    const hidePreviewImmediately = () => {
        clearPreviewTimer();
        setHoveredImage(null);
    };

    const onThumbnailMouseEnter = (image: string, e: React.MouseEvent) => {
        clearPreviewTimer();
        setHoveredImage(image);
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    if (loading) return <GeneralAnalysisLoading timer={timer} />;
    if (!analysis) return null;


    return (
        <div className="pb-20 relative">
            {/* Content Area */}
            <div className="min-h-[500px] relative max-w-6xl mx-auto">
                <StickyNotesLayer zpid={zpid || ''} activeTab={activeTab}>
                    {activeTab === 'interior' && <InteriorView data={analysis.home_interior} />}
                    {activeTab === 'rooms' && <RoomsView highlights={analysis.room_highlights} />}
                    {activeTab === 'exterior_and_neighborhood' && (
                        <>
                            <ExteriorView
                                data={analysis.exterior_and_neighborhood}
                                streetViewAnalysis={propertyData?.streetViewAnalysis}
                                satellitaryOrientation={orientationAI}
                                satelliteLoading={satelliteLoading}
                                onRefreshOrientation={refreshOrientation}
                            />

                            {/* Vastu Analysis — bottom of exterior tab */}
                            {orientationAI?.azimuth_degrees != null && (
                                <div className="mt-4">
                                    <VastuCard
                                        azimuth_degrees={orientationAI.azimuth_degrees}
                                        final_orientation={orientationAI.final_orientation !== 'UNCLEAR_IMAGE' ? orientationAI.final_orientation : null}
                                        onRefresh={refreshOrientation}
                                        refreshing={satelliteLoading}
                                        pool_visible={orientationAI.pool_visible ?? null}
                                        pool_direction={orientationAI.pool_direction ?? null}
                                        garage_direction={orientationAI.garage_direction ?? null}
                                        open_sky_direction={orientationAI.open_sky_direction ?? null}
                                    />
                                </div>
                            )}
                        </>
                    )}
                    {activeTab === 'neighborhood' && (
                        <section>
                            {neighborhoodLoading ? (
                                <AnalysisLoading title="Spatial Intelligence..." subtitle="Decoding maps & local venues." timer={timer} address={propertyData?.address} icon="fa-map-location-dot" />
                            ) : !analysis.neighborhood ? (
                                <EmptyState section="Neighborhood" />
                            ) : (
                                <NeighborhoodView
                                    data={analysis.neighborhood}
                                    mapZoomIn={propertyData?.mapZoomIn}
                                    mapZoomOut={propertyData?.mapZoomOut}
                                    propertyData={propertyData}
                                    onRefresh={handleRunNeighborhoodAnalysis}
                                    isRefreshing={neighborhoodLoading}
                                    timer={timer}
                                />
                            )}
                        </section>
                    )}
                    {activeTab === 'schools' && (
                        <section>
                            {!schoolsData?.schools?.length ? (
                                <EmptyState section="Schools" />
                            ) : (
                                <div className="space-y-4">
                                    {/* District header */}
                                    {schoolsData.district_name && (
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                                <i className="fa-solid fa-graduation-cap text-blue-600"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Schools Intelligence</h3>
                                                <p className="text-sm text-slate-400">{schoolsData.district_name} · {schoolsData.schools.length} schools analyzed</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* School tabs row */}
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {schoolsData.schools.map((school: any, idx: number) => {
                                            const isActive = activeSchoolIdx === idx;
                                            const ratingNum = parseFloat(String(school.mls_rating)) || 0;
                                            const ratingColor = ratingNum >= 7 ? 'emerald' : ratingNum >= 5 ? 'amber' : 'rose';
                                            const levelIcon = school.level?.toLowerCase()?.includes('element') ? 'fa-child' :
                                                school.level?.toLowerCase()?.includes('middle') ? 'fa-school' : 'fa-building-columns';
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveSchoolIdx(idx)}
                                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-left whitespace-nowrap transition-all flex-shrink-0 ${
                                                        isActive
                                                            ? 'bg-white shadow-md border border-slate-200 ring-1 ring-indigo-100'
                                                            : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <i className={`fa-solid ${levelIcon} text-[11px] ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}></i>
                                                    <div>
                                                        <div className={`text-[12px] font-bold ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>{school.name}</div>
                                                        <div className="text-[10px] text-slate-400">{school.grades_served}</div>
                                                    </div>
                                                    {school.mls_rating && (
                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ml-1 bg-${ratingColor}-100 text-${ratingColor}-700`}>
                                                            {school.mls_rating}/10
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Active school content */}
                                    {(() => {
                                        const school = schoolsData.schools[activeSchoolIdx];
                                        if (!school) return null;
                                        return (
                                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                                {/* Stat pills row */}
                                                <div className="flex flex-wrap gap-2 px-4 pt-4 pb-3">
                                                    {school.enrollment && (
                                                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                                                            Enrollment: {school.enrollment?.toLocaleString()}
                                                        </span>
                                                    )}
                                                    {school.student_teacher_ratio && (
                                                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                                                            Ratio: {school.student_teacher_ratio}
                                                        </span>
                                                    )}
                                                    {school.graduation_rate && school.graduation_rate !== 'N/A' && (
                                                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                                                            Graduation: {school.graduation_rate}
                                                        </span>
                                                    )}
                                                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full capitalize">
                                                        {school.type || 'Public'}
                                                    </span>
                                                </div>

                                                {/* Card grid — rooms pattern */}
                                                <div className="px-4 pb-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                                        {school.overall_assessment && (
                                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col col-span-full">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-clipboard-check text-lg"></i>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Summary</h4>
                                                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{school.overall_assessment}</p>
                                                            </div>
                                                        )}
                                                        {school.test_scores && (
                                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-chart-line text-lg"></i>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Test Scores</h4>
                                                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{school.test_scores}</p>
                                                            </div>
                                                        )}
                                                        {school.ap_ib_programs && school.ap_ib_programs !== 'N/A' && (
                                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-award text-lg"></i>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">AP / IB Programs</h4>
                                                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{school.ap_ib_programs}</p>
                                                            </div>
                                                        )}
                                                        {school.college_readiness && school.college_readiness !== 'N/A' && (
                                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-user-graduate text-lg"></i>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">College Readiness</h4>
                                                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{school.college_readiness}</p>
                                                            </div>
                                                        )}
                                                        {school.parent_sentiment_positive && (
                                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-thumbs-up text-lg"></i>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Parent Loves</h4>
                                                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{school.parent_sentiment_positive}</p>
                                                            </div>
                                                        )}
                                                        {school.parent_sentiment_concerns && (
                                                            <div className="bg-rose-50/60 p-6 rounded-2xl border border-rose-200/60 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-500 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-flag text-lg"></i>
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-rose-500 bg-rose-100 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                                                                        <i className="fa-solid fa-flag text-[9px]"></i>Flag
                                                                    </span>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Parent Concerns</h4>
                                                                <p className="text-rose-900/80 font-sans font-normal text-[13px] leading-relaxed">{school.parent_sentiment_concerns}</p>
                                                            </div>
                                                        )}
                                                        {school.extracurriculars && (
                                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-trophy text-lg"></i>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Activities & Strengths</h4>
                                                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{school.extracurriculars}</p>
                                                            </div>
                                                        )}
                                                        {school.demographics_summary && (
                                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-users text-lg"></i>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Demographics</h4>
                                                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{school.demographics_summary}</p>
                                                            </div>
                                                        )}
                                                        {school.recent_news && (
                                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                <div className="flex justify-between items-start mb-4">
                                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                                        <i className="fa-solid fa-newspaper text-lg"></i>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Recent News</h4>
                                                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed italic">{school.recent_news}</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Sources — footer */}
                                                    {school.sources?.length > 0 && (
                                                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Sources:</span>
                                                            {school.sources.map((src: any, sIdx: number) => {
                                                                const domain = (() => { try { return new URL(src.url).hostname.replace('www.', ''); } catch { return src.title || src.url; }})();
                                                                return (
                                                                    <a key={sIdx} href={src.url} target="_blank" rel="noopener noreferrer"
                                                                        className="text-[10px] text-blue-500 hover:text-blue-700 underline decoration-dotted underline-offset-2 transition-colors"
                                                                        title={src.title || src.url}
                                                                    >
                                                                        {src.title || domain}
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </section>
                    )}
                    {activeTab === 'pulse' && (
                        <section>
                            {pulseLoading ? (
                                <AnalysisLoading title="Social Sentiment..." subtitle="Aggregating neighborhood insights." timer={timer} address={propertyData?.address} icon="fa-users-viewfinder" />
                            ) : !analysis.community_pulse ? (
                                <EmptyState section="Community Pulse" />
                            ) : (
                                <CommunityPulseView
                                    data={analysis.community_pulse}
                                    onRefresh={() => handleRunCommunityPulse(true)}
                                    isRefreshing={pulseLoading}
                                    userRole={userRole}
                                />
                            )}
                        </section>
                    )}
                    {activeTab === 'city_neighborhoods' && (
                        <section>
                            <CityNeighborhoodsView propertyData={propertyData} />
                        </section>
                    )}
                    {activeTab === 'quality' && (
                        <section>
                            {qualityLoading ? (
                                <AnalysisLoading title="Picture Audit..." timer={timer} address={propertyData?.address} icon="fa-camera" />
                            ) : !analysis.image_quality_analysis ? (
                                <EmptyState section="Quality Audit" />
                            ) : (
                                <QualityAnalysisView
                                    data={analysis.image_quality_analysis}
                                    propertyImages={propertyImages}
                                    onMouseEnter={onThumbnailMouseEnter}
                                    onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
                                    onMouseLeave={hidePreviewImmediately}
                                />
                            )}
                        </section>
                    )}
                    {activeTab === 'investment' && (
                        <section>
                            {investmentLoading ? (
                                <AnalysisLoading title="Market Research..." subtitle="Scouring STR data and historicals." timer={timer} address={propertyData?.address} icon="fa-magnifying-glass-dollar" />
                            ) : (!analysis.property_investment) ? (
                                <EmptyState section="Investment Research" />
                            ) : (
                                <InvestmentView specific={analysis.property_investment} deepResearch={analysis.deep_investment_research} />
                            )}
                        </section>
                    )}
                    {activeTab === 'deep_research' && (
                        <section>
                            {deepLoading ? (
                                <AnalysisLoading title="Running Deep Research..." subtitle="Analyzing macroeconomic indicators, market dynamics, and pro-forma." timer={timer} address={propertyData?.address} icon="fa-microscope" />
                            ) : !analysis.deep_investment_research ? (
                                <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
                                        <i className="fa-solid fa-microscope text-2xl text-violet-300"></i>
                                    </div>
                                    <div>
                                        <p className="text-slate-800 font-black text-lg tracking-tight">City Research Not Available</p>
                                        <p className="text-slate-400 text-sm mt-1 max-w-xs">
                                            Deep Investment Research for this city hasn't been run yet.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleRunDeepInvestmentResearch(true)}
                                        className="px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-play text-xs"></i>
                                        Run Deep Research
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex justify-end mb-3">
                                        <button
                                            onClick={() => handleRunDeepInvestmentResearch(true)}
                                            className="px-3 py-1.5 text-[11px] font-bold text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors flex items-center gap-1.5"
                                        >
                                            <i className="fa-solid fa-rotate text-[10px]"></i>
                                            Re-run
                                        </button>
                                    </div>
                                    <DeepInvestmentView data={analysis.deep_investment_research} />
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === 'image_analysis' && (
                        <section>
                            {!analysis.image_by_image_analysis || analysis.image_by_image_analysis.length === 0 ? (
                                <EmptyState section="Image Analysis" />
                            ) : (
                                <ImageAnalysisView data={analysis.image_by_image_analysis} />
                            )}
                        </section>
                    )}
                    {activeTab === 'context_graph' && (
                        <section>
                            {graphLoading ? (
                                <AnalysisLoading title="Extracting Context Factors..." subtitle="Analyzing dimensions." timer={timer} address={propertyData?.address} icon="fa-diagram-project" />
                            ) : (
                                <ContextGraphView
                                    data={graphResult!}
                                    loading={graphLoading}
                                    onExtract={handleReExtractContextGraph}
                                />
                            )}
                        </section>
                    )}
                </StickyNotesLayer>
            </div>

            <HoverPreview
                hoveredImage={hoveredImage}
                mousePos={mousePos}
                onMouseEnter={clearPreviewTimer}
                onMouseLeave={hidePreviewImmediately}
                onClose={() => setHoveredImage(null)}
            />

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default AnalysisOrchestrator;
