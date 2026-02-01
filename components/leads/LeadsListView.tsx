import React from 'react';
import { Lead } from '../../types';

interface LeadsListViewProps {
    leads: Lead[];
    onActivateLead: (lead: Lead) => void;
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
}

const LeadsListView: React.FC<LeadsListViewProps> = ({ leads, onActivateLead, onUpdateLead }) => {
    const getDate = (val: any) => {
        if (!val) return null;
        if (val.toDate && typeof val.toDate === 'function') return val.toDate();
        if (val instanceof Date) return val;
        return new Date(val);
    };

    return (
        <div className="flex-1 bg-white overflow-hidden flex flex-col h-full border-t border-slate-100">
            <div className="overflow-auto custom-scrollbar flex-1">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 z-20 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Name</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Contact</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Temp</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Property</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Motivation</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Since</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {leads.map((lead) => {
                            const receivedDate = getDate(lead.leadInfo?.createdDate) || getDate(lead.receivedAt);

                            return (
                                <tr
                                    key={lead.id}
                                    onClick={() => onActivateLead(lead)}
                                    className="group hover:bg-indigo-50/30 transition-all cursor-pointer"
                                >
                                    {/* Name & Avatar */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex-shrink-0 border border-slate-200 overflow-hidden flex items-center justify-center">
                                                {lead.clientPhotoUrl ? (
                                                    <img src={lead.clientPhotoUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-indigo-400/60 font-black text-xs uppercase">
                                                        {lead.firstName?.charAt(0) || ''}{lead.lastName?.charAt(0) || ''}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors truncate">
                                                    {lead.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown'}
                                                </span>
                                                {lead.source && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                                                        {lead.source}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Contact */}
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-0.5 text-xs">
                                            {lead.email && (
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <i className="fa-solid fa-envelope opacity-30 text-[9px]"></i>
                                                    <span className="truncate max-w-[180px]">{lead.email}</span>
                                                </div>
                                            )}
                                            {lead.phone && (
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <i className="fa-solid fa-phone opacity-30 text-[9px]"></i>
                                                    <span>{lead.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Temperature */}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center">
                                            {lead.engagementScore === 'Hot' && (
                                                <i className="fa-solid fa-fire text-orange-500 text-lg animate-pulse" title="Hot"></i>
                                            )}
                                            {lead.engagementScore === 'Warm' && (
                                                <i className="fa-solid fa-mug-hot text-amber-500 text-lg" title="Warm"></i>
                                            )}
                                            {lead.engagementScore === 'Cold' && (
                                                <i className="fa-solid fa-snowflake text-sky-300 text-lg" title="Cold"></i>
                                            )}
                                            {lead.engagementScore === 'Stale' && (
                                                <i className="fa-solid fa-ghost text-slate-300 text-lg" title="Stale"></i>
                                            )}
                                            {!lead.engagementScore && (
                                                <span className="text-slate-200">-</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${(lead.status || '').includes('New') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                (lead.status || '').includes('Attempted') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    (lead.status || '').includes('Unresponsive') ? 'bg-red-50 text-red-600 border-red-100' :
                                                        'bg-indigo-50 text-indigo-600 border-indigo-100'
                                            }`}>
                                            {lead.status || 'New'}
                                        </span>
                                    </td>

                                    {/* Property */}
                                    <td className="px-6 py-4">
                                        <div className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={lead.propertyAddress || lead.leadInfo?.inquiryProperty?.address || lead.subjectProperty}>
                                            {lead.propertyAddress || lead.leadInfo?.inquiryProperty?.address || lead.subjectProperty || <span className="text-slate-200 text-[10px] font-normal">No property</span>}
                                        </div>
                                    </td>

                                    {/* Motivation */}
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-600 truncate max-w-[150px]" title={lead.motivation}>
                                            {lead.motivation || <span className="text-slate-200 text-[10px] italic">Not specified</span>}
                                        </div>
                                    </td>

                                    {/* Since */}
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-400 font-bold whitespace-nowrap">
                                            {receivedDate ? receivedDate.toLocaleDateString() : '--'}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {leads.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 text-2xl">
                            <i className="fa-solid fa-users-slash"></i>
                        </div>
                        <div className="text-slate-400 font-medium">No leads found in this view</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadsListView;
