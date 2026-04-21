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
import { isTargetForOrientationAnalysis } from '../../../utils/propertyPolicies';

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
    onTabChange?: (tabId: TabType) => void;
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
    activeSubTab,
    onTabChange
}) => {
    const role = (userRole as 'buyer' | 'seller' | 'realtor' | 'investor' | 'auditor') || 'buyer';
    const allowedTabs = (APP_CONFIG as any).roleTabs[role] || (APP_CONFIG as any).roleTabs.buyer;

    // Stable ref for onTabChange — prevents the PostHog useEffect from re-running
    // every time the parent re-renders with a new inline arrow function reference.
    const onTabChangeRef = useRef(onTabChange);
    useEffect(() => { onTabChangeRef.current = onTabChange; }, [onTabChange]);

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
                const { generateCityStateKey } = await import('../../../services/firebase/config');
                const results: any[] = [];
                const orchestratorCityStateKey = generateCityStateKey(city, state || '');
                for (const school of schools) {
                    const cacheKey = getSchoolCacheKey(school.name, city, state || '');
                    const cached = orchestratorCityStateKey
                        ? await getSchoolAnalysisFromCloud(cacheKey, orchestratorCityStateKey)
                        : null;
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

    // Update PostHog super properties with the deepest sub-tab.
    // Uses a ref for onTabChange to avoid the infinite loop caused by inline arrow
    // function props (new reference on every parent render → effect re-fires → loop).
    useEffect(() => {
        const tabLabel = tabs.find(t => t.id === activeTab)?.label || activeTab;
        setCurrentPage(activeTab, `Explore > ${tabLabel}`);
        // Synchronize with parent so it's sticky across refreshes/re-renders
        onTabChangeRef.current?.(activeTab);
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

// ── School Details expandable sub-section ───────────────────────────────────

    if (loading) return <GeneralAnalysisLoading timer={timer} />;
    if (!analysis) return null;


    return (
        <div className="pb-20 relative">
            {/* Content Area */}
            <div className="min-h-[500px] relative max-w-6xl mx-auto">
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
                                        propertyData={propertyData}
                                    />

                                    {/* Vastu Analysis — bottom of exterior tab */}
                                    {isTargetForOrientationAnalysis(propertyData).target && orientationAI?.azimuth_degrees != null && (
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
                                    ) : (() => {
                                        const school = schoolsData.schools[activeSchoolIdx];
                                        return (
                                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                                {/* School tabs — horizontal */}
                                                <div className="flex gap-2 overflow-x-auto px-4 pt-4 pb-3 border-b border-slate-100">
                                                    {schoolsData.schools.map((s: any, i: number) => {
                                                        const isSelected = activeSchoolIdx === i;
                                                        const ratingNum = parseFloat(String(s.mls_rating)) || 0;
                                                        const levelIcon = s.level?.toLowerCase()?.includes('element') ? 'fa-child' :
                                                            s.level?.toLowerCase()?.includes('middle') ? 'fa-school' : 'fa-building-columns';
                                                        return (
                                                            <button
                                                                key={i}
                                                                onClick={() => setActiveSchoolIdx(i)}
                                                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border whitespace-nowrap flex-shrink-0 transition-all ${
                                                                    isSelected
                                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                                                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                                                }`}
                                                            >
                                                                <i className={`fa-solid ${levelIcon} text-[11px] ${isSelected ? 'text-white/70' : 'text-slate-300'}`} />
                                                                <div className="text-left">
                                                                    <span className="text-[12px] font-black block">{s.name}</span>
                                                                    {s.grades_served && (
                                                                        <span className={`text-[10px] ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>{s.grades_served}</span>
                                                                    )}
                                                                </div>
                                                                {s.mls_rating && (
                                                                    <div className={`px-2 py-0.5 rounded-md text-[10px] font-black ml-1 ${
                                                                        isSelected
                                                                            ? 'bg-emerald-400 text-slate-900'
                                                                            : ratingNum >= 7 ? 'bg-emerald-50 text-emerald-600' : ratingNum >= 5 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                                                    }`}>
                                                                        {s.mls_rating}/10
                                                                    </div>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                {/* Selected school content — always visible */}
                                                {school && (
                                                    <div className="p-4 space-y-4">
                                                        {/* Summary */}
                                                        {school.overall_assessment && (
                                                            <p className="text-[14px] text-slate-600 leading-relaxed font-medium">
                                                                {school.overall_assessment}
                                                            </p>
                                                        )}

                                                        {/* Stat pills */}
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {school.enrollment && (
                                                                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">Enrollment: {school.enrollment?.toLocaleString()}</span>
                                                            )}
                                                            {school.student_teacher_ratio && (
                                                                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">Ratio: {school.student_teacher_ratio}</span>
                                                            )}
                                                            {school.graduation_rate && school.graduation_rate !== 'N/A' && (
                                                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">Graduation: {school.graduation_rate}</span>
                                                            )}
                                                            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full capitalize">{school.type || 'Public'}</span>
                                                        </div>

                                                        {/* Test scores */}
                                                        {school.test_scores && (
                                                            <div>
                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Test Scores</div>
                                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{school.test_scores}</p>
                                                            </div>
                                                        )}

                                                        {/* Parent loves & concerns */}
                                                        {(school.parent_sentiment_positive || school.parent_sentiment_concerns) && (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {school.parent_sentiment_positive && (
                                                                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
                                                                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                                            <i className="fa-solid fa-thumbs-up text-[9px]" /> Parent Loves
                                                                        </div>
                                                                        <p className="text-[12px] text-emerald-800 leading-relaxed font-medium">{school.parent_sentiment_positive}</p>
                                                                    </div>
                                                                )}
                                                                {school.parent_sentiment_concerns && (
                                                                    <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100">
                                                                        <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                                            <i className="fa-solid fa-flag text-[9px]" /> Parent Concerns
                                                                        </div>
                                                                        <p className="text-[12px] text-rose-700 leading-relaxed font-medium">{school.parent_sentiment_concerns}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Activities */}
                                                        {school.extracurriculars && (
                                                            <div>
                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                                    <i className="fa-solid fa-trophy text-[9px] text-amber-400" /> Activities &amp; Strengths
                                                                </div>
                                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{school.extracurriculars}</p>
                                                            </div>
                                                        )}

                                                        {/* Recent news */}
                                                        {school.recent_news && (
                                                            <div>
                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Recent News</div>
                                                                <p className="text-[13px] text-slate-500 leading-relaxed italic font-medium">{school.recent_news}</p>
                                                            </div>
                                                        )}

                                                        {/* Demographics */}
                                                        {school.demographics_summary && (
                                                            <div>
                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                                    <i className="fa-solid fa-users text-[9px] text-indigo-400" /> Demographics
                                                                </div>
                                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{school.demographics_summary}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Sources */}
                                                {school?.sources?.length > 0 && (
                                                    <div className="px-5 py-3 border-t border-slate-50 flex flex-wrap items-center gap-1.5">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Sources:</span>
                                                        {school.sources.map((src: any, sIdx: number) => {
                                                            const domain = (() => { try { return new URL(src.url).hostname.replace('www.', ''); } catch { return src.title || src.url; } })();
                                                            return (
                                                                <a key={sIdx} href={src.url} target="_blank" rel="noopener noreferrer"
                                                                    className="text-[11px] text-blue-500 hover:text-blue-700 underline decoration-dotted underline-offset-2 transition-colors font-medium"
                                                                    title={src.title || src.url}
                                                                >
                                                                    {src.title || domain}
                                                                </a>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
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
                                        <DeepInvestmentView data={analysis.deep_investment_research} />
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
