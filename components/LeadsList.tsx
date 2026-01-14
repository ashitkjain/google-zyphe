import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Lead, PipelineNote, UserProfile } from '../types';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { getStatusOptions, getStatusDefinitions, isNewLeadStatus } from '../services/statusService';

const TypedDraggable = Draggable as any;
const TypedDroppable = Droppable as any;

const noteTypes = [
    { id: 'note-yellow', color: 'bg-[#ffff88] text-slate-800 border-[#eeee77]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-blue', color: 'bg-[#7afaff] text-slate-800 border-[#69e9ee]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-pink', color: 'bg-[#ff7eb9] text-white border-[#ee6da8]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-green', color: 'bg-[#a7ffeb] text-slate-800 border-[#96eee0]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
];

interface InternalProps {
    leads: Lead[];
    onUpdateLead: (id: string, updates: Partial<Lead>) => void;
    onViewLead: (lead: Lead) => void;
    onCreateLead: (initialUpdates?: Partial<Lead>) => void;
    onActivateLead: (lead: Lead) => void;
    notes: PipelineNote[];
    pendingNote: { leadId: string, color: string } | null;
    setPendingNote: (note: { leadId: string, color: string } | null) => void;
    handleSaveNote: (content: string) => void;
    handleUpdateNote: (noteId: string, updates: Partial<PipelineNote>) => void;
    handleDeleteNote: (noteId: string) => void;
    handleDragEnd: (result: DropResult) => void;
    realtorSettings?: UserProfile['settings'];
}
// Helper Component for Gallery Items
const LeadGalleryItem: React.FC<{
    lead: Lead,
    index: number,
    onViewLead: (l: Lead) => void,
    selectedIds: Set<string>,
    handleSelectOne: (id: string) => void,
    notes: PipelineNote[],
    editNoteId: string | null,
    setEditNoteId: (id: string | null) => void,
    editContent: string,
    setEditContent: (c: string) => void,
    handleUpdateNote: (id: string, updates: any) => void,
    onDoneToggle: (e: any, note: any) => void,
    onDeleteClick: (e: any, id: string) => void,
    pendingNote: any,
    draftContent: string,
    setDraftContent: (c: string) => void,
    handleSaveNote: (c: string) => void,
    setPendingNote: (n: any) => void,
    deleteCoords: any,
    deletingNoteId: string | null,
    celebratingNoteId: string | null,
    isFlyingUpId: string | null,
    onArchive: (id: string) => void,
    onActivate: (id: string) => void
}> = ({
    lead, index, onViewLead, selectedIds, handleSelectOne, notes,
    editNoteId, setEditNoteId, editContent, setEditContent, handleUpdateNote,
    onDoneToggle, onDeleteClick, pendingNote, draftContent, setDraftContent,
    handleSaveNote, setPendingNote, deleteCoords, deletingNoteId, celebratingNoteId, isFlyingUpId,
    onArchive, onActivate
}) => (
        <div
            className={`bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all border-l-4 group relative cursor-pointer flex flex-col ${selectedIds.has(lead.id) ? 'ring-2 ring-indigo-500 ring-offset-2 bg-indigo-50/10' : ''}`}
            style={{
                borderLeftColor: lead.leadType === 'Seller' ? '#10b981' : '#6366f1'
            }}
            onClick={(e) => { handleSelectOne(lead.id); }}
            onDoubleClick={(e) => { e.stopPropagation(); onViewLead(lead); }}
        >
            <TypedDroppable droppableId={lead.id} type="POSTIT_PALETTE">
                {(noteProvided: any, noteSnapshot: any) => (
                    <div
                        ref={noteProvided.innerRef}
                        {...noteProvided.droppableProps}
                        className={`flex-1 flex flex-col min-h-[150px] ${noteSnapshot.isDraggingOver ? 'bg-indigo-50/50 rounded-2xl' : ''}`}
                    >
                        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                            <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onArchive(lead.id); }}
                                    className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-all shadow-sm"
                                    title="Archive"
                                >
                                    <i className="fa-solid fa-box-archive text-[10px]"></i>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onActivate(lead.id); }}
                                    className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-200 hover:bg-indigo-50 flex items-center justify-center transition-all shadow-sm"
                                    title="Activate"
                                >
                                    <i className="fa-solid fa-bolt text-[10px]"></i>
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-3">
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3 w-full">
                                    <div className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors uppercase tracking-tight truncate" onClick={() => onViewLead(lead)}>
                                        {lead.firstName} {lead.lastName}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 rounded-[3px] px-1 py-0.5">{lead.source}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-[10px] text-slate-900 font-medium">
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


                        {/* Render Post-its */}
                        <div className="flex flex-wrap gap-4 mb-4 relative min-h-[40px] empty:hidden" onClick={(e) => { e.stopPropagation(); handleSelectOne(lead.id); }}>
                            {notes.filter(n => n.leadId === lead.id && !n.isDone).map((note, i) => (
                                <div
                                    key={note.id}
                                    onClick={() => { if (!editNoteId) { setEditNoteId(note.id); setEditContent(note.content); } }}
                                    className={`p-3 pt-4 w-24 h-24 rounded-sm border-t border-black/5 text-[9px] font-bold post-it-font whitespace-normal shadow-lg transition-all hover:scale-110 hover:z-10 group/note flex flex-col relative cursor-pointer post-it-container ${note.color} ${i % 2 === 0 ? 'rotate-2' : '-rotate-3'} hover:rotate-0 ${note.isDone ? 'line-through' : ''} ${deletingNoteId === note.id ? 'animate-fly-away' : ''} ${celebratingNoteId === note.id ? 'animate-shake' : ''} ${isFlyingUpId === note.id ? 'animate-fly-up' : ''} ${note.isUrgent ? 'urgent-glow' : ''}`}
                                    style={{
                                        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
                                        ...(((deletingNoteId === note.id || isFlyingUpId === note.id) && deleteCoords) ? {
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

                                    <div className="flex-1 overflow-hidden">
                                        {editNoteId === note.id ? (
                                            <textarea
                                                autoFocus
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                onBlur={() => {
                                                    handleUpdateNote(note.id, { content: editContent, timestamp: new Date() });
                                                    setEditNoteId(null);
                                                }}
                                                className="w-full h-full bg-transparent border-none outline-none resize-none post-it-font text-[9px] font-bold p-0 post-it-edit"
                                            />
                                        ) : (
                                            note.content
                                        )}
                                    </div>
                                    <div className="text-[7px] opacity-40 mt-1 uppercase tracking-tighter shrink-0">
                                        {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(note.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}

                            {/* Inline Draft Post-it */}
                            {pendingNote?.leadId === lead.id && (
                                <div className={`p-3 pt-4 w-24 h-24 rounded-sm border-t border-black/5 shadow-2xl z-20 scale-110 -rotate-2 relative post-it-container ${pendingNote.color}`}>
                                    <div className="w-full h-1 bg-black/5 absolute top-0 left-0"></div>
                                    <textarea
                                        autoFocus
                                        placeholder="Type note..."
                                        value={draftContent}
                                        onChange={(e) => setDraftContent(e.target.value)}
                                        onBlur={() => {
                                            if (draftContent.trim()) handleSaveNote(draftContent);
                                            setPendingNote(null);
                                            setDraftContent('');
                                        }}
                                        className="w-full h-full bg-transparent border-none outline-none resize-none post-it-font text-[9px] font-bold post-it-placeholder placeholder:text-black/20 post-it-draft"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50 relative">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Created:</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                                        {lead.receivedAt?.toDate ? lead.receivedAt.toDate().toLocaleDateString() : new Date(lead.receivedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-indigo-400">
                                <span className="text-[9px] font-black uppercase tracking-tighter">Last Follow Up:</span>
                                <span className="text-[10px] font-bold uppercase tracking-tighter">
                                    {lead.lastTouch?.toDate ? lead.lastTouch.toDate().toLocaleDateString() : lead.lastTouch ? new Date(lead.lastTouch).toLocaleDateString() : 'None'}
                                </span>
                            </div>
                        </div>
                        {noteProvided.placeholder}
                    </div>
                )}
            </TypedDroppable>
        </div>
    );


const LeadsList: React.FC<InternalProps> = ({
    leads,
    onUpdateLead,
    onViewLead,
    onCreateLead,
    onActivateLead,
    notes,
    pendingNote,
    setPendingNote,
    handleSaveNote,
    handleUpdateNote,
    handleDeleteNote,
    handleDragEnd,
    realtorSettings
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortField, setSortField] = useState<keyof Lead>('receivedAt');

    const STATUS_OPTIONS = useMemo(() => {
        // Since LeadsList shows all leads, we might need to show a combined list of statuses
        // or handle it per lead. For the main filter and bulk actions, we'll use a unique set.
        const buyerOpts = getStatusOptions('Buyer', realtorSettings).map((o: any) => o.label);
        const sellerOpts = getStatusOptions('Seller', realtorSettings).map((o: any) => o.label);
        return Array.from(new Set([...buyerOpts, ...sellerOpts]));
    }, [realtorSettings]);

    const getStatusDefinitionsForLead = (lead: Lead) => {
        return getStatusDefinitions(lead.leadType, realtorSettings);
    };
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [buyerViewMode, setBuyerViewMode] = useState<'today' | 'week' | 'month' | 'year' | 'older'>('today');
    const [sellerViewMode, setSellerViewMode] = useState<'today' | 'week' | 'month' | 'year' | 'older'>('today');
    const [showFilters, setShowFilters] = useState(false);
    const [showStatusInfo, setShowStatusInfo] = useState(false);
    const [columnFilters, setColumnFilters] = useState({
        name: '',
        phone: '',
        email: '',
        status: '',
        source: '',
    });
    const [activeTab, setActiveTab] = useState<'Buyer' | 'Seller'>('Buyer');
    const [showColumnSelector, setShowColumnSelector] = useState(false);

    const availableBuyerColumns = [
        { id: 'status', label: 'Lead Status' },
        { id: 'phone', label: 'Contact Info' },
        { id: 'isAlsoSelling', label: 'Also Selling?' },
        { id: 'preQualified', label: 'Pre-qualified?' },
        { id: 'budgetRange', label: 'Budget Range' },
        { id: 'preferredNeighborhood', label: 'Preferred Neighborhood' },
        { id: 'source', label: 'Source' },
        { id: 'receivedAt', label: 'Date Created' },
        { id: 'lastTouch', label: 'Last Follow Up' },
        { id: 'message', label: 'Message' },
        { id: 'timeframe', label: 'Timeframe' },
        { id: 'leaseEndDate', label: 'Lease End Date' },
        { id: 'propertyAddress', label: 'Inquired Property' },
        { id: 'tags', label: 'Tags' },
        { id: 'funnelStage', label: 'Pipeline Stage' },
        { id: 'notes', label: 'Comments / Notes' }
    ];

    const availableSellerColumns = [
        { id: 'status', label: 'Lead Status' },
        { id: 'phone', label: 'Contact Info' },
        { id: 'isAlsoBuying', label: 'Also Buying?' },
        { id: 'homeValueNeeded', label: 'Home Value Needed?' },
        { id: 'mostImportantToSeller', label: 'Most Important to Seller' },
        { id: 'sellWhen', label: 'Sell When?' },
        { id: 'propertyType', label: 'Property Type' },
        { id: 'occupancyStatus', label: 'Occupancy Status' },
        { id: 'expectedPrice', label: 'Expected Price' },
        { id: 'propertyAddress', label: 'Property Address' },
        { id: 'reasonForSelling', label: 'Reason for Selling' },
        { id: 'existingAgentName', label: 'Existing Agent?' },
        { id: 'source', label: 'Source' },
        { id: 'receivedAt', label: 'Date Created' },
        { id: 'lastTouch', label: 'Last Follow Up' },
        { id: 'message', label: 'Message' },
        { id: 'tags', label: 'Tags' },
        { id: 'funnelStage', label: 'Pipeline Stage' },
        { id: 'notes', label: 'Comments / Notes' }
    ];

    // Default visible columns (preserving previous default view)
    const defaultBuyerVisible = ['status', 'phone', 'isAlsoSelling', 'preQualified', 'budgetRange', 'preferredNeighborhood', 'source', 'receivedAt', 'notes'];
    const defaultSellerVisible = ['status', 'phone', 'isAlsoBuying', 'homeValueNeeded', 'mostImportantToSeller', 'sellWhen', 'propertyType', 'occupancyStatus', 'expectedPrice', 'propertyAddress', 'source', 'receivedAt'];

    const [visibleColumns, setVisibleColumns] = useState({
        Buyer: new Set(defaultBuyerVisible),
        Seller: new Set(defaultSellerVisible)
    });

    const toggleColumn = (type: 'Buyer' | 'Seller', colId: string) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev[type]);
            if (newSet.has(colId)) newSet.delete(colId);
            else newSet.add(colId);
            return { ...prev, [type]: newSet };
        });
    };

    const columnSelectorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
                setShowColumnSelector(false);
            }
        };

        if (showColumnSelector) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showColumnSelector]);

    const [viewMode, setViewMode] = useState<'today' | 'week' | 'month' | 'year' | 'older'>('today'); // Legacy for displayModes mapping

    const [displayModes, setDisplayModes] = useState<Record<string, 'list' | 'gallery'>>({
        today: 'gallery',
        week: 'list',
        month: 'list',
        year: 'list',
        older: 'list'
    });

    const currentDisplayMode = activeTab === 'Buyer' ? displayModes[buyerViewMode] : displayModes[sellerViewMode];

    const toggleDisplayMode = (mode: 'list' | 'gallery') => {
        const targetViewMode = activeTab === 'Buyer' ? buyerViewMode : sellerViewMode;
        setDisplayModes(prev => ({
            ...prev,
            [targetViewMode]: mode
        }));
    };

    // Clear selection on view change
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeTab, buyerViewMode, sellerViewMode]);

    // Inline Editing State
    const [editingCell, setEditingCell] = useState<{ id: string, field: keyof Lead } | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    // Post-it Logic State
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
            handleUpdateNote(note.id, { isDone: false, timestamp: new Date() });
            return;
        }

        const rect = (e.currentTarget.closest('.post-it-container') as HTMLElement).getBoundingClientRect();
        setDeleteCoords({ top: rect.top, left: rect.left });
        setCelebratingNoteId(note.id);

        setTimeout(() => {
            setCelebratingNoteId(null);
            setIsFlyingUpId(note.id);
            setTimeout(() => {
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
            if (!target.closest('.post-it-container') && !target.closest('.note-palette-item')) {
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

    const startEditing = (e: React.MouseEvent, id: string, field: keyof Lead, value: any) => {
        e.stopPropagation(); // Prevent row click
        setEditingCell({ id, field });
        setEditValue(value || '');
    };

    const saveEditing = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingCell) {
            onUpdateLead(editingCell.id, { [editingCell.field]: editValue });
            setEditingCell(null);
            setEditValue('');
        }
    };

    const [confirmModal, setConfirmModal] = useState<{ show: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

    const handleBulkArchive = () => {
        if (selectedIds.size === 0) return;

        const executeArchive = () => {
            selectedIds.forEach(id => {
                onUpdateLead(id, { status: 'Archived' });
            });
            setSelectedIds(new Set());
            setConfirmModal(null);
        };

        if (selectedIds.size === 1) {
            executeArchive();
            return;
        }

        setConfirmModal({
            show: true,
            title: 'Confirm Bulk Archive',
            message: `Are you sure you want to archive ${selectedIds.size} selected leads?`,
            onConfirm: executeArchive
        });
    };

    const handleBulkActivate = () => {
        if (selectedIds.size === 0) return;

        const executeActivate = () => {
            selectedIds.forEach(id => {
                const lead = leads.find(l => l.id === id);
                if (lead) {
                    onActivateLead(lead);
                }
            });
            setSelectedIds(new Set());
            setConfirmModal(null);
        };

        setConfirmModal({
            show: true,
            title: 'Confirm Bulk Activation',
            message: `Are you sure you want to activate ${selectedIds.size} selected leads? They will be moved to the appropriate pipeline.`,
            onConfirm: executeActivate
        });
    };

    const cancelEditing = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCell(null);
        setEditValue('');
    };

    const renderCell = (lead: Lead, field: keyof Lead, type: 'text' | 'select' = 'text', options: string[] = [], viewAction?: () => void) => {
        const isEditing = editingCell?.id === lead.id && editingCell?.field === field;
        const value = lead[field] as string;

        if (isEditing) {
            return (
                <div className="flex items-center gap-1 min-w-[120px]" onClick={e => e.stopPropagation()}>
                    {type === 'select' ? (
                        <select
                            autoFocus
                            className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                            defaultValue={value}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                onUpdateLead(lead.id, { [field]: newValue });
                                setEditingCell(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    e.stopPropagation();
                                    setEditingCell(null);
                                }
                            }}
                        >
                            {options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    ) : (
                        <>
                            <input
                                autoFocus
                                type="text"
                                className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditing(e as any);
                                    if (e.key === 'Escape') cancelEditing(e as any);
                                }}
                            />
                            <button onClick={saveEditing} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 p-1 rounded flex-shrink-0"><i className="fa-solid fa-check"></i></button>
                            <button onClick={cancelEditing} className="text-red-400 hover:text-red-600 bg-red-50 p-1 rounded flex-shrink-0"><i className="fa-solid fa-xmark"></i></button>
                        </>
                    )}
                </div>
            );
        }

        return (
            <div className="group/cell flex items-center justify-between gap-2 w-full h-full min-h-[20px]">
                <div
                    className={`truncate ${viewAction ? 'cursor-pointer hover:underline' : 'cursor-text'}`}
                    onClick={(e) => {
                        if (viewAction) {
                            e.stopPropagation();
                            viewAction();
                        } else {
                            startEditing(e, lead.id, field, value);
                        }
                    }}
                >
                    {value || <span className="text-slate-300 italic">--</span>}
                </div>
                <button
                    onClick={(e) => startEditing(e, lead.id, field, value)}
                    className="opacity-0 group-hover/cell:opacity-100 hover:text-indigo-500 transition-opacity p-1"
                >
                    <i className="fa-solid fa-pencil text-slate-300 text-[10px]"></i>
                </button>
            </div>
        );
    };

    const dateRanges = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        const startOfYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

        const formatDate = (d: Date, includeYear = false) => {
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: includeYear ? 'numeric' : undefined
            });
        };

        const yesterday = new Date(startOfToday);
        yesterday.setDate(yesterday.getDate() - 1);

        const weekEnd = new Date(startOfToday);
        weekEnd.setDate(weekEnd.getDate() - 1);

        const monthEnd = new Date(startOfWeek);
        monthEnd.setDate(monthEnd.getDate() - 1);

        const yearEnd = new Date(startOfMonth);
        yearEnd.setDate(yearEnd.getDate() - 1);

        return {
            startOfToday,
            startOfWeek,
            startOfMonth,
            startOfYear,
            labels: {
                today: formatDate(startOfToday),
                week: `${formatDate(startOfWeek)} - ${formatDate(weekEnd)}`,
                month: `${formatDate(startOfMonth)} - ${formatDate(monthEnd)}`,
                year: `${formatDate(startOfYear, true)} - ${formatDate(yearEnd, true)}`,
                older: `Before ${formatDate(startOfYear, true)}`
            }
        };
    }, []);

    const timeStats = useMemo(() => {
        const { startOfToday, startOfWeek, startOfMonth, startOfYear } = dateRanges;
        const validLeads = leads.filter(l =>
            isNewLeadStatus(l.status, l.leadType, realtorSettings) &&
            l.collectionName === 'leads'
        );

        const getStatsForType = (type: 'Buyer' | 'Seller') => {
            const typed = validLeads.filter(l => l.leadType === type);
            return {
                today: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d >= startOfToday;
                }).length,
                week: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d >= startOfWeek && d < startOfToday;
                }).length,
                month: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d >= startOfMonth && d < startOfWeek;
                }).length,
                year: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d >= startOfYear && d < startOfMonth;
                }).length,
                older: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d < startOfYear;
                }).length
            };
        };

        return {
            Buyer: getStatsForType('Buyer'),
            Seller: getStatsForType('Seller')
        };
    }, [leads, dateRanges, realtorSettings]);

    const filteredBuyerLeads = useMemo(() => {
        const { startOfToday, startOfWeek, startOfMonth, startOfYear } = dateRanges;

        let result = leads.filter(l => {
            if (l.leadType !== 'Buyer' && l.leadType !== 'Rental' && l.leadType !== 'Mortgage') return false; // Default Buyers
            // Note: Types are 'Buyer' | 'Seller' | 'Rental' | 'Mortgage'. Grouping Buyers, Rentals, Mortgage together for now or just Buyer.
            if (l.leadType !== 'Buyer') return false;

            if (!isNewLeadStatus(l.status, l.leadType, realtorSettings)) return false;
            if (l.collectionName !== 'leads') return false;

            const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);

            if (buyerViewMode === 'today') return d >= startOfToday;
            if (buyerViewMode === 'week') return d >= startOfWeek && d < startOfToday;
            if (buyerViewMode === 'month') return d >= startOfMonth && d < startOfWeek;
            if (buyerViewMode === 'year') return d >= startOfYear && d < startOfMonth;
            if (buyerViewMode === 'older') return d < startOfYear;
            return false;
        });

        if (columnFilters.name) result = result.filter(l => `${l.firstName} ${l.lastName}`.toLowerCase().includes(columnFilters.name.toLowerCase()));
        if (columnFilters.phone) result = result.filter(l => l.phone.toLowerCase().includes(columnFilters.phone.toLowerCase()));
        if (columnFilters.email) result = result.filter(l => l.email.toLowerCase().includes(columnFilters.email.toLowerCase()));
        if (columnFilters.status) result = result.filter(l => l.status === columnFilters.status);
        if (columnFilters.source) result = result.filter(l => l.source === columnFilters.source);

        return result.sort((a, b) => {
            let aVal = a[sortField] as any;
            let bVal = b[sortField] as any;

            if (sortField === 'firstName') {
                aVal = `${a.firstName} ${a.lastName}`;
                bVal = `${b.firstName} ${b.lastName}`;
            }

            if (aVal === bVal) return 0;
            if (aVal === undefined || aVal === null) return 1;
            if (bVal === undefined || bVal === null) return -1;

            const comparison = aVal > bVal ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [leads, buyerViewMode, columnFilters, sortField, sortDirection, realtorSettings]);

    const filteredSellerLeads = useMemo(() => {
        const { startOfToday, startOfWeek, startOfMonth, startOfYear } = dateRanges;

        let result = leads.filter(l => {
            if (l.leadType !== 'Seller') return false;
            if (!isNewLeadStatus(l.status, l.leadType, realtorSettings)) return false;
            if (l.collectionName !== 'leads') return false;

            const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);

            if (sellerViewMode === 'today') return d >= startOfToday;
            if (sellerViewMode === 'week') return d >= startOfWeek && d < startOfToday;
            if (sellerViewMode === 'month') return d >= startOfMonth && d < startOfWeek;
            if (sellerViewMode === 'year') return d >= startOfYear && d < startOfMonth;
            if (sellerViewMode === 'older') return d < startOfYear;
            return false;
        });

        if (columnFilters.name) result = result.filter(l => `${l.firstName} ${l.lastName}`.toLowerCase().includes(columnFilters.name.toLowerCase()));
        if (columnFilters.phone) result = result.filter(l => l.phone.toLowerCase().includes(columnFilters.phone.toLowerCase()));
        if (columnFilters.email) result = result.filter(l => l.email.toLowerCase().includes(columnFilters.email.toLowerCase()));
        if (columnFilters.status) result = result.filter(l => l.status === columnFilters.status);
        if (columnFilters.source) result = result.filter(l => l.source === columnFilters.source);

        return result.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal === bVal) return 0;
            if (!aVal) return 1;
            if (!bVal) return -1;

            const comparison = aVal > bVal ? 1 : -1;
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [leads, sellerViewMode, columnFilters, sortField, sortDirection, realtorSettings]);

    const filteredLeads = useMemo(() => [...filteredBuyerLeads, ...filteredSellerLeads], [filteredBuyerLeads, filteredSellerLeads]);

    const handleSelectAll = (leadsToSelect: Lead[], isChecked: boolean) => {
        const newSet = new Set(selectedIds);
        if (isChecked) {
            leadsToSelect.forEach(l => newSet.add(l.id));
        } else {
            leadsToSelect.forEach(l => newSet.delete(l.id));
        }
        setSelectedIds(newSet);
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleSort = (field: keyof Lead) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-white text-sm font-sans overflow-hidden min-w-0">
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                .post-it-font {
                    font-family: 'Architects Daughter', cursive;
                    line-height: 1.2;
                }
                @keyframes fly-to-trash {
                    0% { transform: scale(1) rotate(0deg); opacity: 1; top: var(--start-top); left: var(--start-left); }
                    30% { transform: scale(1.1) rotate(15deg); opacity: 1; }
                    100% { transform: scale(0.1) rotate(360deg); opacity: 0; top: 100vh; left: 50vw; }
                }
                .animate-fly-away {
                    position: fixed !important; z-index: 9999 !important; pointer-events: none;
                    animation: fly-to-trash 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
                }
                @keyframes fly-up-high {
                    0% { transform: scale(1) rotate(0deg); opacity: 1; top: var(--start-top); left: var(--start-left); }
                    100% { transform: scale(0.5) rotate(-15deg); opacity: 0; top: -200px; left: var(--start-left); }
                }
                .animate-fly-up {
                    position: fixed !important; z-index: 9999 !important; pointer-events: none;
                    animation: fly-up-high 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
                }
                @keyframes shake-only {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(-2deg); }
                    40% { transform: rotate(2deg); }
                    60% { transform: rotate(-2deg); }
                    80% { transform: rotate(2deg); }
                }
                .animate-shake { animation: shake-only 0.5s ease-in-out; }
                .urgent-glow {
                    box-shadow: 0 0 10px rgba(255, 69, 0, 0.4) !important;
                    border: 1px solid rgba(255, 69, 0, 0.3) !important;
                }
            `}} />

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex-shrink-0 w-full">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Tab Switcher */}
                            <div className="flex bg-slate-200/50 p-1 rounded-xl items-center mr-4">
                                <button
                                    onClick={() => setActiveTab('Buyer')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'Buyer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <i className="fa-solid fa-user-tag"></i>
                                    Buyer Leads
                                </button>
                                <button
                                    onClick={() => setActiveTab('Seller')}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'Seller' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <i className="fa-solid fa-house-chimney-user"></i>
                                    Seller Leads
                                </button>
                            </div>

                            <button
                                onClick={() => onCreateLead({ leadType: activeTab })}
                                className={`mr-4 w-8 h-8 rounded-full text-white flex items-center justify-center transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95 ${activeTab === 'Buyer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                title={`Create New ${activeTab} Lead`}
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>

                            <div className="h-6 w-px bg-slate-200"></div>
                            <div className="flex items-center gap-1 text-slate-400">

                                <div className="relative" ref={columnSelectorRef}>
                                    <button
                                        className={`w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors ${showColumnSelector ? 'bg-slate-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => setShowColumnSelector(!showColumnSelector)}
                                        title="Select Columns"
                                    >
                                        <i className="fa-solid fa-table-columns text-lg"></i>
                                    </button>
                                    {showColumnSelector && (
                                        <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-64 z-50 animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Visible Columns</div>
                                                <button onClick={() => setShowColumnSelector(false)} className="text-slate-400 hover:text-slate-600">
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            </div>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                                {(activeTab === 'Buyer' ? availableBuyerColumns : availableSellerColumns).map(col => (
                                                    <label key={col.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleColumns[activeTab].has(col.id)}
                                                            onChange={() => toggleColumn(activeTab, col.id)}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        {col.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button
                                    className={`w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors ${showFilters ? 'bg-slate-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => setShowFilters(!showFilters)}
                                    title="Filter Leads"
                                >
                                    <i className="fa-solid fa-filter text-lg"></i>
                                </button>
                            </div>
                        </div>



                        {/* Post-it Palette */}
                        {currentDisplayMode === 'gallery' && (
                            <TypedDroppable droppableId="palette" direction="horizontal" type="POSTIT_PALETTE" isDropDisabled={true}>
                                {(provided: any) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="flex items-center gap-4"
                                    >
                                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Post it:</div>
                                        <div className="flex items-center gap-4">
                                            {noteTypes.map((note, index) => (
                                                <TypedDraggable key={note.id} draggableId={note.id} index={index}>
                                                    {(provided: any, snapshot: any) => (
                                                        <div className="relative group note-palette-item">
                                                            {!snapshot.isDragging && (
                                                                <>
                                                                    <div className={`absolute inset-0 translate-x-1 translate-y-1 rounded-sm border border-black/5 opacity-40 ${note.color} ${note.shadow}`}></div>
                                                                </>
                                                            )}

                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`w-8 h-8 rounded-sm border-t border-black/5 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all hover:-translate-y-1 hover:-rotate-3 ${note.color} ${note.shadow} ${snapshot.isDragging ? 'z-[100] rotate-6 scale-110 shadow-2xl' : ''}`}
                                                            >
                                                                <div className="w-full h-1 bg-black/5 absolute top-0"></div>
                                                                <i className="fa-solid fa-note-sticky opacity-20 text-[10px]"></i>
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
                        )}
                    </div>
                </div>

                {/* Filter Bar */}
                {
                    showFilters && (
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 grid grid-cols-5 gap-2 flex-shrink-0 w-full">
                            <input
                                type="text"
                                placeholder="Filter Name..."
                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                value={columnFilters.name}
                                onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder="Filter Phone..."
                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                value={columnFilters.phone}
                                onChange={(e) => setColumnFilters({ ...columnFilters, phone: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder="Filter Email..."
                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                value={columnFilters.email}
                                onChange={(e) => setColumnFilters({ ...columnFilters, email: e.target.value })}
                            />
                            <select
                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                value={columnFilters.status}
                                onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                            >
                                <option value="">All Statuses</option>
                                {STATUS_OPTIONS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <select
                                className="px-3 py-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-indigo-500"
                                value={columnFilters.source}
                                onChange={(e) => setColumnFilters({ ...columnFilters, source: e.target.value })}
                            >
                                <option value="">All Sources</option>
                                {Array.from(new Set(leads.map(l => l.source))).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    )
                }

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white mb-0 space-y-4 py-4">
                    {/* Buyer Section */}
                    {activeTab === 'Buyer' && (
                        <section className="px-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="flex items-center justify-start mb-4 border-b border-slate-100 pb-3">

                                {/* Time Selector for Buyers */}
                                <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden">
                                    {[
                                        { id: 'today', label: 'New', subtitle: dateRanges.labels.today, count: timeStats.Buyer.today },
                                        { id: 'week', label: 'Past Week', subtitle: dateRanges.labels.week, count: timeStats.Buyer.week },
                                        { id: 'month', label: 'Past Month', subtitle: dateRanges.labels.month, count: timeStats.Buyer.month },
                                        { id: 'year', label: 'Past Year', subtitle: dateRanges.labels.year, count: timeStats.Buyer.year },
                                        { id: 'older', label: 'Older', subtitle: dateRanges.labels.older, count: timeStats.Buyer.older }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setBuyerViewMode(tab.id as any)}
                                            className={`px-4 py-1.5 rounded-xl transition-all duration-300 relative z-10 flex flex-col items-center min-w-[100px] ${buyerViewMode === tab.id ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            <div className="text-[10px] font-semibold uppercase tracking-widest leading-tight">
                                                {tab.label} {tab.count > 0 && `(${tab.count})`}
                                            </div>
                                            <div className="text-[7px] font-bold opacity-60 uppercase tracking-tighter mt-0.5 whitespace-nowrap">
                                                {tab.subtitle}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="ml-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-2">
                                        <button
                                            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all min-h-[42px] ${selectedIds.size > 0 ? 'bg-red-50 text-black hover:bg-red-100 shadow-sm' : 'bg-slate-50 text-black cursor-not-allowed border border-slate-100'}`}
                                            onClick={handleBulkArchive}
                                            disabled={selectedIds.size === 0}
                                        >
                                            <i className="fa-solid fa-box-archive"></i>
                                            Archive {selectedIds.size > 0 && `(${selectedIds.size})`}
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all min-h-[42px] ${selectedIds.size > 0 ? 'bg-indigo-50 text-black hover:bg-indigo-100 shadow-sm' : 'bg-slate-50 text-black cursor-not-allowed border border-slate-100'}`}
                                            onClick={handleBulkActivate}
                                            disabled={selectedIds.size === 0}
                                        >
                                            <i className="fa-solid fa-bolt"></i>
                                            Activate {selectedIds.size > 0 && `(${selectedIds.size})`}
                                        </button>
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-medium text-center mt-1">
                                        Select the checkbox to archive or activate
                                    </div>
                                </div>
                                <div className="ml-auto flex bg-slate-100/50 p-1 rounded-2xl items-center">
                                    <button
                                        onClick={() => toggleDisplayMode('list')}
                                        className={`px-3 py-0 min-h-[42px] rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${currentDisplayMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <i className="fa-solid fa-list-ul"></i>
                                        List
                                    </button>
                                    <button
                                        onClick={() => toggleDisplayMode('gallery')}
                                        className={`px-3 py-0 min-h-[42px] rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${currentDisplayMode === 'gallery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <i className="fa-solid fa-table-cells-large"></i>
                                        Gallery
                                    </button>
                                </div>
                            </div>

                            {filteredBuyerLeads.length > 0 ? (
                                currentDisplayMode === 'list' ? (
                                    <div className="shadow-sm border border-slate-200/60 rounded-2xl overflow-x-auto overflow-y-auto max-h-[600px] w-full pb-6">
                                        <table className="w-full text-left border-collapse min-w-full">
                                            <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-semibold text-slate-500">
                                                <tr>
                                                    <th className="w-12 px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">#</th>
                                                    <th className="w-10 px-2 py-3 border-b border-slate-200/60 bg-slate-50">
                                                        <input type="checkbox" onChange={(e) => handleSelectAll(filteredBuyerLeads, e.target.checked)} checked={filteredBuyerLeads.length > 0 && filteredBuyerLeads.every(l => selectedIds.has(l.id))} className="rounded border-slate-300" />
                                                    </th>
                                                    <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Profile Picture</th>
                                                    <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('firstName')}>
                                                        Full Name {sortField === 'firstName' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                    </th>
                                                    {visibleColumns.Buyer.has('status') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                                            Lead Status {sortField === 'status' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}

                                                    {visibleColumns.Buyer.has('phone') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('phone')}>
                                                            Contact Info {sortField === 'phone' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Buyer.has('isAlsoSelling') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Also Selling?</th>}
                                                    {visibleColumns.Buyer.has('preQualified') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Pre-qualified?</th>}
                                                    {visibleColumns.Buyer.has('budgetRange') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Budget Range</th>}
                                                    {visibleColumns.Buyer.has('preferredNeighborhood') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Preferred Neighborhood</th>}
                                                    {visibleColumns.Buyer.has('source') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('source')}>
                                                            Source {sortField === 'source' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Buyer.has('receivedAt') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('receivedAt')}>
                                                            Date Created {sortField === 'receivedAt' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Buyer.has('lastTouch') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('lastTouch')}>
                                                            Last Follow Up {sortField === 'lastTouch' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Buyer.has('message') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Message</th>}
                                                    {visibleColumns.Buyer.has('timeframe') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Timeframe</th>}
                                                    {visibleColumns.Buyer.has('leaseEndDate') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Lease End Date</th>}
                                                    {visibleColumns.Buyer.has('propertyAddress') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('propertyAddress')}>
                                                            Inquired Property {sortField === 'propertyAddress' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Buyer.has('tags') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Tags</th>}
                                                    {visibleColumns.Buyer.has('funnelStage') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Pipeline Stage</th>}
                                                    {visibleColumns.Buyer.has('notes') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Comments / Notes</th>}

                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredBuyerLeads.map((lead, index) => (
                                                    <tr key={lead.id} className="group text-slate-700 text-sm transition-colors hover:bg-slate-50/80">
                                                        <td className="px-2 py-2 border-b border-slate-100 text-center text-slate-400 font-bold opacity-50">{index + 1}</td>
                                                        <td className="px-2 py-2 border-b border-slate-100">
                                                            <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => handleSelectOne(lead.id)} className="rounded border-slate-300" />
                                                        </td>
                                                        <td className="px-2 py-2 border-b border-slate-100">
                                                            <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
                                                                {lead.avatarUrl ? (
                                                                    <img src={lead.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <i className="fa-solid fa-user text-slate-300 text-[10px]"></i>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2 border-b border-slate-100 font-bold text-slate-900 cursor-pointer hover:underline" onClick={() => onViewLead(lead)}>
                                                            {lead.firstName} {lead.lastName}
                                                        </td>
                                                        {visibleColumns.Buyer.has('status') && (
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                {renderCell(lead, 'status', 'select', getStatusOptions(lead.leadType, realtorSettings).map((o: any) => o.label))}
                                                            </td>
                                                        )}

                                                        {visibleColumns.Buyer.has('phone') && (
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                <div className="flex flex-col">
                                                                    <div className="text-xs font-semibold text-slate-700 leading-tight mb-0.5">{renderCell(lead, 'phone')}</div>
                                                                    <div className="text-[10px] text-blue-600 font-medium leading-tight">{renderCell(lead, 'email')}</div>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('isAlsoSelling') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-center">
                                                                <div
                                                                    className="flex justify-center cursor-pointer"
                                                                    onClick={(e) => startEditing(e, lead.id, 'isAlsoSelling', lead.isAlsoSelling ? 'Yes' : 'No')}
                                                                >
                                                                    {editingCell?.id === lead.id && editingCell?.field === 'isAlsoSelling' ? (
                                                                        <div onClick={e => e.stopPropagation()}>
                                                                            <select
                                                                                autoFocus
                                                                                className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
                                                                                defaultValue={lead.isAlsoSelling ? 'Yes' : 'No'}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value === 'Yes';
                                                                                    onUpdateLead(lead.id, { isAlsoSelling: val });
                                                                                    setEditingCell(null);
                                                                                }}
                                                                                onBlur={() => setEditingCell(null)}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                <option value="Yes">Yes</option>
                                                                                <option value="No">No</option>
                                                                            </select>
                                                                        </div>
                                                                    ) : (
                                                                        lead.isAlsoSelling ? (
                                                                            <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '0% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                        ) : (
                                                                            <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '100% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('preQualified') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-center font-semibold">
                                                                <div
                                                                    className="flex justify-center cursor-pointer"
                                                                    onClick={(e) => startEditing(e, lead.id, 'preQualified', lead.preQualified ? 'Yes' : 'No')}
                                                                >
                                                                    {editingCell?.id === lead.id && editingCell?.field === 'preQualified' ? (
                                                                        <div onClick={e => e.stopPropagation()}>
                                                                            <select
                                                                                autoFocus
                                                                                className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
                                                                                defaultValue={lead.preQualified ? 'Yes' : 'No'}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value === 'Yes';
                                                                                    onUpdateLead(lead.id, { preQualified: val });
                                                                                    setEditingCell(null);
                                                                                }}
                                                                                onBlur={() => setEditingCell(null)}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                <option value="Yes">Yes</option>
                                                                                <option value="No">No</option>
                                                                            </select>
                                                                        </div>
                                                                    ) : (
                                                                        lead.preQualified ? (
                                                                            <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '0% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                        ) : (
                                                                            <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '100% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('budgetRange') && <td className="px-2 py-2 border-b border-slate-100 font-medium">{renderCell(lead, 'budgetRange' as any)}</td>}
                                                        {visibleColumns.Buyer.has('preferredNeighborhood') && <td className="px-2 py-2 border-b border-slate-100 font-medium underline text-indigo-600/80 decoration-indigo-200 underline-offset-4">{renderCell(lead, 'preferredNeighborhood' as any)}</td>}
                                                        {visibleColumns.Buyer.has('source') && <td className="px-2 py-2 border-b border-slate-100 text-xs font-semibold text-indigo-500">{lead.source}</td>}
                                                        {visibleColumns.Buyer.has('receivedAt') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-[10px] text-slate-400 font-semibold whitespace-nowrap uppercase">
                                                                {lead.receivedAt?.toDate ? lead.receivedAt.toDate().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(lead.receivedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('lastTouch') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                                                {lead.lastTouch ? (lead.lastTouch?.toDate ? lead.lastTouch.toDate().toLocaleDateString() : new Date(lead.lastTouch).toLocaleDateString()) : '--'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('message') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-600 max-w-[200px] truncate" title={lead.message}>
                                                                {lead.message || '--'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('timeframe') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.timeframe || '--'}</td>}
                                                        {visibleColumns.Buyer.has('leaseEndDate') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-[10px] text-slate-500 font-medium">
                                                                {lead.leaseEndDate ? (lead.leaseEndDate?.toDate ? lead.leaseEndDate.toDate().toLocaleDateString() : new Date(lead.leaseEndDate).toLocaleDateString()) : '--'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('propertyAddress') && <td className="px-2 py-2 border-b border-slate-100 font-medium underline text-indigo-600/80 decoration-indigo-200 underline-offset-4 text-xs">{lead.propertyAddress || '--'}</td>}
                                                        {visibleColumns.Buyer.has('tags') && (
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {lead.tags?.map((tag, i) => (
                                                                        <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-medium border border-slate-200">{tag}</span>
                                                                    ))}
                                                                    {(!lead.tags || lead.tags.length === 0) && <span className="text-xs text-slate-300">--</span>}
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('funnelStage') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.funnelStage || '--'}</td>}
                                                        {visibleColumns.Buyer.has('notes') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 min-w-[200px] text-xs text-slate-600 line-clamp-2" title={lead.notes}>
                                                                {renderCell(lead, 'notes')}
                                                            </td>
                                                        )}

                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {filteredBuyerLeads.map((lead, index) => (
                                            <LeadGalleryItem
                                                key={lead.id}
                                                lead={lead}
                                                index={index}
                                                onViewLead={onViewLead}
                                                selectedIds={selectedIds}
                                                handleSelectOne={handleSelectOne}
                                                notes={notes}
                                                editNoteId={editNoteId}
                                                setEditNoteId={setEditNoteId}
                                                editContent={editContent}
                                                setEditContent={setEditContent}
                                                handleUpdateNote={handleUpdateNote}
                                                onDoneToggle={onDoneToggle}
                                                onDeleteClick={onDeleteClick}
                                                pendingNote={pendingNote}
                                                draftContent={draftContent}
                                                setDraftContent={setDraftContent}
                                                handleSaveNote={handleSaveNote}
                                                setPendingNote={setPendingNote}
                                                deleteCoords={deleteCoords}
                                                deletingNoteId={deletingNoteId}
                                                celebratingNoteId={celebratingNoteId}
                                                isFlyingUpId={isFlyingUpId}
                                                onArchive={(id) => onUpdateLead(id, { status: 'Archived' })}
                                                onActivate={(id) => onUpdateLead(id, { status: 'New' })}
                                            />
                                        ))}
                                    </div>
                                )
                            ) : (
                                <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-[2rem]">
                                    No buyer leads found for this period.
                                </div>
                            )}
                        </section>
                    )}

                    {/* Seller Section */}
                    {activeTab === 'Seller' && (
                        <section className="px-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center justify-start mb-4 border-b border-slate-100 pb-3">

                                {/* Time Selector for Sellers */}
                                <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/60 shadow-sm relative overflow-hidden">
                                    {[
                                        { id: 'today', label: 'New', subtitle: dateRanges.labels.today, count: timeStats.Seller.today },
                                        { id: 'week', label: 'Past Week', subtitle: dateRanges.labels.week, count: timeStats.Seller.week },
                                        { id: 'month', label: 'Past Month', subtitle: dateRanges.labels.month, count: timeStats.Seller.month },
                                        { id: 'year', label: 'Past Year', subtitle: dateRanges.labels.year, count: timeStats.Seller.year },
                                        { id: 'older', label: 'Older', subtitle: dateRanges.labels.older, count: timeStats.Seller.older }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setSellerViewMode(tab.id as any)}
                                            className={`px-4 py-1.5 rounded-xl transition-all duration-300 relative z-10 flex flex-col items-center min-w-[100px] ${sellerViewMode === tab.id ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            <div className="text-[10px] font-semibold uppercase tracking-widest leading-tight">
                                                {tab.label} {tab.count > 0 && `(${tab.count})`}
                                            </div>
                                            <div className="text-[7px] font-bold opacity-60 uppercase tracking-tighter mt-0.5 whitespace-nowrap">
                                                {tab.subtitle}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="ml-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-2">
                                        <button
                                            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all min-h-[42px] ${selectedIds.size > 0 ? 'bg-red-50 text-black hover:bg-red-100 shadow-sm' : 'bg-slate-50 text-black cursor-not-allowed border border-slate-100'}`}
                                            onClick={handleBulkArchive}
                                            disabled={selectedIds.size === 0}
                                        >
                                            <i className="fa-solid fa-box-archive"></i>
                                            Archive {selectedIds.size > 0 && `(${selectedIds.size})`}
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wide transition-all min-h-[42px] ${selectedIds.size > 0 ? 'bg-indigo-50 text-black hover:bg-indigo-100 shadow-sm' : 'bg-slate-50 text-black cursor-not-allowed border border-slate-100'}`}
                                            onClick={handleBulkActivate}
                                            disabled={selectedIds.size === 0}
                                        >
                                            <i className="fa-solid fa-bolt"></i>
                                            Activate {selectedIds.size > 0 && `(${selectedIds.size})`}
                                        </button>
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-medium text-center mt-1">
                                        Select the checkbox to archive or activate
                                    </div>
                                </div>
                                <div className="ml-auto flex bg-slate-100/50 p-1 rounded-2xl items-center">
                                    <button
                                        onClick={() => toggleDisplayMode('list')}
                                        className={`px-3 py-0 min-h-[42px] rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${currentDisplayMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <i className="fa-solid fa-list-ul"></i>
                                        List
                                    </button>
                                    <button
                                        onClick={() => toggleDisplayMode('gallery')}
                                        className={`px-3 py-0 min-h-[42px] rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${currentDisplayMode === 'gallery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <i className="fa-solid fa-table-cells-large"></i>
                                        Gallery
                                    </button>
                                </div>
                            </div>

                            {filteredSellerLeads.length > 0 ? (
                                currentDisplayMode === 'list' ? (
                                    <div className="shadow-sm border border-slate-200/60 rounded-2xl overflow-x-auto overflow-y-auto max-h-[600px] w-full pb-6">
                                        <table className="w-full text-left border-collapse min-w-full">
                                            <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-semibold text-slate-500">
                                                <tr>
                                                    <th className="w-12 px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">#</th>
                                                    <th className="w-10 px-2 py-3 border-b border-slate-200/60 bg-slate-50">
                                                        <input type="checkbox" onChange={(e) => handleSelectAll(filteredSellerLeads, e.target.checked)} checked={filteredSellerLeads.length > 0 && filteredSellerLeads.every(l => selectedIds.has(l.id))} className="rounded border-slate-300" />
                                                    </th>
                                                    <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Profile Picture</th>
                                                    <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('firstName')}>
                                                        Full Name {sortField === 'firstName' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                    </th>
                                                    {visibleColumns.Seller.has('status') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                                                            Lead Status {sortField === 'status' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Seller.has('phone') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('phone')}>
                                                            Contact Info {sortField === 'phone' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Seller.has('isAlsoBuying') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Also Buying?</th>}
                                                    {visibleColumns.Seller.has('homeValueNeeded') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Home Value Needed?</th>}
                                                    {visibleColumns.Seller.has('mostImportantToSeller') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Most Important to Seller</th>}
                                                    {visibleColumns.Seller.has('sellWhen') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Sell When?</th>}
                                                    {visibleColumns.Seller.has('propertyType') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Property Type</th>}
                                                    {visibleColumns.Seller.has('occupancyStatus') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Occupancy Status</th>}
                                                    {visibleColumns.Seller.has('expectedPrice') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Expected Price</th>}
                                                    {visibleColumns.Seller.has('propertyAddress') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('propertyAddress')}>
                                                            Property Address {sortField === 'propertyAddress' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Seller.has('source') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('source')}>
                                                            Source {sortField === 'source' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Seller.has('receivedAt') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('receivedAt')}>
                                                            Date Created {sortField === 'receivedAt' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Seller.has('reasonForSelling') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Reason for Selling</th>}
                                                    {visibleColumns.Seller.has('existingAgentName') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Existing Agent?</th>}
                                                    {visibleColumns.Seller.has('lastTouch') && (
                                                        <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('lastTouch')}>
                                                            Last Follow Up {sortField === 'lastTouch' && <i className={`fa-solid fa-sort-${sortDirection} ml-1`}></i>}
                                                        </th>
                                                    )}
                                                    {visibleColumns.Seller.has('message') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Message</th>}
                                                    {visibleColumns.Seller.has('tags') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Tags</th>}
                                                    {visibleColumns.Seller.has('funnelStage') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Pipeline Stage</th>}
                                                    {visibleColumns.Seller.has('notes') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Comments / Notes</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredSellerLeads.map((lead, index) => (
                                                    <tr key={lead.id} className="group text-slate-700 text-sm transition-colors hover:bg-slate-50/80">
                                                        <td className="px-2 py-2 border-b border-slate-100 text-center text-slate-400 font-bold opacity-50">{index + 1}</td>
                                                        <td className="px-2 py-2 border-b border-slate-100">
                                                            <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => handleSelectOne(lead.id)} className="rounded border-slate-300" />
                                                        </td>
                                                        <td className="px-2 py-2 border-b border-slate-100">
                                                            <div className="w-8 h-8 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
                                                                {lead.avatarUrl ? (
                                                                    <img src={lead.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <i className="fa-solid fa-user text-slate-300 text-[10px]"></i>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2 border-b border-slate-100 font-bold text-slate-900 cursor-pointer hover:underline" onClick={() => onViewLead(lead)}>
                                                            {lead.firstName} {lead.lastName}
                                                        </td>
                                                        {visibleColumns.Seller.has('status') && (
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                {renderCell(lead, 'status', 'select', getStatusOptions(lead.leadType, realtorSettings).map((o: any) => o.label))}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('phone') && (
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                <div className="flex flex-col">
                                                                    <div className="text-xs font-semibold text-slate-700 leading-tight mb-0.5">{renderCell(lead, 'phone')}</div>
                                                                    <div className="text-[10px] text-blue-600 font-medium leading-tight">{renderCell(lead, 'email')}</div>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('isAlsoBuying') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-center">
                                                                <div
                                                                    className="flex justify-center cursor-pointer"
                                                                    onClick={(e) => startEditing(e, lead.id, 'isAlsoBuying', lead.isAlsoBuying ? 'Yes' : 'No')}
                                                                >
                                                                    {editingCell?.id === lead.id && editingCell?.field === 'isAlsoBuying' ? (
                                                                        <div onClick={e => e.stopPropagation()}>
                                                                            <select
                                                                                autoFocus
                                                                                className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
                                                                                defaultValue={lead.isAlsoBuying ? 'Yes' : 'No'}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value === 'Yes';
                                                                                    onUpdateLead(lead.id, { isAlsoBuying: val });
                                                                                    setEditingCell(null);
                                                                                }}
                                                                                onBlur={() => setEditingCell(null)}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                <option value="Yes">Yes</option>
                                                                                <option value="No">No</option>
                                                                            </select>
                                                                        </div>
                                                                    ) : (
                                                                        lead.isAlsoBuying ? (
                                                                            <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '0% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                        ) : (
                                                                            <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '100% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('homeValueNeeded') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-center font-semibold">
                                                                <div
                                                                    className="flex justify-center cursor-pointer"
                                                                    onClick={(e) => startEditing(e, lead.id, 'homeValueNeeded', lead.homeValueNeeded ? 'Yes' : 'No')}
                                                                >
                                                                    {editingCell?.id === lead.id && editingCell?.field === 'homeValueNeeded' ? (
                                                                        <div onClick={e => e.stopPropagation()}>
                                                                            <select
                                                                                autoFocus
                                                                                className="bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
                                                                                defaultValue={lead.homeValueNeeded ? 'Yes' : 'No'}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value === 'Yes';
                                                                                    onUpdateLead(lead.id, { homeValueNeeded: val });
                                                                                    setEditingCell(null);
                                                                                }}
                                                                                onBlur={() => setEditingCell(null)}
                                                                                onClick={e => e.stopPropagation()}
                                                                            >
                                                                                <option value="Yes">Yes</option>
                                                                                <option value="No">No</option>
                                                                            </select>
                                                                        </div>
                                                                    ) : (
                                                                        lead.homeValueNeeded ? (
                                                                            <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '0% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                        ) : (
                                                                            <div className="w-8 h-6 bg-no-repeat bg-contain" style={{ backgroundImage: 'url(/assets/checkmark-cross.png)', backgroundPosition: '100% center', backgroundSize: '200% 100%', mixBlendMode: 'multiply' }}></div>
                                                                        )
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('mostImportantToSeller') && <td className="px-2 py-2 border-b border-slate-100 font-medium">{renderCell(lead, 'mostImportantToSeller' as any)}</td>}
                                                        {visibleColumns.Seller.has('sellWhen') && <td className="px-2 py-2 border-b border-slate-100 font-medium whitespace-nowrap">{renderCell(lead, 'sellWhen' as any)}</td>}
                                                        {visibleColumns.Seller.has('propertyType') && <td className="px-2 py-2 border-b border-slate-100 font-medium">{renderCell(lead, 'propertyType' as any)}</td>}
                                                        {visibleColumns.Seller.has('occupancyStatus') && <td className="px-2 py-2 border-b border-slate-100 font-medium">{renderCell(lead, 'occupancyStatus' as any)}</td>}
                                                        {visibleColumns.Seller.has('expectedPrice') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 font-black text-slate-900">
                                                                {lead.expectedPrice ? `$${lead.expectedPrice.toLocaleString()}` : '--'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('propertyAddress') && <td className="px-2 py-2 border-b border-slate-100 max-w-[250px] truncate font-medium underline text-indigo-600/80 decoration-indigo-200 underline-offset-4">{lead.propertyAddress || '--'}</td>}
                                                        {visibleColumns.Seller.has('source') && <td className="px-2 py-2 border-b border-slate-100 text-xs font-semibold text-indigo-500">{lead.source}</td>}
                                                        {visibleColumns.Seller.has('receivedAt') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-[10px] text-slate-400 font-semibold whitespace-nowrap uppercase">
                                                                {lead.receivedAt?.toDate ? lead.receivedAt.toDate().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(lead.receivedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('reasonForSelling') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.reasonForSelling || '--'}</td>}
                                                        {visibleColumns.Seller.has('existingAgentName') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.existingAgentName || '--'}</td>}
                                                        {visibleColumns.Seller.has('lastTouch') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                                                {lead.lastTouch ? (lead.lastTouch?.toDate ? lead.lastTouch.toDate().toLocaleDateString() : new Date(lead.lastTouch).toLocaleDateString()) : '--'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('message') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-600 max-w-[200px] truncate" title={lead.message}>
                                                                {lead.message || '--'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('tags') && (
                                                            <td className="px-2 py-2 border-b border-slate-100">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {lead.tags?.map((tag, i) => (
                                                                        <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-medium border border-slate-200">{tag}</span>
                                                                    ))}
                                                                    {(!lead.tags || lead.tags.length === 0) && <span className="text-xs text-slate-300">--</span>}
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('funnelStage') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.funnelStage || '--'}</td>}
                                                        {visibleColumns.Seller.has('notes') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 min-w-[200px] text-xs text-slate-600 line-clamp-2" title={lead.notes}>
                                                                {renderCell(lead, 'notes')}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {filteredSellerLeads.map((lead, index) => (
                                            <LeadGalleryItem
                                                key={lead.id}
                                                lead={lead}
                                                index={index + filteredBuyerLeads.length}
                                                onViewLead={onViewLead}
                                                selectedIds={selectedIds}
                                                handleSelectOne={handleSelectOne}
                                                notes={notes}
                                                editNoteId={editNoteId}
                                                setEditNoteId={setEditNoteId}
                                                editContent={editContent}
                                                setEditContent={setEditContent}
                                                handleUpdateNote={handleUpdateNote}
                                                onDoneToggle={onDoneToggle}
                                                onDeleteClick={onDeleteClick}
                                                pendingNote={pendingNote}
                                                draftContent={draftContent}
                                                setDraftContent={setDraftContent}
                                                handleSaveNote={handleSaveNote}
                                                setPendingNote={setPendingNote}
                                                deleteCoords={deleteCoords}
                                                deletingNoteId={deletingNoteId}
                                                celebratingNoteId={celebratingNoteId}
                                                isFlyingUpId={isFlyingUpId}
                                                onArchive={(id) => onUpdateLead(id, { status: 'Archived' })}
                                                onActivate={(id) => onUpdateLead(id, { status: 'New' })}
                                            />
                                        ))}
                                    </div>
                                )
                            ) : (
                                <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-[2rem]">
                                    No seller leads found for this period.
                                </div>
                            )}
                        </section>
                    )}
                </div>

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
            </DragDropContext >
            {/* Custom Confirmation Modal */}
            {confirmModal && confirmModal.show && (
                <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl p-8 animate-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6 border border-amber-100 mx-auto">
                            <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 text-center mb-2">{confirmModal.title}</h3>
                        <p className="text-sm text-slate-500 text-center font-medium leading-relaxed mb-8">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                id="confirm-bulk-action"
                                onClick={confirmModal.onConfirm}
                                className="flex-1 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadsList;
