import React from 'react';
import { Lead } from '../../../types';
import { getTimeSince } from './shared';

interface IntelligenceModuleProps {
    candidates: Lead[];
    onSelectCandidate: (leadId: string, channel?: 'email' | 'call' | 'sms' | 'whatsapp' | 'mail') => void;
}

const IntelligenceModule: React.FC<IntelligenceModuleProps> = ({ candidates, onSelectCandidate }) => {

    // Categorize for stats
    const coldLeadsCount = candidates.length;
    // Mock logic for "High Intent" - e.g. leads with high price points or recent activity despite being archived
    const highIntentCount = candidates.filter(l => (l.budgetMax || 0) > 800000).length;
    const missingContextCount = candidates.filter(l => !l.phone && !l.email).length;

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Lead Intelligence Layer</h1>
                    <p className="text-slate-500">AI analysis of your stale and cold leads to predict revival probability.</p>
                </div>
                <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all text-xs font-black uppercase tracking-widest">
                    <i className="fa-solid fa-arrows-rotate mr-2"></i>
                    Refresh Analysis
                </button>
            </div>

            {/* Stale Lead Stats */}
            <div className="grid grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Cold Leads Identified</div>
                    <div className="text-4xl font-black text-slate-900">{coldLeadsCount}</div>
                    <div className="mt-2 text-xs font-medium text-rose-500 flex items-center gap-1">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        <span>Needs Attention</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">High Intent Signals</div>
                    <div className="text-4xl font-black text-slate-900">{highIntentCount}</div>
                    <div className="mt-2 text-xs font-medium text-emerald-500 flex items-center gap-1">
                        <i className="fa-solid fa-money-bill-trend-up"></i>
                        <span>Worth $2.4M Volume</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Missing Context</div>
                    <div className="text-4xl font-black text-slate-900">{missingContextCount}</div>
                    <div className="mt-2 text-xs font-medium text-amber-500 flex items-center gap-1">
                        <i className="fa-solid fa-database"></i>
                        <span>Enrichment Needed</span>
                    </div>
                </div>
            </div>

            {/* Candidate List */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-black text-lg text-slate-900">Revival Candidates</h3>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100">Filter</button>
                        <button className="px-4 py-2 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-100">Sort</button>
                    </div>
                </div>
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-400 font-black">
                        <tr>
                            <th className="px-6 py-4 tracking-widest">Lead</th>
                            <th className="px-6 py-4 tracking-widest">Staleness Reason</th>
                            <th className="px-6 py-4 tracking-widest">Revival Prob.</th>
                            <th className="px-6 py-4 tracking-widest text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {candidates.map((lead) => {
                            // Mock AI analysis logic
                            const reasons = ['Rate Shock', 'Inventory Low', 'Ghosted', 'Just Browsing', 'Timing Off'];
                            const reason = reasons[Math.abs(lead.id.charCodeAt(0) % reasons.length)];
                            const prob = 40 + (Math.abs(lead.id.charCodeAt(lead.id.length - 1)) % 55);

                            return (
                                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-500">
                                                {lead.avatarUrl ? <img src={lead.avatarUrl} alt="" className="w-full h-full object-cover" /> : <span>{lead.firstName?.charAt(0)}</span>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900">{lead.firstName} {lead.lastName}</div>
                                                <div className="text-xs text-slate-400">Last active: {getTimeSince(lead.lastActiveAt || lead.receivedAt)}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                            {reason}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${prob > 70 ? 'bg-emerald-500' : prob > 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${prob}%` }}></div>
                                            </div>
                                            <span className="font-bold text-xs">{prob}%</span>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        <div className="grid grid-cols-3 gap-1.5 justify-items-end w-fit ml-auto">
                                            <button
                                                onClick={() => onSelectCandidate(lead.id, 'email')}
                                                className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center"
                                                title="Email"
                                            >
                                                <i className="fa-solid fa-envelope text-xs"></i>
                                            </button>
                                            <button
                                                onClick={() => onSelectCandidate(lead.id, 'call')}
                                                className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center justify-center"
                                                title="Call"
                                            >
                                                <i className="fa-solid fa-phone text-xs"></i>
                                            </button>
                                            <button
                                                onClick={() => onSelectCandidate(lead.id, 'sms')}
                                                className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-center"
                                                title="SMS"
                                            >
                                                <i className="fa-solid fa-comment text-xs"></i>
                                            </button>
                                            <button
                                                onClick={() => onSelectCandidate(lead.id, 'whatsapp')}
                                                className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors flex items-center justify-center"
                                                title="WhatsApp"
                                            >
                                                <i className="fa-brands fa-whatsapp text-xs"></i>
                                            </button>
                                            <button
                                                onClick={() => onSelectCandidate(lead.id, 'mail')}
                                                className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center justify-center"
                                                title="Direct Mail"
                                            >
                                                <i className="fa-solid fa-paper-plane text-xs"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IntelligenceModule;
