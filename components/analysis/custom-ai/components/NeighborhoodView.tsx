import React from 'react';
import { CustomAIAnalysisResult } from '../../../../types';
import { EmptyState } from './CommonComponents';

interface NeighborhoodViewProps {
    data: CustomAIAnalysisResult['neighborhood'];
    mapZoomIn?: string;
    mapZoomOut?: string;
}

export const NeighborhoodView: React.FC<NeighborhoodViewProps> = ({ data, mapZoomIn, mapZoomOut }) => {
    const [selectedMap, setSelectedMap] = React.useState<{ url: string, title: string } | null>(null);

    if (!data?.overview) return <EmptyState section="Neighborhood" />;
    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                {/* Visual Map Integration */}
                {(mapZoomIn || mapZoomOut) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch pt-4">
                        {mapZoomIn && (
                            <div
                                onClick={() => setSelectedMap({ url: mapZoomIn, title: 'Property Close-up Map' })}
                                className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative aspect-video cursor-zoom-in active:scale-[0.98] transition-all"
                            >
                                <img
                                    src={mapZoomIn}
                                    alt="Property Close-up Map"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border border-white/20">
                                    <i className="fa-solid fa-map mr-2"></i> Close-up View
                                </div>
                                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 flex items-center justify-center transition-all duration-300">
                                    <i className="fa-solid fa-magnifying-glass-plus text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                </div>
                            </div>
                        )}
                        {mapZoomOut && (
                            <div
                                onClick={() => setSelectedMap({ url: mapZoomOut, title: 'Neighborhood Map' })}
                                className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative aspect-video cursor-zoom-in active:scale-[0.98] transition-all"
                            >
                                <img
                                    src={mapZoomOut}
                                    alt="Neighborhood Map"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border border-white/20">
                                    <i className="fa-solid fa-earth-americas mr-2"></i> Neighborhood View
                                </div>
                                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 flex items-center justify-center transition-all duration-300">
                                    <i className="fa-solid fa-magnifying-glass-plus text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="text-2xl font-black text-indigo-600 uppercase tracking-[0.3em]">NEIGHBORHOOD CONTEXT</div>
                    <p className="text-gray-800 font-sans font-normal text-[14px] leading-[1.625]">{data.overview}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                    {data.orientation && (
                        <div className="space-y-3">
                            <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Orientation</div>
                            <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">
                                The home front is facing {data.orientation.final_orientation.toLowerCase().includes('facing') ? data.orientation.final_orientation : data.orientation.final_orientation}.
                            </p>
                        </div>
                    )}
                    {data.neighborhood_features && (
                        <>
                            <div className="space-y-3">
                                <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Street & Traffic</div>
                                <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.street_layout_and_traffic}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Pedestrian</div>
                                <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.sidewalks_and_pedestrian_infra}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Nature & Greenery</div>
                                <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.proximity_to_greenery_and_water}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Amenities</div>
                                <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.nearby_amenities}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Development</div>
                                <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.development_patterns}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Density</div>
                                <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.neighborhood_density}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">Topography</div>
                                <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.topography}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-2xl font-black text-gray-400 uppercase tracking-widest">General</div>
                                <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625]">{data.neighborhood_features.general}</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Lightbox Modal */}
            {selectedMap && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
                    onKeyDown={(e) => e.key === 'Escape' && setSelectedMap(null)}
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
                        onClick={() => setSelectedMap(null)}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative bg-white rounded-[3rem] shadow-2xl overflow-hidden max-w-[95vw] max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="absolute top-6 right-6 z-10">
                            <button
                                onClick={() => setSelectedMap(null)}
                                className="w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-md text-white flex items-center justify-center transition-all group active:scale-90"
                            >
                                <i className="fa-solid fa-xmark text-xl group-hover:rotate-90 transition-transform"></i>
                            </button>
                        </div>

                        {/* Title Overlay */}
                        <div className="absolute top-6 left-6 z-10 px-6 py-3 rounded-2xl bg-black/20 border border-white/20 backdrop-blur-md">
                            <div className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-0.5">Expanded Visualization</div>
                            <div className="text-sm font-black text-white">{selectedMap.title}</div>
                        </div>

                        {/* Image Container */}
                        <div className="flex-1 flex items-center justify-center bg-slate-50 overflow-auto">
                            <img
                                src={selectedMap.url}
                                alt={selectedMap.title}
                                className="max-w-full max-h-full object-contain shadow-sm"
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};
