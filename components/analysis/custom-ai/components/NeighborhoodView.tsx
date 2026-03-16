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

    if (!data?.overview) return <EmptyState section="Neighborhood" />;

    // Normalize parcelPolygon for use with StaticParcelMap
    const parcelPolygon = React.useMemo(() => {
        const raw = propertyData?.parcelPolygon;
        if (!raw || !Array.isArray(raw) || raw.length < 3) return undefined;
        return raw.map((pt: any) => Array.isArray(pt) ? pt : [pt.lon, pt.lat]) as [number, number][];
    }, [propertyData]);

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

                {/* ── Extracted Labels (Visual Evidence) — HIDDEN ─────── */}

                {/* ── Neighborhood features grid ─────────────── */}
                {data.neighborhood_features && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-12 border-t border-gray-100">
                        {/* Row 1: General, Amenities, Nature & Greenery */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-city text-lg"></i>
                                </div>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">General</h4>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.neighborhood_features.general}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-store text-lg"></i>
                                </div>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Amenities</h4>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.neighborhood_features.nearby_amenities}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-tree text-lg"></i>
                                </div>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Nature & Greenery</h4>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.neighborhood_features.proximity_to_greenery_and_water}</p>
                        </div>
                        {/* Row 2: Streets, Pedestrian, Topography */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-road text-lg"></i>
                                </div>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Street & Traffic</h4>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.neighborhood_features.street_layout_and_traffic}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-person-walking text-lg"></i>
                                </div>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Pedestrian</h4>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.neighborhood_features.sidewalks_and_pedestrian_infra}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-mountain text-lg"></i>
                                </div>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Topography</h4>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.neighborhood_features.topography}</p>
                        </div>
                        {/* Row 3: Density, Development */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-building text-lg"></i>
                                </div>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Density</h4>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.neighborhood_features.neighborhood_density}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-hammer text-lg"></i>
                                </div>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Development</h4>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.neighborhood_features.development_patterns}</p>
                        </div>
                    </div>
                )}
            </div>

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
