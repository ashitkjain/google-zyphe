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
                    <div className="inline-flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
                        {[
                            { id: 'Leads', label: 'Leads', icon: 'fa-users-line' },
                            { id: 'Nurture', label: 'Nurture', icon: 'fa-seedling' },
                            { id: 'Active Search', label: 'Active Search', icon: 'fa-magnifying-glass-location' },
                            { id: 'Offer', label: 'Offer', icon: 'fa-handshake' },
                            { id: 'Contract', label: 'Closing', icon: 'fa-flag-checkered' },
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => onFunnelCategoryChange(cat.id as any)}
                                className={`flex items-center gap-3 px-6 py-3 rounded-xl font-black transition-all text-[12px] uppercase tracking-widest whitespace-nowrap ${activeFunnelCategory === cat.id ? 'bg-gradient-to-r from-indigo-700 to-gray-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                            >
                                <i className={`fa-solid ${cat.icon} ${activeFunnelCategory === cat.id ? 'text-white' : 'text-slate-300'}`}></i>
                                {cat.label}
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
