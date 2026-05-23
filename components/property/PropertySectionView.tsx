/**
 * PropertySectionView
 *
 * Content router for the new 5-section hierarchical nav.
 * Each (sectionId, subId) pair renders a focused, isolated view.
 */
import React, { useState, useEffect, useRef } from 'react';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult } from '../../types';
import { DeepResearchInsights } from '../../types/ai';
import { CensusDemographics, MicroclimateDelta } from '../../services/api/environmental';
import { NeighborhoodAnalysis } from '../../types/ai';

import { PropertyDashboardLeft } from './PropertyDashboardLeft';
import { PropertyDashboardRight } from './PropertyDashboardRight';
import { VastuZonesTable } from './VastuCard';
import { PropertyLifestylePanel } from './PropertyLifestylePanel';
import { ExploreRow1Cards } from './ExploreRow1Cards';
import { PropertyInsightsPanel } from './PropertyInsightsPanel';
import { calculateSolarPotential } from '../../utils/solarCalculations';
import CommuteCalculator from './CommuteCalculator';
import CustomAIAnalysis from '../analysis/CustomAIAnalysis';
import ComprehensiveAnalysis from '../analysis/ComprehensiveAnalysis';
import { EnvironmentSectionPage } from './sections/EnvironmentSectionPage';

import { CommunityPulseSectionPage } from './sections/CommunityPulseSectionPage';
import { CityNeighborhoodsView } from '../analysis/custom-ai/components/CityNeighborhoodsView';
import { DeepInvestmentView } from '../analysis/custom-ai/components/DeepInvestmentView';
import { LifestyleSchoolsVastuSection } from './sections/LifestyleSchoolsVastuSection';
import { MLSSectionPage } from './sections/MLSSectionPage';
import { RealEstateApiSectionPage } from './sections/RealEstateApiSectionPage';
import { RentCastSectionPage } from './sections/RentCastSectionPage';
import { IndoorSectionPage } from './sections/IndoorSectionPage';
import { OutdoorSectionPage } from './sections/OutdoorSectionPage';
import VisionAnalysisPage from './VisionAnalysisPage';
import { ConnectivitySectionPage } from './sections/ConnectivitySectionPage';
import { LocationOverviewSectionPage } from './sections/LocationOverviewSectionPage';

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
    deepResearch: DeepInvestmentResearchResult | null;
    neighborhoodOverview: string | null;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    designStyle: any;
    currentInteriorSummary: any;
    census: CensusDemographics | null;
    micro: MicroclimateDelta | null;
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
    addLog: (service: string, meta: any, content: any) => void;
    isHealingFema?: boolean;
    // ── CustomAIAnalysis passthrough ────────────────────────────────────────
    customAnalysisLoading?: boolean;
    comprehensiveLoading?: boolean;
    onRefreshAnalysis?: () => void;
    onFullRefresh?: () => void;
    onRunComprehensive?: (refresh: boolean) => void;
    onUpdateAnalysis?: (updated: CustomAIAnalysisResult) => void;
    onUpdatePropertyData?: (fields: any) => void;
    isFavorited?: boolean;
    onToggleFavorite?: () => void;
    orientationGroundTruth?: { expected_orientation: string; expected_azimuth_deg: number | null; gt_source: string } | null;
    renderPalette?: () => React.ReactNode;
}

// ─────────────────────────────────────────────────────────────
// Section page header — editorial serif design
// ─────────────────────────────────────────────────────────────

const TAILWIND_TO_HEX: Record<string, string> = {
    'text-slate-500':    '#64748b',
    'text-slate-600':    '#475569',
    'text-violet-500':   '#8b5cf6',
    'text-violet-600':   '#7c3aed',
    'text-indigo-500':   '#6366f1',
    'text-indigo-600':   '#4f46e5',
    'text-amber-500':    '#f59e0b',
    'text-amber-600':    '#d97706',
    'text-emerald-500':  '#10b981',
    'text-emerald-600':  '#059669',
    'text-blue-500':     '#3b82f6',
    'text-blue-600':     '#2563eb',
    'text-rose-500':     '#f43f5e',
    'text-teal-500':     '#14b8a6',
    'text-teal-600':     '#0d9488',
};

const _serif = "'Instrument Serif', Georgia, serif";

export const PageHeader: React.FC<{
    icon: string;
    label?: string;
    title: string;
    description?: string;
    subtitle?: string;
    color?: string;
    attribution?: string;
    renderPalette?: () => React.ReactNode;
    titleSuffix?: React.ReactNode;
}> = ({
    icon, label, title, description, subtitle, color = 'text-indigo-500', attribution, renderPalette, titleSuffix,
}) => {
    const accentHex = TAILWIND_TO_HEX[color] || '#4f46e5';
    return (
        <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
            padding: '10px 16px', marginBottom: 24, position: 'relative', overflow: 'hidden',
            display: 'flex', alignItems: 'center', gap: 12,
        }}>
            {/* Gradient blob */}
            <div style={{
                position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%',
                background: `radial-gradient(circle, ${accentHex}18 0%, transparent 70%)`, pointerEvents: 'none',
            }} />
            {/* Icon */}
            <div style={{
                width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center',
                background: `${accentHex}18`, color: accentHex, flexShrink: 0,
            }}>
                <i className={`fa-solid ${icon} text-sm`} />
            </div>
            {/* Text block */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {label && (
                    <div style={{ fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 1 }}>
                        {label}
                    </div>
                )}
                <h1 style={{
                    fontFamily: _serif, fontSize: 26, lineHeight: 1.05, margin: 0,
                    fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
                }}>
                    <span>{title}</span>
                    {titleSuffix}
                </h1>
                {(description || subtitle) && (
                    <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.45, margin: '2px 0 0', maxWidth: 640 }}>
                        {description || subtitle}
                    </p>
                )}
                {attribution && (
                    <div style={{ fontSize: 9, letterSpacing: '0.14em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginTop: 4 }}>
                        {attribution}
                    </div>
                )}
            </div>
            {/* Palette */}
            {renderPalette && renderPalette()}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export const PropertySectionView: React.FC<PropertySectionViewProps> = (props) => {
    const contextGraphRefreshRef = useRef<(() => void) | null>(null);

    const {
        sectionId, subId, propertyData: data,
        customAnalysis, comprehensiveAnalysis: analysis, communityPulse, ltrAnalysis, deepResearch, keyInsights,
        neighborhoodOverview, visualPoi, mapLabels, designStyle, currentInteriorSummary,
        census, micro,
        lifestyleFit, lifestyleInsights, lifestyleLoading,
        lifestyleFitTab, setLifestyleFitTab, lifestyleInterestTab, setLifestyleInterestTab,
        handleGenerateLifestyle,
        schoolsIntelligence, cityNhEntryOverview,
        pulseExpanded, setPulseExpanded, isRefreshingPulse, setIsRefreshingPulse,
        isSatelliteExpanded, setIsSatelliteExpanded,
        groundTruthMapTab, setGroundTruthMapTab,
        onRunAnalysis, onRefreshEnvironment, environmentRefreshing, isHealingFema,
        onRefreshCommunityPulse, userRole,
        customAnalysisLoading,
        onRefreshAnalysis, onFullRefresh, onRunComprehensive,
        onUpdateAnalysis, onUpdatePropertyData, addLog,
        isFavorited, onToggleFavorite,
        orientationGroundTruth,
        renderPalette,
    } = props;

    // ── Shared CustomAIAnalysis props ────────────────────────────────────────
    const aiProps = {
        analysis: customAnalysis,
        loading: customAnalysisLoading ?? false,
        onBack: () => {},
        onRefresh: onRefreshAnalysis ?? (() => {}),
        onFullRefresh: onFullRefresh ?? (() => {}),
        onRunComprehensive: onRunComprehensive ?? (() => {}),
        comprehensiveResult: analysis,
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

    const headerProps = { renderPalette };

    // Auto-fetch customAnalysis if missing when visiting the Indoor or Outdoor tab
    useEffect(() => {
        if ((subId === 'indoor' || subId === 'outdoor') && !customAnalysis && !customAnalysisLoading && onRunAnalysis) {
            onRunAnalysis();
        }
    }, [subId, customAnalysis, customAnalysisLoading, onRunAnalysis]);

    // ── Shared internal state (needed by Left/Right components) ─────────────
    const [mlsOpen, setMlsOpen] = useState(true);
    const [envOpen, setEnvOpen] = useState<Record<string, boolean>>({});
    const [selectedSchool, setSelectedSchool] = useState(0);
    const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
    const [isNearbyCollapsed, setIsNearbyCollapsed] = useState(false);
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

    // ── Scroll to top on section change ──────────────────────────────────────
    useEffect(() => {
        // Find the top of the section content
        const topEl = document.getElementById('property-section-top');
        if (topEl) {
            // Calculate position relative to the document
            const rect = topEl.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetY = rect.top + scrollTop - 20; // 20px buffer for breathing room
            
            window.scrollTo({
                top: Math.max(0, targetY),
                behavior: 'smooth'
            });
        }
    }, [sectionId, subId]);

    // ── Shared Left column props ─────────────────────────────────────────────
    const leftProps = {
        data, micro,
        hasEnv, hasCoords: !!data.coordinates, hasNoise, hasPollen,
        hasSolar, hasWalk, hasBroadband, hasEV,
        solarPotential, mlsOpen, setMlsOpen, envOpen, toggleEnv,
        customAnalysis,
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
        orientationGroundTruth,
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

    return (
        <div id="property-section-top" className="flex flex-col w-full min-h-screen scroll-mt-20">
            {(() => {
                // ────────────────────────────────────────────────────────────────────────
                // PROPERTY
                // ────────────────────────────────────────────────────────────────────────
                if (sectionId === 'property') {
                    if (subId === 'lifestyle-vastu') return (
                        <div className="animate-in fade-in duration-200">
                            <LifestyleSchoolsVastuSection
                                data={data}
                                lifestyleFit={lifestyleFit}
                                lifestyleInsights={lifestyleInsights}
                                lifestyleLoading={lifestyleLoading}
                                lifestyleFitTab={lifestyleFitTab}
                                setLifestyleFitTab={setLifestyleFitTab}
                                handleGenerateLifestyle={handleGenerateLifestyle}
                                schoolsIntelligence={schoolsIntelligence}
                                selectedSchool={selectedSchool}
                                setSelectedSchool={setSelectedSchool}
                                isSchoolModalOpen={isSchoolModalOpen}
                                setIsSchoolModalOpen={setIsSchoolModalOpen}
                                orientationGroundTruth={orientationGroundTruth}
                                renderPalette={renderPalette}
                                analysis={analysis}
                            />
                        </div>
                    );

                    if (subId === 'mls-data') return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-table-cells-large" title="MLS Property Data"
                                label="Listing Data"
                                description="Full technical specifications, listing remarks, and official property images from the Multiple Listing Service."
                                color="text-indigo-500" {...headerProps} />
                            <MLSSectionPage data={data} />
                        </div>
                    );

                    if (subId === 'realestateapi-data') return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-database" title="RealEstateAPI Data"
                                label="MLS Intelligence"
                                description="Full property record from RealEstateAPI.com — MLS history, ownership data, tax assessment, equity metrics, schools, and parcel details."
                                color="text-emerald-600" {...headerProps} />
                            <RealEstateApiSectionPage data={data} />
                        </div>
                    );

                    if (subId === 'rentcast-data') return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-chart-line" title="RentCast Data"
                                label="Market Intelligence"
                                description="Property details, automated valuation model (AVM), long-term rent estimate, tax assessments, and ownership records from RentCast."
                                color="text-violet-600" {...headerProps} />
                            <RentCastSectionPage data={data} />
                        </div>
                    );

                    if (subId === 'indoor') return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-couch" title="Indoor atmosphere"
                                label="Interior Overview"
                                description="Room-by-room analysis, design style classification, and interior material quality assessments."
                                color="text-teal-600" {...headerProps} />
                            <IndoorSectionPage
                                data={data}
                                customAnalysis={customAnalysis}
                                currentInteriorSummary={currentInteriorSummary}
                                designStyle={designStyle}
                            />
                        </div>
                    );



                    if (subId === 'outdoor') return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-house-chimney" title="Outdoor &amp; curb appeal"
                                label="Exterior Overview"
                                description="Curb appeal, lot utility, street-view analysis, and satellite-based parcel characterization."
                                color="text-emerald-500" {...headerProps} />
                            <OutdoorSectionPage data={data} customAnalysis={customAnalysis} />
                        </div>
                    );

                    if (subId === 'indoor-ai') return (
                        <div className="animate-in fade-in duration-200">
                            <VisionAnalysisPage propertyData={data} userRole={userRole} mode="indoor" renderPalette={renderPalette} />
                        </div>
                    );

                    if (subId === 'outdoor-ai') return (
                        <div className="animate-in fade-in duration-200">
                            <VisionAnalysisPage propertyData={data} customAnalysis={customAnalysis} userRole={userRole} mode="outdoor" renderPalette={renderPalette} />
                        </div>
                    );
                }

                // ────────────────────────────────────────────────────────────────────────
                // ENVIRONMENT
                // ────────────────────────────────────────────────────────────────────────
                if (sectionId === 'environment') {
                    return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-leaf" title="Environmental Overview"
                                description="Climate risk, seismic zone, air quality and solar"
                                color="text-emerald-500" {...headerProps} />
                            <EnvironmentSectionPage 
                                data={data} 
                                solarPotential={solarPotential} 
                                micro={micro} 
                                onRefreshEnvironment={onRefreshEnvironment} 
                                environmentRefreshing={environmentRefreshing} 
                                isHealingFema={isHealingFema}
                            />
                        </div>
                    );
                }

                // ────────────────────────────────────────────────────────────────────────
                // CONNECTIVITY
                // ────────────────────────────────────────────────────────────────────────
                if (sectionId === 'connectivity') {
                    return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-network-wired" title="Connectivity"
                                label="Mobility & Infrastructure"
                                description="Real-world commute times, walkability metrics, and high-speed broadband availability."
                                color="text-blue-500" {...headerProps} />
                            <ConnectivitySectionPage data={data} />
                            {data.coordinates && (
                                <div className="mt-6">
                                    <CommuteCalculator
                                        originLat={data.coordinates.lat}
                                        originLng={data.coordinates.lng}
                                        propertyAddress={data.address}
                                    />
                                </div>
                            )}
                        </div>
                    );
                }

                if (sectionId === 'location') {
                    if (subId === 'city-neighborhoods') return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-mountain-city" title="City & Neighborhoods"
                                label="Urban Geography"
                                description="Comprehensive atlas of local districts, community tiers, and neighborhood character across the greater metropolitan area."
                                color="text-indigo-600" {...headerProps} />
                            <CityNeighborhoodsView propertyData={data} />
                        </div>
                    );

                    if (subId === 'community-pulse') return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-users" title="Community Pulse"
                                label="Resident Sentiment Report"
                                description={`What residents actually say about living in ${data.city || 'this area'} — sourced from community forums, reviews, and local intelligence.`}
                                color="text-blue-600" {...headerProps} />
                            <CommunityPulseSectionPage
                                communityPulse={communityPulse}
                                analysis={analysis}
                                city={data.city}
                                propertyData={data}
                            />
                        </div>
                    );

                    return (
                        <div className="animate-in fade-in duration-200">
                            <PageHeader icon="fa-location-dot" title="Location Overview"
                                label="Geographic Context"
                                description="Neighborhood dynamics, area demographics, and key local amenities cross-referenced with lifestyle preferences."
                                color="text-indigo-500" {...headerProps} />
                            <LocationOverviewSectionPage
                                data={data}
                                neighborhoodOverview={neighborhoodOverview}
                                census={census}
                                lifestyleInsights={props.lifestyleInsights}
                                visualPoi={visualPoi}
                                mapLabels={mapLabels}
                                cityNhEntryOverview={cityNhEntryOverview}
                            />
                        </div>
                    );
                }


                // ────────────────────────────────────────────────────────────────────────
                // INVESTMENT
                // ────────────────────────────────────────────────────────────────────────
                if (sectionId === 'investment') {
                    return (
                        <div className="animate-in fade-in duration-200 space-y-1">
                            <PageHeader icon="fa-sack-dollar" title="Investment Research"
                                label="Market Economics"
                                description="Financial research, valuation average, and deep-dive investment analysis for high-conviction decision making."
                                color="text-indigo-600" {...headerProps} />
                            <PropertyInsightsPanel {...insightProps} showOnly={['rental']} />
                            <PropertyInsightsPanel {...insightProps} showOnly={['ai-analysis']} />
                            {customAnalysisLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center gap-4 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                    <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Assembling Analysis...</p>
                                </div>
                            ) : (customAnalysis?.deep_investment_research || deepResearch) ? (
                                <DeepInvestmentView data={customAnalysis?.deep_investment_research || deepResearch} />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 gap-6 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
                                        <i className="fa-solid fa-microscope text-2xl text-violet-300"></i>
                                    </div>
                                    <div>
                                        <p className="text-slate-800 font-black text-lg tracking-tight">Deep Research Not Available</p>
                                        <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">Run a comprehensive investment analysis to generate this deep-dive market report.</p>
                                    </div>
                                    <button onClick={() => onRunComprehensive?.()} className="px-6 py-3 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-200 flex items-center gap-2">
                                        <i className="fa-solid fa-wand-magic-sparkles" /> Run Deep Research
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
                    const refreshBtn = (
                        <button
                            onClick={() => contextGraphRefreshRef.current?.()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 hover:border-indigo-600 rounded-xl transition-all shadow-sm active:scale-95"
                        >
                            <i className="fa-solid fa-arrows-rotate text-[9px]" />
                            Refresh
                        </button>
                    );
                    return (
                        <div className="animate-in fade-in duration-200 space-y-4">
                            <PageHeader icon="fa-diagram-project" title="Factors - At A Glance"
                                subtitle="Decision Factors · Semantic Extraction · Performance Graph" color="text-indigo-600" {...headerProps} titleSuffix={refreshBtn} />
                            <CustomAIAnalysis {...aiProps} activeSubTab="context_graph"
                                onBindContextGraphRefresh={(fn) => { contextGraphRefreshRef.current = fn; }} />
                        </div>
                    );
                }

                // ────────────────────────────────────────────────────────────────────────
                // LEGACY VIEWS
                // ────────────────────────────────────────────────────────────────────────
                if (sectionId === 'legacy') {
                    if (subId === 'comprehensive') return (
                        <div className="animate-in fade-in duration-200">
                            <ComprehensiveAnalysis
                                analysis={analysis}
                                loading={props.comprehensiveLoading}
                                onBack={() => {}}
                                isFavorited={props.isFavorited}
                                onToggleFavorite={props.onToggleFavorite}
                            />
                        </div>
                    );
                    return (
                        <div className="animate-in fade-in duration-200">
                            <CustomAIAnalysis {...aiProps} activeSubTab={subId || 'interior'} onTabChange={() => {}} />
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
            })()}
        </div>
    );
};

