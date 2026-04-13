/**
 * ExploreRow2Cards
 *
 * Lifestyle Fit widget + Row 2 of the Explore overview AI insights strip:
 *   Community Pulse · Market Dynamics · LTR Analysis
 *   Ground Truth Map · Nearby Places · Property Facts
 *
 * Extracted from ExploreTab.tsx for maintainability.
 */
import React from 'react';
import ParcelValidationCard from './ParcelValidationCard';
import StaticParcelMap from './StaticParcelMap';
import PropertyFacts from './PropertyFacts';
import StreetViewAnalysisSection from './StreetViewAnalysisSection';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, DeepResearchInsights } from '../../types';
import { AffordabilityCard } from '../analysis/custom-ai/components/AffordabilityCard';
import { CensusDemographicsCard } from '../analysis/custom-ai/components/CensusDemographicsCard';
import { CensusDemographics } from '../../services/api/environmental';
import { NeighborhoodAnalysis } from '../../types/ai';


interface ExploreRow2CardsProps {
    propertyData: PropertyData;
    analysis: ComprehensiveAnalysisResult | null;
    customAnalysis: CustomAIAnalysisResult | null;
    keyInsights: DeepResearchInsights | null;
    ltrAnalysis: { monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null;
    census: CensusDemographics | null;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    neighborhoodOverview: string | null;
    // Lifestyle Fit
    lifestyleFit: any;
    lifestyleInsights: any;
    lifestyleLoading: boolean;
    lifestyleFitTab: string;
    setLifestyleFitTab: (tab: string) => void;
    lifestyleInterestTab: string;
    setLifestyleInterestTab: (tab: string) => void;
    handleGenerateLifestyle: () => void;
    // UI state
    pulseExpanded: boolean;
    setPulseExpanded: (v: boolean) => void;
    isRefreshingPulse: boolean;
    setIsRefreshingPulse: (v: boolean) => void;
    groundTruthMapTab: 'parcel' | 'satellite';
    setGroundTruthMapTab: (v: 'parcel' | 'satellite') => void;
    userRole?: string;
    onRefreshCommunityPulse?: () => Promise<void>;
    // Ground truth / satellite
    isSatelliteExpanded: boolean;
    setIsSatelliteExpanded: (v: boolean) => void;
    // Street view
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
    /** Which section to render. 'lifestyle' = only the Lifestyle Fit widget.
     *  'insights' = everything EXCEPT the Lifestyle Fit widget.
     *  Default (undefined) = render everything. */
    section?: 'lifestyle' | 'insights';
}


export const ExploreRow2Cards: React.FC<ExploreRow2CardsProps> = ({
    propertyData,
    analysis,
    customAnalysis,
    keyInsights,
    ltrAnalysis,
    census,
    visualPoi,
    mapLabels,
    neighborhoodOverview,
    lifestyleFit,
    lifestyleInsights,
    lifestyleLoading,
    lifestyleFitTab,
    setLifestyleFitTab,
    lifestyleInterestTab,
    setLifestyleInterestTab,
    handleGenerateLifestyle,
    pulseExpanded,
    setPulseExpanded,
    isRefreshingPulse,
    setIsRefreshingPulse,
    groundTruthMapTab,
    setGroundTruthMapTab,
    userRole,
    onRefreshCommunityPulse,
    isSatelliteExpanded,
    setIsSatelliteExpanded,
    onRefreshEnvironment,
    environmentRefreshing,
    section,
}) => {
    return (
        <>
            {/* Row: Split Lifestyle Fit and Interests */}
            {section !== 'insights' && (() => {
                const FIT_TABS = [
                    { key: 'working_professionals', label: 'Working Professionals', icon: 'fa-briefcase', bg: 'bg-sky-100', text: 'text-sky-600' },
                    { key: 'families_with_kids', label: 'Families with Kids', icon: 'fa-children', bg: 'bg-blue-100', text: 'text-blue-600' },
                    { key: 'seniors', label: 'Seniors', icon: 'fa-heart-pulse', bg: 'bg-rose-100', text: 'text-rose-600' },
                ];
                const INTEREST_TABS = [
                    { key: 'outdoor', label: 'Outdoor & Recreation', icon: 'fa-mountain-sun', bg: 'bg-emerald-100', text: 'text-emerald-600' },
                    { key: 'pets', label: 'Pet Friendly', icon: 'fa-paw', bg: 'bg-amber-100', text: 'text-amber-600' },
                    { key: 'food', label: 'Food & Entertainment', icon: 'fa-utensils', bg: 'bg-violet-100', text: 'text-violet-600' },
                ];

                const verdictColors: Record<string, string> = {
                    'Excellent Fit': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    'Good Fit': 'bg-sky-100 text-sky-700 border-sky-200',
                    'Moderate Fit': 'bg-amber-100 text-amber-700 border-amber-200',
                    'Poor Fit': 'bg-orange-100 text-orange-700 border-orange-200',
                    'Not Recommended': 'bg-rose-100 text-rose-700 border-rose-200',
                };

                const hasFitData = lifestyleFit && (lifestyleFit.working_professionals || lifestyleFit.families_with_kids || lifestyleFit.seniors);
                const hasInterestData = lifestyleInsights && (lifestyleInsights.outdoor || lifestyleInsights.pets || lifestyleInsights.food);
                if (!hasFitData && !hasInterestData && !lifestyleLoading) return null;

                const activeFit = FIT_TABS.find(t => t.key === lifestyleFitTab) || FIT_TABS[0];
                const activeInterest = INTEREST_TABS.find(t => t.key === lifestyleInterestTab) || INTEREST_TABS[0];

                const renderTabButton = (tab: any, activeKey: string, setKey: (k: string) => void, isFit: boolean) => {
                    const isActive = tab.key === activeKey;
                    const hasContent = isFit
                        ? (!!lifestyleFit?.[tab.key] || lifestyleLoading)
                        : (!!lifestyleInsights?.[tab.key as keyof typeof lifestyleInsights] || lifestyleLoading);
                    const fitData = isFit ? lifestyleFit?.[tab.key] : null;

                    return (
                        <button
                            key={tab.key}
                            onClick={() => setKey(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-left ${isActive
                                ? `${tab.bg} border-current ${tab.text} shadow-md ring-2 ring-current ring-offset-1`
                                : hasContent
                                    ? 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer shadow-sm'
                                    : 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                                }`}
                            disabled={!hasContent}
                        >
                            <i className={`fa-solid ${tab.icon} ${tab.text} text-[14px]`} />
                            <span className={`text-[13px] font-black whitespace-nowrap ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>{tab.label}</span>
                            {fitData?.verdict && (
                                <span className={`ml-2 px-2 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-wider ${verdictColors[fitData.verdict] || 'bg-slate-100 text-slate-500'}`}>
                                    {fitData.verdict}
                                </span>
                            )}
                        </button>
                    );
                };

                return (
                    <div id="ov-lifestyle" className="flex flex-col gap-1 w-full scroll-mt-20 px-2 select-none">
                        <div className="flex flex-col lg:flex-row gap-3 w-full">
                            {/* Box 1: Lifestyle Fit (3x) */}
                            <div className="flex-1 lg:flex-[3] flex flex-col bg-slate-50 rounded-2xl border-2 border-indigo-200 overflow-hidden">
                                <div className="p-3 flex-1 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shadow-sm">
                                            <i className="fa-solid fa-people-arrows text-indigo-600 text-[14px]" />
                                        </div>
                                        <h3 className="text-[15px] font-black text-slate-900 tracking-tight">Lifestyle Fit</h3>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {FIT_TABS.map(t => renderTabButton(t, lifestyleFitTab, setLifestyleFitTab, true))}
                                    </div>

                                    <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden p-4">
                                        {(() => {
                                            const fitData = lifestyleFit?.[lifestyleFitTab];
                                            if (!fitData) return lifestyleLoading ? (
                                                <div className="space-y-4">
                                                    <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
                                                    <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="h-20 bg-slate-50 rounded animate-pulse" />
                                                        <div className="h-20 bg-slate-50 rounded animate-pulse" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                                                    <i className={`fa-solid ${activeFit.icon} text-2xl mb-2 opacity-20`} />
                                                    <div className="text-[12px] font-bold">No fit analysis available</div>
                                                </div>
                                            );

                                            return (
                                                <div className="flex flex-col gap-3">
                                                    <p className="text-[15px] text-slate-700 leading-relaxed font-bold">{fitData.summary}</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {fitData.strengths?.length > 0 && (
                                                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm">
                                                                <div className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <i className="fa-solid fa-circle-check text-[12px]" /> Pros
                                                                </div>
                                                                <div className="flex flex-col gap-2">
                                                                    {fitData.strengths.map((s: string, i: number) => (
                                                                        <div key={i} className="flex items-start gap-2.5">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                                                                            <span className="text-[14px] text-slate-700 leading-snug">{s}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {fitData.concerns?.length > 0 && (
                                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 shadow-sm">
                                                                <div className="text-[11px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <i className="fa-solid fa-triangle-exclamation text-[12px]" /> Cons
                                                                </div>
                                                                <div className="flex flex-col gap-2">
                                                                    {fitData.concerns.map((c: string, i: number) => (
                                                                        <div key={i} className="flex items-start gap-2.5">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                                                                            <span className="text-[14px] text-slate-700 leading-snug">{c}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {fitData.tip && (
                                                        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
                                                            <i className="fa-solid fa-lightbulb text-[14px] text-indigo-400 mt-1" />
                                                            <span className="text-[14px] text-indigo-700 leading-relaxed font-medium">{fitData.tip}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Box 2: Interests (1x) */}
                            <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border-2 border-indigo-200 overflow-hidden">
                                <div className="p-3 flex-1 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shadow-sm">
                                            <i className="fa-solid fa-star text-emerald-600 text-[14px]" />
                                        </div>
                                        <h3 className="text-[15px] font-black text-slate-900 tracking-tight">Interests</h3>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {INTEREST_TABS.map(t => renderTabButton(t, lifestyleInterestTab, setLifestyleInterestTab, false))}
                                    </div>

                                    <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden p-4">
                                        {(() => {
                                            const nbText = lifestyleInsights?.[lifestyleInterestTab as keyof typeof lifestyleInsights];
                                            if (!nbText) return lifestyleLoading ? (
                                                <div className="space-y-3">
                                                    <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                                                    <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
                                                    <div className="h-4 w-4/6 bg-slate-100 rounded animate-pulse" />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                                                    <i className={`fa-solid ${activeInterest.icon} text-2xl mb-2 opacity-20`} />
                                                    <div className="text-[12px] font-bold">No insights available</div>
                                                </div>
                                            );

                                            return (
                                                <p className="text-[15px] text-slate-700 leading-relaxed text-left font-medium">
                                                    {String(nbText).split(/\*\*(.*?)\*\*/g).map((chunk: string, j: number) => (
                                                        j % 2 === 1 ? <strong key={j} className="font-black text-slate-900 border-b-2 border-emerald-100">{chunk}</strong> : chunk
                                                    ))}
                                                </p>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-[8px] text-slate-500 mt-1 px-4 text-right">MLS + AI Photo Analysis • Google Places • Gemini</div>
                    </div>
                );
            })()}

            {/* Street View + Ground Truth Engine — side by side */}
            {section !== 'lifestyle' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                    {propertyData.streetViewAnalysis && propertyData.streetViewAnalysis.isImageryAvailable !== false && (
                        <div id="ov-streetview" className="rounded-2xl border-2 border-indigo-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 scroll-mt-24">
                            <StreetViewAnalysisSection
                                data={propertyData}
                                onRefresh={onRefreshEnvironment}
                                refreshing={environmentRefreshing}
                            />
                        </div>
                    )}
                    <div id="ov-lot" className="rounded-2xl border-2 border-indigo-200 overflow-hidden bg-white p-4 flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 scroll-mt-24">
                        {/* Ground Truth Engine intro */}
                        <div className="flex items-center gap-3 bg-slate-50/50 rounded-xl border border-slate-100/80 px-4 py-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                <i className="fa-solid fa-shield-halved text-indigo-600 text-[11px]"></i>
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-tight">Lot Intelligence</h3>
                                <p className="text-[13px] text-slate-700 leading-relaxed font-normal mt-0.5">
                                    Lot grades, driveway accessibility, backyard usability, and view potential using Google Elevation and then cross-references parcel data
                                </p>
                            </div>
                        </div>
                        {/* Parcel Map + Validation side by side */}
                        <div className="flex flex-col gap-4 flex-1">
                            <div className="w-full aspect-[4/3] flex flex-col overflow-hidden rounded-xl border border-slate-100">
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
                            <div className="w-full bg-slate-50/50 rounded-xl border border-slate-100/80 hover:bg-white transition-colors duration-300">
                                <ParcelValidationCard propertyData={propertyData} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Row 2: Investment Insights (Dublin Overview) */}
            {section !== 'lifestyle' && (keyInsights || ltrAnalysis || analysis?.detailed_analysis?.community_pulse || lifestyleLoading || propertyData) && (
                <div id="ov-community" className="w-full px-2 rounded-2xl border-2 border-indigo-200 overflow-hidden bg-white scroll-mt-24">
                    {/* Section Heading */}
                    <div className="px-5 pt-5 pb-0 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <i className="fa-solid fa-city text-indigo-500 text-[12px]" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-tight">
                                {propertyData.city || 'City'} Overview
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0 font-medium tracking-tight">Market dynamics, neighborhood sentiment, and community insights</p>
                        </div>
                    </div>

                    {/* Top row: Community Pulse · Market Dynamics · Market Pulse */}
                    <div className="px-5 pb-5 pt-1.5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Community Pulse */}
                        {(customAnalysis?.community_pulse || analysis?.detailed_analysis?.community_pulse || lifestyleLoading) && (
                            <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm h-full">
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                    <i className="fa-solid fa-users text-blue-600 group-hover:text-white text-[12px]"></i>
                                                </div>
                                                <span className="text-[17px] font-black text-slate-900 tracking-tight">Community Pulse</span>
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

                                        {/* Content logic */}
                                        {(() => {
                                            const cp = customAnalysis?.community_pulse as any;
                                            if (!cp) {
                                                if (lifestyleLoading) {
                                                    return (
                                                        <div className="space-y-3">
                                                            <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                                                            <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
                                                        </div>
                                                    );
                                                }
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
                                                ...(cp.safety_and_concerns?.points || [])
                                            ];
                                            const PULSE_LIMIT = 2;
                                            const showPos = pulseExpanded ? positives : positives.slice(0, PULSE_LIMIT);
                                            const showNeg = pulseExpanded ? negatives : negatives.slice(0, PULSE_LIMIT);
                                            const hasMore = positives.length > PULSE_LIMIT || negatives.length > PULSE_LIMIT;

                                            return (
                                                <div className="flex flex-col gap-4">
                                                    <div className="flex flex-col gap-4">
                                                        {positives.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="text-[11px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                                    <i className="fa-solid fa-heart text-[9px]" /> Resident Loves
                                                                </div>
                                                                {showPos.map((item: string, i: number) => (
                                                                    <div key={i} className="bg-emerald-50/50 border border-emerald-100/50 rounded-lg px-3 py-2 text-[12px] text-emerald-800 font-medium leading-snug flex items-start gap-2">
                                                                        <i className="fa-solid fa-check text-emerald-400 text-[10px] mt-1 flex-shrink-0" />
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {negatives.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="text-[11px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                                    <i className="fa-solid fa-circle-exclamation text-[9px]" /> Local Concerns
                                                                </div>
                                                                {showNeg.map((item: string, i: number) => (
                                                                    <div key={i} className="bg-rose-50/50 border border-rose-100/50 rounded-lg px-3 py-2 text-[12px] text-rose-800 font-medium leading-snug flex items-start gap-2">
                                                                        <i className="fa-solid fa-triangle-exclamation text-rose-300 text-[10px] mt-1 flex-shrink-0" />
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {hasMore && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPulseExpanded(!pulseExpanded);
                                                            }}
                                                            className="mt-1 text-[11px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-2 transition-colors border-t border-slate-100 pt-3 w-full justify-center uppercase tracking-widest"
                                                        >
                                                            <span>{pulseExpanded ? 'Condense' : 'Show All Insights'}</span>
                                                            <i className={`fa-solid ${pulseExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[8px]`} />
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
                        {(keyInsights || lifestyleLoading) && (
                            <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm h-full">
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                                <i className="fa-solid fa-chart-line text-indigo-600 group-hover:text-white text-[12px]"></i>
                                            </div>
                                            <span className="text-[17px] font-black text-slate-900 tracking-tight">Market Dynamics</span>
                                        </div>
                                        {(!keyInsights && lifestyleLoading) ? (
                                            <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse mb-3" />
                                        ) : keyInsights?.executive_summary && keyInsights.executive_summary !== 'N/A' && (
                                            <p className="text-[12px] text-slate-600 leading-relaxed mb-4 font-medium italic">&ldquo;{keyInsights.executive_summary.length > 120 ? keyInsights.executive_summary.substring(0, 117) + '...' : keyInsights.executive_summary}&rdquo;</p>
                                        )}
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {(!keyInsights && lifestyleLoading) ? (
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <div key={i} className="h-14 w-full bg-slate-100 rounded-xl animate-pulse border border-slate-100" />
                                                ))
                                            ) : (
                                                [
                                                    { label: 'Median Price', value: keyInsights?.median_price_range, icon: 'fa-tag' },
                                                    { label: '$/sqft', value: keyInsights?.ppsf_benchmark, icon: 'fa-ruler' },
                                                    { label: 'Inventory', value: keyInsights?.months_of_supply, icon: 'fa-warehouse' },
                                                    { label: 'Avg DOM', value: keyInsights?.dom_range, icon: 'fa-calendar' },
                                                ].filter(m => m.value && m.value !== 'N/A').map((m, i) => (
                                                    <div key={i} className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <i className={`fa-solid ${m.icon} text-[10px] text-indigo-300`} />
                                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">{m.label}</span>
                                                        </div>
                                                        <div className="text-[13px] font-black text-slate-800 leading-tight truncate">{m.value}</div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {keyInsights?.risk_tags && keyInsights.risk_tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-4">
                                                {keyInsights.risk_tags.slice(0, 3).map((tag, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-100 rounded-lg text-[10px] font-bold text-rose-600">
                                                        <div className="w-1 h-1 rounded-full bg-rose-400" />
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Affordability & Demographics (Directly in grid) */}
                        <div className="flex flex-col gap-3 px-2">
                             <AffordabilityCard 
                                state={propertyData.state}
                                city={propertyData.city}
                                county={propertyData.county}
                                countyFips={
                                    (propertyData.census_demographics?.stateFips && propertyData.census_demographics?.countyFips)
                                        ? `${propertyData.census_demographics.stateFips}${propertyData.census_demographics.countyFips}`
                                        : (census?.stateFips && census?.countyFips)
                                            ? `${census.stateFips}${census.countyFips}`
                                            : undefined
                                }
                                userId={userRole}
                                compact
                            />
                            {census && (
                                <CensusDemographicsCard 
                                    data={census as any} 
                                    compact 
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {section !== 'lifestyle' && propertyData.resoFacts && (
                <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden">
                    <PropertyFacts facts={propertyData.resoFacts} />
                </div>
            )}
        </>
    );
};
