/**
 * RealEstateApiSectionPage
 * Identical layout/UI to MLSSectionPage — sourced from POST /v2/MLSDetail.
 * Accent: indigo (#4f46e5) — same as MLS Data page.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebaseService';
import { APP_CONFIG } from '../../../config';
import { PropertyData } from '../../../types';

interface Props {
    data: PropertyData;
    renderPalette?: () => React.ReactNode;
}

const serif    = "'Instrument Serif', Georgia, serif";
const mono     = "'JetBrains Mono', ui-monospace, monospace";
const ACCENT    = '#4f46e5';
const ACCENT_BG = 'rgba(79,70,229,0.09)';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ── MLSDetail API shape ────────────────────────────────────────────────────────

interface ApiProperty {
    bedroomsTotal?: number;
    bathroomsTotal?: number;
    bathroomsHalf?: number | null;
    bathroomsText?: string;
    garageSpaces?: number;
    hasBasement?: boolean;
    hasPool?: boolean;
    isCityView?: boolean;
    isMountainView?: boolean;
    isParkView?: boolean;
    isWaterfront?: boolean;
    isWaterview?: boolean;
    latitude?: number;
    longitude?: number;
    livingArea?: number;
    lotSizeSquareFeet?: number;
    neighborhood?: string;
    propertyType?: string;
    propertySubType?: string;
    stories?: number;
    subdivisionName?: string;
    yearBuilt?: number;
    associationFee?: number | null;
}

interface ApiHomeDetails {
    appliances?: string[];
    associationFeeFrequency?: string | null;
    cooling?: string;
    directions?: string;
    exteriorFeatures?: string | null;
    fireplacesTotal?: number;
    fireplaceYn?: boolean;
    flooring?: string;
    heating?: string;
    lotFeatures?: string | null;
    lotSizeAcres?: string;
    lotSizeArea?: string;
    roof?: string;
    sewer?: string;
    taxAmount?: number | null;
    watersource?: string;
    zoning?: string | null;
}

interface ApiAgent {
    fullName?: string;
    email?: string;
    phone?: string;
    mlsAgentId?: string;
}

interface ApiOffice {
    name?: string;
    phone?: string;
    email?: string;
    websiteUrl?: string;
}

interface ApiOpenHouse {
    openHouseDate?: string;
    openHouseStartTime?: string;
    openHouseEndTime?: string;
    openHouseStatus?: string;
    openHouseRemarks?: string;
}

interface MlsListing {
    listingId?: number;
    mlsNumber?: string;
    mlsBoardCode?: string;
    customStatus?: string;
    standardStatus?: string;
    daysOnMarket?: number;
    listPrice?: number;
    pricePerSqFt?: number;
    listingContractDate?: string;
    soldDate?: string | null;
    modificationTimestamp?: string;
    priceChangeTimestamp?: string;
    publicRemarks?: string;
    courtesyOf?: string;
    hasPhotos?: boolean;
    url?: string;
    address?: { unparsedAddress?: string; city?: string; stateOrProvince?: string; zipCode?: string; countyOrParish?: string };
    property?: ApiProperty;
    homedetails?: ApiHomeDetails;
    schools?: { elementarySchool?: string | null; middleOrJuniorSchool?: string | null; highSchool?: string | null; schoolDistrict?: string | null };
    media?: { primaryListingImageUrl?: string; photosCount?: string | number; photosList?: Array<{ highRes?: string; midRes?: string; lowRes?: string }> };
    listingAgent?: ApiAgent;
    listingOffice?: ApiOffice;
    openHouses?: ApiOpenHouse[];
}

interface CachedData { mls: MlsListing; fetchedAt: Date; }

// ── Cache ──────────────────────────────────────────────────────────────────────

function makeCacheKey(mlsId: string): string {
    return mlsId.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 100);
}

async function loadFromCache(cacheKey: string): Promise<CachedData | null> {
    try {
        const ref  = doc(db, 'realestateapi_cache', cacheKey);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        const d = snap.data() as any;
        const fetchedAt: Date = d.fetchedAt instanceof Timestamp ? d.fetchedAt.toDate() : new Date(d.fetchedAt);
        if (Date.now() - fetchedAt.getTime() > CACHE_TTL_MS || !d.mls) return null;
        return { mls: d.mls, fetchedAt };
    } catch { return null; }
}

async function saveToCache(cacheKey: string, mls: MlsListing): Promise<void> {
    try {
        const ref = doc(db, 'realestateapi_cache', cacheKey);
        await setDoc(ref, { mls, fetchedAt: Timestamp.now() });
    } catch { /* non-blocking */ }
}

// ── API ────────────────────────────────────────────────────────────────────────

async function fetchMlsDetail(address: string): Promise<MlsListing | null> {
    const key  = APP_CONFIG.realEstateApi.key;
    const base = APP_CONFIG.realEstateApi.baseUrl;
    const res  = await fetch(`${base}/MLSDetail`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body:    JSON.stringify({ address }),
    });
    if (!res.ok) throw new Error(`MLSDetail ${res.status}: ${await res.text().catch(() => '')}`);
    const json = await res.json();
    return (Array.isArray(json.data) ? json.data[0] : json.data) ?? null;
}

// ── Shared primitives (identical to MLSSectionPage) ───────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n?: number | null, prefix = '$'): string {
    if (!n) return '—';
    if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)     return `${prefix}${(n / 1000).toFixed(0)}K`;
    return `${prefix}${n.toLocaleString()}`;
}

function formatDate(raw?: string | null): string {
    if (!raw) return '—';
    try { return new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return raw; }
}

function formatTime(raw?: string | null): string {
    if (!raw) return '';
    try { return new Date(raw).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
    catch { return ''; }
}

function asArr(v?: string | string[] | null): string[] {
    if (!v) return [];
    return Array.isArray(v) ? v.filter(Boolean) : [v];
}

function join(v?: string | string[] | null): string {
    return asArr(v).join(', ') || '—';
}

function statusColor(s?: string): string {
    if (!s) return '#64748b';
    const sl = s.toLowerCase();
    if (sl.includes('active')) return '#16a34a';
    if (sl.includes('pend'))   return '#d97706';
    if (sl.includes('sold') || sl.includes('close')) return '#dc2626';
    return '#64748b';
}

// ── Photo Modal (identical to MLSSectionPage) ─────────────────────────────────

function PhotoModal({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
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
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
                <span style={{ fontFamily: mono, fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em' }}>{active + 1} / {images.length}</span>
                <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            <div onClick={e => e.stopPropagation()} style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 70px 16px', minHeight: 0 }}>
                <img src={images[active]} alt={`Photo ${active + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
            </div>
            {(['prev', 'next'] as const).map(dir => (
                <button key={dir} onClick={e => { e.stopPropagation(); dir === 'prev' ? prev() : next(); }}
                    style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [dir === 'prev' ? 'left' : 'right']: 16, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', fontSize: 20, display: 'grid', placeItems: 'center', backdropFilter: 'blur(4px)' }}>
                    {dir === 'prev' ? '‹' : '›'}
                </button>
            ))}
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

// ── Main component ─────────────────────────────────────────────────────────────

export function RealEstateApiSectionPage({ data }: Props) {
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState<string | null>(null);
    const [mls, setMls]             = useState<MlsListing | null>(null);
    const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [modalIndex, setModalIndex] = useState<number | null>(null);

    const address  = data.address || '';
    const mlsId    = data.resoFacts?.mlsid || '';
    const cacheKey = makeCacheKey(mlsId || address);

    useEffect(() => {
        if (!address) return;
        let cancelled = false;
        async function load(bypass = false) {
            setLoading(true); setError(null);
            try {
                if (!bypass) {
                    const cached = await loadFromCache(cacheKey);
                    if (cached && !cancelled) {
                        setMls(cached.mls); setFetchedAt(cached.fetchedAt);
                        setLoading(false); return;
                    }
                }
                const result = await fetchMlsDetail(address);
                if (!cancelled) {
                    setMls(result); setFetchedAt(new Date());
                    if (result) await saveToCache(cacheKey, result);
                }
            } catch (e: any) {
                if (!cancelled) setError(e.message || 'Failed to fetch MLS data.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load(refreshKey > 0);
        return () => { cancelled = true; };
    }, [cacheKey, address, refreshKey]);

    // ── Loading / error states ─────────────────────────────────────────────────

    if (loading) return (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 24, marginBottom: 12, display: 'block' }} />
            <div style={{ fontSize: 14 }}>Fetching MLS listing from RealEstateAPI…</div>
        </div>
    );

    if (error) return (
        <div style={{ padding: 28, background: '#fff1f2', borderRadius: 12, border: '1px solid #fecdd3', color: '#9f1239' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />
            {error}
            <button onClick={() => setRefreshKey(k => k + 1)} style={{ marginLeft: 16, fontSize: 12, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
    );

    if (!mls) return (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
            <i className="fa-solid fa-database" style={{ fontSize: 20, marginBottom: 8, display: 'block' }} />
            <div>No MLS listing found for this address.</div>
            <button onClick={() => setRefreshKey(k => k + 1)} style={{ marginTop: 10, fontSize: 12, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Try again</button>
        </div>
    );

    // ── Data extraction ────────────────────────────────────────────────────────

    const p  = mls.property    || {};
    const hd = mls.homedetails || {};

    const photos     = (mls.media?.photosList ?? []).map(ph => ph.highRes).filter(Boolean) as string[];
    const hasImages  = photos.length > 0;
    const desc       = mls.publicRemarks || '';
    const ppsf       = mls.pricePerSqFt;
    const lotSqft    = p.lotSizeSquareFeet ?? (hd.lotSizeArea ? parseFloat(hd.lotSizeArea) : null);
    const mlsSource  = `MLS# ${mls.mlsNumber ?? '—'} · ${mls.mlsBoardCode ?? 'RealEstateAPI'}`;

    // Section numbers
    let sn = 1;
    const sec = {
        remarks:      String(sn++).padStart(2, '0'),
        gallery:      hasImages ? String(sn++).padStart(2, '0') : null,
        specs:        String(sn++).padStart(2, '0'),
        openHouses:   mls.openHouses?.length ? String(sn++).padStart(2, '0') : null,
    };

    // ── Spec rows (same categories as MLSSectionPage) ─────────────────────────

    const structureRows = [
        { k: 'Type',      v: [p.propertyType, p.propertySubType].filter(Boolean).join(' · ') },
        { k: 'Stories',   v: p.stories != null ? String(p.stories) : '' },
        { k: 'Flooring',  v: hd.flooring || '' },
        { k: 'Roof',      v: hd.roof || '' },
        { k: 'Basement',  v: p.hasBasement != null ? (p.hasBasement ? 'Yes' : 'No') : '' },
        { k: 'Fireplaces',v: hd.fireplaceYn ? String(hd.fireplacesTotal || 1) : '' },
        { k: 'Zoning',    v: hd.zoning || '' },
        { k: 'County',    v: mls.address?.countyOrParish || '' },
    ].filter(r => r.v);

    const parkingRows = [
        { k: 'Garage',   v: p.garageSpaces != null ? `${p.garageSpaces} spaces` : '' },
    ].filter(r => r.v);

    const interiorRows = [
        { k: 'Heating',    v: hd.heating || '' },
        { k: 'Cooling',    v: hd.cooling || '' },
        { k: 'Appliances', v: join(hd.appliances) !== '—' ? join(hd.appliances) : '' },
    ].filter(r => r.v);

    const utilityRows = [
        { k: 'Sewer',  v: hd.sewer || '' },
        { k: 'Water',  v: hd.watersource || '' },
    ].filter(r => r.v);

    const lotRows = [
        { k: 'Lot Size',  v: lotSqft ? `${lotSqft.toLocaleString()} sqft` : (hd.lotSizeAcres && hd.lotSizeAcres !== '0' ? `${hd.lotSizeAcres} ac` : '') },
        { k: 'Pool',      v: p.hasPool ? 'Yes' : '' },
        { k: 'Waterfront',v: p.isWaterfront ? 'Yes' : '' },
        { k: 'City View', v: p.isCityView ? 'Yes' : '' },
        { k: 'Mtn View',  v: p.isMountainView ? 'Yes' : '' },
        { k: 'Lot Features', v: hd.lotFeatures || '' },
        { k: 'Exterior',  v: hd.exteriorFeatures || '' },
    ].filter(r => r.v);

    const financialRows = [
        { k: 'HOA Fee',   v: p.associationFee != null ? `$${p.associationFee}/${hd.associationFeeFrequency || 'mo'}` : '' },
        { k: 'Annual Tax',v: hd.taxAmount != null ? fmt(hd.taxAmount, '$') : '' },
        { k: 'Subdivision',v: p.subdivisionName && p.subdivisionName !== 'Not Listed' ? p.subdivisionName : '' },
        { k: 'Neighborhood',v: p.neighborhood && p.neighborhood !== 'Not Listed' ? p.neighborhood : '' },
    ].filter(r => r.v);

    const schoolRows = [
        { k: 'District',  v: mls.schools?.schoolDistrict || '' },
        { k: 'Elementary',v: mls.schools?.elementarySchool || '' },
        { k: 'Middle',    v: mls.schools?.middleOrJuniorSchool || '' },
        { k: 'High',      v: mls.schools?.highSchool || '' },
    ].filter(r => r.v);

    // ── Highlight pills (same logic as MLSSectionPage) ────────────────────────

    const highlightWords: [string, string][] = [
        ['pool',      '🏊 Pool'],
        ['garage',    p.garageSpaces ? `🚗 ${p.garageSpaces}-car garage` : '🚗 Garage'],
        ['hardwood',  '🪵 Hardwood floors'],
        ['kitchen',   '🍳 Kitchen'],
        ['school',    '🏫 Schools nearby'],
        ['perg',      '🌿 Pergola'],
        ['corner',    '📐 Corner lot'],
        ['downtown',  '🏙 Downtown-close'],
        ['fireplace', '🔥 Fireplace'],
        ['quartz',    '✦ Quartz counters'],
    ];
    const pills = highlightWords.filter(([kw]) => desc.toLowerCase().includes(kw)).map(([, label]) => label);

    return (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* ── Source + refresh ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setRefreshKey(k => k + 1)}
                    style={{ fontFamily: mono, fontSize: 11, color: ACCENT, background: ACCENT_BG, border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 700 }}>
                    <i className="fa-solid fa-rotate-right" style={{ marginRight: 5 }} />Refresh
                </button>
            </div>

            {/* ── At-a-glance row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                <StatTile label="List Price"     value={fmt(mls.listPrice)}                              hint="MLS list price"    color="#16a34a" />
                <StatTile label="Living Area"    value={p.livingArea?.toLocaleString() ?? '—'}           unit={p.livingArea ? 'sqft' : undefined} hint="interior sqft" />
                <StatTile label="Days on Market" value={mls.daysOnMarket ?? '—'}                         hint={mls.daysOnMarket != null && mls.daysOnMarket <= 14 ? '🔥 Moving fast' : undefined} color={ACCENT} />
                <StatTile label="Price / Sqft"   value={ppsf ? `$${parseFloat(String(ppsf)).toFixed(0)}` : '—'} hint="per living sqft" />
                <StatTile label="Beds · Baths"   value={`${p.bedroomsTotal ?? '—'} · ${p.bathroomsTotal ?? '—'}`} />
                <StatTile label="Year Built"     value={p.yearBuilt ?? '—'} />
                <StatTile label="Lot Size"       value={lotSqft?.toLocaleString() ?? '—'}               unit={lotSqft ? 'sqft' : undefined} />
            </div>

            {/* ── Section 01 — Listing Remarks ── */}
            <div>
                <SectionTitleBar num={sec.remarks} kicker="Listing Remarks" title="The story the agent tells" italicWord="story" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
                    {/* Description */}
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 24, position: 'relative' }}>
                        <div style={{ fontFamily: serif, fontSize: 48, color: `${ACCENT}55`, position: 'absolute', top: 10, left: 18, lineHeight: 1 }}>"</div>
                        {desc ? (
                            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: 0, paddingLeft: 16, textWrap: 'pretty' as any }}>{desc}</p>
                        ) : (
                            <p style={{ fontSize: 13.5, color: '#94a3b8', fontStyle: 'italic', margin: 0, paddingLeft: 16 }}>No listing remarks available.</p>
                        )}
                        {pills.length > 0 && (
                            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                                {pills.map(pill => (
                                    <span key={pill} style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, border: '1px solid #e2e8f0' }}>{pill}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: `linear-gradient(180deg, ${ACCENT_BG} 0%, #fff 100%)`, borderRadius: 14, border: '1px solid #e2e8f0', padding: 18 }}>
                            <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' as const, marginBottom: 10 }}>Listing Status</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {mls.mlsNumber && <StatusRow label="MLS #" value={mls.mlsNumber} />}
                                {mls.mlsBoardCode && <StatusRow label="Board" value={mls.mlsBoardCode} />}
                                {(mls.standardStatus || mls.customStatus) && (
                                    <StatusRow label="Status" value={mls.standardStatus || mls.customStatus || ''} color={statusColor(mls.standardStatus)} />
                                )}
                                {p.propertySubType && <StatusRow label="Type" value={p.propertySubType} />}
                                {mls.listingContractDate && <StatusRow label="Listed" value={formatDate(mls.listingContractDate)} />}
                                {mls.daysOnMarket != null && <StatusRow label="Days Listed" value={String(mls.daysOnMarket)} />}
                            </div>
                        </div>

                        {/* Listed by */}
                        {(mls.listingAgent?.fullName || mls.listingOffice?.name) && (
                            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 8 }}>Listed By</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {mls.listingAgent?.fullName && (
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{mls.listingAgent.fullName}</div>
                                    )}
                                    {mls.listingOffice?.name && (
                                        <div style={{ fontSize: 11.5, color: '#64748b' }}>{mls.listingOffice.name}</div>
                                    )}
                                    {mls.listingAgent?.phone && (
                                        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: mono }}>{mls.listingAgent.phone}</div>
                                    )}
                                    {mls.courtesyOf && (
                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>Courtesy of {mls.courtesyOf}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Source link */}
                        {mls.url && (
                            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 18 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const, marginBottom: 8 }}>Source</div>
                                <a href={mls.url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 12, color: ACCENT, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10 }} />
                                    View on Realty.com
                                </a>
                                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 6, fontFamily: mono }}>
                                    via RealEstateAPI.com
                                    {fetchedAt && ` · ${fetchedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Section 02 — Gallery ── */}
            {hasImages && sec.gallery && (
                <div>
                    <SectionTitleBar num={sec.gallery} kicker="Property Images" title="Gallery"
                        right={<span style={{ fontSize: 11, color: '#94a3b8' }}>{photos.length} photos</span>} />
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '200px 200px', gap: 12 }}>
                        {/* Hero */}
                        <div onClick={() => setModalIndex(0)} style={{ gridRow: '1 / 3', borderRadius: 12, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}>
                            <img src={photos[0]} alt="property" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        {photos.slice(1, 5).map((img, i) => {
                            if (i === 3 && photos.length > 5) {
                                return (
                                    <div key={i} onClick={() => setModalIndex(4)} style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 16, cursor: 'pointer' }}>
                                        <img src={img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.22 }} />
                                        <div style={{ position: 'relative', fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' as const }}>+ {photos.length - 4} more</div>
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

            {/* ── Section 03 — Detailed Specifications ── */}
            <div>
                <SectionTitleBar num={sec.specs} kicker="Detailed Specifications" title="The Data Sheet" italicWord="Data"
                    right={<span style={{ fontSize: 11, color: '#94a3b8' }}>◇ {mlsSource}</span>} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {structureRows.length > 0  && <SpecBlock title="Structure"        icon="⌂" rows={structureRows} />}
                    {parkingRows.length > 0    && <SpecBlock title="Parking"          icon="⛟" rows={parkingRows} />}
                    {interiorRows.length > 0   && <SpecBlock title="Interior"         icon="◉" rows={interiorRows} />}
                    {utilityRows.length > 0    && <SpecBlock title="Utilities"        icon="⚡" rows={utilityRows} />}
                    {lotRows.length > 0        && <SpecBlock title="Lot & Outdoor"    icon="✿" rows={lotRows} />}
                    {financialRows.length > 0  && <SpecBlock title="Financial & Fees" icon="$" rows={financialRows} />}
                    {schoolRows.length > 0     && <SpecBlock title="Schools"          icon="🏫" rows={schoolRows} />}
                </div>
            </div>

            {/* ── Section 04 — Open Houses ── */}
            {mls.openHouses && mls.openHouses.length > 0 && sec.openHouses && (
                <div>
                    <SectionTitleBar num={sec.openHouses} kicker="Open Houses" title="Scheduled showings" italicWord="showings" />
                    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {mls.openHouses.map((oh, i) => {
                                const isLast = i === (mls.openHouses?.length ?? 0) - 1;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, paddingBottom: isLast ? 0 : 14, marginBottom: isLast ? 0 : 14, borderBottom: isLast ? 'none' : '1px dashed #f1f5f9' }}>
                                        <div style={{ paddingTop: 3, flexShrink: 0 }}>
                                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: ACCENT }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                                                <div style={{ fontSize: 12.5, fontWeight: 600, color: ACCENT }}>
                                                    {formatDate(oh.openHouseDate)}
                                                    {oh.openHouseStartTime && ` · ${formatTime(oh.openHouseStartTime)}`}
                                                    {oh.openHouseEndTime && ` – ${formatTime(oh.openHouseEndTime)}`}
                                                </div>
                                                {oh.openHouseStatus && (
                                                    <span style={{ fontFamily: mono, fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{oh.openHouseStatus}</span>
                                                )}
                                            </div>
                                            {oh.openHouseRemarks && (
                                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{oh.openHouseRemarks}</div>
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
            <PhotoModal images={photos} startIndex={modalIndex} onClose={() => setModalIndex(null)} />
        )}
        </>
    );
}
