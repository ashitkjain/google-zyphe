import React, { useState, useEffect, useRef } from 'react';
import { AddressIndexEntry } from '../services/firebase/properties';

interface UniversalSearchBoxProps {
    address: string;
    setAddress: (addr: string) => void;
    performSearch: (addr: string) => void;
    addressIndex: AddressIndexEntry[];
    searchHistory: { address: string; timestamp: number }[];
    favorites: any[];
    loading?: boolean;
    activeTab?: 'search' | 'story' | 'browse';
    onTabChange?: (tab: 'search' | 'story' | 'browse') => void;
    onSaveSearch?: () => void;
    onViewSaved?: () => void;
}

const UniversalSearchBox: React.FC<UniversalSearchBoxProps> = ({
    address,
    setAddress,
    performSearch,
    addressIndex,
    searchHistory,
    favorites,
    loading,
    activeTab = 'search',
    onTabChange,
    onSaveSearch,
    onViewSaved
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [suggestions, setSuggestions] = useState<AddressIndexEntry[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Handle clicks outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (val: string) => {
        setAddress(val);
        if (val.length >= 2) {
            const q = val.toLowerCase();
            const matches = addressIndex
                .filter(entry => entry.a.toLowerCase().includes(q))
                .slice(0, 6);
            setSuggestions(matches);
            setShowDropdown(true);
        } else {
            setSuggestions([]);
        }
    };

    const handleSelect = (addr: string) => {
        setAddress(addr);
        setShowDropdown(false);
        performSearch(addr);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowDropdown(false);
        performSearch(address);
    };

    const useCurrentLocation = () => {
        if ("geolocation" in navigator) {
            setShowDropdown(false);
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                // Transition to a search using coordinates
                performSearch(`${latitude},${longitude}`);
            });
        }
    };

    return (
        <div className="relative w-full max-w-6xl mx-auto flex items-center gap-4 px-2" ref={dropdownRef}>
            {/* 1. Left-aligned Navigation Tabs */}
            <div className="flex items-center gap-1 shrink-0">
                {[
                    { id: 'search', label: 'Search', icon: 'fa-magnifying-glass' },
                    { id: 'story', label: 'Story', icon: 'fa-book-open-reader' },
                    { id: 'browse', label: 'Browse', icon: 'fa-compass' }
                ].map((tab) => (
                    <button
                        type="button"
                        key={tab.id}
                        onClick={() => onTabChange?.(tab.id as any)}
                        className={`
                            px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                            ${activeTab === tab.id 
                                ? 'bg-white/40 text-black shadow-md' 
                                : 'text-black/70 hover:text-black hover:bg-black/5'}
                        `}
                    >
                        <i className={`fa-solid ${tab.icon} text-[11px]`}></i>
                        <span className="hidden lg:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* 2. Central Search Input */}
            <form onSubmit={handleSubmit} className="flex-1 relative z-[70]">
                <div className={`
                    relative flex items-center bg-white rounded-xl shadow-xl transition-all duration-300 border-2 overflow-hidden
                    ${showDropdown ? 'border-indigo-500 shadow-indigo-100/50' : 'border-transparent focus-within:border-indigo-500'}
                `}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={address}
                        onFocus={() => setShowDropdown(true)}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder={activeTab === 'story' ? "Describe your dream lifestyle..." : "Search address or city..."}
                        className="w-full pl-4 pr-10 py-2 bg-transparent outline-none text-slate-800 font-bold placeholder:text-slate-400 text-sm"
                    />
                    
                    <button 
                        type="submit"
                        disabled={loading}
                        className="absolute right-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                        {loading ? (
                            <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i>
                        ) : (
                            <i className="fa-solid fa-magnifying-glass text-[10px]"></i>
                        )}
                    </button>
                </div>
            </form>

            {/* 3. Right-aligned Saved Actions */}
            <div className="flex items-center gap-2 shrink-0">
                {onViewSaved && (
                    <button
                        type="button"
                        onClick={onViewSaved}
                        className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-black/70 hover:text-black bg-white/20 hover:bg-white/30 transition-all flex items-center gap-2"
                    >
                        <i className="fa-solid fa-bell"></i>
                        <span className="hidden md:inline">Saved</span>
                    </button>
                )}
                {onSaveSearch && (
                    <button
                        type="button"
                        onClick={onSaveSearch}
                        className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-black bg-indigo-500 hover:bg-indigo-600 transition-all shadow-lg flex items-center gap-2"
                    >
                        <i className="fa-solid fa-bell-plus"></i>
                        <span className="hidden md:inline">Save Search</span>
                    </button>
                )}
            </div>

            {/* Premium Dropdown */}
            {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                    
                    {/* Current Location */}
                    <button 
                        onClick={useCurrentLocation}
                        className="w-full px-6 py-4 flex items-center gap-4 hover:bg-indigo-50 text-indigo-600 transition-colors border-b border-slate-50 group"
                    >
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <i className="fa-solid fa-location-dot"></i>
                        </div>
                        <div className="text-left">
                            <p className="font-bold text-sm">Current Location</p>
                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Search near me</p>
                        </div>
                    </button>

                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {/* Browse Options (Specific to Browse Tab) */}
                        {activeTab === 'browse' && (
                            <div className="py-2">
                                <div className="px-6 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Browse</span>
                                </div>
                                {['Pleasanton', 'Dublin'].map((city) => (
                                    <button
                                        key={city}
                                        onClick={() => handleSelect(city)}
                                        className="w-full px-6 py-3 flex items-center gap-4 hover:bg-indigo-50 text-indigo-600 transition-colors group"
                                    >
                                        <i className="fa-solid fa-city text-xs group-hover:scale-110 transition-transform"></i>
                                        <span className="text-sm font-bold">{city}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Instant Matches (Autocomplete) */}
                        {suggestions.length > 0 && (
                            <div className="py-2">
                                <div className="px-6 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instant Match</span>
                                </div>
                                {suggestions.map((entry, i) => (
                                    <button
                                        key={`match-${i}`}
                                        onClick={() => handleSelect(entry.a)}
                                        className="w-full px-6 py-3 flex items-center gap-4 hover:bg-slate-50 text-slate-700 transition-colors"
                                    >
                                        <i className="fa-solid fa-bolt text-amber-400 text-xs"></i>
                                        <span className="text-sm font-medium">{entry.a}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Recent History */}
                        {searchHistory.length > 0 && (
                            <div className="py-2 border-t border-slate-50">
                                <div className="px-6 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search History</span>
                                </div>
                                {searchHistory.slice(0, 5).map((hist, i) => (
                                    <button
                                        key={`hist-${i}`}
                                        onClick={() => handleSelect(hist.address)}
                                        className="w-full px-6 py-3 flex items-center gap-4 hover:bg-slate-50 text-slate-600 transition-colors"
                                    >
                                        <i className="fa-regular fa-clock text-slate-300 text-xs"></i>
                                        <span className="text-sm font-medium">{hist.address}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Favorites */}
                        {favorites.length > 0 && (
                            <div className="py-2 border-t border-slate-50">
                                <div className="px-6 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Favorites</span>
                                </div>
                                {favorites.slice(0, 3).map((fav, i) => (
                                    <button
                                        key={`fav-${i}`}
                                        onClick={() => handleSelect(fav.address)}
                                        className="w-full px-6 py-3 flex items-center gap-4 hover:bg-slate-50 text-slate-600 transition-colors"
                                    >
                                        <i className="fa-solid fa-heart text-rose-400 text-xs"></i>
                                        <span className="text-sm font-medium">{fav.address}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniversalSearchBox;
