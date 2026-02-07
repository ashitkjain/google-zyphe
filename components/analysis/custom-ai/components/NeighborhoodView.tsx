import React from 'react';
import { CustomAIAnalysisResult } from '../../../../types';
import { EmptyState } from './CommonComponents';

interface NeighborhoodViewProps {
    data: CustomAIAnalysisResult['neighborhood'];
}

export const NeighborhoodView: React.FC<NeighborhoodViewProps> = ({ data }) => {
    if (!data?.overall_vibe) return <EmptyState section="Neighborhood" />;
    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                <div className="space-y-4">
                    <div className="text-xl font-black text-indigo-600 uppercase tracking-[0.3em]">NEIGHBORHOOD CONTEXT</div>
                    <p className="text-gray-800 font-sans font-normal text-[13px] leading-[1.625]">{data.overall_vibe}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pt-12 border-t border-gray-100">
                    <div className="space-y-3">
                        <div className="text-xl font-black text-gray-400 uppercase tracking-widest">Street Context</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-[1.625]">{data.street_context}</p>
                    </div>
                </div>
            </div>
        </section>
    );
};
