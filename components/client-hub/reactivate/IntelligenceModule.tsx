import React, { useState } from 'react';
import { Lead } from '../../../types';
import { getTimeSince } from './shared';
import OutreachModule from './OutreachModule';
import BulkCampaignBuilder from './components/BulkCampaignBuilder';
import LeadListTable from './components/LeadListTable';

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

                <div className="bg-white overflow-hidden">
                    <LeadListTable
                        leads={candidates}
                        selectedLeadIds={selectedLeads}
                        onToggleSelectAll={toggleAll}
                        onToggleSelectOne={toggleLeadSelection}
                        renderStatus={(lead) => (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm border ${lead.engagementScore === 'Hot' ? 'bg-rose-50 text-rose-500 border-rose-100' : lead.engagementScore === 'Cold' ? 'bg-sky-50 text-sky-500 border-sky-100' : lead.health === 'Stale' ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-500 border-indigo-100'}`}>
                                {lead.engagementScore === 'Hot' && <i className="fa-solid fa-fire text-xs text-rose-500"></i>}
                                {lead.engagementScore === 'Cold' && <i className="fa-solid fa-snowflake text-xs text-sky-400"></i>}
                                {lead.health === 'Stale' && lead.engagementScore !== 'Hot' && lead.engagementScore !== 'Cold' && <i className="fa-solid fa-clock-rotate-left text-xs text-slate-400"></i>}
                                {!['Hot', 'Cold', 'Stale'].includes(lead.engagementScore || lead.health || '') && <i className="fa-solid fa-circle-dot text-[8px] text-indigo-300"></i>}
                            </div>
                        )}
                        renderActions={(lead) => (
                            <div className="grid grid-cols-5 gap-1.5 w-fit ml-auto">
                                <button onClick={(e) => { e.stopPropagation(); onSelectCandidate(lead.id, 'email'); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-center border border-slate-100" title="Email"><i className="fa-solid fa-envelope text-xs"></i></button>
                                <button onClick={(e) => { e.stopPropagation(); onSelectCandidate(lead.id, 'call'); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center justify-center border border-slate-100" title="Call"><i className="fa-solid fa-phone text-xs"></i></button>
                                <button onClick={(e) => { e.stopPropagation(); onSelectCandidate(lead.id, 'sms'); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-center border border-slate-100" title="SMS"><i className="fa-solid fa-comment text-xs"></i></button>
                                <button onClick={(e) => { e.stopPropagation(); onSelectCandidate(lead.id, 'whatsapp'); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors flex items-center justify-center border border-slate-100" title="WhatsApp"><i className="fa-brands fa-whatsapp text-xs"></i></button>
                                <button onClick={(e) => { e.stopPropagation(); onSelectCandidate(lead.id, 'mail'); }} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-purple-50 hover:text-purple-600 transition-colors flex items-center justify-center border border-slate-100" title="Direct Mail"><i className="fa-solid fa-paper-plane text-xs"></i></button>
                            </div>
                        )}
                        actionColumnWidth="w-[26%]"
                        noteColumnWidth="w-[25%]"
                        marketColumnWidth="w-[12%]"
                    />
                </div>
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
