import React, { useState, useEffect } from 'react';
import { Lead } from '../../types';
import IntelligenceModule from './reactivate/IntelligenceModule';
import OutreachModule from './reactivate/OutreachModule';
import TriggersModule from './reactivate/TriggersModule';

interface ReactivateTabProps {
    realtorId: string;
    leads: Lead[];
}

const ReactivateTab: React.FC<ReactivateTabProps> = ({ realtorId, leads }) => {
    const [selectedModule, setSelectedModule] = useState<'INTELLIGENCE' | 'OUTREACH' | 'TRIGGERS'>('INTELLIGENCE');
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<'email' | 'call' | 'sms' | 'whatsapp' | 'mail' | undefined>('email');

    // Filter for candidates: Archived status or Stale health
    const candidates = leads.filter(l => l.status === 'Archived' || l.health === 'Stale');

    // Switch to Outreach tab automatically when a candidate is selected
    useEffect(() => {
        if (selectedCandidateId) {
            setSelectedModule('OUTREACH');
        }
    }, [selectedCandidateId]);

    const handleSelectCandidate = (leadId: string, channel?: 'email' | 'call' | 'sms' | 'whatsapp' | 'mail') => {
        setSelectedCandidateId(leadId);
        if (channel) setSelectedChannel(channel);
        // Effect will switch tab
    };

    return (
        <div className="flex bg-slate-50 h-full">
            {/* Sidebar Navigation */}
            <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-2">
                <div className="mb-8">
                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 text-indigo-600">
                        <i className="fa-solid fa-bolt text-2xl"></i>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Reactivate</h2>
                    <p className="text-xs font-medium text-slate-400 mt-1">Autopilot for Stale Leads</p>
                </div>

                <nav className="space-y-1">

                    <button
                        onClick={() => setSelectedModule('INTELLIGENCE')}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${['INTELLIGENCE', 'OUTREACH'].includes(selectedModule) ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'}`}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles w-5 text-center"></i>
                        <span className="text-xs uppercase tracking-widest">AI Outreach</span>
                    </button>
                    <button
                        onClick={() => setSelectedModule('TRIGGERS')}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${selectedModule === 'TRIGGERS' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'}`}
                    >
                        <i className="fa-solid fa-stopwatch w-5 text-center"></i>
                        <span className="text-xs uppercase tracking-widest">Triggers</span>
                    </button>
                </nav>

                <div className="mt-auto bg-slate-900 rounded-2xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                        <i className="fa-solid fa-arrow-trend-up text-xs"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">Performance</span>
                    </div>
                    <div className="text-2xl font-black tracking-tight">{Math.floor(candidates.length * 0.15)}</div>
                    <div className="text-[10px] text-slate-400 font-medium">Leads revived this month</div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-10">
                {selectedModule === 'INTELLIGENCE' && (
                    <IntelligenceModule
                        candidates={candidates}
                        onSelectCandidate={handleSelectCandidate}
                    />
                )}

                {selectedModule === 'OUTREACH' && (
                    <OutreachModule
                        realtorId={realtorId}
                        leads={leads}
                        selectedCandidateId={selectedCandidateId}
                        initialChannel={selectedChannel}
                        onClearSelection={() => setSelectedCandidateId(null)}
                        onGoToIntelligence={() => setSelectedModule('INTELLIGENCE')}
                    />
                )}

                {selectedModule === 'TRIGGERS' && (
                    <TriggersModule />
                )}
            </div>
        </div>
    );
};

export default ReactivateTab;
