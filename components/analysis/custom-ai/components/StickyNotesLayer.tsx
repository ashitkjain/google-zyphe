import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UserPropertyComment, StickyNoteColor } from '../../../../types';
import { getStickyNotes, saveStickyNote, updateStickyNote, deleteStickyNote } from '../../../../services/firebase/stickyNotes';
import { auth } from '../../../../services/firebase/config';
import { StickyNote } from './StickyNote';
import { trackClarityEvent } from '../../../../services/analytics/clarity';
import { trackEvent as trackPH } from '../../../../services/analytics/posthog';

interface Props {
    zpid: string;
    activeTab: string;
    children: React.ReactNode;
    paletteSlotRef?: React.RefObject<HTMLDivElement>;
}

const PALETTE_COLORS: { id: StickyNoteColor; label: string; color: string; border: string }[] = [
    { id: 'yellow', label: 'Yellow', color: 'bg-[#ffff88]', border: 'border-[#eeee77]' },
    { id: 'blue', label: 'Blue', color: 'bg-[#7afaff]', border: 'border-[#69e9ee]' },
    { id: 'rose', label: 'Red', color: 'bg-[#ff7e7e]', border: 'border-[#ee6d6d]' },
    { id: 'emerald', label: 'Green', color: 'bg-[#a7ffeb]', border: 'border-[#96eee0]' },
];

export const StickyNotesLayer: React.FC<Props> = ({ zpid, activeTab, children, paletteSlotRef }) => {
    const user = auth?.currentUser;
    const [notes, setNotes] = useState<UserPropertyComment[]>([]);
    const [draggingFromPalette, setDraggingFromPalette] = useState<StickyNoteColor | null>(null);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const [pendingNote, setPendingNote] = useState<{ color: StickyNoteColor, location: { x: number, y: number } } | null>(null);
    const [draftContent, setDraftContent] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const loadNotes = async () => {
        if (!user || !zpid) return;
        const fetched = await getStickyNotes(zpid, user.uid, activeTab);
        setNotes(fetched);
    };

    useEffect(() => {
        loadNotes();
    }, [zpid, user?.uid, activeTab]);

    const handlePaletteDragStart = (e: React.MouseEvent | React.TouchEvent, color: StickyNoteColor) => {
        if ('button' in e && e.button !== 0) return;
        if (e.cancelable) e.preventDefault();

        setDraggingFromPalette(color);
        trackClarityEvent('Note_Palette_Drag_Start');
        trackPH('Note_Palette_Drag_Start', { color });
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setDragPos({ x: clientX, y: clientY });

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!draggingFromPalette) return;
            const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
            setDragPos({ x: clientX, y: clientY });
        };

        const handleMouseUp = async (e: MouseEvent | TouchEvent) => {
            if (!draggingFromPalette) return;

            document.body.style.userSelect = '';
            document.body.style.cursor = '';

            const clientX = 'touches' in e ? (e as TouchEvent).changedTouches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).changedTouches[0].clientY : (e as MouseEvent).clientY;

            if (user && zpid && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const slop = 60;

                if (clientX >= rect.left - slop && clientX <= rect.right + slop &&
                    clientY >= rect.top - slop && clientY <= rect.bottom + slop) {

                    const x = Math.max(0, Math.min(clientX - rect.left - 48, rect.width - 96));
                    const y = Math.max(0, Math.min(clientY - rect.top - 16, rect.height - 96));

                    setPendingNote({ color: draggingFromPalette, location: { x, y } });
                    setDraftContent('');
                    trackClarityEvent('Note_Dropped_On_Canvas');
                    trackPH('Note_Dropped_On_Canvas', { color: draggingFromPalette });
                }
            }

            setDraggingFromPalette(null);
        };

        if (draggingFromPalette) {
            window.addEventListener('mousemove', handleMouseMove, { passive: false });
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleMouseMove, { passive: false });
            window.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [draggingFromPalette, user, zpid, activeTab]);

    const handleSavePending = async () => {
        if (!pendingNote || !user || !zpid) {
            setPendingNote(null);
            setDraftContent('');
            return;
        }

        const content = draftContent.trim();
        const ctx = { ...pendingNote };

        setPendingNote(null);
        setDraftContent('');

        if (content) {
            const newNoteData = {
                userId: user.uid,
                zpid: String(zpid),
                tab: activeTab,
                comment: content,
                color: ctx.color,
                location: ctx.location
            };

            const tempId = 'temp-' + Date.now();
            const optimisticNote: any = {
                ...newNoteData,
                id: tempId,
                createdAt: { seconds: Math.floor(Date.now() / 1000) },
                lastUpdated: { seconds: Math.floor(Date.now() / 1000) }
            };
            setNotes(prev => [...prev, optimisticNote]);
            trackClarityEvent('Note_Created');
            trackPH('Note_Created', { color: ctx.color, tab: activeTab });

            try {
                const id = await saveStickyNote(newNoteData);
                if (id) {
                    setNotes(prev => prev.map(n => n.id === tempId ? { ...n, id } : n));
                } else {
                    setNotes(prev => prev.filter(n => n.id !== tempId));
                    loadNotes(); // fallback to real state
                }
            } catch (err) {
                setNotes(prev => prev.filter(n => n.id !== tempId));
                loadNotes();
            }
        }
    };

    const handleUpdate = async (id: string, updates: Partial<UserPropertyComment>) => {
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
        const success = await updateStickyNote(id, updates);
        if (!success) loadNotes();
    };

    const handleDelete = async (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        const success = await deleteStickyNote(id);
        if (!success) loadNotes();
    };

    return (
        <div className="relative group/layer min-h-full">
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                .post-it-font {
                    font-family: 'Architects Daughter', cursive;
                    line-height: 1.2;
                }
            `}} />

            {/* Quick Note Palette — renders inline or fixed depending on paletteSlotRef */}
            {(() => {
                const paletteContent = (
                    <div className={paletteSlotRef?.current ? 'flex items-center gap-2.5' : 'flex flex-col items-center gap-3 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-2xl'}>
                        <div className={paletteSlotRef?.current ? 'flex flex-col items-center gap-0 mr-0.5' : 'flex flex-col items-center gap-0.5'}>
                            <span className={`font-black uppercase tracking-[0.2em] text-amber-600 leading-tight ${paletteSlotRef?.current ? 'text-[8px]' : 'text-[10px]'}`}>Quick Note</span>
                            <span className={`font-semibold text-slate-400 leading-tight ${paletteSlotRef?.current ? 'text-[7px]' : 'text-[8px]'}`}>Drag to page</span>
                        </div>
                        <div className={paletteSlotRef?.current ? 'flex items-center gap-1.5' : 'grid grid-cols-2 gap-3'}>
                            {PALETTE_COLORS.map((note, idx) => {
                                const rotations = ['-rotate-2', 'rotate-1', 'rotate-2', '-rotate-1'];
                                const size = paletteSlotRef?.current ? 'w-8 h-8' : 'w-14 h-14';
                                return (
                                <div key={note.id} className="relative group/palette-item">
                                    <div className={`absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-sm ${note.color} opacity-30 blur-[1px] ${rotations[idx]}`}></div>
                                    <div
                                        onMouseDown={(e) => handlePaletteDragStart(e, note.id)}
                                        onTouchStart={(e) => handlePaletteDragStart(e, note.id)}
                                        onDragStart={(e) => e.preventDefault()}
                                        className={`${size} rounded-[2px] ${note.color} cursor-grab active:cursor-grabbing flex items-center justify-center transition-all duration-200 hover:-translate-y-1 hover:rotate-3 hover:shadow-xl shadow-[2px_2px_6px_rgba(33,33,33,.15)] relative z-10 ${rotations[idx]}`}
                                    >
                                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-gradient-to-tl from-black/[0.07] to-transparent"></div>
                                        {!paletteSlotRef?.current && (
                                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-5 border-2 border-slate-400/50 rounded-full bg-slate-200/30 z-20 shadow-sm">
                                                <div className="absolute inset-0.5 border-l border-slate-500/20 rounded-full"></div>
                                            </div>
                                        )}
                                        <i className={`fa-solid fa-pen-fancy opacity-15 ${paletteSlotRef?.current ? 'text-[9px]' : 'text-[13px]'}`}></i>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                );

                if (paletteSlotRef?.current) {
                    return createPortal(paletteContent, paletteSlotRef.current);
                }

                return (
                    <div className="fixed z-[101] animate-in slide-in-from-right-4 duration-500" style={{ right: 'calc((100vw - 72rem) / 4)', top: '28%' }}>
                        {paletteContent}
                    </div>
                );
            })()}

            <div
                ref={containerRef}
                className="relative min-h-[500px]"
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setPendingNote(null);
                }}
            >
                {children}

                {/* Notes Canvas */}
                <div className="absolute inset-0 pointer-events-none z-[100]">
                    {notes.map(note => (
                        <div key={note.id} className="pointer-events-auto">
                            <StickyNote
                                note={note}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                                containerRef={containerRef}
                            />
                        </div>
                    ))}

                    {/* Pending Drop Note (Draft mode) */}
                    {pendingNote && (
                        <div
                            className={`absolute w-36 h-36 p-3 pt-6 rounded-[2px] shadow-2xl transition-all z-[200] flex flex-col pointer-events-auto rotate-1 scale-105 post-it-font
                                ${pendingNote.color === 'yellow' ? 'bg-[#ffff88] text-slate-800' :
                                    pendingNote.color === 'blue' ? 'bg-[#7afaff] text-slate-800' :
                                        pendingNote.color === 'rose' ? 'bg-[#ff7e7e] text-white' :
                                            'bg-[#a7ffeb] text-slate-800'}`}
                            style={{ left: pendingNote.location.x, top: pendingNote.location.y, fontFamily: "'Architects Daughter', cursive" }}
                        >
                            <div className="absolute bottom-0 right-0 w-5 h-5 bg-gradient-to-tl from-black/[0.06] to-transparent"></div>
                            <div className="flex justify-between items-start mb-1 absolute top-1.5 left-3 right-1.5">
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Draft</span>
                            </div>
                            <textarea
                                autoFocus
                                className="w-full h-full bg-transparent border-none focus:ring-0 text-sm font-bold p-0 resize-none leading-snug placeholder:italic placeholder:opacity-40 post-it-font"
                                placeholder="..."
                                value={draftContent}
                                onChange={(e) => setDraftContent(e.target.value)}
                                onBlur={handleSavePending}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSavePending();
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Ghost Note during dragging */}
            {draggingFromPalette && (
                <div
                    className="fixed pointer-events-none z-[500] rotate-6 scale-110 opacity-70"
                    style={{
                        left: dragPos.x - 56,
                        top: dragPos.y - 56,
                        width: '112px',
                        height: '112px'
                    }}
                >
                    <div className={`w-full h-full rounded-[2px] shadow-2xl ${PALETTE_COLORS.find(c => c.id === draggingFromPalette)?.color}`}>
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-gradient-to-tl from-black/[0.06] to-transparent"></div>
                    </div>
                </div>
            )}
        </div>
    );
};
