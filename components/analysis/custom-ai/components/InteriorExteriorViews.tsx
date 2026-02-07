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
}

export const ExteriorView: React.FC<ExteriorViewProps> = ({ data }) => {
    if (!data?.exterior_and_lot_appeal?.architecture_style) return <EmptyState section="Exterior" />;
    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                <div className="space-y-6">
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

                {data.neighborhood_street_insights && (
                    <div className="pt-12 border-t border-gray-100 space-y-6">
                        <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">STREET & NEIGHBORHOOD INSIGHTS</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_street_insights}</p>
                    </div>
                )}
            </div>
        </section>
    );
};
