import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebaseService';
import { APP_CONFIG } from '../../config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValueEstimate {
    price: number;
    priceRangeLow: number;
    priceRangeHigh: number;
    latitude: number;
    longitude: number;
    listingType: string;
    comps: SaleComp[];
}

interface SaleComp {
    id: string;
    formattedAddress: string;
    addressLine1?: string;
    addressLine2?: string;
    city: string;
    state: string;
    stateFips?: string;
    zipCode: string;
    county?: string;
    countyFips?: string;
    latitude?: number;
    longitude?: number;
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    lotSize?: number;
    yearBuilt?: number;
    assessorID?: string;
    legalDescription?: string;
    subdivision?: string;
    zoning?: string;
    lastSaleDate?: string;   // ISO date-time from Rentcast /properties
    lastSalePrice?: number;
    hoa?: Record<string, any>;
    features?: Record<string, any>;
    taxAssessments?: Record<string, any>;
    propertyTaxes?: Record<string, any>;
    history?: Record<string, any>;
    owner?: Record<string, any>;
    ownerOccupied?: boolean;
    // /properties doesn't return these but keep for compat with display code
    distance?: number;
    correlation?: number;
    daysOnMarket?: number;
}

interface CachedComps {
    valueEstimate: ValueEstimate | null;
    queriedAt: Date;
    address: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null, prefix = '$') {
    if (n == null) return '—';
    return `${prefix}${Math.round(n).toLocaleString()}`;
}

function cacheKey(address: string) {
    return address.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 200);
}

function pricePsf(price: number, sqft: number) {
    if (!sqft) return '—';
    return `$${Math.round(price / sqft)}/sf`;
}

/** Haversine formula — returns distance in miles between two lat/lng points */
function haversineDistanceMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SHOW_INITIAL = 6; // comps to show before "Show all"

/**
 * Safely convert a value from Firestore that might be:
 *   - a plain ISO string   "2025-09-15T00:00:00.000Z"
 *   - a Firestore Timestamp  { toDate: () => Date, seconds: number, ... }
 *   - a JS Date object
 * Returns a JS Date, or null if unparseable.
 */
function toDateSafe(val: any): Date | null {
    if (!val) return null;
    if (typeof val === 'string') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val?.toDate === 'function') return val.toDate() as Date; // Firestore Timestamp
    if (val instanceof Date) return val;
    return null;
}

// ─── Time filter types ────────────────────────────────────────────────────────

type TimePreset = 'week' | 'month' | '6months' | 'all' | 'custom';

interface TimeFilter {
    preset: TimePreset;
    customFrom?: string; // ISO date string YYYY-MM-DD
    customTo?: string;
}

const DEFAULT_FILTER: TimeFilter = { preset: 'all' };

function filterCutoff(preset: TimePreset): Date | null {
    const now = new Date();
    if (preset === 'week') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    if (preset === 'month') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
    if (preset === '6months') { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d; }
    return null;
}

function applyDateFilter<T extends object & { lastSaleDate?: any }>(items: T[], filter: TimeFilter): T[] {
    if (filter.preset === 'all') return items;
    if (filter.preset === 'custom') {
        const from = filter.customFrom ? new Date(filter.customFrom) : null;
        const to = filter.customTo ? new Date(filter.customTo) : null;
        return items.filter(i => {
            const d = toDateSafe(i.lastSaleDate);
            if (!d) return true;
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });
    }
    const cutoff = filterCutoff(filter.preset);
    if (!cutoff) return items;
    return items.filter(i => {
        const d = toDateSafe(i.lastSaleDate);
        return !d || d >= cutoff;
    });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EstimateBanner({ label, value, low, high, color }: {
    label: string; value: number; low: number; high: number; color: string;
}) {
    return (
        <div className={`rounded-[1.5rem] border px-5 py-4 ${color}`}>
            <div className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
            <div className="text-2xl font-black mb-0.5">{fmt(value)}</div>
            <div className="text-[10px] font-bold opacity-70">
                Range: {fmt(low)} – {fmt(high)}
            </div>
        </div>
    );
}

function CompCard({ comp }: { comp: SaleComp }) {
    const corrPct = Math.round((comp.correlation ?? 0) * 100);
    const corrColor = corrPct >= 80 ? 'text-emerald-600 bg-emerald-50' : corrPct >= 60 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-100';
    const displayPrice = comp.lastSalePrice ?? null;

    return (
        <div className="p-5 border border-slate-100 rounded-[1.25rem] hover:border-slate-200 hover:shadow-sm transition-all bg-white group">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-black text-slate-800 leading-snug truncate">{comp.formattedAddress}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{comp.city}, {comp.state}</div>
                </div>
                {corrPct > 0 && (
                    <span className={`flex-shrink-0 text-[9px] font-black px-2 py-1 rounded-lg ${corrColor}`}>
                        {corrPct}% match
                    </span>
                )}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                    <div className="text-[15px] font-black text-slate-900">{fmt(displayPrice)}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Sale Price</div>
                </div>
                <div className="text-center">
                    <div className="text-[15px] font-black text-slate-700">{comp.squareFootage?.toLocaleString() ?? '—'}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Sq Ft</div>
                </div>
                <div className="text-center">
                    <div className="text-[15px] font-black text-slate-700">{comp.distance != null ? `${Number(comp.distance).toFixed(1)} mi` : '—'}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Distance</div>
                </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-bold flex-wrap">
                <span>{comp.bedrooms ?? '—'} bd · {comp.bathrooms ?? '—'} ba</span>
                {comp.squareFootage && displayPrice ? <span>{pricePsf(displayPrice, comp.squareFootage)}</span> : null}
                {comp.daysOnMarket != null && <span>{comp.daysOnMarket} DOM</span>}
                {comp.yearBuilt ? <span>Built {comp.yearBuilt}</span> : null}
                {comp.lastSaleDate && (() => {
                    const d = toDateSafe(comp.lastSaleDate);
                    if (!d) return null;
                    return <span>Sold {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>;
                })()}
            </div>
        </div>
    );
}

// ─── TimeFilterBar sub-component ─────────────────────────────────────────────

const PRESETS: { key: TimePreset; label: string }[] = [
    { key: 'week', label: 'Last Week' },
    { key: 'month', label: 'Last Month' },
    { key: '6months', label: 'Last 6 Mo' },
    { key: 'all', label: 'All Time' },
    { key: 'custom', label: 'Custom' },
];

function TimeFilterBar({ value, onChange, accentColor }: {
    value: TimeFilter;
    onChange: (f: TimeFilter) => void;
    accentColor: string; // tailwind bg class for active pill
}) {
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {PRESETS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => onChange({ ...value, preset: p.key })}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${value.preset === p.key
                            ? `${accentColor} text-white shadow-sm`
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            {value.preset === 'custom' && (
                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="date"
                        value={value.customFrom ?? ''}
                        onChange={e => onChange({ ...value, customFrom: e.target.value })}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                    />
                    <span className="text-[10px] font-bold text-slate-400">to</span>
                    <input
                        type="date"
                        value={value.customTo ?? ''}
                        onChange={e => onChange({ ...value, customTo: e.target.value })}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                    />
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PropertyCompsTabProps {
    initialAddress?: string;
    onBack?: () => void;
    subjectLat?: number;
    subjectLng?: number;
}


const PropertyCompsTab: React.FC<PropertyCompsTabProps> = ({ initialAddress = '', onBack, subjectLat, subjectLng }) => {
    const [address, setAddress] = useState(initialAddress);
    const [bedrooms, setBedrooms] = useState('');
    const [bathrooms, setBathrooms] = useState('');
    const [sqft, setSqft] = useState('');
    const [propertyType, setPropertyType] = useState('Single Family');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cached, setCached] = useState<CachedComps | null>(null);

    const [showAllSale, setShowAllSale] = useState(false);
    const [saleFilter, setSaleFilter] = useState<TimeFilter>(DEFAULT_FILTER);

    const fetchComps = useCallback(async (addrOverride?: string) => {
        const trimmed = (addrOverride ?? address).trim();
        if (!trimmed) return;
        setLoading(true);
        setError(null);
        setCached(null);
        setShowAllSale(false);

        try {
            const key = cacheKey(trimmed);
            const cacheRef = doc(db, 'rentcast_comps', key);

            // ── Cache read ───────────────────────────────────────────────────
            const snap = await getDoc(cacheRef);
            if (snap.exists()) {
                const d = snap.data() as any;
                // Only serve cache if it uses the new flat schema (d.comps array).
                // Old AVM-format docs have d.valueEstimate but no d.comps — treat as miss
                // so we re-fetch with the new /properties endpoint.
                if (d.comps) {
                    console.log('[Comps] cache hit — subjectLat:', subjectLat, 'subjectLng:', subjectLng);
                    const rawComps: SaleComp[] = d.comps;
                    const cachedComps = rawComps.map(c => ({
                        ...c,
                        // Use stored distance; fall back to Haversine if missing (older cache docs)
                        distance: c.distance != null
                            ? c.distance
                            : (subjectLat != null && subjectLng != null && c.latitude != null && c.longitude != null)
                                ? Math.round(haversineDistanceMi(subjectLat, subjectLng, c.latitude, c.longitude) * 10) / 10
                                : undefined,
                    }));
                    setCached({
                        valueEstimate: cachedComps.length > 0
                            ? {
                                price: null as any, priceRangeLow: null as any, priceRangeHigh: null as any,
                                latitude: null as any, longitude: null as any, listingType: null as any, comps: cachedComps
                            }
                            : null,
                        rentEstimate: null,
                        queriedAt: d.queriedAt?.toDate?.() ?? new Date(),
                        address: d.address ?? trimmed,
                    });
                    setLoading(false);
                    return;
                }
                // Old AVM cache doc — fall through to live API call
                console.log('[Comps] old AVM cache detected — re-fetching from /properties');
            }

            // ── Live API call: /properties with saleDateRange & radius ────────
            const headers = { 'X-Api-Key': APP_CONFIG.rentcast.key, 'Content-Type': 'application/json' };
            const base = APP_CONFIG.rentcast.baseUrl;

            const params = new URLSearchParams({
                address: trimmed,        // full address e.g. "27663 La Porte Ave, Hayward, CA 94545 US"
                saleDateRange: '0:365',
                radius: '5.0',
                limit: '20',
            });
            console.log('[Comps] fetching:', `${base}/properties?${params}`);

            const res = await fetch(`${base}/properties?${params}`, { headers });
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(`Rentcast /properties error: ${txt}`);
            }

            const json: any[] = await res.json();

            // ── DEBUG: show raw Rentcast dates before any mapping ────────────
            console.log('[Comps] raw Rentcast response — first 3 lastSaleDate values:',
                (Array.isArray(json) ? json.slice(0, 3) : []).map((p: any) => ({
                    address: p.formattedAddress,
                    lastSaleDate: p.lastSaleDate,
                    lastSaleDateType: typeof p.lastSaleDate,
                    lastSalePrice: p.lastSalePrice,
                }))
            );

            // Map /properties response → SaleComp
            const comps: SaleComp[] = (Array.isArray(json) ? json : []).map((p: any) => ({
                ...p,
                id: p.id ?? p.formattedAddress ?? String(Math.random()),
                formattedAddress: p.formattedAddress ?? '',
                city: p.city ?? '',
                state: p.state ?? '',
                zipCode: p.zipCode ?? '',
                distance: (subjectLat != null && subjectLng != null && p.latitude != null && p.longitude != null)
                    ? Math.round(haversineDistanceMi(subjectLat, subjectLng, p.latitude, p.longitude) * 10) / 10
                    : undefined,
            }));

            // /properties has no AVM estimate — set price fields to null, keep comps
            const valueEstimate: ValueEstimate = {
                price: null as any,
                priceRangeLow: null as any,
                priceRangeHigh: null as any,
                latitude: null as any,
                longitude: null as any,
                listingType: null as any,
                comps,
            };


            // ── Cache write — store all fields except the two large tax objects ──
            // taxAssessments and propertyTaxes are deeply nested year-by-year records.
            // lastSaleDate is explicitly stringified to prevent Firestore from auto-converting
            // ISO date strings into Timestamp objects (which breaks read-time parsing).
            // distance IS stored — it is stable and avoids recomputing on every read.
            const slimComps = comps.map(({ taxAssessments, propertyTaxes, ...rest }: any) => ({
                ...rest,
                // ensure lastSaleDate is stored as a plain string, never a Timestamp
                lastSaleDate: rest.lastSaleDate != null ? String(rest.lastSaleDate) : undefined,
            }));

            const stripUndefined = (obj: any): any => {
                if (Array.isArray(obj)) return obj.map(stripUndefined);
                if (obj !== null && typeof obj === 'object') {
                    return Object.fromEntries(
                        Object.entries(obj)
                            .filter(([, v]) => v !== undefined)
                            .map(([k, v]) => [k, stripUndefined(v)])
                    );
                }
                return obj;
            };

            await setDoc(cacheRef, stripUndefined({
                address: trimmed,
                comps: slimComps,
                queriedAt: Timestamp.now(),
            }));


            setCached({
                valueEstimate,
                queriedAt: new Date(),
                address: trimmed,
            });
        } catch (e: any) {
            setError(e.message ?? 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [address]);

    // Auto-fetch when navigated here with an initialAddress
    useEffect(() => {
        if (initialAddress) {
            setAddress(initialAddress);
            fetchComps(initialAddress);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialAddress]);

    const saleComps = cached?.valueEstimate?.comps ?? [];
    const filteredSale = applyDateFilter<SaleComp>(saleComps, saleFilter);
    const visibleSale = showAllSale ? filteredSale : filteredSale.slice(0, SHOW_INITIAL);

    return (
        <div className="max-w-7xl mx-auto pt-3 pb-8 px-6 space-y-5 animate-in fade-in duration-500">

            {/* Header row: back button + title + address */}
            <div className="flex items-start gap-4">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex-shrink-0 mt-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                        <i className="fa-solid fa-arrow-left text-[9px]" />
                        Back
                    </button>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-chart-bar text-indigo-600 text-[10px]" />
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property Comps</span>
                        {cached && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                <i className="fa-solid fa-database text-[8px] mr-1" />
                                Cached {cached.queriedAt.toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">{cached?.address ?? initialAddress}</h2>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center gap-3 py-12 text-indigo-500">
                    <i className="fa-solid fa-spinner animate-spin text-xl" />
                    <span className="text-[13px] font-black uppercase tracking-widest">Fetching comps…</span>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-[1.5rem] px-6 py-4 text-[12px] font-bold text-rose-600 flex items-center gap-3">
                    <i className="fa-solid fa-circle-exclamation" />
                    {error}
                </div>
            )}

            {/* Results */}
            {cached && (
                <div className="space-y-6">
                    {/* Estimate banners — only shown if /avm endpoint was used */}
                    {cached.valueEstimate?.price && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <EstimateBanner
                                label="Estimated Sale Value"
                                value={cached.valueEstimate.price}
                                low={cached.valueEstimate.priceRangeLow}
                                high={cached.valueEstimate.priceRangeHigh}
                                color="bg-indigo-50 border-indigo-200 text-indigo-900"
                            />
                        </div>
                    )}

                    {/* Sale Comps */}
                    {saleComps.length > 0 && (
                        <div>
                            <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                                <div>
                                    <h3 className="text-[14px] font-black text-slate-900">Sale Comps</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">
                                        {filteredSale.length} of {saleComps.length} shown
                                    </p>
                                </div>
                                <TimeFilterBar
                                    value={saleFilter}
                                    onChange={f => { setSaleFilter(f); setShowAllSale(false); }}
                                    accentColor="bg-indigo-600"
                                />
                            </div>
                            {filteredSale.length === 0 ? (
                                <div className="py-8 text-center text-[11px] font-bold text-slate-400">
                                    No sale comps in this date range.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {visibleSale.map(c => <CompCard key={c.id} comp={c} />)}
                                </div>
                            )}
                            {filteredSale.length > SHOW_INITIAL && (
                                <button
                                    onClick={() => setShowAllSale(v => !v)}
                                    className="mt-4 w-full py-2.5 rounded-2xl border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    {showAllSale ? `Show less` : `Show all ${filteredSale.length} sale comps`}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PropertyCompsTab;
