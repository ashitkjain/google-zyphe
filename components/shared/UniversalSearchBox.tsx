import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SearchTrie, SearchResult } from '../services/api/trie';

interface UniversalSearchBoxProps {
    address: string;
    setAddress: (addr: string) => void;
    performSearch: (addr: string) => void;
    searchTrie: SearchTrie | null;
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
    searchTrie,
    searchHistory,
    favorites,
    loading,
    activeTab = 'search',
    onTabChange,
    onSaveSearch,
    onViewSaved
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // true only when the current address value was last changed by the user typing
    const userTypedRef = useRef(false);

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

    // When the address changes externally (parent sets it), clear the user-typed flag
    useEffect(() => {
        userTypedRef.current = false;
    }, [address]);

    const isPrefixValid = useMemo(() => {
        if (!address || activeTab !== 'search') return true;
        if (/^\d+$/.test(address.trim())) return true; // Allow numeric ZPID input
        // Only validate against the trie when the user is actively typing
        if (!userTypedRef.current) return true;
        return searchTrie?.isValidPrefix(address) ?? true;
    }, [address, searchTrie, activeTab]);

    const completeMatch = useMemo(() => {
        if (!address || activeTab !== 'search') return null;
        return searchTrie?.isCompleteMatch(address) ?? null;
    }, [address, searchTrie, activeTab]);

    const handleInputChange = (val: string) => {
        userTypedRef.current = true;
        setAddress(val);
        if (activeTab === 'search' && searchTrie) {
            if (val.length >= 1) {
                const matches = searchTrie.search(val, 8);
                setSuggestions(matches);
                setShowDropdown(true);
            } else {
                setSuggestions([]);
            }
        }
    };

    const [showBrowseModal, setShowBrowseModal] = useState(false);

    const handleSelect = (result: SearchResult) => {
        setAddress(result.label);
        setShowDropdown(false);
        performSearch(result.zpid || result.label);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeTab === 'story') {
            performSearch(address);
            return;
        }

        // Detect ZPID
        if (/^\d{7,12}$/.test(address.trim())) {
            setShowDropdown(false);
            performSearch(address.trim());
            return;
        }

        // Strict Enforcement: Only allow search if it's a complete match in the Trie
        if (completeMatch) {
            setShowDropdown(false);
            performSearch(completeMatch.zpid || completeMatch.label);
        } else {
            // If user just pressed enter on a partial string, try the first suggestion
            if (suggestions.length > 0) {
                handleSelect(suggestions[0]);
            }
        }
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

    const getIconForType = (type: string) => {
        switch (type) {
            case 'city': return <i className="fa-solid fa-city text-indigo-400"></i>;
            case 'zip': return <i className="fa-solid fa-map-pin text-emerald-400"></i>;
            case 'address': return <i className="fa-solid fa-house text-slate-400"></i>;
            default: return <i className="fa-solid fa-location-dot"></i>;
        }
    };

    return (
        <div className="relative w-full max-w-6xl mx-auto flex items-center gap-4 px-2" ref={dropdownRef}>
            {/* 1. Left-aligned Navigation Tabs */}
            <div className="flex items-center gap-1 shrink-0">
                {[
                    { id: 'story', label: 'Story', icon: 'fa-book-open-reader' },
                    { id: 'browse', label: 'Browse', icon: 'fa-compass' }
                ].map((tab) => (
                    <button
                        type="button"
                        key={tab.id}
                        onClick={() => {
                            if (tab.id === 'browse') {
                                setShowBrowseModal(true);
                            } else {
                                onTabChange?.(tab.id as any);
                            }
                        }}
                        className={`
                            px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
                            ${(activeTab === tab.id && tab.id !== 'browse') 
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
                    ${!isPrefixValid ? 'border-rose-400 bg-rose-50/30' : (showDropdown ? 'border-indigo-500 shadow-indigo-100/50' : 'border-transparent focus-within:border-indigo-500')}
                `}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={address}
                        onFocus={() => setShowDropdown(true)}
                        onChange={(e) => handleInputChange(e.target.value)}
                        placeholder={activeTab === 'story' ? "Describe your dream lifestyle..." : "Search address or city..."}
                        className={`w-full pl-4 pr-10 py-2 bg-transparent outline-none font-bold text-sm ${!isPrefixValid ? 'text-rose-600' : 'text-slate-800'} placeholder:text-slate-400`}
                    />
                    
                    <button 
                        type="submit"
                        disabled={loading || (!isPrefixValid && activeTab !== 'story')}
                        className={`absolute right-1 w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-50 ${!isPrefixValid ? 'bg-rose-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
                    >
                        {loading ? (
                            <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i>
                        ) : (
                            <i className={`fa-solid ${!isPrefixValid ? 'fa-triangle-exclamation' : 'fa-magnifying-glass'} text-[10px]`}></i>
                        )}
                    </button>
                </div>
                {!isPrefixValid && activeTab === 'search' && (
                    <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-rose-500 text-white text-[9px] font-black uppercase tracking-tighter rounded-md shadow-lg animate-in slide-in-from-top-1">
                        Unsupported Area
                    </div>
                )}
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
                        {/* Instant Matches (Trie results) */}
                        {suggestions.length > 0 && (
                            <div className="py-2">

                                {suggestions.map((result, i) => (
                                    <button
                                        key={`match-${i}`}
                                        onClick={() => handleSelect(result)}
                                        className="w-full px-6 py-3 flex items-center gap-4 hover:bg-slate-50 text-slate-700 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-xs">
                                            {getIconForType(result.type)}
                                        </div>
                                        <div className="flex flex-col items-start">
                                            <span className="text-sm font-bold">{result.label}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Recent History (Filtered to supported area) */}
                        {searchHistory.length > 0 && suggestions.length === 0 && (
                            <div className="py-2 border-t border-slate-50">
                                <div className="px-6 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search History</span>
                                </div>
                                {searchHistory.slice(0, 5).map((hist, i) => (
                                    <button
                                        key={`hist-${i}`}
                                        onClick={() => {
                                            const res = searchTrie?.isCompleteMatch(hist.address);
                                            if (res) handleSelect(res);
                                            else setAddress(hist.address);
                                        }}
                                        className="w-full px-6 py-3 flex items-center gap-4 hover:bg-slate-50 text-slate-600 transition-colors"
                                    >
                                        <i className="fa-regular fa-clock text-slate-300 text-xs"></i>
                                        <span className="text-sm font-medium">{hist.address}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Favorites */}
                        {favorites.length > 0 && suggestions.length === 0 && (
                            <div className="py-2 border-t border-slate-50">
                                <div className="px-6 py-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Favorites</span>
                                </div>
                                {favorites.slice(0, 3).map((fav, i) => (
                                    <button
                                        key={`fav-${i}`}
                                        onClick={() => {
                                            const res = searchTrie?.isCompleteMatch(fav.address);
                                            if (res) handleSelect(res);
                                            else setAddress(fav.address);
                                        }}
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

            {/* Browse Modal */}
            {showBrowseModal && (
                <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowBrowseModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-slate-800">Browse by City</h3>
                            <button onClick={() => setShowBrowseModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {['Pleasanton', 'Dublin'].map((city) => (
                                <button
                                    key={city}
                                    onClick={() => {
                                        setShowBrowseModal(false);
                                        const res = searchTrie?.isCompleteMatch(city);
                                        if (res) handleSelect(res);
                                        else performSearch(city);
                                    }}
                                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group shadow-sm hover:shadow-md"
                                >
                                    <div className="w-14 h-14 rounded-full bg-slate-100 group-hover:bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm group-hover:shadow">
                                        <i className="fa-solid fa-city text-2xl"></i>
                                    </div>
                                    <span className="font-bold text-slate-700 group-hover:text-indigo-700">{city}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UniversalSearchBox;
