import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../../services/firebaseService';
import { runSatellitaryAnalysis, getOrCacheAerialSatelliteUrl, forceRefreshAerialSatelliteUrl, forceRefreshAllImagesAndAnalyze, computeGeocodingAzimuth } from '../../services/satellitaryService';
import { savePropertyOrientationToCloud } from '../../services/firebase/properties';
import { saveOrientationAssessment, OrientationAssessmentValue } from '../../services/firebase/ai_assessment';

// ─── Local Types ──────────────────────────────────────────────────────────────

interface OrientationRow {
    zpid: string;
    address: string;
    city: string;
    mapZoomIn?: string;
    mapZoomOut?: string;
    streetView?: string;
    orientationAI?: {
        final_orientation: string;
        azimuth_degrees: number | null;
        confidence: 'high' | 'medium' | 'low';
        image_quality?: 'clear' | 'acceptable' | 'blurry';
        aerial_only_mode: boolean;
        feng_shui_vastu?: string | null;
        privacy_insight?: string;
        lot_coverage_hardscape?: number | null;
        lot_coverage_pervious?: number | null;
        buyer_pro?: string;
        buyer_con?: string;
    } | null;
    orientationGeocoding?: {
        azimuth_degrees: number;
        orientation: string;
    } | null;
    finalOrientation?: string | null;
    coordinates?: { latitude: number; longitude: number };
    orientationAssessment: OrientationAssessmentValue[];  // multi-select
    geocodingNA?: boolean;   // true = geocoding ran but API returned no entrance data
    status: 'idle' | 'running' | 'refreshing' | 'done' | 'error';
    error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONF_COLOR: Record<string, string> = {
    high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-rose-50 text-rose-700 border-rose-200',
};

function DirBadge({ label, azimuth, color }: { label: string; azimuth?: number | null; color: string }) {
    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider ${color}`}>
            {label}
            {azimuth != null && <span className="opacity-60 font-mono">{azimuth}°</span>}
        </div>
    );
}

function ProgressBar({ label, progress }: { label: string; progress: { done: number; total: number } }) {
    return (
        <div className="bg-white rounded-2xl border border-indigo-100 p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">{label}</span>
                <span className="text-[11px] font-mono text-slate-500">{progress.done} / {progress.total}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const OrientationAuditTab: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
    const [rows, setRows] = useState<OrientationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCity, setActiveCity] = useState<string | null>(null);
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
    const [geocodeBatchRunning, setGeocodeBatchRunning] = useState(false);
    const [geocodeBatchProgress, setGeocodeBatchProgress] = useState<{ done: number; total: number } | null>(null);
    const [redownloadRunning, setRedownloadRunning] = useState(false);
    const [redownloadProgress, setRedownloadProgress] = useState<{ done: number; total: number } | null>(null);

    // ── Fetch all properties + visual analyses ────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch properties, visual analyses, and ai_assessment in parallel
            const [propSnap, visualSnap, assessmentSnap] = await Promise.all([
                getDocs(query(collection(db, 'properties'), orderBy('address', 'asc'))),
                getDocs(collection(db, 'property_analyses_visual')),
                getDocs(collection(db, 'ai_assessment')),
            ]);

            // Build a zpid → neighborhood orientation lookup from visual analyses
            const visualOrientationMap: Record<string, string> = {};
            visualSnap.docs.forEach(d => {
                const va = d.data() as any;
                const fo = va?.neighborhood?.orientation?.final_orientation;
                if (fo) visualOrientationMap[d.id] = fo;
            });

            // Build a zpid → orientation_assessment[] lookup from ai_assessment
            // Handles both old single-string format and new array format
            const orientationAssessmentMap: Record<string, OrientationAssessmentValue[]> = {};
            assessmentSnap.docs.forEach(d => {
                const raw = (d.data() as any)?.orientation_assessment;
                if (!raw) return;
                if (Array.isArray(raw)) {
                    orientationAssessmentMap[d.id] = raw as OrientationAssessmentValue[];
                } else if (typeof raw === 'string') {
                    // backward compat: old single-value string
                    orientationAssessmentMap[d.id] = [raw as OrientationAssessmentValue];
                }
            });

            const built: OrientationRow[] = propSnap.docs.map(d => {
                const p = d.data() as any;
                return {
                    zpid: d.id,
                    address: p.address || d.id,
                    city: p.city || 'Other',
                    mapZoomIn: p.mapZoomIn || undefined,
                    mapZoomOut: p.mapZoomOut || undefined,
                    streetView: p.streetViewAnalysis?.imageUrl || p.streetView || undefined,
                    orientationAI: p.orientation_ai || null,
                    orientationGeocoding: p.orientation_geocoding || null,
                    finalOrientation:
                        // 1. Neighborhood AI analysis (property_analyses_visual collection)
                        visualOrientationMap[d.id] ||
                        // 2. Satellitary-cached orientation (from our new caching)
                        (p.orientation_ai?.final_orientation as string | undefined) ||
                        null,
                    coordinates: p.coordinates || undefined,
                    orientationAssessment: orientationAssessmentMap[d.id] ?? [],
                    status: 'idle' as const,
                };
            });
            setRows(built);

            if (!activeCity && built.length > 0) {
                const cityCounts: Record<string, number> = {};
                built.forEach(r => { cityCounts[r.city] = (cityCounts[r.city] || 0) + 1; });
                const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
                setActiveCity(sorted[0]?.[0] || null);
            }

            // Background: cache satellite images for rows without one
            const toFetch = built.filter(
                r => r.coordinates && (!r.mapZoomOut || !r.mapZoomOut.includes('firebasestorage'))
            );
            const CONCURRENCY = 10;
            for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
                const batch = toFetch.slice(i, i + CONCURRENCY);
                await Promise.allSettled(
                    batch.map(async row => {
                        try {
                            const url = await getOrCacheAerialSatelliteUrl(
                                row.zpid,
                                row.coordinates!.latitude,
                                row.coordinates!.longitude
                            );
                            setRows(prev => prev.map(r =>
                                r.zpid === row.zpid ? { ...r, mapZoomOut: url } : r
                            ));
                        } catch (e) {
                            console.warn(`[OrientationAudit] Satellite cache failed for ${row.zpid}:`, e);
                        }
                    })
                );
            }
        } catch (e) {
            console.error('[OrientationAudit] Failed to fetch properties:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const cities = useMemo(() => {
        const m: Record<string, number> = {};
        rows.forEach(r => { m[r.city] = (m[r.city] || 0) + 1; });
        return Object.entries(m)
            .filter(([, c]) => c >= 5)
            .sort((a, b) => b[1] - a[1])
            .map(([name, total]) => ({ name, total }));
    }, [rows]);

    const filteredRows = useMemo(() =>
        activeCity ? rows.filter(r => r.city === activeCity) : rows
        , [rows, activeCity]);

    // Running tally: how many filteredRows include each assessment option
    const assessmentCounts = useMemo(() => {
        const counts: Record<OrientationAssessmentValue, number> = {
            radar_map: 0, satellite: 0, geocode: 0, none: 0, all: 0,
        };
        for (const row of filteredRows) {
            for (const v of row.orientationAssessment) {
                counts[v] = (counts[v] ?? 0) + 1;
            }
        }
        return counts;
    }, [filteredRows]);

    const assessedCount = useMemo(() =>
        filteredRows.filter(r => r.orientationAssessment.length > 0).length,
        [filteredRows]
    );

    // ── Run single row ────────────────────────────────────────────────────────
    const runForRow = async (zpid: string) => {
        const row = rows.find(r => r.zpid === zpid);
        if (!row?.coordinates) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: 'No coordinates' } : r));
            return;
        }
        setRows(prev => prev.map(r => r.zpid === zpid ? { ...r, status: 'running', error: undefined } : r));
        try {
            const result = await runSatellitaryAnalysis(
                row.coordinates.latitude,
                row.coordinates.longitude,
                row.streetView,
                auth?.currentUser?.uid || 'unknown',  // userId for llm_call_events logging
                zpid,
                row.address
            );
            setRows(prev => prev.map(r => r.zpid === zpid ? {
                ...r,
                status: 'done',
                orientationAI: {
                    final_orientation: result.final_orientation,
                    azimuth_degrees: result.azimuth_degrees,
                    confidence: result.confidence,
                    image_quality: result.image_quality,
                    aerial_only_mode: result.aerial_only_mode,
                    feng_shui_vastu: result.feng_shui_vastu,
                    privacy_insight: result.privacy_insight,
                    lot_coverage_hardscape: result.lot_coverage_hardscape,
                    lot_coverage_pervious: result.lot_coverage_pervious,
                    buyer_pro: result.buyer_pro,
                    buyer_con: result.buyer_con,
                },
                orientationGeocoding: result.geocoding_entrance_available && result.geocoding_azimuth_degrees != null
                    ? { azimuth_degrees: result.geocoding_azimuth_degrees, orientation: result.geocoding_orientation! }
                    : r.orientationGeocoding,
                mapZoomIn: r.mapZoomIn || result.aerial_url,
                streetView: r.streetView || result.street_view_url || undefined,
            } : r));
        } catch (e: any) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: e.message || 'Unknown error' } : r));
        }
    };

    // ── Force-refresh single row (delete images → re-download → re-analyze) ───
    const forceRefreshForRow = async (zpid: string) => {
        const row = rows.find(r => r.zpid === zpid);
        if (!row?.coordinates) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: 'No coordinates' } : r));
            return;
        }
        setRows(prev => prev.map(r => r.zpid === zpid
            ? { ...r, status: 'refreshing', error: undefined } : r));
        try {
            const result = await forceRefreshAllImagesAndAnalyze(
                zpid,
                row.coordinates.latitude,
                row.coordinates.longitude,
                auth?.currentUser?.uid || 'unknown',
                row.address
            );
            setRows(prev => prev.map(r => r.zpid === zpid ? {
                ...r,
                status: 'done',
                // Update images with freshly downloaded versions
                mapZoomOut: result.freshAerialUrl || r.mapZoomOut,
                streetView: result.freshStreetViewUrl || r.streetView,
                // Update orientation results
                orientationAI: {
                    final_orientation: result.final_orientation,
                    azimuth_degrees: result.azimuth_degrees,
                    confidence: result.confidence,
                    image_quality: result.image_quality,
                    aerial_only_mode: result.aerial_only_mode,
                    feng_shui_vastu: result.feng_shui_vastu,
                    privacy_insight: result.privacy_insight,
                    lot_coverage_hardscape: result.lot_coverage_hardscape,
                    lot_coverage_pervious: result.lot_coverage_pervious,
                    buyer_pro: result.buyer_pro,
                    buyer_con: result.buyer_con,
                },
                orientationGeocoding: result.geocoding_entrance_available && result.geocoding_azimuth_degrees != null
                    ? { azimuth_degrees: result.geocoding_azimuth_degrees, orientation: result.geocoding_orientation! }
                    : r.orientationGeocoding,
            } : r));
        } catch (e: any) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: e.message || 'Refresh failed' } : r));
        }
    };

    // ── Batch calculate orientations ──────────────────────────────────────────
    const handleBatchRun = async () => {
        const targets = filteredRows.filter(r => r.coordinates && r.status !== 'running');
        if (targets.length === 0) return;
        setBatchRunning(true);
        setBatchProgress({ done: 0, total: targets.length });
        for (let i = 0; i < targets.length; i++) {
            await runForRow(targets[i].zpid);
            setBatchProgress({ done: i + 1, total: targets.length });
        }
        setBatchRunning(false);
        setBatchProgress(null);
    };

    // ── Batch geocoding orientation (no Gemini) ────────────────────────────────
    const handleBatchGeocode = async () => {
        const targets = filteredRows.filter(r => r.coordinates);
        if (targets.length === 0) return;
        setGeocodeBatchRunning(true);
        setGeocodeBatchProgress({ done: 0, total: targets.length });
        const CONCURRENCY = 10;
        for (let i = 0; i < targets.length; i += CONCURRENCY) {
            const batch = targets.slice(i, i + CONCURRENCY);
            await Promise.allSettled(
                batch.map(async row => {
                    try {
                        const geo = await computeGeocodingAzimuth(
                            row.coordinates!.latitude,
                            row.coordinates!.longitude
                        );
                        if (geo) {
                            savePropertyOrientationToCloud(
                                row.zpid,
                                null,
                                { azimuth_degrees: geo.azimuth, orientation: geo.orientation }
                            ).catch(e => console.warn('[OrientationAudit] Geocode cache write failed:', e));
                            setRows(prev => prev.map(r =>
                                r.zpid === row.zpid
                                    ? { ...r, orientationGeocoding: { azimuth_degrees: geo.azimuth, orientation: geo.orientation } }
                                    : r
                            ));
                        }
                    } catch (e) {
                        console.warn(`[OrientationAudit] Geocode failed for ${row.zpid}:`, e);
                    }
                })
            );
            setGeocodeBatchProgress({ done: Math.min(i + CONCURRENCY, targets.length), total: targets.length });
        }
        setGeocodeBatchRunning(false);
        setGeocodeBatchProgress(null);
    };

    // ── Force re-download satellite images ────────────────────────────────────
    const handleRedownloadSatellites = async () => {
        const targets = filteredRows.filter(r => r.coordinates);
        if (targets.length === 0) return;
        setRedownloadRunning(true);
        setRedownloadProgress({ done: 0, total: targets.length });
        const CONCURRENCY = 10;
        for (let i = 0; i < targets.length; i += CONCURRENCY) {
            const batch = targets.slice(i, i + CONCURRENCY);
            await Promise.allSettled(
                batch.map(async row => {
                    try {
                        const url = await forceRefreshAerialSatelliteUrl(
                            row.zpid,
                            row.coordinates!.latitude,
                            row.coordinates!.longitude
                        );
                        setRows(prev => prev.map(r =>
                            r.zpid === row.zpid ? { ...r, mapZoomOut: url } : r
                        ));
                    } catch (e) {
                        console.warn(`[OrientationAudit] Re-download failed for ${row.zpid}:`, e);
                    }
                })
            );
            setRedownloadProgress({ done: Math.min(i + CONCURRENCY, targets.length), total: targets.length });
        }
        setRedownloadRunning(false);
        setRedownloadProgress(null);
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900">Orientation Audit</h2>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Estimated orientation based on AI satellite analysis, geocoding, and cached data — results are indicative, not definitive
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Refresh — admin only */}
                    {isAdmin && (
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-40"
                            title="Refresh data"
                        >
                            <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    )}

                    {/* Geocode All — admin only */}
                    {isAdmin && (
                        <button
                            onClick={handleBatchGeocode}
                            disabled={geocodeBatchRunning || batchRunning || redownloadRunning || loading || filteredRows.filter(r => r.coordinates).length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            title="Run geocoding orientation for all properties in this city (no AI, fast)"
                        >
                            {geocodeBatchRunning ? (
                                <>
                                    <i className="fa-solid fa-spinner animate-spin text-xs" />
                                    {geocodeBatchProgress ? `${geocodeBatchProgress.done}/${geocodeBatchProgress.total}` : 'Geocoding…'}
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-location-crosshairs text-xs" />
                                    Geocode All
                                </>
                            )}
                        </button>
                    )}

                    {/* Re-download satellites — admin only */}
                    {isAdmin && (
                        <button
                            onClick={handleRedownloadSatellites}
                            disabled={redownloadRunning || batchRunning || loading || filteredRows.filter(r => r.coordinates).length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            title="Force re-download all satellite images for this city (ignores cache)"
                        >
                            {redownloadRunning ? (
                                <>
                                    <i className="fa-solid fa-spinner animate-spin text-xs" />
                                    {redownloadProgress ? `${redownloadProgress.done}/${redownloadProgress.total}` : 'Downloading…'}
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-satellite text-xs" />
                                    Re-download Satellites
                                </>
                            )}
                        </button>
                    )}

                    {/* Calculate all orientations — admin only */}
                    {isAdmin && (
                        <button
                            onClick={handleBatchRun}
                            disabled={batchRunning || geocodeBatchRunning || redownloadRunning || loading || filteredRows.length === 0}
                            className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-slate-800 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:scale-[1.03] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {batchRunning ? (
                                <>
                                    <i className="fa-solid fa-spinner animate-spin text-xs" />
                                    {batchProgress ? `${batchProgress.done}/${batchProgress.total}` : 'Running…'}
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-satellite-dish text-xs" />
                                    Calculate All ({filteredRows.filter(r => r.coordinates).length})
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* City tabs */}
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {cities.map(c => (
                    <button
                        key={c.name}
                        onClick={() => setActiveCity(c.name)}
                        className={`px-5 py-2.5 rounded-[1.2rem] text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border flex-shrink-0
                            ${activeCity === c.name
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
                    >
                        {c.name}
                        <span className={`ml-2 text-[9px] ${activeCity === c.name ? 'text-slate-400' : 'text-slate-300'}`}>
                            {c.total}
                        </span>
                    </button>
                ))}
            </div>

            {/* Progress bars */}
            {batchProgress && (
                <ProgressBar label="Calculating satellite orientations…" progress={batchProgress} />
            )}
            {geocodeBatchProgress && (
                <ProgressBar label="Geocoding orientations…" progress={geocodeBatchProgress} />
            )}
            {redownloadProgress && (
                <ProgressBar label="Re-downloading satellite images…" progress={redownloadProgress} />
            )}

            {/* Table */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-32">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading properties…</p>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">

                    {/* Assessment accuracy summary bar */}
                    <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Assessment counts</span>
                            {([
                                { v: 'radar_map' as OrientationAssessmentValue, label: 'Radar Map', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
                                { v: 'satellite' as OrientationAssessmentValue, label: 'Satellite', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
                                { v: 'geocode' as OrientationAssessmentValue, label: 'Geocode', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
                                { v: 'none' as OrientationAssessmentValue, label: 'None', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-400' },
                                { v: 'all' as OrientationAssessmentValue, label: 'All', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-400' },
                            ]).map(({ v, label, bg, text, border, dot }) => {
                                const count = assessmentCounts[v];
                                const pct = assessedCount > 0 ? Math.round((count / assessedCount) * 100) : 0;
                                return (
                                    <div
                                        key={v}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${bg} ${border} transition-all`}
                                    >
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                                        <span className={`text-[9px] font-black uppercase tracking-wide ${text}`}>{label}</span>
                                        <span className={`text-[11px] font-black ${text}`}>{count}</span>
                                        <span className={`text-[8px] font-semibold opacity-60 ${text}`}>{pct}%</span>
                                    </div>
                                );
                            })}
                            <div className="ml-auto flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span className="text-slate-600">{assessedCount}</span> / {filteredRows.length} assessed
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-10">#</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[140px]">Property</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[100px]">Close-up Map</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[100px]">Satellite</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[100px]">Street View</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[130px]">Radar Map</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px]">Satellite</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px]">Geocoding Orientation</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[160px]">Orientation Assessment</th>
                                    {isAdmin && <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right min-w-[100px]">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-24 text-center">
                                            <i className="fa-solid fa-folder-open text-4xl text-slate-100 mb-3 block" />
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No properties in this city</p>
                                        </td>
                                    </tr>
                                ) : filteredRows.map((row, idx) => (
                                    <tr
                                        key={row.zpid}
                                        className={`group hover:bg-slate-50/40 transition-colors ${(row.status === 'running' || row.status === 'refreshing') ? 'animate-pulse' : ''}`}
                                    >
                                        <td className="p-5 text-center w-10">
                                            <span className="text-[11px] font-black text-slate-300 font-mono">{idx + 1}</span>
                                        </td>
                                        <td className="p-5">
                                            <div className="text-[11px] font-black text-slate-800 leading-tight line-clamp-2">{row.address}</div>
                                            <div className="text-[9px] font-mono text-slate-400 mt-0.5">{row.zpid}</div>
                                            {row.status === 'error' && (
                                                <div className="text-[9px] text-rose-500 font-bold mt-1 truncate max-w-[120px]">{row.error}</div>
                                            )}
                                            {row.status === 'done' && (
                                                <div className="text-[9px] text-emerald-600 font-black mt-1">✓ Updated</div>
                                            )}
                                            {row.status === 'refreshing' && (
                                                <div className="text-[9px] text-indigo-500 font-black mt-1">↻ Refreshing…</div>
                                            )}
                                        </td>

                                        {/* Close-up map */}
                                        <td className="p-5 text-center">
                                            <MapThumb url={row.mapZoomIn} label="Close-up Map" orientations={{
                                                ...row,
                                                selectedAssessment: row.orientationAssessment,
                                                onSelectAssessment: (v) => {
                                                    const next = row.orientationAssessment.includes(v)
                                                        ? row.orientationAssessment.filter(x => x !== v)
                                                        : [...row.orientationAssessment, v];
                                                    setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, orientationAssessment: next } : r));
                                                    saveOrientationAssessment(row.zpid, next).catch(console.error);
                                                },
                                            }} />
                                        </td>

                                        {/* Satellite */}
                                        <td className="p-5 text-center">
                                            <MapThumb url={row.mapZoomOut} label="Satellite" orientations={{
                                                ...row,
                                                selectedAssessment: row.orientationAssessment,
                                                onSelectAssessment: (v) => {
                                                    const next = row.orientationAssessment.includes(v)
                                                        ? row.orientationAssessment.filter(x => x !== v)
                                                        : [...row.orientationAssessment, v];
                                                    setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, orientationAssessment: next } : r));
                                                    saveOrientationAssessment(row.zpid, next).catch(console.error);
                                                },
                                            }} />
                                        </td>

                                        {/* Street view */}
                                        <td className="p-5 text-center">
                                            <MapThumb url={row.streetView} label="Street View" orientations={{
                                                ...row,
                                                selectedAssessment: row.orientationAssessment,
                                                onSelectAssessment: (v) => {
                                                    const next = row.orientationAssessment.includes(v)
                                                        ? row.orientationAssessment.filter(x => x !== v)
                                                        : [...row.orientationAssessment, v];
                                                    setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, orientationAssessment: next } : r));
                                                    saveOrientationAssessment(row.zpid, next).catch(console.error);
                                                },
                                            }} />
                                        </td>

                                        {/* Cached property orientation */}
                                        <td className="p-5">
                                            {row.finalOrientation ? (
                                                <DirBadge label={row.finalOrientation} color="bg-slate-100 text-slate-700 border-slate-200" />
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold">—</span>
                                            )}
                                        </td>

                                        {/* AI orientation */}
                                        <td className="p-5">
                                            {row.orientationAI ? (
                                                <div className="space-y-1.5">
                                                    {row.orientationAI.image_quality === 'blurry' ? (
                                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[10px] font-black bg-slate-100 text-slate-400 border-slate-200">
                                                            <i className="fa-solid fa-eye-slash text-[8px]" />
                                                            Unclear Image
                                                        </div>
                                                    ) : (
                                                        <DirBadge
                                                            label={`~${row.orientationAI.final_orientation}`}
                                                            azimuth={row.orientationAI.azimuth_degrees}
                                                            color="bg-indigo-50 text-indigo-700 border-indigo-200"
                                                        />
                                                    )}
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${CONF_COLOR[row.orientationAI.confidence]}`}>
                                                            {row.orientationAI.confidence}
                                                        </div>
                                                        {row.orientationAI.image_quality && row.orientationAI.image_quality !== 'clear' && (
                                                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${row.orientationAI.image_quality === 'blurry'
                                                                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                                                                    : 'bg-amber-50 text-amber-600 border-amber-200'
                                                                }`}>
                                                                {row.orientationAI.image_quality}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {row.orientationAI.aerial_only_mode && (
                                                        <div className="text-[9px] text-amber-600 font-black">aerial only</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold">—</span>
                                            )}
                                        </td>

                                        {/* Geocoding orientation */}
                                        <td className="p-5">
                                            {row.orientationGeocoding ? (
                                                <div className="space-y-1.5">
                                                    <DirBadge
                                                        label={row.orientationGeocoding.orientation}
                                                        azimuth={row.orientationGeocoding.azimuth_degrees}
                                                        color="bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    />
                                                    {row.orientationAI?.azimuth_degrees != null && (
                                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black border ${Math.abs(row.orientationGeocoding.azimuth_degrees - (row.orientationAI.azimuth_degrees ?? 0)) <= 22.5
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : Math.abs(row.orientationGeocoding.azimuth_degrees - (row.orientationAI.azimuth_degrees ?? 0)) <= 45
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                            }`}>
                                                            Δ {Math.round(Math.abs(row.orientationGeocoding.azimuth_degrees - (row.orientationAI.azimuth_degrees ?? 0)))}°
                                                        </div>
                                                    )}
                                                </div>
                                            ) : row.geocodingNA ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black bg-amber-50 text-amber-600 border border-amber-200">
                                                        <i className="fa-solid fa-triangle-exclamation text-[8px]" />
                                                        N/A
                                                    </span>
                                                    <span className="text-[8px] text-slate-400">No entrance data</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold">—</span>
                                            )}
                                        </td>

                                        {/* Orientation Assessment */}
                                        <td className="p-5">
                                            <AssessmentDropdown
                                                value={row.orientationAssessment}
                                                onChange={(next) => {
                                                    setRows(prev => prev.map(r =>
                                                        r.zpid === row.zpid ? { ...r, orientationAssessment: next } : r
                                                    ));
                                                    saveOrientationAssessment(row.zpid, next)
                                                        .catch(e => console.error('[OrientationAudit] Failed to save assessment:', e));
                                                }}
                                            />
                                        </td>

                                        {/* Action — admin only */}
                                        {isAdmin && (
                                            <td className="p-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Force-refresh: delete images → re-download → re-analyze */}
                                                    <button
                                                        onClick={() => forceRefreshForRow(row.zpid)}
                                                        disabled={row.status === 'running' || row.status === 'refreshing' || batchRunning || !row.coordinates}
                                                        title={!row.coordinates ? 'No coordinates available' : 'Force-refresh: delete cached images, re-download, and re-run orientation analysis'}
                                                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        {row.status === 'refreshing'
                                                            ? <i className="fa-solid fa-spinner animate-spin text-xs" />
                                                            : <i className="fa-solid fa-arrows-rotate text-xs" />}
                                                    </button>
                                                    {/* Run analysis only (uses existing cached images) */}
                                                    <button
                                                        onClick={() => runForRow(row.zpid)}
                                                        disabled={row.status === 'running' || row.status === 'refreshing' || batchRunning || !row.coordinates}
                                                        title={!row.coordinates ? 'No coordinates available' : 'Run orientation analysis (uses existing cached images)'}
                                                        className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        {row.status === 'running'
                                                            ? <i className="fa-solid fa-spinner animate-spin text-xs" />
                                                            : <i className="fa-solid fa-satellite-dish text-xs" />}
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div >
            )}
        </div >
    );
};

// ─── Orientation summary types shared with MapThumb ─────────────────────────

interface OrientationSummary {
    finalOrientation?: string | null;
    orientationAI?: {
        final_orientation: string;
        azimuth_degrees: number | null;
        confidence: 'high' | 'medium' | 'low';
        image_quality?: 'clear' | 'acceptable' | 'blurry';
        aerial_only_mode: boolean;
        feng_shui_vastu?: string | null;
        privacy_insight?: string;
        lot_coverage_hardscape?: number | null;
        lot_coverage_pervious?: number | null;
        buyer_pro?: string;
        buyer_con?: string;
    } | null;
    orientationGeocoding?: {
        azimuth_degrees: number;
        orientation: string;
    } | null;
    selectedAssessment?: OrientationAssessmentValue[];  // multi-select array
    onSelectAssessment?: (v: OrientationAssessmentValue) => void;
}

// ─── Image thumbnail with full-screen modal ───────────────────────────────────

function MapThumb({ url, label, orientations }: {
    url?: string;
    label: string;
    orientations?: OrientationSummary;
}) {
    const [open, setOpen] = useState(false);
    if (!url) return (
        <div className="w-16 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-200 mx-auto">
            <i className="fa-solid fa-image text-xs" />
        </div>
    );
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-16 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:shadow-md hover:scale-105 transition-all mx-auto block"
                title={`View ${label}`}
            >
                <img src={url} alt={label} className="w-full h-full object-cover" />
            </button>
            {open && (
                <div
                    className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="relative w-full max-w-2xl flex flex-col gap-4"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Image */}
                        <div>
                            <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">{label}</div>
                            <img src={url} alt={label} className="w-full rounded-2xl shadow-2xl" />
                        </div>

                        {/* Orientation panel */}
                        {orientations && (
                            <div className="grid grid-cols-3 gap-3">

                                {/* Radar Map */}
                                {(() => {
                                    const isSelected = (orientations.selectedAssessment ?? []).includes('radar_map');
                                    const hasData = !!orientations.finalOrientation;
                                    return (
                                        <button
                                            onClick={() => hasData && orientations.onSelectAssessment?.('radar_map')}
                                            disabled={!hasData || !orientations.onSelectAssessment}
                                            title={hasData ? 'Set assessment to Radar Map' : 'No radar map orientation available'}
                                            className={`text-left rounded-2xl p-4 border transition-all ${isSelected
                                                ? 'bg-white/20 border-white ring-2 ring-white shadow-lg scale-[1.02]'
                                                : hasData && orientations.onSelectAssessment
                                                    ? 'bg-white/10 border-white/10 hover:bg-white/15 hover:border-white/30 cursor-pointer'
                                                    : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[9px] font-black text-white/50 uppercase tracking-widest">Radar Map</div>
                                                {isSelected && <i className="fa-solid fa-check text-[10px] text-white" />}
                                            </div>
                                            {orientations.finalOrientation ? (
                                                <div className="text-sm font-black text-white">{orientations.finalOrientation}</div>
                                            ) : (
                                                <div className="text-[11px] text-white/30 font-bold">—</div>
                                            )}
                                        </button>
                                    );
                                })()}

                                {/* Satellite */}
                                {(() => {
                                    const isSelected = (orientations.selectedAssessment ?? []).includes('satellite');
                                    const hasData = !!orientations.orientationAI;
                                    return (
                                        <button
                                            onClick={() => hasData && orientations.onSelectAssessment?.('satellite')}
                                            disabled={!hasData || !orientations.onSelectAssessment}
                                            title={hasData ? 'Set assessment to Satellite' : 'No satellite orientation available'}
                                            className={`text-left rounded-2xl p-4 border transition-all ${isSelected
                                                ? 'bg-indigo-400/40 border-indigo-300 ring-2 ring-indigo-300 shadow-lg scale-[1.02]'
                                                : hasData && orientations.onSelectAssessment
                                                    ? 'bg-indigo-500/20 border-indigo-400/20 hover:bg-indigo-500/30 hover:border-indigo-300/40 cursor-pointer'
                                                    : 'bg-indigo-500/10 border-indigo-400/10 opacity-50 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Satellite</div>
                                                {isSelected && <i className="fa-solid fa-check text-[10px] text-indigo-200" />}
                                            </div>
                                            {orientations.orientationAI ? (
                                                <>
                                                    {orientations.orientationAI.image_quality === 'blurry' ? (
                                                        <div className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5">
                                                            <i className="fa-solid fa-eye-slash text-[10px]" />
                                                            Unclear image
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="text-[10px] text-indigo-300 font-semibold mb-0.5">likely faces</div>
                                                            <div className="text-sm font-black text-white leading-tight">
                                                                {orientations.orientationAI.final_orientation}
                                                            </div>
                                                            {orientations.orientationAI.azimuth_degrees != null && (
                                                                <div className="text-[10px] text-indigo-300 font-mono mt-0.5">
                                                                    ~{orientations.orientationAI.azimuth_degrees}°
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${orientations.orientationAI.confidence === 'high' ? 'bg-emerald-400/30 text-emerald-300'
                                                            : orientations.orientationAI.confidence === 'medium' ? 'bg-amber-400/30 text-amber-300'
                                                                : 'bg-rose-400/30 text-rose-300'
                                                            }`}>
                                                            {orientations.orientationAI.confidence}
                                                        </span>
                                                        {orientations.orientationAI.image_quality && orientations.orientationAI.image_quality !== 'clear' && (
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${orientations.orientationAI.image_quality === 'blurry'
                                                                    ? 'bg-slate-400/20 text-slate-300'
                                                                    : 'bg-amber-400/20 text-amber-300'
                                                                }`}>
                                                                {orientations.orientationAI.image_quality}
                                                            </span>
                                                        )}
                                                        {orientations.orientationAI.aerial_only_mode && (
                                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300">
                                                                aerial only
                                                            </span>
                                                        )}
                                                    </div>
                                                    {/* Privacy & Overlook */}
                                                    {orientations.orientationAI.privacy_insight && orientations.orientationAI.image_quality !== 'blurry' && (
                                                        <div className="mt-2 pt-2 border-t border-white/10">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <i className="fa-solid fa-eye text-[8px] text-sky-300" />
                                                                <span className="text-[8px] font-black text-sky-300 uppercase tracking-wide">Privacy</span>
                                                            </div>
                                                            <p className="text-[10px] text-white/70 leading-relaxed">{orientations.orientationAI.privacy_insight}</p>
                                                        </div>
                                                    )}
                                                    {/* Lot Coverage */}
                                                    {orientations.orientationAI.lot_coverage_hardscape != null && orientations.orientationAI.image_quality !== 'blurry' && (
                                                        <div className="mt-2 pt-2 border-t border-white/10">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <i className="fa-solid fa-layer-group text-[8px] text-emerald-300" />
                                                                <span className="text-[8px] font-black text-emerald-300 uppercase tracking-wide">Lot Coverage</span>
                                                            </div>
                                                            <div className="flex gap-2 mt-0.5">
                                                                <span className="text-[10px] font-black text-white/80">
                                                                    {orientations.orientationAI.lot_coverage_hardscape}% Hardscape
                                                                </span>
                                                                <span className="text-[10px] text-white/30">/</span>
                                                                <span className="text-[10px] font-black text-emerald-300">
                                                                    {orientations.orientationAI.lot_coverage_pervious}% Pervious
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Buyer Pro / Con */}
                                                    {(orientations.orientationAI.buyer_pro || orientations.orientationAI.buyer_con) && orientations.orientationAI.image_quality !== 'blurry' && (
                                                        <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                                                            {orientations.orientationAI.buyer_pro && (
                                                                <div className="flex items-start gap-1.5">
                                                                    <i className="fa-solid fa-circle-check text-[8px] text-emerald-400 mt-0.5 shrink-0" />
                                                                    <p className="text-[10px] text-emerald-300 leading-relaxed">{orientations.orientationAI.buyer_pro}</p>
                                                                </div>
                                                            )}
                                                            {orientations.orientationAI.buyer_con && (
                                                                <div className="flex items-start gap-1.5">
                                                                    <i className="fa-solid fa-circle-xmark text-[8px] text-rose-400 mt-0.5 shrink-0" />
                                                                    <p className="text-[10px] text-rose-300 leading-relaxed">{orientations.orientationAI.buyer_con}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Feng Shui / Vastu */}
                                                    {orientations.orientationAI.feng_shui_vastu && orientations.orientationAI.image_quality !== 'blurry' && (
                                                        <div className="mt-2 pt-2 border-t border-white/10">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <i className="fa-solid fa-yin-yang text-[8px] text-violet-300" />
                                                                <span className="text-[8px] font-black text-violet-300 uppercase tracking-wide">Feng Shui / Vastu</span>
                                                            </div>
                                                            <p className="text-[10px] text-white/70 leading-relaxed">{orientations.orientationAI.feng_shui_vastu}</p>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-[11px] text-white/30 font-bold">—</div>
                                            )}
                                        </button>
                                    );
                                })()}

                                {/* Geocoding */}
                                {(() => {
                                    const isSelected = (orientations.selectedAssessment ?? []).includes('geocode');
                                    const hasData = !!orientations.orientationGeocoding;
                                    return (
                                        <button
                                            onClick={() => hasData && orientations.onSelectAssessment?.('geocode')}
                                            disabled={!hasData || !orientations.onSelectAssessment}
                                            title={hasData ? 'Set assessment to Geocode' : 'No geocoding orientation available'}
                                            className={`text-left rounded-2xl p-4 border transition-all ${isSelected
                                                ? 'bg-emerald-400/40 border-emerald-300 ring-2 ring-emerald-300 shadow-lg scale-[1.02]'
                                                : hasData && orientations.onSelectAssessment
                                                    ? 'bg-emerald-500/20 border-emerald-400/20 hover:bg-emerald-500/30 hover:border-emerald-300/40 cursor-pointer'
                                                    : 'bg-emerald-500/10 border-emerald-400/10 opacity-50 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[9px] font-black text-emerald-300 uppercase tracking-widest">Geocoding</div>
                                                {isSelected && <i className="fa-solid fa-check text-[10px] text-emerald-200" />}
                                            </div>
                                            {orientations.orientationGeocoding ? (
                                                <>
                                                    <div className="text-sm font-black text-white leading-tight">
                                                        {orientations.orientationGeocoding.orientation}
                                                    </div>
                                                    <div className="text-[10px] text-emerald-300 font-mono mt-0.5">
                                                        {orientations.orientationGeocoding.azimuth_degrees}°
                                                    </div>
                                                    {orientations.orientationAI?.azimuth_degrees != null && (
                                                        <div className={`text-[8px] font-black px-1.5 py-0.5 rounded-md mt-1.5 inline-block ${Math.abs(orientations.orientationGeocoding.azimuth_degrees - (orientations.orientationAI.azimuth_degrees ?? 0)) <= 22.5
                                                            ? 'bg-emerald-400/30 text-emerald-300'
                                                            : Math.abs(orientations.orientationGeocoding.azimuth_degrees - (orientations.orientationAI.azimuth_degrees ?? 0)) <= 45
                                                                ? 'bg-amber-400/30 text-amber-300'
                                                                : 'bg-rose-400/30 text-rose-300'
                                                            }`}>
                                                            Δ {Math.round(Math.abs(orientations.orientationGeocoding.azimuth_degrees - (orientations.orientationAI.azimuth_degrees ?? 0)))}° vs AI
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="text-[11px] text-white/30 font-bold">—</div>
                                            )}
                                        </button>
                                    );
                                })()}

                                {/* None / All row */}
                                {orientations.onSelectAssessment && (
                                    <div className="col-span-3 flex gap-2 mt-1">
                                        {(['none', 'all'] as OrientationAssessmentValue[]).map(v => {
                                            const isSelected = (orientations.selectedAssessment ?? []).includes(v);
                                            return (
                                                <button
                                                    key={v}
                                                    onClick={() => orientations.onSelectAssessment!(v)}
                                                    className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${isSelected
                                                        ? v === 'none'
                                                            ? 'bg-rose-400/40 border-rose-300 ring-2 ring-rose-300 text-rose-100'
                                                            : 'bg-violet-400/40 border-violet-300 ring-2 ring-violet-300 text-violet-100'
                                                        : v === 'none'
                                                            ? 'bg-rose-500/20 border-rose-400/20 text-rose-300 hover:bg-rose-500/30'
                                                            : 'bg-violet-500/20 border-violet-400/20 text-violet-300 hover:bg-violet-500/30'
                                                        }`}
                                                >
                                                    {isSelected && <i className="fa-solid fa-check mr-1.5 text-[8px]" />}
                                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                            </div>
                        )}

                        {/* Close button */}
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                        >
                            <i className="fa-solid fa-xmark text-xs" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

// \u2500\u2500\u2500 Assessment dropdown ─────────────────────────────────────────────────────────

const ASSESSMENT_OPTIONS: { value: OrientationAssessmentValue; label: string }[] = [
    { value: 'radar_map', label: 'Radar Map' },
    { value: 'satellite', label: 'Satellite' },
    { value: 'geocode', label: 'Geocode' },
    { value: 'none', label: 'None' },
    { value: 'all', label: 'All' },
];

const ASSESSMENT_CHIP_COLOR: Record<OrientationAssessmentValue, string> = {
    radar_map: 'bg-amber-100  text-amber-700  border-amber-200',
    satellite: 'bg-blue-100   text-blue-700   border-blue-200',
    geocode: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    none: 'bg-rose-100   text-rose-700   border-rose-200',
    all: 'bg-violet-100 text-violet-700 border-violet-200',
};

function AssessmentDropdown({
    value,
    onChange,
}: {
    value: OrientationAssessmentValue[];
    onChange: (next: OrientationAssessmentValue[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    // Close on outside click
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const toggle = (v: OrientationAssessmentValue) => {
        const next = value.includes(v) ? value.filter(x => x !== v) : [...value, v];
        onChange(next);
    };

    return (
        <div ref={ref} className="relative w-full min-w-[140px]">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full text-left px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-200 min-h-[34px]"
            >
                {value.length === 0 ? (
                    <span className="text-[10px] font-bold text-slate-400">— select —</span>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {value.map(v => (
                            <span
                                key={v}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wide border ${ASSESSMENT_CHIP_COLOR[v]}`}
                            >
                                {ASSESSMENT_OPTIONS.find(o => o.value === v)?.label}
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); toggle(v); }}
                                    className="ml-0.5 text-[7px] opacity-60 hover:opacity-100"
                                >×</button>
                            </span>
                        ))}
                    </div>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                    {ASSESSMENT_OPTIONS.map(o => {
                        const checked = value.includes(o.value);
                        // Extract individual Tailwind classes from the chip-color string
                        const parts = ASSESSMENT_CHIP_COLOR[o.value].trim().split(/\s+/).filter(Boolean);
                        // parts = ['bg-*', 'text-*', 'border-*']
                        const bgCls = parts[0] ?? '';   // e.g. bg-blue-100
                        const textCls = parts[1] ?? '';   // e.g. text-blue-700
                        const borderCls = parts[2] ?? '';  // e.g. border-blue-200
                        return (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => toggle(o.value)}
                                className={`flex items-center gap-2.5 w-full px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide transition-all border-l-2 ${checked
                                    ? `${bgCls} ${borderCls}`
                                    : `bg-white border-transparent hover:${bgCls} hover:border-l-2 hover:${borderCls}`
                                    }`}
                            >
                                {/* Checkbox */}
                                <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? `${bgCls} ${borderCls}` : `border-slate-200 bg-white`
                                    }`}>
                                    {checked && <i className={`fa-solid fa-check text-[7px] ${textCls}`} />}
                                </span>
                                {/* Coloured dot */}
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${bgCls} border ${borderCls}`} />
                                {/* Label — always in its colour */}
                                <span className={textCls}>{o.label}</span>
                            </button>
                        );
                    })}
                    {/* Clear all */}
                    {value.length > 0 && (
                        <div className="border-t border-slate-100 px-3 py-1.5">
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-wide transition-colors"
                            >
                                × Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default OrientationAuditTab;
