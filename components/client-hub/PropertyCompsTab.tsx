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
    city: string;
    state: string;
    zipCode: string;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    yearBuilt: number;
    price: number;
    listedDate: string;
    removedDate?: string;
    daysOnMarket?: number;
    distance: number;
    correlation: number;
    latitude: number;
    longitude: number;
    propertyType?: string;
}

interface RentEstimate {
    rent: number;
    rentRangeLow: number;
    rentRangeHigh: number;
    comps: RentComp[];
}

interface RentComp {
    id: string;
    formattedAddress: string;
    city: string;
    state: string;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    price: number;
    daysOnMarket?: number;
    distance: number;
    correlation: number;
}

interface CachedComps {
    valueEstimate: ValueEstimate | null;
    rentEstimate: RentEstimate | null;
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

const SHOW_INITIAL = 6; // comps to show before "Show all"

// ─── Sub-components ───────────────────────────────────────────────────────────

function EstimateBanner({ label, value, low, high, color }: {
    label: string; value: number; low: number; high: number; color: string;
}) {
    return (
        <div className={`rounded-[1.5rem] border p-6 ${color}`}>
            <div className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
            <div className="text-4xl font-black mb-1">{fmt(value)}</div>
            <div className="text-[11px] font-bold opacity-70">
                Range: {fmt(low)} – {fmt(high)}
            </div>
        </div>
    );
}

function CompCard({ comp, type }: { comp: SaleComp | RentComp; type: 'sale' | 'rent' }) {
    const isSale = type === 'sale';
    const saleComp = isSale ? (comp as SaleComp) : null;
    const corrPct = Math.round((comp.correlation ?? 0) * 100);
    const corrColor = corrPct >= 80 ? 'text-emerald-600 bg-emerald-50' : corrPct >= 60 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-100';

    return (
        <div className="p-5 border border-slate-100 rounded-[1.25rem] hover:border-slate-200 hover:shadow-sm transition-all bg-white group">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-black text-slate-800 leading-snug truncate">{comp.formattedAddress}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">{comp.city}, {comp.state}</div>
                </div>
                <span className={`flex-shrink-0 text-[9px] font-black px-2 py-1 rounded-lg ${corrColor}`}>
                    {corrPct}% match
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center">
                    <div className="text-[15px] font-black text-slate-900">{fmt(comp.price)}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wide">{type === 'sale' ? 'Sale Price' : 'Rent/mo'}</div>
                </div>
                <div className="text-center">
                    <div className="text-[15px] font-black text-slate-700">{comp.squareFootage?.toLocaleString() ?? '—'}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Sq Ft</div>
                </div>
                <div className="text-center">
                    <div className="text-[15px] font-black text-slate-700">{comp.distance != null ? `${comp.distance.toFixed(1)} mi` : '—'}</div>
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Distance</div>
                </div>
            </div>

            <div className="flex items-center gap-3 text-[9px] text-slate-400 font-bold flex-wrap">
                <span>{comp.bedrooms ?? '—'} bd · {comp.bathrooms ?? '—'} ba</span>
                {comp.squareFootage && comp.price ? <span>{pricePsf(comp.price, comp.squareFootage)}</span> : null}
                {comp.daysOnMarket != null && <span>{comp.daysOnMarket} DOM</span>}
                {saleComp?.yearBuilt ? <span>Built {saleComp.yearBuilt}</span> : null}
                {saleComp?.listedDate && (
                    <span>{new Date(saleComp.listedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PropertyCompsTabProps {
    initialAddress?: string;
}

const PropertyCompsTab: React.FC<PropertyCompsTabProps> = ({ initialAddress = '' }) => {
    const [address, setAddress] = useState(initialAddress);
    const [bedrooms, setBedrooms] = useState('');
    const [bathrooms, setBathrooms] = useState('');
    const [sqft, setSqft] = useState('');
    const [propertyType, setPropertyType] = useState('Single Family');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cached, setCached] = useState<CachedComps | null>(null);

    const [showAllSale, setShowAllSale] = useState(false);
    const [showAllRent, setShowAllRent] = useState(false);

    const fetchComps = useCallback(async (addrOverride?: string) => {
        const trimmed = (addrOverride ?? address).trim();
        if (!trimmed) return;
        setLoading(true);
        setError(null);
        setCached(null);
        setShowAllSale(false);
        setShowAllRent(false);

        try {
            const key = cacheKey(trimmed);
            const cacheRef = doc(db, 'rentcast_comps', key);

            // ── Cache read ───────────────────────────────────────────────────
            const snap = await getDoc(cacheRef);
            if (snap.exists()) {
                const d = snap.data() as any;
                setCached({
                    valueEstimate: d.valueEstimate ?? null,
                    rentEstimate: d.rentEstimate ?? null,
                    queriedAt: d.queriedAt?.toDate?.() ?? new Date(),
                    address: d.address ?? trimmed,
                });
                setLoading(false);
                return;
            }

            // ── Live API calls ───────────────────────────────────────────────
            const headers = { 'X-Api-Key': APP_CONFIG.rentcast.key, 'Content-Type': 'application/json' };
            const base = APP_CONFIG.rentcast.baseUrl;

            const params = new URLSearchParams({ address: trimmed });
            if (bedrooms) params.set('bedrooms', bedrooms);
            if (bathrooms) params.set('bathrooms', bathrooms);
            if (sqft) params.set('squareFootage', sqft);
            if (propertyType) params.set('propertyType', propertyType);
            params.set('compCount', '20');

            const [valueRes, rentRes] = await Promise.allSettled([
                fetch(`${base}/avm/value?${params}`, { headers }),
                fetch(`${base}/avm/rent/long-term?${params}`, { headers }),
            ]);

            let valueEstimate: ValueEstimate | null = null;
            let rentEstimate: RentEstimate | null = null;

            if (valueRes.status === 'fulfilled' && valueRes.value.ok) {
                const json = await valueRes.value.json();
                valueEstimate = {
                    price: json.price,
                    priceRangeLow: json.priceRangeLow,
                    priceRangeHigh: json.priceRangeHigh,
                    latitude: json.latitude,
                    longitude: json.longitude,
                    listingType: json.listingType,
                    comps: json.comparables ?? [],
                };
            } else if (valueRes.status === 'fulfilled') {
                const txt = await valueRes.value.text();
                console.warn('Rentcast value error:', txt);
            }

            if (rentRes.status === 'fulfilled' && rentRes.value.ok) {
                const json = await rentRes.value.json();
                rentEstimate = {
                    rent: json.rent,
                    rentRangeLow: json.rentRangeLow,
                    rentRangeHigh: json.rentRangeHigh,
                    comps: json.comparables ?? [],
                };
            }

            // ── Cache write ──────────────────────────────────────────────────
            const payload: any = {
                address: trimmed,
                valueEstimate,
                rentEstimate,
                queriedAt: Timestamp.now(),
                bedrooms: bedrooms ? Number(bedrooms) : null,
                bathrooms: bathrooms ? Number(bathrooms) : null,
                squareFootage: sqft ? Number(sqft) : null,
                propertyType,
            };
            await setDoc(cacheRef, payload);

            setCached({
                valueEstimate,
                rentEstimate,
                queriedAt: new Date(),
                address: trimmed,
            });
        } catch (e: any) {
            setError(e.message ?? 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [address, bedrooms, bathrooms, sqft, propertyType]);

    // Auto-fetch when navigated here with an initialAddress
    useEffect(() => {
        if (initialAddress) {
            setAddress(initialAddress);
            fetchComps(initialAddress);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialAddress]);

    const saleComps = cached?.valueEstimate?.comps ?? [];
    const rentComps = cached?.rentEstimate?.comps ?? [];
    const visibleSale = showAllSale ? saleComps : saleComps.slice(0, SHOW_INITIAL);
    const visibleRent = showAllRent ? rentComps : rentComps.slice(0, SHOW_INITIAL);

    return (
        <div className="max-w-7xl mx-auto py-12 px-6 space-y-8 animate-in fade-in duration-500">

            {/* Header */}
            <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <span className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center">
                        <i className="fa-solid fa-chart-bar text-indigo-600 text-sm" />
                    </span>
                    Property Comps
                </h2>
                <p className="text-[11px] text-slate-400 font-medium mt-1 ml-[52px]">
                    Pulls sale &amp; rent comparables from Rentcast AVM. Results are cached permanently after the first lookup.
                </p>
            </div>

            {/* Search panel */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Property Address</label>

                {/* Address row */}
                <div className="relative">
                    <i className="fa-solid fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
                    <input
                        type="text"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !loading && fetchComps()}
                        placeholder="e.g. 123 Main St, Dublin, CA 94568"
                        className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200 text-[13px] font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition-all"
                        disabled={loading}
                    />
                </div>

                {/* Optional params */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Bedrooms', value: bedrooms, set: setBedrooms, placeholder: 'e.g. 3' },
                        { label: 'Bathrooms', value: bathrooms, set: setBathrooms, placeholder: 'e.g. 2' },
                        { label: 'Sq Footage', value: sqft, set: setSqft, placeholder: 'e.g. 1800' },
                    ].map(f => (
                        <div key={f.label}>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{f.label} <span className="normal-case font-medium opacity-60">(optional)</span></div>
                            <input
                                type="number"
                                value={f.value}
                                onChange={e => f.set(e.target.value)}
                                placeholder={f.placeholder}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                                disabled={loading}
                            />
                        </div>
                    ))}
                    <div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Property Type</div>
                        <select
                            value={propertyType}
                            onChange={e => setPropertyType(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                            disabled={loading}
                        >
                            {['Single Family', 'Condo', 'Townhouse', 'Multi Family', 'Manufactured'].map(t => (
                                <option key={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    onClick={fetchComps}
                    disabled={!address.trim() || loading}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:scale-[1.01] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2.5"
                >
                    {loading ? (
                        <><i className="fa-solid fa-spinner animate-spin text-xs" /> Fetching Comps…</>
                    ) : (
                        <><i className="fa-solid fa-magnifying-glass-chart text-xs" /> Get Comps</>
                    )}
                </button>
            </div>

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
                    {/* Meta bar */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] font-black text-slate-600">{cached.address}</span>
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest">
                            <i className="fa-solid fa-database text-[8px] mr-1" />
                            Cached {cached.queriedAt.toLocaleDateString()}
                        </span>
                    </div>

                    {/* Estimate banners */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cached.valueEstimate && (
                            <EstimateBanner
                                label="Estimated Sale Value"
                                value={cached.valueEstimate.price}
                                low={cached.valueEstimate.priceRangeLow}
                                high={cached.valueEstimate.priceRangeHigh}
                                color="bg-indigo-50 border-indigo-200 text-indigo-900"
                            />
                        )}
                        {cached.rentEstimate && (
                            <EstimateBanner
                                label="Estimated Monthly Rent"
                                value={cached.rentEstimate.rent}
                                low={cached.rentEstimate.rentRangeLow}
                                high={cached.rentEstimate.rentRangeHigh}
                                color="bg-violet-50 border-violet-200 text-violet-900"
                            />
                        )}
                        {!cached.valueEstimate && !cached.rentEstimate && (
                            <div className="col-span-2 py-10 text-center text-[11px] font-bold text-slate-400">
                                Rentcast returned no estimate for this address.
                            </div>
                        )}
                    </div>

                    {/* Sale Comps */}
                    {saleComps.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-[14px] font-black text-slate-900">Sale Comps</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">{saleComps.length} comparable sales found</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {visibleSale.map(c => <CompCard key={c.id} comp={c} type="sale" />)}
                            </div>
                            {saleComps.length > SHOW_INITIAL && (
                                <button
                                    onClick={() => setShowAllSale(v => !v)}
                                    className="mt-4 w-full py-2.5 rounded-2xl border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    {showAllSale ? `Show less` : `Show all ${saleComps.length} sale comps`}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Rent Comps */}
                    {rentComps.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-[14px] font-black text-slate-900">Rent Comps</h3>
                                    <p className="text-[10px] text-slate-400 font-medium">{rentComps.length} comparable rentals found</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {visibleRent.map(c => <CompCard key={(c as any).id ?? c.formattedAddress} comp={c} type="rent" />)}
                            </div>
                            {rentComps.length > SHOW_INITIAL && (
                                <button
                                    onClick={() => setShowAllRent(v => !v)}
                                    className="mt-4 w-full py-2.5 rounded-2xl border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                                >
                                    {showAllRent ? `Show less` : `Show all ${rentComps.length} rent comps`}
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
