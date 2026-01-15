import React, { useState, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Lead, FunnelStage, PipelineNote } from '../../types';

const TypedDraggable = Draggable as any;
const TypedDroppable = Droppable as any;

interface PipelineBoardProps {
    subTab: 'buying' | 'selling';
    setSubTab: (tab: 'buying' | 'selling') => void;
    leads: Lead[];
    notes: PipelineNote[];
    pendingNote: { leadId: string, color: string } | null;
    setPendingNote: (note: { leadId: string, color: string } | null) => void;
    handleSaveNote: (content: string) => void;
    handleUpdateNote: (noteId: string, updates: Partial<PipelineNote>) => void;
    handleDeleteNote: (noteId: string) => void;
    setEditingLead: (lead: Lead) => void;
    handleDragEnd: (result: DropResult) => void;
    handleCreateLead: (initialUpdates?: Partial<Lead>) => void;
}

const noteTypes = [
    { id: 'note-yellow', color: 'bg-[#ffff88] text-slate-800 border-[#eeee77]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-blue', color: 'bg-[#7afaff] text-slate-800 border-[#69e9ee]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-pink', color: 'bg-[#ff7eb9] text-white border-[#ee6da8]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-green', color: 'bg-[#a7ffeb] text-slate-800 border-[#96eee0]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
];

const PipelineBoard: React.FC<PipelineBoardProps> = ({
    subTab,
    setSubTab,
    leads,
    notes,
    pendingNote,
    setPendingNote,
    handleSaveNote,
    handleUpdateNote,
    handleDeleteNote,
    setEditingLead,
    handleDragEnd,
    handleCreateLead,
}) => {
    const [draftContent, setDraftContent] = useState('');
    const [editNoteId, setEditNoteId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const [deleteCoords, setDeleteCoords] = useState<{ top: number, left: number } | null>(null);
    const [celebratingNoteId, setCelebratingNoteId] = useState<string | null>(null);
    const [isFlyingUpId, setIsFlyingUpId] = useState<string | null>(null);

    const onDoneToggle = (e: React.MouseEvent, note: PipelineNote) => {
        e.stopPropagation();
        if (note.isDone) {
            // If already done, just toggle it back normally
            handleUpdateNote(note.id, { isDone: false, timestamp: new Date() });
            return;
        }

        const rect = (e.currentTarget.closest('.post-it-container') as HTMLElement).getBoundingClientRect();
        setDeleteCoords({ top: rect.top, left: rect.left });

        // Stage 1: Shake and Dim
        setCelebratingNoteId(note.id);

        setTimeout(() => {
            // Stage 2: Fly Upward
            setCelebratingNoteId(null);
            setIsFlyingUpId(note.id);

            setTimeout(() => {
                // Final: Update state (this removes it from the card view)
                handleUpdateNote(note.id, { isDone: true, timestamp: new Date() });
                setIsFlyingUpId(null);
                setDeleteCoords(null);
            }, 800);
        }, 500);
    };

    const onDeleteClick = (e: React.MouseEvent, noteId: string) => {
        e.stopPropagation();
        const rect = (e.currentTarget.closest('.post-it-container') as HTMLElement).getBoundingClientRect();
        setDeleteCoords({ top: rect.top, left: rect.left });
        setDeletingNoteId(noteId);
        // Delay the actual deletion to allow animation to play
        setTimeout(() => {
            handleDeleteNote(noteId);
            setDeletingNoteId(null);
            setDeleteCoords(null);
        }, 800);
    };

    // Global click listener to "Complete" edits when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // If we click outside the post-it area entirely
            if (!target.closest('.post-it-container') && !target.closest('.note-palette-item')) {
                // Find any active post-it textarea and force blur to trigger its save logic
                const activeEl = document.activeElement;
                if (activeEl instanceof HTMLTextAreaElement &&
                    (activeEl.classList.contains('post-it-edit') || activeEl.classList.contains('post-it-draft'))) {
                    activeEl.blur();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const columns = [
        { stage: 'Nurture', label: 'Nurture', color: '#f59e0b', icon: 'fa-leaf' },
        { stage: 'Active', label: subTab === 'buying' ? 'Active Search' : 'Showing', color: '#6366f1', icon: 'fa-house-fire' },
        { stage: 'Offer', label: 'Offer', color: '#f43f5e', icon: 'fa-file-invoice-dollar' },
        { stage: 'UnderContract', label: 'Contract', color: '#10b981', icon: 'fa-handshake' },
        { stage: 'Closed', label: 'Closed', color: '#94a3b8', icon: 'fa-flag-checkered' },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                .post-it-font {
                    font-family: 'Architects Daughter', cursive;
                    line-height: 1.2;
                }
                @keyframes fly-to-trash {
                    0% {
                        transform: scale(1) rotate(0deg);
                        opacity: 1;
                        top: var(--start-top);
                        left: var(--start-left);
                    }
                    30% {
                        transform: scale(1.1) rotate(15deg);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(0.1) rotate(360deg);
                        opacity: 0;
                        top: 100vh;
                        left: 50vw;
                    }
                }
                .animate-fly-away {
                    position: fixed !important;
                    z-index: 9999 !important;
                    pointer-events: none;
                    animation: fly-to-trash 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
                }
                @keyframes fly-up-high {
                    0% {
                        transform: scale(1) rotate(0deg);
                        opacity: 1;
                        top: var(--start-top);
                        left: var(--start-left);
                    }
                    100% {
                        transform: scale(0.5) rotate(-15deg);
                        opacity: 0;
                        top: -200px;
                        left: var(--start-left);
                    }
                }
                .animate-fly-up {
                    position: fixed !important;
                    z-index: 9999 !important;
                    pointer-events: none;
                    animation: fly-up-high 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
                }
                @keyframes shake-only {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(-2deg); }
                    40% { transform: rotate(2deg); }
                    60% { transform: rotate(-2deg); }
                    80% { transform: rotate(2deg); }
                }
                .animate-shake {
                    animation: shake-only 0.5s ease-in-out;
                }
                @keyframes bin-shake {
                    0%, 100% { transform: scale(1); }
                    25% { transform: scale(1.1) rotate(-5deg); }
                    75% { transform: scale(1.1) rotate(5deg); }
                }
                .bin-active {
                    animation: bin-shake 0.3s ease-in-out infinite;
                }
                .bin-active {
                    animation: bin-shake 0.3s ease-in-out infinite;
                }
                @keyframes fire-flicker {
                    0%, 100% { transform: scale(1) rotate(-1deg); filter: drop-shadow(0 0 2px #ff4500); }
                    50% { transform: scale(1.1) rotate(1deg); filter: drop-shadow(0 0 5px #ff8c00); }
                }
                .animate-fire {
                    animation: fire-flicker 0.4s ease-in-out infinite;
                }
                .urgent-glow {
                    box-shadow: 0 0 10px rgba(255, 69, 0, 0.4) !important;
                    border: 1px solid rgba(255, 69, 0, 0.3) !important;
                }
            `}} />

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="p-8 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                    <div className="flex items-center gap-10">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => setSubTab('buying')}
                                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'buying' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Buyers
                            </button>
                            <button
                                onClick={() => setSubTab('selling')}
                                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${subTab === 'selling' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Sellers
                            </button>
                        </div>

                        <div className="h-8 w-px bg-slate-200"></div>

                        <TypedDroppable droppableId="palette" direction="horizontal" type="LEAD" isDropDisabled={true}>
                            {(provided: any) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="flex items-center gap-6"
                                >
                                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Post it:</div>
                                    <div className="flex items-center gap-8">
                                        {noteTypes.map((note, index) => (
                                            <TypedDraggable key={note.id} draggableId={note.id} index={index}>
                                                {(provided: any, snapshot: any) => (
                                                    <div className="relative group note-palette-item">
                                                        {/* Visual Stack Effect */}
                                                        {!snapshot.isDragging && (
                                                            <>
                                                                {/* Back Note */}
                                                                <div className={`absolute inset-0 -translate-x-1 translate-y-1 rounded-sm border border-black/10 opacity-60 ${note.color} ${note.shadow} -rotate-3 transition-transform group-hover:-translate-x-2 group-hover:translate-y-2`}></div>
                                                                {/* Middle Note */}
                                                                <div className={`absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-sm border border-black/5 opacity-40 ${note.color} ${note.shadow} rotate-2 transition-transform group-hover:translate-x-1 group-hover:translate-y-1`}></div>
                                                            </>
                                                        )}

                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`w-16 h-16 rounded-sm border-t border-black/5 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all hover:-translate-y-1 hover:rotate-3 ${note.color} ${note.shadow} ${snapshot.isDragging ? 'z-[100] rotate-6 scale-110 shadow-2xl ring-2 ring-white/50' : 'relative z-10'}`}
                                                        >
                                                            {/* Paperclip Effect */}
                                                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-7 border-2 border-slate-400/80 rounded-full bg-slate-200/50 z-20 shadow-sm opacity-80 group-hover:opacity-100 transition-opacity">
                                                                <div className="absolute inset-1 border-l border-slate-500/30 rounded-full"></div>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-black/5 absolute top-0"></div>
                                                            <i className="fa-solid fa-note-sticky opacity-20 text-[18px]"></i>
                                                        </div>
                                                    </div>
                                                )}
                                            </TypedDraggable>
                                        ))}
                                    </div>
                                    {provided.placeholder}
                                </div>
                            )}
                        </TypedDroppable>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto p-10 flex gap-8 whitespace-nowrap scrollbar-thin scrollbar-thumb-indigo-100">
                    {columns.map((col) => (
                        <div key={col.stage} className="min-w-[320px] max-w-[320px] flex flex-col gap-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                                    <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: col.color }}></div>
                                    <i className={`fa-solid ${col.icon} text-slate-300 mr-1`}></i>
                                    {col.label}
                                </h3>
                                <span className="text-[10px] font-bold text-slate-300">
                                    {leads.filter(l => l.funnelStage === col.stage && l.collectionName === (subTab === 'buying' ? 'buyers' : 'sellers')).length}
                                </span>
                            </div>

                            <TypedDroppable droppableId={col.stage} type="LEAD" isCombineEnabled={true}>
                                {(provided: any, snapshot: any) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`flex-1 flex flex-col gap-4 rounded-[2.5rem] p-4 transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/50 outline-2 outline-dashed outline-indigo-200' : ''}`}
                                        style={{ minHeight: '100px' }}
                                    >
                                        {leads
                                            .filter(l => l.funnelStage === col.stage && l.collectionName === (subTab === 'buying' ? 'buyers' : 'sellers'))
                                            .map((lead, index) => (
                                                <TypedDraggable key={lead.id} draggableId={lead.id} index={index}>
                                                    {(provided: any, snapshot: any) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={`bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all border-l-4 group relative ${snapshot.isDragging ? 'shadow-2xl scale-105 rotate-2 z-50 ring-4 ring-indigo-500/20' : ''} ${snapshot.combineTargetFor ? 'ring-4 ring-indigo-500 ring-offset-2 scale-105' : ''}`}
                                                            style={{
                                                                ...provided.draggableProps.style,
                                                                borderLeftColor: col.color
                                                            }}
                                                            onDoubleClick={(e) => {
                                                                setEditingLead(lead);
                                                            }}
                                                        >
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="font-bold text-slate-900 text-sm truncate">{lead.firstName} {lead.lastName}</div>
                                                                {lead.slaUrgency === 'high' && (
                                                                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse mt-1.5" title="High Urgency"></div>
                                                                )}
                                                            </div>

                                                            {lead.propertyAddress && subTab !== 'buying' && (
                                                                <div className="text-[10px] text-slate-500 font-medium mb-1 truncate flex items-center gap-1.5 gray-400">
                                                                    <i className="fa-solid fa-location-dot opacity-30 text-[8px]"></i>
                                                                    {lead.propertyAddress}
                                                                </div>
                                                            )}

                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-[10px] text-slate-400">
                                                                {lead.email && (
                                                                    <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                                                                        <i className="fa-solid fa-envelope opacity-30 text-[8px]"></i>
                                                                        {lead.email}
                                                                    </div>
                                                                )}
                                                                {lead.phone && (
                                                                    <div className="flex items-center gap-1.5 truncate">
                                                                        <i className="fa-solid fa-phone opacity-30 text-[8px]"></i>
                                                                        {lead.phone}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Render Physical Post-its */}
                                                            <div className="flex flex-wrap gap-4 mb-4 relative min-h-[40px]" onClick={(e) => e.stopPropagation()}>
                                                                {notes.filter(n => n.leadId === lead.id && !n.isDone).map((note, i) => (
                                                                    <div
                                                                        key={note.id}
                                                                        onClick={() => { if (!editNoteId) { setEditNoteId(note.id); setEditContent(note.content); } }}
                                                                        className={`p-3 pt-4 w-24 h-24 rounded-sm border-t border-black/5 text-[12px] font-bold post-it-font whitespace-normal shadow-lg transition-all hover:scale-110 hover:z-10 group/note flex flex-col relative cursor-pointer post-it-container ${note.color} ${i % 2 === 0 ? 'rotate-2' : '-rotate-3'} hover:rotate-0 ${note.isDone ? 'line-through' : ''} ${deletingNoteId === note.id ? 'animate-fly-away' : ''} ${celebratingNoteId === note.id ? 'animate-shake' : ''} ${isFlyingUpId === note.id ? 'animate-fly-up' : ''} ${note.isUrgent ? 'urgent-glow' : ''}`}
                                                                        style={{
                                                                            boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
                                                                            ...((deletingNoteId === note.id || isFlyingUpId === note.id) && deleteCoords ? {
                                                                                '--start-top': `${deleteCoords.top}px`,
                                                                                '--start-left': `${deleteCoords.left}px`
                                                                            } as any : {})
                                                                        }}
                                                                    >
                                                                        <div className="w-full h-1 bg-black/5 absolute top-0 left-0"></div>

                                                                        {note.isUrgent && (
                                                                            <div className="absolute top-1 right-1 animate-fire z-10">
                                                                                <i className="fa-solid fa-fire text-orange-500 text-[10px]"></i>
                                                                            </div>
                                                                        )}

                                                                        {/* Note Actions */}
                                                                        {!editNoteId && (
                                                                            <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity z-30">
                                                                                <button
                                                                                    onClick={(e) => onDoneToggle(e, note)}
                                                                                    className={`w-5 h-5 rounded-full ${note.isDone ? 'bg-emerald-500' : 'bg-slate-800'} text-white flex items-center justify-center hover:scale-110 transition-transform shadow-md`}
                                                                                >
                                                                                    <i className="fa-solid fa-circle-check text-[7px]"></i>
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); handleUpdateNote(note.id, { isUrgent: !note.isUrgent }); }}
                                                                                    className={`w-5 h-5 rounded-full ${note.isUrgent ? 'bg-orange-600' : 'bg-slate-800'} text-white flex items-center justify-center hover:scale-110 transition-transform shadow-md`}
                                                                                    title="Toggle Urgency"
                                                                                >
                                                                                    <i className="fa-solid fa-fire text-[7px]"></i>
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => onDeleteClick(e, note.id)}
                                                                                    className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                                                                                >
                                                                                    <i className="fa-solid fa-trash text-[7px]"></i>
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex-1 overflow-hidden flex flex-col">
                                                                            <div className="text-[7px] opacity-40 mb-1 font-sans uppercase tracking-tighter leading-none">
                                                                                {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(note.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                            </div>
                                                                            {editNoteId === note.id ? (
                                                                                <textarea
                                                                                    autoFocus
                                                                                    value={editContent}
                                                                                    onChange={(e) => setEditContent(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                                            handleUpdateNote(note.id, { content: editContent, timestamp: new Date() });
                                                                                            setEditNoteId(null);
                                                                                        }
                                                                                        if (e.key === 'Escape') setEditNoteId(null);
                                                                                    }}
                                                                                    onBlur={() => {
                                                                                        handleUpdateNote(note.id, { content: editContent, timestamp: new Date() });
                                                                                        setEditNoteId(null);
                                                                                    }}
                                                                                    className="w-full h-full bg-transparent border-none outline-none resize-none post-it-font text-[12px] font-bold p-0 post-it-edit"
                                                                                />
                                                                            ) : (
                                                                                <div className="text-[12px] font-bold post-it-font leading-tight">{note.content}</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                                {/* Inline Draft Post-it */}
                                                                {pendingNote?.leadId === lead.id && (
                                                                    <div
                                                                        className={`p-3 pt-4 w-24 h-24 rounded-sm border-t border-black/5 shadow-2xl z-20 scale-110 -rotate-2 relative post-it-container ${pendingNote.color}`}
                                                                    >
                                                                        <div className="w-full h-1 bg-black/5 absolute top-0 left-0"></div>
                                                                        <textarea
                                                                            autoFocus
                                                                            placeholder="Type note..."
                                                                            value={draftContent}
                                                                            onChange={(e) => setDraftContent(e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                                    e.preventDefault();
                                                                                    if (draftContent.trim()) handleSaveNote(draftContent);
                                                                                    setPendingNote(null);
                                                                                    setDraftContent('');
                                                                                }
                                                                                if (e.key === 'Escape') {
                                                                                    setPendingNote(null);
                                                                                    setDraftContent('');
                                                                                }
                                                                            }}
                                                                            onBlur={() => {
                                                                                if (draftContent.trim()) {
                                                                                    handleSaveNote(draftContent);
                                                                                }
                                                                                setPendingNote(null);
                                                                                setDraftContent('');
                                                                            }}
                                                                            className="w-full h-full bg-transparent border-none outline-none resize-none post-it-font text-[9px] font-bold post-it-placeholder placeholder:text-black/20 post-it-draft"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                                                                <div className="flex -space-x-1.5">
                                                                    <div className="w-6 h-6 rounded-full bg-slate-50 border border-white text-[8px] flex items-center justify-center font-black text-slate-400 shadow-sm group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                                        {lead.name[0]}
                                                                    </div>
                                                                    {lead.health === 'Active' && (
                                                                        <div className="w-6 h-6 rounded-full bg-emerald-50 border border-white flex items-center justify-center shadow-sm">
                                                                            <i className="fa-solid fa-bolt text-emerald-500 text-[8px]"></i>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {subTab === 'buying' ? (
                                                                        (lead.minPrice || lead.maxPrice) && (
                                                                            <div className="text-[10px] font-black text-slate-900">
                                                                                {lead.minPrice ? `$${(lead.minPrice / 1000).toFixed(0)}k` : '?'} - {lead.maxPrice ? `$${(lead.maxPrice / 1000).toFixed(0)}k` : '?'}
                                                                            </div>
                                                                        )
                                                                    ) : (
                                                                        lead.price && (
                                                                            <div className="text-[10px] font-black text-slate-900">${(lead.price / 1000).toFixed(0)}k</div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </TypedDraggable>
                                            ))}
                                        {provided.placeholder}
                                        <button
                                            onClick={() => handleCreateLead({ funnelStage: col.stage as FunnelStage, leadType: subTab === 'buying' ? 'Buyer' : 'Seller', status: 'Active' })}
                                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-indigo-300 hover:text-indigo-500 hover:bg-slate-50 transition-all group/btn mt-2"
                                        >
                                            <i className="fa-solid fa-plus mr-2 group-hover/btn:scale-110 transition-transform"></i>
                                            Add {subTab === 'buying' ? 'Buyer' : 'Seller'}
                                        </button>
                                    </div>
                                )}
                            </TypedDroppable>
                        </div>
                    ))
                    }
                </div >
            </DragDropContext >
            {/* Trash Bin for Fly-away Animation */}
            {
                deletingNoteId && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2 pointer-events-none">
                        <div className="w-16 h-16 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-2xl bin-active">
                            <i className="fa-solid fa-trash-can text-2xl"></i>
                        </div>
                        <span className="text-rose-600 font-bold text-xs uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm">Discarding...</span>
                    </div>
                )
            }
        </div >
    );
};

export default PipelineBoard;
