import React, { useState, useMemo } from 'react';
import { Lead, Transaction } from '../../types';
import TransactionTab from './TransactionTab';
import TransactionWizard from './TransactionWizard';

interface ClosingDashboardProps {
    leads: Lead[];
    onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void;
    realtorId: string;
}

interface DocItem {
    id: string;
    name: string;
    status: 'Pending' | 'Completed' | 'Rejected';
    comments: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Pending': return 'bg-orange-500';
        case 'Completed': return 'bg-emerald-500';
        case 'Rejected': return 'bg-rose-500';
        default: return 'bg-slate-500';
    }
};

const getStatusBadgeColor = (status: string) => {
    switch (status) {
        case 'Pending': return 'bg-rose-100 text-rose-600 border-rose-200';
        case 'Completed': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

// Default documentation checklist for a transaction
const getDefaultDocumentation = (): DocItem[] => [
    { id: 'doc_1', name: 'Purchase Contract', status: 'Pending', comments: '' },
    { id: 'doc_2', name: 'Listing Agreement', status: 'Pending', comments: '' },
    { id: 'doc_3', name: 'EMD', status: 'Pending', comments: '' },
    { id: 'doc_4', name: 'Disclosures', status: 'Pending', comments: '' },
    { id: 'doc_5', name: 'Inspections', status: 'Pending', comments: '' },
];

// Checklist category interface - moved up for use in TransactionTimeline
interface ChecklistCategory {
    id: string;
    name: string;
    icon: string;
    description: string;
    tasks: {
        id: string;
        name: string;
        status: 'Pending' | 'Completed' | 'Rejected';
        comments: string;
        emoji?: string;  // Optional emoji for the task
    }[];
}

// Timeline phases for transaction progress
const timelinePhases = [
    { id: 1, name: 'Contract Review', icon: '📁', shortName: 'Contract' },
    { id: 2, name: 'Title & Ownership', icon: '🔍', shortName: 'Title' },
    { id: 3, name: 'Financing & Appraisal', icon: '🏦', shortName: 'Financing' },
    { id: 4, name: 'Inspections', icon: '🧪', shortName: 'Inspect' },
    { id: 5, name: 'Document Review', icon: '📜', shortName: 'Documents' },
    { id: 6, name: 'Final Coordination', icon: '📆', shortName: 'Final' },
    { id: 7, name: 'Closing Day', icon: '🗝️', shortName: 'Close' },
    { id: 8, name: 'Post-Closing', icon: '📦', shortName: 'Complete' },
];

// Initial categories for the checklist
const getInitialCategories = (): ChecklistCategory[] => [
    {
        id: 'c1',
        name: '1. Contract & Initial Review',
        icon: '📁',
        description: 'Tasks that happen right after contract ratification and before ordering anything.',
        tasks: [
            { id: 't1_1', name: 'Review and understand the sales/purchase contract.', status: 'Pending', comments: '' },
            { id: 't1_2', name: 'Review the property survey (if available).', status: 'Pending', comments: '' },
            { id: 't1_3', name: 'Review and prepare seller disclosure documents.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c2',
        name: '2. Title & Ownership',
        icon: '🔍',
        description: 'Tasks focused on confirming title and ownership.',
        tasks: [
            { id: 't2_1', name: 'Obtain a clear title to the property.', status: 'Pending', comments: '' },
            { id: 't2_2', name: 'Conduct title search and resolve title issues.', status: 'Pending', comments: '' },
            { id: 't2_3', name: 'Verify title insurance details.', status: 'Pending', comments: '' },
            { id: 't2_4', name: 'Verify chain of title (ownership history).', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c3',
        name: '3. Financing & Appraisal',
        icon: '🏦',
        description: 'Tasks required for loan and valuation.',
        tasks: [
            { id: 't3_1', name: 'Coordinate with lender to ensure loan approval and funds disbursement.', status: 'Pending', comments: '' },
            { id: 't3_2', name: 'Order appraisal.', status: 'Pending', comments: '' },
            { id: 't3_3', name: 'Review appraisal report and approvals.', status: 'Pending', comments: '' },
            { id: 't3_4', name: "Verify buyer's financial approval and lender docs.", status: 'Pending', comments: '' },
            { id: 't3_5', name: "Confirm buyer obtains homeowner's insurance.", status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c4',
        name: '4. Inspections & Negotiations',
        icon: '🧪',
        description: 'Tasks that deal with property condition and repairs.',
        tasks: [
            { id: 't4_1', name: 'Schedule and conduct home inspection.', status: 'Pending', comments: '' },
            { id: 't4_2', name: 'Review inspection report; identify issues.', status: 'Pending', comments: '' },
            { id: 't4_3', name: 'Negotiate repair requests / price adjustments.', status: 'Pending', comments: '' },
            { id: 't4_4', name: 'Ensure agreed repairs are completed.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c5',
        name: '5. Document Review & Compliance',
        icon: '📜',
        description: 'Tasks where paperwork and legal docs must be checked.',
        tasks: [
            { id: 't5_1', name: 'Prepare and review all closing documents (HUD-1, disclosures, settlement).', status: 'Pending', comments: '' },
            { id: 't5_2', name: 'Review closing costs and verify accuracy.', status: 'Pending', comments: '' },
            { id: 't5_3', name: 'Review and sign all closing documents.', status: 'Pending', comments: '' },
            { id: 't5_4', name: 'Review and approve final settlement statement.', status: 'Pending', comments: '' },
            { id: 't5_5', name: 'Prepare deed, bill of sale, mortgage note, lien releases, title insurance docs.', status: 'Pending', comments: '' },
            { id: 't5_6', name: 'Verify HOA fees and property taxes are current.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c6',
        name: '6. Final Coordination & Checks',
        icon: '📆',
        description: 'Tasks that happen shortly before closing date.',
        tasks: [
            { id: 't6_1', name: 'Schedule final walk-through inspection.', status: 'Pending', comments: '' },
            { id: 't6_2', name: 'Confirm time and location of closing meeting.', status: 'Pending', comments: '' },
            { id: 't6_3', name: 'Arrange funds for closing (wire, certified check).', status: 'Pending', comments: '' },
            { id: 't6_4', name: 'Arrange utilities transfer/disconnection.', status: 'Pending', comments: '' },
            { id: 't6_5', name: 'Notify post office & relevant parties of address change.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c7',
        name: '7. Closing Day',
        icon: '🗝️',
        description: 'Tasks due on closing day itself.',
        tasks: [
            { id: 't7_1', name: 'Attend closing meeting with parties.', status: 'Pending', comments: '' },
            { id: 't7_2', name: 'Sign all documents and verify signatures.', status: 'Pending', comments: '' },
            { id: 't7_3', name: 'Disburse funds & record deed.', status: 'Pending', comments: '' },
            { id: 't7_4', name: 'Obtain keys, garage openers, manuals.', status: 'Pending', comments: '' },
        ]
    },
    {
        id: 'c8',
        name: '8. Post-Closing & Client Handoff',
        icon: '📦',
        description: 'Tasks after the deal is officially closed.',
        tasks: [
            { id: 't8_1', name: 'Provide buyer with warranties, manuals, local service info.', status: 'Pending', comments: '' },
            { id: 't8_2', name: 'Update your internal records with new ownership.', status: 'Pending', comments: '' },
            { id: 't8_3', name: 'Follow-up with lender, title, and client.', status: 'Pending', comments: '' },
            { id: 't8_4', name: 'Referral / thank-you outreach.', status: 'Pending', comments: '' },
        ]
    }
];

// Phase schedule interface for calendar view
interface PhaseSchedule {
    phaseId: number;
    startDay: number; // Day offset from contract start
    duration: number; // Duration in days
}

// Default schedule for a typical 30-45 day closing
const getDefaultSchedule = (): PhaseSchedule[] => [
    { phaseId: 1, startDay: 0, duration: 3 },    // Contract Review: Days 1-3
    { phaseId: 2, startDay: 3, duration: 7 },    // Title & Ownership: Days 4-10
    { phaseId: 3, startDay: 5, duration: 14 },   // Financing & Appraisal: Days 6-19 (overlaps)
    { phaseId: 4, startDay: 7, duration: 10 },   // Inspections: Days 8-17 (overlaps)
    { phaseId: 5, startDay: 17, duration: 10 },  // Document Review: Days 18-27
    { phaseId: 6, startDay: 25, duration: 5 },   // Final Coordination: Days 26-30
    { phaseId: 7, startDay: 30, duration: 1 },   // Closing Day: Day 31
    { phaseId: 8, startDay: 31, duration: 7 },   // Post-Closing: Days 32-38
];

// Phase colors for the calendar bars
const phaseColors = [
    { bg: 'bg-indigo-100', bar: 'bg-gradient-to-r from-indigo-400 to-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700' },
    { bg: 'bg-purple-100', bar: 'bg-gradient-to-r from-purple-400 to-purple-500', border: 'border-purple-300', text: 'text-purple-700' },
    { bg: 'bg-blue-100', bar: 'bg-gradient-to-r from-blue-400 to-blue-500', border: 'border-blue-300', text: 'text-blue-700' },
    { bg: 'bg-cyan-100', bar: 'bg-gradient-to-r from-cyan-400 to-cyan-500', border: 'border-cyan-300', text: 'text-cyan-700' },
    { bg: 'bg-amber-100', bar: 'bg-gradient-to-r from-amber-400 to-amber-500', border: 'border-amber-300', text: 'text-amber-700' },
    { bg: 'bg-orange-100', bar: 'bg-gradient-to-r from-orange-400 to-orange-500', border: 'border-orange-300', text: 'text-orange-700' },
    { bg: 'bg-emerald-100', bar: 'bg-gradient-to-r from-emerald-400 to-emerald-500', border: 'border-emerald-300', text: 'text-emerald-700' },
    { bg: 'bg-rose-100', bar: 'bg-gradient-to-r from-rose-400 to-rose-500', border: 'border-rose-300', text: 'text-rose-700' },
];

// Comment modal interface
interface CommentModalData {
    phaseId: number;
    phaseName: string;
    tasks: { id: string; name: string }[];
}

interface TransactionCalendarProps {
    categories: ChecklistCategory[];
    onScrollToPhase?: (phaseIndex: number) => void;
    onAddComment?: (catId: string, taskId: string, comment: string) => void;
}

const TransactionCalendar: React.FC<TransactionCalendarProps> = ({
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

    // Schedule state - allows realtor adjustment
    const [schedule, setSchedule] = useState<PhaseSchedule[]>(getDefaultSchedule());

    // View mode: 'week' or 'month'
    const [viewMode, setViewMode] = useState<'week' | 'month'>('month');

    // Dragging state for adjusting bars
    const [dragging, setDragging] = useState<{ phaseId: number; edge: 'start' | 'end' } | null>(null);

    // Comment modal state
    const [commentModal, setCommentModal] = useState<CommentModalData | null>(null);
    const [commentText, setCommentText] = useState('');
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');

    // Handle double-click on bar to add comment
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

    // Handle submit comment
    const handleSubmitComment = () => {
        if (commentModal && selectedTaskId && commentText.trim()) {
            const catId = `c${commentModal.phaseId}`;
            onAddComment?.(catId, selectedTaskId, commentText.trim());
            setCommentModal(null);
            setCommentText('');
            setSelectedTaskId('');
        }
    };


    // Calculate total days to show
    const totalDays = viewMode === 'week' ? 14 : 42;
    const dayWidth = viewMode === 'week' ? 60 : 28;

    // Generate dates for the calendar header
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

    // Calculate category completion
    const getCategoryProgress = (categoryIndex: number) => {
        if (categoryIndex >= categories.length) return { completed: 0, total: 0, percentage: 0 };
        const cat = categories[categoryIndex];
        const completed = cat.tasks.filter(t => t.status === 'Completed').length;
        const total = cat.tasks.length;
        return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
    };

    // Handle drag to adjust bar position
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

    const handleMouseUp = () => {
        setDragging(null);
    };

    // Calculate overall progress
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

    // Format date for display
    const formatDate = (date: Date) => date.getDate();
    const formatMonth = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' });
    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };
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
                        <p className="text-xs font-medium text-slate-500">Drag bars to adjust schedule • Click phase to view tasks</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex items-center bg-slate-100 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'week'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            2 Weeks
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'month'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            6 Weeks
                        </button>
                    </div>
                    {/* Overall Progress */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Progress</span>
                        <span className="text-lg font-black text-indigo-600">{overallProgress}%</span>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div
                className="overflow-x-auto cursor-default select-none"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div className="min-w-max">
                    {/* Date Header */}
                    <div className="flex border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
                        {/* Phase Label Column */}
                        <div className="w-[200px] flex-shrink-0 px-4 py-3 border-r border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phase</span>
                        </div>
                        {/* Date Columns */}
                        <div className="flex">
                            {dates.map((date, idx) => {
                                // Show month label at the start of each month
                                const showMonth = idx === 0 || date.getDate() === 1;
                                return (
                                    <div
                                        key={idx}
                                        style={{ width: dayWidth }}
                                        className={`flex-shrink-0 py-2 text-center border-r border-slate-50 ${isToday(date) ? 'bg-indigo-50' : isWeekend(date) ? 'bg-slate-50/80' : ''
                                            }`}
                                    >
                                        {showMonth && (
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                                {formatMonth(date)}
                                            </div>
                                        )}
                                        <div className={`text-xs font-bold ${isToday(date) ? 'text-indigo-600' : 'text-slate-600'
                                            }`}>
                                            {formatDate(date)}
                                        </div>
                                        {isToday(date) && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mx-auto mt-0.5"></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Phase Rows */}
                    {timelinePhases.map((phase, idx) => {
                        const phaseSchedule = schedule.find(s => s.phaseId === phase.id) || { startDay: 0, duration: 1 };
                        const progress = getCategoryProgress(idx);
                        const isCompleted = progress.total > 0 && progress.completed === progress.total;
                        const colors = phaseColors[idx % phaseColors.length];

                        return (
                            <div
                                key={phase.id}
                                className="flex border-b border-slate-50 hover:bg-slate-50/30 transition-colors group"
                            >
                                {/* Phase Label */}
                                <div
                                    className="w-[200px] flex-shrink-0 px-4 py-4 border-r border-slate-100 flex items-center gap-3 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                                    onClick={() => onScrollToPhase?.(idx)}
                                >
                                    <span className="text-lg">{phase.icon}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-slate-800 truncate">{phase.name}</div>
                                        <div className="text-[10px] font-medium text-slate-400">
                                            {progress.completed}/{progress.total} tasks
                                        </div>
                                    </div>
                                    {isCompleted && (
                                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                            <i className="fa-solid fa-check text-emerald-600 text-[8px]"></i>
                                        </div>
                                    )}
                                </div>

                                {/* Timeline Bar Area */}
                                <div className="flex relative" style={{ height: 60 }}>
                                    {/* Grid lines */}
                                    {dates.map((date, dateIdx) => (
                                        <div
                                            key={dateIdx}
                                            style={{ width: dayWidth }}
                                            className={`flex-shrink-0 border-r border-slate-50 ${isToday(date) ? 'bg-indigo-50/30' : isWeekend(date) ? 'bg-slate-50/50' : ''
                                                }`}
                                        />
                                    ))}

                                    {/* Phase Bar */}
                                    <div
                                        className={`absolute top-2.5 h-10 rounded-xl ${colors.bar} shadow-sm border border-white/10 flex items-center justify-between px-1 group/bar transition-all cursor-pointer hover:-translate-y-[1px] hover:shadow-md active:translate-y-0 ${dragging?.phaseId === phase.id ? 'ring-2 ring-indigo-400 ring-offset-1 scale-[1.01]' : ''
                                            }`}
                                        style={{
                                            left: phaseSchedule.startDay * dayWidth,
                                            width: phaseSchedule.duration * dayWidth - 4,
                                            minWidth: 40,
                                        }}
                                        onDoubleClick={() => handleBarDoubleClick(phase.id, idx)}
                                    >

                                        {/* Left drag handle */}
                                        <div
                                            className="w-2 h-full cursor-ew-resize flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity z-20"
                                            onMouseDown={handleMouseDown(phase.id, 'start')}
                                        >
                                            <div className="w-0.5 h-5 bg-white/50 rounded-full"></div>
                                        </div>

                                        {/* Progress indicator - subtle subtle tint */}
                                        {progress.percentage > 0 && progress.percentage < 100 && (
                                            <div
                                                className="absolute inset-0 rounded-xl bg-white/20 origin-left transition-all"
                                                style={{ transform: `scaleX(${progress.percentage / 100})` }}
                                            />
                                        )}

                                        {/* Bar Content - Stacked Layout */}
                                        <div className="flex-1 pl-3 pr-2 overflow-hidden flex flex-col items-start justify-center relative z-10 gap-0.5">




                                            {/* Comment Avatar Pill - Stacked below text */}
                                            {categories[idx]?.tasks.some(t => t.comments) && (
                                                <div className="relative group/comment -ml-1">
                                                    <div className="flex items-center gap-1.5 bg-slate-50/50 hover:bg-white p-0.5 px-1 rounded-full border border-slate-100/50 transition-all group-hover/comment:shadow-sm cursor-help">
                                                        <div className="flex -space-x-2 overflow-hidden scale-[0.65] origin-left">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center shadow-sm">
                                                                <i className="fa-solid fa-user text-[12px] text-indigo-500"></i>
                                                            </div>
                                                            <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center shadow-sm">
                                                                <i className="fa-solid fa-user-tie text-[12px] text-emerald-500"></i>
                                                            </div>
                                                            <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center shadow-sm">
                                                                <i className="fa-solid fa-user-pen text-[12px] text-amber-500"></i>
                                                            </div>
                                                        </div>
                                                        <span className="text-[8px] font-black text-slate-400 -ml-1 pr-1 truncate max-w-[100px]">
                                                            {categories[idx].tasks.filter(t => t.comments).length} updates
                                                        </span>
                                                    </div>

                                                    {/* Hover Overlay - Aligned to left of bar */}
                                                    <div className="absolute top-full left-0 mt-3 w-72 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-5 hidden group-hover/bar:block animate-in fade-in slide-in-from-top-3 duration-300 z-[70] origin-top-left">
                                                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                                                            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                                                                <i className="fa-solid fa-comments text-indigo-600 text-[12px]"></i>
                                                            </div>
                                                            <div>
                                                                <div className="text-[11px] font-black text-slate-900 uppercase tracking-widest text-left">Phase Updates</div>
                                                                <div className="text-[9px] text-slate-400 font-medium text-left">{categories[idx].tasks.filter(t => t.comments).length} discussion threads</div>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-4 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                                                            {categories[idx].tasks.filter(t => t.comments).map((t, tIdx) => (
                                                                <div key={t.id} className="flex gap-3">
                                                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] ${tIdx % 3 === 0 ? 'bg-indigo-50 text-indigo-500 border border-indigo-100' :
                                                                        tIdx % 3 === 1 ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' :
                                                                            'bg-amber-50 text-amber-500 border border-amber-100'
                                                                        }`}>
                                                                        <i className={`fa-solid ${tIdx % 4 === 0 ? 'fa-message' :
                                                                            tIdx % 4 === 1 ? 'fa-note-sticky' :
                                                                                tIdx % 4 === 2 ? 'fa-comment-dots' :
                                                                                    'fa-pencil'
                                                                            }`}></i>
                                                                    </div>
                                                                    <div className="space-y-1.5 flex-1 min-w-0">
                                                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider leading-tight text-left truncate">{t.name}</div>
                                                                        <div className="text-[12px] font-medium text-slate-600 bg-slate-50/80 p-3 rounded-2xl leading-relaxed text-left border border-slate-100/50">
                                                                            {t.comments}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Decorative arrow */}
                                                        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-l border-t border-slate-100 rotate-45"></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right drag handle */}
                                        <div
                                            className="w-2 h-full cursor-ew-resize flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity z-20"
                                            onMouseDown={handleMouseDown(phase.id, 'end')}
                                        >
                                            <div className="w-0.5 h-5 bg-white/50 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer Legend */}
            <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-3 rounded bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-3 rounded bg-slate-200"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weekend</span>
                    </div>
                </div>
                <button
                    onClick={() => setSchedule(getDefaultSchedule())}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-2"
                >
                    <i className="fa-solid fa-rotate-left"></i>
                    Reset to Default
                </button>
            </div>

            {/* Comment Modal */}
            {commentModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                        <div className="px-10 pt-10 pb-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                        <i className="fa-solid fa-comment-dots text-indigo-600 text-xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Add Phase Comment</h3>
                                        <p className="text-sm font-medium text-slate-500">For {commentModal.phaseName}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setCommentModal(null)}
                                    className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
                                >
                                    <i className="fa-solid fa-xmark text-lg"></i>
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Specific Task (Optional)</label>
                                    <select
                                        value={selectedTaskId}
                                        onChange={(e) => setSelectedTaskId(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">General Phase Comment</option>
                                        {commentModal.tasks.map(task => (
                                            <option key={task.id} value={task.id}>{task.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Your Comment</label>
                                    <textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Add notes, updates or instructions..."
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 transition-all min-h-[120px] resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() => setCommentModal(null)}
                                className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitComment}
                                disabled={!commentText.trim()}
                                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Comment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const ClosingDashboard: React.FC<ClosingDashboardProps> = ({ leads, onUpdateLead, realtorId }) => {
    const [showWizard, setShowWizard] = useState(false);
    // Filter leads that are in closing stage (funnelStage === 'Contract' or status === 'In Contract')
    const closingLeads = useMemo(() => {
        return leads.filter(lead =>
            lead.funnelStage === 'Contract' ||
            lead.status === 'In Contract'
        );
    }, [leads]);

    const [activeLeadId, setActiveLeadId] = useState<string | null>(
        closingLeads.length > 0 ? closingLeads[0].id : null
    );

    // Update activeLeadId when closingLeads changes
    React.useEffect(() => {
        if (closingLeads.length > 0) {
            if (!activeLeadId || !closingLeads.find(l => l.id === activeLeadId)) {
                setActiveLeadId(closingLeads[0].id);
            }
        } else {
            setActiveLeadId(null);
        }
    }, [closingLeads, activeLeadId]);

    const activeLead = closingLeads.find(l => l.id === activeLeadId) || null;

    const [activeSubTab, setActiveSubTab] = useState('CHECKLIST');

    const subTabs = ['TRANSACTION', 'CONTACTS', 'COMMISSION', 'CHECKLIST', 'DOCUMENTS', 'LOG', 'TASKS', 'PROPERTY'];

    // Checklist categories state - shared between Timeline and ChecklistSection
    const [categories, setCategories] = useState<ChecklistCategory[]>(getInitialCategories());

    // Manual phase override state - allows agent to manually control the timeline
    const [manualPhaseOverride, setManualPhaseOverride] = useState<number | null>(null);

    // Expanded categories state for the checklist
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['c1']));

    // Scroll to a specific phase/category in the checklist
    const handleScrollToPhase = (phaseIndex: number) => {
        setActiveSubTab('CHECKLIST');
        const categoryId = `c${phaseIndex + 1}`;
        setExpandedCategories(prev => new Set([...prev, categoryId]));
        // Scroll to the category element after a brief delay to allow render
        setTimeout(() => {
            const element = document.getElementById(`category-${categoryId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };

    const toggleCategory = (id: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const updateTaskStatus = (catId: string, taskId: string, status: 'Pending' | 'Completed' | 'Rejected') => {
        setCategories(prev => prev.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                tasks: cat.tasks.map(t => t.id === taskId ? { ...t, status } : t)
            };
        }));
    };

    const addTaskComment = (catId: string, taskId: string, comment: string) => {
        setCategories(prev => prev.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                tasks: cat.tasks.map(t => t.id === taskId ? { ...t, comments: comment } : t)
            };
        }));
    };

    const updateTaskEmoji = (catId: string, taskId: string, emoji: string) => {
        setCategories(prev => prev.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                tasks: cat.tasks.map(t => t.id === taskId ? { ...t, emoji } : t)
            };
        }));
    };

    // Empty state when no clients in closing
    if (closingLeads.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center mb-8 border border-slate-200">
                        <i className="fa-solid fa-file-invoice-dollar text-5xl text-slate-300"></i>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">No Clients In Closing</h2>
                    <p className="text-slate-500 text-lg max-w-md mb-8">
                        When clients move to the "In Contract" status, they will appear here for transaction management.
                    </p>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                        <i className="fa-solid fa-lightbulb text-amber-400"></i>
                        <span>Move a client to "In Contract" status in the Funnel tab to get started</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Client Tabs */}
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {closingLeads.map(lead => (
                        <button
                            key={lead.id}
                            onClick={() => setActiveLeadId(lead.id)}
                            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border-2 transition-all flex-shrink-0 group ${activeLeadId === lead.id
                                ? 'bg-white border-indigo-500 shadow-lg shadow-indigo-500/10'
                                : 'bg-white/50 border-slate-200 hover:border-slate-300 hover:bg-white'
                                }`}
                        >
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white shadow-sm flex-shrink-0">
                                {lead.avatarUrl ? (
                                    <img src={lead.avatarUrl} alt={lead.firstName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                        {lead.firstName?.charAt(0) || ''}{lead.lastName?.charAt(0) || ''}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col items-start">
                                <span className={`font-bold text-sm tracking-tight ${activeLeadId === lead.id ? 'text-slate-900' : 'text-slate-600'}`}>
                                    {lead.firstName} {lead.lastName}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                    {lead.leadType}
                                </span>
                            </div>
                            {activeLeadId === lead.id && (
                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse ml-1"></div>
                            )}
                        </button>
                    ))}
                </div>

                {activeLead && (
                    <>
                        {/* Header Section */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-8">
                                {/* Client Info Block */}
                                <div className="flex items-center gap-4 border-r border-slate-200 pr-8">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-xl flex-shrink-0 relative group cursor-pointer">
                                        {activeLead.avatarUrl ? (
                                            <img src={activeLead.avatarUrl} alt={activeLead.firstName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                                                {activeLead.firstName?.charAt(0) || ''}{activeLead.lastName?.charAt(0) || ''}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                                                {activeLead.firstName} {activeLead.lastName}
                                            </h1>
                                            {activeLead.clientId && (
                                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono font-bold text-slate-500 tracking-tight">
                                                    {activeLead.clientId}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mailing Address</p>
                                        <p className="text-xs text-slate-500 font-medium max-w-[200px] leading-tight">
                                            {activeLead.homeAddress || activeLead.propertyAddress || 'No address provided'}
                                        </p>
                                    </div>
                                </div>

                                {/* Property Info Block */}
                                <div className="flex items-center gap-6">
                                    <div className="w-24 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-xl flex-shrink-0 relative group bg-slate-100 flex items-center justify-center">
                                        <i className="fa-solid fa-home text-2xl text-slate-300"></i>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                                {activeLead.subjectProperty || activeLead.propertyAddress || 'Property TBD'}
                                            </h2>
                                            <span className={`px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-white ${getStatusColor('Pending')}`}>
                                                {activeLead.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">
                                            {activeLead.leadType} Transaction
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button className="flex items-center gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Transaction Actions</span>
                                <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 group-hover:translate-y-0.5 transition-transform"></i>
                            </button>
                        </div>

                        {/* Transaction Calendar Timeline */}
                        <TransactionCalendar
                            categories={categories}
                            onScrollToPhase={handleScrollToPhase}
                            onAddComment={addTaskComment}
                        />

                        {/* Sub Navigation */}
                        <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
                            {subTabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveSubTab(tab)}
                                    className={`px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeSubTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab}
                                    {activeSubTab === tab && (
                                        <div className="absolute bottom-0 left-6 right-6 h-1 bg-indigo-600 rounded-t-full shadow-[0_-2px_8px_rgba(79,70,229,0.3)]"></div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Details Grid - Hide on Transaction Tab (as it has its own) */}
                        {activeSubTab !== 'TRANSACTION' && (
                            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5 p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
                                <div className="space-y-6">
                                    <DetailItem label="SUBJECT PROPERTY" value={activeLead.subjectProperty || activeLead.propertyAddress || 'TBD'} />
                                    <DetailItem label="ACCEPTANCE DATE" value={activeLead.stageLastChangedAt ? new Date(activeLead.stageLastChangedAt).toLocaleDateString() : '--'} />
                                    <DetailItem label="PROPERTY TYPE" value={activeLead.propertyType || '--'} />
                                </div>
                                <div className="space-y-6">
                                    <DetailItem label="CLIENT NAME" value={`${activeLead.firstName} ${activeLead.lastName}`} />
                                    <DetailItem label="PHONE" value={activeLead.phone || '--'} />
                                    <DetailItem label="TYPE" value={activeLead.leadType} />
                                </div>
                                <div className="space-y-6">
                                    <DetailItem label="CLOSE OF ESCROW" value="TBD" />
                                    <DetailItem label="EMAIL" value={activeLead.email || '--'} isLink />
                                    <DetailItem label="MLS NUMBER" value={activeLead.mlsNumber || '--'} />
                                </div>
                                <div className="space-y-6">
                                    <DetailItem label="PRICE" value={activeLead.price ? `$${activeLead.price.toLocaleString()}` : '--'} />
                                    <DetailItem label="BEDROOMS" value={activeLead.bedrooms?.toString() || '--'} />
                                </div>
                                <div className="space-y-6">
                                    <DetailItem label="BATHROOMS" value={activeLead.bathrooms?.toString() || '--'} />
                                    <DetailItem label="SQ FT" value={activeLead.sqft?.toString() || '--'} />
                                </div>
                            </div>
                        )}

                        {/* Toolbar Actions */}
                        <div className="flex flex-wrap items-center gap-3 py-4">
                            <ActionButton color="bg-indigo-600" icon="fa-house-shield" label="Order Home Warranty" />
                            <ActionButton color="bg-indigo-600" icon="fa-file-shield" label="Order NHD" />
                            <ActionButton color="bg-indigo-600" icon="fa-money-bill-transfer" label="Get Paid Now!" />

                            <div className="h-10 w-px bg-slate-200 mx-2"></div>

                            <DropdownButton label="Checked" />
                            <DropdownButton label="Update Agent" />
                            <DropdownButton label="Docs to Review" badge="0" />

                            <button className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                                <i className="fa-solid fa-bullhorn"></i>
                            </button>
                        </div>

                        {/* Documentation / Checklist Section */}
                        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5 overflow-hidden">
                            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                        {activeSubTab === 'CHECKLIST' ? 'Transaction Checklist' :
                                            activeSubTab === 'TRANSACTION' ? 'Transaction Record' :
                                                'Documentation'}
                                    </h2>
                                    <button
                                        onClick={() => setShowWizard(true)}
                                        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                                    >
                                        <i className="fa-solid fa-plus"></i>
                                        <span className="font-bold">New</span>
                                    </button>
                                </div>
                            </div>

                            <div className="p-10">
                                {activeSubTab === 'TRANSACTION' && (
                                    <TransactionTab lead={activeLead} realtorId={realtorId} />
                                )}

                                {activeSubTab === 'CHECKLIST' && (
                                    <ChecklistSection
                                        categories={categories}
                                        expandedCategories={expandedCategories}
                                        onToggleCategory={toggleCategory}
                                        onUpdateTaskStatus={updateTaskStatus}
                                        onUpdateTaskEmoji={updateTaskEmoji}
                                        onUpdateTaskComment={addTaskComment}
                                    />
                                )}

                                {activeSubTab !== 'CHECKLIST' && activeSubTab !== 'TRANSACTION' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                                <tr>
                                                    <th className="px-10 py-5 w-20">#</th>
                                                    <th className="px-10 py-5">Documentation</th>
                                                    <th className="px-10 py-5">Status</th>
                                                    <th className="px-10 py-5 text-center">Docs</th>
                                                    <th className="px-10 py-5">Comments</th>
                                                    <th className="px-10 py-5 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {getDefaultDocumentation().map((doc, idx) => (
                                                    <tr key={doc.id} className="group hover:bg-slate-50/50 transition-all">
                                                        <td className="px-10 py-6 text-sm font-black text-slate-300">{idx + 1}.</td>
                                                        <td className="px-10 py-6 text-sm font-bold text-slate-800">{doc.name}</td>
                                                        <td className="px-10 py-6">
                                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusBadgeColor(doc.status)}`}>
                                                                {doc.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-10 py-6 text-center">
                                                            <button className="text-slate-400 hover:text-indigo-600 transition-all p-2 rounded-xl hover:bg-indigo-50">
                                                                <i className="fa-solid fa-paperclip text-lg"></i>
                                                            </button>
                                                        </td>
                                                        <td className="px-10 py-6">
                                                            <input
                                                                type="text"
                                                                placeholder="Add a comment..."
                                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                                            />
                                                        </td>
                                                        <td className="px-10 py-6 text-right">
                                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-600/20">Save</button>
                                                                <button className="px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50">Cancel</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
            {showWizard && (
                <TransactionWizard
                    leads={leads}
                    realtorId={realtorId}
                    onClose={() => setShowWizard(false)}
                    onComplete={(tx) => {
                        setShowWizard(false);
                        // In a real app we might redirect or refresh
                        alert(`Transaction ${tx.id} created successfully!`);
                    }}
                />
            )}
        </div >
    );
};

interface ChecklistSectionProps {
    categories: ChecklistCategory[];
    expandedCategories: Set<string>;
    onToggleCategory: (id: string) => void;
    onUpdateTaskStatus: (catId: string, taskId: string, status: 'Pending' | 'Completed' | 'Rejected') => void;
    onUpdateTaskEmoji?: (catId: string, taskId: string, emoji: string) => void;
    onUpdateTaskComment?: (catId: string, taskId: string, comment: string) => void;
}

const commonEmojis = ['✅', '🚧', '❗', '📍', '🏠', '🔑', '📝', '📞', '💰', '📅', '🎉'];

const ChecklistSection: React.FC<ChecklistSectionProps> = ({
    categories,
    expandedCategories,
    onToggleCategory,
    onUpdateTaskStatus,
    onUpdateTaskEmoji,
    onUpdateTaskComment
}) => {
    return (
        <div className="space-y-6 text-left">
            {categories.map(cat => (
                <div
                    key={cat.id}
                    id={`category-${cat.id}`}
                    className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm scroll-mt-4"
                >
                    <button
                        onClick={() => onToggleCategory(cat.id)}
                        className={`w-full px-8 py-6 flex items-center justify-between transition-all ${expandedCategories.has(cat.id) ? 'bg-indigo-50/30' : 'bg-white hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4 text-left">
                            <span className="text-2xl">{cat.icon}</span>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">{cat.name}</h3>
                                <p className="text-xs font-medium text-slate-500 mt-0.5">{cat.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end mr-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
                                <span className="text-sm font-black text-indigo-600">
                                    {cat.tasks.filter(t => t.status === 'Completed').length}/{cat.tasks.length}
                                </span>
                            </div>
                            {/* Completion badge */}
                            {cat.tasks.length > 0 && cat.tasks.every(t => t.status === 'Completed') && (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                                    ✓ Complete
                                </span>
                            )}
                            <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 ${expandedCategories.has(cat.id) ? 'rotate-180' : ''}`}></i>
                        </div>
                    </button>

                    {expandedCategories.has(cat.id) && (
                        <div className="border-t border-slate-100 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-3 w-16 text-center">Icon</th>
                                        <th className="px-8 py-3 w-16">Status</th>
                                        <th className="px-8 py-3">Task Description</th>
                                        <th className="px-8 py-3">Comments</th>
                                        <th className="px-8 py-3 text-right">Update</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {cat.tasks.map(task => (
                                        <tr key={task.id} className="group hover:bg-slate-50/30">
                                            <td className="px-8 py-6">
                                                <div className="relative flex justify-center group/emoji">
                                                    <button className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg hover:border-indigo-500 transition-all">
                                                        {task.emoji || '+'}
                                                    </button>
                                                    {/* Simple emoji picker on hover */}
                                                    <div className="absolute top-0 left-full ml-2 z-20 hidden group-hover/emoji:flex items-center gap-1 bg-white p-2 rounded-xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-left-2">
                                                        {commonEmojis.map(emoji => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => onUpdateTaskEmoji?.(cat.id, task.id, emoji)}
                                                                className="w-8 h-8 rounded-lg hover:bg-indigo-50 flex items-center justify-center transition-colors"
                                                            >
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => onUpdateTaskEmoji?.(cat.id, task.id, '')}
                                                            className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-rose-500 transition-colors"
                                                        >
                                                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mx-auto ${task.status === 'Completed' ? 'bg-emerald-100 border-emerald-500 text-emerald-600' :
                                                    task.status === 'Rejected' ? 'bg-rose-100 border-rose-500 text-rose-600' :
                                                        'bg-orange-50 border-orange-200 text-orange-400'
                                                    }`}>
                                                    <i className={`fa-solid ${task.status === 'Completed' ? 'fa-check' :
                                                        task.status === 'Rejected' ? 'fa-xmark' :
                                                            'fa-clock'
                                                        } text-xs`}></i>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <p className={`text-sm font-bold ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                                                        {task.name}
                                                    </p>
                                                    {task.comments && (
                                                        <div className="relative group/taskcomment">
                                                            <div className="flex items-center gap-1.5 text-indigo-500 animate-in fade-in slide-in-from-left-1 duration-300 cursor-help">
                                                                <i className="fa-solid fa-comment-dots text-[10px]"></i>
                                                                <span className="text-[10px] font-black uppercase tracking-widest">Commented</span>
                                                            </div>

                                                            {/* Hover Overlay for Task Comment */}
                                                            <div className="absolute bottom-full left-0 mb-3 w-72 bg-slate-900 text-white rounded-2xl shadow-2xl p-4 hidden group-hover/taskcomment:block animate-in fade-in slide-in-from-bottom-2 duration-200 z-[60]">
                                                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50">
                                                                    <i className="fa-solid fa-quote-left text-indigo-400 text-xs"></i>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Task Note</span>
                                                                </div>
                                                                <p className="text-xs font-medium leading-relaxed text-slate-200">
                                                                    {task.comments}
                                                                </p>
                                                                <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-slate-900 rotate-45"></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <input
                                                    type="text"
                                                    value={task.comments}
                                                    onChange={(e) => onUpdateTaskComment?.(cat.id, task.id, e.target.value)}
                                                    placeholder="Task notes..."
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-slate-700 hover:bg-white"
                                                />
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => onUpdateTaskStatus(cat.id, task.id, 'Completed')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Completed' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500'}`}
                                                        title="Complete"
                                                    >
                                                        <i className="fa-solid fa-check text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateTaskStatus(cat.id, task.id, 'Rejected')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Rejected' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-rose-500 hover:text-rose-500'}`}
                                                        title="Reject"
                                                    >
                                                        <i className="fa-solid fa-xmark text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => onUpdateTaskStatus(cat.id, task.id, 'Pending')}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${task.status === 'Pending' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-orange-500 hover:text-orange-500'}`}
                                                        title="Set Pending"
                                                    >
                                                        <i className="fa-solid fa-clock text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const DetailItem: React.FC<{ label: string; value: string; isLink?: boolean }> = ({ label, value, isLink }) => (
    <div className="flex flex-col gap-1.5 min-w-0">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
        <span className={`text-[13px] font-bold tracking-tight truncate ${isLink ? 'text-indigo-600 hover:underline cursor-pointer' : 'text-slate-800'}`}>
            {value}
        </span>
    </div>
);

const ActionButton: React.FC<{ color: string; icon: string; label: string }> = ({ color, icon, label }) => (
    <button className={`flex items-center gap-3 px-6 py-3 ${color} text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all group`}>
        <i className={`fa-solid ${icon} text-sm group-hover:scale-110 transition-transform`}></i>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
);

const DropdownButton: React.FC<{ label: string; badge?: string }> = ({ label, badge }) => (
    <button className="flex items-center gap-4 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all group">
        <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{label}</span>
            {badge && badge !== '0' && (
                <span className="bg-rose-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full">
                    {badge}
                </span>
            )}
        </div>
        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 group-hover:translate-y-0.5 transition-transform"></i>
    </button>
);

export default ClosingDashboard;
