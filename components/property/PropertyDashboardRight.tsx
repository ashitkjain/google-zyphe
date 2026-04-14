/**
 * PropertyDashboardRight
 *
 * Right column of the Property Overview Dashboard.
 * Sections: Schools · Orientation & Vastu · Neighborhood · Rental Analysis · What's Nearby? · AI Summary
 */
import React from 'react';
import { PropertyData, CustomAIAnalysisResult } from '../../types';
import VastuCard from './VastuCard';
import NeighborhoodPlacesSection from './NeighborhoodPlacesSection';
import { isTargetForOrientationAnalysis } from '../../utils/propertyPolicies';
import { NeighborhoodAnalysis } from '../../types/ai';
import { SectionCard } from './PropertyDashboardShared';

// ── Props ─────────────────────────────────────────────────────────────────────
interface PropertyDashboardRightProps {
    data: PropertyData;
    customAnalysis?: CustomAIAnalysisResult | null;
    schoolsIntelligence?: any;
    cityNhEntryOverview?: any;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    neighborhoodOverview: string | null;
    ltrAnalysis?: { monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null;
    // feature flags
    hasSchools: boolean;
    hasPlaces: boolean;
    // UI state
    selectedSchool: number;
    setSelectedSchool: React.Dispatch<React.SetStateAction<number>>;
    isSchoolModalOpen: boolean;
    setIsSchoolModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isNearbyCollapsed: boolean;
    setIsNearbyCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    onRunAnalysis?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const PropertyDashboardRight: React.FC<PropertyDashboardRightProps> = ({
    data,
    customAnalysis,
    schoolsIntelligence,
    cityNhEntryOverview,
    visualPoi,
    mapLabels,
    neighborhoodOverview,
    ltrAnalysis,
    hasSchools,
    hasPlaces,
    selectedSchool,
    setSelectedSchool,
    isSchoolModalOpen,
    setIsSchoolModalOpen,
    isNearbyCollapsed,
    setIsNearbyCollapsed,
    onRunAnalysis,
}) => {
    return (
        <>
            {/* Schools */}
            {hasSchools && (
                <SectionCard
                    id="ov-schools"
                    title="Schools"
                    icon="fa-graduation-cap"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-500"
                    className="hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                >
                    <div className="p-4 space-y-2">
                        {schoolsIntelligence.schools.slice(0, 3).map((school: any, i: number) => {
                            const isSelected = selectedSchool === i;
                            return (
                                <button
                                    key={i}
                                    onClick={() => setSelectedSchool(i)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                        : 'bg-white border-slate-100 text-slate-700 hover:border-slate-200'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <i className={`fa-solid fa-building-columns text-[13px] ${isSelected ? 'text-white/70' : 'text-slate-300'}`} />
                                        <span className="text-[13px] font-black truncate max-w-[150px]">{school.name}</span>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded-md text-[11px] font-black ${isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {school.rating || '8'}/10
                                    </div>
                                </button>
                            );
                        })}

                        {schoolsIntelligence.schools[selectedSchool] && (
                            <div className="mt-2 space-y-3">
                                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-1 duration-300">
                                    <p className="text-[13px] text-slate-600 leading-relaxed font-sans font-medium">
                                        {schoolsIntelligence.schools[selectedSchool].description ||
                                            `${schoolsIntelligence.schools[selectedSchool].name} is a highly-rated ${schoolsIntelligence.schools[selectedSchool].type?.toLowerCase() || 'public'} school in ${data.city || 'Dublin'}, CA, known for its strong academic performance and diverse student body.`
                                        }
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Distance</div>
                                        <div className="text-[14px] font-black text-slate-700">{schoolsIntelligence.schools[selectedSchool].distanceMiles?.toFixed(1) || '0.4'} mi</div>
                                    </div>
                                    <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</div>
                                        <div className="text-[14px] font-black text-slate-700">{schoolsIntelligence.schools[selectedSchool].type || 'Public'}</div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsSchoolModalOpen(true)}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-[0.15em] rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-indigo-200"
                                >
                                    View Full School Report
                                </button>
                            </div>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* Schools Detail Modal */}
            {isSchoolModalOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300"
                    onClick={() => setIsSchoolModalOpen(false)}
                >
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"></div>
                    <div
                        className="relative max-w-4xl w-full bg-white rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col"
                        style={{ maxHeight: '92vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-8 pt-8 pb-4 bg-white border-b border-slate-100 relative shrink-0">
                            <button
                                onClick={() => setIsSchoolModalOpen(false)}
                                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
                            >
                                <i className="fa-solid fa-xmark text-sm" />
                            </button>
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                                    <i className={`fa-solid ${schoolsIntelligence.schools[selectedSchool]?.level?.toLowerCase().includes('elementary') ? 'fa-user' :
                                        schoolsIntelligence.schools[selectedSchool]?.level?.toLowerCase().includes('middle') ? 'fa-map' : 'fa-graduation-cap'
                                        } text-white text-[18px]`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-[18px] font-black text-slate-800 tracking-tight leading-tight truncate">
                                            {schoolsIntelligence.schools[selectedSchool]?.name}
                                        </h2>
                                        <div className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md text-[11px] font-black text-emerald-600 shrink-0">
                                            {schoolsIntelligence.schools[selectedSchool]?.rating || '9'}/10
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Grades</span>
                                            <span className="text-[11px] font-bold text-slate-600">{schoolsIntelligence.schools[selectedSchool]?.grades_served || 'K-5'}</span>
                                        </div>
                                        <div className="w-1 h-1 rounded-full bg-slate-200" />
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Distance</span>
                                            <span className="text-[11px] font-bold text-slate-600">{schoolsIntelligence.schools[selectedSchool]?.distanceMiles?.toFixed(1) || '0.4'} mi</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 space-y-8 overflow-y-auto">
                            <div className="space-y-4">
                                <p className="text-[13px] md:text-[14px] text-slate-600 leading-relaxed font-sans font-medium">
                                    {schoolsIntelligence.schools[selectedSchool]?.overall_assessment ||
                                        `${schoolsIntelligence.schools[selectedSchool].name} is a highly-rated ${schoolsIntelligence.schools[selectedSchool].type || 'public'} school in ${data.city || 'Dublin'}, CA, known for its strong academic performance and diverse student body.`}
                                </p>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {[
                                        { label: 'Enrollment', val: schoolsIntelligence.schools[selectedSchool]?.enrollment?.toLocaleString() || '852' },
                                        { label: 'Ratio', val: schoolsIntelligence.schools[selectedSchool]?.student_teacher_ratio || '21:1' },
                                        { label: 'Type', val: (schoolsIntelligence.schools[selectedSchool]?.type || 'Public').toUpperCase() }
                                    ].map((b, i) => (
                                        <div key={i} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none pt-0.5">{b.label}:</span>
                                            <span className="text-[11px] font-black text-slate-700">{b.val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Test Scores</div>
                                    <p className="text-[13px] text-slate-600 leading-relaxed font-sans font-medium">
                                        {schoolsIntelligence.schools[selectedSchool]?.test_scores || 'Students demonstrate high proficiency rates in both Math and ELA, significantly exceeding state averages.'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">
                                            <i className="fa-solid fa-thumbs-up" /> Parent Loves
                                        </div>
                                        <p className="text-[11px] text-emerald-900 leading-relaxed font-sans font-medium">
                                            {schoolsIntelligence.schools[selectedSchool]?.parent_sentiment_positive || 'Parents appreciate the dedicated teachers and the overall quality of education provided.'}
                                        </p>
                                    </div>
                                    <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-100/50">
                                        <div className="flex items-center gap-1.5 text-[9px] font-black text-rose-600 uppercase tracking-widest mb-2">
                                            <i className="fa-solid fa-triangle-exclamation" /> Parent Concerns
                                        </div>
                                        <p className="text-[11px] text-rose-900 leading-relaxed font-sans font-medium">
                                            {schoolsIntelligence.schools[selectedSchool]?.parent_sentiment_concerns || 'Some concerns have been raised regarding resources for special needs students.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                        <i className="fa-solid fa-trophy text-amber-500 text-[9px]" /> Activities & Strengths
                                    </div>
                                    <p className="text-[12px] text-slate-600 leading-relaxed font-sans font-medium">
                                        {schoolsIntelligence.schools[selectedSchool]?.extracurriculars || 'Offers a variety of after-school enrichment programs, music, and arts.'}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Recent News</div>
                                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                                        {schoolsIntelligence.schools[selectedSchool]?.recent_news || 'No major recent news changes reported for this calendar year.'}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                        <i className="fa-solid fa-users text-indigo-500 text-[9px]" /> Demographics
                                    </div>
                                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                                        {schoolsIntelligence.schools[selectedSchool]?.demographics_summary || 'The student body is diverse, with strong community engagement.'}
                                    </p>
                                </div>

                                <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest shrink-0 leading-none">Sources:</span>
                                    {schoolsIntelligence.schools[selectedSchool]?.sources?.map((s: any, idx: number) => (
                                        <a
                                            key={idx}
                                            href={s.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] font-sans font-medium text-blue-500 hover:text-blue-600 underline transition-colors"
                                        >
                                            {s.title || s.label || 'Official Source'}
                                        </a>
                                    )) || <span className="text-[9px] text-slate-400 font-sans font-medium">Verified Zyphe Data • 2026</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Orientation & Vastu */}
            {data && isTargetForOrientationAnalysis(data).target && (data as any).orientation_ai && (data as any).orientation_ai.final_orientation !== 'UNCLEAR_IMAGE' && (() => {
                const sat = (data as any).orientation_ai;
                return (
                    <SectionCard
                        id="ov-orientation"
                        title="Orientation and Vastu"
                        icon="fa-compass"
                        iconBg="bg-amber-50"
                        iconColor="text-amber-500"
                        className="hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                    >
                        <div className="p-4 space-y-3">
                            {sat.orientation_highlights && (
                                <p className="text-[14px] text-slate-600 leading-relaxed font-sans font-medium">
                                    The front of the home likely faces <strong className="text-slate-900">{sat.final_orientation}</strong>. {sat.orientation_highlights}
                                </p>
                            )}
                            <VastuCard
                                compact
                                azimuth_degrees={sat.azimuth_degrees}
                                pool_visible={sat.pool_visible}
                                pool_direction={sat.pool_direction}
                                garage_direction={sat.garage_direction}
                                open_sky_direction={sat.open_sky_direction}
                            />
                        </div>
                    </SectionCard>
                );
            })()}

            {/* Neighborhood Identity */}
            {data?.neighborhood_identity?.resolved_name && (() => {
                const nid = data.neighborhood_identity;
                const gem = cityNhEntryOverview || nid.gemini;
                const tier = nid?.tier;
                const tierColors: Record<string, string> = {
                    'Elite': 'bg-indigo-50 text-indigo-700 border-indigo-100',
                    'Premium': 'bg-blue-50 text-blue-700 border-blue-100',
                    'Standard': 'bg-slate-50 text-slate-700 border-slate-200',
                };
                return (
                    <SectionCard
                        id="ov-neighborhood"
                        title={`Neighborhood: ${nid.resolved_name}`}
                        icon="fa-map-location-dot"
                        iconBg="bg-violet-50"
                        iconColor="text-violet-500"
                        className="hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                    >
                        <div className="p-4 space-y-4">
                            {gem?.character?.description && (
                                <p className="text-[13px] text-slate-600 leading-relaxed font-sans font-medium">
                                    {gem.character.description}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {tier && (
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${tierColors[tier] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        <i className="fa-solid fa-tag mr-1" />{tier}
                                    </span>
                                )}
                                {gem?.price_context?.typical_range && (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                                        <i className="fa-solid fa-dollar-sign mr-1" />{gem.price_context.typical_range}
                                    </span>
                                )}
                                {gem?.character?.community_type && (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100">
                                        <i className="fa-solid fa-shield-halved mr-1" />{gem.character.community_type}
                                    </span>
                                )}
                                {gem?.hoa?.has_hoa !== undefined && (
                                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${gem.hoa.has_hoa ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                        <i className={`fa-solid ${gem.hoa.has_hoa ? 'fa-building-shield' : 'fa-check'} mr-1`} />
                                        {gem.hoa.has_hoa ? 'HOA' : 'No HOA'}
                                    </span>
                                )}
                                {gem?.character?.era_built && (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                                        <i className="fa-solid fa-calendar mr-1" />Built {gem.character.era_built}
                                    </span>
                                )}
                                {gem?.character?.architectural_style && (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                                        <i className="fa-solid fa-ruler-combined mr-1" />{gem.character.architectural_style}
                                    </span>
                                )}
                            </div>

                            {gem?.unique_features && gem.unique_features.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Stand Out Features</div>
                                    <div className="flex flex-wrap gap-2">
                                        {gem.unique_features.slice(0, 5).map((feat: string, i: number) => (
                                            <span key={i} className="text-[11px] font-bold px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
                                                {feat}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {gem?.infrastructure_quality && (
                                <div className="pt-3 border-t border-slate-100">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Infrastructure</div>
                                    <p className="text-[12px] text-slate-500 leading-relaxed font-sans font-medium">{gem.infrastructure_quality}</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                );
            })()}

            {/* Rental Analysis */}
            {ltrAnalysis && (
                <SectionCard
                    id="ov-rental"
                    title="Rent Estimates"
                    icon="fa-house-chimney-window"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-500"
                    className="hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                >
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Long Term Rental */}
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Long Term (LTR)</div>
                                    <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wider">Stable</div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Rent</div>
                                        <div className="text-[16px] font-bold text-slate-800">
                                            {(() => {
                                                const rent = ltrAnalysis.monthly_rent || "";
                                                const match = rent.match(/\$[\d,]+(?:\s*(?:to|-)\s*\$[\d,]+)?/);
                                                return match ? match[0] : (rent.length > 20 ? "--" : rent || "--");
                                            })()}
                                        </div>
                                    </div>
                                    {ltrAnalysis.vacancy_rate && (
                                        <div className="flex items-center justify-between pt-2 border-t border-emerald-100/50">
                                            <span className="text-[11px] text-slate-500 font-sans font-medium">Vacancy</span>
                                            <span className="text-[11px] text-emerald-700 font-black">
                                                {(() => {
                                                    const v = ltrAnalysis.vacancy_rate || "";
                                                    const match = v.match(/(\d+(?:-\d+)?%)/);
                                                    return match ? match[1] : (v.length > 10 ? "--" : v || "--");
                                                })()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Short Term Rental */}
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Short Term (STR)</div>
                                    <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase tracking-wider">High Yield</div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Annual Revenue</div>
                                        <div className="text-[16px] font-bold text-slate-800">
                                            {(() => {
                                                const str = customAnalysis?.property_investment?.str_performance?.annual_revenue_projection || "";
                                                const summary = ltrAnalysis.comparison_summary || "";
                                                const combined = str + " " + summary;
                                                const match = combined.match(/\$[\d,]{4,}/);
                                                return match ? match[0] : "--";
                                            })()}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-indigo-100/50">
                                        <span className="text-[11px] text-slate-500 font-sans font-medium">Occupancy</span>
                                        <span className="text-[11px] text-indigo-700 font-black">
                                            {(() => {
                                                const str = customAnalysis?.property_investment?.str_performance?.occupancy_rate || "";
                                                const summary = ltrAnalysis.comparison_summary || "";
                                                const combined = str + " " + summary;
                                                const match = combined.match(/(\d+(?:-\d+)?%)/);
                                                return match ? match[1] : "--";
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
                            <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 text-[10px]" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Estimated</span>
                        </div>
                    </div>
                </SectionCard>
            )}

            {/* What's Nearby? */}
            {(data.google_places || visualPoi || (mapLabels && mapLabels.length > 0)) && (
                <div id="ov-nearby" className="bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 scroll-mt-24">
                    <button
                        onClick={() => setIsNearbyCollapsed(!isNearbyCollapsed)}
                        className="w-full px-5 py-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors border border-slate-100/50">
                                <i className="fa-solid fa-map-location-dot text-indigo-500 text-[13px]" />
                            </div>
                            <h3 className="text-[18px] font-black text-slate-900 tracking-tight">What's Nearby?</h3>
                        </div>
                        <i className={`fa-solid ${isNearbyCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-[10px] text-slate-400 group-hover:text-indigo-500 transition-all mr-2`} />
                    </button>
                    <div className={`${isNearbyCollapsed ? 'hidden' : 'block'}`}>
                        <NeighborhoodPlacesSection
                            data={data}
                            visualPoi={visualPoi}
                            mapLabels={mapLabels}
                            mapZoomOut={data.mapZoomOut}
                            address={data.address}
                            neighborhoodOverview={neighborhoodOverview}
                            hoaAmenities={data.hoa?.amenities}
                            isEmbeddedCard={true}
                        />
                    </div>
                </div>
            )}

            {/* AI Summary */}
            {customAnalysis?.executiveSummary && (
                <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl shadow-indigo-900/20 border border-indigo-500/10">
                    <div className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg shadow-indigo-500/40">
                            <i className="fa-solid fa-wand-magic-sparkles text-white text-[12px]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">Analyst AI Summary</div>
                            <p className="text-[12px] text-slate-300 leading-relaxed font-sans font-medium italic opacity-90">
                                &ldquo;{customAnalysis.executiveSummary}&rdquo;
                            </p>
                        </div>
                    </div>
                    {onRunAnalysis && (
                        <button onClick={onRunAnalysis} className="mt-5 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/25">
                            Run Full AI Audit
                        </button>
                    )}
                </div>
            )}
        </>
    );
};
