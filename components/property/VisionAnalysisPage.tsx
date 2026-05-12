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
import { PageHeader } from './PropertySectionView';

interface Props {
    propertyData: PropertyData;
    // Optional close handler — when present the page renders as a fullscreen
    // overlay with a Close button. When absent (the default path now), it
    // renders as a normal section page inside the property nav.
    onClose?: () => void;
    userRole?: string;
    mode?: 'indoor' | 'outdoor';
    renderPalette?: () => React.ReactNode;
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
    storage_and_cabinetry: string;
    condition_and_finish: string;
    hero_headline: string;
    atmosphere_scores: { brightness: number; warmth: number; openness: number };
    finish_quality_score: number;
    facet_tags: { colors_tag: string; lighting_tag: string; storage_tag: string };
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

type ActiveTab = 'indoor' | 'outdoor';

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
        let displayLabel = canonical.room_label || canonical.group_label || 'Unlabeled';
        if (displayLabel === 'Bathroom') displayLabel = 'Bathrooms';
        if (displayLabel === 'Bedroom') displayLabel = 'Bedrooms';
        return {
            label: displayLabel,
            canonical,
            sent,
            similar,
        };
    });

    return { groups, orphans };
}

const VisionAnalysisPage: React.FC<Props> = ({ propertyData, onClose, userRole, mode, renderPalette }) => {
    const zpid = propertyData?.zpid ? String(propertyData.zpid) : '';
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [docData, setDocData] = useState<VisionDoc | null>(null);
    // Wall-clock elapsed timer. Driven by local `running` state + the
    // pipeline's status field so it continues ticking even if the client
    // callable times out (the server keeps working, the page keeps timing).
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [elapsedMs, setElapsedMs] = useState(0);
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('indoor');
    // Lifted out of RoomsWalkthrough so it survives parent re-renders caused
    // by setEnlargedImage (Wrapper is defined inside this component which
    // would otherwise remount RoomsWalkthrough and reset its state).
    const [selectedIndoorRoomIdx, setSelectedIndoorRoomIdx] = useState(0);
    const [selectedOutdoorRoomIdx, setSelectedOutdoorRoomIdx] = useState(0);

    useEffect(() => {
        if (mode) {
            setActiveTab(mode);
        }
    }, [mode]);

    useEffect(() => {
        if (!zpid) return;
        const ref = doc(db, 'properties', zpid, 'analysis', 'vision_v2');
        const unsub = onSnapshot(ref, (snap) => {
            setDocData(snap.exists() ? (snap.data() as VisionDoc) : null);
        });
        return unsub;
    }, [zpid]);

    const { groups, orphans } = useMemo(() => groupPhotos(docData?.photos), [docData]);
    const intGroups = useMemo(() => groups.filter(g => !isExteriorGroup(g)), [groups]);
    const extGroups = useMemo(() => groups.filter(g => isExteriorGroup(g)), [groups]);

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
            <div className="pb-6">
                {mode && (
                    <PageHeader
                        icon={mode === 'indoor' ? 'fa-couch' : 'fa-house-chimney'}
                        title={mode === 'indoor' ? 'Indoor atmosphere (AI)' : 'Outdoor & curb appeal (AI)'}
                        description={mode === 'indoor' ? 'Granular indoor visual analysis using multi-space visual classification' : 'Granular outdoor visual analysis using multi-space visual classification'}
                        color={mode === 'indoor' ? 'text-teal-600' : 'text-emerald-500'}
                        renderPalette={renderPalette}
                        titleSuffix={userRole === 'admin' && (
                            <div className="inline-flex items-center gap-2 ml-2">
                                {inProgress && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded">
                                        <span className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse" />
                                        {formatElapsed(elapsedMs)}
                                    </span>
                                )}
                                <button
                                    onClick={handleRun}
                                    disabled={!zpid || inProgress}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center justify-center h-6 w-6 rounded-full hover:bg-slate-100"
                                    title={inProgress ? 'Running…' : (docData ? 'Re-run Analysis' : 'Run Analysis')}
                                >
                                    <i className={`fa-solid fa-arrows-rotate text-sm ${inProgress ? 'animate-spin text-indigo-600' : ''}`} />
                                </button>
                            </div>
                        )}
                    />
                )}

                {userRole === 'admin' && !mode && (
                    <div className="flex justify-end mb-3">
                        {inProgress && (
                            <span className="inline-flex items-center gap-2 px-3 py-1 mr-2 text-xs font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                {formatElapsed(elapsedMs)}
                            </span>
                        )}
                        <button
                            onClick={handleRun}
                            disabled={!zpid || inProgress}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                            title={inProgress ? 'Running…' : (docData ? 'Re-run Analysis' : 'Run Analysis')}
                        >
                            <i className={`fa-solid fa-arrows-rotate ${inProgress ? 'animate-spin text-indigo-600' : ''}`} />
                        </button>
                    </div>
                )}

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



                {!docData && (
                    <div className="text-center py-16 text-slate-500">
                        <p className="text-sm">No analysis saved yet.</p>
                        <p className="text-xs mt-2">Click "Run Analysis" above to generate one.</p>
                    </div>
                )}

                {/* Tab bar */}
                {docData && !mode && (
                    <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
                        {([
                            { id: 'indoor' as const, label: 'Indoor Visual AI', count: docData.synthesis_input_counts?.interior },
                            { id: 'outdoor' as const, label: 'Outdoor Visual AI', count: docData.synthesis_input_counts?.exterior },
                        ]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${activeTab === tab.id
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

                {/* Indoor Visual AI tab — synthesis + per-room interior detail */}
                {docData && activeTab === 'indoor' && (
                    <div className="space-y-8">
                        <SynthesisIndoor
                            synthesis={docData.interior_synthesis ?? null}
                            error={docData.interior_synthesis_error ?? null}
                            inputCount={docData.synthesis_input_counts?.interior ?? 0}
                            groups={intGroups}
                            propertyImages={propertyData?.images}
                            onEnlargeImage={(url) => setEnlargedImage(url)}
                        />
                        {intGroups.length > 0 && (
                            <RoomsWalkthrough
                                groups={intGroups}
                                orphans={orphans}
                                selectedIdx={selectedIndoorRoomIdx}
                                onSelectIdx={setSelectedIndoorRoomIdx}
                                onEnlargeImage={(url) => setEnlargedImage(url)}
                                embedded
                                sectionNum="03"
                                accent="#4f46e5"
                            />
                        )}
                    </div>
                )}

                {/* Outdoor Visual AI tab — synthesis + per-room exterior detail */}
                {docData && activeTab === 'outdoor' && (
                    <div className="space-y-8">
                        <SynthesisOutdoor
                            synthesis={docData.exterior_synthesis ?? null}
                            error={docData.exterior_synthesis_error ?? null}
                            inputCount={docData.synthesis_input_counts?.exterior ?? 0}
                            groups={extGroups}
                            propertyImages={propertyData?.images}
                            onEnlargeImage={(url) => setEnlargedImage(url)}
                        />
                        {extGroups.length > 0 && (
                            <RoomsWalkthrough
                                groups={extGroups}
                                orphans={[]}
                                selectedIdx={selectedOutdoorRoomIdx}
                                onSelectIdx={setSelectedOutdoorRoomIdx}
                                onEnlargeImage={(url) => setEnlargedImage(url)}
                                embedded
                                sectionNum="03"
                                accent="#059669"
                            />
                        )}
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

const _serif = "'Instrument Serif', Georgia, serif";
const _mono = "'JetBrains Mono', ui-monospace, monospace";

function SectionTitleBar({ num, kicker, title, italicWord, accent }: {
    num: string; kicker: string; title: string; italicWord?: string; accent: string;
}) {
    const parts = italicWord && title.includes(italicWord) ? title.split(italicWord) : null;
    return (
        <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: _mono, fontSize: 11, color: accent, padding: '2px 7px', borderRadius: 4, background: `${accent}1a`, fontWeight: 700 }}>{num}</span>
                <span style={{ width: 24, height: 1, background: accent, display: 'inline-block' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.18em', fontWeight: 700, color: accent, textTransform: 'uppercase' }}>{kicker}</span>
            </div>
            <h2 style={{ fontFamily: _serif, fontSize: 30, lineHeight: 1.05, margin: 0, fontWeight: 400, letterSpacing: '-0.02em', color: '#0f172a' }}>
                {parts ? <>{parts[0]}<em style={{ color: accent, fontStyle: 'italic' }}>{italicWord}</em>{parts[1]}</> : title}
            </h2>
        </div>
    );
}

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

function FacetCard({ num, title, chip, body, theme = 'indoor' }: { num: number; title: string; chip?: string; body: string; theme?: 'indoor' | 'outdoor' }) {
    const bgClass = theme === 'outdoor'
        ? 'bg-gradient-to-b from-emerald-50/60 to-white border border-emerald-100/60'
        : 'bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100/60';
    const chipBg = theme === 'outdoor'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : 'bg-indigo-50 text-indigo-800 border-indigo-200';
    return (
        <div className={`${bgClass} rounded-xl p-5 relative`}>
            <div className="absolute top-3 right-4 text-[10px] font-mono text-slate-300 font-bold">0{num}</div>
            <h4 className="font-serif text-lg text-slate-900 mb-2 leading-tight">{title}</h4>
            {chip && chip !== '—' && (
                <span className={`inline-flex items-center ${chipBg} px-2 py-0.5 rounded-full text-[11px] font-bold border mb-2`}>{chip}</span>
            )}
            <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
        </div>
    );
}

function SynthesisIndoor({
    synthesis: s, error, inputCount, groups, propertyImages, onEnlargeImage
}: {
    synthesis: InteriorSynthesis | null;
    error: string | null;
    inputCount: number;
    groups: GroupView[];
    propertyImages?: string[];
    onEnlargeImage: (url: string) => void;
}) {
    if (!s) return <SynthesisEmpty kind="indoor" error={error} inputCount={inputCount} />;
    return (
        <div className="space-y-8">
            {/* Hero */}
            <div className="bg-gradient-to-b from-indigo-50/60 to-white border border-indigo-100 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                        <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full text-[11px] font-bold">◈ {s.design_style.style}</span>
                        {s.hero_tags.map(t => (
                            <span key={t} className="bg-white text-slate-600 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200">{t}</span>
                        ))}
                    </div>
                    <h2 className="font-serif text-2xl text-slate-900 mb-3 leading-tight">{s.hero_headline || <>Interior &amp; <em className="text-indigo-600">atmosphere</em></>}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{s.overall_description}</p>
                    {s.objective_tags.length > 0 && (() => {
                        const styleVal = s.design_style.style?.trim().toLowerCase();
                        const seen = new Set<string>();
                        if (styleVal) seen.add(styleVal);
                        
                        const uniqueObjectiveTags = s.objective_tags.filter(t => {
                            const val = t?.trim().toLowerCase();
                            if (!val || seen.has(val)) return false;
                            seen.add(val);
                            return true;
                        });

                        if (uniqueObjectiveTags.length === 0) return null;

                        return (
                            <div className="flex flex-wrap gap-1.5 mt-4">
                                {uniqueObjectiveTags.map(t => (
                                    <span key={t} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-200">{t}</span>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* Photo grid - Mosaic of top 3 photos */}
                {(() => {
                    let items: Array<{ url: string; label: string }> = [];
                    const used = new Set<string>();

                    for (const g of groups) {
                        const url = g.canonical?.url;
                        if (url && !used.has(url)) {
                            items.push({ url, label: g.label || '' });
                            used.add(url);
                            if (items.length >= 3) break;
                        }
                    }

                    if (items.length < 3 && propertyImages) {
                        for (const url of propertyImages) {
                            if (url && !used.has(url)) {
                                items.push({ url, label: '' });
                                used.add(url);
                                if (items.length >= 3) break;
                            }
                        }
                    }

                    if (items.length === 0) return null;

                    return (
                        <div className="grid grid-cols-2 gap-3">
                            {items.map((img, i) => (
                                <div
                                    key={i}
                                    className={`rounded-xl overflow-hidden relative border border-slate-200 cursor-zoom-in bg-slate-50 ${i === 0 ? 'col-span-2 h-[260px]' : 'h-[160px]'
                                        }`}
                                    onClick={() => onEnlargeImage(img.url)}
                                >
                                    <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                                    {img.label && (
                                        <div className="absolute bottom-3 left-3 bg-slate-900/75 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                            {img.label}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* Atmosphere Dials */}
            <section>
                <SectionTitleBar num="01" kicker="Atmosphere Dials" title="How it feels inside" italicWord="feels" accent="#4f46e5" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <ScoreDial label="Brightness" value={s.atmosphere_scores.brightness} hint={s.facet_tags.lighting_tag} color="#4f46e5" />
                    <ScoreDial label="Warmth" value={s.atmosphere_scores.warmth} hint={s.facet_tags.colors_tag} color="#d97706" />
                    <ScoreDial label="Openness" value={s.atmosphere_scores.openness} hint={s.spatial_tag || 'Layout & flow'} color="#0ea5e9" />
                    <ScoreDial label="Finish Quality" value={s.finish_quality_score} hint={s.condition_tag || 'Build quality'} color="#16a34a" />
                </div>
            </section>

            {/* Six Dimensions */}
            <section>
                <SectionTitleBar num="02" kicker="Interior Facets" title="Six dimensions of the interior" italicWord="dimensions" accent="#4f46e5" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <FacetCard num={1} title="Design Philosophy" chip={s.design_style.style} body={s.design_style.reasoning} theme="indoor" />
                    <FacetCard num={2} title="Colors & Materials" chip={s.facet_tags.colors_tag} body={s.color_and_materials} theme="indoor" />
                    <FacetCard num={3} title="Lighting Environment" chip={s.facet_tags.lighting_tag} body={s.lighting} theme="indoor" />
                    <FacetCard num={4} title="Spatial Architecture" chip={s.spatial_tag} body={s.spatial_flow} theme="indoor" />
                    <FacetCard num={5} title="Storage & Cabinetry" chip={s.facet_tags?.storage_tag} body={(s as any).storage_and_cabinetry || (s as any).staging_and_furnishings} theme="indoor" />
                    <FacetCard num={6} title="Condition & Finish" chip={s.condition_tag} body={s.condition_and_finish} theme="indoor" />
                </div>
            </section>

            {/* Material palette */}
            {s.material_palette.length > 0 && (
                <section>
                    <SectionTitleBar num="03" kicker="Material Palette" title="The home's material story" italicWord="material story" accent="#4f46e5" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {s.material_palette.map((m, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg border border-slate-200 flex-shrink-0" style={{ background: m.hex }} />
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-slate-900 truncate">{m.name}</div>
                                    <div className="text-[11px] text-slate-500 truncate">{m.location}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

// ─── Rooms Walkthrough ───────────────────────────────────────────────────────
// "Spaces · LLM" walkthrough: horizontal nav (EXT/INT sections) + detail panel
// with hero image, facet card grid, and AI narrative. Matches the design spec.

interface AnalysisField {
    key: string;
    value: string;
    fieldName?: string; // short label from "Section — FieldName" format
}

function parseAnalysisFields(text: string): AnalysisField[] {
    const lines = text.split('\n');
    const fields: AnalysisField[] = [];
    let currentKey = '';
    let currentValue = '';

    const push = () => {
        if (!currentKey) return;
        const v = currentValue.trim();
        if (!v) return;
        const m = currentKey.match(/^(.+?)\s*(?:—|–|--)\s*(.+)$/);
        fields.push({ key: currentKey, value: v, fieldName: m ? m[2].trim() : undefined });
    };

    for (const line of lines) {
        const m = line.match(/^([^:\n]{1,80}):\s*(.*)$/);
        if (m) {
            push();
            currentKey = m[1].trim();
            currentValue = m[2];
        } else if (currentKey) {
            const t = line.trim();
            if (t) currentValue += ' ' + t;
        }
    }
    push();
    return fields;
}

const EXTERIOR_KEYWORDS = ['front yard', 'backyard', 'back yard', 'aerial view', 'aerial', 'floor plan', 'garage', 'pool area', 'pool', 'exterior', 'side yard'];

function isExteriorGroup(g: GroupView): boolean {
    const lbl = (g.canonical.group_label || g.label || '').toLowerCase();
    return EXTERIOR_KEYWORDS.some(k => lbl.includes(k));
}

// Cycling color palettes — exterior = green family, interior = violet family
const EXT_PALETTES = [
    { bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'text-emerald-700' },
    { bg: 'bg-teal-50', border: 'border-teal-100', label: 'text-teal-700' },
    { bg: 'bg-green-50', border: 'border-green-100', label: 'text-green-700' },
    { bg: 'bg-cyan-50', border: 'border-cyan-100', label: 'text-cyan-700' },
];
const INT_PALETTES = [
    { bg: 'bg-violet-50', border: 'border-violet-100', label: 'text-violet-700' },
    { bg: 'bg-indigo-50', border: 'border-indigo-100', label: 'text-indigo-700' },
    { bg: 'bg-purple-50', border: 'border-purple-100', label: 'text-purple-700' },
    { bg: 'bg-fuchsia-50', border: 'border-fuchsia-100', label: 'text-fuchsia-700' },
];

interface NavCardProps {
    group: GroupView;
    globalIdx: number;
    isActive: boolean;
    onSelect: (idx: number) => void;
}

const RoomNavCard: React.FC<NavCardProps> = ({ group: g, globalIdx, isActive, onSelect }) => {
    const ext = isExteriorGroup(g);
    const total = 1 + g.sent.length + g.similar.length;
    const fieldCount = parseAnalysisFields(g.canonical.analysis || '')
        .filter(f => f.key !== 'Space' && f.key !== 'Description').length;
    const numLabel = String(globalIdx + 1).padStart(2, '0');
    return (
        <button
            onClick={() => onSelect(globalIdx)}
            className={`flex-shrink-0 w-[96px] text-left rounded-xl overflow-hidden transition-all border-2 ${isActive
                ? (ext ? 'border-emerald-400 shadow-md ring-1 ring-emerald-200' : 'border-violet-400 shadow-md ring-1 ring-violet-200')
                : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
        >
            <div className="relative h-[62px]">
                {g.canonical.url ? (
                    <img src={g.canonical.url} alt={g.label} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    <div className="w-full h-full bg-slate-200" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <span className="absolute top-1 left-1 text-[9px] font-black text-white bg-black/60 rounded px-1 leading-tight">
                    #{numLabel}
                </span>
                <span className={`absolute top-1 right-1 text-[9px] font-black px-1 rounded leading-tight ${ext ? 'bg-emerald-500 text-white' : 'bg-violet-500 text-white'
                    }`}>
                    {ext ? 'EXT' : 'INT'}
                </span>
                {g.canonical.room_type === 'primary' && (
                    <span className="absolute bottom-1 right-1 text-[8px] font-black text-amber-300">★</span>
                )}
            </div>
            <div className={`px-2 py-1.5 ${isActive ? 'bg-white' : 'bg-slate-50'}`}>
                <div className="text-[10px] font-bold text-slate-900 truncate leading-tight">{g.label}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{total}p · {fieldCount}f</div>
            </div>
        </button>
    );
};

function RoomsWalkthrough({ groups, orphans, selectedIdx, onSelectIdx, onEnlargeImage, embedded, sectionNum, accent }: {
    groups: GroupView[];
    orphans: PhotoEntry[];
    selectedIdx: number;
    onSelectIdx: (idx: number) => void;
    onEnlargeImage: (url: string) => void;
    embedded?: boolean;
    sectionNum?: string;
    accent?: string;
}) {
    const [showSimilar, setShowSimilar] = useState(false);

    if (groups.length === 0) {
        return <div className="text-center py-16 text-slate-500 text-sm">No room analyses available yet.</div>;
    }

    const safeIdx = Math.min(selectedIdx, groups.length - 1);
    const group = groups[safeIdx];
    const stripPhotos = [group.canonical, ...group.sent];
    const allFields = parseAnalysisFields(group.canonical.analysis || '');
    const facets = allFields.filter(f => f.key !== 'Space' && f.key !== 'Description');
    const description = allFields.find(f => f.key === 'Description');
    const ext = isExteriorGroup(group);
    const palettes = ext ? EXT_PALETTES : INT_PALETTES;

    const extGroups = groups.filter(g => isExteriorGroup(g));
    const intGroups = groups.filter(g => !isExteriorGroup(g));
    const totalPhotos = groups.reduce((s, g) => s + 1 + g.sent.length + g.similar.length, 0);
    const totalFacets = groups.reduce((s, g) =>
        s + parseAnalysisFields(g.canonical.analysis || '').filter(f => f.key !== 'Space' && f.key !== 'Description').length, 0);

    const handleSelect = (idx: number) => { onSelectIdx(idx); setShowSimilar(false); };

    // Accent tokens for the selected room
    const accentText = ext ? 'text-emerald-600' : 'text-violet-600';
    const badgeBg = ext ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800';
    const narrativeBg = ext ? 'bg-emerald-50 border-emerald-200' : 'bg-violet-50 border-violet-200';
    const narrativeTx = ext ? 'text-emerald-700' : 'text-violet-700';
    const diamondBg = ext ? 'bg-emerald-600' : 'bg-violet-600';
    const obsLabel = ext ? 'text-emerald-600' : 'text-violet-600';

    return (
        <div className="space-y-5">
            {/* ── Page header — shown only in standalone mode ── */}
            {!embedded && (
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">SPACES · LLM</span>
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">COMPUTER-VISION WALKTHROUGH</span>
                        </div>
                        <h2 className="font-serif text-3xl text-slate-900 leading-tight">
                            Every room, <em className="text-emerald-500 not-italic font-serif">seen and described.</em>
                        </h2>
                        <p className="text-sm text-slate-600 mt-2">
                            Our vision model studied <strong className="text-slate-900">{totalPhotos} photos</strong> and grouped them into {groups.length} canonical spaces · <strong className="text-slate-900">{totalFacets}</strong> structured facets extracted.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        {[
                            { val: groups.length, lbl: 'SPACES' },
                            { val: totalPhotos, lbl: 'PHOTOS' },
                            { val: extGroups.length, lbl: 'EXT.' },
                            { val: intGroups.length, lbl: 'INT.' },
                        ].map(s => (
                            <div key={s.lbl} className="text-center bg-white border border-slate-200 rounded-xl px-3 py-2 min-w-[52px]">
                                <div className="text-lg font-black text-slate-900">{s.val}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.lbl}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Embedded section heading ── */}
            {embedded && (
                <SectionTitleBar
                    num={sectionNum ?? '03'}
                    kicker="Room by Room"
                    title={`${groups.length} spaces explored`}
                    italicWord="spaces"
                    accent={accent ?? '#4f46e5'}
                />
            )}

            {/* ── Horizontal room nav ── */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 overflow-x-auto">
                <div className="flex gap-8 min-w-max">
                    {/* Exterior section */}
                    {extGroups.length > 0 && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-2.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">EXTERIOR · {extGroups.length}</span>
                            </div>
                            <div className="flex gap-2">
                                {extGroups.map(g => {
                                    const gi = groups.indexOf(g);
                                    return <RoomNavCard key={String(gi)} group={g} globalIdx={gi} isActive={gi === safeIdx} onSelect={handleSelect} />;
                                })}
                            </div>
                        </div>
                    )}
                    {extGroups.length > 0 && intGroups.length > 0 && (
                        <div className="w-px bg-slate-200 self-stretch my-1" />
                    )}
                    {/* Interior section */}
                    {intGroups.length > 0 && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-2.5">
                                <span className="w-2 h-2 rounded-full bg-violet-500" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">INTERIOR · {intGroups.length}</span>
                            </div>
                            <div className="flex gap-2">
                                {intGroups.map(g => {
                                    const gi = groups.indexOf(g);
                                    return <RoomNavCard key={String(gi)} group={g} globalIdx={gi} isActive={gi === safeIdx} onSelect={handleSelect} />;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Detail panel ── */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {/* Detail header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className={`text-4xl font-black leading-none tabular-nums ${accentText}`}>
                            {String(safeIdx + 1).padStart(2, '0')}
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black text-slate-900">{group.label}</h3>
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeBg}`}>
                                    {ext ? 'EXTERIOR' : 'INTERIOR'}
                                </span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* AI Narrative — full width, right below header border */}
                {group.canonical.analysis && description && (
                    <div className={`mx-5 mt-4 mb-0 border rounded-xl p-4 ${ext
                        ? 'bg-gradient-to-b from-emerald-50/70 to-white border-emerald-100'
                        : 'bg-gradient-to-b from-violet-50/70 to-white border-violet-100'
                    }`}>
                        <div className="flex items-center gap-2 mb-2.5">
                            <span className={`w-5 h-5 rounded-md ${diamondBg} text-white text-[10px] font-black flex items-center justify-center flex-shrink-0`}>1</span>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${narrativeTx}`}>AI NARRATIVE</span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{description.value}</p>
                    </div>
                )}

                {/* Body: image column + analysis column */}
                <div className="flex">
                    {/* Left — image + photo strip */}
                    <div className="w-[280px] flex-shrink-0 border-r border-slate-100">
                        <div className="relative m-2 rounded-lg overflow-hidden">
                            {group.canonical.url ? (
                                <img
                                    src={group.canonical.url}
                                    alt={group.label}
                                    className="w-full h-[220px] object-cover cursor-zoom-in"
                                    onClick={() => group.canonical.url && onEnlargeImage(group.canonical.url)}
                                />
                            ) : (
                                <div className="w-full h-[220px] bg-slate-100 flex items-center justify-center text-slate-400 text-xs">No photo</div>
                            )}
                            <span className="absolute top-2 left-2 text-[10px] font-black text-white bg-black/70 rounded px-1.5 py-0.5">#1</span>
                            <span className={`absolute bottom-2 right-2 text-[9px] font-black px-2 py-0.5 rounded-full ${ext ? 'bg-emerald-500/90 text-white' : 'bg-violet-500/90 text-white'}`}>
                                ✦ VISION-ANALYZED
                            </span>
                        </div>
                        {/* Strip */}
                        {stripPhotos.length > 1 && (
                            <div className="flex gap-1.5 flex-wrap p-2.5 border-t border-slate-100 bg-slate-50/50">
                                {stripPhotos.map((p, pi) => (
                                    <div key={pi} className="relative flex-shrink-0">
                                        <img
                                            src={p.url}
                                            alt=""
                                            className="w-[58px] h-[44px] object-cover rounded-lg cursor-zoom-in hover:opacity-90 transition-opacity"
                                            loading="lazy"
                                            onClick={() => p.url && onEnlargeImage(p.url)}
                                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                                        />
                                        <span className="absolute top-0.5 left-0.5 text-[8px] font-bold text-white bg-black/60 rounded px-0.5 leading-tight">
                                            #{(p.photo_index ?? 0) + 1}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Similar toggle */}
                        {group.similar.length > 0 && (
                            <div className="px-3 py-2 border-t border-slate-100">
                                <button
                                    onClick={() => setShowSimilar(v => !v)}
                                    className="text-[10px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1"
                                >
                                    {showSimilar ? '▾' : '▸'} {group.similar.length} more not sent to LLM
                                </button>
                                {showSimilar && (
                                    <div className="mt-2 flex gap-1.5 flex-wrap">
                                        {group.similar.map((p, pi) => (
                                            <div key={pi} className="relative flex-shrink-0">
                                                <img
                                                    src={p.url} alt=""
                                                    className="w-[52px] h-[40px] object-cover rounded opacity-60 hover:opacity-100 cursor-zoom-in transition-opacity"
                                                    loading="lazy"
                                                    onClick={() => p.url && onEnlargeImage(p.url)}
                                                />
                                                <span className="absolute top-0 left-0 text-[8px] font-bold text-white bg-black/50 rounded-br px-0.5 leading-tight">
                                                    #{(p.photo_index ?? 0) + 1}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right — facets */}
                    <div className="flex-1 px-5 pb-5 pt-4 min-w-0">
                        {group.canonical.analysis ? (
                            <>


                                {/* Facet cards — 3-col grid */}
                                {facets.filter(f => f.value !== 'Not visible').length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {facets.filter(f => f.value !== 'Not visible').map((f, i) => {
                                            const p = palettes[i % palettes.length];
                                            const lbl = f.fieldName || f.key;
                                            return (
                                                <div key={i} className={`bg-white border ${p.border} rounded-xl p-3`}>
                                                    <div className={`text-[9px] font-black uppercase tracking-wider mb-1.5 leading-tight ${p.label}`}>
                                                        {lbl}
                                                    </div>
                                                    <p className="text-[11px] text-slate-800 leading-snug">{f.value}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-4 rounded-xl">
                                No analysis — {group.canonical.error || 'unknown error'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Orphans */}
            {orphans.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h3 className="text-sm font-black text-amber-900 mb-1">
                        {orphans.length} photo{orphans.length === 1 ? '' : 's'} without analysis
                    </h3>
                    <p className="text-xs text-amber-700 mb-3">Failed classification or image fetch.</p>
                    <div className="flex gap-2 flex-wrap">
                        {orphans.map((p, pi) => (
                            <div key={pi} className="flex-shrink-0 relative">
                                {p.url && (
                                    <img src={p.url} alt="" className="h-16 w-20 object-cover rounded-lg opacity-60 hover:opacity-100 cursor-zoom-in transition-opacity" loading="lazy" onClick={() => p.url && onEnlargeImage(p.url)} />
                                )}
                                <span className="absolute top-0 left-0 text-[9px] font-bold text-white bg-black/50 rounded-br px-1 leading-tight">
                                    #{(p.photo_index ?? 0) + 1}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SynthesisOutdoor({
    synthesis: s, error, inputCount, groups, propertyImages, onEnlargeImage
}: {
    synthesis: ExteriorSynthesis | null;
    error: string | null;
    inputCount: number;
    groups: GroupView[];
    propertyImages?: string[];
    onEnlargeImage: (url: string) => void;
}) {
    if (!s) return <SynthesisEmpty kind="outdoor" error={error} inputCount={inputCount} />;
    return (
        <div className="space-y-8">
            {/* Hero */}
            <div className="bg-gradient-to-b from-emerald-50/60 to-white border border-emerald-100 rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-[11px] font-bold">◈ {s.facet_tags.style_tag}</span>
                        {(() => {
                            const styleVal = s.facet_tags.style_tag?.trim().toLowerCase();
                            const seen = new Set<string>();
                            if (styleVal) seen.add(styleVal);

                            const uniqueObjectiveTags = s.objective_tags.filter(t => {
                                const val = t?.trim().toLowerCase();
                                if (!val || seen.has(val)) return false;
                                seen.add(val);
                                return true;
                            });

                            return uniqueObjectiveTags.slice(0, 6).map(t => (
                                <span key={t} className="bg-white text-slate-600 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-slate-200">{t}</span>
                            ));
                        })()}
                    </div>
                    <h2 className="font-serif text-2xl text-slate-900 mb-3 leading-tight">{s.hero_headline || <>Outdoor &amp; <em className="text-emerald-600">curb appeal</em></>}</h2>
                    <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                        <p className="whitespace-pre-line">{s.exterior_and_lot_appeal.curb_appeal}</p>
                        <p className="whitespace-pre-line">{s.exterior_and_lot_appeal.backyard_and_patio}</p>
                    </div>
                </div>

                {/* Photo grid - Mosaic of top 3 photos */}
                {(() => {
                    let items: Array<{ url: string; label: string }> = [];
                    const used = new Set<string>();

                    for (const g of groups) {
                        const url = g.canonical?.url;
                        if (url && !used.has(url)) {
                            items.push({ url, label: g.label || '' });
                            used.add(url);
                            if (items.length >= 3) break;
                        }
                    }

                    if (items.length < 3 && propertyImages) {
                        for (const url of propertyImages) {
                            if (url && !used.has(url)) {
                                items.push({ url, label: '' });
                                used.add(url);
                                if (items.length >= 3) break;
                            }
                        }
                    }

                    if (items.length === 0) return null;

                    return (
                        <div className="grid grid-cols-2 gap-3">
                            {items.map((img, i) => (
                                <div
                                    key={i}
                                    className={`rounded-xl overflow-hidden relative border border-slate-200 cursor-zoom-in bg-slate-50 ${i === 0 ? 'col-span-2 h-[260px]' : 'h-[160px]'
                                        }`}
                                    onClick={() => onEnlargeImage(img.url)}
                                >
                                    <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                                    {img.label && (
                                        <div className="absolute bottom-3 left-3 bg-slate-900/75 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                            {img.label}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* Atmosphere dials */}
            <section>
                <SectionTitleBar num="01" kicker="Outdoor Dials" title="How the outside reads" italicWord="outside" accent="#059669" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <ScoreDial label="Curb Appeal" value={s.exterior_atmosphere_scores.curb_appeal_score} hint={s.facet_tags.style_tag} color="#059669" />
                    <ScoreDial label="Outdoor Living" value={s.exterior_atmosphere_scores.outdoor_living_score} hint="Backyard & patio" color="#0891b2" />
                    <ScoreDial label="Privacy" value={s.exterior_atmosphere_scores.privacy_score} hint={s.facet_tags.privacy_tag} color="#7c3aed" />
                    <ScoreDial label="Views" value={s.exterior_atmosphere_scores.view_score} hint={s.facet_tags.views_tag} color="#d97706" />
                </div>
            </section>

            {/* Six Dimensions of plot */}
            <section>
                <SectionTitleBar num="02" kicker="Outdoor Facets" title="Six dimensions of the outdoor" italicWord="dimensions" accent="#059669" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <FacetCard num={1} title="Style" chip={s.facet_tags.style_tag} body={s.exterior_and_lot_appeal.architecture_style} theme="outdoor" />
                    <FacetCard num={2} title="Curb Appeal" body={s.exterior_and_lot_appeal.curb_appeal} theme="outdoor" />
                    <FacetCard num={3} title="Backyard" body={s.exterior_and_lot_appeal.backyard_and_patio} theme="outdoor" />
                    <FacetCard num={4} title="Privacy" chip={s.facet_tags.privacy_tag} body={s.views_privacy_orientation.privacy} theme="outdoor" />
                    <FacetCard num={5} title="Views" chip={s.facet_tags.views_tag} body={s.views_privacy_orientation.views} theme="outdoor" />
                    <FacetCard num={6} title="Lot Coverage" chip={s.facet_tags.lot_coverage_tag} body={`Inferred coverage: ${s.facet_tags.lot_coverage_tag}. ${s.objective_tags.length > 0 ? 'Notable lot features: ' + s.objective_tags.slice(0, 6).join(', ') + '.' : ''}`} theme="outdoor" />
                </div>
            </section>
        </div>
    );
}
