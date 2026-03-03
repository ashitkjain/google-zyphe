import React, { useState, useRef, useEffect } from 'react';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs, documentId, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../services/firebaseService';
import { getZipsForCity, getZipListings, saveZipMetadataBatch } from '../../services/firebase/cityData';
import { APP_CONFIG } from '../../config';
import { executeGeminiRequest, FLASH_MODEL } from '../../services/geminiService';
import PropertyCompsTab from './PropertyCompsTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistressResult {
    zpid: string;
    address: string;
    city: string;
    state: string;
    cityKey: string;
    distressScore: number;
    primaryIndicators: string[];
    hiddenRisks: string;
    negotiationLeverage: string;
    rawText: string;
    description?: string;
    propertyType?: string;
    mlsName?: string;
    fromCache?: boolean;
    isNew?: boolean;
    analyzedAt?: Date;
    error?: string;
    latitude?: number;
    longitude?: number;
    listPrice?: number;
}

type ScanStatus = 'idle' | 'fetching_zips' | 'fetching_listings' | 'analyzing' | 'done' | 'error';

const DISTRESS_PROMPT = (mlsData: string) => `Act as a Real Estate Investment Analyst specializing in distressed assets and motivated sellers. I am going to provide you with the full MLS listing data. Your goal is to identify if this property is potentially 'distressed'.

Analyze the text using semantics for the following 'Red Flags':

Financial Keywords: Short sale, REO, bank-owned, subject to court approval, pre-foreclosure, auction, or third-party approval.

Condition Keywords: As-is, contractor special, handyman's dream, mold, foundation, teardown, probate, need TLC, contractor special deferred maintainence or cash-only etc.

Seller Motivation: Must sell, relocating, priced for quick sale, bring all offers, or estate sale.

Timing Clues: Back on market (BOM), 2nd or 3rd chance, or mentions of 'failed inspections.'

Output your analysis in this JSON format:
{
  "distress_score": <number 1-10>,
  "primary_indicators": [<string>, ...],
  "hidden_risks": "<string>",
  "negotiation_leverage": "<string>"
}

Here is the MLS Data:
${mlsData}`;

const DISTRESS_SCHEMA = {
    type: 'object',
    properties: {
        distress_score: { type: 'number' },
        primary_indicators: { type: 'array', items: { type: 'string' } },
        hidden_risks: { type: 'string' },
        negotiation_leverage: { type: 'string' },
    },
    required: ['distress_score', 'primary_indicators', 'hidden_risks', 'negotiation_leverage'],
};

function scoreColor(score: number) {
    if (score >= 7) return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', bar: 'bg-rose-500' };
    if (score >= 4) return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', bar: 'bg-amber-400' };
    return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', bar: 'bg-emerald-400' };
}

/** Normalize city input to Title Case so Firestore equality matches regardless of how user typed it. */
function toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DistressedFinderTabProps {
    onNavigateToComps?: (address: string) => void; // kept for backward-compat but no longer used
}

const DistressedFinderTab: React.FC<DistressedFinderTabProps> = () => {
    const [compsAddress, setCompsAddress] = useState<{ address: string; lat?: number; lng?: number; listPrice?: number } | null>(null);
    const [city, setCity] = useState('');
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [checkingNew, setCheckingNew] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<DistressResult[]>([]);
    const [searched, setSearched] = useState(false); // whether a search has been run
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [filterScore, setFilterScore] = useState(4); // default = Medium
    const [sortBy, setSortBy] = useState<'score' | 'address'>('score');
    const [priceMin, setPriceMin] = useState<number | ''>('');
    const [priceMax, setPriceMax] = useState<number | ''>('');
    const [filterPropertyType, setFilterPropertyType] = useState('');
    const [filterOnMLS, setFilterOnMLS] = useState<'all' | 'on' | 'off'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeCityTab, setActiveCityTab] = useState<string | null>(null);
    const [lastSearchedCity, setLastSearchedCity] = useState('');
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [cityQuery, setCityQuery] = useState('');
    const [showCitySuggestions, setShowCitySuggestions] = useState(false);
    const PAGE_SIZE = 10;
    const logsEndRef = useRef<HTMLDivElement>(null);

    // On mount: fetch distinct cities from distress_analysis using the city field
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(collection(db, 'distress_analysis'));
                const citySet = new Set<string>();
                snap.docs.forEach(d => {
                    const data = d.data() as any;
                    const c = data.city ?? '';
                    if (c) citySet.add(c);
                });
                setAvailableCities(Array.from(citySet).sort());
            } catch { /* silent */ }
        })();
    }, []);

    const addLog = (msg: string) => {
        setLogs(prev => {
            const next = [...prev, `${new Date().toLocaleTimeString()} — ${msg}`];
            setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            return next;
        });
    };

    const buildMlsText = (propData: any): string => {
        const parts: string[] = [];
        if (propData.address) parts.push(`Address: ${propData.address}`);
        if (propData.listPrice ?? propData.price) parts.push(`Price: $${(propData.listPrice ?? propData.price)?.toLocaleString()}`);
        if (propData.beds) parts.push(`Beds: ${propData.beds}`);
        if (propData.baths) parts.push(`Baths: ${propData.baths}`);
        if (propData.sqft) parts.push(`Sqft: ${propData.sqft}`);
        if (propData.yearBuilt) parts.push(`Year Built: ${propData.yearBuilt}`);
        if (propData.propertyType) parts.push(`Type: ${propData.propertyType}`);
        if (propData.status) parts.push(`Status: ${propData.status}`);
        if (propData.daysOnMarket != null) parts.push(`Days on Market: ${propData.daysOnMarket}`);
        if (propData.description) parts.push(`Description: ${propData.description}`);
        if (propData.remarks) parts.push(`Agent Remarks: ${propData.remarks}`);
        if (propData.publicRemarks) parts.push(`Public Remarks: ${propData.publicRemarks}`);
        if (propData.listingTerms) parts.push(`Listing Terms: ${propData.listingTerms}`);
        if (propData.specialConditions) parts.push(`Special Conditions: ${propData.specialConditions}`);
        if (propData.buyerAgentRemarks) parts.push(`Buyer Agent Remarks: ${propData.buyerAgentRemarks}`);
        return parts.join('\n') || 'No data available';
    };

    // ── Mode 1: Load from cache (distress_analysis WHERE city == X) ──────────
    const handleSearch = async (cityOverride?: string) => {
        const trimmedCity = toTitleCase((cityOverride ?? city).trim());
        if (!trimmedCity) return;

        setStatus('fetching_listings');
        setLogs([]);
        setResults([]);
        setProgress(null);
        setSearched(true);
        setLastSearchedCity(trimmedCity);
        setActiveCityTab(null);
        setCurrentPage(1);
        addLog(`Checking distress_analysis cache for: ${trimmedCity}...`);

        try {
            // Query distress_analysis collection by city field
            const q = query(
                collection(db, 'distress_analysis'),
                where('city', '==', trimmedCity)
            );
            const snap = await getDocs(q);

            if (snap.empty) {
                addLog(`No cached results found for "${trimmedCity}". Click "Check for New" to run analysis.`);
                setStatus('done');
                return;
            }

            const loaded: DistressResult[] = snap.docs.map(d => {
                const data = d.data() as any;
                const rawAddress = data.address ?? d.id;
                const propCity = data.city ?? trimmedCity;
                const propState = data.state ?? '';
                return {
                    zpid: d.id,
                    address: rawAddress,
                    city: propCity,
                    state: propState,
                    cityKey: propState ? `${propCity}, ${propState}` : propCity,
                    distressScore: data.distress_score ?? 0,
                    primaryIndicators: data.primary_indicators ?? [],
                    hiddenRisks: data.hidden_risks ?? '',
                    negotiationLeverage: data.negotiation_leverage ?? '',
                    rawText: '',
                    description: '',        // filled below from properties
                    fromCache: true,
                    analyzedAt: data.analyzed_at?.toDate?.() ?? undefined,
                    latitude: data.latitude ?? undefined,
                    longitude: data.longitude ?? undefined,
                };
            });

            // ── Batch-enrich from properties collection (listPrice / propertyType / description)
            // Firestore 'in' query limit is 30 — chunk accordingly
            try {
                const zpids = loaded.map(r => r.zpid);
                const CHUNK = 30;
                const propMap = new Map<string, any>();
                for (let i = 0; i < zpids.length; i += CHUNK) {
                    const chunk = zpids.slice(i, i + CHUNK);
                    const propSnap = await getDocs(
                        query(collection(db, 'properties'), where(documentId(), 'in', chunk))
                    );
                    propSnap.docs.forEach(d => propMap.set(d.id, d.data()));
                }
                loaded.forEach(r => {
                    const pd = propMap.get(r.zpid);
                    if (!pd) return;
                    r.listPrice = pd.listPrice ?? pd.price ?? pd.list_price ?? undefined;
                    r.propertyType = pd.homeType ?? pd.propertyType ?? pd.property_type ?? undefined;
                    r.description = pd.description || pd.publicRemarks || pd.remarks || '';
                    r.mlsName = pd.attribution?.mlsName ?? undefined;
                });
            } catch { /* non-fatal — display without enrichment */ }

            loaded.sort((a, b) => b.distressScore - a.distressScore);
            setResults(loaded);
            addLog(`✅ Loaded ${loaded.length} cached results for "${trimmedCity}".`);
            setStatus('done');
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`);
            setStatus('error');
        }
    };

    // ── Mode 2: Check for New ─────────────────────────────────────────────────
    const handleCheckForNew = async () => {
        const trimmedCity = toTitleCase(lastSearchedCity || city.trim());
        if (!trimmedCity) return;
        setCheckingNew(true);
        setProgress(null);
        addLog(`--- Checking for new properties in ${trimmedCity} ---`);

        try {
            // Step A: resolve zips
            let targetZips: string[] = [];
            const isPostal = /^\d{5}(-\d{4})?$/.test(trimmedCity);
            if (isPostal) {
                targetZips = [trimmedCity];
            } else {
                const cachedGroups = await getZipsForCity(trimmedCity);
                if (cachedGroups) targetZips = Object.values(cachedGroups).flat();

                if (targetZips.length === 0) {
                    const zipConfig = APP_CONFIG.rapidapi.zipCodesApi;
                    addLog(`Resolving zip codes via API...`);
                    const resp = await fetch(
                        `https://${zipConfig.host}${zipConfig.path}?q=${encodeURIComponent(trimmedCity)}`,
                        { headers: { 'X-RapidAPI-Key': zipConfig.key, 'X-RapidAPI-Host': zipConfig.host } }
                    );
                    const zipResult = await resp.json();
                    let entries: { zip: string; city: string; state: string }[] = [];
                    if (Array.isArray(zipResult)) {
                        entries = zipResult.map((x: any) => ({
                            zip: x.zipCode || x.zip_code || '',
                            city: x.uspsMainCityName || x.city || trimmedCity,
                            state: x.stateCode || x.state || 'Unknown'
                        }));
                    }
                    entries = entries.filter(e => e.zip);
                    targetZips = entries.map(e => e.zip);
                    if (entries.length > 0) {
                        await saveZipMetadataBatch(entries);
                        addLog(`Found ${targetZips.length} zip codes from API`);
                    }
                } else {
                    addLog(`Found ${targetZips.length} cached zip codes`);
                }
            }

            if (targetZips.length === 0) {
                addLog(`⚠️ No zip codes found for "${trimmedCity}".`);
                setCheckingNew(false);
                return;
            }

            // Step B: gather properties from zip listings (Firestore cached)
            const uniqueZips = [...new Set(targetZips)];
            addLog(`Scanning ${uniqueZips.length} zip codes for listings...`);

            const propertiesWithData: { zpid: string; address: string; city: string; state: string; data: any }[] = [];
            const existingZpids = new Set(results.map(r => r.zpid));

            for (const zip of uniqueZips) {
                const cache = await getZipListings(zip);
                if (!cache?.listings?.length) continue;

                for (const listing of cache.listings) {
                    const zpid = String(listing.property_id || listing.listing_id || listing.mls_id || listing.mls?.id || '');
                    if (!zpid) continue;

                    const docRef = doc(db, 'properties', zpid);
                    const snap = await getDoc(docRef);
                    if (!snap.exists()) continue;

                    const propData = snap.data();
                    const addr = propData.address || listing.location?.address?.line || zpid;
                    const propCity = propData.city || listing.location?.address?.city || trimmedCity;
                    const propState = propData.state || listing.location?.address?.state_code || '';
                    propertiesWithData.push({ zpid, address: addr, city: propCity, state: propState, data: propData });
                }
            }

            addLog(`Found ${propertiesWithData.length} properties total. Checking which are new...`);

            // Step C: find those NOT already in distress_analysis
            const newProperties: typeof propertiesWithData = [];
            for (const prop of propertiesWithData) {
                if (existingZpids.has(prop.zpid)) continue;
                const cacheRef = doc(db, 'distress_analysis', prop.zpid);
                const cacheSnap = await getDoc(cacheRef);
                if (cacheSnap.exists()) {
                    // Already cached but not in current results — add it silently
                    existingZpids.add(prop.zpid);
                } else {
                    newProperties.push(prop);
                }
            }

            if (newProperties.length === 0) {
                addLog(`✅ No new properties found — all ${propertiesWithData.length} are already analyzed.`);
                setCheckingNew(false);
                return;
            }

            addLog(`Found ${newProperties.length} new properties. Running AI analysis...`);
            const userId = auth?.currentUser?.uid || 'unknown';
            const newResults: DistressResult[] = [];
            setProgress({ done: 0, total: newProperties.length });

            const CONCURRENCY = 3;
            for (let i = 0; i < newProperties.length; i += CONCURRENCY) {
                const batch = newProperties.slice(i, i + CONCURRENCY);
                await Promise.allSettled(batch.map(async ({ zpid, address, city: propCity, state: propState, data }) => {
                    const mlsText = buildMlsText(data);
                    const cacheRef = doc(db, 'distress_analysis', zpid);
                    addLog(`  Analyzing: ${address}`);
                    try {
                        const { data: aiData } = await executeGeminiRequest<any>({
                            model: FLASH_MODEL,
                            contents: DISTRESS_PROMPT(mlsText),
                            config: { temperature: 0.3 },
                            userId,
                            zpid,
                            address,
                            promptFilename: 'distressedFinder.ts',
                            extractResultJson: true,
                            schema: DISTRESS_SCHEMA,
                        });

                        // Extract subject lat/lng from the properties document
                        const coords = data.coordinates;
                        const latitude: number | undefined = coords?.latitude ?? undefined;
                        const longitude: number | undefined = coords?.longitude ?? undefined;

                        await setDoc(cacheRef, {
                            distress_score: aiData.distress_score ?? 0,
                            primary_indicators: aiData.primary_indicators ?? [],
                            hidden_risks: aiData.hidden_risks ?? '',
                            negotiation_leverage: aiData.negotiation_leverage ?? '',
                            address,
                            city: propCity,
                            state: propState,
                            ...(latitude != null && { latitude }),
                            ...(longitude != null && { longitude }),
                            analyzed_at: Timestamp.now(),
                        });

                        newResults.push({
                            zpid, address, city: propCity, state: propState,
                            cityKey: propState ? `${propCity}, ${propState}` : propCity,
                            distressScore: aiData.distress_score ?? 0,
                            primaryIndicators: aiData.primary_indicators ?? [],
                            hiddenRisks: aiData.hidden_risks ?? '',
                            negotiationLeverage: aiData.negotiation_leverage ?? '',
                            description: data.description || data.publicRemarks || data.remarks || '',
                            propertyType: data.homeType ?? data.propertyType ?? data.property_type ?? undefined,
                            mlsName: data.attribution?.mlsName ?? undefined,
                            rawText: mlsText,
                            fromCache: false,
                            isNew: true,
                            analyzedAt: new Date(),
                            latitude,
                            longitude,
                            listPrice: data.listPrice ?? data.price ?? data.list_price ?? undefined,
                        });
                    } catch (e: any) {
                        addLog(`  ⚠️ AI failed for ${address}: ${e.message}`);
                        newResults.push({
                            zpid, address, city: propCity, state: propState,
                            cityKey: propState ? `${propCity}, ${propState}` : propCity,
                            distressScore: 0, primaryIndicators: [],
                            hiddenRisks: '', negotiationLeverage: '',
                            rawText: mlsText, isNew: true, error: e.message
                        });
                    }
                    setProgress(p => p ? { ...p, done: p.done + 1 } : null);
                }));
                if (i + CONCURRENCY < newProperties.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // Merge new results into existing, new ones at top
            setResults(prev => {
                const merged = [...newResults, ...prev];
                return merged;
            });
            addLog(`✅ Done. ${newResults.length} new properties analyzed.`);
            setProgress(null);
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`);
        } finally {
            setCheckingNew(false);
        }
    };

    // ── Derived display — group by City, State ───────────────────────────────────

    // Build a "City, State" key for each result
    const cityStateTabs = Array.from(new Set(results.map(r => {
        const c = r.city || 'Unknown';
        const s = r.state || '';
        return s ? `${c}, ${s}` : c;
    })))
        .map(key => ({
            key, count: results.filter(r => {
                const c = r.city || 'Unknown';
                const s = r.state || '';
                return (s ? `${c}, ${s}` : c) === key;
            }).length
        }))
        .sort((a, b) => b.count - a.count);

    const resolvedCityStateTab = activeCityTab && cityStateTabs.some(t => t.key === activeCityTab)
        ? activeCityTab
        : cityStateTabs[0]?.key ?? null;

    const filtered = results
        .filter(r => {
            const c = r.city || 'Unknown';
            const s = r.state || '';
            return (s ? `${c}, ${s}` : c) === resolvedCityStateTab;
        })
        .filter(r => r.distressScore >= filterScore)
        .filter(r => priceMin === '' || (r.listPrice != null && r.listPrice >= priceMin))
        .filter(r => priceMax === '' || (r.listPrice != null && r.listPrice <= priceMax))
        .filter(r => !filterPropertyType || r.propertyType === filterPropertyType)
        .filter(r => {
            if (filterOnMLS === 'on') return !!r.mlsName;
            if (filterOnMLS === 'off') return !r.mlsName;
            return true;
        })
        .sort((a, b) => {
            if (a.isNew && !b.isNew) return -1;
            if (!a.isNew && b.isNew) return 1;
            return sortBy === 'score' ? b.distressScore - a.distressScore : a.address.localeCompare(b.address);
        });

    // Unique property types from ALL results in active city tab (not just filtered)
    const availablePropertyTypes = Array.from(new Set(
        results
            .filter(r => {
                const c = r.city || 'Unknown';
                const s = r.state || '';
                return (s ? `${c}, ${s}` : c) === resolvedCityStateTab;
            })
            .map(r => r.propertyType)
            .filter((t): t is string => !!t)
    )).sort();

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const highDistress = results.filter(r => r.distressScore >= 7).length;
    const medDistress = results.filter(r => r.distressScore >= 4 && r.distressScore < 7).length;
    const newCount = results.filter(r => r.isNew).length;
    const isRunning = status !== 'idle' && status !== 'done' && status !== 'error';

    return (
        <div className="max-w-7xl mx-auto py-12 px-6 space-y-8 animate-in fade-in duration-500">

            {/* ── Inline Comps view ─────────────────────────────────── */}
            {compsAddress && (
                <div className="animate-in fade-in duration-300">
                    <PropertyCompsTab
                        initialAddress={compsAddress.address}
                        onBack={() => setCompsAddress(null)}
                        subjectLat={compsAddress.lat}
                        subjectLng={compsAddress.lng}
                        subjectListPrice={compsAddress.listPrice}
                    />
                </div>
            )}

            {/* Hide main content while comps view is open */}
            {compsAddress ? null : <>

                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <span className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                            <i className="fa-solid fa-house-crack text-rose-600 text-sm" />
                        </span>
                        Find Distressed Properties
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 ml-[52px]">
                        Searches cached AI analysis by city. Use <strong>Check for New</strong> to analyze new listings.
                    </p>
                </div>

                {/* Search bar */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">City</label>
                    <div className="flex gap-3">
                        {/* Autocomplete city input */}
                        <div className="relative flex-1">
                            <i className="fa-solid fa-house-laptop absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                value={cityQuery}
                                onChange={e => {
                                    setCityQuery(e.target.value);
                                    setShowCitySuggestions(true);
                                }}
                                onFocus={() => setShowCitySuggestions(true)}
                                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && cityQuery.trim()) {
                                        setShowCitySuggestions(false);
                                        setCity(cityQuery.trim());
                                        handleSearch(cityQuery.trim());
                                    }
                                    if (e.key === 'Escape') setShowCitySuggestions(false);
                                }}
                                placeholder="Search city…"
                                disabled={isRunning || checkingNew}
                                className="w-full pl-12 pr-4 py-3 bg-slate-100 border-2 border-transparent focus:bg-white focus:border-rose-400 rounded-2xl outline-none shadow-inner focus:shadow-lg transition-all text-xs font-medium text-slate-800 placeholder:text-slate-400 disabled:opacity-50"
                            />
                            {/* Suggestions dropdown */}
                            {showCitySuggestions && availableCities.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                    <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cities with Analysis</span>
                                        <span className="text-[9px] text-slate-300 font-medium">{availableCities.filter(c => !cityQuery || c.toLowerCase().includes(cityQuery.toLowerCase())).length} results</span>
                                    </div>
                                    <div className="max-h-[220px] overflow-y-auto p-1.5">
                                        {availableCities
                                            .filter(c => !cityQuery || c.toLowerCase().includes(cityQuery.toLowerCase()))
                                            .map(c => (
                                                <button
                                                    key={c}
                                                    onMouseDown={() => {
                                                        setCityQuery(c);
                                                        setCity(c);
                                                        setShowCitySuggestions(false);
                                                        handleSearch(c);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-rose-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-3 group"
                                                >
                                                    <i className="fa-solid fa-location-dot text-slate-300 group-hover:text-rose-400 transition-colors text-[10px]" />
                                                    {c}
                                                </button>
                                            ))
                                        }
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Main submit */}
                        <button
                            onClick={handleSearch}
                            disabled={!city.trim() || isRunning || checkingNew}
                            className="px-8 py-3.5 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:scale-[1.03] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2.5"
                        >
                            {isRunning ? (
                                <><i className="fa-solid fa-spinner animate-spin text-xs" /> Loading…</>
                            ) : (
                                <><i className="fa-solid fa-database text-xs" /> Load Cached</>
                            )}
                        </button>

                        {/* Check for New */}
                        {searched && (
                            <button
                                onClick={handleCheckForNew}
                                disabled={checkingNew || isRunning}
                                className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-200 hover:scale-[1.03] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2.5"
                            >
                                {checkingNew ? (
                                    <><i className="fa-solid fa-spinner animate-spin text-xs" /> Scanning…</>
                                ) : (
                                    <><i className="fa-solid fa-radar text-xs" /> Check for New</>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Progress bar */}
                    {progress && checkingNew && (
                        <div className="mt-4">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">AI Analysis — New Properties</span>
                                <span className="text-[10px] font-mono text-slate-400">{progress.done} / {progress.total}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 rounded-full transition-all duration-500"
                                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Empty state */}
                {searched && results.length === 0 && status === 'done' && !isRunning && !checkingNew && (
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm py-16 text-center">
                        <i className="fa-solid fa-house-circle-xmark text-4xl text-slate-100 mb-4 block" />
                        <p className="text-[13px] font-black text-slate-400">No cached analysis found for <span className="text-slate-700">"{lastSearchedCity}"</span></p>
                        <p className="text-[10px] text-slate-300 font-medium mt-2">Click <strong className="text-indigo-500">Check for New</strong> above to scan listings and run AI analysis.</p>
                    </div>
                )}


                {/* Results */}
                {results.length > 0 && (
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">

                        {/* Filter bar — above city tabs */}
                        <div className="px-6 pt-5 pb-4 border-b border-slate-100 space-y-3">
                            {/* Row 1: distress score + sort + count */}
                            <div className="flex items-center gap-4 flex-wrap">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filters</span>
                                <div className="flex items-center gap-2">
                                    <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
                                        {([{ score: 4, label: 'Medium' }, { score: 7, label: 'High' }, { score: 1, label: 'All' }] as { score: number; label: string }[]).map(({ score, label }) => (
                                            <button
                                                key={score}
                                                onClick={() => { setFilterScore(score); setCurrentPage(1); }}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${filterScore === score ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500">Sort</span>
                                    <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
                                        {(['score', 'address'] as ('score' | 'address')[]).map(s => (
                                            <button
                                                key={s}
                                                onClick={() => { setSortBy(s); setCurrentPage(1); }}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${sortBy === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {s === 'score' ? 'Score' : 'Address'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <span className="ml-auto text-[10px] font-bold text-slate-400">
                                    {filtered.length === 0 ? '0' : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)}`} of {filtered.length}
                                </span>
                            </div>

                            {/* Row 2: price range + property type + on MLS */}
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Price range */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Price</span>
                                    <div className="flex items-center gap-1">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">$</span>
                                            <input
                                                type="number"
                                                placeholder="Min"
                                                value={priceMin}
                                                onChange={e => { setPriceMin(e.target.value === '' ? '' : Number(e.target.value)); setCurrentPage(1); }}
                                                className="pl-4 pr-2 py-1 w-24 text-[10px] font-bold bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                            />
                                        </div>
                                        <span className="text-[9px] text-slate-300 font-bold">–</span>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">$</span>
                                            <input
                                                type="number"
                                                placeholder="Max"
                                                value={priceMax}
                                                onChange={e => { setPriceMax(e.target.value === '' ? '' : Number(e.target.value)); setCurrentPage(1); }}
                                                className="pl-4 pr-2 py-1 w-24 text-[10px] font-bold bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Property type */}
                                {availablePropertyTypes.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                                        <select
                                            value={filterPropertyType}
                                            onChange={e => { setFilterPropertyType(e.target.value); setCurrentPage(1); }}
                                            className="px-2 py-1 text-[10px] font-bold bg-slate-100 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 text-slate-700"
                                        >
                                            <option value="">All</option>
                                            {availablePropertyTypes.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* On MLS toggle */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MLS</span>
                                    <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
                                        {([{ val: 'all', label: 'All' }, { val: 'on', label: 'On MLS' }, { val: 'off', label: 'Off MLS' }] as { val: 'all' | 'on' | 'off'; label: string }[]).map(({ val, label }) => (
                                            <button
                                                key={val}
                                                onClick={() => { setFilterOnMLS(val); setCurrentPage(1); }}
                                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${filterOnMLS === val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Clear extra filters */}
                                {(priceMin !== '' || priceMax !== '' || filterPropertyType || filterOnMLS !== 'all') && (
                                    <button
                                        onClick={() => { setPriceMin(''); setPriceMax(''); setFilterPropertyType(''); setFilterOnMLS('all'); setCurrentPage(1); }}
                                        className="text-[9px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-wide transition-colors"
                                    >
                                        <i className="fa-solid fa-xmark mr-1" />Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* City / State tabs — below filters */}
                        {cityStateTabs.length > 0 && (
                            <div className="px-6 pt-4 flex items-center gap-2 flex-wrap border-b border-slate-100">
                                {cityStateTabs.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => { setActiveCityTab(tab.key); setCurrentPage(1); }}
                                        className={`flex items-center gap-1.5 px-4 py-2.5 mb-[-1px] rounded-t-xl text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${resolvedCityStateTab === tab.key
                                            ? 'border-rose-500 text-rose-600 bg-rose-50/60'
                                            : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        <i className="fa-solid fa-location-dot text-[8px]" />
                                        {tab.key}
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${resolvedCityStateTab === tab.key ? 'bg-rose-100 text-rose-500' : 'bg-slate-100 text-slate-400'
                                            }`}>{tab.count}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Cards */}
                        <div className="divide-y divide-slate-100">
                            {paginated.map(r => {
                                const colors = scoreColor(r.distressScore);
                                return (
                                    <div key={r.zpid} className={`p-6 hover:bg-slate-50/40 transition-colors ${r.isNew ? 'bg-indigo-50/30' : ''}`}>
                                        <div className="flex items-start gap-5">
                                            {/* Score ring */}
                                            <div className={`flex-shrink-0 w-16 h-16 rounded-2xl border-2 ${colors.bg} ${colors.border} flex flex-col items-center justify-center`}>
                                                <span className={`text-2xl font-black ${colors.text}`}>{r.distressScore}</span>
                                                <span className={`text-[8px] font-black uppercase tracking-wide opacity-60 ${colors.text}`}>/10</span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                            <a
                                                                href={`https://www.zillow.com/homes/${r.zpid}_zpid/`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[13px] font-black text-slate-900 leading-tight hover:text-indigo-600 hover:underline transition-colors"
                                                            >{r.address}</a>
                                                            {r.isNew && (
                                                                <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-wide flex items-center gap-1">
                                                                    <i className="fa-solid fa-sparkles text-[7px]" />New
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* ── Property summary strip ── */}
                                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                            {r.listPrice != null && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black">
                                                                    <i className="fa-solid fa-tag text-[8px]" />
                                                                    ${r.listPrice.toLocaleString()}
                                                                </span>
                                                            )}
                                                            {r.propertyType && (
                                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200">
                                                                    {r.propertyType}
                                                                </span>
                                                            )}
                                                            {r.mlsName && (
                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-lg text-[10px] font-bold border border-indigo-100">
                                                                    {r.mlsName}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {r.description && (
                                                            <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2 mb-1.5">{r.description}</p>
                                                        )}

                                                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                                                            <span>{r.city} · {r.zpid}</span>
                                                            {r.fromCache && !r.isNew && (
                                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[8px] font-black uppercase tracking-wide" title={r.analyzedAt ? `Analyzed ${r.analyzedAt.toLocaleDateString()}` : 'Cached'}>
                                                                    <i className="fa-solid fa-bolt text-[7px] mr-0.5" />Cached
                                                                </span>
                                                            )}
                                                            {r.distressScore >= 4 && (
                                                                <button
                                                                    onClick={async () => {
                                                                        let lat = r.latitude;
                                                                        let lng = r.longitude;
                                                                        let listPrice: number | undefined;
                                                                        // Fall back: look up from properties collection if distress_analysis
                                                                        // was written before lat/lng caching was added
                                                                        if (lat == null || lng == null) {
                                                                            try {
                                                                                const propSnap = await getDoc(doc(db, 'properties', r.zpid));
                                                                                if (propSnap.exists()) {
                                                                                    const pd = propSnap.data();
                                                                                    const coords = pd?.coordinates;
                                                                                    if (coords?.latitude != null) { lat = coords.latitude; lng = coords.longitude; }
                                                                                    listPrice = pd?.listPrice ?? pd?.price ?? pd?.list_price ?? undefined;
                                                                                }
                                                                            } catch { /* non-fatal */ }
                                                                        } else {
                                                                            // coords already known — still grab listPrice cheaply
                                                                            try {
                                                                                const propSnap = await getDoc(doc(db, 'properties', r.zpid));
                                                                                if (propSnap.exists()) {
                                                                                    const pd = propSnap.data();
                                                                                    listPrice = pd?.listPrice ?? pd?.price ?? pd?.list_price ?? undefined;
                                                                                }
                                                                            } catch { /* non-fatal */ }
                                                                        }
                                                                        setCompsAddress({ address: r.address, lat, lng, listPrice });
                                                                    }}
                                                                    className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded text-[8px] font-black uppercase tracking-wide hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                                                >
                                                                    <i className="fa-solid fa-chart-bar text-[7px]" />Comps
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Score bar */}
                                                    <div className="flex-shrink-0 w-24">
                                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                                                                style={{ width: `${(r.distressScore / 10) * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {r.error ? (
                                                    <div className="mt-2 text-[10px] text-rose-500 font-bold">{r.error}</div>
                                                ) : (
                                                    <div className="mt-3 space-y-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div>
                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primary Indicators</div>
                                                                {r.primaryIndicators.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {r.primaryIndicators.map((ind, i) => (
                                                                            <span key={i} className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${colors.bg} ${colors.text} ${colors.border}`}>
                                                                                {ind}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-300 font-bold">None detected</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Hidden Risks</div>
                                                                <p className="text-[10px] text-slate-600 leading-relaxed">{r.hiddenRisks || '—'}</p>
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Negotiation Leverage</div>
                                                                <p className="text-[10px] text-slate-600 leading-relaxed">{r.negotiationLeverage || '—'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {paginated.length === 0 && (
                                <div className="py-16 text-center">
                                    <i className="fa-solid fa-house-circle-check text-4xl text-slate-100 mb-3 block" />
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No properties match this filter</p>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={safePage === 1}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                >
                                    <i className="fa-solid fa-chevron-left text-[9px]" /> Prev
                                </button>
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                                        .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, i) => p === '…' ? (
                                            <span key={`ellipsis-${i}`} className="px-2 text-slate-300 text-[10px] font-bold">…</span>
                                        ) : (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p as number)}
                                                className={`w-8 h-8 rounded-xl text-[10px] font-black transition-all ${safePage === p ? 'bg-rose-600 text-white shadow-md shadow-rose-200' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={safePage === totalPages}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                >
                                    Next <i className="fa-solid fa-chevron-right text-[9px]" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Log console */}
                {logs.length > 0 && (
                    <div className="bg-slate-900 rounded-[2rem] overflow-hidden">
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scan Log</span>
                            <button
                                onClick={() => setLogs([])}
                                className="text-[9px] font-black text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="p-5 h-48 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1 custom-scrollbar">
                            {logs.map((log, i) => <div key={i}>{log}</div>)}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}
            </> /* end main content */}
        </div>
    );
};

export default DistressedFinderTab;
