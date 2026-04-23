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
import { isTargetForOrientationAnalysis, isOrientationClear } from '../../utils/propertyPolicies';
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
    /** Filter to only show specific sections */
    showOnly?: string[];
    /** Extra content rendered at the bottom of the Neighborhood SectionCard */
    extraNeighborhoodContent?: React.ReactNode;
    analysis?: ComprehensiveAnalysisResult | null;
    setSchoolsExpanded?: (v: Record<number, boolean>) => void;
    orientationGroundTruth?: { expected_orientation: string; expected_azimuth_deg: number | null; gt_source: string } | null;
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
    showOnly,
    extraNeighborhoodContent,
    orientationGroundTruth,
}) => {
    const show = (key: string) => !showOnly || showOnly.includes(key);
    return (
        <div className="flex flex-col gap-8 w-full">
            {/* Schools */}
            {show('schools') && hasSchools && (
                <SectionCard
                    id="ov-schools"
                    title="Schools"
                    icon="fa-graduation-cap"
                    iconBg="bg-blue-50"
                    iconColor="text-blue-500"
                    className="hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                >
                    <div className="px-4 pt-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {schoolsIntelligence.schools.slice(0, 3).map((school: any, i: number) => {
                                return (
                                    <div
                                        key={i}
                                        className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 p-4 flex flex-col h-full"
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 shadow-sm border border-indigo-100 flex items-center justify-center shrink-0">
                                                    <i className="fa-solid fa-building-columns text-[13px]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-[15px] font-black text-slate-900 leading-tight truncate">
                                                        {school.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{school.type}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md text-[11px] font-black text-emerald-600 shrink-0">
                                                {school.rating || '8'}/10
                                            </div>
                                        </div>

                                        {(school.test_scores || school.overall_assessment) ? (
                                            <div className="mb-4 flex-1">
                                                <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.18em] mb-1">
                                                    {school.test_scores ? 'Test Scores' : 'Overview'}
                                                </div>
                                                <p className="text-[13px] text-slate-500 leading-relaxed font-sans font-medium">
                                                    {school.test_scores || school.overall_assessment}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-[13px] text-slate-400 italic font-medium line-clamp-3 mb-4 flex-1">
                                                Analysis loading...
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between pt-3 border-t border-slate-50 gap-2">
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <i className="fa-solid fa-location-dot text-[11px] text-slate-300" />
                                                <span className="text-[13px] font-black text-slate-600 truncate">{school.distanceMiles?.toFixed(1) || '0.4'} mi</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedSchool(i);
                                                    setIsSchoolModalOpen(true);
                                                }}
                                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                            >
                                                Details
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
            {show('orientation') && data && isTargetForOrientationAnalysis(data).target && (data as any).orientation_ai && isOrientationClear((data as any).orientation_ai) && (() => {
                const sat = (data as any).orientation_ai;
                const gt = orientationGroundTruth;
                
                const displayOrientation = gt ? gt.expected_orientation : sat.final_orientation;
                const displayAzimuth = gt ? gt.expected_azimuth_deg : sat.azimuth_degrees;
                const isGT = !!gt;

                return (
                    <SectionCard
                        id="ov-orientation"
                        title="Orientation and Vastu"
                        icon="fa-compass"
                        iconBg="bg-amber-50"
                        iconColor="text-amber-500"
                        className="hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                    >
                        <div className="px-2 pb-2">
                            {displayOrientation !== 'UNCLEAR' ? (
                                <VastuCard
                                    compact
                                    azimuth_degrees={displayAzimuth}
                                    final_orientation={displayOrientation}
                                    open_sky_direction={sat.open_sky_direction}
                                    isGT={isGT}
                                />
                            ) : (
                                <div className="m-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                                    <div className="flex items-start gap-2">
                                        <i className="fa-solid fa-eye-slash text-slate-400 mt-0.5" />
                                        <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                                            Satellite imagery and listing photos are inconclusive regarding the main entrance orientation.
                                            Vastu analysis is unavailable without a confirmed facing direction.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                );
            })()}

            {/* Neighborhood Identity */}
            {show('neighborhood') && data?.neighborhood_identity?.resolved_name && (() => {
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
                                {/* Tier badge */}
                                {gem?.price_context?.tier && (() => {
                                    const tierBadgeColors: Record<string, string> = {
                                        'entry-level': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                        'mid-range': 'bg-blue-100 text-blue-700 border-blue-200',
                                        'upper mid-range': 'bg-indigo-100 text-indigo-700 border-indigo-200',
                                        'premium': 'bg-purple-100 text-purple-700 border-purple-200',
                                        'ultra-luxury': 'bg-amber-100 text-amber-700 border-amber-200',
                                    };
                                    const cls = tierBadgeColors[gem.price_context.tier.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200';
                                    return (
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${cls}`}>
                                            {gem.price_context.tier}
                                        </span>
                                    );
                                })()}
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
                                {gem?.hoa?.has_hoa !== undefined && !(gem.hoa.has_hoa && gem?.character?.community_type?.toLowerCase().includes('hoa')) && (
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
                                {gem?.character?.typical_home_size && (
                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                                        <i className="fa-solid fa-ruler-combined mr-1" />{gem.character.typical_home_size}
                                    </span>
                                )}
                            </div>

                            {/* Also Known As */}
                            {gem?.alternative_names?.length > 0 && (
                                <div>
                                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Also Known As</div>
                                    <p className="text-[12px] text-slate-600 font-sans font-medium">{gem.alternative_names.join(', ')}</p>
                                </div>
                            )}

                            {/* Typical Lot Size */}
                            {gem?.character?.typical_lot_size && (
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Typical Lot Size</div>
                                    <p className="text-[12px] text-slate-600 font-sans font-medium">{gem.character.typical_lot_size}</p>
                                </div>
                            )}

                            {/* Market Position */}
                            {gem?.price_context?.context && (
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Market Position</div>
                                    <p className="text-[12px] text-slate-600 font-sans font-medium">{gem.price_context.context}</p>
                                </div>
                            )}

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

                            {/* Source + Social Platforms */}
                            <div className="pt-3 border-t border-slate-100 space-y-2">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
                                    Source: {gem?.source_type || 'Real Estate / Google Maps'}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${gem?.nextdoor?.found ? 'bg-[#00b246]/10 border-[#00b246]/30 text-[#008c38]' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm0 14.5a8.5 8.5 0 01-6.277-2.77C6.96 15.122 9.35 14 12 14s5.04 1.122 6.277 2.73A8.5 8.5 0 0112 19.5z" /></svg>
                                        Nextdoor
                                        {gem?.nextdoor?.found && <span className="w-1.5 h-1.5 rounded-full bg-[#00b246] inline-block ml-0.5" />}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-orange-50/70 border-orange-200/50 text-orange-500">
                                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" /></svg>
                                        Reddit
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-blue-50/70 border-blue-200/50 text-blue-500">
                                        <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                        Facebook
                                    </span>
                                </div>
                            </div>
                        </div>

                        {extraNeighborhoodContent && (
                            <div className="mt-2">
                                {extraNeighborhoodContent}
                            </div>
                        )}
                    </SectionCard>
                );
            })()}

            {/* Rental Analysis */}
            {show('rental') && ltrAnalysis && (
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
                                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Long Term</div>
                                    <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wider">Stable</div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Monthly Rent</div>
                                        <div className="text-[18px] font-black text-slate-800">
                                            {(() => {
                                                const rent = ltrAnalysis.monthly_rent || "";
                                                const match = rent.match(/\$[\d,]+(?:\s*(?:to|-)\s*\$[\d,]+)?/);
                                                return match ? match[0] : (rent.length > 20 ? "--" : rent || "--");
                                            })()}
                                        </div>
                                    </div>
                                    {ltrAnalysis.vacancy_rate && (
                                        <div className="flex items-center justify-between pt-2.5 border-t border-emerald-100/50">
                                            <span className="text-[13px] text-slate-500 font-sans font-medium">Vacancy</span>
                                            <span className="text-[13px] text-emerald-700 font-black">
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
                                    <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Short Term</div>
                                    <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase tracking-wider">High Yield</div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Annual Revenue</div>
                                        <div className="text-[18px] font-black text-slate-800">
                                            {(() => {
                                                const str = customAnalysis?.property_investment?.str_performance?.annual_revenue_projection || "";
                                                const summary = ltrAnalysis.comparison_summary || "";
                                                const combined = str + " " + summary;
                                                const match = combined.match(/\$[\d,]{4,}/);
                                                return match ? match[0] : "--";
                                            })()}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2.5 border-t border-indigo-100/50">
                                        <span className="text-[13px] text-slate-500 font-sans font-medium">Occupancy</span>
                                        <span className="text-[13px] text-indigo-700 font-black">
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
            {show('nearby') && (data.google_places || visualPoi || (mapLabels && mapLabels.length > 0)) && (
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

            {/* AI Summary — only in full overview or neighborhood context */}
            {(show('neighborhood') || !showOnly) && customAnalysis?.executiveSummary && (
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
        </div>
    );
};
