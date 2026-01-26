import React from 'react';
import { Lead } from '../../../../types';
import { getTimeSince } from '../shared';

interface LeadListTableProps {
    leads: Lead[];
    selectedLeadIds: Set<string> | string[];
    onToggleSelectAll: () => void;
    onToggleSelectOne: (id: string) => void;
    onLeadClick?: (lead: Lead) => void;
    renderStatus: (lead: Lead) => React.ReactNode;
    renderActions: (lead: Lead) => React.ReactNode;
    actionColumnWidth?: string;
    noteColumnWidth?: string;
    marketColumnWidth?: string;
}

const LeadListTable: React.FC<LeadListTableProps> = ({
    leads,
    selectedLeadIds,
    onToggleSelectAll,
    onToggleSelectOne,
    onLeadClick,
    renderStatus,
    renderActions,
    actionColumnWidth = 'w-[12%]',
    noteColumnWidth = 'w-[36%]',
    marketColumnWidth = 'w-[15%]'
}) => {
    // Helper to check selection
    const isSelected = (id: string) => {
        if (Array.isArray(selectedLeadIds)) return selectedLeadIds.includes(id);
        return selectedLeadIds.has(id);
    };

    const allSelected = leads.length > 0 && (Array.isArray(selectedLeadIds) ? selectedLeadIds.length === leads.length : selectedLeadIds.size === leads.length);

    return (
        <div className="flex flex-col">
            {/* Headers */}
            <div className="flex items-center px-8 py-3 border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <div className="w-[3%] flex items-center">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={onToggleSelectAll}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                </div>
                <div className="w-[4%] text-center">Type</div>
                <div className="w-[18%] px-4">Lead Name</div>
                <div className={`${marketColumnWidth} px-4`}>Target Market</div>
                <div className="w-[7%] px-2">Source</div>
                <div className="w-[5%] text-center">Status</div>
                <div className={`${noteColumnWidth} px-4`}>Staff Note</div>
                <div className={`${actionColumnWidth} text-right pr-4`}>{actionColumnWidth === 'w-[12%]' ? 'Last Seen' : 'Action'}</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50">
                {leads.map((lead) => {
                    const selected = isSelected(lead.id);
                    return (
                        <div
                            key={lead.id}
                            className={`flex items-center px-8 py-2.5 hover:bg-indigo-50/30 transition-all cursor-default group border-b border-slate-50/50 relative overflow-hidden ${selected ? 'bg-indigo-50/30' : ''}`}
                            onDoubleClick={() => onLeadClick && onLeadClick(lead)}
                        >
                            {/* Checkbox */}
                            <div className="w-[3%] flex items-center relative z-10" onClick={(e) => e.stopPropagation()}>
                                <div
                                    onClick={() => onToggleSelectOne(lead.id)}
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 cursor-pointer ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 hover:border-indigo-400'}`}
                                >
                                    {selected ? (
                                        <i className="fa-solid fa-check text-[10px] text-white"></i>
                                    ) : (
                                        <input
                                            type="checkbox"
                                            checked={selected}
                                            readOnly
                                            className="opacity-0 w-full h-full cursor-pointer"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Type */}
                            <div className="w-[4%] flex justify-center">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border shadow-sm ${lead.leadType === 'Seller' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                    {lead.leadType === 'Seller' ? 'S' : 'B'}
                                </div>
                            </div>

                            {/* Name */}
                            <div className="w-[18%] flex items-center px-4 gap-2">
                                <p className="text-[12px] font-black text-slate-800 truncate tracking-tight group-hover:text-indigo-600 transition-colors uppercase leading-tight">
                                    {lead.fullName || `${lead.firstName} ${lead.lastName}`}
                                </p>
                                <div className="group/info relative cursor-help">
                                    <i className="fa-solid fa-circle-info text-slate-300 hover:text-indigo-400 transition-colors text-sm"></i>
                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-800 text-white text-[9px] font-bold px-2 py-1 rounded-md opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all whitespace-nowrap z-50 pointer-events-none shadow-xl">
                                        Double-click for details
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-1 border-4 border-transparent border-r-slate-800"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Target Market */}
                            <div className={`${marketColumnWidth} flex items-center px-4`}>
                                <p className="text-[12px] font-bold text-slate-500 truncate">
                                    {lead.searchCriteria?.locations || ''}
                                </p>
                            </div>

                            {/* Source */}
                            <div className="w-[7%] flex items-center px-2">
                                <p className="text-[12px] font-bold text-slate-400 truncate">
                                    {lead.source || 'Direct Entry'}
                                </p>
                            </div>

                            {/* Status */}
                            <div className="w-[5%] flex justify-center relative">
                                {renderStatus(lead)}
                            </div>

                            {/* Staff Note */}
                            <div className={`${noteColumnWidth} flex items-center px-4 py-1`}>
                                <p className="text-[11px] font-medium text-slate-400 italic pr-6 border-l border-slate-50 pl-4 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all">
                                    {lead.leadInfo?.customerMessage || lead.notes || 'No active notes'}
                                </p>
                            </div>

                            {/* Action / Last Seen */}
                            <div className={`${actionColumnWidth} flex items-center justify-end pr-4 shrink-0`}>
                                {renderActions(lead)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LeadListTable;
