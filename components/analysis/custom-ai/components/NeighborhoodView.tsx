import React from 'react';
import { CustomAIAnalysisResult, PropertyData } from '../../../../types';
import { EmptyState } from './CommonComponents';
import AirQualitySection from '../../../property/AirQualitySection';
import NeighborhoodPlacesSection from '../../../property/NeighborhoodPlacesSection';
import StaticParcelMap from '../../../property/StaticParcelMap';

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
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
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

                {mapZoomIn && (
                    <div className="pt-4">
                        <div
                            onClick={() => setSelectedMap({ url: mapZoomIn, title: 'Property Close-up Map', isZoomIn: true })}
                            className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative aspect-video cursor-zoom-in active:scale-[0.98] transition-all"
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
                            <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border border-white/20 z-10">
                                <i className="fa-solid fa-map mr-2" /> Close-up View
                            </div>
                            <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 flex items-center justify-center transition-all duration-300 z-10">
                                <i className="fa-solid fa-magnifying-glass-plus text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Extracted Labels (Visual Evidence) — HIDDEN ─────── */}

                {/* ── Neighborhood features grid ─────────────── */}
                {data.neighborhood_features && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                        {/* Row 1: General, Amenities, Nature & Greenery */}
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">General</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.general}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Amenities</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.nearby_amenities}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Nature & Greenery</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.proximity_to_greenery_and_water}</p>
                        </div>
                        {/* Row 2: Streets, Pedestrian, Topography */}
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Street & Traffic</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.street_layout_and_traffic}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Pedestrian</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.sidewalks_and_pedestrian_infra}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Topography</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.topography}</p>
                        </div>
                        {/* Row 3: Density, Development */}
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Density</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.neighborhood_density}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Development</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.development_patterns}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Environmental Intelligence ────────────────── */}
            {propertyData && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                    <div className="flex items-center gap-4 pt-12">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                            <i className="fa-solid fa-microchip" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Environmental Intelligence</h1>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Google Environmental APIs & Local Context</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
                            <AirQualitySection data={propertyData} />
                        </div>

                        <div className="flex flex-col lg:flex-row gap-6">
                            {mapZoomOut && (
                                <div className="lg:w-[340px] flex-shrink-0">
                                    <div
                                        onClick={() => setSelectedMap({ url: mapZoomOut, title: 'Neighborhood Map', isZoomIn: false })}
                                        className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative cursor-zoom-in active:scale-[0.98] transition-all sticky top-4 h-full min-h-[300px]"
                                    >
                                        <img src={mapZoomOut} alt="Neighborhood Map" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                        <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                                            <i className="fa-solid fa-earth-americas mr-1.5" /> Neighborhood
                                        </div>
                                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 flex items-center justify-center transition-all duration-300">
                                            <i className="fa-solid fa-magnifying-glass-plus text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="flex-1 min-w-0 bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
                                <NeighborhoodPlacesSection data={propertyData} visualPoi={data.visual_poi} mapLabels={data.map_labels} />
                            </div>
                        </div>
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
