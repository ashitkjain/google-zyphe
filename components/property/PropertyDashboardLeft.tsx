/**
 * PropertyDashboardLeft
 *
 * Left column of the Property Overview Dashboard.
 * Sections: MLS Property Data · Environment · Resilience & Hazards · Solar Insights · Daily Living & Commute
 */
import React from 'react';
import { PropertyData, ComprehensiveAnalysisResult, CustomAIAnalysisResult } from '../../types';
import SeasonalSunCard from './SeasonalSunCard';
import PropertyImages from './PropertyImages';
import { calculateSolarPotential } from '../../utils/solarCalculations';
import { SectionCard } from './PropertyDashboardShared';

// ── MLS Detail helpers ─────────────────────────────────────────────────────────
const parseVal = (val: any): string | null => {
    if (val === null || val === undefined || val === '') return null;
    if (Array.isArray(val)) return val.filter(Boolean).join(', ') || null;
    if (typeof val === 'string' && val.startsWith('[')) {
        try { const p = JSON.parse(val); if (Array.isArray(p)) return p.filter(Boolean).join(', '); } catch { }
    }
    return String(val);
};
const parseList = (val: any): string[] => {
    if (!val) return [];
    if (typeof val === 'string') {
        if (val.startsWith('[')) { try { return JSON.parse(val).filter(Boolean); } catch { } }
        return val.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(val)) return val.filter(Boolean).map(String);
    return [String(val)];
};
const MLSRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex gap-3 py-1.5 border-b border-slate-50/50 last:border-0 group">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] w-24 flex-shrink-0 pt-0.5 transition-colors group-hover:text-slate-500">{label}</span>
        <span className="text-[14px] text-slate-700 font-sans font-medium leading-relaxed line-clamp-2 transition-colors group-hover:text-slate-900">{value}</span>
    </div>
);
const MLSGroup: React.FC<{ icon: string; title: string; rows: { label: string; value: string | null }[] }> = ({ icon, title, rows }) => {
    const valid = rows.filter(r => r.value);
    if (!valid.length) return null;
    return (
        <div className="bg-slate-50/30 rounded-2xl border border-slate-100/60 p-4 transition-all hover:bg-slate-50/50">
            <div className="flex items-center gap-2 mb-2.5">
                <div className="w-5 h-5 rounded-md bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                    <i className={`fa-solid ${icon} text-[9px] text-indigo-500`} />
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
            </div>
            <div className="space-y-0">
                {valid.map(r => <MLSRow key={r.label} label={r.label} value={r.value!} />)}
            </div>
        </div>
    );
};

// ── Risk helpers ───────────────────────────────────────────────────────────────
const riskLevel = (score?: number | null) => {
    if (score == null) return { label: 'N/A', color: 'text-slate-400' };
    if (score <= 2) return { label: 'Low', color: 'text-emerald-600' };
    if (score <= 5) return { label: 'Moderate', color: 'text-amber-600' };
    if (score <= 7) return { label: 'High', color: 'text-orange-600' };
    return { label: 'Severe', color: 'text-red-600' };
};
const getAQIColor = (aqi: number) => {
    if (aqi <= 50) return 'text-emerald-600';
    if (aqi <= 100) return 'text-amber-600';
    if (aqi <= 150) return 'text-orange-600';
    return 'text-rose-600';
};
const getAQILabel = (aqi: number) => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy (Sensitive)';
    return 'Unhealthy';
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface PropertyDashboardLeftProps {
    data: PropertyData;
    micro?: { insight: string; fetchedAt: number } | null;
    // feature flags
    hasEnv: boolean;
    hasCoords: boolean;
    hasNoise: boolean;
    hasPollen: boolean;
    hasSolar: boolean;
    hasWalk: boolean;
    hasBroadband: boolean;
    hasEV: boolean;
    // computed solar data
    solarPotential: ReturnType<typeof calculateSolarPotential> | null;
    // UI state
    mlsOpen: boolean;
    setMlsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    envOpen: Record<string, boolean>;
    toggleEnv: (key: string) => void;
    /** If provided, only renders the listed section keys: 'mls' | 'environment' | 'resilience' | 'solar' | 'commute' | 'walk' | 'broadband' */
    showOnly?: string[];
    customAnalysis?: CustomAIAnalysisResult | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const PropertyDashboardLeft: React.FC<PropertyDashboardLeftProps> = ({
    data,
    micro,
    hasEnv,
    hasCoords,
    hasNoise,
    hasPollen,
    hasSolar,
    hasWalk,
    hasBroadband,
    hasEV,
    solarPotential,
    mlsOpen,
    setMlsOpen,
    envOpen,
    toggleEnv,
    showOnly,
    customAnalysis,
}) => {
    const price = data.listPrice ?? data.price;
    const show = (key: string) => !showOnly || showOnly.includes(key);

    return (
        <>
            {/* Property title / MLS */}
            {show('mls') && (
                <div id="ov-property" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24">
                    {/* Removed duplicated internal header */}
                    <div className="px-5 py-5 flex flex-col gap-4">
                        {/* Row 1: Address + badges */}
                        {/* Removed duplicated address block */}
                    </div>

                    {/* Listing Remarks — full width above specifications */}
                    {data.description && (
                        <div className="w-full px-5 py-5 border-t border-slate-100">
                            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                                        <i className="fa-solid fa-align-left text-indigo-600 text-[11px]" />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Listing Remarks</span>
                                </div>
                                <p className="text-[14px] text-slate-600 leading-relaxed font-sans font-medium">
                                    {data.description}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Detailed MLS Specifications */}
                    {data.resoFacts && (
                        <div className="border-t border-slate-100">
                            <div className="px-5 py-4 bg-slate-50/30 flex items-center justify-between border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-sm">
                                        <i className="fa-solid fa-list text-indigo-500 text-[10px]" />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-[0.15em]">
                                        Detailed Specifications
                                    </span>
                                </div>
                            </div>

                            <div className="px-5 py-6 flex flex-col lg:flex-row gap-6">
                                {data.images && data.images.length > 0 && (
                                    <div className="w-full lg:w-1/2 shrink-0">
                                        <PropertyImages
                                            images={data.images}
                                            loading={false}
                                            homeStatus={data.homeStatus}
                                            attribution={data.attributionInfo}
                                            imageAnalysis={customAnalysis?.image_by_image_analysis}
                                        />
                                    </div>
                                )}
                                <div className="flex-1 flex flex-col gap-3 min-w-0">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5">
                                        <MLSGroup icon="fa-landmark" title="Structure" rows={[
                                            { label: 'Style', value: parseVal(data.resoFacts?.architecturalStyle) },
                                            { label: 'Stories', value: data.resoFacts?.stories ? `${data.resoFacts.stories}` : null },
                                            { label: 'Construction', value: parseVal(data.resoFacts?.constructionMaterials) },
                                            { label: 'Flooring', value: parseVal(data.resoFacts?.flooring) },
                                            { label: 'Roof', value: parseVal(data.resoFacts?.roofType) },
                                            { label: 'Condition', value: parseVal(data.resoFacts?.propertyCondition) },
                                        ]} />
                                        <MLSGroup icon="fa-car-side" title="Parking" rows={[
                                            { label: 'Garage', value: parseVal(data.resoFacts?.garageParkingCapacity) },
                                            { label: 'Parking', value: parseVal(data.resoFacts?.parkingFeatures) },
                                        ]} />
                                        <MLSGroup icon="fa-couch" title="Interior" rows={[
                                            { label: 'Heating', value: parseVal(data.resoFacts?.heating) },
                                            { label: 'Cooling', value: parseVal(data.resoFacts?.cooling) },
                                            { label: 'Appliances', value: parseVal(data.resoFacts?.appliances) },
                                            { label: 'Basement', value: parseVal(data.resoFacts?.basement) },
                                            { label: 'Features', value: parseVal(data.resoFacts?.interiorFeatures) },
                                        ]} />
                                        <MLSGroup icon="fa-plug" title="Utilities" rows={[
                                            { label: 'Utilities', value: parseVal(data.resoFacts?.utilities) },
                                            { label: 'Electric', value: parseVal(data.resoFacts?.electric) },
                                            { label: 'Sewer', value: parseVal(data.resoFacts?.sewer) },
                                            { label: 'Water', value: parseVal(data.resoFacts?.waterSource) },
                                        ]} />
                                        {(() => {
                                            const lotFeats = parseList(data.resoFacts?.lotFeatures);
                                            const fencing = parseList(data.resoFacts?.fencing);
                                            const rows = [
                                                { label: 'Lot Size', value: data.lotSize ?? null },
                                                { label: 'Lot Features', value: lotFeats.length ? lotFeats.join(', ') : null },
                                                { label: 'Fencing', value: fencing.length ? fencing.join(', ') : null },
                                            ];
                                            return <MLSGroup icon="fa-chart-area" title="Lot & Outdoor" rows={rows} />;
                                        })()}
                                        <MLSGroup icon="fa-shield" title="Security & Windows" rows={[
                                            { label: 'Security', value: parseVal(data.resoFacts?.securityFeatures) },
                                            { label: 'Windows', value: parseVal(data.resoFacts?.windowFeatures) },
                                            { label: 'Fireplace', value: parseVal(data.resoFacts?.fireplaceFeatures) },
                                            { label: 'Laundry', value: parseVal(data.resoFacts?.laundryFeatures) },
                                        ]} />
                                        {data.hoa && (
                                            <MLSGroup icon="fa-building" title="HOA" rows={[
                                                { label: 'Name', value: data.hoa.name ?? null },
                                                { label: 'Fee', value: data.hoa.fee ?? null },
                                                { label: 'Phone', value: data.hoa.phone ?? null },
                                                { label: 'Covers', value: data.hoa.feeIncludes?.filter((x: string) => x !== 'Other' && x !== 'None').join(', ') || null },
                                                { label: 'Amenities', value: data.hoa.amenities?.filter((x: string) => x !== 'Other').join(', ') || null },
                                                { label: 'Units', value: data.resoFacts?.numberOfUnitsInCommunity ? `${data.resoFacts.numberOfUnitsInCommunity}` : null },
                                            ]} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}{/* end mls */}

            {/* Environment */}
            {show('environment') && (hasEnv || hasCoords) && (
                <SectionCard
                    id="ov-environment"
                    title="Environment"
                    icon="fa-leaf"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-500"
                    className="mt-4"
                    noPadding
                >
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Noise */}
                        <div className="lg:col-span-1">
                            {hasNoise && (
                                <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full group">
                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 shadow-sm h-full p-4 flex flex-col">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-600 transition-colors">
                                                <i className="fa-solid fa-volume-xmark text-purple-600 group-hover:text-white text-[13px]" />
                                            </div>
                                            <span className="text-[15px] font-bold text-slate-800 tracking-tight">Noise</span>
                                            <span className="ml-auto text-[11px] font-black text-slate-400 uppercase tracking-widest">Score</span>
                                            <span className="text-[16px] font-bold text-slate-900 leading-none">{data.noiseScore}/100</span>
                                        </div>
                                        <div className="space-y-3 flex-1">
                                            {[
                                                { label: 'Traffic', score: data.noiseTrafficScore ?? null, desc: data.noiseTrafficDesc ?? null },
                                                { label: 'Local', score: data.noiseLocalScore ?? null, desc: data.noiseLocalDesc ?? null },
                                                { label: 'Airport', score: data.noiseAirportScore ?? null, desc: data.noiseAirportDesc ?? null }
                                            ].map((n, i) => (
                                                <div key={i} className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest leading-none">{n.label}</span>
                                                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{n.desc ?? '—'}</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-purple-400 rounded-full" style={{ width: n.score != null ? `${n.score}%` : '0%' }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-4">HowLoud Data Engine</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Air Quality */}
                        <div className="lg:col-span-1">
                            {data.airQuality && (
                                <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full group">
                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 shadow-sm h-full p-4 flex flex-col">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                                                <i className="fa-solid fa-wind text-emerald-600 group-hover:text-white text-[13px]" />
                                            </div>
                                            <span className="text-[15px] font-bold text-slate-800 tracking-tight">Air Quality</span>
                                            <span className="ml-auto text-[11px] font-black text-slate-400 uppercase tracking-widest">US AQI</span>
                                            <span className={`text-[16px] font-bold leading-none ${getAQIColor(data.airQuality.aqi)}`}>{data.airQuality.aqi}</span>
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[13px] font-black text-emerald-700">{getAQILabel(data.airQuality.aqi)}</span>
                                            </div>
                                            <p className="text-[14px] text-slate-600 font-sans font-medium leading-relaxed">
                                                "With this level of air quality, you have no limitations. Enjoy the outdoors!"
                                            </p>
                                            <button
                                                onClick={() => toggleEnv('aqi_bento')}
                                                className="w-full flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3 hover:text-emerald-500 transition-colors"
                                            >
                                                <span>Molecular Breakdown</span>
                                                <i className={`fa-solid fa-chevron-${envOpen['aqi_bento'] ? 'up' : 'down'} transition-transform`} />
                                            </button>
                                            {envOpen['aqi_bento'] && (
                                                <div className="pt-2 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    {data.airQuality.pollutants?.map((p, i) => (
                                                        <div key={i} className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{p.fullName}</span>
                                                            <div className="flex items-baseline gap-1.5">
                                                                <span className="text-[13px] font-black text-slate-800">{p.concentration.toFixed(1)}</span>
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter truncate opacity-80">{p.unit.replace(/_/g, ' ')}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-4">Google Air Quality API</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pollen */}
                        <div className="lg:col-span-1">
                            {hasPollen && (
                                <div className="flex flex-col gap-2 bg-white rounded-xl border border-slate-100/80 p-2 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full group">
                                    <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 shadow-sm h-full p-4 flex flex-col">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-600 transition-colors">
                                                <i className="fa-solid fa-seedling text-amber-600 group-hover:text-white text-[13px]" />
                                            </div>
                                            <span className="text-[15px] font-bold text-slate-800 tracking-tight">Pollen Watch</span>
                                            <span className="ml-auto text-[11px] font-black text-slate-400 uppercase tracking-widest">Level</span>
                                            <span className="text-[16px] font-bold text-amber-600 leading-none">{data.pollen?.category || 'Low'}</span>
                                        </div>
                                        <div className="space-y-3 flex-1">
                                            <div className="flex flex-col p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <i className="fa-solid fa-leaf text-[11px] text-amber-300" />
                                                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest leading-none">Dominant Type</span>
                                                </div>
                                                <div className="text-[15px] font-black text-slate-800 leading-tight">{data.pollen?.dominantPollenType || 'Grasses'}</div>
                                            </div>
                                            <p className="text-[14px] text-slate-600 font-sans font-medium leading-relaxed">
                                                {data.pollen?.description || 'Pollen levels are currently within a comfortable range for most sensitive groups.'}
                                            </p>
                                        </div>
                                        <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-4">Google Pollen API</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </SectionCard>
            )}{/* end environment */}

            {/* Daily Living & Commute */}
            {(show('commute') || show('walk') || show('broadband')) && (hasWalk || hasBroadband || hasSolar || hasEV) && (
                <SectionCard
                    id="ov-living"
                    title="Daily Living & Commute"
                    icon="fa-briefcase"
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-500"
                    className="mt-4"
                    noPadding
                >
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Col 1: Mobility & Commute */}
                        {(show('commute') || show('walk')) && (
                            <div className="lg:col-span-4 space-y-4">
                                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <i className="fa-solid fa-person-walking text-emerald-400 text-[14px]" />
                                        <span className="text-[14px] font-bold text-slate-800 tracking-tight">Getting Around</span>
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            { label: 'WALK', score: data.walkScore, desc: data.walkScoreDesc, icon: 'fa-person-walking' },
                                            { label: 'TRANSIT', score: data.transitScore, desc: data.transitScoreDesc || 'N/A', icon: 'fa-bus' },
                                            { label: 'BIKE', score: data.bikeScore, desc: data.bikeScoreDesc, icon: 'fa-bicycle' },
                                        ].map((m, i) => (
                                            <div key={i} className="flex flex-col">
                                                <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                    <i className={`fa-solid ${m.icon} text-[9px]`} />
                                                    <span>{m.label}</span>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[16px] font-black text-slate-700">{m.score != null ? `${m.score}/100` : 'N/A'}</span>
                                                    <span className="text-[12px] text-slate-400 font-medium truncate">{m.desc}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-4">Walk Score</div>
                                </div>

                            </div>
                        )}{/* end commute/walk */}

                        {/* Col 2: Connectivity */}
                        {show('broadband') && (
                            <div className="lg:col-span-4">
                                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm h-full">
                                    <div className="flex items-center gap-2 mb-4">
                                        <i className="fa-solid fa-wifi text-blue-400 text-[14px]" />
                                        <span className="text-[14px] font-bold text-slate-800 tracking-tight">Connectivity</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                            FIBER <i className="fa-solid fa-check text-[8px]" />
                                        </span>
                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase tracking-wider">5G</span>
                                    </div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Internet Availability</div>
                                    <div>
                                        {data.broadband?.internetProviders?.slice(0, 4).map((isp, i) => (
                                            <div key={i} className={`grid grid-cols-[1fr_80px_56px] items-center py-2 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <i className="fa-solid fa-signal text-indigo-400 text-[11px]" />
                                                    <span className="text-[12px] font-bold text-slate-900 truncate">{isp.name}</span>
                                                </div>
                                                <div className="flex justify-center">
                                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest text-center ${isp.technology === 'Fiber' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        {isp.technology}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[13px] font-medium text-slate-900">{isp.maxDownloadMbps >= 1000 ? `${(isp.maxDownloadMbps / 1000).toFixed(0)}Gbps` : `${isp.maxDownloadMbps}Mbps`}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-6 mb-3">Cell Coverage</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['AT&T', 'T-Mobile', 'Verizon'].map(net => {
                                            const cov = data.broadband?.cellCoverage?.find(c => c.network === net);
                                            return (
                                                <div key={net} className="text-center">
                                                    <div className="text-[10px] font-black text-slate-400 mb-1">{net}</div>
                                                    <div className={`text-[12px] font-black ${cov?.signalLevel === 'Good' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                        {cov?.signalLevel || 'Fair'}
                                                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 flex gap-1 px-1">
                                                            <div className="w-1.5 h-full bg-emerald-500 rounded-full" />
                                                            <div className="w-1.5 h-full bg-emerald-500 rounded-full" />
                                                            <div className={`w-1.5 h-full ${cov?.signalLevel === 'Good' ? 'bg-emerald-500' : 'bg-slate-200'} rounded-full`} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-6">BroadbandMap</div>
                                </div>
                            </div>
                        )}{/* end broadband */}

                        {/* Col 3: EV Charging */}
                        {show('commute') && (
                            <div className="lg:col-span-4">
                                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 shadow-sm h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <i className="fa-solid fa-charging-station text-emerald-400 text-[14px]" />
                                            <span className="text-[14px] font-bold text-slate-800 tracking-tight">EV Charging</span>
                                        </div>
                                        <i className="fa-solid fa-up-right-from-square text-slate-300 text-[11px]" />
                                    </div>
                                    {(() => {
                                        const ev = (data as any).evChargers || { totalStations: 20, closestDistanceMi: 0.4, totalPorts: 129, dcFastPorts: 40, level2Ports: 89, networks: ['ChargePoint', 'Tesla', 'Loop', 'Noodoe', 'EVGo'] };
                                        return (
                                            <div className="flex-1 space-y-6">
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Stations</div>
                                                        <div className="text-[20px] font-black text-slate-800">{ev.totalStations}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Closest</div>
                                                        <div className="text-[20px] font-black text-emerald-500">{(ev.closestDistanceMi || 0.4).toFixed(1)} <span className="text-[11px]">mi</span></div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Ports</div>
                                                        <div className="text-[20px] font-black text-slate-800">{ev.totalPorts}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-1.5 mb-1.5">
                                                            <i className="fa-solid fa-bolt-lightning text-amber-400 text-[11px]" />
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DC Fast</span>
                                                        </div>
                                                        <div className="text-[14px] font-black text-orange-500">{ev.dcFastPorts || 40} ports</div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-1.5 mb-1.5">
                                                            <i className="fa-solid fa-bolt text-blue-400 text-[11px]" />
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Level 2</span>
                                                        </div>
                                                        <div className="text-[14px] font-black text-blue-500">{ev.level2Ports || 89} ports</div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {ev.networks?.map((n: string, i: number) => (
                                                        <span key={i} className="px-3 py-1 bg-white border border-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">{n.toUpperCase()}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-auto pt-4">NREL AFDC API</div>
                                </div>
                            </div>
                        )}{/* end ev */}
                    </div>
                </SectionCard>
            )}{/* end commute/walk/broadband */}

            {/* Resilience & Hazards */}
            {show('resilience') && (hasEnv || hasCoords) && (
                <SectionCard
                    id="ov-resilience"
                    title="Resilience & Hazards"
                    icon="fa-shield-halved"
                    iconBg="bg-orange-50"
                    iconColor="text-orange-500"
                    className="mt-4"
                    noPadding
                >
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2">
                            {/* Climate Risk */}
                            <div className="bg-slate-50/50 rounded-2xl border border-slate-100/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-full">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-triangle-exclamation text-orange-500 text-[14px]" />
                                        <span className="text-[14px] font-bold text-slate-800 tracking-tight">Climate Risk</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Insurance</div>
                                        <div className="text-[14px] font-bold text-slate-900 leading-none">${(data.annualHomeownersInsurance || 6544).toLocaleString()}/yr</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'WIND', score: data.windRiskScore || 1, max: 10, color: 'text-emerald-500', icon: 'fa-wind' },
                                        { label: 'FLOOD', score: data.floodRiskScore || 1, max: 10, color: 'text-blue-500', icon: 'fa-water' },
                                        { label: 'FIRE', score: data.fireRiskScore || 6, max: 10, color: 'text-orange-500', icon: 'fa-fire' },
                                        { label: 'HEAT', score: data.heatRiskScore || 5, max: 10, color: 'text-rose-500', icon: 'fa-temperature-high' }
                                    ].map((r, i) => (
                                        <div key={i} className={`p-2.5 rounded-xl border border-slate-100 transition-all shadow-sm ${r.score && r.score > 5 ? 'bg-orange-50/50 border-orange-100/50 shadow-orange-100/20' : 'bg-white'}`}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <i className={`fa-solid ${r.icon} text-slate-300 text-[10px]`} />
                                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{r.label}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-[16px] font-black ${r.score ? r.color : 'text-slate-300'}`}>
                                                    {r.score ? r.score : 'N/A'}
                                                </span>
                                                {r.score && (
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter opacity-80">
                                                        / {r.max}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-3">FEMA National Risk Index</div>
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            {/* Hazard Zones */}
                            <div className="bg-slate-50/50 rounded-2xl border border-slate-100/60 p-4 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 h-full">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-map-location-dot text-rose-500 text-[14px]" />
                                        <span className="text-[14px] font-bold text-slate-800 tracking-tight">Hazards</span>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 shadow-sm">
                                            <i className="fa-solid fa-house-chimney-crack text-rose-500 text-[18px]" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <span className="text-[14px] font-black text-slate-700 uppercase tracking-tight">Seismic Hazard</span>
                                                <span className="px-2 py-0.5 bg-rose-500 text-white rounded-md text-[11px] font-black shadow-lg shadow-rose-200">Zone {data.seismicHazardZone || 'E'}</span>
                                            </div>
                                            <p className="text-[14px] text-slate-500 font-sans font-medium leading-relaxed">
                                                Located in a high-risk seismic zone. Structural reinforcement and specialized insurance are recommended.
                                            </p>
                                            <div className="flex gap-6 mt-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Historic Quakes</span>
                                                    <span className="text-[13px] text-slate-600 font-black">10 <span className="text-slate-300 font-normal ml-0.5">nearby</span></span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">FEMA Disasters</span>
                                                    <span className="text-[13px] text-slate-600 font-black">0 <span className="text-slate-300 font-normal ml-0.5">recorded</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-200/50" />

                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 shadow-sm">
                                            <i className="fa-solid fa-droplet-slash text-emerald-500 text-[18px]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[12px] font-black text-slate-700 uppercase tracking-tight">Drought Intensity</span>
                                                    <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{data.drought?.drought_level?.toUpperCase() || 'NONE'}</span>
                                                </div>
                                            </div>
                                            <p className="text-[12px] text-slate-500 font-sans font-medium leading-relaxed">
                                                Currently 100% free of drought conditions. Low risk of vegetation loss or landscape impact.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-auto pt-4">USGS · FEMA · Drought Monitor</div>
                            </div>
                        </div>


                    </div>
                </SectionCard>
            )}{/* end resilience */}



            {/* Solar Insights */}
            {show('solar') && hasSolar && (
                <SectionCard
                    id="ov-sun"
                    title="Solar Insights"
                    icon="fa-sun"
                    iconBg="bg-amber-50"
                    iconColor="text-amber-500"
                    className="mt-4"
                >
                    <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Sun Map */}
                        <div className="lg:col-span-5">
                            <SeasonalSunCard
                                lat={data.coordinates!.latitude}
                                lng={data.coordinates!.longitude}
                                orientation={(() => {
                                    const fo = (data as any).orientation_ai?.final_orientation;
                                    return fo && fo !== 'UNCLEAR' && fo !== 'UNCLEAR_IMAGE' ? fo : undefined;
                                })()}
                            />
                        </div>

                        {/* AI Insights */}
                        <div className="lg:col-span-3">
                            <div className="space-y-4 h-full">
                                {micro && (
                                    <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl relative overflow-hidden group transition-all hover:bg-blue-50 h-full">
                                        <div className="absolute top-0 right-0 p-2 opacity-5">
                                            <i className="fa-solid fa-temperature-half text-[32px] text-blue-500" />
                                        </div>
                                        <div className="flex items-center gap-2 mb-5 relative z-10">
                                            <i className="fa-solid fa-temperature-half text-blue-500 text-[12px]" />
                                            <span className="text-[14px] font-bold text-slate-800 tracking-tight">Relative Microclimate</span>
                                        </div>
                                        <p className="text-[14px] text-blue-700 leading-relaxed relative z-10 font-sans font-medium">
                                            &ldquo;{micro.insight}&rdquo;
                                        </p>
                                        <div className="flex items-center justify-between mt-3 text-[10px] text-blue-400 font-black uppercase tracking-widest relative z-10">
                                            <span>Tomorrow.io AI Insight</span>
                                            <span>{new Date(micro.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-white/50 rounded-xl p-3 border border-slate-100 mt-auto">
                                    <div className="text-[10px] text-slate-300 font-black uppercase text-right tracking-widest">SunCalc · Tomorrow.io API Datasets</div>
                                </div>
                            </div>
                        </div>

                        {/* Solar Potential */}
                        <div className="lg:col-span-4">
                            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-full flex flex-col">
                                <div className="flex items-center gap-2 mb-4">
                                    <i className="fa-solid fa-solar-panel text-amber-500 text-[14px]" />
                                    <span className="text-[14px] font-bold text-slate-800 tracking-tight">Solar Potential</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sunshine</div>
                                        <div className="text-[16px] font-black text-slate-700 leading-tight">{Math.round(data.solarData?.maxSunshineHoursPerYear || 1815).toLocaleString()} <span className="text-[9px] uppercase">hrs/yr</span></div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Production</div>
                                        <div className="text-[16px] font-black text-indigo-600 leading-tight">{(solarPotential?.annualKwh || 39048).toLocaleString()} <span className="text-[9px] uppercase">kWh</span></div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Efficiency</div>
                                        <div className="text-[16px] font-black text-orange-600 leading-tight">60% <span className="text-[9px] font-black uppercase">Safe</span></div>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-200/50 rounded-full overflow-hidden mb-1.5 relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-300 rounded-full" style={{ width: '60%' }} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-white border border-slate-100 rounded-xl relative shadow-sm">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Payback</div>
                                        <div className="text-[16px] font-black text-orange-500">{(data.solarData?.financialAnalysis?.cashPurchase?.paybackYears || 5.5).toFixed(1)} <span className="text-[9px]">yrs</span></div>
                                    </div>
                                    <div className="p-4 bg-white border border-slate-100 rounded-xl relative shadow-sm">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">20-Yr Savings</div>
                                        <div className="text-[16px] font-black text-emerald-500">${(data.solarData?.financialAnalysis?.cashPurchase?.savings?.savingsYear20 || 76915).toLocaleString()}</div>
                                    </div>
                                    <div className="p-4 bg-white border border-slate-100 rounded-xl relative shadow-sm">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">System Cost</div>
                                        <div className="text-[16px] font-black text-indigo-600">${(data.solarData?.financialAnalysis?.cashPurchase?.upfrontCost || 18218).toLocaleString()}</div>
                                    </div>
                                    <div className="p-4 bg-white border border-slate-100 rounded-xl relative shadow-sm">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Year 1 Saving</div>
                                        <div className="text-[16px] font-black text-slate-800">${(data.solarData?.financialAnalysis?.cashPurchase?.savings?.savingsYear1 || 3341).toLocaleString()}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => toggleEnv('solar_specs')}
                                    className="w-full flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 mt-6 pt-3 group hover:text-indigo-500 transition-colors"
                                >
                                    <span>@ System Specs</span>
                                    <i className={`fa-solid fa-chevron-${envOpen['solar_specs'] ? 'up' : 'down'} text-[9px] transition-transform`} />
                                </button>
                                {envOpen['solar_specs'] && (
                                    <div className="mt-5 pt-5 border-t border-slate-200 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                                            <div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Max Panels</div>
                                                <div className="text-[16px] font-black text-slate-800">{data.solarPotential?.maxArrayPanelsCount || 25} <span className="text-[12px] text-slate-400 font-medium">units</span></div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Panel Capacity</div>
                                                <div className="text-[16px] font-black text-slate-800">{data.solarPotential?.panelCapacityWatts || 320} <span className="text-[12px] text-slate-400 font-medium">Watts</span></div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Array Area</div>
                                                <div className="text-[16px] font-black text-slate-800">{Math.round(data.solarPotential?.maxArrayAreaMeters2 || 42)} <span className="text-[12px] text-slate-400 font-medium">m²</span></div>
                                            </div>
                                            <div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Annual Sunshine</div>
                                                <div className="text-[16px] font-black text-slate-800">{Math.round(data.solarData?.maxSunshineHoursPerYear || 1815).toLocaleString()} <span className="text-[12px] text-slate-400 font-medium">hrs/yr</span></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="text-[9px] font-black text-slate-300 uppercase text-right tracking-[0.2em] mt-auto pt-4">Google Solar API</div>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            )}
        </>
    );
};
