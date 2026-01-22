import React, { useMemo, useState } from 'react';
import { ChecklistCategory } from '../../types/transaction';

interface GanttChartProps {
    categories: ChecklistCategory[];
    startDate?: Date;
    onTaskStatusChange?: (catId: string, taskId: string, newStatus: 'Pending' | 'Completed') => void;
    onAddComment?: (catId: string, taskId: string, comment: string) => void;
    onUpdateTask?: (catId: string, taskId: string, updates: { name?: string; comment?: string; startDate?: Date; dueDate?: Date }) => void;
}

interface ProcessedTask {
    id: string;
    name: string;
    catId: string;
    catName: string;
    catColor: string;
    startDay: number;
    duration: number;
    endDay: number;
    dependsOn: string[];
    row: number;
    status: 'Pending' | 'Completed' | 'Rejected';
    comments?: string;
    type: 'task';
    rawTask: any;
}

interface CategoryBar {
    id: string;
    name: string;
    color: string;
    startDay: number;
    endDay: number;
    duration: number;
    progress: number;
    row: number;
    dependsOn: string[]; // Category IDs
    rawCategory: ChecklistCategory;
    hasComments?: boolean;
    type: 'category';
}

type VisibleItem = CategoryBar | ProcessedTask;

const CATEGORY_COLORS = [
    'bg-sky-500', // Standardizing on Blue theme per reference image request
    'bg-sky-600',
    'bg-blue-500',
    'bg-blue-600',
];

const GanttChart: React.FC<GanttChartProps> = ({ categories, startDate, onTaskStatusChange, onAddComment, onUpdateTask }) => {
    const [zoom, setZoom] = useState<'day' | 'week'>('week');
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['c1']));
    const [editModal, setEditModal] = useState<{
        isOpen: boolean;
        catId: string;
        taskId: string;
        taskName: string;
        currentComment: string;
        startDate: string; // YYYY-MM-DD
        dueDate: string;   // YYYY-MM-DD
    } | null>(null);
    const [dateError, setDateError] = useState<string | null>(null);

    // Determine chart start date based on earliest task
    const chartStartDate = useMemo(() => {
        let baseDate = (startDate && !isNaN(startDate.getTime()) && startDate.getFullYear() > 2000) ? new Date(startDate) : new Date();
        let earliest = new Date(baseDate);

        categories.forEach(cat => {
            cat.tasks.forEach(t => {
                const d = t.startDate?.toDate ? t.startDate.toDate() : (t.startDate ? new Date(t.startDate) : null);
                if (d && !isNaN(d.getTime())) {
                    if (d < earliest) earliest = d;
                }
            });
        });

        // Snap to Sunday to ensure Week 1 aligns with the creation week
        const sunday = new Date(earliest);
        sunday.setDate(sunday.getDate() - sunday.getDay());
        sunday.setHours(0, 0, 0, 0);
        return sunday;
    }, [categories, startDate]);

    // 1. Core Scheduling Logic (Global)
    const { globalTaskMap, globalCategoryBars } = useMemo(() => {
        const tasks: ProcessedTask[] = [];
        const taskMap = new Map<string, ProcessedTask>();

        // Flatten tasks and initialize days using persisted dates if available
        categories.forEach((cat, catIdx) => {
            const colorClass = 'bg-indigo-500';
            cat.tasks.forEach(task => {
                const sDate = task.startDate?.toDate ? task.startDate.toDate() : new Date(task.startDate);
                const eDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);

                let startDay = 0;
                let duration = task.durationDays || 1;

                if (sDate && !isNaN(sDate.getTime())) {
                    startDay = Math.floor((sDate.getTime() - chartStartDate.getTime()) / (1000 * 60 * 60 * 24));
                }

                if (eDate && !isNaN(eDate.getTime()) && sDate && !isNaN(sDate.getTime())) {
                    duration = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)));
                }

                const newTask: ProcessedTask = {
                    id: task.id,
                    name: task.name,
                    catId: cat.id,
                    catName: cat.name,
                    catColor: colorClass,
                    startDay,
                    duration,
                    endDay: startDay + duration,
                    dependsOn: task.dependsOn || [],
                    row: 0,
                    status: task.status,
                    comments: task.comments,
                    type: 'task',
                    rawTask: task
                };
                tasks.push(newTask);
                taskMap.set(task.id, newTask);
            });
        });

        // 2. Fallback dependency resolution (only if dates are missing or for non-persisted tasks)
        // Check if we actually have any persisted dates
        const hasPersistedDates = Array.from(taskMap.values()).some(t => t.rawTask.startDate);

        if (!hasPersistedDates) {
            let changed = true;
            let iter = 0;
            while (changed && iter < tasks.length) {
                changed = false;
                tasks.forEach(task => {
                    let maxDepEnd = 0;
                    task.dependsOn.forEach(depId => {
                        const dep = taskMap.get(depId);
                        if (dep) maxDepEnd = Math.max(maxDepEnd, dep.endDay);
                    });
                    if (task.startDay !== maxDepEnd) {
                        task.startDay = maxDepEnd;
                        task.endDay = task.startDay + task.duration;
                        changed = true;
                    } else {
                        task.endDay = task.startDay + task.duration;
                    }
                });
                iter++;
            }
        }

        // Create Category Bars (Aggregates)
        const catBars = categories.map((cat, idx) => {
            const catTasks = cat.tasks.map(t => taskMap.get(t.id)).filter(Boolean) as ProcessedTask[];
            // Inferred dependencies
            const depCatIds = new Set<string>();
            catTasks.forEach(t => {
                t.dependsOn.forEach(depId => {
                    const depTask = taskMap.get(depId);
                    if (depTask && depTask.catId !== cat.id) depCatIds.add(depTask.catId);
                });
            });

            const start = catTasks.length ? Math.min(...catTasks.map(t => t.startDay)) : 0;
            const end = catTasks.length ? Math.max(...catTasks.map(t => t.endDay)) : 1;
            const progress = catTasks.length ? Math.round((catTasks.filter(t => t.status === 'Completed').length / catTasks.length) * 100) : 0;
            const hasComments = catTasks.some(t => t.comments && t.comments.trim().length > 0);

            return {
                id: cat.id,
                name: cat.name,
                color: 'bg-indigo-200', // Reference style: Light blue for group
                startDay: start,
                endDay: end,
                duration: end - start,
                progress,
                row: 0, // Assigned later
                dependsOn: Array.from(depCatIds),
                rawCategory: cat,
                hasComments,
                type: 'category'
            } as CategoryBar;
        });

        return { globalTaskMap: taskMap, globalCategoryBars: catBars };
    }, [categories]);


    // 2. Build Visible List (Tree Flattening)
    const visibleItems = useMemo(() => {
        const items: VisibleItem[] = [];
        let currentRow = 0;

        // Sort categories by start date
        const sortedCats = [...globalCategoryBars].sort((a, b) => a.startDay - b.startDay);

        sortedCats.forEach((cat, index) => {
            // Add Category Header
            // We use a "Part 1, Part 2" numbering style per reference or just index
            items.push({ ...cat, row: currentRow++ });

            // If expanded, add children
            if (expandedIds.has(cat.id)) {
                const catTasks = cat.rawCategory.tasks
                    .map(t => globalTaskMap.get(t.id))
                    .filter(Boolean) as ProcessedTask[];

                // Sort tasks by start date
                catTasks.sort((a, b) => a.startDay - b.startDay);

                catTasks.forEach(task => {
                    items.push({ ...task, row: currentRow++ });
                });
            }
        });

        return items;
    }, [globalCategoryBars, globalTaskMap, expandedIds]);


    // 3. Helper to toggle expand
    const toggleExpand = (catId: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    };

    // --- Rendering Config ---
    // --- Rendering Config ---
    const rowHeight = 60; // Increased to fit wrapped text
    const headerHeight = 60; // 2 rows of headers
    const taskBarHeight = 18; // DENSE
    const dayWidth = zoom === 'day' ? 46 : 20; // Increased to ensure content fills screen naturally

    const getDateLabel = (dayIndex: number) => {
        const d = new Date(chartStartDate);
        d.setDate(d.getDate() + dayIndex);
        return {
            fullDate: d,
            day: d.getDate(),
            month: d.toLocaleDateString('en-US', { month: 'short' }),
            year: d.getFullYear(),
            isWeekend: d.getDay() === 0 || d.getDay() === 6
        };
    };

    // Calculate view boundaries based on VISIBLE content
    const maxEnd = visibleItems.length ? Math.max(...visibleItems.map(i => i.endDay)) : 30;
    const endBuffer = 1;

    // Start from the beginning of the project (Day 0) to ensure Weeks 1, 2, 3 are visible
    const viewStartDay = 0;
    const viewEndDay = maxEnd + endBuffer + 7; // Add a week of padding at the end

    // Width is strictly content-based
    const totalWidth = (viewEndDay - viewStartDay) * dayWidth;
    const totalHeight = Math.max(visibleItems.length * rowHeight, 400); // Min height


    return (
        <div className="flex flex-col h-[700px] bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-indigo-500/5 overflow-hidden font-sans relative text-sm">
            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-20">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
                        <i className="fa-solid fa-list-check text-white text-sm"></i>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800 tracking-tight">Closing Checklist and Schedule</h3>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setZoom('week')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${zoom === 'week' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Weekly</button>
                    <button onClick={() => setZoom('day')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${zoom === 'day' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Daily</button>
                </div>
            </div>

            <div className="flex-1 overflow-auto relative custom-scrollbar bg-white">
                <div className="relative min-w-max" style={{ width: totalWidth + 300, height: totalHeight + headerHeight }}>

                    {/* Grid & Header */}
                    <div className="absolute top-0 left-[300px] right-0 bottom-0">
                        {/* Header */}
                        <div className="h-[60px] border-b border-slate-200 flex flex-col sticky top-0 bg-white z-40 w-full shadow-sm">
                            {/* Month Row */}
                            <div className="flex-1 flex border-b border-slate-100">
                                {/* We need to span months. A simple way: render every day and check if month changes. */}
                                {Array.from({ length: viewEndDay - viewStartDay }).map((_, i) => {
                                    const dayIndex = viewStartDay + i;
                                    const { day, month, year } = getDateLabel(dayIndex);
                                    // Show label if day 1 or index 0
                                    const showLabel = i === 0 || day === 1;
                                    return (
                                        <div key={`m-${dayIndex}`} style={{ width: dayWidth }} className="flex-shrink-0 relative">
                                            {showLabel && (
                                                <div className="absolute left-0 top-0 bottom-0 pl-2 flex items-center whitespace-nowrap z-20">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{month} {year}</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            {/* Day Row (Now Weekly Headers) */}
                            <div className="flex-1 flex relative overflow-hidden">
                                {Array.from({ length: viewEndDay - viewStartDay }).map((_, i) => {
                                    const dayIndex = viewStartDay + i;
                                    const { fullDate, isWeekend } = getDateLabel(dayIndex);

                                    // Start of Week (Project relative: every 7 days from start)
                                    const isStartOfWeek = dayIndex % 7 === 0;
                                    const showLabel = isStartOfWeek || i === 0;

                                    // Project Week Number
                                    const projectWeekNum = Math.floor(dayIndex / 7) + 1;

                                    return (
                                        <div key={`d-${dayIndex}`} style={{ width: dayWidth }} className={`flex-shrink-0 flex items-center border-r border-slate-100 relative ${isWeekend ? 'bg-slate-50' : 'bg-white'}`}>
                                            {showLabel && (
                                                <div className="absolute left-1 whitespace-nowrap z-10 bg-white/80 px-1 rounded text-[10px] font-bold text-slate-500">
                                                    WEEK {projectWeekNum} • {fullDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Grid Lines */}
                        <div className="absolute top-[60px] bottom-0 left-0 right-0 flex pointer-events-none">
                            {Array.from({ length: viewEndDay - viewStartDay }).map((_, i) => {
                                const { isWeekend, fullDate } = getDateLabel(viewStartDay + i);
                                const isEndOfWeek = fullDate.getDay() === 0; // Sunday
                                return <div key={i} style={{ width: dayWidth }} className={`border-r h-full ${isEndOfWeek ? 'border-slate-300' : 'border-slate-100'} ${isWeekend ? 'bg-slate-50/40' : ''}`}></div>
                            })}
                        </div>
                    </div>

                    {/* Left Sidebar (Tree Table) */}
                    <div className="sticky left-0 w-[300px] bg-white border-r border-slate-200 z-30 h-full shadow-[4px_0_12px_-6px_rgba(0,0,0,0.1)]">
                        <div className="h-[60px] border-b border-slate-200 bg-slate-50 sticky top-0 z-40 flex items-end pb-2 px-4 shadow-[0_4px_12px_-8px_rgba(0,0,0,0.05)]">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Activity</span>
                        </div>
                        <div className="bg-white">
                            {visibleItems.map((item, idx) => (
                                <div
                                    key={item.id}
                                    style={{ minHeight: rowHeight }}
                                    className={`flex items-center py-2 px-0 border-b border-slate-100 transition-colors 
                                        ${item.type === 'category' ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' : 'hover:bg-slate-50 text-slate-700'}
                                    `}
                                    onClick={() => item.type === 'category' ? toggleExpand(item.id) : null}
                                >
                                    <div className="flex-1 flex items-center gap-2 px-4 min-w-0">
                                        {item.type === 'category' ? (
                                            <>
                                                <i className={`fa-solid fa-chevron-right text-[10px] w-4 transition-transform duration-200 ${expandedIds.has(item.id) ? 'rotate-90' : ''}`}></i>
                                                <span className="text-xs font-bold tracking-tight flex-1 whitespace-normal break-words">{item.name}</span>
                                                {/* Parent Task Dot Indicator */}
                                                {(item as CategoryBar).hasComments && (
                                                    <div className="w-2 h-2 rounded-full bg-white ml-2 shadow-sm animate-pulse"></div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {/* Note Icon */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const task = item as ProcessedTask;

                                                        // Helper to format date for input type="date"
                                                        const formatDate = (date: any) => {
                                                            if (!date) return '';
                                                            const d = date.toDate ? date.toDate() : new Date(date);
                                                            return d.toISOString().split('T')[0];
                                                        };

                                                        setEditModal({
                                                            isOpen: true,
                                                            catId: task.catId,
                                                            taskId: task.id,
                                                            taskName: task.name,
                                                            currentComment: task.comments || '',
                                                            startDate: formatDate(task.rawTask.startDate),
                                                            dueDate: formatDate(task.rawTask.dueDate)
                                                        });
                                                        setDateError(null);
                                                    }}
                                                    className={`w-5 h-5 flex-shrink-0 flex items-center justify-center mr-1 transition-colors ${(item as ProcessedTask).comments ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'
                                                        }`}
                                                    title="Edit Task"
                                                >
                                                    <i className="fa-solid fa-pen-to-square text-xs"></i>
                                                </button>

                                                {/* Toggle Button (Replaces Serial #) */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const task = item as ProcessedTask;
                                                        const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
                                                        if (onTaskStatusChange) {
                                                            onTaskStatusChange(task.catId, task.id, newStatus);
                                                        }
                                                    }}
                                                    className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center transition-all shadow-sm border mr-2 ${(item as ProcessedTask).status === 'Completed'
                                                        ? 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600'
                                                        : 'bg-slate-100 border-slate-300 text-slate-300 hover:bg-slate-200 hover:border-slate-400'
                                                        }`}
                                                >
                                                    <i className="fa-solid fa-thumbs-up text-[10px]"></i>
                                                </button>

                                                <span className={`text-xs whitespace-normal leading-tight transition-colors duration-300 ${(item as ProcessedTask).status === 'Completed' ? 'text-slate-400' : ''}`}>
                                                    {item.name}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    {/* Status Column REMOVED */}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side: Timeline Bars */}
                    <div className="absolute top-[60px] left-[300px] bottom-0 right-0 py-0">
                        {/* Dependency Lines Layer */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                                </marker>
                            </defs>
                            {visibleItems.map(target => {
                                // Don't show dependencies pointing to parent tasks (categories)
                                if (target.type === 'category') return null;

                                const dependsOn = target.dependsOn || [];
                                return dependsOn.map(sourceId => {
                                    let sourceItem = visibleItems.find(i => i.id === sourceId);

                                    // Fallback for connecting to collapsed categories
                                    if (!sourceItem && target.type === 'task') {
                                        const sourceTask = globalTaskMap.get(sourceId);
                                        if (sourceTask && !expandedIds.has(sourceTask.catId)) {
                                            sourceItem = visibleItems.find(i => i.id === sourceTask.catId && i.type === 'category');
                                        }
                                    }

                                    if (!sourceItem) return null;

                                    const startX = (sourceItem.endDay - viewStartDay) * dayWidth;
                                    const startY = (sourceItem.row * rowHeight) + (rowHeight / 2);
                                    const endX = (target.startDay - viewStartDay) * dayWidth;
                                    const endY = (target.row * rowHeight) + (rowHeight / 2);

                                    // Orthogonal Path for clearer dense view
                                    const midX = (startX + endX) / 2;
                                    // Logic: Start -> Right -> Down/Up -> Right -> End
                                    // Actually sigmoid is less cluttered for density
                                    const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

                                    return (
                                        <path
                                            key={`${sourceId}-${target.id}`}
                                            d={path}
                                            stroke="#64748b"
                                            strokeWidth="1.5"
                                            fill="none"
                                            markerEnd="url(#arrowhead)"
                                            strokeDasharray={target.type === 'task' ? "3 3" : "0"}
                                            strokeOpacity="0.8"
                                        />
                                    );
                                });
                            })}
                        </svg>

                        {/* Bars Layer */}
                        {visibleItems.map(item => {
                            const isCat = item.type === 'category';

                            return (
                                <div
                                    key={item.id}
                                    className="absolute group"
                                    style={{
                                        left: (item.startDay - viewStartDay) * dayWidth,
                                        top: (item.row * rowHeight) + ((rowHeight - taskBarHeight) / 2),
                                        width: Math.max(item.duration * dayWidth, isCat ? dayWidth : 4),
                                        height: taskBarHeight,
                                        zIndex: isCat ? 5 : 20
                                    }}
                                    onClick={() => isCat ? toggleExpand(item.id) : null}
                                >
                                    {/* Bar Shape */}
                                    <div className={`w-full h-full shadow-sm relative overflow-visible flex items-center
                                        ${isCat ? 'bg-indigo-200/50 cursor-pointer' : 'bg-sky-500 rounded border border-sky-600 shadow cursor-default hover:bg-sky-400'}
                                     `}>
                                        {/* Start/End Markers for Category */}
                                        {isCat && (
                                            <>
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400"></div>
                                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-indigo-400"></div>
                                                <div className="absolute top-0 left-0 right-0 h-[1px] bg-indigo-300"></div>
                                                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-indigo-300"></div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Edit Task Modal */}
            {
                editModal && editModal.isOpen && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
                        onClick={() => setEditModal(null)}
                    >
                        <div
                            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-in zoom-in-95 duration-200 border border-white/20"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                                        <i className="fa-solid fa-pen-to-square text-sm"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 text-base">Edit Task Details</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ref: {editModal.taskId}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditModal(null)}
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600 transition-all border border-transparent hover:border-slate-100"
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                {/* Task Name */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Task Title</label>
                                    <input
                                        type="text"
                                        className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800 placeholder:text-slate-300"
                                        value={editModal.taskName}
                                        onChange={(e) => setEditModal({ ...editModal, taskName: e.target.value })}
                                        placeholder="Enter task name..."
                                    />
                                </div>

                                {/* Dates Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Start Date</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-calendar-day absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                                            <input
                                                type="date"
                                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800"
                                                value={editModal.startDate}
                                                onChange={(e) => setEditModal({ ...editModal, startDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Due Date</label>
                                        <div className="relative">
                                            <i className="fa-solid fa-calendar-check absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                                            <input
                                                type="date"
                                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-800"
                                                value={editModal.dueDate}
                                                onChange={(e) => setEditModal({ ...editModal, dueDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Comments */}
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Notes & Comments</label>
                                    <textarea
                                        className="w-full h-32 px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm text-slate-700 resize-none font-medium placeholder:text-slate-300"
                                        placeholder="Add notes for your client or internal team..."
                                        value={editModal.currentComment}
                                        onChange={(e) => setEditModal({ ...editModal, currentComment: e.target.value })}
                                    ></textarea>
                                </div>

                                {/* Error Message */}
                                {dateError && (
                                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <i className="fa-solid fa-circle-exclamation text-red-500 text-sm"></i>
                                        <span className="text-xs font-bold text-red-600">{dateError}</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        onClick={() => {
                                            setEditModal(null);
                                            setDateError(null);
                                        }}
                                        className="flex-1 py-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all active:scale-[0.98]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (editModal.startDate && editModal.dueDate) {
                                                const start = new Date(editModal.startDate);
                                                const end = new Date(editModal.dueDate);
                                                if (end < start) {
                                                    setDateError("Due date cannot be before start date");
                                                    return;
                                                }
                                            }

                                            if (onUpdateTask) {
                                                onUpdateTask(editModal.catId, editModal.taskId, {
                                                    name: editModal.taskName,
                                                    comment: editModal.currentComment,
                                                    startDate: editModal.startDate ? new Date(editModal.startDate) : undefined,
                                                    dueDate: editModal.dueDate ? new Date(editModal.dueDate) : undefined
                                                });
                                            }
                                            setEditModal(null);
                                            setDateError(null);
                                        }}
                                        className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all transform active:scale-[0.98]"
                                    >
                                        Update Task
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default GanttChart;
