/**
 * RentCastSectionPage
 * Shows active sale listings from RentCast /v1/listings/sale
 * alongside AVM value & rent estimates.
 * Accent: violet (#7c3aed)
 */
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebaseService';
import { APP_CONFIG } from '../../../config';
import { PropertyData } from '../../../types';

interface Props {
    data: PropertyData;
    renderPalette?: () => React.ReactNode;
}

const serif = "'Instrument Serif', Georgia, serif";
const mono  = "'JetBrains Mono', ui-monospace, monospace";
const ACCENT    = '#7c3aed';
const ACCENT_BG = 'rgba(124,58,237,0.09)';

// ── RentCast API types ─────────────────────────────────────────────────────────

interface RCSaleListing {
    id?: string;
    formattedAddress?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    county?: string;
    latitude?: number;
    longitude?: number;
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    lotSize?: number;
    yearBuilt?: number;
    price?: number;
    listingType?: string;
    listedDate?: string;
    removedDate?: string;
    lastSeenDate?: string;
    daysOnMarket?: number;
    status?: string;
    mlsName?: string;
    mlsNumber?: string;
    listingAgent?: { name?: string; email?: string; phone?: string };
    listedBy?: string;
}

interface RCValueEstimate {
    price?: number;
    priceRangeLow?: number;
    priceRangeHigh?: number;
    listingType?: string;
    comps?: any[];
}

interface RCRentEstimate {
    rent?: number;
    rentRangeLow?: number;
    rentRangeHigh?: number;
    listingType?: string;
    comps?: any[];
}

interface RCData {
    listings: RCSaleListing[];
    valueEstimate: RCValueEstimate | null;
    rentEstimate: RCRentEstimate | null;
    fetchedAt: Date;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionTitleBar({ num, kicker, title, italicWord, right }: {
    num: string; kicker: string; title: string; italicWord?: string; right?: React.ReactNode;
}) {
    const parts = italicWord && title.includes(italicWord) ? title.split(italicWord) : null;
    return (
        <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' as const }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 11, color: ACCENT, padding: '2px 7px', borderRadius: 4, background: `${ACCENT}1a`, fontWeight: 700 }}>{num}</span>
                    <span style={{ width: 24, height: 1, background: ACCENT, display: 'inline-block' }} />
                    <span style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' as const }}>{kicker}</span>
                </div>
                <h2 style={{ fontFamily: serif, fontSize: 30, lineHeight: 1.05, margin: 0, fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                    {parts ? <>{parts[0]}<em style={{ color: ACCENT, fontStyle: 'italic' }}>{italicWord}</em>{parts[1]}</> : title}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n?: number | null, prefix = '$'): string {
    if (n == null) return '—';
    if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${prefix}${(n / 1000).toFixed(0)}K`;
    return `${prefix}${n.toLocaleString()}`;
}

function fmtDate(raw?: string | null): string {
    if (!raw) return '—';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusColor(s?: string): string {
    if (!s) return '#64748b';
    const sl = s.toLowerCase();
    if (sl.includes('active')) return '#16a34a';
    if (sl.includes('pend')) return '#d97706';
    if (sl.includes('sold') || sl.includes('close')) return '#dc2626';
    return '#64748b';
}

function statusBg(s?: string): string {
    if (!s) return 'rgba(100,116,139,0.1)';
    const sl = s.toLowerCase();
    if (sl.includes('active')) return 'rgba(22,163,74,0.1)';
    if (sl.includes('pend')) return 'rgba(217,119,6,0.1)';
    return 'rgba(100,116,139,0.1)';
}

// ── Firestore cache ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — listings data changes more often

async function loadFromCache(zpid: string): Promise<RCData | null> {
    try {
        const ref = doc(db, 'properties', zpid, 'analysis', 'rentcast_sale_listings');
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        const d = snap.data();
        const fetchedAt: Date = d.fetchedAt instanceof Timestamp ? d.fetchedAt.toDate() : new Date(d.fetchedAt);
        if (Date.now() - fetchedAt.getTime() > CACHE_TTL_MS) return null;
        return {
            listings: d.listings ?? [],
            valueEstimate: d.valueEstimate ?? null,
            rentEstimate: d.rentEstimate ?? null,
            fetchedAt,
        };
    } catch {
        return null;
    }
}

async function saveToCache(zpid: string, data: Omit<RCData, 'fetchedAt'>): Promise<void> {
    try {
        const ref = doc(db, 'properties', zpid, 'analysis', 'rentcast_sale_listings');
        await setDoc(ref, { ...data, fetchedAt: Timestamp.now() });
    } catch (e) {
        console.warn('[RentCast] cache save failed', e);
    }
}

// ── Listing card ──────────────────────────────────────────────────────────────

const ListingCard: React.FC<{ listing: RCSaleListing; mapsKey: string }> = ({ listing, mapsKey }) => {
    const ppsf = listing.price && listing.squareFootage
        ? Math.round(listing.price / listing.squareFootage)
        : null;

    const streetViewAddr = encodeURIComponent(listing.formattedAddress || `${listing.addressLine1}, ${listing.city}, ${listing.state}`);
    const streetViewUrl  = mapsKey
        ? `https://maps.googleapis.com/maps/api/streetview?size=480x300&location=${streetViewAddr}&fov=90&pitch=5&key=${mapsKey}`
        : null;

    const specCols: Array<{ k: string; v: string }> = [
        listing.propertyType             ? { k: 'Type',         v: listing.propertyType }                                     : null,
        listing.lotSize != null          ? { k: 'Lot Size',     v: listing.lotSize >= 43560 ? `${(listing.lotSize/43560).toFixed(2)} ac` : `${listing.lotSize.toLocaleString()} sqft` } : null,
        listing.yearBuilt != null        ? { k: 'Year Built',   v: String(listing.yearBuilt) }                                : null,
        listing.daysOnMarket != null     ? { k: 'Days on Mkt',  v: `${listing.daysOnMarket}${listing.daysOnMarket <= 14 ? ' 🔥' : ''}` } : null,
        listing.listedDate               ? { k: 'Listed',       v: fmtDate(listing.listedDate) }                              : null,
        listing.mlsName                  ? { k: 'MLS',          v: `${listing.mlsName}${listing.mlsNumber ? ` #${listing.mlsNumber}` : ''}` } : null,
        listing.listingAgent?.name       ? { k: 'Agent',        v: listing.listingAgent.name }                                : null,
        listing.listingAgent?.phone      ? { k: 'Phone',        v: listing.listingAgent.phone }                               : null,
        listing.listedBy                 ? { k: 'Brokerage',    v: listing.listedBy }                                         : null,
    ].filter(Boolean) as Array<{ k: string; v: string }>;

    return (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>

            {/* ── Photo panel ── */}
            <div style={{ flexShrink: 0, width: 300, position: 'relative', background: '#f1f5f9' }}>
                {streetViewUrl ? (
                    <img
                        src={streetViewUrl}
                        alt={listing.addressLine1 || ''}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : (
                    <div style={{ width: '100%', height: '100%', minHeight: 200, display: 'grid', placeItems: 'center', color: '#cbd5e1', fontSize: 28 }}>🏠</div>
                )}
                {listing.status && (
                    <span style={{
                        position: 'absolute', top: 12, left: 12,
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const,
                        padding: '3px 9px', borderRadius: 999,
                        color: statusColor(listing.status), background: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    }}>
                        {listing.status}
                    </span>
                )}
            </div>

            {/* ── Content panel ── */}
            <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

                {/* Address + price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                        <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, color: '#0f172a', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                            {listing.addressLine1 || listing.formattedAddress}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                            {[listing.city, listing.state, listing.zipCode].filter(Boolean).join(', ')}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                        <div style={{ fontFamily: serif, fontSize: 28, color: ACCENT, letterSpacing: '-0.02em', lineHeight: 1 }}>
                            {fmt(listing.price)}
                        </div>
                        {ppsf && (
                            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>${ppsf} / sqft</div>
                        )}
                    </div>
                </div>

                {/* Key stats strip */}
                <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    {[
                        listing.bedrooms  != null ? { icon: '🛏',  val: `${listing.bedrooms} bd` }   : null,
                        listing.bathrooms != null ? { icon: '🚿',  val: `${listing.bathrooms} ba` }  : null,
                        listing.squareFootage != null ? { icon: '📐', val: `${listing.squareFootage.toLocaleString()} sqft` } : null,
                    ].filter(Boolean).map((s, i, arr) => (
                        <div key={i} style={{
                            flex: 1, padding: '10px 0', textAlign: 'center' as const,
                            borderRight: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
                            background: '#fafafa',
                        }}>
                            <div style={{ fontSize: 14 }}>{s!.icon}</div>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{s!.val}</div>
                        </div>
                    ))}
                </div>

                {/* Spec grid */}
                {specCols.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
                        {specCols.map(r => (
                            <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                                <span style={{ fontSize: 9.5, letterSpacing: '0.12em', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, flexShrink: 0 }}>{r.k}</span>
                                <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 500, textAlign: 'right' as const, fontFamily: r.k === 'Days on Mkt' ? mono : undefined }}>{r.v}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

interface ApiLog {
    label: string;
    url: string;
    status: number | 'network-error';
    body: string;
}

export const RentCastSectionPage: React.FC<Props> = ({ data }) => {
    const [rcData, setRcData] = useState<RCData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
    const [showDebug, setShowDebug] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const zpid = String(data.zpid || '');
    const address = data.address || '';

    useEffect(() => {
        if (!address) {
            setError('No address available for RentCast lookup.');
            setLoading(false);
            return;
        }

        let cancelled = false;

        async function fetch_(bypassCache = false) {
            setLoading(true);
            setError(null);
            setApiLogs([]);

            // Use cache unless bypassing (refresh) or cache is empty (all nulls)
            if (!bypassCache && zpid) {
                const cached = await loadFromCache(zpid);
                const hasData = cached && (cached.listings.length > 0 || cached.valueEstimate || cached.rentEstimate);
                if (hasData && !cancelled) {
                    setRcData(cached!);
                    setLoading(false);
                    return;
                }
            }

            const key = APP_CONFIG.rentcast.key;
            if (!key) {
                setError('RentCast API key not configured. Add VITE_RENTCAST_KEY to .env.local');
                setLoading(false);
                return;
            }

            const base = APP_CONFIG.rentcast.baseUrl;
            const headers = { 'X-Api-Key': key, 'Content-Type': 'application/json' };

            // /listings/sale: try zipCode first (most specific), fallback to city+state
            const listingParams = new URLSearchParams({ limit: '24', status: 'Active' });
            if (data.zipCode) listingParams.set('zipCode', data.zipCode);
            else if (data.city && data.state) {
                listingParams.set('city', data.city);
                listingParams.set('state', data.state);
            } else {
                listingParams.set('address', address);
            }

            const listingsUrl = `${base}/listings/sale?${listingParams}`;
            const valueUrl    = `${base}/avm/value?address=${encodeURIComponent(address)}`;
            const rentUrl     = `${base}/avm/rent/long-term?address=${encodeURIComponent(address)}`;

            const logs: ApiLog[] = [];

            async function safeGet(label: string, url: string) {
                try {
                    const res = await fetch(url, { headers });
                    const body = await res.text();
                    logs.push({ label, url, status: res.status, body });
                    if (res.ok) {
                        try { return JSON.parse(body); } catch { return null; }
                    }
                    return null;
                } catch (e: any) {
                    logs.push({ label, url, status: 'network-error', body: e.message });
                    return null;
                }
            }

            try {
                const [listingsJson, valueJson, rentJson] = await Promise.all([
                    safeGet('listings/sale', listingsUrl),
                    safeGet('avm/value', valueUrl),
                    safeGet('avm/rent/long-term', rentUrl),
                ]);

                if (cancelled) return;

                const listings: RCSaleListing[] = Array.isArray(listingsJson)
                    ? listingsJson
                    : (listingsJson?.data ?? listingsJson?.listings ?? []);
                const valueEstimate: RCValueEstimate | null = valueJson ?? null;
                const rentEstimate: RCRentEstimate | null  = rentJson ?? null;

                setApiLogs(logs);
                const result: RCData = { listings, valueEstimate, rentEstimate, fetchedAt: new Date() };
                setRcData(result);
                if (zpid) saveToCache(zpid, { listings, valueEstimate, rentEstimate });
            } catch (e: any) {
                if (!cancelled) setError(e.message || 'Failed to fetch RentCast data.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetch_(refreshKey > 0);
        return () => { cancelled = true; };
    }, [zpid, address, data.city, data.state, data.zipCode, refreshKey]);

    // ── Derived ──────────────────────────────────────────────────────────────

    const listings = rcData?.listings ?? [];
    const val  = rcData?.valueEstimate;
    const rent = rcData?.rentEstimate;

    const statuses = ['All', ...Array.from(new Set(listings.map(l => l.status).filter(Boolean) as string[]))];
    const visible = statusFilter === 'All' ? listings : listings.filter(l => l.status === statusFilter);

    const activePrices = listings.filter(l => l.status?.toLowerCase().includes('active') && l.price).map(l => l.price!);
    const medianPrice = activePrices.length
        ? activePrices.sort((a, b) => a - b)[Math.floor(activePrices.length / 2)]
        : null;
    const avgDom = listings.filter(l => l.daysOnMarket != null).length
        ? Math.round(listings.filter(l => l.daysOnMarket != null).reduce((s, l) => s + l.daysOnMarket!, 0) / listings.filter(l => l.daysOnMarket != null).length)
        : null;

    // ── States ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${ACCENT_BG}`, borderTopColor: ACCENT, animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as const }}>Fetching RentCast listings…</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ background: '#fff0f0', border: '1px solid #fecaca', borderRadius: 12, padding: 24, color: '#dc2626', fontSize: 13 }}>
                <strong>Error:</strong> {error}
                <button onClick={() => setRefreshKey(k => k + 1)} style={{ marginLeft: 16, padding: '4px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    Retry
                </button>
            </div>
        );
    }

    const isEmpty = (rcData?.listings.length ?? 0) === 0 && !rcData?.valueEstimate && !rcData?.rentEstimate;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* ── At-a-glance row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                <StatTile label="Listings Found"  value={listings.length}         hint={`in ${data.city || 'area'}`}       color={ACCENT} />
                <StatTile label="Median List Price" value={fmt(medianPrice)}      hint="active listings" />
                <StatTile label="Avg Days on Mkt"  value={avgDom ?? '—'}          hint="listed properties" />
                <StatTile label="AVM Est. Value"   value={fmt(val?.price)}        hint="RentCast model"   color="#7c3aed" />
                <StatTile label="Est. Rent / mo"   value={fmt(rent?.rent)}        hint="long-term rental" color="#059669" />
                {val?.priceRangeLow && val?.priceRangeHigh && (
                    <StatTile label="Value Range" value={`${fmt(val.priceRangeLow)} – ${fmt(val.priceRangeHigh)}`} hint="AVM confidence" />
                )}
            </div>

            {/* ── AVM cards ── */}
            {(val || rent) && (
                <div>
                    <SectionTitleBar num="01" kicker="AVM Estimates" title="Automated valuation model" italicWord="valuation" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {val && (
                            <div style={{ background: `linear-gradient(180deg, ${ACCENT_BG} 0%, #fff 100%)`, borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: ACCENT, textTransform: 'uppercase' as const, marginBottom: 10 }}>Market Value</div>
                                <div style={{ fontFamily: serif, fontSize: 36, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1 }}>{fmt(val.price)}</div>
                                {val.priceRangeLow && val.priceRangeHigh && (
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Range: {fmt(val.priceRangeLow)} – {fmt(val.priceRangeHigh)}</div>
                                )}
                                {val.comps && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{val.comps.length} comparable sales</div>}
                            </div>
                        )}
                        {rent && (
                            <div style={{ background: 'linear-gradient(180deg, rgba(5,150,105,0.07) 0%, #fff 100%)', borderRadius: 14, border: '1px solid #e2e8f0', padding: 22 }}>
                                <div style={{ fontSize: 9.5, letterSpacing: '0.14em', fontWeight: 700, color: '#059669', textTransform: 'uppercase' as const, marginBottom: 10 }}>Long-Term Rent</div>
                                <div style={{ fontFamily: serif, fontSize: 36, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1 }}>
                                    {fmt(rent.rent)}<span style={{ fontSize: 14, color: '#94a3b8', fontFamily: 'sans-serif' }}>/mo</span>
                                </div>
                                {rent.rentRangeLow && rent.rentRangeHigh && (
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>Range: {fmt(rent.rentRangeLow)} – {fmt(rent.rentRangeHigh)}/mo</div>
                                )}
                                {rent.comps && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{rent.comps.length} rental comps</div>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Sale listings ── */}
            <div>
                <SectionTitleBar
                    num="02"
                    kicker="Active Sale Listings"
                    title="What's on the market"
                    italicWord="market"
                    right={
                        <div style={{ display: 'flex', gap: 6 }}>
                            {statuses.map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)} style={{
                                    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                                    padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                                    background: statusFilter === s ? ACCENT : '#f1f5f9',
                                    color: statusFilter === s ? '#fff' : '#64748b',
                                    transition: 'background 0.15s',
                                }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    }
                />

                {visible.length === 0 ? (
                    <div style={{ background: '#f8fafc', borderRadius: 14, border: '1px dashed #e2e8f0', padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>No listings found</div>
                        <div style={{ fontSize: 12, marginTop: 6 }}>
                            {listings.length > 0 ? `Try "All" filter — ${listings.length} total listings available.` : 'RentCast returned no sale listings for this area.'}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {visible.map((listing, i) => (
                            <ListingCard key={listing.id ?? listing.formattedAddress ?? i} listing={listing} mapsKey={APP_CONFIG.maps.key} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Debug panel ── */}
            {(isEmpty || showDebug) && apiLogs.length > 0 && (
                <div style={{ background: '#0f172a', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const }}>API Debug Log</span>
                        <button onClick={() => setShowDebug(false)} style={{ fontSize: 10, color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>hide</button>
                    </div>
                    {apiLogs.map((log, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                    fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                                    background: log.status === 200 ? '#166534' : log.status === 'network-error' ? '#7f1d1d' : '#78350f',
                                    color: '#fff', fontFamily: mono,
                                }}>{log.status}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{log.label}</span>
                            </div>
                            <div style={{ fontFamily: mono, fontSize: 10, color: '#475569', wordBreak: 'break-all' as const }}>{log.url}</div>
                            {log.status !== 200 && (
                                <div style={{ fontFamily: mono, fontSize: 10, color: '#f87171', whiteSpace: 'pre-wrap' as const, maxHeight: 80, overflow: 'auto' }}>{log.body}</div>
                            )}
                            {log.status === 200 && (
                                <div style={{ fontFamily: mono, fontSize: 10, color: '#34d399' }}>
                                    {(() => { try { const j = JSON.parse(log.body); return `→ ${Array.isArray(j) ? j.length + ' items' : JSON.stringify(j).slice(0, 120)}`; } catch { return log.body.slice(0, 120); } })()}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Attribution + controls ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setRefreshKey(k => k + 1)} style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                        padding: '5px 12px', borderRadius: 8, border: `1px solid ${ACCENT}22`, background: ACCENT_BG,
                        color: ACCENT, cursor: 'pointer',
                    }}>
                        ↺ Refresh
                    </button>
                    {apiLogs.length > 0 && !showDebug && (
                        <button onClick={() => setShowDebug(true)} style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                            padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc',
                            color: '#64748b', cursor: 'pointer',
                        }}>
                            Debug
                        </button>
                    )}
                </div>
                <div style={{ fontSize: 10, color: '#cbd5e1', letterSpacing: '0.12em', fontWeight: 600, textTransform: 'uppercase' as const }}>
                    Data provided by RentCast · Fetched {rcData?.fetchedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
            </div>
        </div>
    );
};
