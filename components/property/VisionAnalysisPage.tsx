// Full-screen overlay that visualizes the saved `vision_v2` document for a
// property. Deliberately self-contained — does NOT depend on or modify the
// existing property analysis UI, so iteration here can't regress the
// production flow.
//
// Render structure:
//   - Header (address, run/re-run, close)
//   - Status row (pipeline version, model, timing, counts)
//   - One section per semantic group, each with:
//       - Group label + photo count + "sent to LLM" count
//       - Horizontal strip of canonical + sent photos
//       - The full analysis text
//       - Collapsed list of "+N similar" photos (mirrors not in the strip)
//   - Footer: photos with no analysis (unclassified / fetch-failed)
//
// Subscribes live to Firestore so a Run/Re-run triggers progress without a
// page reload.

import React, { useEffect, useMemo, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import { PropertyData } from '../../types';

interface Props {
    propertyData: PropertyData;
    // Optional close handler — when present the page renders as a fullscreen
    // overlay with a Close button. When absent (the default path now), it
    // renders as a normal section page inside the property nav.
    onClose?: () => void;
}

interface PhotoEntry {
    photo_index?: number;
    url?: string;
    analysis?: string | null;
    score?: number | null;
    error?: string | null;
    group_label?: string | null;
    group_member_indices?: number[];
    group_sent_indices?: number[];
    mirror_of?: number | null;
    mirror_of_url?: string | null;
    sent_to_llm?: boolean | null;
}

interface VisionDoc {
    pipeline_version?: string;
    model?: string;
    analyzed_at_iso?: string;
    photo_count?: number;
    photo_count_total?: number;
    analyzed_photo_count?: number;
    group_count?: number;
    photos?: PhotoEntry[];
    timing_ms?: { fetch?: number; classify?: number; analyze?: number; total?: number };
    // Progress fields written incrementally as the pipeline runs.
    status?: 'fetching' | 'classifying' | 'analyzing' | 'done' | 'error';
    phase?: string;
    classify_total?: number;
    classify_done?: number;
    analyze_total?: number;
    analyze_done?: number;
    error?: string;
}

interface GroupView {
    label: string;
    canonical: PhotoEntry;
    sent: PhotoEntry[];      // members in the strip (sent_to_llm)
    similar: PhotoEntry[];   // mirrors not in the strip
}

function groupPhotos(photos: PhotoEntry[] | undefined): { groups: GroupView[]; orphans: PhotoEntry[] } {
    if (!Array.isArray(photos)) return { groups: [], orphans: [] };

    const canonicals = photos.filter(p => p.analysis != null && !p.mirror_of_url && !p.mirror_of);
    const mirrors = photos.filter(p => p.mirror_of_url != null || p.mirror_of != null);
    const orphans = photos.filter(p => p.analysis == null && p.mirror_of == null && p.mirror_of_url == null);

    const groups: GroupView[] = canonicals.map(canonical => {
        const groupMirrors = mirrors.filter(m =>
            (m.mirror_of_url && m.mirror_of_url === canonical.url) ||
            (m.mirror_of != null && m.mirror_of === canonical.photo_index)
        );
        const sent = groupMirrors.filter(m => m.sent_to_llm === true);
        const similar = groupMirrors.filter(m => m.sent_to_llm !== true);
        return {
            label: canonical.group_label || 'Unlabeled',
            canonical,
            sent,
            similar,
        };
    });

    return { groups, orphans };
}

const VisionAnalysisPage: React.FC<Props> = ({ propertyData, onClose }) => {
    const zpid = propertyData?.zpid ? String(propertyData.zpid) : '';
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [docData, setDocData] = useState<VisionDoc | null>(null);
    const [showSimilarFor, setShowSimilarFor] = useState<Record<number, boolean>>({});
    // Wall-clock elapsed timer. Driven by local `running` state + the
    // pipeline's status field so it continues ticking even if the client
    // callable times out (the server keeps working, the page keeps timing).
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [elapsedMs, setElapsedMs] = useState(0);

    useEffect(() => {
        if (!zpid) return;
        const ref = doc(db, 'properties', zpid, 'analysis', 'vision_v2');
        const unsub = onSnapshot(ref, (snap) => {
            setDocData(snap.exists() ? (snap.data() as VisionDoc) : null);
        });
        return unsub;
    }, [zpid]);

    const { groups, orphans } = useMemo(() => groupPhotos(docData?.photos), [docData]);

    // True while either the local callable is in-flight OR the saved doc
    // is reporting an in-progress status (covers the case where the client
    // disconnected but the server keeps working).
    const inProgress = running || (docData?.status === 'fetching' || docData?.status === 'classifying' || docData?.status === 'analyzing');

    // Start the timer when we transition into "in progress" and stop when
    // we leave it. The interval drives `elapsedMs` every 250ms so the
    // displayed seconds tick smoothly.
    useEffect(() => {
        if (!inProgress) {
            setStartedAt(null);
            setElapsedMs(0);
            return;
        }
        const start = startedAt ?? Date.now();
        if (startedAt == null) setStartedAt(start);
        const tick = () => setElapsedMs(Date.now() - start);
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [inProgress, startedAt]);

    const formatElapsed = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
    };

    const handleRun = async () => {
        if (!zpid || running) return;
        setError(null);
        setRunning(true);
        try {
            const functions = getFunctions();
            // 540s mirrors the function's own timeoutSeconds. The default
            // (70s) is far too short for properties with many photos —
            // 76 photos × classify + sequential analysis comfortably
            // exceeds one minute of wall-clock.
            const fn = httpsCallable(functions, 'runVisionAnalysisForProperty', { timeout: 540000 });
            await fn({ zpid });
        } catch (e: any) {
            console.error('[VisionAnalysisPage] run failed', e);
            setError(e?.message || String(e));
        } finally {
            setRunning(false);
        }
    };

    const overlay = !!onClose;
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
        overlay
            ? <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto">{children}</div>
            : <div className="bg-slate-50">{children}</div>;

    return (
        <Wrapper>
            <div className="max-w-6xl mx-auto px-6 py-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-black text-slate-900">Vision Analysis</h1>
                        <p className="text-sm text-slate-600">{propertyData?.address || zpid}</p>
                        <p className="text-xs text-slate-400 font-mono">
                            properties/{zpid}/analysis/vision_v2
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {inProgress && (
                            <span className="inline-flex items-center gap-2 px-3 py-2 text-sm font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                                {formatElapsed(elapsedMs)}
                            </span>
                        )}
                        <button
                            onClick={handleRun}
                            disabled={!zpid || inProgress}
                            className="px-4 py-2 text-sm font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {inProgress ? 'Running…' : (docData ? 'Re-run' : 'Run Analysis')}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-bold rounded-lg border border-slate-300 text-slate-700 hover:bg-white"
                            >
                                Close
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded mb-4">
                        <div className="font-bold">{error}</div>
                        {docData?.error && <div className="text-xs mt-1">Server: {docData.error}</div>}
                        {!docData?.error && error.includes('deadline-exceeded') && (
                            <div className="text-xs mt-1 text-red-600">
                                The client timed out, but the function is likely still running on the server. Watch the progress below — the page will update when it finishes.
                            </div>
                        )}
                    </div>
                )}

                {/* Live progress banner while the pipeline is mid-run */}
                {docData && docData.status && docData.status !== 'done' && docData.status !== 'error' && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 mb-4 flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <div className="flex-1">
                            <div className="text-sm font-bold text-indigo-900 flex items-center justify-between">
                                <span>{docData.phase || docData.status}</span>
                                <span className="text-xs font-mono text-indigo-700">{formatElapsed(elapsedMs)}</span>
                            </div>
                            {docData.status === 'classifying' && docData.classify_total ? (
                                <div className="w-full bg-indigo-100 rounded h-1.5 mt-1.5">
                                    <div
                                        className="bg-indigo-600 h-1.5 rounded transition-all"
                                        style={{ width: `${Math.round(((docData.classify_done || 0) / docData.classify_total) * 100)}%` }}
                                    />
                                </div>
                            ) : null}
                            {docData.status === 'analyzing' && docData.analyze_total ? (
                                <div className="w-full bg-indigo-100 rounded h-1.5 mt-1.5">
                                    <div
                                        className="bg-indigo-600 h-1.5 rounded transition-all"
                                        style={{ width: `${Math.round(((docData.analyze_done || 0) / docData.analyze_total) * 100)}%` }}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

                {docData?.status === 'error' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-800">
                        <div className="font-bold">Pipeline failed</div>
                        <div className="text-xs mt-1">{docData.error || 'unknown error'}</div>
                    </div>
                )}

                {/* Status row */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                        <div className="text-slate-500 uppercase font-bold tracking-wide">Pipeline</div>
                        <div className="text-slate-900 font-mono mt-1">{docData?.pipeline_version || '—'}</div>
                    </div>
                    <div>
                        <div className="text-slate-500 uppercase font-bold tracking-wide">Model</div>
                        <div className="text-slate-900 font-mono mt-1">{docData?.model || '—'}</div>
                    </div>
                    <div>
                        <div className="text-slate-500 uppercase font-bold tracking-wide">Photos</div>
                        <div className="text-slate-900 mt-1">
                            {docData ? `${docData.analyzed_photo_count} analyses · ${docData.group_count} groups · ${docData.photo_count} total` : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 uppercase font-bold tracking-wide">Timing</div>
                        <div className="text-slate-900 mt-1">
                            {docData?.timing_ms ? `${Math.round((docData.timing_ms.total || 0)/1000)}s total` : '—'}
                            {docData?.timing_ms && (
                                <span className="text-slate-500 ml-1">
                                    (fetch {Math.round((docData.timing_ms.fetch || 0)/1000)}s · classify {Math.round((docData.timing_ms.classify || 0)/1000)}s · analyze {Math.round((docData.timing_ms.analyze || 0)/1000)}s)
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {!docData && (
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-sm">No analysis saved yet.</p>
                        <p className="text-xs mt-2">Click "Run Analysis" above to generate one.</p>
                    </div>
                )}

                {/* Per-group sections */}
                {groups.map((group, gi) => {
                    const stripPhotos: PhotoEntry[] = [group.canonical, ...group.sent];
                    const showSimilar = !!showSimilarFor[gi];
                    return (
                        <div key={gi} className="bg-white border border-slate-200 rounded-xl mb-4 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-black text-slate-900">{group.label}</h3>
                                    <p className="text-xs text-slate-500">
                                        {stripPhotos.length} photo{stripPhotos.length === 1 ? '' : 's'} sent to LLM
                                        {group.similar.length > 0 && <> · +{group.similar.length} similar</>}
                                    </p>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">
                                    canonical #{(group.canonical.photo_index ?? 0) + 1}
                                </span>
                            </div>

                            {/* Group strip */}
                            <div className="px-4 py-3 border-b border-slate-100 flex gap-2 overflow-x-auto bg-slate-50">
                                {stripPhotos.map((p, pi) => (
                                    <div key={pi} className="flex-shrink-0 relative">
                                        <img
                                            src={p.url}
                                            alt={`Photo ${(p.photo_index ?? 0) + 1}`}
                                            className={`h-24 w-24 object-cover rounded-lg ${pi === 0 ? 'ring-2 ring-indigo-500' : ''}`}
                                            loading="lazy"
                                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                                        />
                                        <span className="absolute top-1 left-1 text-[10px] font-bold text-white bg-black/60 rounded px-1.5 py-0.5">
                                            #{(p.photo_index ?? 0) + 1}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Analysis text */}
                            <div className="px-4 py-3">
                                {group.canonical.analysis ? (
                                    <pre className="text-xs whitespace-pre-wrap font-sans text-slate-800 leading-relaxed">
                                        {group.canonical.analysis}
                                    </pre>
                                ) : (
                                    <div className="text-xs text-red-600">No analysis — {group.canonical.error || 'unknown error'}</div>
                                )}
                            </div>

                            {/* Similar photos (collapsed by default) */}
                            {group.similar.length > 0 && (
                                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60">
                                    <button
                                        onClick={() => setShowSimilarFor(s => ({ ...s, [gi]: !s[gi] }))}
                                        className="text-xs text-slate-600 hover:text-slate-900 font-bold"
                                    >
                                        {showSimilar ? '▾' : '▸'} {group.similar.length} similar photo{group.similar.length === 1 ? '' : 's'} not sent to LLM
                                    </button>
                                    {showSimilar && (
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            {group.similar.map((p, pi) => (
                                                <div key={pi} className="flex-shrink-0 relative">
                                                    <img
                                                        src={p.url}
                                                        alt={`Photo ${(p.photo_index ?? 0) + 1}`}
                                                        className="h-16 w-16 object-cover rounded opacity-70"
                                                        loading="lazy"
                                                    />
                                                    <span className="absolute top-0 left-0 text-[9px] font-bold text-white bg-black/50 rounded-br px-1">
                                                        #{(p.photo_index ?? 0) + 1}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Orphans (no analysis at all — unclassified or fetch-failed) */}
                {orphans.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6">
                        <h3 className="text-sm font-black text-amber-900 mb-2">
                            {orphans.length} photo{orphans.length === 1 ? '' : 's'} without analysis
                        </h3>
                        <p className="text-xs text-amber-700 mb-3">Photos that failed classification or image fetch.</p>
                        <div className="flex gap-2 flex-wrap">
                            {orphans.map((p, pi) => (
                                <div key={pi} className="flex-shrink-0 relative">
                                    {p.url && (
                                        <img
                                            src={p.url}
                                            alt={`Photo ${(p.photo_index ?? 0) + 1}`}
                                            className="h-16 w-16 object-cover rounded opacity-60"
                                            loading="lazy"
                                        />
                                    )}
                                    <span className="absolute top-0 left-0 text-[9px] font-bold text-white bg-black/50 rounded-br px-1">
                                        #{(p.photo_index ?? 0) + 1}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="h-12" />
            </div>
        </Wrapper>
    );
};

export default VisionAnalysisPage;
