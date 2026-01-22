import React, { useState } from 'react';
import { Lead } from '../../types';

interface ReactivateTabProps {
    realtorId: string;
    leads: Lead[];
}

const ReactivateTab: React.FC<ReactivateTabProps> = ({ realtorId, leads }) => {
    const [selectedModule, setSelectedModule] = useState<'INTELLIGENCE' | 'OUTREACH' | 'TRIGGERS'>('INTELLIGENCE');

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
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${selectedModule === 'INTELLIGENCE' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'}`}
                    >
                        <i className="fa-solid fa-brain w-5 text-center"></i>
                        <span className="text-xs uppercase tracking-widest">Intelligence</span>
                    </button>
                    <button
                        onClick={() => setSelectedModule('OUTREACH')}
                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${selectedModule === 'OUTREACH' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'}`}
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
                    <div className="text-2xl font-black tracking-tight">12</div>
                    <div className="text-[10px] text-slate-400 font-medium">Leads revived this month</div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-10">
                {selectedModule === 'INTELLIGENCE' && (
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
                                <div className="text-4xl font-black text-slate-900">42</div>
                                <div className="mt-2 text-xs font-medium text-rose-500 flex items-center gap-1">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                    <span>Needs Attention</span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">High Intent Signals</div>
                                <div className="text-4xl font-black text-slate-900">8</div>
                                <div className="mt-2 text-xs font-medium text-emerald-500 flex items-center gap-1">
                                    <i className="fa-solid fa-fire"></i>
                                    <span>Hot Opportunities</span>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Missing Context</div>
                                <div className="text-4xl font-black text-slate-900">15</div>
                                <div className="mt-2 text-xs font-medium text-amber-500 flex items-center gap-1">
                                    <i className="fa-solid fa-magnifying-glass"></i>
                                    <span>Enrichment Needed</span>
                                </div>
                            </div>
                        </div>

                        {/* Stale List */}
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Revival Candidates</h3>
                                <div className="flex gap-2">
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:border-slate-300">
                                        Filters <i className="fa-solid fa-chevron-down ml-1"></i>
                                    </span>
                                </div>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {[1, 2, 3].map((_, i) => (
                                    <div key={i} className="p-6 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                                    {String.fromCharCode(65 + i)}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">Client Name {i + 1}</h4>
                                                    <p className="text-xs text-slate-400 font-medium">Last active: {2 + i} months ago</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                <div>
                                                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Staleness Reason</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                                        <span className="text-xs font-bold text-slate-600">Rate Shock (Prob: 88%)</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <button className="text-xs font-bold text-indigo-600 hover:underline">View Analysis</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {selectedModule === 'OUTREACH' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="mb-8">
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">AI Outreach Generator</h1>
                            <p className="text-slate-500">Generate context-aware, non-spammy messages to revive conversations.</p>
                        </div>

                        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm text-center py-20">
                            <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-500">
                                <i className="fa-solid fa-wand-magic-sparkles text-3xl"></i>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">Select a Candidate</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mb-8">Go to Intelligence tab and select a lead to generate a personalized revival sequence.</p>
                            <button className="bg-slate-900 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-slate-800 transition-all text-xs font-black uppercase tracking-widest" onClick={() => setSelectedModule('INTELLIGENCE')}>
                                Go to Intelligence
                            </button>
                        </div>
                    </div>
                )}

                {selectedModule === 'TRIGGERS' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="mb-8">
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Timing & Trigger Engine</h1>
                            <p className="text-slate-500">Configure automated market signals that wake up your database.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            {['Rate Drop > 0.5%', 'Inventory Spike in ZIP', 'Listing Price Reduction', 'Lead Anniversary (6mo)'].map((trigger, i) => (
                                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all cursor-pointer group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="w-10 h-6 bg-slate-100 rounded-full relative transition-colors group-hover:bg-emerald-100">
                                            <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform group-hover:translate-x-4"></div>
                                        </div>
                                    </div>
                                    <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                        <i className="fa-solid fa-bolt"></i>
                                    </div>
                                    <h3 className="font-bold text-slate-900">{trigger}</h3>
                                    <p className="text-xs text-slate-400 mt-2">Currently monitoring 42 leads for this signal.</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReactivateTab;
