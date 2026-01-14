import React, { useState, useRef, useEffect } from 'react';

type Tool = 'select' | 'note' | 'text' | 'pen' | 'sticker' | 'eraser' | 'arrow';
type NoteColor = 'yellow' | 'blue' | 'green' | 'red';

interface BoardItem {
    id: string;
    type: 'note' | 'text' | 'sticker';
    x: number;
    y: number;
    content?: string;
    color?: NoteColor;
    width?: number;
    height?: number;
    rotation?: number;
    stickerType?: string;

    fontSize?: number;
    reaction?: string;
}

interface Path {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    type?: 'freehand' | 'arrow';
}

const WhiteboardTab: React.FC = () => {
    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [selectedColor, setSelectedColor] = useState<NoteColor>('yellow');
    const [penColor, setPenColor] = useState<string>('#000000');

    // Initialize from Session Storage or Default
    const [items, setItems] = useState<BoardItem[]>(() => {
        const saved = sessionStorage.getItem('zyphe_wb_items');
        return saved ? JSON.parse(saved) : [
            { id: '1', type: 'note', x: 200, y: 150, content: 'Welcome to the Whiteboard!', color: 'yellow', rotation: -2, width: 200, height: 200 },
            { id: '2', type: 'note', x: 500, y: 100, content: 'Brainstorm stats here...', color: 'blue', rotation: 3, width: 200, height: 200 },
            { id: '3', type: 'text', x: 350, y: 350, content: 'What are your tips & tricks on staying productive in WFH setting?', width: 500, fontSize: 24 },
        ];
    });

    const [paths, setPaths] = useState<Path[]>(() => {
        const saved = sessionStorage.getItem('zyphe_wb_paths');
        return saved ? JSON.parse(saved) : [];
    });

    // Persist to Session Storage
    useEffect(() => {
        sessionStorage.setItem('zyphe_wb_items', JSON.stringify(items));
    }, [items]);

    useEffect(() => {
        sessionStorage.setItem('zyphe_wb_paths', JSON.stringify(paths));
    }, [paths]);

    // Drawing State
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

    // Dragging State
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Resizing State
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

    const canvasRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (activeTool === 'pen') {
            setIsDrawing(true);
            const rect = svgRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setCurrentPath([{ x, y }]);
            }
            return;
        }

        if (activeTool === 'arrow') {
            setIsDrawing(true);
            const rect = svgRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setCurrentPath([{ x, y }, { x, y }]);
            }
            return;
        }

        // Add Note on Click if tool is note
        if (activeTool === 'note') {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left - 75; // Center the note
                const y = e.clientY - rect.top - 75;
                const newItem: BoardItem = {
                    id: Date.now().toString(),
                    type: 'note',
                    x,
                    y,
                    color: selectedColor,
                    content: 'New Note',
                    rotation: Math.random() * 6 - 3
                };
                setItems(prev => [...prev, newItem]);
                setActiveTool('select'); // Switch back to select
            }
        }

        // Add text on Click if tool is text
        if (activeTool === 'text') {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const newItem: BoardItem = {
                    id: Date.now().toString(),
                    type: 'text',
                    x,
                    y,
                    content: 'Type here...',
                    fontSize: 24
                };
                setItems(prev => [...prev, newItem]);
                setActiveTool('select'); // Switch back to select
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeTool === 'pen' && isDrawing) {
            setCurrentPath(prev => [...prev, { x, y }]);
            setCurrentPath(prev => [...prev, { x, y }]);
            return;
        }

        if (activeTool === 'arrow' && isDrawing) {
            setCurrentPath(prev => [prev[0], { x, y }]);
            return;
        }

        if (resizingId) {
            const dx = e.clientX - resizeStart.x;
            const dy = e.clientY - resizeStart.y;
            setItems(prev => prev.map(item =>
                item.id === resizingId
                    ? { ...item, width: Math.max(100, resizeStart.w + dx), height: Math.max(50, resizeStart.h + dy) }
                    : item
            ));
            return;
        }

        if (draggingId) {
            setItems(prev => prev.map(item =>
                item.id === draggingId
                    ? { ...item, x: x - dragOffset.x, y: y - dragOffset.y }
                    : item
            ));
        }
    };

    const handleMouseUp = () => {
        if (activeTool === 'pen' && isDrawing) {
            setIsDrawing(false);
            if (currentPath.length > 1) {
                setPaths(prev => [...prev, {
                    id: Date.now().toString(),
                    points: currentPath,
                    color: penColor,
                    width: 3
                }]);
            }
            setCurrentPath([]);
            setCurrentPath([]);
        }
        if (activeTool === 'arrow' && isDrawing) {
            setIsDrawing(false);
            if (currentPath.length === 2 && (currentPath[0].x !== currentPath[1].x || currentPath[0].y !== currentPath[1].y)) {
                setPaths(prev => [...prev, {
                    id: Date.now().toString(),
                    points: currentPath,
                    color: penColor,
                    width: 3,
                    type: 'arrow'
                }]);
            }
            setCurrentPath([]);
        }
        setDraggingId(null);
        setResizingId(null);
    };

    const startResize = (e: React.MouseEvent, item: BoardItem) => {
        e.stopPropagation();
        e.preventDefault();
        setResizingId(item.id);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            w: item.width || (item.type === 'note' ? 192 : 300),
            h: item.height || (item.type === 'note' ? 192 : 100)
        });
    };

    const startDrag = (e: React.MouseEvent, item: BoardItem) => {
        if (activeTool !== 'select') return;
        e.stopPropagation();
        setDraggingId(item.id);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setDragOffset({ x: x - item.x, y: y - item.y });
        }
    };

    const updateItemContent = (id: string, content: string) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, content } : item));
    };

    const updateItemFontSize = (id: string, delta: number) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newSize = Math.max(12, Math.min(96, (item.fontSize || 24) + delta));
                return { ...item, fontSize: newSize };
            }
            return item;
        }));
    };

    const updateItemReaction = (id: string, reaction: string) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, reaction: item.reaction === reaction ? undefined : reaction } : item));
    };

    const deleteItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const deletePath = (id: string) => {
        setPaths(prev => prev.filter(p => p.id !== id));
    };

    return (
        <div className="w-full h-[calc(100vh-100px)] bg-[#fdfaf5] relative overflow-hidden flex font-sans text-slate-900 border-t border-slate-200">
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Architects+Daughter&display=swap');
                .post-it-font {
                    font-family: 'Architects Daughter', cursive;
                    line-height: 1.2;
                }
            `}} />
            {/* Toolbar */}
            <div className="absolute left-6 top-6 flex flex-col bg-white shadow-xl rounded-2xl p-2 gap-2 z-50 border border-slate-100">
                <ToolButton icon="fa-arrow-pointer" tool="select" active={activeTool} onClick={() => setActiveTool('select')} />
                <ToolButton icon="fa-font" tool="text" active={activeTool} onClick={() => setActiveTool('text')} />
                <ToolButton icon="fa-note-sticky" tool="note" active={activeTool} onClick={() => setActiveTool('note')} />
                {activeTool === 'note' && (
                    <div className="flex flex-col gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100 items-center animate-in fade-in slide-in-from-left-4 duration-200">
                        {(['yellow', 'blue', 'green', 'red'] as NoteColor[]).map(color => (
                            <button
                                key={color}
                                className={`w-6 h-6 rounded-full border-2 ${selectedColor === color ? 'border-indigo-600 scale-110 shadow-sm' : 'border-transparent hover:scale-110'} transition-all`}
                                style={{ backgroundColor: getColorInHex(color) }}
                                onClick={(e) => { e.stopPropagation(); setSelectedColor(color); }}
                                title={color.charAt(0).toUpperCase() + color.slice(1)}
                            />
                        ))}
                    </div>
                )}
                <ToolButton icon="fa-pen" tool="pen" active={activeTool} onClick={() => setActiveTool('pen')} />
                {activeTool === 'pen' && (
                    <div className="flex flex-col gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100 items-center animate-in fade-in slide-in-from-left-4 duration-200">
                        {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308'].map(color => (
                            <button
                                key={color}
                                className={`w-5 h-5 rounded-full border-2 ${penColor === color ? 'border-indigo-600 scale-110' : 'border-transparent hover:scale-110'} transition-all`}
                                style={{ backgroundColor: color }}
                                onClick={(e) => { e.stopPropagation(); setPenColor(color); }}
                            />
                        ))}
                    </div>
                )}
                <ToolButton icon="fa-arrow-right-long" tool="arrow" active={activeTool} onClick={() => setActiveTool('arrow')} label="Arrow" />
                {activeTool === 'arrow' && (
                    <div className="flex flex-col gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100 items-center animate-in fade-in slide-in-from-left-4 duration-200">
                        {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308'].map(color => (
                            <button
                                key={color}
                                className={`w-5 h-5 rounded-full border-2 ${penColor === color ? 'border-indigo-600 scale-110' : 'border-transparent hover:scale-110'} transition-all`}
                                style={{ backgroundColor: color }}
                                onClick={(e) => { e.stopPropagation(); setPenColor(color); }}
                            />
                        ))}
                    </div>
                )}
                <ToolButton icon="fa-eraser" tool="eraser" active={activeTool} onClick={() => setActiveTool('eraser')} />
                <ToolButton icon="fa-icons" tool="sticker" active={activeTool} onClick={() => setActiveTool('select')} label="Sticker" disabled />
            </div>


            {/* Canvas Area */}
            <div
                ref={canvasRef}
                className={`w-full h-full relative ${activeTool === 'pen' ? 'cursor-crosshair' : activeTool === 'select' ? 'cursor-default' : 'cursor-cell'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                    backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
            >
                {/* SVG Layer for Drawings */}
                <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    <defs>
                        {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308'].map(color => (
                            <marker
                                key={color}
                                id={`arrowhead-${color.replace('#', '')}`}
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill={color} />
                            </marker>
                        ))}
                    </defs>
                    {paths.map(path => (
                        <React.Fragment key={path.id}>
                            {/* Eraser Hitbox */}
                            {activeTool === 'eraser' && (
                                path.type === 'arrow' ? (
                                    <line
                                        x1={path.points[0].x}
                                        y1={path.points[0].y}
                                        x2={path.points[1].x}
                                        y2={path.points[1].y}
                                        stroke="transparent"
                                        strokeWidth={20}
                                        className="cursor-cell"
                                        style={{ pointerEvents: 'all' }}
                                        onClick={(e) => { e.stopPropagation(); deletePath(path.id); }}
                                        onMouseEnter={(e) => { if (e.buttons === 1) deletePath(path.id); }}
                                    />
                                ) : (
                                    <polyline
                                        points={path.points.map(p => `${p.x},${p.y}`).join(' ')}
                                        fill="none"
                                        stroke="transparent"
                                        strokeWidth={20}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="cursor-cell"
                                        style={{ pointerEvents: 'all' }}
                                        onClick={(e) => { e.stopPropagation(); deletePath(path.id); }}
                                        onMouseEnter={(e) => { if (e.buttons === 1) deletePath(path.id); }}
                                    />
                                )
                            )}
                            {path.type === 'arrow' ? (
                                <line
                                    x1={path.points[0].x}
                                    y1={path.points[0].y}
                                    x2={path.points[1].x}
                                    y2={path.points[1].y}
                                    stroke={path.color}
                                    strokeWidth={path.width}
                                    markerEnd={`url(#arrowhead-${path.color.replace('#', '')})`}
                                    style={{ opacity: activeTool === 'eraser' ? 0.3 : 1, transition: 'opacity 0.2s' }}
                                />
                            ) : (
                                <polyline
                                    points={path.points.map(p => `${p.x},${p.y}`).join(' ')}
                                    fill="none"
                                    stroke={path.color}
                                    strokeWidth={path.width}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ opacity: activeTool === 'eraser' ? 0.3 : 1, transition: 'opacity 0.2s' }}
                                />
                            )}
                        </React.Fragment>
                    ))}
                    {currentPath.length > 0 && activeTool === 'pen' && (
                        <polyline
                            points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke={penColor}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    {currentPath.length > 0 && activeTool === 'arrow' && (
                        <line
                            x1={currentPath[0].x}
                            y1={currentPath[0].y}
                            x2={currentPath[1].x}
                            y2={currentPath[1].y}

                            stroke={penColor}
                            strokeWidth="3"
                            markerEnd={`url(#arrowhead-${penColor.replace('#', '')})`}
                        />
                    )}
                </svg>

                {/* Items Layer */}
                {items.map(item => (
                    <div
                        key={item.id}
                        className={`absolute group top-0 left-0 transition-transform ${activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        style={{
                            transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation || 0}deg)`,
                            zIndex: 20
                        }}
                        onMouseDown={(e) => startDrag(e, item)}
                    >
                        {/* Delete Button (visible on hover) */}
                        <button
                            className="absolute -top-3 -right-3 w-6 h-6 bg-white rounded-full shadow-md text-slate-400 hover:text-red-500 hover:scale-110 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 text-xs border border-slate-100"
                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                            title="Delete"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>

                        {/* Reaction Picker (Note Only) */}
                        {item.type === 'note' && (
                            <div className="absolute -top-9 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-50 bg-white shadow-sm border border-slate-100 rounded-full px-2 py-1 items-center">
                                {['🔥', '👍', '👎', '💯', '❤️', '😢', '😭', '⚡', '🚗'].map(emoji => (
                                    <button
                                        key={emoji}
                                        className={`hover:scale-125 transition-transform text-sm ${item.reaction === emoji ? 'scale-125 bg-slate-100 rounded-full' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); updateItemReaction(item.id, emoji); }}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}

                        {item.type === 'note' && (
                            <div
                                className={`p-4 shadow-lg ${getColorClass(item.color || 'yellow')} flex flex-col justify-start relative transition-shadow hover:shadow-2xl`}
                                style={{
                                    width: item.width || 192,
                                    height: item.height || 192,
                                    boxShadow: '2px 4px 12px rgba(0,0,0,0.1), 0 0 2px rgba(0,0,0,0.05)',
                                    minWidth: '100px',
                                    minHeight: '100px'
                                }}
                            >
                                {item.reaction && (
                                    <div className="absolute -top-4 -right-4 text-3xl filter drop-shadow-sm transform rotate-12 z-20 animate-in zoom-in duration-200 cursor-default select-none pointer-events-none">
                                        {item.reaction}
                                    </div>
                                )}
                                <textarea
                                    className="w-full h-full bg-transparent resize-none border-none focus:ring-0 text-slate-800 font-medium text-lg placeholder-black/20 leading-snug post-it-font"
                                    value={item.content}
                                    placeholder="Write something..."
                                    onChange={(e) => updateItemContent(item.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div
                                    className="absolute bottom-1 right-1 w-6 h-6 cursor-se-resize z-50 opacity-20 hover:opacity-100 flex items-end justify-end p-1"
                                    onMouseDown={(e) => startResize(e, item)}
                                >
                                    <i className="fa-solid fa-caret-down -rotate-45 text-slate-800"></i>
                                </div>
                            </div>
                        )}

                        {item.type === 'text' && (
                            <div
                                className="bg-white/50 rounded-lg p-2 focus-within:bg-white focus-within:shadow-sm border border-transparent focus-within:border-slate-200 transition-colors relative group/text"
                                style={{
                                    width: item.width || 300,
                                    height: item.height || 'auto',
                                    minWidth: '150px',
                                    minHeight: '50px'
                                }}
                            >
                                <textarea
                                    className="w-full h-full bg-transparent resize-none border-none focus:ring-0 text-slate-900 font-bold placeholder-slate-300 leading-tight text-center"
                                    value={item.content}
                                    placeholder="Type Text..."
                                    style={{ height: '100%', fontSize: item.fontSize || 24 }}
                                    onChange={(e) => updateItemContent(item.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {/* Resize Handle */}
                                <div
                                    className="absolute bottom-1 right-1 w-6 h-6 cursor-se-resize z-50 opacity-0 group-hover/text:opacity-50 hover:!opacity-100 flex items-end justify-end p-1"
                                    onMouseDown={(e) => startResize(e, item)}
                                >
                                    <i className="fa-solid fa-caret-down -rotate-45 text-slate-400"></i>
                                </div>

                                {/* Font Size Controls */}
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover/text:opacity-100 transition-opacity z-50 bg-white shadow-sm border border-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateItemFontSize(item.id, -4); }}
                                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded text-xs"
                                        title="Decrease Font Size"
                                    >
                                        <i className="fa-solid fa-minus"></i>
                                    </button>
                                    <div className="flex items-center justify-center w-6 text-[10px] font-bold text-slate-400 select-none">
                                        {item.fontSize || 24}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateItemFontSize(item.id, 4); }}
                                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded text-xs"
                                        title="Increase Font Size"
                                    >
                                        <i className="fa-solid fa-plus"></i>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div >
    );
};

const ToolButton: React.FC<{ icon: string; tool: Tool; active: Tool; onClick: () => void; label?: string; disabled?: boolean }> = ({ icon, tool, active, onClick, label, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active === tool
            ? 'bg-indigo-600 text-white shadow-md scale-105'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        title={label || tool}
    >
        <i className={`fa-solid ${icon}`}></i>
    </button>
);

const getColorClass = (color: NoteColor) => {
    switch (color) {
        case 'blue': return 'bg-[#c7eeff]';
        case 'green': return 'bg-[#d1f7c4]';
        case 'red': return 'bg-[#ffcdd2]';
        default: return 'bg-[#fff59d]'; // Yellow
    }
};

const getColorInHex = (color: NoteColor) => {
    switch (color) {
        case 'blue': return '#c7eeff';
        case 'green': return '#d1f7c4';
        case 'red': return '#ffcdd2';
        default: return '#fff59d'; // Yellow
    }
};

export default WhiteboardTab;
