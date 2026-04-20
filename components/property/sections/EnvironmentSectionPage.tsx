/**
 * EnvironmentSectionPage
 *
 * Stitch-inspired redesign of the Environment section.
 * Covers: Resilience · Hazards · Noise & Air · Pollen · Solar
 *
 * Type scale (consistent throughout):
 *   text-[10px] font-black uppercase tracking-widest  → labels / captions
 *   text-[13px] font-medium                           → body text
 *   text-[14px] font-black                            → item titles / sub-labels
 *   text-[16px] font-black                            → card headings
 *   text-[24px] font-black                            → metric numbers
 *   text-[36px] font-black                            → hero number
 */
import React from 'react';
import { PropertyData } from '../../../types';
import { calculateSolarPotential } from '../../../utils/solarCalculations';
import SeasonalSunCard from '../SeasonalSunCard';

interface Props {
    data: PropertyData;
    solarPotential: ReturnType<typeof calculateSolarPotential> | null;
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
}

// ─── Type Scale Constants ────────────────────────────────────────────────────
const T = {
    label:  'text-[10px] font-black text-slate-400 uppercase tracking-widest',
    body:   'text-[13px] font-medium text-slate-500 leading-relaxed',
    title:  'text-[14px] font-black text-slate-800',
    cardH:  'text-[16px] font-black text-slate-900 tracking-tight',
    metric: 'text-[24px] font-black text-slate-900 leading-none tracking-tight',
    hero:   'text-[36px] font-black text-slate-900 leading-none tracking-tight',
    attr:   'text-[10px] font-bold text-slate-300 uppercase tracking-widest',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const riskOf = (score: number, max = 10) => {
    const p = score / max;
    if (p <= 0.3) return { label: 'Minimal Risk',     color: 'text-emerald-600', pill: 'bg-emerald-50 text-emerald-700 border-emerald-100', bar: 'bg-emerald-400' };
    if (p <= 0.6) return { label: 'Moderate',         color: 'text-amber-600',   pill: 'bg-amber-50 text-amber-700 border-amber-100',      bar: 'bg-amber-400' };
    return              { label: 'High Risk',          color: 'text-rose-600',    pill: 'bg-rose-50 text-rose-700 border-rose-100',         bar: 'bg-rose-500' };
};

const aqiOf = (aqi: number) => {
    if (aqi <= 50)  return { label: 'Good',         pill: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    if (aqi <= 100) return { label: 'Moderate',     pill: 'bg-amber-50 text-amber-700 border-amber-100' };
    if (aqi <= 150) return { label: 'Sensitive',    pill: 'bg-orange-50 text-orange-700 border-orange-100' };
    return                 { label: 'Unhealthy',    pill: 'bg-rose-50 text-rose-700 border-rose-100' };
};

const Bar: React.FC<{ pct: number; color: string }> = ({ pct, color }) => (
    <div className="w-full h-[3px] bg-slate-100 rounded-full overflow-hidden mt-2">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(Math.max(pct * 100, 0), 100)}%` }} />
    </div>
);

const Pill: React.FC<{ label: string; cls: string }> = ({ label, cls }) => (
    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${cls}`}>{label}</span>
);

const Divider = () => <div className="h-px bg-slate-100" />;

// ─── Sub-components ──────────────────────────────────────────────────────────

const MetricCard: React.FC<{
    icon: string; label: string; value: string; unit?: string;
    score: number; max?: number;
}> = ({ icon, label, value, unit, score, max = 10 }) => {
    const risk = riskOf(score, max);
    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col gap-3
                        hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
                <span className={T.label}>{label}</span>
                <i className={`fa-solid ${icon} text-slate-300 text-[11px]`} />
            </div>
            <div className="flex items-baseline gap-1.5">
                <span className={T.metric}>{value}</span>
                {unit && <span className={T.label}>{unit}</span>}
            </div>
            <Bar pct={score / max} color={risk.bar} />
            <span className={`text-[11px] font-black ${risk.color}`}>{risk.label}</span>
        </div>
    );
};

const ActionItem: React.FC<{ icon: string; title: string; desc: string }> = ({ icon, title, desc }) => (
    <div className="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className={`fa-solid ${icon} text-indigo-500 text-[11px]`} />
        </div>
        <div>
            <div className={`${T.title} mb-0.5`}>{title}</div>
            <p className={T.body}>{desc}</p>
        </div>
    </div>
);

/** Inline hover tooltip — no JS state needed */
const InfoTip: React.FC<{ tip: string }> = ({ tip }) => (
    <span className="relative inline-flex items-center group ml-1 align-middle">
        <i className="fa-solid fa-circle-info text-slate-300 text-[10px] cursor-help group-hover:text-indigo-400 transition-colors" />
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-xl bg-slate-800 text-white text-[11px] font-medium leading-relaxed px-3 py-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
            {tip}
        </span>
    </span>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export const EnvironmentSectionPage: React.FC<Props> = ({ data, solarPotential }) => {

    // ── Risk scores (First Street Foundation) ────────────────────────────────
    const windScore  = data.windRiskScore  ?? null;
    const floodScore = data.floodRiskScore ?? null;
    const fireScore  = data.fireRiskScore  ?? null;
    const heatScore  = data.heatRiskScore  ?? null;
    const available  = [windScore, floodScore, fireScore, heatScore].filter((s): s is number => s != null);

    // ── Historical disasters ──────────────────────────────────────────────────
    const seismic      = data.historical_disasters?.seismicZone ?? null;
    const floodZoneData = data.historical_disasters?.floodZone  ?? null;
    const recentQuakes = data.historical_disasters?.earthquakes ?? [];
    const femaEvents   = data.historical_disasters?.femaDeclarations?.slice(0, 3)   ?? [];
    const hasHazards   = !!data.historical_disasters || !!data.drought?.drought_level;

    // ── Actions ───────────────────────────────────────────────────────────────
    const actions = [
        fireScore  != null && fireScore  > 5 && { icon: 'fa-fire-extinguisher', title: 'Fire Mitigation',  desc: 'Install ember-resistant vents and maintain a defensible space perimeter to reduce wildfire exposure.' },
        windScore  != null && windScore  > 5 && { icon: 'fa-house-chimney',     title: 'Roof Tie-Downs',   desc: 'Secondary water resistance and hurricane clips could reduce annual insurance premiums significantly.' },
        floodScore != null && floodScore > 5 && { icon: 'fa-droplet',           title: 'Smart Leak Sensors', desc: 'IoT sensors in mechanical rooms can mitigate internal flooding and reduce water damage claims.' },
        heatScore  != null && heatScore  > 5 && { icon: 'fa-temperature-high',  title: 'Heat Mitigation',  desc: 'Consider cool roofing and improved insulation to reduce cooling load during extreme heat events.' },
    ].filter(Boolean) as { icon: string; title: string; desc: string }[];

    // ── Collapse state ────────────────────────────────────────────────────────
    const [quakesExpanded, setQuakesExpanded] = React.useState(false);
    const QUAKE_PREVIEW = 3;
    const visibleQuakes = quakesExpanded ? recentQuakes : recentQuakes.slice(0, QUAKE_PREVIEW);

    return (
        <div className="min-h-screen" style={{ background: '#f1f1f8' }}>
            <div className="max-w-5xl mx-auto py-8 px-4 space-y-5">

                {/* ── Hero ───────────────────────────────────────────────── */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-8 shadow-sm">
                    <div className="flex items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                            <div className={`${T.label} mb-2`}>Environmental Analysis</div>
                            <h1 className={`${T.hero} mb-3`}>
                                Environmental<br />
                                <span className="text-indigo-600">Overview</span>
                            </h1>
                            <p className={T.body}>
                                Comprehensive hazard analysis for{' '}
                                <strong className="text-slate-700 font-black">{data.address || 'this property'}</strong>.
                                {' '}Covering climate risk, seismic zones, air quality, and solar potential.
                            </p>
                        </div>
                        {data.annualHomeownersInsurance && (
                            <div className="shrink-0 bg-slate-50 rounded-2xl border border-slate-200 px-5 py-4 text-right">
                                <div className={T.label}>Est. Annual Insurance</div>
                                <div className={`${T.metric} mt-1`}>${data.annualHomeownersInsurance.toLocaleString()}</div>
                                <div className={`${T.label} mt-0.5`}>per year</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── 4 Climate Risk Cards ────────────────────────────────── */}
                {available.length > 0 && (
                    <div className={`grid grid-cols-2 gap-4 ${available.length >= 4 ? 'lg:grid-cols-4' : available.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                        {windScore  != null && <MetricCard icon="fa-wind"             label="Wind"  value={`${windScore}`}  unit="/ 10" score={windScore} />}
                        {floodScore != null && <MetricCard icon="fa-water"            label="Flood" value={floodZoneData ? `Zone ${floodZoneData.zone}` : `${floodScore}`} unit={floodZoneData ? '' : '/ 10'} score={floodScore} />}
                        {fireScore  != null && <MetricCard icon="fa-fire"             label="Fire"  value={`${fireScore}`}  unit="/ 10" score={fireScore} />}
                        {heatScore  != null && <MetricCard icon="fa-temperature-high" label="Heat"  value={`${heatScore}`}  unit="/ 10" score={heatScore} />}
                    </div>
                )}

                {/* ── Noise · Air Quality · Pollen — 3-column card row ────── */}
                {(data.noiseScore != null || data.airQuality?.aqi != null || data.pollen?.category) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        {/* Noise */}
                        {data.noiseScore != null && (
                            <div className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-volume-high text-violet-500 text-[11px]" />
                                    </div>
                                    <span className={T.cardH}>Noise</span>
                                    <span className={`${T.title} ml-auto text-slate-900`}>
                                        {data.noiseScore}<span className={`${T.label} ml-0.5`}>/100</span>
                                    </span>
                                </div>
                                <Bar pct={data.noiseScore / 100}
                                    color={data.noiseScore < 40 ? 'bg-emerald-400' : data.noiseScore < 65 ? 'bg-amber-400' : 'bg-rose-500'} />
                                <span className={`text-[11px] font-black ${data.noiseScore < 40 ? 'text-emerald-600' : data.noiseScore < 65 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {data.noiseScore < 40 ? 'Quiet' : data.noiseScore < 65 ? 'Moderate' : 'Loud'}
                                </span>
                                {(data.noiseTrafficScore != null || data.noiseLocalScore != null || data.noiseAirportScore != null) && (
                                    <div className="space-y-2 pt-1 border-t border-slate-100">
                                        {[
                                            { label: 'Traffic', score: data.noiseTrafficScore, desc: data.noiseTrafficDesc },
                                            { label: 'Local',   score: data.noiseLocalScore,   desc: data.noiseLocalDesc },
                                            { label: 'Airport', score: data.noiseAirportScore, desc: data.noiseAirportDesc },
                                        ].filter(n => n.score != null).map((n, i) => (
                                            <div key={i}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={T.label}>{n.label}</span>
                                                    {n.desc && <span className={`${T.label} lowercase`}>{n.desc}</span>}
                                                </div>
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-violet-400 rounded-full" style={{ width: `${n.score}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Air Quality */}
                        {data.airQuality?.aqi != null && (
                            <div className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-wind text-sky-500 text-[11px]" />
                                    </div>
                                    <span className={T.cardH}>Air Quality</span>
                                    <span className={`${T.title} ml-auto text-slate-900`}>
                                        {data.airQuality.aqi}<span className={`${T.label} ml-0.5`}>AQI</span>
                                    </span>
                                </div>
                                <Bar pct={data.airQuality.aqi / 200}
                                    color={data.airQuality.aqi < 50 ? 'bg-emerald-400' : data.airQuality.aqi < 100 ? 'bg-amber-400' : 'bg-rose-500'} />
                                <Pill label={aqiOf(data.airQuality.aqi).label} cls={aqiOf(data.airQuality.aqi).pill} />
                                {data.airQuality.pollutants && data.airQuality.pollutants.length > 0 && (
                                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                                        {data.airQuality.pollutants.slice(0, 4).map((p: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span className={`${T.label} truncate`}>{p.fullName}</span>
                                                <span className={`${T.label} shrink-0 ml-2 text-slate-600`}>
                                                    {p.concentration?.toFixed(1)} {p.unit?.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className={`${T.attr} text-right mt-auto`}>Google Air Quality API</div>
                            </div>
                        )}

                        {/* Pollen */}
                        {data.pollen?.category && (
                            <div className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-lime-50 flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-seedling text-lime-500 text-[11px]" />
                                    </div>
                                    <span className={T.cardH}>Pollen</span>
                                    <span className={`${T.title} ml-auto text-slate-900`}>{data.pollen.category}</span>
                                </div>
                                <Bar
                                    pct={({ High: 0.85, Moderate: 0.5, Low: 0.15, VeryHigh: 1.0 } as any)[data.pollen.category] ?? 0.15}
                                    color={data.pollen.category === 'Low' ? 'bg-emerald-400' : data.pollen.category === 'Moderate' ? 'bg-amber-400' : 'bg-rose-500'}
                                />
                                {data.pollen.dominantPollenType && (
                                    <div className="flex items-center gap-2">
                                        <span className={T.label}>Dominant</span>
                                        <Pill label={data.pollen.dominantPollenType} cls="bg-lime-50 text-lime-700 border-lime-100" />
                                    </div>
                                )}
                                {data.pollen.description && (
                                    <p className={`${T.body} pt-1 border-t border-slate-100`}>{data.pollen.description}</p>
                                )}
                                <div className={`${T.attr} text-right mt-auto`}>Google Pollen API</div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Hazard Zones ───────────────────────────────────────── */}
                {hasHazards && (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm space-y-5">
                        <h2 className={T.cardH}>Hazard Zones</h2>

                        {/* Seismic */}
                        {seismic && (
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-house-chimney-crack text-rose-500 text-[14px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                                        <span className={T.title}>Seismic Design Zone</span>
                                        <Pill label={`Category ${seismic.designCategory}`} cls={
                                            seismic.riskLevel === 'very_high' ? 'bg-rose-500 text-white border-rose-500'
                                            : seismic.riskLevel === 'high'    ? 'bg-orange-500 text-white border-orange-500'
                                            : seismic.riskLevel === 'moderate'? 'bg-amber-50 text-amber-700 border-amber-100'
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        } />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        {[
                                            {
                                                label: 'Peak Ground Accel.',
                                                abbr: 'PGA',
                                                value: `${seismic.pga}g`,
                                                tip: 'Peak Ground Acceleration — the maximum force (in g) the earthquake exerts on a structure. Higher values mean stronger shaking.',
                                            },
                                            {
                                                label: 'Short-Period Accel.',
                                                abbr: 'Ss',
                                                value: `${seismic.ss}g`,
                                                tip: 'Spectral Response at 0.2s — measures shaking force on short, stiff buildings like 1–2 story homes. Used in structural engineering design codes (ASCE 7-22).',
                                            },
                                            {
                                                label: '1-Second Accel.',
                                                abbr: 'S1',
                                                value: `${seismic.s1}g`,
                                                tip: 'Spectral Response at 1.0s — measures shaking force on taller or more flexible structures. Important for multi-story buildings and soft soils.',
                                            },
                                        ].map(({ label, abbr, value, tip }) => (
                                            <div key={abbr} className="bg-slate-50 rounded-xl border border-slate-100 p-2.5 text-center">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <span className={T.label}>{label}</span>
                                                    <InfoTip tip={tip} />
                                                </div>
                                                <div className={`${T.title} text-center mt-0.5`}>{value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <span className={`text-[11px] font-black capitalize ${riskOf(seismic.riskLevel === 'very_high' ? 8 : seismic.riskLevel === 'high' ? 6 : seismic.riskLevel === 'moderate' ? 4 : 2).color}`}>
                                        {seismic.riskLevel.replace('_', ' ')} seismic risk
                                    </span>
                                    {seismic.riskLevel !== 'low' && (
                                        <div className="mt-3 flex items-start gap-3 bg-indigo-50 rounded-xl border border-indigo-100 px-3 py-2.5">
                                            <i className="fa-solid fa-arrow-up-from-ground-water text-indigo-500 text-[11px] mt-0.5" />
                                            <div>
                                                <div className={`${T.title} text-indigo-800`}>Seismic Reinforcement Recommended</div>
                                                <p className={`${T.body} text-indigo-600 mt-0.5`}>Category {seismic.designCategory}: Structural bolting and soft-story retrofits are strongly advised.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Flood Zone */}
                        {floodZoneData && (
                            <>
                                {seismic && <Divider />}
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-water text-blue-500 text-[14px]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                            <span className={T.title}>Flood Zone</span>
                                            <Pill label={`Zone ${floodZoneData.zone}`} cls={
                                                floodZoneData.riskLevel === 'high'     ? 'bg-rose-500 text-white border-rose-500'
                                                : floodZoneData.riskLevel === 'moderate'? 'bg-amber-50 text-amber-700 border-amber-100'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                            } />
                                            {floodZoneData.insuranceRequired && (
                                                <Pill label="Insurance Required" cls="bg-rose-50 text-rose-700 border-rose-100" />
                                            )}
                                        </div>
                                        <p className={T.body + ' capitalize'}>{floodZoneData.riskLevel} flood risk</p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Recent Earthquakes */}
                        {recentQuakes.length > 0 && (
                            <>
                                <Divider />
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={T.label}>
                                            Recent Earthquakes — {data.historical_disasters?.radiusMi ?? 5}mi radius, M3.0+
                                            <span className="ml-1.5 text-slate-300">({recentQuakes.length})</span>
                                        </div>
                                        {recentQuakes.length > QUAKE_PREVIEW && (
                                            <button
                                                onClick={() => setQuakesExpanded(e => !e)}
                                                className="flex items-center gap-1.5 text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                                            >
                                                {quakesExpanded ? 'Show less' : `Show all ${recentQuakes.length}`}
                                                <i className={`fa-solid fa-chevron-${quakesExpanded ? 'up' : 'down'} text-[8px]`} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {visibleQuakes.map((eq, i) => (
                                            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                                                    <i className="fa-solid fa-circle-radiation text-rose-400 text-[10px]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`${T.title} truncate`}>{eq.title}</div>
                                                    <div className={T.label + ' mt-0.5 lowercase'}>
                                                        {eq.date}{eq.distanceMi != null ? ` · ${eq.distanceMi}mi away` : ''}
                                                    </div>
                                                </div>
                                                <span className="text-[13px] font-black text-rose-600 shrink-0">{eq.severity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {!quakesExpanded && recentQuakes.length > QUAKE_PREVIEW && (
                                        <div className="mt-2 text-center">
                                            <button
                                                onClick={() => setQuakesExpanded(true)}
                                                className="text-[11px] font-black text-slate-400 hover:text-indigo-500 transition-colors"
                                            >
                                                + {recentQuakes.length - QUAKE_PREVIEW} more earthquakes
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* FEMA Declarations */}
                        {femaEvents.length > 0 && (
                            <>
                                <Divider />
                                <div>
                                    <div className={`${T.label} mb-3`}>FEMA Disaster Declarations</div>
                                    <div className="space-y-2">
                                        {femaEvents.map((ev, i) => (
                                            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                                                    <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[10px]" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`${T.title} truncate`}>{ev.title}</div>
                                                    <div className={T.label + ' mt-0.5 lowercase'}>{ev.date} · {ev.description}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Drought */}
                        {data.drought?.drought_level && (
                            <>
                                <Divider />
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-droplet-slash text-emerald-500 text-[14px]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                            <span className={T.title}>Drought Intensity</span>
                                            <Pill label={data.drought.drought_level.toUpperCase()} cls={
                                                data.drought.drought_level.toLowerCase() === 'none'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                                            } />
                                        </div>
                                        {data.drought.description && <p className={T.body}>{data.drought.description}</p>}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className={`${T.attr} text-right`}>USGS · FEMA · Drought Monitor</div>
                    </div>
                )}

                {/* ── Actions ─────────────────────────────────────────────── */}
                {actions.length > 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-5 bg-indigo-500 rounded-full" />
                            <h2 className={T.cardH}>Action Recommended</h2>
                        </div>
                        {actions.slice(0, 3).map((a, i) => <ActionItem key={i} {...a} />)}
                    </div>
                )}

                {/* ── Solar ───────────────────────────────────────────────── */}
                {(!!data.solarData || !!data.coordinates) && (
                    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                <i className="fa-solid fa-sun text-amber-500 text-[13px]" />
                            </div>
                            <h2 className={T.cardH}>Solar &amp; Sun Arc</h2>
                            {solarPotential && (
                                <Pill label="High Potential" cls="ml-auto bg-emerald-50 text-emerald-700 border-emerald-100" />
                            )}
                        </div>
                        {/* ── Solar Panel Generation metrics — shown first ── */}
                        {!!data.solarData && (
                            <>
                                <div className={`${T.label} mb-3`}>
                                    <i className="fa-solid fa-solar-panel mr-1.5" />
                                    Solar Panel Generation
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {[
                                        data.solarData?.maxSunshineHoursPerYear != null && {
                                            label: 'Sunshine Hours',
                                            value: Math.round(data.solarData.maxSunshineHoursPerYear).toLocaleString(),
                                            unit: 'hrs/yr', color: 'text-amber-500',
                                        },
                                        solarPotential?.annualKwh != null && {
                                            label: 'Annual Output',
                                            value: solarPotential.annualKwh.toLocaleString(),
                                            unit: 'kWh/yr', color: 'text-indigo-600',
                                        },
                                        data.solarData?.financialAnalysis?.cashPurchase?.paybackYears != null && {
                                            label: 'Payback Period',
                                            value: data.solarData.financialAnalysis.cashPurchase.paybackYears.toFixed(1),
                                            unit: 'years', color: 'text-orange-500',
                                        },
                                        data.solarData?.financialAnalysis?.cashPurchase?.savings?.savingsYear20 != null && {
                                            label: '20-Yr Savings',
                                            value: `$${data.solarData.financialAnalysis.cashPurchase.savings.savingsYear20.toLocaleString()}`,
                                            unit: '', color: 'text-emerald-600',
                                        },
                                    ].filter(Boolean).map((m: any, i) => (
                                        <div key={i} className="bg-slate-50 rounded-2xl border border-slate-100 p-4 text-center">
                                            <div className={`${T.label} mb-1.5`}>{m.label}</div>
                                            <div className={`text-[22px] font-black ${m.color} leading-none`}>{m.value}</div>
                                            {m.unit && <div className={`${T.label} mt-0.5`}>{m.unit}</div>}
                                        </div>
                                    ))}
                                </div>

                                {/* Panel specs */}
                                {(data.solarData?.maxArrayPanelsCount != null || data.solarData?.panelCapacityWatts != null) && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {[
                                            data.solarData?.maxArrayPanelsCount != null && { label: 'Max Panels',     value: `${data.solarData.maxArrayPanelsCount}`, unit: 'units' },
                                            data.solarData?.panelCapacityWatts   != null && { label: 'Panel Capacity', value: `${data.solarData.panelCapacityWatts}`,   unit: 'W' },
                                            data.solarData?.maxArrayAreaMeters2  != null && { label: 'Array Area',     value: `${Math.round(data.solarData.maxArrayAreaMeters2)}`, unit: 'm²' },
                                            data.solarData?.financialAnalysis?.cashPurchase?.savings?.savingsYear1 != null && {
                                                label: 'Year 1 Savings',
                                                value: `$${data.solarData.financialAnalysis.cashPurchase.savings.savingsYear1.toLocaleString()}`,
                                                unit: '',
                                            },
                                        ].filter(Boolean).map((m: any, i) => (
                                            <div key={i} className="text-center">
                                                <div className={`${T.label} mb-1`}>{m.label}</div>
                                                <div className={T.metric}>{m.value} <span className={T.label}>{m.unit}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className={`${T.attr} text-right mt-3`}>Google Solar API</div>
                            </>
                        )}

                        {/* ── Divider between solar metrics and sun arc ── */}
                        {!!data.solarData && !!data.coordinates && <Divider />}

                        {/* ── Sun Arc by Season ── */}
                        {data.coordinates && (
                            <div className={!!data.solarData ? 'pt-1' : ''}>
                                <div className={`${T.label} mb-3`}>Sun Arc by Season</div>
                                <SeasonalSunCard
                                    lat={data.coordinates.latitude}
                                    lng={data.coordinates.longitude}
                                    orientation={data.orientation_ai?.final_orientation}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* ── Footer ──────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-1 pb-4">
                    <div className="flex gap-6">
                        <div>
                            <div className={T.label}>Data Sources</div>
                            <div className="text-[12px] font-bold text-slate-600 mt-0.5">First Street · FEMA · USGS · Drought Monitor</div>
                        </div>
                        <div>
                            <div className={T.label}>Confidence</div>
                            <div className="text-[12px] font-black text-emerald-600 mt-0.5">Verified</div>
                        </div>
                    </div>
                    <div className={T.attr}>Zyphe Property Intelligence</div>
                </div>

            </div>
        </div>
    );
};
