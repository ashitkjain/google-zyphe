import React, { useState } from 'react';
import { CRMTask, ReminderRule, Lead } from '../../types';
import ReminderRulesManager from './ReminderRulesManager';
import { updateTask, addTask, deleteTask } from '../../services/firebaseService';
import ZypheCalendar from './ZypheCalendar';

interface TaskBoardProps {
    realtorId: string;
    tasks: CRMTask[];
    leads: Lead[];
    reminderRules?: ReminderRule[];
    onTasksUpdated?: () => Promise<void>;
    onUpdateRule?: (ruleId: string, updates: Partial<ReminderRule>) => void;
    onSaveRules?: () => Promise<void>;
}

const formatDate = (val: any) => {
    if (!val) return 'Just now';
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

const TaskBoard: React.FC<TaskBoardProps> = ({ realtorId, tasks: initialTasks, leads = [], reminderRules = [], onTasksUpdated, onUpdateRule, onSaveRules }) => {
    const [activeTab, setActiveTab] = useState<'calendar' | 'tasks' | 'rules'>('calendar');
    const [isSaving, setIsSaving] = useState(false);
    const [calendarPreference, setCalendarPreference] = useState<'none' | 'third-party' | 'zyphe'>('none');

    // Filter leads to show only those in specific stages
    const clientOptions = leads.filter(l =>
        ['Leads', 'Nurture', 'Active Search', 'Offer', 'Closing'].includes(l.funnelStage)
    );

    // Manage tasks locally for editing
    const [tasks, setTasks] = useState<CRMTask[]>(initialTasks);

    // Sync local tasks when prop changes (essential for persistence visibility)
    React.useEffect(() => {
        setTasks(initialTasks);
    }, [initialTasks]);
    // Manage the "empty" row data for each section
    const [extraRows, setExtraRows] = useState<Record<number, any[]>>({
        0: [{}],
        1: [{}],
        2: [{}]
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
        const success = await deleteTask(taskId);
        if (success) {
            setTasks(prev => prev.filter(t => t.id !== taskId));
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
                });
            }

            // 2. Add new ones from extraRows
            const priorityMap: Record<number, CRMTask['priority']> = { 0: 'Urgent', 1: 'High', 2: 'Normal' };

            for (const sIdx of [0, 1, 2]) {
                const rows = extraRows[sIdx] || [];
                for (const row of rows) {
                    if (row.task && row.task.trim()) {
                        await addTask({
                            realtorId,
                            title: row.task,
                            description: row.notes || '',
                            dueDate: ensureDate(row.date),
                            priority: row.priority || 'Normal',
                            status: row.done === 'Yes' ? 'Completed' : 'Pending',
                            clientId: row.clientId || ''
                        });
                    }
                }
            }
            alert("✅ Tasks saved successfully!");
            setExtraRows({ 0: [{}], 1: [{}], 2: [{}] });

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

    return (
        <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
            {/* Header with Tabs */}
            <div className="bg-white border-b border-slate-200/60 shadow-sm relative z-20">
                <div className="p-10 pb-0 flex items-center justify-between">
                    {/* Tab Navigation */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'calendar'
                                ? 'text-indigo-600 border-indigo-600'
                                : 'text-slate-500 border-transparent hover:text-slate-700'
                                }`}
                        >
                            My Calendar
                        </button>
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'tasks'
                                ? 'text-indigo-600 border-indigo-600'
                                : 'text-slate-500 border-transparent hover:text-slate-700'
                                }`}
                        >
                            My Tasks
                        </button>
                        <button
                            onClick={() => setActiveTab('rules')}
                            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'rules'
                                ? 'text-indigo-600 border-indigo-600'
                                : 'text-slate-500 border-transparent hover:text-slate-700'
                                }`}
                        >
                            Reminder Rules ({reminderRules.filter(r => r.enabled).length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {/* Calendar View */}
                {activeTab === 'calendar' && (
                    <div className="flex-1 h-full">
                        {calendarPreference === 'none' && (
                            <div className="flex-1 h-full p-10 flex flex-col items-center justify-center text-center">
                                <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm border border-indigo-100/50">
                                    <i className="fa-solid fa-calendar-days text-4xl"></i>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">My Calendar</h3>
                                <p className="text-slate-500 font-medium max-w-sm mb-10">Choose how you want to manage your schedule and appointments.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
                                    <button
                                        onClick={() => setCalendarPreference('third-party')}
                                        className="p-8 bg-white border border-slate-200 rounded-3xl hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-100 transition-all text-left group"
                                    >
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            <i className="fa-brands fa-google text-lg"></i>
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-900 mb-1">3rd Party Integration</h4>
                                        <p className="text-sm text-slate-500">Connect Google or Outlook calendar to sync all your existing appointments.</p>
                                    </button>

                                    <button
                                        onClick={() => setCalendarPreference('zyphe')}
                                        className="p-8 bg-white border border-slate-200 rounded-3xl hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-100 transition-all text-left group"
                                    >
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                            <i className="fa-solid fa-rocket text-lg"></i>
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-900 mb-1">Zyphe Calendar</h4>
                                        <p className="text-sm text-slate-500">Use our built-in premium calendar designed specifically for realtors.</p>
                                    </button>
                                </div>
                            </div>
                        )}

                        {calendarPreference === 'third-party' && (
                            <div className="flex-1 h-full p-10 flex flex-col items-center justify-center text-center">
                                <button
                                    onClick={() => setCalendarPreference('none')}
                                    className="absolute top-10 left-10 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                    <i className="fa-solid fa-arrow-left mr-2"></i> Back to options
                                </button>
                                <div className="w-24 h-24 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm border border-indigo-100/50">
                                    <i className="fa-solid fa-link text-4xl"></i>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">Connect Your Calendar</h3>
                                <p className="text-slate-500 font-medium max-w-sm">Manage your external appointments directly within Zyphe.</p>
                                <div className="flex gap-4 mt-8">
                                    <button className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2">
                                        <i className="fa-brands fa-google text-red-500"></i> Google Calendar
                                    </button>
                                    <button className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2">
                                        <i className="fa-brands fa-microsoft text-blue-500"></i> Outlook
                                    </button>
                                </div>
                            </div>
                        )}

                        {calendarPreference === 'zyphe' && (
                            <ZypheCalendar onSwitch={() => setCalendarPreference('none')} />
                        )}
                    </div>
                )}

                {/* My Tasks View */}
                {activeTab === 'tasks' && (
                    <div className="flex-1 bg-white px-12 pt-3 pb-12 overflow-y-auto font-sans leading-normal text-slate-900">
                        <div className="max-w-6xl mx-auto">
                            <div className="flex justify-end mb-3">
                                <button
                                    onClick={handleSaveTasks}
                                    disabled={isSaving}
                                    className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-600 hover:text-indigo-600 shadow-sm disabled:opacity-50 flex items-center group"
                                    title="Save Tasks"
                                >
                                    <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-xl`}></i>
                                </button>
                            </div>
                            <div className="space-y-12">
                                {[
                                    { name: '', mainColor: '#1d3d50', secondaryColor: '#539fc9', items: tasks.filter(t => t.priority === 'Urgent') },
                                    { name: '.', mainColor: '#4c6122', secondaryColor: '#8cae3e', items: tasks.filter(t => t.priority === 'High') },
                                    { name: '', mainColor: '#a15c1e', secondaryColor: '#d68b44', items: tasks.filter(t => t.priority === 'Normal' || t.priority === 'Low') }
                                ].map((section, sIdx) => (
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
                                                            <select
                                                                className="w-full h-full px-3 py-2 bg-transparent border-none text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"
                                                                value={item.clientId || ''}
                                                                onChange={(e) => handleTaskChange(item.id, 'clientId', e.target.value)}
                                                            >
                                                                <option value="">- Select Client -</option>
                                                                {clientOptions.map(client => (
                                                                    <option key={client.id} value={client.id}>{client.fullName}</option>
                                                                ))}
                                                            </select>
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
                                                                value={item.title}
                                                                rows={1}
                                                                onChange={(e) => handleTaskChange(item.id, 'title', e.target.value)}
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
                                                                value={item.description || ''}
                                                                rows={1}
                                                                onChange={(e) => handleTaskChange(item.id, 'description', e.target.value)}
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
                                                            <select
                                                                className="w-full h-full px-3 py-2 bg-transparent border-none text-xs text-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none"
                                                                value={row.clientId || ''}
                                                                onChange={(e) => handleExtraRowChange(sIdx, i, 'clientId', e.target.value)}
                                                            >
                                                                <option value="">- Select Client -</option>
                                                                {clientOptions.map(client => (
                                                                    <option key={client.id} value={client.id}>{client.fullName}</option>
                                                                ))}
                                                            </select>
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
                                ))}
                            </div>

                            <div className="mt-12 mb-8 text-center text-xs text-slate-400 font-medium">
                                Smartsheet Inc. ©2025
                            </div>
                        </div>
                    </div>
                )}

                {/* Reminder Rules View */}
                {activeTab === 'rules' && onUpdateRule && (
                    <ReminderRulesManager
                        rules={reminderRules}
                        onUpdateRule={onUpdateRule}
                        onSaveRules={onSaveRules}
                    />
                )}
            </div>
        </div>
    );
};

export default TaskBoard;
