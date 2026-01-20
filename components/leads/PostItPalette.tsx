import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';

const TypedDroppable = Droppable as any;
const TypedDraggable = Draggable as any;

const noteTypes = [
    { id: 'note-yellow', color: 'bg-[#ffff88] text-slate-800 border-[#eeee77]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-blue', color: 'bg-[#7afaff] text-slate-800 border-[#69e9ee]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-red', color: 'bg-[#ff7e7e] text-white border-[#ee6d6d]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
    { id: 'note-green', color: 'bg-[#a7ffeb] text-slate-800 border-[#96eee0]', shadow: 'shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
];

interface PostItPaletteProps {
    type: 'buyer' | 'seller';
}

const PostItPalette: React.FC<PostItPaletteProps> = ({ type }) => {
    return (
        <div className="flex items-center gap-3 ml-4 bg-amber-50/50 p-2 rounded-xl border border-amber-100/50">
            <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Quick Note</span>
                <span className="text-[9px] font-bold text-amber-700/60 leading-none">Drag to card</span>
            </div>
            <TypedDroppable droppableId={`palette-${type}`} direction="horizontal" type="POSTIT_PALETTE" isDropDisabled={true}>
                {(provided: any) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex items-center gap-2">
                        {noteTypes.map((note, index) => (
                            <TypedDraggable key={note.id} draggableId={`${note.id}-${type}`} index={index}>
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
                                            className={`w-16 h-16 rounded-sm border-t border-black/5 cursor-grab active:cursor-grabbing flex items-center justify-center transition-all hover:-translate-y-1 hover:rotate-3 ${note.color} ${note.shadow} ${snapshot.isDragging ? 'z-[100] rotate-6 scale-110 shadow-2xl ring-2 ring-white/50' : 'relative z-10'} ${snapshot.isDropAnimating ? 'opacity-0 duration-0' : ''}`}
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
                        {provided.placeholder}
                    </div>
                )}
            </TypedDroppable>
        </div>
    );
};

export default PostItPalette;
export { noteTypes };
