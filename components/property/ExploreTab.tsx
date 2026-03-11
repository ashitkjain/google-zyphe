import React from 'react';
import PropertyHeader from './PropertyHeader';
import PropertyImages from './PropertyImages';
import PropertyFacts from './PropertyFacts';
import AirQualitySection from './AirQualitySection';
import PropertyDescription from './PropertyDescription';
import StreetViewAnalysisSection from './StreetViewAnalysisSection';
import PropertyMaps from './PropertyMaps';
import Logo from '../shared/Logo';
import CustomAIAnalysis from '../analysis/CustomAIAnalysis';
import ComprehensiveAnalysis from '../analysis/ComprehensiveAnalysis';
import ComplianceAttribution from './ComplianceAttribution';
import NeighborhoodPlacesSection from './NeighborhoodPlacesSection';


import ChatInterface from '../shared/ChatInterface';
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, LogEntry } from '../../types';

interface ExploreTabProps {
    propertyData: PropertyData | null;
    loading: boolean;
    loadingSublabel: string;
    viewMode: 'main' | 'visual-report' | 'comprehensive-report';
    setViewMode: (mode: 'main' | 'visual-report' | 'comprehensive-report') => void;
    imagesLoading: boolean;
    isFavorited: boolean;
    onToggleFavorite: () => void;
    onRunCustomAnalysis: (force?: boolean) => void;
    customAnalysis: CustomAIAnalysisResult | null;
    customAnalysisLoading: boolean;
    onRunComprehensive: (force?: boolean) => void;
    comprehensiveAnalysis: ComprehensiveAnalysisResult | null;
    comprehensiveLoading: boolean;
    onUpdateAnalysis: (updated: any) => void;
    addLog: (service: string, meta: any, content: any) => void;
    logs: LogEntry[];
    userRole?: string;
    searchBar?: React.ReactNode;
    address?: string;
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
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
    addLog,
    logs,
    userRole,
    searchBar,
    address: currentAddress,
    onRefreshEnvironment,
    environmentRefreshing
}) => {
    // Determine if the property is actively listed for sale
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
            {viewMode === 'main' && (
                <div className="animate-in fade-in duration-500">
                    {searchBar && (
                        <div className="max-w-5xl mx-auto pt-4 pb-2 px-3 sticky top-0 z-[40] bg-slate-50/80 backdrop-blur-md">
                            {searchBar}
                        </div>
                    )}
                    {propertyData ? (
                        <>
                            {/* Deprecated banner — property is sold / no longer active in the market */}
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
                            <PropertyHeader
                                data={propertyData}
                                isFavorited={isFavorited}
                                onToggleFavorite={onToggleFavorite}
                                onRunAnalysis={() => onRunCustomAnalysis(false)}
                                parcelPolygon={
                                    propertyData.parcelPolygon && propertyData.parcelPolygon.length > 3
                                        ? propertyData.parcelPolygon.map((pt: any) =>
                                            Array.isArray(pt) ? pt : [pt.lon, pt.lat]
                                        )
                                        : undefined
                                }
                            />
                            <AirQualitySection data={propertyData} neighborhoodOverview={customAnalysis?.neighborhood?.overview} />
                            <NeighborhoodPlacesSection data={propertyData} mapZoomOut={propertyData.mapZoomOut} address={propertyData.address} />
                            <StreetViewAnalysisSection
                                data={propertyData}
                                onRefresh={onRefreshEnvironment}
                                refreshing={environmentRefreshing}
                            />
                            <PropertyImages images={propertyData.images} loading={imagesLoading} attribution={propertyData.attribution} />
                            <PropertyFacts facts={propertyData.resoFacts} />

                            <PropertyMaps
                                mapZoomIn={propertyData.mapZoomIn}
                                mapZoomOut={propertyData.mapZoomOut}
                                coordinates={propertyData.coordinates}
                                address={propertyData.address}
                                solarData={propertyData.solarData}
                                parcelPolygon={
                                    propertyData.parcelPolygon && propertyData.parcelPolygon.length > 3
                                        ? propertyData.parcelPolygon.map((pt: any) =>
                                            Array.isArray(pt) ? pt : [pt.lon, pt.lat]
                                        )
                                        : undefined
                                }
                                parcelApn={propertyData.parcelApn}
                                parcelAreaSqft={propertyData.parcelAreaSqft}
                            />
                            <ComplianceAttribution data={propertyData} />
                        </>
                    ) : (
                        <div className="max-w-4xl mx-auto py-6 text-center space-y-12">
                            <p className="text-2xl text-slate-500 font-medium leading-relaxed">The world's most advanced property analysis suite.</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                                {[
                                    { title: 'For Buyers', icon: 'fa-shopping-bag', color: 'indigo', desc: "Navigate the market with unmatched clarity. Our AI cross-references public records, maps and property pictures, and resident sentiment to uncover hidden structural risks, neighborhood, community pulse on what people like and don't, and score lifestyle compatibility for your family." },
                                    { title: 'For Sellers', icon: 'fa-money-bill-trend-up', color: 'slate', desc: 'Discover how to maximize your home value with AI-driven staging and market insights.' },
                                    { title: 'For Realtors', icon: 'fa-briefcase', color: 'indigo', desc: 'Provide comprehensive home report, concierge chat box to your clients and track their preferences. Generate professional multi-source reports and compelling marketing copy in seconds.' }
                                ].map((item, i) => (
                                    <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:-translate-y-2 transition-all group">
                                        <div className={`w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                            <i className={`fa-solid ${item.icon} text-2xl`}></i>
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-4">{item.title}</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed font-medium">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'visual-report' && (
                <CustomAIAnalysis
                    analysis={customAnalysis}
                    loading={customAnalysisLoading}
                    onBack={() => setViewMode('main')}
                    onRefresh={() => onRunCustomAnalysis(true)}
                    onRunComprehensive={() => onRunComprehensive(false)}
                    comprehensiveResult={comprehensiveAnalysis}
                    hasImages={(propertyData?.images?.length || 0) > 0}
                    userRole={userRole}
                    propertyImages={propertyData?.images}
                    zpid={propertyData?.zpid}
                    propertyData={propertyData}
                    onUpdateAnalysis={onUpdateAnalysis}
                    addLog={addLog}
                    isFavorited={isFavorited}
                    onToggleFavorite={onToggleFavorite}
                />
            )}

            {viewMode === 'comprehensive-report' && (
                <ComprehensiveAnalysis
                    analysis={comprehensiveAnalysis}
                    loading={comprehensiveLoading}
                    onBack={() => setViewMode('visual-report')}
                    isFavorited={isFavorited}
                    onToggleFavorite={onToggleFavorite}
                />
            )}

            {propertyData && (
                <ChatInterface property={propertyData} visual={customAnalysis} comprehensive={comprehensiveAnalysis} />
            )}
        </>
    );
};

export default ExploreTab;
