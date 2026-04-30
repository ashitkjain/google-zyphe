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
import { MicroclimateDelta } from '../../../services/api/environmental';

interface Props {
    data: PropertyData;
    solarPotential: ReturnType<typeof calculateSolarPotential> | null;
    micro?: MicroclimateDelta | null;
    onRefreshEnvironment?: () => void;
    environmentRefreshing?: boolean;
    isHealingFema?: boolean;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const serif = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

const ACCENT = '#0ea5e9';
const ACCENT_BG = 'rgba(14,165,233,0.10)';

// ── Risk colour palettes ──────────────────────────────────────────────────────
interface RiskPalette {
    bar: string; text: string; bg: string; border: string; label: string; topStrip: string;
}

function riskPalette(score: number, rating?: string, max = 100): RiskPalette {
    if (rating) {
        const r = rating.toLowerCase();
        if (r.includes('very high')) return { bar: '#ef4444', text: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Very High', topStrip: '#ef4444' };
        if (r.includes('relatively high')) return { bar: '#f97316', text: '#ea580c', bg: '#fff7ed', border: '#ffedd5', label: 'Relatively High', topStrip: '#f97316' };
        if (r.includes('moderate')) return { bar: '#f59e0b', text: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Moderate', topStrip: '#f59e0b' };
        if (r.includes('relatively low')) return { bar: '#10b981', text: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Relatively Low', topStrip: '#10b981' };
        if (r.includes('very low')) return { bar: '#22c55e', text: '#16a34a', bg: '#f0fdf4', border: '#dcfce7', label: 'Very Low', topStrip: '#22c55e' };
        if (r.includes('no rating')) return { bar: '#94a3b8', text: '#64748b', bg: '#f8fafc', border: '#e2e8f0', label: 'No Rating', topStrip: '#94a3b8' };
    }
    const p = score / max;
    if (p <= 0.3) return { bar: '#10b981', text: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Minimal Risk', topStrip: '#10b981' };
    if (p <= 0.6) return { bar: '#f59e0b', text: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Moderate', topStrip: '#f59e0b' };
    return { bar: '#ef4444', text: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'High Risk', topStrip: '#ef4444' };
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

const RiskTile: React.FC<{ icon: string; label: string; score?: number; rating?: string; isLegacyNRI?: boolean; isFallback?: boolean }> = ({ icon, label, score = 0, rating, isLegacyNRI, isFallback }) => {
    // It's NRI if it's NOT a fallback, OR if it has a rating/legacy flag/high score
    const isNRI = !isFallback || !!rating || isLegacyNRI || score > 10.1;
    const pal = riskPalette(score, rating, isNRI ? 100 : 10);
    const pct = Math.min(score / (isNRI ? 100 : 10), 1);
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
                    <span style={{ fontFamily: serif, fontSize: 34, color: pal.text, fontWeight: 400, lineHeight: 1, letterSpacing: '-0.02em' }}>
                        {isNRI ? (score > 0 ? score.toFixed(1) : '0') : score}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{isNRI ? 'Score' : '/10'}</span>
                </div>
                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: -2 }}>
                    {isFallback ? 'Market Average' : 'FEMA NRI Index'}
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

export const EnvironmentSectionPage: React.FC<Props> = ({ data, solarPotential, micro, isHealingFema }) => {

    // ── Climate risk scores (Prefer FEMA NRI) ────────────────────────────────
    const [allHazardsExpanded, setAllHazardsExpanded] = React.useState(false);
    const nri = data.historical_disasters?.femaRiskIndex;

    // Helper to get score: either already mapped 1-10 on root, or derived from NRI percentiles
    // Helper to get raw data
    const getHazardData = (rootVal: number | undefined, nriVal: any | undefined) => {
        if (nriVal != null) {
            // Handle legacy schema where nriVal was just a numeric score
            if (typeof nriVal === 'number') {
                return { score: nriVal, rating: undefined, isLegacyNRI: true, isFallback: false };
            }
            return { score: nriVal.score ?? 0, rating: nriVal.rating, isLegacyNRI: false, isFallback: false };
        }
        return rootVal != null ? { score: rootVal, rating: undefined, isLegacyNRI: false, isFallback: true } : null;
    };

    const windData = getHazardData(data.windRiskScore, nri?.hazards?.hurricane);
    const floodData = getHazardData(data.floodRiskScore, nri?.hazards?.flood);
    const fireData = getHazardData(data.fireRiskScore, nri?.hazards?.wildfire);
    const heatData = getHazardData(data.heatRiskScore, nri?.hazards?.heatwave);

    const riskTiles = [
        windData && { icon: 'fa-wind', label: 'Wind', ...windData },
        floodData && { icon: 'fa-water', label: 'Inland Flood', ...floodData },
        fireData && { icon: 'fa-fire', label: 'Fire', ...fireData },
        heatData && { icon: 'fa-temperature-high', label: 'Heat', ...heatData },
    ].filter(Boolean) as { icon: string; label: string; score: number; rating?: string; isLegacyNRI?: boolean; isFallback?: boolean }[];

    const allHazardsRaw = [
        { key: 'earthquake', label: 'Earthquake', icon: 'fa-house-chimney-crack' },
        { key: 'tornado', label: 'Tornado', icon: 'fa-tornado' },
        { key: 'strongwind', label: 'Strong Wind', icon: 'fa-wind' },
        { key: 'hail', label: 'Hail', icon: 'fa-cloud-meatball' },
        { key: 'lightning', label: 'Lightning', icon: 'fa-bolt' },
        { key: 'drought', label: 'Drought', icon: 'fa-sun-plant-wilt' },
        { key: 'landslide', label: 'Landslide', icon: 'fa-mountain' },
        { key: 'tsunami', label: 'Tsunami', icon: 'fa-house-tsunami' },
        { key: 'avalanche', label: 'Avalanche', icon: 'fa-mountain-sun' },
        { key: 'coldwave', label: 'Cold Wave', icon: 'fa-snowflake' },
        { key: 'icestorm', label: 'Ice Storm', icon: 'fa-icicles' },
        { key: 'volcano', label: 'Volcano', icon: 'fa-volcano' },
        { key: 'winterweather', label: 'Winter Weather', icon: 'fa-cloud-showers-heavy' },
        { key: 'coastal_flood', label: 'Coastal Flood', icon: 'fa-house-flood-water' }
    ].map(h => {
        const hazard = nri?.hazards?.[h.key];
        const hasAnyNri = !!nri;

        let score: number | null = null;
        let rating: string | undefined = undefined;

        if (hazard != null) {
            if (typeof hazard === 'number') {
                score = hazard;
            } else {
                score = hazard.score ?? 0;
                rating = hazard.rating;
            }
        } else if (hasAnyNri) {
            score = 0;
        }

        return { ...h, score, rating };
    });

    const secondaryHazards = allHazardsRaw.filter(h => {
        if (!h.rating) return true;
        const r = h.rating.toLowerCase();
        return !r.includes('not applicable') && !r.includes('no rating');
    });

    const omittedHazards = allHazardsRaw.filter(h => {
        if (!h.rating) return false;
        const r = h.rating.toLowerCase();
        return r.includes('not applicable') || r.includes('no rating');
    });

    // ── Noise helpers ─────────────────────────────────────────────────────────
    // Priority: Zyphe Noise Score (v3) -> HowLoud SoundScore (v1)
    const noiseScore = data.zypheNoiseScore ?? data.noiseScore ?? null;
    const noiseLabel = noiseScore == null ? null
        : noiseScore >= 85 ? 'Pristine' : noiseScore >= 70 ? 'Quiet' : noiseScore >= 50 ? 'Moderate' : 'Loud';
    const noiseColor = noiseScore == null ? '#10b981'
        : noiseScore >= 70 ? '#10b981' : noiseScore >= 50 ? '#f59e0b' : '#ef4444';

    const noiseSubs = [
        { label: 'Traffic', score: data.noiseTrafficScore, desc: data.noiseTrafficDesc },
        { label: 'Local', score: data.noiseLocalScore, desc: data.noiseLocalDesc },
        { label: 'Airport', score: data.noiseAirportScore, desc: data.noiseAirportDesc },
    ].filter(n => n.score != null) as { label: string; score: number; desc?: string }[];

    // ── Air quality helpers ───────────────────────────────────────────────────
    const aqi = data.airQuality?.aqi ?? null;
    const aqiLabel = aqi == null ? null : aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Sensitive' : 'Unhealthy';
    const aqiColor = aqi == null ? '#10b981' : aqi <= 50 ? '#10b981' : aqi <= 100 ? '#f59e0b' : '#ef4444';

    // ── Pollen helpers ────────────────────────────────────────────────────────
    const pollenCat = data.pollen?.category ?? null;
    const pollenPct = pollenCat ? ({ High: 0.85, Moderate: 0.5, Low: 0.15, VeryHigh: 1.0 } as Record<string, number>)[pollenCat] ?? 0.2 : 0;
    const pollenColor = pollenCat === 'Low' ? '#10b981' : pollenCat === 'Moderate' ? '#f59e0b' : '#ef4444';

    // ── Hazard data ───────────────────────────────────────────────────────────
    const seismic = data.historical_disasters?.seismicZone ?? null;
    const floodZone = data.historical_disasters?.floodZone ?? null;
    const recentQuakes = data.historical_disasters?.earthquakes ?? [];
    const femaEvents = data.historical_disasters?.femaDeclarations ?? [];
    const drought = data.drought;
    const hasHazards = !!(data.coordinates);

    const [quakesOpen, setQuakesOpen] = React.useState(false);
    const QUAKE_PREVIEW = 3;
    const visibleQuakes = quakesOpen ? recentQuakes : recentQuakes.slice(0, QUAKE_PREVIEW);

    // ── Solar ─────────────────────────────────────────────────────────────────
    const hasSolar = !!(data.solarData || data.coordinates);
    const sd = data.solarData;

    // ── Conditional action items ──────────────────────────────────────────────
    const actions = [
        fireData?.score != null && fireData.score > (fireData.rating ? 50 : 5) && { icon: 'fa-fire-extinguisher', title: 'Fire Mitigation', desc: 'Install ember-resistant vents and maintain a defensible space perimeter to reduce wildfire exposure.' },
        windData?.score != null && windData.score > (windData.rating ? 50 : 5) && { icon: 'fa-house-chimney', title: 'Roof Tie-Downs', desc: 'Secondary water resistance and hurricane clips can reduce annual insurance premiums significantly.' },
        floodData?.score != null && floodData.score > (floodData.rating ? 50 : 5) && { icon: 'fa-droplet', title: 'Smart Leak Sensors', desc: 'IoT sensors in mechanical rooms can mitigate internal flooding and reduce water damage claims.' },
    ].filter(Boolean) as { icon: string; title: string; desc: string }[];

    const sn = { environmental: '01', climate: '02', hazard: '03', microclimate: '04', solar: '05' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>


            {/* ── Section 01 — Environmental Quality ────────────────────────── */}
            {(noiseScore != null || aqi != null || pollenCat) && (
                <section>
                    <SectionTitleBar num={sn.environmental} kicker="Air · Acoustic · Pollen" title="Environmental Quality" italicWord="Quality" />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                        {/* Noise */}
                        {noiseScore != null && (
                            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <i className="fa-solid fa-volume-high" style={{ fontSize: 10, color: '#7c3aed' }} />
                                    </div>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Noise Profile</span>
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 2 }}>
                                        <span style={{ fontFamily: serif, fontSize: 22, color: '#0f172a', fontWeight: 400, lineHeight: 1 }}>{noiseScore}</span>
                                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>/100</span>
                                    </div>
                                </div>
                                <div style={{ width: '100%', height: 3, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
                                    <div style={{ width: `${noiseScore}%`, height: '100%', background: noiseColor, borderRadius: 99 }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: noiseColor }}>{noiseLabel}</span>
                                {data.primaryNoiseSource && (
                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <div style={{ fontSize: 9.5, letterSpacing: '0.13em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Primary Source</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <i className={`fa-solid ${data.primaryNoiseSource.includes('Motorway') ? 'fa-road' : data.primaryNoiseSource.includes('Rail') ? 'fa-train' : 'fa-house-chimney-window'} text-slate-400 text-[10px]`} />
                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{data.primaryNoiseSource}</span>
                                        </div>
                                    </div>
                                )}
                                {noiseSubs.length > 0 && data.zypheNoiseScore == null && (
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
                                <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', marginTop: 'auto' }}>
                                    OpenStreetMap · Acoustic Model
                                </div>
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
                </section>
            )}

            {/* ── Section 02 — Climate Risk ─────────────────────────────────── */}
            {riskTiles.length > 0 && (
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <SectionTitleBar num={sn.climate} kicker="FEMA National Risk Index" title="Climate Risk Overview" italicWord="Risk" />
                        {nri?.lastUpdated && (
                            <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Updated {new Date(nri.lastUpdated).toLocaleDateString()}
                            </div>
                        )}
                    </div>

                    {/* 4 risk tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${riskTiles.length}, 1fr)`, gap: 14, marginBottom: 20 }}>
                        {riskTiles.map(t => (
                            <RiskTile
                                key={t.label}
                                icon={t.icon}
                                label={t.label}
                                score={t.score}
                                rating={t.rating}
                                isLegacyNRI={t.isLegacyNRI}
                                isFallback={t.isFallback}
                            />
                        ))}
                    </div>

                    {isHealingFema && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 16 }}>
                            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 10, color: '#3b82f6' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>Fetching FEMA National Risk Index scores…</span>
                        </div>
                    )}

                    {/* Resilience Actions Integrated here */}
                    {actions.length > 0 && (
                        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <div style={{ width: 3, height: 16, background: '#4f46e5', borderRadius: 99 }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions Recommended</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                                {actions.map((a, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                            <i className={`fa-solid ${a.icon}`} style={{ fontSize: 10, color: '#4f46e5' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{a.title}</div>
                                            <p style={{ fontSize: 11.5, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{a.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Secondary Hazards Grid */}
                    {secondaryHazards.length > 0 && (
                        <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
                            <div style={{ fontSize: 9.5, letterSpacing: '0.13em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="fa-solid fa-shield-halved" style={{ fontSize: 10 }} />
                                Full Natural Hazard Risk Matrix
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                                {secondaryHazards.map((h, i) => (
                                    <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <i className={`fa-solid ${h.icon}`} style={{ fontSize: 10, color: '#64748b' }} />
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{h.label}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                            <span style={{
                                                fontFamily: serif,
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: h.score == null ? '#94a3b8' : riskPalette(h.score, h.rating).text
                                            }}>{h.rating || (h.score != null ? h.score : '—')}</span>
                                            {!h.rating && h.score != null && <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}>/10</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                                                    : seismic.riskLevel === 'high' ? { background: '#f97316', color: '#fff', border: '1px solid #f97316' }
                                                        : seismic.riskLevel === 'moderate' ? { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
                                                            : { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }
                                            }
                                        />
                                    </div>

                                    {/* PGA / Ss / S1 mini tiles */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                                        {[
                                            { label: 'Peak Ground Accel.', abbr: 'PGA', value: `${seismic.pga}g`, tip: 'Peak Ground Acceleration — the maximum force (in g) the earthquake exerts on a structure. Higher values mean stronger shaking.' },
                                            { label: 'Short-Period Accel.', abbr: 'Ss', value: `${seismic.ss}g`, tip: 'Spectral Response at 0.2s — measures shaking force on short, stiff buildings like 1–2 story homes. Used in structural design codes (ASCE 7-22).' },
                                            { label: '1-Second Accel.', abbr: 'S1', value: `${seismic.s1}g`, tip: 'Spectral Response at 1.0s — measures shaking force on taller or more flexible structures. Important for multi-story buildings and soft soils.' },
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
                                                    {(() => {
                                                        const rawFaults = ((data as any).faults.faults as FaultLine[]) || [];
                                                        const unique: Record<string, FaultLine> = {};
                                                        rawFaults.forEach(f => {
                                                            const key = f.name.trim().toLowerCase();
                                                            if (!unique[key] || f.distanceMi < unique[key].distanceMi) {
                                                                unique[key] = f;
                                                            }
                                                        });
                                                        return Object.values(unique).sort((a, b) => a.distanceMi - b.distanceMi).map((fault, i) => (
                                                            <div key={i} style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{fault.name}</div>
                                                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>{fault.distanceMi} mi</div>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                                        {fault.activityStatus && (
                                                                            <Pill
                                                                                label={fault.activityStatus}
                                                                                style={{
                                                                                    background: fault.activityStatus === 'High Activity' ? '#fef2f2' : fault.activityStatus === 'Historically Active' ? '#fffbeb' : '#f1f5f9',
                                                                                    color: fault.activityStatus === 'High Activity' ? '#ef4444' : fault.activityStatus === 'Historically Active' ? '#d97706' : '#64748b',
                                                                                    border: 'none',
                                                                                    fontSize: 9
                                                                                }}
                                                                            />
                                                                        )}
                                                                        <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>{fault.lastActive}</span>
                                                                    </div>
                                                                    {fault.slipRate && fault.slipRate !== 'Unspecified' && (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                            <span style={{ fontSize: 8, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase' }}>Slip Rate:</span>
                                                                            <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b' }}>{fault.slipRate}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ));
                                                    })()}
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
                    </div>
                </section>
            )}

            {/* ── Section 04 — Microclimate Delta ─────────────────────────── */}
            {micro && (
                <section>
                    <SectionTitleBar num={sn.microclimate} kicker="Tomorrow.io · Thermal Fingerprint" title="Local Microclimate" italicWord="Microclimate" />

                    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: micro.delta <= 0 ? 'rgba(14,165,233,0.1)' : 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <i className={micro.delta <= 0 ? "fa-solid fa-snowflake" : "fa-solid fa-fire-orange"} style={{ fontSize: 16, color: micro.delta <= 0 ? '#0ea5e9' : '#f59e0b' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Thermal Fingerprint</div>
                                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{micro.label || (micro.delta <= 0 ? 'Slightly Cooler' : 'Slightly Warmer')} vs {micro.baselineLabel}</div>
                                    </div>
                                </div>

                                <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                                    {micro.insight}
                                </p>

                                {micro.mechanism && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '10px 14px', width: 'fit-content' }}>
                                        <div style={{ fontSize: 10, letterSpacing: '0.05em', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Mechanism:</div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{micro.mechanism}</div>
                                    </div>
                                )}
                            </div>



                            <div style={{ background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Temperature Delta</span>
                                    <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: micro.delta <= 0 ? '#0ea5e9' : '#f59e0b', background: micro.delta <= 0 ? 'rgba(14,165,233,0.1)' : 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                        {micro.deltaF > 0 ? '+' : ''}{micro.deltaF}°F
                                    </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>This Property</span>
                                        <span style={{ fontFamily: serif, fontSize: 20, color: '#0f172a' }}>{Math.round(micro.propertyApparentTemp * 9 / 5 + 32)}°F</span>
                                    </div>
                                    <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '50%', top: -2, width: 2, height: 8, background: '#cbd5e1' }} />
                                        <div style={{
                                            position: 'absolute',
                                            left: `${50 + (micro.delta * 5)}%`,
                                            top: -4,
                                            width: 12,
                                            height: 12,
                                            borderRadius: '50%',
                                            background: micro.delta <= 0 ? '#0ea5e9' : '#f59e0b',
                                            border: '2px solid #fff',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{micro.baselineLabel}</span>
                                        <span style={{ fontFamily: serif, fontSize: 20, color: '#64748b' }}>{Math.round(micro.baselineApparentTemp * 9 / 5 + 32)}°F</span>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                                    <div>
                                        <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Humidity</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{Math.round(micro.humidity)}%</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Wind Speed</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{Math.round(micro.windSpeed * 2.237)} mph</div>
                                    </div>
                                </div>
                            </div>
                        </div>
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
                                            sd.maxArrayPanelsCount != null && { label: 'Max Panels', value: `${sd.maxArrayPanelsCount}`, unit: 'units' },
                                            sd.panelCapacityWatts != null && { label: 'Panel Capacity', value: `${sd.panelCapacityWatts}`, unit: 'W' },
                                            sd.maxArrayAreaMeters2 != null && { label: 'Array Area', value: `${Math.round(sd.maxArrayAreaMeters2)}`, unit: 'm²' },
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

                        {nri?.hazards && (
                            <div style={{ marginTop: 16 }}>
                                <button 
                                    onClick={() => setAllHazardsExpanded(!allHazardsExpanded)}
                                    style={{ 
                                        background: 'none', border: 'none', padding: 0, 
                                        fontSize: 10, fontWeight: 700, color: ACCENT, 
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                                    }}
                                >
                                    <i className={`fa-solid ${allHazardsExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ fontSize: 9 }} />
                                    {allHazardsExpanded ? 'Hide Detailed Hazards' : `View All 18 Natural Hazards`}
                                </button>

                                {allHazardsExpanded && (
                                    <div style={{ marginTop: 16 }}>
                                        <div style={{ 
                                            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                                            gap: 10, padding: 16, background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' 
                                        }}>
                                            {secondaryHazards.map((h) => {
                                                const pal = riskPalette(h.score ?? 0, h.rating, 100);
                                                return (
                                                    <div key={h.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{h.label}</div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: pal.text }}>{h.rating || 'No Rating'}</div>
                                                        <div style={{ height: 3, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(h.score ?? 0, 100)}%`, height: '100%', background: pal.bar }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        {omittedHazards.length > 0 && (
                                            <div style={{ marginTop: 12, padding: '0 8px', fontSize: 10, color: '#94a3b8', fontWeight: 500, lineHeight: 1.5 }}>
                                                <i className="fa-solid fa-circle-info" style={{ marginRight: 6, fontSize: 9 }} />
                                                The following hazards were flagged as <span style={{ fontWeight: 700 }}>Not Applicable</span> or have <span style={{ fontWeight: 700 }}>No Official Rating</span> for this location: {omittedHazards.map(h => h.label).join(', ')}.
                                            </div>
                                        )}
                                    </div>
                                )}
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
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginTop: 3 }}>FEMA National Risk Index · USGS · Drought Monitor</div>
                    </div>
                </div>
                <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Zyphe Property Analysis</div>
            </div>

        </div>
    );
};
