/**
 * PropertyOverviewDashboard
 *
 * Two-column dashboard with a sticky left mini-nav anchored to every section.
 * Uses IntersectionObserver to highlight the active section as you scroll.
 */
import React from 'react';
import { PropertyData, ComprehensiveAnalysisResult, CustomAIAnalysisResult } from '../../types';
import SeasonalSunCard from './SeasonalSunCard';
import { calculateSolarPotential } from '../../utils/solarCalculations';
import { computeSolarBenchmarks } from '../../utils/solarCityBenchmarks';

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
    subtitle?: string;
    badge?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ id, title, subtitle, badge, children, className = '' }) => (
    <div
        id={id}
        className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-24 ${className}`}
    >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
                <h3 className="text-[15px] font-black text-slate-900 tracking-tight">{title}</h3>
                {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
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

// ── Mini Left Nav ──────────────────────────────────────────────────────────────
interface NavItem { id: string; label: string; icon: string; visible: boolean; }

const MiniNav: React.FC<{ items: NavItem[]; activeId: string }> = ({ items, activeId }) => {
    const visible = items.filter(i => i.visible);
    if (visible.length < 2) return null;

    return (
        <nav className="hidden xl:flex flex-col gap-1 sticky top-24 self-start w-[160px] flex-shrink-0">
            {/* Nav header */}
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-[0.18em] px-3 mb-1">
                On this page
            </div>
            {visible.map(item => {
                const isActive = activeId === item.id;
                return (
                    <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={e => {
                            e.preventDefault();
                            document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 group
                            ${isActive
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                    >
                        {/* Active dot / icon */}
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all
                            ${isActive ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                            <i className={`fa-solid ${item.icon} text-[8px] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        </span>
                        <span className="leading-snug truncate">{item.label}</span>
                        {isActive && (
                            <div className="ml-auto w-1 h-1 rounded-full bg-white/70 flex-shrink-0" />
                        )}
                    </a>
                );
            })}
        </nav>
    );
};

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
    const toggleEnv = (key: string) => setEnvOpen(prev => ({ ...prev, [key]: !prev[key] }));

    // — Section nav items (order matches rendered sections) —
    const navItems: NavItem[] = [
        { id: 'ov-property',     label: 'Property',          icon: 'fa-house',               visible: true },
        { id: 'ov-environment',  label: 'Environment',        icon: 'fa-leaf',                visible: hasEnv || hasCoords },
        { id: 'ov-solar',        label: 'Solar',              icon: 'fa-solar-panel',         visible: hasSolar },
        { id: 'ov-connectivity', label: 'Connectivity',       icon: 'fa-wifi',                visible: hasBroadband },
        { id: 'ov-mobility',     label: 'Mobility',           icon: 'fa-person-walking',      visible: hasWalk },
        { id: 'ov-ev',           label: 'EV Charging',        icon: 'fa-charging-station',    visible: hasEV },
        { id: 'ov-schools',      label: 'Education',          icon: 'fa-graduation-cap',      visible: hasSchools },
        { id: 'ov-amenities',    label: 'Amenities',          icon: 'fa-location-dot',        visible: hasPlaces },
    ];

    // — IntersectionObserver to track active section —
    const [activeId, setActiveId] = React.useState('ov-property');

    React.useEffect(() => {
        const ids = navItems.filter(i => i.visible).map(i => i.id);
        const observers: IntersectionObserver[] = [];

        const handleIntersect = (entries: IntersectionObserverEntry[]) => {
            // Pick the topmost visible section
            const visible = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible.length > 0) {
                setActiveId(visible[0].target.id);
            }
        };

        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const obs = new IntersectionObserver(handleIntersect, {
                rootMargin: '-10% 0px -60% 0px',
                threshold: 0,
            });
            obs.observe(el);
            observers.push(obs);
        });

        return () => observers.forEach(o => o.disconnect());
    }, [navItems.map(i => i.id + i.visible).join(',')]);

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
        <div className="flex gap-4 py-4">

            {/* ═══ STICKY LEFT MINI NAV ═══════════════════════════════ */}
            <MiniNav items={navItems} activeId={activeId} />

            {/* ═══ MAIN CONTENT (left + right columns) ════════════════ */}
            <div className="flex-1 min-w-0 flex flex-col xl:flex-row gap-4">

                {/* ── LEFT COLUMN ── */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">

                    {/* Property title */}
                    <div id="ov-property" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24">
                        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-5 py-2">
                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em]">
                                ✦ Intelligence Report
                            </span>
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
                                    <div className="flex items-center gap-2">
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
                                    <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 animate-in slide-in-from-top-1 duration-200">

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
                                )}
                            </div>
                        )}
                    </div>

                    {/* Environment & Resilience — Bento grid overhaul */}
                    {(hasEnv || hasCoords) && (
                        <div id="ov-environment" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-24">
                            {/* Card header */}
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <i className="fa-solid fa-leaf text-emerald-500 text-[14px]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[17px] font-black text-slate-900 tracking-tight">Environment &amp; Resilience</h3>
                                        <p className="text-[12px] text-slate-400 mt-0.5">Advanced risk assessment and climate projections</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 rounded-full text-[10px] font-black text-white uppercase tracking-wider shadow-sm">
                                    <i className="fa-solid fa-bolt text-[8px]" /> AI Risk Scored
                                </span>
                            </div>

                            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* ── COLUMN 1: Senses ── */}
                                <div className="space-y-6">
                                    {/* Noise Card */}
                                    {hasNoise && (
                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <i className="fa-solid fa-volume-xmark text-purple-400 text-[12px]" />
                                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Noise</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score</div>
                                                    <div className="text-[18px] font-black text-slate-900 leading-none">{data.noiseScore}/100</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level</div>
                                                    <div className="text-[14px] font-black text-purple-600 leading-none">{data.noiseScoreDesc ?? 'Active'}</div>
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
                                        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <i className="fa-solid fa-wind text-emerald-400 text-[12px]" />
                                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Air Quality</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">US AQI</div>
                                                    <div className="text-[18px] font-black text-amber-600 leading-none">{data.airQuality.aqi}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level</div>
                                                    <div className="text-[14px] font-black text-emerald-600 leading-none">Excellent quality</div>
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
                                    {/* Climate Risk Card */}
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-shield-halved text-orange-400 text-[14px]" />
                                                <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Climate Risk</span>
                                                <i className="fa-solid fa-up-right-from-square text-slate-300 text-[9px]" />
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Insurance</div>
                                                <div className="text-[18px] font-black text-slate-900 leading-none">${(data.annualHomeownersInsurance || 6544).toLocaleString()}/yr</div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { label: 'WIND', score: data.windRiskScore || 1, max: 10, color: 'text-emerald-500', icon: 'fa-wind' },
                                                { label: 'FLOOD', score: data.floodRiskScore || 1, max: 10, color: 'text-blue-500', icon: 'fa-water' },
                                                { label: 'FIRE', score: data.fireRiskScore || 6, max: 10, color: 'text-orange-500', icon: 'fa-fire' },
                                                { label: 'HEAT', score: data.heatRiskScore || null, max: 10, color: 'text-rose-500', icon: 'fa-temperature-high' }
                                            ].map((r, i) => (
                                                <div key={i} className={`p-4 rounded-xl border border-slate-100 transition-all ${r.score && r.score > 5 ? 'bg-orange-50/50 border-orange-100/50' : 'bg-white'}`}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <i className={`fa-solid ${r.icon} text-slate-300 text-[10px]`} />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.label}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`text-[16px] font-black ${r.score ? r.color : 'text-slate-300'}`}>
                                                        {r.score ? `${r.score}/${r.max}` : 'N/A'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-4">Risk Factor · First Street</div>
                                    </div>

                                    {/* Hazard Zones Card */}
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-triangle-exclamation text-rose-400 text-[14px]" />
                                                <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Hazard Zones</span>
                                                <i className="fa-solid fa-circle-info text-slate-300 text-[10px]" />
                                            </div>
                                            <i className="fa-solid fa-rotate-left text-slate-300 text-[10px]" />
                                        </div>
                                        <div className="space-y-6">
                                            <div className="flex items-start gap-3">
                                                <i className="fa-solid fa-house-chimney-crack text-rose-500 mt-1" />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[11px] font-black text-slate-700 uppercase">Seismic</span>
                                                        <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded text-[9px] font-black">Zone {data.seismicHazardZone || 'E'}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                                        Very high seismic risk — earthquake insurance recommended.
                                                    </p>
                                                    <div className="flex gap-4 mt-2">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[9px] font-black text-slate-700 uppercase">Quakes</span>
                                                            <span className="text-[9px] text-slate-400 font-bold">+0 TD</span>
                                                            <span className="text-[9px] font-black text-slate-700">10 <span className="text-[8px] text-slate-400">prev.</span></span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[9px] font-black text-slate-700 uppercase">FEMA</span>
                                                            <span className="text-[9px] text-slate-400 font-bold">VTD</span>
                                                            <span className="text-[9px] font-black text-slate-700">0 <span className="text-[8px] text-slate-400">prev.</span></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-100" />

                                            <div className="flex items-start gap-3">
                                                <i className="fa-solid fa-droplet-slash text-emerald-500 mt-1" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-black text-slate-700 uppercase">Drought</span>
                                                            <span className="text-[11px] font-black text-emerald-500">{data.drought?.drought_level?.toUpperCase() || 'NONE'}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                                        Alameda County, CA — 100% no drought, 0% affected.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-[8px] text-slate-300 font-bold uppercase text-right tracking-widest mt-6">USGS · FEMA · Drought Monitor</div>
                                    </div>
                                </div>

                                {/* ── COLUMN 3: Solar ── */}
                                <div className="space-y-6">
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                                        <div className="flex items-center gap-2 mb-4">
                                            <i className="fa-solid fa-sun text-amber-400 text-[14px]" />
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Seasonal Sun</span>
                                        </div>
                                        
                                        <div className="flex-1">
                                            <SeasonalSunCard 
                                                lat={data.coordinates!.latitude} 
                                                lng={data.coordinates!.longitude} 
                                                orientation={(data as any).orientation_ai?.final_orientation} 
                                            />
                                        </div>

                                        <div className="mt-6 space-y-4">
                                            {micro && (
                                                <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl relative overflow-hidden group transition-all hover:bg-blue-50">
                                                    <div className="absolute top-0 right-0 p-2 opacity-5">
                                                        <i className="fa-solid fa-temperature-half text-[40px] text-blue-500" />
                                                    </div>
                                                    <p className="text-[10px] text-blue-700 leading-relaxed italic relative z-10 font-medium">
                                                        &ldquo;Every home has a unique thermal fingerprint. While the official temperature at Downtown Dublin is 61°F, this specific lot actually feels like 48°F — a 13°F "Summer Survival Gap". Canyon breezes reach this location before the rest of town.&rdquo;
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

                    {/* Mobility */}
                    {hasWalk && (
                        <SectionCard id="ov-mobility" title="Mobility Score">
                            <div className="space-y-4">
                                {[
                                    { label: 'Walk Score', score: data.walkScore, desc: data.walkScoreDesc, color: 'bg-emerald-500' },
                                    { label: 'Transit Score', score: data.transitScore, desc: data.transitScoreDesc, color: 'bg-blue-500' },
                                    { label: 'Bike Score', score: data.bikeScore, desc: data.bikeScoreDesc, color: 'bg-teal-500' },
                                ].filter(m => m.score != null).map(m => (
                                    <div key={m.label}>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-[24px] font-black text-slate-900 tracking-tight leading-none">{m.score}</span>
                                            <ScoreBar score={m.score!} color={m.color} />
                                        </div>
                                        {m.desc && <div className="text-[10px] text-slate-400 font-medium mt-1 leading-snug">{m.desc}</div>}
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}

                    {/* EV Charging */}
                    {hasEV && (() => {
                        const ev = (data as any).evChargers;
                        return (
                            <SectionCard id="ov-ev" title="EV Charging">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    {ev.totalCount != null && <div><div className="text-[20px] font-black text-slate-900">{ev.totalCount}</div><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Stations</div></div>}
                                    {ev.closestDistanceMiles != null && <div><div className="text-[20px] font-black text-emerald-600">{ev.closestDistanceMiles.toFixed(1)}</div><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">mi Away</div></div>}
                                    {ev.totalPorts != null && <div><div className="text-[20px] font-black text-slate-900">{ev.totalPorts}</div><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Ports</div></div>}
                                </div>
                                {ev.networks?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {ev.networks.slice(0, 4).map((n: string, i: number) => (
                                            <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-black uppercase tracking-wide">{n}</span>
                                        ))}
                                    </div>
                                )}
                            </SectionCard>
                        );
                    })()}

                    {/* Schools */}
                    {hasSchools && (
                        <SectionCard id="ov-schools" title="Education" badge={
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[9px] font-black uppercase tracking-wide">Top Ranked</span>
                        }>
                            <div className="space-y-2">
                                {schoolsIntelligence.schools.slice(0, 4).map((school: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[13px] font-black text-blue-600">{school.rating ?? '–'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-black text-slate-700 truncate">{school.name}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                {school.distanceMiles ? `${school.distanceMiles.toFixed(1)} mi` : ''}{school.type ? ` · ${school.type}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}

                    {/* Nearby Amenities */}
                    {hasPlaces && (
                        <SectionCard id="ov-amenities" title="Nearby Amenities">
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
