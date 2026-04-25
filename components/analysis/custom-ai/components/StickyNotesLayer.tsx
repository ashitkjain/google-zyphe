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
    children: (renderPalette: () => React.ReactNode) => React.ReactNode;
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
        setNotes([]);        // Clear previous tab's notes immediately
        setPendingNote(null); // Cancel any in-progress draft
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
            
            // Prevent scrolling on mobile during drag
            if ('touches' in e && e.cancelable) {
                e.preventDefault();
            }

            const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
            
            // Use requestAnimationFrame for smoother updates
            window.requestAnimationFrame(() => {
                setDragPos({ x: clientX, y: clientY });
            });
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

                    // Center the note on the drop location (note is 192px/192px => offset by 96px)
                    const x = Math.max(0, Math.min(clientX - rect.left - 96, rect.width - 192));
                    const y = Math.max(0, Math.min(clientY - rect.top - 96, rect.height - 192));

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
        const success = await updateStickyNote(id, { ...updates, userId: user?.uid });
        if (!success) loadNotes();
    };

    const handleDelete = async (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        const success = await deleteStickyNote(id, user?.uid);
        if (!success) loadNotes();
    };

    const palette = () => (
        <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 tracking-wide">drag to add a note</span>
            <div className="relative group/palette-item">
                {/* Stack shadows */}
                <div className="absolute inset-0 translate-x-[4px] translate-y-[4px] rounded-[2px] bg-[#e8e04a]/50 blur-[1px]"></div>
                <div className="absolute inset-0 translate-x-[2px] translate-y-[2px] rounded-[2px] bg-[#f5ef6a]/70"></div>
                <div
                    onMouseDown={(e) => handlePaletteDragStart(e, 'yellow')}
                    onTouchStart={(e) => handlePaletteDragStart(e, 'yellow')}
                    onDragStart={(e) => e.preventDefault()}
                    title="Drag to add a note"
                    className="relative z-10 w-14 h-14 rounded-[2px] bg-[#fef08a] cursor-grab active:cursor-grabbing flex flex-col justify-between p-1.5 transition-all duration-200 hover:-translate-y-1 hover:rotate-2 shadow-lg"
                    style={{ boxShadow: '2px 3px 8px rgba(0,0,0,0.18)' }}
                >
                    {/* Tape strip at top */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3.5 bg-yellow-100/80 rounded-sm border border-yellow-200/60" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }} />
                    {/* Ruled lines */}
                    <div className="flex flex-col gap-[5px] mt-2 px-0.5">
                        <div className="h-[1px] bg-amber-300/50 rounded-full" />
                        <div className="h-[1px] bg-amber-300/50 rounded-full" />
                        <div className="h-[1px] bg-amber-300/50 rounded-full" />
                    </div>
                    <i className="fa-solid fa-plus text-[11px] text-amber-600/50 self-center mb-0.5" />
                </div>
            </div>
        </div>
    );

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

            <div
                ref={containerRef}
                className="relative min-h-[500px]"
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setPendingNote(null);
                }}
            >
                {children(palette)}

                {/* Notes Canvas */}
                <div className="absolute inset-0 pointer-events-none z-[100]">
                    {notes.filter(n => n.tab === activeTab).map(note => (
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
                            className={`absolute w-48 h-48 p-4 pt-8 rounded-[1px] shadow-2xl transition-all z-[200] flex flex-col pointer-events-auto rotate-1 scale-105 post-it-font overflow-hidden
                                ${pendingNote.color === 'yellow' ? 'bg-[#ffff88] text-slate-800' :
                                    pendingNote.color === 'blue' ? 'bg-[#7afaff] text-slate-800' :
                                        pendingNote.color === 'rose' ? 'bg-[#ff7e7e] text-white' :
                                            'bg-[#a7ffeb] text-slate-800'}`}
                            style={{ left: pendingNote.location.x, top: pendingNote.location.y, fontFamily: "'Architects Daughter', cursive" }}
                        >

                            {/* Tape strip */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-[5px] bg-white/25 rounded-b-sm"></div>
                            <div className="flex justify-between items-start mb-1 absolute top-2 left-4 right-2">
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Draft</span>
                            </div>
                            <textarea
                                autoFocus
                                className="w-full h-full bg-transparent border-none outline-none focus:ring-0 focus:outline-none text-[15px] font-bold p-0 resize-none leading-snug placeholder:italic placeholder:opacity-40 post-it-font"
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
                    className="fixed pointer-events-none z-[9999] rotate-6 scale-110 opacity-70"
                    style={{
                        left: 0,
                        top: 0,
                        width: '180px',
                        height: '180px',
                        transform: `translate3d(${dragPos.x - 90}px, ${dragPos.y - 90}px, 0)`
                    }}
                >
                    <div className={`w-full h-full rounded-[1px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${PALETTE_COLORS.find(c => c.id === draggingFromPalette)?.color || 'bg-[#ffff88]'} overflow-hidden`}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-[5px] bg-white/25 rounded-b-sm"></div>
                    </div>
                </div>
            )}
        </div>
    );
};
