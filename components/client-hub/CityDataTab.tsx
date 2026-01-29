
import React, { useState, useMemo } from 'react';
import { APP_CONFIG } from '../../config';
import {
    saveZipMetadataBatch,
    getZipsForCity,
    saveZipListings,
    getZipListings
} from '../../services/firebase/cityData';
import { savePropertyToCloud, checkExistingPropertiesBatch } from '../../services/firebase/properties';
import { PropertyData } from '../../types';
import { runFullIntelligencePipeline, PipelineProgress } from '../../services/preloadService';
import { getLLMLogsForTimeRange } from '../../services/firebase/llm_logs';
import { getAPILogsForTimeRange } from '../../services/firebase/api_logs';
import { auth } from '../../services/firebase/config';
import { LLMCallEvent } from '../../types/ai';
import { APICallEvent } from '../../services/firebase/api_logs';

interface IngestionJob {
    zpid: string;
    address: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: PipelineProgress | null;
    startTime?: number;
    endTime?: number;
    error?: string;
}

const CityDataTab: React.FC<{ onNavigate?: (view: string, address: string) => void }> = ({ onNavigate }) => {
    const [city, setCity] = useState('');
    // State removed as per new API requirements
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [stateFilter, setStateFilter] = useState<string>('');
    const [ingestionQueue, setIngestionQueue] = useState<IngestionJob[]>([]);
    const [cachedPropertyIds, setCachedPropertyIds] = useState<Set<string>>(new Set());
    const [isCheckingCache, setIsCheckingCache] = useState(false);
    const [ingestionReport, setIngestionReport] = useState<{
        llmLogs: LLMCallEvent[];
        apiLogs: APICallEvent[];
    } | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'ingestion'>('table');

    const availableStates = useMemo(() => {
        const states = new Set<string>();
        listings.forEach(item => {
            if (item.location?.address?.state_code) {
                states.add(item.location?.address?.state_code);
            }
        });
        return Array.from(states).sort();
    }, [listings]);

    // Auto-select first state when results arrive
    React.useEffect(() => {
        if (availableStates.length > 0 && (stateFilter === '' || stateFilter === 'ALL')) {
            setStateFilter(availableStates[0]);
        }
    }, [availableStates]);

    const groupedListings = useMemo(() => {
        const groups: Record<string, any[]> = {};

        // Determine search context
        const isZipSearch = /^\d/.test(city.trim());
        const searchCityTerm = city.split(',')[0].trim().toLowerCase();

        listings.forEach(item => {
            const itemCity = item.location?.address?.city || 'Unknown City';
            const state = item.location?.address?.state_code || 'Unknown State';

            // 1. State Filter (UI Toggle)
            if (stateFilter && stateFilter !== 'ALL' && state !== stateFilter) return;

            // 2. City Name Filter (User Intent)
            // If user searched by name, strictly show ONLY that city (exclude neighbors in same zip)
            if (!isZipSearch) {
                if (itemCity.toLowerCase() !== searchCityTerm) return;
            }

            const key = `${itemCity}, ${state}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [listings, stateFilter, city]);

    const log = (message: string) => {
        console.log(message);
        setStatusLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkIngest = async () => {
        if (selectedIds.size === 0) return;
        if (selectedIds.size > 10) {
            setError(`You can only ingest up to 10 properties at once. You selected ${selectedIds.size}.`);
            return;
        }

        setLoading(true);
        setError(null);
        setViewMode('ingestion');
        setIngestionReport(null); // Reset previous report
        const batchStartTime = Date.now();
        log(`Starting Parallel Bulk Ingest & Intelligence Pipeline for ${selectedIds.size} properties...`);

        const targets = listings.filter(l => selectedIds.has(l.property_id));

        // Initialize Queue
        const newJobs: IngestionJob[] = targets.map(item => ({
            zpid: item.property_id,
            address: item.location?.address?.line || item.property_id,
            status: 'pending',
            progress: null
        }));
        setIngestionQueue(newJobs);

        let successCount = 0;

        // Staggered parallel scanning: launches pipelines in parallel but staggers their start by 1s each
        // to avoid hitting API rate limit bursts while maintaining some concurrency.
        const ingestPromises = targets.map(async (item, index) => {
            const zpid = item.property_id;
            // Construct strict address for lookup quality
            const addrObj = item.location?.address;
            const builtAddress = addrObj
                ? `${addrObj.line}, ${addrObj.city}, ${addrObj.state_code} ${addrObj.postal_code}`
                : (item.location?.address?.line || zpid);

            // Wait for stagger delay
            if (index > 0) {
                await new Promise(r => setTimeout(r, index * 1000));
            }

            const startTime = Date.now();
            log(`Starting pipeline for property: ${builtAddress}`);
            // Mark running
            setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'running', startTime } : j));

            try {
                // Run Full Intelligence Pipeline
                // IMPORTANT: We pass 'undefined' for the zpid argument to FORCE the pipeline to look up 
                // the property by address. This ensures we get the canonical ZPID headers from the API 
                // rather than trusting the feed's property_id which may be mismatched.
                await runFullIntelligencePipeline(builtAddress, (progress) => {
                    setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, progress } : j));
                }, undefined, (msg) => log(`[${builtAddress}] ${msg}`));

                log(`Successfully completed intelligence suite for: ${builtAddress}`);
                setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'completed', endTime: Date.now() } : j));
                return true;
            } catch (e: any) {
                console.error(`Ingestion failed for ${zpid}:`, e);
                setIngestionQueue(prev => prev.map(j => j.zpid === zpid ? { ...j, status: 'error', error: e.message } : j));
                return false;
            }
        });

        // Wait for all to complete
        const results = await Promise.all(ingestPromises);
        successCount = results.filter(r => r === true).length;

        log(`Bulk Ingest Complete. Successfully processed ${successCount} / ${targets.length} properties.`);
        setLoading(false);

        if (successCount === targets.length) {
            setSelectedIds(new Set());
        }

        // Generate Report
        try {
            const maxEnd = Date.now();
            const userId = auth?.currentUser?.uid || 'unknown';

            const [llmLogs, apiLogs] = await Promise.all([
                getLLMLogsForTimeRange(userId, batchStartTime, maxEnd),
                getAPILogsForTimeRange(userId, batchStartTime, maxEnd)
            ]);

            setIngestionReport({ llmLogs, apiLogs });
            log(`Usage Report Generated: ${llmLogs.length} AI calls, ${apiLogs.length} API calls.`);
        } catch (reportErr) {
            console.error("Failed to generate ingestion report:", reportErr);
        }
    };

    const fetchListings = async (zip: string) => {
        const config = APP_CONFIG.rapidapi.realtyInUsApi;

        // 1. Check Cloud Cache first (Database)
        try {
            const cloudCached = await getZipListings(zip);
            if (cloudCached && cloudCached.timestamp) {
                const timestamp = cloudCached.timestamp.toDate?.()?.getTime() || cloudCached.timestamp;
                // 24 hour TTL for listings
                if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                    log(`Cloud Cache Hit for Zip: ${zip} (${cloudCached.listings?.length || 0} items)`);
                    return cloudCached.listings || [];
                }
            }
        } catch (e) {
            console.warn('Cloud cache check failed', e);
        }

        // 2. Network Request
        log(`Fetching live data for Zip: ${zip}...`);
        const url = `https://${config.host}${config.endpoints.list}`;
        const body = {
            ...config.defaults,
            postal_code: zip
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-RapidAPI-Key': config.key,
                    'X-RapidAPI-Host': config.host,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const txt = await response.text();
                log(`API Error for ${zip}: ${response.status} - ${txt}`);
                return [];
            }

            const result = await response.json();
            // Robust parsing for different API response structures
            const data = result.data?.home_search?.results || result.results || [];

            log(`Live API returned ${data.length} listings for ${zip}`);

            // 3. Save to Cloud Cache
            if (data.length > 0) {
                saveZipListings(zip, data).catch(console.error);
            }

            return data;
        } catch (e: any) {
            log(`Fetch failed for ${zip}: ${e.message}`);
            return [];
        }
    };

    const handleSearch = async () => {
        if (!city) {
            setError('Please provide a City or Postal Code.');
            return;
        }

        const config = APP_CONFIG.rapidapi.realtyInUsApi;
        const zipConfig = APP_CONFIG.rapidapi.zipCodesApi;
        if (!config.key) {
            setError('RapidAPI Key not configured in system.');
            return;
        }

        setLoading(true);
        setError(null);
        setStatusLog([]);
        setListings([]);

        log(`Starting ingestion for: ${city}`);

        try {
            const isPostalCodeInput = /^\d{5}(-\d{4})?$/.test(city.trim());
            let targetZips: string[] = [];

            if (isPostalCodeInput) {
                targetZips = [city.trim()];
                log(`Identified direct Zip Code: ${targetZips[0]}`);
            } else {
                const normalizedCity = city.trim();

                // Step 1: Check Cloud Cache for Zip Metadata (Grouped by State)
                const cachedGroups = await getZipsForCity(normalizedCity);

                if (cachedGroups) {
                    // Flatten all zips from all states found in cache
                    const allCachedZips = Object.values(cachedGroups).flat();
                    if (allCachedZips.length > 0) {
                        // Iterate entries to log states
                        const statesFound = Object.keys(cachedGroups).join(', ');
                        log(`Cloud Cache Hit for City: ${normalizedCity}. Found ${allCachedZips.length} zips across [${statesFound}].`);
                        targetZips = allCachedZips;
                    }
                }

                if (targetZips.length === 0) {
                    log(`Resolving Zip Codes for ${normalizedCity}...`);
                    // Step 2: Resolve Zip Codes for the City (Network) using US Zip Codes API
                    try {
                        const zipApiUrl = `https://${zipConfig.host}${zipConfig.path}?q=${encodeURIComponent(normalizedCity)}`;
                        const zipResp = await fetch(zipApiUrl, {
                            method: 'GET',
                            headers: {
                                'X-RapidAPI-Key': zipConfig.key,
                                'X-RapidAPI-Host': zipConfig.host
                            }
                        });

                        if (zipResp.status === 429) {
                            log('Rate Limit Hit (429) on Zip Resolution.');
                        } else {
                            const zipResult = await zipResp.json();

                            // Trying robust parse assuming it returns something like [{zip_code: "94566", state: "CA"}, ...]
                            let foundEntries: { zip: string, city: string, state: string }[] = [];

                            if (Array.isArray(zipResult)) {
                                foundEntries = zipResult.map((x: any) => ({
                                    zip: typeof x === 'string' ? x : x.zip_code || x.zipCode,
                                    city: x.city || normalizedCity, // Fallback to search term if missing
                                    state: x.state || x.state_code || 'Unknown'
                                }));
                            } else if (zipResult.zip_codes) {
                                // Some endpoints return { zip_codes: [...Strings] }
                                foundEntries = zipResult.zip_codes.map((z: any) => ({ zip: z, city: normalizedCity, state: 'Unknown' }));
                            }

                            // Filter valid zips
                            foundEntries = foundEntries.filter(z => z.zip && typeof z.zip === 'string');
                            targetZips = foundEntries.map(z => z.zip);

                            const uniqueStates = [...new Set(foundEntries.map(z => z.state).filter(s => s !== 'Unknown'))];
                            log(`Resolved ${targetZips.length} Zip Codes from API. States: ${uniqueStates.join(', ') || 'N/A'}`);

                            // Save to Cloud Cache (Batch)
                            if (foundEntries.length > 0) {
                                saveZipMetadataBatch(foundEntries).catch(console.error);
                            }
                        }
                    } catch (e) {
                        log(`Zip resolution failed: ${e}`);
                    }
                }
            }

            // Fallback: If Multi-Zip scan is impossible (rate limit or no zips), try direct City Search
            if (targetZips.length === 0) {
                log('Zip-based scan failed. Attempting direct City listing search...');

                const url = `https://${config.host}${config.endpoints.list}`;
                const body = {
                    ...config.defaults,
                    location: `${city.trim()}`
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'X-RapidAPI-Key': config.key,
                        'X-RapidAPI-Host': config.host,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const txt = await response.text();
                    throw new Error(`Fallback Search Failed: ${response.status} - ${txt}`);
                }

                const result = await response.json();
                const data = result.data?.home_search?.results || result.results || [];

                log(`Direct City Search returned ${data.length} listings.`);
                setListings(data);
                setLoading(false);
                return;
            }

            // Step 2: Fetch listings for each Zip (with cache)
            const allResults: any[] = [];
            const uniqueZips = [...new Set(targetZips)];

            // Safety limit
            const zipsToScan = uniqueZips.slice(0, 10);
            log(`Scanning ${zipsToScan.length} unique Zip Codes...`);

            for (const zip of zipsToScan) {
                const zipListings = await fetchListings(zip);
                allResults.push(...zipListings);
                // Tiny delay to be nice to the API
                await new Promise(r => setTimeout(r, 200));
            }

            // Step 3: De-duplicate and Set
            const seenIds = new Set();
            const deDuplicated = allResults.filter(item => {
                const id = item.property_id || item.listing_id || (item.location?.address?.line + item.list_price);
                if (seenIds.has(id)) return false;
                seenIds.add(id);
                return true;
            });

            log(`Ingestion Complete. ${deDuplicated.length} unique properties found.`);
            setListings(deDuplicated);

            // Check which properties are already in our database
            if (deDuplicated.length > 0) {
                setIsCheckingCache(true);
                log('Checking against existing database...');
                try {
                    const zpids = deDuplicated.map(l => l.property_id);
                    const existing = await checkExistingPropertiesBatch(zpids);
                    setCachedPropertyIds(existing);
                    log(`${existing.size} properties already exist in database.`);
                } finally {
                    setIsCheckingCache(false);
                }
            }

            if (deDuplicated.length === 0) {
                setError('No listings found in the resolved areas.');
            }

        } catch (err: any) {
            console.error(err);
            log(`Critical Error: ${err.message}`);
            setError(err.message || 'Workflow failed. See log.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Table Row Component
    const ListingRow = ({ item }: { item: any, key?: any }) => {
        const isSelected = selectedIds.has(item.property_id);
        const isCached = cachedPropertyIds.has(item.property_id);

        return (
            <tr
                className={`hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0 
                    ${isSelected ? 'bg-indigo-50/30 hover:bg-indigo-50/50' : ''} 
                    ${isCached ? 'bg-slate-50 opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => !isCached && toggleSelection(item.property_id)}
            >
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    {isCheckingCache ? (
                        <div className="w-5 h-5 flex items-center justify-center">
                            <i className="fa-solid fa-circle-notch animate-spin text-[10px] text-slate-300"></i>
                        </div>
                    ) : (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isCached}
                            onChange={() => !isCached && toggleSelection(item.property_id)}
                            className={`w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 
                                ${isCached ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'cursor-pointer'}`}
                        />
                    )}
                </td>
                <td className="p-4 cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-12 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                            {item.primary_photo?.href ? (
                                <img src={item.primary_photo.href} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <i className="fa-solid fa-image"></i>
                                </div>
                            )}
                        </div>
                        <div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const fullAddress = `${item.location?.address?.line}, ${item.location?.address?.city}, ${item.location?.address?.state_code} ${item.location?.address?.postal_code}`;
                                    if (onNavigate) onNavigate('explore', fullAddress);
                                }}
                                className="font-bold text-slate-900 text-sm hover:text-indigo-600 hover:underline text-left transition-colors"
                            >
                                {item.location?.address?.line || 'Unknown Address'}
                            </button>
                            <div className="text-xs text-slate-500">{item.location?.address?.city}, {item.location?.address?.state_code} {item.location?.address?.postal_code}</div>
                        </div>
                    </div>
                </td>
                <td className="p-4 text-right font-medium text-slate-900">
                    ${item.list_price?.toLocaleString() || '--'}
                </td>
                <td className="p-4 text-right">
                    <button
                        onClick={() => copyToClipboard(item.location?.address?.line)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Copy Address"
                    >
                        <i className="fa-solid fa-copy"></i>
                    </button>
                </td>
            </tr>
        );
    };

    return (
        <div className="max-w-7xl mx-auto py-10 px-6 animate-in fade-in duration-700">
            {viewMode === 'table' ? (
                <>
                    <div className="mb-8 items-center justify-between flex">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">City Data Engine</h1>
                            <p className="text-slate-500 text-sm font-medium">Scan cities for new properties and trigger the intelligence pipeline.</p>
                        </div>
                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleBulkIngest}
                                disabled={loading}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-right-4"
                            >
                                {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                                Ingest Selected ({selectedIds.size})
                            </button>
                        )}
                    </div>

                    {/* API Config & Search */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 mb-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                            <div className="lg:col-span-7 relative">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Location or Zip</label>
                                <input
                                    type="text"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    placeholder="Type a city (e.g. New York)..."
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium text-sm shadow-inner"
                                />
                            </div>

                            <div className="lg:col-span-5">
                                <button
                                    onClick={handleSearch}
                                    disabled={loading}
                                    className="w-full px-8 py-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-search"></i>}
                                    {loading ? 'Processing...' : 'Fetch Zip Codes & For-Sale Properties'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-in slide-in-from-top-2">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                                {error}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setViewMode('table')}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                            >
                                <i className="fa-solid fa-arrow-left"></i>
                            </button>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Ingest Dashboard</h1>
                                <p className="text-slate-500 text-sm font-medium">Monitoring {ingestionQueue.length} intelligence pipelines</p>
                            </div>
                        </div>

                        {!loading && (
                            <button
                                onClick={() => {
                                    // Update local cache state with successfully ingested properties so they appear grayed out
                                    setCachedPropertyIds(prev => {
                                        const next = new Set(prev);
                                        ingestionQueue.forEach(job => {
                                            if (job.status === 'completed') {
                                                next.add(job.zpid);
                                            }
                                        });
                                        return next;
                                    });
                                    setViewMode('table');
                                }}
                                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-[1.2rem] text-sm font-black shadow-lg shadow-slate-200 transition-all animate-in zoom-in"
                            >
                                Done & Return to Listings
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Grouped Results */}
            {viewMode === 'table' && (
                listings.length > 0 ? (
                    <div className="space-y-12">
                        {/* Filter Controls */}
                        {availableStates.length > 1 && (
                            <div className="flex items-center gap-2 mb-8 bg-white/50 p-2 rounded-xl w-fit">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3">Filter State:</span>
                                {availableStates.map(st => (
                                    <button
                                        key={st}
                                        onClick={() => setStateFilter(st)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${stateFilter === st ? 'bg-slate-900 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-800'}`}
                                    >
                                        {st}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setStateFilter('ALL')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${stateFilter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-800'}`}
                                >
                                    All
                                </button>
                            </div>
                        )}

                        {(Object.entries(groupedListings) as [string, any[]][]).map(([groupKey, groupItems]) => (
                            <div key={groupKey} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                            <i className="fa-solid fa-map-location-dot"></i>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900">{groupKey}</h2>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                                <span>{groupItems.length} Properties</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span className="text-emerald-600">Active</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard((groupItems as any[]).map(l => l.location?.address?.line).join('\n'))}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-copy"></i> Copy Addresses
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            <tr>
                                                <th className="p-4 w-12 text-center">
                                                    ID
                                                </th>
                                                <th className="p-4">Property</th>
                                                <th className="p-4 text-right">Price</th>
                                                <th className="p-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(groupItems as any[]).map((item, idx) => (
                                                <ListingRow key={idx} item={item} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    !loading && !error && (
                        <div className="text-center py-24 opacity-40">
                            <i className="fa-solid fa-table-cells text-6xl mb-4 text-slate-300"></i>
                            <p className="font-medium text-slate-400">Data table is empty. Start a search above.</p>
                        </div>
                    )
                )
            )}

            <div className={`${viewMode === 'ingestion' ? 'block' : 'hidden'}`}>
                {/* Active Ingestion Jobs (Rich UI) */}
                {ingestionQueue.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Active Ingestion Jobs</h3>
                            <span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase">
                                {ingestionQueue.filter(q => q.status === 'completed').length} / {ingestionQueue.length} Done
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {ingestionQueue.map((item) => (
                                <div key={item.zpid} className={`bg-white p-6 rounded-[2rem] border transition-all ${item.status === 'completed' ? 'border-emerald-100 shadow-emerald-50' : item.status === 'error' ? 'border-rose-100 shadow-rose-50' : 'border-slate-100 shadow-lg shadow-slate-200/50'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                item.status === 'error' ? 'bg-rose-50 text-rose-600' :
                                                    item.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                        'bg-slate-50 text-slate-400'
                                                }`}>
                                                <i className={`fa-solid ${item.status === 'completed' ? 'fa-circle-check' :
                                                    item.status === 'error' ? 'fa-circle-xmark' :
                                                        item.status === 'running' ? 'fa-spinner animate-spin' :
                                                            'fa-hourglass-start'
                                                    }`}></i>
                                            </div>
                                            <span className="text-sm font-black text-slate-900 truncate">{item.address}</span>
                                        </div>
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                            item.status === 'error' ? 'bg-rose-50 text-rose-600' :
                                                item.status === 'running' ? 'bg-indigo-50 text-indigo-600' :
                                                    'bg-slate-100 text-slate-400'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </div>

                                    {item.status === 'running' && item.progress && (
                                        <div className="space-y-3 animate-in fade-in">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                                                <div className="flex items-center gap-2">
                                                    <span>{item.progress.step}</span>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <span className="font-mono text-indigo-500">
                                                        {item.startTime ? Math.floor((Date.now() - item.startTime) / 1000) : 0}s
                                                    </span>
                                                </div>
                                                <span className="text-indigo-600">Active</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                                                    style={{ width: `${(100 / 9) * (['Geocoding', 'Status Check', 'Property Data', 'Gallery', 'Visual AI', 'Spatial AI', 'Market AI', 'Quality Audit', 'Narrative AI'].indexOf(item.progress.step) + 1)}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-[11px] text-slate-500 font-medium italic">
                                                {item.progress.message}
                                            </p>
                                        </div>
                                    )}

                                    {item.status === 'error' && (
                                        <p className="text-[11px] text-rose-600 font-medium bg-rose-50 p-3 rounded-xl border border-rose-100">
                                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                                            {item.error}
                                        </p>
                                    )}

                                    {item.status === 'completed' && (
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-emerald-600 text-[11px] font-black uppercase tracking-widest bg-emerald-50 py-2 px-4 rounded-xl w-fit">
                                                <i className="fa-solid fa-check"></i>
                                                Intelligence Suite Ready
                                            </div>
                                            {item.startTime && item.endTime && (
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    Total: <span className="text-slate-900 font-mono">{Math.floor((item.endTime - item.startTime) / 1000)}s</span>
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Ingestion Summary Report */}
                {ingestionReport && (
                    <div className="mt-16 bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-10 animate-in fade-in zoom-in duration-500">
                        <div className="flex items-center gap-6 mb-10 pb-8 border-b border-slate-100">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                                <i className="fa-solid fa-chart-line text-2xl"></i>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Ingestion Usage Report</h2>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Audit of intelligence pipeline execution</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Gemini Summary */}
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 group hover:border-indigo-200 transition-all">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                                        <i className="fa-solid fa-brain"></i>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Gemini AI</span>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-bold text-slate-600">Total Calls</span>
                                        <span className="text-2xl font-black text-slate-900">{ingestionReport.llmLogs.length}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-bold text-slate-600">Total Tokens</span>
                                        <span className="text-2xl font-black text-indigo-600">
                                            {(ingestionReport.llmLogs.reduce((acc, log) => acc + (log.usage_metadata?.totalTokenCount || 0), 0)).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* API Summary */}
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 group hover:border-emerald-200 transition-all">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                                        <i className="fa-solid fa-cloud-arrow-down"></i>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">External APIs</span>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-bold text-slate-600">RapidAPI Calls</span>
                                        <span className="text-2xl font-black text-slate-900">
                                            {ingestionReport.apiLogs.filter(l => l.api_name === 'RapidAPI').length}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-bold text-slate-600">Radar Geocoding</span>
                                        <span className="text-2xl font-black text-slate-900">
                                            {ingestionReport.apiLogs.filter(l => l.api_name === 'Radar').length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Performance Summary */}
                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 group hover:border-amber-200 transition-all">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-amber-600 shadow-sm">
                                        <i className="fa-solid fa-bolt"></i>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">System Speed</span>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-bold text-slate-600">Avg API Latency</span>
                                        <span className="text-2xl font-black text-slate-900">
                                            {Math.round(ingestionReport.apiLogs.reduce((acc, log) => acc + (log.response_time_ms || 0), 0) / (ingestionReport.apiLogs.length || 1))}ms
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-bold text-slate-600">Avg AI Response</span>
                                        <span className="text-2xl font-black text-slate-900">
                                            {Math.round(ingestionReport.llmLogs.length > 0 ? (ingestionReport.llmLogs.reduce((acc, log) => {
                                                if (log.response_received_at && log.request_sent_at) {
                                                    const start = (log.request_sent_at as any).toMillis?.() || 0;
                                                    const end = (log.response_received_at as any).toMillis?.() || 0;
                                                    return acc + (end - start);
                                                }
                                                return acc;
                                            }, 0) / ingestionReport.llmLogs.length) / 1000 : 0)}s
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 overflow-x-auto rounded-3xl border border-slate-100">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <tr>
                                        <th className="p-5">Call Type</th>
                                        <th className="p-5">Endpoint / Agent</th>
                                        <th className="p-5 text-right">Tokens / Time</th>
                                        <th className="p-5 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {ingestionReport.llmLogs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(log => (
                                        <tr key={log.id} className="text-sm transition-colors hover:bg-slate-50/50">
                                            <td className="p-5">
                                                <div className="flex items-center gap-2">
                                                    <i className="fa-solid fa-robot text-indigo-500 w-4"></i>
                                                    <span className="font-bold text-slate-900">Gemini</span>
                                                </div>
                                            </td>
                                            <td className="p-5 font-medium text-slate-600">{log.prompt_filename || 'Unknown Agent'}</td>
                                            <td className="p-5 text-right font-mono text-indigo-600 font-bold">
                                                {log.usage_metadata?.totalTokenCount || 0} tkn
                                            </td>
                                            <td className="p-5 text-right">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${log.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {ingestionReport.apiLogs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(log => (
                                        <tr key={log.id} className="text-sm transition-colors hover:bg-slate-50/50">
                                            <td className="p-5">
                                                <div className="flex items-center gap-2">
                                                    <i className={`fa-solid ${log.api_name === 'Radar' ? 'fa-location-crosshairs text-emerald-500' : 'fa-server text-blue-500'} w-4`}></i>
                                                    <span className="font-bold text-slate-900">{log.api_name}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 font-medium text-slate-600">{log.endpoint}</td>
                                            <td className="p-5 text-right font-mono text-slate-500">
                                                {log.response_time_ms ? `${log.response_time_ms}ms` : '--'}
                                            </td>
                                            <td className="p-5 text-right">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${log.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Ingestion Console (Available in both, but emphasized in ingestion mode) */}
                {statusLog.length > 0 && (
                    <div className={`mt-12 p-6 bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-900/20 transition-all ${viewMode === 'ingestion' ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                System Event Log
                            </div>
                            <span className="text-[9px] font-mono opacity-50">{statusLog.length} events logged</span>
                        </div>
                        <div className={`${viewMode === 'ingestion' ? 'max-h-64' : 'max-h-24'} overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5`}>
                            {statusLog.map((log, i) => (
                                <div key={i} className="border-l-2 border-slate-800 pl-3 py-0.5 animate-in slide-in-from-left-2">{log}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CityDataTab;
