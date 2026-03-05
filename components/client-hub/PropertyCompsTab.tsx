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
            // Fetch descriptions
            const descMap = new Map<string, string>();
            await Promise.all(eligible.map(async (c) => {
                try {
                    const snap = await getDoc(doc(db, 'sold_or_unlisted_properties', c.id));
                    const d = snap.exists() ? snap.data() : null;
                    if (d?.description && typeof d.description === 'string') {
                        descMap.set(c.id, d.description.slice(0, 500));
                    }
                } catch { /* ignore */ }
            }));

            const compsList = eligible.map(c => ({
                address: c.formattedAddress,
                city: c.city,
                state: c.state,
                zpid: c.id,
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
                description: descMap.get(c.id) ?? null,
            }));

            const subjectInfo = `${address}, ${subjectSqft ?? '?'} sqft, ${subjectBedrooms ?? '?'} bed, ${subjectBathrooms ?? '?'} bath, ${subjectHomeType ?? 'Single Family'}, Built ${subjectYearBuilt ?? '?'}, Listed at $${subjectListPrice?.toLocaleString() ?? '?'}, Lot ${subjectLotSize?.toLocaleString() ?? '?'} sqft`;

            const prompt = `Role: Senior Real Estate Data Architect for Zyphe.ai.
Task: Normalize a list of ${eligible.length} comparables against official records.

Subject Property: ${subjectInfo}

Comps Data:
${JSON.stringify(compsList, null, 2)}

Instructions:
1. GROUNDING: For subject property and each comp, use Google Search to find tax and public record data. Try these sources IN ORDER until you find the "Total Living Area" or "Building SqFt":
   a. County Assessor / Tax Assessor website (search "[address] [county] assessor parcel")
   b. Redfin "Public Facts" section (search "[address] redfin")
   c. Zillow "Public Facts" or "Home Facts" section (search "[address] zillow public facts")
   d. Realtor.com "Property Details" section
   NEVER return null for tax_sqft without trying ALL four sources. If all four fail, use the listing sqft as a fallback.
2. DATA EXTRACTION: Extract "Total Living Area" from the Tax Record vs. the Listing.
3. PHANTOM ANALYSIS: Identify if "Listing SqFt" > "Tax SqFt" by more than 10%. If yes, flag as "Unpermitted Utility."
4. NORMALIZATION: Calculate the "Adjusted $/SqFt" by dividing the Sold Price by the HIGHER of the two square footage numbers (reflecting the buyer's actual price for total utility).
5. FEATURE ADJUSTMENTS: Identify key value-shifters: Successor Trustee sales (distress), topography (sloped lots), or "Cash Only" status.
6. INCLUSION RECOMMENDATION: For each comp, determine if it should be included in calculating the average $/sqft for the subject property valuation. Exclude comps that are distressed, have major condition differences, or have unreliable data. Give a brief reason for exclusion.

Return ONLY valid JSON with this schema (no markdown, no code fences):
{
  "comp_analysis": [
    {
      "address": "string",
      "zpid": "string",
      "tax_sqft": number or null,
      "listing_sqft": number or null,
      "delta_percent": number or null,
      "normalized_psf": number or null,
      "adjustments": ["list of factors"],
      "confidence_score": number 1-10,
      "risk_flag": boolean,
      "include_in_avg": boolean,
      "exclude_reason": "string or null"
    }
  ],
  "final_summary": {
    "recommended_avg_psf": number,
    "subject_valuation": number,
    "normalization_notes": "string"
  }
}`;

            // ── Land Utility Prompt (runs in parallel) ────────────────────────
            const landPrompt = `Role: Senior Real Estate Appraiser and Land Use Architect for Zyphe.ai.
Objective: Generate a normalized CMA for ${eligible.length} properties by verifying square footage integrity and estimating usable lot utility.

Subject Property: ${subjectInfo}

Comp List:
${JSON.stringify(compsList, null, 2)}

USABLE LOT ESTIMATION
1. ZONING: Identify the Zoning District and search for the specific Setback and Lot Coverage requirements.
2. TOPOGRAPHIC SLOPE ANALYSIS: For the Subject and each Comp:
   a. Use USGS TopoView or Google Earth Terrain data to identify the Contour Interval.
   b. Calculate the Effective Slope % (Rise/Run) across the primary building envelope. Do NOT cap the result at 25%. Return the actual calculated slope percentage.
   c. Categorize the property based on the following scale:
      - Flat (<5%): No deduction.
      - Moderate (6-15%): 10% deduction (Retaining walls/terracing).
      - Steep (16-30%): 60% deduction (Severe building restrictions).
      - Heavy (>30%): 85% deduction (Legally unbuildable/Open Space only).
   d. UNKNOWN TOPOGRAPHY INFERENCE: If the Topography field is 'Unknown', perform these Inference Steps:
      - Use Google Search to find the Elevation of the property address and the elevation of the street 100 feet behind it.
      - Calculate Slope: Subtract the lower elevation from the higher elevation and divide by the distance (Rise/Run).
       - Assign Category:
        * Flat: < 5% grade (e.g., property sits on a flat bench).
        * Moderate: 6-15% grade.
        * Steep: 16-30% grade.
        * Heavy: > 30% grade (e.g., land drops sharply, legally unbuildable).
      - In your output, state in the topography field: 'Inferred as [Category] based on [X] feet of elevation change over [Y] feet of lot depth.'
      - NEVER return "Unknown" as the topography. Always infer using this method.
      - IMPORTANT: Ignore marketing descriptions for topography. If the lot size is > 30,000 sq ft and the elevation change exceeds 20 feet over the first 100 feet of depth, classify strictly as Heavy Slope.
3. CALCULATION: Estimate the 'Building Envelope' by subtracting mandatory setbacks, easements, and slope reductions from the Gross Lot Size.

Return ONLY valid JSON (no markdown, no code fences):
{
  "subject_audit": {
    "zoning_district": "string",
    "topography": "string",
    "slope_percent": number or null,
    "slope_category": "Flat | Moderate | Steep | Heavy",
    "topo_source_url": "string or null (URL used for topographic data)",
    "notes": "string"
  },
  "properties": [
    {
      "address": "string",
      "zpid": "string",
      "lot_utility": {"gross_lot_sqft": number or null, "zoning_district": "string", "topography": "string", "slope_percent": number or null, "slope_category": "Flat | Moderate | Steep | Heavy", "topo_source_url": "string or null", "building_envelope_sqft": number or null},
      "valuation": {"adjusted_psf": number or null, "key_adjustments": ["list"]}
    }
  ],
  "final_average_psf": number,
  "confidence_score": number 1-10
}`;

            console.log('[CompAnalysis] 🔄 Running normalization + land utility in parallel...');
            // Run both Gemini calls in parallel
            const [normResult, landResult] = await Promise.allSettled([
                executeGeminiRequest<any>({
                    model: FLASH_MODEL,
                    contents: prompt,
                    config: {
                        tools: [{ googleSearch: {} }],
                        systemInstruction: 'You are a senior real estate data architect. Always return valid JSON. Use Google Search to verify tax records and public facts for each comp.',
                        maxOutputTokens: 8192,
                    },
                    userId: 'unknown',
                    promptFilename: 'compNormalization',
                    zpid: subjectZpid,
                    address: address,
                    extractResultJson: true,
                }),
                executeGeminiRequest<any>({
                    model: FLASH_MODEL,
                    contents: landPrompt,
                    config: {
                        tools: [{ googleSearch: {} }],
                        systemInstruction: 'You are a senior real estate appraiser and land use architect. Always return valid JSON. Use Google Search to find zoning districts, setback requirements, and assessor records.',
                        maxOutputTokens: 8192,
                    },
                    userId: 'unknown',
                    promptFilename: 'compLandUtility',
                    zpid: subjectZpid,
                    address: address,
                    extractResultJson: true,
                }),
            ]);

            // Process normalization result
            const normData = normResult.status === 'fulfilled' ? normResult.value.data : null;
            const landData = landResult.status === 'fulfilled' ? landResult.value.data : null;

            if (normResult.status === 'rejected') console.warn('[CompAnalysis] Normalization failed:', normResult.reason);
            if (landResult.status === 'rejected') console.warn('[CompAnalysis] Land utility failed:', landResult.reason);

            if (!normData && !landData) throw new Error('Both analysis calls failed');

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

            const mergedComps = (normData?.comp_analysis ?? []).map((ca: any) => {
                const landComp = (landData?.properties ?? []).find((lp: any) => lp.zpid === ca.zpid || lp.address === ca.address);
                const lotCalc = landComp?.lot_utility ? calcUsableLot(landComp.lot_utility.gross_lot_sqft, landComp.lot_utility.slope_category, landComp.lot_utility.slope_percent) : null;
                const lotUtil = landComp?.lot_utility ? {
                    ...landComp.lot_utility,
                    usable_sqft: lotCalc?.usable ?? null,
                    lot_calc: lotCalc,
                } : null;
                return {
                    ...ca,
                    lot_utility: lotUtil,
                    land_valuation: landComp?.valuation ?? null,
                };
            });

            // Apply usable lot calc to subject audit too
            const subjectLotCalc = calcUsableLot(subjectLotSize ?? null, landData?.subject_audit?.slope_category, landData?.subject_audit?.slope_percent);
            const subjectAudit = landData?.subject_audit ? {
                ...landData.subject_audit,
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
                // Recalculate average using only non-excluded comps
                const finalComps = mergedComps.filter((c: any) => c.include_in_avg && !c.zyphe_excluded && typeof c.normalized_psf === 'number');
                if (finalComps.length > 0) {
                    const zypheAvgPsf = finalComps.reduce((sum: number, c: any) => sum + c.normalized_psf, 0) / finalComps.length;
                    const zypheValuation = typeof subjectSqft === 'number' ? Math.round(zypheAvgPsf * subjectSqft) : null;
                    normData.final_summary = {
                        ...normData.final_summary,
                        recommended_avg_psf: Math.round(zypheAvgPsf),
                        subject_valuation: zypheValuation,
                        outliers_dropped: mergedComps.filter((c: any) => c.zyphe_excluded).length,
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
                    await setDoc(doc(db, 'distress_analysis', subjectZpid), {
                        compNormalization: merged,
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
                            onRefresh();
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
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="fa-solid fa-chart-bar text-indigo-600 text-xs" />
                        </span>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Property Comps</span>

                    </div>

                    {/* Row 1: address + list price */}
                    <div className="flex items-baseline gap-3 flex-wrap">
                        <h2 className="text-xl font-black text-slate-900 leading-tight">{cached?.address ?? initialAddress}</h2>
                        {subjectListPrice != null && (
                            <span className="text-[13px] font-bold text-emerald-600 flex-shrink-0">
                                Listed at ${subjectListPrice.toLocaleString()}
                            </span>
                        )}
                    </div>

                    {/* Row 2: property detail pills (no label) */}
                    {(subjectBedrooms != null || subjectBathrooms != null || subjectSqft != null || subjectYearBuilt != null || subjectHomeType || subjectLotSize != null) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            {subjectHomeType && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-700">
                                    <i className="fa-solid fa-house text-[8px]" />
                                    {subjectHomeType}
                                </span>
                            )}
                            {subjectBedrooms != null && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                                    <i className="fa-solid fa-bed text-[8px] text-slate-400" />
                                    {subjectBedrooms} bd
                                </span>
                            )}
                            {subjectBathrooms != null && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                                    <i className="fa-solid fa-bath text-[8px] text-slate-400" />
                                    {subjectBathrooms} ba
                                </span>
                            )}
                            {subjectSqft != null && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                                    <i className="fa-solid fa-ruler-combined text-[8px] text-slate-400" />
                                    {subjectSqft.toLocaleString()} sf
                                </span>
                            )}
                            {subjectLotSize != null && fmtLotSize(subjectLotSize) && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                                    <i className="fa-solid fa-expand text-[8px] text-slate-400" />
                                    {fmtLotSize(subjectLotSize)}
                                </span>
                            )}
                            {subjectYearBuilt != null && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600">
                                    <i className="fa-solid fa-calendar text-[8px] text-slate-400" />
                                    Built {subjectYearBuilt}
                                </span>
                            )}
                            {subjectListPrice != null && subjectSqft != null && subjectSqft > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-700">
                                    <i className="fa-solid fa-tag text-[8px]" />
                                    ${Math.round(subjectListPrice / subjectSqft)}/sf
                                </span>
                            )}
                        </div>
                    )}
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

                    {/* ── Zyphe Estimated Value ──────────────────────────── */}
                    {(() => {
                        if (!subjectSqft || subjectSqft <= 0 || saleComps.length === 0) return null;
                        // Use Gemini's include_in_avg recommendations if available
                        const geminiRecs = compAnalysisResult?.comp_analysis as any[] | undefined;
                        let eligible = saleComps
                            .filter(c => !c.isOutlier && !c.priceUnverified && c.adjustedPrice && c.squareFootage && c.squareFootage > 0)
                            .sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || (a.distance ?? 99) - (b.distance ?? 99));
                        if (geminiRecs && geminiRecs.length > 0) {
                            // Filter to only Gemini-recommended comps
                            const includedZpids = new Set(geminiRecs.filter(r => r.include_in_avg && !r.zyphe_excluded).map(r => r.zpid));
                            const geminiFiltered = eligible.filter(c => includedZpids.has(c.id));
                            if (geminiFiltered.length > 0) {
                                eligible = geminiFiltered;
                            } else {
                                eligible = eligible.slice(0, 3); // fallback
                            }
                        } else {
                            eligible = eligible.slice(0, 3);
                        }
                        if (eligible.length === 0) return null;
                        const avgAdjPsf = eligible.reduce((s, c) => s + (c.adjustedPrice! / c.squareFootage!), 0) / eligible.length;
                        const zypheValue = Math.round(avgAdjPsf * subjectSqft);
                        const vsDelta = subjectListPrice ? ((zypheValue - subjectListPrice) / subjectListPrice * 100) : null;
                        return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                                            <i className="fa-solid fa-gem text-indigo-600 text-[12px]" />
                                        </span>
                                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Zyphe Estimated Value</span>
                                    </div>
                                    <div className="flex items-baseline gap-3 flex-wrap">
                                        <span className="text-3xl font-black text-indigo-900">${zypheValue.toLocaleString()}</span>
                                        {vsDelta != null && (
                                            <span className={`text-[12px] font-bold ${vsDelta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {vsDelta > 0 ? '+' : ''}{vsDelta.toFixed(1)}% vs list
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium mt-1.5">
                                        Based on avg adjusted $/sqft of top {eligible.length} comp{eligible.length > 1 ? 's' : ''} (${Math.round(avgAdjPsf)}/sqft) × {subjectSqft.toLocaleString()} sqft
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        {eligible.map((c, i) => {
                                            const cPsf = Math.round(c.adjustedPrice! / c.squareFootage!);
                                            return (
                                                <div key={c.id} className="flex items-center gap-2 text-xs">
                                                    <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-600 font-black flex items-center justify-center text-[10px]">{i + 1}</span>
                                                    <a href={`https://www.zillow.com/homedetails/${c.id}_zpid/`} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline truncate max-w-[200px]">{c.formattedAddress}</a>
                                                    <span className="text-slate-400 font-medium">${cPsf}/sf</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {subjectZestimate != null && subjectZestimate > 0 && (
                                    <div className="rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                                                <i className="fa-solid fa-chart-line text-blue-600 text-[12px]" />
                                            </span>
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Zillow Zestimate</span>
                                        </div>
                                        <div className="flex items-baseline gap-3 flex-wrap">
                                            <span className="text-3xl font-black text-slate-800">${subjectZestimate.toLocaleString()}</span>
                                            {(() => {
                                                const zDelta = ((subjectZestimate - zypheValue) / zypheValue * 100);
                                                return (
                                                    <span className={`text-[12px] font-bold ${zDelta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {zDelta > 0 ? '+' : ''}{zDelta.toFixed(1)}% vs Zyphe
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <p className="text-xs text-slate-400 font-medium mt-1.5">
                                            Zillow&apos;s automated valuation model estimate
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

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

                    {/* ── Gemini Comp Analysis ──────────────────────── */}
                    {saleComps.length > 0 && (
                        <div className="mt-6">

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
                                const subjectAudit = analysis?.subject_audit;

                                // Compute lot calc at render time (handles cached data without lot_calc)
                                const getLotCalc = (grossSqft: number | null | undefined, slopeCategory: string | null | undefined, slopePct: number | null | undefined) => {
                                    if (typeof grossSqft !== 'number' || grossSqft <= 0) return null;
                                    const cappedLot = Math.min(grossSqft, 30000);
                                    const setbackDeduction = cappedLot <= 12000 ? cappedLot * 0.25 : 3000 + (cappedLot - 12000) * 0.01;
                                    const afterSetback = grossSqft - setbackDeduction;
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
                                    return { gross: Math.round(grossSqft), setback_deduction: Math.round(setbackDeduction), slope_deduction_pct: slopeDeductionPct, slope_deduction: Math.round(slopeDeduction), usable: Math.round(afterSetback - slopeDeduction) };
                                };
                                const subjectLotCalc = subjectAudit?.lot_calc ?? getLotCalc(subjectLotSize ?? null, subjectAudit?.slope_category, subjectAudit?.slope_percent);
                                return (
                                    <div className="mt-5 border border-violet-100 rounded-[1.5rem] overflow-hidden bg-gradient-to-br from-violet-50/40 to-indigo-50/40">
                                        {/* Header */}
                                        <div className="px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-between flex-wrap gap-3">
                                            <div className="flex items-center gap-2 text-white">
                                                <i className="fa-solid fa-wand-magic-sparkles" />
                                                <span className="text-[13px] font-black uppercase tracking-widest">Top Comps Normalization</span>
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
                                            {/* Subject Property Audit */}
                                            {subjectAudit && (
                                                <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4">
                                                    <div className="text-xs font-black text-teal-700 uppercase tracking-widest mb-2">
                                                        <i className="fa-solid fa-map-location-dot mr-1" />Subject Property Land Audit
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                                        <div>
                                                            <div className="text-slate-400 font-bold">Zoning District</div>
                                                            <div className="font-black text-slate-700">{subjectAudit.zoning_district ?? '—'}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-slate-400 font-bold">Slope</div>
                                                            <div className={`font-black ${subjectAudit.slope_category === 'Heavy' || subjectAudit.slope_category === 'Steep' ? 'text-red-600' : subjectAudit.slope_category === 'Moderate' ? 'text-amber-600' : 'text-slate-700'}`}>
                                                                {subjectAudit.slope_percent != null ? `${subjectAudit.slope_percent}%` : ''}{subjectAudit.slope_category ? `${subjectAudit.slope_percent != null ? ' ' : ''}${subjectAudit.slope_category}` : '—'}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-slate-400 font-bold">Net Usable Land</div>
                                                            <div className="font-black text-teal-700">{(subjectLotCalc?.usable ?? subjectAudit.usable_lot)?.toLocaleString() ?? '—'} sf</div>
                                                        </div>
                                                    </div>
                                                    {subjectLotCalc && (
                                                        <div className="mt-2 flex items-center gap-1 text-xs font-mono text-slate-500 flex-wrap">
                                                            <span className="font-bold text-slate-600">{subjectLotCalc.gross.toLocaleString()}</span>
                                                            <span>−</span>
                                                            <span className="text-amber-600">{subjectLotCalc.setback_deduction.toLocaleString()} setback (SB 9/AB 1154)</span>
                                                            <span>−</span>
                                                            <span className="text-red-500">{subjectLotCalc.slope_deduction.toLocaleString()} slope ({subjectLotCalc.slope_deduction_pct}%)</span>
                                                            <span>=</span>
                                                            <span className="font-bold text-teal-700">{subjectLotCalc.usable.toLocaleString()} sf</span>
                                                        </div>
                                                    )}

                                                    {subjectAudit.notes && (
                                                        <div className="mt-2 text-xs text-slate-500 italic">{subjectAudit.notes}</div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Per-comp analysis */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {comps.map((ca: any, idx: number) => (
                                                    <div key={idx} className={`rounded-xl border p-4 bg-white ${ca.zyphe_excluded ? 'border-orange-400' : ca.risk_flag ? 'border-amber-300' : ca.include_in_avg === false ? 'border-red-200 opacity-70' : 'border-slate-200'}`}>
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="text-[12px] font-bold text-slate-800 leading-snug max-w-[60%]">{ca.address}</div>
                                                            <div className="flex items-center gap-1 flex-wrap justify-end">
                                                                {ca.zyphe_excluded ? <span className="text-[11px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">✗ Stat Outlier</span> : ca.include_in_avg === true && <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">✓ In Avg</span>}
                                                                {!ca.zyphe_excluded && ca.include_in_avg === false && <span className="text-[11px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">✗ Excluded</span>}

                                                                {ca.risk_flag && <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1 rounded">⚠ Risk</span>}
                                                            </div>
                                                        </div>
                                                        {ca.zyphe_excluded && ca.zyphe_exclude_reason && (
                                                            <div className="text-xs text-orange-600 font-medium mb-2 italic">{ca.zyphe_exclude_reason}</div>
                                                        )}
                                                        {!ca.zyphe_excluded && ca.include_in_avg === false && ca.exclude_reason && (
                                                            <div className="text-xs text-red-500 font-medium mb-2 italic">{ca.exclude_reason}</div>
                                                        )}
                                                        {/* SqFt + Slope in one row */}
                                                        <div className="grid grid-cols-5 gap-2 text-xs mb-2">
                                                            <div>
                                                                <div className="text-slate-400 font-bold">Built Area (Public Records)</div>
                                                                <div className="font-black text-slate-700">{ca.tax_sqft?.toLocaleString() ?? '—'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-slate-400 font-bold">Listing SqFt</div>
                                                                <div className="font-black text-slate-700">{ca.listing_sqft?.toLocaleString() ?? '—'}</div>
                                                            </div>
                                                            {ca.lot_utility && (() => {
                                                                const compLotCalc = ca.lot_utility.lot_calc ?? getLotCalc(ca.lot_utility.gross_lot_sqft, ca.lot_utility.slope_category, ca.lot_utility.slope_percent);
                                                                return (
                                                                    <>
                                                                        <div>
                                                                            <div className="text-teal-500 font-bold">Slope</div>
                                                                            <div className={`font-black ${ca.lot_utility.slope_category === 'Heavy' || ca.lot_utility.slope_category === 'Steep' ? 'text-red-600' : ca.lot_utility.slope_category === 'Moderate' ? 'text-amber-600' : 'text-slate-700'}`}>
                                                                                {ca.lot_utility.slope_percent != null ? `${ca.lot_utility.slope_percent}%` : ''}{ca.lot_utility.slope_category ? `${ca.lot_utility.slope_percent != null ? ' ' : ''}${ca.lot_utility.slope_category}` : '—'}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-teal-500 font-bold">Lot Size</div>
                                                                            <div className="font-black text-slate-700">{ca.lot_utility.gross_lot_sqft?.toLocaleString() ?? '—'} sf</div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-teal-500 font-bold">Usable Lot</div>
                                                                            <div className="font-black text-teal-700">{compLotCalc?.usable?.toLocaleString() ?? '—'} sf</div>
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                        {/* Lot calc formula */}
                                                        {ca.lot_utility && (() => {
                                                            const compLotCalc = ca.lot_utility.lot_calc ?? getLotCalc(ca.lot_utility.gross_lot_sqft, ca.lot_utility.slope_category, ca.lot_utility.slope_percent);
                                                            return compLotCalc ? (
                                                                <div className="text-xs mb-2 bg-teal-50/50 rounded-lg p-2 border border-teal-100">
                                                                    <div className="flex items-center gap-1 text-xs font-mono text-slate-500 flex-wrap">
                                                                        <span className="font-bold text-slate-600">{compLotCalc.gross.toLocaleString()}</span>
                                                                        <span>−</span>
                                                                        <span className="text-amber-600">{compLotCalc.setback_deduction.toLocaleString()} setback (SB 9/AB 1154)</span>
                                                                        <span>−</span>
                                                                        <span className="text-red-500">{compLotCalc.slope_deduction.toLocaleString()} slope ({compLotCalc.slope_deduction_pct}%)</span>
                                                                        <span>=</span>
                                                                        <span className="font-bold text-teal-700">{compLotCalc.usable.toLocaleString()} sf</span>
                                                                    </div>
                                                                </div>
                                                            ) : null;
                                                        })()}

                                                        {(ca.adjustments?.length > 0 || ca.land_valuation?.key_adjustments?.length > 0) && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {(ca.adjustments ?? []).map((adj: string, i: number) => (
                                                                    <span key={`a-${i}`} className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{adj}</span>
                                                                ))}
                                                                {(ca.land_valuation?.key_adjustments ?? []).map((adj: string, i: number) => (
                                                                    <span key={`l-${i}`} className="text-[11px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">{adj}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}


                </div>
            )}
        </div>
    );
};

export default PropertyCompsTab;
