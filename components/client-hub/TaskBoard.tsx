import React, { useState } from 'react';
import { CRMTask, Lead } from '../../types';
import { updateTask, addTask, deleteTask } from '../../services/firebaseService';
import ClientSelector from './ClientSelector';

interface TaskBoardProps {
    realtorId: string;
    tasks: CRMTask[];
    leads: Lead[];
    onTasksUpdated?: () => Promise<void>;
}

const formatDate = (val: any) => {
    if (!val) return '---';
    // Handle Firestore Timestamp, native Date, ISO string, or corrupted {seconds, nanoseconds} map
    let date: Date;
    if (typeof val.toDate === 'function') {
        date = val.toDate();
    } else if (val.seconds !== undefined) {
        date = new Date(val.seconds * 1000);
    } else {
        date = new Date(val);
    }

    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const TaskBoard: React.FC<TaskBoardProps> = ({ realtorId, tasks: initialTasks, leads = [], onTasksUpdated }) => {
    const [isSaving, setIsSaving] = useState(false);
    // Search and Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Completed'>('All');
    const [sortBy, setBy] = useState<'date' | 'priority' | 'name'>('date');

    // Manage tasks locally for editing
    const [tasks, setTasks] = useState<CRMTask[]>(initialTasks);

    // Sync local tasks when prop changes (essential for persistence visibility)
    React.useEffect(() => {
        console.log(`[TaskBoard] Received ${initialTasks.length} tasks from props`);
        setTasks(initialTasks);
    }, [initialTasks]);
    // Manage the "empty" row data for each section
    const [extraRows, setExtraRows] = useState<Record<number, any[]>>({
        0: [{}],
        1: [{}],
        2: [{}],
        3: [{}]
    });

    const addRowToSection = (sIdx: number) => {
        setExtraRows(prev => ({
            ...prev,
            [sIdx]: [...(prev[sIdx] || []), {}]
        }));
    };

    const handleTaskChange = (taskId: string, field: string, value: string) => {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t));
    };

    const handleExtraRowChange = (sectionIdx: number, rowIdx: number, field: string, value: string) => {
        setExtraRows(prev => {
            const sectionRows = [...(prev[sectionIdx] || [])];
            sectionRows[rowIdx] = { ...sectionRows[rowIdx], [field]: value };
            return { ...prev, [sectionIdx]: sectionRows };
        });
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
        const taskToDelete = tasks.find(t => t.id === taskId);
        const success = await deleteTask(taskId, taskToDelete?.transaction_id);
        if (success) {
            setTasks(prev => prev.filter(t => t.id !== taskId));
            if (onTasksUpdated) await onTasksUpdated();
        } else {
            alert("❌ Failed to delete task.");
        }
    };

    const handleDeleteExtraRow = (sIdx: number, rowIdx: number) => {
        setExtraRows(prev => {
            const sectionRows = [...(prev[sIdx] || [])];
            sectionRows.splice(rowIdx, 1);
            // Always keep at least one empty row
            if (sectionRows.length === 0) sectionRows.push({});
            return { ...prev, [sIdx]: sectionRows };
        });
    };

    const handleSaveTasks = async () => {
        setIsSaving(true);
        try {
            // Helper to handle date parsing reliably
            const ensureDate = (val: any) => {
                if (!val) return new Date();
                const d = new Date(val);
                return isNaN(d.getTime()) ? new Date() : d;
            };

            // 1. Update existing
            for (const task of tasks) {
                await updateTask(task.id, {
                    ...task,
                    dueDate: ensureDate(task.dueDate)
                }, task.transaction_id);
            }

            // 2. Add new ones from extraRows 
            // We use the section descriptions to determine the default priority for new rows
            const sections = [
                { name: 'My Task List', priority: 'Normal' as const },
                { name: 'System generated', priority: 'High' as const },
                { name: 'closing task list', priority: 'Low' as const },
                { name: 'Other Tasks', priority: 'Normal' as const }
            ];

            for (let sIdx = 0; sIdx < sections.length; sIdx++) {
                const rows = extraRows[sIdx] || [];
                for (const row of rows) {
                    if (row.task && row.task.trim()) {
                        await addTask({
                            realtorId,
                            name: row.task,
                            comment: row.notes || '',
                            dueDate: row.date ? ensureDate(row.date) : null as any,
                            priority: row.priority || sections[sIdx].priority,
                            status: row.done === 'Yes' ? 'Completed' : 'Pending',
                            clientId: row.clientId || ''
                        });
                    }
                }
            }
            alert("✅ Tasks saved successfully!");
            setExtraRows({ 0: [{}], 1: [{}], 2: [{}], 3: [{}] });

            // Notify parent to re-fetch tasks
            if (onTasksUpdated) {
                await onTasksUpdated();
            }
        } catch (error) {
            console.error("Failed to save tasks:", error);
            alert("❌ Failed to save tasks. Check console.");
        } finally {
            setIsSaving(false);
        }
    };

    const getClientName = (clientId: string) => {
        if (!clientId) return '';
        const client = leads.find(l => l.id === clientId);
        if (!client) return '';
        return client.fullName || `${client.firstName} ${client.lastName}` || '';
    };

    const getFilteredAndSortedTasks = () => {
        let result = tasks.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                getClientName(t.clientId).toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'All' ||
                (statusFilter === 'Completed' ? t.status === 'Completed' : t.status !== 'Completed');
            return matchesSearch && matchesStatus;
        });

        return result.sort((a, b) => {
            if (sortBy === 'date') {
                const dateA = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)).getTime() : Infinity;
                const dateB = b.dueDate ? (b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate)).getTime() : Infinity;
                return dateA - dateB;
            }
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            return 0; // Default segments handle priority
        });
    };

    const displayedTasks = getFilteredAndSortedTasks();

    return (
        <div className="flex-1 bg-[#F8FAFC]">
            {/* Content Area */}
            <div className="h-full">
                <div className="flex-1 bg-white px-12 pt-6 pb-12 overflow-y-auto font-sans leading-normal text-slate-900 border-l border-slate-100">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col gap-6 mb-8">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Task Board</h1>
                                    <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-indigo-100/50">
                                        {displayedTasks.length} {displayedTasks.length === 1 ? 'Task' : 'Tasks'}
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveTasks}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
                                    Save Changes
                                </button>
                            </div>

                            {/* Filter Bar */}
                            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="flex-1 min-w-[300px] relative group">
                                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"></i>
                                    <input
                                        type="text"
                                        placeholder="Search by task name or client..."
                                        className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</label>
                                    <select
                                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as any)}
                                    >
                                        <option value="All">All Tasks</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sort</label>
                                    <select
                                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={sortBy}
                                        onChange={(e) => setBy(e.target.value as any)}
                                    >
                                        <option value="date">Due Date</option>
                                        <option value="name">Task Name</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-amber-50/50 px-4 py-2.5 rounded-xl border border-amber-100/50 w-fit">
                                <i className="fa-solid fa-calendar-check text-amber-500"></i>
                                Tasks with due dates are automatically synced to your calendar
                            </div>
                        </div>
                        <div className="space-y-12">
                            {[
                                { name: 'My Task List', mainColor: '#1d3d50', secondaryColor: '#539fc9', items: displayedTasks.filter(t => !t.transaction_id && (t.priority === 'Urgent' || t.priority === 'Normal')) },
                                { name: 'System generated', mainColor: '#4c6122', secondaryColor: '#8cae3e', items: displayedTasks.filter(t => !t.transaction_id && t.priority === 'High') },
                                { name: 'closing task list', mainColor: '#a15c1e', secondaryColor: '#d68b44', items: displayedTasks.filter(t => t.transaction_id || t.priority === 'Low') },
                                {
                                    name: 'Other Tasks',
                                    mainColor: '#475569',
                                    secondaryColor: '#64748b',
                                    items: displayedTasks.filter(t => !t.transaction_id && !['Urgent', 'High', 'Normal', 'Low'].includes(t.priority as string))
                                }
                            ].map((section, sIdx) => {
                                console.log(`[TaskBoard] Section "${section.name}" has ${section.items.length} items`);
                                if (section.items.length === 0 && (sIdx === 3 || searchTerm || statusFilter !== 'All')) return null; // Hide Other if empty or filtering
                                return (
                                    <div key={sIdx} className="w-full">
                                        <table className="w-full border-collapse border border-slate-300">
                                            <thead>
                                                <tr>
                                                    <th colSpan={1} className="w-12 text-left px-3 py-1 bg-[#1d3d50] text-white text-sm font-bold border border-slate-300">Name</th>
                                                    <th colSpan={5} className="px-3 py-1 bg-[#f9f9f9] border border-slate-300 text-left font-normal italic text-slate-500">
                                                        {section.name || ''}
                                                    </th>
                                                    <th className="bg-[#f9f9f9] border border-slate-300 w-10 p-0 text-center">
                                                        <button
                                                            onClick={() => addRowToSection(sIdx)}
                                                            className="w-full h-full text-slate-400 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <i className="fa-solid fa-plus text-xs"></i>
                                                        </button>
                                                    </th>
                                                </tr>
                                                <tr>
                                                    <th className="w-[5%] px-3 py-2 text-center text-white text-xs font-bold border border-slate-300" style={{ backgroundColor: section.mainColor }}>Done</th>
                                                    <th className="w-[10%] px-3 py-2 text-left text-white text-xs font-bold border border-slate-300" style={{ backgroundColor: section.mainColor }}>Client</th>
                                                    <th className="w-[7%] px-3 py-2 text-left text-white text-xs font-bold border border-slate-300" style={{ backgroundColor: section.mainColor }}>Priority</th>
                                                    <th className="w-[28%] px-3 py-2 text-left text-white text-xs font-bold border border-slate-300" style={{ backgroundColor: section.mainColor }}>Task</th>
                                                    <th className="w-[10%] px-3 py-2 text-left text-white text-xs font-bold border border-slate-300" style={{ backgroundColor: section.secondaryColor }}>Date Due</th>
                                                    <th className="w-[35%] px-3 py-2 text-left text-white text-xs font-bold border border-slate-300" style={{ backgroundColor: section.secondaryColor }}>Notes</th>
                                                    <th className="w-[5%] px-3 py-2 text-center text-white text-xs font-bold border border-slate-300" style={{ backgroundColor: section.secondaryColor }}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.items.map((item, i) => (
                                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="border border-slate-200 p-0 text-center align-middle">
                                                            <button
                                                                onClick={() => handleTaskChange(item.id, 'status', item.status === 'Completed' ? 'Pending' : 'Completed')}
                                                                className={`w-5 h-5 mx-auto rounded-md flex items-center justify-center transition-all border ${item.status === 'Completed'
                                                                    ? 'bg-emerald-500 border-emerald-500 shadow-sm'
                                                                    : 'bg-white border-slate-300 hover:border-emerald-300'
                                                                    }`}
                                                            >
                                                                {item.status === 'Completed' && (
                                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <ClientSelector
                                                                leads={leads}
                                                                selectedClientId={item.clientId}
                                                                onSelect={(id) => handleTaskChange(item.id, 'clientId', id)}
                                                                className="h-full"
                                                                hideIcon={true}
                                                                inputClassName="bg-transparent font-normal text-slate-600 !px-3"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <select
                                                                className="w-full h-full px-3 py-2 bg-transparent border-none text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"
                                                                value={item.priority}
                                                                onChange={(e) => handleTaskChange(item.id, 'priority', e.target.value as any)}
                                                            >
                                                                <option value="Urgent">Urgent</option>
                                                                <option value="High">High</option>
                                                                <option value="Normal">Normal</option>
                                                                <option value="Low">Low</option>
                                                            </select>
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <textarea
                                                                className="w-full min-h-[40px] px-3 py-2 bg-transparent border-none text-xs font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none resize-none overflow-hidden"
                                                                value={item.name}
                                                                rows={1}
                                                                onChange={(e) => handleTaskChange(item.id, 'name', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <textarea
                                                                className="w-full min-h-[40px] px-3 py-2 bg-transparent border-none text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none resize-none overflow-hidden"
                                                                value={formatDate(item.dueDate)}
                                                                rows={1}
                                                                onChange={(e) => handleTaskChange(item.id, 'dueDate', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <textarea
                                                                className="w-full min-h-[40px] px-3 py-2 bg-transparent border-none text-xs text-slate-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none overflow-hidden"
                                                                value={item.comment || ''}
                                                                rows={1}
                                                                onChange={(e) => handleTaskChange(item.id, 'comment', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 text-center align-middle">
                                                            <button
                                                                onClick={() => handleDeleteTask(item.id)}
                                                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                                title="Delete Task"
                                                            >
                                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {/* Editable Placeholder Rows */}
                                                {(extraRows[sIdx] || []).map((row, i) => (
                                                    <tr key={`empty-${sIdx}-${i}`} className="min-h-[40px]">
                                                        <td className="border border-slate-200 p-0 text-center align-middle">
                                                            <button
                                                                onClick={() => handleExtraRowChange(sIdx, i, 'done', row.done === 'Yes' ? 'No' : 'Yes')}
                                                                className={`w-5 h-5 mx-auto rounded-md flex items-center justify-center transition-all border ${row.done === 'Yes'
                                                                    ? 'bg-emerald-500 border-emerald-500 shadow-sm'
                                                                    : 'bg-white border-slate-300 hover:border-emerald-300'
                                                                    }`}
                                                            >
                                                                {row.done === 'Yes' && (
                                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <ClientSelector
                                                                leads={leads}
                                                                selectedClientId={row.clientId}
                                                                onSelect={(id) => handleExtraRowChange(sIdx, i, 'clientId', id)}
                                                                className="h-full"
                                                                hideIcon={true}
                                                                inputClassName="bg-transparent font-normal text-slate-400 !px-3"
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <select
                                                                className="w-full h-full px-3 py-2 bg-transparent border-none text-xs text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"
                                                                value={row.priority || 'Normal'}
                                                                onChange={(e) => handleExtraRowChange(sIdx, i, 'priority', e.target.value)}
                                                            >
                                                                <option value="Urgent">Urgent</option>
                                                                <option value="High">High</option>
                                                                <option value="Normal">Normal</option>
                                                                <option value="Low">Low</option>
                                                            </select>
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <textarea
                                                                placeholder="..."
                                                                className="w-full min-h-[40px] px-3 py-2 bg-transparent border-none text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-200 resize-none overflow-hidden"
                                                                value={row.task || ''}
                                                                rows={1}
                                                                onChange={(e) => handleExtraRowChange(sIdx, i, 'task', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <textarea
                                                                placeholder="..."
                                                                className="w-full min-h-[40px] px-3 py-2 bg-transparent border-none text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-200 resize-none overflow-hidden"
                                                                value={row.date || ''}
                                                                rows={1}
                                                                onChange={(e) => handleExtraRowChange(sIdx, i, 'date', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 align-top">
                                                            <textarea
                                                                placeholder="..."
                                                                className="w-full min-h-[40px] px-3 py-2 bg-transparent border-none text-xs text-slate-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-200 resize-none overflow-hidden"
                                                                value={row.notes || ''}
                                                                rows={1}
                                                                onChange={(e) => handleExtraRowChange(sIdx, i, 'notes', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="border border-slate-200 p-0 text-center align-middle">
                                                            <button
                                                                onClick={() => handleDeleteExtraRow(sIdx, i)}
                                                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                                title="Remove Row"
                                                            >
                                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })
                            }
                        </div>

                        <div className="mt-12 mb-8 text-center text-xs text-slate-400 font-medium">
                            Smartsheet Inc. ©2025
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskBoard;
