import React from 'react';
import { CustomAIAnalysisResult } from '../../../../types';
import { EmptyState } from './CommonComponents';

interface NeighborhoodViewProps {
    data: CustomAIAnalysisResult['neighborhood'];
}

export const NeighborhoodView: React.FC<NeighborhoodViewProps> = ({ data }) => {
    if (!data?.overview) return <EmptyState section="Neighborhood" />;
    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                <div className="space-y-4">
                    <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">NEIGHBORHOOD CONTEXT</div>
                    <p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{data.overview}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                    {data.neighborhood_features && (
                        <>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Street & Traffic</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.street_layout_and_traffic}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Walkability</div>
                                <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.neighborhood_features.walkability_indicators || data.neighborhood_features.sidewalks_and_pedestrian_infra}</p>
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
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};
