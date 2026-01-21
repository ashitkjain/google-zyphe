import React, { useState } from 'react';
import { ChecklistCategory, PhaseSchedule } from '../../types/transaction';

// Timeline phases for transaction progress
export const timelinePhases = [
    { id: 1, name: 'Contract Review', icon: '📁', shortName: 'Contract' },
    { id: 2, name: 'Title & Ownership', icon: '🔍', shortName: 'Title' },
    { id: 3, name: 'Financing & Appraisal', icon: '🏦', shortName: 'Financing' },
    { id: 4, name: 'Inspections', icon: '🧪', shortName: 'Inspect' },
    { id: 5, name: 'Document Review', icon: '📜', shortName: 'Documents' },
    { id: 6, name: 'Final Coordination', icon: '📆', shortName: 'Final' },
    { id: 7, name: 'Closing Day', icon: '🗝️', shortName: 'Close' },
    { id: 8, name: 'Post-Closing', icon: '📦', shortName: 'Complete' },
];

// Phase colors for the calendar bars
export const phaseColors = [
    { bg: 'bg-indigo-100', bar: 'bg-gradient-to-r from-indigo-400 to-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700' },
    { bg: 'bg-purple-100', bar: 'bg-gradient-to-r from-purple-400 to-purple-500', border: 'border-purple-300', text: 'text-purple-700' },
    { bg: 'bg-blue-100', bar: 'bg-gradient-to-r from-blue-400 to-blue-500', border: 'border-blue-300', text: 'text-blue-700' },
    { bg: 'bg-cyan-100', bar: 'bg-gradient-to-r from-cyan-400 to-cyan-500', border: 'border-cyan-300', text: 'text-cyan-700' },
    { bg: 'bg-amber-100', bar: 'bg-gradient-to-r from-amber-400 to-amber-500', border: 'border-amber-300', text: 'text-amber-700' },
    { bg: 'bg-orange-100', bar: 'bg-gradient-to-r from-orange-400 to-orange-500', border: 'border-orange-300', text: 'text-orange-700' },
    { bg: 'bg-emerald-100', bar: 'bg-gradient-to-r from-emerald-400 to-emerald-500', border: 'border-emerald-300', text: 'text-emerald-700' },
    { bg: 'bg-rose-100', bar: 'bg-gradient-to-r from-rose-400 to-rose-500', border: 'border-rose-300', text: 'text-rose-700' },
];

export const getDefaultSchedule = (): PhaseSchedule[] => [
    { phaseId: 1, startDay: 0, duration: 3 },    // Contract Review: Days 1-3
    { phaseId: 2, startDay: 3, duration: 7 },    // Title & Ownership: Days 4-10
    { phaseId: 3, startDay: 5, duration: 14 },   // Financing & Appraisal: Days 6-19 (overlaps)
    { phaseId: 4, startDay: 7, duration: 10 },   // Inspections: Days 8-17 (overlaps)
    { phaseId: 5, startDay: 17, duration: 10 },  // Document Review: Days 18-27
    { phaseId: 6, startDay: 25, duration: 5 },   // Final Coordination: Days 26-30
    { phaseId: 7, startDay: 30, duration: 1 },   // Closing Day: Day 31
    { phaseId: 8, startDay: 31, duration: 7 },   // Post-Closing: Days 32-38
];

interface CommentModalData {
    phaseId: number;
    phaseName: string;
    tasks: { id: string; name: string }[];
}

interface TransactionTimelineProps {
    categories: ChecklistCategory[];
    onScrollToPhase?: (phaseIndex: number) => void;
    onAddComment?: (catId: string, taskId: string, comment: string) => void;
}

const TransactionTimeline: React.FC<TransactionTimelineProps> = ({
    categories,
    onScrollToPhase,
    onAddComment
}) => {
    // Contract start date (for demo, using today)
    const [contractStartDate] = useState(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    });

    const [schedule, setSchedule] = useState<PhaseSchedule[]>(getDefaultSchedule());
    const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
    const [dragging, setDragging] = useState<{ phaseId: number; edge: 'start' | 'end' } | null>(null);
    const [commentModal, setCommentModal] = useState<CommentModalData | null>(null);
    const [commentText, setCommentText] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');

    const handleBarDoubleClick = (phaseId: number, idx: number) => {
        const phase = timelinePhases[idx];
        const category = categories[idx];
        if (category) {
            setCommentModal({
                phaseId,
                phaseName: phase.name,
                tasks: category.tasks.map(t => ({ id: t.id, name: t.name }))
            });
            setSelectedTaskId(category.tasks[0]?.id || '');
            setCommentText('');
        }
    };

    const handleSubmitComment = () => {
        if (commentModal && selectedTaskId && commentText.trim()) {
            const catId = `c${commentModal.phaseId}`;
            onAddComment?.(catId, selectedTaskId, commentText.trim());
            setCommentModal(null);
            setCommentText('');
            setSelectedTaskId('');
        }
    };

    const totalDays = viewMode === 'week' ? 14 : 42;
    const dayWidth = viewMode === 'week' ? 60 : 28;

    const getDates = () => {
        const dates = [];
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(contractStartDate);
            date.setDate(date.getDate() + i);
            dates.push(date);
        }
        return dates;
    };

    const dates = getDates();

    const getCategoryProgress = (categoryIndex: number) => {
        if (categoryIndex >= categories.length) return { completed: 0, total: 0, percentage: 0 };
        const cat = categories[categoryIndex];
        const completed = cat.tasks.filter(t => t.status === 'Completed').length;
        const total = cat.tasks.length;
        return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
    };

    const handleMouseDown = (phaseId: number, edge: 'start' | 'end') => (e: React.MouseEvent) => {
        e.preventDefault();
        setDragging({ phaseId, edge });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragging) return;
        const container = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - container.left - 200; // Subtract label width
        const dayIndex = Math.max(0, Math.min(totalDays - 1, Math.floor(x / dayWidth)));

        setSchedule(prev => prev.map(s => {
            if (s.phaseId !== dragging.phaseId) return s;
            if (dragging.edge === 'start') {
                const newStart = Math.min(dayIndex, s.startDay + s.duration - 1);
                const newDuration = s.startDay + s.duration - newStart;
                return { ...s, startDay: newStart, duration: Math.max(1, newDuration) };
            } else {
                const newDuration = dayIndex - s.startDay + 1;
                return { ...s, duration: Math.max(1, newDuration) };
            }
        }));
    };

    const handleMouseUp = () => setDragging(null);

    const calculateProgress = () => {
        let totalTasks = 0;
        let completedTasks = 0;
        categories.forEach((cat) => {
            totalTasks += cat.tasks.length;
            completedTasks += cat.tasks.filter(t => t.status === 'Completed').length;
        });
        return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    };

    const overallProgress = calculateProgress();
    const formatDate = (date: Date) => date.getDate();
    const formatMonth = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' });
    const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
    const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5 overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <i className="fa-solid fa-calendar-days text-white text-lg"></i>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Transaction Timeline</h3>
                        <p className="text-xs font-medium text-slate-500">Drag bars to adjust schedule • Double click phase for notes</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            2 Weeks
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            6 Weeks
                        </button>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Progress</span>
                        <span className="text-lg font-black text-indigo-600">{overallProgress}%</span>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-x-auto cursor-default select-none" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <div className="min-w-max">
                    <div className="flex border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                        <div className="w-[200px] flex-shrink-0 px-4 py-3 border-r border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phase</span>
                        </div>
                        <div className="flex">
                            {dates.map((date, idx) => {
                                const showMonth = idx === 0 || date.getDate() === 1;
                                return (
                                    <div key={idx} style={{ width: dayWidth }} className={`flex-shrink-0 py-2 text-center border-r border-slate-50 ${isToday(date) ? 'bg-indigo-50' : isWeekend(date) ? 'bg-slate-50/80' : ''}`}>
                                        {showMonth && <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatMonth(date)}</div>}
                                        <div className={`text-xs font-bold ${isToday(date) ? 'text-indigo-600' : 'text-slate-600'}`}>{formatDate(date)}</div>
                                        {isToday(date) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mx-auto mt-0.5"></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {timelinePhases.map((phase, idx) => {
                        const phaseSchedule = schedule.find(s => s.phaseId === phase.id) || { startDay: 0, duration: 1 };
                        const progress = getCategoryProgress(idx);
                        const colors = phaseColors[idx % phaseColors.length];
                        return (
                            <div key={phase.id} className="flex border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                                <button onClick={() => onScrollToPhase?.(idx)} className="w-[200px] flex-shrink-0 px-4 py-4 border-r border-slate-100 text-left hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm">{phase.icon}</span>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-black text-slate-800 tracking-tight truncate">{phase.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="flex-1 h-1 w-16 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${colors.bar}`} style={{ width: `${progress.percentage}%` }}></div>
                                                </div>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase">{progress.percentage}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                                <div className="flex relative">
                                    <div
                                        onDoubleClick={() => handleBarDoubleClick(phase.id, idx)}
                                        className={`absolute h-8 top-1/2 -translate-y-1/2 rounded-xl border shadow-sm flex items-center px-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md z-10 ${colors.bg} ${colors.border}`}
                                        style={{ left: phaseSchedule.startDay * dayWidth, width: phaseSchedule.duration * dayWidth }}
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/5 rounded-l-xl" onMouseDown={handleMouseDown(phase.id, 'start')}></div>
                                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/5 rounded-r-xl" onMouseDown={handleMouseDown(phase.id, 'end')}></div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest truncate ${colors.text}`}>{phase.shortName}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Comment Modal */}
            {commentModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white animate-in zoom-in-95">
                        <div className="p-10">
                            <h3 className="text-xl font-black text-slate-900 mb-6">Add Note: {commentModal.phaseName}</h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Task</label>
                                    <select
                                        value={selectedTaskId}
                                        onChange={(e) => setSelectedTaskId(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                                    >
                                        {commentModal.tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Your Comment</label>
                                    <textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 min-h-[120px] outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex gap-4">
                                <button onClick={() => setCommentModal(null)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Cancel</button>
                                <button onClick={handleSubmitComment} disabled={!commentText.trim()} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50">Save Comment</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionTimeline;
