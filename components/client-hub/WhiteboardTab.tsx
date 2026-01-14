import React, { useState, useRef, useEffect } from 'react';
import { saveWhiteboard, getWhiteboard, auth } from '../../services/firebaseService';

type Tool = 'select' | 'note' | 'text' | 'pen' | 'sticker' | 'eraser' | 'arrow';
type NoteColor = 'yellow' | 'blue' | 'green' | 'red';

interface BoardItem {
    id: string;
    type: 'note' | 'text' | 'sticker' | 'pen' | 'arrow';
    x?: number;
    y?: number;
    content?: string;
    color?: NoteColor;
    width?: number;
    height?: number;
    rotation?: number;
    fontSize?: number;
    reaction?: string;
    // Path specific
    points?: { x: number; y: number }[];
    stroke?: string;
    strokeWidth?: number;
}

interface Props {
    userId: string;
}

const WhiteboardTab: React.FC<Props> = ({ userId }) => {
    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [selectedColor, setSelectedColor] = useState<NoteColor>('yellow');
    const [penColor, setPenColor] = useState<string>('#000000');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Initialize Items State from SessionStorage for instant tab switching
    const [items, setItems] = useState<BoardItem[]>(() => {
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem(`wb_cache_${userId}`) : null;
        return cached ? JSON.parse(cached) : [];
    });

    // Ref for cleanup persistence
    const itemsRef = useRef<BoardItem[]>(items);
    useEffect(() => { itemsRef.current = items; }, [items]);

    // Sync session storage on change
    useEffect(() => {
        if (items.length > 0) {
            sessionStorage.setItem(`wb_cache_${userId}`, JSON.stringify(items));
        }
    }, [items, userId]);


    // Load from Firebase on Mount
    useEffect(() => {
        let mounted = true;
        const loadBoard = async () => {
            const effectiveId = auth?.currentUser?.uid || userId;
            if (!effectiveId) {
                setIsLoading(false);
                return;
            }
            console.log(`[Whiteboard] Loading board for user ${effectiveId}...`);
            const data = await getWhiteboard(effectiveId);
            if (mounted) {
                if (data && Array.isArray(data)) {
                    console.log(`[Whiteboard] Loaded ${data.length} items.`);
                    setItems(data);
                } else {
                    console.log("[Whiteboard] No existing board found or data format invalid.");
                }
                setIsLoading(false);
            }
        };
        loadBoard();
        return () => { mounted = false; };
    }, [userId]);

    const handleSave = async () => {
        // Prioritize actual Auth UID for persistence to satisfy Firestore rules
        const effectiveId = auth?.currentUser?.uid || userId;

        if (!effectiveId) {
            console.warn("[Whiteboard] Cannot save: No valid ID available.");
            return;
        }
        setIsSaving(true);
        setSaveStatus('idle');
        console.log(`[Whiteboard] Attempting to save board for user ${effectiveId} (prop: ${userId}) with ${items.length} items...`);

        try {
            const result = await saveWhiteboard(effectiveId, items);
            if (result.success) {
                console.log("[Whiteboard] Save successful.");
                setSaveStatus('success');
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                console.error("[Whiteboard] Save failed:", result.error);
                setSaveStatus('error');
                alert(`Save failed: ${result.error}`);
            }
        } catch (err) {
            console.error("[Whiteboard] Unexpected error during save:", err);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-save roughly when items change (debounced would be better, but let's stick to manual + unmount)
    useEffect(() => {
        return () => {
            // Best effort save on unmount if there are items
            const effectiveId = auth?.currentUser?.uid || userId;
            if (effectiveId && itemsRef.current.length > 0) {
                saveWhiteboard(effectiveId, itemsRef.current);
            }
        };
    }, [userId]);



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

    const handleMouseDown = (e: React.MouseEvent) => {
        // Close color picker on interaction
        if (showColorPicker && !((e.target as HTMLElement).closest('button'))) {
            setShowColorPicker(false);
        }

        if (activeTool === 'pen') {
            setIsDrawing(true);
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setCurrentPath([{ x, y }]);
            }
            return;
        }

        if (activeTool === 'arrow') {
            setIsDrawing(true);
            const rect = canvasRef.current?.getBoundingClientRect();
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
                setItems(prev => [...prev, {
                    id: Date.now().toString(),
                    type: 'pen',
                    points: currentPath,
                    stroke: penColor,
                    strokeWidth: 3
                }]);
            }
            setCurrentPath([]);
        }
        if (activeTool === 'arrow' && isDrawing) {
            setIsDrawing(false);
            if (currentPath.length === 2 && (currentPath[0].x !== currentPath[1].x || currentPath[0].y !== currentPath[1].y)) {
                setItems(prev => [...prev, {
                    id: Date.now().toString(),
                    type: 'arrow',
                    points: currentPath,
                    stroke: penColor,
                    strokeWidth: 3
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
        if (!item.x || !item.y) return; // Prevent dragging of paths
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



    const handleToolClick = (tool: Tool) => {
        if (activeTool === tool) {
            setShowColorPicker(!showColorPicker);
        } else {
            setActiveTool(tool);
            if (['note', 'pen', 'arrow'].includes(tool)) {
                setShowColorPicker(true);
            } else {
                setShowColorPicker(false);
            }
        }
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
                <ToolButton icon="fa-arrow-pointer" tool="select" active={activeTool} onClick={() => handleToolClick('select')} />
                <ToolButton icon="fa-font" tool="text" active={activeTool} onClick={() => handleToolClick('text')} />
                <ToolButton icon="fa-note-sticky" tool="note" active={activeTool} onClick={() => handleToolClick('note')} />
                {activeTool === 'note' && showColorPicker && (
                    <div className="flex flex-col gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100 items-center animate-in fade-in slide-in-from-left-4 duration-200">
                        {(['yellow', 'blue', 'green', 'red'] as NoteColor[]).map(color => (
                            <button
                                key={color}
                                className={`w-6 h-6 rounded-full border-2 ${selectedColor === color ? 'border-indigo-600 scale-110 shadow-sm' : 'border-transparent hover:scale-110'} transition-all`}
                                style={{ backgroundColor: getColorInHex(color) }}
                                onClick={(e) => { e.stopPropagation(); setSelectedColor(color); setShowColorPicker(false); }}
                                title={color.charAt(0).toUpperCase() + color.slice(1)}
                            />
                        ))}
                    </div>
                )}
                <ToolButton icon="fa-pen" tool="pen" active={activeTool} onClick={() => handleToolClick('pen')} />
                {activeTool === 'pen' && showColorPicker && (
                    <div className="flex flex-col gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100 items-center animate-in fade-in slide-in-from-left-4 duration-200">
                        {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308'].map(color => (
                            <button
                                key={color}
                                className={`w-5 h-5 rounded-full border-2 ${penColor === color ? 'border-indigo-600 scale-110' : 'border-transparent hover:scale-110'} transition-all`}
                                style={{ backgroundColor: color }}
                                onClick={(e) => { e.stopPropagation(); setPenColor(color); setShowColorPicker(false); }}
                            />
                        ))}
                    </div>
                )}
                <ToolButton icon="fa-arrow-right-long" tool="arrow" active={activeTool} onClick={() => handleToolClick('arrow')} label="Arrow" />
                {activeTool === 'arrow' && showColorPicker && (
                    <div className="flex flex-col gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100 items-center animate-in fade-in slide-in-from-left-4 duration-200">
                        {['#000000', '#ef4444', '#22c55e', '#3b82f6', '#eab308'].map(color => (
                            <button
                                key={color}
                                className={`w-5 h-5 rounded-full border-2 ${penColor === color ? 'border-indigo-600 scale-110' : 'border-transparent hover:scale-110'} transition-all`}
                                style={{ backgroundColor: color }}
                                onClick={(e) => { e.stopPropagation(); setPenColor(color); setShowColorPicker(false); }}
                            />
                        ))}
                    </div>
                )}
                <ToolButton icon="fa-eraser" tool="eraser" active={activeTool} onClick={() => handleToolClick('eraser')} />
                <ToolButton icon="fa-icons" tool="sticker" active={activeTool} onClick={() => handleToolClick('select')} label="Sticker" disabled />
            </div>

            {/* Top Right Save Controls */}
            <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
                {saveStatus === 'success' && (
                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 animate-in fade-in slide-in-from-right-4 duration-300">
                        <i className="fa-solid fa-circle-check text-xs"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">Saved Successfully</span>
                    </div>
                )}
                {saveStatus === 'error' && (
                    <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 animate-in fade-in slide-in-from-right-4 duration-300">
                        <i className="fa-solid fa-circle-xmark text-xs"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">Save Failed</span>
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={isSaving || isLoading}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <>
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                            Saving...
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-cloud-arrow-up"></i>
                            Confirm & Save
                        </>
                    )}
                </button>
            </div>

            {/* Loading Overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-600"></i>
                        <span className="text-slate-500 font-medium animate-pulse">Loading Whiteboard...</span>
                    </div>
                </div>
            )}


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
                {/* Global Defs SVG (for Arrowheads) - Always at bottom */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
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
                </svg>

                {/* Unified Items Layer - Rendered in Creation Order */}
                {items.map(item => {
                    // Render Path/Arrow
                    if (item.type === 'pen' || item.type === 'arrow') {
                        if (!item.points || item.points.length < 1) return null;
                        if (item.type === 'arrow' && item.points.length < 2) return null;
                        return (
                            <svg key={item.id} className="absolute inset-0 w-full h-full pointer-events-none">
                                {activeTool === 'eraser' && (
                                    item.type === 'arrow' ? (
                                        <line
                                            x1={item.points![0].x}
                                            y1={item.points![0].y}
                                            x2={item.points![1].x}
                                            y2={item.points![1].y}
                                            stroke="transparent"
                                            strokeWidth={20}
                                            className="cursor-cell"
                                            style={{ pointerEvents: 'all' }}
                                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                            onMouseEnter={(e) => { if (e.buttons === 1) deleteItem(item.id); }}
                                        />
                                    ) : (
                                        <polyline
                                            points={item.points!.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke="transparent"
                                            strokeWidth={20}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="cursor-cell"
                                            style={{ pointerEvents: 'all' }}
                                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                            onMouseEnter={(e) => { if (e.buttons === 1) deleteItem(item.id); }}
                                        />
                                    )
                                )}
                                {item.type === 'arrow' ? (
                                    <line
                                        x1={item.points![0].x}
                                        y1={item.points![0].y}
                                        x2={item.points![1].x}
                                        y2={item.points![1].y}
                                        stroke={item.stroke}
                                        strokeWidth={item.strokeWidth}
                                        markerEnd={`url(#arrowhead-${item.stroke?.replace('#', '')})`}
                                        style={{ opacity: activeTool === 'eraser' ? 0.3 : 1, transition: 'opacity 0.2s' }}
                                    />
                                ) : (
                                    <polyline
                                        points={item.points!.map(p => `${p.x},${p.y}`).join(' ')}
                                        fill="none"
                                        stroke={item.stroke}
                                        strokeWidth={item.strokeWidth}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{ opacity: activeTool === 'eraser' ? 0.3 : 1, transition: 'opacity 0.2s' }}
                                    />
                                )}
                            </svg>
                        );
                    }

                    // Render Notes/Text
                    return (
                        <div
                            key={item.id}
                            className={`absolute group top-0 left-0 transition-transform ${activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            style={{
                                transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation || 0}deg)`,
                                zIndex: 'auto' // Let DOM order dictate zIndex
                            }}
                            onMouseDown={(e) => startDrag(e, item)}
                        >
                            {/* Delete Button (visible on hover) */}
                            <button
                                className="absolute -bottom-3 -left-3 w-6 h-6 bg-white rounded-full shadow-md text-slate-400 hover:text-red-500 hover:scale-110 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 text-xs border border-slate-100"
                                onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                title="Delete"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>

                            {/* Reaction Picker (Note Only) */}
                            {item.type === 'note' && (
                                <div className="absolute -top-9 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-50 bg-white shadow-sm border border-slate-100 rounded-full px-2 py-1 items-center">
                                    {['🔥', '👍', '👎', '💯', '❤️', '✅', '❌', '😢', '😊', '⚡', '🚗'].map(emoji => (
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
                    );
                })}

                {/* Current Drawing (Always on top during creation) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
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
                    {currentPath.length > 1 && activeTool === 'arrow' && (
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
