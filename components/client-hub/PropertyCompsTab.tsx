import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebaseService';
import { APP_CONFIG } from '../../config';
import { COMP_NORMALIZATION_PROMPT, COMP_NORMALIZATION_SYSTEM_INSTRUCTION } from '../../prompts/property/compNormalization';

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
    tier?: number;           // 1=ideal, 2=strong, 3=good, 4=acceptable
    adjustedPrice?: number;  // time-adjusted sale price
    isOutlier?: boolean;     // flagged by IQR in regression
    priceUnverified?: boolean; // true if sold ≤60 days and price diverges >10% from zestimate
    zestimate?: number;        // Zillow zestimate for the comp property
}

export type { SaleComp };

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

function fmtLotSize(sqft: number | undefined | null): string | null {
    if (sqft == null || sqft <= 0) return null;
    if (sqft >= 43560) return `${(sqft / 43560).toFixed(2)} ac`;
    return `${sqft.toLocaleString()} sf lot`;
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

const DEFAULT_FILTER: TimeFilter = { preset: '6months' };

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
    const lotLabel = fmtLotSize(comp.lotSize);

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

            <div className="grid grid-cols-4 gap-2 mb-3">
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
                <div className="text-center">
                    <div className="text-[15px] font-black text-slate-700">
                        {(() => { const d = toDateSafe(comp.lastSaleDate); return d ? `${Math.floor((Date.now() - d.getTime()) / 86_400_000)}d` : '—'; })()}
                    </div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Days Ago</div>
                </div>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-bold flex-wrap">
                <span>{comp.bedrooms ?? '—'} bd · {comp.bathrooms ?? '—'} ba</span>
                {comp.squareFootage && displayPrice ? <span>{pricePsf(displayPrice, comp.squareFootage)}</span> : null}
                {lotLabel && <span><i className="fa-solid fa-expand text-[9px] mr-1" />{lotLabel}</span>}
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
];

function TimeFilterBar({ value, onChange, accentColor }: {
    value: TimeFilter;
    onChange: (f: TimeFilter) => void;
    accentColor: string; // tailwind bg class for active pill
}) {
    return (
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
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PropertyCompsTabProps {
    initialAddress?: string;
    onBack?: () => void;
    onRefresh?: () => void;
    subjectZpid?: string;
    subjectLat?: number;
    subjectLng?: number;
    subjectListPrice?: number;
    subjectBedrooms?: number;
    subjectBathrooms?: number;
    subjectSqft?: number;
    subjectYearBuilt?: number;
    subjectHomeType?: string;
    subjectLotSize?: number;
    preloadedComps?: SaleComp[];
    monthlyRate?: number;
    subjectZestimate?: number;
}


const PropertyCompsTab: React.FC<PropertyCompsTabProps> = ({ initialAddress = '', onBack, onRefresh, subjectZpid, subjectLat, subjectLng, subjectListPrice, subjectBedrooms, subjectBathrooms, subjectSqft, subjectYearBuilt, subjectHomeType, subjectLotSize, preloadedComps, monthlyRate, subjectZestimate }) => {
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
    const [openFilter, setOpenFilter] = useState<string | null>(null);

    // ── Property filters ───────────────────────────────────────────────────
    const [filterBeds, setFilterBeds] = useState<string>('any');
    const [filterBaths, setFilterBaths] = useState<string>('any');
    const [filterSqftMin, setFilterSqftMin] = useState('');
    const [filterSqftMax, setFilterSqftMax] = useState('');
    const [filterLotMin, setFilterLotMin] = useState('');
    const [filterLotMax, setFilterLotMax] = useState('');
    const [filterDaysMax, setFilterDaysMax] = useState('');
    const [filterDistMax, setFilterDistMax] = useState('');

    // ── Gemini Comp Analysis state ─────────────────────────────────────────
    const [compAnalysisLoading, setCompAnalysisLoading] = useState(false);
    const [compAnalysisResult, setCompAnalysisResult] = useState<any>(null);
    const [compAnalysisError, setCompAnalysisError] = useState<string | null>(null);
    const [arvBreakdown, setArvBreakdown] = useState<{ item: string; estimated_cost: number; value_add: number; roi_pct: number }[] | null>(null);
    const [renovationStrategy, setRenovationStrategy] = useState<string | null>(null);


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
                saleDateRange: '0:180',
                radius: '1.0',
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
        if (preloadedComps && preloadedComps.length > 0) {
            // Use preloaded comps from zip_sold_listings_cache — skip Rentcast entirely
            setCached({
                valueEstimate: {
                    price: null as any, priceRangeLow: null as any, priceRangeHigh: null as any,
                    latitude: null as any, longitude: null as any, listingType: null as any, comps: preloadedComps
                },
                queriedAt: new Date(),
                address: initialAddress,
            });
            return;
        }
        if (initialAddress) {
            setAddress(initialAddress);
            fetchComps(initialAddress);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialAddress, preloadedComps]);

    // Load cached comp normalization from distress_analysis
    useEffect(() => {
        if (!subjectZpid) return;
        (async () => {
            try {
                console.log('[CompAnalysis] Checking cache for', subjectZpid);
                const daSnap = await getDoc(doc(db, 'distress_analysis', subjectZpid));
                const cached = daSnap.exists() ? daSnap.data()?.compNormalization : null;
                if (cached) {
                    console.log('[CompAnalysis] ✅ Loaded from cache — skipping Gemini call');
                    setCompAnalysisResult(cached);
                } else {
                    console.log('[CompAnalysis] No cached normalization found — will trigger Gemini');
                }
                // Also load ARV breakdown if present
                const arvData = daSnap.data()?.arv_breakdown;
                if (arvData && Array.isArray(arvData) && arvData.length > 0) {
                    setArvBreakdown(arvData);
                }
                // Load renovation strategy if present
                const renStrat = daSnap.data()?.renovation_strategy;
                if (renStrat && typeof renStrat === 'string') {
                    setRenovationStrategy(renStrat);
                }
            } catch { /* ignore */ }
        })();
    }, [subjectZpid]);

    // Extracted analysis runner (used by button and auto-trigger)
    const runCompAnalysis = useCallback(async (comps: SaleComp[]) => {
        if (compAnalysisLoading) return;
        setCompAnalysisLoading(true);
        setCompAnalysisError(null);
        console.log(`[CompAnalysis] 🚀 Running Gemini comp normalization for ${comps.length} comps...`);
        try {
            const { executeGeminiRequest, FLASH_MODEL } = await import('../../services/geminiService');
            const eligible = comps
                .filter(c => !c.isOutlier && !c.priceUnverified && (c.tier === 1 || c.tier === 2 || c.tier === 3))
                .sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || (a.distance ?? 99) - (b.distance ?? 99))
                .slice(0, 10);
            if (eligible.length === 0) {
                setCompAnalysisError('No eligible comps found (need tier 1-3, non-outlier)');
                return;
            }
            // Enrich comp properties: check sold_or_unlisted_properties cache, fetch from RapidAPI if missing
            const compDataMap = new Map<string, { description?: string; resoFacts?: any; homeType?: string }>();
            const config = APP_CONFIG.usHousingApi;
            await Promise.all(eligible.map(async (c) => {
                try {
                    // 1. Check if property data is already cached
                    const snap = await getDoc(doc(db, 'sold_or_unlisted_properties', c.id));
                    if (snap.exists()) {
                        const d = snap.data();
                        if (d?.description && typeof d.description === 'string') {
                            compDataMap.set(c.id, { description: d.description.slice(0, 500), resoFacts: d.resoFacts, homeType: d.homeType || d.propertyType });
                            return;
                        }
                    }

                    // 2. Also check active properties cache
                    const propSnap = await getDoc(doc(db, 'properties', c.id));
                    if (propSnap.exists()) {
                        const d = propSnap.data();
                        if (d?.description && typeof d.description === 'string') {
                            compDataMap.set(c.id, { description: d.description.slice(0, 500), resoFacts: d.resoFacts, homeType: d.homeType || d.propertyType });
                            return;
                        }
                    }

                    // 3. Fetch from RapidAPI and cache
                    console.log(`[CompEnrich] Fetching property data for comp ${c.id} from RapidAPI...`);
                    const url = `https://${config.host}/property?zpid=${c.id}`;
                    const resp = await fetch(url, {
                        method: 'GET',
                        headers: { 'x-rapidapi-host': config.host, 'x-rapidapi-key': config.key },
                        cache: 'no-store',
                    });
                    if (!resp.ok) {
                        console.warn(`[CompEnrich] RapidAPI returned ${resp.status} for zpid ${c.id}`);
                        return;
                    }
                    const data = await resp.json();
                    const root = data.property || data.props || data;
                    const addrRoot = root.address || data.address;
                    const description = root.description || null;
                    const resoFacts = root.resoFacts || null;

                    // Cache to sold_or_unlisted_properties for future use
                    const cacheData: any = {
                        zpid: String(c.id),
                        address: c.formattedAddress,
                        city: addrRoot?.city || c.city,
                        state: addrRoot?.state || c.state,
                        description: description || null,
                        homeType: root.homeType || null,
                        bedrooms: root.bedrooms || c.bedrooms || null,
                        bathrooms: root.bathrooms || c.bathrooms || null,
                        livingAreaValue: root.livingAreaValue || root.livingArea || c.squareFootage || null,
                        yearBuilt: root.yearBuilt || c.yearBuilt || null,
                        lotSize: root.resoFacts?.lotSize || root.lotSize || null,
                        lastSalePrice: c.lastSalePrice || null,
                        lastSaleDate: c.lastSaleDate || null,
                        zestimate: root.zestimate || null,
                        resoFacts: resoFacts || null,
                        cachedAt: Timestamp.now(),
                        source: 'comp_enrichment',
                    };
                    await setDoc(doc(db, 'sold_or_unlisted_properties', c.id), cacheData, { merge: true });
                    console.log(`[CompEnrich] ✅ Cached property data for ${c.formattedAddress}`);

                    if (description) {
                        compDataMap.set(c.id, { description: description.slice(0, 500), resoFacts, homeType: root.homeType || undefined });
                    }
                } catch (e: any) {
                    console.warn(`[CompEnrich] Failed to enrich comp ${c.id}:`, e.message);
                }
            }));

            const compsList = eligible.map(c => ({
                address: c.formattedAddress,
                city: c.city,
                state: c.state,
                zpid: c.id,
                latitude: c.latitude,
                longitude: c.longitude,
                soldPrice: c.lastSalePrice,
                soldDate: c.lastSaleDate,
                listingSqFt: c.squareFootage,
                beds: c.bedrooms,
                baths: c.bathrooms,
                yearBuilt: c.yearBuilt,
                lotSize: c.lotSize,
                distance: c.distance,
                tier: c.tier,
                zestimate: c.zestimate,
                description: compDataMap.get(c.id)?.description ?? null,
                homeType: c.propertyType || compDataMap.get(c.id)?.homeType || null,
            }));
            // Fetch subject property description for feature extraction
            let subjectDescription = '';
            let subjectTaxSqft: number | undefined;
            if (subjectZpid) {
                try {
                    const subjSnap = await getDoc(doc(db, 'properties', subjectZpid));
                    if (subjSnap.exists()) {
                        const subjData = subjSnap.data();
                        subjectDescription = (subjData?.description || subjData?.homeDescription || '').slice(0, 600);
                        subjectTaxSqft = subjData?.livingAreaValue || subjData?.livingArea || undefined;
                    }
                } catch { /* ignore */ }
            }

            const subjectInfo = `${address}, ${subjectSqft ?? '?'} sqft, ${subjectBedrooms ?? '?'} bed, ${subjectBathrooms ?? '?'} bath, ${subjectHomeType ?? 'Single Family'}, Built ${subjectYearBuilt ?? '?'}, Listed at $${subjectListPrice?.toLocaleString() ?? '?'}, Lot ${subjectLotSize?.toLocaleString() ?? '?'} sqft`;

            const prompt = COMP_NORMALIZATION_PROMPT(eligible.length, subjectInfo, subjectDescription, JSON.stringify(compsList, null, 2));

            console.log('[CompAnalysis] 🔄 Running normalization + land utility in parallel...');
            // Run both Gemini calls in parallel
            const [normResult, landResult] = await Promise.allSettled([
                executeGeminiRequest<any>({
                    model: FLASH_MODEL,
                    contents: prompt,
                    config: {
                        tools: [{ googleSearch: {} }],
                        systemInstruction: COMP_NORMALIZATION_SYSTEM_INSTRUCTION,
                        maxOutputTokens: 8192,
                    },
                    userId: 'unknown',
                    promptFilename: 'compNormalization',
                    zpid: subjectZpid,
                    address: address,
                    extractResultJson: true,
                }),
                // Land Utility — uses Gemini function calling with USGS/Google elevation tools
                (async () => {
                    const { executeLandUtilityAnalysis } = await import('../../prompts/property/landUtility');
                    return executeLandUtilityAnalysis(eligible.length, subjectInfo, compsList, subjectZpid, address, subjectLat, subjectLng, subjectLotSize, subjectDescription, subjectTaxSqft);
                })(),
            ]);

            // Process normalization result
            const normData = normResult.status === 'fulfilled' ? normResult.value.data : null;
            const landData = landResult.status === 'fulfilled' ? landResult.value.data : null;

            if (normResult.status === 'rejected') console.warn('[CompAnalysis] Normalization failed:', normResult.reason);
            if (landResult.status === 'rejected') console.warn('[CompAnalysis] Land utility failed:', landResult.reason);

            if (!normData && !landData) throw new Error('Both analysis calls failed');

            // Helper: check if property type is single-family (lot calc only applies to SFR)
            const isSingleFamily = (homeType: string | null | undefined): boolean => {
                if (!homeType) return true; // assume SFR if unknown
                const ht = homeType.toLowerCase();
                const nonSFR = ['townhouse', 'townhome', 'condo', 'condominium', 'co-op', 'coop', 'apartment', 'multi', 'duplex', 'triplex', 'fourplex', 'manufactured', 'mobile'];
                return !nonSFR.some(t => ht.includes(t));
            };

            // Merge land utility data into normalization results by zpid
            // Calculate usable lot in code (not relying on Gemini)
            const calcUsableLot = (grossSqft: number | null | undefined, slopeCategory: string | null | undefined, slopePct: number | null | undefined) => {
                if (typeof grossSqft !== 'number' || grossSqft <= 0) return null;

                // Step 1: Setback deduction
                const cappedLot = Math.min(grossSqft, 30000);
                let setbackDeduction: number;
                if (cappedLot <= 12000) {
                    setbackDeduction = cappedLot * 0.25;
                } else {
                    setbackDeduction = 3000 + (cappedLot - 12000) * 0.01;
                }
                const afterSetback = grossSqft - setbackDeduction;

                // Step 2: Slope deduction (applied to post-setback area)
                let slopeDeductionPct = 0;
                if (typeof slopePct === 'number') {
                    if (slopePct > 30) slopeDeductionPct = 85;
                    else if (slopePct >= 16) slopeDeductionPct = 60;
                    else if (slopePct >= 6) slopeDeductionPct = 10;
                } else {
                    const cat = (slopeCategory ?? '').toLowerCase();
                    if (cat.includes('heavy')) slopeDeductionPct = 85;
                    else if (cat.includes('steep')) slopeDeductionPct = 60;
                    else if (cat.includes('moderate')) slopeDeductionPct = 10;
                }
                const slopeDeduction = afterSetback * (slopeDeductionPct / 100);
                const usable = Math.round(afterSetback - slopeDeduction);

                return {
                    gross: Math.round(grossSqft),
                    setback_deduction: Math.round(setbackDeduction),
                    after_setback: Math.round(afterSetback),
                    slope_deduction_pct: slopeDeductionPct,
                    slope_deduction: Math.round(slopeDeduction),
                    usable,
                };
            };

            if (!normData?.comp_analysis || normData.comp_analysis.length === 0) {
                console.error('[CompAnalysis] ❌ Normalization response missing comp_analysis');
                setCompAnalysisError('AI response was incomplete — comp analysis missing. Try refreshing.');
                setCompAnalysisLoading(false);
                return;
            }

            const mergedComps = (normData.comp_analysis).map((ca: any) => {
                const landComp = (landData?.properties ?? []).find((lp: any) => lp.zpid === ca.zpid || lp.address === ca.address);
                const compHomeType = ca.homeType || compsList.find((cl: any) => cl.zpid === ca.zpid || cl.address === ca.address)?.homeType || null;
                const sfOnly = isSingleFamily(compHomeType);
                const lotCalc = (sfOnly && landComp?.lot_utility) ? calcUsableLot(landComp.lot_utility.gross_lot_sqft, landComp.lot_utility.slope_category, landComp.lot_utility.slope_percent) : null;
                const lotUtil = landComp?.lot_utility ? {
                    ...landComp.lot_utility,
                    usable_sqft: lotCalc?.usable ?? null,
                    lot_calc: lotCalc,
                } : null;
                return {
                    ...ca,
                    lot_utility: lotUtil,
                    land_valuation: landComp?.valuation ?? null,
                    _homeType: compHomeType,
                };
            });

            // Apply usable lot calc to subject audit too (only for single-family)
            const subjectIsSF = isSingleFamily(subjectHomeType);
            const subjectLotCalc = subjectIsSF ? calcUsableLot(subjectLotSize ?? null, landData?.subject_audit?.slope_category, landData?.subject_audit?.slope_percent) : null;
            const normSubjectAudit = normData?.subject_audit;
            const landSubjectAudit = landData?.subject_audit;
            const subjectAudit = (landSubjectAudit || normSubjectAudit) ? {
                ...(landSubjectAudit ?? {}),
                // Merge tax_sqft from normalization prompt (preferred) or land prompt
                tax_sqft: normSubjectAudit?.tax_sqft ?? landSubjectAudit?.tax_sqft ?? null,
                // Merge adjustments: combine from both prompts, deduplicate (case-insensitive, substring-aware)
                adjustments: (() => {
                    const raw = [
                        ...(landSubjectAudit?.adjustments ?? []),
                        ...(normSubjectAudit?.adjustments ?? []),
                    ].filter(Boolean);
                    // Deduplicate: case-insensitive, keep shorter label when one contains another
                    const deduped: string[] = [];
                    for (const item of raw) {
                        const lower = item.toLowerCase().trim();
                        const existingIdx = deduped.findIndex(d => {
                            const dl = d.toLowerCase().trim();
                            return dl === lower || dl.includes(lower) || lower.includes(dl);
                        });
                        if (existingIdx === -1) {
                            deduped.push(item.trim());
                        } else if (item.trim().length < deduped[existingIdx].length) {
                            // Keep the shorter (more concise) label
                            deduped[existingIdx] = item.trim();
                        }
                    }
                    return deduped.slice(0, 8); // cap at 8
                })().filter(f => {
                    const fl = f.toLowerCase();
                    const banned = ['year built', 'lot size', 'square footage', 'sqft', 'sq ft', 'bedrooms', 'bathrooms', 'beds', 'baths', 'built in'];
                    return !banned.some(b => fl.includes(b));
                }),
                usable_lot: subjectLotCalc?.usable ?? null,
                lot_calc: subjectLotCalc,
            } : null;
            // ── Post-Gemini statistical outlier detection (median deviation) ──
            // After Gemini returns, apply a code-side filter on normalized_psf
            // to catch any remaining outlier that skews the average.
            const MEDIAN_DEV_THRESHOLD = 0.20; // flag if >20% from median
            const includedComps = mergedComps.filter((c: any) => c.include_in_avg && typeof c.normalized_psf === 'number');
            if (includedComps.length >= 3) {
                const psfValues = includedComps.map((c: any) => c.normalized_psf as number).sort((a: number, b: number) => a - b);
                const median = psfValues[Math.floor(psfValues.length / 2)];
                for (const c of mergedComps) {
                    if (c.include_in_avg && typeof c.normalized_psf === 'number') {
                        const deviation = Math.abs(c.normalized_psf - median) / median;
                        if (deviation > MEDIAN_DEV_THRESHOLD) {
                            c.zyphe_excluded = true;
                            c.zyphe_exclude_reason = `$/sqft ($${Math.round(c.normalized_psf)}) deviates ${Math.round(deviation * 100)}% from median ($${Math.round(median)})`;
                        }
                    }
                }
                // Recalculate average using only top 3 non-excluded comps (by tier, then distance)
                const finalComps = mergedComps
                    .filter((c: any) => c.include_in_avg && !c.zyphe_excluded && typeof c.normalized_psf === 'number')
                    .sort((a: any, b: any) => {
                        // Match the comp by zpid to get tier + distance from saleComps
                        const scA = comps.find(sc => String(sc.id) === String(a.zpid));
                        const scB = comps.find(sc => String(sc.id) === String(b.zpid));
                        return ((scA?.tier ?? 4) - (scB?.tier ?? 4)) || ((scA?.distance ?? 99) - (scB?.distance ?? 99));
                    })
                    .slice(0, 3);
                if (finalComps.length > 0) {
                    // Mark which comps are actually used in the average
                    for (const fc of finalComps) {
                        fc.zyphe_in_avg = true;
                    }
                    const zypheAvgPsf = finalComps.reduce((sum: number, c: any) => sum + c.normalized_psf, 0) / finalComps.length;
                    const zypheValuation = typeof subjectSqft === 'number' ? Math.round(zypheAvgPsf * subjectSqft) : null;
                    normData.final_summary = {
                        ...normData.final_summary,
                        recommended_avg_psf: Math.round(zypheAvgPsf),
                        subject_valuation: zypheValuation,
                        outliers_dropped: mergedComps.filter((c: any) => c.zyphe_excluded).length,
                        comps_in_avg: finalComps.length,
                    };
                }
            }

            const merged = {
                ...normData,
                comp_analysis: mergedComps,
                subject_audit: subjectAudit,
                land_confidence: landData?.confidence_score ?? null,
                land_avg_psf: landData?.final_average_psf ?? null,
            };

            console.log(`[CompAnalysis] ✅ Merged — ${mergedComps.length} comps, subject audit: ${landData?.subject_audit ? 'yes' : 'no'}`);
            setCompAnalysisResult(merged);
            // Cache to distress_analysis
            if (subjectZpid) {
                try {
                    // Firestore rejects `undefined` values — strip them before saving
                    const sanitize = (obj: any): any => {
                        if (obj === null || obj === undefined) return null;
                        if (Array.isArray(obj)) return obj.map(sanitize);
                        if (typeof obj === 'object') {
                            const clean: any = {};
                            for (const [k, v] of Object.entries(obj)) {
                                if (v !== undefined) clean[k] = sanitize(v);
                            }
                            return clean;
                        }
                        return obj;
                    };
                    await setDoc(doc(db, 'distress_analysis', subjectZpid), {
                        compNormalization: sanitize(merged),
                        compNormalizationAt: new Date().toISOString(),
                    }, { merge: true });
                } catch (cacheErr) {
                    console.warn('[CompAnalysis] Failed to cache:', cacheErr);
                }
            }
        } catch (e: any) {
            console.error('[CompAnalysis] Error:', e);
            setCompAnalysisError(e.message || 'Analysis failed');
        } finally {
            setCompAnalysisLoading(false);
        }
    }, [address, subjectSqft, subjectBedrooms, subjectBathrooms, subjectHomeType, subjectYearBuilt, subjectListPrice, subjectLotSize, subjectZpid, compAnalysisLoading]);

    const saleComps = cached?.valueEstimate?.comps ?? [];

    // Auto-trigger comp analysis when comps are loaded and no cached result
    useEffect(() => {
        if (saleComps.length > 0 && !compAnalysisResult && !compAnalysisLoading && !compAnalysisError) {
            console.log('[CompAnalysis] Auto-triggering — no cached result, comps available');
            // Small delay to let the cache load finish first
            const timer = setTimeout(() => {
                if (!compAnalysisResult) {
                    runCompAnalysis(saleComps);
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [saleComps.length, compAnalysisResult, compAnalysisLoading]);

    // ── Apply all filters ────────────────────────────────────────────────
    const fullyFiltered = (() => {
        let items = applyDateFilter<SaleComp>(saleComps, saleFilter);
        const today = Date.now();
        const bedMin = filterBeds !== 'any' ? Number(filterBeds) : null;
        const bathMin = filterBaths !== 'any' ? Number(filterBaths) : null;
        const sqftMin = filterSqftMin ? Number(filterSqftMin) : null;
        const sqftMax = filterSqftMax ? Number(filterSqftMax) : null;
        const lotMin = filterLotMin ? Number(filterLotMin) : null;
        const lotMax = filterLotMax ? Number(filterLotMax) : null;
        const daysMax = filterDaysMax ? Number(filterDaysMax) : null;
        const distMax = filterDistMax ? Number(filterDistMax) : null;

        items = items.filter(c => {
            if (bedMin != null && (c.bedrooms ?? 0) < bedMin) return false;
            if (bathMin != null && (c.bathrooms ?? 0) < bathMin) return false;
            if (sqftMin != null && (c.squareFootage ?? 0) < sqftMin) return false;
            if (sqftMax != null && (c.squareFootage ?? 999999) > sqftMax) return false;
            if (lotMin != null && (c.lotSize ?? 0) < lotMin) return false;
            if (lotMax != null && (c.lotSize ?? 999999) > lotMax) return false;
            if (distMax != null && (c.distance ?? 999) > distMax) return false;
            if (daysMax != null) {
                const d = toDateSafe(c.lastSaleDate);
                if (d) {
                    const daysSince = Math.floor((today - d.getTime()) / 86_400_000);
                    if (daysSince > daysMax) return false;
                }
            }
            return true;
        });
        // Sort by tier (best first), then by distance (closest first) within each tier
        items.sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || (a.distance ?? 99) - (b.distance ?? 99));
        return items;
    })();

    const hasActiveFilters = !!(filterBeds !== 'any' || filterBaths !== 'any' || filterSqftMin || filterSqftMax || filterLotMin || filterLotMax || filterDaysMax || filterDistMax);

    const clearAllFilters = () => {
        setFilterBeds('any'); setFilterBaths('any');
        setFilterSqftMin(''); setFilterSqftMax('');
        setFilterLotMin(''); setFilterLotMax('');
        setFilterDaysMax(''); setFilterDistMax('');
    };

    const visibleSale = showAllSale ? fullyFiltered : fullyFiltered.slice(0, SHOW_INITIAL);

    return (
        <div className="max-w-7xl mx-auto pt-3 pb-8 px-6 space-y-5 animate-in fade-in duration-500">

            {/* AI Comp Analysis loading banner */}
            {compAnalysisLoading && (
                <div className="sticky top-0 z-50 flex items-center justify-center gap-3 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg">
                    <span className="text-lg animate-bounce" style={{ animationDuration: '1.5s' }}>🔮</span>
                    <span className="text-xs font-black uppercase tracking-widest">Reading the market…</span>
                    <span className="text-lg animate-bounce" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }}>✨</span>
                </div>
            )}

            {/* Header: back button + stacked address block */}
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
                {onRefresh && (
                    <button
                        onClick={() => {
                            // Clear analysis state so auto-trigger fires fresh
                            setCompAnalysisResult(null);
                            setCompAnalysisError(null);
                            setCompAnalysisLoading(false);
                            // Clear cached normalization in Firestore
                            if (subjectZpid) {
                                setDoc(doc(db, 'distress_analysis', subjectZpid), {
                                    compNormalization: null,
                                    compNormalizationAt: null,
                                }, { merge: true }).catch(() => { });
                            }
                            // Re-run analysis in-place (don't navigate away)
                            const sc = cached?.valueEstimate?.comps ?? [];
                            if (sc.length > 0) {
                                runCompAnalysis(sc);
                            }
                        }}
                        className="flex-shrink-0 mt-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                        <i className="fa-solid fa-rotate text-[9px]" />
                        Refresh
                    </button>
                )}

                {/* Title block — grows to fill, stacks vertically */}
                <div className="min-w-0 flex-1">
                    {/* Breadcrumb row */}
                    <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl px-4 py-2 mb-1.5">
                        <i className="fa-solid fa-chart-bar text-white/80 text-sm" />
                        <span className="text-xs font-black text-white uppercase tracking-widest">Property Comps</span>
                    </div>
                </div>
            </div>

            {/* ── Unified Subject Property Card ─────────────────────────── */}
            {(() => {
                // Compute Zyphe value
                let zypheValue: number | null = null;
                let vsDelta: number | null = null;
                let avgAdjPsf: number | null = null;
                let eligibleForVal: typeof saleComps = [];

                if (subjectSqft && subjectSqft > 0 && saleComps.length > 0 && !compAnalysisLoading && compAnalysisResult) {
                    const geminiRecs = compAnalysisResult?.comp_analysis as any[] | undefined;
                    let eligible = saleComps
                        .filter(c => !c.isOutlier && !c.priceUnverified && c.adjustedPrice && c.squareFootage && c.squareFootage > 0)
                        .sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || (a.distance ?? 99) - (b.distance ?? 99));
                    if (geminiRecs && geminiRecs.length > 0) {
                        const includedZpids = new Set(geminiRecs.filter(r => r.include_in_avg && !r.zyphe_excluded).map(r => r.zpid));
                        const geminiFiltered = eligible.filter(c => includedZpids.has(c.id));
                        if (geminiFiltered.length > 0) {
                            eligible = geminiFiltered;
                        } else {
                            eligible = eligible.slice(0, 3);
                        }
                    } else {
                        eligible = eligible.slice(0, 3);
                    }
                    eligible = eligible.slice(0, 3);
                    if (eligible.length > 0) {
                        avgAdjPsf = eligible.reduce((s, c) => s + (c.adjustedPrice! / c.squareFootage!), 0) / eligible.length;
                        zypheValue = Math.round(avgAdjPsf * subjectSqft);
                        vsDelta = subjectListPrice ? ((zypheValue - subjectListPrice) / subjectListPrice * 100) : null;
                        eligibleForVal = eligible;
                    }
                }

                const subjectAuditData = compAnalysisResult?.subject_audit;
                const parseNumLocal = (v: any): number => {
                    if (typeof v === 'number') return v;
                    if (typeof v === 'string') return parseFloat(v.replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
                    return 0;
                };
                const parseLotSqftLocal = (v: any): number => {
                    if (v == null) return 0;
                    const isAcreStr = typeof v === 'string' && /acre/i.test(v);
                    const num = parseNumLocal(v);
                    if (num > 0 && (isAcreStr || num < 500)) return Math.round(num * 43560);
                    return num;
                };
                const getLotCalcLocal = (rawGross: any, slopeCategory: string | null | undefined, rawSlope: any) => {
                    const grossSqft = parseLotSqftLocal(rawGross);
                    if (grossSqft <= 0) return null;
                    const slopePct = parseNumLocal(rawSlope);
                    const cappedLot = Math.min(grossSqft, 30000);
                    const setbackDeduction = cappedLot <= 12000 ? cappedLot * 0.25 : 3000 + (cappedLot - 12000) * 0.01;
                    const afterSetback = grossSqft - setbackDeduction;
                    let slopeDeductionPct = 0;
                    if (slopePct > 0) {
                        if (slopePct > 30) slopeDeductionPct = 85;
                        else if (slopePct >= 16) slopeDeductionPct = 60;
                        else if (slopePct >= 6) slopeDeductionPct = 10;
                    } else {
                        const cat = (slopeCategory ?? '').toLowerCase();
                        if (cat.includes('heavy')) slopeDeductionPct = 85;
                        else if (cat.includes('steep')) slopeDeductionPct = 60;
                        else if (cat.includes('moderate')) slopeDeductionPct = 10;
                    }
                    const slopeDeduction = afterSetback * (slopeDeductionPct / 100);
                    return { gross: Math.round(grossSqft), setback_deduction: Math.round(setbackDeduction), slope_deduction_pct: slopeDeductionPct, slope_deduction: Math.round(slopeDeduction), usable: Math.round(afterSetback - slopeDeduction) };
                };
                const subjectIsSFLocal = (() => {
                    if (!subjectHomeType) return true;
                    const ht = subjectHomeType.toLowerCase();
                    const nonSFR = ['townhouse', 'townhome', 'condo', 'condominium', 'co-op', 'coop', 'apartment', 'multi', 'duplex', 'triplex', 'fourplex', 'manufactured', 'mobile'];
                    return !nonSFR.some(t => ht.includes(t));
                })();
                const subjectLotCalcLocal = subjectIsSFLocal
                    ? ((subjectAuditData?.lot_calc?.usable != null ? subjectAuditData.lot_calc : null) ?? getLotCalcLocal(subjectLotSize ?? null, subjectAuditData?.slope_category, subjectAuditData?.slope_percent))
                    : null;

                return (
                    <div className="rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-5">
                        {/* Banner row: label + address + price */}
                        <div className="flex items-baseline gap-3 flex-wrap mb-2">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest bg-teal-500 px-2 py-0.5 rounded-md self-center">Subject Property</span>
                            <a href={`https://www.zillow.com/homedetails/${subjectZpid}_zpid/`} target="_blank" rel="noopener noreferrer" className="text-lg font-black text-slate-900 leading-tight hover:text-teal-700 hover:underline transition-colors">{cached?.address ?? initialAddress}</a>
                            {subjectListPrice != null && (
                                <span className="text-[13px] font-bold text-emerald-600">
                                    Listed at ${subjectListPrice.toLocaleString()}
                                </span>
                            )}
                        </div>

                        {/* 3-column grid: Attributes+Features | SqFt+Lot | Valuation+Comps */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                            {/* ── Column 1: Attributes + Features ── */}
                            <div className="space-y-2">
                                {(subjectBedrooms != null || subjectBathrooms != null || subjectSqft != null || subjectYearBuilt != null || subjectHomeType || subjectLotSize != null) && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {subjectHomeType && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md text-[11px] font-bold text-indigo-700">
                                                <i className="fa-solid fa-house text-[7px]" />{subjectHomeType}
                                            </span>
                                        )}
                                        {subjectBedrooms != null && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                                                <i className="fa-solid fa-bed text-[7px] text-slate-400" />{subjectBedrooms} bd
                                            </span>
                                        )}
                                        {subjectBathrooms != null && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                                                <i className="fa-solid fa-bath text-[7px] text-slate-400" />{subjectBathrooms} ba
                                            </span>
                                        )}
                                        {subjectYearBuilt != null && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-bold text-slate-600">
                                                <i className="fa-solid fa-calendar text-[7px] text-slate-400" />Built {subjectYearBuilt}
                                            </span>
                                        )}
                                        {subjectListPrice != null && subjectSqft != null && subjectSqft > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md text-[11px] font-bold text-emerald-700">
                                                <i className="fa-solid fa-tag text-[7px]" />${Math.round(subjectListPrice / subjectSqft)}/sf
                                            </span>
                                        )}
                                    </div>
                                )}
                                {/* Features from AI */}
                                {subjectAuditData?.adjustments?.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Key Features</div>
                                        <div className="flex flex-wrap gap-1">
                                            {subjectAuditData.adjustments.map((adj: string, i: number) => (
                                                <span key={i} className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded border border-teal-200">{adj}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Validation Scorecard — Subject */}
                                {subjectAuditData?.validation_flags?.length > 0 && (
                                    <div className="mt-2 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-2 space-y-1.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <i className="fa-solid fa-shield-halved text-[8px]" />Verification from county parcel polygon data
                                        </div>
                                        {subjectAuditData.validation_flags.map((f: any, fi: number) => (
                                            <div key={fi} className={`flex items-start gap-1.5 text-[10px] leading-tight px-1.5 py-1 rounded ${f.severity === 'alert' ? 'bg-red-50 border border-red-200' :
                                                f.severity === 'warning' ? 'bg-amber-50 border border-amber-200' :
                                                    'bg-emerald-50 border border-emerald-200'
                                                }`}>
                                                <span className="shrink-0 mt-0.5">{f.severity === 'alert' ? '🚨' : f.severity === 'warning' ? '⚠️' : '✅'}</span>
                                                <span className={`font-semibold ${f.severity === 'alert' ? 'text-red-700' :
                                                    f.severity === 'warning' ? 'text-amber-700' :
                                                        'text-emerald-700'
                                                    }`}>{f.finding}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                            </div>

                            {/* ── Column 2: SqFt + Lot Analysis ── */}
                            <div className="space-y-1.5">
                                {subjectAuditData && (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <div className="text-slate-400 font-bold text-[10px]">Built Area (Listing)</div>
                                            <div className="font-black text-slate-700">{subjectSqft ? `${subjectSqft.toLocaleString()} sf` : '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 font-bold text-[10px]">Built Area (Tax Records)</div>
                                            <div className="font-black text-slate-700">{subjectAuditData.tax_sqft ? `${subjectAuditData.tax_sqft.toLocaleString()} sf` : '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-teal-500 font-bold text-[10px]">Lot Area</div>
                                            <div className="font-black text-slate-700">{subjectLotSize ? `${subjectLotSize.toLocaleString()} sf` : '—'}</div>
                                        </div>
                                        {subjectIsSFLocal && (
                                            <div>
                                                <div className="text-teal-500 font-bold text-[10px]">Usable Lot</div>
                                                <div className="font-black text-teal-700">{(subjectLotCalcLocal?.usable ?? subjectAuditData.usable_lot) ? `${(subjectLotCalcLocal?.usable ?? subjectAuditData.usable_lot)?.toLocaleString()} sf` : '—'}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {subjectLotCalcLocal && (
                                    <div className="space-y-0.5 text-[11px] font-mono bg-white/60 rounded-lg p-2 border border-teal-100">
                                        <div className="text-[9px] font-black text-teal-600 uppercase tracking-widest font-mono mb-1">Usable Lot Calculation</div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-11 text-right text-slate-400 font-bold text-[9px]">Slope</span>
                                            <span className={`font-bold ${subjectAuditData?.slope_category === 'Heavy' || subjectAuditData?.slope_category === 'Steep' ? 'text-red-600' : subjectAuditData?.slope_category === 'Moderate' ? 'text-amber-600' : 'text-slate-700'}`}>
                                                {subjectAuditData?.slope_percent != null ? `${subjectAuditData.slope_percent}%` : ''}{subjectAuditData?.slope_category ? `${subjectAuditData?.slope_percent != null ? ' ' : ''}${subjectAuditData.slope_category}` : '—'}
                                            </span>
                                        </div>
                                        {subjectAuditData?.zoning_district && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-11 text-right text-slate-400 font-bold text-[9px]">Zone</span>
                                                <span className="font-bold text-slate-700">{subjectAuditData.zoning_district}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-teal-100 pt-0.5 mt-0.5" />
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-11 text-right text-slate-400 font-bold text-[9px] uppercase">Gross</span>
                                            <span className="font-black text-slate-700">{subjectLotCalcLocal.gross.toLocaleString()} sf</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-11 text-right text-amber-500 font-bold text-[9px]">−</span>
                                            <span className="font-bold text-amber-600">{subjectLotCalcLocal.setback_deduction.toLocaleString()} setback (state reqd)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-11 text-right text-red-400 font-bold text-[9px]">−</span>
                                            <span className="font-bold text-red-500">{subjectLotCalcLocal.slope_deduction.toLocaleString()} slope ({subjectLotCalcLocal.slope_deduction_pct}%)</span>
                                        </div>
                                        <div className="border-t border-teal-200 pt-0.5 flex items-center gap-1.5">
                                            <span className="w-11 text-right text-teal-500 font-bold text-[9px]">Usable</span>
                                            <span className="font-black text-teal-700">{subjectLotCalcLocal.usable.toLocaleString()} sf</span>
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* ── Column 3: Zyphe Valuation + Comps ── */}
                            <div className="space-y-1.5">
                                {compAnalysisLoading && (
                                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 p-3 text-center">
                                        <div className="text-8xl mb-1" style={{ animation: 'pulse 2s ease-in-out infinite' }}>🤚</div>
                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI analyzing…</div>
                                        <div className="flex justify-center gap-1 mt-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '0s' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                                        </div>
                                    </div>
                                )}
                                {zypheValue != null && (
                                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 p-3">
                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">
                                            <i className="fa-solid fa-gem text-[9px] mr-1" />Zyphe ARV Estimate
                                        </div>
                                        <div className="text-2xl font-black text-indigo-900">${zypheValue.toLocaleString()}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {vsDelta != null && (
                                                <span className={`text-[11px] font-bold ${vsDelta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {vsDelta > 0 ? '+' : ''}{vsDelta.toFixed(1)}% vs list
                                                </span>
                                            )}
                                        </div>
                                        {/* Calculation breakdown */}
                                        <div className="mt-2 text-[10px] font-mono bg-white/70 rounded-lg px-2 py-1.5 border border-indigo-100 flex items-center gap-1.5 flex-wrap">
                                            <span className="text-slate-400 font-bold">Avg $/sf</span>
                                            <span className="font-black text-slate-700">${Math.round(avgAdjPsf!)}</span>
                                            <span className="text-slate-400 font-bold">×</span>
                                            <span className="font-bold text-slate-600">{subjectSqft?.toLocaleString()} sf</span>
                                            <span className="text-indigo-400 font-bold">=</span>
                                            <span className="font-black text-indigo-800">${zypheValue.toLocaleString()}</span>
                                        </div>
                                        <div className="mt-2 space-y-0.5 border-t border-indigo-100 pt-1.5">
                                            {eligibleForVal.map((c, i) => {
                                                const cPsf = Math.round(c.adjustedPrice! / c.squareFootage!);
                                                return (
                                                    <div key={c.id} className="flex items-center gap-1.5 text-[11px]">
                                                        <span className="w-3.5 h-3.5 rounded bg-indigo-100 text-indigo-600 font-black flex items-center justify-center text-[9px]">{i + 1}</span>
                                                        <a href={`https://www.zillow.com/homedetails/${c.id}_zpid/`} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline truncate">{c.formattedAddress}</a>
                                                        <span className="text-slate-400 font-medium shrink-0">${cPsf}/sf</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {/* ARV Remodel Breakdown — compact inline */}
                                {arvBreakdown && arvBreakdown.length > 0 && (
                                    <div className="overflow-hidden rounded-lg border border-emerald-200/60">
                                        <table className="text-left w-full">
                                            <thead>
                                                <tr className="bg-emerald-100/50">
                                                    <th className="px-2 py-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest">Remodel</th>
                                                    <th className="px-2 py-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest text-right">Cost</th>
                                                    <th className="px-2 py-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest text-right">Value Add</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-emerald-100/40">
                                                {arvBreakdown.map((b, i) => (
                                                    <tr key={i} className="bg-white/60 hover:bg-emerald-50/40 transition-colors">
                                                        <td className="px-2 py-1 text-[10px] font-bold text-slate-700">{b.item}</td>
                                                        <td className="px-2 py-1 text-[10px] font-mono text-slate-500 text-right">${b.estimated_cost.toLocaleString()}</td>
                                                        <td className="px-2 py-1 text-[10px] font-mono text-emerald-700 font-bold text-right">+${b.value_add.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Renovation Strategy — full width below grid */}
                        {renovationStrategy && (
                            <div className="mt-3 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-3">
                                <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 mb-1">
                                    <i className="fa-solid fa-hammer text-[8px]" />Renovation Strategy
                                </div>
                                <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line">{renovationStrategy}</p>
                            </div>
                        )}

                    </div>
                );
            })()}

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

            {/* ── Gemini Comp Analysis ──────────────────────── */}
            {saleComps.length > 0 && (
                <div>

                    {compAnalysisError && (
                        <div className="mt-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-3 text-[12px] font-bold text-rose-600 flex items-center gap-2">
                            <i className="fa-solid fa-circle-exclamation" />{compAnalysisError}
                        </div>
                    )}

                    {/* ── Gemini Analysis Results ──────────────────── */}
                    {compAnalysisResult && (() => {
                        const analysis = compAnalysisResult;
                        const comps = analysis?.comp_analysis ?? [];
                        const summary = analysis?.final_summary;

                        // Parse numeric values that may be strings with commas/units (e.g. "7,143 sqft", "28.8%")
                        const parseNum = (v: any): number => {
                            if (typeof v === 'number') return v;
                            if (typeof v === 'string') return parseFloat(v.replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
                            return 0;
                        };
                        // Parse lot size — auto-detect acres and convert to sqft
                        const parseLotSqft = (v: any): number => {
                            if (v == null) return 0;
                            const isAcreStr = typeof v === 'string' && /acre/i.test(v);
                            const num = parseNum(v);
                            // If string says "acres" or value is suspiciously small (< 500), it's acres
                            if (num > 0 && (isAcreStr || num < 500)) return Math.round(num * 43560);
                            return num;
                        };
                        const getLotCalc = (rawGross: any, slopeCategory: string | null | undefined, rawSlope: any) => {
                            const grossSqft = parseLotSqft(rawGross);
                            if (grossSqft <= 0) return null;
                            const slopePct = parseNum(rawSlope);
                            const cappedLot = Math.min(grossSqft, 30000);
                            const setbackDeduction = cappedLot <= 12000 ? cappedLot * 0.25 : 3000 + (cappedLot - 12000) * 0.01;
                            const afterSetback = grossSqft - setbackDeduction;
                            let slopeDeductionPct = 0;
                            if (slopePct > 0) {
                                if (slopePct > 30) slopeDeductionPct = 85;
                                else if (slopePct >= 16) slopeDeductionPct = 60;
                                else if (slopePct >= 6) slopeDeductionPct = 10;
                            } else {
                                const cat = (slopeCategory ?? '').toLowerCase();
                                if (cat.includes('heavy')) slopeDeductionPct = 85;
                                else if (cat.includes('steep')) slopeDeductionPct = 60;
                                else if (cat.includes('moderate')) slopeDeductionPct = 10;
                            }
                            const slopeDeduction = afterSetback * (slopeDeductionPct / 100);
                            return { gross: Math.round(grossSqft), setback_deduction: Math.round(setbackDeduction), slope_deduction_pct: slopeDeductionPct, slope_deduction: Math.round(slopeDeduction), usable: Math.round(afterSetback - slopeDeduction) };
                        };

                        return (
                            <div className="mt-5 border border-violet-100 rounded-[1.5rem] overflow-hidden bg-gradient-to-br from-violet-50/40 to-indigo-50/40">
                                {/* Header */}
                                <div className="px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-2 text-white">
                                        <i className="fa-solid fa-wand-magic-sparkles" />
                                        <span className="text-[13px] font-black uppercase tracking-widest">Top Comps Adjustments Analysis</span>
                                    </div>
                                    <button
                                        onClick={() => runCompAnalysis(saleComps)}
                                        disabled={compAnalysisLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50"
                                    >
                                        <i className={`fa-solid ${compAnalysisLoading ? 'fa-spinner animate-spin' : 'fa-rotate'} text-[11px]`} />
                                        {compAnalysisLoading ? 'Running…' : 'Refresh'}
                                    </button>
                                </div>

                                <div className="p-6 space-y-4">

                                    {/* Per-comp analysis */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {comps.map((ca: any, idx: number) => (
                                            <div key={idx} className={`rounded-xl border-2 p-4 ${ca.zyphe_excluded
                                                ? 'border-orange-300 bg-gradient-to-br from-rose-50 via-white to-orange-50'
                                                : ca.include_in_avg === false
                                                    ? 'border-red-200 bg-gradient-to-br from-rose-50/60 via-white to-pink-50/60 opacity-80'
                                                    : ca.zyphe_in_avg
                                                        ? 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50'
                                                        : 'border-slate-200 bg-white'
                                                }`}>
                                                <div className="flex items-start justify-between mb-2">
                                                    <a href={`https://www.zillow.com/homedetails/${ca.zpid}_zpid/`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-slate-800 leading-snug max-w-[60%] hover:text-indigo-600 hover:underline transition-colors">{ca.address}</a>
                                                    <div className="flex items-center gap-1 flex-wrap justify-end">
                                                        {ca.zyphe_excluded ? <span className="text-[11px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">✗ Stat Outlier</span> : ca.zyphe_in_avg && <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">✓ Top Comp</span>}
                                                        {!ca.zyphe_excluded && ca.include_in_avg === false && <span className="text-[11px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">✗ Excluded</span>}

                                                        {ca.risk_flag && <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1 rounded">⚠ Risk</span>}
                                                    </div>
                                                </div>
                                                {/* Property attributes */}
                                                {(() => {
                                                    const sc = saleComps.find((s: any) => String(s.id) === String(ca.zpid));
                                                    return sc ? (
                                                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                                            {sc.propertyType && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i className="fa-solid fa-house text-[7px]" />{sc.propertyType}</span>}
                                                            {sc.bedrooms != null && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i className="fa-solid fa-bed text-[7px]" />{sc.bedrooms} bd</span>}
                                                            {sc.bathrooms != null && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i className="fa-solid fa-bath text-[7px]" />{sc.bathrooms} ba</span>}
                                                            {sc.yearBuilt != null && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i className="fa-solid fa-calendar text-[7px]" />Built {sc.yearBuilt}</span>}
                                                            {sc.lastSaleDate && (() => {
                                                                const days = Math.round((Date.now() - new Date(sc.lastSaleDate).getTime()) / 86400000);
                                                                return <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i className="fa-solid fa-clock text-[7px]" />Sold {days}d ago</span>;
                                                            })()}
                                                            {sc.distance != null && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><i className="fa-solid fa-location-dot text-[7px]" />{sc.distance.toFixed(1)} mi</span>}
                                                        </div>
                                                    ) : null;
                                                })()}
                                                {ca.zyphe_excluded && ca.zyphe_exclude_reason && (
                                                    <div className="text-xs text-orange-600 font-medium mb-2 italic">{ca.zyphe_exclude_reason}</div>
                                                )}
                                                {!ca.zyphe_excluded && ca.include_in_avg === false && ca.exclude_reason && (
                                                    <div className="text-xs text-red-500 font-medium mb-2 italic">{ca.exclude_reason}</div>
                                                )}
                                                {/* Top row: Listing | Tax Records | $/sf | Lot Area | Usable Lot */}
                                                <div className="grid grid-cols-5 gap-3 text-xs mb-3">
                                                    <div>
                                                        <div className="text-slate-400 font-bold">Listing</div>
                                                        <div className="font-black text-slate-700">{ca.listing_sqft ? `${ca.listing_sqft.toLocaleString()} sf` : '—'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-400 font-bold">Tax Records</div>
                                                        <div className="font-black text-slate-700">{ca.tax_sqft ? `${ca.tax_sqft.toLocaleString()} sf` : '—'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-emerald-500 font-bold">$/sf</div>
                                                        <div className="font-black text-emerald-700">{ca.normalized_psf ? `$${Math.round(ca.normalized_psf)}` : '—'}</div>
                                                    </div>
                                                    {ca.lot_utility && (() => {
                                                        const compIsSF = (() => {
                                                            const ht = (ca._homeType || saleComps.find((sc: any) => String(sc.id) === String(ca.zpid))?.propertyType || '').toLowerCase();
                                                            if (!ht) return true;
                                                            const nonSFR = ['townhouse', 'townhome', 'condo', 'condominium', 'co-op', 'coop', 'apartment', 'multi', 'duplex', 'triplex', 'fourplex', 'manufactured', 'mobile'];
                                                            return !nonSFR.some((t: string) => ht.includes(t));
                                                        })();
                                                        const compLotCalc = compIsSF
                                                            ? ((ca.lot_utility.lot_calc?.usable != null ? ca.lot_utility.lot_calc : null) ?? getLotCalc(ca.lot_utility.gross_lot_sqft, ca.lot_utility.slope_category, ca.lot_utility.slope_percent))
                                                            : null;
                                                        return (
                                                            <>
                                                                <div>
                                                                    <div className="text-teal-500 font-bold">Lot Area</div>
                                                                    <div className="font-black text-slate-700">{parseLotSqft(ca.lot_utility.gross_lot_sqft) > 0 ? `${parseLotSqft(ca.lot_utility.gross_lot_sqft).toLocaleString()} sf` : '—'}</div>
                                                                    {ca.lot_utility.arcgis_lot_sqft && ca.lot_utility.gross_lot_sqft && Math.abs(ca.lot_utility.arcgis_lot_sqft - ca.lot_utility.gross_lot_sqft) / ca.lot_utility.gross_lot_sqft > 0.05 && (
                                                                        <div className="text-[9px] text-teal-400 font-semibold">Parcel Boundary: {ca.lot_utility.arcgis_lot_sqft.toLocaleString()} sf</div>
                                                                    )}
                                                                </div>
                                                                {compIsSF && (
                                                                    <div>
                                                                        <div className="text-teal-500 font-bold">Usable Lot</div>
                                                                        <div className="font-black text-teal-700">{compLotCalc?.usable ? `${compLotCalc.usable.toLocaleString()} sf` : '—'}</div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>

                                                {/* Lot calculation vertical + Key Features side by side */}
                                                <div className="flex gap-4">
                                                    {/* Left: Vertical lot calc */}
                                                    {ca.lot_utility && (() => {
                                                        const compIsSF2 = (() => {
                                                            const ht = (ca._homeType || saleComps.find((sc: any) => String(sc.id) === String(ca.zpid))?.propertyType || '').toLowerCase();
                                                            if (!ht) return true;
                                                            const nonSFR = ['townhouse', 'townhome', 'condo', 'condominium', 'co-op', 'coop', 'apartment', 'multi', 'duplex', 'triplex', 'fourplex', 'manufactured', 'mobile'];
                                                            return !nonSFR.some((t: string) => ht.includes(t));
                                                        })();
                                                        const compLotCalc = compIsSF2
                                                            ? ((ca.lot_utility.lot_calc?.usable != null ? ca.lot_utility.lot_calc : null) ?? getLotCalc(ca.lot_utility.gross_lot_sqft, ca.lot_utility.slope_category, ca.lot_utility.slope_percent))
                                                            : null;
                                                        return compLotCalc ? (
                                                            <div className="shrink-0 space-y-1 text-xs font-mono bg-teal-50/50 rounded-lg p-2 border border-teal-100">
                                                                <div className="text-[9px] font-black text-teal-600 uppercase tracking-widest font-mono mb-1">Usable Lot Calculation</div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-12 text-right text-slate-400 font-bold text-[10px]">Slope</span>
                                                                    <span className={`font-bold ${ca.lot_utility.slope_category === 'Heavy' || ca.lot_utility.slope_category === 'Steep' ? 'text-red-600' : ca.lot_utility.slope_category === 'Moderate' ? 'text-amber-600' : 'text-slate-700'}`}>
                                                                        {ca.lot_utility.slope_percent != null ? `${ca.lot_utility.slope_percent}%` : ''}{ca.lot_utility.slope_category ? `${ca.lot_utility.slope_percent != null ? ' ' : ''}${ca.lot_utility.slope_category}` : '—'}
                                                                    </span>
                                                                </div>
                                                                <div className="border-t border-teal-100 pt-1 mt-0.5" />
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-12 text-right text-slate-400 font-bold text-[10px] uppercase">Gross</span>
                                                                    <span className="font-black text-slate-700">{compLotCalc.gross.toLocaleString()} sf</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-12 text-right text-amber-500 font-bold text-[10px]">−</span>
                                                                    <span className="font-bold text-amber-600">{compLotCalc.setback_deduction.toLocaleString()} setback (state reqd)</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-12 text-right text-red-400 font-bold text-[10px]">−</span>
                                                                    <span className="font-bold text-red-500">{compLotCalc.slope_deduction.toLocaleString()} slope ({compLotCalc.slope_deduction_pct}%)</span>
                                                                </div>
                                                                <div className="border-t border-teal-200 pt-1 flex items-center gap-2">
                                                                    <span className="w-12 text-right text-teal-500 font-bold text-[10px]">Usable</span>
                                                                    <span className="font-black text-teal-700">{compLotCalc.usable.toLocaleString()} sf</span>
                                                                </div>
                                                            </div>
                                                        ) : null;
                                                    })()}

                                                    {/* Right: Key Features / Adjustments */}
                                                    {(ca.adjustments?.length > 0 || ca.land_valuation?.key_adjustments?.length > 0) && (
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Key Features</div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {(ca.adjustments ?? []).map((adj: string, i: number) => (
                                                                    <span key={`a-${i}`} className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{adj}</span>
                                                                ))}
                                                                {(ca.land_valuation?.key_adjustments ?? []).map((adj: string, i: number) => (
                                                                    <span key={`l-${i}`} className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200">{adj}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>




                                            </div>
                                        ))}
                                    </div>

                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Sale Comps */}
            {saleComps.length > 0 && (
                <div>
                    <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                        <div>
                            <h3 className="text-[14px] font-black text-slate-900">Sale Comps</h3>
                            <p className="text-xs text-slate-400 font-medium">
                                {fullyFiltered.length} of {saleComps.length} shown
                            </p>
                            {monthlyRate != null && Math.abs(monthlyRate) >= 0.001 && (
                                <p className={`text-[13px] font-bold mt-1 ${monthlyRate > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    <i className={`fa-solid ${monthlyRate > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} text-[11px] mr-1`} />
                                    Based on linear regression of last 6 months of similar sales, property prices are {monthlyRate > 0 ? 'increasing' : 'dropping'} at {Math.abs(monthlyRate * 100).toFixed(2)}%/mo
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <TimeFilterBar
                                value={saleFilter}
                                onChange={f => { setSaleFilter(f); setShowAllSale(false); }}
                                accentColor="bg-indigo-600"
                            />
                        </div>
                    </div>
                    {/* ── Filter Dropdowns Bar ──────────────────── */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                        {/* Beds & Baths */}
                        <div className="relative">
                            <button
                                onClick={() => setOpenFilter(openFilter === 'beds' ? null : 'beds')}
                                className={`px-4 py-2 rounded-xl text-[12px] font-bold border transition-all flex items-center gap-2 ${filterBeds !== 'any' || filterBaths !== 'any'
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : openFilter === 'beds' ? 'bg-white border-slate-400 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                Beds & Baths{(filterBeds !== 'any' || filterBaths !== 'any') ? ' ·' : ''}
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openFilter === 'beds' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilter === 'beds' && (
                                <div className="absolute top-full left-0 mt-2 w-[320px] bg-white border border-slate-200 rounded-2xl shadow-lg p-4 z-30 space-y-4 animate-in fade-in duration-150">
                                    <div>
                                        <label className="text-xs font-black text-slate-500 mb-2 block">Bedrooms</label>
                                        <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                                            {['any', '1', '2', '3', '4', '5'].map(v => (
                                                <button key={v} onClick={() => setFilterBeds(v)}
                                                    className={`flex-1 py-2 text-[12px] font-bold transition-all border-r border-slate-200 last:border-r-0 ${filterBeds === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                >{v === 'any' ? 'Any' : `${v}+`}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-slate-500 mb-2 block">Bathrooms</label>
                                        <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                                            {['any', '1', '1.5', '2', '3', '4'].map(v => (
                                                <button key={v} onClick={() => setFilterBaths(v)}
                                                    className={`flex-1 py-2 text-[12px] font-bold transition-all border-r border-slate-200 last:border-r-0 ${filterBaths === v ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                >{v === 'any' ? 'Any' : `${v}+`}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sq Ft */}
                        <div className="relative">
                            <button
                                onClick={() => setOpenFilter(openFilter === 'sqft' ? null : 'sqft')}
                                className={`px-4 py-2 rounded-xl text-[12px] font-bold border transition-all flex items-center gap-2 ${filterSqftMin || filterSqftMax
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : openFilter === 'sqft' ? 'bg-white border-slate-400 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                Sq Ft{filterSqftMin || filterSqftMax ? ' ·' : ''}
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openFilter === 'sqft' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilter === 'sqft' && (
                                <div className="absolute top-full left-0 mt-2 w-[280px] bg-white border border-slate-200 rounded-2xl shadow-lg p-4 z-30 animate-in fade-in duration-150">
                                    <label className="text-xs font-black text-slate-500 mb-2 block">Living Area (sqft)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" placeholder="Min" value={filterSqftMin} onChange={e => setFilterSqftMin(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                                        <span className="text-slate-300 font-bold">–</span>
                                        <input type="number" placeholder="Max" value={filterSqftMax} onChange={e => setFilterSqftMax(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Lot Size */}
                        <div className="relative">
                            <button
                                onClick={() => setOpenFilter(openFilter === 'lot' ? null : 'lot')}
                                className={`px-4 py-2 rounded-xl text-[12px] font-bold border transition-all flex items-center gap-2 ${filterLotMin || filterLotMax
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : openFilter === 'lot' ? 'bg-white border-slate-400 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                Lot Size{filterLotMin || filterLotMax ? ' ·' : ''}
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openFilter === 'lot' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilter === 'lot' && (
                                <div className="absolute top-full left-0 mt-2 w-[280px] bg-white border border-slate-200 rounded-2xl shadow-lg p-4 z-30 animate-in fade-in duration-150">
                                    <label className="text-xs font-black text-slate-500 mb-2 block">Lot Size (sqft)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="number" placeholder="Min" value={filterLotMin} onChange={e => setFilterLotMin(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                                        <span className="text-slate-300 font-bold">–</span>
                                        <input type="number" placeholder="Max" value={filterLotMax} onChange={e => setFilterLotMax(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Days Sold */}
                        <div className="relative">
                            <button
                                onClick={() => setOpenFilter(openFilter === 'days' ? null : 'days')}
                                className={`px-4 py-2 rounded-xl text-[12px] font-bold border transition-all flex items-center gap-2 ${filterDaysMax
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : openFilter === 'days' ? 'bg-white border-slate-400 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                Days Sold{filterDaysMax ? ` ≤${filterDaysMax}d` : ''}
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openFilter === 'days' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilter === 'days' && (
                                <div className="absolute top-full left-0 mt-2 w-[200px] bg-white border border-slate-200 rounded-2xl shadow-lg p-4 z-30 animate-in fade-in duration-150">
                                    <label className="text-xs font-black text-slate-500 mb-2 block">Max Days Since Sold</label>
                                    <input type="number" placeholder="e.g. 180" value={filterDaysMax} onChange={e => setFilterDaysMax(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                                </div>
                            )}
                        </div>

                        {/* Distance */}
                        <div className="relative">
                            <button
                                onClick={() => setOpenFilter(openFilter === 'dist' ? null : 'dist')}
                                className={`px-4 py-2 rounded-xl text-[12px] font-bold border transition-all flex items-center gap-2 ${filterDistMax
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : openFilter === 'dist' ? 'bg-white border-slate-400 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                    }`}
                            >
                                Distance{filterDistMax ? ` ≤${filterDistMax}mi` : ''}
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${openFilter === 'dist' ? 'rotate-180' : ''}`} />
                            </button>
                            {openFilter === 'dist' && (
                                <div className="absolute top-full left-0 mt-2 w-[200px] bg-white border border-slate-200 rounded-2xl shadow-lg p-4 z-30 animate-in fade-in duration-150">
                                    <label className="text-xs font-black text-slate-500 mb-2 block">Max Distance (mi)</label>
                                    <input type="number" step="0.1" placeholder="e.g. 0.5" value={filterDistMax} onChange={e => setFilterDistMax(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[12px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                                </div>
                            )}
                        </div>

                        {/* Clear all */}
                        {hasActiveFilters && (
                            <button
                                onClick={clearAllFilters}
                                className="px-3 py-2 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {fullyFiltered.length === 0 ? (
                        <div className="py-8 text-center text-[13px] font-bold text-slate-400">
                            No sale comps match the current filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Tier</th>
                                        <th className="px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">Address</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Price</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Zestimate</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Adj. Price</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">$/SqFt</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Beds</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Baths</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Sq Ft</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Lot</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Dist</th>
                                        <th className="px-3 py-3 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Days Ago</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleSale.map((c, idx) => {
                                        const saleD = toDateSafe(c.lastSaleDate);
                                        const daysAgo = saleD ? Math.floor((Date.now() - saleD.getTime()) / 86_400_000) : null;
                                        const psf = c.squareFootage && (c.adjustedPrice || c.lastSalePrice) ? Math.round((c.adjustedPrice || c.lastSalePrice!) / c.squareFootage) : null;
                                        const tierColors: Record<number, string> = {
                                            1: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                            2: 'bg-amber-50 text-amber-700 border-amber-200',
                                            3: 'bg-sky-50 text-sky-700 border-sky-200',
                                            4: 'bg-slate-100 text-slate-500 border-slate-200',
                                        };
                                        const tierLabels: Record<number, string> = { 1: 'Ideal', 2: 'Strong', 3: 'Good', 4: 'OK' };
                                        const tier = c.tier ?? 4;
                                        const adjDelta = c.adjustedPrice && c.lastSalePrice
                                            ? ((c.adjustedPrice - c.lastSalePrice) / c.lastSalePrice * 100) : null;
                                        return (
                                            <tr key={c.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${tier <= 2 ? 'border-l-2 border-l-emerald-400' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${c.isOutlier ? 'opacity-50' : ''}`}>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-black border ${tierColors[tier]}`}>
                                                        {tierLabels[tier]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <a href={`https://www.zillow.com/homedetails/${c.id}_zpid/`} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline leading-snug truncate max-w-[240px] block">{c.formattedAddress}</a>
                                                    {c.isOutlier && (
                                                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                            <i className="fa-solid fa-ban text-[8px]" />IQR Outlier — Not sent to AI
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <div className={`text-[12px] font-black ${c.priceUnverified ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{fmt(c.lastSalePrice ?? null)}</div>
                                                    {c.priceUnverified && (
                                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1 rounded" title="Sold ≤60 days ago, price diverges >10% from Zestimate — may not have been finalized. Excluded from Zyphe valuation.">⚠ Price not finalized</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <div className="text-[12px] font-bold text-slate-500">{c.zestimate ? fmt(c.zestimate) : '—'}</div>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    {c.adjustedPrice ? (
                                                        <div>
                                                            <div className="text-[12px] font-black text-indigo-700">{fmt(c.adjustedPrice)}</div>
                                                            {adjDelta != null && Math.abs(adjDelta) >= 0.1 && (
                                                                <div className={`text-[11px] font-bold ${adjDelta > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                                                    {adjDelta > 0 ? '+' : ''}{adjDelta.toFixed(1)}%
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : <span className="text-[12px] text-slate-400">—</span>}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <span className={`text-[12px] font-bold text-slate-600 ${c.isOutlier ? 'line-through' : ''}`}>{psf != null ? `$${psf}` : '—'}</span>
                                                    {c.isOutlier && (
                                                        <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-50 border border-orange-200 text-[10px] font-black text-orange-600 uppercase">
                                                            <i className="fa-solid fa-triangle-exclamation text-[9px]" />Outlier
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-[12px] font-bold text-slate-700 text-center">{c.bedrooms ?? '—'}</td>
                                                <td className="px-3 py-3 text-[12px] font-bold text-slate-700 text-center">{c.bathrooms ?? '—'}</td>
                                                <td className="px-3 py-3 text-[12px] font-bold text-slate-700 text-right whitespace-nowrap">{c.squareFootage?.toLocaleString() ?? '—'}</td>
                                                <td className="px-3 py-3 text-[12px] font-bold text-slate-700 text-right whitespace-nowrap">{c.lotSize ? c.lotSize.toLocaleString() : '—'}</td>
                                                <td className="px-3 py-3 text-[12px] font-bold text-slate-700 text-right whitespace-nowrap">{c.distance != null ? `${Number(c.distance).toFixed(2)} mi` : '—'}</td>
                                                <td className="px-3 py-3 text-[12px] font-bold text-slate-700 text-right">{daysAgo != null ? `${daysAgo}d` : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {fullyFiltered.length > SHOW_INITIAL && (
                        <button
                            onClick={() => setShowAllSale(v => !v)}
                            className="mt-4 w-full py-2.5 rounded-2xl border border-slate-200 text-xs font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            {showAllSale ? `Show less` : `Show all ${fullyFiltered.length} sale comps`}
                        </button>
                    )}
                </div>
            )}



        </div >
    );
};

export default PropertyCompsTab;
