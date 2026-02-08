import React from 'react';
import { CustomAIAnalysisResult } from '../../../../types';
import { EmptyState } from './CommonComponents';

interface InteriorViewProps {
    data: CustomAIAnalysisResult['home_interior'];
}

export const InteriorView: React.FC<InteriorViewProps> = ({ data }) => {
    if (!data?.overall_description) return <EmptyState section="Interior" />;
    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                <div className="space-y-4">
                    <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">SUMMARY</div>
                    <p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{data.overall_description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                    <div className="space-y-3">
                        <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Design Philosophy</div>
                        <div className="inline-block bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase px-3 py-1.5 rounded-full mb-2">{data.design_style?.style}</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.design_style?.reasoning}</p>
                    </div>
                    <div className="space-y-3">
                        <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Colors & Materials</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.color_and_materials}</p>
                    </div>
                    <div className="space-y-3">
                        <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Lighting Environment</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.lighting}</p>
                    </div>
                    <div className="space-y-3">
                        <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Spatial Architecture</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.spatial_flow}</p>
                    </div>
                    <div className="space-y-3">
                        <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Staging & Furnishings</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.staging_and_furnishings}</p>
                    </div>
                    <div className="space-y-3">
                        <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Condition & Finish</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.condition_and_finish}</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

interface RoomsViewProps {
    highlights: CustomAIAnalysisResult['room_highlights'];
}

export const RoomsView: React.FC<RoomsViewProps> = ({ highlights }) => {
    if (!highlights || highlights.length === 0) return <EmptyState section="Room Highlights" />;
    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {highlights.map((room, idx) => (
                    <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                            <div className="w-12 h-12 bg-gray-50 rounded-[1.25rem] flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                <i className={`fa-solid ${room.room_name?.toLowerCase().includes('kitchen') ? 'fa-kitchen-set' : 'fa-door-open'} text-xl`}></i>
                            </div>
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">{room.floor || 'N/A'}</span>
                        </div>
                        <h4 className="font-black text-gray-900 text-xl mb-4 tracking-tight">{room.room_name}</h4>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625] mb-6">{room.description}</p>
                        {room.potential_improvements && (
                            <div className="pt-6 border-t border-gray-100 bg-gray-50 -mx-8 -mb-8 p-8 mt-auto">
                                <div className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-3">Strategic Enhancement</div>
                                <p className="text-gray-500 text-[13px] font-sans font-normal italic leading-[1.625]">"{room.potential_improvements}"</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
};

interface ExteriorViewProps {
    data: CustomAIAnalysisResult['exterior_and_neighborhood'];
    streetViewAnalysis?: any;
}

export const ExteriorView: React.FC<ExteriorViewProps> = ({ data, streetViewAnalysis }) => {
    if (!data?.exterior_and_lot_appeal?.architecture_style) return <EmptyState section="Exterior" />;
    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                {/* Visual Street View Integration */}
                {(streetViewAnalysis?.imageUrl || streetViewAnalysis?.curbAppealScore) && (
                    <div className="flex flex-col md:flex-row gap-8 items-stretch pt-4">
                        {streetViewAnalysis?.imageUrl && (
                            <div className="md:w-1/2 rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative">
                                <img
                                    src={streetViewAnalysis.imageUrl}
                                    alt="Property Street View"
                                    className="w-full h-full object-cover min-h-[300px] group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                                    <i className="fa-solid fa-street-view mr-2"></i> Actual Street View
                                </div>
                            </div>
                        )}
                        <div className={`${streetViewAnalysis?.imageUrl ? 'md:w-1/2' : 'w-full'} bg-indigo-50/50 rounded-[2rem] p-8 flex flex-col justify-center gap-6 border border-indigo-100/50`}>
                            <div className="space-y-2">
                                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">CURB APPEAL AI RATING</div>
                                <div className="flex items-end gap-3">
                                    <span className="text-6xl font-black text-gray-900 leading-none">
                                        {streetViewAnalysis?.curbAppealScore ? (streetViewAnalysis.curbAppealScore <= 10 ? streetViewAnalysis.curbAppealScore * 10 : streetViewAnalysis.curbAppealScore) : 'N/A'}
                                    </span>
                                    <span className="text-xl font-black text-indigo-300 mb-1">/ 100</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                        <i className="fa-solid fa-chess-rook text-xs"></i>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Architectural Context</div>
                                        <div className="text-gray-800 text-[13px] font-semibold">{streetViewAnalysis?.architecturalStyle || 'No data'}</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                        <i className="fa-solid fa-leaf text-xs"></i>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Landscape Notes</div>
                                        <div className="text-gray-800 text-[13px] font-semibold leading-[1.4] line-clamp-2">{streetViewAnalysis?.gardenDescription || 'No data'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-6 pt-12 border-t border-gray-100">
                    <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">ARCHITECTURE & LOT</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        <div className="space-y-3">
                            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Style</div>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.exterior_and_lot_appeal.architecture_style}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Curb Appeal</div>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.exterior_and_lot_appeal.curb_appeal}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Backyard & Patio</div>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.exterior_and_lot_appeal.backyard_and_patio}</p>
                        </div>
                    </div>
                </div>

                <div className="pt-12 border-t border-gray-100 space-y-6">
                    <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">VIEWS & PRIVACY</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                        <div className="space-y-3">
                            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Views</div>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.views_privacy_orientation?.views}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Privacy</div>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.views_privacy_orientation?.privacy}</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Orientation</div>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.views_privacy_orientation?.orientation}</p>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
};
