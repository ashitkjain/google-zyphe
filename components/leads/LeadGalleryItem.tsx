import React from 'react';
import { Lead, PipelineNote } from '../../types';
import { Droppable } from '@hello-pangea/dnd';

const TypedDroppable = Droppable as any;

interface LeadGalleryItemProps {
    lead: Lead;
    index: number;
    onViewLead: (lead: Lead) => void;
    selectedIds: Set<string>;
    handleSelectOne: (id: string) => void;
    notes: PipelineNote[];
    editNoteId: string | null;
    setEditNoteId: (id: string | null) => void;
    editContent: string;
    setEditContent: (content: string) => void;
    handleUpdateNote: (id: string, updates: any) => void;
    onDoneToggle: (e: any, note: any) => void;
    onDeleteClick: (e: any, id: string) => void;
    pendingNote: any;
    draftContent: string;
    setDraftContent: (content: string) => void;
    handleSaveNote: (content: string) => void;
    setPendingNote: (note: any) => void;
    deleteCoords: any;
    deletingNoteId: string | null;
    celebratingNoteId: string | null;
    isFlyingUpId: string | null;
    onArchive: (id: string) => void;
    onActivate: (id: string) => void;
    visibleColumns: Set<string>;
    activeTab: 'Buyer' | 'Seller';
    onUpdateAvatar: (leadId: string, file: File) => void;
}

const LeadGalleryItem: React.FC<LeadGalleryItemProps> = ({
    lead, index, onViewLead, selectedIds, handleSelectOne,
    editNoteId, setEditNoteId, editContent, setEditContent, handleUpdateNote,
    onDoneToggle, onDeleteClick, pendingNote, draftContent, setDraftContent,
    handleSaveNote, setPendingNote, deleteCoords, deletingNoteId, celebratingNoteId, isFlyingUpId,
    onArchive, onActivate, visibleColumns, activeTab, onUpdateAvatar
}) => {
    // ... helper functions ...
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpdateAvatar(lead.id, e.target.files[0]);
        }
    };

    // ... renderValue and COLUMN_METADATA ...
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
                            <div
                                className="w-14 h-14 rounded-2xl bg-slate-50 flex-shrink-0 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center relative group/avatar cursor-pointer"
                                onClick={handleAvatarClick}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                {lead.avatarUrl ? (
                                    <img src={lead.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-indigo-400/60 font-black text-sm uppercase">
                                        {lead.firstName?.charAt(0) || ''}{lead.lastName?.charAt(0) || ''}
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                    <i className="fa-solid fa-camera text-white text-xs drop-shadow-md"></i>
                                </div>
                            </div>

                            <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                                <div className="font-bold text-black text-sm group-hover:text-indigo-600 transition-colors tracking-tight truncate leading-tight mb-0.5" onClick={() => onViewLead(lead)}>
                                    {lead.firstName} {lead.lastName}
                                </div>

                                <div className="flex flex-col gap-0.5 text-[12px] text-slate-400 font-bold whitespace-nowrap overflow-hidden">
                                    {lead.email && (
                                        <div className="flex items-center gap-1.5 pr-2 min-w-0 pb-1">
                                            <i className="fa-solid fa-envelope opacity-30 text-[8px] flex-shrink-0"></i>
                                            <span className="truncate">{lead.email}</span>
                                            {(lead.preferredContactMethod || '').toLowerCase() === 'email' && (
                                                <span className="text-[9px] text-indigo-400 font-medium italic whitespace-nowrap flex-shrink-0">
                                                    - preferred
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {lead.phone && (
                                        <div className="flex items-center gap-1.5 pr-2 min-w-0">
                                            <i className="fa-solid fa-phone opacity-30 text-[8px] flex-shrink-0"></i>
                                            <span className="truncate">{lead.phone}</span>
                                            {['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) && (
                                                <span className="text-[9px] text-indigo-400 font-medium italic whitespace-nowrap flex-shrink-0">
                                                    - preferred {(lead.preferredContactMethod || '').toLowerCase() === 'call' ? 'call' : 'text'}
                                                </span>
                                            )}
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
                                    <div key={colId as string} className="grid grid-cols-[auto_1fr] gap-x-1.5 text-[14px] font-bold text-black leading-tight min-w-0 items-start">
                                        <span className="whitespace-nowrap">{displayLabel}:</span>
                                        <span className="font-medium break-words">{renderValue(colId as string)}</span>
                                    </div>
                                );
                            })}
                        </div>


                        {/* User Message */}
                        {lead.message && (
                            <div className="mt-2 bg-indigo-50/30 p-3 rounded-2xl border border-indigo-100/50 flex flex-col gap-1.5 relative overflow-hidden group/msg">
                                <div className="text-[14px] font-medium text-black tracking-widest flex items-center gap-1.5 opacity-60">
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
                                    className={`p-2.5 pt-4 w-24 h-24 rounded-sm border-t border-black/5 text-[12px] font-bold post-it-font whitespace-normal shadow-lg transition-all hover:scale-110 hover:z-10 group/note flex flex-col relative cursor-pointer post-it-container ${note.color || 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]'} ${i % 2 === 0 ? 'rotate-2' : '-rotate-2'} hover:rotate-0 ${note.isDone ? 'line-through opacity-50' : ''} ${celebratingNoteId === note.id ? 'animate-shake' : ''} ${note.isUrgent ? 'urgent-glow' : ''} ${(deletingNoteId === note.id || isFlyingUpId === note.id) ? 'opacity-0 pointer-events-none' : ''}`}
                                    style={{
                                        '--rotation': i % 2 === 0 ? '2deg' : '-2deg'
                                    } as React.CSSProperties}
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

export default LeadGalleryItem;
