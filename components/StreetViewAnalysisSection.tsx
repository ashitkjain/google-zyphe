
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
        <div className="bg-white border-x border-gray-100 px-8 py-10 border-t border-gray-50 space-y-8">
            <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest">
                <div className="flex items-center">
                    <i className="fa-solid fa-eye mr-2 text-indigo-400"></i>
                    AI Visual Intelligence
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-black font-bold">Analysis via Gemini Vision</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                </div>
            </div>

            {/* Visual Header with Image */}
            {analysis.imageUrl && (
                <div className="w-full h-[300px] rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-inner group relative mb-8">
                    <img
                        src={analysis.imageUrl}
                        alt="Property Street View"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
                    <div className="absolute bottom-6 left-8 flex items-center gap-4">
                        <div className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-white text-[10px] font-black uppercase tracking-widest border border-white/30">
                            <i className="fa-solid fa-street-view mr-2"></i> Actual Neighborhood View
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Curb Appeal Score */}
                <div className={`p-6 rounded-[2rem] border border-gray-50 flex items-center gap-5 ${getScoreBg(analysis.curbAppealScore)}`}>
                    <div className={`w-20 h-20 rounded-2xl bg-white flex flex-col items-center justify-center shadow-xl ${getScoreColor(analysis.curbAppealScore)}`}>
                        <span className="text-3xl font-black leading-none">{analysis.curbAppealScore}</span>
                        <span className="text-[9px] uppercase font-bold tracking-widest opacity-60">/10</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Curb Appeal</span>
                        <span className={`text-xl font-black tracking-tight ${getScoreColor(analysis.curbAppealScore)}`}>
                            {analysis.curbAppealScore >= 8 ? 'Excellent' : analysis.curbAppealScore >= 5 ? 'Average' : 'Needs Work'}
                        </span>
                    </div>
                </div>

                {/* Style & Vibe */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <i className="fa-solid fa-home text-sm"></i>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Architectural Style</span>
                        </div>
                        <div className="text-lg font-black text-slate-800 leading-tight pl-11">
                            {analysis.architecturalStyle}
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                                <i className="fa-solid fa-tree text-sm"></i>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neighborhood Vibe</span>
                        </div>
                        <div className="text-lg font-black text-slate-800 leading-tight pl-11">
                            {analysis.neighborhoodVibe}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Garden Description */}
                <div className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                        <i className="fa-solid fa-leaf text-emerald-500 mr-2"></i>
                        Landscape & Garden
                    </div>
                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        {analysis.gardenDescription}
                    </p>
                </div>

                {/* Safety & Clutter */}
                <div className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm relative overflow-hidden">
                    {analysis.visualClutter && (
                        <div className="absolute top-0 right-0 bg-amber-50 text-amber-600 px-3 py-1 rounded-bl-xl text-[9px] font-black uppercase tracking-widest border-l border-b border-amber-100">
                            <i className="fa-solid fa-triangle-exclamation mr-1"></i> Visual Clutter Detected
                        </div>
                    )}
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                        <i className="fa-solid fa-shield-halved text-blue-500 mr-2"></i>
                        Safety & Infrastructure Assessment
                    </div>
                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        {analysis.safetyAssessment}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StreetViewAnalysisSection;
