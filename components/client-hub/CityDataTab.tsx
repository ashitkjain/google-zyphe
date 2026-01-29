
import React, { useState } from 'react';
import { APP_CONFIG } from '../../config';
import {
    saveZipMetadataBatch,
    getZipsForCity,
    saveZipListings,
    getZipListings
} from '../../services/firebase/cityData';

const CityDataTab: React.FC = () => {
    const [city, setCity] = useState('');
    // State removed as per new API requirements
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusLog, setStatusLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const log = (message: string) => {
        console.log(message);
        setStatusLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const fetchListings = async (zip: string) => {
        const config = APP_CONFIG.rapidapi;

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

        const config = APP_CONFIG.rapidapi;
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
                        const zipApiUrl = `https://${config.zipCodesApi.host}${config.zipCodesApi.path}?q=${encodeURIComponent(normalizedCity)}`;
                        const zipResp = await fetch(zipApiUrl, {
                            method: 'GET',
                            headers: {
                                'X-RapidAPI-Key': config.key,
                                'X-RapidAPI-Host': config.zipCodesApi.host
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
    const ListingRow = ({ item }: { item: any }) => (
        <tr className="hover:bg-slate-50 transition-colors group border-b border-slate-100">
            <td className="p-4">
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
                        <div className="font-bold text-slate-900 text-sm">{item.location?.address?.line || 'Unknown Address'}</div>
                        <div className="text-xs text-slate-500">{item.location?.address?.city}, {item.location?.address?.state_code} {item.location?.address?.postal_code}</div>
                    </div>
                </div>
            </td>
            <td className="p-4 text-right font-medium text-slate-900">
                ${item.list_price?.toLocaleString() || '--'}
            </td>
            <td className="p-4 text-center text-slate-600 text-sm">
                {item.description?.beds} <span className="text-xs text-slate-400">bd</span>
            </td>
            <td className="p-4 text-center text-slate-600 text-sm">
                {item.description?.baths} <span className="text-xs text-slate-400">ba</span>
            </td>
            <td className="p-4 text-center text-slate-600 text-sm">
                {item.description?.sqft?.toLocaleString()} <span className="text-xs text-slate-400">sqft</span>
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

    return (
        <div className="max-w-7xl mx-auto py-10 px-6 animate-in fade-in duration-700">
            <div className="mb-8 items-center justify-between flex">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">City Data Engine</h1>
                    <p className="text-slate-500 font-medium">Global MLS Ingestion & Caching</p>
                </div>
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
                            {loading ? 'Ingesting Data...' : 'Start Ingestion'}
                        </button>
                    </div>
                </div>

                {/* Status Log */}
                {statusLog.length > 0 && (
                    <div className="mt-6 p-4 bg-slate-900 rounded-xl overflow-hidden">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Ingestion Log
                        </div>
                        <div className="max-h-32 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1">
                            {statusLog.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </div>
                    </div>
                )}
                {error && (
                    <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-in slide-in-from-top-2">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        {error}
                    </div>
                )}
            </div>

            {/* Results Table */}
            {listings.length > 0 ? (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <span className="text-lg font-black text-slate-900">{listings.length} Properties</span>
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-widest rounded">Active</span>
                        </div>
                        <button
                            onClick={() => copyToClipboard(listings.map(l => l.location?.address?.line).join('\n'))}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-copy"></i> Copy All Addresses
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="p-4">Property</th>
                                    <th className="p-4 text-right">Price</th>
                                    <th className="p-4 text-center">Beds</th>
                                    <th className="p-4 text-center">Baths</th>
                                    <th className="p-4 text-center">Sqft</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {listings.map((item, idx) => (
                                    <ListingRow key={idx} item={item} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                !loading && !error && (
                    <div className="text-center py-24 opacity-40">
                        <i className="fa-solid fa-table-cells text-6xl mb-4 text-slate-300"></i>
                        <p className="font-medium text-slate-400">Data table is empty. Start a search above.</p>
                    </div>
                )
            )}
        </div>
    );
};

export default CityDataTab;
