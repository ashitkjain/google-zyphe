import React, { useState, useEffect } from 'react';
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
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult, LogEntry, DeepResearchInsights } from '../../types';

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
    // Fetch design_style, market dynamics, and LTR from cloud cache if customAnalysis is not loaded
    const [cachedDesignStyle, setCachedDesignStyle] = useState<{ style?: string; reasoning?: string } | null>(null);
    const [cachedMarketDynamics, setCachedMarketDynamics] = useState<{ summary?: string; details?: string[] } | null>(null);
    const [cachedLtrAnalysis, setCachedLtrAnalysis] = useState<{ monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null>(null);
    const [cachedKeyInsights, setCachedKeyInsights] = useState<DeepResearchInsights | null>(null);
    const [cachedNeighborhoodOverview, setCachedNeighborhoodOverview] = useState<string | null>(null);

    useEffect(() => {
        if (customAnalysis) {
            console.log('[ExploreTab Cache] customAnalysis is loaded, skipping cache fetch');
            setCachedDesignStyle(null);
            setCachedMarketDynamics(null);
            setCachedLtrAnalysis(null);
            setCachedKeyInsights(null);
            setCachedNeighborhoodOverview(null);
            return;
        }
        if (!propertyData?.zpid) return;

        let cancelled = false;
        (async () => {
            try {
                const {
                    getVisualAnalysisFromCloud,
                    getPropertyInvestmentFromCloud,
                    getDeepInvestmentResearchFromCloud
                } = await import('../../services/firebase/properties');
                const { generateCityStateKey } = await import('../../services/firebase/config');

                // Build city-state key for city-level collections
                const cityStateKey = generateCityStateKey(propertyData.city, propertyData.state);
                console.log('[ExploreTab Cache] Fetching cache data:', {
                    zpid: propertyData.zpid,
                    city: propertyData.city,
                    state: propertyData.state,
                    cityStateKey
                });

                const [visualCache, investmentCache, deepResearchCache] = await Promise.all([
                    getVisualAnalysisFromCloud(String(propertyData.zpid)),
                    getPropertyInvestmentFromCloud(String(propertyData.zpid)),
                    cityStateKey ? getDeepInvestmentResearchFromCloud(cityStateKey) : Promise.resolve(null)
                ]);

                console.log('[ExploreTab Cache] hasDeepResearch:', !!deepResearchCache);
                console.log('[ExploreTab Cache] deepResearch keys:', deepResearchCache ? Object.keys(deepResearchCache) : 'null');
                console.log('[ExploreTab Cache] hasStructuredReport:', !!deepResearchCache?.structured_report);
                console.log('[ExploreTab Cache] structuredReport keys:', deepResearchCache?.structured_report ? Object.keys(deepResearchCache.structured_report) : 'none');
                console.log('[ExploreTab Cache] hasMarketDynamics:', !!deepResearchCache?.structured_report?.market_dynamics);
                console.log('[ExploreTab Cache] marketDynamics:', deepResearchCache?.structured_report?.market_dynamics);

                if (cancelled) return;

                if (visualCache?.home_interior?.design_style) {
                    setCachedDesignStyle(visualCache.home_interior.design_style);
                }
                if (visualCache?.neighborhood?.overview) {
                    setCachedNeighborhoodOverview(visualCache.neighborhood.overview);
                }
                if (deepResearchCache?.structured_report?.market_dynamics) {
                    setCachedMarketDynamics(deepResearchCache.structured_report.market_dynamics);
                }
                if ((deepResearchCache as any)?.key_insights) {
                    setCachedKeyInsights((deepResearchCache as any).key_insights);
                } else if (deepResearchCache?.content && deepResearchCache.content.length > 200 && cityStateKey) {
                    // Backfill: extract key insights on-the-fly from existing research
                    console.log('[ExploreTab Cache] No key_insights found — extracting on-the-fly...');
                    try {
                        const { extractDeepResearchInsights } = await import('../../services/geminiService');
                        const insightsRes = await extractDeepResearchInsights(deepResearchCache.content, 'cache-backfill', cityStateKey);
                        if (insightsRes.data && !cancelled) {
                            setCachedKeyInsights(insightsRes.data);
                            // Save back to Firestore for next time
                            const { doc: firestoreDoc, setDoc: firestoreSetDoc } = await import('firebase/firestore');
                            const { db } = await import('../../services/firebase/config');
                            if (db) {
                                const docRef = firestoreDoc(db, "deep_investment_research", cityStateKey);
                                await firestoreSetDoc(docRef, { key_insights: insightsRes.data }, { merge: true });
                                console.log('[ExploreTab Cache] Key insights extracted and saved.');
                            }
                        }
                    } catch (insightErr) {
                        console.warn('[ExploreTab Cache] On-the-fly insights extraction failed:', insightErr);
                    }
                }
                if (investmentCache?.ltr_analysis) {
                    setCachedLtrAnalysis(investmentCache.ltr_analysis);
                }
            } catch (e) {
                console.error('[ExploreTab Cache] Error fetching cache:', e);
            }
        })();
        return () => { cancelled = true; };
    }, [propertyData?.zpid, customAnalysis]);

    const designStyle = customAnalysis?.home_interior?.design_style || cachedDesignStyle || null;
    const marketDynamics = customAnalysis?.deep_investment_research?.structured_report?.market_dynamics || cachedMarketDynamics || null;
    const ltrAnalysis = customAnalysis?.property_investment?.ltr_analysis || cachedLtrAnalysis || null;
    const keyInsights = cachedKeyInsights || null;
    const neighborhoodOverview = customAnalysis?.neighborhood?.overview || cachedNeighborhoodOverview || null;

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
                                designStyle={designStyle}
                                marketDynamics={marketDynamics}
                                parcelPolygon={
                                    propertyData.parcelPolygon && propertyData.parcelPolygon.length > 3
                                        ? propertyData.parcelPolygon.map((pt: any) =>
                                            Array.isArray(pt) ? pt : [pt.lon, pt.lat]
                                        )
                                        : undefined
                                }
                            />

                            {/* Horizontal Insight Strip — 4 cards in a row */}
                            {(designStyle || keyInsights || ltrAnalysis || neighborhoodOverview) && (
                                <div className="max-w-[1400px] mx-auto px-2 -mt-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                                        {/* Design Philosophy */}
                                        {designStyle?.style && (
                                            <div className="flex flex-col gap-3 bg-slate-50/30 rounded-xl border border-slate-100/80 p-3">
                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                    <div className="p-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                                                <i className="fa-solid fa-palette text-indigo-600 text-[11px]"></i>
                                                            </div>
                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Design Philosophy</span>
                                                        </div>
                                                        <span className="inline-block bg-indigo-100 text-indigo-700 text-[11px] font-black uppercase px-2.5 py-1 rounded-full mb-2">{designStyle.style}</span>
                                                        {designStyle.reasoning && (
                                                            <p className="text-[13px] text-slate-600 leading-relaxed line-clamp-3">{designStyle.reasoning}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Market Insights */}
                                        {keyInsights && (
                                            <div className="flex flex-col gap-3 bg-slate-50/30 rounded-xl border border-slate-100/80 p-3">
                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                    <div className="p-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                                                                <i className="fa-solid fa-microscope text-violet-600 text-[11px]"></i>
                                                            </div>
                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Market Insights</span>
                                                        </div>
                                                        {keyInsights.executive_summary && keyInsights.executive_summary !== 'N/A' && (
                                                            <p className="text-[13px] text-slate-600 leading-relaxed mb-3 italic line-clamp-2">{keyInsights.executive_summary}</p>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {[
                                                                { label: 'Median', value: keyInsights.median_price_range },
                                                                { label: 'PPSF', value: keyInsights.ppsf_benchmark },
                                                                { label: 'Supply', value: keyInsights.months_of_supply },
                                                                { label: 'DOM', value: keyInsights.dom_range },
                                                            ].filter(m => m.value && m.value !== 'N/A').map((m, i) => (
                                                                <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                    <div className="min-w-0">
                                                                        <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">{m.label}</div>
                                                                        <div className="text-[13px] font-normal text-slate-800 leading-snug">{m.value}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {keyInsights.risk_tags && keyInsights.risk_tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-3">
                                                                {keyInsights.risk_tags.slice(0, 3).map((tag, i) => (
                                                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 border border-rose-100 rounded-lg text-[11px] font-semibold text-rose-600">
                                                                        <i className="fa-solid fa-triangle-exclamation text-[9px] opacity-50"></i>
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Long Term Rental */}
                                        {ltrAnalysis && (ltrAnalysis.monthly_rent || ltrAnalysis.vacancy_rate) && (
                                            <div className="flex flex-col gap-3 bg-slate-50/30 rounded-xl border border-slate-100/80 p-3">
                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                    <div className="p-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                                <i className="fa-solid fa-house-circle-check text-emerald-600 text-[11px]"></i>
                                                            </div>
                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Long Term Rental</span>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {ltrAnalysis.monthly_rent && (
                                                                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                    <i className="fa-solid fa-dollar-sign text-[10px] text-emerald-400"></i>
                                                                    <div className="min-w-0">
                                                                        <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Monthly Rent</div>
                                                                        <div className="text-[13px] font-normal text-slate-800 leading-snug">{ltrAnalysis.monthly_rent}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {ltrAnalysis.vacancy_rate && (
                                                                <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                                                    <i className="fa-solid fa-chart-pie text-[10px] text-slate-300"></i>
                                                                    <div className="min-w-0">
                                                                        <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Vacancy Rate</div>
                                                                        <div className="text-[13px] font-normal text-slate-800 leading-snug">{ltrAnalysis.vacancy_rate}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Neighborhood Overview */}
                                        {neighborhoodOverview && (
                                            <div className="flex flex-col gap-3 bg-slate-50/30 rounded-xl border border-slate-100/80 p-3">
                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                    <div className="p-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                                                                <i className="fa-solid fa-map-location-dot text-amber-600 text-[11px]"></i>
                                                            </div>
                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Neighborhood</span>
                                                        </div>
                                                        <p className="text-[13px] text-slate-600 leading-relaxed line-clamp-5">{neighborhoodOverview}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <AirQualitySection data={propertyData} neighborhoodOverview={neighborhoodOverview} />
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
