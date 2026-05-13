import React, { useState, useEffect } from 'react';
import { calculateAffordabilityScore } from '../../../../services/affordabilityService';

interface CityNeighborhoodsViewProps {
    propertyData?: any;
}

const TIER_ICONS: Record<string, string> = {
    'entry-level': 'fa-seedling',
    'mid-range': 'fa-house',
    'upper mid-range': 'fa-house-chimney',
    'premium': 'fa-gem',
    'ultra-luxury': 'fa-crown',
};

const CityNeighborhoodsView: React.FC<CityNeighborhoodsViewProps> = ({ propertyData }) => {
    const [minedCities, setMinedCities] = useState<{ key: string; city: string; state: string; count: number }[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [neighborhoodData, setNeighborhoodData] = useState<any>(null);
    const [nhFilter, setNhFilter] = useState<string>('all');
    const [nhSearch, setNhSearch] = useState('');
    const [expandedNh, setExpandedNh] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showGuide, setShowGuide] = useState(true);

    const propertyCity = propertyData?.city || (propertyData?.address?.includes(',') ? propertyData.address.split(',')[1]?.trim() : null);
    const propertyState = propertyData?.state || 'CA';

    useEffect(() => {
        (async () => {
            try {
                // Pre-calculate hint key from propertyData for immediate loading attempt
                let initialKey: string | null = null;
                if (propertyCity) {
                    const { generateCityStateKey } = await import('../../../../services/firebase/config');
                    initialKey = generateCityStateKey(propertyCity, propertyState);
                    setSelectedKey(initialKey); // Tentatively set this so we start loading data immediately
                }

                const { getAllMinedCities } = await import('../../../../services/firebase/properties');
                const cities = await getAllMinedCities();
                setMinedCities(cities);
                
                // Refined matching logic once cities list is available
                if (initialKey) {
                    const match = cities.find(c => c.key === initialKey);
                    if (match) setSelectedKey(match.key);
                    else if (!selectedKey && cities.length > 0) {
                        setSelectedKey(cities[0].key);
                    }
                } else if (cities.length > 0) {
                    setSelectedKey(cities[0].key);
                }
            } catch (e) { 
                console.warn('Failed to load mined cities:', e); 
            } finally {
                setLoading(false);
            }
        })();
    }, []);

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
        'entry-level': 'bg-emerald-100 text-emerald-700',
        'mid-range': 'bg-blue-100 text-blue-700',
        'upper mid-range': 'bg-indigo-100 text-indigo-700',
        'premium': 'bg-purple-100 text-purple-700',
        'ultra-luxury': 'bg-amber-100 text-amber-700',
    };
    const getTierColor = (tier: string) => tierColors[tier?.toLowerCase()] || 'bg-gray-100 text-gray-700';

    const tiers = neighborhoodData?.neighborhoods
        ? [...new Set(neighborhoodData.neighborhoods.map((n: any) => n.price_context?.tier).filter(Boolean))]
        : [];

    const filtered = neighborhoodData?.neighborhoods?.filter((n: any) => {
        if (nhFilter !== 'all' && n.price_context?.tier !== nhFilter) return false;
        if (nhSearch) {
            const q = nhSearch.toLowerCase();
            const name = typeof n.neighborhood_name === 'string' ? n.neighborhood_name : (n.neighborhood_name?.social || n.neighborhood_name?.legal_subdivision || '');
            return name.toLowerCase().includes(q) ||
                n.alternative_names?.some((a: string) => typeof a === 'string' && a.toLowerCase().includes(q)) ||
                n.character?.description?.toLowerCase().includes(q);
        }
        return true;
    }) || [];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[13px] font-bold text-gray-400">Loading city neighborhoods...</p>
                </div>
            </div>
        );
    }

    if (minedCities.length === 0) {
        return (
            <section>
                <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12">
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
                            <i className="fa-solid fa-mountain-city text-2xl text-gray-300"></i>
                        </div>
                        <h3 className="font-black text-gray-900 text-xl mb-3 tracking-tight">No Cities Mined Yet</h3>
                        <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625] max-w-md">
                            Go to the <strong className="text-indigo-600">City Data</strong> admin tab and click <strong className="text-indigo-600">Mine Neighborhoods</strong> for a city to populate this view.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <div className="space-y-8">
            {/* ── Main Container ─────────────────────────────── */}
            <div className="space-y-12">


                {!neighborhoodData ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* ── Buyer's Guide ─────────────────────────── */}
                        {neighborhoodData.city_summary && (
                            <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-[2.5rem] border border-indigo-100/60 p-6 md:p-8">
                                <button
                                    onClick={() => setShowGuide(!showGuide)}
                                    className="w-full flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                            <i className="fa-solid fa-compass text-lg" />
                                        </div>
                                        <div className="text-left">
                                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">BUYER&apos;S GUIDE</div>
                                            <div className="font-black text-gray-900 text-lg tracking-tight">{selectedCity?.city || 'City'} Residential Landscape</div>
                                        </div>
                                    </div>
                                    <i className={`fa-solid fa-chevron-${showGuide ? 'up' : 'down'} text-indigo-300`} />
                                </button>
                                {showGuide && (
                                    <p className="text-gray-700 font-sans font-normal text-[14px] leading-[1.625] mt-6 whitespace-pre-line">
                                        {neighborhoodData.city_summary}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── Filter + Search ───────────────────────── */}
                        <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-gray-100">
                            <div className="flex items-center gap-1 flex-wrap">
                                <button
                                    onClick={() => setNhFilter('all')}
                                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${nhFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                >
                                    All ({neighborhoodData.neighborhoods?.length || 0})
                                </button>
                                {(tiers as string[]).map((tier: string) => {
                                    const cnt = neighborhoodData.neighborhoods?.filter((n: any) => n.price_context?.tier === tier).length || 0;
                                    return (
                                        <button
                                            key={tier}
                                            onClick={() => setNhFilter(nhFilter === tier ? 'all' : tier)}
                                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${nhFilter === tier ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                        >
                                            {tier} ({cnt})
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="relative flex-1 min-w-[200px] max-w-sm">
                                <i className="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 text-xs" />
                                <input
                                    value={nhSearch}
                                    onChange={e => setNhSearch(e.target.value)}
                                    placeholder="Search neighborhoods..."
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13px] font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                                />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-auto">
                                {filtered.length} of {neighborhoodData.neighborhoods?.length || 0}
                            </span>
                        </div>

                        {/* ── Neighborhood Cards Grid ────────────────── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filtered.map((n: any, idx: number) => {
                                const isExpanded = expandedNh.has(n.neighborhood_name);
                                const tierKey = (n.price_context?.tier || '').toLowerCase();
                                const icon = TIER_ICONS[tierKey] || 'fa-location-dot';

                                // Calculate affordability if census data exists
                                const affordability = n.census_demographics ? calculateAffordabilityScore({
                                    tractId: '', 
                                    tractLabel: n.neighborhood_name,
                                    medianHouseholdIncome: n.census_demographics.median_household_income,
                                    medianGrossRent: n.census_demographics.median_gross_rent,
                                    rentBurdenPct: n.census_demographics.rent_burden_pct,
                                    medianHomeValue: n.census_demographics.median_home_value,
                                    ownerPct: n.census_demographics.owner_pct,
                                    renterPct: n.census_demographics.renter_pct,
                                    totalPopulation: 0
                                } as any) : null;

                                return (
                                    <div
                                        key={idx}
                                        className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col cursor-pointer"
                                        onClick={() => setExpandedNh(prev => {
                                            const next = new Set(prev);
                                            isExpanded ? next.delete(n.neighborhood_name) : next.add(n.neighborhood_name);
                                            return next;
                                        })}
                                    >
                                        {/* Icon + Name + Tier badge */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors shrink-0">
                                                <i className={`fa-solid ${icon} text-lg`}></i>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-gray-900 text-lg tracking-tight truncate">
                                                    {typeof n.neighborhood_name === 'string' 
                                                        ? n.neighborhood_name 
                                                        : (n.neighborhood_name?.social || n.neighborhood_name?.legal_subdivision || 'Unnamed Neighborhood')}
                                                </h4>
                                            </div>
                                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-full shrink-0 ${getTierColor(n.price_context?.tier)}`}>
                                                {n.price_context?.tier || 'N/A'}
                                            </span>
                                        </div>

                                        {/* Price + Community Type badges */}
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {n.price_context?.typical_range && (
                                                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700">
                                                    <i className="fa-solid fa-dollar-sign mr-1" />{n.price_context.typical_range}
                                                </span>
                                            )}
                                            {n.character?.community_type && (
                                                <span className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
                                                    <i className="fa-solid fa-shield-halved mr-1" />{n.character.community_type}
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">
                                            {n.character?.description || 'No description available.'}
                                        </p>

                                        {/* Quick stats in footer zone */}
                                        <div className="pt-4 border-t border-gray-100 mt-auto -mx-6 -mb-6 px-6 py-4 rounded-b-2xl bg-gray-50 flex flex-wrap gap-x-4 gap-y-1.5">
                                            {n.character?.architectural_style && (
                                                <span className="text-[11px] font-semibold text-gray-500">
                                                    <i className="fa-solid fa-building-columns text-gray-300 mr-1 text-[9px]" />
                                                    {n.character.architectural_style}
                                                </span>
                                            )}
                                            {n.character?.era_built && (
                                                <span className="text-[11px] font-semibold text-gray-500">
                                                    <i className="fa-solid fa-calendar text-gray-300 mr-1 text-[9px]" />
                                                    {n.character.era_built}
                                                </span>
                                            )}
                                            {n.character?.typical_home_size && (
                                                <span className="text-[11px] font-semibold text-gray-500">
                                                    <i className="fa-solid fa-ruler-combined text-gray-300 mr-1 text-[9px]" />
                                                    {n.character.typical_home_size}
                                                </span>
                                            )}
                                            {n.hoa?.has_hoa && (
                                                <span className="text-[11px] font-bold text-amber-600">
                                                    <i className="fa-solid fa-building-shield text-[9px] mr-1" />
                                                    HOA{n.hoa.monthly_fee ? ` · ${n.hoa.monthly_fee}` : ''}
                                                </span>
                                            )}
                                        </div>

                                        {/* Expanded details */}
                                        {isExpanded && (
                                            <div className="pt-5 -mx-6 -mb-6 px-6 pb-6 border-t border-gray-100 space-y-4 bg-white rounded-b-2xl mt-4">
                                                {n.alternative_names?.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">ALSO KNOWN AS</div>
                                                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{n.alternative_names.join(', ')}</p>
                                                    </div>
                                                )}
                                                {n.character?.typical_lot_size && (
                                                    <div>
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">TYPICAL LOT SIZE</div>
                                                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{n.character.typical_lot_size}</p>
                                                    </div>
                                                )}
                                                {n.price_context?.context && (
                                                    <div>
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">MARKET POSITION</div>
                                                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{n.price_context.context}</p>
                                                    </div>
                                                )}
                                                {n.hoa?.has_hoa && (n.hoa.covers || n.hoa.notable_rules) && (
                                                    <div>
                                                        <div className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">
                                                            <i className="fa-solid fa-building-shield mr-1" />HOA DETAILS
                                                        </div>
                                                        {n.hoa.covers && <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed"><strong className="text-gray-900">Covers:</strong> {n.hoa.covers}</p>}
                                                        {n.hoa.notable_rules && <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed mt-1"><strong className="text-gray-900">Rules:</strong> {n.hoa.notable_rules}</p>}
                                                    </div>
                                                )}
                                                {n.infrastructure_quality && (
                                                    <div>
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">INFRASTRUCTURE</div>
                                                        <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{n.infrastructure_quality}</p>
                                                    </div>
                                                )}
                                                 {n.upcoming_changes && (() => {
                                                     const val = typeof n.upcoming_changes === 'object'
                                                         ? Object.entries(n.upcoming_changes)
                                                             .filter(([_, v]) => v && typeof v === 'string' && v !== 'None known')
                                                             .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: ${v}`)
                                                             .join(' | ')
                                                         : n.upcoming_changes;
                                                     if (!val || val === 'None known') return null;
                                                     return (
                                                         <div>
                                                             <div className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">
                                                                 <i className="fa-solid fa-triangle-exclamation mr-1" />UPCOMING CHANGES
                                                             </div>
                                                             <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{val}</p>
                                                         </div>
                                                     );
                                                 })()}
                                                {n.unique_features?.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">STANDOUT FEATURES</div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {n.unique_features.map((f: string, fi: number) => (
                                                                <span key={fi} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-indigo-100 text-indigo-700 shadow-sm">
                                                                    {f}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}


                                                {/* Nextdoor Community Intelligence */}
                                                {n.nextdoor?.found && (
                                                    <div className="pt-4 border-t border-gray-100 space-y-4">
                                                        <div className="flex flex-col gap-1 w-full">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                                                    <i className="fa-solid fa-people-group" />
                                                                    Community Intelligence
                                                                </div>
                                                                {n.nextdoor.overall_city_rank && (
                                                                    <span className="text-[9px] font-bold text-gray-400 italic">
                                                                        #{n.nextdoor.overall_city_rank} in {selectedCity?.city || 'City'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[8px] text-gray-400 font-medium italic opacity-60">
                                                                {affordability ? '*Housing metrics from Census Bureau (ACS); social data from platforms' : '*Aggregated from social platforms'}
                                                            </div>
                                                        </div>

                                                        {/* Metrics Grid */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/50">
                                                                <div className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1.5">Affordability</div>
                                                                <div className="flex items-end gap-1.5">
                                                                    <span className="text-2xl font-black text-amber-800 leading-none">
                                                                        {affordability?.score || n.nextdoor.affordability_score || '—'}
                                                                    </span>
                                                                    <span className="text-[11px] font-bold text-amber-600/60 pb-1">/ 10</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50">
                                                                 <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1.5">Social Activity Score</div>
                                                                <div className="flex items-end gap-1.5">
                                                                    <span className="text-2xl font-black text-emerald-800 leading-none">{n.nextdoor.friendliness_score || '—'}</span>
                                                                    <span className="text-[11px] font-bold text-emerald-600/60 pb-1">/ 10</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/50">
                                                                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Ownership</div>
                                                                <div className="text-2xl font-black text-gray-800 leading-none">
                                                                    {affordability?.signals?.ownerPct != null ? `${affordability?.signals?.ownerPct}%*` : (n.nextdoor.home_ownership_pct || '—')}
                                                                </div>
                                                            </div>
                                                            {(n.census_demographics?.rent_burden_pct || n.nextdoor.local_events_count) && (
                                                                <div className={`${n.census_demographics?.rent_burden_pct ? 'bg-blue-50/50 border-blue-100/50' : 'bg-indigo-50/50 border-indigo-100/50'} rounded-2xl p-4 border`}>
                                                                    <div className={`text-[9px] font-black ${n.census_demographics?.rent_burden_pct ? 'text-blue-500' : 'text-indigo-500'} uppercase tracking-widest mb-1.5`}>
                                                                        {n.census_demographics?.rent_burden_pct ? 'Cost Burden' : 'Local Events'}
                                                                    </div>
                                                                    <div className={`text-${n.census_demographics?.rent_burden_pct ? '2xl' : 'lg'} font-black ${n.census_demographics?.rent_burden_pct ? 'text-blue-800' : 'text-indigo-800'} leading-none`}>
                                                                        {n.census_demographics?.rent_burden_pct ? `${n.census_demographics.rent_burden_pct}%` : `${n.nextdoor.local_events_count} active`}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Topics */}
                                                        {n.nextdoor.key_topics?.length > 0 && (
                                                            <div>
                                                                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Active Local Themes</div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {n.nextdoor.key_topics.map((t: any, ti: number) => (
                                                                        <span key={ti} className="text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm" title={t.description}>
                                                                            {t.topic}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Community Events */}
                                                        {n.nextdoor.upcoming_events?.length > 0 && (
                                                            <div className="space-y-3">
                                                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Upcoming Community Events</div>
                                                                <div className="grid grid-cols-1 gap-2">
                                                                    {n.nextdoor.upcoming_events.slice(0, 3).map((e: any, ei: number) => (
                                                                        <div key={ei} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 group/event">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[13px] font-bold text-gray-900 leading-snug">{e.name}</span>
                                                                                {e.description && <p className="text-[11px] text-gray-500 mt-0.5 italic">{e.description}</p>}
                                                                            </div>
                                                                            {e.date && (
                                                                                <div className="shrink-0 bg-white px-2.5 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                                                                                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">{e.date}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Source + Social Platforms */}
                                                <div className="pt-3 border-t border-gray-100 space-y-2">
                                                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
                                                        Source: {n.source_type || 'Real Estate / MLS'}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {/* Nextdoor */}
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                                                                n.nextdoor?.found
                                                                    ? 'bg-[#00b246]/10 border-[#00b246]/30 text-[#008c38]'
                                                                    : 'bg-gray-50 border-gray-200 text-gray-400'
                                                            }`}
                                                            title={n.nextdoor?.found ? 'Community data sourced from Nextdoor' : 'Nextdoor data not available'}
                                                        >
                                                            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm0 14.5a8.5 8.5 0 01-6.277-2.77C6.96 15.122 9.35 14 12 14s5.04 1.122 6.277 2.73A8.5 8.5 0 0112 19.5z"/>
                                                            </svg>
                                                            Nextdoor
                                                            {n.nextdoor?.found && (
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#00b246] inline-block ml-0.5" />
                                                            )}
                                                        </span>

                                                        {/* Reddit */}
                                                        <span
                                                            className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-orange-50/70 border-orange-200/50 text-orange-500"
                                                            title="Local subreddit community signals"
                                                        >
                                                            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                                                            </svg>
                                                            Reddit
                                                        </span>

                                                        {/* Facebook Community */}
                                                        <span
                                                            className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-blue-50/70 border-blue-200/50 text-blue-500"
                                                            title="Local Facebook community group signals"
                                                        >
                                                            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                                            </svg>
                                                            Facebook
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filtered.length === 0 && (
                                <div className="col-span-full text-center py-16">
                                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-5">
                                        <i className="fa-solid fa-search text-2xl text-gray-300"></i>
                                    </div>
                                    <h3 className="font-black text-gray-900 text-lg mb-2 tracking-tight">No neighborhoods match</h3>
                                    <p className="text-gray-500 font-sans font-normal text-[13px]">Try a different search term or filter.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export { CityNeighborhoodsView };
