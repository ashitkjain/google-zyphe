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

    // — Section nav items (order matches rendered sections) —
    const navItems: NavItem[] = [
        { id: 'ov-property',     label: 'Property',          icon: 'fa-house',               visible: true },
        { id: 'ov-environment',  label: 'Environment',        icon: 'fa-leaf',                visible: hasEnv },
        { id: 'ov-solar',        label: 'Solar',              icon: 'fa-solar-panel',         visible: hasSolar },
        { id: 'ov-connectivity', label: 'Connectivity',       icon: 'fa-wifi',                visible: hasBroadband },
        { id: 'ov-sunpath',      label: 'Sun Path',           icon: 'fa-sun',                 visible: hasCoords },
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
                    </div>

                    {/* Environment & Resilience */}
                    {hasEnv && (
                        <SectionCard
                            id="ov-environment"
                            title="Environment & Resilience"
                            subtitle="Risk assessment and climate data"
                            badge={
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 rounded-full text-[9px] font-black text-white uppercase tracking-wider">
                                    <i className="fa-solid fa-bolt text-[7px]" /> AI Risk Scored
                                </span>
                            }
                        >
                            <div className="space-y-4">
                                {hasClimate && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { label: 'Flood Risk', score: data.floodRiskScore, icon: 'fa-water', iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
                                            { label: 'Fire Threat', score: data.fireRiskScore, icon: 'fa-fire', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
                                            { label: 'Wind Risk', score: data.windRiskScore, icon: 'fa-wind', iconBg: 'bg-cyan-50', iconColor: 'text-cyan-500' },
                                            { label: 'Heat Stress', score: data.heatRiskScore, icon: 'fa-temperature-high', iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
                                        ].filter(r => r.score != null).map(r => {
                                            const rl = riskLevel(r.score);
                                            return (
                                                <div key={r.label} className="bg-slate-50 rounded-xl border border-slate-100 p-3 flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-6 h-6 rounded-md ${r.iconBg} flex items-center justify-center flex-shrink-0`}>
                                                            <i className={`fa-solid ${r.icon} ${r.iconColor} text-[10px]`} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{r.label}</span>
                                                    </div>
                                                    <div className={`text-[16px] font-black tracking-tight leading-none ${rl.color}`}>{rl.label}</div>
                                                    <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${riskBarColor(r.score)}`} style={{ width: `${Math.min(100, (r.score! / 10) * 100)}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {(data.airQuality || hasNoise) && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {data.airQuality && (
                                            <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center">
                                                        <i className="fa-solid fa-leaf text-emerald-500 text-[10px]" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Air Quality</span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className={`text-[20px] font-black tracking-tight leading-none ${getAQIColor(data.airQuality.aqi)}`}>{data.airQuality.aqi}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">AQI</span>
                                                </div>
                                                <div className={`text-[11px] font-black mt-0.5 ${getAQIColor(data.airQuality.aqi)}`}>{getAQILabel(data.airQuality.aqi)}</div>
                                            </div>
                                        )}
                                        {hasNoise && (
                                            <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center">
                                                        <i className="fa-solid fa-volume-xmark text-purple-500 text-[10px]" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Noise Level</span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className={`text-[20px] font-black tracking-tight leading-none ${data.noiseScore! >= 80 ? 'text-emerald-600' : data.noiseScore! >= 65 ? 'text-amber-600' : 'text-orange-600'}`}>{data.noiseScore}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">/100</span>
                                                </div>
                                                <div className="text-[11px] font-black text-slate-500 mt-0.5">{data.noiseScoreDesc ?? ''}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {data.drought && (data.drought.drought_level !== 'none' || data.seismicHazardZone) && (
                                    <div className="bg-slate-800 rounded-xl p-3 space-y-1.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Hazard Zones</div>
                                        {data.seismicHazardZone && (
                                            <div className="flex items-center justify-between text-[12px]">
                                                <span className="text-slate-300 font-medium">Seismic Activity</span>
                                                <span className="font-black text-white">{data.seismicHazardZone}</span>
                                            </div>
                                        )}
                                        {data.drought && (
                                            <div className="flex items-center justify-between text-[12px]">
                                                <span className="text-slate-300 font-medium">Drought Vulnerability</span>
                                                <span className={`font-black ${data.drought.drought_level === 'none' ? 'text-emerald-400' : data.drought.drought_level === 'moderate' ? 'text-amber-400' : 'text-red-400'}`}>
                                                    {data.drought.drought_level ? data.drought.drought_level.charAt(0).toUpperCase() + data.drought.drought_level.slice(1) : 'N/A'}
                                                </span>
                                            </div>
                                        )}
                                        {hasNoise && (
                                            <div className="flex items-center justify-between text-[12px]">
                                                <span className="text-slate-300 font-medium">Noise Pollution</span>
                                                <span className="font-black text-white">{data.noiseScore}/100</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    )}

                    {/* Solar Potential */}
                    {hasSolar && (
                        <SectionCard id="ov-solar" title="Solar Potential" subtitle="Efficiency metrics">
                            <div className="grid grid-cols-3 gap-2">
                                <MetricTile icon="fa-sun" iconBg="bg-yellow-50" iconColor="text-yellow-500" label="Sunshine" value={`${Math.round((solar!.maxSunshineHoursPerYear || 0) / 100) / 10}K`} sublabel="hrs / yr" valueColor="text-yellow-600" />
                                {solarPotential && <MetricTile icon="fa-bolt" iconBg="bg-indigo-50" iconColor="text-indigo-500" label="Production" value={`${Math.round(solarPotential.annualKwh / 100) / 10}K`} sublabel="kWh / yr" valueColor="text-indigo-600" />}
                                {solar?.financialAnalysis?.cashPurchase?.paybackYears != null && <MetricTile icon="fa-clock-rotate-left" iconBg="bg-amber-50" iconColor="text-amber-500" label="Payback" value={`${Number(solar.financialAnalysis.cashPurchase.paybackYears).toFixed(1)}`} sublabel="years" valueColor="text-amber-600" />}
                                {solar?.financialAnalysis?.cashPurchase?.savings?.savingsYear20 != null && <MetricTile icon="fa-chart-line" iconBg="bg-emerald-50" iconColor="text-emerald-500" label="20-Yr Savings" value={`$${Math.round(solar!.financialAnalysis!.cashPurchase!.savings!.savingsYear20 / 1000)}K`} valueColor="text-emerald-600" />}
                                {solarBench && <MetricTile icon="fa-map-location-dot" iconBg="bg-slate-100" iconColor="text-slate-500" label={`vs ${solarBench.benchmarkCity}`} value={`${solarBench.sunshinePctOfAvg}%`} sublabel={solarBench.sunshinePctOfAvg >= 100 ? 'Sun-Drenched' : 'Below Avg'} valueColor={solarBench.sunshinePctOfAvg >= 100 ? 'text-emerald-600' : 'text-amber-600'} />}
                            </div>
                        </SectionCard>
                    )}

                    {/* Connectivity */}
                    {hasBroadband && (
                        <SectionCard id="ov-connectivity" title="Connectivity">
                            <div className="space-y-2">
                                {data.broadband!.internetProviders.slice(0, 3).map((p, i) => {
                                    const techColors: Record<string, string> = { Fiber: 'bg-emerald-100 text-emerald-700', Cable: 'bg-blue-100 text-blue-700' };
                                    const color = techColors[p.technology] || 'bg-slate-100 text-slate-600';
                                    const speedLabel = p.maxDownloadMbps >= 1000 ? `${(p.maxDownloadMbps / 1000).toFixed(1)} Gbps` : `${p.maxDownloadMbps} Mbps`;
                                    const speedTag = p.maxDownloadMbps >= 1000 ? 'ULTRAFAST' : p.maxDownloadMbps >= 500 ? 'FAST' : 'STANDARD';
                                    return (
                                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                <i className={`fa-solid ${p.technology === 'Fiber' ? 'fa-bolt' : 'fa-ethernet'} text-blue-500 text-[11px]`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[12px] font-black text-slate-700 truncate">{p.name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">{p.technology}</div>
                                            </div>
                                            <div className="flex flex-col items-end flex-shrink-0">
                                                <span className="text-[14px] font-black text-slate-900">{speedLabel}</span>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${color}`}>{speedTag}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {data.broadband!.cellCoverage.length > 0 && (
                                    <div className="flex gap-2 pt-1">
                                        {Array.from(new Set(data.broadband!.cellCoverage.map(c => c.network))).slice(0, 4).map((carrier, i) => {
                                            const best = data.broadband!.cellCoverage.filter(c => c.network === carrier).sort((a, b) => (b.rsrpDbm || 0) - (a.rsrpDbm || 0))[0];
                                            const isGood = best?.signalLevel === 'Good';
                                            return (
                                                <div key={i} className="flex-1 p-2 bg-slate-50 rounded-lg border border-slate-100 text-center">
                                                    <div className={`text-[10px] font-black ${isGood ? 'text-emerald-600' : 'text-amber-600'}`}>{carrier}</div>
                                                    <div className={`text-[9px] font-medium ${isGood ? 'text-emerald-500' : 'text-amber-500'}`}>{best?.signalLevel || 'Fair'}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </SectionCard>
                    )}

                    {/* Sun Path */}
                    {hasCoords && (
                        <SectionCard id="ov-sunpath" title="Sun Path Analysis" subtitle="Seasonal shadow projections and daylight saturation">
                            <SeasonalSunCard lat={data.coordinates!.latitude} lng={data.coordinates!.longitude} orientation={(data as any).orientation_ai?.final_orientation} />
                            {micro && (
                                <div className="mt-3 px-3 py-2 bg-blue-50/60 rounded-lg border border-blue-100">
                                    <p className="text-[11px] text-blue-700 leading-relaxed italic">
                                        <i className="fa-solid fa-temperature-half mr-1" />
                                        &ldquo;{micro.insight}&rdquo;
                                    </p>
                                    <div className="text-[8px] text-blue-400 mt-0.5 text-right">Tomorrow.io · {new Date(micro.fetchedAt).toLocaleTimeString()}</div>
                                </div>
                            )}
                        </SectionCard>
                    )}
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="xl:w-[300px] flex-shrink-0 flex flex-col gap-4">

                    {/* Market Estimate */}
                    <div id="ov-market" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24">
                        <div className="p-4 space-y-3">
                            {price && (
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Market Estimate</div>
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
