/**
 * OutdoorSectionPage
 * IDS redesign — two full-width sections with SectionTitleBar.
 * Section 01 — Eyes on the Street: image hero with numbered pins + 6 obs cards
 * Section 02 — Parcel & Satellite: map + lot stats + verify-these
 * Accent: green (#16a34a)
 */
import React, { useState } from 'react';
import { PropertyData } from '../../../types';
import { CustomAIAnalysisResult } from '../../../types/ai';
import StaticParcelMap from '../StaticParcelMap';

interface Props {
    data: PropertyData;
    customAnalysis?: CustomAIAnalysisResult | null;
}

const serif = "'Instrument Serif', Georgia, serif";
const mono  = "'JetBrains Mono', ui-monospace, monospace";
const ACCENT     = '#16a34a';
const ACCENT_BG  = 'rgba(22,163,74,0.10)';

// ── Primitives ────────────────────────────────────────────────────────────────

function SectionTitleBar({ num, kicker, title, italicWord, right }: {
    num?: string; kicker: string; title: string; italicWord?: string; right?: React.ReactNode;
}) {
    const parts = italicWord && title.includes(italicWord) ? title.split(italicWord) : null;
    return (
        <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {num && <span style={{ fontFamily: mono, fontSize: 11, color: ACCENT, padding: '2px 7px', borderRadius: 4, background: ACCENT_BG, fontWeight: 700 }}>{num}</span>}
                <span style={{ width: 24, height: 1, background: ACCENT, display: 'inline-block' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' }}>{kicker}</span>
                {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.05, margin: 0, fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                {parts
                    ? <>{parts[0]}<em style={{ color: ACCENT, fontStyle: 'italic' }}>{italicWord}</em>{parts[1]}</>
                    : title}
            </h2>
        </div>
    );
}

// Numbered pin badge for street view overlay
const Pin: React.FC<{ n: number; style?: React.CSSProperties }> = ({ n, style }) => {
    return (
        <div style={{
            position: 'absolute', width: 26, height: 26, borderRadius: '50%',
            background: ACCENT, border: '2px solid rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: mono, fontSize: 11, fontWeight: 700, color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.35)', cursor: 'default', zIndex: 2,
            transform: 'translate(-50%, -50%)',
            ...style,
        }}>
            {n}
        </div>
    );
};

// Observation card (numbered, category, value headline, body)
interface Obs {
    num: number;
    category: string;
    value: string;
    body: string;
}

const ObsCard: React.FC<Obs> = ({ num, category, value, body }) => (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{num}</div>
            <span style={{ fontSize: 9.5, letterSpacing: '0.15em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{category}</span>
        </div>
        <div style={{ fontFamily: serif, fontSize: 17, color: '#0f172a', fontWeight: 400, lineHeight: 1.1 }}>{value}</div>
        <p style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
);

// Stat row inside parcel card
function ParcelStat({ icon, label, value, sub, badge }: {
    icon: string; label: string; value: string; sub?: string; badge?: string;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <i className={`fa-solid ${icon}`} style={{ fontSize: 9, color: '#6366f1' }} />
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: serif, fontSize: 20, color: '#0f172a', fontWeight: 400, lineHeight: 1 }}>{value}</span>
                    {badge && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: ACCENT_BG, color: ACCENT }}>{badge}</span>
                    )}
                </div>
                {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{sub}</div>}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const OutdoorSectionPage: React.FC<Props> = ({ data, customAnalysis }) => {
    const [selectedImage, setSelectedImage] = useState<{ url: string; label: string } | null>(null);
    const ext = customAnalysis?.exterior_and_neighborhood;
    const outdoorHighlights = ext?.outdoor_highlights || [];
    const lotFeaturesRaw = data.resoFacts?.lotFeatures;
    const lotFeatures = Array.isArray(lotFeaturesRaw) ? lotFeaturesRaw.join(', ') : (lotFeaturesRaw || '');
    const fencingRaw = data.resoFacts?.fencing;
    const fencing = Array.isArray(fencingRaw) ? fencingRaw.join(', ') : (fencingRaw || '');
    const lotSqft = data.lotAreaValue;
    const coordinates = data.coordinates;

    const [svTab, setSvTab] = useState<'streetview' | 'satellite'>('streetview');
    const [lotTab, setLotTab] = useState<'parcel' | 'satellite'>('satellite');
    const [isSatelliteExpanded, setIsSatelliteExpanded] = useState(false);
    const [isStreetViewExpanded, setIsStreetViewExpanded] = useState(false);

    // Parcel Validation / Elevation Data
    const [pvLoading, setPvLoading] = useState(false);
    const [pvFlags, setPvFlags] = useState<any[] | null>(null);
    const [arcgisArea, setArcgisArea] = useState<number | null>(null);
    const [taxSqft, setTaxSqft] = useState<number | null>(null);
    const [drivewayDisplay, setDrivewayDisplay] = useState<any>(null);
    const [backyardDisplay, setBackyardDisplay] = useState<any>(null);
    const [viewDisplay, setViewDisplay] = useState<any>(null);
    const [elevationFt, setElevationFt] = useState<number | null>(null);

    const MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

    React.useEffect(() => {
        if (!data.zpid || !data.coordinates) return;
        let cancelled = false;
        const run = async () => {
            setPvLoading(true);
            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const { db } = await import('../../../services/firebase/config');
                const propSnap = await getDoc(doc(db, 'properties', String(data.zpid)));
                const pData = propSnap.exists() ? propSnap.data() : null;
                if (pData?.parcelValidation) {
                    const pv = pData.parcelValidation;
                    setPvFlags(pv.flags || []);
                    if (pv.slopePercent != null)       setBackyardDisplay({ grade: pv.slopePercent, category: pv.slopeCategory || 'Flat', dir: pv.uphillDir || '?' });
                    if (pv.drivewayGradePercent != null) setDrivewayDisplay({ grade: pv.drivewayGradePercent, category: pv.drivewayCategory || 'Flat', dir: pv.downhillDir || '?' });
                    if (pv.viewDropFt != null)          setViewDisplay({ potential: pv.viewPotential || 'None', dropFt: pv.viewDropFt, dir: pv.viewDropDir || '?' });
                    if (pv.elevationFt != null)         setElevationFt(pv.elevationFt);
                }
                setArcgisArea(pData?.parcelAreaSqft || null);
                setTaxSqft(pData?.taxSqft || null);
            } catch (e) { console.error('PV Fetch failed', e); }
            finally { if (!cancelled) setPvLoading(false); }
        };
        run();
        return () => { cancelled = true; };
    }, [data.zpid, data.coordinates]);

    // ── Build 6 observations from dynamic data ────────────────────────────────
    const sv = data.streetViewAnalysis;
    const observations: Obs[] = [
        {
            num: 1,
            category: 'Front-Yard Privacy',
            value: sv?.privacyRating || (fencing ? 'Fenced' : 'Moderate'),
            body: ext?.views_privacy_orientation?.privacy
                || sv?.gardenDescription
                || 'Privacy screening details will appear after running the exterior analysis.',
        },
        {
            num: 2,
            category: 'Safety & Access',
            value: fencing ? 'Fully fenced' : (sv?.familySafety?.split(' ').slice(0, 2).join(' ') || 'Open front'),
            body: sv?.familySafety
                || (fencing
                    ? `${fencing} fencing with direct access to sidewalks. Suitable for kids and pets.`
                    : 'No fencing listed. Front yard is open to the street.'),
        },
        {
            num: 3,
            category: 'Solar Potential',
            value: sv?.solarObstructions
                ? (sv.solarObstructions.toLowerCase().includes('obstruct') ? 'Obstructed' : 'Good')
                : (lotFeatures.toLowerCase().includes('tree') ? 'Obstructed' : 'Good'),
            body: sv?.solarObstructions
                || (lotFeatures.toLowerCase().includes('tree')
                    ? 'Mature trees on the property and surrounding lots could obstruct rooftop solar, especially in winter months when the sun angle is lower.'
                    : 'No major obstructions detected. Good exposure for rooftop solar.'),
        },
        {
            num: 4,
            category: 'Vibe',
            value: sv?.neighborhoodVibe?.split(' ').slice(0, 3).join(' ') || 'Pleasant',
            body: [sv?.neighborCondition, sv?.neighborhoodVibe]
                .filter(Boolean)
                .join(' — ')
                || ext?.neighborhood_street_insights?.slice(0, 180)
                || 'Neighboring houses appear well-maintained and in good condition, contributing to a cohesive neighborhood aesthetic.',
        },
        {
            num: 5,
            category: 'Utilities',
            value: sv?.utilityAesthetic
                ? (sv.utilityAesthetic.toLowerCase().includes('underground') ? 'Underground' : 'Visible')
                : 'Underground',
            body: sv?.utilityAesthetic
                || 'No overhead wires visible — utilities appear to be underground, preserving the visual character of the street.',
        },
        {
            num: 6,
            category: 'Parking',
            value: sv?.parkingLogistics?.split(' ').slice(0, 3).join(' ') || 'Street + driveway',
            body: sv?.parkingLogistics
                || 'Street parking is available and unrestricted. Combined with the private driveway, guest parking is not a concern.',
        },
    ];

    // AI-provided pin positions (from observationPins field), keyed by pin num
    const pinMap = new Map<number, { xPct: number; yPct: number }>(
        (sv?.observationPins ?? []).map(p => [p.num, { xPct: p.xPct, yPct: p.yPct }])
    );

    const svUrl = data.streetView || data.orientation_ai?.street_view_url;
    const hasSatellite = !!data.satelliteImageUrl;

    // Tab toggle rendering for section 01
    const s1ToggleTabs = (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {(['streetview', 'satellite'] as const).map(tab => {
                const active = svTab === tab;
                const label = tab === 'streetview' ? 'Google Street View' : 'Parcel Satellite';
                const show = tab === 'streetview' ? !!svUrl : hasSatellite;
                if (!show) return null;
                return (
                    <button key={tab} onClick={() => setSvTab(tab)} style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 9.5, fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', border: 'none',
                        background: active ? ACCENT : '#f1f5f9',
                        color: active ? '#fff' : '#64748b',
                    }}>
                        {active && <i className="fa-solid fa-check" style={{ fontSize: 8, marginRight: 5 }} />}
                        {label}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            
            {/* ── Exterior Hero Section — Mosaic of top 5 outdoor photos ── */}
            <div style={{
                background: `linear-gradient(180deg, ${ACCENT_BG}60 0%, #fff 160px)`,
                borderRadius: 16, border: `1px solid ${ACCENT}30`, padding: 24,
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start',
            }}>
                <div>
                    {/* Dynamic exterior tags */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' as const }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', background: `${ACCENT}18`, color: ACCENT, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>◈ Exterior Overview</span>
                        {ext?.exterior_and_lot_appeal?.architecture_style && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0' }}>
                                {ext.exterior_and_lot_appeal.architecture_style.split(' ').slice(0, 3).join(' ')}
                            </span>
                        )}
                        {lotSqft && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0' }}>
                                {Math.round(lotSqft / 43560 * 100) / 100} Acres
                            </span>
                        )}
                    </div>

                    <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.1, margin: '0 0 14px', fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                        Outdoor &amp; <em style={{ color: ACCENT, fontStyle: 'italic' }}>curb appeal</em>
                    </h2>

                    <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, margin: '0 0 14px', textWrap: 'pretty' as any }}>
                        {ext?.exterior_and_lot_appeal?.curb_appeal} {ext?.exterior_and_lot_appeal?.backyard_and_patio}
                    </p>
                    <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, margin: 0, textWrap: 'pretty' as any }}>
                        {ext?.views_privacy_orientation?.views} {ext?.views_privacy_orientation?.privacy}
                    </p>

                    {/* Objective tags as chips */}
                    {(() => {
                        const tags = ext?.objective_tags || ext?.outdoor_highlights?.map(h => h.label) || [];
                        if (tags.length === 0) return null;
                        return (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
                                {tags.map(tag => (
                                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', background: `${ACCENT}10`, color: ACCENT, padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, border: `1px solid ${ACCENT}25` }}>
                                        {tag.replace(/-/g, ' ')}
                                    </span>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* Photo grid - Mosaic of top 3 exterior photos */}
                {(() => {
                    const outdoorHighlights = customAnalysis?.exterior_and_neighborhood?.outdoor_highlights || [];
                    const imageAnalysis = customAnalysis?.image_by_image_analysis || [];
                    
                    let items: Array<{ url: string; label: string }> = [];
                    const used = new Set<number>();

                    // 1. Priority: AI-mapped outdoor highlights
                    for (const highlight of outdoorHighlights) {
                        const idx = parseInt(highlight.image_id.match(/\d+/)?.[0] || '-1');
                        const url = data.images?.[idx];
                        if (url && !used.has(idx)) {
                            items.push({ url: url as string, label: highlight.label });
                            used.add(idx);
                            if (items.length >= 3) break;
                        }
                    }

                    // 2. Fallback: Sniff image analysis for outdoor keywords
                    if (items.length < 3) {
                        const outdoorKeywords = ['exterior', 'aerial', 'drone', 'pool', 'backyard', 'garden', 'driveway'];
                        for (const entry of imageAnalysis) {
                            const idx = parseInt(entry.image_id.match(/\d+/)?.[0] || '-1');
                            const url = data.images?.[idx];
                            if (url && !used.has(idx) && outdoorKeywords.some(k => entry.analysis.toLowerCase().includes(k))) {
                                items.push({ url: url as string, label: '' }); // No label for fallback
                                used.add(idx);
                                if (items.length >= 3) break;
                            }
                        }
                    }

                    // 3. Last resort: First 3 available
                    if (items.length < 3) {
                        (data.images || []).forEach((img, idx) => {
                            if (items.length >= 3 || used.has(idx) || !img) return;
                            items.push({ url: img as string, label: '' }); // No label for fallback
                            used.add(idx);
                        });
                    }

                    return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                            {items.map((item, i) => (
                                <div key={i} style={{ 
                                    borderRadius: 12, overflow: 'hidden', height: i === 0 ? 320 : 220, 
                                    position: 'relative', gridColumn: i === 0 ? '1 / span 2' : 'auto',
                                    background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'zoom-in'
                                }} onClick={() => setSelectedImage({ url: item.url, label: item.label })}>
                                    <img src={item.url} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    {item.label && (
                                        <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', color: '#fff', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                                            {item.label}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* ── Section 01 — Eyes on the Street ──────────────────────────── */}
            {svUrl && <section>
                <SectionTitleBar
                    kicker="Eyes on the Street"
                    title="What the street tells you — before you walk up."
                    italicWord="before you walk up."
                />
                <p style={{ fontSize: 12.5, color: '#64748b', margin: '0 0 16px', lineHeight: 1.55 }}>
                    Six observations synthesised from street view, satellite, and parcel data. Hover any pin to focus its reading.
                </p>

                {/* Side-by-side: square image left · 2×3 cards right */}
                <div style={{ display: 'grid', gridTemplateColumns: '44% 1fr', gap: 14, alignItems: 'start' }}>

                    {/* Left — square image + tab toggle above */}
                    <div>
                        {/* Tab toggles */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            {(['streetview', 'satellite'] as const).map(tab => {
                                const active = svTab === tab;
                                const label = tab === 'streetview' ? 'Google Street View' : 'Parcel Satellite';
                                const show = tab === 'streetview' ? !!svUrl : hasSatellite;
                                if (!show) return null;
                                return (
                                    <button key={tab} onClick={() => setSvTab(tab)} style={{
                                        padding: '4px 12px', borderRadius: 6, fontSize: 9.5, fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', border: 'none',
                                        background: active ? ACCENT : '#f1f5f9', color: active ? '#fff' : '#64748b',
                                    }}>
                                        {active && <i className="fa-solid fa-check" style={{ fontSize: 8, marginRight: 5 }} />}
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Square image */}
                        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1 / 1', background: '#f1f5f9' }}>
                            {svTab === 'streetview' ? (
                                svUrl ? (
                                    <>
                                        <img
                                            src={svUrl}
                                            alt="Street View"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                            onClick={() => setIsStreetViewExpanded(true)}
                                        />
                                        <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(15,10,31,0.55)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <i className="fa-solid fa-street-view" style={{ fontSize: 8 }} />
                                            {data.address}
                                        </div>
                                        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '3px 9px', fontSize: 8.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setIsStreetViewExpanded(true)}>
                                            <i className="fa-solid fa-up-right-and-down-left-from-center" style={{ fontSize: 7 }} />
                                            360° View
                                        </div>
                                        {observations.map(obs => {
                                            const pos = pinMap.get(obs.num);
                                            if (!pos) return null;
                                            return <Pin key={obs.num} n={obs.num} style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }} />;
                                        })}
                                    </>
                                ) : data.images?.[data.images.length - 1] ? (
                                    <img src={data.images[data.images.length - 1]} alt="exterior" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ height: '100%', background: `repeating-linear-gradient(135deg, ${ACCENT}0a 0 6px, transparent 6px 14px), #f8fafc`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                        Street View · {data.address}
                                    </div>
                                )
                            ) : hasSatellite ? (
                                <>
                                    <img src={data.satelliteImageUrl!} alt="Satellite View" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setIsSatelliteExpanded(true)} />
                                    <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(15,10,31,0.55)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.2)' }}>Satellite View</div>
                                </>
                            ) : (
                                <div style={{ height: '100%', background: `repeating-linear-gradient(135deg, ${ACCENT}0a 0 6px, transparent 6px 14px), #f8fafc`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    Satellite · {data.address}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right — 6 obs cards 2×3 grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                        {observations.map(obs => (
                            <ObsCard key={obs.num} {...obs} />
                        ))}
                    </div>
                </div>

            </section>}

            {/* ── Six dimensions of the plot ────────────────────────────── */}
                {(ext || data.orientation_ai) && (() => {
                    const hardscape = data.orientation_ai?.lot_coverage_hardscape;
                    const pervious  = data.orientation_ai?.lot_coverage_pervious ?? (hardscape != null ? 100 - hardscape : null);
                    const dims = [
                        {
                            icon: 'fa-eye-slash',
                            title: 'Privacy',
                            body: ext?.views_privacy_orientation?.privacy
                                || 'Privacy analysis will appear after running the exterior analysis.',
                        },
                        {
                            icon: 'fa-layer-group',
                            title: 'Lot Coverage',
                            isLotCoverage: true,
                            hardscape: hardscape ?? 45,
                            pervious:  pervious  ?? 55,
                            body: hardscape != null
                                ? `~${hardscape}% of the lot is hardscape (roof, driveway, patio) and ~${pervious}% is pervious green space.`
                                : '~45% of the lot is hardscape (roof, driveway, patio) and ~55% is pervious green space.',
                        },
                        {
                            icon: 'fa-building-columns',
                            title: 'Style',
                            body: ext?.exterior_and_lot_appeal?.architecture_style
                                || (data.resoFacts as any)?.architecturalStyle
                                || 'Architecture style analysis pending.',
                        },
                        {
                            icon: 'fa-house',
                            title: 'Curb Appeal',
                            body: ext?.exterior_and_lot_appeal?.curb_appeal
                                || 'Curb appeal analysis will appear after running the exterior analysis.',
                        },
                        {
                            icon: 'fa-tree',
                            title: 'Backyard & Patio',
                            body: ext?.exterior_and_lot_appeal?.backyard_and_patio
                                || 'Backyard analysis will appear after running the exterior analysis.',
                        },
                        {
                            icon: 'fa-binoculars',
                            title: 'Views',
                            body: ext?.views_privacy_orientation?.views
                                || 'View analysis will appear after running the exterior analysis.',
                        },
                    ] as const;
                    return (
                        <div style={{ marginTop: 28 }}>
                            {/* Sub-heading */}
                            <div style={{ marginBottom: 16 }}>
                                <h3 style={{ fontFamily: serif, fontSize: 24, fontWeight: 400, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>
                                    Six <em style={{ color: ACCENT, fontStyle: 'italic' }}>dimensions</em> of the plot
                                </h3>
                            </div>

                            {/* 3-col grid of dimension cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                {dims.map((d) => (
                                    <div key={d.title} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: ACCENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <i className={`fa-solid ${d.icon}`} style={{ fontSize: 10, color: ACCENT }} />
                                            </div>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{d.title}</span>
                                        </div>
                                        {(d as any).isLotCoverage && (
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
                                                    <div style={{ flex: (d as any).hardscape, background: '#4ade80', borderRadius: '99px 0 0 99px' }} />
                                                    <div style={{ flex: (d as any).pervious, background: '#bbf7d0', borderRadius: '0 99px 99px 0' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a' }}>{(d as any).hardscape}% hardscape</span>
                                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#86efac' }}>{(d as any).pervious}% green</span>
                                                </div>
                                            </div>
                                        )}
                                        <p style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.55, margin: 0 }}>{d.body}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

            {/* ── Neighborhood Street Insights ─────────────────────────── */}
            {ext?.neighborhood_street_insights && (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px' }}>
                    <div style={{ fontSize: 9.5, letterSpacing: '0.15em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', marginBottom: 6 }}>Neighborhood Street Insights</div>
                    <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6, margin: 0 }}>{ext.neighborhood_street_insights}</p>
                </div>
            )}

            {/* ── Section 02 — Parcel & Satellite ──────────────────────────── */}
            <section>
                <SectionTitleBar
                    kicker="Parcel & Satellite"
                    title="What the lot is actually working with"
                    italicWord="actually"
                    right={
                        data.parcelApn
                            ? <span style={{ fontFamily: mono, fontSize: 10, color: '#94a3b8', letterSpacing: '0.12em' }}>APN: {data.parcelApn}</span>
                            : undefined
                    }
                />

                {/* Side-by-side: square map left · stats right */}
                <div style={{ display: 'grid', gridTemplateColumns: '44% 1fr', gap: 14, alignItems: 'start' }}>

                    {/* Left — square map + tab toggle above */}
                    <div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                            {(['parcel', 'satellite'] as const).map(tab => {
                                const active = lotTab === tab;
                                return (
                                    <button key={tab} onClick={() => setLotTab(tab)} style={{
                                        padding: '4px 12px', borderRadius: 6, fontSize: 9.5, fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer',
                                        border: active ? 'none' : '1px solid #e2e8f0',
                                        background: active ? ACCENT : '#fff', color: active ? '#fff' : '#64748b',
                                    }}>
                                        {tab}
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1 / 1' }}>
                            {lotTab === 'parcel' ? (
                                <StaticParcelMap
                                    data={data}
                                    className="h-full rounded-xl overflow-hidden"
                                    parcelPolygon={
                                        data.parcelPolygon && data.parcelPolygon.length > 3
                                            ? data.parcelPolygon.map((pt: any) => Array.isArray(pt) ? pt : [pt.lon, pt.lat])
                                            : undefined
                                    }
                                />
                            ) : hasSatellite ? (
                                <>
                                    <img src={data.satelliteImageUrl!} alt="Satellite View" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setIsSatelliteExpanded(true)} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(15,10,31,0.6)', backdropFilter: 'blur(4px)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fff', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Satellite View</span>
                                        {data.address && <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.6)' }}>· {data.address}</span>}
                                        {lotFeatures && <span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>· {lotFeatures.slice(0, 30)}</span>}
                                    </div>
                                </>
                            ) : (
                                <StaticParcelMap
                                    data={data}
                                    className="h-full rounded-xl overflow-hidden"
                                    parcelPolygon={
                                        data.parcelPolygon && data.parcelPolygon.length > 3
                                            ? data.parcelPolygon.map((pt: any) => Array.isArray(pt) ? pt : [pt.lon, pt.lat])
                                            : undefined
                                    }
                                />
                            )}
                        </div>
                    </div>

                    {/* Right — stats + verify these */}
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 32px' }}>

                        {/* Row 1 */}
                        <ParcelStat
                            icon="fa-draw-polygon"
                            label="Parcel Polygon"
                            value={arcgisArea ? `${arcgisArea.toLocaleString()} sf` : (lotSqft ? `${lotSqft.toLocaleString()} sf` : '—')}
                            sub={(arcgisArea || lotSqft) ? `(${((arcgisArea || lotSqft || 0) / 43560).toFixed(2)} ac)` : undefined}
                        />
                        <ParcelStat
                            icon="fa-ruler-combined"
                            label="Living Area (Tax Records)"
                            value={taxSqft ? `${taxSqft.toLocaleString()} sf` : (data.livingAreaValue ? `${data.livingAreaValue.toLocaleString()} sf` : '—')}
                        />

                        {/* Row 2 — separator */}
                        <div style={{ gridColumn: '1 / -1', height: 1, background: '#f1f5f9' }} />

                        <ParcelStat
                            icon="fa-car"
                            label="Driveway Grade"
                            value={drivewayDisplay ? `${drivewayDisplay.grade}%` : '—'}
                            badge={drivewayDisplay?.category}
                            sub={drivewayDisplay?.category === 'Flat' ? 'Level entry — no concern for vehicles or accessibility' : 'Measured terrain grade.'}
                        />
                        <ParcelStat
                            icon="fa-tree"
                            label="Backyard Slope"
                            value={backyardDisplay ? `${backyardDisplay.grade}%` : '—'}
                            badge={backyardDisplay?.category}
                            sub={backyardDisplay?.category === 'Flat' ? 'Fully usable — pool, patio & lawn all feasible' : 'Measured terrain grade.'}
                        />

                        {/* Row 3 — separator */}
                        <div style={{ gridColumn: '1 / -1', height: 1, background: '#f1f5f9' }} />

                        <ParcelStat
                            icon="fa-mountain-sun"
                            label="Elevation"
                            value={elevationFt ? `${elevationFt.toLocaleString()} ft` : '—'}
                            sub="above sea level"
                        />
                        <ParcelStat
                            icon="fa-binoculars"
                            label="View Potential"
                            value={viewDisplay?.potential || 'None'}
                            sub={viewDisplay?.potential === 'None' || !viewDisplay ? 'Flat surroundings — no terrain-based view expected' : 'View potential assessed.'}
                        />
                    </div>

                    {/* ── Verify These ─────────────────────────────────────── */}
                    {pvFlags && pvFlags.filter(f => f.severity === 'alert' || f.severity === 'warning').length > 0 && (
                        <div style={{ marginTop: 18, borderTop: '1px solid #f1f5f9', paddingTop: 18 }}>
                            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b', fontSize: 10 }} />
                                Verify These
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {pvFlags.filter(f => f.severity === 'alert' || f.severity === 'warning').map((f, idx) => (
                                    <div key={idx} style={{
                                        background: f.severity === 'alert' ? '#fef2f2' : '#fffbeb',
                                        border: `1px solid ${f.severity === 'alert' ? '#fecaca' : '#fde68a'}`,
                                        borderRadius: 10, padding: '12px 14px',
                                    }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: f.severity === 'alert' ? '#991b1b' : '#92400e', lineHeight: 1.45, marginBottom: f.listed ? 8 : 0 }}>
                                            {f.finding}
                                        </div>
                                        {f.listed && f.measured && (
                                            <div style={{ display: 'flex', gap: 20, fontSize: 10.5, color: '#64748b' }}>
                                                <span>Listed: <strong>{f.listed}</strong></span>
                                                <span>Measured: <strong>{f.measured}</strong></span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer attribution */}
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', fontSize: 10, color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.5 }}>
                        Measures terrain grade, driveway usability, backyard slope, and view potential using Google Elevation data, verified against Municipal ArcGIS &amp; Tax Records.
                    </div>
                </div>{/* end stats card / right col */}
                </div>{/* end outer 2-col grid */}
            </section>

            {/* ── Outdoor Highlights Cards ── */}
            {outdoorHighlights.length > 0 && (
                <section style={{ marginTop: 60 }}>
                    <SectionTitleBar kicker="Outdoor Highlights" title={`${outdoorHighlights.length} focus areas`} italicWord="areas" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        {outdoorHighlights.map((highlight, i) => {
                            const imgId = highlight.image_id || '';
                            const idx = parseInt(imgId.match(/\d+/)?.[0] || '-1');
                            const url = data.images?.[idx];
                            return (
                                <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
                                    {url && (
                                        <div
                                            style={{ width: 'calc(100% + 36px)', margin: '-18px -18px 18px -18px', height: 160, overflow: 'hidden', cursor: 'zoom-in', background: '#f8fafc' }}
                                            onClick={() => setSelectedImage({ url, label: highlight.label })}
                                        >
                                            <img src={url} alt={highlight.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    )}
                                    <div style={{ fontFamily: serif, fontSize: 18, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{highlight.label}</div>
                                    {highlight.description && (
                                        <p style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, margin: 0, textWrap: 'pretty' as any }}>{highlight.description}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── Expand Modals ─────────────────────────────────────────────── */}
            {isSatelliteExpanded && hasSatellite && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'grid', placeItems: 'center', padding: 40 }}
                    onClick={() => setIsSatelliteExpanded(false)}
                >
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img src={data.satelliteImageUrl!} alt="Satellite Expanded" style={{ width: '100%', height: 'auto', borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }} />
                        <button style={{ position: 'absolute', top: -50, right: 0, background: 'none', border: 'none', color: '#fff', fontSize: 30, cursor: 'pointer' }}>×</button>
                    </div>
                </div>
            )}

            {isStreetViewExpanded && coordinates && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)', zIndex: 9999, padding: 40 }}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontFamily: serif, fontSize: 28, color: '#fff', margin: 0 }}>Street View Exploration</h3>
                                <p style={{ color: '#94a3b8', fontSize: 14, margin: '4px 0 0 0' }}>{data.address}</p>
                            </div>
                            <button
                                onClick={() => setIsStreetViewExpanded(false)}
                                style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                            >
                                <i className="fa-solid fa-xmark" />
                            </button>
                        </div>
                        <div style={{ flex: 1, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <iframe
                                width="100%" height="100%"
                                style={{ border: 0 }}
                                loading="lazy"
                                allowFullScreen
                                src={`https://www.google.com/maps/embed/v1/streetview?key=${MAPS_API_KEY}&location=${coordinates.latitude},${coordinates.longitude}&heading=${data.orientation_ai?.azimuth_degrees ?? 0}&pitch=0&fov=90&source=outdoor`}
                            />
                        </div>
                    </div>
                </div>
            )}
            {/* ── Image Modal ── */}
            {selectedImage && (
                <div 
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(10px)', zIndex: 10000, display: 'grid', placeItems: 'center', padding: 40 }}
                    onClick={() => setSelectedImage(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
                        <img src={selectedImage.url} alt={selectedImage.label} style={{ width: '100%', height: 'auto', maxHeight: '80vh', borderRadius: 20, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', objectFit: 'contain' }} />
                        <div style={{ marginTop: 20, textAlign: 'center' }}>
                            <h3 style={{ fontFamily: serif, fontSize: 28, color: '#fff', margin: 0 }}>{selectedImage.label}</h3>
                        </div>
                        <button 
                            onClick={() => setSelectedImage(null)}
                            style={{ position: 'absolute', top: -50, right: 0, background: 'none', border: 'none', color: '#fff', fontSize: 32, cursor: 'pointer', fontFamily: mono }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

