import React, { useState, useEffect, useMemo } from 'react';
import { Lead } from '../../../../types';
import { getReactivationMessages } from '../../../../services/firebase/communications';

interface SnapshotReportProps {
    realtorId: string;
    leads: Lead[];
}

interface ReportRow {
    leadName: string;
    lastOutreach: Date | null;
    channel: string;
    status: 'Reached' | 'Replied' | 'Failed';
    nextStep: string;
    campaign: string;
}

type TimeRange = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';

const SnapshotReport: React.FC<SnapshotReportProps> = ({ realtorId, leads }) => {
    const [allMessages, setAllMessages] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<TimeRange>('ALL');
    const [loading, setLoading] = useState(true);

    const stats = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));
        const startOfWeek = new Date(new Date().setDate(new Date().getDate() - 7));
        const startOfMonth = new Date(new Date().setMonth(new Date().getMonth() - 1));

        const filteredMessages = allMessages.filter(msg => {
            let msgDate;
            if (msg.sent_at?.toDate) {
                msgDate = msg.sent_at.toDate();
            } else if (msg.sent_at?.seconds) {
                msgDate = new Date(msg.sent_at.seconds * 1000);
            } else {
                msgDate = new Date(msg.sent_at);
            }

            if (isNaN(msgDate.getTime())) return false;

            if (timeRange === 'TODAY') return msgDate >= startOfToday;
            if (timeRange === 'WEEK') return msgDate >= startOfWeek;
            if (timeRange === 'MONTH') return msgDate >= startOfMonth;
            return true;
        });

        // Group messages by lead to calculate lead-level stats within the time range
        const leadMap = new Map<string, { hasOutreach: boolean, hasReply: boolean, campaign: string }>();

        filteredMessages.forEach(msg => {
            const lead = leads.find(l => l.id === msg.lead_id);
            if (!lead) return;

            const current = leadMap.get(msg.lead_id) || {
                hasOutreach: false,
                hasReply: false,
                campaign: lead.searchCriteria?.locations || 'Unknown'
            };

            if (!msg.isInbound && !msg.reply_received) current.hasOutreach = true;
            if (msg.isInbound || msg.reply_received) current.hasReply = true;

            leadMap.set(msg.lead_id, current);
        });

        const conversations = Array.from(leadMap.values()).filter(v => v.hasOutreach).length;
        const reactivated = Array.from(leadMap.values()).filter(v => v.hasReply).length;
        const replyRate = conversations > 0 ? (reactivated / conversations) * 100 : 0;
        const markets = new Set(Array.from(leadMap.values()).map(v => v.campaign)).size;

        return {
            totalLeads: leads.length,
            conversations,
            reactivated,
            replyRate: replyRate.toFixed(1),
            markets,
            totalMessages: filteredMessages.length
        };
    }, [allMessages, timeRange, leads]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch up to 1000 messages for the report
                const messages = await getReactivationMessages(realtorId, undefined, 1000);
                setAllMessages(messages);
            } catch (err) {
                console.error("Error generating report", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [realtorId]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-indigo-500/5">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Generating Analytics...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header with Time Slicer */}
            <div className="flex items-center justify-between bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-1">
                    {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${timeRange === range
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'text-slate-400 hover:bg-slate-50'
                                }`}
                        >
                            {range === 'ALL' ? 'All Time' : range === 'WEEK' ? 'Last 7 Days' : range === 'MONTH' ? 'Last 30 Days' : range}
                        </button>
                    ))}
                </div>
                <div className="px-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        Showing data for {timeRange === 'ALL' ? 'Entire Period' : timeRange.toLowerCase()}
                    </p>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {[
                    { label: "Total Leads", value: stats?.totalLeads, icon: "fa-users", color: "text-slate-600", bg: "bg-slate-50" },
                    { label: "Conversations", value: stats?.conversations, icon: "fa-comments", color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Reactivated", value: stats?.reactivated, icon: "fa-bolt", color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Reply Rate", value: `${stats?.replyRate}%`, icon: "fa-percent", color: "text-indigo-600", bg: "bg-indigo-50" },
                    { label: "Total Msgs", value: stats?.totalMessages, icon: "fa-paper-plane", color: "text-purple-600", bg: "bg-purple-50" },
                    { label: "Markets", value: stats?.markets, icon: "fa-map-location-dot", color: "text-amber-600", bg: "bg-amber-50" }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col gap-3">
                            <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center text-base`}>
                                <i className={`fa-solid ${stat.icon}`}></i>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{stat.label}</p>
                                <p className="text-xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Summary Text */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-500/20">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black tracking-tight">Intelligence Oversight</h3>
                        <p className="text-indigo-100 font-medium max-w-xl">
                            You have reactivated <span className="text-white font-black underline decoration-2 underline-offset-4">{stats?.reactivated} leads</span> from your total pool of {stats?.totalLeads}.
                            That's a <span className="text-white font-black">{stats?.replyRate}% success rate</span> across {stats?.markets} active markets.
                        </p>
                    </div>
                    <div className="hidden md:block opacity-20">
                        <i className="fa-solid fa-chart-pie text-8xl"></i>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SnapshotReport;
