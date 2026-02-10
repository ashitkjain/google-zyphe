import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, Lead, CRMTask, CalendarEvent, LeadNote } from '../../types';
import { getClientTasks, getClientCalendarEvents, saveCalendarEvent, addTask, updateTask, deleteTask } from '../../services/firebaseService';
import { HubTab } from './hub/HubHeader';
import ClientSelector from './ClientSelector';
import ClientEditModal from './ClientEditModal';

const formatDate = (date: any) => {
    if (!date) return '---';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const isOverdue = (dateVal: any, status: string) => {
    if (!dateVal || status === 'DONE' || status === 'Completed') return false;
    const now = new Date();
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    return d.getTime() < now.getTime();
};

interface ClientDetailsViewProps {
    realtorId: string;
    clients: UserProfile[];
    leads: Lead[];
    onUpdateClient: (id: string, updates: any, collectionName: string) => Promise<boolean>;
    loading?: boolean;
    initialSelectedId?: string;
    hideClientList?: boolean;
    setActiveTab?: (tab: HubTab) => void;
    refreshTasks?: () => Promise<void>;
}

const ClientDetailsView: React.FC<ClientDetailsViewProps> = ({ realtorId, clients, leads, onUpdateClient, loading, initialSelectedId, hideClientList, setActiveTab, refreshTasks }) => {
    const getName = (c: any) => c.isUser ? c.displayName : `${c.firstName} ${c.lastName}`;
    const getEmail = (c: any) => c.email;
    const getPhone = (c: any) => c.isUser ? c.phoneNumber : c.phone;

    const getStageStatus = (c: any) => {
        const stage = c.funnelStage || 'Leads';
        switch (stage) {
            case 'Leads': return c.leadStatus;
            case 'Nurture': return c.nurtureStatus;
            case 'Active Search': return c.activeSearchStatus;
            case 'Offer': return c.offerStatus;
            case 'Closing': return c.closingStatus;
            default: return c.status;
        }
    };

    // Combine both into a unified list
    const allClients = [
        ...clients.map(c => ({ ...c, isUser: true, id: c.uid })),
        ...leads.map(l => ({ ...l, isUser: false }))
    ].sort((a, b) => {
        // Sort by isUser (false first - Off-Zyphe, true last - On-Zyphe)
        if (a.isUser !== b.isUser) {
            return a.isUser ? 1 : -1;
        }
        // Then sort by date
        const dateA = a.isUser ? (a.createdAt || 0) : (a.receivedAt || 0);
        const dateB = b.isUser ? (b.createdAt || 0) : (b.receivedAt || 0);
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    const nonArchivedClients = allClients.filter(c => (c as any).status !== 'Archived' && (c as any).funnelStage !== 'Archived');

    const [activeListTab, setActiveListTab] = useState<'Buyers' | 'Sellers'>('Buyers');
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState<string>('All Stages');
    const [sortOrder, setSortOrder] = useState<'newest' | 'name'>('newest');
    const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId || (nonArchivedClients.length > 0 ? nonArchivedClients[0].id : (allClients.length > 0 ? allClients[0].id : null)));
    const [showEditModal, setShowEditModal] = useState(false);
    const [showTasksModal, setShowTasksModal] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskDate, setNewTaskDate] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'Low' | 'Normal' | 'High' | 'Urgent'>('Normal');
    const [newTaskNote, setNewTaskNote] = useState('');
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [editingTask, setEditingTask] = useState<CRMTask | null>(null);

    useEffect(() => {
        if (initialSelectedId) {
            setSelectedId(initialSelectedId);
        }
    }, [initialSelectedId]);

    const filteredClients = allClients
        .filter(c => {
            const type = (c as any).leadType || 'Buyer';
            const matchesTab = type === (activeListTab === 'Buyers' ? 'Buyer' : 'Seller');

            const name = getName(c).toLowerCase();
            const email = (getEmail(c) || '').toLowerCase();
            const matchesSearch = name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());

            const stage = (c as any).funnelStage || 'Leads';
            const matchesStage = stageFilter === 'All Stages' || stage === stageFilter;

            const isArchived = (c as any).status === 'Archived' || stage === 'Archived';
            if (isArchived) return false;

            return matchesTab && matchesSearch && matchesStage;
        })
        .sort((a, b) => {
            if (sortOrder === 'name') {
                return getName(a).localeCompare(getName(b));
            }
            // Default to newest (allClients is already sorted by date, but we re-apply just in case)
            const dateA = a.isUser ? (a.createdAt || 0) : (a.receivedAt || 0);
            const dateB = b.isUser ? (b.createdAt || 0) : (b.receivedAt || 0);
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

    const selectedClient = allClients.find(c => c.id === selectedId) || filteredClients[0] || allClients[0];


    // Sticky Notes Logic
    // Unified Lead Notes Logic
    const [leadNotes, setLeadNotes] = useState<Record<string, LeadNote[]>>({});
    const [draggingNote, setDraggingNote] = useState<{ x: number, y: number } | null>(null);
    const [movingNoteIndex, setMovingNoteIndex] = useState<number | null>(null);
    const snapshotRef = useRef<HTMLDivElement>(null);

    const [clientTasks, setClientTasks] = useState<CRMTask[]>([]);
    const [clientEvents, setClientEvents] = useState<CalendarEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    // Sync with selected client when it changes
    useEffect(() => {
        if (selectedClient) {
            setLeadNotes(prev => ({ ...prev, [selectedClient.id]: (selectedClient as any).leadNotes || [] }));

            const fetchClientData = async () => {
                setLoadingEvents(true);
                const [tasks, events] = await Promise.all([
                    getClientTasks(realtorId, selectedClient.id),
                    getClientCalendarEvents(realtorId, selectedClient.id)
                ]);
                setClientTasks(tasks);
                setClientEvents(events);
                setLoadingEvents(false);
            };
            fetchClientData();
        }
    }, [selectedClient?.id, realtorId]);

    const persistChanges = async (clientId: string, updates: Partial<Lead>) => {
        const client = allClients.find(c => c.id === clientId);
        if (!client) return;

        const collectionName = client.isUser ? 'users' : (client as any).collectionName || 'leads';
        await onUpdateClient(clientId, updates, collectionName);
    };

    const addRealtorNote = async (clientId: string, text: string) => {
        if (!text.trim()) return;
        const currentNotes = leadNotes[clientId] || [];

        // Prevent duplicate consecutive notes
        if (currentNotes[0]?.content === text && currentNotes[0]?.type === 'general') return;

        const newNote: LeadNote = {
            id: 'note-' + Date.now(),
            content: text,
            timestamp: new Date(),
            color: 'yellow',
            type: 'general'
        };
        const updatedNotes = [newNote, ...currentNotes];
        setLeadNotes(prev => ({ ...prev, [clientId]: updatedNotes }));
        await persistChanges(clientId, { leadNotes: updatedNotes });
    };

    // --- CALENDAR EVENT CREATION LOGIC ---
    const [draftEvent, setDraftEvent] = useState<CalendarEvent | null>(null);

    const formatDateToInput = (date: Date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatTimeToInput = (date: Date) => {
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    const handleCreateEventClick = () => {
        const now = new Date();
        const start = new Date(now);
        start.setHours(now.getHours() + 1, 0, 0, 0); // Next hour
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration

        const clientName = getName(selectedClient);

        setDraftEvent({
            id: `new-${Date.now()}`,
            realtorId,
            title: `Meeting with ${clientName}`,
            start,
            end,
            type: 'appointment',
            description: '',
            clientId: selectedClient.id,
            client: clientName
        });
    };

    const handleSaveNewEvent = async () => {
        if (!draftEvent) return;

        // Basic validation
        if (draftEvent.end.getTime() < draftEvent.start.getTime()) {
            alert("End time cannot be before start time.");
            return;
        }

        const savedId = await saveCalendarEvent(draftEvent);
        if (savedId) {
            const newEventWithId = { ...draftEvent, id: savedId };
            setClientEvents(prev => [...prev, newEventWithId].sort((a, b) => b.start.getTime() - a.start.getTime()));
            setDraftEvent(null);
        } else {
            alert("Failed to save event.");
        }
    };

    const handleAddTask = async () => {
        if (!newTaskName.trim()) return;
        setIsAddingTask(true);
        try {
            const taskData: Partial<CRMTask> = {
                realtorId,
                clientId: selectedClient.id,
                name: newTaskName,
                comment: newTaskNote,
                dueDate: newTaskDate ? new Date(newTaskDate) : null as any,
                priority: newTaskPriority,
                status: editingTask ? editingTask.status : 'Pending',
            };

            if (editingTask) {
                const success = await updateTask(editingTask.id, taskData);
                if (success) {
                    setClientTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData } : t));
                    setEditingTask(null);
                }
            } else {
                const taskId = await addTask({ ...taskData, status: 'Pending', created_at: new Date() });
                if (taskId) {
                    const fullTask = { ...taskData, id: taskId, status: 'Pending', created_at: new Date() } as CRMTask;
                    setClientTasks(prev => [...prev, fullTask].sort((a, b) => {
                        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                        return dateA - dateB;
                    }));
                }
            }
            cancelEditing();
        } catch (error) {
            console.error("Failed to handle task:", error);
        } finally {
            setIsAddingTask(false);
            if (refreshTasks) refreshTasks();
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
        const success = await deleteTask(taskId);
        if (success) {
            setClientTasks(prev => prev.filter(t => t.id !== taskId));
            if (refreshTasks) refreshTasks();
        }
    };

    const handleToggleTaskStatus = async (task: CRMTask) => {
        const newStatus = (task.status === 'Completed' || task.status === 'DONE') ? 'Pending' : 'Completed';
        const success = await updateTask(task.id, { status: newStatus });
        if (success) {
            setClientTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
            if (refreshTasks) refreshTasks();
        }
    };

    const cancelEditing = () => {
        setEditingTask(null);
        setNewTaskName('');
        setNewTaskNote('');
        setNewTaskDate('');
        setNewTaskPriority('Normal');
    };

    const startEditingTask = (task: CRMTask) => {
        if (editingTask?.id === task.id) {
            cancelEditing();
            return;
        }
        setEditingTask(task);
        setNewTaskName(task.name);
        setNewTaskNote(task.comment || '');
        setNewTaskPriority(task.priority);
        if (task.dueDate) {
            const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
            setNewTaskDate(d.toISOString().split('T')[0]);
        } else {
            setNewTaskDate('');
        }
    };


    const handleMouseDownOnStack = (e: React.MouseEvent) => {
        setDraggingNote({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDownOnNote = (e: React.MouseEvent, index: number) => {
        // Prevent drag when clicking textarea or button
        if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return;
        setMovingNoteIndex(index);
    };

    const closeStuckNote = async (index: number) => {
        if (!selectedId) return;
        const currentNotes = leadNotes[selectedId] || [];
        const stickies = currentNotes.filter(n => n.x !== undefined);
        const nonStickies = currentNotes.filter(n => n.x === undefined);

        const updatedStickies = stickies.filter((_, i) => i !== index);
        const allUpdated = [...updatedStickies, ...nonStickies];

        setLeadNotes(prev => ({
            ...prev,
            [selectedId]: allUpdated
        }));
        await persistChanges(selectedId, { leadNotes: allUpdated });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (draggingNote) {
                setDraggingNote({ x: e.clientX, y: e.clientY });
            }
            if (movingNoteIndex !== null && snapshotRef.current && selectedId) {
                const rect = snapshotRef.current.getBoundingClientRect();
                const x = ((e.clientX - rect.left - 64) / rect.width) * 100;
                const y = ((e.clientY - rect.top - 64) / rect.height) * 100;

                setLeadNotes(prev => {
                    const allNotes = [...(prev[selectedId] || [])];
                    const stickies = allNotes.filter(n => n.x !== undefined);
                    const nonStickies = allNotes.filter(n => n.x === undefined);

                    if (stickies[movingNoteIndex]) {
                        stickies[movingNoteIndex] = { ...stickies[movingNoteIndex], x, y };
                    }
                    return { ...prev, [selectedId]: [...stickies, ...nonStickies] };
                });
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (draggingNote && snapshotRef.current && selectedId) {
                const rect = snapshotRef.current.getBoundingClientRect();
                if (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                ) {
                    // Calculate percentage but offset by half of the note size (32px / 2 = 16px if scaled, or 64px for full size)
                    // The note is 8rem (128px). To center it on mouse without transform, subtract 64px.
                    const x_px = (e.clientX - rect.left) - 64;
                    const y_px = (e.clientY - rect.top) - 64;
                    const x = (x_px / rect.width) * 100;
                    const y = (y_px / rect.height) * 100;
                    const rotation = Math.floor(Math.random() * 15) - 7.5;

                    const currentNotes = leadNotes[selectedId] || [];
                    const newSticky: LeadNote = {
                        id: 'sticky-' + Date.now(),
                        x, y, rotation,
                        content: '',
                        timestamp: new Date(),
                        type: 'sticky'
                    };
                    const updatedNotes = [...currentNotes, newSticky];
                    setLeadNotes(prev => ({
                        ...prev,
                        [selectedId]: updatedNotes
                    }));
                    persistChanges(selectedId, { leadNotes: updatedNotes });
                }
                setDraggingNote(null);
            }
            if (movingNoteIndex !== null && selectedId) {
                persistChanges(selectedId, { leadNotes: leadNotes[selectedId] });
            }
            setMovingNoteIndex(null);
        };

        if (draggingNote || movingNoteIndex !== null) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingNote, movingNoteIndex, selectedId]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Clients...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex bg-slate-50 h-full overflow-hidden">
            {/* Left Column: Client List */}
            {!hideClientList && (
                <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{filteredClients.length} {activeListTab}</p>
                            </div>
                            <div className="flex gap-2">
                                <select
                                    className="text-[9px] font-bold uppercase bg-transparent border-none text-slate-400 focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors"
                                    value={stageFilter}
                                    onChange={(e) => setStageFilter(e.target.value)}
                                >
                                    {['All Stages', 'Leads', 'Nurture', 'Active Search', 'Offer', 'Contract', 'Closed'].map((stage) => (
                                        <option key={stage} value={stage}>{stage}</option>
                                    ))}
                                </select>
                                <span className="text-slate-300">|</span>
                                <select
                                    className="text-[9px] font-bold uppercase bg-transparent border-none text-slate-400 focus:ring-0 cursor-pointer hover:text-indigo-600 transition-colors"
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value as 'newest' | 'name')}
                                >
                                    <option value="newest">Newest</option>
                                    <option value="name">Name</option>
                                </select>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]"></i>
                            <input
                                type="text"
                                placeholder="Search clients..."
                                className="w-full bg-slate-100 border-none rounded-xl py-2 pl-9 pr-4 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-indigo-500 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                >
                                    <i className="fa-solid fa-circle-xmark text-[10px]"></i>
                                </button>
                            )}
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex bg-slate-200/50 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveListTab('Buyers')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeListTab === 'Buyers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Buyers
                            </button>
                            <button
                                onClick={() => setActiveListTab('Sellers')}
                                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeListTab === 'Sellers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Sellers
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredClients.map((client) => (
                            <button
                                key={client.id}
                                onClick={() => setSelectedId(client.id)}
                                className={`w-full p-4 flex items-center gap-4 border-b border-slate-50 transition-all hover:bg-slate-50 ${selectedId === client.id ? 'bg-indigo-50/50 border-r-4 border-r-indigo-600' : ''}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm ${client.isUser ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                                    {getName(client).charAt(0)}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <div className="text-xs font-normal text-slate-900 truncate">{getName(client)}</div>
                                    <div className="truncate">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{(client as any).funnelStage || 'Leads'}</span>
                                        <span className="text-slate-300 mx-1">•</span>
                                        <span className="text-[10px] font-medium text-slate-500 font-mono italic">{(client as any).status || getStageStatus(client) || 'New'}</span>
                                    </div>
                                </div>
                                {client.isUser && (
                                    <div className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded">App</div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Right Column: Details */}
            <div className="flex-1 flex flex-col">
                {selectedClient ? (
                    <>
                        {/* Header */}
                        <div className="px-4 py-3 bg-white border-b border-slate-200">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3 -mt-1">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl text-white font-black shadow-lg overflow-hidden ${selectedClient.isUser ? 'bg-emerald-500 shadow-emerald-200' : 'bg-indigo-500 shadow-indigo-200'}`}>
                                        {(selectedClient as any).avatarUrl || (selectedClient as any).clientPhotoUrl ? (
                                            <img
                                                src={(selectedClient as any).avatarUrl || (selectedClient as any).clientPhotoUrl}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            getName(selectedClient).charAt(0)
                                        )}
                                    </div>
                                    <div className="space-y-0">
                                        <div className="flex items-center gap-6">
                                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{getName(selectedClient)}</h1>

                                            {/* Stage and Status Badges */}
                                            <div className="flex items-center gap-3">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                                                    {(selectedClient as any).funnelStage || 'Leads'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono italic">
                                                    {(selectedClient as any).status || getStageStatus(selectedClient) || 'New'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="flex items-center">
                                                    {selectedClient.engagementScore === 'Hot' && (
                                                        <div className="w-8 h-8 relative animate-flame">
                                                            <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-sm">
                                                                <path d="M50 95C30 95 15 75 15 50C15 35 25 20 45 5C45 15 50 25 55 35C65 25 75 35 85 50C85 75 70 95 50 95Z" fill="#ff4d00" />
                                                                <path d="M50 90C35 90 25 75 25 55C25 45 30 35 45 25C45 35 50 45 55 50C62 40 70 45 75 55C75 75 65 90 50 90Z" fill="#ff9900" />
                                                                <path d="M50 85C42 85 35 75 35 60C35 50 40 45 45 40C48 50 50 55 55 60C58 55 62 55 65 60C65 75 58 85 50 85Z" fill="#ffcc00" />
                                                            </svg>
                                                            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-orange-500/20 blur-lg rounded-full -z-10 animate-pulse"></div>
                                                        </div>
                                                    )}
                                                    {selectedClient.engagementScore === 'Warm' && <i className="fa-solid fa-mug-hot text-amber-500 text-xl filter drop-shadow-sm"></i>}
                                                    {selectedClient.engagementScore === 'Cold' && <i className="fa-solid fa-snowflake text-sky-400 text-xl filter drop-shadow-sm"></i>}
                                                    {selectedClient.engagementScore === 'Stale' && <img src="/stale-bread.png" alt="Stale" className="w-6 h-6 object-contain filter drop-shadow-sm" />}
                                                </div>

                                                {/* Post-it Stack */}
                                                <div className="relative flex flex-col items-center">
                                                    <div
                                                        onMouseDown={handleMouseDownOnStack}
                                                        className="group cursor-grab active:cursor-grabbing relative w-10 h-10 select-none mb-0.5"
                                                    >
                                                        {/* Stack Visual */}
                                                        <div className="absolute inset-0 bg-yellow-100 border border-yellow-200 shadow-sm rotate-6 rounded-md translate-x-1 translate-y-1"></div>
                                                        <div className="absolute inset-0 bg-yellow-50 border border-yellow-200 shadow-sm -rotate-3 rounded-md"></div>
                                                        <div className="absolute inset-0 bg-yellow-200 border border-yellow-300 shadow-md group-hover:scale-110 group-hover:-rotate-6 transition-all rounded-md flex items-center justify-center">
                                                            <i className="fa-solid fa-plus text-yellow-600 text-sm"></i>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="text-[8px] text-slate-400 font-bold text-center leading-tight">
                                                            Drag for note
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Email Row */}
                                            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                                <i className="fa-solid fa-envelope text-slate-300 text-xs"></i>
                                                <span className="text-xs font-semibold">{getEmail(selectedClient)}</span>
                                                {(() => {
                                                    const preferredMethod = (selectedClient as any).primaryContactInfo?.preferredMethod || (selectedClient as any).preferredContactMethod;
                                                    return preferredMethod === 'Email' && (
                                                        <i className="fa-solid fa-star text-yellow-500 text-[8px] ml-0.5"></i>
                                                    );
                                                })()}
                                            </div>

                                            <span className="text-slate-200 text-xs">|</span>

                                            {/* Phone Row */}
                                            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                                <i className="fa-solid fa-phone text-slate-300 text-xs"></i>
                                                <span className="text-xs font-semibold">{getPhone(selectedClient) || 'No phone'}</span>
                                                {(() => {
                                                    const preferredMethod = (selectedClient as any).primaryContactInfo?.preferredMethod || (selectedClient as any).preferredContactMethod;
                                                    const isPhoneRelated = ['Phone', 'SMS', 'WhatsApp'].includes(preferredMethod);
                                                    if (!isPhoneRelated) return null;

                                                    return (
                                                        <div className="flex items-center gap-1 ml-0.5">
                                                            <i className="fa-solid fa-star text-yellow-500 text-[8px]"></i>
                                                            {preferredMethod === 'SMS' && <img src="/sms-icon.png" alt="SMS" className="w-3 h-3 object-contain" />}
                                                            {preferredMethod === 'WhatsApp' && <img src="/whatsapp-icon.png" alt="WhatsApp" className="w-3 h-3 object-contain" />}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>


                                </div>
                                <div className="flex gap-2 mr-12">
                                    <button
                                        onClick={handleCreateEventClick}
                                        className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-calendar-plus text-indigo-500"></i> Event
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowTasksModal(true);
                                        }}
                                        className="px-3 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-list-check text-amber-500"></i> Task
                                    </button>

                                    <button
                                        onClick={() => setShowEditModal(true)}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all active:scale-95"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-4 bg-slate-50/50 space-y-4 overflow-y-auto overflow-x-auto custom-scrollbar">
                            {/* Funnel Stage Timeline */}
                            <div className="bg-white rounded-2xl py-3 px-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                                {/* Decorative Gradient Background */}
                                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/30 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none group-hover:bg-indigo-100/40 transition-colors duration-1000"></div>

                                <div className="relative pt-4 pb-1">
                                    {/* Progress Track Background */}
                                    <div className="absolute top-[34px] left-2 right-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                                        {/* Dynamic Progress Fill */}
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${(() => {
                                                    const stages = ['Leads', 'Nurture', 'Active Search', 'Offer', 'Contract', 'Closed'];
                                                    const currentStage = (selectedClient as any).funnelStage || 'Leads';
                                                    const index = stages.indexOf(currentStage);
                                                    if (index === -1) return 0;
                                                    return (index / (stages.length - 1)) * 100;
                                                })()}%`
                                            }}
                                        ></div>
                                    </div>

                                    {/* Milestone Points */}
                                    <div className="relative flex justify-between">
                                        {[
                                            { label: 'Leads', icon: 'fa-user-tag' },
                                            { label: 'Nurture', icon: 'fa-seedling' },
                                            { label: 'Active Search', icon: 'fa-house-magnifying-glass' },
                                            { label: 'Offer', icon: 'fa-file-signature' },
                                            { label: 'Contract', icon: 'fa-handshake' },
                                            { label: 'Closed', icon: 'fa-trophy' }
                                        ].map((stage, idx, arr) => {
                                            const currentStage = (selectedClient as any).funnelStage || 'Leads';
                                            const currentIndex = arr.map(s => s.label).indexOf(currentStage);
                                            const isCompleted = idx < currentIndex;
                                            const isCurrent = idx === currentIndex;
                                            const isPending = idx > currentIndex;

                                            // Find the date the client entered this stage
                                            let entryDate = null;
                                            if (!isPending) {
                                                const history = (selectedClient as any).stageHistory || [];
                                                const historyEntry = history.find((h: any) => h.toStage === stage.label);
                                                if (historyEntry) {
                                                    entryDate = historyEntry.enteredAt;
                                                } else if (stage.label === 'Leads') {
                                                    entryDate = (selectedClient as any).receivedAt || (selectedClient as any).createdAt || (selectedClient as any).createdDate;
                                                }
                                            }

                                            return (
                                                <div key={idx} className="flex flex-col items-center relative z-10 group/milestone min-w-[60px]">
                                                    {/* Entered At Date */}
                                                    {entryDate && (
                                                        <div className="absolute -top-5 text-[7px] font-black text-slate-900 uppercase tracking-widest whitespace-nowrap z-20 animate-in fade-in slide-in-from-bottom-1 duration-500">
                                                            {formatDate(entryDate)}

                                                        </div>
                                                    )}

                                                    {/* The Milestone Circle */}
                                                    <div className={`
                                                        w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500 border-2
                                                        ${isCompleted ? 'bg-indigo-600 border-white shadow-lg shadow-indigo-100 scale-90' : ''}
                                                        ${isCurrent ? 'bg-white border-indigo-600 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50 scale-110' : ''}
                                                        ${isPending ? 'bg-white border-slate-50 text-slate-200 shadow-sm' : ''}
                                                    `}>
                                                        {isCurrent && entryDate && (
                                                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-indigo-500 uppercase tracking-widest whitespace-nowrap bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                                                                <i className="fa-regular fa-clock text-[7px]"></i>
                                                                {Math.floor((new Date().getTime() - (entryDate.toDate ? entryDate.toDate() : new Date(entryDate)).getTime()) / (1000 * 60 * 60 * 24))} Days
                                                            </div>
                                                        )}
                                                        <i className={`
                                                            fa-solid ${stage.icon} text-xs transition-colors duration-500
                                                            ${isCompleted ? 'text-white' : ''}
                                                            ${isCurrent ? 'text-indigo-600' : ''}
                                                            ${isPending ? 'text-slate-200' : ''}
                                                        `}></i>
                                                    </div>

                                                    {/* Label */}
                                                    <div className="mt-2 text-center">
                                                        <p className={`
                                                            text-[8px] font-black uppercase tracking-widest transition-colors duration-500 whitespace-nowrap
                                                            ${isCurrent ? 'text-indigo-600' : 'text-slate-400'}
                                                            ${isCompleted ? 'text-slate-800' : ''}
                                                        `}>
                                                            {stage.label}
                                                        </p>
                                                        {isCurrent && (selectedClient as any).status && (
                                                            <div className="mt-0.5 px-1.5 py-0 bg-slate-100 text-slate-500 text-[7px] font-black uppercase tracking-widest rounded-md animate-in fade-in zoom-in-95 duration-500">
                                                                {(selectedClient as any).status}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            {/* Snapshot Box */}
                            <div
                                ref={snapshotRef}
                                className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 relative min-h-[300px]"
                            >
                                {/* Stuck Notes (Unified) */}
                                {(leadNotes[selectedId || ''] || []).filter(n => n.x !== undefined).map((note, idx) => (
                                    <div
                                        key={note.id || idx}
                                        onMouseDown={(e) => handleMouseDownOnNote(e, idx)}
                                        className={`absolute w-32 h-32 bg-yellow-200 border border-yellow-300 shadow-xl rounded-sm flex flex-col p-2 z-10 group/note transition-all ${movingNoteIndex === idx ? 'cursor-grabbing shadow-2xl scale-105 z-20' : 'cursor-grab'} ${!note.content ? 'animate-in zoom-in-50 duration-200' : ''} hover:border-yellow-400`}
                                        style={{
                                            left: `${note.x}%`,
                                            top: `${note.y}%`,
                                            transform: `rotate(${note.rotation}deg)`
                                        }}
                                    >
                                        <div className="absolute -top-2 -right-2 hidden group-hover/note:flex z-20">
                                            <button
                                                onClick={() => closeStuckNote(idx)}
                                                className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                                            >
                                                <i className="fa-solid fa-xmark text-[10px]"></i>
                                            </button>
                                        </div>
                                        <div className="w-full border-t-2 border-yellow-400/40 h-0.5 mb-1.5 rounded-full pointer-events-none"></div>
                                        <div className="relative flex-1 flex flex-col">
                                            <textarea
                                                autoFocus={!note.content}
                                                className="flex-1 bg-transparent border-none outline-none resize-none text-[10px] font-bold text-slate-800 placeholder:text-yellow-700/40 leading-tight cursor-text focus:placeholder:opacity-0 transition-opacity"
                                                placeholder="Click here to add comment..."
                                                value={note.content}
                                                onChange={(e) => {
                                                    const allNotes = [...(leadNotes[selectedId || ''] || [])];
                                                    const stickies = allNotes.filter(n => n.x !== undefined);
                                                    const nonStickies = allNotes.filter(n => n.x === undefined);

                                                    if (stickies[idx]) {
                                                        stickies[idx].content = e.target.value;
                                                        setLeadNotes(prev => ({ ...prev, [selectedId || '']: [...stickies, ...nonStickies] }));
                                                    }
                                                }}
                                                onBlur={() => addRealtorNote(selectedId || '', note.content)}
                                            />
                                            {!note.content && (
                                                <div className="absolute top-0 right-0 opacity-20 pointer-events-none group-hover/note:opacity-40 transition-opacity">
                                                    <i className="fa-solid fa-pencil text-[8px]"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-1 pointer-events-none">
                                            <div className="text-[6px] font-bold text-yellow-700/30 uppercase flex items-center gap-1">
                                                <i className="fa-solid fa-i-cursor text-[6px]"></i> Editable
                                            </div>
                                            <div className="text-[6px] font-black text-black uppercase tracking-widest uppercase">
                                                {note.timestamp ? formatDate(note.timestamp) : formatDate(new Date())}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Offer Snapshot (Only for Offer Stage) */}
                                {(selectedClient as any).funnelStage === 'Offer' && (
                                    <>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                                                <i className="fa-solid fa-file-signature text-xs"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900">Offer Snapshot</h3>
                                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Current Offer Details</p>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 relative">
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-3 gap-x-4">
                                                <div className="space-y-0.5">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Offer Price</div>
                                                    <div className="text-xs font-medium text-slate-800">
                                                        {(selectedClient as any).activeOffer?.price
                                                            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((selectedClient as any).activeOffer.price)
                                                            : (selectedClient as any).offers?.[0]?.bidPrice
                                                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((selectedClient as any).offers[0].bidPrice)
                                                                : '---'}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Offer Date</div>
                                                    <div className="text-xs font-medium text-slate-800">
                                                        {(selectedClient as any).activeOffer?.offerDate
                                                            ? formatDate((selectedClient as any).activeOffer.offerDate)
                                                            : (selectedClient as any).offers?.[0]?.date
                                                                ? formatDate((selectedClient as any).offers[0].date)
                                                                : '---'}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Earnest Money</div>
                                                    <div className="text-xs font-medium text-slate-800">
                                                        {(selectedClient as any).activeOffer?.earnestMoney
                                                            ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((selectedClient as any).activeOffer.earnestMoney)
                                                            : '---'}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5 md:col-span-2">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contingencies</div>
                                                    <div className="text-xs font-medium text-slate-800 truncate">
                                                        {(selectedClient as any).activeOffer?.contingencies?.join(', ') || 'None'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Search Snapshot (Active Search OR Offer Stage) */}
                                {['Active Search', 'Offer'].includes((selectedClient as any).funnelStage) && (
                                    <>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
                                                <i className="fa-solid fa-magnifying-glass text-xs"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900">Search Snapshot</h3>
                                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Active Search Activity</p>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 relative">
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-3 gap-x-4">
                                                {(selectedClient as any).leadType === 'Buyer' ? (
                                                    <>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Search Status</div>
                                                            <div className="text-xs font-medium text-slate-800">{(selectedClient as any).status || '---'}</div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Must Haves</div>
                                                            <div className="text-xs font-medium text-slate-800">{(selectedClient as any).searchCriteria?.mustHaves || '---'}</div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Areas</div>
                                                            <div className="text-xs font-medium text-slate-800">{(selectedClient as any).searchCriteria?.location || '---'}</div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Property Tours</div>
                                                            <div className="text-xs font-medium text-slate-800">{(selectedClient as any).tours?.length || 0} Scheduled</div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Past Offers</div>
                                                            <div className="text-xs font-medium text-slate-800">{(selectedClient as any).historicalOffers?.length || 0} Rejected</div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Deal Breakers</div>
                                                            <div className="text-xs font-medium text-rose-600 truncate">{(selectedClient as any).searchCriteria?.dealBreakers || '---'}</div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Listing Status</div>
                                                            <div className="text-xs font-medium text-slate-800">{(selectedClient as any).status || '---'}</div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Visitors</div>
                                                            <div className="text-xs font-medium text-slate-800">
                                                                {(selectedClient as any).visitors?.reduce((acc: number, v: any) => acc + (v.visitCount || 0), 0) || 0} Visits
                                                            </div>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Interested Buyers</div>
                                                            <div className="text-xs font-medium text-emerald-600">
                                                                {(selectedClient as any).visitors?.filter((v: any) => v.isInterested).length || 0} Interested
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                                {/* Closing/Contract Snapshot (Only for Contract/Closing Stages) */}
                                {['Contract', 'Closing', 'Closed'].includes((selectedClient as any).funnelStage) && (
                                    <>
                                        <div className="flex items-center gap-2 mb-2 mt-4">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                <i className="fa-solid fa-handshake text-xs"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-900">Closing Snapshot</h3>
                                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">Critical Dates & Partners</p>
                                            </div>
                                            {(selectedClient as any).closingHealth && (
                                                <div className={`ml-auto px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${(selectedClient as any).closingHealth === 'On Track' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    (selectedClient as any).closingHealth === 'Delayed' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        'bg-rose-50 text-rose-600 border-rose-100'
                                                    }`}>
                                                    {(selectedClient as any).closingHealth}
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 relative">
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-3 gap-x-4">
                                                <div className="space-y-0.5">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inspection End</div>
                                                    <div className="text-xs font-medium text-slate-800">
                                                        {(selectedClient as any).criticalDates?.inspectionEnd ? formatDate((selectedClient as any).criticalDates.inspectionEnd) : '---'}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Appraisal Date</div>
                                                    <div className="text-xs font-medium text-slate-800">
                                                        {(selectedClient as any).criticalDates?.appraisalDate ? formatDate((selectedClient as any).criticalDates.appraisalDate) : '---'}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Closing Date</div>
                                                    <div className="text-xs font-medium text-indigo-600 font-bold">
                                                        {(selectedClient as any).criticalDates?.closingDate ? formatDate((selectedClient as any).criticalDates.closingDate) : '---'}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lender POC</div>
                                                    <div className="text-xs font-medium text-slate-800 truncate">
                                                        {(selectedClient as any).transactionTeam?.lenderPOC || '---'}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Escrow Officer</div>
                                                    <div className="text-xs font-medium text-slate-800 truncate">
                                                        {(selectedClient as any).transactionTeam?.escrowOfficer || '---'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-50">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                        <i className="fa-solid fa-bolt text-xs"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900">Client Snapshot</h3>
                                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">who the person is, what they want</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-3 gap-x-4">
                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Window</div>
                                        <div className="text-xs font-medium text-slate-800 tracking-tight">{(selectedClient as any).targetTimeline || '---'}</div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Client Persona</div>
                                        <div className="text-xs font-medium text-slate-800 tracking-tight">{(selectedClient as any).personaProfile || '---'}</div>
                                    </div>

                                    <div className="space-y-0.5 text-left">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Motivation</div>
                                        <div className="text-xs font-medium text-slate-800 tracking-tight">{(selectedClient as any).motivation || '---'}</div>
                                    </div>

                                    <div className="space-y-0.5 text-left">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Source</div>
                                        <div className="text-xs font-medium text-slate-800 tracking-tight">{(selectedClient as any).source || (selectedClient as any).leadInfo?.origin || 'Direct'}</div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inquiry Property</div>
                                        <div className="text-xs font-medium text-slate-800 truncate">{(selectedClient as any).leadInfo?.inquiryProperty?.address || (selectedClient as any).subjectProperty || '---'}</div>
                                    </div>

                                    {(selectedClient as any).leadType === 'Buyer' && (
                                        <div className="space-y-0.5">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Buying Power</div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-xs font-medium text-emerald-600">
                                                    {(selectedClient as any).financialVitals?.budgetMax
                                                        ? `$${((selectedClient as any).financialVitals.budgetMax).toLocaleString()}`
                                                        : (selectedClient as any).maxPrice
                                                            ? `$${((selectedClient as any).maxPrice).toLocaleString()}`
                                                            : '---'}
                                                </div>
                                                {(selectedClient as any).financialVitals?.preApprovalStatus && (
                                                    <div className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded">Pre-Approved</div>
                                                )}
                                                {(selectedClient as any).financialVitals?.isAllCash && (
                                                    <div className="px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[8px] font-black uppercase rounded">All Cash</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {(selectedClient as any).leadType === 'Buyer' && (
                                        <div className="space-y-0.5">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Budget Range</div>
                                            <div className="text-xs font-medium text-slate-800 tracking-tight">{(selectedClient as any).leadInfo?.budgetRange || '---'}</div>
                                        </div>
                                    )}

                                    {(selectedClient as any).leadType === 'Buyer' && (
                                        <div className="space-y-0.5 md:col-span-1 lg:col-span-3">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hard Requirements</div>
                                            <div className="text-xs font-medium text-slate-800 leading-tight">{(selectedClient as any).searchCriteria?.mustHaves || 'No specific requirements listed.'}</div>
                                        </div>
                                    )}

                                    {(selectedClient as any).leadType === 'Seller' && (
                                        <>
                                            <div className="space-y-0.5">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">When to Sell</div>
                                                <div className="text-xs font-medium text-slate-800 tracking-tight">{(selectedClient as any).sellWhen || '---'}</div>
                                            </div>
                                            <div className="space-y-0.5 md:col-span-1 lg:col-span-2">
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Listing Readiness</div>
                                                <div className="flex items-center gap-2">
                                                    {(selectedClient as any).listingStatus?.estimatedValue && (
                                                        <div className="text-xs font-medium text-emerald-600">
                                                            Est. ${(selectedClient as any).listingStatus.estimatedValue.toLocaleString()}
                                                        </div>
                                                    )}
                                                    {(selectedClient as any).listingStatus?.occupancyStatus && (
                                                        <div className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black uppercase rounded">{(selectedClient as any).listingStatus.occupancyStatus}</div>
                                                    )}
                                                    {!(selectedClient as any).listingStatus?.estimatedValue && !(selectedClient as any).listingStatus?.occupancyStatus && (
                                                        <div className="text-xs font-medium text-slate-800 tracking-tight">---</div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-0.5 md:col-span-1 lg:col-span-2">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer Message</div>
                                        <div className="text-xs font-medium text-slate-800 leading-tight">{(selectedClient as any).leadInfo?.customerMessage || 'No inquiry message provided.'}</div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Follow-up Deadline</div>
                                        <div className={`text-xs font-medium tracking-tight ${(selectedClient as any).staleWarningDate && new Date((selectedClient as any).staleWarningDate) < new Date() ? 'text-rose-600' : 'text-slate-800'}`}>
                                            {(selectedClient as any).staleWarningDate ? formatDate((selectedClient as any).staleWarningDate) : '---'}
                                        </div>
                                    </div>
                                </div>

                                {/* Communication History Table */}
                                <div className="mt-6 pt-4 border-t border-slate-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
                                            <i className="fa-solid fa-comments text-[10px]"></i>
                                        </div>
                                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Communication History</h4>
                                        <div className="px-1.5 py-0.5 ml-auto bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest border border-slate-200">
                                            {(selectedClient as any).callCount || 0} Calls
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-white">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/60">
                                                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100/50 last:border-0">Date</th>
                                                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100/50 last:border-0">Channel</th>
                                                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100/50 last:border-0">Summary</th>
                                                    <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {((selectedClient as any).nurtureLog || []).length > 0 ? (
                                                    (selectedClient as any).nurtureLog.map((msg: any, i: number) => (
                                                        <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                                                            <td className="px-3 py-2 text-[10px] font-medium text-slate-500 font-mono italic">{formatDate(msg.CallDate)}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <i className={`fa-solid ${msg.CommChannel === 'Phone' ? 'fa-phone text-indigo-500' : msg.CommChannel === 'Text' ? 'fa-message-sms text-sky-500' : 'fa-envelope text-emerald-500'} text-[9px]`}></i>
                                                                    <span className="text-[10px] font-medium text-slate-900 uppercase tracking-tighter">{msg.CommChannel}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-[10px] font-medium text-slate-600 truncate max-w-xs">{msg.Note}</td>
                                                            <td className="px-3 py-2 text-right">
                                                                <span className="px-1.5 py-0.5 bg-slate-100/80 text-slate-600 text-[7px] font-black uppercase rounded-md shadow-sm">
                                                                    Logged
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="px-3 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                            No communication logged yet
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Tour Feedback & Historical Offers */}
                                {(((selectedClient as any).tourFeedback || []).length > 0 || ((selectedClient as any).historicalOffers || []).length > 0) && (
                                    <div className="mt-6 pt-4 border-t border-slate-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 shadow-inner border border-orange-100">
                                                <i className="fa-solid fa-house-circle-check text-[10px]"></i>
                                            </div>
                                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Activities & Feedback</h4>
                                        </div>

                                        <div className="space-y-3">
                                            {/* Tour Feedback */}
                                            {((selectedClient as any).tourFeedback || []).map((tour: any, i: number) => (
                                                <div key={i} className="flex gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] font-black text-slate-900 truncate">{tour.property?.address}</span>
                                                            <div className="flex gap-0.5">
                                                                {[...Array(5)].map((_, star) => (
                                                                    <i key={star} className={`fa-solid fa-star text-[8px] ${star < tour.rating ? 'text-amber-400' : 'text-slate-200'}`}></i>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-600 leading-tight italic">"{tour.feedback}"</p>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Historical Offers */}
                                            {((selectedClient as any).historicalOffers || []).map((off: any, i: number) => (
                                                <div key={i} className="flex gap-3 p-3 bg-rose-50/30 rounded-xl border border-rose-100/50">
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] font-black text-rose-900 truncate">{off.propertyAddress}</span>
                                                            <span className="text-[9px] font-bold text-rose-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(off.offerPrice)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-1.5 py-0.5 bg-rose-100/50 text-rose-600 text-[7px] font-black uppercase rounded">Rejected: {off.rejectionReason}</span>
                                                            <p className="text-[9px] text-slate-500 font-medium truncate ml-2">Notes: {off.agentNotes}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* Events & Tasks Container */}
                            {(loadingEvents || clientEvents.length > 0 || clientTasks.length > 0) && (
                                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                                                <i className="fa-solid fa-calendar-check text-lg"></i>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Events & Tasks</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none mt-0.5">Scheduled activity with this client</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                {clientEvents.length} Events
                                            </div>
                                            <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100">
                                                {clientTasks.length} Tasks
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-inner bg-slate-50/30">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white border-b border-slate-100">
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-32">Date & Time</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] w-24">Category</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Activity Details</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {loadingEvents ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-8 text-center bg-white/50">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="w-5 h-5 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fetching schedule...</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : clientEvents.length === 0 && clientTasks.length === 0 ? (
                                                    // This case is theoretically unreachable now due to parent condition, but kept for type safety/fallback
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-12 text-center bg-white/50">
                                                            <div className="flex flex-col items-center opacity-40">
                                                                <i className="fa-solid fa-calendar-day text-3xl mb-3 text-slate-300"></i>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">No activities scheduled yet</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    <>
                                                        {/* Merge and Sort Events and Tasks */}
                                                        {[
                                                            ...clientEvents.map(e => ({ ...e, cat: 'Event' })),
                                                            ...clientTasks.map(t => ({ ...t, cat: 'Task', start: t.dueDate ? (t.dueDate instanceof Date ? t.dueDate : (t.dueDate as any).toDate ? (t.dueDate as any).toDate() : new Date(t.dueDate)) : new Date() }))
                                                        ].sort((a, b) => b.start.getTime() - a.start.getTime()).map((item: any, i) => (
                                                            <tr key={i} className="group hover:bg-white transition-all">
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[11px] font-black text-slate-900">{formatDate(item.start)}</span>
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                                                                            {item.cat === 'Event' ? item.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Due Today'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className={`
                                                                        inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider
                                                                        ${item.cat === 'Event' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-amber-50 border-amber-100 text-amber-600'}
                                                                    `}>
                                                                        <i className={`fa-solid ${item.cat === 'Event' ? 'fa-calendar' : 'fa-list-check'} text-[8px]`}></i>
                                                                        {item.cat}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-slate-800">{item.title}</span>
                                                                        {item.description && (
                                                                            <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{item.description}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <span className={`
                                                                        px-2.5 py-0.5 bg-white border border-slate-100 text-[8px] font-black uppercase tracking-widest rounded-lg shadow-sm
                                                                        ${item.status === 'Completed' || item.status === 'Done' ? 'text-emerald-500' : 'text-slate-400'}
                                                                    `}>
                                                                        {item.status || 'Active'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Miscellaneous Data Fields */}
                            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                                    <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
                                        <i className="fa-solid fa-list-check text-[10px]"></i>
                                    </div>
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Wait! There's More</h4>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6">
                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Created Date</div>
                                        <div className="text-xs font-bold text-slate-800">{formatDate((selectedClient as any).receivedAt || (selectedClient as any).createdAt)}</div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Legal Name</div>
                                        <div className="text-xs font-bold text-slate-800">{(selectedClient as any).legalName || '---'}</div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Zillow Property ID</div>
                                        <div className="text-xs font-bold text-slate-800">{(selectedClient as any).zpid || '---'}</div>
                                    </div>

                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Referral Type</div>
                                        <div className="text-xs font-bold text-slate-800">{(selectedClient as any).leadInfo?.referralType || '---'}</div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marketing Campaign</div>
                                        <div className="text-xs font-bold text-slate-800">{(selectedClient as any).leadInfo?.campaign || '---'}</div>
                                    </div>
                                    {(selectedClient as any).leadType === 'Buyer' && (
                                        <div className="space-y-0.5">
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lease End Date</div>
                                            <div className="text-xs font-bold text-slate-800">{formatDate((selectedClient as any).leaseEndDate)}</div>
                                        </div>
                                    )}

                                    <div className="space-y-0.5 md:col-span-2">
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Home Address</div>
                                        <div className="text-xs font-bold text-slate-800 truncate">{(selectedClient as any).primaryContact?.homeAddress || '---'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Stage History Log */}
                            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                                    <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
                                        <i className="fa-solid fa-code-branch text-[10px]"></i>
                                    </div>
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Stage History Log</h4>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-slate-100 shadow-inner bg-slate-50/30">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-white border-b border-slate-100 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                                            <tr>
                                                <th className="px-4 py-3 w-32">Date</th>
                                                <th className="px-4 py-3">Previous Stage</th>
                                                <th className="px-4 py-3">New Stage</th>
                                                <th className="px-4 py-3 text-right">Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {((selectedClient as any).stageHistory || []).map((history: any, i: number) => (
                                                <tr key={i} className="hover:bg-white transition-colors">
                                                    <td className="px-4 py-3 text-[10px] font-black text-slate-900 font-mono italic">
                                                        {formatDate(history.enteredAt)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black uppercase rounded-lg tracking-wider border border-slate-200">
                                                            {history.fromStage}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase rounded-lg tracking-wider border border-indigo-100">
                                                            {history.toStage}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-[10px] font-bold text-slate-400 text-right">
                                                        ---
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!((selectedClient as any).stageHistory) || (selectedClient as any).stageHistory.length === 0) && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-[10px] italic bg-white/50">
                                                        No stage history available.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <i className="fa-regular fa-folder-open text-4xl mb-4 opacity-30"></i>
                            <p className="text-sm font-medium">Select a client to view details</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Global Dragging Note Portal */}
            {
                draggingNote && (
                    <div
                        className="fixed w-12 h-12 bg-yellow-200 border border-yellow-300 shadow-2xl rounded-sm pointer-events-none z-[9999]"
                        style={{
                            left: draggingNote.x,
                            top: draggingNote.y,
                            transform: 'translate(-50%, -50%) rotate(-5deg)'
                        }}
                    >
                        <div className="w-full border-t border-yellow-400 opacity-20 h-0.5 mt-2"></div>
                    </div>
                )
            }

            {/* CREATE EVENT MODAL */}
            {
                draftEvent && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                            <div className={`h-3 ${draftEvent.type === 'open-house' ? 'bg-emerald-500' : draftEvent.type === 'task' ? 'bg-amber-500' : 'bg-indigo-500'}`} />

                            <div className="p-10">
                                <div className="flex justify-between items-start mb-8 gap-4">
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 block mb-2">
                                            New Event
                                        </span>
                                        <textarea
                                            rows={1}
                                            className="text-xl font-bold text-slate-900 border-b border-slate-100 focus:border-indigo-600 outline-none w-full pb-1 bg-transparent resize-none overflow-hidden"
                                            defaultValue={draftEvent.title}
                                            onChange={(e) => {
                                                setDraftEvent({ ...draftEvent, title: e.target.value });
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        onClick={() => setDraftEvent(null)}
                                        className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Date */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                            <i className="fa-solid fa-calendar-day"></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Date</p>
                                            <input
                                                type="date"
                                                className="bg-slate-50 border-none rounded-lg px-3 py-1 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                                                value={formatDateToInput(draftEvent.start)}
                                                onChange={(e) => {
                                                    const [y, m, d] = e.target.value.split('-').map(Number);
                                                    const newStart = new Date(draftEvent.start);
                                                    newStart.setFullYear(y, m - 1, d);
                                                    const newEnd = new Date(draftEvent.end);
                                                    newEnd.setFullYear(y, m - 1, d);
                                                    setDraftEvent({ ...draftEvent, start: newStart, end: newEnd });
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Time */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                            <i className="fa-solid fa-clock-rotate-left"></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Time Range</p>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    className="bg-slate-50 border-none rounded-lg px-3 py-1 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={formatTimeToInput(draftEvent.start)}
                                                    onChange={(e) => {
                                                        const [h, m] = e.target.value.split(':').map(Number);
                                                        const newStart = new Date(draftEvent.start);
                                                        newStart.setHours(h, m);
                                                        const duration = draftEvent.end.getTime() - draftEvent.start.getTime();
                                                        setDraftEvent({ ...draftEvent, start: newStart, end: new Date(newStart.getTime() + duration) });
                                                    }}
                                                />
                                                <span className="text-slate-400 font-semibold">to</span>
                                                <input
                                                    type="time"
                                                    className="bg-slate-50 border-none rounded-lg px-3 py-1 text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    value={formatTimeToInput(draftEvent.end)}
                                                    onChange={(e) => {
                                                        const [h, m] = e.target.value.split(':').map(Number);
                                                        const newEnd = new Date(draftEvent.end);
                                                        newEnd.setHours(h, m);
                                                        setDraftEvent({ ...draftEvent, end: newEnd });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Client */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                            <i className="fa-solid fa-user-tie"></i>
                                        </div>
                                        <div className="flex-1 relative">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Client</p>
                                            <ClientSelector
                                                leads={allClients.map(c => ({ ...c, id: c.id, fullName: getName(c) } as unknown as Lead))}
                                                selectedClientId={draftEvent.clientId}
                                                onSelect={(id, name) => setDraftEvent({ ...draftEvent, clientId: id, client: name })}
                                            />
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mt-1">
                                            <i className="fa-solid fa-align-left"></i>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Description</p>
                                            <textarea
                                                className="w-full text-slate-600 font-medium border border-slate-100 rounded-2xl p-4 focus:border-indigo-600 outline-none min-h-[100px]"
                                                defaultValue={draftEvent.description}
                                                onChange={(e) => setDraftEvent({ ...draftEvent, description: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 flex gap-4">
                                    <button
                                        onClick={handleSaveNewEvent}
                                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                                    >
                                        Create Event
                                    </button>
                                    <button
                                        onClick={() => setDraftEvent(null)}
                                        className="px-6 py-2.5 bg-slate-50 text-slate-400 rounded-xl font-bold uppercase tracking-wider text-[11px] hover:text-slate-600 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Tasks Modal */}
            {showTasksModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Client Tasks</h2>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{getName(selectedClient)}</p>
                            </div>
                            <button
                                onClick={() => setShowTasksModal(false)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* New Task Form */}
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                                <label
                                    onClick={cancelEditing}
                                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 block cursor-pointer hover:text-indigo-800 transition-colors flex items-center justify-between"
                                >
                                    {editingTask ? 'Editing Task (Click to Add New)' : 'Add New Task'}
                                    {editingTask && <i className="fa-solid fa-plus-circle"></i>}
                                </label>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="What needs to be done?"
                                        className="w-full px-4 py-2.5 bg-white border border-indigo-100 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={newTaskName}
                                        onChange={(e) => setNewTaskName(e.target.value)}
                                    />
                                    <div className="flex gap-3">
                                        <div className="flex-1 relative group">
                                            <i className="fa-solid fa-calendar-days absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300 text-[10px] group-focus-within:text-indigo-500 transition-colors pointer-events-none"></i>
                                            <input
                                                type={newTaskDate ? "date" : "text"}
                                                placeholder="Add due date (optional)"
                                                onFocus={(e) => (e.target.type = "date")}
                                                onBlur={(e) => {
                                                    if (!e.target.value) e.target.type = "text";
                                                }}
                                                className="w-full pl-8 pr-4 py-2 bg-white border border-indigo-100 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                value={newTaskDate}
                                                onChange={(e) => setNewTaskDate(e.target.value)}
                                            />
                                        </div>
                                        <select
                                            className="px-4 py-2 bg-white border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            value={newTaskPriority}
                                            onChange={(e) => setNewTaskPriority(e.target.value as any)}
                                        >
                                            <option value="Low">Low</option>
                                            <option value="Normal">Normal</option>
                                            <option value="High">High</option>
                                            <option value="Urgent">Urgent</option>
                                        </select>
                                    </div>
                                    <textarea
                                        placeholder="Add notes or details..."
                                        className="w-full px-4 py-2.5 bg-white border border-indigo-100 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[80px]"
                                        value={newTaskNote}
                                        onChange={(e) => setNewTaskNote(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleAddTask}
                                            disabled={!newTaskName.trim() || isAddingTask}
                                            className="flex-1 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                                        >
                                            {isAddingTask ? (
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            ) : editingTask ? (
                                                <i className="fa-solid fa-check-double"></i>
                                            ) : (
                                                <i className="fa-solid fa-plus"></i>
                                            )}
                                            {editingTask ? 'Update Task' : 'Create Task'}
                                        </button>
                                        {editingTask && (
                                            <button
                                                onClick={cancelEditing}
                                                className="px-4 py-2.5 bg-slate-100/50 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all border border-slate-200"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Upcoming Tasks List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Obligations</label>
                                    <button
                                        onClick={() => {
                                            if (setActiveTab) setActiveTab('tasks');
                                            setShowTasksModal(false);
                                        }}
                                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 flex items-center gap-1.5 group"
                                    >
                                        Go to Task Board
                                        <i className="fa-solid fa-arrow-right text-[8px] group-hover:translate-x-0.5 transition-transform"></i>
                                    </button>
                                </div>

                                <div className="max-h-60 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                    {clientTasks
                                        .filter(t => t.status !== 'DONE' && t.status !== 'Completed')
                                        .map(task => (
                                            <div
                                                key={task.id}
                                                className={`p-3 border rounded-xl flex items-center justify-between group/task transition-all ${editingTask?.id === task.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${task.priority === 'Urgent' ? 'bg-red-500 animate-pulse' : task.priority === 'High' ? 'bg-orange-500' : task.priority === 'Normal' ? 'bg-amber-400' : 'bg-slate-300'}`}></div>
                                                    <div className="cursor-pointer" onClick={() => startEditingTask(task)}>
                                                        <p className="text-xs font-bold text-slate-700">{task.name}</p>
                                                        <p className={`text-[9px] font-black uppercase tracking-tighter ${isOverdue(task.dueDate, task.status) ? 'text-red-500' : 'text-slate-400'}`}>
                                                            {isOverdue(task.dueDate, task.status) ? 'PAST DUE: ' : 'Due '}
                                                            {formatDate(task.dueDate)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 transition-opacity">
                                                    <button
                                                        onClick={() => startEditingTask(task)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all"
                                                        title="Edit Task"
                                                    >
                                                        <i className="fa-solid fa-pen text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteTask(task.id)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-100 transition-all"
                                                        title="Delete Task"
                                                    >
                                                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                    {clientTasks.filter(t => t.status !== 'DONE' && t.status !== 'Completed').length === 0 && (
                                        <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                            <i className="fa-solid fa-clipboard-list text-slate-200 text-2xl mb-2 block"></i>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">No active tasks</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Edit Modal */}
            {
                selectedClient && (
                    <ClientEditModal
                        client={selectedClient}
                        isOpen={showEditModal}
                        onClose={() => setShowEditModal(false)}
                        onSave={async (updates) => {
                            await persistChanges(selectedClient.id, updates);
                            setShowEditModal(false);
                        }}
                    />
                )
            }
        </div >
    );
};

export default ClientDetailsView;
