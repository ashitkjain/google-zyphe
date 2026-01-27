import React, { useState, useEffect, useMemo } from 'react';
import { getReactivationMessages } from '../../../services/firebase/communications';
import { getAllUserLeadPlans } from '../../../services/firebase/reactivation';
import { Lead } from '../../../types';
import { LeadPlanRecord } from '../../../types/ai';

interface TrailModuleProps {
    realtorId: string;
    leads: Lead[];
}

const TrailModule: React.FC<TrailModuleProps> = ({ realtorId, leads }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [plans, setPlans] = useState<LeadPlanRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter & Sort State
    const [filters, setFilters] = useState({
        timestamp: '',
        lead: '',
        type: 'ALL',
        channel: 'ALL',
        content: ''
    });
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [msgs, p] = await Promise.all([
                    getReactivationMessages(realtorId),
                    getAllUserLeadPlans(realtorId)
                ]);
                setMessages(msgs);
                setPlans(p);
            } catch (err) {
                console.error("Failed to fetch trail data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [realtorId]);

    // Reset page when filters/sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, sortConfig]);

    const formatTimestamp = (ts: any) => {
        if (!ts) return '--';
        try {
            const date = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts.seconds ? ts.seconds * 1000 : ts));
            if (isNaN(date.getTime())) return '--';
            return date.toLocaleString();
        } catch (e) {
            return '--';
        }
    };

    const getTypeBadgeColor = (isInbound: boolean, isRecommendation: boolean) => {
        if (isRecommendation) return 'bg-indigo-100 text-indigo-600 border-indigo-200';
        if (isInbound) return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        return 'bg-slate-100 text-slate-600 border-slate-200';
    };

    const getChannelBadgeColor = (channel: string) => {
        switch (channel?.toLowerCase()) {
            case 'email': return 'bg-blue-50 text-blue-600';
            case 'sms': return 'bg-emerald-50 text-emerald-600';
            case 'call': return 'bg-orange-50 text-orange-600';
            case 'whatsapp': return 'bg-green-50 text-green-600';
            default: return 'bg-slate-50 text-slate-600';
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const feedItems = useMemo(() => {
        const items = [...messages].map(m => ({ ...m, itemType: 'message' }));
        const now = new Date();

        // Detect follow-up due per lead
        plans.forEach(plan => {
            const leadMsgs = messages.filter(m => m.lead_id === plan.lead_id);
            const outboundMsgs = leadMsgs.filter(m => !m.isInbound);

            if (outboundMsgs.length > 0) {
                const day1Msg = outboundMsgs.reduce((oldest: any, curr: any) => {
                    const timeCurr = curr.sent_at?.toDate ? curr.sent_at.toDate().getTime() : new Date(curr.sent_at).getTime();
                    const timeOldest = oldest ? (oldest.sent_at?.toDate ? oldest.sent_at.toDate().getTime() : new Date(oldest.sent_at).getTime()) : Infinity;
                    return timeCurr < timeOldest ? curr : oldest;
                }, null);

                const day1SentDate = day1Msg.sent_at?.toDate ? day1Msg.sent_at.toDate() : new Date(day1Msg.sent_at);

                plan.sequence.steps.forEach((step, idx) => {
                    const dueDate = new Date(day1SentDate);
                    dueDate.setDate(dueDate.getDate() + step.day_offset);

                    if (now > dueDate && outboundMsgs.length <= idx + 1) {
                        items.push({
                            id: `feed-followup-${plan.lead_id}-${step.day_offset}`,
                            itemType: 'recommendation',
                            lead_id: plan.lead_id,
                            channel: step.channel,
                            content: step.message,
                            sent_at: dueDate,
                            day_offset: step.day_offset
                        } as any);
                    }
                });
            }
        });

        return items;
    }, [messages, plans]);

    const processItems = (data: any[], currentFilters: typeof filters, sort: typeof sortConfig) => {
        let result = [...data];

        // Filter
        result = result.filter(item => {
            const lead = leads.find(l => l.id === item.lead_id);
            const leadName = lead ? `${lead.firstName} ${lead.lastName}`.toLowerCase() : '';
            const isRecommendation = item.itemType === 'recommendation';
            const isInbound = item.reply_received || item.isInbound;

            if (currentFilters.timestamp) {
                const tsStr = formatTimestamp(item.sent_at).toLowerCase();
                if (!tsStr.includes(currentFilters.timestamp.toLowerCase())) return false;
            }
            if (currentFilters.lead) {
                if (!leadName.includes(currentFilters.lead.toLowerCase())) return false;
            }
            if (currentFilters.type !== 'ALL') {
                if (currentFilters.type === 'SENT' && (isInbound || isRecommendation)) return false;
                if (currentFilters.type === 'RECEIVED' && !isInbound) return false;
                if (currentFilters.type === 'RECOMMENDED' && !isRecommendation) return false;
            }
            if (currentFilters.channel !== 'ALL') {
                if (item.channel?.toLowerCase() !== currentFilters.channel.toLowerCase()) return false;
            }
            if (currentFilters.content) {
                if (!(item.content || '').toLowerCase().includes(currentFilters.content.toLowerCase())) return false;
            }
            return true;
        });

        // Sort
        result.sort((a, b) => {
            let aValue, bValue;

            if (sort.key === 'timestamp') {
                aValue = (a.sent_at?.toDate ? a.sent_at.toDate() : new Date(a.sent_at)).getTime();
                bValue = (b.sent_at?.toDate ? b.sent_at.toDate() : new Date(b.sent_at)).getTime();
            } else if (sort.key === 'lead') {
                const aLead = leads.find(l => l.id === a.lead_id);
                const bLead = leads.find(l => l.id === b.lead_id);
                aValue = aLead ? `${aLead.firstName} ${aLead.lastName}` : '';
                bValue = bLead ? `${bLead.firstName} ${bLead.lastName}` : '';
            } else if (sort.key === 'type') {
                aValue = a.itemType === 'recommendation' ? 'recommended' : (a.isInbound ? 'received' : 'sent');
                bValue = b.itemType === 'recommendation' ? 'recommended' : (b.isInbound ? 'received' : 'sent');
            } else {
                aValue = a[sort.key] || '';
                bValue = b[sort.key] || '';
            }

            if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    };

    const filteredItems = useMemo(() => {
        return processItems(feedItems, filters, sortConfig);
    }, [feedItems, filters, sortConfig, leads]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredItems, currentPage]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-16 shadow-xl shadow-indigo-500/5 text-center">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-blue-500">
                    <i className="fa-solid fa-clock-rotate-left text-4xl"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Message Trail</h3>
                <p className="text-slate-500 max-w-md mx-auto font-medium text-lg leading-relaxed">No reactivation messages have been sent yet. Head over to Old Leads to start outreach.</p>
            </div>
        );
    }

    const getHeaderClass = (key: string) => {
        const baseClass = "px-4 py-2 cursor-pointer transition-colors select-none";
        if (sortConfig.key === key) {
            return `${baseClass} bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500`;
        }
        return `${baseClass} hover:bg-slate-100`;
    };

    return (
        <div className="p-0 space-y-4">
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-sm">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50/50 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            <th className={`${getHeaderClass('lead')} w-40`} onClick={() => handleSort('lead')}>
                                <div className="flex items-center gap-1">
                                    Lead Name
                                    {sortConfig.key === 'lead' && (
                                        <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </div>
                            </th>
                            <th className={`${getHeaderClass('type')} w-32`} onClick={() => handleSort('type')}>
                                <div className="flex items-center gap-1">
                                    Type
                                    {sortConfig.key === 'type' && (
                                        <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </div>
                            </th>
                            <th className={`${getHeaderClass('channel')} w-28`} onClick={() => handleSort('channel')}>
                                <div className="flex items-center gap-1">
                                    Channel
                                    {sortConfig.key === 'channel' && (
                                        <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </div>
                            </th>
                            <th className="px-4 py-2">Content</th>
                            <th className={`${getHeaderClass('timestamp')} w-40`} onClick={() => handleSort('timestamp')}>
                                <div className="flex items-center gap-1">
                                    Timestamp
                                    {sortConfig.key === 'timestamp' && (
                                        <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </div>
                            </th>
                        </tr>
                        {/* Filter Row */}
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={filters.lead}
                                    onChange={(e) => handleFilterChange('lead', e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                            <th className="px-2 py-1">
                                <select
                                    value={filters.type}
                                    onChange={(e) => handleFilterChange('type', e.target.value)}
                                    className="w-full px-1 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">All</option>
                                    <option value="SENT">Sent</option>
                                    <option value="RECEIVED">Received</option>
                                    <option value="RECOMMENDED">Recommended</option>
                                </select>
                            </th>
                            <th className="px-2 py-1">
                                <select
                                    value={filters.channel}
                                    onChange={(e) => handleFilterChange('channel', e.target.value)}
                                    className="w-full px-1 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">All</option>
                                    <option value="email">Email</option>
                                    <option value="sms">SMS</option>
                                    <option value="call">Call</option>
                                    <option value="whatsapp">WhatsApp</option>
                                </select>
                            </th>
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Search content..."
                                    value={filters.content}
                                    onChange={(e) => handleFilterChange('content', e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={filters.timestamp}
                                    onChange={(e) => handleFilterChange('timestamp', e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {paginatedItems.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center">
                                    <p className="text-[11px] font-bold text-slate-400 italic">No matching messages found.</p>
                                </td>
                            </tr>
                        ) : (
                            paginatedItems.map((item, idx) => {
                                const lead = leads.find(l => l.id === item.lead_id);
                                const isReply = item.reply_received || item.isInbound;
                                const isRecommendation = item.itemType === 'recommendation';

                                return (
                                    <tr key={item.id || idx} className="group hover:bg-slate-50/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 truncate">
                                                <span className="text-[12px] font-bold text-slate-700 truncate">
                                                    {lead ? `${lead.firstName} ${lead.lastName}` : (item.lead_name || 'Unknown Lead')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${getTypeBadgeColor(isReply, isRecommendation)}`}>
                                                {isRecommendation ? 'Recommended' : (isReply ? 'Received' : 'Sent')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getChannelBadgeColor(item.channel)}`}>
                                                {item.channel || '--'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-[12px] text-slate-600 leading-tight italic line-clamp-2">
                                                "{item.content}"
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-[12px] font-bold text-slate-500 whitespace-nowrap">
                                            {formatTimestamp(item.sent_at)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-xs text-slate-400 font-medium">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} of {filteredItems.length} messages
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${currentPage === 1
                                ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                        >
                            Previous
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i + 1}
                                onClick={() => handlePageChange(i + 1)}
                                className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg border transition-all ${currentPage === i + 1
                                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 ring-2 ring-indigo-500/20'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${currentPage === totalPages
                                ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                }`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrailModule;
