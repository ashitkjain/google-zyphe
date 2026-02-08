
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

    const InfoStat = ({ icon, label, value, colorClass, bgClass, subValue }: any) => (
        <div className={`p-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-4 ${bgClass || 'bg-slate-50/50'}`}>
            <div className={`w-10 h-10 rounded-xl bg-white flex flex-col items-center justify-center shadow-sm ${colorClass || 'text-slate-600'} flex-shrink-0`}>
                <i className={`fa-solid ${icon} text-[14px]`}></i>
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</span>
                <div className="text-[13px] font-black text-slate-800 leading-tight truncate">
                    {value}
                </div>
                {subValue && <span className="text-[10px] text-slate-400 font-medium truncate">{subValue}</span>}
            </div>
        </div>
    );

    return (
        <div className="bg-white border-x border-slate-100 px-8 pt-0 pb-10 space-y-8">
            <div className="flex items-center justify-between text-xs font-black text-gray-400 uppercase tracking-widest">
                <div className="flex items-center">
                    <i className="fa-solid fa-eye mr-2 text-indigo-400"></i>
                    AI Neighborhood Forensics
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-black font-bold text-[10px]">VISUAL INTELLIGENCE SCAN</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></span>
                </div>
            </div>

            {/* Compact Global Side-by-Side Layout */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Visual Side */}
                {analysis.imageUrl && (
                    <div className="lg:w-2/5 h-[480px] rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-inner group relative">
                        <img
                            src={analysis.imageUrl}
                            alt="Property Street View"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"></div>
                        <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                            <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-white text-[9px] font-black uppercase tracking-widest border border-white/30 w-fit">
                                <i className="fa-solid fa-street-view mr-1.5"></i> Google Street View
                            </div>
                        </div>
                    </div>
                )}

                {/* Information Side */}
                <div className="flex-1 flex flex-col gap-4">
                    {/* Top Forensic Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Curb Appeal (Special) */}
                        <div className={`p-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-4 ${getScoreBg(analysis.curbAppealScore)}`}>
                            <div className={`w-12 h-12 rounded-xl bg-white flex flex-col items-center justify-center shadow-md ${getScoreColor(analysis.curbAppealScore)} flex-shrink-0`}>
                                <span className="text-lg font-black leading-none">{analysis.curbAppealScore}</span>
                                <span className="text-[7px] uppercase font-bold tracking-widest opacity-60">/10</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Curb Appeal</span>
                                <span className={`text-[13px] font-black tracking-tight ${getScoreColor(analysis.curbAppealScore)}`}>
                                    {analysis.curbAppealScore >= 8 ? 'Exceptional' : analysis.curbAppealScore >= 5 ? 'Standard' : 'Needs Work'}
                                </span>
                            </div>
                        </div>

                        <InfoStat
                            icon="fa-shield-halved"
                            label="Privacy & Seclusion"
                            value={analysis.privacyRating}
                            colorClass="text-indigo-600"
                        />

                        <InfoStat
                            icon="fa-car-side"
                            label="Parking Logistics"
                            value={analysis.parkingLogistics}
                            colorClass="text-blue-600"
                        />

                        <InfoStat
                            icon="fa-plug-circle-bolt"
                            label="Utility Aesthetic"
                            value={analysis.utilityAesthetic}
                            colorClass="text-amber-600"
                        />

                        <InfoStat
                            icon="fa-landmark"
                            label="Architectural Style"
                            value={analysis.architecturalStyle}
                        />

                        <InfoStat
                            icon="fa-tree-city"
                            label="Neighborhood Vibe"
                            value={analysis.neighborhoodVibe}
                        />
                    </div>

                    {/* Detailed Analysis Blocks */}
                    <div className="grid grid-cols-1 gap-3">
                        {/* Safety & Family Analysis */}
                        <div className="bg-slate-50/30 border border-slate-100 p-5 rounded-[1.8rem] relative overflow-hidden group hover:bg-white transition-colors">
                            {analysis.visualClutter && (
                                <div className="absolute top-0 right-0 bg-rose-50 text-rose-600 px-3 py-1 rounded-bl-xl text-[7px] font-black uppercase tracking-widest border-l border-b border-rose-100 animate-pulse">
                                    <i className="fa-solid fa-triangle-exclamation mr-1"></i> Visual Clutter Alert
                                </div>
                            )}
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                                <i className="fa-solid fa-children text-indigo-500 mr-2"></i>
                                Safety & Family Suitability
                            </div>
                            <div className="space-y-2">
                                <p className="text-[12.5px] text-slate-700 font-medium leading-relaxed">
                                    {analysis.familySafety}
                                </p>
                                <p className="text-[11px] text-slate-500 font-normal leading-relaxed italic border-l-2 border-slate-100 pl-3">
                                    {analysis.safetyAssessment}
                                </p>
                            </div>
                        </div>

                        {/* Landscape & Shade Analysis */}
                        <div className="bg-slate-50/30 border border-slate-100 p-5 rounded-[1.8rem] group hover:bg-white transition-colors">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                                <i className="fa-solid fa-cloud-sun text-emerald-500 mr-2"></i>
                                Solar & Environmental Context
                            </div>
                            <div className="space-y-2">
                                <p className="text-[12.5px] text-slate-700 font-medium leading-relaxed">
                                    {analysis.solarObstructions}
                                </p>
                                <p className="text-[11px] text-slate-500 font-normal leading-relaxed italic border-l-2 border-slate-100 pl-3">
                                    {analysis.gardenDescription}
                                </p>
                            </div>
                        </div>

                        {/* Maintenance Risk Alerts */}
                        {analysis.maintenanceRisks && analysis.maintenanceRisks.length > 0 && (
                            <div className="bg-rose-50/30 border border-rose-100/50 p-5 rounded-[1.8rem] group hover:bg-white transition-colors">
                                <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 flex items-center">
                                    <i className="fa-solid fa-toolbox mr-2"></i>
                                    Visible Maintenance Forensic Alerts
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.maintenanceRisks.map((risk, i) => (
                                        <div key={i} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-black border border-rose-100 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                            {risk}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StreetViewAnalysisSection;
