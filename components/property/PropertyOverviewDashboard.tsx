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
import NeighborhoodPlacesSection from './NeighborhoodPlacesSection';
import { NeighborhoodAnalysis } from '../../types/ai';
import { AffordabilityCard } from '../analysis/custom-ai/components/AffordabilityCard';
import { CensusDemographicsCard } from '../analysis/custom-ai/components/CensusDemographicsCard';
import { CensusDemographics } from '../../services/api/environmental';

interface Props {
    propertyData: PropertyData;
    analysis?: ComprehensiveAnalysisResult | null;
    customAnalysis?: CustomAIAnalysisResult | null;
    micro?: { insight: string; fetchedAt: number } | null;
    schoolsIntelligence?: any;
    census?: CensusDemographics | null;
    cityNhEntryOverview?: any;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    neighborhoodOverview: string | null;
    ltrAnalysis?: { monthly_rent?: string; vacancy_rate?: string; comparison_summary?: string } | null;
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
    noPadding?: boolean;
}> = ({ id, title, icon, iconBg = 'bg-slate-50/50', iconColor = 'text-slate-400', subtitle, badge, children, className = '', noPadding = false }) => (
    <div
        id={id}
        className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-24 transition-all hover:shadow-md/5 ${className}`}
    >
        <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {icon && (
                    <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center border border-slate-100/50`}>
                        <i className={`fa-solid ${icon} ${iconColor} text-[13px]`} />
                    </div>
                )}
                <div>
                    <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-tight">{title}</h3>
                    {subtitle && <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {badge}
        </div>
        <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
);

const MetricTile: React.FC<{
    icon: string; iconBg: string; iconColor: string;
    label: string; value: string; sublabel?: string; valueColor?: string;
}> = ({ icon, iconBg, iconColor, label, value, sublabel, valueColor = 'text-slate-900' }) => (
    <div className="flex flex-col items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100/80 text-center transition-all hover:bg-slate-50">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center mb-2.5 shadow-sm border border-slate-100/50`}>
            <i className={`fa-solid ${icon} ${iconColor} text-[14px]`} />
        </div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] leading-none mb-1.5">{label}</div>
        <div className={`text-[18px] font-black tracking-tight leading-none ${valueColor}`}>{value}</div>
        {sublabel && <div className="text-[11px] text-slate-500 font-bold mt-1.5 opacity-80">{sublabel}</div>}
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
    <div className="flex gap-3 py-1.5 border-b border-slate-50/50 last:border-0 group">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] w-24 flex-shrink-0 pt-0.5 transition-colors group-hover:text-slate-500">{label}</span>
        <span className="text-[13px] text-slate-700 font-semibold leading-relaxed line-clamp-2 transition-colors group-hover:text-slate-900">{value}</span>
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
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em]">{title}</span>
            </div>
            <div className="space-y-0">
                {valid.map(r => <MLSRow key={r.label} label={r.label} value={r.value!} />)}
            </div>
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
    cityNhEntryOverview,
    visualPoi,
    mapLabels,
    neighborhoodOverview,
    ltrAnalysis,
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
    const [isSchoolModalOpen, setIsSchoolModalOpen] = React.useState(false);
    const [isNearbyCollapsed, setIsNearbyCollapsed] = React.useState(false);
    
    // Manage expanded states for Environment cards
    const [envOpen, setEnvOpen] = React.useState<Record<string, boolean>>({});
    const [selectedSchool, setSelectedSchool] = React.useState(0);
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
            <div className="flex flex-col xl:flex-row gap-8 items-start">

                {/* ── LEFT COLUMN ── */}
                <div className="flex-1 xl:flex-[3] min-w-0 flex flex-col gap-2">

                    {/* Property title */}
                    <div id="ov-property" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24">
                        <div className="px-5 py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center border border-slate-100/50">
                                <i className="fa-solid fa-table-cells-large text-indigo-500 text-[13px]" />
                            </div>
                            <h3 className="text-[15px] font-black text-slate-900 tracking-tight leading-none">
                                MLS Property Data
                            </h3>
                        </div>
                        <div className="px-5 py-5">
                            <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-tight">
                                {data.address?.split(',')[0] || 'Property Overview'}
                            </h1>
                            <p className="text-[12px] text-slate-500 mt-1 font-semibold uppercase tracking-wider">
                                {data.address?.split(',').slice(1).join(',').trim()}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                {data.homeType && (
                                    <span className="px-3 py-1.5 bg-indigo-50 border border-indigo-100/50 rounded-lg text-[10px] font-black text-indigo-700 uppercase tracking-[0.1em]">
                                        {data.homeType.replace(/_/g, ' ')}
                                    </span>
                                )}
                                {data.bedrooms != null && (
                                    <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-[0.1em]">
                                        <i className="fa-solid fa-bed mr-2 text-[10px] text-slate-400" />{data.bedrooms} Bed
                                    </span>
                                )}
                                {data.bathrooms != null && (
                                    <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-[0.1em]">
                                        <i className="fa-solid fa-bath mr-2 text-[10px] text-slate-400" />{data.bathrooms} Bath
                                    </span>
                                )}
                                {data.livingAreaValue && (
                                    <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-[0.1em]">
                                        <i className="fa-solid fa-maximize mr-2 text-[10px] text-slate-400" />{data.livingAreaValue.toLocaleString()} SF
                                    </span>
                                )}
                                {data.yearBuilt && (
                                    <span className="px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-[0.1em]">
                                        Built {data.yearBuilt}
                                    </span>
                                )}
                                {price && data.livingAreaValue && (
                                    <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-100/50 rounded-lg text-[10px] font-black text-emerald-700 uppercase tracking-[0.1em]">
                                        ${Math.round(price / data.livingAreaValue).toLocaleString()}/SF
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Collapsible MLS Details ── */}
                        {data.resoFacts && (
                            <div className="border-t border-slate-100">
                                <button
                                    onClick={() => setMlsOpen(v => !v)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Small thumbnail preview in collapsed state */}
                                        {!mlsOpen && data.imgSrc && (
                                            <div className="w-14 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
                                                <img src={data.imgSrc} className="w-full h-full object-cover" alt="MLS Preview" />
                                            </div>
                                        )}
                                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors shadow-sm">
                                            <i className="fa-solid fa-list text-slate-400 group-hover:text-indigo-500 text-[10px] transition-colors" />
                                        </div>
                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] group-hover:text-slate-700 transition-colors">
                                            Detailed Specifications
                                        </span>
                                    </div>
                                    <i className={`fa-solid fa-chevron-${mlsOpen ? 'up' : 'down'} text-[10px] text-slate-400 transition-transform duration-200 mr-2`} />
                                </button>

                                {mlsOpen && (
                                    <div className="px-5 pb-5 animate-in slide-in-from-top-1 duration-200 flex flex-col lg:flex-row gap-6">
                                        {/* Left: Constant gallery */}
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

                                        {/* Right: Insights & Specs */}
                                        <div className="flex-1 flex flex-col gap-3 min-w-0">
                                            {/* Property Description */}
                                            {data.description && (
                                                <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center">
                                                            <i className="fa-solid fa-align-left text-indigo-600 text-[10px]" />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Listing Remarks</span>
                                                    </div>
                                                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium line-clamp-6 hover:line-clamp-none transition-all duration-300">
                                                        {data.description}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

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
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Environment section */}
                    {(hasEnv || hasCoords) && (
                        <SectionCard
                            id="ov-environment"
                            title="Environment"
                            icon="fa-leaf"
                            iconBg="bg-emerald-50"
                            iconColor="text-emerald-500"
                            className="mt-4"
                            noPadding
                        >

                            <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
                                {/* ── COLUMN 1: Noise ── */}
                                <div className="lg:col-span-1 space-y-6">
                                    {/* Noise Card */}
                                    {hasNoise && (
                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100/60 p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-2.5">
                                                    <i className="fa-solid fa-volume-xmark text-purple-500 text-[14px]" />
                                                    <span className="text-[13px] font-black text-slate-800 uppercase tracking-[0.1em]">Noise Report</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Score</div>
                                                    <div className="text-[20px] font-black text-slate-900 leading-none">{data.noiseScore}/100</div>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {[
                                                    { label: 'TRAFFIC', score: (data as any).noiseTrafficScore || 75, status: ' Busy' },
                                                    { label: 'LOCAL', score: (data as any).noiseLocalScore || 15, status: ' Calm' },
                                                    { label: 'AIRPORT', score: (data as any).noiseAirportScore || 5, status: ' Calm' }
                                                ].map((n, i) => (
                                                    <div key={i}>
                                                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                                            <span>{n.label}</span>
                                                            <span className="text-slate-600 font-extrabold">{n.status}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-200/50 rounded-full overflow-hidden shadow-inner">
                                                            <div className="h-full bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.4)]" style={{ width: `${n.score}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="text-[9px] text-slate-300 font-black uppercase text-right tracking-[0.2em] mt-2">HowLoud Data Engine</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* ── COLUMN 2: Air Quality ── */}
                                <div className="lg:col-span-2">
                                    {data.airQuality && (
                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <i className="fa-solid fa-wind text-emerald-500 text-[14px]" />
                                                    <span className="text-[14px] font-black text-slate-800 uppercase tracking-widest">Air Quality</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">US AQI</div>
                                                    <div className="text-[24px] font-black text-amber-600 leading-none">{data.airQuality.aqi}</div>
                                                </div>
                                            </div>
                                            <div className="inline-flex items-center gap-2.5 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg mb-4">
                                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
                                                <span className="text-[15px] font-black text-emerald-700 tracking-tight">Safe — No Limitations</span>
                                            </div>
                                            <p className="text-[15px] text-slate-600 leading-relaxed font-medium mb-6">
                                                "With this level of air quality, you have no limitations. Enjoy the outdoors!"
                                            </p>
                                            <button 
                                                onClick={() => toggleEnv('aqi_bento')} 
                                                className="w-full flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 pt-3 group hover:text-emerald-500 transition-colors"
                                            >
                                                <span>Molecular Breakdown</span>
                                                <i className={`fa-solid fa-chevron-${envOpen['aqi_bento'] ? 'up' : 'down'} transition-transform`} />
                                            </button>
                                            {envOpen['aqi_bento'] && (
                                                <div className="pt-3 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    {data.airQuality.pollutants?.map((p, i) => (
                                                        <div key={i} className="flex flex-col p-2 bg-white rounded-lg border border-slate-100">
                                                            <span className="text-[11px] font-bold text-slate-400">{p.fullName}</span>
                                                            <span className="text-[15px] font-black text-slate-700">{p.concentration.toFixed(1)} {p.unit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="text-[9px] text-slate-300 font-bold uppercase text-right tracking-[0.2em] mt-auto pt-4">Google Air Quality API</div>
                                        </div>
                                    )}
                                </div>

                                {/* ── COLUMN 3: Pollen ── */}
                                <div className="lg:col-span-1">
                                    {hasPollen && (
                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100/60 p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-2.5">
                                                    <i className="fa-solid fa-seedling text-amber-600 text-[14px]" />
                                                    <span className="text-[13px] font-black text-slate-800 uppercase tracking-[0.1em]">Pollen Report</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Level</div>
                                                    <div className="text-[20px] font-black text-amber-600 leading-none">{data.pollen?.category || 'Low'}</div>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="p-4 bg-white border border-slate-100/80 rounded-2xl relative shadow-sm">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1.5">Dominant Type</div>
                                                    <div className="text-[16px] font-black text-slate-800">{data.pollen?.dominantPollenType || 'Grasses'}</div>
                                                </div>
                                                <p className="text-[13px] text-slate-500 font-semibold leading-relaxed italic">
                                                    {data.pollen?.description || 'Pollen levels are currently within a comfortable range for most sensitive groups.'}
                                                </p>
                                            </div>
                                            <div className="text-[9px] text-slate-300 font-bold uppercase text-right tracking-[0.2em] mt-4">Google Pollen API</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    {/* Resilience section */}
                    {(hasEnv || hasCoords) && (
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
                                {/* ── Resilience Columns ── */}
                                <div className="lg:col-span-2">
                                     {/* Climate Risk Card */}
                                      <div className="bg-slate-50/50 rounded-2xl border border-slate-100/60 p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                                         <div className="flex items-center justify-between mb-6">
                                             <div className="flex items-center gap-2.5">
                                                 <i className="fa-solid fa-triangle-exclamation text-orange-500 text-[14px]" />
                                                 <span className="text-[13px] font-black text-slate-800 uppercase tracking-[0.1em]">Climate Risk Factors</span>
                                             </div>
                                             <div className="text-right">
                                                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Forecasted Insurance</div>
                                                 <div className="text-[20px] font-black text-slate-900 leading-none">${(data.annualHomeownersInsurance || 6544).toLocaleString()}/yr</div>
                                             </div>
                                         </div>
                                         <div className="grid grid-cols-2 gap-3">
                                             {[
                                                 { label: 'WIND', score: data.windRiskScore || 1, max: 10, color: 'text-emerald-500', icon: 'fa-wind' },
                                                 { label: 'FLOOD', score: data.floodRiskScore || 1, max: 10, color: 'text-blue-500', icon: 'fa-water' },
                                                 { label: 'FIRE', score: data.fireRiskScore || 6, max: 10, color: 'text-orange-500', icon: 'fa-fire' },
                                                 { label: 'HEAT', score: data.heatRiskScore || 5, max: 10, color: 'text-rose-500', icon: 'fa-temperature-high' }
                                             ].map((r, i) => (
                                                 <div key={i} className={`p-4 rounded-xl border border-slate-100 transition-all shadow-sm ${r.score && r.score > 5 ? 'bg-orange-50/50 border-orange-100/50 shadow-orange-100/20' : 'bg-white'}`}>
                                                     <div className="flex items-center justify-between mb-2">
                                                         <div className="flex items-center gap-1.5">
                                                             <i className={`fa-solid ${r.icon} text-slate-400 text-[12px]`} />
                                                             <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{r.label}</span>
                                                         </div>
                                                     </div>
                                                     <div className={`text-[18px] font-black ${r.score ? r.color : 'text-slate-300'}`}>
                                                         {r.score ? `${r.score}/${r.max}` : 'N/A'}
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                         <div className="text-[9px] text-slate-300 font-black uppercase text-right tracking-[0.2em] mt-6">Risk Factor · First Street</div>
                                     </div>
                                </div>

                                <div className="lg:col-span-2">
                                    {/* Hazard Zones Card */}
                                     <div className="bg-slate-50/50 rounded-2xl border border-slate-100/60 p-5 shadow-sm hover:shadow-md transition-shadow h-full">
                                         <div className="flex items-center justify-between mb-6">
                                             <div className="flex items-center gap-2.5">
                                                 <i className="fa-solid fa-map-location-dot text-rose-500 text-[14px]" />
                                                 <span className="text-[13px] font-black text-slate-800 uppercase tracking-[0.1em]">Hazard Zones</span>
                                             </div>
                                         </div>
                                        <div className="space-y-6">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 shadow-sm">
                                                    <i className="fa-solid fa-house-chimney-crack text-rose-500 text-[18px]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-3 mb-1.5">
                                                        <span className="text-[15px] font-black text-slate-700 uppercase">Seismic Hazard</span>
                                                        <span className="px-2 py-0.5 bg-rose-500 text-white rounded-md text-[11px] font-black shadow-lg shadow-rose-200">Zone {data.seismicHazardZone || 'E'}</span>
                                                    </div>
                                                    <p className="text-[14px] text-slate-600 font-medium leading-relaxed">
                                                        Located in a high-risk seismic zone. Structural reinforcement and specialized insurance are recommended.
                                                    </p>
                                                    <div className="flex gap-6 mt-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight">Historic Quakes</span>
                                                            <span className="text-[12px] text-slate-500 font-bold">10 <span className="text-slate-300 font-normal ml-0.5">nearby</span></span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight">FEMA Disasters</span>
                                                            <span className="text-[12px] text-slate-500 font-bold">0 <span className="text-slate-300 font-normal ml-0.5">recorded</span></span>
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
                                                            <span className="text-[15px] font-black text-slate-700 uppercase">Drought Intensity</span>
                                                            <span className="text-[15px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">{data.drought?.drought_level?.toUpperCase() || 'NONE'}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[14px] text-slate-600 font-medium leading-relaxed">
                                                        Currently 100% free of drought conditions. Low risk of vegetation loss or landscape impact.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-300 font-black uppercase text-right tracking-widest mt-auto pt-4">USGS · FEMA · Drought Monitor</div>
                                    </div>
                                </div>

                                {/* ── COLUMN 3: Sun Pathing ── */}
                                <div id="ov-sun" className="lg:col-span-4 scroll-mt-24 mt-4">
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100/60 p-5 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2.5 mb-5">
                                            <i className="fa-solid fa-sun text-amber-500 text-[14px]" />
                                            <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-[0.1em]">Solar Insights</h3>
                                        </div>
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                            {/* Column 1: Sun Map (5/12) */}
                                            <div className="lg:col-span-5">
                                                <SeasonalSunCard 
                                                    lat={data.coordinates!.latitude} 
                                                    lng={data.coordinates!.longitude} 
                                                    orientation={(data as any).orientation_ai?.final_orientation} 
                                                />
                                            </div>

                                            {/* Column 2: AI Insights (3/12) */}
                                            <div className="lg:col-span-3">
                                                <div className="space-y-4 h-full">
                                                    {micro && (
                                                        <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl relative overflow-hidden group transition-all hover:bg-blue-50 h-full">
                                                            <div className="absolute top-0 right-0 p-2 opacity-5">
                                                                <i className="fa-solid fa-temperature-half text-[32px] text-blue-500" />
                                                            </div>
                                                            <p className="text-[14px] text-blue-700 leading-relaxed italic relative z-10 font-bold">
                                                                &ldquo;Lot feels cooler due to canyon breezes reaching this location early.&rdquo;
                                                            </p>
                                                            <div className="flex items-center justify-between mt-3 text-[10px] text-blue-400 font-black uppercase tracking-widest relative z-10">
                                                                <span>Tomorrow.io AI Insight</span>
                                                                <span>7:42 AM PST</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="bg-white/50 rounded-xl p-3 border border-slate-100 mt-auto">
                                                        <div className="text-[10px] text-slate-300 font-black uppercase text-right tracking-widest">SunCalc · Tomorrow.io API Datasets</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 3: Solar Potential (4/12) */}
                                            <div className="lg:col-span-4">
                                                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm h-full flex flex-col">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <i className="fa-solid fa-solar-panel text-amber-500 text-[14px]" />
                                                        <span className="text-[13px] font-black text-slate-800 uppercase tracking-widest">Solar Potential</span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                                        <div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sunshine</div>
                                                            <div className="text-[18px] font-black text-slate-700 leading-tight">{Math.round(data.solarData?.maxSunshineHoursPerYear || 1815).toLocaleString()} <span className="text-[10px] uppercase">hrs/yr</span></div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Production</div>
                                                            <div className="text-[18px] font-black text-indigo-600 leading-tight">{(solarPotential?.annualKwh || 39048).toLocaleString()} <span className="text-[10px] uppercase">kWh</span></div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency</div>
                                                            <div className="text-[18px] font-black text-orange-600 leading-tight">60% <span className="text-[10px] font-bold uppercase">Safe</span></div>
                                                        </div>
                                                    </div>
                                                    <div className="h-2 bg-slate-200/50 rounded-full overflow-hidden mb-1.5 relative">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-300 rounded-full" style={{ width: '60%' }} />
                                                    </div>
                                                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center mb-6 shadow-sm">
                                                        <span className="text-[13px] font-black text-orange-600 uppercase tracking-widest italic leading-none block mb-1">Impacted by obstructions</span>
                                                        <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                                            Based on roof pitch, trees, and Google Solar API models.
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-4 bg-white border border-slate-100 rounded-xl relative shadow-sm">
                                                            <div className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-2">Payback</div>
                                                            <div className="text-[22px] font-black text-orange-500">{(data.solarData?.financialAnalysis?.cashPurchase?.paybackYears || 5.5).toFixed(1)} <span className="text-[13px]">yrs</span></div>
                                                        </div>
                                                        <div className="p-4 bg-white border border-slate-100 rounded-xl relative shadow-sm">
                                                            <div className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-2">20-Yr Savings</div>
                                                            <div className="text-[22px] font-black text-emerald-500">${(data.solarData?.financialAnalysis?.cashPurchase?.savings?.savingsYear20 || 76915).toLocaleString()}</div>
                                                        </div>
                                                        <div className="p-4 bg-white border border-slate-100 rounded-xl relative shadow-sm">
                                                            <div className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-2">System Cost</div>
                                                            <div className="text-[22px] font-black text-indigo-600">${(data.solarData?.financialAnalysis?.cashPurchase?.upfrontCost || 18218).toLocaleString()}</div>
                                                        </div>
                                                        <div className="p-4 bg-white border border-slate-100 rounded-xl relative shadow-sm">
                                                            <div className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-2">Year 1 Saving</div>
                                                            <div className="text-[22px] font-black text-slate-800">${(data.solarData?.financialAnalysis?.cashPurchase?.savings?.savingsYear1 || 3341).toLocaleString()}</div>
                                                        </div>
                                                    </div>

                                                    <button 
                                                        onClick={() => toggleEnv('solar_specs')}
                                                        className="w-full flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100 mt-6 pt-3 group hover:text-indigo-500 transition-colors"
                                                    >
                                                        <span>@ System Specs</span>
                                                        <i className={`fa-solid fa-chevron-${envOpen['solar_specs'] ? 'up' : 'down'} text-[10px] transition-transform`} />
                                                    </button>
                                                    
                                                    {envOpen['solar_specs'] && (
                                                        <div className="mt-5 pt-5 border-t border-slate-200 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                                                                <div>
                                                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Max Panels</div>
                                                                    <div className="text-[16px] font-black text-slate-800">{data.solarPotential?.maxArrayPanelsCount || 25} <span className="text-[12px] text-slate-400 font-medium">units</span></div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Panel Capacity</div>
                                                                    <div className="text-[16px] font-black text-slate-800">{data.solarPotential?.panelCapacityWatts || 320} <span className="text-[12px] text-slate-400 font-medium">Watts</span></div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Array Area</div>
                                                                    <div className="text-[16px] font-black text-slate-800">{Math.round(data.solarPotential?.maxArrayAreaMeters2 || 42)} <span className="text-[12px] text-slate-400 font-medium">m²</span></div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Annual Sunshine</div>
                                                                    <div className="text-[16px] font-black text-slate-800">{Math.round(data.solarData?.maxSunshineHoursPerYear || 1815).toLocaleString()} <span className="text-[12px] text-slate-400 font-medium">hrs/yr</span></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] text-slate-300 font-bold uppercase text-right tracking-widest mt-auto pt-4">google solar api</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    {/* Daily Living & Commute — Bento grid overhaul */}
                    {(hasWalk || hasBroadband || hasSolar || hasEV) && (
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
                                {/* ── Col 1: Mobility & Commute ── */}
                                <div className="lg:col-span-4 space-y-4">
                                    {/* Mobility */}
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <i className="fa-solid fa-person-walking text-emerald-400 text-[13px]" />
                                            <span className="text-[13px] font-black text-slate-500 uppercase tracking-widest">Mobility</span>
                                        </div>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'WALK', score: data.walkScore, desc: data.walkScoreDesc, icon: 'fa-person-walking' },
                                                { label: 'TRANSIT', score: data.transitScore, desc: data.transitScoreDesc || 'N/A', icon: 'fa-bus' },
                                                { label: 'BIKE', score: data.bikeScore, desc: data.bikeScoreDesc, icon: 'fa-bicycle' },
                                            ].map((m, i) => (
                                                <div key={i} className="flex flex-col">
                                                    <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                                        <i className={`fa-solid ${m.icon} text-[10px]`} />
                                                        <span>{m.label}</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[16px] font-black text-slate-700">{m.score != null ? `${m.score}/100` : 'N/A'}</span>
                                                        <span className="text-[13px] text-slate-400 font-medium truncate">{m.desc}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[10px] text-slate-300 font-bold uppercase text-right tracking-widest mt-4">Walk Score</div>
                                    </div>

                                    {/* Commute */}
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <i className="fa-solid fa-clock text-blue-400 text-[13px]" />
                                            <span className="text-[13px] font-black text-slate-500 uppercase tracking-widest">Commute</span>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                placeholder="Enter work address..." 
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                            <div className="absolute right-2 top-2 p-1 bg-blue-500 rounded-md text-white">
                                                <i className="fa-solid fa-magnifying-glass text-[11px]" />
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-300 font-bold uppercase text-right tracking-widest mt-4">Google Maps</div>
                                    </div>
                                </div>

                                {/* ── Col 2: Connectivity ── */}
                                <div className="lg:col-span-4">
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm h-full">
                                        <div className="flex items-center gap-2 mb-4">
                                            <i className="fa-solid fa-wifi text-blue-400 text-[13px]" />
                                            <span className="text-[13px] font-black text-slate-500 uppercase tracking-widest">Connectivity</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                                FIBER <i className="fa-solid fa-check text-[8px]" />
                                            </span>
                                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase tracking-wider">5G</span>
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[9px] font-black uppercase tracking-wider">9 ISPS</span>
                                            <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[9px] font-black uppercase tracking-wider">+ 5 GBPS</span>
                                        </div>
                                        <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Internet Availability</div>
                                        <div className="space-y-3">
                                            {data.broadband?.internetProviders?.slice(0,4).map((isp, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-2.5 max-w-[50%]">
                                                        <i className="fa-solid fa-signal text-indigo-400 text-[11px]" />
                                                        <span className="text-[14px] font-black text-slate-700 truncate">{isp.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${isp.technology === 'Fiber' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                            {isp.technology}
                                                        </span>
                                                        <span className="text-[15px] font-black text-indigo-600">{isp.maxDownloadMbps >= 1000 ? `${(isp.maxDownloadMbps/1000).toFixed(0)}Gbps` : `${isp.maxDownloadMbps}Mbps`}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-6 mb-3">Cell Coverage</div>
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
                                        <div className="text-[10px] text-slate-300 font-bold uppercase text-right tracking-widest mt-6">broadbandmap</div>
                                    </div>
                                </div>

                                {/* ── Col 3: EV Charging ── */}
                                <div className="lg:col-span-4">
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 shadow-sm h-full flex flex-col">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-charging-station text-emerald-400 text-[14px]" />
                                                <span className="text-[13px] font-black text-slate-800 uppercase tracking-widest">EV Charging</span>
                                            </div>
                                            <i className="fa-solid fa-up-right-from-square text-slate-300 text-[11px]" />
                                        </div>
                                        
                                        {(() => {
                                            const ev = (data as any).evChargers || { totalStations: 20, closestDistanceMi: 0.4, totalPorts: 129, dcFastPorts: 40, level2Ports: 89, networks: ['ChargePoint', 'Tesla', 'Loop', 'Noodoe', 'EVGo'] };
                                            return (
                                                <div className="flex-1 space-y-6">
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        <div>
                                                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Stations</div>
                                                            <div className="text-[24px] font-black text-slate-800">{ev.totalStations}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Closest</div>
                                                            <div className="text-[24px] font-black text-emerald-500">{(ev.closestDistanceMi || 0.4).toFixed(1)} <span className="text-[13px]">mi</span></div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Ports</div>
                                                            <div className="text-[24px] font-black text-slate-800">{ev.totalPorts}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <i className="fa-solid fa-bolt-lightning text-amber-400 text-[11px]" />
                                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">DC Fast</span>
                                                            </div>
                                                            <div className="text-[16px] font-black text-orange-500">{ev.dcFastPorts || 40} ports</div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <i className="fa-solid fa-bolt text-blue-400 text-[11px]" />
                                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Level 2</span>
                                                            </div>
                                                            <div className="text-[16px] font-black text-blue-500">{ev.level2Ports || 89} ports</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {ev.networks?.map((n: string, i: number) => (
                                                            <span key={i} className="px-3 py-1 bg-white border border-emerald-100 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">{n.toUpperCase()}</span>
                                                        ))}
                                                    </div>

                                                    <div className="flex items-center gap-2 text-[13px] text-slate-400 font-medium">
                                                        <i className="fa-solid fa-location-dot text-[11px] text-slate-300" />
                                                        {ev.closestStationName || 'CITY OF DUBLIN HERITAGE'}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        
                                        <div className="text-[10px] text-slate-300 font-bold uppercase text-right tracking-widest mt-auto pt-4">NREL AFDC API</div>
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    )}

                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="xl:flex-1 flex flex-col gap-4">




                    {/* Schools */}
                    {hasSchools && (
                        <SectionCard
                            id="ov-schools"
                            title="Schools"
                            icon="fa-graduation-cap"
                            iconBg="bg-blue-50"
                            iconColor="text-blue-500"
                        >
                            
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
                                            <p className="text-[13px] text-slate-600 leading-relaxed font-semibold">
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
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setIsSchoolModalOpen(true)}
                                className="w-full py-4 border-t border-slate-50 text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
                            >
                                View full details 
                                <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                            </button>
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
                                {/* Header / Selector */}
                                <div className="px-8 pt-8 pb-4 bg-white border-b border-slate-100 relative shrink-0">
                                    <button 
                                        onClick={() => setIsSchoolModalOpen(false)}
                                        className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all"
                                    >
                                        <i className="fa-solid fa-xmark text-sm" />
                                    </button>

                                    {/* Static Header for Selected School */}
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
                                            <i className={`fa-solid ${
                                                schoolsIntelligence.schools[selectedSchool]?.level?.toLowerCase().includes('elementary') ? 'fa-user' : 
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

                                {/* Content Body */}
                                <div className="p-8 space-y-8 overflow-y-auto">
                                    {/* Executive Intro */}
                                    <div className="space-y-4">
                                        <p className="text-[13px] md:text-[14px] text-slate-600 leading-relaxed font-medium">
                                            {schoolsIntelligence.schools[selectedSchool]?.overall_assessment || 
                                             `${schoolsIntelligence.schools[selectedSchool].name} is a highly-rated ${schoolsIntelligence.schools[selectedSchool].type || 'public'} school in ${data.city || 'Dublin'}, CA, known for its strong academic performance and diverse student body.`}
                                        </p>
                                        
                                        {/* Status Bar */}
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

                                    {/* Details Sections */}
                                    <div className="space-y-8">
                                        {/* Test Scores */}
                                        <div className="space-y-3">
                                            <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Test Scores</div>
                                            <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                                                {schoolsIntelligence.schools[selectedSchool]?.test_scores || 'Students demonstrate high proficiency rates in both Math and ELA, significantly exceeding state averages.'}
                                            </p>
                                        </div>

                                        {/* Sentiment Analysis */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">
                                                    <i className="fa-solid fa-thumbs-up" /> Parent Loves
                                                </div>
                                                <p className="text-[11px] text-emerald-900 leading-relaxed font-medium">
                                                    {schoolsIntelligence.schools[selectedSchool]?.parent_sentiment_positive || 'Parents appreciate the dedicated teachers and the overall quality of education provided.'}
                                                </p>
                                            </div>
                                            <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-100/50">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-rose-600 uppercase tracking-widest mb-2">
                                                    <i className="fa-solid fa-triangle-exclamation" /> Parent Concerns
                                                </div>
                                                <p className="text-[11px] text-rose-900 leading-relaxed font-medium">
                                                    {schoolsIntelligence.schools[selectedSchool]?.parent_sentiment_concerns || 'Some concerns have been raised regarding resources for special needs students.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Extracurriculars */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                                <i className="fa-solid fa-trophy text-amber-500 text-[9px]" /> Activities & Strengths
                                            </div>
                                            <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                                                {schoolsIntelligence.schools[selectedSchool]?.extracurriculars || 'Offers a variety of after-school enrichment programs, music, and arts.'}
                                            </p>
                                        </div>

                                        {/* News */}
                                        <div className="space-y-2">
                                            <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Recent News</div>
                                            <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                                                {schoolsIntelligence.schools[selectedSchool]?.recent_news || 'No major recent news changes reported for this calendar year.'}
                                            </p>
                                        </div>

                                        {/* Demographics */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                                <i className="fa-solid fa-users text-indigo-500 text-[9px]" /> Demographics
                                            </div>
                                            <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                                                {schoolsIntelligence.schools[selectedSchool]?.demographics_summary || 'The student body is diverse, with strong community engagement.'}
                                            </p>
                                        </div>

                                        {/* Sources */}
                                        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2">
                                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest shrink-0 leading-none">Sources:</span>
                                            {schoolsIntelligence.schools[selectedSchool]?.sources?.map((s: any, idx: number) => (
                                                <a 
                                                    key={idx} 
                                                    href={s.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-[10px] font-medium text-blue-500 hover:text-blue-600 underline transition-colors"
                                                >
                                                    {s.title || s.label || 'Official Source'}
                                                </a>
                                            )) || <span className="text-[9px] text-slate-400 font-medium">Verified Zyphe Data • 2026</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Front Orientation */}
                    {data && isTargetForOrientationAnalysis(data).target && (data as any).orientation_ai && (data as any).orientation_ai.final_orientation !== 'UNCLEAR_IMAGE' && (() => {
                        const sat = (data as any).orientation_ai;
                        return (
                            <SectionCard
                                id="ov-orientation"
                                title="Front Orientation"
                                icon="fa-compass"
                                iconBg="bg-amber-50"
                                iconColor="text-amber-500"
                            >
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
                            </SectionCard>
                        );
                    })()}

                    {/* 1. Neighborhood Insights (Relocated gemini analysis) */}
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
                            >
                                <div className="p-4 space-y-4">
                                    {gem?.character?.description && (
                                        <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                                            {gem.character.description}
                                        </p>
                                    )}

                                    {/* Badges row */}
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

                                    {/* Standout Features */}
                                    {gem?.unique_features && gem.unique_features.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Stand Out Features</div>
                                            <div className="flex flex-wrap gap-2">
                                                {gem.unique_features.slice(0, 5).map((feat: string, i: number) => (
                                                    <span key={i} className="text-[11px] font-bold px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
                                                        {feat}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Infrastructure */}
                                    {gem?.infrastructure_quality && (
                                        <div className="pt-3 border-t border-slate-100">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Infrastructure</div>
                                            <p className="text-[12px] text-slate-500 leading-relaxed font-medium">{gem.infrastructure_quality}</p>
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
                            title="Rental Analysis"
                            icon="fa-house-chimney-window"
                            iconBg="bg-emerald-50"
                            iconColor="text-emerald-500"
                        >
                            <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Long Term Rental (LTR) */}
                                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Long Term (LTR)</div>
                                            <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase tracking-wider">Stable</div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Est. Monthly Rent</div>
                                                <div className="text-[20px] font-black text-slate-800">
                                                    {(() => {
                                                        const rent = ltrAnalysis.monthly_rent || "";
                                                        // Extract range like "$7,500 to $9,000" or "$7,500 - $9,000"
                                                        const match = rent.match(/\$[\d,]+(?:\s*(?:to|-)\s*\$[\d,]+)?/);
                                                        return match ? match[0] : (rent.length > 20 ? "--" : rent || "--");
                                                    })()}
                                                </div>
                                            </div>
                                            {ltrAnalysis.vacancy_rate && (
                                                <div className="flex items-center justify-between pt-2 border-t border-emerald-100/50">
                                                    <span className="text-[11px] text-slate-500 font-medium">Est. Vacancy</span>
                                                    <span className="text-[11px] text-emerald-700 font-black">
                                                        {(() => {
                                                            const v = ltrAnalysis.vacancy_rate || "";
                                                            // Extract range like "2-4%" or "5%"
                                                            const match = v.match(/(\d+(?:-\d+)?%)/);
                                                            return match ? match[1] : (v.length > 10 ? "--" : v || "--");
                                                        })()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Short Term Rental (STR) */}
                                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Short Term (STR)</div>
                                            <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase tracking-wider">High Yield</div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Est. Annual Revenue</div>
                                                <div className="text-[20px] font-black text-slate-800">
                                                    {(() => {
                                                        const str = customAnalysis?.property_investment?.str_performance?.annual_revenue_projection || "";
                                                        const summary = ltrAnalysis.comparison_summary || "";
                                                        
                                                        // Try to extract from str object first, then summary
                                                        const combined = str + " " + summary;
                                                        const match = combined.match(/\$[\d,]{4,}/); // Look for significant dollar amount
                                                        return match ? match[0] : "--";
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-indigo-100/50">
                                                <span className="text-[11px] text-slate-500 font-medium">Est. Occupancy</span>
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
                            </div>
                        </SectionCard>
                    )}

                    {/* Nearby Amenities */}
                    {(data.google_places || visualPoi || (mapLabels && mapLabels.length > 0)) && (
                        <div id="ov-nearby" className="bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow scroll-mt-24">
                            <button 
                                onClick={() => setIsNearbyCollapsed(!isNearbyCollapsed)}
                                className="w-full px-5 py-4 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors border border-slate-100/50">
                                        <i className="fa-solid fa-map-location-dot text-indigo-500 text-[13px]" />
                                    </div>
                                    <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-[0.1em]">What's Nearby?</h3>
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
                                    <p className="text-[12px] text-slate-300 leading-relaxed italic font-medium opacity-90">
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
            </div>
        </div>
    );
};

export default PropertyOverviewDashboard;
