import React from 'react';
import { FunnelStage } from '../../types';
import PostItPalette from './PostItPalette';

interface LeadsViewControlsProps {
    activeTab: 'Buyer' | 'Seller';
    activeFunnelCategory: FunnelStage | 'Closed & Archived';
    onFunnelCategoryChange: (cat: FunnelStage | 'Closed & Archived') => void;
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {/* Sub-Category Selector */}
                    <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/60 shadow-sm overflow-x-auto max-w-[calc(100vw-2rem)] md:max-w-none no-scrollbar">
                        {['Leads', 'Nurture', 'Active Search', 'Offer', 'Contract', 'Closed & Archived'].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => onFunnelCategoryChange(cat as any)}
                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${activeFunnelCategory === cat ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                    {displayMode !== 'gallery' && (
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
                    )}

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
        </div>
    );
};

export default LeadsViewControls;
