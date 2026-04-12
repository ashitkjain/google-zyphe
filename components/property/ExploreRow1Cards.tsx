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
import VastuCard from './VastuCard';

import { AffordabilityCard } from '../analysis/custom-ai/components/AffordabilityCard';
import { CensusDemographicsCard } from '../analysis/custom-ai/components/CensusDemographicsCard';
import { CensusDemographics } from '../../services/api/environmental';
import { isTargetForOrientationAnalysis } from '../../utils/propertyPolicies';
import { PropertyData, ComprehensiveAnalysisResult } from '../../types';

interface ExploreRow1CardsProps {
    propertyData: PropertyData;
    analysis: ComprehensiveAnalysisResult | null;
    census: CensusDemographics | null;
    cityNhEntryOverview: any;
    schoolsIntelligence: any;
    schoolsExpanded: Record<number, boolean>;
    setSchoolsExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
    lifestyleFit: any;
    lifestyleInsights: any;
    userRole?: string;
    // Additional derived data
    designStyle?: { style?: string; reasoning?: string } | null;

}


export const ExploreRow1Cards: React.FC<ExploreRow1CardsProps> = ({
    propertyData,
    analysis,
    census,
    cityNhEntryOverview,
    schoolsIntelligence,
    schoolsExpanded,
    setSchoolsExpanded,
    lifestyleFit,
    lifestyleInsights,
    userRole,
    designStyle,
}) => {


    return (
        <>
                                                {/* Row 1: Property & Neighborhood Context */}
                                                <div className="w-full px-2 -mt-1 rounded-2xl border-2 border-indigo-200 overflow-hidden">

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                                                        {/* Front Orientation */}
                                                        {propertyData && isTargetForOrientationAnalysis(propertyData).target && (propertyData as any).orientation_ai && (propertyData as any).orientation_ai.final_orientation !== 'UNCLEAR_IMAGE' && (() => {
                                                            const sat = (propertyData as any).orientation_ai;
                                                            return (
                                                                <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                        <div className="p-4">
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                                                                    <i className="fa-solid fa-compass text-amber-600 group-hover:text-white text-[11px]"></i>
                                                                                </div>
                                                                                <span className="text-[16px] font-black text-slate-700 tracking-tight">Front Orientation</span>
                                                                            </div>
                                                                            {sat.orientation_highlights && (
                                                                                <p className="text-[12px] text-slate-600 leading-relaxed mb-2">
                                                                                    The front of the home likely faces <strong>{sat.final_orientation}</strong>. {sat.orientation_highlights}
                                                                                </p>
                                                                            )}
                                                                            {/* Vastu */}
                                                                            <VastuCard
                                                                                compact
                                                                                azimuth_degrees={sat.azimuth_degrees}
                                                                                pool_visible={sat.pool_visible}
                                                                                pool_direction={sat.pool_direction}
                                                                                garage_direction={sat.garage_direction}
                                                                                open_sky_direction={sat.open_sky_direction}
                                                                            />

                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Outdoors & Privacy */}
                                                        {(analysis?.detailed_analysis?.outdoors_view_quality || analysis?.detailed_analysis?.privacy_layout) && (
                                                            <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
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

                                                        {/* Schools Intelligence */}
                                                        {schoolsIntelligence?.schools?.length > 0 && (
                                                            <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
                                                                        <div className="flex items-center justify-between mb-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                                                    <i className="fa-solid fa-graduation-cap text-blue-600 group-hover:text-white text-[11px]"></i>
                                                                                </div>
                                                                                <span className="text-[16px] font-black text-slate-700 tracking-tight">Schools</span>
                                                                            </div>
                                                                            {schoolsIntelligence.district_rating && (
                                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${schoolsIntelligence.district_rating.startsWith('A') ? 'bg-emerald-100 text-emerald-700' :
                                                                                    schoolsIntelligence.district_rating.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                                                                                        schoolsIntelligence.district_rating.startsWith('C') ? 'bg-amber-100 text-amber-700' :
                                                                                            'bg-rose-100 text-rose-700'
                                                                                    }`}>
                                                                                    {schoolsIntelligence.district_name} · {schoolsIntelligence.district_rating}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* District overview */}
                                                                        {schoolsIntelligence.district_overview && (
                                                                            <p className="text-[12px] text-slate-500 leading-relaxed mb-3">
                                                                                {schoolsIntelligence.district_overview}
                                                                            </p>
                                                                        )}

                                                                        {/* Desirability badge */}
                                                                        {schoolsIntelligence.is_desirable_zone !== undefined && (
                                                                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 ${schoolsIntelligence.is_desirable_zone ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                                                                                <i className={`fa-solid ${schoolsIntelligence.is_desirable_zone ? 'fa-circle-check text-emerald-500' : 'fa-triangle-exclamation text-amber-500'} text-[11px]`}></i>
                                                                                <span className={`text-[11px] font-bold ${schoolsIntelligence.is_desirable_zone ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                                                    {schoolsIntelligence.is_desirable_zone ? 'Desirable School Zone' : 'School Zone Concerns'}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* School tabs — stacked, max 3 */}
                                                                        <div className="flex flex-col gap-1.5 mb-2">
                                                                            {schoolsIntelligence.schools.slice(0, 3).map((school: any, idx: number) => {
                                                                                const isActive = (schoolsExpanded.__activeIdx ?? 0) === idx;
                                                                                const ratingNum = parseFloat(String(school.mls_rating)) || 0;
                                                                                const ratingColor = ratingNum >= 7 ? 'emerald' : ratingNum >= 5 ? 'amber' : 'rose';
                                                                                const levelIcon = school.level?.includes('element') ? 'fa-child' :
                                                                                    school.level?.includes('middle') ? 'fa-school' : 'fa-building-columns';
                                                                                return (
                                                                                    <button
                                                                                        key={idx}
                                                                                        onClick={() => setSchoolsExpanded(prev => ({ ...prev, __activeIdx: idx }))}
                                                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all w-full ${isActive
                                                                                            ? 'bg-indigo-600 shadow-sm border border-indigo-700'
                                                                                            : 'bg-white border border-slate-200 hover:bg-slate-50'
                                                                                            }`}
                                                                                    >
                                                                                        <i className={`fa-solid ${levelIcon} text-[9px] ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}></i>
                                                                                        <span className={`text-[12px] font-bold flex-1 ${isActive ? 'text-white' : 'text-slate-600'}`}>{school.name}</span>
                                                                                        {school.mls_rating && (
                                                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded bg-${ratingColor}-100 text-${ratingColor}-700`}>
                                                                                                {school.mls_rating}/10
                                                                                            </span>
                                                                                        )}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>

                                                                        {/* Active school content */}
                                                                        {(() => {
                                                                            const activeIdx = schoolsExpanded.__activeIdx ?? 0;
                                                                            const school = schoolsIntelligence.schools[activeIdx];
                                                                            if (!school) return null;
                                                                            const isDetailOpen = schoolsExpanded[`detail_${activeIdx}`];
                                                                            return (
                                                                                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white animate-in fade-in duration-200">
                                                                                    {/* Summary — always visible */}
                                                                                    {school.overall_assessment && (
                                                                                        <div className="p-3 bg-indigo-50/50 border-b border-indigo-100/50">
                                                                                            <p className="text-[13px] text-slate-600 leading-relaxed">{school.overall_assessment}</p>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* Show Details toggle */}
                                                                                    <button
                                                                                        onClick={() => setSchoolsExpanded(prev => ({ ...prev, [`detail_${activeIdx}`]: !prev[`detail_${activeIdx}`] }))}
                                                                                        className="w-full flex items-center justify-center gap-1 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                                                                    >
                                                                                        <span>{isDetailOpen ? 'Hide Details' : 'Show Details'}</span>
                                                                                        <i className={`fa-solid fa-chevron-${isDetailOpen ? 'up' : 'down'} text-[8px]`}></i>
                                                                                    </button>

                                                                                    {/* Expandable details */}
                                                                                    {isDetailOpen && (
                                                                                        <div className="px-3 pb-3 space-y-2 border-t border-slate-50">
                                                                                            {/* Stat pills */}
                                                                                            <div className="flex flex-wrap gap-1.5 pt-2">
                                                                                                {school.enrollment && (
                                                                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                                                                                        Enrollment: {school.enrollment?.toLocaleString()}
                                                                                                    </span>
                                                                                                )}
                                                                                                {school.student_teacher_ratio && (
                                                                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                                                                                        Ratio: {school.student_teacher_ratio}
                                                                                                    </span>
                                                                                                )}
                                                                                                {school.graduation_rate && school.graduation_rate !== 'N/A' && (
                                                                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                                                                                        Graduation: {school.graduation_rate}
                                                                                                    </span>
                                                                                                )}
                                                                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full capitalize">
                                                                                                    {school.type || 'Public'}
                                                                                                </span>
                                                                                            </div>

                                                                                            {/* Test Scores */}
                                                                                            {school.test_scores && (
                                                                                                <div>
                                                                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Test Scores</div>
                                                                                                    <p className="text-[11px] text-slate-600 leading-relaxed">{school.test_scores}</p>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* College Readiness */}
                                                                                            {school.college_readiness && school.college_readiness !== 'N/A' && (
                                                                                                <div>
                                                                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">College Readiness</div>
                                                                                                    <p className="text-[11px] text-slate-600 leading-relaxed">{school.college_readiness}</p>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* AP/IB Programs */}
                                                                                            {school.ap_ib_programs && school.ap_ib_programs !== 'N/A' && (
                                                                                                <div>
                                                                                                    <div className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mb-1">AP/IB Programs</div>
                                                                                                    <p className="text-[11px] text-slate-600 leading-relaxed">{school.ap_ib_programs}</p>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* Parent Sentiment */}
                                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                                {school.parent_sentiment_positive && (
                                                                                                    <div className="p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                                                                                                        <div className="text-[9px] font-black text-emerald-600 uppercase mb-1">
                                                                                                            <i className="fa-solid fa-thumbs-up mr-1"></i>Parent Loves
                                                                                                        </div>
                                                                                                        <p className="text-[10px] text-emerald-800 leading-relaxed">{school.parent_sentiment_positive}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {school.parent_sentiment_concerns && (
                                                                                                    <div className="p-2 bg-pink-50/50 rounded-lg border border-pink-100/50">
                                                                                                        <div className="text-[9px] font-black text-pink-600 uppercase mb-1">
                                                                                                            <i className="fa-solid fa-flag mr-1"></i>Parent Concerns
                                                                                                        </div>
                                                                                                        <p className="text-[10px] text-pink-800 leading-relaxed">{school.parent_sentiment_concerns}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>

                                                                                            {/* Activities & Strengths */}
                                                                                            {school.extracurriculars && (
                                                                                                <div>
                                                                                                    <div className="text-[9px] font-black text-violet-500 uppercase tracking-wider mb-1">
                                                                                                        <i className="fa-solid fa-trophy mr-1"></i>Activities & Strengths
                                                                                                    </div>
                                                                                                    <p className="text-[11px] text-slate-600 leading-relaxed">{school.extracurriculars}</p>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* Recent News */}
                                                                                            {school.recent_news && (
                                                                                                <div>
                                                                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Recent News</div>
                                                                                                    <p className="text-[11px] text-slate-500 leading-relaxed italic">{school.recent_news}</p>
                                                                                                </div>
                                                                                            )}

                                                                                            {/* Demographics */}
                                                                                            {school.demographics_summary && (
                                                                                                <div>
                                                                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                                                                                        <i className="fa-solid fa-users mr-1"></i>Demographics
                                                                                                    </div>
                                                                                                    <p className="text-[11px] text-slate-600 leading-relaxed">{school.demographics_summary}</p>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}

                                                                        {/* Education Verdict */}
                                                                        {schoolsIntelligence.education_verdict && (
                                                                            <div className="mt-3 pt-3 border-t border-slate-100">
                                                                                <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Education Verdict</div>
                                                                                <p className="text-[12px] text-slate-600 leading-relaxed">
                                                                                    {schoolsIntelligence.education_verdict.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                        j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                                                                                    ))}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}


                                                        {/* Schools Summary from Comprehensive Analysis (fallback when no full schools data) */}
                                                        {!schoolsIntelligence?.schools?.length && analysis?.schools_summary && (
                                                            <div className="flex flex-col gap-3 bg-slate-50/30 rounded-xl border border-slate-100/80 p-3">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                                                                                <i className="fa-solid fa-graduation-cap text-blue-600 text-[11px]"></i>
                                                                            </div>
                                                                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Schools</span>
                                                                        </div>
                                                                        <p className="text-[13px] text-slate-600 leading-relaxed">
                                                                            {analysis.schools_summary.replace(/\n/g, ' ').split(/\*\*(.*?)\*\*/g).map((chunk: any, j: number) => (
                                                                                j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                                                                            ))}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Architecture Appeal */}
                                                        {(designStyle?.style || analysis?.detailed_analysis?.visual_appeal_condition) && (
                                                            <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                    <div className="p-4">
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

                                                        {/* Neighborhood Identity */}
                                                        {propertyData?.neighborhood_identity?.resolved_name && (() => {
                                                            const nid = propertyData.neighborhood_identity;
                                                            const gem = cityNhEntryOverview || nid.gemini;
                                                            const tierColors: Record<string, string> = {
                                                                'Entry-Level': 'bg-emerald-100 text-emerald-700',
                                                                'Mid-Range': 'bg-blue-100 text-blue-700',
                                                                'Upper Mid-Range': 'bg-indigo-100 text-indigo-700',
                                                                'Premium': 'bg-amber-100 text-amber-700',
                                                                'Ultra-Luxury': 'bg-purple-100 text-purple-700',
                                                            };
                                                            const tier = gem?.price_context?.tier || gem?.market_tier;
                                                            return (
                                                                <div className="flex flex-col gap-3 bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                                                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                                                                        <div className="p-4">
                                                                            <div className="flex items-center gap-2 mb-3">
                                                                                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors">
                                                                                    <i className="fa-solid fa-map-location-dot text-violet-600 group-hover:text-white text-[11px]"></i>
                                                                                </div>
                                                                                <span className="text-[16px] font-black text-slate-700 tracking-tight">Neighborhood: {nid.resolved_name}</span>
                                                                            </div>

                                                                            {gem?.character?.description && (
                                                                                <p className="text-[13px] text-slate-600 leading-relaxed mb-3">
                                                                                    {gem.character.description}
                                                                                </p>
                                                                            )}

                                                                            {/* Tier + key badges */}
                                                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                                                {tier && (
                                                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${tierColors[tier] || 'bg-slate-100 text-slate-600'}`}>
                                                                                        <i className="fa-solid fa-tag mr-1" />{tier}
                                                                                    </span>
                                                                                )}
                                                                                {gem?.price_context?.typical_range && (
                                                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                                        <i className="fa-solid fa-dollar-sign mr-1" />{gem.price_context.typical_range}
                                                                                    </span>
                                                                                )}
                                                                                {gem?.character?.community_type && (
                                                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100">
                                                                                        <i className="fa-solid fa-shield-halved mr-1" />{gem.character.community_type}
                                                                                    </span>
                                                                                )}
                                                                                {gem?.hoa?.has_hoa !== undefined && (
                                                                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${gem.hoa.has_hoa ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                                                                        <i className={`fa-solid ${gem.hoa.has_hoa ? 'fa-building-shield' : 'fa-check'} mr-1`} />
                                                                                        {gem.hoa.has_hoa ? `HOA${gem.hoa.monthly_fee ? ` · ${gem.hoa.monthly_fee}` : ''}` : 'No HOA'}
                                                                                    </span>
                                                                                )}
                                                                                {gem?.character?.era_built && (
                                                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                                        <i className="fa-solid fa-calendar mr-1" />Built {gem.character.era_built}
                                                                                    </span>
                                                                                )}
                                                                                {gem?.character?.architectural_style && (
                                                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                                        <i className="fa-solid fa-ruler-combined mr-1" />{gem.character.architectural_style}
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {/* Standout Features */}
                                                                            {gem?.unique_features?.length > 0 && (
                                                                                <div className="mb-3">
                                                                                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Stand Out Features</div>
                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                        {gem.unique_features.slice(0, 5).map((feat: string, i: number) => (
                                                                                            <span key={i} className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-sm">
                                                                                                {feat}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}

                                                                            {/* Infrastructure */}
                                                                            {gem?.infrastructure_quality && (
                                                                                <div className="mb-3 pt-2 border-t border-slate-100">
                                                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Infrastructure</div>
                                                                                    <p className="text-[11px] text-slate-500 leading-relaxed">{gem.infrastructure_quality}</p>
                                                                                </div>
                                                                            )}

                                                                            {/* Lifestyle hashtags (legacy per-property schema) */}
                                                                            {gem?.character?.lifestyle?.length > 0 && (
                                                                                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                                                                                    {gem.character.lifestyle.map((tag: string, i: number) => (
                                                                                        <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-500 shadow-sm lowercase">
                                                                                            #{tag.replace(/\s+/g, '')}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Row 1, Box 5: Affordability */}
                                                        {propertyData && (
                                                            <div className="flex flex-col gap-3 group">
                                                                <AffordabilityCard
                                                                    state={propertyData.state}
                                                                    city={propertyData.city}
                                                                    county={propertyData.county}
                                                                    countyFips={
                                                                        (propertyData.census_demographics?.stateFips && propertyData.census_demographics?.countyFips)
                                                                            ? `${propertyData.census_demographics.stateFips}${propertyData.census_demographics.countyFips}`
                                                                            : (census?.stateFips && census?.countyFips)
                                                                                ? `${census.stateFips}${census.countyFips}`
                                                                                : undefined
                                                                    }
                                                                    userId={(propertyData as any)._userId}
                                                                    compact
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Row 1, Box 6: Census Demographics */}
                                                        {(propertyData?.census_demographics || census) && (
                                                            <div className="flex flex-col gap-3 group">
                                                                <CensusDemographicsCard 
                                                                    data={(propertyData.census_demographics || census) as unknown as CensusDemographics} 
                                                                    compact
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
        </>
    );
};



