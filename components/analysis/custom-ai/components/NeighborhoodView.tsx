import React from 'react';
import { CustomAIAnalysisResult, PropertyData } from '../../../../types';
import { EmptyState } from './CommonComponents';
import StaticParcelMap from '../../../property/StaticParcelMap';
import NeighborhoodPlacesSection from '../../../property/NeighborhoodPlacesSection';
import HistoricalDisasterSection from '../../../property/HistoricalDisasterSection';

interface NeighborhoodViewProps {
    data: CustomAIAnalysisResult['neighborhood'];
    mapZoomIn?: string;
    mapZoomOut?: string;
    propertyData?: PropertyData;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    timer?: number;
}

export const NeighborhoodView: React.FC<NeighborhoodViewProps> = ({ data, mapZoomIn, mapZoomOut, propertyData, onRefresh, isRefreshing, timer }) => {
    const [selectedMap, setSelectedMap] = React.useState<{ url: string, title: string, isZoomIn?: boolean } | null>(null);
    const [cityNhEntry, setCityNhEntry] = React.useState<any>(null);

    if (!data?.overview) return <EmptyState section="Neighborhood" />;

    // Neighborhood Identity data (from Gemini grounded + city plan + surveyor tract)
    const identity = propertyData?.neighborhood_identity;
    const cityPlan = identity?.city_plan;
    const surveyorTract = identity?.surveyor_tract;
    const resolvedName = identity?.resolved_name;

    // Fetch matching entry from city_neighborhoods table
    React.useEffect(() => {
        if (!resolvedName || !propertyData?.city || !propertyData?.state) return;
        (async () => {
            try {
                const { generateCityStateKey } = await import('../../../../services/firebase/config');
                const { getCityNeighborhoodsFromCloud } = await import('../../../../services/firebase/properties');
                const key = generateCityStateKey(propertyData.city, propertyData.state);
                if (!key) return;
                const cityData = await getCityNeighborhoodsFromCloud(key);
                if (cityData?.neighborhoods?.length) {
                    const match = cityData.neighborhoods.find((n: any) =>
                        n.neighborhood_name?.toLowerCase() === resolvedName.toLowerCase()
                    );
                    if (match) setCityNhEntry(match);
                }
            } catch (e) {
                console.warn('[NeighborhoodView] City neighborhoods lookup failed:', e);
            }
        })();
    }, [resolvedName, propertyData?.city, propertyData?.state]);

    // Use city-level mined data if available, fall back to per-property gemini data
    const gemini = cityNhEntry || identity?.gemini;

    // Normalize parcelPolygon for use with StaticParcelMap
    const parcelPolygon = React.useMemo(() => {
        const raw = propertyData?.parcelPolygon;
        if (!raw || !Array.isArray(raw) || raw.length < 3) return undefined;
        return raw.map((pt: any) => Array.isArray(pt) ? pt : [pt.lon, pt.lat]) as [number, number][];
    }, [propertyData]);

    // Price tier color mapping
    const tierColors: Record<string, string> = {
        'Entry-Level': 'bg-emerald-100 text-emerald-700',
        'Mid-Range': 'bg-blue-100 text-blue-700',
        'Upper Mid-Range': 'bg-indigo-100 text-indigo-700',
        'Premium': 'bg-amber-100 text-amber-700',
        'Ultra-Luxury': 'bg-purple-100 text-purple-700',
    };

    return (
        <section className="space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">

                {/* ── Overview ───────────────────────────────── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-2xl font-black text-indigo-600 uppercase tracking-[0.3em]">OVERVIEW</div>
                        {onRefresh && (
                            <button
                                onClick={onRefresh}
                                disabled={isRefreshing}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${isRefreshing ? 'bg-indigo-50 text-indigo-400' : 'bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-100 shadow-sm'}`}
                            >
                                <i className={`fa-solid fa-rotate ${isRefreshing ? 'animate-spin' : ''}`} />
                                {isRefreshing ? `Refreshing (${timer}s)...` : 'Refresh Insight'}
                            </button>
                        )}
                    </div>
                    <p className="text-gray-800 font-sans font-normal text-[14px] leading-[1.625]">{data.overview}</p>
                </div>

                {/* ── Maps row (3 across) ──────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {mapZoomIn && (
                        <div
                            onClick={() => setSelectedMap({ url: mapZoomIn, title: 'Property Close-up Map', isZoomIn: true })}
                            className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner group relative aspect-square cursor-zoom-in active:scale-[0.98] transition-all"
                        >
                            {propertyData ? (
                                <StaticParcelMap
                                    data={propertyData}
                                    parcelPolygon={parcelPolygon}
                                    className="w-full h-full"
                                />
                            ) : (
                                <img src={mapZoomIn} alt="Property Close-up Map" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            )}
                            <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20 z-10">
                                <i className="fa-solid fa-map mr-1.5" /> Close-up
                            </div>
                            <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 flex items-center justify-center transition-all duration-300 z-10">
                                <i className="fa-solid fa-magnifying-glass-plus text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    )}
                    {mapZoomOut && (
                        <div
                            onClick={() => setSelectedMap({ url: mapZoomOut, title: 'Neighborhood Map', isZoomIn: false })}
                            className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner group relative aspect-square cursor-zoom-in active:scale-[0.98] transition-all"
                        >
                            <img src={mapZoomOut} alt="Neighborhood Map" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                                <i className="fa-solid fa-earth-americas mr-1.5" /> Neighborhood
                            </div>
                            <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 flex items-center justify-center transition-all duration-300">
                                <i className="fa-solid fa-magnifying-glass-plus text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    )}
                    {propertyData?.satelliteImageUrl && (
                        <div
                            onClick={() => setSelectedMap({ url: propertyData.satelliteImageUrl!, title: 'Satellite View', isZoomIn: true })}
                            className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner group relative aspect-square cursor-zoom-in active:scale-[0.98] transition-all"
                        >
                            <img src={propertyData.satelliteImageUrl} alt="Satellite View" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                                <i className="fa-solid fa-satellite mr-1.5" /> Satellite
                            </div>
                            <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 flex items-center justify-center transition-all duration-300">
                                <i className="fa-solid fa-magnifying-glass-plus text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* ── Neighborhood Identity Banner ─────────────────── */}
            {resolvedName && (
                <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-[3rem] border border-indigo-100/60 shadow-sm overflow-hidden p-8 md:p-12">
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Left: Name + Character */}
                        <div className="flex-1 min-w-0 space-y-4">
                            <div>
                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">NEIGHBORHOOD</div>
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">{resolvedName}</h2>
                                {gemini?.alternative_names?.length > 0 && (
                                    <p className="text-sm text-slate-400 mt-1">Also known as: {gemini.alternative_names.join(', ')}</p>
                                )}
                            </div>

                            {/* Character description */}
                            {gemini?.character?.description && (
                                <p className="text-slate-700 text-[14px] leading-[1.625] font-normal">{gemini.character.description}</p>
                            )}
                            {gemini?.price_context?.context && (
                                <p className="text-slate-600 text-[13px] leading-[1.625] font-normal">{gemini.price_context.context}</p>
                            )}

                            {/* Badges row */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {gemini?.price_context?.tier && (
                                    <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${tierColors[gemini.price_context.tier] || 'bg-gray-100 text-gray-700'}`}>
                                        <i className="fa-solid fa-tag mr-1.5" />{gemini.price_context.tier}
                                    </span>
                                )}
                                {gemini?.price_context?.typical_range && (
                                    <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
                                        <i className="fa-solid fa-dollar-sign mr-1.5" />{gemini.price_context.typical_range}
                                    </span>
                                )}
                                {gemini?.character?.community_type && (
                                    <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700">
                                        <i className="fa-solid fa-shield-halved mr-1.5" />{gemini.character.community_type}
                                    </span>
                                )}
                                {gemini?.hoa?.has_hoa !== undefined && (
                                    <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${gemini.hoa.has_hoa ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                        <i className={`fa-solid ${gemini.hoa.has_hoa ? 'fa-building-shield' : 'fa-check'} mr-1.5`} />
                                        {gemini.hoa.has_hoa ? `HOA${gemini.hoa.monthly_fee ? ` · ${gemini.hoa.monthly_fee}` : ''}` : 'No HOA'}
                                    </span>
                                )}
                                {gemini?.character?.era_built && (
                                    <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
                                        <i className="fa-solid fa-calendar mr-1.5" />Built {gemini.character.era_built}
                                    </span>
                                )}
                                {gemini?.character?.architectural_style && (
                                    <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
                                        <i className="fa-solid fa-ruler-combined mr-1.5" />{gemini.character.architectural_style}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Right: Unique Features + Infrastructure */}
                        <div className="w-full md:w-80 space-y-5 flex-shrink-0">
                            {gemini?.unique_features?.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">STANDOUT FEATURES</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {gemini.unique_features.map((feat: string, i: number) => (
                                            <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-indigo-100 text-indigo-700 shadow-sm">
                                                {feat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {gemini?.infrastructure_quality && (
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">INFRASTRUCTURE</h4>
                                    <p className="text-slate-600 text-[12px] leading-relaxed">{gemini.infrastructure_quality}</p>
                                </div>
                            )}
                            {gemini?.upcoming_changes && gemini.upcoming_changes !== 'None known' && (
                                <div>
                                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-2">
                                        <i className="fa-solid fa-triangle-exclamation mr-1" />UPCOMING CHANGES
                                    </h4>
                                    <p className="text-slate-600 text-[12px] leading-relaxed">{gemini.upcoming_changes}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Source attribution + data source detail cards */}
                    <div className="mt-4 pt-2 space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Data Sources Queried:</span>
                            <span className={`text-[10px] font-semibold ${cityPlan ? 'text-teal-500' : 'text-slate-300'}`}><i className="fa-solid fa-city mr-1" />City Plan</span>
                            <span className={`text-[10px] font-semibold ${surveyorTract?.tract_id ? 'text-violet-500' : 'text-slate-300'}`}><i className="fa-solid fa-map mr-1" />Surveyor Tract</span>
                        </div>

                        {/* Data source detail cards — always show all sources */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

                            {/* City Plan (LMD + Specific Plan + Land Use) */}
                            <div className={`rounded-xl p-4 shadow-sm ${cityPlan ? 'bg-white border border-teal-100' : 'bg-slate-50/50 border border-dashed border-slate-200'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cityPlan ? 'bg-teal-50' : 'bg-slate-100'}`}>
                                        <i className={`fa-solid fa-city text-[11px] ${cityPlan ? 'text-teal-500' : 'text-slate-300'}`} />
                                    </div>
                                    <div className={`text-[10px] font-black uppercase tracking-wider ${cityPlan ? 'text-teal-600' : 'text-slate-400'}`}>City of Pleasanton</div>
                                </div>
                                {cityPlan ? (
                                    <>
                                        {/* Primary name: LMD > Specific Plan */}
                                        {(cityPlan.lmd_name || cityPlan.specific_plan) && (
                                            <div className="text-[14px] font-bold text-slate-800 mb-1">
                                                {cityPlan.lmd_name || cityPlan.specific_plan}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-1.5">
                                            {cityPlan.lmd_name && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    <i className="fa-solid fa-tree mr-1 text-[8px]" />LMD
                                                </span>
                                            )}
                                            {cityPlan.specific_plan && cityPlan.lmd_name && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                                                    {cityPlan.specific_plan}
                                                </span>
                                            )}
                                            {cityPlan.land_use_designation && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                    {cityPlan.land_use_designation}
                                                </span>
                                            )}
                                            {cityPlan.land_use_category && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                                                    {cityPlan.land_use_category}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1.5 text-[10px] text-slate-400">City ArcGIS — 3 layers queried</div>
                                    </>
                                ) : (
                                    <div className="text-[12px] text-slate-400 italic">Outside city coverage</div>
                                )}
                            </div>

                            {/* Surveyor Tract Map */}
                            <div className={`rounded-xl p-4 shadow-sm ${surveyorTract?.tract_id ? 'bg-white border border-violet-100' : 'bg-slate-50/50 border border-dashed border-slate-200'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${surveyorTract?.tract_id ? 'bg-violet-50' : 'bg-slate-100'}`}>
                                        <i className={`fa-solid fa-scroll text-[11px] ${surveyorTract?.tract_id ? 'text-violet-500' : 'text-slate-300'}`} />
                                    </div>
                                    <div className={`text-[10px] font-black uppercase tracking-wider ${surveyorTract?.tract_id ? 'text-violet-600' : 'text-slate-400'}`}>Surveyor Tract Map</div>
                                </div>
                                {surveyorTract?.tract_id ? (
                                    <>
                                        <div className="text-[14px] font-bold text-slate-800">{surveyorTract.description || surveyorTract.tract_id}</div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                                                <i className="fa-solid fa-hashtag mr-1 text-[8px]" />{surveyorTract.tract_id}
                                            </span>
                                            {surveyorTract.year && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                                                    <i className="fa-solid fa-calendar mr-1 text-[8px]" />Filed {surveyorTract.year}
                                                </span>
                                            )}
                                        </div>
                                        {surveyorTract.roads && surveyorTract.roads.toUpperCase() !== 'NONE' && (
                                            <div className="mt-2 text-[11px] text-slate-500">
                                                <span className="font-bold text-slate-600">Roads: </span>{surveyorTract.roads}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-[12px] text-slate-400 italic">No tract found in Alameda County Surveyor records</div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ── Hazard ──────────────────────────────────── */}
            {propertyData && (
                <div className="space-y-6">
                    {propertyData.historical_disasters && (
                        <HistoricalDisasterSection data={propertyData.historical_disasters} compact />
                    )}

                    {/* What's Nearby — full width */}
                    <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
                        <NeighborhoodPlacesSection data={propertyData} visualPoi={data.visual_poi} mapLabels={data.map_labels} />
                    </div>
                </div>
            )}

            {/* ── Lightbox Modal ─────────────────────────────── */}
            {selectedMap && (
                <div
                    className="fixed inset-0 z-[600] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
                    onKeyDown={(e) => e.key === 'Escape' && setSelectedMap(null)}
                >
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setSelectedMap(null)} />
                    <div className="relative bg-white rounded-[3rem] shadow-2xl overflow-hidden max-w-[95vw] max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="absolute top-6 right-6 z-10">
                            <button
                                onClick={() => setSelectedMap(null)}
                                className="w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md text-white flex items-center justify-center transition-all group active:scale-90"
                            >
                                <i className="fa-solid fa-xmark text-xl group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>
                        <div className="absolute top-6 left-6 z-10 px-6 py-3 rounded-2xl bg-black/20 border border-white/20 backdrop-blur-md">
                            <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-0.5">Expanded Visualization</div>
                            <div className="text-sm font-black text-white">{selectedMap.title}</div>
                        </div>
                        <div className="flex-1 flex items-center justify-center bg-slate-50 overflow-auto">
                            {selectedMap.isZoomIn && propertyData ? (
                                <div className="w-full h-full max-w-4xl max-h-[80vh] aspect-square">
                                    <StaticParcelMap data={propertyData} parcelPolygon={parcelPolygon} />
                                </div>
                            ) : (
                                <img src={selectedMap.url} alt={selectedMap.title} className="max-w-full max-h-full object-contain shadow-sm" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
