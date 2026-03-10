import React, { useState } from 'react';
import { PropertyData } from '../../types';
import { NeighborhoodPlaces, NearbyPlace, NeighborhoodCategorySet } from '../../services/apiService';
import { NeighborhoodAnalysis } from '../../types/ai';

interface Props {
    data: PropertyData;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
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
        { key: 'shopping', label: 'Shopping & Groceries', icon: 'fa-bag-shopping', color: 'text-orange-500', bgColor: 'bg-orange-50', borderColor: 'border-orange-100' },
        { key: 'parks', label: 'Parks', icon: 'fa-tree', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-100' },
        { key: 'transit', label: 'Transit', icon: 'fa-bus', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-100' },
        { key: 'fitness', label: 'Fitness', icon: 'fa-dumbbell', color: 'text-purple-500', bgColor: 'bg-purple-50', borderColor: 'border-purple-100' },
        { key: 'schools', label: 'Schools', icon: 'fa-graduation-cap', color: 'text-indigo-500', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-100' },
        { key: 'medical', label: 'Medical', icon: 'fa-house-medical', color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-100' },
        { key: 'community', label: 'Community', icon: 'fa-icons', color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-100' },
        { key: 'others', label: 'Other POI', icon: 'fa-location-crosshairs', color: 'text-slate-500', bgColor: 'bg-slate-50', borderColor: 'border-slate-100' },
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
                <div className="text-[12px] font-semibold text-slate-800 truncate leading-tight">
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
                <div className="flex items-center gap-1 mt-0.5">
                    {place.isAiExtracted ? (
                        <>
                            <i className="fa-solid fa-brain text-indigo-400 text-[8px]" />
                            <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-tight">AI Discovery</span>
                        </>
                    ) : (
                        <>
                            {distanceMiles && (
                                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">{distanceMiles} mi</span>
                            )}
                            {place.primaryTypeDisplayName && (
                                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">{place.primaryTypeDisplayName}</span>
                            )}
                        </>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <StarRating rating={place.rating} />
                {place.userRatingCount != null && (
                    <span className="text-[8px] text-slate-400 font-medium">({place.userRatingCount.toLocaleString()})</span>
                )}
            </div>
        </div>
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
        <div className={`rounded-2xl border ${borderColor} ${bgColor} p-4 flex flex-col gap-3`}>
            {/* Title & Badge */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <i className={`fa-solid ${icon} ${color} text-[11px]`} />
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

const NeighborhoodPlacesSection: React.FC<Props> = ({ data, visualPoi, mapLabels }) => {
    const [mode, setMode] = useState<'walk' | 'drive' | 'all'>('all');
    const rawPlaces = data.neighborhoodPlaces;
    if (!rawPlaces && !visualPoi && (!mapLabels || mapLabels.length === 0)) return null;

    const collections: Record<string, NearbyPlace[]> = {};

    CATEGORY_CONFIG.forEach(cat => {
        let list: NearbyPlace[] = [];
        if (mode === 'all') list = (rawPlaces as any)?.[cat.key] || [];
        else if (mode === 'walk') list = rawPlaces?.walkable?.[cat.key as keyof NeighborhoodCategorySet] || [];
        else list = rawPlaces?.drivable?.[cat.key as keyof NeighborhoodCategorySet] || [];

        collections[cat.key] = [...list];

        // Blend AI discoveries into view if unique (only in ALL or Walk mode)
        if (mode !== 'drive' && visualPoi && visualPoi[cat.key as keyof NeighborhoodAnalysis['visual_poi']]) {
            const aiNames = visualPoi[cat.key as keyof NeighborhoodAnalysis['visual_poi']];
            if (Array.isArray(aiNames)) {
                aiNames.forEach(name => {
                    const normalized = name.toLowerCase().trim();
                    const alreadyKnown = collections[cat.key].some(p => p.name.toLowerCase().trim() === normalized);
                    if (!alreadyKnown) {
                        collections[cat.key].push({
                            name,
                            primaryTypeDisplayName: 'AI Visual Discovery',
                            isAiExtracted: true
                        });
                    }
                });
            }
        }
    });

    const totalPlaces = CATEGORY_CONFIG.reduce((sum, cat) => {
        return sum + (collections[cat.key] || []).length;
    }, 0);

    // Category grid
    const hasActiveData = CATEGORY_CONFIG.some(cat => (collections[cat.key] || []).length > 0);

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <i className={`fa-solid ${mode === 'walk' ? 'fa-person-walking' : mode === 'drive' ? 'fa-car' : 'fa-location-dot'} text-indigo-600 text-sm`} />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">
                            {mode === 'walk' ? 'Local Walkable (1.5km)' : mode === 'drive' ? 'Regional Drivable (5km)' : 'Discovery Context'}
                        </div>
                        <h2 className="text-lg font-black text-slate-900 leading-tight">What's Nearby</h2>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setMode('all')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setMode('walk')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'walk' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            Walkable
                        </button>
                        <button
                            onClick={() => setMode('drive')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'drive' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            Drivable
                        </button>
                    </div>
                    {totalPlaces > 0 && (
                        <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{totalPlaces} spots</span>
                        </div>
                    )}
                </div>
            </div>

            {!hasActiveData && (mode === 'walk' || mode === 'drive') ? (
                <div className="py-12 flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-3xl">
                    <i className="fa-solid fa-hourglass-half text-slate-300 text-2xl mb-3" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">No transit data in cache</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">Please try searching again to refresh results</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

            {/* Attributions */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-x-8 gap-y-4">
                <div className="flex items-center gap-2">
                    <img
                        src="https://developers.google.com/static/maps/documentation/images/google_on_white.png"
                        alt="Powered by Google"
                        className="h-3.5 opacity-60"
                    />
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Google Places</span>
                </div>

                {(visualPoi || mapLabels) && (
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-brain text-indigo-300 text-[14px]" />
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-0.5">AI Visual Analysis</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NeighborhoodPlacesSection;
