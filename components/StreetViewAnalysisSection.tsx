
import React from 'react';
import { PropertyData } from '../types';

interface Props {
    data: PropertyData;
}

const StreetViewAnalysisSection: React.FC<Props> = ({ data }) => {
    const analysis = data.streetViewAnalysis;
    if (!analysis) return null;

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-emerald-500';
        if (score >= 5) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 8) return 'bg-emerald-50';
        if (score >= 5) return 'bg-amber-50';
        return 'bg-rose-50';
    };

    return (
        <div className="bg-white border-x border-slate-100 px-8 pt-0 pb-10 space-y-8">
            <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest">
                <div className="flex items-center">
                    <i className="fa-solid fa-eye mr-2 text-indigo-400"></i>
                    AI Visual Intelligence
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-black font-bold">Google street view</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                </div>
            </div>

            {/* Compact Global Side-by-Side Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Visual Side */}
                {analysis.imageUrl && (
                    <div className="lg:w-2/5 h-[420px] rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative">
                        <img
                            src={analysis.imageUrl}
                            alt="Property Street View"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-4 left-4">
                            <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-white text-[9px] font-black uppercase tracking-widest border border-white/30">
                                <i className="fa-solid fa-street-view mr-1.5"></i> Actual Neighborhood View
                            </div>
                        </div>
                    </div>
                )}

                {/* Information Side */}
                <div className="flex-1 flex flex-col gap-3">
                    {/* Top Stats - More Flexible Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className={`p-4 rounded-[1.5rem] border border-gray-50 flex items-center gap-4 ${getScoreBg(analysis.curbAppealScore)} sm:col-span-2 md:col-span-1`}>
                            <div className={`w-12 h-12 rounded-xl bg-white flex flex-col items-center justify-center shadow-md ${getScoreColor(analysis.curbAppealScore)} flex-shrink-0`}>
                                <span className="text-lg font-black leading-none">{analysis.curbAppealScore}</span>
                                <span className="text-[7px] uppercase font-bold tracking-widest opacity-60">/10</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Curb Appeal</span>
                                <span className={`text-[13px] font-black tracking-tight ${getScoreColor(analysis.curbAppealScore)}`}>
                                    {analysis.curbAppealScore >= 8 ? 'Excellent' : analysis.curbAppealScore >= 5 ? 'Average' : 'Needs Work'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-4">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                <i className="fa-solid fa-home text-[10px]"></i>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Architectural Style</span>
                                <div className="text-[13px] font-black text-slate-800 leading-tight">
                                    {analysis.architecturalStyle}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50/50 p-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-4 sm:col-span-2 md:col-span-1">
                            <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                                <i className="fa-solid fa-tree text-[10px]"></i>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Neighborhood Vibe</span>
                                <div className="text-[13px] font-black text-slate-800 leading-tight">
                                    {analysis.neighborhoodVibe}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Landscaping Assessment */}
                    <div className="bg-white border border-gray-100 p-5 rounded-[1.8rem] shadow-sm flex-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center">
                            <i className="fa-solid fa-leaf text-emerald-500 mr-2"></i>
                            Landscape & Garden Analysis
                        </div>
                        <p className="text-[12.5px] text-slate-700 font-normal leading-[1.6]">
                            {analysis.gardenDescription}
                        </p>
                    </div>

                    {/* Safety & Infra Assessment */}
                    <div className="bg-white border border-gray-100 p-5 rounded-[1.8rem] shadow-sm relative overflow-hidden flex-1">
                        {analysis.visualClutter && (
                            <div className="absolute top-0 right-0 bg-amber-50 text-amber-600 px-3 py-1 rounded-bl-xl text-[7px] font-black uppercase tracking-widest border-l border-b border-amber-100">
                                <i className="fa-solid fa-triangle-exclamation mr-1"></i> Clutter Alert
                            </div>
                        )}
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center">
                            <i className="fa-solid fa-shield-halved text-blue-500 mr-2"></i>
                            Safety & Infrastructure Assessment
                        </div>
                        <p className="text-[12.5px] text-slate-700 font-normal leading-[1.6]">
                            {analysis.safetyAssessment}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StreetViewAnalysisSection;
