import React from 'react';
import { CustomAIAnalysisResult } from '../../../../types';
import { EmptyState } from './CommonComponents';
import { isTargetForOrientationAnalysis } from '../../../../utils/propertyPolicies';

interface InteriorViewProps {
    data: CustomAIAnalysisResult['home_interior'];
}

export const InteriorView: React.FC<InteriorViewProps> = ({ data }) => {
    if (!data?.overall_description) return <EmptyState section="Interior" />;
    return (
        <section className="space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-12 border-t border-gray-100">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-palette text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Design Philosophy</h4>
                        </div>
                        <div className="inline-block bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase px-3 py-1.5 rounded-full mb-2 self-start">{data.design_style?.style}</div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.design_style?.reasoning}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-swatchbook text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Colors & Materials</h4>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.color_and_materials}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-lightbulb text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Lighting Environment</h4>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.lighting}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-arrows-up-down-left-right text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Spatial Architecture</h4>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.spatial_flow}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-chair text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Staging & Furnishings</h4>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.staging_and_furnishings}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-screwdriver-wrench text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Condition & Finish</h4>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.condition_and_finish}</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

interface RoomsViewProps {
    highlights: CustomAIAnalysisResult['room_highlights'];
}

export const RoomsView: React.FC<RoomsViewProps> = ({ highlights }) => {
    if (!highlights || highlights.length === 0) return <EmptyState section="Room Highlights" />;

    // Canonical walk-through order — lower index = shown first
    const ROOM_ORDER: [RegExp, number][] = [
        [/entry|foyer|hall/i, 0],
        [/living|family|great room/i, 1],
        [/dining|nook|breakfast nook/i, 2],
        [/kitchen/i, 3],
        [/primary bed|master bed/i, 4],
        [/bedroom|bed/i, 5],         // all other bedrooms after primary
        [/primary bath|master bath/i, 6],
        [/bathroom|bath|half bath|powder/i, 7],
        [/laundry|utility/i, 8],
        [/office|den|bonus/i, 9],
        [/garage/i, 10],
        [/patio|deck|backyard|outdoor|pool/i, 11],
    ];

    const roomSortKey = (name: string = '') => {
        for (const [pattern, rank] of ROOM_ORDER) {
            if (pattern.test(name)) return rank;
        }
        return 99; // unknown rooms go last
    };

    const sorted = [...highlights].sort((a, b) => {
        const rankA = roomSortKey(a.room_name);
        const rankB = roomSortKey(b.room_name);
        if (rankA !== rankB) return rankA - rankB;
        // Within same category, sort alphabetically (Bedroom 2 before Bedroom 3)
        return (a.room_name || '').localeCompare(b.room_name || '');
    });

    // Group rooms into sections for visual separation
    const SECTION_LABELS: Record<number, string> = {
        0: 'Common Areas', 1: 'Common Areas', 2: 'Common Areas', 3: 'Common Areas',
        4: 'Bedrooms', 5: 'Bedrooms', 6: 'Bathrooms', 7: 'Bathrooms',
        8: 'Other Spaces', 9: 'Other Spaces', 10: 'Other Spaces', 11: 'Other Spaces',
    };

    const ROOM_ICONS: [RegExp, string][] = [
        [/entry|foyer|hall/i, 'fa-door-open'],
        [/living|family|great/i, 'fa-couch'],
        [/dining/i, 'fa-utensils'],
        [/kitchen/i, 'fa-kitchen-set'],
        [/bed/i, 'fa-bed'],
        [/bath|powder/i, 'fa-shower'],
        [/laundry|utility/i, 'fa-washing-machine'],
        [/office|den|bonus/i, 'fa-briefcase'],
        [/garage/i, 'fa-warehouse'],
        [/patio|deck|backyard|outdoor|pool/i, 'fa-tree'],
    ];

    const roomIcon = (name: string = '') => {
        for (const [pattern, icon] of ROOM_ICONS) {
            if (pattern.test(name)) return icon;
        }
        return 'fa-door-open';
    };

    // Build grouped sections
    type Section = { label: string; rooms: typeof sorted };
    const sections: Section[] = [];
    let lastLabel = '';
    for (const room of sorted) {
        const rank = roomSortKey(room.room_name);
        const label = SECTION_LABELS[rank] || 'Other';
        if (label !== lastLabel) {
            sections.push({ label, rooms: [] });
            lastLabel = label;
        }
        sections[sections.length - 1].rooms.push(room);
    }

    return (
        <section>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sorted.map((room, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className={`fa-solid ${roomIcon(room.room_name)} text-lg`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-black text-gray-900 text-lg tracking-tight truncate">{room.room_name}</h4>
                            </div>
                            {room.floor && (
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 shrink-0">{room.floor}</span>
                            )}
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed mb-4">{room.description}</p>
                        {room.potential_improvements && (
                            <div className="pt-4 border-t border-gray-100 bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl mt-auto">
                                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">Strategic Enhancement</div>
                                <p className="text-gray-500 text-[13px] font-sans font-normal italic leading-relaxed">"{room.potential_improvements}"</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
};

interface SatellitaryOrientation {
    final_orientation: string;
    azimuth_degrees?: number | null;
    confidence?: 'high' | 'medium' | 'low';
    image_quality?: 'clear' | 'acceptable' | 'blurry';
    aerial_only_mode?: boolean;
    feng_shui_vastu?: string | null;
    privacy_insight?: string;
    lot_coverage_hardscape?: number | null;
    lot_coverage_pervious?: number | null;
    buyer_pro?: string;
    buyer_con?: string;
    orientation_highlights?: string;
    // Tier 2: aerial site features
    pool_visible?: boolean | null;
    pool_direction?: string | null;
    garage_direction?: string | null;
    open_sky_direction?: string | null;
}

interface ExteriorViewProps {
    data: CustomAIAnalysisResult['exterior_and_neighborhood'];
    streetViewAnalysis?: any;
    satellitaryOrientation?: SatellitaryOrientation | null;
    satelliteLoading?: boolean;
    onRefreshOrientation?: () => void;
    propertyData?: any;
}

export const ExteriorView: React.FC<ExteriorViewProps> = ({ data, streetViewAnalysis, satellitaryOrientation, satelliteLoading, onRefreshOrientation, propertyData }) => {
    if (!data?.exterior_and_lot_appeal?.architecture_style) return <EmptyState section="Exterior" />;
    
    // Check if this property is a target for orientation analysis
    const isTarget = propertyData ? isTargetForOrientationAnalysis(propertyData).target : true;
    return (
        <section className="space-y-8">
            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
                {/* Visual Street View Forensic Scan Integration */}
                {(streetViewAnalysis?.imageUrl || streetViewAnalysis?.curbAppealScore) && (
                    <div className="space-y-8">
                        <div className="flex flex-col lg:flex-row gap-8 items-stretch pt-4">
                            {streetViewAnalysis?.imageUrl && (
                                <div className="lg:w-1/2 rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-inner group relative">
                                    <img
                                        src={streetViewAnalysis.imageUrl}
                                        alt="Property Street View"
                                        className="w-full h-full object-cover min-h-[350px] lg:min-h-[450px] group-hover:scale-105 transition-transform duration-[2s]"
                                    />
                                    <div className="absolute top-6 left-6 bg-black/50 backdrop-blur-xl text-white px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border border-white/20 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        Live AI Forensic Scan
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent"></div>
                                    <div className="absolute bottom-6 left-6 text-white text-[11px] font-black uppercase tracking-widest">
                                        Google Street View Coverage
                                    </div>
                                </div>
                            )}
                            <div className={`${streetViewAnalysis?.imageUrl ? 'lg:w-1/2' : 'w-full'} flex flex-col gap-4`}>
                                {/* AI Curb Appeal Box */}
                                <div className="bg-indigo-50/30 rounded-[2rem] p-8 border border-indigo-100/50 flex flex-col justify-center">
                                    <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4">FORENSIC CURB APPEAL</div>
                                    <div className="flex items-end gap-3 mb-6">
                                        <span className="text-7xl font-black text-gray-900 leading-none tracking-tighter">
                                            {streetViewAnalysis?.curbAppealScore ? (streetViewAnalysis.curbAppealScore <= 10 ? streetViewAnalysis.curbAppealScore * 10 : streetViewAnalysis.curbAppealScore) : 'N/A'}
                                        </span>
                                        <span className="text-2xl font-black text-indigo-300 mb-1">/ 100</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-indigo-100/50">
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Privacy Seclusion</div>
                                            <div className="text-gray-800 text-[13px] font-bold">{streetViewAnalysis?.privacyRating || 'Scan pending...'}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Parking Logistics</div>
                                            <div className="text-gray-800 text-[13px] font-bold">{streetViewAnalysis?.parkingLogistics || 'Scan pending...'}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Utility System</div>
                                            <div className="text-gray-800 text-[13px] font-bold">{streetViewAnalysis?.utilityAesthetic || 'Scan pending...'}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Architecture</div>
                                            <div className="text-gray-800 text-[13px] font-bold truncate">{streetViewAnalysis?.architecturalStyle || 'No data'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Maintenance Forensic Box */}
                                {streetViewAnalysis?.maintenanceRisks && streetViewAnalysis.maintenanceRisks.length > 0 && (
                                    <div className="bg-rose-50/20 rounded-[2rem] p-6 border border-rose-100/50">
                                        <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                            Forensic Maintenance Alerts
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {streetViewAnalysis.maintenanceRisks.map((risk: string, i: number) => (
                                                <div key={i} className="px-3 py-1.5 bg-white border border-rose-100 text-rose-600 rounded-xl text-[11px] font-black uppercase tracking-tight">
                                                    {risk}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Extended Forensic Analysis */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 space-y-3">
                                <div className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fa-solid fa-shield-cat"></i>
                                    Family & Safety Assessment
                                </div>
                                <p className="text-[13.5px] text-gray-700 font-medium leading-relaxed italic border-l-2 border-indigo-100 pl-4">
                                    {streetViewAnalysis?.familySafety ? `"${streetViewAnalysis.familySafety}"` : 'Forensic scan required for safety assessment.'}
                                </p>
                            </div>
                            <div className="p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 space-y-3">
                                <div className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fa-solid fa-solar-panel"></i>
                                    Solar & Obstruction Intake
                                </div>
                                <p className="text-[13.5px] text-gray-700 font-medium leading-relaxed italic border-l-2 border-emerald-100 pl-4">
                                    {streetViewAnalysis?.solarObstructions ? `"${streetViewAnalysis.solarObstructions}"` : 'Forensic scan required for solar obstruction analysis.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Unified card grid ───── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-6">

                    {/* Satellite loading placeholder */}
                    {satelliteLoading && !satellitaryOrientation && (
                        <div className="col-span-full flex items-center gap-3 text-gray-400">
                            <svg className="animate-spin h-4 w-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-[13px] font-semibold text-gray-400">Analysing satellite imagery…</span>
                        </div>
                    )}

                    {/* Satellite cards — only when orientation data is available AND it is a target */}
                    {isTarget && satellitaryOrientation && satellitaryOrientation.final_orientation !== 'UNCLEAR_IMAGE' && (() => {
                        const sat = satellitaryOrientation;
                        return (<>

                            {sat.privacy_insight && (
                                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                                <i className="fa-solid fa-eye-slash text-lg"></i>
                                            </div>
                                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Privacy</h4>
                                        </div>
                                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{sat.privacy_insight}</p>
                                </div>
                            )}
                            {sat.lot_coverage_hardscape != null && (
                                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                            <i className="fa-solid fa-layer-group text-lg"></i>
                                        </div>
                                        <h4 className="font-black text-gray-900 text-lg tracking-tight">Lot Coverage</h4>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
                                        <div className="h-full bg-gray-400 rounded-full" style={{ width: `${Math.round((sat.lot_coverage_hardscape > 0 && sat.lot_coverage_hardscape <= 1) ? sat.lot_coverage_hardscape * 100 : (sat.lot_coverage_hardscape ?? 0))}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[11px] font-black text-gray-500 mb-3">
                                        <span>{Math.round((sat.lot_coverage_hardscape > 0 && sat.lot_coverage_hardscape <= 1) ? sat.lot_coverage_hardscape * 100 : (sat.lot_coverage_hardscape ?? 0))}% hardscape</span>
                                        <span className="text-emerald-600">{Math.round((sat.lot_coverage_pervious > 0 && sat.lot_coverage_pervious <= 1) ? sat.lot_coverage_pervious * 100 : (sat.lot_coverage_pervious ?? (100 - ((sat.lot_coverage_hardscape > 0 && sat.lot_coverage_hardscape <= 1) ? sat.lot_coverage_hardscape * 100 : (sat.lot_coverage_hardscape ?? 0)))))}% green</span>
                                    </div>
                                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">
                                        ~{Math.round((sat.lot_coverage_hardscape > 0 && sat.lot_coverage_hardscape <= 1) ? sat.lot_coverage_hardscape * 100 : (sat.lot_coverage_hardscape ?? 0))}% of the lot is hardscape (roof, driveway, patio) and ~{Math.round((sat.lot_coverage_pervious > 0 && sat.lot_coverage_pervious <= 1) ? sat.lot_coverage_pervious * 100 : (sat.lot_coverage_pervious ?? (100 - ((sat.lot_coverage_hardscape > 0 && sat.lot_coverage_hardscape <= 1) ? sat.lot_coverage_hardscape * 100 : (sat.lot_coverage_hardscape ?? 0)))))}% is pervious green space.
                                    </p>
                                </div>
                            )}
                        </>);
                    })()}

                    {/* Architecture & lot cards — always shown */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-building-columns text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Style</h4>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.exterior_and_lot_appeal.architecture_style}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-house text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Curb Appeal</h4>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.exterior_and_lot_appeal.curb_appeal}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                <i className="fa-solid fa-tree text-lg"></i>
                            </div>
                            <h4 className="font-black text-gray-900 text-lg tracking-tight">Backyard & Patio</h4>
                        </div>
                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.exterior_and_lot_appeal.backyard_and_patio}</p>
                    </div>
                    {data.views_privacy_orientation?.views && (
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                    <i className="fa-solid fa-mountain-sun text-lg"></i>
                                </div>
                                <h4 className="font-black text-gray-900 text-lg tracking-tight">Views</h4>
                            </div>
                            <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{data.views_privacy_orientation.views}</p>
                        </div>
                    )}
                </div>

            </div>
        </section>
    );
};
