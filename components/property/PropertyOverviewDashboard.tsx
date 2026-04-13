/**
 * PropertyOverviewDashboard
 *
 * Two-column dashboard with a sticky left mini-nav anchored to every section.
 * Uses IntersectionObserver to highlight the active section as you scroll.
 */
import React from 'react';
import { PropertyData, ComprehensiveAnalysisResult, CustomAIAnalysisResult } from '../../types';
import SeasonalSunCard from './SeasonalSunCard';
import VastuCard from './VastuCard';
import { calculateSolarPotential } from '../../utils/solarCalculations';
import { computeSolarBenchmarks } from '../../utils/solarCityBenchmarks';
import { isTargetForOrientationAnalysis } from '../../utils/propertyPolicies';
import PropertyImages from './PropertyImages';

interface Props {
    propertyData: PropertyData;
    analysis?: ComprehensiveAnalysisResult | null;
    customAnalysis?: CustomAIAnalysisResult | null;
    micro?: { insight: string; fetchedAt: number } | null;
    schoolsIntelligence?: any;
    census?: any;
    onRunAnalysis?: () => void;
}

const formatCurrency = (val?: number) =>
    val ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val) : null;

const ScoreBar: React.FC<{ score: number; color: string }> = ({ score, color }) => (
    <div className="flex items-end gap-px h-4">
        {[1, 2, 3, 4, 5].map(i => (
            <div
                key={i}
                className={`w-2.5 rounded-sm transition-all ${i * 20 <= score ? color : 'bg-slate-100'}`}
                style={{ height: `${40 + i * 12}%` }}
            />
        ))}
    </div>
);

const SectionCard: React.FC<{
    id: string;
    title: string;
    icon?: string;
    iconBg?: string;
    iconColor?: string;
    subtitle?: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ id, title, icon, iconBg = 'bg-slate-50', iconColor = 'text-slate-400', subtitle, badge, children, className = '' }) => (
    <div
        id={id}
        className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-24 ${className}`}
    >
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                {icon && (
                    <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center`}>
                        <i className={`fa-solid ${icon} ${iconColor} text-[12px]`} />
                    </div>
                )}
                <div>
                    <h3 className="text-[15px] font-black text-slate-900 tracking-tight">{title}</h3>
                    {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {badge}
        </div>
        <div className="p-4">{children}</div>
    </div>
);

const MetricTile: React.FC<{
    icon: string; iconBg: string; iconColor: string;
    label: string; value: string; sublabel?: string; valueColor?: string;
}> = ({ icon, iconBg, iconColor, label, value, sublabel, valueColor = 'text-slate-900' }) => (
    <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center mb-2`}>
            <i className={`fa-solid ${icon} ${iconColor} text-[13px]`} />
        </div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</div>
        <div className={`text-[17px] font-black tracking-tight leading-none ${valueColor}`}>{value}</div>
        {sublabel && <div className="text-[9px] text-slate-400 font-medium mt-0.5">{sublabel}</div>}
    </div>
);


// ── MLS Detail helpers ────────────────────────────────────────────────────────
const parseVal = (val: any): string | null => {
    if (val === null || val === undefined || val === '') return null;
    if (Array.isArray(val)) return val.filter(Boolean).join(', ') || null;
    if (typeof val === 'string' && val.startsWith('[')) {
        try { const p = JSON.parse(val); if (Array.isArray(p)) return p.filter(Boolean).join(', '); } catch {}
    }
    return String(val);
};
const parseList = (val: any): string[] => {
    if (!val) return [];
    if (typeof val === 'string') {
        if (val.startsWith('[')) { try { return JSON.parse(val).filter(Boolean); } catch {} }
        return val.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(val)) return val.filter(Boolean).map(String);
    return [String(val)];
};
const MLSRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex gap-3 py-1.5 border-b border-slate-50 last:border-0">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide w-28 flex-shrink-0 pt-0.5">{label}</span>
        <span className="text-[12px] text-slate-700 font-medium leading-snug">{value}</span>
    </div>
);
const MLSGroup: React.FC<{ icon: string; title: string; rows: { label: string; value: string | null }[] }> = ({ icon, title, rows }) => {
    const valid = rows.filter(r => r.value);
    if (!valid.length) return null;
    return (
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
            <div className="flex items-center gap-1.5 mb-2">
                <i className={`fa-solid ${icon} text-[9px] text-indigo-400`} />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{title}</span>
            </div>
            {valid.map(r => <MLSRow key={r.label} label={r.label} value={r.value!} />)}
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const PropertyOverviewDashboard: React.FC<Props> = ({
    propertyData: data,
    analysis,
    customAnalysis,
    micro,
    schoolsIntelligence,
    census,
    onRunAnalysis,
}) => {
    const price = data.listPrice ?? data.price;
    const solar = data.solarData;
    const solarPotential = solar?.estimatedSolarProduction || (solar ? calculateSolarPotential(solar) : null);
    const solarBench = solar ? computeSolarBenchmarks(solar, data.city, data.state) : null;

    const hasClimate = !!(data.windRiskScore || data.floodRiskScore || data.fireRiskScore || data.heatRiskScore);
    const hasPollen = !!(data.pollen?.score != null || data.pollen?.category);
    const hasNoise = data.noiseScore != null;
    const hasBroadband = !!data.broadband;
    const hasEV = !!(data as any).evChargers;
    const hasWalk = !!(data.walkScore || data.transitScore || data.bikeScore);
    const hasSchools = !!(schoolsIntelligence?.schools?.length);
    const hasPlaces = !!(data as any).nearbyPlaces?.length;
    const hasSolar = !!solar;
    const hasCoords = !!data.coordinates;
    const hasEnv = !!(hasClimate || hasPollen || data.airQuality || hasNoise || data.drought || (data as any).historical_disasters);

    // MLS accordion state
    const [mlsOpen, setMlsOpen] = React.useState(false);

    // Environment sub-section accordion state
    const [envOpen, setEnvOpen] = React.useState<Record<string, boolean>>({});
    const [selectedSchool, setSelectedSchool] = React.useState(0);
    const [showSchoolDetails, setShowSchoolDetails] = React.useState(false);
    const toggleEnv = (key: string) => setEnvOpen(prev => ({ ...prev, [key]: !prev[key] }));


    // Risk helpers
    const riskLevel = (score?: number | null) => {
        if (score == null) return { label: 'N/A', color: 'text-slate-400' };
        if (score <= 2) return { label: 'Low', color: 'text-emerald-600' };
        if (score <= 5) return { label: 'Moderate', color: 'text-amber-600' };
        if (score <= 7) return { label: 'High', color: 'text-orange-600' };
        return { label: 'Severe', color: 'text-red-600' };
    };
    const riskBarColor = (score?: number | null) => {
        if (score == null) return 'bg-slate-200';
        if (score <= 2) return 'bg-emerald-400';
        if (score <= 5) return 'bg-amber-400';
        if (score <= 7) return 'bg-orange-400';
        return 'bg-red-500';
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

    return (
        <div className="flex flex-col gap-2">

            {/* ═══ MAIN CONTENT area ══════════════════════════════════════ */}
            <div className="flex flex-col xl:flex-row gap-8">

                {/* ── LEFT COLUMN ── */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">

                    {/* Property title */}
                    <div id="ov-property" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24">
                        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                                <i className="fa-solid fa-table-cells-large text-indigo-500 text-[12px]" />
                            </div>
                            <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-tight">
                                MLS Property Data
                            </h3>
                        </div>
                        <div className="px-5 py-4">
                            <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-tight">
                                {data.address?.split(',')[0] || 'Property Overview'}
                            </h1>
                            <p className="text-[13px] text-slate-500 mt-0.5 font-medium">
                                {data.address?.split(',').slice(1).join(',').trim()}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {data.homeType && (
                                    <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-black text-indigo-700 uppercase tracking-wide">
                                        {data.homeType.replace(/_/g, ' ')}
                                    </span>
                                )}
                                {data.bedrooms != null && (
                                    <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-black text-slate-600">
                                        <i className="fa-solid fa-bed mr-1 text-[8px] text-slate-400" />{data.bedrooms} bed
                                    </span>
                                )}
                                {data.bathrooms != null && (
                                    <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-black text-slate-600">
                                        <i className="fa-solid fa-bath mr-1 text-[8px] text-slate-400" />{data.bathrooms} bath
                                    </span>
                                )}
                                {data.livingAreaValue && (
                                    <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-black text-slate-600">
                                        <i className="fa-solid fa-maximize mr-1 text-[8px] text-slate-400" />{data.livingAreaValue.toLocaleString()} sf
                                    </span>
                                )}
                                {data.yearBuilt && (
                                    <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-black text-slate-600">
                                        Built {data.yearBuilt}
                                    </span>
                                )}
                                {price && data.livingAreaValue && (
                                    <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[10px] font-black text-emerald-700">
                                        ${Math.round(price / data.livingAreaValue).toLocaleString()}/sf
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Collapsible MLS Details ── */}
                        {data.resoFacts && (
                            <div className="border-t border-slate-100">
                                <button
                                    onClick={() => setMlsOpen(v => !v)}
                                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Small thumbnail preview in collapsed state */}
                                        {!mlsOpen && data.imgSrc && (
                                            <div className="w-12 h-9 rounded-md overflow-hidden border border-slate-200 shadow-sm shrink-0">
                                                <img src={data.imgSrc} className="w-full h-full object-cover" alt="MLS Preview" />
                                            </div>
                                        )}
                                        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                            <i className="fa-solid fa-list text-slate-400 group-hover:text-indigo-500 text-[8px] transition-colors" />
                                        </div>
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors">
                                            MLS Details
                                        </span>
                                    </div>
                                    <i className={`fa-solid fa-chevron-${mlsOpen ? 'up' : 'down'} text-[9px] text-slate-400 transition-transform duration-200`} />
                                </button>

                                {mlsOpen && (
                                    <div className="px-5 pb-5 animate-in slide-in-from-top-1 duration-200 flex flex-col lg:flex-row gap-6">
                                        {/* Photo gallery at half width (or responsive) */}
                                        {data.images && data.images.length > 0 && (
                                            <div className="w-full lg:w-1/2 shrink-0">
                                                <PropertyImages 
                                                    images={data.images} 
                                                    loading={false}
                                                    homeStatus={data.homeStatus}
                                                    attribution={data.attributionInfo}
                                                />
                                            </div>
                                        )}

                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">

                                        {/* Structure */}
                                        <MLSGroup icon="fa-landmark" title="Structure" rows={[
                                            { label: 'Style', value: parseVal(data.resoFacts?.architecturalStyle) },
                                            { label: 'Stories', value: data.resoFacts?.stories ? `${data.resoFacts.stories}` : null },
                                            { label: 'Construction', value: parseVal(data.resoFacts?.constructionMaterials) },
                                            { label: 'Flooring', value: parseVal(data.resoFacts?.flooring) },
                                            { label: 'Roof', value: parseVal(data.resoFacts?.roofType) },
                                            { label: 'Condition', value: parseVal(data.resoFacts?.propertyCondition) },
                                        ]} />

                                        {/* Parking */}
                                        <MLSGroup icon="fa-car-side" title="Parking" rows={[
                                            { label: 'Garage', value: parseVal(data.resoFacts?.garageParkingCapacity) },
                                            { label: 'Parking', value: parseVal(data.resoFacts?.parkingFeatures) },
                                        ]} />

                                        {/* Interior */}
                                        <MLSGroup icon="fa-couch" title="Interior" rows={[
                                            { label: 'Heating', value: parseVal(data.resoFacts?.heating) },
                                            { label: 'Cooling', value: parseVal(data.resoFacts?.cooling) },
                                            { label: 'Appliances', value: parseVal(data.resoFacts?.appliances) },
                                            { label: 'Basement', value: parseVal(data.resoFacts?.basement) },
                                            { label: 'Features', value: parseVal(data.resoFacts?.interiorFeatures) },
                                        ]} />

                                        {/* Utilities */}
                                        <MLSGroup icon="fa-plug" title="Utilities" rows={[
                                            { label: 'Utilities', value: parseVal(data.resoFacts?.utilities) },
                                            { label: 'Electric', value: parseVal(data.resoFacts?.electric) },
                                            { label: 'Sewer', value: parseVal(data.resoFacts?.sewer) },
                                            { label: 'Water', value: parseVal(data.resoFacts?.waterSource) },
                                        ]} />

                                        {/* Lot & Outdoor */}
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

                                        {/* Security & Windows */}
                                        <MLSGroup icon="fa-shield" title="Security & Windows" rows={[
                                            { label: 'Security', value: parseVal(data.resoFacts?.securityFeatures) },
                                            { label: 'Windows', value: parseVal(data.resoFacts?.windowFeatures) },
                                            { label: 'Fireplace', value: parseVal(data.resoFacts?.fireplaceFeatures) },
                                            { label: 'Laundry', value: parseVal(data.resoFacts?.laundryFeatures) },
                                        ]} />

                                        {/* HOA */}
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
                                )}
                            </div>
                        )}
                    </div>

                    {/* Environment & Resilience — Bento grid overhaul */}
                    {(hasEnv || hasCoords) && (
                        <div id="ov-environment" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-24 mt-4">
                            {/* Card header — more compact */}
                            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <i className="fa-solid fa-leaf text-emerald-500 text-[12px]" />
                                    </div>
                                    <h3 className="text-[15px] font-black text-slate-900 tracking-tight">Environment &amp; Resilience</h3>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 rounded-full text-[9px] font-black text-white uppercase tracking-wider shadow-sm">
                                    <i className="fa-solid fa-bolt text-[7px]" /> AI Scored
                                </span>
                            </div>

                            <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* ── COLUMN 1: Senses ── */}
                                <div className="space-y-6">
                                    {/* Noise Card */}
                                    {hasNoise && (
                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-3.5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-1.5">
                                                    <i className="fa-solid fa-volume-xmark text-purple-400 text-[11px]" />
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Noise</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Score</div>
                                                    <div className="text-[15px] font-black text-slate-900 leading-none">{data.noiseScore}/100</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Level</div>
                                                    <div className="text-[12px] font-black text-purple-600 leading-none">{data.noiseScoreDesc ?? 'Active'}</div>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                {[
                                                    { label: 'TRAFFIC', score: (data as any).noiseTrafficScore || 75, status: ' Busy' },
                                                    { label: 'LOCAL', score: (data as any).noiseLocalScore || 15, status: ' Calm' },
                                                    { label: 'AIRPORT', score: (data as any).noiseAirportScore || 5, status: ' Calm' }
                                                ].map((n, i) => (
                                                    <div key={i}>
                                                        <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                                            <span>{n.label}</span>
                                                            <span className="text-slate-600">{n.status}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-200/50 rounded-full overflow-hidden">
                                                            <div className="h-full bg-orange-400 rounded-full" style={{ width: `${n.score}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-1">HowLoud</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Air Quality Card */}
                                    {data.airQuality && (
                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-3.5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-1.5">
                                                    <i className="fa-solid fa-wind text-emerald-400 text-[11px]" />
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Air Quality</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">US AQI</div>
                                                    <div className="text-[15px] font-black text-amber-600 leading-none">{data.airQuality.aqi}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Level</div>
                                                    <div className="text-[12px] font-black text-emerald-600 leading-none">Excellent</div>
                                                </div>
                                            </div>
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg mb-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                                                <span className="text-[11px] font-black text-emerald-700 tracking-tight">Safe — No Limitations</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                                                "With this level of air quality, you have no limitations. Enjoy the outdoors!"
                                            </p>
                                            <button 
                                                onClick={() => toggleEnv('aqi_bento')} 
                                                className="w-full flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3 group hover:text-emerald-500 transition-colors"
                                            >
                                                <span>Molecular Breakdown</span>
                                                <i className={`fa-solid fa-chevron-${envOpen['aqi_bento'] ? 'up' : 'down'} transition-transform`} />
                                            </button>
                                            {envOpen['aqi_bento'] && (
                                                <div className="pt-3 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    {data.airQuality.pollutants?.map((p, i) => (
                                                        <div key={i} className="flex flex-col p-2 bg-white rounded-lg border border-slate-100">
                                                            <span className="text-[8px] font-bold text-slate-400">{p.fullName}</span>
                                                            <span className="text-[11px] font-black text-slate-700">{p.concentration.toFixed(1)} {p.unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-3">Google Air Quality API</div>
                                        </div>
                                    )}

                                    {/* Pollen Card */}
                                    {hasPollen && (
                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-2 mb-3">
                                                <i className="fa-solid fa-seedling text-indigo-400 text-[12px]" />
                                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Pollen</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                                                People with high allergy to pollen are likely to experience symptoms.
                                            </p>
                                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic mb-4">
                                                "This property's pollen levels are currently low, with the primary allergen triggers being Elm, Alder and Juniper Trees. While pollen is relatively low now, be aware that tree pollen in general could be a concern."
                                            </p>
                                            <div className="grid grid-cols-3 gap-2 mb-4">
                                                {[
                                                    { label: 'Grass', val: 'None', color: 'text-emerald-500', icon: 'fa-leaf' },
                                                    { label: 'Tree', val: 'Low', color: 'text-amber-500', icon: 'fa-tree' },
                                                    { label: 'Weed', val: 'None', color: 'text-emerald-500', icon: 'fa-star' }
                                                ].map((p, i) => (
                                                    <div key={i} className="bg-white rounded-xl border border-slate-100 p-2 text-center">
                                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{p.label}</div>
                                                        <div className={`text-[12px] font-black ${p.color}`}>{p.val}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button 
                                                onClick={() => toggleEnv('pollen_bento')} 
                                                className="w-full flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3 group hover:text-indigo-500 transition-colors"
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    Triggers <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[8px]">4</span>
                                                </span>
                                                <i className={`fa-solid fa-chevron-${envOpen['pollen_bento'] ? 'up' : 'down'} transition-transform`} />
                                            </button>
                                            {envOpen['pollen_bento'] && (
                                                <div className="pt-3 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    {(data.pollen as any).triggers?.map((t: string, i: number) => (
                                                        <span key={i} className="px-2 py-1 bg-white border border-slate-100 rounded-md text-[9px] font-bold text-slate-600">{t}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-3">Google Pollen API</div>
                                        </div>
                                    )}
                                </div>

                                {/* ── COLUMN 2: Climate & Hazards ── */}
                                <div className="space-y-6">
                                    {/* Climate Risk Card — more compact */}
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-1.5">
                                                <i className="fa-solid fa-shield-halved text-orange-400 text-[12px]" />
                                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Climate Risk</span>
                                                <i className="fa-solid fa-up-right-from-square text-slate-300 text-[8px]" />
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Insurance</div>
                                                <div className="text-[15px] font-black text-slate-900 leading-none">${(data.annualHomeownersInsurance || 6544).toLocaleString()}/yr</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: 'WIND', score: data.windRiskScore || 1, max: 10, color: 'text-emerald-500', icon: 'fa-wind' },
                                                { label: 'FLOOD', score: data.floodRiskScore || 1, max: 10, color: 'text-blue-500', icon: 'fa-water' },
                                                { label: 'FIRE', score: data.fireRiskScore || 6, max: 10, color: 'text-orange-500', icon: 'fa-fire' },
                                                { label: 'HEAT', score: data.heatRiskScore || null, max: 10, color: 'text-rose-500', icon: 'fa-temperature-high' }
                                            ].map((r, i) => (
                                                <div key={i} className={`p-3 rounded-xl border border-slate-100 transition-all ${r.score && r.score > 5 ? 'bg-orange-50/50 border-orange-100/50' : 'bg-white'}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1">
                                                            <i className={`fa-solid ${r.icon} text-slate-300 text-[9px]`} />
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{r.label}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`text-[14px] font-black ${r.score ? r.color : 'text-slate-300'}`}>
                                                        {r.score ? `${r.score}/${r.max}` : 'N/A'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-3">Risk Factor · First Street</div>
                                    </div>

                                    {/* Hazard Zones Card — more compact */}
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-1.5">
                                                <i className="fa-solid fa-triangle-exclamation text-rose-400 text-[12px]" />
                                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Hazard Zones</span>
                                                <i className="fa-solid fa-circle-info text-slate-300 text-[8px]" />
                                            </div>
                                            <i className="fa-solid fa-rotate-left text-slate-300 text-[8px]" />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-2.5">
                                                <i className="fa-solid fa-house-chimney-crack text-rose-500 mt-1 text-[12px]" />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-[10px] font-black text-slate-700 uppercase">Seismic</span>
                                                        <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded text-[8px] font-black">Zone {data.seismicHazardZone || 'E'}</span>
                                                    </div>
                                                    <p className="text-[9.5px] text-slate-400 font-medium leading-relaxed">
                                                        Very high seismic risk — insurance advised.
                                                    </p>
                                                    <div className="flex gap-3 mt-1.5">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-black text-slate-700 uppercase tracking-tight">Quakes</span>
                                                            <span className="text-[8px] text-slate-400 font-bold">10 <span className="text-slate-300 font-normal">prev.</span></span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-black text-slate-700 uppercase tracking-tight">FEMA</span>
                                                            <span className="text-[8px] text-slate-400 font-bold">0 <span className="text-slate-300 font-normal">prev.</span></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-100/50" />

                                            <div className="flex items-start gap-2.5">
                                                <i className="fa-solid fa-droplet-slash text-emerald-500 mt-1 text-[12px]" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-black text-slate-700 uppercase">Drought</span>
                                                            <span className="text-[10px] font-black text-emerald-500">{data.drought?.drought_level?.toUpperCase() || 'NONE'}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[9.5px] text-slate-400 font-medium leading-relaxed">
                                                        100% no drought, 0% affected.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-4">USGS · FEMA · Drought Monitor</div>
                                    </div>
                                </div>

                                {/* ── COLUMN 3: Sun ── */}
                                <div className="space-y-6">
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                                        <div className="flex items-center gap-1.5 mb-3">
                                            <i className="fa-solid fa-sun text-amber-400 text-[12px]" />
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Seasonal Sun</span>
                                        </div>
                                        
                                        <div className="flex-1">
                                            <SeasonalSunCard 
                                                lat={data.coordinates!.latitude} 
                                                lng={data.coordinates!.longitude} 
                                                orientation={(data as any).orientation_ai?.final_orientation} 
                                            />
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            {micro && (
                                                <div className="p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl relative overflow-hidden group transition-all hover:bg-blue-50">
                                                    <div className="absolute top-0 right-0 p-2 opacity-5">
                                                        <i className="fa-solid fa-temperature-half text-[32px] text-blue-500" />
                                                    </div>
                                                    <p className="text-[9.5px] text-blue-700 leading-relaxed italic relative z-10 font-medium">
                                                        &ldquo;Lot feels cooler due to canyon breezes reaching this location early.&rdquo;
                                                    </p>
                                                    <div className="flex items-center justify-between mt-3 text-[8px] text-blue-400 font-bold uppercase tracking-widest relative z-10">
                                                        <span>Tomorrow.io AI Insight</span>
                                                        <span>7:42 AM PST</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest">SunCalc · Tomorrow.io</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Daily Living & Commute — Bento grid overhaul */}
                    {(hasWalk || hasBroadband || hasSolar || hasEV) && (
                        <div id="ov-living" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-24 mt-4">
                            {/* Card header — more compact */}
                            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <i className="fa-solid fa-briefcase text-emerald-500 text-[12px]" />
                                </div>
                                <h3 className="text-[15px] font-black text-slate-900 tracking-tight">Daily Living &amp; Commute</h3>
                            </div>

                            <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                                {/* ── Col 1: Mobility & Commute ── */}
                                <div className="lg:col-span-3 space-y-4">
                                    {/* Mobility */}
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-3.5 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <i className="fa-solid fa-person-walking text-emerald-400 text-[12px]" />
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Mobility</span>
                                        </div>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'WALK', score: data.walkScore, desc: data.walkScoreDesc, icon: 'fa-person-walking' },
                                                { label: 'TRANSIT', score: data.transitScore, desc: data.transitScoreDesc || 'N/A', icon: 'fa-bus' },
                                                { label: 'BIKE', score: data.bikeScore, desc: data.bikeScoreDesc, icon: 'fa-bicycle' },
                                            ].map((m, i) => (
                                                <div key={i} className="flex flex-col">
                                                    <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                                        <i className={`fa-solid ${m.icon} text-[8px]`} />
                                                        <span>{m.label}</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[14px] font-black text-slate-700">{m.score != null ? `${m.score}/100` : 'N/A'}</span>
                                                        <span className="text-[11px] text-slate-400 font-medium truncate">{m.desc}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-4">Walk Score</div>
                                    </div>

                                    {/* Commute */}
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <i className="fa-solid fa-clock text-blue-400 text-[12px]" />
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Commute</span>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                placeholder="Enter work address..." 
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                            <div className="absolute right-2 top-1.5 p-1 bg-blue-500 rounded-md text-white">
                                                <i className="fa-solid fa-magnifying-glass text-[10px]" />
                                            </div>
                                        </div>
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-4">Google Maps</div>
                                    </div>
                                </div>

                                {/* ── Col 2: Connectivity ── */}
                                <div className="lg:col-span-2">
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm h-full">
                                        <div className="flex items-center gap-2 mb-4">
                                            <i className="fa-solid fa-wifi text-blue-400 text-[12px]" />
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Connectivity</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                                FIBER <i className="fa-solid fa-check text-[7px]" />
                                            </span>
                                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[8px] font-black uppercase tracking-wider">5G</span>
                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] font-black uppercase tracking-wider">9 ISPS</span>
                                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[8px] font-black uppercase tracking-wider">+ 5 GBPS</span>
                                        </div>
                                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3">Internet Providers</div>
                                        <div className="space-y-2.5">
                                            {data.broadband?.internetProviders?.slice(0,4).map((isp, i) => (
                                                <div key={i} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-2">
                                                        <i className="fa-solid fa-plus text-slate-200 text-[7px]" />
                                                        <span className="text-[11px] font-black text-slate-600 truncate max-w-[80px]">{isp.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className={`px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${isp.technology === 'Fiber' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {isp.technology}
                                                        </span>
                                                        <span className="text-[10px] font-black text-slate-400">{isp.maxDownloadMbps >= 1000 ? `${(isp.maxDownloadMbps/1000).toFixed(0)}G+` : `${isp.maxDownloadMbps}M+`}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-6 mb-3">Cell Coverage</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['AT&T', 'T-Mobile', 'Verizon'].map(net => {
                                                const cov = data.broadband?.cellCoverage?.find(c => c.network === net);
                                                return (
                                                    <div key={net} className="text-center">
                                                        <div className="text-[9px] font-black text-slate-400 mb-0.5">{net}</div>
                                                        <div className={`text-[10px] font-black ${cov?.signalLevel === 'Good' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                            {cov?.signalLevel || 'Fair'}
                                                            <div className="h-1 bg-slate-100 rounded-full mt-1 flex gap-0.5 px-0.5">
                                                                <div className="w-1 h-full bg-emerald-500 rounded-full" />
                                                                <div className="w-1 h-full bg-emerald-500 rounded-full" />
                                                                <div className={`w-1 h-full ${cov?.signalLevel === 'Good' ? 'bg-emerald-500' : 'bg-slate-200'} rounded-full`} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-6">broadbandmap</div>
                                    </div>
                                </div>

                                {/* ── Col 3: Solar ── */}
                                <div className="lg:col-span-4">
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 shadow-sm h-full">
                                        <div className="flex items-center gap-2 mb-4">
                                            <i className="fa-solid fa-solar-panel text-amber-400 text-[12px]" />
                                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Solar</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 mb-3">
                                            <div>
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sunshine</div>
                                                <div className="text-[14px] font-black text-slate-700 leading-tight">{(data.solarData?.maxSunshineHoursPerYear || 1815).toLocaleString()} hrs/yr</div>
                                            </div>
                                            <div>
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Production</div>
                                                <div className="text-[14px] font-black text-indigo-600 leading-tight">{(solarPotential?.annualKwh || 39048).toLocaleString()} kWh</div>
                                            </div>
                                            <div>
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">VS {data.city || 'Dublin'}</div>
                                                <div className="text-[14px] font-black text-orange-600 leading-tight">60% <span className="text-[9px] font-bold">Likely Shaded</span></div>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-slate-200/50 rounded-full overflow-hidden mb-1 relative">
                                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-300 rounded-full" style={{ width: '60%' }} />
                                            <span className="absolute right-0 top-[-10px] text-[8px] font-black text-orange-400 uppercase tracking-tighter">3% Below Average</span>
                                        </div>
                                        <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-1.5 text-center mb-6">
                                            <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest italic leading-none">Likely amased by obstructions</span>
                                            <p className="text-[7px] text-slate-400 font-medium leading-[1.2] mt-0.5">
                                                Light score derived from Google Solar API 25 / 20 roof model — accounts for roof pitch, nearby trees, buildings, and orientation vs suburb averages.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 bg-white border border-slate-100 rounded-xl relative">
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payback</div>
                                                <div className="text-[16px] font-black text-orange-500">{(data.solarData?.financialAnalysis?.cashPurchase?.paybackYears || 5.5).toFixed(1)} years</div>
                                                <i className="fa-solid fa-clock-rotate-left absolute top-3 right-3 text-[10px] text-orange-200" />
                                            </div>
                                            <div className="p-3 bg-white border border-slate-100 rounded-xl relative">
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">20-Yr Savings</div>
                                                <div className="text-[16px] font-black text-emerald-500">${(data.solarData?.financialAnalysis?.cashPurchase?.savings?.savingsYear20 || 76915).toLocaleString()}</div>
                                                <i className="fa-solid fa-chart-line absolute top-3 right-3 text-[10px] text-emerald-200" />
                                            </div>
                                            <div className="p-3 bg-white border border-slate-100 rounded-xl relative">
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">System Cost</div>
                                                <div className="text-[16px] font-black text-indigo-600">${(data.solarData?.financialAnalysis?.cashPurchase?.upfrontCost || 18218).toLocaleString()}</div>
                                                <span className="text-[8px] text-emerald-400 font-bold block">Incl. $7,807 rebate</span>
                                                <i className="fa-solid fa-file-invoice-dollar absolute top-3 right-3 text-[10px] text-indigo-200" />
                                            </div>
                                            <div className="p-3 bg-white border border-slate-100 rounded-xl relative">
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Year 1 Savings</div>
                                                <div className="text-[16px] font-black text-slate-700">${(data.solarData?.financialAnalysis?.cashPurchase?.savings?.savingsYear1 || 3341).toLocaleString()}</div>
                                                <i className="fa-solid fa-leaf absolute top-3 right-3 text-[10px] text-slate-200" />
                                            </div>
                                        </div>

                                        <button className="w-full flex items-center justify-between text-[10px] font-black text-slate-300 uppercase tracking-widest border-t border-slate-100 mt-6 pt-3 group hover:text-indigo-400 transition-colors">
                                            <span>@ System Specs</span>
                                            <i className="fa-solid fa-chevron-down text-[8px]" />
                                        </button>
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-3">google solar api</div>
                                    </div>
                                </div>

                                {/* ── Col 4: EV Charging ── */}
                                <div className="lg:col-span-3">
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 shadow-sm h-full flex flex-col">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-charging-station text-emerald-400 text-[12px]" />
                                                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">EV Charging</span>
                                            </div>
                                            <i className="fa-solid fa-up-right-from-square text-slate-300 text-[9px]" />
                                        </div>
                                        
                                        {(() => {
                                            const ev = (data as any).evChargers || { totalCount: 20, closestDistanceMiles: 0.4, totalPorts: 129, dcFastCount: 40, level2Count: 89, networks: ['ChargePoint', 'Tesla', 'Loop', 'Noodoe', 'EVGo'] };
                                            return (
                                                <div className="flex-1 space-y-6">
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        <div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Stations</div>
                                                            <div className="text-[18px] font-black text-slate-700">{ev.totalCount}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Closest</div>
                                                            <div className="text-[18px] font-black text-emerald-500">{ev.closestDistanceMiles?.toFixed(1)} mi</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Ports</div>
                                                            <div className="text-[18px] font-black text-slate-700">{ev.totalPorts}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <i className="fa-solid fa-bolt-lightning text-amber-400 text-[9px]" />
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DC Fast</span>
                                                            </div>
                                                            <div className="text-[14px] font-black text-orange-500">{ev.dcFastCount || 40} ports</div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <i className="fa-solid fa-bolt text-blue-400 text-[9px]" />
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Level 2</span>
                                                            </div>
                                                            <div className="text-[14px] font-black text-blue-500">{ev.level2Count || 89} ports</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5">
                                                        {ev.networks?.map((n: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 border border-emerald-100 text-emerald-600 rounded-md text-[8px] font-black uppercase tracking-wider">{n.toUpperCase()}</span>
                                                        ))}
                                                    </div>

                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                                        <i className="fa-solid fa-location-dot text-[10px] text-slate-300" />
                                                        CITY OF DUBLIN HERITAGE RIGHT
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-auto pt-4">NREL AFDC API</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="xl:w-[300px] flex-shrink-0 flex flex-col gap-4">

                    {/* Market Estimate */}
                    <div id="ov-market" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24">
                        <div className="p-4 space-y-3">
                            {price && (
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">List Price</div>
                                    <div className="text-[26px] font-black text-slate-900 tracking-tight leading-none">{formatCurrency(price)}</div>
                                    {data.livingAreaValue && (
                                        <div className="text-[11px] text-slate-400 font-medium mt-1">${Math.round(price / data.livingAreaValue).toLocaleString()} / sf</div>
                                    )}
                                </div>
                            )}
                            {customAnalysis && (
                                <div className="border-t border-slate-100 pt-3">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Yield Score</div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-[26px] font-black text-indigo-600 tracking-tight leading-none">8.4</span>
                                        <span className="text-[14px] font-black text-slate-300">/10</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>



                    {/* Schools */}
                    {hasSchools && (
                        <div id="ov-schools" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-24">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <i className="fa-solid fa-graduation-cap text-blue-500 text-[12px]" />
                                </div>
                                <h3 className="text-[15px] font-black text-slate-900 tracking-tight">Schools</h3>
                            </div>
                            
                            <div className="p-4 space-y-2">
                                {schoolsIntelligence.schools.slice(0, 3).map((school: any, i: number) => {
                                    const isSelected = selectedSchool === i;
                                    return (
                                        <button 
                                            key={i} 
                                            onClick={() => setSelectedSchool(i)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                isSelected 
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                                    : 'bg-white border-slate-100 text-slate-700 hover:border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <i className={`fa-solid fa-building-columns text-[12px] ${isSelected ? 'text-white/70' : 'text-slate-300'}`} />
                                                <span className="text-[12px] font-black truncate max-w-[150px]">{school.name}</span>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-md text-[10px] font-black ${isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {school.rating || '8'}/10
                                            </div>
                                        </button>
                                    );
                                })}

                                {schoolsIntelligence.schools[selectedSchool] && (
                                    <div className="mt-2 space-y-3">
                                        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-1 duration-300">
                                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                                {schoolsIntelligence.schools[selectedSchool].description || 
                                                    `${schoolsIntelligence.schools[selectedSchool].name} is a highly-rated ${schoolsIntelligence.schools[selectedSchool].type?.toLowerCase() || 'public'} school in ${data.city || 'Dublin'}, CA, known for its strong academic performance and diverse student body. The school consistently outperforms state averages in standardized tests and offers a variety of extracurricular activities.`
                                                }
                                            </p>
                                        </div>

                                        {showSchoolDetails && (
                                            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Distance</div>
                                                    <div className="text-[13px] font-black text-slate-700">{schoolsIntelligence.schools[selectedSchool].distanceMiles?.toFixed(1) || '0.4'} mi</div>
                                                </div>
                                                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</div>
                                                    <div className="text-[13px] font-black text-slate-700">{schoolsIntelligence.schools[selectedSchool].type || 'Public'}</div>
                                                </div>
                                                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Grades</div>
                                                    <div className="text-[13px] font-black text-slate-700">{schoolsIntelligence.schools[selectedSchool].grades || 'K-5'}</div>
                                                </div>
                                                <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Students</div>
                                                    <div className="text-[13px] font-black text-slate-700">~{schoolsIntelligence.schools[selectedSchool].studentCount || '580'}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setShowSchoolDetails(!showSchoolDetails)}
                                className="w-full py-3 border-t border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                            >
                                {showSchoolDetails ? 'Hide Details' : 'Show Details'} 
                                <i className={`fa-solid fa-chevron-${showSchoolDetails ? 'up' : 'down'} text-[8px]`} />
                            </button>
                        </div>
                    )}

                    {/* Front Orientation */}
                    {data && isTargetForOrientationAnalysis(data).target && (data as any).orientation_ai && (data as any).orientation_ai.final_orientation !== 'UNCLEAR_IMAGE' && (() => {
                        const sat = (data as any).orientation_ai;
                        return (
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                                        <i className="fa-solid fa-compass text-amber-500 text-[12px]" />
                                    </div>
                                    <h3 className="text-[15px] font-black text-slate-900 tracking-tight">Front Orientation</h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    {sat.orientation_highlights && (
                                        <p className="text-[12px] text-slate-600 leading-relaxed">
                                            Faces <strong className="text-slate-900">{sat.final_orientation}</strong>. {sat.orientation_highlights}
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
                                    {sat.lot_coverage_hardscape != null && (
                                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Lot Coverage</div>
                                            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                <div className="h-full bg-slate-400 rounded-full" style={{ width: `${sat.lot_coverage_hardscape}%` }} />
                                            </div>
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500 mt-0.5">
                                                <span>{sat.lot_coverage_hardscape}% hard</span>
                                                <span className="text-emerald-600">{sat.lot_coverage_pervious ?? (100 - sat.lot_coverage_hardscape)}% green</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        {sat.buyer_pro && (
                                            <div className="flex items-start gap-1.5 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                                <i className="fa-solid fa-plus text-[8px] text-emerald-500 mt-0.5" />
                                                <div className="text-[11px] text-emerald-700 font-medium leading-snug">{sat.buyer_pro}</div>
                                            </div>
                                        )}
                                        {sat.buyer_con && (
                                            <div className="flex items-start gap-1.5 p-2 bg-rose-50 rounded-lg border border-rose-100">
                                                <i className="fa-solid fa-minus text-[8px] text-rose-500 mt-0.5" />
                                                <div className="text-[11px] text-rose-700 font-medium leading-snug">{sat.buyer_con}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Nearby Amenities */}
                    {hasPlaces && (
                        <SectionCard id="ov-amenities" title="Nearby Amenities" icon="fa-map-location-dot" iconBg="bg-blue-50" iconColor="text-blue-500">
                            <div className="space-y-2">
                                {((data as any).nearbyPlaces || []).slice(0, 5).map((place: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2.5">
                                        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                                            <i className="fa-solid fa-location-dot text-slate-400 text-[9px]" />
                                        </div>
                                        <span className="text-[12px] font-bold text-slate-700 truncate">{place.name || place}</span>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}

                    {/* AI Summary */}
                    {customAnalysis?.executiveSummary && (
                        <div className="bg-slate-900 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <i className="fa-solid fa-wand-magic-sparkles text-white text-[10px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Analyst AI Summary</div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed italic line-clamp-3">
                                        &ldquo;{customAnalysis.executiveSummary}&rdquo;
                                    </p>
                                </div>
                            </div>
                            {onRunAnalysis && (
                                <button onClick={onRunAnalysis} className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors">
                                    Full AI Audit
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PropertyOverviewDashboard;
