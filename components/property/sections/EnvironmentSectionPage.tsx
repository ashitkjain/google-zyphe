/**
 * EnvironmentSectionPage
 * IDS redesign — inline styles, Instrument Serif + JetBrains Mono.
 * Accent: sky-blue (#0ea5e9).  All data dynamic from PropertyData.
 */
import React from 'react';
import { PropertyData } from '../../../types';
import { calculateSolarPotential } from '../../../utils/solarCalculations';
import SeasonalSunCard from '../SeasonalSunCard';
import FaultMap from './FaultMap';
import { FaultLine } from '../../../services/api/faults';

interface Props {
    data: PropertyData;
    solarPotential: ReturnType<typeof calculateSolarPotential> | null;
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const serif = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const mono  = "'JetBrains Mono', ui-monospace, monospace";

const ACCENT     = '#0ea5e9';
const ACCENT_BG  = 'rgba(14,165,233,0.10)';

// ── Risk colour palettes ──────────────────────────────────────────────────────
interface RiskPalette {
    bar: string; text: string; bg: string; border: string; label: string; topStrip: string;
}

function riskPalette(score: number, max = 10): RiskPalette {
    const p = score / max;
    if (p <= 0.3) return { bar: '#10b981', text: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Minimal Risk',  topStrip: '#10b981' };
    if (p <= 0.6) return { bar: '#f59e0b', text: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Moderate',      topStrip: '#f59e0b' };
    return             { bar: '#ef4444', text: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'High Risk',      topStrip: '#ef4444' };
}

// ── Primitives ────────────────────────────────────────────────────────────────

function SectionTitleBar({ num, kicker, title, italicWord }: {
    num: string; kicker: string; title: string; italicWord?: string;
}) {
    const parts = italicWord && title.includes(italicWord) ? title.split(italicWord) : null;
    return (
        <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: ACCENT, padding: '2px 7px', borderRadius: 4, background: ACCENT_BG, fontWeight: 700 }}>{num}</span>
                <span style={{ width: 24, height: 1, background: ACCENT, display: 'inline-block' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' }}>{kicker}</span>
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.05, margin: 0, fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                {parts
                    ? <>{parts[0]}<em style={{ color: ACCENT, fontStyle: 'italic' }}>{italicWord}</em>{parts[1]}</>
                    : title}
            </h2>
        </div>
    );
}

const MiniStatTile: React.FC<{ label: string; value: string; unit?: string; color?: string }> = ({ label, value, unit, color }) => {
    return (
        <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.13em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: serif, fontSize: 22, color: color ?? '#0f172a', fontWeight: 400, lineHeight: 1 }}>{value}</div>
            {unit && <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{unit}</div>}
        </div>
    );
};

const RiskTile: React.FC<{ icon: string; label: string; score: number }> = ({ icon, label, score }) => {
    const pal = riskPalette(score);
    const pct = Math.min(score / 10, 1);
    return (
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${pal.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 4, background: pal.topStrip }} />
            <div style={{ padding: '16px 16px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: pal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className={`fa-solid ${icon}`} style={{ fontSize: 11, color: pal.text }} />
                        </div>
                        <span style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{label}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{ fontFamily: serif, fontSize: 34, color: pal.text, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em' }}>{score}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>/10</span>
                </div>
                <div style={{ width: '100%', height: 3, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pct * 100}%`, height: '100%', background: pal.bar, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: pal.text }}>{pal.label}</span>
            </div>
        </div>
    );
};

function Pill({ label, style }: { label: string; style?: React.CSSProperties }) {
    return (
        <span style={{ padding: '2px 9px', borderRadius: 6, fontSize: 10, fontWeight: 700, border: '1px solid #e2e8f0', ...style }}>{label}</span>
    );
}

function InfoTip({ tip }: { tip: string }) {
    return (
        <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }} className="group">
            <i className="fa-solid fa-circle-info group-hover:text-indigo-400 transition-colors"
                style={{ fontSize: 10, color: '#cbd5e1', cursor: 'help' }} />
            <span style={{ pointerEvents: 'none', position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, width: 210, borderRadius: 10, background: '#1e293b', color: '#fff', fontSize: 11, fontWeight: 500, lineHeight: 1.5, padding: '6px 10px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', opacity: 0, zIndex: 50 }}
                className="group-hover:opacity-100 transition-opacity">
                {tip}
            </span>
        </span>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const EnvironmentSectionPage: React.FC<Props> = ({ data, solarPotential }) => {

    // ── Climate risk scores ───────────────────────────────────────────────────
    const windScore  = data.windRiskScore  ?? null;
    const floodScore = data.floodRiskScore ?? null;
    const fireScore  = data.fireRiskScore  ?? null;
    const heatScore  = data.heatRiskScore  ?? null;
    const riskTiles  = [
        windScore  != null && { icon: 'fa-wind',             label: 'Wind',  score: windScore  },
        floodScore != null && { icon: 'fa-water',            label: 'Flood', score: floodScore },
        fireScore  != null && { icon: 'fa-fire',             label: 'Fire',  score: fireScore  },
        heatScore  != null && { icon: 'fa-temperature-high', label: 'Heat',  score: heatScore  },
    ].filter(Boolean) as { icon: string; label: string; score: number }[];

    // ── Noise helpers ─────────────────────────────────────────────────────────
    // HowLoud SoundScore: 100 is quietest, 0 is loudest.
    const noiseScore   = data.noiseScore ?? null;
    const noiseLabel   = noiseScore == null ? null
        : noiseScore >= 85 ? 'Pristine' : noiseScore >= 70 ? 'Quiet' : noiseScore >= 50 ? 'Moderate' : 'Loud';
    const noiseColor   = noiseScore == null ? '#10b981'
        : noiseScore >= 70 ? '#10b981' : noiseScore >= 50 ? '#f59e0b' : '#ef4444';

    const noiseSubs = [
        { label: 'Traffic', score: data.noiseTrafficScore, desc: data.noiseTrafficDesc },
        { label: 'Local',   score: data.noiseLocalScore,   desc: data.noiseLocalDesc   },
        { label: 'Airport', score: data.noiseAirportScore, desc: data.noiseAirportDesc },
    ].filter(n => n.score != null) as { label: string; score: number; desc?: string }[];

    // ── Air quality helpers ───────────────────────────────────────────────────
    const aqi      = data.airQuality?.aqi ?? null;
    const aqiLabel = aqi == null ? null : aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Sensitive' : 'Unhealthy';
    const aqiColor = aqi == null ? '#10b981' : aqi <= 50 ? '#10b981' : aqi <= 100 ? '#f59e0b' : '#ef4444';

    // ── Pollen helpers ────────────────────────────────────────────────────────
    const pollenCat = data.pollen?.category ?? null;
    const pollenPct = pollenCat ? ({ High: 0.85, Moderate: 0.5, Low: 0.15, VeryHigh: 1.0 } as Record<string,number>)[pollenCat] ?? 0.2 : 0;
    const pollenColor = pollenCat === 'Low' ? '#10b981' : pollenCat === 'Moderate' ? '#f59e0b' : '#ef4444';

    // ── Hazard data ───────────────────────────────────────────────────────────
    const seismic      = data.historical_disasters?.seismicZone ?? null;
    const floodZone    = data.historical_disasters?.floodZone ?? null;
    const recentQuakes = data.historical_disasters?.earthquakes ?? [];
    const femaEvents   = data.historical_disasters?.femaDeclarations ?? [];
    const drought      = data.drought;
    const hasHazards   = !!(data.coordinates);

    const [quakesOpen, setQuakesOpen] = React.useState(false);
    const QUAKE_PREVIEW = 3;
    const visibleQuakes = quakesOpen ? recentQuakes : recentQuakes.slice(0, QUAKE_PREVIEW);

    // ── Solar ─────────────────────────────────────────────────────────────────
    const hasSolar = !!(data.solarData || data.coordinates);
    const sd       = data.solarData;

    // ── Conditional action items ──────────────────────────────────────────────
    const actions = [
        fireScore  != null && fireScore  > 5 && { icon: 'fa-fire-extinguisher', title: 'Fire Mitigation',      desc: 'Install ember-resistant vents and maintain a defensible space perimeter to reduce wildfire exposure.' },
        windScore  != null && windScore  > 5 && { icon: 'fa-house-chimney',     title: 'Roof Tie-Downs',        desc: 'Secondary water resistance and hurricane clips can reduce annual insurance premiums significantly.' },
        floodScore != null && floodScore > 5 && { icon: 'fa-droplet',           title: 'Smart Leak Sensors',    desc: 'IoT sensors in mechanical rooms can mitigate internal flooding and reduce water damage claims.' },
        heatScore  != null && heatScore  > 5 && { icon: 'fa-temperature-high',  title: 'Heat Mitigation',       desc: 'Cool roofing and improved insulation reduce cooling load during extreme heat events.' },
    ].filter(Boolean) as { icon: string; title: string; desc: string }[];

    const sn = { climate: '01', hazard: '02', solar: '03' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* ── Section 01 — Climate Risk ─────────────────────────────────── */}
            {riskTiles.length > 0 && (
                <section>
                    <SectionTitleBar num={sn.climate} kicker="First Street Foundation" title="Climate Risk Overview" italicWord="Risk" />

                    {/* 4 risk tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${riskTiles.length}, 1fr)`, gap: 14, marginBottom: 20 }}>
                        {riskTiles.map(t => <RiskTile key={t.label} icon={t.icon} label={t.label} score={t.score} />)}
                    </div>

                    {/* Noise · Air Quality · Pollen — 3 cards */}
                    {(noiseScore != null || aqi != null || pollenCat) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>

                            {/* Noise */}
                            {noiseScore != null && (
                                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <i className="fa-solid fa-volume-high" style={{ fontSize: 10, color: '#7c3aed' }} />
                                        </div>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Noise</span>
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                            <span style={{ fontFamily: serif, fontSize: 22, color: '#0f172a', fontWeight: 400, lineHeight: 1 }}>{noiseScore}</span>
                                            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>/100</span>
                                        </div>
                                    </div>
                                    <div style={{ width: '100%', height: 3, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ width: `${noiseScore}%`, height: '100%', background: noiseColor, borderRadius: 99 }} />
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: noiseColor }}>{noiseLabel}</span>
                                    {noiseSubs.length > 0 && (
                                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {noiseSubs.map((n, i) => (
                                                <div key={i}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <span style={{ fontSize: 9.5, letterSpacing: '0.13em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{n.label}</span>
                                                        {n.desc && <span style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600, textTransform: 'lowercase' }}>{n.desc}</span>}
                                                    </div>
                                                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                                        <div style={{ width: `${n.score}%`, height: '100%', background: n.score >= 70 ? '#10b981' : n.score >= 50 ? '#f59e0b' : '#7c3aed', borderRadius: 99 }} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Air Quality */}
                            {aqi != null && (
                                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(14,165,233,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <i className="fa-solid fa-wind" style={{ fontSize: 10, color: '#0ea5e9' }} />
                                        </div>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Air Quality</span>
                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                            <span style={{ fontFamily: serif, fontSize: 22, color: '#0f172a', fontWeight: 400, lineHeight: 1 }}>{aqi}</span>
                                            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>AQI</span>
                                        </div>
                                    </div>
                                    <div style={{ width: '100%', height: 3, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(aqi / 200, 1) * 100}%`, height: '100%', background: aqiColor, borderRadius: 99 }} />
                                    </div>
                                    {aqiLabel && <Pill label={aqiLabel} style={{ alignSelf: 'flex-start', background: aqi <= 50 ? '#ecfdf5' : aqi <= 100 ? '#fffbeb' : '#fef2f2', color: aqiColor, border: `1px solid ${aqi <= 50 ? '#a7f3d0' : aqi <= 100 ? '#fde68a' : '#fecaca'}` }} />}
                                    {data.airQuality?.pollutants && data.airQuality.pollutants.length > 0 && (
                                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                            {data.airQuality.pollutants.slice(0, 4).map((p: any, i: number) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: 9.5, letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{p.fullName}</span>
                                                    <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>
                                                        {p.concentration?.toFixed(1)} {p.unit?.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', marginTop: 'auto' }}>Google Air Quality API</div>
                                </div>
                            )}

                            {/* Pollen */}
                            {pollenCat && (
                                <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(101,163,13,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <i className="fa-solid fa-seedling" style={{ fontSize: 10, color: '#65a30d' }} />
                                        </div>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Pollen</span>
                                        <Pill label={pollenCat} style={{ marginLeft: 'auto', background: pollenCat === 'Low' ? '#ecfdf5' : pollenCat === 'Moderate' ? '#fffbeb' : '#fef2f2', color: pollenColor, border: `1px solid ${pollenCat === 'Low' ? '#a7f3d0' : pollenCat === 'Moderate' ? '#fde68a' : '#fecaca'}` }} />
                                    </div>
                                    <div style={{ width: '100%', height: 3, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                        <div style={{ width: `${pollenPct * 100}%`, height: '100%', background: pollenColor, borderRadius: 99 }} />
                                    </div>
                                    {data.pollen?.dominantPollenType && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Dominant</span>
                                            <Pill label={data.pollen.dominantPollenType} style={{ background: '#f7fee7', color: '#4d7c0f', border: '1px solid #d9f99d' }} />
                                        </div>
                                    )}
                                    {data.pollen?.description && (
                                        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55, margin: 0, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>{data.pollen.description}</p>
                                    )}
                                    <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', marginTop: 'auto' }}>Google Pollen API</div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* ── Section 02 — Seismic & Structural ────────────────────────── */}
            {hasHazards && (
                <section>
                    <SectionTitleBar num={sn.hazard} kicker="USGS · FEMA · Seismic" title="Nature's Hazards" italicWord="Hazards" />

                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* Seismic zone */}
                        {seismic && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <i className="fa-solid fa-house-chimney-crack" style={{ fontSize: 14, color: '#ef4444' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Earthquake Risk</span>
                                        <Pill
                                            label={`Category ${seismic.designCategory}`}
                                            style={
                                                seismic.riskLevel === 'very_high' ? { background: '#ef4444', color: '#fff', border: '1px solid #ef4444' }
                                                : seismic.riskLevel === 'high'     ? { background: '#f97316', color: '#fff', border: '1px solid #f97316' }
                                                : seismic.riskLevel === 'moderate' ? { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
                                                : { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }
                                            }
                                        />
                                    </div>

                                    {/* PGA / Ss / S1 mini tiles */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                                        {[
                                            { label: 'Peak Ground Accel.', abbr: 'PGA', value: `${seismic.pga}g`, tip: 'Peak Ground Acceleration — the maximum force (in g) the earthquake exerts on a structure. Higher values mean stronger shaking.' },
                                            { label: 'Short-Period Accel.', abbr: 'Ss',  value: `${seismic.ss}g`,  tip: 'Spectral Response at 0.2s — measures shaking force on short, stiff buildings like 1–2 story homes. Used in structural design codes (ASCE 7-22).' },
                                            { label: '1-Second Accel.',     abbr: 'S1',  value: `${seismic.s1}g`,  tip: 'Spectral Response at 1.0s — measures shaking force on taller or more flexible structures. Important for multi-story buildings and soft soils.' },
                                        ].map(({ label, abbr, value, tip }) => (
                                            <div key={abbr} style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 8px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ fontSize: 9, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
                                                    <InfoTip tip={tip} />
                                                </div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Risk label */}
                                    <span style={{ fontSize: 11, fontWeight: 700, color: seismic.riskLevel === 'very_high' ? '#dc2626' : seismic.riskLevel === 'high' ? '#ea580c' : seismic.riskLevel === 'moderate' ? '#d97706' : '#059669', textTransform: 'capitalize' }}>
                                        {seismic.riskLevel.replace('_', ' ')} seismic risk
                                    </span>

                                    {/* Reinforcement banner */}
                                    {seismic.riskLevel !== 'low' && (
                                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 10, background: '#eef2ff', borderRadius: 10, border: '1px solid #c7d2fe', padding: '10px 12px' }}>
                                            <i className="fa-solid fa-arrow-up-from-ground-water" style={{ fontSize: 10, color: '#4f46e5', marginTop: 2, flexShrink: 0 }} />
                                            <div>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#3730a3' }}>Seismic Reinforcement Recommended</div>
                                                <p style={{ fontSize: 11, color: '#4f46e5', margin: '3px 0 0', lineHeight: 1.5 }}>Category {seismic.designCategory}: Structural bolting and soft-story retrofits are strongly advised.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Fault Map & List */}
                                    {((data as any).faults?.faults || []).length > 0 ? (
                                        <div style={{ marginTop: 20 }}>
                                            <div style={{ fontSize: 9.5, letterSpacing: '0.13em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>
                                                Nearby Geological Faults
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                                                <FaultMap 
                                                    lat={data.coordinates.latitude} 
                                                    lng={data.coordinates.longitude} 
                                                    faults={(data as any).faults.faults} 
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
                                                    {((data as any).faults.faults as FaultLine[]).map((fault, i) => (
                                                        <div key={i} style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{fault.name}</div>
                                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>{fault.distanceMi} mi</div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                                <div>
                                                                    <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Slip Rate</div>
                                                                    <div style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>{fault.slipRate}</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Age</div>
                                                                    <div style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>{fault.age}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: 20, padding: '16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <i className="fa-solid fa-shield-check" style={{ color: '#10b981', fontSize: 16, marginBottom: 8, display: 'block' }} />
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>No Active Quaternary Faults</div>
                                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>No identified fault lines within a 20-mile radius.</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Recent earthquakes */}
                        {recentQuakes.length > 0 && (
                            <>
                                {seismic && <div style={{ height: 1, background: '#f1f5f9' }} />}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span style={{ fontSize: 9.5, letterSpacing: '0.13em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                            Recent Earthquakes — {data.historical_disasters?.radiusMi ?? 5}mi radius, M3.0+
                                            <span style={{ marginLeft: 6, color: '#cbd5e1' }}>({recentQuakes.length})</span>
                                        </span>
                                        {recentQuakes.length > QUAKE_PREVIEW && (
                                            <button
                                                onClick={() => setQuakesOpen(o => !o)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.14em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                            >
                                                {quakesOpen ? 'Show less' : `Show all ${recentQuakes.length}`}
                                                <i className={`fa-solid fa-chevron-${quakesOpen ? 'up' : 'down'}`} style={{ fontSize: 8 }} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {visibleQuakes.map((eq, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px' }}>
                                                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <i className="fa-solid fa-circle-radiation" style={{ fontSize: 10, color: '#f87171' }} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.title}</div>
                                                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 2, textTransform: 'lowercase' }}>
                                                        {eq.date}{eq.distanceMi != null ? ` · ${eq.distanceMi}mi away` : ''}
                                                    </div>
                                                </div>
                                                <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>{eq.severity}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {!quakesOpen && recentQuakes.length > QUAKE_PREVIEW && (
                                        <div style={{ marginTop: 8, textAlign: 'center' }}>
                                            <button
                                                onClick={() => setQuakesOpen(true)}
                                                style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                + {recentQuakes.length - QUAKE_PREVIEW} more earthquakes
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div style={{ height: 1, background: '#f1f5f9' }} />

                        {/* Hazards Grid (Flood, FEMA, Drought) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                            
                            {/* FEMA Flood Zone Box */}
                            <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: floodZone ? '#eff6ff' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa-solid fa-water" style={{ fontSize: 12, color: floodZone ? '#3b82f6' : '#94a3b8' }} />
                                    </div>
                                    <span style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>FEMA Flood</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                                        {floodZone ? `Zone ${floodZone.zone}` : 'Minimal Risk'}
                                    </div>
                                    <Pill 
                                        label={floodZone ? `${floodZone.riskLevel} risk` : 'Inland / Low'} 
                                        style={floodZone?.riskLevel === 'high' ? { background: '#fef2f2', color: '#dc2626' } : { background: '#ecfdf5', color: '#059669' }} 
                                    />
                                </div>
                                <p style={{ fontSize: 10, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                                    {floodZone?.insuranceRequired ? 'Mandatory flood insurance area.' : 'Insurance typically not required for mortgage.'}
                                </p>
                            </div>

                            {/* FEMA Disaster Declarations Box */}
                            <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: femaEvents.length > 0 ? '#fffbeb' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 12, color: femaEvents.length > 0 ? '#f59e0b' : '#94a3b8' }} />
                                    </div>
                                    <span style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>FEMA History</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                                        {femaEvents.length > 0 ? `${femaEvents.length} Recent Events` : 'No Recent Events'}
                                    </div>
                                    <Pill 
                                        label={femaEvents.length > 0 ? 'Federal Record' : 'Clean History'} 
                                        style={femaEvents.length > 0 ? { background: '#fffbeb', color: '#d97706' } : { background: '#ecfdf5', color: '#059669' }} 
                                    />
                                </div>
                                <p style={{ fontSize: 10, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                                    {femaEvents.length > 0 ? `Latest: ${femaEvents[0].title}` : 'No major disaster declarations for this county.'}
                                </p>
                            </div>

                            {/* Drought Intensity Box */}
                            <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: drought?.drought_level ? '#f0fdf4' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fa-solid fa-droplet-slash" style={{ fontSize: 12, color: drought?.drought_level ? '#16a34a' : '#94a3b8' }} />
                                    </div>
                                    <span style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Drought</span>
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                                        {drought?.drought_level?.toUpperCase() || 'NORMAL'}
                                    </div>
                                    <Pill 
                                        label={drought?.drought_level ? 'Active Monitor' : 'Stable Levels'} 
                                        style={drought?.drought_level && drought.drought_level !== 'None' ? { background: '#fffbeb', color: '#d97706' } : { background: '#ecfdf5', color: '#059669' }} 
                                    />
                                </div>
                                <p style={{ fontSize: 10, color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                                    {drought?.description || 'Current moisture levels are within normal historical ranges.'}
                                </p>
                            </div>
                        </div>

                        <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>USGS · FEMA · Drought Monitor</div>
                    </div>
                </section>
            )}

            {/* ── Resilience Actions ────────────────────────────────────────── */}
            {actions.length > 0 && (
                <section>
                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                            <div style={{ width: 4, height: 20, background: '#4f46e5', borderRadius: 99 }} />
                            <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Actions Recommended</span>
                        </div>
                        {actions.map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: i < actions.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                    <i className={`fa-solid ${a.icon}`} style={{ fontSize: 11, color: '#4f46e5' }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{a.title}</div>
                                    <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.55 }}>{a.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Section 03 — Solar & Sun Arc ──────────────────────────────── */}
            {hasSolar && (
                <section>
                    <SectionTitleBar num={sn.solar} kicker="Google Solar API" title="Solar & Sun Arc" italicWord="Sun" />

                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* Solar generation metrics */}
                        {sd && (
                            <>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.13em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <i className="fa-solid fa-solar-panel" style={{ fontSize: 9 }} />
                                    Solar Panel Generation
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                                    {[
                                        sd.maxSunshineHoursPerYear != null && {
                                            label: 'Sunshine Hours', value: Math.round(sd.maxSunshineHoursPerYear).toLocaleString(), unit: 'hrs/yr', color: '#d97706',
                                        },
                                        solarPotential?.annualKwh != null && {
                                            label: 'Annual Output', value: solarPotential.annualKwh.toLocaleString(), unit: 'kWh/yr', color: '#4f46e5',
                                        },
                                        sd.financialAnalysis?.cashPurchase?.paybackYears != null && {
                                            label: 'Payback Period', value: sd.financialAnalysis.cashPurchase.paybackYears.toFixed(1), unit: 'years', color: '#ea580c',
                                        },
                                        sd.financialAnalysis?.cashPurchase?.savings?.savingsYear20 != null && {
                                            label: '20-Yr Savings', value: `$${sd.financialAnalysis.cashPurchase.savings.savingsYear20.toLocaleString()}`, unit: '', color: '#059669',
                                        },
                                    ].filter(Boolean).map((m: any, i: number) => (
                                        <MiniStatTile key={i} label={m.label as string} value={m.value as string} unit={m.unit as string | undefined} color={m.color as string | undefined} />
                                    ))}
                                </div>

                                {/* Panel specs */}
                                {(sd.maxArrayPanelsCount != null || sd.panelCapacityWatts != null) && (
                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
                                        {[
                                            sd.maxArrayPanelsCount != null && { label: 'Max Panels',    value: `${sd.maxArrayPanelsCount}`,                  unit: 'units' },
                                            sd.panelCapacityWatts  != null && { label: 'Panel Capacity', value: `${sd.panelCapacityWatts}`,                    unit: 'W'     },
                                            sd.maxArrayAreaMeters2 != null && { label: 'Array Area',     value: `${Math.round(sd.maxArrayAreaMeters2)}`,       unit: 'm²'    },
                                            sd.financialAnalysis?.cashPurchase?.savings?.savingsYear1 != null && {
                                                label: 'Year 1 Savings', value: `$${sd.financialAnalysis.cashPurchase.savings.savingsYear1.toLocaleString()}`, unit: '',
                                            },
                                        ].filter(Boolean).map((m: any, i) => (
                                            <div key={i} style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>{m.label}</div>
                                                <div style={{ fontFamily: serif, fontSize: 20, color: '#0f172a', fontWeight: 400, lineHeight: 1 }}>
                                                    {m.value} {m.unit && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{m.unit}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>Google Solar API</div>
                            </>
                        )}

                        {/* Sun arc seasonal card */}
                        {sd && data.coordinates && <div style={{ height: 1, background: '#f1f5f9' }} />}
                        {data.coordinates && (
                            <div>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.13em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Sun Arc by Season</div>
                                <SeasonalSunCard
                                    lat={data.coordinates.latitude}
                                    lng={data.coordinates.longitude}
                                    orientation={data.orientation_ai?.final_orientation}
                                />
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 16px' }}>
                <div style={{ display: 'flex', gap: 24 }}>
                    <div>
                        <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Data Sources</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginTop: 3 }}>First Street · FEMA · USGS · Drought Monitor</div>
                    </div>
                </div>
                <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Zyphe Property Intelligence</div>
            </div>

        </div>
    );
};
