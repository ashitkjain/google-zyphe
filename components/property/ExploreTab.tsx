import React from 'react';
import { NeighborhoodAnalysis } from '../../types/ai';
import PropertyHeader from './PropertyHeader';
import PropertyImages from './PropertyImages';
import PropertyFacts from './PropertyFacts';
import DailyLivingSection from './DailyLivingSection';
import EnvironmentResilienceSection from './EnvironmentResilienceSection';
import PropertyDescription from './PropertyDescription';
import StreetViewAnalysisSection from './StreetViewAnalysisSection';
import PropertyMaps from './PropertyMaps';
import Logo from '../shared/Logo';
import VastuCard from './VastuCard';
import { doc, setDoc } from 'firebase/firestore';
import CustomAIAnalysis from '../analysis/CustomAIAnalysis';
import ComprehensiveAnalysis from '../analysis/ComprehensiveAnalysis';
import ComplianceAttribution from './ComplianceAttribution';
import NeighborhoodPlacesSection from './NeighborhoodPlacesSection';
import ParcelValidationCard from './ParcelValidationCard';
import StaticParcelMap from './StaticParcelMap';
import HistoricalDisasterSection from './HistoricalDisasterSection';
import LifestyleInsightsSection from './LifestyleInsightsSection';
import { StickyNotesLayer } from '../analysis/custom-ai/components/StickyNotesLayer';
import ChatInterface from '../shared/ChatInterface';
import ConciergeCall from '../concierge/ConciergeCall';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, LogEntry } from '../../types';
import { hasEssentialData } from '../../utils/propertyPolicies';
import StoryIntakeTab from '../client-hub/StoryIntakeTab';
import { trackViewModeChanged } from '../../services/analytics/idxTracking';
import { BrowseHomeSection } from './BrowseByCitySection';
import { useExploreTabData } from './hooks/useExploreTabData';
import { ExploreRow1Cards } from './ExploreRow1Cards';
import { ExploreRow2Cards } from './ExploreRow2Cards';

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
    realtorId?: string;
    searchBar?: React.ReactNode;
    address?: string;
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
    onRefreshCommunityPulse?: () => Promise<void>;
    onBack?: () => void;
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
    realtorId,
    searchBar,
    address: currentAddress,
    onRefreshEnvironment,
    environmentRefreshing,
    onRefreshCommunityPulse,
    onBack,
}) => {
    const {
        activeTab, setActiveTab,
        activeSubTab, setActiveSubTab,
        stickyNoteActiveTab,
        isRefreshingPulse, setIsRefreshingPulse,
        pulseExpanded, setPulseExpanded,
        showTimings, setShowTimings,
        isSatelliteExpanded, setIsSatelliteExpanded,
        compReportTab, setCompReportTab,
        groundTruthMapTab, setGroundTruthMapTab,
        census, micro,
        cityNhEntryOverview,
        lifestyleInsights, lifestyleLoading, lifestyleFit,
        lifestyleFitTab, setLifestyleFitTab,
        handleGenerateLifestyle,
        schoolsIntelligence, setSchoolsIntelligence,
        schoolsExpanded, setSchoolsExpanded,
        cachedVisualAnalysis,
        designStyle, marketDynamics, ltrAnalysis, keyInsights,
        neighborhoodOverview, visualPoi, mapLabels,
        currentInteriorSummary, analysis,
        handleFullRefresh,
    } = useExploreTabData({ propertyData, viewMode, customAnalysis, comprehensiveAnalysis, onRunCustomAnalysis });

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
            <div className="px-5">
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

                        {/* ── Back button (shown when navigated from IDX Browse) ── */}
                        {onBack && (
                            <div className="pt-3 px-5 md:px-6">
                                <button
                                    onClick={onBack}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-[11px] font-black uppercase tracking-widest shadow-sm group"
                                >
                                    <i className="fa-solid fa-arrow-left text-[10px] group-hover:-translate-x-0.5 transition-transform"></i>
                                    Back to Browse
                                </button>
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

                        <StickyNotesLayer zpid={propertyData?.zpid || ''} activeTab={stickyNoteActiveTab}>
                            {(renderPalette) => (<>
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
                                            {renderPalette()}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Tab Content ── */}
                                {activeTab === 'property-data' && (
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

                                        <DailyLivingSection data={propertyData} onRefresh={onRefreshEnvironment} refreshing={environmentRefreshing} />
                                        <EnvironmentResilienceSection data={propertyData} disasterData={propertyData.historical_disasters} micro={micro} onRefresh={onRefreshEnvironment} refreshing={environmentRefreshing} />

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
                                                {/* Executive Summary hidden per user request */}

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

                                                <ExploreRow1Cards
                                                    propertyData={propertyData}
                                                    analysis={analysis}
                                                    census={census}
                                                    cityNhEntryOverview={cityNhEntryOverview}
                                                    schoolsIntelligence={schoolsIntelligence}
                                                    schoolsExpanded={schoolsExpanded}
                                                    setSchoolsExpanded={setSchoolsExpanded}
                                                    lifestyleFit={lifestyleFit}
                                                    lifestyleInsights={lifestyleInsights}
                                                    userRole={userRole}
                                                />

                                                <ExploreRow2Cards
                                                    propertyData={propertyData}
                                                    analysis={analysis}
                                                    customAnalysis={customAnalysis}
                                                    keyInsights={keyInsights}
                                                    ltrAnalysis={ltrAnalysis}
                                                    visualPoi={visualPoi}
                                                    mapLabels={mapLabels}
                                                    neighborhoodOverview={neighborhoodOverview}
                                                    lifestyleFit={lifestyleFit}
                                                    lifestyleInsights={lifestyleInsights}
                                                    lifestyleLoading={lifestyleLoading}
                                                    lifestyleFitTab={lifestyleFitTab}
                                                    setLifestyleFitTab={setLifestyleFitTab}
                                                    handleGenerateLifestyle={handleGenerateLifestyle}
                                                    pulseExpanded={pulseExpanded}
                                                    setPulseExpanded={setPulseExpanded}
                                                    isRefreshingPulse={isRefreshingPulse}
                                                    setIsRefreshingPulse={setIsRefreshingPulse}
                                                    groundTruthMapTab={groundTruthMapTab}
                                                    setGroundTruthMapTab={setGroundTruthMapTab}
                                                    isSatelliteExpanded={isSatelliteExpanded}
                                                    setIsSatelliteExpanded={setIsSatelliteExpanded}
                                                    onRefreshEnvironment={onRefreshEnvironment}
                                                    environmentRefreshing={environmentRefreshing}
                                                    userRole={userRole}
                                                    onRefreshCommunityPulse={onRefreshCommunityPulse}
                                                />


                                            </div>
                                        )}

                                    </div>
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
                                        onTabChange={(tabId) => setActiveSubTab(tabId)}
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
                            </>)}
                        </StickyNotesLayer>
                    </>
                )}

                {!propertyData && !loading && (
                    <BrowseHomeSection searchBar={searchBar} setViewMode={setViewMode} />
                )}
            </div>

            {propertyData && (
                <>
                    <ChatInterface property={propertyData} visual={customAnalysis} comprehensive={comprehensiveAnalysis} />
                    <ConciergeCall />
                </>
            )
            }
        </>
    );
};

export default ExploreTab;

