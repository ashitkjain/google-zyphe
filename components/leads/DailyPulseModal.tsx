import React, { useState, useEffect } from 'react';
import { Lead, CRMTask, CalendarEvent } from '../../types';
import { DailyPulseResult } from '../../types/ai';
import { generateDailyPulse } from '../../services/geminiService';

interface DailyPulseModalProps {
    leads: Lead[];
    tasks?: CRMTask[];
    calendarEvents?: CalendarEvent[];
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const DailyPulseModal: React.FC<DailyPulseModalProps> = ({ leads, tasks = [], calendarEvents = [], isOpen, onClose, userId }) => {
    const [report, setReport] = useState<DailyPulseResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAllTodayTasks, setShowAllTodayTasks] = useState(false);
    const [showAllUpcomingTasks, setShowAllUpcomingTasks] = useState(false);

    useEffect(() => {
        if (isOpen && !report && !loading) {
            handleGenerate();
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            // Filter leads for the past 14 days
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const recentLeads = leads.filter(l => {
                const date = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt || 0);
                return date >= fourteenDaysAgo;
            });

            const result = await generateDailyPulse(recentLeads, userId, tasks, calendarEvents);
            setReport(result.data);
        } catch (err: any) {
            console.error('Failed to generate Daily Pulse:', err);
            setError(err.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 relative border border-white/20">
                {/* Header */}
                <div className="bg-white px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <i className="fa-solid fa-bolt-lightning text-xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Today's Briefing</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your AI-Powered Command Center</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i>
                            Refresh
                        </button>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            <i className="fa-solid fa-times"></i>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-slate-500 font-bold animate-pulse text-sm">Zyphe Engine is synthesizing your report...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-100 p-6 rounded-3xl text-center">
                            <i className="fa-solid fa-circle-exclamation text-red-400 text-3xl mb-3"></i>
                            <h3 className="text-red-800 font-bold mb-1">Synthesis Interrupted</h3>
                            <p className="text-red-600 text-xs mb-4">{error}</p>
                            <button onClick={handleGenerate} className="px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors">
                                Try Again
                            </button>
                        </div>
                    ) : report ? (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {/* 1. Heat Map - Top Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                            <i className="fa-solid fa-fire-flame-curved"></i>
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Active Pursuits</div>
                                    </div>
                                    <div className="text-4xl font-black text-slate-800 tracking-tight">{report.summary.activePursuits}</div>
                                    <div className="mt-2 text-[10px] text-slate-400 font-bold">Warm or Hot leads in play</div>
                                </div>
                                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                                            <i className="fa-solid fa-hourglass-start"></i>
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Neglected Leads</div>
                                    </div>
                                    <div className="text-4xl font-black text-red-600 tracking-tight">{report.summary.neglectedLeads}</div>
                                    <div className="mt-2 text-[10px] text-slate-400 font-bold">No contact {'>'} 48 hours</div>
                                </div>
                                <div className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                            <i className="fa-solid fa-chart-line"></i>
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pipeline Value</div>
                                    </div>
                                    <div className="text-4xl font-black text-emerald-600 tracking-tight">${(report.activePipelineValue / 1000000).toFixed(1)}M</div>
                                    <div className="mt-2 text-[10px] text-slate-400 font-bold">Active budget total volume</div>
                                </div>
                            </div>

                            {/* 2. Intelligence Layer: Must Call & Red Flags */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* The Daily 5 */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center text-white shadow-lg shadow-amber-100">
                                                <i className="fa-solid fa-star"></i>
                                            </div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">The Daily 5 (Must Action)</h3>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">Top Focus</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {report.dailyFive.map((item, idx) => (
                                            <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-300 hover:shadow-lg transition-all flex items-start gap-5 group cursor-pointer">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white font-black text-lg transition-all shadow-inner">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-base font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.name}</div>
                                                            {item.type && <div className="text-[8px] font-black text-white bg-slate-900 px-2 py-0.5 rounded uppercase tracking-[0.15em]">{item.type}</div>}
                                                        </div>
                                                        {item.phone && <div className="text-[11px] font-black text-indigo-500 font-mono tracking-tighter hover:scale-105 transition-transform">{item.phone}</div>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-bold leading-relaxed">{item.reason}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Red Flags */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 px-2">
                                        <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-100">
                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest text-rose-600">Red Flags</h3>
                                    </div>
                                    <div className="space-y-4">
                                        {report.redFlags.map((item, idx) => (
                                            <div key={idx} className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                                <div className="absolute top-0 right-0 w-16 h-16 -mr-8 -mt-8 bg-rose-50 rounded-full group-hover:scale-110 transition-transform"></div>
                                                <div className="relative z-10">
                                                    <div className="text-sm font-black text-slate-800 mb-2">{item.name}</div>
                                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                                        <div className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                            <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse"></span>
                                                            Critical Hook
                                                        </div>
                                                        <p className="text-[11px] text-slate-600 font-black leading-relaxed italic">"{item.hook}"</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 3. Schedule & Agenda Layer */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                        <i className="fa-solid fa-calendar-day"></i>
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Operation Intelligence</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Meetings Card */}
                                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5 pb-3 border-b border-slate-50">Today's Meetings</div>
                                        <div className="space-y-4">
                                            {report.todayMeetings.length > 0 ? report.todayMeetings.map((m, i) => (
                                                <div key={i} className="flex items-start gap-4 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100/50 group hover:bg-emerald-50 transition-colors">
                                                    <div className="text-[10px] font-black text-emerald-600 bg-white px-2 py-1 rounded shadow-sm self-start">{m.time}</div>
                                                    <div className="text-[11px] font-black text-slate-800 leading-snug">{m.title}</div>
                                                </div>
                                            )) : <div className="text-[10px] text-slate-400 italic text-center py-4">No meetings scheduled</div>}
                                        </div>
                                    </div>

                                    {/* Tasks Today Card */}
                                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                                        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Today's Tasks</div>
                                            {report.todayTasks.length > 3 && (
                                                <button onClick={() => setShowAllTodayTasks(!showAllTodayTasks)} className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 transition-colors tracking-widest">
                                                    {showAllTodayTasks ? 'LESS' : 'MORE'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            {report.todayTasks.length > 0 ? (showAllTodayTasks ? report.todayTasks : report.todayTasks.slice(0, 3)).map((t, i) => (
                                                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 group hover:bg-indigo-50 transition-colors">
                                                    <div className="flex-1 text-[11px] font-black text-slate-800 line-clamp-1">{t.name}</div>
                                                    <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${t.priority === 'Urgent' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                                                        {t.priority}
                                                    </div>
                                                </div>
                                            )) : <div className="text-[10px] text-slate-400 italic text-center py-4">No pending tasks for today</div>}
                                        </div>
                                    </div>

                                    {/* Next 3 Days Card */}
                                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                                        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">The Next 72 Hours</div>
                                            {report.upcomingTasks.length > 3 && (
                                                <button onClick={() => setShowAllUpcomingTasks(!showAllUpcomingTasks)} className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 transition-colors tracking-widest">
                                                    {showAllUpcomingTasks ? 'LESS' : 'MORE'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            {report.upcomingTasks.length > 0 ? (showAllUpcomingTasks ? report.upcomingTasks : report.upcomingTasks.slice(0, 3)).map((t, i) => (
                                                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-slate-300 transition-all">
                                                    <div className="flex-1 text-[11px] font-black text-slate-800 line-clamp-1">{t.name}</div>
                                                    <div className="text-[8px] font-black text-slate-400 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm">{t.dueDate}</div>
                                                </div>
                                            )) : <div className="text-[10px] text-slate-400 italic text-center py-4">Clear schedule ahead</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Agent Pro Tip - Final Feature */}
                            <div className="bg-gradient-to-r from-indigo-600 to-indigo-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 -mr-32 -mt-32 bg-white/5 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                                <div className="absolute bottom-0 left-0 w-48 h-48 -ml-24 -mb-24 bg-indigo-400/10 rounded-full blur-2xl"></div>
                                <div className="relative z-10 flex items-center gap-8">
                                    <div className="hidden md:flex w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md items-center justify-center text-3xl shadow-2xl border border-white/20">
                                        <i className="fa-solid fa-lightbulb text-amber-300 animate-pulse"></i>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Intelligence Briefing Pro Tip</div>
                                        </div>
                                        <p className="text-lg font-black leading-relaxed tracking-tight opacity-95">
                                            {report.proTip}
                                        </p>
                                    </div>
                                    <i className="fa-solid fa-bolt-lightning absolute -right-4 -bottom-4 text-[10rem] text-white/5 rotate-12"></i>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-400 italic">
                            No report available. Click refresh to generate.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-100/50 px-8 py-4 border-t border-slate-100 flex items-center justify-between">
                    <div></div>
                    <button onClick={onClose} className="text-xs font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest transition-colors">
                        Dismiss Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyPulseModal;
