import React, { useState, useEffect, useRef, useMemo } from 'react';
import { setCurrentPage } from '../../../services/analytics/posthog';
import {
    CustomAIAnalysisResult,
    ComprehensiveAnalysisResult
} from '../../../types';

export type TabType = 'interior' | 'rooms' | 'exterior_and_neighborhood' | 'neighborhood' | 'schools' | 'pulse' | 'quality' | 'investment' | 'image_analysis' | 'deep_research' | 'context_graph';
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
    onToggleFavorite
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
        { id: 'deep_research', label: 'Investment Research', icon: 'fa-magnifying-glass-chart' },
        { id: 'investment', label: 'Property Economics', icon: 'fa-chart-pie' },
        { id: 'image_analysis', label: 'Image by Image analysis', icon: 'fa-images' },
        { id: 'quality', label: 'Picture Quality Audit', icon: 'fa-camera-rotate' },
        { id: 'context_graph', label: 'Context Graph', icon: 'fa-diagram-project' },
    ].filter(tab => allowedTabs.includes(tab.id)), [allowedTabs]);

    // Initialize activeTab to the first TRULY available tab, fallback to 'interior'
    const [activeTab, setActiveTab] = useState<TabType>((tabs[0]?.id as TabType) || 'interior');

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
            propertyData?.address
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
                        }
                    });
                }
            })
            .catch(e => console.warn('[Exterior] Auto satellite analysis failed:', e))
            .finally(() => setSatelliteLoading(false));
    }, [activeTab, orientationAI]);

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
        <div className="space-y-8 pb-20 relative">
            {/* Tabs */}
            <div className="flex flex-col items-end gap-3 px-1">
                {userRole === 'admin' && (
                    <button
                        onClick={onFullRefresh}
                        className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-all uppercase tracking-[0.2em] flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 shadow-sm sm:shadow-none"
                    >
                        <i className="fa-solid fa-sync text-[10px]"></i>
                        Full Refresh
                    </button>
                )}
                <div className="flex justify-center sm:justify-start w-full">
                    <div className="inline-flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-[13px] whitespace-nowrap ${activeTab === tab.id ? 'bg-gradient-to-r from-indigo-700 to-gray-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                            >
                                <i className={`fa-solid ${tab.icon} ${activeTab === tab.id ? 'text-white' : 'text-gray-400'}`}></i>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px] relative">
                <StickyNotesLayer zpid={zpid || ''} activeTab={activeTab}>
                    {activeTab === 'interior' && <InteriorView data={analysis.home_interior} />}
                    {activeTab === 'rooms' && <RoomsView highlights={analysis.room_highlights} />}
                    {activeTab === 'exterior_and_neighborhood' && (
                        <ExteriorView
                            data={analysis.exterior_and_neighborhood}
                            streetViewAnalysis={propertyData?.streetViewAnalysis}
                            satellitaryOrientation={orientationAI}
                            satelliteLoading={satelliteLoading}
                        />
                    )}
                    {activeTab === 'neighborhood' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-300">
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

                                                {/* Summary — full width at top */}
                                                <div className="px-4 pb-2">
                                                    {school.overall_assessment && (
                                                        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                                            <div className="text-[10px] font-black text-indigo-500 uppercase tracking-wider mb-1.5">Summary</div>
                                                            <p className="text-[13px] text-indigo-900 leading-relaxed font-medium">{school.overall_assessment}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Two-column grid */}
                                                <div className="px-4 pb-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* LEFT COLUMN: Academics */}
                                                        <div className="space-y-3">
                                                            {school.test_scores && (
                                                                <div className="p-3 bg-slate-50 rounded-xl">
                                                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Test Scores</div>
                                                                    <p className="text-[12px] text-slate-700 leading-relaxed">{school.test_scores}</p>
                                                                </div>
                                                            )}
                                                            {school.ap_ib_programs && school.ap_ib_programs !== 'N/A' && (
                                                                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/40">
                                                                    <div className="text-[10px] font-black text-indigo-500 uppercase tracking-wider mb-1.5">AP / IB Programs</div>
                                                                    <p className="text-[12px] text-slate-700 leading-relaxed">{school.ap_ib_programs}</p>
                                                                </div>
                                                            )}
                                                            {school.college_readiness && school.college_readiness !== 'N/A' && (
                                                                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/40">
                                                                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-wider mb-1.5">College Readiness</div>
                                                                    <p className="text-[12px] text-slate-700 leading-relaxed">{school.college_readiness}</p>
                                                                </div>
                                                            )}
                                                            {school.recent_news && (
                                                                <div className="p-3 bg-slate-50 rounded-xl">
                                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Recent News</div>
                                                                    <p className="text-[12px] text-slate-500 leading-relaxed italic">{school.recent_news}</p>
                                                                </div>
                                                            )}
                                                            {school.demographics_summary && (
                                                                <div className="p-3 bg-slate-50 rounded-xl">
                                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                                                                        <i className="fa-solid fa-users mr-1"></i>Demographics
                                                                    </div>
                                                                    <p className="text-[12px] text-slate-600 leading-relaxed">{school.demographics_summary}</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* RIGHT COLUMN: Community Voice */}
                                                        <div className="space-y-3">
                                                            {school.parent_sentiment_positive && (
                                                                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100/50">
                                                                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1.5">
                                                                        <i className="fa-solid fa-thumbs-up mr-1"></i>Parent Loves
                                                                    </div>
                                                                    <p className="text-[12px] text-emerald-800 leading-relaxed">{school.parent_sentiment_positive}</p>
                                                                </div>
                                                            )}
                                                            {school.parent_sentiment_concerns && (
                                                                <div className="p-3 bg-pink-50/60 rounded-xl border border-pink-100/50">
                                                                    <div className="text-[10px] font-black text-pink-600 uppercase tracking-wider mb-1.5">
                                                                        <i className="fa-solid fa-flag mr-1"></i>Parent Concerns
                                                                    </div>
                                                                    <p className="text-[12px] text-pink-800 leading-relaxed">{school.parent_sentiment_concerns}</p>
                                                                </div>
                                                            )}
                                                            {school.extracurriculars && (
                                                                <div className="p-3 bg-violet-50/40 rounded-xl border border-violet-100/40">
                                                                    <div className="text-[10px] font-black text-violet-500 uppercase tracking-wider mb-1.5">
                                                                        <i className="fa-solid fa-trophy mr-1"></i>Activities & Strengths
                                                                    </div>
                                                                    <p className="text-[12px] text-slate-700 leading-relaxed">{school.extracurriculars}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Sources — footer */}
                                                    {school.sources?.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
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
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                    {activeTab === 'quality' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
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
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {!analysis.image_by_image_analysis || analysis.image_by_image_analysis.length === 0 ? (
                                <EmptyState section="Image Analysis" />
                            ) : (
                                <ImageAnalysisView data={analysis.image_by_image_analysis} />
                            )}
                        </section>
                    )}
                    {activeTab === 'context_graph' && (
                        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
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
