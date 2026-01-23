import React, { useState, useEffect } from 'react';
import { getReactivationMessages } from '../../../services/firebase/communications';
import { Lead } from '../../../types';
import { getTimeSince } from './shared';

interface TrailModuleProps {
    realtorId: string;
    leads: Lead[];
}

const TrailModule: React.FC<TrailModuleProps> = ({ realtorId, leads }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter & Sort State
    const [filters, setFilters] = useState({
        timestamp: '',
        recipient: '',
        channel: 'ALL',
        engagement: 'ALL',
        content: ''
    });
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 25;

    useEffect(() => {
        const fetchMessages = async () => {
            const msgs = await getReactivationMessages(realtorId);
            setMessages(msgs);
            setLoading(false);
        };
        fetchMessages();
    }, [realtorId]);

    // Reset page when filters/sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, sortConfig]);

    const formatTimestamp = (ts: any) => {
        if (!ts) return '--';
        try {
            const date = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts.seconds ? ts.seconds * 1000 : ts));
            if (isNaN(date.getTime())) return 'Just now...';
            return date.toLocaleString();
        } catch (e) {
            return 'Just now...';
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

    const processMessages = (data: any[], currentFilters: typeof filters, sort: typeof sortConfig) => {
        let result = [...data];

        // Filter
        result = result.filter(m => {
            const lead = leads.find(l => l.id === m.lead_id);
            const leadName = lead ? `${lead.firstName} ${lead.lastName}` : 'Unknown';

            if (currentFilters.timestamp) {
                const tsStr = formatTimestamp(m.sent_at).toLowerCase();
                if (!tsStr.includes(currentFilters.timestamp.toLowerCase())) return false;
            }
            if (currentFilters.recipient) {
                if (!leadName.toLowerCase().includes(currentFilters.recipient.toLowerCase())) return false;
            }
            if (currentFilters.channel !== 'ALL') {
                if (m.channel !== currentFilters.channel) return false;
            }
            if (currentFilters.engagement !== 'ALL') {
                if (currentFilters.engagement === 'REPLIED' && !m.reply_received) return false;
                if (currentFilters.engagement === 'PENDING' && m.reply_received) return false;
            }
            if (currentFilters.content) {
                if (!(m.content || '').toLowerCase().includes(currentFilters.content.toLowerCase())) return false;
            }
            return true;
        });

        // Sort
        result.sort((a, b) => {
            let aValue: any, bValue: any;

            if (sort.key === 'timestamp') {
                aValue = a.sent_at?.seconds || 0;
                bValue = b.sent_at?.seconds || 0;
            } else if (sort.key === 'recipient') {
                const leadA = leads.find(l => l.id === a.lead_id);
                const leadB = leads.find(l => l.id === b.lead_id);
                aValue = `${leadA?.firstName} ${leadA?.lastName}`;
                bValue = `${leadB?.firstName} ${leadB?.lastName}`;
            } else {
                aValue = a[sort.key];
                bValue = b[sort.key];
            }

            if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    };

    const filteredMessages = React.useMemo(() => {
        return processMessages(messages, filters, sortConfig);
    }, [messages, filters, sortConfig, leads]);

    const totalPages = Math.ceil(filteredMessages.length / ITEMS_PER_PAGE);
    const paginatedMessages = React.useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredMessages.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredMessages, currentPage]);

    const getHeaderClass = (key: string) => {
        const baseClass = "px-4 py-3 cursor-pointer transition-colors select-none";
        if (sortConfig.key === key) {
            return `${baseClass} bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500`;
        }
        return `${baseClass} hover:bg-slate-100`;
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
                <p className="text-slate-500 max-w-md mx-auto font-medium text-lg leading-relaxed">No reactivation messages have been sent yet. Head over to Intelligence to start outreach.</p>
            </div>
        );
    }

    return (
        <div className="p-0 space-y-4">
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-sm">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50/50 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            <th className={`${getHeaderClass('timestamp')} w-40`} onClick={() => handleSort('timestamp')}>
                                <div className="flex items-center gap-1">
                                    Timestamp
                                    {sortConfig.key === 'timestamp' && <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                                </div>
                            </th>
                            <th className={`${getHeaderClass('recipient')} w-48`} onClick={() => handleSort('recipient')}>
                                <div className="flex items-center gap-1">
                                    Recipient
                                    {sortConfig.key === 'recipient' && <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                                </div>
                            </th>
                            <th className={`${getHeaderClass('channel')} w-32`} onClick={() => handleSort('channel')}>
                                <div className="flex items-center gap-1">
                                    Channel
                                    {sortConfig.key === 'channel' && <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>}
                                </div>
                            </th>
                            <th className="px-4 py-3 w-40">Engagement</th>
                            <th className="px-4 py-3">Message Content</th>
                        </tr>
                        {/* Filter Row */}
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={filters.timestamp}
                                    onChange={(e) => handleFilterChange('timestamp', e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={filters.recipient}
                                    onChange={(e) => handleFilterChange('recipient', e.target.value)}
                                    className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                            <th className="px-2 py-1">
                                <select
                                    value={filters.channel}
                                    onChange={(e) => handleFilterChange('channel', e.target.value)}
                                    className="w-full px-1 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">All Channels</option>
                                    <option value="email">Email</option>
                                    <option value="sms">SMS</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="call">Call</option>
                                </select>
                            </th>
                            <th className="px-2 py-1">
                                <select
                                    value={filters.engagement}
                                    onChange={(e) => handleFilterChange('engagement', e.target.value)}
                                    className="w-full px-1 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">All Engagement</option>
                                    <option value="REPLIED">Replied</option>
                                    <option value="PENDING">Pending</option>
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
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {paginatedMessages.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center">
                                    <p className="text-[11px] font-bold text-slate-400 italic">No matching campaigns found.</p>
                                </td>
                            </tr>
                        ) : (
                            paginatedMessages.map((msg) => {
                                const lead = leads.find(l => l.id === msg.lead_id);
                                return (
                                    <tr key={msg.id} className="group hover:bg-slate-50/30 transition-colors">
                                        <td className="px-4 py-3 text-[12px] font-bold text-slate-500 whitespace-nowrap">
                                            {formatTimestamp(msg.sent_at)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-6 h-6 rounded flex items-center justify-center text-[12px] font-black bg-slate-100 text-slate-600 overflow-hidden">
                                                    {lead?.avatarUrl ? <img src={lead.avatarUrl} alt="" /> : <span>{lead?.firstName?.charAt(0)}</span>}
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className="text-[12px] font-bold text-slate-700 truncate">{lead?.firstName} {lead?.lastName}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium font-mono">ID: {lead?.id.substring(0, 6)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${msg.channel === 'email' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                msg.channel === 'sms' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    msg.channel === 'whatsapp' ? 'bg-green-50 text-green-600 border-green-100' :
                                                        msg.channel === 'call' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                            'bg-slate-50 text-slate-600 border-slate-100'
                                                }`}>
                                                {msg.channel}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1.5 flex-wrap">
                                                <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${msg.reply_received ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                                                    {msg.reply_received ? 'Replied' : 'Pending'}
                                                </div>
                                                {msg.sentiment && (
                                                    <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${msg.sentiment.includes('positive') ? 'bg-blue-100 text-blue-700' :
                                                        msg.sentiment.includes('negative') ? 'bg-rose-100 text-rose-700' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {msg.sentiment.replace('_', ' ')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-[12px] text-slate-600 leading-tight">
                                                <p className="italic font-medium line-clamp-1 group-hover:line-clamp-none transition-all">
                                                    "{msg.content}"
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-xs text-slate-400 font-medium tracking-tight">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredMessages.length)} of {filteredMessages.length} outreaches
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${currentPage === 1 ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                            Prev
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i + 1}
                                onClick={() => setCurrentPage(i + 1)}
                                className={`w-8 h-8 flex items-center justify-center text-[10px] font-black rounded-lg border transition-all ${currentPage === i + 1 ? 'bg-indigo-50 text-indigo-600 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${currentPage === totalPages ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
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
