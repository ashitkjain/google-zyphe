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
    // Multi-room support (Bedroom / Bathroom split into N analyses each).
    room_id?: string | null;
    room_label?: string | null;
    room_type?: string | null;     // 'primary' | 'secondary' | 'guest' | 'kids' | 'walk_in_closet' | 'full' | 'powder_half' | 'unclear' | 'n/a'
}

interface InteriorSynthesis {
    overall_description: string;
    design_style: { style: string; reasoning: string };
    color_and_materials: string;
    lighting: string;
    spatial_flow: string;
    staging_and_furnishings: string;
    condition_and_finish: string;
    hero_headline: string;
    atmosphere_scores: { brightness: number; warmth: number; openness: number };
    finish_quality_score: number;
    facet_tags: { colors_tag: string; lighting_tag: string; staging_tag: string };
    spatial_tag?: string;
    condition_tag?: string;
    hero_tags: string[];
    objective_tags: string[];
    material_palette: Array<{ name: string; hex: string; location: string }>;
}

interface ExteriorSynthesis {
    exterior_and_lot_appeal: { architecture_style: string; curb_appeal: string; backyard_and_patio: string };
    views_privacy_orientation: { views: string; privacy: string };
    hero_headline: string;
    exterior_atmosphere_scores: { curb_appeal_score: number; outdoor_living_score: number; privacy_score: number; view_score: number };
    facet_tags: { style_tag: string; lot_coverage_tag: string; privacy_tag: string; views_tag: string };
    objective_tags: string[];
}

interface VisionDoc {
    function_deployed_at?: string;
    model?: string;
    analyzed_at_iso?: string;
    photo_count?: number;
    photo_count_total?: number;
    analyzed_photo_count?: number;
    group_count?: number;
    room_count?: number;
    photos?: PhotoEntry[];
    timing_ms?: { fetch?: number; classify?: number; analyze?: number; synthesis?: number; total?: number };
    // Progress fields written incrementally as the pipeline runs.
    status?: 'fetching' | 'classifying' | 'analyzing' | 'synthesizing' | 'done' | 'error';
    phase?: string;
    classify_total?: number;
    classify_done?: number;
    analyze_total?: number;
    analyze_done?: number;
    error?: string;
    interior_synthesis?: InteriorSynthesis | null;
    interior_synthesis_error?: string | null;
    exterior_synthesis?: ExteriorSynthesis | null;
    exterior_synthesis_error?: string | null;
    synthesis_input_counts?: { interior: number; exterior: number };
}

type ActiveTab = 'indoor' | 'outdoor' | 'rooms';

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
        // Prefer the room-specific label when present (e.g. "Primary Bedroom"
        // instead of the generic group label "Bedroom"). Falls back to the
        // group label for single-room categories like Kitchen.
        const displayLabel = canonical.room_label || canonical.group_label || 'Unlabeled';
        return {
            label: displayLabel,
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
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('indoor');

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
                        <div className="text-slate-500 uppercase font-bold tracking-wide">Function deployed</div>
                        <div className="text-slate-900 font-mono mt-1">
                            {docData?.function_deployed_at ? new Date(docData.function_deployed_at).toLocaleString() : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 uppercase font-bold tracking-wide">Model</div>
                        <div className="text-slate-900 font-mono mt-1">{docData?.model || '—'}</div>
                    </div>
                    <div>
                        <div className="text-slate-500 uppercase font-bold tracking-wide">Photos</div>
                        <div className="text-slate-900 mt-1">
                            {docData ? (
                                <>
                                    {docData.analyzed_photo_count} analyses
                                    {docData.room_count != null && docData.room_count !== docData.group_count && (
                                        <> · {docData.room_count} rooms in {docData.group_count} groups</>
                                    )}
                                    {(docData.room_count == null || docData.room_count === docData.group_count) && (
                                        <> · {docData.group_count} groups</>
                                    )}
                                    {' · '}{docData.photo_count} total
                                </>
                            ) : '—'}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-500 uppercase font-bold tracking-wide">Timing</div>
                        <div className="text-slate-900 mt-1">
                            {docData?.timing_ms ? `${Math.round((docData.timing_ms.total || 0)/1000)}s total` : '—'}
                            {docData?.timing_ms && (
                                <span className="text-slate-500 ml-1">
                                    (fetch {Math.round((docData.timing_ms.fetch || 0)/1000)}s · classify {Math.round((docData.timing_ms.classify || 0)/1000)}s · analyze {Math.round((docData.timing_ms.analyze || 0)/1000)}s
                                    {docData.timing_ms.synthesis != null && <> · synthesize {Math.round((docData.timing_ms.synthesis || 0)/1000)}s</>}
                                    )
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

                {/* Tab bar — switches between synthesized views and per-room detail */}
                {docData && (
                    <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
                        {([
                            { id: 'indoor' as const, label: 'Indoor Visual AI', count: docData.synthesis_input_counts?.interior },
                            { id: 'outdoor' as const, label: 'Outdoor Visual AI', count: docData.synthesis_input_counts?.exterior },
                            { id: 'rooms' as const, label: 'Per-Room Detail', count: groups.length },
                        ]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-indigo-600 text-indigo-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {tab.label}
                                {tab.count != null && <span className="ml-1.5 text-xs font-mono text-slate-400">({tab.count})</span>}
                            </button>
                        ))}
                    </div>
                )}

                {/* Indoor Visual AI tab */}
                {docData && activeTab === 'indoor' && (
                    <SynthesisIndoor
                        synthesis={docData.interior_synthesis ?? null}
                        error={docData.interior_synthesis_error ?? null}
                        inputCount={docData.synthesis_input_counts?.interior ?? 0}
                    />
                )}

                {/* Outdoor Visual AI tab */}
                {docData && activeTab === 'outdoor' && (
                    <SynthesisOutdoor
                        synthesis={docData.exterior_synthesis ?? null}
                        error={docData.exterior_synthesis_error ?? null}
                        inputCount={docData.synthesis_input_counts?.exterior ?? 0}
                    />
                )}

                {/* Per-room detail tab — original per-group sections */}
                {docData && activeTab === 'rooms' && groups.map((group, gi) => {
                    const stripPhotos: PhotoEntry[] = [group.canonical, ...group.sent];
                    const showSimilar = !!showSimilarFor[gi];
                    return (
                        <div key={gi} className="bg-white border border-slate-200 rounded-xl mb-4 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900">{group.label}</h3>
                                        <p className="text-xs text-slate-500">
                                            {stripPhotos.length} photo{stripPhotos.length === 1 ? '' : 's'} sent to LLM
                                            {group.similar.length > 0 && <> · +{group.similar.length} similar</>}
                                        </p>
                                    </div>
                                    {group.canonical.room_type === 'primary' && (
                                        <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                            ★ Primary
                                        </span>
                                    )}
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
                                            className={`h-24 w-24 object-cover rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity ${pi === 0 ? 'ring-2 ring-indigo-500' : ''}`}
                                            loading="lazy"
                                            onClick={() => setEnlargedImage(p.url || null)}
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
                                                        className="h-16 w-16 object-cover rounded opacity-70 hover:opacity-100 cursor-zoom-in transition-opacity"
                                                        loading="lazy"
                                                        onClick={() => setEnlargedImage(p.url || null)}
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
                {docData && activeTab === 'rooms' && orphans.length > 0 && (
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
                                            className="h-16 w-16 object-cover rounded opacity-60 hover:opacity-100 cursor-zoom-in transition-opacity"
                                            loading="lazy"
                                            onClick={() => setEnlargedImage(p.url || null)}
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

            {/* Enlarged Image Modal */}
            {enlargedImage && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setEnlargedImage(null)}
                >
                    <img 
                        src={enlargedImage} 
                        alt="Enlarged view" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                    <div className="absolute top-4 right-4 text-white/50 text-sm font-bold bg-black/50 px-3 py-1 rounded-full">
                        Click anywhere to close
                    </div>
                </div>
            )}
        </Wrapper>
    );
};

export default VisionAnalysisPage;

// ─── Synthesis renderers ──────────────────────────────────────────────────
// Both tabs render the property-level synthesis produced by phase 7 of the
// vision pipeline (functions/visionPipeline.js). They expect the JSON
// shapes defined in InteriorSynthesis / ExteriorSynthesis above.

function SynthesisEmpty({ kind, error, inputCount }: { kind: 'indoor' | 'outdoor'; error: string | null; inputCount: number }) {
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-900">
            <div className="font-bold mb-1">{kind === 'indoor' ? 'Indoor' : 'Outdoor'} synthesis not available</div>
            {error ? (
                <div className="text-xs">Reason: {error}</div>
            ) : inputCount === 0 ? (
                <div className="text-xs">No {kind === 'indoor' ? 'interior rooms' : 'exterior spaces'} were analyzed in this run, so there's nothing to synthesize. Re-run after adding more photos of those spaces.</div>
            ) : (
                <div className="text-xs">Synthesis hasn't been generated yet. Re-run the pipeline to produce it.</div>
            )}
        </div>
    );
}

function ScoreDial({ label, value, hint, color }: { label: string; value: number; hint?: string; color: string }) {
    const pct = Math.max(0, Math.min(100, value));
    const circumference = 2 * Math.PI * 28;
    const dash = (pct / 100) * circumference;
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" stroke="#e2e8f0" strokeWidth="6" fill="none" />
                <circle cx="36" cy="36" r="28" stroke={color} strokeWidth="6" fill="none"
                    strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`}
                    transform="rotate(-90 36 36)" />
                <text x="36" y="42" textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">{pct}</text>
            </svg>
            <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</div>
                {hint && <div className="text-xs text-slate-700 mt-1 leading-snug">{hint}</div>}
            </div>
        </div>
    );
}

function FacetCard({ num, title, chip, body }: { num: number; title: string; chip?: string; body: string }) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 relative">
            <div className="absolute top-3 right-4 text-[10px] font-mono text-slate-300 font-bold">0{num}</div>
            <h4 className="font-serif text-lg text-slate-900 mb-2 leading-tight">{title}</h4>
            {chip && chip !== '—' && (
                <span className="inline-flex items-center bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-full text-[11px] font-bold border border-indigo-200 mb-2">{chip}</span>
            )}
            <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
        </div>
    );
}

function SynthesisIndoor({ synthesis: s, error, inputCount }: { synthesis: InteriorSynthesis | null; error: string | null; inputCount: number }) {
    if (!s) return <SynthesisEmpty kind="indoor" error={error} inputCount={inputCount} />;
    return (
        <div className="space-y-8">
            {/* Hero */}
            <div className="bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100 rounded-2xl p-6">
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full text-[11px] font-bold">◈ {s.design_style.style}</span>
                    {s.hero_tags.map(t => (
                        <span key={t} className="bg-white text-slate-600 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200">{t}</span>
                    ))}
                </div>
                <h2 className="font-serif text-2xl text-slate-900 mb-3 leading-tight">{s.hero_headline || <>Interior &amp; <em className="text-indigo-600">atmosphere</em></>}</h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{s.overall_description}</p>
                {s.objective_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4">
                        {s.objective_tags.map(t => (
                            <span key={t} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-200">{t}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Atmosphere Dials */}
            <section>
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">01</span>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-700">Atmosphere Dials</span>
                </div>
                <h3 className="font-serif text-xl text-slate-900 mb-4">How it <em className="text-indigo-600">feels</em> inside</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <ScoreDial label="Brightness" value={s.atmosphere_scores.brightness} hint={s.facet_tags.lighting_tag} color="#4f46e5" />
                    <ScoreDial label="Warmth" value={s.atmosphere_scores.warmth} hint={s.facet_tags.colors_tag} color="#d97706" />
                    <ScoreDial label="Openness" value={s.atmosphere_scores.openness} hint={s.spatial_tag || 'Layout & flow'} color="#0ea5e9" />
                    <ScoreDial label="Finish Quality" value={s.finish_quality_score} hint={s.condition_tag || 'Build quality'} color="#16a34a" />
                </div>
            </section>

            {/* Six Dimensions */}
            <section>
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">02</span>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-700">Interior Facets</span>
                </div>
                <h3 className="font-serif text-xl text-slate-900 mb-4">Six <em className="text-indigo-600">dimensions</em> of the interior</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <FacetCard num={1} title="Design Philosophy" chip={s.design_style.style} body={s.design_style.reasoning} />
                    <FacetCard num={2} title="Colors & Materials" chip={s.facet_tags.colors_tag} body={s.color_and_materials} />
                    <FacetCard num={3} title="Lighting Environment" chip={s.facet_tags.lighting_tag} body={s.lighting} />
                    <FacetCard num={4} title="Spatial Architecture" chip={s.spatial_tag} body={s.spatial_flow} />
                    <FacetCard num={5} title="Staging & Furnishings" chip={s.facet_tags.staging_tag} body={s.staging_and_furnishings} />
                    <FacetCard num={6} title="Condition & Finish" chip={s.condition_tag} body={s.condition_and_finish} />
                </div>
            </section>

            {/* Material palette */}
            {s.material_palette.length > 0 && (
                <section>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-[11px] font-mono text-slate-400 font-bold">03</span>
                        <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-700">Material Palette</span>
                    </div>
                    <h3 className="font-serif text-xl text-slate-900 mb-4">The home's <em className="text-indigo-600">material story</em></h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {s.material_palette.map((m, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg border border-slate-200 flex-shrink-0" style={{ background: m.hex }} />
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-slate-900 truncate">{m.name}</div>
                                    <div className="text-[11px] text-slate-500 truncate">{m.location}</div>
                                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{m.hex}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

function SynthesisOutdoor({ synthesis: s, error, inputCount }: { synthesis: ExteriorSynthesis | null; error: string | null; inputCount: number }) {
    if (!s) return <SynthesisEmpty kind="outdoor" error={error} inputCount={inputCount} />;
    return (
        <div className="space-y-8">
            {/* Hero */}
            <div className="bg-gradient-to-b from-emerald-50/60 to-white border border-emerald-100 rounded-2xl p-6">
                <div className="flex flex-wrap gap-2 mb-3">
                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[11px] font-bold">◈ {s.facet_tags.style_tag}</span>
                    {s.objective_tags.slice(0, 6).map(t => (
                        <span key={t} className="bg-white text-slate-600 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200">{t}</span>
                    ))}
                </div>
                <h2 className="font-serif text-2xl text-slate-900 mb-3 leading-tight">{s.hero_headline || <>Outdoor &amp; <em className="text-emerald-600">curb appeal</em></>}</h2>
                <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                    <p className="whitespace-pre-line">{s.exterior_and_lot_appeal.curb_appeal}</p>
                    <p className="whitespace-pre-line">{s.exterior_and_lot_appeal.backyard_and_patio}</p>
                </div>
            </div>

            {/* Atmosphere dials */}
            <section>
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">01</span>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700">Outdoor Dials</span>
                </div>
                <h3 className="font-serif text-xl text-slate-900 mb-4">How the <em className="text-emerald-600">outside</em> reads</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <ScoreDial label="Curb Appeal" value={s.exterior_atmosphere_scores.curb_appeal_score} hint={s.facet_tags.style_tag} color="#059669" />
                    <ScoreDial label="Outdoor Living" value={s.exterior_atmosphere_scores.outdoor_living_score} hint="Backyard & patio" color="#0891b2" />
                    <ScoreDial label="Privacy" value={s.exterior_atmosphere_scores.privacy_score} hint={s.facet_tags.privacy_tag} color="#7c3aed" />
                    <ScoreDial label="Views" value={s.exterior_atmosphere_scores.view_score} hint={s.facet_tags.views_tag} color="#d97706" />
                </div>
            </section>

            {/* Six Dimensions of plot */}
            <section>
                <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">02</span>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700">Plot Facets</span>
                </div>
                <h3 className="font-serif text-xl text-slate-900 mb-4">Six <em className="text-emerald-600">dimensions</em> of the plot</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <FacetCard num={1} title="Style" chip={s.facet_tags.style_tag} body={s.exterior_and_lot_appeal.architecture_style} />
                    <FacetCard num={2} title="Curb Appeal" body={s.exterior_and_lot_appeal.curb_appeal} />
                    <FacetCard num={3} title="Backyard & Patio" body={s.exterior_and_lot_appeal.backyard_and_patio} />
                    <FacetCard num={4} title="Privacy" chip={s.facet_tags.privacy_tag} body={s.views_privacy_orientation.privacy} />
                    <FacetCard num={5} title="Views" chip={s.facet_tags.views_tag} body={s.views_privacy_orientation.views} />
                    <FacetCard num={6} title="Lot Coverage" chip={s.facet_tags.lot_coverage_tag} body={`Inferred coverage: ${s.facet_tags.lot_coverage_tag}. ${s.objective_tags.length > 0 ? 'Notable lot features: ' + s.objective_tags.slice(0, 6).join(', ') + '.' : ''}`} />
                </div>
            </section>
        </div>
    );
}
