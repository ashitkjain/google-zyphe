import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebaseService';
import { runSatellitaryAnalysis, getOrCacheAerialSatelliteUrl, forceRefreshAerialSatelliteUrl, computeGeocodingAzimuth } from '../../services/satellitaryService';
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
        aerial_only_mode: boolean;
    } | null;
    orientationGeocoding?: {
        azimuth_degrees: number;
        orientation: string;
    } | null;
    finalOrientation?: string | null;
    coordinates?: { latitude: number; longitude: number };
    orientationAssessment?: OrientationAssessmentValue | null;
    status: 'idle' | 'running' | 'done' | 'error';
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

const OrientationAuditTab: React.FC = () => {
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

            // Build a zpid → orientation_assessment lookup from ai_assessment
            const orientationAssessmentMap: Record<string, OrientationAssessmentValue> = {};
            assessmentSnap.docs.forEach(d => {
                const oa = (d.data() as any)?.orientation_assessment as OrientationAssessmentValue | undefined;
                if (oa) orientationAssessmentMap[d.id] = oa;
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
                    orientationAssessment: orientationAssessmentMap[d.id] ?? null,
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
                'audit',
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
                    aerial_only_mode: result.aerial_only_mode,
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
                        Compare AI, geocoding, and cached orientation across all properties
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Refresh */}
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-40"
                        title="Refresh data"
                    >
                        <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Geocode All */}
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

                    {/* Re-download satellites */}
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

                    {/* Calculate all orientations */}
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[140px]">Property</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[100px]">Close-up Map</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[100px]">Satellite</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[100px]">Street View</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[130px]">Radar Map</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px]">Satellite</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px]">Geocoding Orientation</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[160px]">Orientation Assessment</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right min-w-[100px]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-24 text-center">
                                            <i className="fa-solid fa-folder-open text-4xl text-slate-100 mb-3 block" />
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No properties in this city</p>
                                        </td>
                                    </tr>
                                ) : filteredRows.map(row => (
                                    <tr
                                        key={row.zpid}
                                        className={`group hover:bg-slate-50/40 transition-colors ${row.status === 'running' ? 'animate-pulse' : ''}`}
                                    >
                                        <td className="p-5">
                                            <div className="text-[11px] font-black text-slate-800 leading-tight line-clamp-2">{row.address}</div>
                                            <div className="text-[9px] font-mono text-slate-400 mt-0.5">{row.zpid}</div>
                                            {row.status === 'error' && (
                                                <div className="text-[9px] text-rose-500 font-bold mt-1 truncate max-w-[120px]">{row.error}</div>
                                            )}
                                            {row.status === 'done' && (
                                                <div className="text-[9px] text-emerald-600 font-black mt-1">✓ Updated</div>
                                            )}
                                        </td>

                                        {/* Close-up map */}
                                        <td className="p-5 text-center">
                                            <MapThumb url={row.mapZoomIn} label="Close-up Map" orientations={{
                                                ...row,
                                                selectedAssessment: row.orientationAssessment,
                                                onSelectAssessment: async (v) => {
                                                    setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, orientationAssessment: v } : r));
                                                    saveOrientationAssessment(row.zpid, v).catch(console.error);
                                                },
                                            }} />
                                        </td>

                                        {/* Satellite */}
                                        <td className="p-5 text-center">
                                            <MapThumb url={row.mapZoomOut} label="Satellite" orientations={{
                                                ...row,
                                                selectedAssessment: row.orientationAssessment,
                                                onSelectAssessment: async (v) => {
                                                    setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, orientationAssessment: v } : r));
                                                    saveOrientationAssessment(row.zpid, v).catch(console.error);
                                                },
                                            }} />
                                        </td>

                                        {/* Street view */}
                                        <td className="p-5 text-center">
                                            <MapThumb url={row.streetView} label="Street View" orientations={{
                                                ...row,
                                                selectedAssessment: row.orientationAssessment,
                                                onSelectAssessment: async (v) => {
                                                    setRows(prev => prev.map(r => r.zpid === row.zpid ? { ...r, orientationAssessment: v } : r));
                                                    saveOrientationAssessment(row.zpid, v).catch(console.error);
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
                                                    <DirBadge
                                                        label={row.orientationAI.final_orientation}
                                                        azimuth={row.orientationAI.azimuth_degrees}
                                                        color="bg-indigo-50 text-indigo-700 border-indigo-200"
                                                    />
                                                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${CONF_COLOR[row.orientationAI.confidence]}`}>
                                                        {row.orientationAI.confidence}
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
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold">—</span>
                                            )}
                                        </td>

                                        {/* Orientation Assessment */}
                                        <td className="p-5">
                                            <AssessmentDropdown
                                                value={row.orientationAssessment ?? null}
                                                onChange={async (val) => {
                                                    setRows(prev => prev.map(r =>
                                                        r.zpid === row.zpid ? { ...r, orientationAssessment: val } : r
                                                    ));
                                                    try {
                                                        await saveOrientationAssessment(row.zpid, val);
                                                    } catch (e) {
                                                        console.error('[OrientationAudit] Failed to save assessment:', e);
                                                    }
                                                }}
                                            />
                                        </td>

                                        {/* Action */}
                                        <td className="p-5 text-right">
                                            <button
                                                onClick={() => runForRow(row.zpid)}
                                                disabled={row.status === 'running' || batchRunning || !row.coordinates}
                                                title={!row.coordinates ? 'No coordinates available' : 'Run orientation analysis'}
                                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                {row.status === 'running'
                                                    ? <i className="fa-solid fa-spinner animate-spin" />
                                                    : <i className="fa-solid fa-satellite-dish" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Orientation summary types shared with MapThumb ─────────────────────────

interface OrientationSummary {
    finalOrientation?: string | null;
    orientationAI?: {
        final_orientation: string;
        azimuth_degrees: number | null;
        confidence: 'high' | 'medium' | 'low';
        aerial_only_mode: boolean;
    } | null;
    orientationGeocoding?: {
        azimuth_degrees: number;
        orientation: string;
    } | null;
    selectedAssessment?: OrientationAssessmentValue | null;
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
                                    const isSelected = orientations.selectedAssessment === 'radar_map';
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
                                    const isSelected = orientations.selectedAssessment === 'satellite';
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
                                                    <div className="text-sm font-black text-white leading-tight">
                                                        {orientations.orientationAI.final_orientation}
                                                    </div>
                                                    {orientations.orientationAI.azimuth_degrees != null && (
                                                        <div className="text-[10px] text-indigo-300 font-mono mt-0.5">
                                                            {orientations.orientationAI.azimuth_degrees}°
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${orientations.orientationAI.confidence === 'high' ? 'bg-emerald-400/30 text-emerald-300'
                                                            : orientations.orientationAI.confidence === 'medium' ? 'bg-amber-400/30 text-amber-300'
                                                                : 'bg-rose-400/30 text-rose-300'
                                                            }`}>
                                                            {orientations.orientationAI.confidence}
                                                        </span>
                                                        {orientations.orientationAI.aerial_only_mode && (
                                                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300">
                                                                aerial only
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-[11px] text-white/30 font-bold">—</div>
                                            )}
                                        </button>
                                    );
                                })()}

                                {/* Geocoding */}
                                {(() => {
                                    const isSelected = orientations.selectedAssessment === 'geocode';
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

const ASSESSMENT_COLOR: Record<OrientationAssessmentValue, string> = {
    radar_map: 'border-blue-200   bg-blue-50   text-blue-700',
    satellite: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    geocode: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    none: 'border-rose-200   bg-rose-50   text-rose-700',
    all: 'border-violet-200 bg-violet-50 text-violet-700',
};

function AssessmentDropdown({
    value,
    onChange,
}: {
    value: OrientationAssessmentValue | null;
    onChange: (v: OrientationAssessmentValue) => void;
}) {
    const colorClass = value ? ASSESSMENT_COLOR[value] : 'border-slate-200 bg-white text-slate-400';
    return (
        <select
            value={value ?? ''}
            onChange={e => {
                if (e.target.value) onChange(e.target.value as OrientationAssessmentValue);
            }}
            className={`w-full text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 ${colorClass}`}
        >
            <option value="" disabled>— select —</option>
            {ASSESSMENT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

export default OrientationAuditTab;
