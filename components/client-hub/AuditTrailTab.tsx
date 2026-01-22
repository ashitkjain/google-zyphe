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

    return (
        <div className="p-0">
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-sm">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            <th className="px-4 py-2 w-32">Timestamp</th>
                            <th className="px-4 py-2 w-32">Actor</th>
                            <th className="px-4 py-2 w-24">Action</th>
                            <th className="px-4 py-2 w-28">Entity</th>
                            <th className="px-4 py-2">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {events.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center">
                                    <p className="text-[11px] font-bold text-slate-400 italic">No events recorded yet.</p>
                                </td>
                            </tr>
                        ) : (
                            events.map((event) => (
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
                                                                        <span className="text-slate-700 font-medium truncate italic max-w-[150px]">
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
        </div>
    );
};

export default AuditTrailTab;
