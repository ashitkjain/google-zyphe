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
    communityPulse: any | null;
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
    onRefreshOrientation?: () => void;
    orientationRefreshing?: boolean;
    userRole?: string;
    onRefreshCommunityPulse?: () => Promise<void>;
    // Lifestyle loading state (used for skeleton guards in Community/Market)
    lifestyleLoading: boolean;
    /** If provided, only renders matching section keys: 'pulse' | 'rental' | 'ai-analysis' */
    showOnly?: string[];
}

export const PropertyInsightsPanel: React.FC<PropertyInsightsPanelProps> = ({
    propertyData,
    analysis,
    customAnalysis,
    communityPulse,
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
    onRefreshOrientation,
    orientationRefreshing,
    userRole,
    onRefreshCommunityPulse,
    lifestyleLoading,
    showOnly,
}) => {
    const show = (key: string) => !showOnly || showOnly.includes(key);
    const [isPulseModalOpen, setIsPulseModalOpen] = React.useState(false);
    return (
        <>
            {/* Street View + Ground Truth Engine */}
            {(show('streetview') || show('lot')) && (
                <div className={`grid gap-8 ${(show('streetview') && show('lot')) ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                    {/* Street View card */}
                    {show('streetview') && propertyData.streetViewAnalysis && propertyData.streetViewAnalysis.isImageryAvailable !== false && (
                        <div id="ov-streetview" className="rounded-2xl border-2 border-indigo-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 scroll-mt-24">
                            <StreetViewAnalysisSection
                                data={propertyData}
                                onRefresh={onRefreshOrientation}
                                refreshing={orientationRefreshing}
                            />
                        </div>
                    )}

                    {/* Lot Intelligence card */}
                    {show('lot') && (
                        <div id="ov-lot" className="rounded-2xl overflow-hidden bg-white p-4 flex flex-col gap-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 scroll-mt-24">
                            {/* Ground Truth Engine intro */}
                            <div className="flex items-center gap-3 bg-slate-50/50 rounded-xl border border-slate-100/80 px-4 py-2.5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                    <i className="fa-solid fa-shield-halved text-indigo-600 text-[11px]"></i>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-[20px] font-black text-slate-900 tracking-tight leading-tight">Lot Intelligence</h3>
                                </div>
                            </div>
                            {/* Parcel Map + Validation */}
                            <div className="flex flex-col gap-8 flex-1">
                                <div className="w-4/5 mx-auto flex flex-col gap-4">
                                    <div className="flex items-center justify-between mb-1">
                                        {/* Tabs — only show if satellite image exists */}
                                        {propertyData.satelliteImageUrl ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setGroundTruthMapTab('parcel')}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groundTruthMapTab === 'parcel'
                                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    <i className="fa-solid fa-map text-[10px]"></i>
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
                                        ) : <div />}

                                        {/* APN display */}
                                        {propertyData.parcelApn && (
                                            <div className="text-[11.5px] text-slate-400 font-mono uppercase tracking-widest">
                                                APN: {propertyData.parcelApn}
                                            </div>
                                        )}
                                    </div>

                                    {/* Map content */}
                                    <div className="h-[375px] w-full relative overflow-hidden rounded-xl border border-slate-100 shadow-inner flex flex-col">
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
                    )}{/* end lot */}
                </div>
            )}{/* end streetview+lot */}


            {/* Affordability + Census only — no outer city overview wrapper */}
            {!show('pulse') && !show('rental') && !show('ai-analysis') && (show('affordability') || show('census')) && (
                <div className="flex flex-col gap-3">
                    {show('affordability') && (
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
                    )}
                    {show('census') && census && (
                        <CensusDemographicsCard
                            data={census as any}
                            compact
                        />
                    )}
                </div>
            )}

            {/* City Overview — Community Pulse · Market Dynamics · Affordability · Census */}
            {(show('pulse') || show('rental') || show('ai-analysis')) && (show('pulse') || show('rental') || show('ai-analysis') || show('affordability') || show('census')) && (keyInsights || ltrAnalysis || analysis?.detailed_analysis?.community_pulse || communityPulse || lifestyleLoading || propertyData) && (
                <div id="ov-community" className="w-full px-2 overflow-hidden bg-transparent scroll-mt-24">
                    {/* Market Dynamics — Full Width High-Density Metrics */}
                    {(keyInsights || lifestyleLoading) && !show('rental') && (
                        <div className="px-5 mt-4 mb-4">
                            <div className="bg-slate-50/50 rounded-2xl p-4 hover:bg-white hover:shadow-xl transition-all duration-300 group">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                                <i className="fa-solid fa-chart-line text-indigo-600 group-hover:text-white text-[14px]"></i>
                                            </div>
                                            <h3 className="text-[17px] font-black text-slate-800 tracking-tight">Market Dynamics</h3>
                                        </div>
                                        {(!keyInsights && lifestyleLoading) ? (
                                            <div className="space-y-2">
                                                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                                                <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
                                            </div>
                                        ) : keyInsights?.executive_summary && keyInsights.executive_summary !== 'N/A' && (
                                            <p className="text-[13px] font-serif italic text-slate-600 leading-relaxed">&ldquo;{keyInsights.executive_summary}&rdquo;</p>
                                        )}
                                    </div>

                                    {/* Risk/Highlights Tags */}
                                    {keyInsights?.risk_tags && keyInsights.risk_tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 md:justify-end max-w-sm">
                                            {keyInsights.risk_tags.slice(0, 3).map((tag: string, i: number) => (
                                                <div key={i} className="px-2.5 py-1 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-1.5 transition-all hover:bg-rose-100">
                                                    <span className="w-1 h-1 rounded-full bg-rose-400" />
                                                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">{tag}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Metrics Row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-2">
                                    {[
                                        { label: 'Median Price', value: keyInsights?.median_price_range, icon: 'fa-tag', color: 'text-slate-400' },
                                        { label: '$/sqft', value: keyInsights?.ppsf_benchmark, icon: 'fa-pen-ruler', color: 'text-indigo-400' },
                                        { label: 'Inventory', value: keyInsights?.months_of_supply, icon: 'fa-warehouse', color: 'text-blue-400' },
                                        { label: 'Avg DOM', value: keyInsights?.dom_range, icon: 'fa-calendar-day', color: 'text-indigo-400' },
                                    ].map((m, i) => (
                                        <div key={i} className="bg-white p-3 rounded-xl border border-slate-100/80 shadow-sm flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <i className={`fa-solid ${m.icon} ${m.color} text-[10px]`} />
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{m.label}</span>
                                            </div>
                                            <div className="text-[15px] font-black text-slate-800 tracking-tight leading-tight">
                                                {m.value || (lifestyleLoading ? "..." : "--")}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Community Pulse (2-col) + right stack (Market Dynamics, Affordability, Census) */}
                    <div className="px-5 pb-2 pt-1.5 grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Community Pulse or Rental Intelligence — L2 title */}
                        {show('rental') && !show('pulse') ? (
                            <div className="lg:col-span-3 flex flex-col gap-4">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Long Term Rental (LTR) Performance */}
                                    <div className="bg-emerald-50/50 rounded-2xl p-4 hover:shadow-lg transition-all group">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                    <i className="fa-solid fa-house-chimney text-[14px]" />
                                                </div>
                                                <div className="text-[13px] font-black text-emerald-600 uppercase tracking-widest">Long Term Rental</div>
                                            </div>
                                            <div className="px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-wider">Stable Yield</div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="p-3 bg-white rounded-xl border border-emerald-100/50 shadow-sm">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-tag text-emerald-300" /> Est. Rent
                                                </div>
                                                <div className="text-[17px] font-black text-slate-800">
                                                    {(() => {
                                                        const rent = ltrAnalysis?.monthly_rent || "";
                                                        const match = rent.match(/\$[\d,]+(?:\s*(?:to|-)\s*\$[\d,]+)?/);
                                                        return match ? match[0] : (rent.length > 20 ? "--" : rent || "--");
                                                    })()}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Per Month</div>
                                            </div>

                                            <div className="p-3 bg-white rounded-xl border border-emerald-100/50 shadow-sm">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-chart-pie text-emerald-300" /> Vacancy
                                                </div>
                                                <div className="text-[17px] font-black text-emerald-600">
                                                    {(() => {
                                                        const v = ltrAnalysis?.vacancy_rate || "";
                                                        const match = v.match(/(\d+(?:-\d+)?%)/);
                                                        return match ? match[1] : (v.length > 10 ? "--" : v || "--");
                                                    })()}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Market Avg</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Short Term (STR) Performance */}
                                    <div className="bg-indigo-50/50 rounded-2xl p-4 hover:shadow-lg transition-all group">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    <i className="fa-solid fa-calendar-check text-[14px]" />
                                                </div>
                                                <div className="text-[13px] font-black text-indigo-600 uppercase tracking-widest">Short Term (STR)</div>
                                            </div>
                                            <div className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[9px] font-black uppercase tracking-wider">High Yield</div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="p-3 bg-white rounded-xl border border-indigo-100/50 shadow-sm">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-sack-dollar text-indigo-300" /> Revenue
                                                </div>
                                                <div className="text-[17px] font-black text-slate-800">
                                                    {(() => {
                                                        const rev = customAnalysis?.property_investment?.str_performance?.annual_revenue_projection || "";
                                                        const matches = rev.match(/\$[\d,]+/g);
                                                        if (matches && matches.length > 0) {
                                                            const sorted = matches
                                                                .map(m => ({ original: m, value: parseInt(m.replace(/[$,]/g, '') || "0") }))
                                                                .sort((a, b) => b.value - a.value);
                                                            return sorted[0].original.replace(/,$/, '');
                                                        }
                                                        return "--";
                                                    })()}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Annual Est.</div>
                                            </div>

                                            <div className="p-3 bg-white rounded-xl border border-indigo-100/50 shadow-sm">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-percent text-indigo-300" /> Occupancy
                                                </div>
                                                <div className="text-[17px] font-black text-indigo-600">
                                                    {(() => {
                                                        const occ = customAnalysis?.property_investment?.str_performance?.occupancy_rate || "";
                                                        const match = occ.match(/(\d+(?:-\d+)?%)/);
                                                        return match ? match[1] : "--";
                                                    })()}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Estimated</div>
                                            </div>

                                            <div className="p-3 bg-white rounded-xl border border-indigo-100/50 shadow-sm">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                    <i className="fa-solid fa-tag text-indigo-300" /> Target ADR
                                                </div>
                                                <div className="text-[17px] font-black text-slate-800">
                                                    {(() => {
                                                        const adrData = customAnalysis?.property_investment?.str_performance;
                                                        const adr = adrData?.adr || (adrData as any)?.target_adr || "";
                                                        const match = adr.match(/\$[\d,]+(?:\s*(?:to|-)\s*\$[\d,]+)?/);
                                                        return match ? match[0].replace(/,$/, '') : (adr.length > 20 ? adr.substring(0, 17) + "..." : adr || "--");
                                                    })()}
                                                </div>
                                                <div className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Daily Rate</div>
                                            </div>
                                        </div>

                                        {/* Footer removed for high-density layout */}
                                    </div>
                                </div>
                            </div>
                        ) : (communityPulse || customAnalysis?.community_pulse || analysis?.detailed_analysis?.community_pulse || lifestyleLoading) && show('pulse') && (
                            <div className="bg-transparent overflow-hidden h-full">
                                    <div className="p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                                    <i className="fa-solid fa-users text-blue-600 group-hover:text-white text-[13px]"></i>
                                                </div>
                                                <span className="text-[18px] font-bold text-slate-800 tracking-tight">Community Pulse</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setIsPulseModalOpen(true)}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                                >
                                                    Details
                                                </button>
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
                                        </div>

                                        {(() => {
                                            const cp = communityPulse || (customAnalysis?.community_pulse as any);
                                            const fallbackText = analysis?.detailed_analysis?.community_pulse;

                                            if (lifestyleLoading) {
                                                return (
                                                    <div className="space-y-3">
                                                        <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                                                        <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
                                                    </div>
                                                );
                                            }

                                            if (!cp && !fallbackText) return null;

                                            const positives: string[] = cp?.what_residents_like?.points || [];
                                            const complaints: string[] = cp?.common_complaints?.points || [];
                                            const safety: string[] = cp?.safety_and_concerns?.points || [];
                                            const summary: string | null = cp?.summary || cp?.overview || (cp ? null : fallbackText) || null;

                                            return (
                                                <div className="flex flex-col gap-6">
                                                    {/* Full-width summary */}
                                                    {summary && (
                                                        <p className="text-[16px] text-slate-600 leading-relaxed font-sans font-medium pb-2">
                                                            {summary}
                                                        </p>
                                                    )}

                                                    {/* 3-column breakdown */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                                        {/* What Residents Like — emerald */}
                                                        {positives.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="text-[12px] font-black uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                                    <i className="fa-solid fa-heart text-[10px]" /> Resident Loves
                                                                </div>
                                                                {positives.map((item: string, i: number) => (
                                                                    <div key={i} className="py-2 text-[14.5px] font-medium leading-snug flex items-start gap-2">
                                                                        <i className="fa-solid fa-check text-emerald-400 text-[10px] mt-1 flex-shrink-0" />
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Common Complaints — pink/red only */}
                                                        {complaints.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="text-[11px] font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                                    <i className="fa-solid fa-flag text-[10px]" /> Common Complaints
                                                                </div>
                                                                {complaints.map((item: string, i: number) => (
                                                                    <div key={i} className="py-2 text-[13px] text-rose-900 font-medium leading-snug flex items-start gap-2">
                                                                        <i className="fa-solid fa-flag text-rose-400 text-[10px] mt-1 flex-shrink-0" />
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Safety & Concerns — neutral slate */}
                                                        {safety.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="text-[12px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                                    <i className="fa-solid fa-shield-halved text-[11px]" /> Safety &amp; Concerns
                                                                </div>
                                                                {safety.map((item: string, i: number) => (
                                                                    <div key={i} className="py-2 text-[14.5px] text-slate-700 font-medium leading-snug flex items-start gap-2">
                                                                        <i className="fa-solid fa-shield-halved text-slate-400 text-[10px] mt-1 flex-shrink-0" />
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                            </div>
                        )}

                        {/* Right column — Affordability + Census */}
                        <div className="flex flex-col gap-6">

                            {/* Affordability + Census Demographics */}
                            <div className="flex flex-col gap-3 px-2">
                                {show('affordability') && (
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
                                    />)}
                                {show('census') && census && (
                                    <CensusDemographicsCard
                                        data={census as any}
                                        compact
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Property Facts */}
            {propertyData.resoFacts && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 scroll-mt-24 bg-white shadow-sm">
                    <PropertyFacts facts={propertyData.resoFacts} />
                </div>
            )}

            <PulseModal
                isOpen={isPulseModalOpen}
                onClose={() => setIsPulseModalOpen(false)}
                analysis={analysis}
                city={propertyData.city || 'Dublin'}
            />
        </>
    );
};

interface PulseModalProps {
    isOpen: boolean;
    onClose: () => void;
    analysis: ComprehensiveAnalysisResult | null;
    city: string;
}

const PulseModal: React.FC<PulseModalProps> = ({ isOpen, onClose, analysis, city }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
            <div
                className="relative max-w-2xl w-full bg-white rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col"
                style={{ maxHeight: '85vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="px-8 pt-8 pb-4 border-b border-slate-100 relative shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
                    >
                        <i className="fa-solid fa-xmark text-sm" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <i className="fa-solid fa-users text-blue-600 text-[14px]" />
                        </div>
                        <div>
                            <h2 className="text-[20px] font-black text-slate-800 tracking-tight">Community Pulse</h2>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{city} · Full Resident Sentiment Report</div>
                        </div>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-8 overflow-y-auto bg-slate-50/30">
                    <div className="space-y-6">
                        {analysis?.detailed_analysis?.community_pulse ? (
                            <div className="space-y-4">
                                <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fa-solid fa-file-lines" /> Full Analysis Overview
                                </div>
                                <p className="text-[14px] text-slate-600 leading-relaxed font-medium">
                                    {analysis.detailed_analysis.community_pulse.split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                        j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                                    ))}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <i className="fa-solid fa-inbox text-2xl mb-2 opacity-20" />
                                <div className="text-sm font-medium">No detailed overview available yet.</div>
                            </div>
                        )}

                        <div className="pt-6 border-t border-slate-200/60 flex items-center justify-between text-[9px] text-slate-400">
                            <div className="flex items-center gap-2 uppercase font-black tracking-widest">
                                <i className="fa-solid fa-shield-halved text-blue-400" /> Zyphe Ground Truth Unit
                            </div>
                            <div className="font-sans font-bold">2026 EDITION</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
