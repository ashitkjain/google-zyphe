import React, { useState, useEffect, useRef } from 'react';
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
}

const PALETTE_COLORS: { id: StickyNoteColor; label: string; color: string; border: string }[] = [
    { id: 'yellow', label: 'Yellow', color: 'bg-[#ffff88]', border: 'border-[#eeee77]' },
    { id: 'blue', label: 'Blue', color: 'bg-[#7afaff]', border: 'border-[#69e9ee]' },
    { id: 'rose', label: 'Red', color: 'bg-[#ff7e7e]', border: 'border-[#ee6d6d]' },
    { id: 'emerald', label: 'Green', color: 'bg-[#a7ffeb]', border: 'border-[#96eee0]' },
];

export const StickyNotesLayer: React.FC<Props> = ({ zpid, activeTab, children }) => {
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

            {/* Quick Note Palette */}
            <div className="absolute top-0 right-0 z-[101] p-3 pointer-events-auto">
                <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md p-2.5 rounded-2xl border border-slate-200 shadow-xl animate-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col pl-2 border-l-4 border-amber-400">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 leading-tight">Quick Note</span>
                        <span className="text-[9px] font-bold text-slate-400 leading-tight">Drag to tab</span>
                    </div>
                    <div className="flex items-center gap-3 pr-2">
                        {PALETTE_COLORS.map((note) => (
                            <div key={note.id} className="relative group/palette-item">
                                <div className={`absolute inset-0 -translate-x-1 translate-y-1 rounded-sm border border-black/10 opacity-40 ${note.color} -rotate-3 transition-transform group-hover/palette-item:-translate-x-2 group-hover/palette-item:translate-y-2`}></div>
                                <div className={`absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-sm border border-black/5 opacity-20 ${note.color} rotate-2 transition-transform group-hover/palette-item:translate-x-1 group-hover/palette-item:translate-y-1`}></div>
                                <div
                                    onMouseDown={(e) => handlePaletteDragStart(e, note.id)}
                                    onTouchStart={(e) => handlePaletteDragStart(e, note.id)}
                                    onDragStart={(e) => e.preventDefault()}
                                    className={`w-12 h-12 rounded-[1px] border-t border-black/5 ${note.color} border-black/10 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all hover:-translate-y-1 hover:rotate-3 shadow-[5px_5px_7px_rgba(33,33,33,.1)] relative z-10`}
                                >
                                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-5 border-2 border-slate-400/60 rounded-full bg-slate-200/40 z-20 shadow-sm opacity-80">
                                        <div className="absolute inset-1 border-l border-slate-500/30 rounded-full"></div>
                                    </div>
                                    <i className="fa-solid fa-note-sticky opacity-20 text-[14px]"></i>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

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
                            className={`absolute w-24 h-24 p-2.5 pt-4 rounded-sm border-t border-black/5 shadow-2xl transition-all z-[200] flex flex-col pointer-events-auto rotate-1 scale-105 post-it-font
                                ${pendingNote.color === 'yellow' ? 'bg-[#ffff88] text-slate-800' :
                                    pendingNote.color === 'blue' ? 'bg-[#7afaff] text-slate-800' :
                                        pendingNote.color === 'rose' ? 'bg-[#ff7e7e] text-white' :
                                            'bg-[#a7ffeb] text-slate-800'}`}
                            style={{ left: pendingNote.location.x, top: pendingNote.location.y, fontFamily: "'Architects Daughter', cursive" }}
                        >
                            <div className="flex justify-between items-start mb-1 absolute top-1 left-2 right-1">
                                <span className="text-[6px] font-black uppercase tracking-widest opacity-40">Draft</span>
                            </div>
                            <textarea
                                autoFocus
                                className="w-full h-full bg-transparent border-none focus:ring-0 text-[12px] font-bold p-0 resize-none leading-tight placeholder:italic placeholder:opacity-40 post-it-font"
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
                        left: dragPos.x - 40,
                        top: dragPos.y - 40,
                        width: '80px',
                        height: '80px'
                    }}
                >
                    <div className={`w-full h-full rounded-sm border-t shadow-2xl ${PALETTE_COLORS.find(c => c.id === draggingFromPalette)?.color} border-black/10`}>
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-7 border-2 border-slate-400/80 rounded-full bg-slate-200/50 z-20 shadow-sm"></div>
                    </div>
                </div>
            )}
        </div>
    );
};
