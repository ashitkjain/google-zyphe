import React from 'react';
import { CustomAIAnalysisResult } from '../../../../types';
import { EmptyState } from './CommonComponents';

interface NeighborhoodViewProps {
    data: CustomAIAnalysisResult['neighborhood'];
    mapZoomIn?: string;
    mapZoomOut?: string;
}

export const NeighborhoodView: React.FC<NeighborhoodViewProps> = ({ data, mapZoomIn, mapZoomOut }) => {
    if (!data?.overview) return <EmptyState section="Neighborhood" />;
    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                {/* Visual Map Integration */}
                {(mapZoomIn || mapZoomOut) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch pt-4">
                        {mapZoomIn && (
                            <div className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative aspect-video">
                                <img
                                    src={mapZoomIn}
                                    alt="Property Close-up Map"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                                    <i className="fa-solid fa-map mr-2"></i> Close-up View
                                </div>
                            </div>
                        )}
                        {mapZoomOut && (
                            <div className="rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative aspect-video">
                                <img
                                    src={mapZoomOut}
                                    alt="Neighborhood Map"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                                    <i className="fa-solid fa-earth-americas mr-2"></i> Neighborhood View
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">NEIGHBORHOOD CONTEXT</div>
                    <p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{data.overview}</p>
                </div>

                {data.orientation && (
                    <div className="pt-12 border-t border-gray-100 space-y-6">
                        <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">ORIENTATION ANALYSIS</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-gray-50/50 p-6 rounded-[1.5rem] border border-gray-100 flex flex-col items-center text-center space-y-2">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Street Direction</div>
                                <div className="text-xl font-black text-indigo-600 font-serif translate-y-[-2px]">{data.orientation.street_direction}</div>
                            </div>
                            <div className="bg-gray-50/50 p-6 rounded-[1.5rem] border border-gray-100 flex flex-col items-center text-center space-y-2">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Home Position</div>
                                <div className="text-xl font-black text-indigo-600 font-serif translate-y-[-2px] capitalize">{data.orientation.home_marker_position} of street</div>
                            </div>
                            <div className="bg-indigo-600 p-6 rounded-[1.5rem] flex flex-col items-center text-center space-y-2 shadow-lg shadow-indigo-100">
                                <div className="text-[10px] font-black text-white/60 uppercase tracking-widest">Front Facing</div>
                                <div className="text-2xl font-black text-white font-serif translate-y-[-2px]">{data.orientation.final_orientation}</div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                    {data.neighborhood_features && (
                        <>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Street & Traffic</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.street_layout_and_traffic}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Pedestrian</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.sidewalks_and_pedestrian_infra}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Nature & Greenery</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.proximity_to_greenery_and_water}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Amenities</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.nearby_amenities}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Development</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.development_patterns}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Density</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.neighborhood_density}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Topography</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.topography}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">General</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.general}</p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};
