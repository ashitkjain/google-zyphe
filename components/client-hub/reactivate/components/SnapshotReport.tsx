import React, { useState, useEffect } from 'react';
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

    useEffect(() => {
        const generateReport = async () => {
            try {
                // Fetch actual message logs
                const messages = await getReactivationMessages(realtorId);

                // Group by lead to find latest status
                const leadMap = new Map<string, any>();

                messages.forEach(msg => {
                    const current = leadMap.get(msg.lead_id);
                    const msgDate = msg.sent_at?.toDate ? msg.sent_at.toDate() : new Date(msg.sent_at?.seconds * 1000);

                    if (!current || msgDate > current.date) {
                        leadMap.set(msg.lead_id, {
                            msg,
                            date: msgDate
                        });
                    }
                });

                const rows: ReportRow[] = [];

                // Process leads who have been contacted
                leadMap.forEach((data, leadId) => {
                    const lead = leads.find(l => l.id === leadId);
                    if (!lead) return;

                    const { msg, date } = data;

                    let nextStep = 'Wait for reply';
                    if (msg.reply_received) nextStep = 'Manual Follow-up Required';
                    else if (date < new Date(Date.now() - 86400000 * 3)) nextStep = 'Send 2nd Follow-up';

                    rows.push({
                        leadName: `${lead.firstName} ${lead.lastName}`,
                        lastOutreach: date,
                        channel: msg.channel,
                        status: msg.reply_received ? 'Replied' : 'Reached',
                        nextStep: nextStep,
                        campaign: 'Reactivation Alpha' // Placeholder
                    });
                });

                // Sort by most recent
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
        const headers = ["Lead Name", "Last Outreach", "Channel", "Status", "Next Step"];
        const csvContent = [
            headers.join(","),
            ...reportData.map(row => [
                `"${row.leadName}"`,
                row.lastOutreach?.toLocaleDateString() || "",
                row.channel,
                row.status,
                `"${row.nextStep}"`
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

    if (loading) return <div className="p-12 text-center text-slate-400">Loading Report Data...</div>;

    if (reportData.length === 0) return (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-200">
            <h3 className="text-xl font-black text-slate-900 mb-2">No Report Data Yet</h3>
            <p className="text-slate-400">Start some reactivation campaigns to see your outreach report here.</p>
        </div>
    );

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Outreach Snapshot</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Campaign Performance Report</p>
                </div>
                <button
                    onClick={downloadCSV}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center gap-2"
                >
                    <i className="fa-solid fa-download"></i> Export CSV
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-4">Lead Name</th>
                            <th className="px-6 py-4">Last Outreach</th>
                            <th className="px-6 py-4">Channel</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Next Step</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                        {reportData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4 font-bold text-slate-700">{row.leadName}</td>
                                <td className="px-6 py-4 font-mono text-xs text-slate-500">{row.lastOutreach?.toLocaleString()}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${row.channel === 'sms' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        'bg-blue-50 text-blue-600 border-blue-100'
                                        }`}>
                                        {row.channel}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`flex items-center gap-2 font-bold text-xs ${row.status === 'Replied' ? 'text-emerald-600' : 'text-slate-500'
                                        }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'Replied' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${row.nextStep.includes('Required') ? 'bg-rose-50 text-rose-600 font-bold' : 'text-slate-500 italic'
                                        }`}>
                                        {row.nextStep}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End of Report • {reportData.length} records found</p>
            </div>
        </div>
    );
};

export default SnapshotReport;
