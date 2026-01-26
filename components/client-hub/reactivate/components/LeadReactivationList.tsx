import React, { useState } from 'react';

interface Lead {
    id: string;
    leadType?: 'Seller' | 'Buyer';
    fullName?: string;
    firstName?: string;
    lastName?: string;
    searchCriteria?: { locations?: string };
    source?: string;
    engagementScore?: string;
    health?: string;
    leadInfo?: { customerMessage?: string };
    notes?: string;
    lastActivity?: string; // Timestamp or date string
    receivedAt?: string;   // Timestamp or date string
    [key: string]: any;
}

interface LeadReactivationListProps {
    leads: Lead[];
    selectedLeads: Set<string> | string[];
    onToggleSelection: (id: string) => void;
    onToggleAll: () => void;
    onLeadClick?: (lead: Lead) => void;
    onStatusChange?: (id: string, status: string) => void;
    renderActionColumn?: (lead: Lead) => React.ReactNode;
    renderNameSubtext?: (lead: Lead) => React.ReactNode;
    pagination?: {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    };
    actionHeaderLabel?: string;
    sortConfig?: { key: string; direction: 'asc' | 'desc' };
    onSort?: (key: string) => void;
    maxHeight?: string;
    variant?: 'card' | 'flat';
    mode?: 'view' | 'action';
}

const getTimeSince = (dateInput: string | number | Date) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
};

export const LeadReactivationList: React.FC<LeadReactivationListProps> = ({
    leads,
    selectedLeads,
    onToggleSelection,
    onToggleAll,
    onLeadClick,
    onStatusChange,
    renderActionColumn,
    renderNameSubtext,
    pagination,
    actionHeaderLabel = "Action",
    sortConfig,
    onSort,
    maxHeight,
    variant = 'card',
    mode = 'view'
}) => {
    const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);

    const isSelected = (id: string) => {
        if (Array.isArray(selectedLeads)) {
            return selectedLeads.includes(id);
        }
        return selectedLeads.has(id);
    };

    const isAllSelected = leads.length > 0 && leads.every(l => isSelected(l.id));

    const renderHeader = (id: string, label: string, widthClass: string, alignClass: string = 'justify-start') => {
        if (!onSort || !sortConfig) {
            return <div className={`${widthClass} ${alignClass} flex items-center`}>{label}</div>;
        }

        return (
            <button
                onClick={() => onSort(id)}
                className={`${widthClass} flex items-center ${alignClass} group/head transition-colors hover:text-slate-900`}
            >
                {label}
                <i className={`fa-solid fa-chevron-${sortConfig.key === id && sortConfig.direction === 'asc' ? 'up' : 'down'} ml-1.5 text-[8px] transition-all ${sortConfig.key === id ? 'text-indigo-500 opacity-100' : 'text-slate-200 opacity-0 group-hover/head:opacity-100'}`}></i>
            </button>
        );
    };

    // Widths based on mode
    const widthMarket = 'w-[15%]';
    const widthNote = mode === 'action' ? 'w-[42%]' : 'w-[36%]';
    const widthAction = mode === 'action' ? 'w-[6%]' : 'w-[12%]';

    return (
        <div className={`flex flex-col ${variant === 'card' ? 'bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden' : ''}`}>
            {/* Headers */}
            <div className="flex items-center px-8 py-3 border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="w-[3%] flex items-center">
                    <div
                        onClick={onToggleAll}
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${isAllSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white hover:border-indigo-400'}`}
                    >
                        {isAllSelected && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                    </div>
                </div>
                {renderHeader('type', 'Type', 'w-[4%]', 'justify-center')}
                {renderHeader('name', 'Lead Name', 'w-[18%] px-4')}
                {renderHeader('market', 'Target Market', `${widthMarket} px-4`)}
                {renderHeader('source', 'Source', 'w-[7%] px-2')}
                {renderHeader('status', 'Status', 'w-[5%]', 'justify-center')}
                <div className={`${widthNote} px-4`}>Staff Note</div>
                <div className={`${widthAction} text-right ${mode === 'action' ? 'pr-2' : 'pr-4'} shrink-0 flex justify-end`}>
                    {onSort && sortConfig && actionHeaderLabel === "Last Seen" ? (
                        <button
                            onClick={() => onSort('lastSeen')}
                            className="flex items-center justify-end group/head transition-colors hover:text-slate-900"
                        >
                            {actionHeaderLabel}
                            <i className={`fa-solid fa-chevron-${sortConfig.key === 'lastSeen' && sortConfig.direction === 'asc' ? 'up' : 'down'} ml-1.5 text-[8px] transition-all ${sortConfig.key === 'lastSeen' ? 'text-indigo-500 opacity-100' : 'text-slate-200 opacity-0 group-hover/head:opacity-100'}`}></i>
                        </button>
                    ) : (
                        actionHeaderLabel
                    )}
                </div>
            </div>

            {/* Rows */}
            <div
                className={`divide-y divide-slate-50 ${maxHeight ? 'overflow-y-auto custom-scrollbar' : ''}`}
                style={maxHeight ? { maxHeight } : undefined}
            >
                {leads.map((lead) => {
                    const selected = isSelected(lead.id);
                    return (
                        <div
                            key={lead.id}
                            onClick={() => onLeadClick && onLeadClick(lead)}
                            onDoubleClick={() => onLeadClick && onLeadClick(lead)}
                            className={`flex items-center px-8 py-2.5 transition-all cursor-default group border-b border-slate-50/50 relative overflow-hidden ${selected ? 'bg-indigo-50/30' : 'hover:bg-indigo-50/30'}`}
                        >
                            {/* SELECTION COLUMN */}
                            <div className="w-[3%] flex items-center relative z-10" onClick={(e) => e.stopPropagation()}>
                                <div
                                    onClick={() => onToggleSelection(lead.id)}
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 hover:border-indigo-400 bg-white'}`}
                                >
                                    {selected && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                                </div>
                            </div>

                            {/* ROLE COLUMN */}
                            <div className="w-[4%] flex justify-center">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border shadow-sm ${lead.leadType === 'Seller' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                    {lead.leadType === 'Seller' ? 'S' : 'B'}
                                </div>
                            </div>

                            {/* NAME COLUMN */}
                            <div className="w-[18%] flex items-center px-4 gap-2">
                                <div className="flex flex-col overflow-hidden">
                                    <p className="text-[12px] font-black text-slate-800 truncate tracking-tight group-hover:text-indigo-600 transition-colors uppercase leading-tight">
                                        {lead.fullName || `${lead.firstName} ${lead.lastName}`}
                                    </p>
                                    {renderNameSubtext && renderNameSubtext(lead)}
                                </div>
                                <div className="group/info relative cursor-help" onClick={(e) => e.stopPropagation()}>
                                    <i className="fa-solid fa-circle-info text-slate-300 hover:text-indigo-400 transition-colors text-sm"></i>
                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded-md opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all whitespace-nowrap z-50 pointer-events-none shadow-xl">
                                        Double-click for details
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 border-4 border-transparent border-r-slate-800"></div>
                                    </div>
                                </div>
                            </div>

                            {/* TARGET MARKET COLUMN */}
                            <div className={`${widthMarket} flex items-center px-4`}>
                                <p className="text-[12px] font-bold text-slate-500 truncate">{lead.searchCriteria?.locations || 'Unknown Market'}</p>
                            </div>

                            {/* COMPANY/SOURCE COLUMN */}
                            <div className="w-[7%] flex items-center px-2">
                                <p className="text-[12px] font-bold text-slate-400 truncate">{lead.source || 'Direct Entry'}</p>
                            </div>

                            {/* STATUS COLUMN */}
                            <div className="w-[5%] flex justify-center relative">
                                {onStatusChange ? (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setStatusMenuOpen(statusMenuOpen === lead.id ? null : lead.id);
                                            }}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-sm border ${lead.engagementScore === 'Hot' ? 'bg-rose-50 text-rose-500 border-rose-100' : lead.engagementScore === 'Cold' ? 'bg-sky-50 text-sky-500 border-sky-100' : lead.health === 'Stale' ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-500 border-indigo-100'}`}
                                        >
                                            {lead.engagementScore === 'Hot' && <i className="fa-solid fa-fire text-xs text-rose-500"></i>}
                                            {lead.engagementScore === 'Cold' && <i className="fa-solid fa-snowflake text-xs text-sky-400"></i>}
                                            {lead.health === 'Stale' && lead.engagementScore !== 'Hot' && lead.engagementScore !== 'Cold' && <i className="fa-solid fa-clock-rotate-left text-xs text-slate-400"></i>}
                                            {!['Hot', 'Cold', 'Stale'].includes(lead.engagementScore || lead.health || '') && <i className="fa-solid fa-circle-dot text-[8px] text-indigo-300"></i>}
                                        </button>

                                        {statusMenuOpen === lead.id && (
                                            <div className="absolute top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border border-slate-100 p-2 min-w-[120px] animate-in fade-in zoom-in-95 duration-200">
                                                {[
                                                    { id: 'Hot', icon: 'fa-fire', label: 'Hot', color: 'text-rose-500', bg: 'hover:bg-rose-50' },
                                                    { id: 'Cold', icon: 'fa-snowflake', label: 'Cold', color: 'text-sky-500', bg: 'hover:bg-sky-50' },
                                                    { id: 'Stale', icon: 'fa-clock-rotate-left', label: 'Stale', color: 'text-slate-400', bg: 'hover:bg-slate-50' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onStatusChange(lead.id, opt.id);
                                                            setStatusMenuOpen(null);
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-tight transition-colors ${opt.bg} ${opt.color}`}
                                                    >
                                                        <i className={`fa-solid ${opt.icon} w-4`}></i>
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm border ${lead.engagementScore === 'Hot' ? 'bg-rose-50 text-rose-500 border-rose-100' : lead.engagementScore === 'Cold' ? 'bg-sky-50 text-sky-500 border-sky-100' : lead.health === 'Stale' ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-500 border-indigo-100'}`}>
                                        {lead.engagementScore === 'Hot' && <i className="fa-solid fa-fire text-xs text-rose-500"></i>}
                                        {lead.engagementScore === 'Cold' && <i className="fa-solid fa-snowflake text-xs text-sky-400"></i>}
                                        {lead.health === 'Stale' && lead.engagementScore !== 'Hot' && lead.engagementScore !== 'Cold' && <i className="fa-solid fa-clock-rotate-left text-xs text-slate-400"></i>}
                                        {!['Hot', 'Cold', 'Stale'].includes(lead.engagementScore || lead.health || '') && <i className="fa-solid fa-circle-dot text-[8px] text-indigo-300"></i>}
                                    </div>
                                )}
                            </div>

                            {/* STAFF NOTE COLUMN */}
                            <div className={`${widthNote} flex items-center px-4 py-1`}>
                                <p className="text-[11px] font-medium text-slate-400 italic pr-6 border-l border-slate-50 pl-4 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                                    {lead.leadInfo?.customerMessage || lead.notes || 'No active notes'}
                                </p>
                            </div>

                            {/* ACTION COLUMN */}
                            <div className={`${widthAction} flex items-center justify-end ${mode === 'action' ? 'pl-2 pr-2' : 'pl-4 pr-8'} shrink-0`}>
                                {renderActionColumn ? renderActionColumn(lead) : (
                                    <p className="text-[12px] font-bold text-slate-400 whitespace-nowrap">
                                        {lead.lastUpdated ? getTimeSince(lead.lastUpdated) : (lead.receivedAt ? getTimeSince(lead.receivedAt) : 'Long ago')}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Page {pagination.currentPage} of {pagination.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); pagination.onPageChange(Math.max(1, pagination.currentPage - 1)); }}
                            disabled={pagination.currentPage === 1}
                            className="w-10 h-10 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); pagination.onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1)); }}
                            disabled={pagination.currentPage === pagination.totalPages}
                            className="w-10 h-10 rounded-xl border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
