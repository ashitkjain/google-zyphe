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

const SnapshotReport: React.FC<SnapshotReportProps> = ({ realtorId, leads }) => {
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);

    const stats = useMemo(() => {
        if (reportData.length === 0) return null;
        const total = reportData.length;
        const replied = reportData.filter(r => r.status === 'Replied').length;
        const replyRate = (replied / total) * 100;
        const markets = new Set(reportData.map(r => r.campaign)).size;

        // Group by market
        const marketStats = reportData.reduce((acc, curr) => {
            acc[curr.campaign] = (acc[curr.campaign] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topMarket = Object.entries(marketStats).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0];

        return {
            total,
            replied,
            replyRate: replyRate.toFixed(1),
            markets,
            topMarket: topMarket ? topMarket[0] : 'None'
        };
    }, [reportData]);

    useEffect(() => {
        const generateReport = async () => {
            try {
                const messages = await getReactivationMessages(realtorId);
                const leadMap = new Map<string, any>();

                messages.forEach(msg => {
                    const current = leadMap.get(msg.lead_id);
                    const msgDate = msg.sent_at?.toDate
                        ? msg.sent_at.toDate()
                        : (msg.sent_at?.seconds ? new Date(msg.sent_at.seconds * 1000) : new Date(msg.sent_at));

                    const hasReplied = msg.isInbound || msg.reply_received || (current?.hasReplied || false);

                    if (!current || msgDate > current.date) {
                        leadMap.set(msg.lead_id, {
                            msg,
                            date: msgDate,
                            hasReplied
                        });
                    } else if (hasReplied) {
                        // If this message shows a reply but isn't the latest, still update the hasReplied flag
                        leadMap.set(msg.lead_id, {
                            ...current,
                            hasReplied: true
                        });
                    }
                });

                const rows: ReportRow[] = [];
                leadMap.forEach((data, leadId) => {
                    const lead = leads.find(l => l.id === leadId);
                    if (!lead) return;

                    const { msg, date, hasReplied } = data;
                    let nextStep = 'Wait for reply';
                    if (hasReplied) nextStep = 'Manual Follow-up Required';
                    else if (date < new Date(Date.now() - 86400000 * 3)) nextStep = 'Send 2nd Follow-up';

                    rows.push({
                        leadName: `${lead.firstName} ${lead.lastName}`,
                        lastOutreach: date,
                        channel: msg.channel,
                        status: hasReplied ? 'Replied' : 'Reached',
                        nextStep: nextStep,
                        campaign: lead.searchCriteria?.locations || 'Unknown Market'
                    });
                });

                rows.sort((a, b) => (b.lastOutreach?.getTime() || 0) - (a.lastOutreach?.getTime() || 0));
                setReportData(rows);
            } catch (err) {
                console.error("Error generating report", err);
            } finally {
                setLoading(false);
            }
        };

        generateReport();
    }, [realtorId, leads]);

    const downloadCSV = () => {
        const headers = ["Lead Name", "Last Outreach", "Channel", "Status", "Next Step", "Market"];
        const csvContent = [
            headers.join(","),
            ...reportData.map(row => [
                `"${row.leadName}"`,
                row.lastOutreach?.toLocaleDateString() || "",
                row.channel,
                row.status,
                `"${row.nextStep}"`,
                `"${row.campaign}"`
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reactivation_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-indigo-500/5">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Generating Analytics...</p>
        </div>
    );

    if (reportData.length === 0) return (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                <i className="fa-solid fa-chart-line text-3xl"></i>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">No Report Data Yet</h3>
            <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">Start contacting your old leads to see reactivation performance here.</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: "Total Contacted", value: stats?.total, icon: "fa-paper-plane", color: "text-blue-600", bg: "bg-blue-50" },
                    { label: "Total Replies", value: stats?.replied, icon: "fa-reply", color: "text-emerald-600", bg: "bg-emerald-50" },
                    { label: "Reply Rate", value: `${stats?.replyRate}%`, icon: "fa-percent", color: "text-indigo-600", bg: "bg-indigo-50" },
                    { label: "Markets Active", value: stats?.markets, icon: "fa-map-location-dot", color: "text-amber-600", bg: "bg-amber-50" }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center text-lg`}>
                                <i className={`fa-solid ${stat.icon}`}></i>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{stat.label}</p>
                                <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Only stats grid remains for simplicity */}
        </div>
    );
};

export default SnapshotReport;
