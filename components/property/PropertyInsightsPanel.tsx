/**
 * PropertyInsightsPanel
 *
 * Renders the Street View, Lot Intelligence (Ground Truth), City Overview,
 * Community Pulse, Market Dynamics, Affordability, Census Demographics,
 * and Property Facts sections on the property Overview tab.
 *
 * Extracted from ExploreRow2Cards.tsx ('insights' section) for clarity and maintainability.
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

interface PropertyInsightsPanelProps {
    propertyData: PropertyData;
    analysis: ComprehensiveAnalysisResult | null;
    customAnalysis: CustomAIAnalysisResult | null;
    keyInsights: DeepResearchInsights | null;
    ltrAnalysis: { monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null;
    census: CensusDemographics | null;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    neighborhoodOverview: string | null;
    // UI state
    pulseExpanded: boolean;
    setPulseExpanded: (v: boolean) => void;
    isRefreshingPulse: boolean;
    setIsRefreshingPulse: (v: boolean) => void;
    groundTruthMapTab: 'parcel' | 'satellite';
    setGroundTruthMapTab: (v: 'parcel' | 'satellite') => void;
    isSatelliteExpanded: boolean;
    setIsSatelliteExpanded: (v: boolean) => void;
    // Refresh callbacks
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
    userRole?: string;
    onRefreshCommunityPulse?: () => Promise<void>;
    // Lifestyle loading state (used for skeleton guards in Community/Market)
    lifestyleLoading: boolean;
}

export const PropertyInsightsPanel: React.FC<PropertyInsightsPanelProps> = ({
    propertyData,
    analysis,
    customAnalysis,
    keyInsights,
    ltrAnalysis,
    census,
    neighborhoodOverview,
    pulseExpanded,
    setPulseExpanded,
    isRefreshingPulse,
    setIsRefreshingPulse,
    groundTruthMapTab,
    setGroundTruthMapTab,
    isSatelliteExpanded,
    setIsSatelliteExpanded,
    onRefreshEnvironment,
    environmentRefreshing,
    userRole,
    onRefreshCommunityPulse,
    lifestyleLoading,
}) => {
    return (
        <>
            {/* Street View + Ground Truth Engine — side by side */}
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
                            <h3 className="text-[18px] font-black text-slate-900 tracking-tight leading-tight">Lot Intelligence</h3>
                            <p className="text-[10px] text-slate-400 leading-relaxed font-sans font-medium mt-1 italic">
                                Measures how steep your lot is, whether the driveway is easy to use, how flat and usable the backyard is, whether the property has good views — using Google Elevation data, and lot and living area sq ft from county records.
                            </p>
                        </div>
                    </div>
                    {/* Parcel Map + Validation */}
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
                                                    <div className="h-16 bg-white w-full flex-shrink-0" />
                                                    <div className="flex-1 overflow-hidden bg-slate-50 flex items-center justify-center relative p-4">
                                                        <img
                                                            src={propertyData.satelliteImageUrl}
                                                            alt="Expanded Satellite View"
                                                            className="max-w-full max-h-full w-auto h-auto object-contain rounded-2xl"
                                                        />
                                                    </div>
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

            {/* City Overview — Community Pulse · Market Dynamics · Affordability · Census */}
            {(keyInsights || ltrAnalysis || analysis?.detailed_analysis?.community_pulse || lifestyleLoading || propertyData) && (
                <div id="ov-community" className="w-full px-2 rounded-2xl border-2 border-indigo-200 overflow-hidden bg-white scroll-mt-24">
                    {/* Section Heading — L1 */}
                    <div className="px-5 pt-5 pb-0 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <i className="fa-solid fa-city text-indigo-500 text-[12px]" />
                        </div>
                        <div>
                            <h3 className="text-[22px] font-black text-slate-900 tracking-tight leading-tight">
                                {propertyData.city || 'City'} Overview
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0 font-medium tracking-tight">Market dynamics, neighborhood sentiment, and community insights</p>
                        </div>
                    </div>

                    {/* Three-col grid: Community Pulse · Market Dynamics · Affordability+Census */}
                    <div className="px-5 pb-5 pt-1.5 grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Community Pulse — L2 title */}
                        {(customAnalysis?.community_pulse || analysis?.detailed_analysis?.community_pulse || lifestyleLoading) && (
                            <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm h-full">
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                    <i className="fa-solid fa-users text-blue-600 group-hover:text-white text-[12px]"></i>
                                                </div>
                                                <span className="text-[14px] font-bold text-slate-800 tracking-tight">Community Pulse</span>
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
                                                                <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1.5 flex items-center gap-2">
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
                                                                <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
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
                                                            className="mt-1 text-[9px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-2 transition-colors border-t border-slate-100 pt-3 w-full justify-center uppercase tracking-widest"
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

                        {/* Market Dynamics — L2 title */}
                        {(keyInsights || lifestyleLoading) && (
                            <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm h-full">
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                                <i className="fa-solid fa-chart-line text-indigo-600 group-hover:text-white text-[12px]"></i>
                                            </div>
                                            <span className="text-[14px] font-bold text-slate-800 tracking-tight">Market Dynamics</span>
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
                                                        <div className="text-[13px] font-black text-slate-800 leading-snug">{m.value}</div>
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

                        {/* Affordability + Census Demographics — L2 title (handled inside AffordabilityCard) */}
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

            {/* Property Facts */}
            {propertyData.resoFacts && (
                <div className="rounded-2xl border-2 border-indigo-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 scroll-mt-24">
                    <PropertyFacts facts={propertyData.resoFacts} />
                </div>
            )}
        </>
    );
};
