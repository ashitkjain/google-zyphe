import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getPropertiesByCity, CityPropertySummary } from '../../services/firebase/properties';

// ── Types ──────────────────────────────────────────────────────────────────────

interface IDXFilters {
    city: string;
    minPrice: number;
    maxPrice: number;
    minBeds: number;
    minBaths: number;
    homeType: string[];
    minSqft: number;
    maxSqft: number;
    minYear: number;
    maxYear: number;
    sortBy: 'price_asc' | 'price_desc' | 'newest' | 'sqft_desc' | 'beds_desc';
    hasPool: boolean | null;
    maxHoa: number;
    minSchoolRating: number;
}

const DEFAULT_FILTERS: IDXFilters = {
    city: 'Pleasanton',
    minPrice: 0,
    maxPrice: 10000000,
    minBeds: 0,
    minBaths: 0,
    homeType: [],
    minSqft: 0,
    maxSqft: 0,
    minYear: 0,
    maxYear: 0,
    sortBy: 'price_desc',
    hasPool: null,
    maxHoa: 0,
    minSchoolRating: 0,
};

const AVAILABLE_CITIES = ['Pleasanton', 'Dublin', 'Livermore', 'San Ramon', 'Danville'];
const HOME_TYPES = ['SingleFamily', 'Townhouse', 'Condo', 'MultiFamily', 'Lot'];
const SORT_OPTIONS: { value: IDXFilters['sortBy']; label: string }[] = [
    { value: 'price_desc', label: 'Price: High → Low' },
    { value: 'price_asc', label: 'Price: Low → High' },
    { value: 'newest', label: 'Newest Listed' },
    { value: 'sqft_desc', label: 'Largest First' },
    { value: 'beds_desc', label: 'Most Bedrooms' },
];

const PRICE_PRESETS = [500000, 750000, 1000000, 1250000, 1500000, 2000000, 2500000, 3000000, 5000000];

interface IDXSearchTabProps {
    onNavigateToProperty?: (zpid: string, address: string) => void;
}

// ── Property Card Component ────────────────────────────────────────────────────

const PropertyCard: React.FC<{
    property: CityPropertySummary;
    onNavigate?: (zpid: string, address: string) => void;
    viewMode: 'grid' | 'list';
}> = ({ property, onNavigate, viewMode }) => {
    const price = property.listPrice;
    const formattedPrice = price ? `$${price.toLocaleString()}` : 'Price N/A';
    const pricePerSqft = price && property.livingArea ? Math.round(price / property.livingArea) : null;
    const heroImage = property.images?.[0] || '';
    const typeLabel = property.homeType?.replace(/([A-Z])/g, ' $1').trim() || 'Home';

    const isNew = property.daysOnZillow != null && property.daysOnZillow <= 7;

    const neighborhoodName = useMemo(() => {
        if (!property.neighborhood) return null;
        if (typeof property.neighborhood === 'string') return property.neighborhood;
        if (typeof property.neighborhood === 'object') {
            const obj = property.neighborhood as any;
            return obj.name || obj.neighborhood_name || obj.social || obj.legal_subdivision || null;
        }
        return null;
    }, [property.neighborhood]);

    if (viewMode === 'list') {
        return (
            <div
                onClick={() => onNavigate?.(property.zpid, property.address)}
                className="flex items-center gap-6 bg-white border border-slate-200 rounded-2xl p-4 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group"
            >
                {/* Thumbnail */}
                <div className="w-32 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 relative">
                    {heroImage ? (
                        <img src={heroImage} alt={property.address} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><i className="fa-solid fa-house text-2xl"></i></div>
                    )}
                    {isNew && <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase rounded-md tracking-wider">New</div>}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="text-lg font-black text-slate-900">{formattedPrice}</div>
                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{property.address}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs font-bold text-slate-600">
                        {property.bedrooms != null && <span>{property.bedrooms} bd</span>}
                        {property.bathrooms != null && <span>{property.bathrooms} ba</span>}
                        {property.livingArea != null && <span>{property.livingArea.toLocaleString()} sqft</span>}
                        {pricePerSqft && <span className="text-indigo-500">${pricePerSqft}/sqft</span>}
                    </div>
                </div>

                {/* Tags */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider">{typeLabel}</span>
                    {neighborhoodName && <span className="text-[10px] font-medium text-slate-400 truncate max-w-[120px]">{neighborhoodName}</span>}
                </div>
            </div>
        );
    }

    // Grid card
    return (
        <div
            onClick={() => onNavigate?.(property.zpid, property.address)}
            className="bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden hover:border-indigo-300 hover:shadow-xl transition-all cursor-pointer group flex flex-col"
        >
            {/* Image */}
            <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
                {heroImage ? (
                    <img src={heroImage} alt={property.address} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300"><i className="fa-solid fa-house text-4xl"></i></div>
                )}

                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-1.5">
                    {isNew && <div className="px-2.5 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg tracking-wider shadow-lg">New</div>}
                    {property.pool && <div className="px-2.5 py-1 bg-sky-500 text-white text-[9px] font-black uppercase rounded-lg tracking-wider shadow-lg"><i className="fa-solid fa-water mr-1"></i>Pool</div>}
                </div>

                {/* Price overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                    <div className="bg-white/95 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-lg border border-white/20 flex items-end justify-between">
                        <div>
                            <div className="text-xl font-black text-slate-900 tracking-tight">{formattedPrice}</div>
                            {pricePerSqft && <div className="text-[10px] font-bold text-indigo-500 mt-0.5">${pricePerSqft}/sqft</div>}
                        </div>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[8px] font-black uppercase tracking-wider">{typeLabel}</span>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-3 text-sm font-black text-slate-700 mb-1.5">
                    {property.bedrooms != null && <span className="flex items-center gap-1"><i className="fa-solid fa-bed text-slate-400 text-[10px]"></i>{property.bedrooms}</span>}
                    {property.bathrooms != null && <span className="flex items-center gap-1"><i className="fa-solid fa-bath text-slate-400 text-[10px]"></i>{property.bathrooms}</span>}
                    {property.livingArea != null && <span className="flex items-center gap-1"><i className="fa-solid fa-ruler-combined text-slate-400 text-[10px]"></i>{property.livingArea.toLocaleString()}</span>}
                    {property.yearBuilt && <span className="flex items-center gap-1 text-slate-400"><i className="fa-solid fa-hammer text-[10px]"></i>{property.yearBuilt}</span>}
                </div>
                <p className="text-xs font-medium text-slate-500 truncate">{property.address}</p>
                {neighborhoodName && <p className="text-[10px] font-bold text-indigo-400 mt-1 truncate">{neighborhoodName}</p>}

                {/* School rating badge */}
                {property.maxSchoolRating && property.maxSchoolRating >= 7 && (
                    <div className="mt-2 flex items-center gap-1.5">
                        <i className="fa-solid fa-graduation-cap text-emerald-500 text-[10px]"></i>
                        <span className="text-[10px] font-black text-emerald-600">{property.maxSchoolRating}/10 school</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Filter Bar Component ───────────────────────────────────────────────────────

const FilterBar: React.FC<{
    filters: IDXFilters;
    setFilters: React.Dispatch<React.SetStateAction<IDXFilters>>;
    resultCount: number;
    totalCount: number;
}> = ({ filters, setFilters, resultCount, totalCount }) => {
    const [expanded, setExpanded] = useState(false);

    const updateFilter = <K extends keyof IDXFilters>(key: K, value: IDXFilters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const toggleHomeType = (type: string) => {
        setFilters(prev => ({
            ...prev,
            homeType: prev.homeType.includes(type)
                ? prev.homeType.filter(t => t !== type)
                : [...prev.homeType, type]
        }));
    };

    const activeFilterCount = [
        filters.minPrice > 0, filters.maxPrice < 10000000,
        filters.minBeds > 0, filters.minBaths > 0,
        filters.homeType.length > 0,
        filters.minSqft > 0, filters.maxSqft > 0,
        filters.minYear > 0, filters.maxYear > 0,
        filters.hasPool !== null,
        filters.maxHoa > 0,
        filters.minSchoolRating > 0,
    ].filter(Boolean).length;

    return (
        <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm">
            {/* Primary Filters Row */}
            <div className="px-5 py-4 flex flex-wrap items-center gap-3">
                {/* City Selector */}
                <select
                    value={filters.city}
                    onChange={(e) => updateFilter('city', e.target.value)}
                    className="px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                    {AVAILABLE_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* Price Min */}
                <select
                    value={filters.minPrice}
                    onChange={(e) => updateFilter('minPrice', Number(e.target.value))}
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                    <option value={0}>Min Price</option>
                    {PRICE_PRESETS.map(p => <option key={p} value={p}>${(p / 1000).toFixed(0)}K+</option>)}
                </select>

                {/* Price Max */}
                <select
                    value={filters.maxPrice}
                    onChange={(e) => updateFilter('maxPrice', Number(e.target.value))}
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                    <option value={10000000}>Max Price</option>
                    {PRICE_PRESETS.map(p => <option key={p} value={p}>Up to ${(p / 1000).toFixed(0)}K</option>)}
                </select>

                {/* Beds */}
                <select
                    value={filters.minBeds}
                    onChange={(e) => updateFilter('minBeds', Number(e.target.value))}
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                    <option value={0}>Beds</option>
                    {[1, 2, 3, 4, 5].map(b => <option key={b} value={b}>{b}+ Beds</option>)}
                </select>

                {/* Baths */}
                <select
                    value={filters.minBaths}
                    onChange={(e) => updateFilter('minBaths', Number(e.target.value))}
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                    <option value={0}>Baths</option>
                    {[1, 2, 3, 4].map(b => <option key={b} value={b}>{b}+ Baths</option>)}
                </select>

                {/* Sort */}
                <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value as IDXFilters['sortBy'])}
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                {/* More Filters toggle */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${expanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                    <i className={`fa-solid fa-sliders text-[10px]`}></i>
                    More
                    {activeFilterCount > 0 && <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center">{activeFilterCount}</span>}
                </button>

                {/* Reset */}
                {activeFilterCount > 0 && (
                    <button
                        onClick={() => setFilters(prev => ({ ...DEFAULT_FILTERS, city: prev.city }))}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 transition-colors"
                    >
                        Clear All
                    </button>
                )}

                {/* Result count */}
                <div className="ml-auto text-xs font-bold text-slate-400">
                    <span className="text-indigo-600 font-black">{resultCount}</span> / {totalCount} homes
                </div>
            </div>

            {/* Expanded Filters */}
            {expanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Home Type */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Home Type</label>
                            <div className="flex flex-wrap gap-2">
                                {HOME_TYPES.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => toggleHomeType(type)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filters.homeType.includes(type)
                                            ? 'bg-indigo-600 text-white border border-indigo-700'
                                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                                            }`}
                                    >
                                        {type.replace(/([A-Z])/g, ' $1').trim()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sqft Range */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Square Footage</label>
                            <div className="flex items-center gap-2">
                                <input type="number" placeholder="Min" value={filters.minSqft || ''} onChange={e => updateFilter('minSqft', Number(e.target.value) || 0)}
                                    className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                <span className="text-slate-300 text-xs">—</span>
                                <input type="number" placeholder="Max" value={filters.maxSqft || ''} onChange={e => updateFilter('maxSqft', Number(e.target.value) || 0)}
                                    className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                            </div>
                        </div>

                        {/* Year Built */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Year Built</label>
                            <div className="flex items-center gap-2">
                                <input type="number" placeholder="Min" value={filters.minYear || ''} onChange={e => updateFilter('minYear', Number(e.target.value) || 0)}
                                    className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                <span className="text-slate-300 text-xs">—</span>
                                <input type="number" placeholder="Max" value={filters.maxYear || ''} onChange={e => updateFilter('maxYear', Number(e.target.value) || 0)}
                                    className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                            </div>
                        </div>

                        {/* Pool */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Amenities</label>
                            <button
                                onClick={() => updateFilter('hasPool', filters.hasPool === true ? null : true)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filters.hasPool === true
                                    ? 'bg-sky-500 text-white border border-sky-600'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-sky-300'
                                    }`}
                            >
                                <i className="fa-solid fa-water mr-1"></i> Pool Only
                            </button>
                        </div>

                        {/* School Rating */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Min School Rating</label>
                            <select
                                value={filters.minSchoolRating}
                                onChange={(e) => updateFilter('minSchoolRating', Number(e.target.value))}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                                <option value={0}>Any</option>
                                {[5, 6, 7, 8, 9].map(r => <option key={r} value={r}>{r}+ / 10</option>)}
                            </select>
                        </div>

                        {/* HOA */}
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Max HOA / month</label>
                            <select
                                value={filters.maxHoa}
                                onChange={(e) => updateFilter('maxHoa', Number(e.target.value))}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                                <option value={0}>Any</option>
                                {[100, 200, 300, 500, 750, 1000].map(h => <option key={h} value={h}>≤ ${h}/mo</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main IDX Search Tab ────────────────────────────────────────────────────────

const IDXSearchTab: React.FC<IDXSearchTabProps> = ({ onNavigateToProperty }) => {
    const [filters, setFilters] = useState<IDXFilters>(DEFAULT_FILTERS);
    const [allProperties, setAllProperties] = useState<CityPropertySummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 24;

    // Fetch properties when city changes
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setPage(1);
            try {
                const props = await getPropertiesByCity(filters.city, 500);
                if (!cancelled) setAllProperties(props);
            } catch (err) {
                console.error('[IDXSearch] Failed to load properties:', err);
            }
            if (!cancelled) setLoading(false);
        };
        load();
        return () => { cancelled = true; };
    }, [filters.city]);

    // Apply filters + sort
    const filtered = useMemo(() => {
        let result = allProperties.filter(p => {
            const price = p.listPrice || 0;
            if (price < filters.minPrice) return false;
            if (price > filters.maxPrice) return false;
            if (filters.minBeds > 0 && (p.bedrooms || 0) < filters.minBeds) return false;
            if (filters.minBaths > 0 && (p.bathrooms || 0) < filters.minBaths) return false;
            if (filters.homeType.length > 0 && !filters.homeType.some(t => (p.homeType || '').toLowerCase().includes(t.toLowerCase()))) return false;
            if (filters.minSqft > 0 && (p.livingArea || 0) < filters.minSqft) return false;
            if (filters.maxSqft > 0 && (p.livingArea || Infinity) > filters.maxSqft) return false;
            if (filters.minYear > 0 && (p.yearBuilt || 0) < filters.minYear) return false;
            if (filters.maxYear > 0 && (p.yearBuilt || Infinity) > filters.maxYear) return false;
            if (filters.hasPool === true && !p.pool) return false;
            if (filters.maxHoa > 0 && (p.hoa || 0) > filters.maxHoa) return false;
            if (filters.minSchoolRating > 0 && (p.maxSchoolRating || 0) < filters.minSchoolRating) return false;
            return true;
        });

        // Sort
        result.sort((a, b) => {
            switch (filters.sortBy) {
                case 'price_asc': return (a.listPrice || 0) - (b.listPrice || 0);
                case 'price_desc': return (b.listPrice || 0) - (a.listPrice || 0);
                case 'newest': return (a.daysOnZillow || 999) - (b.daysOnZillow || 999);
                case 'sqft_desc': return (b.livingArea || 0) - (a.livingArea || 0);
                case 'beds_desc': return (b.bedrooms || 0) - (a.bedrooms || 0);
                default: return 0;
            }
        });

        return result;
    }, [allProperties, filters]);

    // Pagination
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Stats
    const stats = useMemo(() => {
        if (filtered.length === 0) return null;
        const prices = filtered.map(p => p.listPrice || 0).filter(p => p > 0);
        const avg = prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0;
        const median = prices.length ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : 0;
        return { avgPrice: avg, medianPrice: median, count: filtered.length };
    }, [filtered]);

    const handleNavigate = useCallback((zpid: string, address: string) => {
        if (onNavigateToProperty) {
            onNavigateToProperty(zpid, address);
        }
    }, [onNavigateToProperty]);

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-200">
                        <i className="fa-solid fa-magnifying-glass-location"></i>
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Property Search</h1>
                        <p className="text-sm font-medium text-slate-500">AI-powered home discovery across Tri-Valley</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-300'}`}
                        >
                            <i className="fa-solid fa-grid-2 text-sm"></i>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-300'}`}
                        >
                            <i className="fa-solid fa-list text-sm"></i>
                        </button>
                    </div>
                </div>

                {/* Market Snapshot */}
                {stats && (
                    <div className="flex items-center gap-6 px-5 py-3 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white">
                        <div className="flex items-center gap-2">
                            <i className="fa-solid fa-chart-simple text-indigo-400 text-sm"></i>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Market Snapshot</span>
                        </div>
                        <div className="w-px h-6 bg-slate-700"></div>
                        <div>
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active</div>
                            <div className="text-sm font-black">{stats.count}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Avg Price</div>
                            <div className="text-sm font-black text-emerald-400">${(stats.avgPrice / 1000).toFixed(0)}K</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Median</div>
                            <div className="text-sm font-black text-indigo-400">${(stats.medianPrice / 1000).toFixed(0)}K</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Filters */}
            <FilterBar filters={filters} setFilters={setFilters} resultCount={filtered.length} totalCount={allProperties.length} />

            {/* Loading */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center animate-pulse">
                        <i className="fa-solid fa-house-signal text-indigo-500 text-xl"></i>
                    </div>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading {filters.city} properties...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                        <i className="fa-solid fa-filter-circle-xmark text-slate-400 text-2xl"></i>
                    </div>
                    <h3 className="text-lg font-black text-slate-600">No properties match your criteria</h3>
                    <p className="text-sm text-slate-400 font-medium">Try adjusting your filters or exploring a different city.</p>
                    <button
                        onClick={() => setFilters(prev => ({ ...DEFAULT_FILTERS, city: prev.city }))}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Reset Filters
                    </button>
                </div>
            )}

            {/* Property Grid / List */}
            {!loading && filtered.length > 0 && (
                <>
                    <div className={`mt-6 ${viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                        : 'flex flex-col gap-3'
                    }`}>
                        {paged.map(p => (
                            <PropertyCard key={p.zpid} property={p} onNavigate={handleNavigate} viewMode={viewMode} />
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-10">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:border-indigo-300 transition-all"
                            >
                                <i className="fa-solid fa-chevron-left text-xs"></i>
                            </button>

                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                const pageNum = totalPages <= 7 ? i + 1 : (
                                    page <= 4 ? i + 1 :
                                    page >= totalPages - 3 ? totalPages - 6 + i :
                                    page - 3 + i
                                );
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${page === pageNum
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:border-indigo-300 transition-all"
                            >
                                <i className="fa-solid fa-chevron-right text-xs"></i>
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default IDXSearchTab;
