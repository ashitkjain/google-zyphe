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
    const [visibleStages, setVisibleStages] = useState<string[]>(['Nurture', 'Active', 'Offer', 'UnderContract', 'Closed']);
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('Nurture');
    const [showCardFieldSettings, setShowCardFieldSettings] = useState<string | null>(null);

    const [visibleColumnsPerStage, setVisibleColumnsPerStage] = useState<Record<string, Set<string>>>({
        'Nurture': new Set(['email', 'phone', 'callCount', 'lastUpdated', 'price', 'avatar']),
        'Active': new Set(['email', 'phone', 'callCount', 'lastUpdated', 'propertyAddress', 'price', 'avatar']),
        'Offer': new Set(['email', 'phone', 'callCount', 'lastUpdated', 'price', 'avatar']),
        'UnderContract': new Set(['email', 'phone', 'callCount', 'lastUpdated', 'propertyAddress', 'price', 'avatar']),
        'Closed': new Set(['email', 'phone', 'callCount', 'lastUpdated', 'price', 'avatar']),
    });

    const cardFields = [
        { id: 'email', label: 'Email', icon: 'fa-envelope' },
        { id: 'phone', label: 'Phone', icon: 'fa-phone' },
        { id: 'callCount', label: 'Call Tracker', icon: 'fa-phone-volume' },
        { id: 'lastUpdated', label: 'Last Updated', icon: 'fa-clock' },
        { id: 'status', label: 'Lead Status', icon: 'fa-signal' },
        { id: 'leadType', label: 'Lead Type', icon: 'fa-user-tag' },
        { id: 'preferredContactMethod', label: 'Preferred Contact', icon: 'fa-message' },
        { id: 'propertyAddress', label: 'Subject Property', icon: 'fa-location-dot' },
        { id: 'propertyType', label: 'Property Type', icon: 'fa-house' },
        { id: 'mlsNumber', label: 'MLS Number', icon: 'fa-list-ol' },
        { id: 'price', label: 'Price/Budget', icon: 'fa-dollar-sign' },
        { id: 'expectedPrice', label: 'Expected Price', icon: 'fa-money-bill-trend-up' },
        { id: 'bedrooms', label: 'Bedrooms', icon: 'fa-bed' },
        { id: 'bathrooms', label: 'Bathrooms', icon: 'fa-bath' },
        { id: 'preferredNeighborhood', label: 'Neighborhood', icon: 'fa-map-location-dot' },
        { id: 'isAlsoSelling', label: 'Also Selling?', icon: 'fa-repeat' },
        { id: 'preQualified', label: 'Pre-qualified?', icon: 'fa-certificate' },
        { id: 'sellWhen', label: 'Sell When?', icon: 'fa-calendar-days' },
        { id: 'occupancyStatus', label: 'Occupancy', icon: 'fa-house-user' },
        { id: 'mostImportantToSeller', label: 'Priority', icon: 'fa-star' },
        { id: 'reasonForSelling', label: 'Reason', icon: 'fa-question' },
        { id: 'isAlsoBuying', label: 'Also Buying?', icon: 'fa-repeat' },
        { id: 'homeValueNeeded', label: 'Value Needed?', icon: 'fa-magnifying-glass-dollar' },
        { id: 'timeframe', label: 'Timeframe', icon: 'fa-hourglass-half' },
        { id: 'message', label: 'Lead Message', icon: 'fa-comment-dots' },
        { id: 'tags', label: 'Tags', icon: 'fa-tags' },
        { id: 'source', label: 'Source', icon: 'fa-share-nodes' },
        { id: 'avatar', label: 'Client Initials', icon: 'fa-user' },
    ];

    const toggleCardField = (stage: string, fieldId: string) => {
        setVisibleColumnsPerStage(prev => {
            const newSet = new Set(prev[stage]);
            if (newSet.has(fieldId)) newSet.delete(fieldId);
            else newSet.add(fieldId);
            return { ...prev, [stage]: newSet };
        });
    };

    // Auto-switch tab if current one is hidden
    useEffect(() => {
        if (!visibleStages.includes(activeTab)) {
            const firstVisible = ['Nurture', 'Active', 'Offer', 'UnderContract', 'Closed'].find(s => visibleStages.includes(s));
            if (firstVisible) setActiveTab(firstVisible);
        }
    }, [visibleStages, activeTab]);

    const onDoneToggle = (e: React.MouseEvent, note: PipelineNote) => {
        e.stopPropagation();
        if (note.isDone) {
            handleUpdateNote(note.id, { isDone: false, timestamp: new Date() });
            return;
        }

        const container = (e.currentTarget.closest('.post-it-container') as HTMLElement);
        if (container) {
            const rect = container.getBoundingClientRect();
            setDeleteCoords({ top: rect.top, left: rect.left });
        }

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
        const container = (e.currentTarget.closest('.post-it-container') as HTMLElement);
        if (container) {
            const rect = container.getBoundingClientRect();
            setDeleteCoords({ top: rect.top, left: rect.left });
        }
        setDeletingNoteId(noteId);
        setTimeout(() => {
            handleDeleteNote(noteId);
            setDeletingNoteId(null);
            setDeleteCoords(null);
        }, 800);
    };

    const renderValue = (lead: Lead, field: string) => {
        const val = (lead as any)[field];
        if (field === 'receivedAt' || field === 'lastTouch' || field === 'leaseEndDate' || field === 'lastUpdated') {
            const date = val?.toDate ? val.toDate() : (val ? new Date(val) : null);
            if (!date) return '--';
            return date.toLocaleDateString();
        }
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        if (field === 'expectedPrice' || field === 'price' || field === 'budgetRange') {
            const priceVal = val || (field === 'expectedPrice' ? lead.expectedPrice : lead.price);
            return priceVal ? `$${(priceVal / 1000).toFixed(0)}k` : '--';
        }
        if (Array.isArray(val)) return val.join(', ') || '--';
        return val || '--';
    };

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
                    0% { transform: scale(1) rotate(0deg); opacity: 1; top: var(--start-top); left: var(--start-left); }
                    30% { transform: scale(1.1) rotate(15deg); opacity: 1; }
                    100% { transform: scale(0.1) rotate(360deg); opacity: 0; top: 100vh; left: 50vw; }
                }
                .animate-fly-away {
                    position: fixed !important;
                    z-index: 9999 !important;
                    pointer-events: none;
                    animation: fly-to-trash 0.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
                }
                @keyframes fly-up-high {
                    0% { transform: scale(1) rotate(0deg); opacity: 1; top: var(--start-top); left: var(--start-left); }
                    100% { transform: scale(0.5) rotate(-15deg); opacity: 0; top: -200px; left: var(--start-left); }
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
                .animate-shake { animation: shake-only 0.5s ease-in-out; }
                @keyframes bin-shake {
                    0%, 100% { transform: scale(1); }
                    25% { transform: scale(1.1) rotate(-5deg); }
                    75% { transform: scale(1.1) rotate(5deg); }
                }
                .bin-active { animation: bin-shake 0.3s ease-in-out infinite; }
                @keyframes fire-flicker {
                    0%, 100% { transform: scale(1) rotate(-1deg); filter: drop-shadow(0 0 2px #ff4500); }
                    50% { transform: scale(1.1) rotate(1deg); filter: drop-shadow(0 0 5px #ff8c00); }
                }
                .animate-fire { animation: fire-flicker 0.4s ease-in-out infinite; }
                .urgent-glow {
                    box-shadow: 0 0 10px rgba(255, 69, 0, 0.4) !important;
                    border: 1px solid rgba(255, 69, 0, 0.3) !important;
                }
            `}} />

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="bg-white border-b border-slate-200/60 shadow-sm relative z-20">
                    <div className="p-6 pb-2 flex items-center justify-between">
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
                                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex items-center gap-6">
                                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Post it:</div>
                                        <div className="flex items-center gap-8">
                                            {noteTypes.map((note, index) => (
                                                <TypedDraggable key={note.id} draggableId={note.id} index={index}>
                                                    {(provided: any, snapshot: any) => (
                                                        <div className="relative group note-palette-item">
                                                            {!snapshot.isDragging && (
                                                                <>
                                                                    <div className={`absolute inset-0 -translate-x-1 translate-y-1 rounded-sm border border-black/10 opacity-60 ${note.color} ${note.shadow} -rotate-3 transition-transform group-hover:-translate-x-2 group-hover:translate-y-2`}></div>
                                                                    <div className={`absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-sm border border-black/5 opacity-40 ${note.color} ${note.shadow} rotate-2 transition-transform group-hover:translate-x-1 group-hover:translate-y-1`}></div>
                                                                </>
                                                            )}
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`w-16 h-16 rounded-sm border-t border-black/5 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all hover:-translate-y-1 hover:rotate-3 ${note.color} ${note.shadow} ${snapshot.isDragging ? 'z-[100] rotate-6 scale-110 shadow-2xl ring-2 ring-white/50' : 'relative z-10'}`}
                                                            >
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
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnSettings(!showColumnSettings)}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-500 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
                            >
                                <i className="fa-solid fa-gear text-[10px]"></i>
                                Configure Tabs
                            </button>
                            {showColumnSettings && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-3 z-50 flex flex-col gap-2">
                                    <div className="text-[10px] font-black uppercase text-slate-400 mb-1 px-1">Visible Tabs</div>
                                    {columns.map(col => (
                                        <label key={col.stage} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleStages.includes(col.stage) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                                {visibleStages.includes(col.stage) && <i className="fa-solid fa-check text-[10px] text-white"></i>}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={visibleStages.includes(col.stage)}
                                                onChange={() => {
                                                    if (visibleStages.includes(col.stage)) {
                                                        setVisibleStages(visibleStages.filter(s => s !== col.stage));
                                                    } else {
                                                        setVisibleStages([...visibleStages, col.stage]);
                                                    }
                                                }}
                                            />
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }}></div>
                                                <span className="text-xs font-bold text-slate-700">{col.label}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="px-8 flex gap-8 whitespace-nowrap overflow-x-auto no-scrollbar border-t border-slate-50">
                        {columns.filter(col => visibleStages.includes(col.stage)).map((col) => {
                            const count = leads.filter(l => l.funnelStage === col.stage && l.collectionName === (subTab === 'buying' ? 'buyers' : 'sellers')).length;
                            const isActive = activeTab === col.stage;
                            return (
                                <button
                                    key={col.stage}
                                    onClick={() => setActiveTab(col.stage)}
                                    className={`relative py-4 px-2 flex items-center gap-3 transition-all group ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <div className={`w-2 h-2 rounded-full transition-transform ${isActive ? 'scale-125' : 'scale-100'}`} style={{ backgroundColor: col.color }}></div>
                                    <div className="flex flex-col items-start">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? 'opacity-100' : 'opacity-60'}`}>{col.label}</span>
                                        <span className="text-[9px] font-bold opacity-40">{count} {count === 1 ? 'Client' : 'Clients'}</span>
                                    </div>
                                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full shadow-[0_-4px_10px_rgba(79,70,229,0.3)]"></div>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 bg-[#F8FAFC]">
                    {columns.filter(col => col.stage === activeTab).map((col) => (
                        <div key={col.stage} className="max-w-[1600px] mx-auto p-8 md:p-12 flex flex-col gap-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100" style={{ backgroundColor: `${col.color}20` }}>
                                        <i className={`fa-solid ${col.icon} text-xl`} style={{ color: col.color }}></i>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{subTab === 'buying' && col.stage === 'Active' ? 'Active Search' : col.label}</h2>
                                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest leading-none">
                                            {leads.filter(l => l.funnelStage === col.stage && l.collectionName === (subTab === 'buying' ? 'buyers' : 'sellers')).length} Clients in Pipeline
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowCardFieldSettings(showCardFieldSettings === col.stage ? null : col.stage)}
                                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${showCardFieldSettings === col.stage ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                                        >
                                            <i className="fa-solid fa-table-columns text-[10px]"></i> Columns
                                        </button>
                                        {showCardFieldSettings === col.stage && (
                                            <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 z-[100] flex flex-col gap-2">
                                                <div className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2 flex items-center justify-between">
                                                    <span>Visible Card Fields</span>
                                                    <button onClick={() => setShowCardFieldSettings(null)}><i className="fa-solid fa-xmark hover:text-rose-500 transition-colors"></i></button>
                                                </div>
                                                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-100">
                                                    {cardFields.map(field => (
                                                        <label key={field.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group px-4">
                                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${visibleColumnsPerStage[col.stage]?.has(field.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white group-hover:border-indigo-300'}`}>
                                                                {visibleColumnsPerStage[col.stage]?.has(field.id) && <i className="fa-solid fa-check text-[8px] text-white"></i>}
                                                            </div>
                                                            <input type="checkbox" className="hidden" checked={visibleColumnsPerStage[col.stage]?.has(field.id)} onChange={() => toggleCardField(col.stage, field.id)} />
                                                            <div className="flex items-center gap-2.5">
                                                                <i className={`fa-solid ${field.icon} text-[9px] ${visibleColumnsPerStage[col.stage]?.has(field.id) ? 'text-indigo-500' : 'text-slate-300'}`}></i>
                                                                <span className={`text-[10px] font-bold tracking-tight ${visibleColumnsPerStage[col.stage]?.has(field.id) ? 'text-slate-900' : 'text-slate-500'}`}>{field.label}</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleCreateLead({ funnelStage: col.stage as FunnelStage, leadType: subTab === 'buying' ? 'Buyer' : 'Seller', status: 'Active' })}
                                        className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all"
                                    >
                                        <i className="fa-solid fa-plus text-[10px]"></i> Add {subTab === 'buying' ? 'Buyer' : 'Seller'}
                                    </button>
                                </div>
                            </div>

                            <TypedDroppable droppableId={col.stage} type="LEAD" isCombineEnabled={true}>
                                {(provided: any, snapshot: any) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 min-h-[400px] p-2 transition-colors ${snapshot.isDraggingOver ? 'bg-indigo-50/30 rounded-[3rem] outline-2 outline-dashed outline-indigo-200' : ''}`}
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
                                                            className={`bg-white p-4 rounded-[2rem] border transition-all border-l-4 group relative cursor-pointer flex flex-col ${snapshot.isDragging
                                                                ? 'ring-4 ring-indigo-500/50 border-indigo-200 bg-indigo-50/30 shadow-2xl scale-[1.02] z-50'
                                                                : 'border-slate-200/60 shadow-sm hover:shadow-xl hover:scale-[1.01]'
                                                                }`}
                                                            style={{ ...provided.draggableProps.style, borderLeftColor: col.color }}
                                                            onDoubleClick={(e) => { e.stopPropagation(); setEditingLead(lead); }}
                                                        >
                                                            {lead.slaUrgency === 'high' && (
                                                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg animate-pulse z-30 ring-4 ring-white">
                                                                    <i className="fa-solid fa-fire text-sm"></i>
                                                                </div>
                                                            )}

                                                            <TypedDroppable droppableId={lead.id} type="POSTIT_PALETTE">
                                                                {(noteProvided: any, noteSnapshot: any) => (
                                                                    <div ref={noteProvided.innerRef} {...noteProvided.droppableProps} className={`flex-1 flex flex-col min-h-[130px] ${noteSnapshot.isDraggingOver ? 'bg-indigo-50/20' : ''}`}>
                                                                        <div className="flex items-start gap-4 mb-4">
                                                                            {visibleColumnsPerStage[col.stage]?.has('avatar') && (
                                                                                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex-shrink-0 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                                                                                    {lead.avatarUrl ? <img src={lead.avatarUrl} alt="" className="w-full h-full object-cover" /> : <div className="text-indigo-400/60 font-black text-sm uppercase">{lead.firstName?.charAt(0)}{lead.lastName?.charAt(0)}</div>}
                                                                                </div>
                                                                            )}
                                                                            <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                                                                                <div className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors tracking-tight truncate leading-tight mb-0.5">{lead.firstName} {lead.lastName}</div>
                                                                                <div className="flex flex-col gap-0.5 text-[12px] text-slate-400 font-bold whitespace-nowrap overflow-hidden">
                                                                                    {visibleColumnsPerStage[col.stage]?.has('email') && lead.email && (
                                                                                        <div className={`flex items-center gap-1.5 pr-2 min-w-0 ${(lead.preferredContactMethod || '').toLowerCase() === 'email' ? 'border border-indigo-500 rounded px-2 py-0.5 bg-indigo-50 -ml-2' : ''}`}>
                                                                                            <i className="fa-solid fa-envelope opacity-30 text-[8px] flex-shrink-0"></i><span className="truncate">{lead.email}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {visibleColumnsPerStage[col.stage]?.has('phone') && lead.phone && (
                                                                                        <div className={`flex items-center gap-1.5 pr-2 min-w-0 ${['text', 'call', 'sms'].includes((lead.preferredContactMethod || '').toLowerCase()) ? 'border border-indigo-500 rounded px-2 py-0.5 bg-indigo-50 -ml-2' : ''}`}>
                                                                                            <i className="fa-solid fa-phone opacity-30 text-[8px] flex-shrink-0"></i><span className="truncate">{lead.phone}</span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4">
                                                                            {Array.from(visibleColumnsPerStage[col.stage] || new Set()).filter(colId => !['phone', 'email', 'firstName', 'lastName', 'message', 'notes', 'avatar'].includes(colId as string)).map((colId: any) => {
                                                                                const fieldMeta = cardFields.find(f => f.id === colId);
                                                                                if (!fieldMeta) return null;
                                                                                return (
                                                                                    <div key={colId} className="grid grid-cols-[auto_1fr] gap-x-1.5 text-[14px] font-bold text-slate-900 leading-tight min-w-0 items-start">
                                                                                        <span className="text-slate-400 whitespace-nowrap flex items-center gap-1"><i className={`fa-solid ${fieldMeta.icon} text-[8px] opacity-40`}></i> {fieldMeta.label}:</span>
                                                                                        <span className="font-medium truncate">{renderValue(lead, colId)}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>

                                                                        {visibleColumnsPerStage[col.stage]?.has('message') && lead.message && (
                                                                            <div className="mt-2 bg-indigo-50/30 p-2.5 rounded-xl border border-indigo-100/50 flex flex-col gap-1 relative overflow-hidden">
                                                                                <div className="text-[14px] font-bold text-slate-400 tracking-wider flex items-center gap-1.5 opacity-60"><i className="fa-solid fa-comment-dots text-[8px] opacity-30"></i> Inquiry</div>
                                                                                <div className="text-[14px] text-indigo-600 font-bold leading-[1.3] italic line-clamp-2">"{lead.message}"</div>
                                                                            </div>
                                                                        )}

                                                                        <div className="flex flex-wrap gap-2 mt-4 relative min-h-[40px] flex-1 rounded-xl transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                            {notes.filter(n => n.leadId === lead.id && !n.isDone).map((note, i) => (
                                                                                <div
                                                                                    key={note.id}
                                                                                    onClick={() => { if (!editNoteId) { setEditNoteId(note.id); setEditContent(note.content); } }}
                                                                                    className={`p-2 pt-3 w-16 h-16 rounded-sm border-t border-black/5 text-[9px] font-bold post-it-font whitespace-normal shadow-md transition-all hover:scale-110 hover:z-10 group/note flex flex-col relative cursor-pointer post-it-container ${note.color || 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]'} ${i % 2 === 0 ? 'rotate-2' : '-rotate-2'} hover:rotate-0 ${deletingNoteId === note.id ? 'animate-fly-away' : ''} ${celebratingNoteId === note.id ? 'animate-shake' : ''} ${isFlyingUpId === note.id ? 'animate-fly-up' : ''}`}
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
                                                                                            value={editContent} onChange={(e) => setEditContent(e.target.value)}
                                                                                            onBlur={() => { if (editContent.trim() && editContent !== note.content) handleUpdateNote(note.id, { content: editContent }); setEditNoteId(null); }}
                                                                                        />
                                                                                    ) : (
                                                                                        <>
                                                                                            <div className="text-[7px] text-slate-800 line-clamp-4 leading-tight">{note.content}</div>
                                                                                            <div className="absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 transition-opacity flex gap-0.5 bg-white/40 rounded-full px-0.5 backdrop-blur-sm">
                                                                                                <button onClick={(e) => onDoneToggle(e, note)} className="text-slate-600 hover:text-emerald-600 transition-colors p-0.5"><i className="fa-solid fa-check text-[7px]"></i></button>
                                                                                                <button onClick={(e) => onDeleteClick(e, note.id)} className="text-slate-600 hover:text-red-500 transition-colors p-0.5"><i className="fa-solid fa-trash-can text-[7px]"></i></button>
                                                                                            </div>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                            {pendingNote?.leadId === lead.id && (
                                                                                <div className={`p-2 pt-3 w-16 h-16 rounded-sm border-t border-black/5 text-[9px] font-bold post-it-font flex flex-col relative animate-pulse opacity-50 ${pendingNote.color} shadow-lg`}>
                                                                                    <textarea
                                                                                        autoFocus placeholder="Type note..." className="w-full h-full bg-transparent border-none outline-none resize-none text-slate-800 placeholder-slate-400"
                                                                                        value={draftContent} onChange={(e) => setDraftContent(e.target.value)}
                                                                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draftContent.trim()) { handleSaveNote(draftContent); setDraftContent(''); } } }}
                                                                                        onBlur={() => { if (draftContent.trim()) { handleSaveNote(draftContent); setDraftContent(''); } setPendingNote(null); }}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                            {noteProvided.placeholder}
                                                                        </div>

                                                                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
                                                                            <div className="flex items-center gap-1.5">
                                                                                {lead.health === 'Active' && <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-100/50"><i className="fa-solid fa-bolt text-emerald-500 text-[9px]"></i></div>}
                                                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">{subTab === 'buying' ? 'Buyer' : 'Seller'}</div>
                                                                            </div>
                                                                            <button onClick={(e) => { e.stopPropagation(); setEditingLead(lead); }} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center border border-slate-100"><i className="fa-solid fa-pen-to-square text-[10px]"></i></button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </TypedDroppable>
                                                        </div>
                                                    )}
                                                </TypedDraggable>
                                            ))}
                                        {provided.placeholder}
                                        <button
                                            onClick={() => handleCreateLead({ funnelStage: col.stage as FunnelStage, leadType: subTab === 'buying' ? 'Buyer' : 'Seller', status: 'Active' })}
                                            className="h-full min-h-[300px] border-4 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center gap-4 text-slate-200 hover:border-indigo-200 hover:text-indigo-400 hover:bg-white transition-all group/ghost"
                                        >
                                            <div className="w-16 h-16 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-100 flex items-center justify-center group-hover/ghost:scale-110 group-hover/ghost:bg-indigo-50 group-hover/ghost:border-indigo-100 transition-all"><i className="fa-solid fa-plus text-xl"></i></div>
                                            <div className="text-center"><div className="font-black uppercase tracking-widest text-xs">Add New Client</div><div className="text-[10px] font-bold opacity-60">to {col.label}</div></div>
                                        </button>
                                    </div>
                                )}
                            </TypedDroppable>
                        </div>
                    ))}
                </div>
            </DragDropContext>
            {deletingNoteId && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10000] flex flex-col items-center gap-2 pointer-events-none">
                    <div className="w-16 h-16 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-2xl bin-active"><i className="fa-solid fa-trash-can text-2xl"></i></div>
                    <span className="text-rose-600 font-bold text-xs uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm">Discarding...</span>
                </div>
            )}
        </div>
    );
};

export default PipelineBoard;
