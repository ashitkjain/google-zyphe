import React, { useState, useEffect } from 'react';
import { Lead } from '../../types';
import TriggersModule from './reactivate/TriggersModule';
import TrailModule from './reactivate/TrailModule';
import AutomatedModule from './reactivate/AutomatedModule';
import DashboardModule from './reactivate/DashboardModule';

import SnapshotReport from './reactivate/components/SnapshotReport';
import ClientDetailsView from './ClientDetailsView';

interface ReactivateTabProps {
    realtorId: string;
    realtorName?: string;
    leads: Lead[];
    onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
}

const ReactivateTab: React.FC<ReactivateTabProps> = ({ realtorId, realtorName, leads, onUpdateLead }) => {
    const [selectedModule, setSelectedModule] = useState<'OLD_LEADS' | 'AI_PLAN' | 'DASHBOARD' | 'TRAIL' | 'TRIGGERS' | 'REPORT'>('OLD_LEADS');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    return (
        <div className="flex-1 bg-slate-50 px-12 pt-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-4">
                {/* Sub Tab Navigation */}
                <div className="flex items-center gap-8 border-b border-slate-200 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setSelectedModule('OLD_LEADS')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'OLD_LEADS' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Old Leads
                        {selectedModule === 'OLD_LEADS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('AI_PLAN')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'AI_PLAN' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        AI Plan
                        {selectedModule === 'AI_PLAN' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('DASHBOARD')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'DASHBOARD' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Respond
                        {selectedModule === 'DASHBOARD' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('REPORT')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'REPORT' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Report
                        {selectedModule === 'REPORT' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                    <button
                        onClick={() => setSelectedModule('TRAIL')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'TRAIL' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Message Trail
                        {selectedModule === 'TRAIL' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>

                    <button
                        onClick={() => setSelectedModule('TRIGGERS')}
                        className={`pb-5 text-sm font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${selectedModule === 'TRIGGERS' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Triggers (Future)
                        {selectedModule === 'TRIGGERS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>}
                    </button>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {selectedModule === 'DASHBOARD' && (
                        <DashboardModule
                            realtorId={realtorId}
                            onOpenLeadDetails={(leadId) => setSelectedClientId(leadId)}
                        />
                    )}

                    {selectedModule === 'OLD_LEADS' && (
                        <AutomatedModule
                            realtorId={realtorId}
                            realtorName={realtorName}
                            leads={leads}
                            onOpenLeadDetails={(leadId) => setSelectedClientId(leadId)}
                            onUpdateLead={onUpdateLead}
                            forcedSubTab="GENERATE"
                        />
                    )}

                    {selectedModule === 'AI_PLAN' && (
                        <AutomatedModule
                            realtorId={realtorId}
                            realtorName={realtorName}
                            leads={leads}
                            onOpenLeadDetails={(leadId) => setSelectedClientId(leadId)}
                            onUpdateLead={onUpdateLead}
                            forcedSubTab="PLANS"
                        />
                    )}

                    {selectedModule === 'TRAIL' && (
                        <TrailModule realtorId={realtorId} leads={leads} />
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
                                realtorId={realtorId}
                                clients={[]}
                                leads={leads}
                                onUpdateClient={async (id: string, updates: any, collectionName: string) => {
                                    if (onUpdateLead) {
                                        onUpdateLead(id, updates);
                                    }
                                    return true;
                                }}
                                initialSelectedId={selectedClientId}
                                hideClientList={true}
                            />
                            <button
                                onClick={() => setSelectedClientId(null)}
                                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shadow-lg z-10"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReactivateTab;
