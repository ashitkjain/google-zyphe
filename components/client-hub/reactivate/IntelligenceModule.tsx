import React, { useState } from 'react';
import { Lead } from '../../../types';
import { getTimeSince } from './shared';
import OutreachModule from './OutreachModule';
import BulkCampaignBuilder from './components/BulkCampaignBuilder';

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
    // Bulk Selection State
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [showBulkBuilder, setShowBulkBuilder] = useState(false);

    const toggleLeadSelection = (leadId: string) => {
        setSelectedLeads(prev => {
            const next = new Set(prev);
            if (next.has(leadId)) {
                next.delete(leadId);
            } else {
                next.add(leadId);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedLeads.size === candidates.length) {
            setSelectedLeads(new Set());
        } else {
            setSelectedLeads(new Set(candidates.map(l => l.id)));
        }
    };

    const handleBulkLaunch = (payload: any) => {
        console.log("Launching Bulk Campaign:", payload, "For leads:", Array.from(selectedLeads));
        // In real app: Call API here
        setShowBulkBuilder(false);
        setSelectedLeads(new Set());
        alert(`Campaign "${payload.title}" launched for ${selectedLeads.size} leads!`);
    };

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

    if (coldLeadsCount === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-wind text-3xl"></i>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Your Pipeline is Running Hot</h3>
                <p className="text-slate-400 max-w-sm mx-auto">We couldn't find any cold or stale leads requiring manual outreach. Check back later once your database cools down!</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 relative min-h-[600px]">
            {/* Candidate List */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden mb-12">
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-100">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Stale Leads Candidates</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400">
                            {selectedLeads.size} selected
                        </span>
                        {selectedLeads.size > 0 && (
                            <button
                                onClick={() => setShowBulkBuilder(true)}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 animate-in fade-in zoom-in-95 duration-200"
                            >
                                <i className="fa-solid fa-bolt mr-2"></i> Reactivate Selected
                            </button>
                        )}
                    </div>
                </div>

                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-400 font-black">
                        <tr>
                            <th className="px-6 py-4 w-12">
                                <input
                                    type="checkbox"
                                    checked={candidates.length > 0 && selectedLeads.size === candidates.length}
                                    onChange={toggleAll}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                            </th>
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
                            const isSelected = selectedLeads.has(lead.id);

                            return (
                                <tr
                                    key={lead.id}
                                    className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                                    onClick={() => toggleLeadSelection(lead.id)}
                                >
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleLeadSelection(lead.id)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                    </td>
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

                                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
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
            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl border border-white/5 mx-auto max-w-5xl">
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

            {/* Bulk Campaign Modal */}
            {showBulkBuilder && (
                <BulkCampaignBuilder
                    leads={candidates.filter(l => selectedLeads.has(l.id))}
                    onClose={() => setShowBulkBuilder(false)}
                    onLaunch={handleBulkLaunch}
                />
            )}
        </div >
    );
};

export default IntelligenceModule;
