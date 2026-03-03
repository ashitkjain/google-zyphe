import React, { useState, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../../services/firebaseService';
import { APP_CONFIG } from '../../config';
import { getZipsForCity, saveZipSoldListings, getZipSoldListings } from '../../services/firebase/cityData';

// ── Types ──────────────────────────────────────────────────────────────────────

type FetchPhase = 'idle' | 'fetching' | 'done' | 'error';
type IngestStatus = 'pending' | 'skipped' | 'fetching' | 'saved' | 'error';

interface ListingRow {
    zpid: string;
    address: string;
    zip: string;
    city: string;
    state: string;
    cityTab: string; // "City, ST" grouping key
    price: number | null;
    soldDate: string | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    raw: any;
    ingestStatus: IngestStatus;
    ingestError?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const extractId = (item: any): string =>
    String(item.property_id || item.zpid || item.listing_id || item.mls_id || Math.random());

const extractAddress = (item: any): string => {
    const a = item.location?.address;
    if (!a) return item.address || item.streetAddress || '—';
    return [a.line, a.city, a.state_code, a.postal_code].filter(Boolean).join(', ');
};

const extractCity = (item: any): string =>
    item.location?.address?.city || item.city || '';

const extractState = (item: any): string =>
    item.location?.address?.state_code || item.location?.address?.state || item.state || '';

const extractPrice = (item: any): number | null => {
    const p = item.price || item.list_price || item.lastSoldPrice;
    return p ? Number(p) : null;
};

const extractSoldDate = (item: any): string | null => {
    const raw = getSoldDateValue(item);
    if (!raw) return null;
    try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { /* fall through */ }
    return raw;
};

const fmt = (n: number | null, prefix = '') =>
    n != null ? `${prefix}${n.toLocaleString()}` : '—';

// How many months back to keep (API ignores soldInLast param, so we filter client-side)
const DATE_FILTER_MONTHS = 6;

// Only actual sold-date fields — do NOT include datePosted or lastSoldPrice
const SOLD_DATE_FIELDS = [
    'dateSold', 'lastSoldDate', 'soldDate',
    'date_sold', 'sold_date',
    'contractDate', 'closedDate',
];

const getSoldDateValue = (item: any): string | null => {
    for (const field of SOLD_DATE_FIELDS) {
        const val = item[field];
        if (!val) continue;
        if (typeof val === 'string' && val.trim()) return val.trim();
        if (typeof val === 'number') {
            // Unix timestamp: detect ms (>1e12) vs seconds
            const ms = val > 1e12 ? val : val * 1000;
            return new Date(ms).toISOString();
        }
    }
    return null;
};

const withinSoldWindow = (item: any): boolean => {
    const dateStr = getSoldDateValue(item);
    if (!dateStr) return false; // no recognizable date field → exclude
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - DATE_FILTER_MONTHS);
        return d >= cutoff;
    } catch {
        return false;
    }
};

// ── Component ──────────────────────────────────────────────────────────────────

const SoldListingsTab: React.FC = () => {
    const [city, setCity] = useState('');

    // Step 1 state
    const [fetchPhase, setFetchPhase] = useState<FetchPhase>('idle');
    const [fetchLog, setFetchLog] = useState<string[]>([]);
    const [listings, setListings] = useState<ListingRow[]>([]);

    // Step 2 state
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [ingesting, setIngesting] = useState(false);
    const [ingestLog, setIngestLog] = useState<string[]>([]);
    const [ingestSummary, setIngestSummary] = useState<{ saved: number; skipped: number; errors: number } | null>(null);

    const addFetchLog = useCallback((msg: string) =>
        setFetchLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]), []);

    const addIngestLog = useCallback((msg: string) =>
        setIngestLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]), []);

    // ── Derived ───────────────────────────────────────────────────────────────

    // City/state tab groups sorted by count desc
    const cityTabs = useMemo(() => {
        const groups: Record<string, number> = {};
        listings.forEach(l => { groups[l.cityTab] = (groups[l.cityTab] || 0) + 1; });
        return Object.entries(groups).sort((a, b) => b[1] - a[1]);
    }, [listings]);

    // Listings visible in the active tab
    const tabListings = useMemo(() =>
        activeTab ? listings.filter(l => l.cityTab === activeTab) : [],
        [listings, activeTab]
    );

    // Select all / deselect all scoped to the active tab
    const allIds = useMemo(() => tabListings.map(l => l.zpid), [tabListings]);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    const someSelected = selectedIds.size > 0;

    // ── Step 1: Fetch sold listings ───────────────────────────────────────────

    const fetchSoldListingsForZip = async (zip: string, onPageLog?: (msg: string) => void): Promise<any[]> => {
        const config = APP_CONFIG.usHousingApi;

        const fetchPage = async (page: number): Promise<{ listings: any[]; totalPages: number }> => {
            const url = `https://${config.host}/propertyExtendedSearch?location=${zip}&status_type=RecentlySold&soldInLast=6m&page=${page}`;
            const resp = await fetch(url, {
                method: 'GET',
                headers: { 'X-RapidAPI-Key': config.key, 'X-RapidAPI-Host': config.host },
            });
            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 150)}`);
            }
            const result = await resp.json();
            const listings = Array.isArray(result) ? result : (result.props || result.results || []);
            const totalPages: number = result.totalPages ?? result.total_pages ?? 1;
            return { listings, totalPages };
        };

        // Page 1
        const { listings: page1, totalPages } = await fetchPage(1);
        const all = [...page1];
        onPageLog?.(`    p1/${totalPages}: ${page1.length} listings`);

        // Pages 2..N
        for (let p = 2; p <= totalPages; p++) {
            // 1s between pages to stay within rate limits
            await new Promise(r => setTimeout(r, 1000));
            const { listings: pageN } = await fetchPage(p);
            all.push(...pageN);
            onPageLog?.(`    p${p}/${totalPages}: ${pageN.length} listings`);
        }

        return all;
    };

    const handleFetch = async (forceRefresh = false) => {
        const cityTrimmed = city.trim();
        if (!cityTrimmed) return;

        setFetchPhase('fetching');
        setFetchLog([]);
        setListings([]);
        setSelectedIds(new Set());
        setIngestSummary(null);
        setIngestLog([]);

        addFetchLog(`Resolving zip codes for "${cityTrimmed}"…`);

        const zipsByState = await getZipsForCity(cityTrimmed);
        if (!zipsByState) {
            addFetchLog(`⚠ No zip codes found for "${cityTrimmed}". Run City Ingestion first.`);
            setFetchPhase('error');
            return;
        }

        const allZips = Object.values(zipsByState).flat();
        addFetchLog(`Found ${allZips.length} zip(s) across ${Object.keys(zipsByState).length} state(s)`);

        // Build zip → state lookup from cache data
        const zipToState: Record<string, string> = {};
        for (const [state, zips] of Object.entries(zipsByState)) {
            (zips as string[]).forEach(z => { zipToState[z] = state; });
        }

        const accumulated: ListingRow[] = [];
        const seen = new Set<string>();

        for (let i = 0; i < allZips.length; i++) {
            const zip = allZips[i];
            addFetchLog(`[${i + 1}/${allZips.length}] Zip ${zip}…`);
            try {
                let raw: any[];

                if (!forceRefresh) {
                    // Try cache first
                    const cached = await getZipSoldListings(zip);
                    if (cached && cached.listings?.length) {
                        const cacheAge = cached.fetchedAt?.toDate
                            ? Math.round((Date.now() - cached.fetchedAt.toDate().getTime()) / 3600000)
                            : '?';
                        addFetchLog(`  → Loaded ${cached.listings.length} from cache (${cacheAge}h old)`);
                        raw = cached.listings;
                    } else {
                        addFetchLog(`  → No cache found, fetching from RapidAPI…`);
                        raw = await fetchSoldListingsForZip(zip, addFetchLog);
                        await saveZipSoldListings(zip, raw);
                    }
                } else {
                    // Force refresh: always hit RapidAPI and overwrite cache
                    addFetchLog(`  → Force refresh: fetching from RapidAPI…`);
                    raw = await fetchSoldListingsForZip(zip, addFetchLog);
                    await saveZipSoldListings(zip, raw);
                }

                // Client-side date filter — API ignores soldInLast param
                const noDate = raw.filter(item => !getSoldDateValue(item)).length;
                const filtered = raw.filter(withinSoldWindow);
                addFetchLog(`  → ${raw.length} total · ${filtered.length} within last ${DATE_FILTER_MONTHS}mo · ${noDate} had no date (excluded)`);

                // Deduplicate and build rows from filtered set
                const stateCode = zipToState[zip] || '';
                const tabKey = [cityTrimmed, stateCode].filter(Boolean).join(', ');
                filtered.forEach(item => {
                    const id = extractId(item);
                    if (seen.has(id)) return;
                    seen.add(id);
                    accumulated.push({
                        zpid: id,
                        address: extractAddress(item),
                        zip,
                        city: cityTrimmed,
                        state: stateCode,
                        cityTab: tabKey,
                        price: extractPrice(item),
                        soldDate: extractSoldDate(item),
                        beds: item.bedrooms ?? item.description?.beds ?? null,
                        baths: item.bathrooms ?? item.description?.baths ?? null,
                        sqft: item.livingArea ?? item.description?.sqft ?? null,
                        raw: item,
                        ingestStatus: 'pending',
                    });
                });

                // Update UI incrementally
                setListings([...accumulated]);
            } catch (e: any) {
                addFetchLog(`  ⚠ Error for ${zip}: ${e.message}`);
            }

            if (i < allZips.length - 1) await new Promise(r => setTimeout(r, 1000));
        }

        // Auto-select all and switch to first city tab
        setSelectedIds(new Set(accumulated.map(l => l.zpid)));
        const firstTab = accumulated[0]?.cityTab ?? null;
        setActiveTab(firstTab);
        addFetchLog(`Done. ${accumulated.length} unique sold properties found.`);
        setFetchPhase('done');
    };

    // ── Step 2: Ingest selected properties ───────────────────────────────────

    const fetchPropertyDetail = async (zpid: string): Promise<any> => {
        const config = APP_CONFIG.usHousingApi;
        const resp = await fetch(`https://${config.host}/property?zpid=${zpid}`, {
            method: 'GET',
            headers: { 'X-RapidAPI-Key': config.key, 'X-RapidAPI-Host': config.host },
        });
        if (!resp.ok) throw new Error(`Detail API ${resp.status}`);
        return resp.json();
    };

    const updateListingStatus = useCallback((zpid: string, status: IngestStatus, error?: string) => {
        setListings(prev => prev.map(l => l.zpid === zpid ? { ...l, ingestStatus: status, ingestError: error } : l));
    }, []);

    const handleIngest = async () => {
        if (selectedIds.size === 0 || ingesting) return;
        setIngesting(true);
        setIngestLog([]);
        setIngestSummary(null);

        const targets = listings.filter(l => selectedIds.has(l.zpid));
        addIngestLog(`Starting ingestion for ${targets.length} selected properties…`);

        let saved = 0, skipped = 0, errors = 0;

        for (let i = 0; i < targets.length; i++) {
            const { zpid, address, raw } = targets[i];

            // Check if already exists
            try {
                const soldRef = doc(db, 'sold_or_unlisted_properties', zpid);
                const snap = await getDoc(soldRef);
                if (snap.exists()) {
                    updateListingStatus(zpid, 'skipped');
                    skipped++;
                    addIngestLog(`  [${i + 1}/${targets.length}] Skipped (exists): ${address}`);
                    continue;
                }
            } catch {
                // proceed anyway
            }

            // Fetch detail
            updateListingStatus(zpid, 'fetching');
            addIngestLog(`  [${i + 1}/${targets.length}] Fetching detail: ${address}`);

            try {
                let detail: any = {};
                const looksLikeZpid = /^\d+$/.test(zpid);
                if (looksLikeZpid) {
                    detail = await fetchPropertyDetail(zpid);
                }

                const merged = {
                    ...sanitizeForFirestore(raw),
                    ...sanitizeForFirestore(detail),
                    zpid,
                    movedAt: Timestamp.now(),
                    movedReason: 'recently_sold',
                };

                const soldRef = doc(db, 'sold_or_unlisted_properties', zpid);
                await setDoc(soldRef, merged);

                updateListingStatus(zpid, 'saved');
                saved++;
            } catch (e: any) {
                updateListingStatus(zpid, 'error', e.message);
                errors++;
                addIngestLog(`  ⚠ Error: ${e.message}`);
            }

            // 1.2s between each to respect rate limits
            if (i < targets.length - 1) await new Promise(r => setTimeout(r, 1200));
        }

        addIngestLog(`Done — Saved: ${saved}, Skipped: ${skipped}, Errors: ${errors}`);
        setIngestSummary({ saved, skipped, errors });
        setIngesting(false);
    };

    // ── Selection helpers ─────────────────────────────────────────────────────

    const toggleAll = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                allIds.forEach(id => next.delete(id));
            } else {
                allIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    const toggleOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const isFetching = fetchPhase === 'fetching';
    const hasFetched = fetchPhase === 'done' || (fetchPhase === 'error' && listings.length > 0);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="p-8 max-w-6xl mx-auto min-h-screen bg-slate-50/50">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <i className="fa-solid fa-house-circle-check text-emerald-600 text-2xl" />
                    Sold Listings Ingestion
                </h1>
                <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">
                    Step 1: Fetch recently-sold properties (last 6 months) from RapidAPI, cached in{' '}
                    <code className="bg-slate-100 px-1 rounded text-xs">zip_sold_listings_cache</code>.&ensp;
                    Step 2: Select properties and ingest them into{' '}
                    <code className="bg-slate-100 px-1 rounded text-xs">sold_or_unlisted_properties</code>.
                </p>
            </div>

            {/* ── STEP 1: Fetch ────────────────────────────────────────────── */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-black text-indigo-600">1</span>
                    </div>
                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">Fetch Sold Listings</span>
                </div>

                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[220px] space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City Name</label>
                        <input
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !isFetching && handleFetch()}
                            placeholder="e.g. Denver"
                            disabled={isFetching || ingesting}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400 transition-all disabled:opacity-50"
                        />
                    </div>
                    <button
                        onClick={() => handleFetch(false)}
                        disabled={isFetching || ingesting || !city.trim()}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-indigo-100"
                    >
                        {isFetching
                            ? <><i className="fa-solid fa-spinner animate-spin" />Fetching…</>
                            : <><i className="fa-solid fa-cloud-arrow-down" />Load Listings</>}
                    </button>
                    <button
                        onClick={() => handleFetch(true)}
                        disabled={isFetching || ingesting || !city.trim()}
                        title="Purge cache and fetch fresh data from RapidAPI"
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-rose-200 text-rose-600 bg-rose-50 text-[11px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all disabled:opacity-40"
                    >
                        <i className="fa-solid fa-rotate" />Force Refresh
                    </button>
                </div>

                {/* Fetch log */}
                {fetchLog.length > 0 && (
                    <div className="mt-4 bg-slate-900 rounded-2xl p-4 font-mono max-h-[180px] overflow-y-auto">
                        {fetchLog.map((line, i) => (
                            <div key={i} className={`text-[11px] leading-relaxed ${line.includes('⚠') ? 'text-rose-400' :
                                line.includes('Done') ? 'text-emerald-400' : 'text-slate-300'
                                }`}>{line}</div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── STEP 2: Select + Ingest ──────────────────────────────────── */}
            {hasFetched && listings.length > 0 && (
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden mb-6">
                    {/* Table header */}
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                            <span className="text-[11px] font-black text-emerald-600">2</span>
                        </div>
                        <span className="text-sm font-black text-slate-700 uppercase tracking-widest flex-1">
                            Select &amp; Ingest
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{listings.length} total · {selectedIds.size} selected</span>

                        <button
                            onClick={toggleAll}
                            disabled={ingesting}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-40"
                        >
                            {allSelected ? 'Deselect Tab' : 'Select Tab'}
                        </button>

                        <button
                            onClick={handleIngest}
                            disabled={!someSelected || ingesting || isFetching}
                            className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40 shadow-lg shadow-emerald-100"
                        >
                            {ingesting
                                ? <><i className="fa-solid fa-spinner animate-spin" />Ingesting…</>
                                : <><i className="fa-solid fa-upload" />Ingest {someSelected ? `${selectedIds.size} Selected` : ''}</>}
                        </button>
                    </div>

                    {/* City / State tabs */}
                    <div className="flex gap-2 overflow-x-auto px-6 pt-4 pb-3 border-b border-slate-100" style={{ scrollbarWidth: 'none' }}>
                        {cityTabs.map(([tab, count]) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-[11px] font-black whitespace-nowrap transition-all ${activeTab === tab
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                                    }`}
                            >
                                <i className="fa-solid fa-location-dot text-[9px]" />
                                {tab}
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-400'
                                    }`}>{count}</span>
                            </button>
                        ))}
                    </div>

                    {/* Property table */}
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            disabled={ingesting}
                                            className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Address</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Zip</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sold Date</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Beds</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Baths</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sqft</th>
                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {tabListings.map(l => (
                                    <tr
                                        key={l.zpid}
                                        onClick={() => !ingesting && toggleOne(l.zpid)}
                                        className={`cursor-pointer transition-colors ${selectedIds.has(l.zpid) ? 'bg-indigo-50/60' : 'hover:bg-slate-50/50'}`}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(l.zpid)}
                                                onChange={() => toggleOne(l.zpid)}
                                                disabled={ingesting}
                                                onClick={e => e.stopPropagation()}
                                                className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-[11px] font-bold text-slate-700 max-w-[240px] truncate">{l.address}</td>
                                        <td className="px-4 py-3 text-[11px] font-mono text-slate-400">{l.zip}</td>
                                        <td className="px-4 py-3 text-[11px] font-bold text-slate-600">{fmt(l.price, '$')}</td>
                                        <td className="px-4 py-3 text-[11px] text-slate-500">{l.soldDate || '—'}</td>
                                        <td className="px-4 py-3 text-[11px] text-slate-500">{fmt(l.beds)}</td>
                                        <td className="px-4 py-3 text-[11px] text-slate-500">{fmt(l.baths)}</td>
                                        <td className="px-4 py-3 text-[11px] text-slate-500">{fmt(l.sqft)}</td>
                                        <td className="px-4 py-3 text-right">
                                            {l.ingestStatus === 'pending' && <span className="text-[9px] font-black text-slate-300 uppercase">—</span>}
                                            {l.ingestStatus === 'fetching' && <span className="text-[9px] font-black text-indigo-500 uppercase"><i className="fa-solid fa-spinner animate-spin mr-1" />Fetching</span>}
                                            {l.ingestStatus === 'skipped' && <span className="text-[9px] font-black text-amber-500 uppercase">Skipped</span>}
                                            {l.ingestStatus === 'saved' && <span className="text-[9px] font-black text-emerald-600 uppercase"><i className="fa-solid fa-check mr-1" />Saved</span>}
                                            {l.ingestStatus === 'error' && (
                                                <span className="text-[9px] font-black text-rose-500 uppercase" title={l.ingestError}>
                                                    <i className="fa-solid fa-xmark mr-1" />Error
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {listings.length === 0 && fetchPhase === 'done' && (
                <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center text-slate-400">
                    <i className="fa-solid fa-house-circle-xmark text-3xl mb-3 text-slate-200" />
                    <p className="text-sm font-bold">No recently-sold properties found for this city.</p>
                </div>
            )}

            {/* Ingest summary */}
            {ingestSummary && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                        { label: 'Saved', value: ingestSummary.saved, color: 'emerald' },
                        { label: 'Skipped', value: ingestSummary.skipped, color: 'amber' },
                        { label: 'Errors', value: ingestSummary.errors, color: 'rose' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-2xl p-5 text-center`}>
                            <div className={`text-3xl font-black text-${color}-700`}>{value}</div>
                            <div className={`text-[10px] font-black text-${color}-500 uppercase tracking-widest mt-1`}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Ingest log */}
            {ingestLog.length > 0 && (
                <div className="bg-slate-900 rounded-[2rem] p-6 font-mono max-h-[280px] overflow-y-auto">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Ingestion Log</div>
                    {ingestLog.map((line, i) => (
                        <div key={i} className={`text-[11px] leading-relaxed ${line.includes('⚠') || line.includes('Error') ? 'text-rose-400' :
                            line.includes('Done') ? 'text-emerald-400' :
                                line.includes('Skipped') ? 'text-amber-400' : 'text-slate-300'
                            }`}>{line}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SoldListingsTab;
