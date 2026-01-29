
import React, { useState } from 'react';
import { APP_CONFIG } from '../../config';

const CityDataTab: React.FC = () => {
    const [city, setCity] = useState('');
    const [stateCode, setStateCode] = useState('');
    const [listings, setListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!city || !stateCode) {
            setError('Please provide City and State Code.');
            return;
        }

        const apiKey = APP_CONFIG.rapidapi.key;
        if (!apiKey) {
            setError('RapidAPI Key not configured in system.');
            return;
        }

        setLoading(true);
        setError(null);
        setListings([]);

        // RapidAPI Realtor.com v3/list-for-sale
        const url = `https://realtor.p.rapidapi.com/properties/v3/list-for-sale?location=${encodeURIComponent(`${city}, ${stateCode}`)}&limit=42&offset=0&sort=newest`;
        const options = {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': 'realtor.p.rapidapi.com'
            }
        };

        try {
            const response = await fetch(url, options);
            const result = await response.json();

            if (result.data?.home_search?.results) {
                setListings(result.data.home_search.results);
            } else if (result.message) {
                setError(result.message);
            } else {
                setError('No listings found or API response error.');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to connect to RapidAPI.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="max-w-7xl mx-auto py-10 px-6 animate-in fade-in duration-700">
            <div className="mb-12">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">City Data Engine</h1>
                <p className="text-slate-500 text-lg font-medium leading-relaxed max-w-2xl">
                    Query the global MLS via RapidAPI. Extract property addresses for bulk pre-fetching and market analysis.
                </p>
            </div>

            {/* API Config & Search */}
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50 mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                    <i className="fa-solid fa-server text-9xl"></i>
                </div>

                <div className="flex items-center gap-3 mb-8">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-md border border-indigo-100">
                        Point 01: Realtor.com v3/list
                    </span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-md border border-emerald-100">
                        Primary Source
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">Target City</label>
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="e.g. Aspen"
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium text-sm shadow-inner"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">State</label>
                        <input
                            type="text"
                            value={stateCode}
                            onChange={(e) => setStateCode(e.target.value)}
                            placeholder="CO"
                            maxLength={2}
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium text-sm shadow-inner uppercase"
                        />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6">
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="w-full md:w-auto px-12 py-5 bg-slate-900 border-b-4 border-slate-700 active:border-b-0 active:translate-y-1 hover:bg-slate-800 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-4"
                    >
                        {loading ? <><i className="fa-solid fa-spinner animate-spin"></i> Initializing Stream...</> : <><i className="fa-solid fa-bolt"></i> Execute Query</>}
                    </button>

                    {error && (
                        <div className="flex items-center gap-3 text-rose-600 text-[10px] font-black uppercase tracking-widest bg-rose-50 px-6 py-4 rounded-2xl border border-rose-100 animate-in slide-in-from-left-2">
                            <i className="fa-solid fa-triangle-exclamation text-sm"></i>
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Total Results Counter */}
            {listings.length > 0 && (
                <div className="flex items-center justify-between mb-8 px-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm font-black text-slate-900 uppercase tracking-widest">
                            Found {listings.length} Active Listings
                        </span>
                    </div>
                    <button
                        onClick={() => copyToClipboard(listings.map(l => l.location?.address?.line).join('\n'))}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <i className="fa-solid fa-copy"></i>
                        Copy All Addresses
                    </button>
                </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {listings.map((item: any, idx) => (
                    <div key={idx} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden hover:-translate-y-2 transition-all duration-500 group">
                        <div className="h-60 bg-slate-100 relative overflow-hidden">
                            {item.primary_photo?.href ? (
                                <img src={item.primary_photo.href} alt="Property" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-200">
                                    <i className="fa-solid fa-house-chimney text-6xl"></i>
                                </div>
                            )}
                            <div className="absolute top-6 left-6 flex flex-col gap-2">
                                <span className="px-4 py-1.5 bg-white/95 backdrop-blur-md rounded-xl text-[10px] font-black text-slate-900 uppercase tracking-widest shadow-lg border border-white">
                                    {item.status?.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div className="absolute bottom-6 left-6">
                                <span className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-lg font-black shadow-2xl flex items-center gap-2">
                                    <span className="text-xs opacity-60 font-medium">$</span>
                                    {item.list_price?.toLocaleString() || 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className="p-8">
                            <h3 className="text-xl font-black text-slate-900 line-clamp-1 mb-2 group-hover:text-indigo-600 transition-colors">
                                {item.location?.address?.line || 'Unknown Address'}
                            </h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                <i className="fa-solid fa-location-dot text-indigo-400"></i>
                                {item.location?.address?.city}, {item.location?.address?.state_code} {item.location?.address?.postal_code}
                            </p>

                            <div className="flex items-center justify-between py-4 border-y border-slate-50 mb-8">
                                <div className="text-center">
                                    <span className="block text-lg font-black text-slate-900">{item.description?.beds || '--'}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Beds</span>
                                </div>
                                <div className="w-px h-6 bg-slate-100"></div>
                                <div className="text-center">
                                    <span className="block text-lg font-black text-slate-900">{item.description?.baths || '--'}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Baths</span>
                                </div>
                                <div className="w-px h-6 bg-slate-100"></div>
                                <div className="text-center">
                                    <span className="block text-lg font-black text-slate-900">{item.description?.sqft?.toLocaleString() || '--'}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sqft</span>
                                </div>
                            </div>

                            <button
                                onClick={() => copyToClipboard(item.location?.address?.line)}
                                className="w-full py-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 text-slate-400 hover:text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                <i className="fa-solid fa-clipboard-list"></i>
                                Copy Primary Address
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {listings.length === 0 && !loading && !error && (
                <div className="py-32 text-center bg-white border-4 border-dashed border-slate-100 rounded-[4rem]">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <i className="fa-solid fa-earth-americas text-4xl text-slate-200"></i>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Ready to Pipeline</h3>
                    <p className="text-slate-400 font-medium max-w-sm mx-auto">Provide a target city and state to begin discovering active listings.</p>
                </div>
            )}

            {/* API Information Footer */}
            <div className="mt-20 p-8 bg-slate-900 rounded-[3rem] text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full"></div>
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div>
                        <h4 className="text-lg font-black mb-4">API Metadata</h4>
                        <div className="space-y-4">
                            <div className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i className="fa-solid fa-code text-sm"></i>
                                </div>
                                <div>
                                    <span className="block text-xs font-black uppercase tracking-widest text-indigo-400">Endpoint</span>
                                    <code className="text-[10px] opacity-70">realtor.p.rapidapi.com/properties/v3/list-for-sale</code>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                    <span className="block text-xs font-black uppercase tracking-widest text-emerald-400">Protocol</span>
                                    <span className="text-xs font-bold font-mono">REST / HTTPS</span>
                                </div>
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                    <span className="block text-xs font-black uppercase tracking-widest text-amber-400">Payload</span>
                                    <span className="text-xs font-bold font-mono">JSON Engine</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-lg font-black mb-4">Integration Guide</h4>
                        <p className="text-white/60 text-sm font-medium leading-relaxed mb-6">
                            This tool allows you to mass-discover listings and then pipe them into our **Bulk Prefetch** engine. Copy the addresses and paste them into the ingestion queue to run deep AI analysis on entire neighborhoods.
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Zyphe Stream Infrastructure v4.2.0 active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CityDataTab;
