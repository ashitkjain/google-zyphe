/**
 * MLSSectionPage
 * Editorial redesign of the MLS Data section.
 * Accent: indigo (#4f46e5)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PropertyData } from '../../../types';

interface Props {
    data: PropertyData;
    renderPalette?: () => React.ReactNode;
}

const serif = "'Instrument Serif', Georgia, serif";
const mono  = "'JetBrains Mono', ui-monospace, monospace";
const ACCENT    = '#4f46e5';
const ACCENT_BG = 'rgba(79,70,229,0.09)';

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionTitleBar({ num, kicker, title, italicWord, accent = ACCENT, right }: {
    num: string; kicker: string; title: string; italicWord?: string; accent?: string; right?: React.ReactNode;
}) {
    const parts = italicWord && title.includes(italicWord) ? title.split(italicWord) : null;
    return (
        <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' as const }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 11, color: accent, padding: '2px 7px', borderRadius: 4, background: `${accent}1a`, fontWeight: 700 }}>{num}</span>
                    <span style={{ width: 24, height: 1, background: accent, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color: accent, textTransform: 'uppercase' as const }}>{kicker}</span>
                </div>
                <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.05, margin: 0, fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                    {parts ? <>{parts[0]}<em style={{ color: accent, fontStyle: 'italic' }}>{italicWord}</em>{parts[1]}</> : title}
                </h2>
            </div>
            {right}
        </div>
    );
}

function StatTile({ label, value, unit, hint, color = '#0f172a' }: {
    label: string; value: string | number; unit?: string; hint?: string; color?: string;
}) {
    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: serif, fontSize: 24, fontWeight: 400, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
                {unit && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{unit}</span>}
            </div>
            {hint && <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>{hint}</div>}
        </div>
    );
}

function SpecBlock({ title, icon, rows, accent = ACCENT }: {
    title: string; icon: string; rows: Array<{ k: string; v: string }>; accent?: string;
}) {
    if (!rows.length) return null;
    return (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: `${accent}18`, color: accent, display: 'grid', placeItems: 'center', fontSize: 12 }}>{icon}</div>
                <div style={{ fontSize: 10.5, letterSpacing: '0.14em', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const }}>{title}</div>
            </div>
            {rows.map(r => (
                <div key={r.k} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 12.5 }}>
                    <div style={{ flex: '0 0 110px', fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const }}>{r.k}</div>
                    <div style={{ color: '#0f172a', fontWeight: 500 }}>{r.v}</div>
                </div>
            ))}
        </div>
    );
}

function StatusRow({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const }}>{label}</span>
            <span style={{ color: color || '#0f172a', fontWeight: 600, fontFamily: mono, fontSize: 11.5 }}>{value}</span>
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n?: number | null, prefix = '$'): string {
    if (!n) return '—';
    if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${prefix}${(n / 1000).toFixed(0)}K`;
    return `${prefix}${n.toLocaleString()}`;
}

function parseMulti(raw?: string | string[] | null): string {
    if (!raw) return '';
    if (Array.isArray(raw)) return raw.join(', ');
    return String(raw);
}

function formatListedDate(raw?: string | number | null): string {
    if (!raw) return '—';
    const d = typeof raw === 'number' ? new Date(raw < 1e12 ? raw * 1000 : raw) : new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function cleanEvent(event: string): string {
    // Strip any trailing parenthetical numbers the API appends e.g. "Listed For Sale (0.507...)"
    return event.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function priceEventColor(event: string): string {
    const e = event.toLowerCase();
    if (e.includes('reduc') || e.includes('cut')) return '#dc2626';
    if (e.includes('sold')) return '#16a34a';
    if (e.includes('list')) return ACCENT;
    if (e.includes('pend')) return '#d97706';
    return '#64748b';
}

// ── Photo Modal ───────────────────────────────────────────────────────────────

function PhotoModal({ images, startIndex, onClose }: {
    images: string[];
    startIndex: number;
    onClose: () => void;
}) {
    const [active, setActive] = useState(startIndex);
    const thumbRef = useRef<HTMLDivElement>(null);

    const prev = useCallback(() => setActive(i => (i - 1 + images.length) % images.length), [images.length]);
    const next = useCallback(() => setActive(i => (i + 1) % images.length), [images.length]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'ArrowRight') next();
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [prev, next, onClose]);

    useEffect(() => {
        const el = thumbRef.current?.children[active] as HTMLElement | undefined;
        el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, [active]);

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {/* Header */}
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>{active + 1} / {images.length}</span>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            {/* Main image */}
            <div onClick={e => e.stopPropagation()} style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 70px 16px', minHeight: 0 }}>
                <img src={images[active]} alt={`Photo ${active + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
            </div>
            {/* Prev / Next */}
            {(['prev', 'next'] as const).map(dir => (
                <button key={dir} onClick={e => { e.stopPropagation(); dir === 'prev' ? prev() : next(); }} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [dir === 'prev' ? 'left' : 'right']: 16, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', fontSize: 20, display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>{dir === 'prev' ? '‹' : '›'}</button>
            ))}
            {/* Thumbnail strip */}
            <div ref={thumbRef} onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 20px', width: '100%', scrollbarWidth: 'none' }}>
                {images.map((img, i) => (
                    <div key={i} onClick={() => setActive(i)} style={{ flexShrink: 0, width: 80, height: 56, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: i === active ? `2px solid ${ACCENT}` : '2px solid transparent', opacity: i === active ? 1 : 0.55, transition: 'opacity 0.15s, border-color 0.15s' }}>
                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export const MLSSectionPage: React.FC<Props> = ({ data }) => {
    const rf = data.resoFacts;
    const [modalIndex, setModalIndex] = useState<number | null>(null);

    const images      = data.images || [];
    const priceHistory = data.priceHistory || [];
    const hasImages   = images.length > 0;
    const hasPriceHistory = priceHistory.length > 0;

    // Section numbering (price history always last)
    let sn = 1;
    const sec = {
        remarks:      String(sn++).padStart(2, '0'),
        gallery:      hasImages ? String(sn++).padStart(2, '0') : null,
        specs:        String(sn++).padStart(2, '0'),
        priceHistory: hasPriceHistory ? String(sn++).padStart(2, '0') : null,
    };

    // ── Spec rows ────────────────────────────────────────────────────────────

    const structureRows = [
        { k: 'Style',        v: rf?.architecturalStyle || '—' },
        { k: 'Stories',      v: rf?.stories != null ? String(rf.stories) : '—' },
        { k: 'Construction', v: rf?.constructionMaterials || '—' },
        { k: 'Flooring',     v: rf?.flooring || '—' },
        { k: 'Roof',         v: rf?.roofType || '—' },
        { k: 'Foundation',   v: rf?.foundationDetails || '—' },
        { k: 'Basement',     v: rf?.basement || '—' },
        { k: 'Condition',    v: rf?.propertyCondition || '—' },
    ].filter(r => r.v && r.v !== '—');

    const parkingRows = [
        { k: 'Garage',   v: rf?.garageParkingCapacity != null ? String(rf.garageParkingCapacity) : '—' },
        { k: 'Parking',  v: parseMulti(rf?.parkingFeatures) || '—' },
    ].filter(r => r.v && r.v !== '—');

    const interiorRows = [
        { k: 'Heating',    v: rf?.heating || '—' },
        { k: 'Cooling',    v: rf?.cooling || '—' },
        { k: 'Appliances', v: rf?.appliances || '—' },
        { k: 'Features',   v: parseMulti(rf?.interiorFeatures) || '—' },
        { k: 'Rooms',      v: rf?.roomTypes || rf?.rooms || '—' },
        { k: 'Laundry',    v: rf?.laundryFeatures || '—' },
        { k: 'Fireplace',  v: rf?.fireplaceFeatures || '—' },
        { k: 'Windows',    v: rf?.windowFeatures || '—' },
        { k: 'Security',   v: rf?.securityFeatures || '—' },
    ].filter(r => r.v && r.v !== '—');

    const utilityRows = [
        { k: 'Utilities', v: rf?.utilities || '—' },
        { k: 'Electric',  v: parseMulti(rf?.electric) || '—' },
        { k: 'Sewer',     v: rf?.sewer || '—' },
        { k: 'Water',     v: rf?.waterSource || '—' },
    ].filter(r => r.v && r.v !== '—');

    const lotRows = [
        { k: 'Lot Size',    v: data.lotSize || (data.lotAreaValue ? `${data.lotAreaValue.toLocaleString()} sqft` : '—') },
        { k: 'Lot Features', v: rf?.lotFeatures || '—' },
        { k: 'Exterior',    v: rf?.exteriorFeatures || '—' },
        { k: 'Fencing',     v: rf?.fencing || '—' },
        { k: 'Zoning',      v: rf?.zoningDescription || '—' },
    ].filter(r => r.v && r.v !== '—');

    const financialRows = [
        { k: 'HOA Name',     v: data.hoa?.name || '—' },
        { k: 'HOA Fee',      v: data.hoa?.fee ? `$${data.hoa.fee}/mo` : (rf?.feesAndDues ? `$${rf.feesAndDues}/mo` : '—') },
        { k: 'HOA Includes', v: data.hoa?.feeIncludes || '—' },
        { k: 'Tax Rate',     v: data.propertyTaxRate != null ? `${data.propertyTaxRate}%` : '—' },
        { k: 'Insurance',    v: data.annualHomeownersInsurance != null ? fmt(data.annualHomeownersInsurance, '$') + '/yr' : '—' },
        { k: 'Units',        v: rf?.numberOfUnitsInCommunity != null ? String(rf.numberOfUnitsInCommunity) : '—' },
    ].filter(r => r.v && r.v !== '—');

    // ── Highlight pills (derived from description) ────────────────────────────

    const desc = data.description || '';
    const garageLabel = rf?.garageParkingCapacity
        ? `🚗 ${rf.garageParkingCapacity}-car garage`
        : '🚗 Garage';

    const highlightWords: [string, string][] = [
        ['pool',      '🏊 Pool'],
        ['garage',    garageLabel],
        ['hardwood',  '🪵 Hardwood floors'],
        ['kitchen',   '🍳 Kitchen'],
        ['school',    '🏫 Schools nearby'],
        ['perg',      '🌿 Pergola'],
        ['corner',    '📐 Corner lot'],
        ['downtown',  '🏙 Downtown-close'],
        ['fireplace', '🔥 Fireplace'],
        ['quartz',    '✦ Quartz counters'],
    ];
    const pills = highlightWords
        .filter(([kw]) => desc.toLowerCase().includes(kw))
        .map(([, label]) => label);

    // ── Derived values ────────────────────────────────────────────────────────

    const ppsf = data.pricePerSqFt ||
        (data.price && data.livingAreaValue ? Math.round(data.price / data.livingAreaValue) : null);
    const mlsSource = data.attribution?.mlsName || rf?.mlsid ? `Source: ${data.attribution?.mlsName || 'MLS'}` : 'Source: MLS';
    const statusColor = (s?: string) => {
        if (!s) return '#64748b';
        const sl = s.toLowerCase();
        if (sl.includes('active')) return '#16a34a';
        if (sl.includes('pend')) return '#d97706';
        if (sl.includes('sold') || sl.includes('close')) return '#dc2626';
        return '#64748b';
    };

    return (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* ── At-a-glance row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                <StatTile label="List Price"     value={fmt(data.price)}                        hint="MLS list price"    color="#16a34a" />
                <StatTile label="Living Area"    value={data.livingAreaValue?.toLocaleString() ?? '—'} unit={data.livingAreaValue ? 'sqft' : undefined} hint="interior sqft" />
                <StatTile label="Days on Market" value={data.daysOnMarket ?? '—'}               hint={data.daysOnMarket != null && data.daysOnMarket <= 14 ? '🔥 Moving fast' : undefined} color={ACCENT} />
                <StatTile label="Price / Sqft"   value={ppsf ? `$${ppsf}` : '—'}               hint="per living sqft" />
                <StatTile label="Beds · Baths"   value={`${data.bedrooms ?? '—'} · ${data.bathrooms ?? '—'}`} />
                <StatTile label="Year Built"     value={data.yearBuilt ?? '—'} />
                <StatTile label="Lot Size"       value={data.lotAreaValue?.toLocaleString() ?? (data.lotSize || '—')} unit={data.lotAreaValue ? 'sqft' : undefined} />
            </div>

            {/* ── Section 01 — Listing Remarks ── */}
            <div>
                <SectionTitleBar num={sec.remarks} kicker="Listing Remarks" title="The story the agent tells" italicWord="story" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
                    {/* Description card */}
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24, position: 'relative' }}>
                        <div style={{ fontFamily: serif, fontSize: 48, color: `${ACCENT}55`, position: 'absolute', top: 10, left: 18, lineHeight: 1 }}>"</div>
                        {desc ? (
                            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: 0, paddingLeft: 16, textWrap: 'pretty' as any }}>{desc}</p>
                        ) : (
                            <p style={{ fontSize: 13.5, color: '#94a3b8', fontStyle: 'italic', margin: 0, paddingLeft: 16 }}>No listing remarks available.</p>
                        )}
                        {pills.length > 0 && (
                            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                                {pills.map(p => (
                                    <span key={p} style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0' }}>{p}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: `linear-gradient(180deg, ${ACCENT_BG} 0%, #fff 100%)`, borderRadius: 14, border: '1px solid #e2e8f0', padding: 18 }}>
                            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' as const, marginBottom: 10 }}>Listing Status</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(rf?.mlsid || data.attribution?.mlsId) && (
                                    <StatusRow label="MLS #" value={rf?.mlsid || data.attribution?.mlsId || ''} />
                                )}
                                {data.homeStatus && (
                                    <StatusRow label="Status" value={data.homeStatus} color={statusColor(data.homeStatus)} />
                                )}
                                {data.homeType && <StatusRow label="Type" value={data.homeType} />}
                                {data.listedDate && <StatusRow label="Listed" value={formatListedDate(data.listedDate)} />}
                                {data.daysOnMarket != null && <StatusRow label="Days Listed" value={String(data.daysOnMarket)} />}
                                {data.favoriteCount != null && <StatusRow label="Saves" value={String(data.favoriteCount)} />}
                            </div>
                        </div>

                        {/* Attribution */}
                        {data.attribution && (data.attribution.listingAgentName || data.attribution.brokerageName) && (
                            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 8 }}>Listed By</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {data.attribution.listingAgentName && (
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{data.attribution.listingAgentName}</div>
                                    )}
                                    {data.attribution.brokerageName && (
                                        <div style={{ fontSize: 11.5, color: '#64748b' }}>{data.attribution.brokerageName}</div>
                                    )}
                                    {data.attribution.listingAgentNumber && (
                                        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: mono }}>{data.attribution.listingAgentNumber}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Zestimate */}
                        {data.zestimate && (
                            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 8 }}>Zestimate</div>
                                <div style={{ fontFamily: serif, fontSize: 26, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>{fmt(data.zestimate)}</div>
                                {data.rentZestimate && (
                                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>Rent Zestimate: {fmt(data.rentZestimate, '$')}/mo</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Section 02 — Gallery ── */}
            {hasImages && sec.gallery && (
                <div>
                    <SectionTitleBar num={sec.gallery} kicker="Property Images" title="Gallery & exterior" italicWord="exterior"
                        right={<span style={{ fontSize: 11, color: '#94a3b8' }}>{images.length} photos</span>} />
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '200px 200px', gap: 12 }}>
                        {/* Hero */}
                        <div onClick={() => setModalIndex(0)} style={{ gridRow: '1 / 3', borderRadius: 12, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                            <img src={images[0]} alt="property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        {images.slice(1, 5).map((img, i) => {
                            if (i === 3 && images.length > 5) {
                                return (
                                    <div key={i} onClick={() => setModalIndex(4)} style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16, cursor: 'pointer' }}>
                                        <img src={img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.22 }} />
                                        <div style={{ position: 'relative', fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' as const }}>+ {images.length - 4} more</div>
                                        <div style={{ position: 'relative', fontFamily: serif, fontSize: 22, color: '#0f172a', lineHeight: 1.1 }}>View all photos</div>
                                    </div>
                                );
                            }
                            return (
                                <div key={i} onClick={() => setModalIndex(i + 1)} style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                                    <img src={img} alt={`Photo ${i + 2}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Detailed Specs ── */}
            <div>
                <SectionTitleBar num={sec.specs} kicker="Detailed Specifications" title="Everything on the data sheet" italicWord="data"
                    right={<span style={{ fontSize: 11, color: '#94a3b8' }}>◇ {mlsSource}</span>} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {structureRows.length > 0  && <SpecBlock title="Structure"          icon="⌂" rows={structureRows} />}
                    {parkingRows.length > 0    && <SpecBlock title="Parking"            icon="⛟" rows={parkingRows} />}
                    {interiorRows.length > 0   && <SpecBlock title="Interior"           icon="◉" rows={interiorRows} />}
                    {utilityRows.length > 0    && <SpecBlock title="Utilities"          icon="⚡" rows={utilityRows} />}
                    {lotRows.length > 0        && <SpecBlock title="Lot & Outdoor"      icon="✿" rows={lotRows} />}
                    {financialRows.length > 0  && <SpecBlock title="Financial & Fees"   icon="$" rows={financialRows} />}
                </div>
            </div>

            {/* ── Price History (bottom) ── */}
            {hasPriceHistory && sec.priceHistory && (
                <div>
                    <SectionTitleBar num={sec.priceHistory} kicker="Price History" title="How the price has moved" italicWord="moved" />
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {priceHistory.map((item, i) => {
                                const label = cleanEvent(item.event || '');
                                const color = priceEventColor(label);
                                const isLast = i === priceHistory.length - 1;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, paddingBottom: isLast ? 0 : 14, marginBottom: isLast ? 0 : 14, borderBottom: isLast ? 'none' : '1px dashed #f1f5f9' }}>
                                        <div style={{ paddingTop: 3, flexShrink: 0 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                                                <div style={{ fontSize: 12.5, fontWeight: 600, color }}>{label || 'Event'}</div>
                                                {item.price != null && (
                                                    <div style={{ fontFamily: serif, fontSize: 18, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1 }}>{fmt(item.price)}</div>
                                                )}
                                            </div>
                                            {item.date && (
                                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.date}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

        </div>

        {modalIndex !== null && (
            <PhotoModal images={images} startIndex={modalIndex} onClose={() => setModalIndex(null)} />
        )}
        </>
    );
};
