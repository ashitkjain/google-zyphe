import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebaseService';
import { runSatellitaryAnalysis, getOrCacheAerialSatelliteUrl } from '../../services/satellitaryService';
import { savePropertyOrientationToCloud } from '../../services/firebase/properties';
import { PropertyData } from '../../types';

// ─── Local Types ─────────────────────────────────────────────────────────────

interface OrientationRow {
    zpid: string;
    address: string;
    city: string;
    // Images
    mapZoomIn?: string;         // close-up map used to assess orientation manually
    mapZoomOut?: string;        // satellite overview
    streetView?: string;        // street view
    // Cached results (from property doc)
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
    // Property-level "final" orientation (from neighborhood analysis or manual)
    finalOrientation?: string | null;
    // Coords for running analysis
    coordinates?: { latitude: number; longitude: number };
    // Runtime status
    status: 'idle' | 'running' | 'done' | 'error';
    error?: string;
}

interface OrientationAuditTabProps {
    /** Optionally pre-filter to one city */
    targetCity?: string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const CONF_COLOR = {
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

// ─── Main Component ───────────────────────────────────────────────────────────

const OrientationAuditTab: React.FC<OrientationAuditTabProps> = () => {
    const [rows, setRows] = useState<OrientationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCity, setActiveCity] = useState<string | null>(null);
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

    // ── Fetch all properties + their cached orientation ────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'properties'), orderBy('address', 'asc')));
            const built: OrientationRow[] = snap.docs.map(d => {
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
                    finalOrientation: p.visual_analysis?.neighborhood?.orientation?.final_orientation
                        || p.analysis?.neighborhood?.orientation?.final_orientation
                        || null,
                    coordinates: p.coordinates || undefined,
                    status: 'idle',
                };
            });
            setRows(built);
            if (!activeCity && built.length > 0) {
                // Default to city with most properties
                const cityCounts: Record<string, number> = {};
                built.forEach(r => { cityCounts[r.city] = (cityCounts[r.city] || 0) + 1; });
                const sorted = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
                setActiveCity(sorted[0]?.[0] || null);
            }

            // ── Background: fetch & cache aerial satellite images ───────────────
            // Only process rows that have coords and don't already have a cached
            // firebase storage satellite URL. Run 3 at a time to avoid rate limits.
            const toFetch = built.filter(
                r => r.coordinates && (!r.mapZoomOut || !r.mapZoomOut.includes('firebasestorage'))
            );
            const CONCURRENCY = 3;
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

    // ── Run analysis for a single property ────────────────────────────────────
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
            // Update local row with fresh data
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
                streetView: r.streetView || (result.street_view_url || undefined),
            } : r));
        } catch (e: any) {
            setRows(prev => prev.map(r => r.zpid === zpid
                ? { ...r, status: 'error', error: e.message || 'Unknown error' } : r));
        }
    };

    // ── Batch run for all in active city ──────────────────────────────────────
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
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-40"
                        title="Refresh"
                    >
                        <i className={`fa-solid fa-arrows-rotate text-xs ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleBatchRun}
                        disabled={batchRunning || loading || filteredRows.length === 0}
                        className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-slate-800 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:scale-[1.03] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {batchRunning ? (
                            <>
                                <i className="fa-solid fa-spinner animate-spin text-xs" />
                                {batchProgress ? `${batchProgress.done}/${batchProgress.total}` : 'Running…'}
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-satellite text-xs" />
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

            {/* Progress bar */}
            {batchProgress && (
                <div className="bg-white rounded-2xl border border-indigo-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">
                            Calculating orientations…
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                            {batchProgress.done} / {batchProgress.total}
                        </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full transition-all duration-300"
                            style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                        />
                    </div>
                </div>
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
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[130px]">Cached (Property)</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px]">AI Orientation</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[150px]">Geocoding Orientation</th>
                                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right min-w-[100px]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-24 text-center">
                                            <i className="fa-solid fa-folder-open text-4xl text-slate-100 mb-3 block" />
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No properties in this city</p>
                                        </td>
                                    </tr>
                                ) : filteredRows.map(row => (
                                    <tr
                                        key={row.zpid}
                                        className={`group hover:bg-slate-50/40 transition-colors ${row.status === 'running' ? 'animate-pulse' : ''}`}
                                    >
                                        {/* Property */}
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
                                        <td className="p-5">
                                            <MapThumb url={row.mapZoomIn} label="Close-up" />
                                        </td>

                                        {/* Satellite */}
                                        <td className="p-5">
                                            <MapThumb url={row.mapZoomOut} label="Satellite" />
                                        </td>

                                        {/* Street view */}
                                        <td className="p-5">
                                            <MapThumb url={row.streetView} label="Street View" />
                                        </td>

                                        {/* Cached property-level orientation */}
                                        <td className="p-5">
                                            {row.finalOrientation ? (
                                                <DirBadge
                                                    label={row.finalOrientation}
                                                    color="bg-slate-100 text-slate-700 border-slate-200"
                                                />
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
                                                    {/* Delta vs AI */}
                                                    {row.orientationAI?.azimuth_degrees != null && (
                                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black border ${Math.abs(row.orientationGeocoding.azimuth_degrees - row.orientationAI.azimuth_degrees!) <= 22.5
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : Math.abs(row.orientationGeocoding.azimuth_degrees - row.orientationAI.azimuth_degrees!) <= 45
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                            }`}>
                                                            Δ {Math.round(Math.abs(row.orientationGeocoding.azimuth_degrees - row.orientationAI.azimuth_degrees!))}°
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-bold">—</span>
                                            )}
                                        </td>

                                        {/* Action */}
                                        <td className="p-5 text-right">
                                            <button
                                                onClick={() => runForRow(row.zpid)}
                                                disabled={row.status === 'running' || batchRunning || !row.coordinates}
                                                title={!row.coordinates ? 'No coordinates available' : 'Run orientation analysis'}
                                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                {row.status === 'running' ? (
                                                    <i className="fa-solid fa-spinner animate-spin" />
                                                ) : (
                                                    <i className="fa-solid fa-satellite-dish" />
                                                )}
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

// ─── Small image thumb helper ─────────────────────────────────────────────────

function MapThumb({ url, label }: { url?: string; label: string }) {
    const [open, setOpen] = useState(false);
    if (!url) return (
        <div className="w-16 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-200">
            <i className="fa-solid fa-image text-xs" />
        </div>
    );
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-16 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:shadow-md hover:scale-105 transition-all"
                title={`View ${label}`}
            >
                <img src={url} alt={label} className="w-full h-full object-cover" />
            </button>
            {open && (
                <div
                    className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-6 animate-in fade-in duration-200"
                    onClick={() => setOpen(false)}
                >
                    <div className="relative max-w-2xl w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2">{label}</div>
                        <img src={url} alt={label} className="w-full rounded-2xl shadow-2xl" />
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-6 right-2 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                        >
                            <i className="fa-solid fa-xmark text-xs" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default OrientationAuditTab;
