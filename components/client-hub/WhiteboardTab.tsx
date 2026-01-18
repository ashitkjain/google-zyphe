import React, { useState, useRef, useEffect } from 'react';
import { saveWhiteboard, getWhiteboard, auth } from '../../services/firebaseService';

type Tool = 'select' | 'note' | 'text' | 'pen' | 'sticker' | 'eraser' | 'arrow' | 'circle' | 'calculator' | 'mortgage-calc' | 'calendar';
type NoteColor = 'yellow' | 'blue' | 'green' | 'red';

interface BoardItem {
    id: string;
    type: 'note' | 'text' | 'sticker' | 'pen' | 'arrow' | 'circle' | 'calculator' | 'mortgage-calc' | 'calendar';
    x?: number;
    y?: number;
    content?: string;
    color?: NoteColor;
    width?: number;
    height?: number;
    rotation?: number;
    fontSize?: number;
    reaction?: string;
    radius?: number;
    // Path specific
    points?: { x: number; y: number }[];
    stroke?: string;
    strokeWidth?: number;
    imageUrl?: string;
}

interface Props {
    userId: string;
}

const WhiteboardTab: React.FC<Props> = ({ userId }) => {
    const [activeTool, setActiveTool] = useState<Tool>('select');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [selectedColor, setSelectedColor] = useState<NoteColor>('yellow');

    const [penColor, setPenColor] = useState<string>('#000000');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
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
    const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
    const [dragOriginalItem, setDragOriginalItem] = useState<BoardItem | null>(null);

    // Resizing State
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const [resizeOriginalItem, setResizeOriginalItem] = useState<BoardItem | null>(null);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Close color picker on interaction
        if (showColorPicker && !((e.target as HTMLElement).closest('button'))) {
            setShowColorPicker(false);
        }

        // Deselect if clicking on empty space
        if (activeTool === 'select' && e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
            setSelectedItemId(null);
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

        if (activeTool === 'circle') {
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


        // Add Sticker (Pokemon)
        if (activeTool === 'sticker') {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left - 50; // Center offset
                const y = e.clientY - rect.top - 50;
                const newItem: BoardItem = {
                    id: Date.now().toString(),
                    type: 'sticker',
                    x,
                    y,
                    width: 100,
                    height: 100,
                    imageUrl: '/pikachu.png',
                    rotation: 0
                };
                setItems(prev => [...prev, newItem]);
                setActiveTool('select');
            }
        }


        // Add Calculator
        if (activeTool === 'calculator') {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left - 100;
                const y = e.clientY - rect.top - 140;
                const newItem: BoardItem = {
                    id: Date.now().toString(),
                    type: 'calculator',
                    x,
                    y,
                    width: 240,
                    height: 320,
                    content: '0', // Current display value
                    rotation: 0
                };
                setItems(prev => [...prev, newItem]);
                setActiveTool('select');
            }
        }


        // Add Mortgage Calculator
        if (activeTool === 'mortgage-calc') {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left - 150;
                const y = e.clientY - rect.top - 200;
                const newItem: BoardItem = {
                    id: Date.now().toString(),
                    type: 'mortgage-calc',
                    x,
                    y,
                    width: 320,
                    height: 420,
                    content: JSON.stringify({ principal: 300000, rate: 3.5, years: 30, downPaymentPercent: 20 }),
                    rotation: 0
                };
                setItems(prev => [...prev, newItem]);
                setActiveTool('select');
            }
        }


        // Add Calendar
        if (activeTool === 'calendar') {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const x = e.clientX - rect.left - 200;
                const y = e.clientY - rect.top - 150;
                const newItem: BoardItem = {
                    id: Date.now().toString(),
                    type: 'calendar',
                    x,
                    y,
                    width: 500,
                    height: 400,
                    content: JSON.stringify({
                        view: 'month',
                        currentDate: new Date().getTime(),
                        events: []
                    }),
                    rotation: 0
                };
                setItems(prev => [...prev, newItem]);
                setActiveTool('select');
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

        if (activeTool === 'circle' && isDrawing) {
            setCurrentPath(prev => [prev[0], { x, y }]);
            return;
        }

        if (resizingId && resizeOriginalItem) {
            const dx = e.clientX - resizeStart.x;
            const dy = e.clientY - resizeStart.y;

            setItems(prev => prev.map(item => {
                if (item.id !== resizingId) return item;

                // Handle Circle Resizing (Radius)
                if (item.type === 'circle' && item.x && item.y) {
                    const currentRadius = Math.sqrt(
                        Math.pow((e.clientX - rect.left) - item.x, 2) +
                        Math.pow((e.clientY - rect.top) - item.y, 2)
                    );
                    return { ...item, radius: currentRadius };
                }

                // Handle Arrow Resizing (Endpoints)
                if (item.type === 'arrow' && resizeOriginalItem.points) {
                    const newPoints = [...resizeOriginalItem.points];
                    if (resizeHandle === 'start') {
                        newPoints[0] = {
                            x: resizeOriginalItem.points[0].x + dx,
                            y: resizeOriginalItem.points[0].y + dy
                        };
                    } else if (resizeHandle === 'end') {
                        newPoints[newPoints.length - 1] = {
                            x: resizeOriginalItem.points[newPoints.length - 1].x + dx,
                            y: resizeOriginalItem.points[newPoints.length - 1].y + dy
                        };
                    }
                    return { ...item, points: newPoints };
                }

                // Handle Box Resizing (Note/Text/Sticker)
                if (item.type === 'note' || item.type === 'text' || item.type === 'sticker') {
                    return {
                        ...item,
                        width: Math.max(50, Math.max(50, resizeStart.w + dx)),
                        height: Math.max(50, Math.max(50, resizeStart.h + dy))
                    };
                }

                return item;
            }));
            return;
        }

        if (draggingId && dragStartPos && dragOriginalItem) {
            const dx = x - dragStartPos.x;
            const dy = y - dragStartPos.y;

            setItems(prev => prev.map(item => {
                if (item.id !== draggingId) return item;

                // Handle XY items (Note, Text, Circle)
                if (dragOriginalItem.x !== undefined && dragOriginalItem.y !== undefined) {
                    return {
                        ...item,
                        x: dragOriginalItem.x + dx,
                        y: dragOriginalItem.y + dy
                    };
                }

                // Handle Path items (Pen, Arrow)
                if (dragOriginalItem.points) {
                    return {
                        ...item,
                        points: dragOriginalItem.points.map(p => ({
                            x: p.x + dx,
                            y: p.y + dy
                        }))
                    };
                }

                return item;
            }));
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
                setActiveTool('select');
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
                setActiveTool('select');
            }
            setCurrentPath([]);
        }
        if (activeTool === 'circle' && isDrawing) {
            setIsDrawing(false);
            if (currentPath.length > 1) {
                const dx = currentPath[1].x - currentPath[0].x;
                const dy = currentPath[1].y - currentPath[0].y;
                const radius = Math.sqrt(dx * dx + dy * dy);

                if (radius > 5) {
                    setItems(prev => [...prev, {
                        id: Date.now().toString(),
                        type: 'circle',
                        x: currentPath[0].x,
                        y: currentPath[0].y,
                        radius,
                        stroke: penColor,
                        strokeWidth: 3
                    }]);
                    setActiveTool('select');
                }
            }
            setCurrentPath([]);
        }
        setDraggingId(null);
        setDragStartPos(null);
        setDragOriginalItem(null);
        setResizingId(null);
        setResizeOriginalItem(null);
        setResizeHandle(null);
    };

    // Keyboard Deletion
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
                // Prevent backspace from navigating back if not in an input
                const activeElement = document.activeElement;
                const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
                if (!isInput) {
                    deleteItem(selectedItemId);
                    setSelectedItemId(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemId]);

    const startResize = (e: React.MouseEvent, item: BoardItem, handle: string = 'default') => {
        e.stopPropagation();
        e.preventDefault();
        setResizingId(item.id);
        setResizeHandle(handle);
        setResizeOriginalItem(item); // Snapshot

        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            w: item.width || (item.type === 'note' ? 192 : 300),
            h: item.height || (item.type === 'note' ? 192 : 100)
        });
    };

    const startDrag = (e: React.MouseEvent, item: BoardItem) => {
        if (activeTool !== 'select') return;

        // Select logic
        setSelectedItemId(item.id);
        e.stopPropagation();

        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            setDraggingId(item.id);
            setDragStartPos({ x, y });
            setDragOriginalItem(item); // Snapshot current state
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
        if (activeTool === 'eraser') setActiveTool('select');
    };



    const handleToolClick = (tool: Tool) => {
        if (activeTool === tool) {
            setShowColorPicker(!showColorPicker);
        } else {
            setActiveTool(tool);
            if (['note', 'pen', 'arrow', 'circle'].includes(tool)) {
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
                <ToolButton icon="fa-circle" tool="circle" active={activeTool} onClick={() => handleToolClick('circle')} label="Circle" />
                {activeTool === 'circle' && showColorPicker && (
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

                <ToolButton icon="fa-calculator" tool="calculator" active={activeTool} onClick={() => handleToolClick('calculator')} label="Calculator" />
                <ToolButton icon="fa-house-chimney" imageSrc="/mortgage-icon.png" tool="mortgage-calc" active={activeTool} onClick={() => handleToolClick('mortgage-calc')} label="Mortgage Calc" />
                <ToolButton icon="fa-calendar" tool="calendar" active={activeTool} onClick={() => handleToolClick('calendar')} label="Calendar" />
                <ToolButton icon="fa-star" imageSrc="/pikachu.png" tool="sticker" active={activeTool} onClick={() => handleToolClick('sticker')} label="Pokemon" />
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
                    // Render Path/Arrow/Circle
                    if (item.type === 'pen' || item.type === 'arrow' || item.type === 'circle') {
                        if ((item.type === 'pen' || item.type === 'arrow') && (!item.points || item.points.length < 1)) return null;
                        if (item.type === 'arrow' && item.points!.length < 2) return null;
                        return (
                            <svg key={item.id} className="absolute inset-0 w-full h-full pointer-events-none">
                                {(activeTool === 'eraser' || activeTool === 'select') && (
                                    item.type === 'arrow' ? (
                                        <line
                                            x1={item.points![0].x}
                                            y1={item.points![0].y}
                                            x2={item.points![1].x}
                                            y2={item.points![1].y}
                                            stroke="transparent"
                                            strokeWidth={20}
                                            className={activeTool === 'eraser' ? 'cursor-cell' : 'cursor-pointer'}
                                            style={{ pointerEvents: 'all' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (activeTool === 'eraser') deleteItem(item.id);
                                                else if (activeTool === 'select') {
                                                    setSelectedItemId(item.id);
                                                    // Trigger drag
                                                }
                                            }}
                                            onMouseDown={(e) => startDrag(e, item)}
                                            onMouseEnter={(e) => {
                                                if (activeTool === 'eraser' && e.buttons === 1) deleteItem(item.id);
                                            }}
                                        />
                                    ) : item.type === 'circle' ? (
                                        <>
                                            <circle
                                                cx={item.x}
                                                cy={item.y}
                                                r={item.radius}
                                                fill="transparent"
                                                stroke="transparent"
                                                strokeWidth={20}
                                                className={activeTool === 'eraser' ? 'cursor-cell' : 'cursor-pointer'}
                                                style={{ pointerEvents: 'all' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (activeTool === 'eraser') deleteItem(item.id);
                                                    else if (activeTool === 'select') {
                                                        setSelectedItemId(item.id);
                                                    }
                                                }}
                                                onMouseDown={(e) => startDrag(e, item)}
                                                onMouseEnter={(e) => {
                                                    if (activeTool === 'eraser' && e.buttons === 1) deleteItem(item.id);
                                                }}
                                            />
                                            {selectedItemId === item.id && activeTool === 'select' && item.radius && (
                                                <circle
                                                    cx={item.x! + item.radius}
                                                    cy={item.y}
                                                    r={6}
                                                    fill="white"
                                                    stroke="#3b82f6"
                                                    strokeWidth={2}
                                                    className="cursor-ew-resize"
                                                    style={{ pointerEvents: 'all' }}
                                                    onMouseDown={(e) => startResize(e, item)}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <polyline
                                            points={item.points!.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke="transparent"
                                            strokeWidth={20}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className={activeTool === 'eraser' ? 'cursor-cell' : 'cursor-pointer'}
                                            style={{ pointerEvents: 'all' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (activeTool === 'eraser') deleteItem(item.id);
                                                else if (activeTool === 'select') {
                                                    setSelectedItemId(item.id);
                                                }
                                            }}
                                            onMouseDown={(e) => startDrag(e, item)}
                                            onMouseEnter={(e) => {
                                                if (activeTool === 'eraser' && e.buttons === 1) deleteItem(item.id);
                                            }}
                                        />
                                    )
                                )}
                                {item.type === 'arrow' ? (
                                    <>
                                        <line
                                            x1={item.points![0].x}
                                            y1={item.points![0].y}
                                            x2={item.points![1].x}
                                            y2={item.points![1].y}
                                            stroke={item.stroke}
                                            strokeWidth={item.strokeWidth}
                                            markerEnd={`url(#arrowhead-${item.stroke?.replace('#', '')})`}
                                            style={{
                                                opacity: activeTool === 'eraser' ? 0.3 : 1,
                                                transition: 'opacity 0.2s',
                                                filter: selectedItemId === item.id ? 'drop-shadow(0 0 4px #3b82f6)' : 'none'
                                            }}
                                        />
                                        {selectedItemId === item.id && activeTool === 'select' && item.points && (
                                            <>
                                                {/* Start Handle */}
                                                <circle
                                                    cx={item.points[0].x}
                                                    cy={item.points[0].y}
                                                    r={5}
                                                    fill="white"
                                                    stroke="#3b82f6"
                                                    strokeWidth={2}
                                                    className="cursor-move"
                                                    style={{ pointerEvents: 'all' }}
                                                    onMouseDown={(e) => startResize(e, item, 'start')}
                                                />
                                                {/* End Handle */}
                                                <circle
                                                    cx={item.points[item.points.length - 1].x}
                                                    cy={item.points[item.points.length - 1].y}
                                                    r={5}
                                                    fill="white"
                                                    stroke="#3b82f6"
                                                    strokeWidth={2}
                                                    className="cursor-move"
                                                    style={{ pointerEvents: 'all' }}
                                                    onMouseDown={(e) => startResize(e, item, 'end')}
                                                />
                                            </>
                                        )}
                                    </>
                                ) : item.type === 'circle' ? (
                                    <circle
                                        cx={item.x}
                                        cy={item.y}
                                        r={item.radius}
                                        fill="none"
                                        stroke={item.stroke}
                                        strokeWidth={item.strokeWidth}
                                        style={{
                                            opacity: activeTool === 'eraser' ? 0.3 : 1,
                                            transition: 'opacity 0.2s',
                                            filter: selectedItemId === item.id ? 'drop-shadow(0 0 4px #3b82f6)' : 'none'
                                        }}
                                    />
                                ) : (
                                    <polyline
                                        points={item.points!.map(p => `${p.x},${p.y}`).join(' ')}
                                        fill="none"
                                        stroke={item.stroke}
                                        strokeWidth={item.strokeWidth}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{
                                            opacity: activeTool === 'eraser' ? 0.3 : 1,
                                            transition: 'opacity 0.2s',
                                            filter: selectedItemId === item.id ? 'drop-shadow(0 0 4px #3b82f6)' : 'none'
                                        }}
                                    />
                                )}
                            </svg>
                        );
                    }

                    // Render Notes/Text
                    return (
                        <div
                            key={item.id}
                            className={`absolute group top-0 left-0 transition-transform hover:z-30 ${activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            style={{
                                transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation || 0}deg)`,
                                zIndex: selectedItemId === item.id ? 40 : undefined
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
                                    className={`p-4 shadow-lg ${getColorClass(item.color || 'yellow')} flex flex-col justify-start relative transition-shadow hover:shadow-2xl ${selectedItemId === item.id ? 'ring-2 ring-indigo-600 ring-offset-2' : ''}`}
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
                                    className={`bg-white/50 rounded-lg p-2 focus-within:bg-white focus-within:shadow-sm border border-transparent focus-within:border-slate-200 transition-colors relative group/text ${selectedItemId === item.id ? 'ring-1 ring-indigo-600 ring-offset-1' : ''}`}
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

                {/* Sticker (Pokemon) Rendering */}
                {items.map(item => {
                    if (item.type !== 'sticker' || !item.imageUrl) return null;
                    return (
                        <div
                            key={item.id}
                            className={`absolute group top-0 left-0 transition-transform hover:z-30 ${activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            style={{
                                transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation || 0}deg)`,
                                zIndex: selectedItemId === item.id ? 40 : undefined,
                                width: item.width || 100,
                                height: item.height || 100
                            }}
                            onMouseDown={(e) => startDrag(e, item)}
                        >
                            <img
                                src={item.imageUrl}
                                alt="Sticker"
                                className={`w-full h-full object-contain select-none pointer-events-none ${selectedItemId === item.id ? 'ring-2 ring-indigo-600 ring-offset-2 rounded-lg' : ''}`}
                            />

                            {/* Delete Button */}
                            <button
                                className="absolute -bottom-3 -left-3 w-6 h-6 bg-white rounded-full shadow-md text-slate-400 hover:text-red-500 hover:scale-110 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 text-xs border border-slate-100"
                                onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>

                            {/* Resize Handle */}
                            <div
                                className="absolute bottom-1 right-1 w-6 h-6 cursor-se-resize z-50 opacity-0 group-hover:opacity-100 flex items-end justify-end p-1"
                                onMouseDown={(e) => startResize(e, item)}
                            >
                                <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                            </div>
                        </div>
                    );

                })}

                {/* Calculator Rendering */}
                {items.map(item => {
                    if (item.type !== 'calculator') return null;

                    const handleCalcClick = (val: string) => {
                        let newContent = item.content || '0';
                        if (val === 'C') {
                            newContent = '0';
                        } else if (val === '=') {
                            try {
                                // Safe evaluation
                                // eslint-disable-next-line
                                newContent = String(eval(newContent.replace(/[^-()\d/*+.]/g, '')));
                            } catch (err) {
                                newContent = 'Error';
                            }
                        } else {
                            if (newContent === '0' || newContent === 'Error') newContent = val;
                            else newContent += val;
                        }
                        updateItemContent(item.id, newContent);
                    };

                    return (
                        <div
                            key={item.id}
                            className={`absolute group bg-slate-900 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 overflow-hidden ${activeTool === 'select' ? 'shadow-indigo-500/20' : ''}`}
                            style={{
                                transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation || 0}deg)`,
                                width: item.width || 240,
                                height: item.height || 360,
                                zIndex: selectedItemId === item.id ? 50 : undefined
                            }}
                            onMouseDown={(e) => startDrag(e, item)}
                        >
                            {/* Display */}
                            <div className="w-full h-16 bg-slate-800 rounded-xl mb-2 flex items-center justify-end px-4 text-3xl font-mono text-white overflow-hidden">
                                {item.content}
                            </div>

                            {/* Buttons Grid */}
                            <div className="grid grid-cols-4 gap-2 flex-1">
                                {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map(btn => (
                                    <button
                                        key={btn}
                                        className={`rounded-lg text-lg font-bold transition-all active:scale-95 ${['/', '*', '-', '+', '='].includes(btn)
                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                            : btn === 'C'
                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                                            }`}
                                        onMouseDown={(e) => { e.stopPropagation(); handleCalcClick(btn); }}
                                    >
                                        {btn}
                                    </button>
                                ))}
                            </div>

                            {/* Delete Button */}
                            <button
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white shadow-md hover:scale-110 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                            >
                                <i className="fa-solid fa-xmark text-xs"></i>
                            </button>
                        </div>
                    );
                })}

                {/* Mortgage Calculator Rendering */}
                {items.map(item => {
                    if (item.type !== 'mortgage-calc') return null;

                    let data = { principal: 300000, rate: 3.5, years: 30, downPaymentPercent: 20 };
                    try { data = { ...data, ...JSON.parse(item.content || '{}') }; } catch (e) { }

                    const calculatePayment = () => {
                        const principal = data.principal || 0;
                        const downPayment = principal * ((data.downPaymentPercent || 0) / 100);
                        const loanAmount = principal - downPayment;
                        const r = (data.rate || 0) / 100 / 12;
                        const n = (data.years || 0) * 12;
                        if (r === 0) return loanAmount / n;
                        return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                    };
                    const monthlyPayment = calculatePayment();

                    const updateData = (key: string, val: number) => {
                        const newData = { ...data, [key]: val };
                        updateItemContent(item.id, JSON.stringify(newData));
                    };

                    return (
                        <div
                            key={item.id}
                            className={`absolute group bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden ${activeTool === 'select' ? 'shadow-indigo-500/20 ring-1 ring-indigo-500' : ''}`}
                            style={{
                                transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation || 0}deg)`,
                                width: item.width || 320,
                                height: item.height || 480,
                                zIndex: selectedItemId === item.id ? 50 : undefined
                            }}
                            onMouseDown={(e) => startDrag(e, item)}
                        >
                            {/* Header */}
                            <div className="bg-slate-900 text-white p-4 flex items-center justify-between cursor-move">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-house-chimney text-emerald-400"></i>
                                    <span className="font-bold text-sm">Mortgage Estimator</span>
                                </div>
                                <button
                                    className="text-slate-400 hover:text-white transition-colors"
                                    onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-5 flex flex-col gap-4 bg-slate-50 flex-1">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Property Price</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                        <input
                                            type="number"
                                            className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                            value={data.principal}
                                            onChange={(e) => updateData('principal', parseFloat(e.target.value))}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Down Payment %</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full pl-3 pr-6 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                            value={data.downPaymentPercent}
                                            onChange={(e) => updateData('downPaymentPercent', parseFloat(e.target.value))}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Interest %</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full pl-3 pr-6 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                                value={data.rate}
                                                onChange={(e) => updateData('rate', parseFloat(e.target.value))}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Years</label>
                                        <input
                                            type="number"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                            value={data.years}
                                            onChange={(e) => updateData('years', parseFloat(e.target.value))}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-slate-200">
                                    <div className="flex justify-between items-end">
                                        <span className="text-sm font-medium text-slate-500">Monthly Payment</span>
                                        <span className="text-2xl font-black text-indigo-600">
                                            ${monthlyPayment ? monthlyPayment.toFixed(2) : '0.00'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Calendar Rendering */}
                {items.map(item => {
                    if (item.type !== 'calendar') return null;

                    let data = { view: 'month', currentDate: new Date().getTime(), events: [] as { id: string, date: number, title: string }[] };
                    try { data = { ...data, ...JSON.parse(item.content || '{}') }; } catch (e) { }

                    const currentDate = new Date(data.currentDate);
                    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

                    const updateState = (updates: Partial<typeof data>) => {
                        updateItemContent(item.id, JSON.stringify({ ...data, ...updates }));
                    };

                    const handlePrev = () => {
                        const newDate = new Date(currentDate);
                        if (data.view === 'month') newDate.setMonth(newDate.getMonth() - 1);
                        else newDate.setDate(newDate.getDate() - 7);
                        updateState({ currentDate: newDate.getTime() });
                    };

                    const handleNext = () => {
                        const newDate = new Date(currentDate);
                        if (data.view === 'month') newDate.setMonth(newDate.getMonth() + 1);
                        else newDate.setDate(newDate.getDate() + 7);
                        updateState({ currentDate: newDate.getTime() });
                    };

                    const addEvent = (dayTimestamp: number) => {
                        const title = prompt("Event Title:");
                        if (title) {
                            const newEvents = [...data.events, { id: Date.now().toString(), date: dayTimestamp, title }];
                            updateState({ events: newEvents });
                        }
                    };

                    const deleteEvent = (eventId: string) => {
                        if (confirm("Delete this event?")) {
                            const newEvents = data.events.filter(e => e.id !== eventId);
                            updateState({ events: newEvents });
                        }
                    };

                    const renderMonthGrid = () => {
                        const days = [];
                        for (let i = 0; i < firstDayOfMonth; i++) {
                            days.push(<div key={`empty-${i}`} className="h-full bg-slate-50/50"></div>);
                        }
                        for (let day = 1; day <= daysInMonth; day++) {
                            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                            const dayEvents = data.events.filter(e => new Date(e.date).toDateString() === date.toDateString());
                            const isToday = new Date().toDateString() === date.toDateString();

                            days.push(
                                <div
                                    key={day}
                                    className={`h-full border border-slate-100 p-1 flex flex-col group/day relative hover:bg-slate-50 transition-colors ${isToday ? 'bg-indigo-50/30' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); addEvent(date.getTime()); }}
                                >
                                    <span className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{day}</span>
                                    <div className="flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
                                        {dayEvents.map(ev => (
                                            <div
                                                key={ev.id}
                                                className="text-[10px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded truncate cursor-pointer hover:bg-indigo-200"
                                                onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }}
                                                title={ev.title}
                                            >
                                                {ev.title}
                                            </div>
                                        ))}
                                    </div>
                                    <button className="opacity-0 group-hover/day:opacity-100 absolute top-1 right-1 text-slate-300 hover:text-indigo-600 transition-opacity">
                                        <i className="fa-solid fa-plus text-[10px]"></i>
                                    </button>
                                </div>
                            );
                        }
                        return days;
                    };

                    // Simple Week View Implementation
                    const renderWeekGrid = () => {
                        const startOfWeek = new Date(currentDate);
                        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday start

                        const days = [];
                        for (let i = 0; i < 7; i++) {
                            const date = new Date(startOfWeek);
                            date.setDate(startOfWeek.getDate() + i);
                            const dayEvents = data.events.filter(e => new Date(e.date).toDateString() === date.toDateString());
                            const isToday = new Date().toDateString() === date.toDateString();

                            days.push(
                                <div
                                    key={i}
                                    className="flex-1 h-full border-r border-slate-100 last:border-r-0 flex flex-col hover:bg-slate-50"
                                    onClick={(e) => { e.stopPropagation(); addEvent(date.getTime()); }}
                                >
                                    <div className={`text-center py-2 border-b border-slate-100 ${isToday ? 'bg-indigo-50' : ''}`}>
                                        <div className="text-xs uppercase text-slate-400 font-bold mb-1">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</div>
                                        <div className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full mx-auto ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
                                            {date.getDate()}
                                        </div>
                                    </div>
                                    <div className="flex-1 p-1 flex flex-col gap-1 overflow-y-auto">
                                        {dayEvents.map(ev => (
                                            <div
                                                key={ev.id}
                                                className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded cursor-pointer hover:bg-indigo-200"
                                                onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }}
                                            >
                                                {ev.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        }
                        return <div className="flex w-full h-full">{days}</div>;
                    };

                    return (
                        <div
                            key={item.id}
                            className={`absolute group bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col overflow-hidden ${activeTool === 'select' ? 'shadow-indigo-500/20 ring-1 ring-indigo-500' : ''}`}
                            style={{
                                transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation || 0}deg)`,
                                width: item.width || 500,
                                height: item.height || 400,
                                zIndex: selectedItemId === item.id ? 50 : undefined
                            }}
                            onMouseDown={(e) => startDrag(e, item)}
                        >
                            {/* Header */}
                            <div className="bg-white border-b border-slate-100 p-3 flex items-center justify-between cursor-move">
                                <div className="flex items-center gap-4">
                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                        <button
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${data.view === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            onClick={(e) => { e.stopPropagation(); updateState({ view: 'month' }); }}
                                        >
                                            Month
                                        </button>
                                        <button
                                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${data.view === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            onClick={(e) => { e.stopPropagation(); updateState({ view: 'week' }); }}
                                        >
                                            Week
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); handlePrev() }} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">
                                            <i className="fa-solid fa-chevron-left text-xs"></i>
                                        </button>
                                        <span className="text-sm font-bold text-slate-700 w-24 text-center">
                                            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button onClick={(e) => { e.stopPropagation(); handleNext() }} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">
                                            <i className="fa-solid fa-chevron-right text-xs"></i>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            </div>

                            {/* Calendar Grid */}
                            <div className="flex-1 bg-white overflow-hidden flex flex-col">
                                {data.view === 'month' && (
                                    <>
                                        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                                <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">{d}</div>
                                            ))}
                                        </div>
                                        <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                                            {renderMonthGrid()}
                                        </div>
                                    </>
                                )}
                                {data.view === 'week' && renderWeekGrid()}
                            </div>

                            {/* Resize Handle */}
                            <div
                                className="absolute bottom-1 right-1 w-6 h-6 cursor-se-resize z-50 opacity-0 group-hover:opacity-100 flex items-end justify-end p-1"
                                onMouseDown={(e) => startResize(e, item)}
                            >
                                <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                            </div>
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
                    {currentPath.length > 1 && activeTool === 'circle' && (
                        <circle
                            cx={currentPath[0].x}
                            cy={currentPath[0].y}
                            r={Math.sqrt(Math.pow(currentPath[1].x - currentPath[0].x, 2) + Math.pow(currentPath[1].y - currentPath[0].y, 2))}
                            fill="none"
                            stroke={penColor}
                            strokeWidth="3"
                        />
                    )}
                </svg>
            </div>
        </div >
    );
};

const ToolButton: React.FC<{ icon: string; imageSrc?: string; tool: Tool; active: Tool; onClick: () => void; label?: string; disabled?: boolean }> = ({ icon, imageSrc, tool, active, onClick, label, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active === tool
            ? 'bg-indigo-600 text-white shadow-md scale-105'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        title={label || tool}
    >
        {imageSrc ? (
            <img src={imageSrc} alt={label || tool} className="w-6 h-6 object-contain filter drop-shadow-sm" />
        ) : (
            <i className={`fa-solid ${icon}`}></i>
        )}
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
