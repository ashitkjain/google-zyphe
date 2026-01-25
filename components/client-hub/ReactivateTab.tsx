import React, { useState, useEffect } from 'react';
import { Lead } from '../../types';
import IntelligenceModule from './reactivate/IntelligenceModule';
import OutreachModule from './reactivate/OutreachModule';
import TriggersModule from './reactivate/TriggersModule';
import TrailModule from './reactivate/TrailModule';
import AnalyticsModule from './reactivate/AnalyticsModule';
import AutomatedModule from './reactivate/AutomatedModule';
import DashboardModule from './reactivate/DashboardModule';

import SnapshotReport from './reactivate/components/SnapshotReport';
import ClientDetailsView from './ClientDetailsView';

interface ReactivateTabProps {
    realtorId: string;
    leads: Lead[];
    onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
}

const ReactivateTab: React.FC<ReactivateTabProps> = ({ realtorId, leads, onUpdateLead }) => {
    const [selectedModule, setSelectedModule] = useState<'DASHBOARD' | 'AUTOMATED' | 'ASSISTED' | 'TRAIL' | 'ANALYTICS' | 'TRIGGERS' | 'REPORT'>('DASHBOARD');
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<'email' | 'call' | 'sms' | 'whatsapp' | 'mail' | undefined>('email');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    // Filter for candidates: Archived status or Stale health
    const candidates = leads.filter(l => l.status === 'Archived' || l.health === 'Stale');

    const handleSelectCandidate = (leadId: string, channel?: 'email' | 'call' | 'sms' | 'whatsapp' | 'mail') => {
        setSelectedCandidateId(leadId);
        if (channel) setSelectedChannel(channel);
        setSelectedModule('ASSISTED'); // Ensure we are in Assisted view to see the generator
    };

    return (
        <div className="flex-1 h-full overflow-y-auto bg-slate-50 px-12 pt-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-4">
                {/* Sub Tab Navigation */}
                <div className="flex items-center gap-8 border-b border-slate-200 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setSelectedModule('DASHBOARD')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'DASHBOARD' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Dashboard
                        {selectedModule === 'DASHBOARD' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('AUTOMATED')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'AUTOMATED' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Automated
                        {selectedModule === 'AUTOMATED' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('ASSISTED')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'ASSISTED' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Assisted
                        {selectedModule === 'ASSISTED' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('TRAIL')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'TRAIL' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Message Trail
                        {selectedModule === 'TRAIL' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('ANALYTICS')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'ANALYTICS' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Analytics
                        {selectedModule === 'ANALYTICS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('TRIGGERS')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'TRIGGERS' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Triggers
                        {selectedModule === 'TRIGGERS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('REPORT')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'REPORT' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Snapshot Report
                        {selectedModule === 'REPORT' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {selectedModule === 'DASHBOARD' && (
                        <DashboardModule
                            realtorId={realtorId}
                            onOpenLeadDetails={(leadId) => setSelectedClientId(leadId)}
                        />
                    )}

                    {selectedModule === 'AUTOMATED' && (
                        <AutomatedModule realtorId={realtorId} leads={leads} />
                    )}

                    {selectedModule === 'ASSISTED' && (
                        <IntelligenceModule
                            realtorId={realtorId}
                            leads={leads}
                            candidates={candidates}
                            selectedCandidateId={selectedCandidateId}
                            initialChannel={selectedChannel}
                            onSelectCandidate={handleSelectCandidate}
                            onClearSelection={() => setSelectedCandidateId(null)}
                            onUpdateLead={onUpdateLead}
                        />
                    )}

                    {selectedModule === 'TRAIL' && (
                        <TrailModule realtorId={realtorId} leads={leads} />
                    )}

                    {selectedModule === 'ANALYTICS' && (
                        <AnalyticsModule realtorId={realtorId} leads={leads} />
                    )}

                    {selectedModule === 'TRIGGERS' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl shadow-indigo-500/5">
                            <TriggersModule />
                        </div>
                    )}

                    {selectedModule === 'REPORT' && (
                        <SnapshotReport realtorId={realtorId} leads={leads} />
                    )}
                </div>

                {/* Client Details Modal */}
                {selectedClientId && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center">
                        <div
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                            onClick={() => setSelectedClientId(null)}
                        />
                        <div className="relative w-full max-w-6xl h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden">
                            <ClientDetailsView
                                clients={leads}
                                selectedClientId={selectedClientId}
                                onClose={() => setSelectedClientId(null)}
                                onUpdateLead={onUpdateLead}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReactivateTab;
