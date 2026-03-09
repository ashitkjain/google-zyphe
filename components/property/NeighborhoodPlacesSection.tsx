import React, { useState } from 'react';
import { PropertyData } from '../../types';
import { NeighborhoodPlaces, NearbyPlace } from '../../services/apiService';

interface Props {
    data: PropertyData;
}

const CATEGORY_CONFIG: {
    key: keyof Omit<NeighborhoodPlaces, 'fetchedAt'>;
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
}[] = [
        { key: 'restaurants', label: 'Restaurants', icon: 'fa-utensils', color: 'text-rose-500', bgColor: 'bg-rose-50', borderColor: 'border-rose-100' },
        { key: 'cafes', label: 'Cafes', icon: 'fa-mug-hot', color: 'text-amber-500', bgColor: 'bg-amber-50', borderColor: 'border-amber-100' },
        { key: 'groceries', label: 'Groceries', icon: 'fa-cart-shopping', color: 'text-emerald-500', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100' },
        { key: 'parks', label: 'Parks', icon: 'fa-tree', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-100' },
        { key: 'transit', label: 'Transit', icon: 'fa-bus', color: 'text-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-100' },
        { key: 'fitness', label: 'Fitness', icon: 'fa-dumbbell', color: 'text-purple-500', bgColor: 'bg-purple-50', borderColor: 'border-purple-100' },
        { key: 'schools', label: 'Schools', icon: 'fa-graduation-cap', color: 'text-indigo-500', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-100' },
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

const PlaceRow: React.FC<{ place: NearbyPlace }> = ({ place }) => (
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
            {place.primaryTypeDisplayName && (
                <div className="text-[9px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">{place.primaryTypeDisplayName}</div>
            )}
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <StarRating rating={place.rating} />
            {place.userRatingCount != null && (
                <span className="text-[8px] text-slate-400 font-medium">({place.userRatingCount.toLocaleString()})</span>
            )}
        </div>
    </div>
);

const CategoryCard: React.FC<{
    icon: string;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    places: NearbyPlace[];
}> = ({ icon, label, color, bgColor, borderColor, places }) => {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? places : places.slice(0, 3);

    return (
        <div className={`rounded-2xl border ${borderColor} ${bgColor} p-4 flex flex-col gap-2`}>
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-xl bg-white flex items-center justify-center shadow-sm`}>
                        <i className={`fa-solid ${icon} ${color} text-[11px]`} />
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${color}`}>{label}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-white rounded-full px-2 py-0.5 border border-slate-100">
                    {places.length} nearby
                </span>
            </div>

            {places.length === 0 ? (
                <p className="text-[11px] text-slate-400 font-medium italic">None found nearby</p>
            ) : (
                <>
                    <div className="divide-y divide-slate-50">
                        {visible.map((place, i) => <PlaceRow key={i} place={place} />)}
                    </div>
                    {places.length > 3 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors mt-1 self-start"
                        >
                            {expanded ? '▲ Show less' : `▼ +${places.length - 3} more`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

const NeighborhoodPlacesSection: React.FC<Props> = ({ data }) => {
    const places = data.neighborhoodPlaces;
    if (!places) return null;

    const totalPlaces = CATEGORY_CONFIG.reduce((sum, cat) => sum + (places[cat.key]?.length ?? 0), 0);

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <i className="fa-solid fa-location-dot text-indigo-600 text-sm" />
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Google Places</div>
                        <h2 className="text-lg font-black text-slate-900 leading-tight">What's Nearby</h2>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-[10px]" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{totalPlaces} places found</span>
                </div>
            </div>

            {/* Category grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {CATEGORY_CONFIG.map(cat => (
                    <CategoryCard
                        key={cat.key}
                        icon={cat.icon}
                        label={cat.label}
                        color={cat.color}
                        bgColor={cat.bgColor}
                        borderColor={cat.borderColor}
                        places={places[cat.key] ?? []}
                    />
                ))}
            </div>

            {/* Google attribution */}
            <div className="mt-4 flex items-center gap-2">
                <img
                    src="https://developers.google.com/static/maps/documentation/images/google_on_white.png"
                    alt="Powered by Google"
                    className="h-4 opacity-60"
                />
                <span className="text-[9px] text-slate-400 font-medium">Places data powered by Google</span>
            </div>
        </div>
    );
};

export default NeighborhoodPlacesSection;
