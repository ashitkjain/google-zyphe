import React from 'react';
import { FunnelStage } from '../../types';
import PostItPalette from './PostItPalette';

interface LeadsViewControlsProps {
    activeTab: 'Buyer' | 'Seller';
    activeFunnelCategory: FunnelStage | 'Closed & Archived';
    onFunnelCategoryChange: (cat: FunnelStage | 'Closed & Archived') => void;
    viewMode: 'past6Months' | 'older';
    onViewModeChange: (mode: 'past6Months' | 'older') => void;
    timeStats: { past6Months: number; older: number };
    dateRangeLabels: { past6Months: string; older: string };
    selectedCount: number;
    onArchive: () => void;
    showColumnSelector: boolean;
    setShowColumnSelector: (show: boolean) => void;
    showFilters: boolean;
    setShowFilters: (show: boolean) => void;
    displayMode: 'list' | 'gallery';
    setDisplayMode: (mode: 'list' | 'gallery') => void;
    columnSelectorRef: React.RefObject<HTMLDivElement>;
    availableColumns: { id: string; label: string }[];
    visibleColumns: Set<string>;
    onToggleColumn: (colId: string) => void;
    onTabChange?: (tab: any) => void;
}

const LeadsViewControls: React.FC<LeadsViewControlsProps> = ({
    activeTab,
    activeFunnelCategory,
    onFunnelCategoryChange,
    viewMode,
    onViewModeChange,
    timeStats,
    dateRangeLabels,
    selectedCount,
    onArchive,
    showColumnSelector,
    setShowColumnSelector,
    showFilters,
    setShowFilters,
    displayMode,
    setDisplayMode,
    columnSelectorRef,
    availableColumns,
    visibleColumns,
    onToggleColumn,
    onTabChange
}) => {
    return (
        <div className="flex flex-col gap-4 mb-4 border-b border-slate-100 pb-3">
            {/* Primary Navigation Row */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {/* Sub-Category Selector */}
                    <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/60 shadow-sm">
                        {['Leads', 'Nurture', 'Active Search', 'Offer', 'Contract', 'Closed & Archived'].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => onFunnelCategoryChange(cat as any)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeFunnelCategory === cat ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {cat === 'Contract' ? 'Closing' : cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Actions & Filters Bar */}
            <div className="flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-4">
                    {/* Date Filters */}
                    {activeFunnelCategory === 'Leads' && (
                        <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden">
                            {[
                                { id: 'past6Months', label: 'Past 6 Months', subtitle: dateRangeLabels.past6Months, count: timeStats.past6Months },
                                { id: 'older', label: 'Older', subtitle: dateRangeLabels.older, count: timeStats.older }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => onViewModeChange(tab.id as any)}
                                    className={`px-4 py-1.5 rounded-xl transition-all duration-300 relative z-10 flex flex-col items-center min-w-[100px] ${viewMode === tab.id ? (activeTab === 'Buyer' ? 'text-indigo-600' : 'text-emerald-600') + ' bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <div className="text-[10px] font-semibold uppercase tracking-widest leading-tight">
                                        {tab.label} {tab.count > 0 && `(${tab.count})`}
                                    </div>
                                    <div className="text-[7px] font-bold opacity-60 uppercase tracking-tighter mt-0.5 whitespace-nowrap">
                                        {tab.subtitle}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Archive Button */}
                    <div className="flex flex-col items-center justify-center gap-1 border-l border-slate-100 pl-4">
                        <button
                            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all min-h-[42px] ${selectedCount > 0 ? 'bg-red-50 text-black hover:bg-red-100 shadow-sm' : 'bg-slate-50 text-black cursor-not-allowed border border-slate-100'}`}
                            onClick={onArchive}
                            disabled={selectedCount === 0}
                        >
                            <i className="fa-solid fa-box-archive"></i>
                            Archive {selectedCount > 0 && `(${selectedCount})`}
                        </button>
                        <div className="text-[9px] text-slate-400 font-medium text-center">
                            Select the checkbox to archive selected leads
                        </div>
                    </div>

                    {/* Post-it Palette */}
                    {displayMode === 'gallery' && (
                        <PostItPalette type={activeTab.toLowerCase() as any} />
                    )}
                </div>

                {/* View Mode Toggle - Far Right */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-slate-400">
                        <div className="relative" ref={columnSelectorRef}>
                            <button
                                className={`w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors ${showColumnSelector ? 'bg-slate-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setShowColumnSelector(!showColumnSelector)}
                                title="Select Columns"
                            >
                                <i className="fa-solid fa-table-columns text-lg"></i>
                            </button>
                            {showColumnSelector && (
                                <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-64 z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visible Columns</div>
                                        <button onClick={() => setShowColumnSelector(false)} className="text-slate-400 hover:text-slate-600">
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto mb-3">
                                        {availableColumns.map(col => (
                                            <label key={col.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleColumns.has(col.id)}
                                                    onChange={() => onToggleColumn(col.id)}
                                                    className={`rounded border-slate-300 ${activeTab === 'Buyer' ? 'text-indigo-600 focus:ring-indigo-500' : 'text-emerald-600 focus:ring-emerald-500'}`}
                                                />
                                                <span className="truncate">{col.id === 'receivedAt' ? `Time in ${activeFunnelCategory}` : col.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="pt-2 border-t border-slate-100 mt-2">
                                        <button
                                            onClick={() => {
                                                setShowColumnSelector(false);
                                                onTabChange?.('settings:properties');
                                            }}
                                            className="w-full py-2 bg-slate-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <i className="fa-solid fa-sliders"></i>
                                            Configure Fields
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            className={`w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors ${showFilters ? 'bg-slate-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setShowFilters(!showFilters)}
                            title="Filter Funnel"
                        >
                            <i className="fa-solid fa-filter text-lg"></i>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default LeadsViewControls;
