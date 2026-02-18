import React, { useState, useRef, useEffect } from 'react';
import { UserPropertyComment, StickyNoteColor } from '../../../../types';
import { trackClarityEvent } from '../../../../services/analytics/clarity';
import { trackEvent as trackPH } from '../../../../services/analytics/posthog';

interface Props {
    note: UserPropertyComment;
    onUpdate: (id: string, updates: Partial<UserPropertyComment>) => void;
    onDelete: (id: string) => void;
    containerRef: React.RefObject<HTMLDivElement>;
}

const COLOR_CLASSES: Record<StickyNoteColor, string> = {
    yellow: 'bg-[#ffff88] border-[#eeee77] text-slate-800',
    blue: 'bg-[#7afaff] border-[#69e9ee] text-slate-800',
    rose: 'bg-[#ff7e7e] border-[#ee6d6d] text-white',
    emerald: 'bg-[#a7ffeb] border-[#96eee0] text-slate-800',
    violet: 'bg-violet-100 border-violet-200 text-violet-900',
    amber: 'bg-amber-100 border-amber-200 text-amber-900',
};

export const StickyNote: React.FC<Props> = ({ note, onUpdate, onDelete, containerRef }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(note.comment);
    const [isDragging, setIsDragging] = useState(false);
    const [pos, setPos] = useState(note.location);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);
    const noteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setPos(note.location);
        setEditText(note.comment);
    }, [note.location, note.comment]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isEditing || (e.target as HTMLElement).closest('button')) return;
        setIsDragging(true);
        hasMoved.current = false;
        dragStartPos.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y
        };
        e.stopPropagation();
    };

    const handleMouseUpDrag = () => {
        if (isDragging) {
            setIsDragging(false);
            if (hasMoved.current) {
                onUpdate(note.id, { location: pos });
                trackClarityEvent('Note_Moved');
                trackPH('Note_Moved', { noteId: note.id });
            } else {
                setIsEditing(true);
                trackClarityEvent('Note_Edit_Start');
                trackPH('Note_Edit_Start', { noteId: note.id });
            }
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            let newX = e.clientX - dragStartPos.current.x;
            let newY = e.clientY - dragStartPos.current.y;

            if (Math.abs(newX - pos.x) > 5 || Math.abs(newY - pos.y) > 5) {
                hasMoved.current = true;
            }

            // Constrain to container boundaries
            newX = Math.max(0, Math.min(newX, rect.width - 96));
            newY = Math.max(0, Math.min(newY, rect.height - 96));

            setPos({ x: newX, y: newY });
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUpDrag);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUpDrag);
        };
    }, [isDragging, pos, onUpdate, note.id, containerRef]);

    const handleSave = () => {
        if (editText.trim() !== note.comment) {
            onUpdate(note.id, { comment: editText });
            trackClarityEvent('Note_Updated');
            trackPH('Note_Updated', { noteId: note.id });
        }
        setIsEditing(false);
    };

    const handleDelete = () => {
        onDelete(note.id);
        trackClarityEvent('Note_Deleted');
        trackPH('Note_Deleted', { noteId: note.id });
    };

    return (
        <div
            ref={noteRef}
            className={`absolute w-24 h-24 p-2.5 pt-4 rounded-sm border-t border-black/5 shadow-[5px_5px_7px_rgba(33,33,33,.1)] cursor-grab active:cursor-grabbing transition-all duration-75 z-[100] flex flex-col post-it-font group/note ${COLOR_CLASSES[note.color] || COLOR_CLASSES.yellow} ${isDragging ? 'shadow-2xl scale-110 z-[200] rotate-2' : 'hover:shadow-xl rotate-[-1deg]'} post-it-container`}
            style={{
                left: pos.x,
                top: pos.y,
                fontFamily: "'Architects Daughter', cursive"
            }}
            onMouseDown={handleMouseDown}
        >
            <div className="absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 transition-opacity flex gap-1 bg-white/20 rounded-full px-1 backdrop-blur-sm z-50">
                <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="text-slate-600 hover:text-red-500 transition-colors p-0.5"
                    title="Delete"
                >
                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                </button>
            </div>

            <div className="absolute top-1 left-2 z-40">
                <div className="text-[6px] opacity-40 font-sans leading-none uppercase tracking-tighter">
                    {note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                </div>
            </div>

            {isEditing ? (
                <textarea
                    autoFocus
                    className="w-full h-full bg-transparent border-none focus:ring-0 text-[12px] font-bold p-0 resize-none leading-tight placeholder:italic placeholder:opacity-40 post-it-font"
                    value={editText}
                    placeholder="Write..."
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                />
            ) : (
                <div className="flex-grow text-[12px] font-bold leading-tight select-none overflow-hidden break-words text-slate-800">
                    {note.comment}
                </div>
            )}

            <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover/note:opacity-100 transition-opacity">
                {['yellow', 'blue', 'rose', 'emerald'].map(c => (
                    <button
                        key={c}
                        onClick={(e) => {
                            e.stopPropagation();
                            onUpdate(note.id, { color: c as StickyNoteColor });
                            trackClarityEvent('Note_Color_Changed');
                            trackPH('Note_Color_Changed', { noteId: note.id, newColor: c });
                        }}
                        className={`w-1.5 h-1.5 rounded-full border border-black/10 transition-transform hover:scale-125 ${COLOR_CLASSES[c as StickyNoteColor].split(' ')[0]}`}
                    />
                ))}
            </div>
        </div>
    );
};
