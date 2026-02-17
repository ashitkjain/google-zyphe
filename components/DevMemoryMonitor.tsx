/**
 * DevMemoryMonitor — A floating dev-only widget that tracks browser data sizes.
 * Toggle with Ctrl+Shift+M (or Cmd+Shift+M on Mac).
 * Only renders in development mode.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

interface DataEntry {
    label: string;
    value: any;
}

interface MemorySnapshot {
    jsHeapUsed: string;
    jsHeapTotal: string;
    jsHeapLimit: string;
    domNodes: number;
    imgCount: number;
    imgDecodedEstimate: string;
    stateBreakdown: { label: string; sizeKB: string }[];
    totalStateKB: string;
    timestamp: string;
}

const roughSizeOf = (obj: any, seen = new WeakSet()): number => {
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'boolean') return 4;
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'string') return obj.length * 2;

    if (typeof obj === 'object') {
        if (seen.has(obj)) return 0;
        seen.add(obj);

        let size = 0;
        if (Array.isArray(obj)) {
            for (const item of obj) {
                size += roughSizeOf(item, seen);
            }
        } else {
            for (const key of Object.keys(obj)) {
                size += key.length * 2; // key
                size += roughSizeOf(obj[key], seen); // value
            }
        }
        return size;
    }
    return 0;
};

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

interface DevMemoryMonitorProps {
    /** Key-value pairs of React state to track. Pass your important state vars here. */
    trackedState: DataEntry[];
}

const DevMemoryMonitor: React.FC<DevMemoryMonitorProps> = ({ trackedState }) => {
    const [visible, setVisible] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);
    const [history, setHistory] = useState<{ time: string; heapMB: number; stateMB: number }[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Only run in development
    if (process.env.NODE_ENV === 'production') return null;

    const takeSnapshot = useCallback(() => {
        // 1. JS Heap (Chrome only)
        const perf = (performance as any);
        const mem = perf?.memory;
        const jsHeapUsed = mem ? formatBytes(mem.usedJSHeapSize) : 'N/A';
        const jsHeapTotal = mem ? formatBytes(mem.totalJSHeapSize) : 'N/A';
        const jsHeapLimit = mem ? formatBytes(mem.jsHeapSizeLimit) : 'N/A';

        // 2. DOM
        const domNodes = document.querySelectorAll('*').length;

        // 3. Images
        const imgs = document.querySelectorAll('img');
        const imgCount = imgs.length;
        let imgDecodedEstimate = 0;
        imgs.forEach(img => {
            if (img.naturalWidth && img.naturalHeight) {
                imgDecodedEstimate += img.naturalWidth * img.naturalHeight * 4; // RGBA
            }
        });

        // 4. React state sizes
        const stateBreakdown: { label: string; sizeKB: string }[] = [];
        let totalBytes = 0;

        for (const entry of trackedState) {
            const size = roughSizeOf(entry.value);
            totalBytes += size;
            stateBreakdown.push({
                label: entry.label,
                sizeKB: formatBytes(size)
            });
        }

        // Sort by size descending
        stateBreakdown.sort((a, b) => {
            const aNum = roughSizeOf(trackedState.find(t => t.label === a.label)?.value);
            const bNum = roughSizeOf(trackedState.find(t => t.label === b.label)?.value);
            return bNum - aNum;
        });

        const snap: MemorySnapshot = {
            jsHeapUsed,
            jsHeapTotal,
            jsHeapLimit,
            domNodes,
            imgCount,
            imgDecodedEstimate: formatBytes(imgDecodedEstimate),
            stateBreakdown,
            totalStateKB: formatBytes(totalBytes),
            timestamp: new Date().toLocaleTimeString()
        };

        setSnapshot(snap);

        // Track history (last 20 samples)
        const heapMB = mem ? mem.usedJSHeapSize / (1024 * 1024) : 0;
        const stateMB = totalBytes / (1024 * 1024);
        setHistory(prev => [...prev.slice(-19), {
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            heapMB: parseFloat(heapMB.toFixed(2)),
            stateMB: parseFloat(stateMB.toFixed(4))
        }]);
    }, [trackedState]);

    // Keyboard shortcut: Ctrl+Shift+M
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
                e.preventDefault();
                setVisible(v => !v);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Auto-refresh every 3s when visible
    useEffect(() => {
        if (visible) {
            takeSnapshot();
            intervalRef.current = setInterval(takeSnapshot, 3000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [visible, takeSnapshot]);

    if (!visible) return null;

    const getColorForSize = (sizeStr: string): string => {
        if (sizeStr.includes('MB')) return '#ef4444';
        if (sizeStr.includes('KB')) {
            const num = parseFloat(sizeStr);
            if (num > 500) return '#f59e0b';
            if (num > 100) return '#eab308';
            return '#22c55e';
        }
        return '#6b7280';
    };

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 16,
                left: 16,
                zIndex: 99999,
                fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
                fontSize: 11,
                color: '#e2e8f0',
                pointerEvents: 'auto',
                maxWidth: minimized ? 200 : 380,
                transition: 'max-width 0.2s ease'
            }}
        >
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                border: '1px solid #334155',
                borderRadius: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05) inset',
                overflow: 'hidden',
                backdropFilter: 'blur(20px)'
            }}>
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        borderBottom: '1px solid #334155',
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                    onClick={() => setMinimized(m => !m)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: '#22c55e',
                            boxShadow: '0 0 6px #22c55e',
                            animation: 'pulse 2s infinite'
                        }} />
                        <span style={{ fontWeight: 700, letterSpacing: 0.5, color: '#a5b4fc' }}>
                            MEMORY MONITOR
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); takeSnapshot(); }}
                            style={{
                                background: 'rgba(99, 102, 241, 0.3)', border: 'none', color: '#a5b4fc',
                                padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 10
                            }}
                        >
                            ↻
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setVisible(false); }}
                            style={{
                                background: 'rgba(239, 68, 68, 0.3)', border: 'none', color: '#fca5a5',
                                padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 10
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {!minimized && snapshot && (
                    <div style={{ padding: '10px 12px' }}>
                        {/* JS Heap */}
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                                JS Heap Memory
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                                <div style={{ background: '#1e293b', padding: '4px 8px', borderRadius: 6, border: '1px solid #334155' }}>
                                    <div style={{ color: '#64748b', fontSize: 9 }}>Used</div>
                                    <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{snapshot.jsHeapUsed}</div>
                                </div>
                                <div style={{ background: '#1e293b', padding: '4px 8px', borderRadius: 6, border: '1px solid #334155' }}>
                                    <div style={{ color: '#64748b', fontSize: 9 }}>Total</div>
                                    <div style={{ color: '#cbd5e1', fontWeight: 600 }}>{snapshot.jsHeapTotal}</div>
                                </div>
                                <div style={{ background: '#1e293b', padding: '4px 8px', borderRadius: 6, border: '1px solid #334155' }}>
                                    <div style={{ color: '#64748b', fontSize: 9 }}>Limit</div>
                                    <div style={{ color: '#94a3b8', fontWeight: 600 }}>{snapshot.jsHeapLimit}</div>
                                </div>
                            </div>
                        </div>

                        {/* Browser Stats */}
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                                Browser
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                                <div style={{ background: '#1e293b', padding: '4px 8px', borderRadius: 6, border: '1px solid #334155' }}>
                                    <div style={{ color: '#64748b', fontSize: 9 }}>DOM</div>
                                    <div style={{ color: snapshot.domNodes > 3000 ? '#ef4444' : snapshot.domNodes > 1500 ? '#f59e0b' : '#22c55e', fontWeight: 700 }}>
                                        {snapshot.domNodes.toLocaleString()}
                                    </div>
                                </div>
                                <div style={{ background: '#1e293b', padding: '4px 8px', borderRadius: 6, border: '1px solid #334155' }}>
                                    <div style={{ color: '#64748b', fontSize: 9 }}>Images</div>
                                    <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{snapshot.imgCount}</div>
                                </div>
                                <div style={{ background: '#1e293b', padding: '4px 8px', borderRadius: 6, border: '1px solid #334155' }}>
                                    <div style={{ color: '#64748b', fontSize: 9 }}>Img RAM</div>
                                    <div style={{ color: getColorForSize(snapshot.imgDecodedEstimate), fontWeight: 700 }}>
                                        {snapshot.imgDecodedEstimate}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* React State Breakdown */}
                        <div>
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4
                            }}>
                                <span style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    React State
                                </span>
                                <span style={{
                                    color: getColorForSize(snapshot.totalStateKB),
                                    fontSize: 10, fontWeight: 700,
                                    background: 'rgba(99, 102, 241, 0.1)',
                                    padding: '1px 6px', borderRadius: 4
                                }}>
                                    Σ {snapshot.totalStateKB}
                                </span>
                            </div>
                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                {snapshot.stateBreakdown.map((item, i) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '3px 8px',
                                        borderRadius: 4,
                                        background: i % 2 === 0 ? 'rgba(30,41,59,0.5)' : 'transparent',
                                        transition: 'background 0.15s'
                                    }}>
                                        <span style={{ color: '#94a3b8', fontSize: 10 }}>{item.label}</span>
                                        <span style={{
                                            color: getColorForSize(item.sizeKB),
                                            fontWeight: 700,
                                            fontSize: 10
                                        }}>
                                            {item.sizeKB}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Timestamp */}
                        <div style={{
                            marginTop: 8, paddingTop: 6, borderTop: '1px solid #1e293b',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span style={{ color: '#475569', fontSize: 9 }}>
                                Updated {snapshot.timestamp}
                            </span>
                            <span style={{ color: '#475569', fontSize: 9 }}>
                                ⌘⇧M to toggle
                            </span>
                        </div>
                    </div>
                )}

                {/* Minimized view */}
                {minimized && snapshot && (
                    <div style={{ padding: '6px 12px', display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                        <span style={{ color: '#94a3b8' }}>Heap: <b style={{ color: '#f1f5f9' }}>{snapshot.jsHeapUsed}</b></span>
                        <span style={{ color: '#94a3b8' }}>State: <b style={{ color: getColorForSize(snapshot.totalStateKB) }}>{snapshot.totalStateKB}</b></span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DevMemoryMonitor;
