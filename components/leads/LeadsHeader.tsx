import React from 'react';

interface LeadsHeaderProps {
    activeTab: 'Buyer' | 'Buyer2' | 'Seller';
    setActiveTab: (tab: 'Buyer' | 'Buyer2' | 'Seller') => void;
    onCreateLead: (initialUpdates?: any) => void;
    displayMode: 'gallery' | 'kanban';
    setDisplayMode: (mode: 'gallery' | 'kanban') => void;
    boardSettings: {
        search: string;
        sort: 'newest' | 'oldest' | 'name' | 'temp';
        tempFilter: string[];
    };
    setBoardSettings: React.Dispatch<React.SetStateAction<{
        search: string;
        sort: 'newest' | 'oldest' | 'name' | 'temp';
        tempFilter: string[];
    }>>;
    isMobile?: boolean;
}

const LeadsHeader: React.FC<LeadsHeaderProps> = ({ activeTab, setActiveTab, onCreateLead, displayMode, setDisplayMode, boardSettings, setBoardSettings, isMobile }) => {
    const [activeDropdown, setActiveDropdown] = React.useState<'filter' | 'sort' | null>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex-shrink-0 w-full relative z-[60]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    {/* Tab Switcher */}
                    <div className="flex bg-slate-200/50 p-1 rounded-xl items-center mr-2 flex-shrink-0">
                        <button
                            onClick={() => setActiveTab('Buyer')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'Buyer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-user-tag"></i>
                            Buyer
                        </button>
                        <button
                            onClick={() => setActiveTab('Buyer2')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'Buyer2' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-user-tag"></i>
                            Seller
                        </button>
                    </div>

                    <button
                        onClick={() => onCreateLead({ leadType: activeTab })}
                        className={`w-8 h-8 rounded-full text-white flex items-center justify-center transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95 flex-shrink-0 ${activeTab === 'Buyer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        title={`Create New ${activeTab} Lead`}
                    >
                        <i className="fa-solid fa-plus"></i>
                    </button>

                    {/* Filter, Sort, Search next to + */}
                    <div className="flex items-center gap-2 ml-2 flex-1" ref={dropdownRef}>
                        {/* Filter */}
                        {displayMode !== 'gallery' && (
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'filter' ? null : 'filter')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${boardSettings.tempFilter.length > 0 ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-200/50'}`}
                                >
                                    <i className="fa-solid fa-filter"></i>
                                    Filter
                                    {boardSettings.tempFilter.length > 0 && <span className="bg-indigo-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{boardSettings.tempFilter.length}</span>}
                                </button>

                                {activeDropdown === 'filter' && (
                                    <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-[70] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Filter Temperature</label>
                                        <div className="space-y-1">
                                            {[
                                                { id: 'Hot', icon: 'fa-fire', color: 'text-orange-500', bg: 'hover:bg-orange-50' },
                                                { id: 'Warm', icon: 'fa-mug-hot', color: 'text-amber-500', bg: 'hover:bg-amber-50' },
                                                { id: 'Cold', icon: 'fa-snowflake', color: 'text-sky-300', bg: 'hover:bg-sky-50' },
                                                { id: 'Stale', icon: 'fa-ghost', color: 'text-slate-400', bg: 'hover:bg-slate-50' }
                                            ].map(opt => {
                                                const isActive = boardSettings.tempFilter.includes(opt.id);
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => {
                                                            const newFilter = isActive
                                                                ? boardSettings.tempFilter.filter(f => f !== opt.id)
                                                                : [...boardSettings.tempFilter, opt.id];
                                                            setBoardSettings({ ...boardSettings, tempFilter: newFilter });
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-indigo-600 text-white' : `text-slate-600 ${opt.bg}`}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <i className={`fa-solid ${opt.icon} ${isActive ? 'text-white' : opt.color}`}></i>
                                                            {opt.id}
                                                        </div>
                                                        {isActive && <i className="fa-solid fa-check text-[10px]"></i>}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {boardSettings.tempFilter.length > 0 && (
                                            <button
                                                onClick={() => setBoardSettings({ ...boardSettings, tempFilter: [] })}
                                                className="w-full mt-3 pt-3 border-t border-slate-100 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 font-sans"
                                            >
                                                Clear Filters
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sort */}
                        {displayMode !== 'gallery' && (
                            <div className="relative">
                                <button
                                    onClick={() => setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${boardSettings.sort !== 'newest' ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-200/50'}`}
                                >
                                    <i className="fa-solid fa-arrow-up-down-z-a"></i>
                                    Sort
                                </button>

                                {activeDropdown === 'sort' && (
                                    <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-[70] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Sort By</label>
                                        <div className="space-y-1">
                                            {[
                                                { id: 'newest', label: 'Newest First', icon: 'fa-calendar-plus' },
                                                { id: 'oldest', label: 'Oldest First', icon: 'fa-calendar-minus' },
                                                { id: 'name', label: 'Name (A-Z)', icon: 'fa-arrow-down-a-z' },
                                                { id: 'temp', label: 'Temperature', icon: 'fa-fire' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => {
                                                        setBoardSettings({ ...boardSettings, sort: opt.id as any });
                                                        setActiveDropdown(null);
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${boardSettings.sort === opt.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <i className={`fa-solid ${opt.icon} ${boardSettings.sort === opt.id ? 'text-white' : 'text-slate-400'}`}></i>
                                                        {opt.label}
                                                    </div>
                                                    {boardSettings.sort === opt.id && <i className="fa-solid fa-check text-[10px]"></i>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Global Search */}
                        <div className="relative ml-4 max-w-sm flex-1">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                            <input
                                type="text"
                                value={boardSettings.search}
                                onChange={(e) => setBoardSettings({ ...boardSettings, search: e.target.value })}
                                placeholder="Search by name, property, or email..."
                                className="w-full pl-9 pr-8 py-1.5 bg-slate-200/50 border-none rounded-xl text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                            />
                            {boardSettings.search && (
                                <button
                                    onClick={() => setBoardSettings({ ...boardSettings, search: '' })}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 p-1"
                                >
                                    <i className="fa-solid fa-circle-xmark text-xs"></i>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* View Toggles */}
                {!isMobile && (
                    <div className="flex bg-slate-200/50 p-1 rounded-2xl items-center">
                        <button
                            onClick={() => setDisplayMode('kanban')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${displayMode === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-columns"></i>
                            Kanban
                        </button>
                        <button
                            onClick={() => setDisplayMode('gallery')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${displayMode === 'gallery' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-table-cells-large"></i>
                            Gallery
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadsHeader;
