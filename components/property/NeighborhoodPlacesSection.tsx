import React, { useState } from 'react';
import { PropertyData } from '../../types';
import { NeighborhoodPlaces, NearbyPlace } from '../../services/apiService';
import { NeighborhoodAnalysis } from '../../types/ai';

interface Props {
    data: PropertyData;
    visualPoi?: NeighborhoodAnalysis['visual_poi'];
    mapLabels?: string[];
    mapZoomOut?: string;
    address?: string;
    neighborhoodOverview?: string | null;
    hoaAmenities?: string[];
    isEmbeddedCard?: boolean;
}

const CATEGORY_CONFIG: {
    key: keyof Omit<NeighborhoodPlaces, 'fetchedAt'>;
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    activeBg: string;
    activeText: string;
}[] = [
        { key: 'dining', label: 'Dining', icon: 'fa-utensils', color: 'text-rose-500', bgColor: 'bg-rose-50', borderColor: 'border-rose-100', activeBg: 'bg-rose-500', activeText: 'text-white' },
        { key: 'shopping', label: 'Shopping', icon: 'fa-bag-shopping', color: 'text-orange-500', bgColor: 'bg-orange-50', borderColor: 'border-orange-100', activeBg: 'bg-orange-500', activeText: 'text-white' },
        { key: 'parks', label: 'Parks', icon: 'fa-tree', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-100', activeBg: 'bg-green-600', activeText: 'text-white' },
        { key: 'medical', label: 'Medical', icon: 'fa-house-medical', color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-100', activeBg: 'bg-rose-600', activeText: 'text-white' },
        { key: 'fitness', label: 'Fitness', icon: 'fa-dumbbell', color: 'text-purple-500', bgColor: 'bg-purple-50', borderColor: 'border-purple-100', activeBg: 'bg-purple-500', activeText: 'text-white' },
        { key: 'community', label: 'Community', icon: 'fa-icons', color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-100', activeBg: 'bg-teal-600', activeText: 'text-white' },
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
                    className={`fa-star text-[7px] ${i < full
                        ? 'fa-solid text-amber-400'
                        : i === full && hasHalf
                            ? 'fa-solid text-amber-300'
                            : 'fa-regular text-slate-200'
                        }`}
                />
            ))}
            <span className="text-[9px] font-bold text-slate-400 ml-1">{rating.toFixed(1)}</span>
        </span>
    );
};

const PlaceRow: React.FC<{ place: NearbyPlace }> = ({ place }) => {
    const distanceMiles = place.distanceMeters ? (place.distanceMeters * 0.000621371).toFixed(1) : null;

    return (
        <div className="flex flex-col py-2 border-b border-slate-100/50 last:border-0 group">
            <div className="text-[14px] font-bold text-slate-800 leading-snug transition-colors group-hover:text-indigo-600 mb-0.5 break-words">
                {place.googleMapsUri ? (
                    <a href={place.googleMapsUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 focus:outline-none">
                        {place.name}
                        <i className="fa-solid fa-arrow-up-right-from-square text-[9px] opacity-0 group-hover:opacity-40 transition-opacity" />
                    </a>
                ) : place.name}
            </div>
            <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2">
                    {place.rating != null && <StarRating rating={place.rating} />}
                    {place.userRatingCount != null && (
                        <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">({place.userRatingCount.toLocaleString()} reviews)</span>
                    )}
                </div>
                {distanceMiles && (
                    <div className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                        <span className="text-[10px] font-black text-indigo-500/70 tracking-tight whitespace-nowrap">
                            {distanceMiles} mi
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const NeighborhoodPlacesSection: React.FC<Props> = ({ data, visualPoi, mapLabels, mapZoomOut, isEmbeddedCard, neighborhoodOverview }) => {
    const [viewMode, setViewMode] = useState<'places' | 'map'>('places');
    const [activeCategory, setActiveCategory] = useState<string>(CATEGORY_CONFIG[0].key);
    const [showAll, setShowAll] = useState(false);
    
    const rawPlaces = data.google_places;
    if (!rawPlaces && !visualPoi && (!mapLabels || mapLabels.length === 0)) return null;

    const collections: Record<string, NearbyPlace[]> = {};

    CATEGORY_CONFIG.forEach(cat => {
        let list: NearbyPlace[] = [];
        if (viewMode === 'places') {
            list = (rawPlaces as any)?.[cat.key] || [];
            if (cat.key === 'community') {
                list = [...list, ...((rawPlaces as any)?.['others'] || [])];
            }
            collections[cat.key] = list;
        } else {
            const aiNames = (visualPoi as any)?.[cat.key] || (cat.key === 'community' ? (visualPoi as any)?.['others'] : []);
            collections[cat.key] = Array.isArray(aiNames) ? aiNames.map(name => ({
                name,
                primaryTypeDisplayName: 'AI Visual Discovery',
                isAiExtracted: true
            })) : [];
        }
    });

    const categoriesWithData = CATEGORY_CONFIG.filter(cat => (collections[cat.key] || []).length > 0);
    const activePlaces = collections[activeCategory] || [];

    // Auto-select first available category if current one is empty
    React.useEffect(() => {
        if (activePlaces.length === 0 && categoriesWithData.length > 0) {
            setActiveCategory(categoriesWithData[0].key);
        }
        setShowAll(false);
    }, [activePlaces.length, categoriesWithData, activeCategory, viewMode]);

    if (isEmbeddedCard && mapZoomOut) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex min-h-0 overflow-hidden">
                {/* Left: header + places list */}
                <div className="w-[56%] shrink-0 flex flex-col min-w-0">
                    {/* Mode switcher header */}
                    <div className="px-5 py-4 flex items-center gap-4 border-b border-slate-50 bg-slate-50/30">
                        <div className="flex bg-slate-100/60 p-1 rounded-xl border border-slate-200/40 backdrop-blur-sm shrink-0">
                            <button
                                onClick={() => setViewMode('places')}
                                className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewMode === 'places' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                GOOGLE PLACES
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`px-4 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewMode === 'map' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                VISUAL POI
                            </button>
                        </div>
                    </div>
                    {/* Content */}
                    <div className="p-4 flex flex-col gap-4">
                        {neighborhoodOverview && (
                            <div className="px-1 mb-1">
                                <div className="flex items-start gap-3 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50">
                                    <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-indigo-100/30">
                                        <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-[10px]" />
                                    </div>
                                    <p className="text-[12.5px] text-slate-600 leading-relaxed font-sans font-medium italic">
                                        "{neighborhoodOverview}"
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {categoriesWithData.map(cat => {
                                const isActive = activeCategory === cat.key;
                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => setActiveCategory(cat.key)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 ${
                                            isActive
                                                ? `${cat.activeBg} ${cat.activeText} border-current shadow-lg`
                                                : `bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50/80`
                                        }`}
                                    >
                                        <i className={`fa-solid ${cat.icon} text-[11px] ${!isActive ? cat.color : ''}`} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{cat.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div>
                            {activePlaces.length > 0 ? (
                                <>
                                    <div className={`grid grid-cols-1 gap-y-0 ${showAll ? 'max-h-[480px] overflow-y-auto' : ''} px-2 custom-scrollbar`}>
                                        {(showAll ? activePlaces : activePlaces.slice(0, 7)).map((place, i) => (
                                            <PlaceRow key={i} place={place} />
                                        ))}
                                    </div>
                                    {activePlaces.length > 7 && (
                                        <div className="pt-3 px-2">
                                            <button
                                                onClick={() => setShowAll(!showAll)}
                                                className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-2 transition-all group"
                                            >
                                                <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                                                    <i className={`fa-solid fa-chevron-${showAll ? 'up' : 'down'} text-[8px]`} />
                                                </span>
                                                {showAll ? 'Show Less' : `Show ${activePlaces.length - 7} More Locations`}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-center">
                                    <i className="fa-solid fa-map-pin text-xl opacity-20 mb-2" />
                                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">No locations discovered</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: map — occupies remaining 36% space */}
                <div className="flex-1 shrink-0 self-stretch p-3">
                    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                        <img
                            src={mapZoomOut}
                            alt="Neighborhood Map"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${isEmbeddedCard ? 'p-0 pb-4' : 'p-5 md:p-7'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>

            {/* Header / Mode Switcher */}
            {!isEmbeddedCard && (
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm shrink-0">
                            <i className="fa-solid fa-map-location-dot text-indigo-500 text-sm"></i>
                        </div>
                        <div className="pt-0.5">
                            <h2 className="text-[18px] font-black text-slate-900 tracking-tight leading-none mb-2">What's Nearby?</h2>
                            {mapZoomOut && (
                                <button
                                    onClick={() => setExpandedMap(mapZoomOut)}
                                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm active:scale-95 group"
                                    title="View Neighborhood Map"
                                >
                                    <i className="fa-solid fa-map-location-dot text-xs group-hover:scale-110 transition-transform"></i>
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-100/60 p-1 rounded-xl border border-slate-200/40 backdrop-blur-sm self-start sm:self-auto shrink-0">
                        <button
                            onClick={() => setViewMode('places')}
                            className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all ${viewMode === 'places' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            GOOGLE PLACES
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`px-4 py-2 text-[10px] font-black rounded-lg transition-all ${viewMode === 'map' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            VISUAL POI
                        </button>
                    </div>
                </div>
            )}

            {/* Content: places list */}
            <div className="flex flex-col gap-8">
                {neighborhoodOverview && (
                    <div className="px-1 -mb-4">
                        <div className="flex items-start gap-4 bg-indigo-50/40 p-5 rounded-[2rem] border border-indigo-100/50 shadow-sm">
                            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-md border border-indigo-100/30">
                                <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-sm" />
                            </div>
                            <p className="text-[14px] text-slate-600 leading-relaxed font-sans font-medium italic">
                                "{neighborhoodOverview}"
                            </p>
                        </div>
                    </div>
                )}
                <div className="flex flex-wrap gap-2.5 mb-8">
                    {categoriesWithData.map(cat => {
                        const isActive = activeCategory === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => setActiveCategory(cat.key)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 ${
                                    isActive
                                        ? `${cat.activeBg} ${cat.activeText} border-current shadow-lg shadow-${cat.key}-500/10`
                                        : `bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50/80`
                                }`}
                            >
                                <i className={`fa-solid ${cat.icon} text-[11px] ${!isActive ? cat.color : ''}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{cat.label}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                                    {(collections[cat.key] || []).length}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-100/80 shadow-sm p-1">
                    {activePlaces.length > 0 ? (
                        <>
                            <div className={`grid grid-cols-1 gap-y-0 ${showAll ? 'max-h-[460px]' : ''} overflow-y-auto px-2 custom-scrollbar`}>
                                {(showAll ? activePlaces : activePlaces.slice(0, 3)).map((place, i) => (
                                    <PlaceRow key={i} place={place} />
                                ))}
                            </div>
                            {activePlaces.length > 3 && (
                                <div className="pt-3 px-2">
                                    <button
                                        onClick={() => setShowAll(!showAll)}
                                        className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-2 transition-all group"
                                    >
                                        <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                                            <i className={`fa-solid fa-chevron-${showAll ? 'up' : 'down'} text-[8px]`} />
                                        </span>
                                        {showAll ? 'Show Less' : `Show ${activePlaces.length - 3} More Locations`}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                                <i className="fa-solid fa-map-pin text-xl opacity-20" />
                            </div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">No locations discovered</p>
                            <p className="text-[10px] font-medium text-slate-400 mt-1">Try switching to Visual POI for AI-extracted details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NeighborhoodPlacesSection;
