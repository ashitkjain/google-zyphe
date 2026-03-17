import React, { useState, useEffect } from 'react';

interface CityNeighborhoodsViewProps {
    propertyData?: any;
}

const CityNeighborhoodsView: React.FC<CityNeighborhoodsViewProps> = ({ propertyData }) => {
    const [minedCities, setMinedCities] = useState<{ key: string; city: string; state: string; count: number }[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [neighborhoodData, setNeighborhoodData] = useState<any>(null);
    const [nhFilter, setNhFilter] = useState<string>('all');
    const [nhSearch, setNhSearch] = useState('');
    const [expandedNh, setExpandedNh] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showGuide, setShowGuide] = useState(true);

    // Extract city/state from propertyData
    const propertyCity = propertyData?.city || propertyData?.address?.split(',')[1]?.trim();
    const propertyState = propertyData?.state || 'CA';

    // Load all mined cities on mount
    useEffect(() => {
        (async () => {
            try {
                const { getAllMinedCities } = await import('../../../../services/firebase/properties');
                const cities = await getAllMinedCities();
                setMinedCities(cities);

                // Auto-select city matching current property
                if (propertyCity) {
                    const { generateCityStateKey } = await import('../../../../services/firebase/config');
                    const hintKey = generateCityStateKey(propertyCity, propertyState);
                    const match = cities.find(c => c.key === hintKey);
                    if (match) {
                        setSelectedKey(match.key);
                    } else if (cities.length > 0) {
                        setSelectedKey(cities[0].key);
                    }
                } else if (cities.length > 0) {
                    setSelectedKey(cities[0].key);
                }
            } catch (e) { console.warn('Failed to load mined cities:', e); }
            setLoading(false);
        })();
    }, []);

    // Load neighborhood data when a city is selected
    useEffect(() => {
        if (!selectedKey) return;
        setNeighborhoodData(null);
        (async () => {
            try {
                const { getCityNeighborhoodsFromCloud } = await import('../../../../services/firebase/properties');
                const data = await getCityNeighborhoodsFromCloud(selectedKey);
                setNeighborhoodData(data);
            } catch (e) { console.warn('Failed to load neighborhoods:', e); }
        })();
    }, [selectedKey]);

    const selectedCity = minedCities.find(c => c.key === selectedKey);

    const tierColors: Record<string, string> = {
        'entry-level': 'bg-emerald-50 border-emerald-200 text-emerald-700',
        'mid-range': 'bg-blue-50 border-blue-200 text-blue-700',
        'upper mid-range': 'bg-indigo-50 border-indigo-200 text-indigo-700',
        'premium': 'bg-purple-50 border-purple-200 text-purple-700',
        'ultra-luxury': 'bg-amber-50 border-amber-200 text-amber-800',
    };
    const getTierColor = (tier: string) => tierColors[tier?.toLowerCase()] || 'bg-slate-50 border-slate-200 text-slate-600';

    const tiers = neighborhoodData?.neighborhoods
        ? [...new Set(neighborhoodData.neighborhoods.map((n: any) => n.price_context?.tier).filter(Boolean))]
        : [];

    const filtered = neighborhoodData?.neighborhoods?.filter((n: any) => {
        if (nhFilter !== 'all' && n.price_context?.tier !== nhFilter) return false;
        if (nhSearch) {
            const q = nhSearch.toLowerCase();
            return n.neighborhood_name?.toLowerCase().includes(q) ||
                n.alternative_names?.some((a: string) => a.toLowerCase().includes(q)) ||
                n.character?.description?.toLowerCase().includes(q);
        }
        return true;
    }) || [];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm font-bold text-slate-400">Loading city neighborhoods...</p>
                </div>
            </div>
        );
    }

    if (minedCities.length === 0) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                        <i className="fa-solid fa-mountain-city text-2xl text-slate-300"></i>
                    </div>
                    <h3 className="text-lg font-black text-slate-700 mb-2">No Cities Mined Yet</h3>
                    <p className="text-sm text-slate-400">Go to the <strong>City Data</strong> admin tab and click <strong>Mine Neighborhoods</strong> for a city to populate this view.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* City Selector Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <i className="fa-solid fa-mountain-city mr-1.5"></i>
                    Select City
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {minedCities.map(c => (
                        <button
                            key={c.key}
                            onClick={() => { setSelectedKey(c.key); setNhFilter('all'); setNhSearch(''); setExpandedNh(new Set()); }}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                selectedKey === c.key
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                    : 'bg-white border border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
                            }`}
                        >
                            {c.city}, {c.state} ({c.count})
                        </button>
                    ))}
                </div>
            </div>

            {!neighborhoodData ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    {/* Buyer's Guide */}
                    {neighborhoodData.city_summary && (
                        <div className="rounded-2xl border border-indigo-100 overflow-hidden">
                            <button
                                onClick={() => setShowGuide(!showGuide)}
                                className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 hover:from-indigo-50 hover:to-purple-50/60 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-compass text-indigo-500 text-sm"></i>
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Buyer&apos;s Guide — {selectedCity?.city || 'City'}</span>
                                </div>
                                <i className={`fa-solid fa-chevron-${showGuide ? 'up' : 'down'} text-indigo-300 text-xs`}></i>
                            </button>
                            {showGuide && (
                                <div className="px-5 py-4 bg-white/50">
                                    <p className="text-[11.5px] text-slate-600 leading-relaxed whitespace-pre-line">
                                        {neighborhoodData.city_summary}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Filter + Search */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center bg-white border border-slate-200 p-1 rounded-xl flex-wrap">
                            <button
                                onClick={() => setNhFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${nhFilter === 'all' ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                All ({neighborhoodData.neighborhoods?.length || 0})
                            </button>
                            {(tiers as string[]).map((tier: string) => {
                                const cnt = neighborhoodData.neighborhoods?.filter((n: any) => n.price_context?.tier === tier).length || 0;
                                return (
                                    <button
                                        key={tier}
                                        onClick={() => setNhFilter(nhFilter === tier ? 'all' : tier)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${nhFilter === tier ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {tier} ({cnt})
                                    </button>
                                );
                            })}
                        </div>
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                            <input
                                value={nhSearch}
                                onChange={e => setNhSearch(e.target.value)}
                                placeholder="Search neighborhoods..."
                                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                            />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 ml-auto">
                            Showing {filtered.length} of {neighborhoodData.neighborhoods?.length || 0}
                        </span>
                    </div>

                    {/* Neighborhood Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filtered.map((n: any, idx: number) => {
                            const isExpanded = expandedNh.has(n.neighborhood_name);
                            return (
                                <div
                                    key={idx}
                                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                                    onClick={() => setExpandedNh(prev => {
                                        const next = new Set(prev);
                                        isExpanded ? next.delete(n.neighborhood_name) : next.add(n.neighborhood_name);
                                        return next;
                                    })}
                                >
                                    {/* Card Header */}
                                    <div className="p-4 pb-3">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h4 className="text-sm font-black text-slate-900 leading-snug">{n.neighborhood_name}</h4>
                                            <span className={`shrink-0 px-2.5 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${getTierColor(n.price_context?.tier)}`}>
                                                {n.price_context?.tier || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mb-2.5">
                                            <span className="text-[11px] font-bold text-indigo-600">{n.price_context?.typical_range || '—'}</span>
                                            {n.character?.community_type && (
                                                <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{n.character.community_type}</span>
                                            )}
                                        </div>
                                        <p className={`text-[10px] text-slate-500 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                                            {n.character?.description || 'No description available.'}
                                        </p>
                                    </div>

                                    {/* Quick Stats Row */}
                                    <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                                        {n.character?.architectural_style && (
                                            <span className="text-[9px] text-slate-500">
                                                <i className="fa-solid fa-home text-[7px] text-slate-300 mr-1"></i>
                                                {n.character.architectural_style}
                                            </span>
                                        )}
                                        {n.character?.era_built && (
                                            <span className="text-[9px] text-slate-500">
                                                <i className="fa-solid fa-calendar text-[7px] text-slate-300 mr-1"></i>
                                                {n.character.era_built}
                                            </span>
                                        )}
                                        {n.character?.typical_home_size && (
                                            <span className="text-[9px] text-slate-500">
                                                <i className="fa-solid fa-ruler-combined text-[7px] text-slate-300 mr-1"></i>
                                                {n.character.typical_home_size}
                                            </span>
                                        )}
                                        {n.hoa?.has_hoa && (
                                            <span className="text-[9px] text-amber-600 font-semibold">
                                                <i className="fa-solid fa-shield text-[7px] mr-1"></i>
                                                HOA{n.hoa.monthly_fee ? ` ${n.hoa.monthly_fee}` : ''}
                                            </span>
                                        )}
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 py-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-200 bg-white">
                                            {n.alternative_names?.length > 0 && (
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Also Known As</span>
                                                    <p className="text-[10px] text-slate-600 mt-0.5">{n.alternative_names.join(', ')}</p>
                                                </div>
                                            )}
                                            {n.character?.typical_lot_size && (
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Typical Lot Size</span>
                                                    <p className="text-[10px] text-slate-600 mt-0.5">{n.character.typical_lot_size}</p>
                                                </div>
                                            )}
                                            {n.price_context?.context && (
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Market Position</span>
                                                    <p className="text-[10px] text-slate-600 mt-0.5">{n.price_context.context}</p>
                                                </div>
                                            )}
                                            {n.hoa?.has_hoa && (n.hoa.covers || n.hoa.notable_rules) && (
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">HOA Details</span>
                                                    {n.hoa.covers && <p className="text-[10px] text-slate-600 mt-0.5"><strong>Covers:</strong> {n.hoa.covers}</p>}
                                                    {n.hoa.notable_rules && <p className="text-[10px] text-slate-600 mt-0.5"><strong>Rules:</strong> {n.hoa.notable_rules}</p>}
                                                </div>
                                            )}
                                            {n.infrastructure_quality && (
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Infrastructure</span>
                                                    <p className="text-[10px] text-slate-600 mt-0.5">{n.infrastructure_quality}</p>
                                                </div>
                                            )}
                                            {n.upcoming_changes && n.upcoming_changes !== 'None known' && (
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Upcoming Changes</span>
                                                    <p className="text-[10px] text-amber-700 mt-0.5">{n.upcoming_changes}</p>
                                                </div>
                                            )}
                                            {n.unique_features?.length > 0 && (
                                                <div>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Standout Features</span>
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        {n.unique_features.map((f: string, fi: number) => (
                                                            <span key={fi} className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[9px] font-semibold">
                                                                {f}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="pt-1">
                                                <span className="text-[8px] text-slate-300 font-medium">Source: {n.source_type || 'Unknown'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div className="col-span-full text-center py-12">
                                <i className="fa-solid fa-search text-3xl text-slate-200 mb-3"></i>
                                <p className="text-sm font-bold text-slate-400">No neighborhoods match your search</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export { CityNeighborhoodsView };
