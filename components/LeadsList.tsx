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
    onActivate: (id: string) => void,
    visibleColumns: Set<string>,
    activeTab: 'Buyer' | 'Seller'
}> = ({
    lead, index, onViewLead, selectedIds, handleSelectOne, notes,
    editNoteId, setEditNoteId, editContent, setEditContent, handleUpdateNote,
    onDoneToggle, onDeleteClick, pendingNote, draftContent, setDraftContent,
    handleSaveNote, setPendingNote, deleteCoords, deletingNoteId, celebratingNoteId, isFlyingUpId,
    onArchive, onActivate, visibleColumns, activeTab
}) => {
        const renderValue = (field: string) => {
            const val = (lead as any)[field];
            if (field === 'receivedAt' || field === 'lastTouch' || field === 'leaseEndDate') {
                const date = val?.toDate ? val.toDate() : (val ? new Date(val) : null);
                if (!date) return '--';
                if (field === 'receivedAt') {
                    const now = new Date();
                    const diffMs = Math.max(0, now.getTime() - date.getTime());
                    const d = Math.floor(diffMs / 86400000);
                    const h = Math.floor((diffMs % 86400000) / 3600000);
                    const s = Math.floor((diffMs % 60000) / 1000);

                    const parts = [];
                    if (d > 0) parts.push(`${d}d`);
                    if (h > 0) parts.push(`${h}h`);
                    if (s > 0) parts.push(`${s}s`);

                    return parts.length > 0 ? parts.join(' ') : 'Just now';
                }
                return date.toLocaleDateString();
            }
            if (typeof val === 'boolean') return val ? 'Yes' : 'No';
            if (field === 'expectedPrice' || field === 'price' || field === 'budgetRange') {
                const min = lead.minPrice;
                const max = lead.maxPrice;

                if (field === 'budgetRange') {
                    if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
                    if (min) return `Above $${(min / 1000).toFixed(0)}k`;
                    if (max) return `Under $${(max / 1000).toFixed(0)}k`;
                    return '--';
                }

                const priceVal = val || (field === 'expectedPrice' ? lead.expectedPrice : lead.price);
                return priceVal ? `$${(priceVal / 1000).toFixed(0)}k` : '--';
            }
            if (Array.isArray(val)) return val.join(', ') || '--';
            return val || '--';
        };

        const COLUMN_METADATA: Record<string, { label: string, icon: string, color?: string }> = {
            status: { label: 'Status', icon: 'fa-signal', color: 'text-indigo-600' },
            isAlsoSelling: { label: 'Also Selling?', icon: 'fa-house-user' },
            isAlsoBuying: { label: 'Also Buying?', icon: 'fa-cart-shopping' },
            preQualified: { label: 'Pre-qualified?', icon: 'fa-certificate', color: 'text-emerald-600' },
            budgetRange: { label: 'Budget', icon: 'fa-tag', color: 'text-emerald-600' },
            expectedPrice: { label: 'Price', icon: 'fa-money-bill-wave', color: 'text-emerald-600' },
            preferredNeighborhood: { label: 'Neighborhood', icon: 'fa-map-location-dot', color: 'text-indigo-600' },
            source: { label: 'Source', icon: 'fa-globe', color: 'text-slate-400' },
            receivedAt: { label: 'Age', icon: 'fa-calendar-plus', color: 'text-slate-400' },
            lastTouch: { label: 'Follow Up', icon: 'fa-clock-rotate-left', color: 'text-indigo-400' },
            message: { label: 'Message', icon: 'fa-comment' },
            timeframe: { label: 'Timeframe', icon: 'fa-hourglass-half' },
            leaseEndDate: { label: 'Lease End', icon: 'fa-file-signature' },
            propertyAddress: { label: 'Property', icon: 'fa-location-dot', color: 'text-indigo-600' },
            tags: { label: 'Tags', icon: 'fa-tags' },
            funnelStage: { label: 'Stage', icon: 'fa-filter' },
            notes: { label: 'Notes', icon: 'fa-clipboard-list' },
            homeValueNeeded: { label: 'Home Value?', icon: 'fa-calculator' },
            mostImportantToSeller: { label: 'Priority', icon: 'fa-star' },
            sellWhen: { label: 'When?', icon: 'fa-calendar-days' },
            propertyType: { label: 'Type', icon: 'fa-building' },
            occupancyStatus: { label: 'Occupancy', icon: 'fa-key' },
            reasonForSelling: { label: 'Reason', icon: 'fa-info-circle' },
            existingAgentName: { label: 'Agent', icon: 'fa-user-tie' }
        };

        return (
            <div
                className={`bg-white p-4 rounded-[2rem] border transition-all border-l-4 group relative cursor-pointer flex flex-col ${selectedIds.has(lead.id)
                    ? (lead.leadType === 'Seller'
                        ? 'ring-4 ring-emerald-500/50 border-emerald-200 bg-emerald-50/30 shadow-2xl scale-[1.02] z-10'
                        : 'ring-4 ring-indigo-500/50 border-indigo-200 bg-indigo-50/30 shadow-2xl scale-[1.02] z-10')
                    : 'border-slate-200/60 shadow-sm hover:shadow-xl hover:scale-[1.01]'
                    }`}
                style={{
                    borderLeftColor: lead.leadType === 'Seller' ? '#10b981' : '#6366f1'
                }}
                onClick={(e) => { handleSelectOne(lead.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); onViewLead(lead); }}
            >
                {/* Selection Badge */}
                {selectedIds.has(lead.id) && (
                    <div className={`absolute -top-2 -right-2 w-8 h-8 ${lead.leadType === 'Seller' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-200 z-30 ring-4 ring-white`}>
                        <i className="fa-solid fa-check text-sm"></i>
                    </div>
                )}
                <TypedDroppable droppableId={lead.id} type="POSTIT_PALETTE">
                    {(noteProvided: any, noteSnapshot: any) => (
                        <div
                            ref={noteProvided.innerRef}
                            {...noteProvided.droppableProps}
                            className={`flex-1 flex flex-col min-h-[130px] ${noteSnapshot.isDraggingOver ? 'bg-indigo-50/20' : ''}`}
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

                            <div className="flex items-start gap-4 mb-4">
                                {/* Profile Picture / Avatar (Bigger) */}
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex-shrink-0 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                                    {lead.avatarUrl ? (
                                        <img src={lead.avatarUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-indigo-400/60 font-black text-sm uppercase">
                                            {lead.firstName?.charAt(0) || ''}{lead.lastName?.charAt(0) || ''}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                                    <div className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors tracking-tight truncate leading-tight mb-0.5" onClick={() => onViewLead(lead)}>
                                        {lead.firstName} {lead.lastName}
                                    </div>

                                    <div className="flex flex-col gap-0.5 text-[12px] text-slate-400 font-bold whitespace-nowrap overflow-hidden">
                                        {lead.email && (
                                            <div className={`flex items-center gap-1.5 pr-2 min-w-0 ${(lead.preferredContactMethod || '').toLowerCase() === 'email' ? 'border border-indigo-500 rounded px-2 py-0.5 bg-indigo-50 -ml-2' : ''}`}>
                                                <i className="fa-solid fa-envelope opacity-30 text-[8px] flex-shrink-0"></i>
                                                <span className="truncate">{lead.email}</span>
                                                {(lead.preferredContactMethod || '').toLowerCase() === 'email' && <i className="fa-solid fa-star text-[8px] text-indigo-600 ml-auto flex-shrink-0"></i>}
                                            </div>
                                        )}
                                        {lead.phone && (
                                            <div className={`flex items-center gap-1.5 pr-2 min-w-0 ${['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) ? 'border border-indigo-500 rounded px-2 py-0.5 bg-indigo-50 -ml-2' : ''}`}>
                                                <i className="fa-solid fa-phone opacity-30 text-[8px] flex-shrink-0"></i>
                                                <span className="truncate">{lead.phone}</span>
                                                {['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) && <span className="text-[8px] font-black uppercase tracking-wider text-indigo-600 ml-auto flex-shrink-0">{lead.preferredContactMethod}</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Price Range & Neighborhood */}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4">
                                {Array.from(visibleColumns).filter(colId => !['phone', 'email', 'firstName', 'lastName', 'message', 'notes'].includes(colId as string)).map((colId: any) => {
                                    const meta = COLUMN_METADATA[colId as string];
                                    if (!meta) return null;
                                    const displayLabel = meta.label
                                        .replace(/[^a-zA-Z0-9\s]/g, '')
                                        .split(' ')
                                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                        .join(' ') + (meta.label.includes('?') ? '?' : '');

                                    return (
                                        <div key={colId as string} className="grid grid-cols-[auto_1fr] gap-x-1.5 text-[14px] font-bold text-slate-900 leading-tight min-w-0 items-start">
                                            <span className="whitespace-nowrap">{displayLabel}:</span>
                                            <span className="font-medium break-words">{renderValue(colId as string)}</span>
                                        </div>
                                    );
                                })}
                            </div>


                            {/* User Message */}
                            {lead.message && (
                                <div className="mt-2 bg-indigo-50/30 p-3 rounded-2xl border border-indigo-100/50 flex flex-col gap-1.5 relative overflow-hidden group/msg">
                                    <div className="text-[14px] font-medium text-slate-900 tracking-widest flex items-center gap-1.5 opacity-60">
                                        <i className="fa-solid fa-comment-dots text-[8px] opacity-30"></i>
                                        Inquiry Message
                                    </div>
                                    <div className="text-[14px] text-indigo-600 font-bold leading-[1.3] italic">
                                        "{lead.message}"
                                    </div>
                                </div>
                            )}

                            {/* Post-it Notes */}
                            <div
                                className="flex flex-wrap gap-3 mt-4 relative min-h-[40px] flex-1 rounded-xl transition-colors"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {(lead.notesLog || []).filter(n => !n.isDone).map((note, i) => (
                                    <div
                                        key={note.id}
                                        onClick={() => { if (!editNoteId) { setEditNoteId(note.id); setEditContent(note.content); } }}
                                        className={`p-2.5 pt-4 w-24 h-24 rounded-sm border-t border-black/5 text-[12px] font-bold post-it-font whitespace-normal shadow-lg transition-all hover:scale-110 hover:z-10 group/note flex flex-col relative cursor-pointer post-it-container ${note.color || 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]'} ${i % 2 === 0 ? 'rotate-2' : '-rotate-2'} hover:rotate-0 ${note.isDone ? 'line-through opacity-50' : ''} ${deletingNoteId === note.id ? 'animate-fly-away' : ''} ${celebratingNoteId === note.id ? 'animate-shake' : ''} ${isFlyingUpId === note.id ? 'animate-fly-up' : ''} ${note.isUrgent ? 'urgent-glow' : ''}`}
                                        style={{
                                            ...((deletingNoteId === note.id || isFlyingUpId === note.id) && deleteCoords ? {
                                                '--start-top': `${deleteCoords.top}px`,
                                                '--start-left': `${deleteCoords.left}px`
                                            } as any : {})
                                        }}
                                    >
                                        {editNoteId === note.id ? (
                                            <textarea
                                                autoFocus
                                                className="w-full h-full bg-transparent border-none outline-none resize-none post-it-edit"
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                onBlur={() => {
                                                    if (editContent.trim() && editContent !== note.content) {
                                                        handleUpdateNote(note.id, { content: editContent });
                                                    }
                                                    setEditNoteId(null);
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <div className="text-[7px] opacity-40 mb-1 font-sans leading-none uppercase tracking-tighter">
                                                    {new Date(note.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <div className="text-slate-800 line-clamp-4 leading-tight">{note.content}</div>
                                                <div className="absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 transition-opacity flex gap-1 bg-white/20 rounded-full px-1 backdrop-blur-sm">
                                                    <button
                                                        onClick={(e) => onDoneToggle(e, note)}
                                                        className="text-slate-600 hover:text-emerald-600 transition-colors p-0.5"
                                                        title="Complete"
                                                    >
                                                        <i className="fa-solid fa-check text-[10px]"></i>
                                                    </button>
                                                    <button
                                                        onClick={(e) => onDeleteClick(e, note.id)}
                                                        className="text-slate-600 hover:text-red-500 transition-colors p-0.5"
                                                        title="Delete"
                                                    >
                                                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {/* Pending Note (Draft) */}
                                {pendingNote && pendingNote.leadId === lead.id && (
                                    <div className={`p-2.5 pt-4 w-24 h-24 rounded-sm border-t border-black/5 text-[9px] font-bold post-it-font whitespace-normal shadow-xl transition-all rotate-3 scale-105 z-20 flex flex-col relative post-it-container ${pendingNote.color}`}>
                                        <textarea
                                            autoFocus
                                            className="w-full h-full bg-transparent border-none outline-none resize-none post-it-draft"
                                            placeholder="Write note..."
                                            value={draftContent}
                                            onChange={(e) => setDraftContent(e.target.value)}
                                            onBlur={() => {
                                                if (draftContent.trim()) {
                                                    handleSaveNote(draftContent);
                                                } else {
                                                    setPendingNote(null);
                                                }
                                                setDraftContent('');
                                            }}
                                        />
                                    </div>
                                )}
                                {<div style={{ display: 'none' }}>{noteProvided.placeholder}</div>}
                            </div>
                        </div>
                    )}
                </TypedDroppable>
            </div >
        );
    };


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
        { id: 'callCount', label: 'Call Tracker' },
        { id: 'lastUpdated', label: 'Last Updated On' },
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
        { id: 'notes', label: 'Call Notes' }
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
        { id: 'notes', label: 'Agent Notes' }
    ];

    // Default visible columns (preserving previous default view)
    const defaultBuyerVisible = ['status', 'phone', 'callCount', 'lastUpdated', 'isAlsoSelling', 'preQualified', 'budgetRange', 'preferredNeighborhood', 'source', 'receivedAt', 'notes'];
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

    // Force sync visible columns if defaults change (handles Hot Reload state preservation)
    useEffect(() => {
        setVisibleColumns(prev => {
            const missingBuyer = defaultBuyerVisible.some(c => !prev.Buyer.has(c));
            if (missingBuyer) {
                return {
                    ...prev,
                    Buyer: new Set([...Array.from(prev.Buyer), ...defaultBuyerVisible])
                };
            }
            return prev;
        });
    }, [defaultBuyerVisible.length]); // Dep on length change or just run once? Defaults are const. Length change is safe proxy.

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

    const [buyerViewMode, setBuyerViewMode] = useState<'past6Months' | 'older'>('past6Months');
    const [sellerViewMode, setSellerViewMode] = useState<'past6Months' | 'older'>('past6Months');

    // Display Mode Mapping (Default: Past 6 Months -> Gallery, Older -> List)
    const [viewMode, setViewMode] = useState<'past6Months' | 'older'>('past6Months'); // Legacy

    const [displayModes, setDisplayModes] = useState<Record<string, 'list' | 'gallery'>>({
        past6Months: 'gallery',
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
        const startOf6Months = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

        return {
            startOf6Months,
            labels: {
                past6Months: `Past 6 Months`,
                older: `Older than 6 Months`
            }
        };
    }, []);

    const timeStats = useMemo(() => {
        const { startOf6Months } = dateRanges;
        const validLeads = leads.filter(l =>
            isNewLeadStatus(l.status, l.leadType, realtorSettings) &&
            l.collectionName === 'leads'
        );

        const getStatsForType = (type: 'Buyer' | 'Seller') => {
            const typed = validLeads.filter(l => l.leadType === type);
            return {
                past6Months: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d >= startOf6Months;
                }).length,
                older: typed.filter(l => {
                    const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);
                    return d < startOf6Months;
                }).length
            };
        };

        return {
            Buyer: getStatsForType('Buyer'),
            Seller: getStatsForType('Seller')
        };
    }, [leads, dateRanges, realtorSettings]);

    const filteredBuyerLeads = useMemo(() => {
        const { startOf6Months } = dateRanges;

        let result = leads.filter(l => {
            if (l.leadType !== 'Buyer' && l.leadType !== 'Rental' && l.leadType !== 'Mortgage') return false; // Default Buyers
            // Note: Types are 'Buyer' | 'Seller' | 'Rental' | 'Mortgage'. Grouping Buyers, Rentals, Mortgage together for now or just Buyer.
            if (l.leadType !== 'Buyer') return false;

            if (!isNewLeadStatus(l.status, l.leadType, realtorSettings)) return false;
            if (l.collectionName !== 'leads') return false;

            const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);

            if (buyerViewMode === 'past6Months') return d >= startOf6Months;
            if (buyerViewMode === 'older') return d < startOf6Months;
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
        const { startOf6Months } = dateRanges;

        let result = leads.filter(l => {
            if (l.leadType !== 'Seller') return false;
            if (!isNewLeadStatus(l.status, l.leadType, realtorSettings)) return false;
            if (l.collectionName !== 'leads') return false;

            const d = l.receivedAt?.toDate ? l.receivedAt.toDate() : new Date(l.receivedAt);

            if (sellerViewMode === 'past6Months') return d >= startOf6Months;
            if (sellerViewMode === 'older') return d < startOf6Months;
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
                                        { id: 'past6Months', label: 'Past 6 Months', subtitle: dateRanges.labels.past6Months, count: timeStats.Buyer.past6Months },
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
                                <div className="ml-4 flex items-center">
                                    <div className="flex flex-col items-center">
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

                                    {/* Post-it Palette */}
                                    {currentDisplayMode === 'gallery' && (
                                        <div className="ml-4 pl-4 border-l border-slate-200 h-10 flex items-center text-left">
                                            <TypedDroppable droppableId="palette-buyer" direction="horizontal" type="POSTIT_PALETTE" isDropDisabled={true}>
                                                {(provided: any) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">Add Note:</div>
                                                        <div className="flex items-center gap-2">
                                                            {noteTypes.map((note, index) => (
                                                                <TypedDraggable key={note.id} draggableId={`${note.id}-buyer`} index={index}>
                                                                    {(provided: any, snapshot: any) => (
                                                                        <div className="relative group note-palette-item">
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
                                                                                className={`w-16 h-16 rounded-sm border-t border-black/5 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all hover:-translate-y-1 hover:rotate-3 ${note.color} ${note.shadow} ${snapshot.isDragging ? 'z-[100] rotate-6 scale-110 shadow-2xl ring-2 ring-white/50' : 'relative z-10'} ${snapshot.isDropAnimating ? 'opacity-0 duration-0' : ''}`}
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
                                    )}
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
                                    <div className="overflow-x-auto w-full pb-6">
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
                                                    {visibleColumns.Buyer.has('callCount') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Call Tracker</th>}
                                                    {visibleColumns.Buyer.has('lastUpdated') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Last Updated On</th>}
                                                    {visibleColumns.Buyer.has('isAlsoSelling') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Also Selling?</th>}
                                                    {visibleColumns.Buyer.has('preQualified') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50 text-center">Pre-qualified?</th>}
                                                    {visibleColumns.Buyer.has('budgetRange') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Budget</th>}
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
                                                    {visibleColumns.Buyer.has('notes') && <th className="px-2 py-3 border-b border-slate-200/60 bg-slate-50">Call Notes</th>}

                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredBuyerLeads.map((lead, index) => (
                                                    <tr key={lead.id} className="group text-slate-700 text-sm transition-colors hover:bg-slate-50/80" onDoubleClick={() => onViewLead(lead)}>
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
                                                                    <div className={`text-xs font-semibold text-slate-700 leading-tight mb-0.5 flex items-center justify-between gap-2 ${['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) ? 'border border-indigo-500 rounded px-2 py-0.5 bg-indigo-50 -ml-2 w-full max-w-[180px]' : ''}`}>
                                                                        <span>{renderCell(lead, 'phone')}</span>
                                                                        {['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) && <span className="text-[8px] font-black uppercase tracking-wider text-indigo-600 flex-shrink-0">{lead.preferredContactMethod}</span>}
                                                                    </div>
                                                                    <div className={`text-[10px] text-blue-600 font-medium leading-tight flex items-center justify-between gap-2 ${(lead.preferredContactMethod || '').toLowerCase() === 'email' ? 'border border-indigo-500 rounded px-2 py-0.5 bg-indigo-50 -ml-2 w-full max-w-[180px]' : ''}`}>
                                                                        <span className="truncate">{renderCell(lead, 'email')}</span>
                                                                        {(lead.preferredContactMethod || '').toLowerCase() === 'email' && <i className="fa-solid fa-star text-[8px] text-indigo-600 flex-shrink-0"></i>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('callCount') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-center">
                                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-bold border border-slate-200">
                                                                    {lead.callCount || 0}
                                                                </span>
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('lastUpdated') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-500 font-medium whitespace-nowrap">
                                                                {lead.lastUpdated ? (lead.lastUpdated?.toDate ? lead.lastUpdated.toDate().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(lead.lastUpdated).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : '--'}
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
                                                                        lead.isAlsoSelling === true ? (
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
                                                                        lead.preQualified === true ? (
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
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-900 font-semibold whitespace-nowrap uppercase">
                                                                {lead.receivedAt?.toDate ? lead.receivedAt.toDate().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : new Date(lead.receivedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('lastTouch') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-900 font-medium whitespace-nowrap">
                                                                {lead.lastTouch ? (lead.lastTouch?.toDate ? lead.lastTouch.toDate().toLocaleDateString() : new Date(lead.lastTouch).toLocaleDateString()) : '--'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Buyer.has('message') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-600 max-w-[200px] whitespace-normal" title={lead.message}>
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
                                                            <td className="px-2 py-2 border-b border-slate-100 min-w-[200px] max-w-[300px]">
                                                                <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto custom-scrollbar">
                                                                    {(lead.notesLog || []).length > 0 ? (
                                                                        lead.notesLog!.map((note, i) => (
                                                                            <div key={note.id || i} className="text-[11px] leading-tight text-slate-600">
                                                                                <span className="opacity-50 text-[10px] mr-1">
                                                                                    {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(note.timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                                {note.content}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">--</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}

                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
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
                                                visibleColumns={visibleColumns.Buyer}
                                                activeTab="Buyer"
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
                                        { id: 'past6Months', label: 'Past 6 Months', subtitle: dateRanges.labels.past6Months, count: timeStats.Seller.past6Months },
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
                                <div className="ml-4 flex items-center">
                                    <div className="flex flex-col items-center">
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

                                    {/* Post-it Palette */}
                                    {currentDisplayMode === 'gallery' && (
                                        <div className="ml-4 pl-4 border-l border-slate-200 h-10 flex items-center text-left">
                                            <TypedDroppable droppableId="palette-seller" direction="horizontal" type="POSTIT_PALETTE" isDropDisabled={true}>
                                                {(provided: any) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">Add Note:</div>
                                                        <div className="flex items-center gap-2">
                                                            {noteTypes.map((note, index) => (
                                                                <TypedDraggable key={note.id} draggableId={`${note.id}-seller`} index={index}>
                                                                    {(provided: any, snapshot: any) => (
                                                                        <div className="relative group note-palette-item">
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
                                                                                className={`w-16 h-16 rounded-sm border-t border-black/5 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all hover:-translate-y-1 hover:rotate-3 ${note.color} ${note.shadow} ${snapshot.isDragging ? 'z-[100] rotate-6 scale-110 shadow-2xl ring-2 ring-white/50' : 'relative z-10'} ${snapshot.isDropAnimating ? 'opacity-0 duration-0' : ''}`}
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
                                    )}
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
                                    <div className="overflow-x-auto w-full pb-6">
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
                                                    <tr key={lead.id} className="group text-slate-700 text-sm transition-colors hover:bg-slate-50/80" onDoubleClick={() => onViewLead(lead)}>
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
                                                                    <div className={`text-xs font-semibold text-slate-700 leading-tight mb-0.5 flex items-center justify-between gap-2 ${['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) ? 'border border-emerald-500 rounded px-2 py-0.5 bg-emerald-50 -ml-2 w-full max-w-[180px]' : ''}`}>
                                                                        <span>{renderCell(lead, 'phone')}</span>
                                                                        {['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) && <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 flex-shrink-0">{lead.preferredContactMethod}</span>}
                                                                    </div>
                                                                    <div className={`text-[10px] text-blue-600 font-medium leading-tight flex items-center justify-between gap-2 ${(lead.preferredContactMethod || '').toLowerCase() === 'email' ? 'border border-emerald-500 rounded px-2 py-0.5 bg-emerald-50 -ml-2 w-full max-w-[180px]' : ''}`}>
                                                                        <span className="truncate">{renderCell(lead, 'email')}</span>
                                                                        {(lead.preferredContactMethod || '').toLowerCase() === 'email' && <i className="fa-solid fa-star text-[8px] text-emerald-600 flex-shrink-0"></i>}
                                                                    </div>
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
                                                                        lead.isAlsoBuying === true ? (
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
                                                                        lead.homeValueNeeded === true ? (
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
                                                        {visibleColumns.Seller.has('propertyAddress') && <td className="px-2 py-2 border-b border-slate-100 max-w-[250px] whitespace-normal font-medium underline text-indigo-600/80 decoration-indigo-200 underline-offset-4">{lead.propertyAddress || '--'}</td>}
                                                        {visibleColumns.Seller.has('source') && <td className="px-2 py-2 border-b border-slate-100 text-xs font-semibold text-indigo-500">{lead.source}</td>}
                                                        {visibleColumns.Seller.has('receivedAt') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-900 font-semibold whitespace-nowrap uppercase">
                                                                {lead.receivedAt?.toDate ? lead.receivedAt.toDate().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : new Date(lead.receivedAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('reasonForSelling') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.reasonForSelling || '--'}</td>}
                                                        {visibleColumns.Seller.has('existingAgentName') && <td className="px-2 py-2 border-b border-slate-100 font-medium text-xs">{lead.existingAgentName || '--'}</td>}
                                                        {visibleColumns.Seller.has('lastTouch') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-900 font-medium whitespace-nowrap">
                                                                {lead.lastTouch ? (lead.lastTouch?.toDate ? lead.lastTouch.toDate().toLocaleDateString() : new Date(lead.lastTouch).toLocaleDateString()) : '--'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.Seller.has('message') && (
                                                            <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-600 max-w-[200px] whitespace-normal" title={lead.message}>
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
                                                            <td className="px-2 py-2 border-b border-slate-100 min-w-[200px] max-w-[300px]">
                                                                <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto custom-scrollbar">
                                                                    {(lead.notesLog || []).length > 0 ? (
                                                                        lead.notesLog!.map((note, i) => (
                                                                            <div key={note.id || i} className="text-[11px] leading-tight text-slate-600">
                                                                                <span className="opacity-50 text-[10px] mr-1">
                                                                                    {note.timestamp?.toDate ? note.timestamp.toDate().toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date(note.timestamp).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                                {note.content}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">--</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
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
                                                visibleColumns={visibleColumns.Seller}
                                                activeTab="Seller"
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
