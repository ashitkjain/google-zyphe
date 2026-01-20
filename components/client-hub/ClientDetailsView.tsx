import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, Lead } from '../../types';

const formatDate = (date: any) => {
    if (!date) return '---';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

interface ClientDetailsViewProps {
    clients: UserProfile[];
    leads: Lead[];
    onUpdateClient: (id: string, updates: any, collectionName: string) => Promise<boolean>;
    loading?: boolean;
}

const ClientDetailsView: React.FC<ClientDetailsViewProps> = ({ clients, leads, onUpdateClient, loading }) => {
    // Combine both into a unified list
    const allClients = [
        ...clients.map(c => ({ ...c, isUser: true, id: c.uid })),
        ...leads.map(l => ({ ...l, isUser: false }))
    ].sort((a, b) => {
        const dateA = a.isUser ? (a.createdAt || 0) : (a.receivedAt || 0);
        const dateB = b.isUser ? (b.createdAt || 0) : (b.receivedAt || 0);
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    const [activeListTab, setActiveListTab] = useState<'Buyers' | 'Sellers'>('Buyers');
    const [selectedId, setSelectedId] = useState<string | null>(allClients.length > 0 ? allClients[0].id : null);

    const filteredClients = allClients.filter(c => {
        const type = (c as any).leadType || 'Buyer';
        return type === (activeListTab === 'Buyers' ? 'Buyer' : 'Seller');
    });

    const selectedClient = allClients.find(c => c.id === selectedId) || filteredClients[0] || allClients[0];

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

    // Sticky Notes Logic
    const [stuckNotes, setStuckNotes] = useState<Record<string, any[]>>({});
    const [realtorNotes, setRealtorNotes] = useState<Record<string, any[]>>({});
    const [draggingNote, setDraggingNote] = useState<{ x: number, y: number } | null>(null);
    const [movingNoteIndex, setMovingNoteIndex] = useState<number | null>(null);
    const snapshotRef = useRef<HTMLDivElement>(null);

    // Sync with selected client when it changes
    useEffect(() => {
        if (selectedClient) {
            setStuckNotes(prev => ({ ...prev, [selectedClient.id]: (selectedClient as any).stickyNotes || [] }));
            setRealtorNotes(prev => ({ ...prev, [selectedClient.id]: (selectedClient as any).realtorNotes || [] }));
        }
    }, [selectedClient?.id]);

    const persistChanges = async (cliendId: string, updates: { stickyNotes?: any[], realtorNotes?: any[] }) => {
        const client = allClients.find(c => c.id === cliendId);
        if (!client) return;

        const collectionName = client.isUser ? 'users' : (client as any).collectionName || 'leads';
        await onUpdateClient(cliendId, updates, collectionName);
    };

    const addRealtorNote = async (clientId: string, text: string) => {
        if (!text.trim()) return;
        const history = realtorNotes[clientId] || [];
        if (history[0]?.text === text) {
            await persistChanges(clientId, { stickyNotes: stuckNotes[clientId] });
            return;
        }
        const updatedHistory = [{ date: new Date(), text, color: 'yellow' }, ...history];
        setRealtorNotes(prev => ({ ...prev, [clientId]: updatedHistory }));
        await persistChanges(clientId, { realtorNotes: updatedHistory, stickyNotes: stuckNotes[clientId] });
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
        const updatedNotes = (stuckNotes[selectedId] || []).filter((_, i) => i !== index);
        setStuckNotes(prev => ({
            ...prev,
            [selectedId]: updatedNotes
        }));
        await persistChanges(selectedId, { stickyNotes: updatedNotes });
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

                setStuckNotes(prev => {
                    const notes = [...(prev[selectedId] || [])];
                    if (notes[movingNoteIndex]) {
                        notes[movingNoteIndex] = { ...notes[movingNoteIndex], x, y };
                    }
                    return { ...prev, [selectedId]: notes };
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

                    const newNotes = [...(stuckNotes[selectedId] || []), { x, y, rotation, content: '', createdAt: new Date() }];
                    setStuckNotes(prev => ({
                        ...prev,
                        [selectedId]: newNotes
                    }));
                    persistChanges(selectedId, { stickyNotes: newNotes });
                }
                setDraggingNote(null);
            }
            if (movingNoteIndex !== null && selectedId) {
                persistChanges(selectedId, { stickyNotes: stuckNotes[selectedId] });
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
        <div className="flex-1 flex overflow-hidden bg-slate-50">
            {/* Left Column: Client List */}
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Clients</h2>
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{filteredClients.length} {activeListTab} Found</p>
                        </div>
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
                <div className="flex-1 overflow-y-auto">
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
                                <div className="text-[10px] font-medium text-slate-400 truncate">{getEmail(client)}</div>
                            </div>
                            {client.isUser && (
                                <div className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded">App</div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Column: Details */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {selectedClient ? (
                    <>
                        {/* Header */}
                        <div className="p-10 bg-white border-b border-slate-200">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-6">
                                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl text-white font-black shadow-xl overflow-hidden ${selectedClient.isUser ? 'bg-emerald-500 shadow-emerald-200' : 'bg-indigo-500 shadow-indigo-200'}`}>
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
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-4">
                                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{getName(selectedClient)}</h1>
                                            <div className="flex items-center gap-3">

                                                <div className="flex items-center">
                                                    {selectedClient.engagementScore === 'Hot' && (
                                                        <div className="w-10 h-10 relative animate-flame">
                                                            <svg viewBox="0 0 100 100" className="w-full h-full filter drop-shadow-sm">
                                                                <path d="M50 95C30 95 15 75 15 50C15 35 25 20 45 5C45 15 50 25 55 35C65 25 75 35 85 50C85 75 70 95 50 95Z" fill="#ff4d00" />
                                                                <path d="M50 90C35 90 25 75 25 55C25 45 30 35 45 25C45 35 50 45 55 50C62 40 70 45 75 55C75 75 65 90 50 90Z" fill="#ff9900" />
                                                                <path d="M50 85C42 85 35 75 35 60C35 50 40 45 45 40C48 50 50 55 55 60C58 55 62 55 65 60C65 75 58 85 50 85Z" fill="#ffcc00" />
                                                            </svg>
                                                            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-orange-500/20 blur-lg rounded-full -z-10 animate-pulse"></div>
                                                        </div>
                                                    )}
                                                    {selectedClient.engagementScore === 'Warm' && <i className="fa-solid fa-mug-hot text-amber-500 text-2xl filter drop-shadow-sm"></i>}
                                                    {selectedClient.engagementScore === 'Cold' && <i className="fa-solid fa-snowflake text-sky-400 text-2xl filter drop-shadow-sm"></i>}
                                                    {selectedClient.engagementScore === 'Stale' && <img src="/assets/stale-icon.png" alt="Stale" className="w-7 h-7 object-contain opacity-60 grayscale filter drop-shadow-sm" />}
                                                </div>
                                            </div>

                                            {/* Post-it Stack */}
                                            <div className="relative ml-6 flex flex-col items-center">
                                                <div
                                                    onMouseDown={handleMouseDownOnStack}
                                                    className="group cursor-grab active:cursor-grabbing relative w-14 h-14 select-none mb-1"
                                                >
                                                    {/* Stack Visual */}
                                                    <div className="absolute inset-0 bg-yellow-100 border border-yellow-200 shadow-sm rotate-6 rounded-md translate-x-1 translate-y-1"></div>
                                                    <div className="absolute inset-0 bg-yellow-50 border border-yellow-200 shadow-sm -rotate-3 rounded-md"></div>
                                                    <div className="absolute inset-0 bg-yellow-200 border border-yellow-300 shadow-md group-hover:scale-110 group-hover:-rotate-6 transition-all rounded-md flex items-center justify-center">
                                                        <i className="fa-solid fa-plus text-yellow-600 text-lg"></i>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <i className="fa-solid fa-circle-info text-slate-400 text-[10px]"></i>
                                                    <div className="text-[10px] text-slate-900 font-bold text-center w-28 leading-tight">
                                                        Drag to snapshot to add comments
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {/* Email Row */}
                                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                <i className="fa-solid fa-envelope text-slate-300 w-5 text-center"></i>
                                                <span className="text-sm font-semibold">{getEmail(selectedClient)}</span>
                                                {(() => {
                                                    const preferredMethod = (selectedClient as any).primaryContactInfo?.preferredMethod || (selectedClient as any).preferredContactMethod;
                                                    return preferredMethod === 'Email' && (
                                                        <i className="fa-solid fa-star text-yellow-500 text-[10px] ml-1"></i>
                                                    );
                                                })()}
                                            </div>

                                            {/* Phone Row */}
                                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                <i className="fa-solid fa-phone text-slate-300 w-5 text-center"></i>
                                                <span className="text-sm font-semibold">{getPhone(selectedClient) || 'No phone listed'}</span>
                                                {(() => {
                                                    const preferredMethod = (selectedClient as any).primaryContactInfo?.preferredMethod || (selectedClient as any).preferredContactMethod;
                                                    const isPhoneRelated = ['Phone', 'SMS', 'WhatsApp'].includes(preferredMethod);
                                                    if (!isPhoneRelated) return null;

                                                    return (
                                                        <div className="flex items-center gap-2 ml-1">
                                                            <i className="fa-solid fa-star text-yellow-500 text-[10px]"></i>
                                                            {preferredMethod === 'SMS' && <img src="/sms-icon.png" alt="SMS" className="w-4 h-4 object-contain" />}
                                                            {preferredMethod === 'WhatsApp' && <img src="/whatsapp-icon.png" alt="WhatsApp" className="w-4 h-4 object-contain" />}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button className="px-6 py-2.5 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
                                        Send Message
                                    </button>
                                    <button className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all active:scale-95">
                                        Edit Profile
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
                            {/* Funnel Stage Timeline */}
                            <div className="bg-white rounded-[2rem] py-5 px-8 border border-slate-100 shadow-sm relative overflow-hidden group">
                                {/* Decorative Gradient Background */}
                                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/30 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none group-hover:bg-indigo-100/40 transition-colors duration-1000"></div>

                                <div className="relative pt-6 pb-2">
                                    {/* Progress Track Background */}
                                    <div className="absolute top-[44px] left-2 right-2 h-1 bg-slate-100 rounded-full overflow-hidden">
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
                                                <div key={idx} className="flex flex-col items-center relative z-10 group/milestone min-w-[70px]">
                                                    {/* Entered At Date */}
                                                    {entryDate && (
                                                        <div className="absolute -top-6 text-[8px] font-black text-slate-900 uppercase tracking-widest whitespace-nowrap z-20 animate-in fade-in slide-in-from-bottom-1 duration-500">
                                                            {formatDate(entryDate)}
                                                        </div>
                                                    )}

                                                    {/* The Milestone Circle */}
                                                    <div className={`
                                                        w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 border-2
                                                        ${isCompleted ? 'bg-indigo-600 border-white shadow-lg shadow-indigo-100 scale-90' : ''}
                                                        ${isCurrent ? 'bg-white border-indigo-600 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50 scale-110' : ''}
                                                        ${isPending ? 'bg-white border-slate-50 text-slate-300 shadow-sm' : ''}
                                                    `}>
                                                        <i className={`
                                                            fa-solid ${stage.icon} text-sm transition-colors duration-500
                                                            ${isCompleted ? 'text-white' : ''}
                                                            ${isCurrent ? 'text-indigo-600' : ''}
                                                            ${isPending ? 'text-slate-200' : ''}
                                                        `}></i>
                                                    </div>

                                                    {/* Label */}
                                                    <div className="mt-2.5 text-center">
                                                        <p className={`
                                                            text-[9px] font-black uppercase tracking-widest transition-colors duration-500 whitespace-nowrap
                                                            ${isCurrent ? 'text-indigo-600' : 'text-slate-400'}
                                                            ${isCompleted ? 'text-slate-800' : ''}
                                                        `}>
                                                            {stage.label}
                                                        </p>
                                                        {isCurrent && (selectedClient as any).status && (
                                                            <div className="mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest rounded-md animate-in fade-in zoom-in-95 duration-500">
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
                                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative min-h-[500px]"
                            >
                                {/* Stuck Notes */}
                                {stuckNotes[selectedId || '']?.map((note, idx) => (
                                    <div
                                        key={idx}
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
                                                    const newNotes = [...stuckNotes[selectedId || '']];
                                                    newNotes[idx].content = e.target.value;
                                                    setStuckNotes(prev => ({ ...prev, [selectedId || '']: newNotes }));
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
                                                {note.createdAt ? formatDate(note.createdAt) : formatDate(new Date())}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-50">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                        <i className="fa-solid fa-bolt text-sm"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900">Client Snapshot</h3>
                                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">who the person is, what they want</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-4">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Window</div>
                                        <div className="text-base font-medium text-slate-800 tracking-tight">{(selectedClient as any).targetTimeline || '---'}</div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Persona</div>
                                        <div className="text-base font-medium text-slate-800 tracking-tight">{(selectedClient as any).personaProfile || '---'}</div>
                                    </div>

                                    <div className="space-y-1 text-left">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivation</div>
                                        <div className="text-base font-medium text-slate-800 tracking-tight">{(selectedClient as any).motivation || '---'}</div>
                                    </div>

                                    <div className="space-y-1 text-left">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source</div>
                                        <div className="text-base font-medium text-slate-800 tracking-tight">{(selectedClient as any).source || (selectedClient as any).leadInfo?.origin || 'Direct'}</div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inquiry Property</div>
                                        <div className="text-base font-medium text-slate-800 truncate">{(selectedClient as any).leadInfo?.inquiryProperty?.address || (selectedClient as any).subjectProperty || '---'}</div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buying Power</div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-base font-medium text-emerald-600">
                                                {(selectedClient as any).financialVitals?.budgetMax
                                                    ? `$${((selectedClient as any).financialVitals.budgetMax).toLocaleString()}`
                                                    : (selectedClient as any).maxPrice
                                                        ? `$${((selectedClient as any).maxPrice).toLocaleString()}`
                                                        : '---'}
                                            </div>
                                            {(selectedClient as any).financialVitals?.preApprovalStatus && (
                                                <div className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded">Pre-Approved</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget Range</div>
                                        <div className="text-base font-medium text-slate-800 tracking-tight">{(selectedClient as any).leadInfo?.budgetRange || '---'}</div>
                                    </div>

                                    <div className="space-y-1 md:col-span-1 lg:col-span-3">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hard Requirements</div>
                                        <div className="text-base font-medium text-slate-800 leading-tight">{(selectedClient as any).searchCriteria?.mustHaves || 'No specific requirements listed.'}</div>
                                    </div>

                                    <div className="space-y-1 md:col-span-1 lg:col-span-2">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Message</div>
                                        <div className="text-base font-medium text-slate-800 leading-tight">{(selectedClient as any).leadInfo?.customerMessage || 'No inquiry message provided.'}</div>
                                    </div>
                                </div>

                                {/* Communication History Table (Moved outside snapshotRef container to stabilize coordinates) */}
                                <div className="mt-8 pt-6 border-t border-slate-200">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shadow-inner border border-slate-100">
                                            <i className="fa-solid fa-comments text-xs"></i>
                                        </div>
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Communication History</h4>
                                    </div>

                                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/60">
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100/50 last:border-0">Date</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100/50 last:border-0">Channel</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100/50 last:border-0">Summary</th>
                                                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {[
                                                    { date: new Date(), channel: 'SMS', summary: 'Sent follow-up regarding property tour.', status: 'Sent' },
                                                    { date: new Date(Date.now() - 86400000), channel: 'Email', summary: 'Sent mortgage pre-approval checklist.', status: 'Delivered' },
                                                ].map((msg, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                                                        <td className="px-4 py-3 text-xs font-medium text-slate-500 font-mono italic">{formatDate(msg.date)}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <i className={`fa-solid ${msg.channel === 'SMS' ? 'fa-message-sms text-indigo-500' : 'fa-envelope text-emerald-500'} text-[10px]`}></i>
                                                                <span className="text-xs font-medium text-slate-900 uppercase tracking-tighter">{msg.channel}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs font-medium text-slate-600 truncate max-w-xs">{msg.summary}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className="px-2 py-1 bg-slate-100/80 text-slate-600 text-[8px] font-black uppercase rounded-md shadow-sm">
                                                                {msg.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50">
                        <i className="fa-solid fa-users text-6xl text-slate-200 mb-4"></i>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Select a client to view details</p>
                    </div>
                )}
            </div>

            {/* Global Dragging Note Portal */}
            {draggingNote && (
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
            )}
        </div>
    );
};

export default ClientDetailsView;
