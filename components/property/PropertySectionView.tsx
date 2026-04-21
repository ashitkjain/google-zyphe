/**
 * PropertySectionView
 *
 * Content router for the new 5-section hierarchical nav.
 * Each (sectionId, subId) pair renders a focused, isolated view.
 */
import React from 'react';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult } from '../../types';
import { DeepResearchInsights } from '../../types/ai';
import { CensusDemographics } from '../../services/api/environmental';
import { NeighborhoodAnalysis } from '../../types/ai';

import { PropertyDashboardLeft } from './PropertyDashboardLeft';
import { PropertyDashboardRight } from './PropertyDashboardRight';
import { PropertyLifestylePanel } from './PropertyLifestylePanel';
import { ExploreRow1Cards } from './ExploreRow1Cards';
import { PropertyInsightsPanel } from './PropertyInsightsPanel';
import { calculateSolarPotential } from '../../utils/solarCalculations';
import CommuteCalculator from './CommuteCalculator';
import CustomAIAnalysis from '../analysis/CustomAIAnalysis';
import { EnvironmentSectionPage } from './sections/EnvironmentSectionPage';
import { RoomsSectionPage } from './sections/RoomsSectionPage';
import { CommunityPulseSectionPage } from './sections/CommunityPulseSectionPage';
import { CityNeighborhoodsView } from '../analysis/custom-ai/components/CityNeighborhoodsView';
import { DeepInvestmentView } from '../analysis/custom-ai/components/DeepInvestmentView';

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface PropertySectionViewProps {
    sectionId: string;
    subId: string;
    propertyData: PropertyData;
    customAnalysis: CustomAIAnalysisResult | null;
    comprehensiveAnalysis: ComprehensiveAnalysisResult | null;
    communityPulse: any | null;
    ltrAnalysis: { monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null;
    keyInsights: DeepResearchInsights | null;
    neighborhoodOverview: string | null;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    designStyle: any;
    currentInteriorSummary: any;
    census: CensusDemographics | null;
    micro: { insight: string; fetchedAt: number } | null;
    lifestyleFit: any;
    lifestyleInsights: any;
    lifestyleLoading: boolean;
    lifestyleFitTab: string;
    setLifestyleFitTab: (v: string) => void;
    lifestyleInterestTab: string;
    setLifestyleInterestTab: (v: string) => void;
    handleGenerateLifestyle: () => Promise<void>;
    schoolsIntelligence: any;
    cityNhEntryOverview: any;
    pulseExpanded: boolean;
    setPulseExpanded: (v: boolean) => void;
    isRefreshingPulse: boolean;
    setIsRefreshingPulse: (v: boolean) => void;
    isSatelliteExpanded: boolean;
    setIsSatelliteExpanded: (v: boolean) => void;
    groundTruthMapTab: 'parcel' | 'satellite';
    setGroundTruthMapTab: (v: 'parcel' | 'satellite') => void;
    onRunAnalysis: () => void;
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
    onRefreshCommunityPulse?: () => Promise<void>;
    userRole?: string;
    // ── CustomAIAnalysis passthrough ────────────────────────────────────────
    customAnalysisLoading?: boolean;
    comprehensiveAnalysis: ComprehensiveAnalysisResult | null;
    onRunAnalysis: () => void;
    onRefreshAnalysis?: () => void;
    onFullRefresh?: () => void;
    onRunComprehensive?: () => void;
    onUpdateAnalysis?: (updated: CustomAIAnalysisResult) => void;
    onUpdatePropertyData?: (fields: any) => void;
    addLog?: (service: string, meta: { type: 'request' | 'response' | 'error' | 'info' }, content: any) => void;
    isFavorited?: boolean;
    onToggleFavorite?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Section page header
// ─────────────────────────────────────────────────────────────

const PageHeader: React.FC<{ icon: string; title: string; subtitle?: string; color?: string }> = ({
    icon, title, subtitle, color = 'text-indigo-500',
}) => (
    <div className="flex items-center gap-3 mb-4 pb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-slate-100 shadow-sm flex-shrink-0">
            <i className={`fa-solid ${icon} text-[16px] ${color}`} />
        </div>
        <div>
            <h2 className="text-[22px] font-black text-slate-900 tracking-tight leading-none">{title}</h2>
            {subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{subtitle}</p>}
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export const PropertySectionView: React.FC<PropertySectionViewProps> = (props) => {
    const {
        sectionId, subId, propertyData: data,
        customAnalysis, comprehensiveAnalysis, communityPulse, ltrAnalysis, keyInsights,
        neighborhoodOverview, visualPoi, mapLabels, designStyle, currentInteriorSummary,
        census, micro,
        lifestyleFit, lifestyleInsights, lifestyleLoading,
        lifestyleFitTab, setLifestyleFitTab, lifestyleInterestTab, setLifestyleInterestTab,
        handleGenerateLifestyle,
        schoolsIntelligence, cityNhEntryOverview,
        pulseExpanded, setPulseExpanded, isRefreshingPulse, setIsRefreshingPulse,
        isSatelliteExpanded, setIsSatelliteExpanded,
        groundTruthMapTab, setGroundTruthMapTab,
        onRunAnalysis, onRefreshEnvironment, environmentRefreshing,
        onRefreshCommunityPulse, userRole,
        customAnalysisLoading,
        onRefreshAnalysis, onFullRefresh, onRunComprehensive,
        onUpdateAnalysis, onUpdatePropertyData, addLog,
        isFavorited, onToggleFavorite,
    } = props;

    // ── Shared CustomAIAnalysis props ────────────────────────────────────────
    const aiProps = {
        analysis: customAnalysis,
        loading: customAnalysisLoading ?? false,
        onBack: () => {},
        onRefresh: onRefreshAnalysis ?? (() => {}),
        onFullRefresh: onFullRefresh ?? (() => {}),
        onRunComprehensive: onRunComprehensive ?? (() => {}),
        comprehensiveResult: comprehensiveAnalysis,
        hasImages: (data.images?.length ?? 0) > 0,
        userRole,
        propertyImages: data.images,
        zpid: data.zpid,
        propertyData: data,
        onUpdateAnalysis: onUpdateAnalysis ?? (() => {}),
        onUpdatePropertyData,
        addLog: addLog ?? (() => {}),
        isFavorited,
        onToggleFavorite,
        onTabChange: () => {},
    };

    // ── Shared internal state (needed by Left/Right components) ─────────────
    const [mlsOpen, setMlsOpen] = React.useState(true);
    const [envOpen, setEnvOpen] = React.useState<Record<string, boolean>>({});
    const [selectedSchool, setSelectedSchool] = React.useState(0);
    const [isSchoolModalOpen, setIsSchoolModalOpen] = React.useState(false);
    const [isNearbyCollapsed, setIsNearbyCollapsed] = React.useState(false);
    const toggleEnv = (key: string) => setEnvOpen(prev => ({ ...prev, [key]: !prev[key] }));

    // ── Derived flags ────────────────────────────────────────────────────────
    const solar = data.solarData;
    const solarPotential = solar?.estimatedSolarProduction || (solar ? calculateSolarPotential(solar) : null);
    const hasEnv = !!(data.windRiskScore || data.floodRiskScore || data.fireRiskScore || data.pollen || data.airQuality || (data as any).historical_disasters);
    const hasNoise = data.noiseScore != null;
    const hasPollen = !!(data.pollen);
    const hasSolar = !!(data.solarData || data.coordinates);
    const hasWalk = !!(data.walkScore || data.transitScore || data.bikeScore);
    const hasBroadband = !!(data as any).broadband;
    const hasEV = !!(data as any).evChargers;
    const hasSchools = !!(schoolsIntelligence?.schools?.length);
    const hasPlaces = !!(data.google_places || visualPoi);

    const analysis = comprehensiveAnalysis;

    // ── Shared Left column props ─────────────────────────────────────────────
    const leftProps = {
        data, micro,
        hasEnv, hasCoords: !!data.coordinates, hasNoise, hasPollen,
        hasSolar, hasWalk, hasBroadband, hasEV,
        solarPotential, mlsOpen, setMlsOpen, envOpen, toggleEnv,
    };

    // ── Shared Right column props ───────────────────────────────────────────
    const rightProps = {
        data, customAnalysis, analysis, schoolsIntelligence, cityNhEntryOverview,
        visualPoi, mapLabels, neighborhoodOverview, ltrAnalysis,
        hasSchools, hasPlaces,
        selectedSchool, setSelectedSchool,
        isSchoolModalOpen, setIsSchoolModalOpen,
        isNearbyCollapsed, setIsNearbyCollapsed,
        onRunAnalysis,
    };

    // ── Shared InsightsPanel props ──────────────────────────────────────────
    const insightProps = {
        propertyData: data, analysis, customAnalysis, communityPulse,
        keyInsights, ltrAnalysis, census, neighborhoodOverview,
        lifestyleLoading,
        pulseExpanded, setPulseExpanded, isRefreshingPulse, setIsRefreshingPulse,
        groundTruthMapTab, setGroundTruthMapTab,
        isSatelliteExpanded, setIsSatelliteExpanded,
        onRefreshEnvironment, environmentRefreshing, userRole,
        onRefreshCommunityPulse,
    };

    // ────────────────────────────────────────────────────────────────────────
    // PROPERTY
    // ────────────────────────────────────────────────────────────────────────
    if (sectionId === 'property') {
        if (subId === 'lifestyle-vastu') return (
            <div className="animate-in fade-in duration-200">
                <PageHeader icon="fa-people-roof" title="Lifestyle, Schools & Vastu"
                    subtitle="Compatibility · Education · Orientation" />
                <PropertyLifestylePanel
                    lifestyleFit={lifestyleFit} lifestyleInsights={lifestyleInsights}
                    lifestyleLoading={lifestyleLoading}
                    lifestyleFitTab={lifestyleFitTab} setLifestyleFitTab={setLifestyleFitTab}
                    lifestyleInterestTab={lifestyleInterestTab} setLifestyleInterestTab={setLifestyleInterestTab}
                    handleGenerateLifestyle={handleGenerateLifestyle}
                    showOnly={['fit']}
                />
                <div className="mt-8">
                    <PropertyDashboardRight {...rightProps} showOnly={['schools', 'orientation']} />
                </div>
            </div>
        );

        if (subId === 'mls-data') return (
            <div className="animate-in fade-in duration-200">
                <PageHeader icon="fa-table-cells-large" title="MLS Property Data"
                    subtitle="Listing details · Full specifications" />
                <PropertyDashboardLeft {...leftProps} showOnly={['mls']} />
            </div>
        );

        if (subId === 'indoor') return (
            <div className="animate-in fade-in duration-200 space-y-6">
                <PageHeader icon="fa-couch" title="Indoor"
                    subtitle="Interior · Rooms · Design · AI Analysis" color="text-violet-500" />
                <ExploreRow1Cards
                    propertyData={data} analysis={analysis} census={census}
                    lifestyleFit={lifestyleFit} lifestyleInsights={lifestyleInsights}
                    userRole={userRole} designStyle={designStyle}
                    currentInteriorSummary={currentInteriorSummary}
                    showOnly={['interior']}
                />
                {/* AI Visual Analysis — Interior & Rooms */}
                {customAnalysis && (
                    <div className="mt-2 space-y-6">
                        <CustomAIAnalysis {...aiProps} activeSubTab="interior" />
                        <CustomAIAnalysis {...aiProps} activeSubTab="rooms" />
                    </div>
                )}
            </div>
        );

        if (subId === 'rooms') return (
            <div className="animate-in fade-in duration-200 space-y-4">
                <RoomsSectionPage
                    data={data}
                    currentInteriorSummary={currentInteriorSummary}
                />
                {/* Per-room AI cards — Entryway, Kitchen, Bedrooms, etc. */}
                {customAnalysis && (
                    <CustomAIAnalysis {...aiProps} activeSubTab="rooms" />
                )}
            </div>
        );

        if (subId === 'outdoor') return (
            <div className="animate-in fade-in duration-200">
                <PageHeader icon="fa-tree" title="Outdoor"
                    subtitle="Exterior lot · Yard · Satellite view" color="text-emerald-500" />
                <ExploreRow1Cards
                    propertyData={data} analysis={analysis} census={census}
                    lifestyleFit={lifestyleFit} lifestyleInsights={lifestyleInsights}
                    userRole={userRole} designStyle={designStyle}
                    currentInteriorSummary={currentInteriorSummary}
                    showOnly={['outdoor']}
                />
            </div>
        );

        if (subId === 'exterior') return (
            <div className="animate-in fade-in duration-200 space-y-6">
                <PageHeader icon="fa-house-chimney" title="Exterior"
                    subtitle="Curb appeal · Façade · Street presence · AI Analysis" color="text-amber-500" />
                <ExploreRow1Cards
                    propertyData={data} analysis={analysis} census={census}
                    lifestyleFit={lifestyleFit} lifestyleInsights={lifestyleInsights}
                    userRole={userRole} designStyle={designStyle}
                    currentInteriorSummary={currentInteriorSummary}
                    showOnly={['exterior']}
                />
                {/* AI Visual Analysis — Exterior & Neighborhood */}
                {customAnalysis && (
                    <div className="mt-2">
                        <CustomAIAnalysis {...aiProps} activeSubTab="exterior_and_neighborhood" />
                    </div>
                )}
            </div>
        );

        if (subId === 'eye-on-street' || subId === 'lot-intelligence') return (
            <div className="animate-in fade-in duration-200">
                <PageHeader icon="fa-street-view" title="Eye on Street & Lot Intelligence"
                    subtitle="Street view · Visual analysis · Parcel map · Ground truth" color="text-sky-500" />
                <PropertyInsightsPanel
                    {...insightProps}
                    communityPulse={null}
                    keyInsights={null}
                    ltrAnalysis={null}
                    neighborhoodOverview={null}
                    showOnly={['streetview', 'lot']}
                />
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // ENVIRONMENT — Stitch-styled unified page
    // ────────────────────────────────────────────────────────────────────────
    if (sectionId === 'environment') {
        return <EnvironmentSectionPage data={data} solarPotential={solarPotential} onRefreshEnvironment={onRefreshEnvironment} environmentRefreshing={environmentRefreshing} />;
    }


    // ────────────────────────────────────────────────────────────────────────
    // CONNECTIVITY — all sub-tabs show one merged page
    // ────────────────────────────────────────────────────────────────────────
    if (sectionId === 'connectivity') {
        return (
            <div className="animate-in fade-in duration-200 space-y-4">
                <PageHeader icon="fa-network-wired" title="Connectivity"
                    subtitle="Commute · Walk Scores · Internet & Broadband" color="text-blue-500" />

                {/* Single card with all connectivity data — no duplicates */}
                <PropertyDashboardLeft {...leftProps} showOnly={['commute', 'walk', 'broadband']} />

                {/* Commute Calculator — interactive route planner */}
                {data.coordinates && (
                    <CommuteCalculator
                        originLat={data.coordinates.lat}
                        originLng={data.coordinates.lng}
                        propertyAddress={data.address}
                    />
                )}
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // LOCATION — city-neighborhoods is isolated; rest merged
    // ────────────────────────────────────────────────────────────────────────
    if (sectionId === 'location') {

        if (subId === 'city-neighborhoods') return (
            <div className="animate-in fade-in duration-200">
                <CityNeighborhoodsView propertyData={data} />
            </div>
        );

        if (subId === 'community-pulse') return (
            <div className="animate-in fade-in duration-200">
                <CommunityPulseSectionPage
                    communityPulse={communityPulse}
                    analysis={analysis}
                    city={data.city}
                />
            </div>
        );

        return (
            <div className="animate-in fade-in duration-200 space-y-4">
                {/* Neighborhood + Affordability/Census — side by side */}
                <div className="grid grid-cols-5 gap-4 items-start">
                    {/* Neighborhood card — wider left column */}
                    <div className="col-span-3 min-w-0">
                        <PropertyDashboardRight
                            {...rightProps}
                            showOnly={['neighborhood']}
                        />
                    </div>
                    {/* Affordability + Census — right column */}
                    <div className="col-span-2 min-w-0">
                        <PropertyInsightsPanel
                            {...insightProps}
                            keyInsights={null}
                            ltrAnalysis={null}
                            neighborhoodOverview={null}
                            showOnly={['affordability', 'census']}
                        />
                    </div>
                </div>
                <PropertyLifestylePanel
                    lifestyleFit={lifestyleFit} lifestyleInsights={lifestyleInsights}
                    lifestyleLoading={lifestyleLoading}
                    lifestyleFitTab={lifestyleFitTab} setLifestyleFitTab={setLifestyleFitTab}
                    lifestyleInterestTab={lifestyleInterestTab} setLifestyleInterestTab={setLifestyleInterestTab}
                    handleGenerateLifestyle={handleGenerateLifestyle}
                    showOnly={['interests']}
                />
                <PropertyDashboardRight {...rightProps} showOnly={['nearby']} />
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // INVESTMENT
    // ────────────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────
    // INVESTMENT — Unified Research & Economics
    // ────────────────────────────────────────────────────────────────────────
        if (sectionId === 'investment') {
        return (
            <div className="animate-in fade-in duration-200 space-y-1">
                <PageHeader icon="fa-sack-dollar" title="Investment Intelligence"
                    subtitle="Economics · Market Dynamics · Deep Research · Valuation" color="text-indigo-600" />
                
                {/* 1. Economics (Rental Analysis) */}
                <PropertyInsightsPanel
                    {...insightProps}
                    communityPulse={null}
                    keyInsights={null}
                    neighborhoodOverview={null}
                    showOnly={['rental']}
                />

                {/* 2. Market Dynamics (The flattened metrics card) */}
                <PropertyInsightsPanel
                    {...insightProps}
                    communityPulse={null}
                    ltrAnalysis={null}
                    showOnly={['ai-analysis']}
                />

                {/* 3. Deep Research Full Report */}
                {customAnalysisLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                        <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Assembling Intelligence...</p>
                    </div>
                ) : customAnalysis?.deep_investment_research ? (
                    <div>
                        <DeepInvestmentView data={customAnalysis.deep_investment_research} />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 gap-6 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
                            <i className="fa-solid fa-microscope text-2xl text-violet-300"></i>
                        </div>
                        <div>
                            <p className="text-slate-800 font-black text-lg tracking-tight">Deep Research Not Available</p>
                            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                                Run a comprehensive investment analysis to generate this deep-dive market report.
                            </p>
                        </div>
                        <button
                            onClick={() => onRunComprehensive?.()}
                            className="px-6 py-3 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles" />
                            Run Deep Research
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // CONTEXT GRAPH
    // ────────────────────────────────────────────────────────────────────────
    if (sectionId === 'context-graph') {
        return (
            <div className="animate-in fade-in duration-200 space-y-4">
                <PageHeader icon="fa-diagram-project" title="Context Graph"
                    subtitle="Decision Factors · Semantic Extraction · Performance Graph" color="text-indigo-600" />
                <CustomAIAnalysis {...aiProps} activeSubTab="context_graph" />
            </div>
        );
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center text-slate-400">
            <i className="fa-solid fa-compass text-5xl mb-4 text-slate-200" />
            <p className="text-sm font-black uppercase tracking-widest">Select a section from the nav</p>
        </div>
    );
};
