import React, { useState, useEffect } from 'react';
import { AuditEvent, Lead } from '../../types';
import { getAuditEvents } from '../../services/firebase/audit';
import { getTransactionByClientId, getTransactions } from '../../services/firebase/transactions';

interface AuditTrailTabProps {
    lead: Lead;
    realtorId: string;
}

const AuditTrailTab: React.FC<AuditTrailTabProps> = ({ lead, realtorId }) => {
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [transactionId, setTransactionId] = useState<string | null>(null);

    // Filter & Sort State
    const [filters, setFilters] = useState({
        timestamp: '',
        actor: '',
        action: 'ALL',
        entity: '',
        details: ''
    });
    const [sortConfig, setSortConfig] = useState<{ key: keyof AuditEvent | 'timestamp', direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 25;

    useEffect(() => {
        const fetchTransactionAndEvents = async () => {
            setLoading(true);
            try {
                let tx = await getTransactionByClientId(lead.id, realtorId);

                if (!tx) {
                    const allTransactions = await getTransactions(realtorId);
                    tx = allTransactions.find(t =>
                        t.property?.address === (lead.subjectProperty || lead.propertyAddress)
                    ) || null;
                }

                if (tx) {
                    setTransactionId(tx.id);
                    const auditData = await getAuditEvents(tx.id);
                    setEvents(auditData);
                }
            } catch (error) {
                console.error("Error fetching audit events:", error);
            } finally {
                setLoading(false);
            }
        };

        if (lead.id) {
            fetchTransactionAndEvents();
        }
    }, [lead.id, realtorId, lead.subjectProperty, lead.propertyAddress]);

    // Reset page when filters/sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, sortConfig]);

    const formatTimestamp = (ts: any) => {
        if (!ts) return '--';

        if (ts && typeof ts === 'object' && (ts._methodName === 'serverTimestamp' || !ts.toDate)) {
            if (ts.seconds !== undefined) {
                return new Date(ts.seconds * 1000).toLocaleString();
            }
            return 'Just now...';
        }

        try {
            const date = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
            if (isNaN(date.getTime())) return 'Just now...';
            return date.toLocaleString();
        } catch (e) {
            return 'Just now...';
        }
    };

    const getActionBadgeColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
            case 'UPDATE': return 'bg-amber-100 text-amber-600 border-amber-200';
            case 'DELETE': return 'bg-rose-100 text-rose-600 border-rose-200';
            case 'REPLACE': return 'bg-indigo-100 text-indigo-600 border-indigo-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const handleSort = (key: keyof AuditEvent | 'timestamp') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const processEvents = (data: AuditEvent[], currentFilters: typeof filters, sort: typeof sortConfig) => {
        let result = [...data];

        // Filter
        result = result.filter(e => {
            // Timestamp Match (Text)
            if (currentFilters.timestamp) {
                const tsStr = formatTimestamp(e.occurred_at).toLowerCase();
                if (!tsStr.includes(currentFilters.timestamp.toLowerCase())) return false;
            }
            // Actor Match
            if (currentFilters.actor) {
                if (!(e.actor_name || '').toLowerCase().includes(currentFilters.actor.toLowerCase())) return false;
            }
            // Action Match
            if (currentFilters.action !== 'ALL') {
                if (e.action !== currentFilters.action) return false;
            }
            // Entity Match
            if (currentFilters.entity) {
                if (!(e.entity_type || '').toLowerCase().includes(currentFilters.entity.toLowerCase())) return false;
            }
            // Details Match
            if (currentFilters.details) {
                const detailsStr = (e.diff?.summary || JSON.stringify(e.diff || {})).toLowerCase();
                if (!detailsStr.includes(currentFilters.details.toLowerCase())) return false;
            }
            return true;
        });

        // Sort
        result.sort((a, b) => {
            const aValue = sort.key === 'timestamp' ? (a.occurred_at as any)?.seconds || 0 : a[sort.key];
            const bValue = sort.key === 'timestamp' ? (b.occurred_at as any)?.seconds || 0 : b[sort.key];

            if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    };

    const filteredEvents = React.useMemo(() => {
        return processEvents(events, filters, sortConfig);
    }, [events, filters, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
    const paginatedEvents = React.useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredEvents, currentPage]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!transactionId) {
        return (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <i className="fa-solid fa-history text-4xl text-slate-300 mb-4"></i>
                <h3 className="text-lg font-bold text-slate-600">No History Available</h3>
                <p className="text-slate-400 max-w-xs mx-auto mt-2">Create a transaction record first to track history.</p>
            </div>
        );
    }

    const getHeaderClass = (key: keyof AuditEvent | 'timestamp') => {
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
                        <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            <th className={`${getHeaderClass('timestamp')} w-32`} onClick={() => handleSort('timestamp')}>
                                <div className="flex items-center gap-1">
                                    Timestamp
                                    {sortConfig.key === 'timestamp' && (
                                        <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </div>
                            </th>
                            <th className={`${getHeaderClass('actor_name')} w-32`} onClick={() => handleSort('actor_name')}>
                                <div className="flex items-center gap-1">
                                    Actor
                                    {sortConfig.key === 'actor_name' && (
                                        <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </div>
                            </th>
                            <th className={`${getHeaderClass('action')} w-24`} onClick={() => handleSort('action')}>
                                <div className="flex items-center gap-1">
                                    Action
                                    {sortConfig.key === 'action' && (
                                        <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </div>
                            </th>
                            <th className={`${getHeaderClass('entity_type')} w-28`} onClick={() => handleSort('entity_type')}>
                                <div className="flex items-center gap-1">
                                    Entity
                                    {sortConfig.key === 'entity_type' && (
                                        <i className={`fa-solid fa-sort-${sortConfig.direction === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </div>
                            </th>
                            <th className="px-4 py-2">Details</th>
                        </tr>
                        {/* Filter Row */}
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={filters.timestamp}
                                    onChange={(e) => handleFilterChange('timestamp', e.target.value)}
                                    className="w-full px-2 py-1 text-[9px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={filters.actor}
                                    onChange={(e) => handleFilterChange('actor', e.target.value)}
                                    className="w-full px-2 py-1 text-[9px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                            <th className="px-2 py-1">
                                <select
                                    value={filters.action}
                                    onChange={(e) => handleFilterChange('action', e.target.value)}
                                    className="w-full px-1 py-1 text-[9px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">All</option>
                                    <option value="CREATE">Create</option>
                                    <option value="UPDATE">Update</option>
                                    <option value="DELETE">Delete</option>
                                </select>
                            </th>
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={filters.entity}
                                    onChange={(e) => handleFilterChange('entity', e.target.value)}
                                    className="w-full px-2 py-1 text-[9px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                            <th className="px-2 py-1">
                                <input
                                    type="text"
                                    placeholder="Search details..."
                                    value={filters.details}
                                    onChange={(e) => handleFilterChange('details', e.target.value)}
                                    className="w-full px-2 py-1 text-[9px] border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {paginatedEvents.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center">
                                    <p className="text-[11px] font-bold text-slate-400 italic">No matching events found.</p>
                                </td>
                            </tr>
                        ) : (
                            paginatedEvents.map((event) => (
                                <tr key={event.id} className="group hover:bg-slate-50/30 transition-colors">
                                    <td className="px-4 py-2 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                        {formatTimestamp(event.occurred_at)}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <div className={`w-5 h-5 min-w-[20px] rounded flex items-center justify-center text-[9px] font-black ${event.actor_type === 'SYSTEM' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {event.actor_type === 'SYSTEM' ? 'S' : 'U'}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-700 truncate">
                                                {event.actor_name || 'Unknown'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider ${getActionBadgeColor(event.action)}`}>
                                            {event.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex flex-col truncate">
                                            <span className="text-[10px] font-black text-slate-800 tracking-tight">{event.entity_type}</span>
                                            <span className="text-[8px] text-slate-400 font-medium font-mono">ID: {event.entity_id?.substring(0, 6)}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="text-[10px] text-slate-600 leading-tight">
                                            {event.diff?.summary || (
                                                <div className="flex flex-col gap-1.5">
                                                    {event.action === 'CREATE' && <span className="text-emerald-500 font-bold italic text-[9px]">Initial creation</span>}
                                                    {event.action === 'DELETE' && <span className="text-rose-500 font-bold italic text-[9px]">Removal</span>}

                                                    {/* Display After Values */}
                                                    {event.diff?.after && (
                                                        <div className="p-1 bg-slate-50/50 rounded border border-slate-100 flex flex-wrap gap-x-3 gap-y-0.5">
                                                            {Object.entries(event.diff.after)
                                                                .filter(([k]) => !['updatedAt', 'updated_at', 'id', 'transaction_id', 'created_at', 'createdAt', 'isMock'].includes(k))
                                                                .map(([key, value]) => (
                                                                    <div key={key} className="flex gap-1 text-[9px] items-baseline">
                                                                        <span className="font-bold text-slate-400 uppercase text-[7px] tracking-tighter">{key}:</span>
                                                                        <span className="text-slate-700 font-medium italic break-words">
                                                                            {typeof value === 'object' ? '...' : String(value)}
                                                                        </span>
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                    <div className="text-xs text-slate-400 font-medium">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)} of {filteredEvents.length} events
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

export default AuditTrailTab;
