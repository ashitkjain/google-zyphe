import React from 'react';
import { FunnelStage } from '../../types';
import PostItPalette from './PostItPalette';

interface LeadsViewControlsProps {
    activeTab: 'Buyer' | 'Seller';
    activeFunnelCategory: FunnelStage;
    onFunnelCategoryChange: (cat: FunnelStage) => void;
    selectedCount: number;
    onArchive: () => void;
    showFilters: boolean;
    setShowFilters: (show: boolean) => void;
    displayMode: 'gallery' | 'kanban' | 'list';
    setDisplayMode: (mode: 'gallery' | 'kanban' | 'list') => void;
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
    onTabChange
}) => {
    return (
        <div className="flex flex-col gap-4 mb-4 border-b border-slate-100 pb-3">
            {/* Primary Navigation Row */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {/* Sub-Category Selector */}
                    <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/60 shadow-sm">
                        {['Leads', 'Nurture', 'Active Search', 'Offer', 'Contract'].map((cat) => (
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
                        <div className="pr-4">
                            <PostItPalette type={activeTab.toLowerCase() as any} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadsViewControls;
