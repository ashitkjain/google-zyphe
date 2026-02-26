import React, { useState } from 'react';
import { runSatellitaryAnalysis, SatellitaryResult } from '../../../../services/satellitaryService';
import { AnalysisLoading } from './AnalysisLoading';

interface Props {
    lat?: number;
    lng?: number;
    cachedStreetViewUrl?: string | null;
    address?: string;
    zpid?: string;
    onResult?: (result: SatellitaryResult) => void;
}

const COMPASS_ICON: Record<string, string> = {
    North: 'fa-arrow-up',
    Northeast: 'fa-arrow-up-right',
    East: 'fa-arrow-right',
    Southeast: 'fa-arrow-down-right',
    South: 'fa-arrow-down',
    Southwest: 'fa-arrow-down-left',
    West: 'fa-arrow-left',
    Northwest: 'fa-arrow-up-left',
};

const CONFIDENCE_COLOR: Record<string, string> = {
    high: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-600 bg-amber-50 border-amber-200',
    low: 'text-rose-600 bg-rose-50 border-rose-200',
};

/** Needle angle for compass rose SVG — 0° = North, 90° = East, etc. */
function azimuthToAngle(azimuth: number | null, orientation: string): number {
    if (azimuth != null) return azimuth;
    const map: Record<string, number> = {
        North: 0, Northeast: 45, East: 90, Southeast: 135,
        South: 180, Southwest: 225, West: 270, Northwest: 315,
    };
    const key = Object.keys(map).find(k => orientation.toLowerCase().includes(k.toLowerCase()));
    return key ? map[key] : 0;
}

const CompassRose: React.FC<{ azimuth: number }> = ({ azimuth }) => (
    <svg viewBox="0 0 100 100" className="w-28 h-28 drop-shadow-md">
        {/* Outer ring */}
        <circle cx="50" cy="50" r="46" fill="white" stroke="#e2e8f0" strokeWidth="2" />
        {/* Cardinal ticks */}
        {[0, 90, 180, 270].map(a => {
            const rad = (a - 90) * (Math.PI / 180);
            return (
                <line key={a}
                    x1={50 + 36 * Math.cos(rad)} y1={50 + 36 * Math.sin(rad)}
                    x2={50 + 44 * Math.cos(rad)} y2={50 + 44 * Math.sin(rad)}
                    stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"
                />
            );
        })}
        {/* Cardinal labels */}
        {[{ a: 0, l: 'N' }, { a: 90, l: 'E' }, { a: 180, l: 'S' }, { a: 270, l: 'W' }].map(({ a, l }) => {
            const rad = (a - 90) * (Math.PI / 180);
            return (
                <text key={l}
                    x={50 + 28 * Math.cos(rad)} y={50 + 28 * Math.sin(rad) + 4}
                    textAnchor="middle" fontSize="9" fontWeight="800"
                    fill={l === 'N' ? '#4f46e5' : '#94a3b8'}
                >{l}</text>
            );
        })}
        {/* Needle — red tip points in facing direction */}
        <g transform={`rotate(${azimuth}, 50, 50)`}>
            {/* Red (facing) tip */}
            <polygon points="50,14 53,50 50,44 47,50" fill="#ef4444" />
            {/* Grey tail */}
            <polygon points="50,86 53,50 50,56 47,50" fill="#cbd5e1" />
        </g>
        <circle cx="50" cy="50" r="4" fill="#1e293b" />
    </svg>
);

const SatellitaryView: React.FC<Props> = ({ lat, lng, cachedStreetViewUrl, address, zpid, onResult }) => {
    const [result, setResult] = useState<SatellitaryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);

    const run = async () => {
        if (!lat || !lng) return;
        setLoading(true);
        setError(null);
        setResult(null);
        setTimer(0);

        const interval = window.setInterval(() => setTimer(t => t + 1), 1000);

        try {
            const res = await runSatellitaryAnalysis(lat, lng, cachedStreetViewUrl, 'unknown', zpid, address);
            setResult(res);
            onResult?.(res);
        } catch (e: any) {
            setError(e.message || 'Analysis failed.');
        } finally {
            clearInterval(interval);
            setLoading(false);
        }
    };

    if (!lat || !lng) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
                <i className="fa-solid fa-satellite text-5xl text-slate-200"></i>
                <p className="text-sm font-semibold">No coordinates available for this property.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <AnalysisLoading
                title="Analyzing Satellite + Street View..."
                subtitle="Cross-referencing aerial footprint with front-door orientation."
                timer={timer}
                address={address}
                icon="fa-satellite"
            />
        );
    }

    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-5xl mx-auto space-y-8">
            {!result ? (
                /* ── Run Panel ── */
                <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-10 md:p-16 flex flex-col items-center gap-8 text-center">
                    <div className="w-20 h-20 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center">
                        <i className="fa-solid fa-satellite text-indigo-500 text-3xl"></i>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Satellitary Orientation</h3>
                        <p className="text-[13px] text-slate-500 max-w-md leading-relaxed">
                            Uses a zoom-20 satellite aerial + street view to precisely determine which
                            compass direction the front door faces — more accurate than map-based inference
                            for diagonal and curving streets.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg text-left">
                        <div className="bg-slate-50 rounded-2xl p-4 flex items-start gap-3">
                            <i className="fa-solid fa-satellite-dish text-indigo-400 mt-0.5"></i>
                            <div>
                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Image A</div>
                                <div className="text-[12px] text-slate-700 font-semibold">Aerial Satellite (Zoom 20)</div>
                                <div className="text-[11px] text-slate-400">North always up · Per-lot resolution</div>
                            </div>
                        </div>
                        <div className={`rounded-2xl p-4 flex items-start gap-3 ${cachedStreetViewUrl?.includes('firebasestorage') ? 'bg-slate-50' : 'bg-amber-50 border border-amber-200'}`}>
                            <i className={`fa-solid fa-street-view mt-0.5 ${cachedStreetViewUrl?.includes('firebasestorage') ? 'text-indigo-400' : 'text-amber-500'}`}></i>
                            <div>
                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Image B</div>
                                <div className="text-[12px] text-slate-700 font-semibold">Street View</div>
                                <div className={`text-[11px] font-bold ${cachedStreetViewUrl?.includes('firebasestorage') ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {cachedStreetViewUrl?.includes('firebasestorage')
                                        ? '✅ Cached in Firebase Storage'
                                        : '⚠️ Not cached yet'}
                                </div>
                            </div>
                        </div>
                    </div>
                    {!cachedStreetViewUrl?.includes('firebasestorage') && (
                        <div className="w-full max-w-lg bg-amber-50 text-amber-700 rounded-2xl p-4 text-[12px] font-semibold border border-amber-200 text-center">
                            <i className="fa-solid fa-circle-info mr-2"></i>
                            No cached street view found. The analysis will run using the aerial satellite image only — accuracy may be slightly lower.
                        </div>
                    )}
                    {error && (
                        <div className="w-full max-w-lg bg-rose-50 text-rose-600 rounded-2xl p-4 text-[12px] font-semibold border border-rose-100">
                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>{error}
                        </div>
                    )}
                    <button
                        onClick={run}
                        className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-indigo-600 to-slate-800 text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl hover:scale-[1.03] transition-all"
                    >
                        <i className="fa-solid fa-satellite"></i>
                        Run Orientation Analysis
                    </button>
                </div>
            ) : (
                /* ── Results Panel ── */
                <div className="space-y-6">
                    {/* Main result card */}
                    <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden p-8 md:p-12">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
                            {/* Compass rose + orientation */}
                            <div className="flex flex-col items-center gap-3 flex-shrink-0">
                                <CompassRose azimuth={azimuthToAngle(result.azimuth_degrees, result.final_orientation)} />
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Front Faces</div>
                                    <div className="text-3xl font-black text-indigo-600">{result.final_orientation}</div>
                                    {result.azimuth_degrees != null && (
                                        <div className="text-[12px] text-slate-500 font-semibold">{result.azimuth_degrees}°</div>
                                    )}
                                </div>
                                <div className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${CONFIDENCE_COLOR[result.confidence]}`}>
                                    {result.confidence} confidence
                                </div>
                                {result.aerial_only_mode && (
                                    <div className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border bg-amber-50 text-amber-600 border-amber-200">
                                        <i className="fa-solid fa-satellite-dish mr-1"></i>Aerial Only
                                    </div>
                                )}
                            </div>

                            {/* Explanation */}
                            <div className="flex-1 space-y-4">
                                <div className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <i className="fa-solid fa-brain text-[13px]"></i>
                                    AI Reasoning
                                </div>
                                <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-line">{result.explanation}</p>
                            </div>
                        </div>
                    </div>

                    {/* Geocoding API — entrance-based azimuth */}
                    <div className={`rounded-[2.5rem] border overflow-hidden p-6 md:p-8 ${result.geocoding_entrance_available ? 'bg-white border-emerald-100 shadow-sm shadow-emerald-500/5' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${result.geocoding_entrance_available ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                                <i className={`fa-solid fa-location-crosshairs text-sm ${result.geocoding_entrance_available ? 'text-emerald-500' : 'text-slate-400'}`}></i>
                            </div>
                            <div>
                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Geocoding API — Entrance Azimuth</div>
                                <div className="text-[10px] text-slate-400 font-medium">Computed from building centroid → preferred entrance (atan2 bearing formula)</div>
                            </div>
                        </div>

                        {result.geocoding_entrance_available && result.geocoding_azimuth_degrees != null ? (
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                                {/* Mini compass */}
                                <CompassRose azimuth={result.geocoding_azimuth_degrees} />
                                <div className="flex flex-col gap-2">
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direction</div>
                                        <div className="text-2xl font-black text-emerald-600">{result.geocoding_orientation}</div>
                                        <div className="text-[13px] text-slate-500 font-semibold">{result.geocoding_azimuth_degrees}°</div>
                                    </div>
                                    {result.azimuth_degrees != null && (
                                        <div className="mt-1">
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">vs AI Estimate</div>
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black border ${Math.abs(result.geocoding_azimuth_degrees - result.azimuth_degrees) <= 22.5
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : Math.abs(result.geocoding_azimuth_degrees - result.azimuth_degrees) <= 45
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}>
                                                <i className={`fa-solid ${Math.abs(result.geocoding_azimuth_degrees - result.azimuth_degrees) <= 22.5
                                                    ? 'fa-circle-check' : 'fa-circle-exclamation'
                                                    } text-xs`}></i>
                                                {Math.round(Math.abs(result.geocoding_azimuth_degrees - result.azimuth_degrees))}° delta from AI
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-[12px] text-slate-400 font-semibold flex items-center gap-2">
                                <i className="fa-solid fa-circle-xmark text-slate-300"></i>
                                No entrance data returned by Geocoding API for this address.
                                <span className="text-slate-300">(BUILDING_AND_ENTRANCES coverage may be limited here)</span>
                            </div>
                        )}
                    </div>

                    {/* Source images */}
                    <div className={`grid ${result.aerial_only_mode ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'} gap-6`}>
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-6 pt-5 pb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-satellite-dish text-indigo-400"></i>Image A — Aerial Satellite
                            </div>
                            <img src={result.aerial_url} alt="Aerial satellite" className="w-full object-cover" />
                        </div>
                        {!result.aerial_only_mode && result.street_view_url && (
                            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-6 pt-5 pb-3 text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <i className="fa-solid fa-street-view text-indigo-400"></i>Image B — Street View
                                </div>
                                <img src={result.street_view_url} alt="Street view" className="w-full object-cover" />
                            </div>
                        )}
                    </div>

                    {/* Re-run */}
                    <div className="flex justify-center">
                        <button
                            onClick={run}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-sm hover:shadow-md transition-all"
                        >
                            <i className="fa-solid fa-rotate"></i> Re-run Analysis
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default SatellitaryView;
