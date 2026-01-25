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
    showFilters: boolean;
    setShowFilters: (show: boolean) => void;
    displayMode: 'gallery' | 'kanban';
    setDisplayMode: (mode: 'gallery' | 'kanban') => void;
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
    showFilters,
    setShowFilters,
    displayMode,
    setDisplayMode,
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

                <div className="flex items-center gap-4">
                    {/* Post-it Palette */}
                    {displayMode === 'gallery' && (
                        <div className="border-r border-slate-100 pr-4">
                            <PostItPalette type={activeTab.toLowerCase() as any} />
                        </div>
                    )}

                    {/* Archive Button */}
                    <div className="flex items-center gap-3">
                        <button
                            className={`px-4 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${selectedCount > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100 shadow-sm border border-red-100' : 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-100'}`}
                            onClick={onArchive}
                            disabled={selectedCount === 0}
                        >
                            <i className="fa-solid fa-box-archive"></i>
                            Archive {selectedCount > 0 && `(${selectedCount})`}
                        </button>
                    </div>

                    {/* Filter Button */}
                    {displayMode !== 'gallery' && (
                        <div className="flex items-center gap-1 text-slate-400">
                            <button
                                className={`w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors ${showFilters ? 'bg-slate-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setShowFilters(!showFilters)}
                                title="Filter Funnel"
                            >
                                <i className="fa-solid fa-filter text-lg"></i>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions Bar - Date Filters */}
            {(activeFunnelCategory === 'Leads') && (
                <div className="flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-4">
                        {/* Date Filters */}
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
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadsViewControls;
