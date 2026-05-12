/**
 * ExploreRow1Cards
 *
 * Row 1 of the Explore overview AI insights strip:
 *   Front Orientation · Outdoors & Privacy · Schools Intelligence
 *   Neighborhood Identity · Affordability · Neighborhood Profile
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
    designStyle?: { style?: string; reasoning?: string } | null;
    currentInteriorSummary?: any;
    /** If provided, only renders matching section keys: 'interior' | 'outdoor' | 'exterior' */
    showOnly?: string[];
    customOverviewText?: string | null;
    customAnalysisHomeInterior?: any;
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
    customOverviewText,
    customAnalysisHomeInterior,
    showOnly,
}) => {
    const show = (key: string) => !showOnly || showOnly.includes(key);


    return (
        <>
                                                {/* Row 1: Property & Neighborhood Context */}
                                                <div id="ov-ai-analysis" className="mb-4 scroll-mt-20">
                                                    <div className="flex flex-col sm:flex-row gap-4 w-full">

                                                        {/* Interiors */}
                                                        {show('interior') && (currentInteriorSummary || customOverviewText) && (
                                                            <div className="flex-1 flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-wand-magic-sparkles text-indigo-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[14px] font-bold text-slate-800 tracking-tight">Overview</span>
                                                                        </div>
                                                                        <div className="space-y-4">
                                                                            <div>
                                                                                {currentInteriorSummary?.interior_summary && (
                                                                                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                                                                                        {currentInteriorSummary.interior_summary}
                                                                                    </p>
                                                                                )}
                                                                                {customOverviewText && (
                                                                                    <p className={`text-[13px] text-slate-600 leading-relaxed font-medium ${currentInteriorSummary?.interior_summary ? 'mt-4' : ''}`}>
                                                                                        {customOverviewText}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {customAnalysisHomeInterior && (
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-8 mt-6 border-t border-slate-200/60">
                                                                                <div className="bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100/60 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                                                                            <i className="fa-solid fa-palette"></i>
                                                                                        </div>
                                                                                        <h4 className="font-serif text-lg text-slate-900 leading-tight">Design Philosophy</h4>
                                                                                    </div>
                                                                                    <div className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-3 py-1.5 rounded-full mb-2 self-start">{customAnalysisHomeInterior.design_style?.style}</div>
                                                                                    <p className="text-xs text-slate-600 leading-relaxed">{customAnalysisHomeInterior.design_style?.reasoning}</p>
                                                                                </div>
                                                                                <div className="bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100/60 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                                                                            <i className="fa-solid fa-swatchbook"></i>
                                                                                        </div>
                                                                                        <h4 className="font-serif text-lg text-slate-900 leading-tight">Colors & Materials</h4>
                                                                                    </div>
                                                                                    <p className="text-xs text-slate-600 leading-relaxed">{customAnalysisHomeInterior.color_and_materials}</p>
                                                                                </div>
                                                                                <div className="bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100/60 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                                                                            <i className="fa-solid fa-lightbulb"></i>
                                                                                        </div>
                                                                                        <h4 className="font-serif text-lg text-slate-900 leading-tight">Lighting Environment</h4>
                                                                                    </div>
                                                                                    <p className="text-xs text-slate-600 leading-relaxed">{customAnalysisHomeInterior.lighting}</p>
                                                                                </div>
                                                                                <div className="bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100/60 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                                                                            <i className="fa-solid fa-arrows-up-down-left-right"></i>
                                                                                        </div>
                                                                                        <h4 className="font-serif text-lg text-slate-900 leading-tight">Spatial Architecture</h4>
                                                                                    </div>
                                                                                    <p className="text-xs text-slate-600 leading-relaxed">{customAnalysisHomeInterior.spatial_flow}</p>
                                                                                </div>
                                                                                <div className="bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100/60 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                                                                            <i className="fa-solid fa-chair"></i>
                                                                                        </div>
                                                                                        <h4 className="font-serif text-lg text-slate-900 leading-tight">Storage & Cabinetry</h4>
                                                                                    </div>
                                                                                    <p className="text-xs text-slate-600 leading-relaxed">{customAnalysisHomeInterior.storage_and_cabinetry || (customAnalysisHomeInterior as any).staging_and_furnishings}</p>
                                                                                </div>
                                                                                <div className="bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100/60 p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                                                                    <div className="flex items-center gap-3 mb-3">
                                                                                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                                                                            <i className="fa-solid fa-screwdriver-wrench"></i>
                                                                                        </div>
                                                                                        <h4 className="font-serif text-lg text-slate-900 leading-tight">Condition & Finish</h4>
                                                                                    </div>
                                                                                    <p className="text-xs text-slate-600 leading-relaxed">{customAnalysisHomeInterior.condition_and_finish}</p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Outdoors & Privacy */}
                                                        {show('outdoor') && (analysis?.detailed_analysis?.outdoors_view_quality || analysis?.detailed_analysis?.privacy_layout) && (
                                                            <div className="flex-1 flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-tree text-emerald-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[14px] font-bold text-slate-800 tracking-tight">Outdoors</span>
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
                                                                            const hVal = sat2.lot_coverage_hardscape;
                                                                            const pVal = sat2.lot_coverage_pervious;
                                                                            const h = (hVal != null && hVal > 0 && hVal <= 1) ? hVal * 100 : (hVal ?? 0);
                                                                            const p = (pVal != null && pVal > 0 && pVal <= 1) ? pVal * 100 : (pVal ?? (100 - h));
                                                                            const hard = Math.round(h);
                                                                            const green = Math.round(p);

                                                                            return (
                                                                                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                                                                    {hVal != null && (
                                                                                        <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                                                            <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-1">Lot Coverage</div>
                                                                                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                                                                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${hard}%` }} />
                                                                                            </div>
                                                                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-0.5">
                                                                                                <span>{hard}% hard</span>
                                                                                                <span className="text-emerald-600">{green}% green</span>
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
                                                        {show('exterior') && (designStyle?.style || analysis?.detailed_analysis?.visual_appeal_condition) && (
                                                            <div className="flex-1 flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-3">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                                                <i className="fa-solid fa-archway text-indigo-600 group-hover:text-white text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[14px] font-bold text-slate-800 tracking-tight">Architecture Appeal</span>
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



