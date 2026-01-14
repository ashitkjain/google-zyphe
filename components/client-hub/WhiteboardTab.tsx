import React, { useState, useRef, useEffect } from 'react';

type Tool = 'select' | 'note' | 'text' | 'pen' | 'sticker' | 'eraser';
type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple';

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
}

interface Path {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
}

const WhiteboardTab: React.FC = () => {
    const [activeTool, setActiveTool] = useState<Tool>('select');

    // Initialize from Session Storage or Default
    const [items, setItems] = useState<BoardItem[]>(() => {
        const saved = sessionStorage.getItem('zyphe_wb_items');
        return saved ? JSON.parse(saved) : [
            { id: '1', type: 'note', x: 200, y: 150, content: 'Welcome to the Whiteboard!', color: 'yellow', rotation: -2, width: 200, height: 200 },
            { id: '2', type: 'note', x: 500, y: 100, content: 'Brainstorm stats here...', color: 'blue', rotation: 3, width: 200, height: 200 },
            { id: '3', type: 'text', x: 350, y: 350, content: 'What are your tips & tricks on staying productive in WFH setting?', width: 500 },
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
                    color: 'yellow',
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
                    content: 'Type here...'
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
                    color: '#000',
                    width: 3
                }]);
            }
            setCurrentPath([]);
        }
        setDraggingId(null);
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
                <ToolButton icon="fa-pen" tool="pen" active={activeTool} onClick={() => setActiveTool('pen')} />
                <ToolButton icon="fa-eraser" tool="eraser" active={activeTool} onClick={() => setActiveTool('eraser')} />
                <ToolButton icon="fa-icons" tool="sticker" active={activeTool} onClick={() => setActiveTool('select')} label="Sticker" disabled />
                <div className="h-px bg-slate-100 my-1"></div>
                <button className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Clear Board" onClick={() => {
                    if (confirm('Are you sure you want to clear the whiteboard?')) {
                        setItems([]);
                        setPaths([]);
                        sessionStorage.removeItem('zyphe_wb_items');
                        sessionStorage.removeItem('zyphe_wb_paths');
                    }
                }}>
                    <i className="fa-solid fa-trash-can"></i>
                </button>
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
                    {paths.map(path => (
                        <React.Fragment key={path.id}>
                            {/* Eraser Hitbox */}
                            {activeTool === 'eraser' && (
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
                            )}
                            <polyline
                                points={path.points.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none"
                                stroke={path.color}
                                strokeWidth={path.width}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{ opacity: activeTool === 'eraser' ? 0.3 : 1, transition: 'opacity 0.2s' }}
                            />
                        </React.Fragment>
                    ))}
                    {currentPath.length > 0 && (
                        <polyline
                            points={currentPath.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke="#000"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
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
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>

                        {item.type === 'note' && (
                            <div
                                className={`p-4 shadow-lg ${getColorClass(item.color || 'yellow')} flex flex-col justify-start relative transition-shadow hover:shadow-2xl resize-both overflow-hidden`}
                                style={{
                                    width: item.width || 192, // w-48 is 192px
                                    height: item.height || 192,
                                    boxShadow: '2px 4px 12px rgba(0,0,0,0.1), 0 0 2px rgba(0,0,0,0.05)',
                                    minWidth: '100px',
                                    minHeight: '100px'
                                }}
                                onMouseUp={(e) => {
                                    const target = e.currentTarget;
                                    setItems(prev => prev.map(i => i.id === item.id ? { ...i, width: target.clientWidth, height: target.clientHeight } : i));
                                }}
                            >
                                <textarea
                                    className="w-full h-full bg-transparent resize-none border-none focus:ring-0 text-slate-800 font-medium text-lg placeholder-black/20 leading-snug post-it-font"
                                    value={item.content}
                                    placeholder="Write something..."
                                    onChange={(e) => updateItemContent(item.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}

                        {item.type === 'text' && (
                            <div
                                className="resize-both overflow-hidden bg-white/50 rounded-lg p-2 focus-within:bg-white focus-within:shadow-sm border border-transparent focus-within:border-slate-200 transition-colors"
                                style={{
                                    width: item.width || 300,
                                    height: item.height || 'auto',
                                    minWidth: '150px',
                                    minHeight: '50px'
                                }}
                                onMouseUp={(e) => {
                                    // Capture resize end
                                    const target = e.currentTarget;
                                    setItems(prev => prev.map(i => i.id === item.id ? { ...i, width: target.clientWidth, height: target.clientHeight } : i));
                                }}
                            >
                                <textarea
                                    className="w-full h-full bg-transparent resize-none border-none focus:ring-0 text-slate-900 font-bold text-2xl placeholder-slate-300 leading-tight text-center"
                                    value={item.content}
                                    placeholder="Type Text..."
                                    style={{ height: '100%' }}
                                    onChange={(e) => updateItemContent(item.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
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
        case 'pink': return 'bg-[#ffe2f5]';
        case 'purple': return 'bg-[#e7d9ff]';
        default: return 'bg-[#fff59d]'; // Yellow
    }
};

export default WhiteboardTab;
