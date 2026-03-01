import React, { useState, useRef } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebaseService';
import { getZipsForCity, getZipListings, saveZipMetadataBatch } from '../../services/firebase/cityData';
import { APP_CONFIG } from '../../config';
import { executeGeminiRequest, FLASH_MODEL } from '../../services/geminiService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DistressResult {
    zpid: string;
    address: string;
    city: string;
    distressScore: number;
    primaryIndicators: string[];
    hiddenRisks: string;
    negotiationLeverage: string;
    rawText: string;
    error?: string;
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

// ─── Main Component ───────────────────────────────────────────────────────────

const DistressedFinderTab: React.FC = () => {
    const [city, setCity] = useState('');
    const [status, setStatus] = useState<ScanStatus>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<DistressResult[]>([]);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [filterScore, setFilterScore] = useState(1); // min score to show
    const [sortBy, setSortBy] = useState<'score' | 'address'>('score');
    const logsEndRef = useRef<HTMLDivElement>(null);

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
        if (propData.price) parts.push(`Price: $${propData.price?.toLocaleString()}`);
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

    const handleSearch = async () => {
        const trimmedCity = city.trim();
        if (!trimmedCity) return;

        setStatus('fetching_zips');
        setLogs([]);
        setResults([]);
        setProgress(null);

        addLog(`Starting distress scan for: ${trimmedCity}`);

        try {
            // ── Step 1: Resolve zip codes ─────────────────────────────────────
            let targetZips: string[] = [];
            const isPostal = /^\d{5}(-\d{4})?$/.test(trimmedCity);

            if (isPostal) {
                targetZips = [trimmedCity];
                addLog(`Direct zip code: ${trimmedCity}`);
            } else {
                addLog(`Resolving zip codes for ${trimmedCity}...`);
                const cachedGroups = await getZipsForCity(trimmedCity);
                if (cachedGroups) {
                    targetZips = Object.values(cachedGroups).flat();
                    addLog(`Cache hit: ${targetZips.length} zip codes found`);
                }

                if (targetZips.length === 0) {
                    const zipConfig = APP_CONFIG.rapidapi.zipCodesApi;
                    addLog(`Querying zip code registry...`);
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
                }
            }

            if (targetZips.length === 0) {
                addLog(`⚠️ No zip codes found for "${trimmedCity}". Try a different city name.`);
                setStatus('error');
                return;
            }

            // ── Step 2: Fetch listings per zip & check Firestore ──────────────
            setStatus('fetching_listings');
            const uniqueZips = [...new Set(targetZips)];
            addLog(`Scanning ${uniqueZips.length} zip codes for active listings...`);

            const propertiesWithData: { zpid: string; address: string; city: string; data: any }[] = [];

            for (const zip of uniqueZips) {
                const cache = await getZipListings(zip);
                if (!cache?.listings?.length) {
                    addLog(`  ${zip}: no cached listings`);
                    continue;
                }
                addLog(`  ${zip}: ${cache.listings.length} listings — checking Firestore...`);

                for (const listing of cache.listings) {
                    const zpid = String(listing.property_id || listing.listing_id || listing.mls_id || listing.mls?.id || '');
                    if (!zpid) continue;

                    const docRef = doc(db, 'properties', zpid);
                    const snap = await getDoc(docRef);
                    if (!snap.exists()) continue;

                    const propData = snap.data();
                    const addr = propData.address || listing.location?.address?.line || zpid;
                    const propCity = propData.city || listing.location?.address?.city || trimmedCity;
                    propertiesWithData.push({ zpid, address: addr, city: propCity, data: propData });
                }
            }

            if (propertiesWithData.length === 0) {
                addLog(`⚠️ No properties with Firestore data found. Try running "Property Data" fetch first.`);
                setStatus('done');
                return;
            }

            addLog(`Found ${propertiesWithData.length} properties in Firestore. Starting AI analysis...`);

            // ── Step 3: Analyze each property with Gemini ─────────────────────
            setStatus('analyzing');
            setProgress({ done: 0, total: propertiesWithData.length });
            const userId = auth?.currentUser?.uid || 'unknown';
            const analysisResults: DistressResult[] = [];

            const CONCURRENCY = 3;
            for (let i = 0; i < propertiesWithData.length; i += CONCURRENCY) {
                const batch = propertiesWithData.slice(i, i + CONCURRENCY);
                await Promise.allSettled(batch.map(async ({ zpid, address, city: propCity, data }) => {
                    addLog(`  Analyzing: ${address}`);
                    const mlsText = buildMlsText(data);
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
                        analysisResults.push({
                            zpid,
                            address,
                            city: propCity,
                            distressScore: aiData.distress_score ?? 0,
                            primaryIndicators: aiData.primary_indicators ?? [],
                            hiddenRisks: aiData.hidden_risks ?? '',
                            negotiationLeverage: aiData.negotiation_leverage ?? '',
                            rawText: mlsText,
                        });
                    } catch (e: any) {
                        addLog(`  ⚠️ AI failed for ${address}: ${e.message}`);
                        analysisResults.push({
                            zpid, address, city: propCity,
                            distressScore: 0, primaryIndicators: [],
                            hiddenRisks: '', negotiationLeverage: '',
                            rawText: mlsText, error: e.message
                        });
                    }
                    setProgress(p => p ? { ...p, done: p.done + 1 } : null);
                }));
                // Brief pause between batches
                if (i + CONCURRENCY < propertiesWithData.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // Sort by score descending
            analysisResults.sort((a, b) => b.distressScore - a.distressScore);
            setResults(analysisResults);
            addLog(`✅ Analysis complete. ${analysisResults.length} properties scored.`);
            setStatus('done');
        } catch (e: any) {
            addLog(`❌ Error: ${e.message}`);
            setStatus('error');
        }
    };

    const filtered = results
        .filter(r => r.distressScore >= filterScore)
        .sort((a, b) => sortBy === 'score' ? b.distressScore - a.distressScore : a.address.localeCompare(b.address));

    const highDistress = results.filter(r => r.distressScore >= 7).length;
    const medDistress = results.filter(r => r.distressScore >= 4 && r.distressScore < 7).length;

    return (
        <div className="max-w-7xl mx-auto py-12 px-6 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <span className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center">
                        <i className="fa-solid fa-house-crack text-rose-600 text-sm" />
                    </span>
                    Find Distressed Properties
                </h2>
                <p className="text-[11px] text-slate-400 font-medium mt-1 ml-[52px]">
                    Analyzes MLS listing text stored in Firestore using Gemini AI to detect motivated sellers, as-is conditions, and financial distress signals.
                </p>
            </div>

            {/* Search bar */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">City or Zip Code</label>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-sm" />
                        <input
                            type="text"
                            value={city}
                            onChange={e => setCity(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && status === 'idle' && handleSearch()}
                            placeholder="e.g. Dublin, CA  or  94568"
                            className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200 text-[13px] font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition-all"
                            disabled={status !== 'idle' && status !== 'done' && status !== 'error'}
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={!city.trim() || (status !== 'idle' && status !== 'done' && status !== 'error')}
                        className="px-8 py-3.5 bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:scale-[1.03] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2.5"
                    >
                        {(status !== 'idle' && status !== 'done' && status !== 'error') ? (
                            <><i className="fa-solid fa-spinner animate-spin text-xs" /> Scanning…</>
                        ) : (
                            <><i className="fa-solid fa-magnifying-glass-chart text-xs" /> Find Distressed</>
                        )}
                    </button>
                </div>

                {/* Progress */}
                {progress && status === 'analyzing' && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">AI Analysis</span>
                            <span className="text-[10px] font-mono text-slate-400">{progress.done} / {progress.total}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-rose-500 to-orange-400 rounded-full transition-all duration-500"
                                style={{ width: `${(progress.done / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Status steps */}
                {status !== 'idle' && (
                    <div className="mt-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                        {(['fetching_zips', 'fetching_listings', 'analyzing', 'done'] as ScanStatus[]).map((s, i) => {
                            const labels = ['Zip Codes', 'Listings', 'AI Analysis', 'Complete'];
                            const steps: ScanStatus[] = ['fetching_zips', 'fetching_listings', 'analyzing', 'done'];
                            const sIdx = steps.indexOf(status);
                            const thisIdx = i;
                            const isDone = sIdx > thisIdx || status === 'done';
                            const isActive = sIdx === thisIdx;
                            return (
                                <React.Fragment key={s}>
                                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${isDone ? 'text-emerald-600 bg-emerald-50' : isActive ? 'text-rose-600 bg-rose-50' : 'text-slate-300 bg-slate-50'}`}>
                                        <i className={`fa-solid text-[9px] ${isDone ? 'fa-check' : isActive ? 'fa-spinner animate-spin' : 'fa-circle-dot'}`} />
                                        {labels[i]}
                                    </div>
                                    {i < 3 && <div className="w-4 h-px bg-slate-200" />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Summary stats */}
            {results.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 text-center">
                        <div className="text-3xl font-black text-slate-900">{results.length}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Properties Scanned</div>
                    </div>
                    <div className="bg-rose-50 rounded-[1.5rem] border border-rose-200 p-5 text-center">
                        <div className="text-3xl font-black text-rose-600">{highDistress}</div>
                        <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest mt-1">High Distress (7-10)</div>
                    </div>
                    <div className="bg-amber-50 rounded-[1.5rem] border border-amber-200 p-5 text-center">
                        <div className="text-3xl font-black text-amber-600">{medDistress}</div>
                        <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-1">Medium Distress (4-6)</div>
                    </div>
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    {/* Filter bar */}
                    <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-4 flex-wrap">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filters</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500">Min Score</span>
                            <div className="flex bg-slate-100 rounded-xl p-1 gap-0.5">
                                {[1, 4, 7].map(score => (
                                    <button
                                        key={score}
                                        onClick={() => setFilterScore(score)}
                                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${filterScore === score ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {score === 1 ? 'All' : score === 4 ? '4+' : '7+'}
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
                                        onClick={() => setSortBy(s)}
                                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all ${sortBy === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {s === 'score' ? 'Score' : 'Address'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <span className="ml-auto text-[10px] font-bold text-slate-400">{filtered.length} showing</span>
                    </div>

                    {/* Cards */}
                    <div className="divide-y divide-slate-100">
                        {filtered.map(r => {
                            const colors = scoreColor(r.distressScore);
                            return (
                                <div key={r.zpid} className="p-6 hover:bg-slate-50/40 transition-colors">
                                    <div className="flex items-start gap-5">
                                        {/* Score ring */}
                                        <div className={`flex-shrink-0 w-16 h-16 rounded-2xl border-2 ${colors.bg} ${colors.border} flex flex-col items-center justify-center`}>
                                            <span className={`text-2xl font-black ${colors.text}`}>{r.distressScore}</span>
                                            <span className={`text-[8px] font-black uppercase tracking-wide opacity-60 ${colors.text}`}>/10</span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[13px] font-black text-slate-900 leading-tight">{r.address}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{r.city} · {r.zpid}</div>
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
                                                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {/* Primary Indicators */}
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

                                                    {/* Hidden Risks */}
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Hidden Risks</div>
                                                        <p className="text-[10px] text-slate-600 leading-relaxed">{r.hiddenRisks || '—'}</p>
                                                    </div>

                                                    {/* Negotiation Leverage */}
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Negotiation Leverage</div>
                                                        <p className="text-[10px] text-slate-600 leading-relaxed">{r.negotiationLeverage || '—'}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div className="py-16 text-center">
                                <i className="fa-solid fa-house-circle-check text-4xl text-slate-100 mb-3 block" />
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No properties match this filter</p>
                            </div>
                        )}
                    </div>
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
        </div>
    );
};

export default DistressedFinderTab;
