/**
 * ExploreRow1Cards
 *
 * Row 1 of the Explore overview AI insights strip:
 *   Front Orientation · Outdoors & Privacy · Schools Intelligence
 *   Neighborhood Identity · Affordability · Census Demographics
 *
 * Extracted from ExploreTab.tsx for maintainability.
 */
import React from 'react';

import { CensusDemographics } from '../../services/api/environmental';
import { isTargetForOrientationAnalysis } from '../../utils/propertyPolicies';
import { PropertyData, ComprehensiveAnalysisResult } from '../../types';

interface ExploreRow1CardsProps {
    propertyData: PropertyData;
    analysis: ComprehensiveAnalysisResult | null;
    census: CensusDemographics | null;
    lifestyleFit: any;
    lifestyleInsights: any;
    userRole?: string;
    // Additional derived data
    designStyle?: { style?: string; reasoning?: string } | null;
    currentInteriorSummary?: any;

}


export const ExploreRow1Cards: React.FC<ExploreRow1CardsProps> = ({
    propertyData,
    analysis,
    census,
    lifestyleFit,
    lifestyleInsights,
    userRole,
    designStyle,
    currentInteriorSummary,
}) => {


    return (
        <>
                                                {/* Row 1: Property & Neighborhood Context */}
                                                <div id="ov-ai-analysis" className="mx-2 mb-4 rounded-2xl border-2 border-slate-100 overflow-hidden bg-white shadow-sm scroll-mt-20">
                                                    <div className="px-5 pt-4 pb-0 flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                            <i className="fa-solid fa-brain text-indigo-500 text-[12px]" />
                                                        </div>
                                                        <h3 className="text-[15px] font-black text-slate-900 tracking-tight">AI Property Analysis</h3>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-2 pb-2 pt-1.5">

                                                        {/* Interiors */}
                                                        {currentInteriorSummary && (
                                                            <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-wand-magic-sparkles text-indigo-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Interiors</span>
                                                                        </div>
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                                                                                    {currentInteriorSummary.interior_summary}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                                                    <i className="fa-solid fa-door-open text-indigo-400"></i>
                                                                                    Spaces
                                                                                </div>
                                                                                <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                                                                                    {currentInteriorSummary.rooms_summary}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Outdoors & Privacy */}
                                                        {(analysis?.detailed_analysis?.outdoors_view_quality || analysis?.detailed_analysis?.privacy_layout) && (
                                                            <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-tree text-emerald-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Outdoors</span>
                                                                        </div>
                                                                        <p className="text-[13px] text-slate-600 leading-relaxed">
                                                                            {analysis.detailed_analysis.outdoors_view_quality && (
                                                                                <span className="block">
                                                                                    {analysis.detailed_analysis.outdoors_view_quality.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                        j % 2 === 1 ? <strong key={j} className="font-black text-slate-900 drop-shadow-sm">{chunk}</strong> : chunk
                                                                                    ))}
                                                                                </span>
                                                                            )}
                                                                        </p>
                                                                        {/* Lot Coverage + buyer signal — moved from Front Orientation card */}
                                                                        {(propertyData as any).orientation_ai && (() => {
                                                                            const sat2 = (propertyData as any).orientation_ai;
                                                                            return (
                                                                                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                                                                    {sat2.lot_coverage_hardscape != null && (
                                                                                        <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                                                            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1">Lot Coverage</div>
                                                                                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                                                                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${sat2.lot_coverage_hardscape}%` }} />
                                                                                            </div>
                                                                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-0.5">
                                                                                                <span>{sat2.lot_coverage_hardscape}% hard</span>
                                                                                                <span className="text-emerald-600">{sat2.lot_coverage_pervious ?? (100 - sat2.lot_coverage_hardscape)}% green</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                    {sat2.buyer_pro && (
                                                                                        <div className="flex items-start gap-1.5 p-2 bg-emerald-50/50 rounded-lg border border-emerald-100">
                                                                                            <i className="fa-solid fa-plus text-[8px] text-emerald-500 mt-0.5"></i>
                                                                                            <div className="text-[11px] text-emerald-700 font-medium leading-snug">{sat2.buyer_pro}</div>
                                                                                        </div>
                                                                                    )}
                                                                                    {sat2.buyer_con && (
                                                                                        <div className="flex items-start gap-1.5 p-2 bg-rose-50/50 rounded-lg border border-rose-100">
                                                                                            <i className="fa-solid fa-minus text-[8px] text-rose-500 mt-0.5"></i>
                                                                                            <div className="text-[11px] text-rose-700 font-medium leading-snug">{sat2.buyer_con}</div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Architecture Appeal */}
                                                        {(designStyle?.style || analysis?.detailed_analysis?.visual_appeal_condition) && (
                                                            <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-archway text-indigo-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Architecture Appeal</span>
                                                                        </div>
                                                                        {designStyle?.style && (
                                                                            <span className="inline-block bg-indigo-100 text-indigo-700 text-[11px] font-black uppercase px-2.5 py-1 rounded-full mb-2">{designStyle.style}</span>
                                                                        )}
                                                                        {(analysis?.detailed_analysis?.visual_appeal_condition || designStyle?.reasoning) && (
                                                                            <p className="text-[13px] text-slate-600 leading-relaxed text-left">
                                                                                {(analysis?.detailed_analysis?.visual_appeal_condition || designStyle?.reasoning)?.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                    j % 2 === 1 ? <strong key={j} className="font-black text-slate-900 drop-shadow-sm">{chunk}</strong> : chunk
                                                                                ))}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}


                                                     </div>
                                                </div>
        </>
    );
};



