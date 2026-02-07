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
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* 1. Heat Map */}
                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 group-hover:text-amber-500 transition-colors">Active Pursuits</div>
                                    <div className="text-3xl font-black text-slate-800">{report.summary.activePursuits}</div>
                                    <div className="mt-2 text-[10px] text-slate-400 font-bold">Warm or Hot leads</div>
                                </div>
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 group-hover:text-red-500 transition-colors">Neglected Leads</div>
                                    <div className="text-3xl font-black text-red-600">{report.summary.neglectedLeads}</div>
                                    <div className="mt-2 text-[10px] text-slate-400 font-bold">No contact {'>'} 48 hours</div>
                                </div>
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 group-hover:text-emerald-500 transition-colors">Pipeline Value</div>
                                    <div className="text-3xl font-black text-emerald-600">${(report.activePipelineValue / 1000000).toFixed(1)}M</div>
                                    <div className="mt-2 text-[10px] text-slate-400 font-bold">Active budget total</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* 2. The Daily 5 */}
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="flex items-center gap-2 px-2">
                                        <i className="fa-solid fa-star text-amber-400"></i>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">The Daily 5 (Must Call)</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {report.dailyFive.map((item, idx) => (
                                            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors flex items-center gap-4 group">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 font-black text-sm transition-colors">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-baseline gap-2 flex-wrap">
                                                        <div className="text-sm font-black text-slate-800">{item.name}</div>
                                                        {item.type && <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.type}</div>}
                                                        {item.phone && <div className="text-[10px] font-bold text-indigo-400/80 font-mono tracking-tighter bg-indigo-50/30 px-1.5 py-0.5 rounded border border-indigo-100/50">{item.phone}</div>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1 line-clamp-2">{item.reason}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. Schedule/Agenda */}
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-2">
                                            <i className="fa-solid fa-calendar-check text-indigo-500"></i>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Today's Agenda</h3>
                                        </div>
                                        <div className="bg-white rounded-[2rem] border border-slate-100 p-6 space-y-6">
                                            {/* Meetings */}
                                            <div className="space-y-3">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Meetings</div>
                                                {report.todayMeetings.length > 0 ? report.todayMeetings.map((m, i) => (
                                                    <div key={i} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border-l-2 border-emerald-400">
                                                        <div className="text-[10px] font-black text-indigo-600 w-12">{m.time}</div>
                                                        <div className="text-[11px] font-bold text-slate-800 line-clamp-1">{m.title}</div>
                                                    </div>
                                                )) : <div className="text-[10px] text-slate-400 italic px-2">No meetings today</div>}
                                            </div>

                                            {/* Today's Tasks */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between px-1">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tasks Due Today</div>
                                                    {report.todayTasks.length > 3 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setShowAllTodayTasks(!showAllTodayTasks); }}
                                                            className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-wider"
                                                        >
                                                            {showAllTodayTasks ? 'Show Less' : 'See More'}
                                                        </button>
                                                    )}
                                                </div>
                                                {report.todayTasks.length > 0 ? (showAllTodayTasks ? report.todayTasks : report.todayTasks.slice(0, 3)).map((t, i) => (
                                                    <div key={i} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border-l-2 border-indigo-400">
                                                        <div className="flex-1 text-[11px] font-bold text-slate-800 line-clamp-1">{t.name}</div>
                                                        <div className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${t.priority === 'Urgent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-600'}`}>
                                                            {t.priority}
                                                        </div>
                                                    </div>
                                                )) : <div className="text-[10px] text-slate-400 italic px-2">No tasks due today</div>}
                                            </div>

                                            {/* Upcoming Tasks */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between px-1">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Next 3 Days</div>
                                                    {report.upcomingTasks.length > 3 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setShowAllUpcomingTasks(!showAllUpcomingTasks); }}
                                                            className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-wider"
                                                        >
                                                            {showAllUpcomingTasks ? 'Show Less' : 'See More'}
                                                        </button>
                                                    )}
                                                </div>
                                                {report.upcomingTasks.length > 0 ? (showAllUpcomingTasks ? report.upcomingTasks : report.upcomingTasks.slice(0, 3)).map((t, i) => (
                                                    <div key={i} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border-l-2 border-slate-300">
                                                        <div className="flex-1 text-[11px] font-bold text-slate-800 line-clamp-1">{t.name}</div>
                                                        <div className="text-[9px] font-black text-slate-400 whitespace-nowrap">{t.dueDate}</div>
                                                    </div>
                                                )) : <div className="text-[10px] text-slate-400 italic px-2">No upcoming tasks</div>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Market Whisper / Red Flags */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 px-2">
                                            <i className="fa-solid fa-circle-exclamation text-red-500"></i>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Red Flags</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {report.redFlags.map((item, idx) => (
                                                <div key={idx} className="bg-white p-4 rounded-2xl border border-red-50 shadow-sm">
                                                    <div className="text-[11px] font-black text-slate-800">{item.name}</div>
                                                    <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed">
                                                        <span className="text-red-600 font-bold uppercase text-[8px] mr-1">Hook:</span>
                                                        "{item.hook}"
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Agent Pro Tip */}
                                    <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
                                        <i className="fa-solid fa-lightbulb absolute -right-4 -bottom-4 text-8xl text-indigo-500/30 group-hover:scale-110 transition-transform"></i>
                                        <div className="relative z-10">
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Agent Pro Tip</div>
                                            <p className="text-sm font-bold leading-relaxed">{report.proTip}</p>
                                        </div>
                                    </div>
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
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i>
                        Powered by Gemini 2.5 Flash Lite
                    </div>
                    <button onClick={onClose} className="text-xs font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest transition-colors">
                        Dismiss Report
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyPulseModal;
