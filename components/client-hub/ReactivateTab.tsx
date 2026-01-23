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
    const [selectedModule, setSelectedModule] = useState<'INTELLIGENCE' | 'TRAIL' | 'ANALYTICS' | 'TRIGGERS'>('INTELLIGENCE');
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<'email' | 'call' | 'sms' | 'whatsapp' | 'mail' | undefined>('email');

    // Filter for candidates: Archived status or Stale health
    const candidates = leads.filter(l => l.status === 'Archived' || l.health === 'Stale');

    const handleSelectCandidate = (leadId: string, channel?: 'email' | 'call' | 'sms' | 'whatsapp' | 'mail') => {
        setSelectedCandidateId(leadId);
        if (channel) setSelectedChannel(channel);
        setSelectedModule('INTELLIGENCE'); // Ensure we are in Intelligence view to see the generator
    };

    return (
        <div className="flex-1 h-full overflow-y-auto bg-slate-50 p-12 animate-in fade-in slide-in-from-bottom-4 duration-700 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-10">
                {/* Sub Tab Navigation */}
                <div className="flex items-center gap-8 border-b border-slate-200">
                    <button
                        onClick={() => setSelectedModule('INTELLIGENCE')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative ${selectedModule === 'INTELLIGENCE' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Intelligence
                        {selectedModule === 'INTELLIGENCE' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('TRAIL')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative ${selectedModule === 'TRAIL' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Message Trail
                        {selectedModule === 'TRAIL' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('ANALYTICS')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative ${selectedModule === 'ANALYTICS' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Analytics
                        {selectedModule === 'ANALYTICS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('TRIGGERS')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative ${selectedModule === 'TRIGGERS' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Triggers
                        {selectedModule === 'TRIGGERS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {selectedModule === 'INTELLIGENCE' && (
                        <IntelligenceModule
                            realtorId={realtorId}
                            leads={leads}
                            candidates={candidates}
                            selectedCandidateId={selectedCandidateId}
                            initialChannel={selectedChannel}
                            onSelectCandidate={handleSelectCandidate}
                            onClearSelection={() => setSelectedCandidateId(null)}
                        />
                    )}

                    {selectedModule === 'TRAIL' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-16 shadow-xl shadow-indigo-500/5 text-center">
                            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-blue-500">
                                <i className="fa-solid fa-clock-rotate-left text-4xl"></i>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Message Trail</h3>
                            <p className="text-slate-500 max-w-md mx-auto font-medium text-lg leading-relaxed">Historical log of all automated and manual outreach attempts will appear here.</p>
                        </div>
                    )}

                    {selectedModule === 'ANALYTICS' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-16 shadow-xl shadow-indigo-500/5 text-center">
                            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 text-emerald-500">
                                <i className="fa-solid fa-chart-line text-4xl"></i>
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Analytics Dashboard</h3>
                            <p className="text-slate-500 max-w-md mx-auto font-medium text-lg leading-relaxed">Track conversion rates and response performance for your reactivation campaigns.</p>
                        </div>
                    )}

                    {selectedModule === 'TRIGGERS' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl shadow-indigo-500/5">
                            <TriggersModule />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReactivateTab;
