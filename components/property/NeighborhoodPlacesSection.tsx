import React, { useState } from 'react';
import { PropertyData } from '../../types';
import { NeighborhoodPlaces, NearbyPlace, NeighborhoodCategorySet } from '../../services/apiService';
import { NeighborhoodAnalysis } from '../../types/ai';

interface Props {
    data: PropertyData;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    mapZoomOut?: string;
    address?: string;
}

const CATEGORY_CONFIG: {
    key: keyof Omit<NeighborhoodPlaces, 'fetchedAt'>;
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
}[] = [
        { key: 'dining', label: 'Dining & Cafes', icon: 'fa-utensils', color: 'text-rose-500', bgColor: 'bg-rose-50', borderColor: 'border-rose-100' },
        { key: 'transit', label: 'Transit', icon: 'fa-bus', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-100' },
        { key: 'shopping', label: 'Shopping & Groceries', icon: 'fa-bag-shopping', color: 'text-orange-500', bgColor: 'bg-orange-50', borderColor: 'border-orange-100' },
        { key: 'parks', label: 'Parks', icon: 'fa-tree', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-100' },
        { key: 'medical', label: 'Medical', icon: 'fa-house-medical', color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-100' },
        { key: 'fitness', label: 'Fitness', icon: 'fa-dumbbell', color: 'text-purple-500', bgColor: 'bg-purple-50', borderColor: 'border-purple-100' },
        { key: 'schools', label: 'Schools', icon: 'fa-graduation-cap', color: 'text-indigo-500', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-100' },
        { key: 'community', label: 'Community & Other', icon: 'fa-icons', color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-100' },
    ];

const StarRating: React.FC<{ rating?: number }> = ({ rating }) => {
    if (!rating) return null;
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.5;
    return (
        <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <i
                    key={i}
                    className={`fa-star text-[8px] ${i < full
                        ? 'fa-solid text-amber-400'
                        : i === full && hasHalf
                            ? 'fa-solid text-amber-300'
                            : 'fa-regular text-slate-200'
                        }`}
                />
            ))}
            <span className="text-[9px] font-bold text-slate-500 ml-0.5">{rating.toFixed(1)}</span>
        </span>
    );
};

const PlaceRow: React.FC<{ place: NearbyPlace }> = ({ place }) => {
    const distanceMiles = place.distanceMeters ? (place.distanceMeters * 0.000621371).toFixed(1) : null;

    return (
        <div className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-slate-800 line-clamp-2 leading-tight">
                    {place.googleMapsUri ? (
                        <a
                            href={place.googleMapsUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-indigo-600 transition-colors"
                        >
                            {place.name}
                            <i className="fa-solid fa-arrow-up-right-from-square text-[8px] ml-1 opacity-40" />
                        </a>
                    ) : (
                        place.name
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    {!place.isAiExtracted && distanceMiles && (
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">{distanceMiles} mi</span>
                    )}
                    <StarRating rating={place.rating} />
                    {place.userRatingCount != null && (
                        <span className="text-[8px] text-slate-400 font-medium">({place.userRatingCount.toLocaleString()})</span>
                    )}
                </div>
            </div>
        </div >
    );
};

const CategoryCard: React.FC<{
    icon: string;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    places: NearbyPlace[];
}> = ({ icon, label, color, bgColor, borderColor, places }) => {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? places : places.slice(0, 4);

    return (
        <div className={`rounded-xl border ${borderColor} ${bgColor} p-2.5 flex flex-col gap-1.5 self-start`}>
            {/* Title & Badge */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-white flex items-center justify-center shadow-sm">
                        <i className={`fa-solid ${icon} ${color} text-[9px]`} />
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</span>
                </div>
            </div>

            {places.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium italic">No results found</p>
            ) : (
                <>
                    <div className="divide-y divide-slate-50">
                        {visible.map((place, i) => <PlaceRow key={i} place={place} />)}
                    </div>
                    {places.length > 4 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mt-1 self-start"
                        >
                            {expanded ? '▲ Show less' : `▼ +${places.length - 4} more`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

const NeighborhoodPlacesSection: React.FC<Props> = ({ data, visualPoi, mapLabels, mapZoomOut, address }) => {
    const [mode, setMode] = useState<'places' | 'map'>('places');
    const [expandedMap, setExpandedMap] = useState<string | null>(null);
    const rawPlaces = data.neighborhoodPlaces;
    if (!rawPlaces && !visualPoi && (!mapLabels || mapLabels.length === 0)) return null;

    const collections: Record<string, NearbyPlace[]> = {};

    CATEGORY_CONFIG.forEach(cat => {
        let list: NearbyPlace[] = [];

        if (mode === 'places') {
            // Show Google Places API data
            list = (rawPlaces as any)?.[cat.key] || [];
            collections[cat.key] = [...list];
        } else {
            // Show only AI-extracted visual POI from the map
            collections[cat.key] = [];
            if (visualPoi && visualPoi[cat.key as keyof NeighborhoodAnalysis['visual_poi']]) {
                const aiNames = visualPoi[cat.key as keyof NeighborhoodAnalysis['visual_poi']];
                if (Array.isArray(aiNames)) {
                    aiNames.forEach(name => {
                        collections[cat.key].push({
                            name,
                            primaryTypeDisplayName: 'AI Visual Discovery',
                            isAiExtracted: true
                        });
                    });
                }
            }
        }
    });

    // Merge 'others' data into the combined 'community' category
    if (mode === 'places') {
        const othersList = (rawPlaces as any)?.['others'] || [];
        if (collections['community']) {
            collections['community'] = [...collections['community'], ...othersList];
        }
    } else {
        if (visualPoi && (visualPoi as any)['others']) {
            const aiNames = (visualPoi as any)['others'];
            if (Array.isArray(aiNames)) {
                aiNames.forEach((name: string) => {
                    collections['community']?.push({
                        name,
                        primaryTypeDisplayName: 'AI Visual Discovery',
                        isAiExtracted: true
                    });
                });
            }
        }
    }

    const totalPlaces = CATEGORY_CONFIG.reduce((sum, cat) => {
        return sum + (collections[cat.key] || []).length;
    }, 0);

    // Category grid
    const hasActiveData = CATEGORY_CONFIG.some(cat => (collections[cat.key] || []).length > 0);

    return (
        <div className="px-6 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">

                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setMode('places')}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${mode === 'places' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            Google Places
                        </button>
                        <button
                            onClick={() => setMode('map')}
                            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${mode === 'map' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            More From The Map
                        </button>
                    </div>
                </div>
            </div>

            {!hasActiveData ? (
                <div className="py-12 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-3xl">
                    <i className="fa-solid fa-hourglass-half text-slate-300 text-2xl mb-3" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">No transit data in cache</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">Please try searching again to refresh results</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-1 items-start">
                    {/* Neighborhood Map — spans 2 columns */}
                    {mapZoomOut && (
                        <div className="hidden lg:block col-span-2 row-span-3">
                            <div
                                onClick={() => setExpandedMap(mapZoomOut)}
                                className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 group relative cursor-zoom-in w-full h-full"
                            >
                                <img
                                    src={mapZoomOut}
                                    alt="Neighborhood Map"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">Neighborhood</div>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                    <i className="fa-solid fa-magnifying-glass-plus text-white opacity-0 group-hover:opacity-100 transition-all scale-50 group-hover:scale-100 text-2xl drop-shadow-md"></i>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Category cards */}
                    {CATEGORY_CONFIG.map(cat => (
                        <CategoryCard
                            key={cat.key}
                            icon={cat.icon}
                            label={cat.label}
                            color={cat.color}
                            bgColor={cat.bgColor}
                            borderColor={cat.borderColor}
                            places={collections[cat.key] || []}
                        />
                    ))}
                </div>
            )}

            {/* Expanded Map Overlay */}
            {expandedMap && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-500"
                    onClick={() => setExpandedMap(null)}
                >
                    <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl"></div>
                    <div
                        className="relative max-w-6xl w-full bg-white rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col"
                        style={{ maxHeight: '90vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setExpandedMap(null)}
                            className="absolute top-6 right-6 z-20 w-12 h-12 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all border border-slate-100 active:scale-95"
                        >
                            <i className="fa-solid fa-xmark text-xl"></i>
                        </button>
                        <div className="flex-1 overflow-hidden bg-slate-50 flex items-center justify-center p-2">
                            <img
                                src={expandedMap}
                                alt="Expanded Map View"
                                className="max-w-full max-h-full w-auto h-auto object-contain rounded-2xl shadow-lg"
                            />
                        </div>
                        <div className="bg-white px-10 py-8 border-t border-slate-50 flex justify-between items-center flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                    <i className="fa-solid fa-map-location-dot text-indigo-600 text-xl"></i>
                                </div>
                                <div>
                                    <div className="text-slate-900 font-black text-xl tracking-tight">Neighborhood Map</div>
                                    {address && <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">{address}</div>}
                                </div>
                            </div>
                            <button
                                onClick={() => setExpandedMap(null)}
                                className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                            >
                                CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default NeighborhoodPlacesSection;
