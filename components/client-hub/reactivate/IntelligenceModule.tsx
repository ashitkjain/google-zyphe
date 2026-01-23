import React from 'react';
import { Lead } from '../../../types';
import { getTimeSince } from './shared';
import OutreachModule from './OutreachModule';

interface IntelligenceModuleProps {
    realtorId: string;
    leads: Lead[];
    candidates: Lead[];
    onSelectCandidate: (leadId: string, channel?: 'email' | 'call' | 'sms' | 'whatsapp' | 'mail') => void;
    selectedCandidateId: string | null;
    initialChannel?: 'email' | 'call' | 'sms' | 'whatsapp' | 'mail';
    onClearSelection: () => void;
    onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
}

const IntelligenceModule: React.FC<IntelligenceModuleProps> = ({
    realtorId,
    leads,
    candidates,
    onSelectCandidate,
    selectedCandidateId,
    initialChannel,
    onClearSelection,
    onUpdateLead
}) => {

    const selectedLead = leads.find(l => l.id === selectedCandidateId);

    if (selectedCandidateId && selectedLead) {
        return (
            <OutreachModule
                realtorId={realtorId}
                leads={leads}
                selectedCandidateId={selectedCandidateId}
                initialChannel={initialChannel}
                onClearSelection={onClearSelection}
                onGoToAssisted={onClearSelection}
                onUpdateLead={onUpdateLead}
            />
        );
    }

    // Categorize for stats
    const coldLeadsCount = candidates.length;
    // Mock logic for "High Intent" - e.g. leads with high price points or recent activity despite being archived
    const highIntentCount = candidates.filter(l => (l.budgetMax || 0) > 800000).length;
    const missingContextCount = candidates.filter(l => !l.phone && !l.email).length;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Candidate List */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden mb-12">
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

            {/* Reactivation Protocol Header (Moved to bottom) */}
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl border border-white/5">
                <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-12">
                    <div className="max-w-md">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <i className="fa-solid fa-brain text-lg"></i>
                            </div>
                            <h2 className="text-3xl font-black tracking-tight">Assisted Engine</h2>
                        </div>
                        <p className="text-slate-400 font-medium leading-relaxed">
                            Our protocol analyzes behavioral patterns to wake up idle segments of your database with surgical precision.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:flex-1">
                        {[
                            { icon: 'fa-user-check', text: 'Understand who the lead is' },
                            { icon: 'fa-snowflake', text: 'Understand why they went cold' },
                            { icon: 'fa-wand-magic-sparkles', text: 'Generate context-aware outreach' },
                            { icon: 'fa-clock', text: 'Pick the right channel + timing' },
                            { icon: 'fa-chart-line', text: 'Learn from responses' }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 group">
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <i className={`fa-solid ${item.icon} text-sm`}></i>
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 leading-snug max-w-[140px]">
                                    {item.text}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] -mr-48 -mt-48"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/5 rounded-full blur-[100px] -ml-32 -mb-32"></div>
            </div>
        </div >
    );
};

export default IntelligenceModule;
