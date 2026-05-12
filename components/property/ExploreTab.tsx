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
import ExplorePage from './BrowseByCitySection';
import { useExploreTabData } from './hooks/useExploreTabData';
import { isOrientationClear } from '../../utils/propertyPolicies';
import { ExploreRow1Cards } from './ExploreRow1Cards';
import { PropertyLifestylePanel } from './PropertyLifestylePanel';
import { PropertyInsightsPanel } from './PropertyInsightsPanel';
import PropertyOverviewDashboard from './PropertyOverviewDashboard';
import PropertySidebar, { NavItem } from './PropertySidebar';
import PropertyNav, { MobileNavBar } from './PropertyNav';
import { PropertySectionView } from './PropertySectionView';

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
    onRegisterSaveAction?: (handler: () => void) => void;
    onRegisterSavedAction?: (handler: () => void) => void;
    onPropertyClick?: (address: string) => void;
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
    onRegisterSaveAction,
    onRegisterSavedAction,
    onPropertyClick,
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
        lifestyleInterestTab, setLifestyleInterestTab,
        handleGenerateLifestyle,
        schoolsIntelligence, setSchoolsIntelligence,
        schoolsExpanded, setSchoolsExpanded,
        cachedVisualAnalysis,
        designStyle, marketDynamics, ltrAnalysis, keyInsights,
        neighborhoodOverview, communityPulse, visualPoi, mapLabels,
        currentInteriorSummary, analysis, deepResearch,
        handleFullRefresh,
        orientationGroundTruth,
        mergedPropertyData,
        isHealingFema,
    } = useExploreTabData({ propertyData, viewMode, customAnalysis, comprehensiveAnalysis, onRunCustomAnalysis });

    // ── City browse via prop (event listener lives here so it survives loading spinner remounts) ──
    const [pendingBrowse, setPendingBrowse] = React.useState<{ city: string; zip?: string; viewMode?: string } | null>(null);
    React.useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.city) {
                setPendingBrowse({
                    city: detail.city,
                    zip: detail.zip,
                    viewMode: detail.viewMode
                });
            }
        };
        window.addEventListener('browse-city', handler);
        return () => window.removeEventListener('browse-city', handler);
    }, []);

    // ── New 2-level nav state ───────────────────────────────
    const [activeNavSection, setActiveNavSection] = React.useState('property');
    const [activeNavSub, setActiveNavSub] = React.useState('mls-data');

    const handleNavNavigate = React.useCallback((sectionId: string, subId: string) => {
        setActiveNavSection(sectionId);
        setActiveNavSub(subId);
        // Map to the matching page section id for smooth-scroll
        const subToSectionId: Record<string, string> = {
            'lifestyle-vastu': 'property-section-top',
            'mls-data': 'property-section-top',
            'indoor': 'property-section-top',
            'outdoor': 'property-section-top',
            'rooms': 'property-section-top',
            'hazards': 'property-section-top',
            'noise-air': 'property-section-top',
            'solar': 'property-section-top',
            'commute': 'property-section-top',
            'walk-scores': 'property-section-top',
            'internet': 'property-section-top',
            'neighborhood': 'property-section-top',
            'interests': 'property-section-top',
            'whats-nearby': 'property-section-top',
            'community-pulse': 'property-section-top',
            'summary': 'property-section-top',
            'city-neighborhoods': 'property-section-top',
            'economics': 'property-section-top',
            'investment-research': 'property-section-top',
            'graph': 'property-section-top',
        };
        const targetId = subToSectionId[subId];
        if (targetId) {
            setSidebarActiveId(targetId);
            manualScrollRef.current = true;
            if (manualScrollTimer.current) clearTimeout(manualScrollTimer.current);
            manualScrollTimer.current = setTimeout(() => { manualScrollRef.current = false; }, 1000);
            requestAnimationFrame(() => {
                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }, []);

    const navVisibility = {
        hasLifestyle: !!(lifestyleFit || lifestyleInsights),
        hasSchools: !!(schoolsIntelligence?.schools?.length),
        hasOrientation: !!(propertyData as any)?.orientation_ai && isOrientationClear((propertyData as any).orientation_ai),
        hasEnvironment: !!(mergedPropertyData?.windRiskScore || mergedPropertyData?.floodRiskScore || mergedPropertyData?.fireRiskScore || mergedPropertyData?.pollen || mergedPropertyData?.airQuality || (mergedPropertyData as any)?.historical_disasters),
        hasSolar: !!mergedPropertyData?.coordinates,
        hasWalkData: !!(mergedPropertyData?.walkScore || mergedPropertyData?.transitScore || mergedPropertyData?.bikeScore),
        hasBroadband: !!(mergedPropertyData as any)?.broadband,
        hasNeighborhood: !!mergedPropertyData?.neighborhood_identity,
        hasNearby: !!(mergedPropertyData?.google_places || visualPoi || (mapLabels && mapLabels.length > 0)),
        hasCommunityPulse: !!(communityPulse || customAnalysis?.community_pulse),
        hasLtrAnalysis: !!ltrAnalysis,
        hasDeepResearch: !!keyInsights,
    };

    // — Legacy sidebar items (kept for IntersectionObserver scroll tracking) —
    const hasWalkData = !!(propertyData?.walkScore || propertyData?.transitScore || propertyData?.bikeScore);
    const hasBroadband = !!(propertyData as any)?.broadband;
    const hasSchoolsData = !!(schoolsIntelligence?.schools?.length);
    const hasEnvData = !!(propertyData?.windRiskScore || propertyData?.floodRiskScore || propertyData?.fireRiskScore ||
        propertyData?.pollen || propertyData?.airQuality || (propertyData as any)?.historical_disasters);

    const sidebarItems: NavItem[] = [
        { id: 'ov-lifestyle', label: 'Lifestyle & Interests', icon: 'fa-people-roof', visible: !!(lifestyleFit || lifestyleInsights) },
        { id: 'ov-property', label: 'MLS Property Data', icon: 'fa-table-cells-large', visible: true },
        { id: 'ov-environment', label: 'Environment', icon: 'fa-leaf', visible: hasEnvData },
        { id: 'ov-resilience', label: 'Resilience & Hazards', icon: 'fa-shield-halved', visible: hasEnvData },
        { id: 'ov-sun', label: 'Solar Insights', icon: 'fa-sun', visible: !!propertyData?.coordinates },
        { id: 'ov-living', label: 'Daily Living & Commute', icon: 'fa-network-wired', visible: hasWalkData || hasBroadband },
        { id: 'ov-schools', label: 'Schools', icon: 'fa-graduation-cap', visible: hasSchoolsData },
        { id: 'ov-orientation', label: 'Orientation and Vastu', icon: 'fa-compass', visible: !!(propertyData as any)?.orientation_ai && isOrientationClear((propertyData as any).orientation_ai) },
        { id: 'ov-neighborhood', label: 'Neighborhood', icon: 'fa-mountain-sun', visible: !!propertyData?.neighborhood_identity },
        { id: 'ov-rental', label: 'Rent Estimates', icon: 'fa-sack-dollar', visible: !!ltrAnalysis },
        { id: 'ov-nearby', label: "What's Nearby?", icon: 'fa-map-location-dot', visible: !!(propertyData?.google_places || visualPoi || (mapLabels && mapLabels.length > 0)) },
        { id: 'ov-ai-analysis', label: 'Property AI', icon: 'fa-brain', visible: !!(designStyle || keyInsights || ltrAnalysis || ((propertyData as any)?.orientation_ai && isOrientationClear((propertyData as any).orientation_ai)) || neighborhoodOverview || analysis) },
        { id: 'ov-streetview', label: 'Eyes on the Street', icon: 'fa-street-view', visible: !!propertyData?.streetViewAnalysis && propertyData.streetViewAnalysis.isImageryAvailable !== false },
        { id: 'ov-community', label: `${propertyData?.city || 'Community'} Overview`, icon: 'fa-city', visible: true },
    ];

    const [sidebarActiveId, setSidebarActiveId] = React.useState('ov-property');
    // Suppress IntersectionObserver updates while the user has manually clicked a nav item.
    // Without this, smooth-scroll triggers observer events that immediately override the click.
    const manualScrollRef = React.useRef(false);
    const manualScrollTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleNavClick = React.useCallback((id: string) => {
        // Immediately highlight the clicked item
        setSidebarActiveId(id);
        // Block observer for 1s (covers smooth-scroll duration)
        manualScrollRef.current = true;
        if (manualScrollTimer.current) clearTimeout(manualScrollTimer.current);
        manualScrollTimer.current = setTimeout(() => {
            manualScrollRef.current = false;
        }, 1000);
    }, []);

    React.useEffect(() => {
        if (!propertyData) return;
        const ids = sidebarItems.filter(i => i.visible).map(i => i.id);
        const observers: IntersectionObserver[] = [];
        const handleIntersect = (entries: IntersectionObserverEntry[]) => {
            if (manualScrollRef.current) return; // ignore during manual scroll
            const visible = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible.length > 0) setSidebarActiveId(visible[0].target.id);
        };
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const obs = new IntersectionObserver(handleIntersect, {
                rootMargin: '-20px 0px -60% 0px',
                threshold: 0,
            });
            obs.observe(el);
            observers.push(obs);
        });
        return () => observers.forEach(o => o.disconnect());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sidebarItems.map(i => i.id + i.visible).join(','), propertyData?.zpid]);

    const isForSale = !propertyData || !propertyData.homeStatus ||
        propertyData.homeStatus.toUpperCase().includes('FOR_SALE');

    if (propertyData && !isForSale) {
        const statusLabel = propertyData.homeStatus?.replace(/_/g, ' ') ?? 'Not For Sale';
        return (
            <div className="flex flex-col items-center px-6 select-none">
                {/* Search bar at top */}
                {searchBar && (
                    <div className="w-full max-w-4xl mx-auto pt-8 pb-4 sticky top-0 z-[40] bg-[#eef2ff]/80 backdrop-blur-md">
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
                        <div className="bg-gradient-to-r from-indigo-50/60 via-white to-slate-50/40 px-5 py-3 md:px-6 rounded-t-[1.5rem] border-x border-t border-slate-100 shadow-sm">
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
                                    <div className="lg:w-[560px] xl:w-[680px] shrink-0">
                                        {searchBar}
                                    </div>
                                )}
                            </div>
                        </div>

                        <StickyNotesLayer zpid={propertyData?.zpid || ''} activeTab={
                            (activeNavSub === 'indoor-ai' || activeNavSub === 'outdoor-ai')
                                ? activeNavSub
                                : stickyNoteActiveTab
                        }>
                            {(renderPalette) => (<>
                                <div className="flex gap-4 min-h-screen">
                                    <PropertyNav
                                        activeSectionId={activeNavSection}
                                        activeSubId={activeNavSub}
                                        cityName={propertyData?.city}
                                        onNavigate={handleNavNavigate}
                                        visibility={navVisibility}
                                        userRole={userRole}
                                    />
                                    <div className="flex-1 min-w-0 py-4 pr-4 lg:py-6 lg:pr-6">
                                        <PropertySectionView
                                            sectionId={activeNavSection}
                                            subId={activeNavSub}
                                            propertyData={mergedPropertyData || propertyData}
                                            customAnalysis={customAnalysis}
                                            comprehensiveAnalysis={analysis}
                                            communityPulse={communityPulse}
                                            ltrAnalysis={ltrAnalysis}
                                            deepResearch={deepResearch}
                                            renderPalette={renderPalette}
                                            keyInsights={keyInsights}
                                            neighborhoodOverview={neighborhoodOverview}
                                            visualPoi={visualPoi}
                                            mapLabels={mapLabels}
                                            designStyle={designStyle}
                                            currentInteriorSummary={currentInteriorSummary}
                                            census={census}
                                            micro={micro}
                                            lifestyleFit={lifestyleFit}
                                            lifestyleInsights={lifestyleInsights}
                                            lifestyleLoading={lifestyleLoading}
                                            lifestyleFitTab={lifestyleFitTab}
                                            setLifestyleFitTab={setLifestyleFitTab}
                                            lifestyleInterestTab={lifestyleInterestTab}
                                            setLifestyleInterestTab={setLifestyleInterestTab}
                                            handleGenerateLifestyle={handleGenerateLifestyle}
                                            schoolsIntelligence={schoolsIntelligence}
                                            cityNhEntryOverview={cityNhEntryOverview}
                                            pulseExpanded={pulseExpanded}
                                            setPulseExpanded={setPulseExpanded}
                                            isRefreshingPulse={isRefreshingPulse}
                                            setIsRefreshingPulse={setIsRefreshingPulse}
                                            isSatelliteExpanded={isSatelliteExpanded}
                                            setIsSatelliteExpanded={setIsSatelliteExpanded}
                                            groundTruthMapTab={groundTruthMapTab}
                                            setGroundTruthMapTab={setGroundTruthMapTab}
                                            isHealingFema={isHealingFema}
                                            onRunAnalysis={() => onRunCustomAnalysis(false)}
                                            onRefreshAnalysis={() => onRunCustomAnalysis(true)}
                                            onFullRefresh={handleFullRefresh}
                                            onRunComprehensive={() => { onRunComprehensive(false); }}
                                            onRefreshEnvironment={onRefreshEnvironment}
                                            environmentRefreshing={environmentRefreshing}
                                            onRefreshCommunityPulse={onRefreshCommunityPulse}
                                            customAnalysisLoading={customAnalysisLoading}
                                            onUpdateAnalysis={onUpdateAnalysis}
                                            onUpdatePropertyData={onUpdatePropertyData}
                                            addLog={addLog}
                                            isFavorited={isFavorited}
                                            onToggleFavorite={onToggleFavorite}
                                            userRole={userRole}
                                            orientationGroundTruth={orientationGroundTruth}
                                        />
                                    </div>{/* end scrollable content area */}
                                </div>

                            </>)}
                        </StickyNotesLayer>
                    </>
                )}

                {!propertyData && !loading && (
                    <ExplorePage
                        searchBar={searchBar}
                        pendingBrowse={pendingBrowse}
                        onClearPendingBrowse={() => setPendingBrowse(null)}
                        onPropertyClick={onPropertyClick || (() => {})}
                    />
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

