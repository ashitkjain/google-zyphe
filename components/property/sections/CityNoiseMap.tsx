import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../services/firebase/config';
import { APP_CONFIG } from '../../../config';
import { fetchCityBoundary, computeCityNoiseGrid, NoiseSimulationResult } from '../../../services/api/osmNoise';

interface CityNoiseMapProps {
    center?: { lat: number; lng: number }; // unused in static mode; kept for call-site compat
    city?: string;
    subjectZpid?: string;
    cityProperties?: any[];
}

const CACHE_SCHEMA_VERSION = 6;
// Bump version string to invalidate old localStorage entries when algo changes
const LS_KEY_PREFIX = 'city_noise_img_v3_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 4-bin colour ramp: quiet (green) → moderate (yellow) → loud (orange) → very loud (red)
const RAMP: [number, [number, number, number]][] = [
    [42, [34,  139,  34]],
    [52, [255, 210,   0]],
    [60, [255,  90,   0]],
    [68, [180,   0,   0]],
];

function dbToRgb(db: number): [number, number, number] {
    if (db <= RAMP[0][0]) return RAMP[0][1];
    if (db >= RAMP[RAMP.length - 1][0]) return RAMP[RAMP.length - 1][1];
    for (let i = 0; i < RAMP.length - 1; i++) {
        const [lo, cLo] = RAMP[i];
        const [hi, cHi] = RAMP[i + 1];
        if (db >= lo && db < hi) {
            const t = (db - lo) / (hi - lo);
            return [
                Math.round(cLo[0] + t * (cHi[0] - cLo[0])),
                Math.round(cLo[1] + t * (cHi[1] - cLo[1])),
                Math.round(cLo[2] + t * (cHi[2] - cLo[2])),
            ];
        }
    }
    return RAMP[RAMP.length - 1][1];
}

function buildNoiseDataUrl(
    dbGrid: Float32Array,
    gridCols: number,
    gridRows: number,
    bounds: { north: number; south: number; east: number; west: number },
    boundaryGeoJSON?: any,
): string {
    const canvas = document.createElement('canvas');
    canvas.width  = gridCols;
    canvas.height = gridRows;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(gridCols, gridRows);
    const px = imgData.data;

    for (let i = 0; i < gridRows * gridCols; i++) {
        const [r, g, b] = dbToRgb(dbGrid[i]);
        px[i * 4]     = r;
        px[i * 4 + 1] = g;
        px[i * 4 + 2] = b;
        px[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // Clip to city boundary using GPU compositing
    if (boundaryGeoJSON) {
        const project = (lng: number, lat: number): [number, number] => [
            (lng - bounds.west)  / (bounds.east  - bounds.west)  * gridCols,
            (bounds.north - lat) / (bounds.north - bounds.south) * gridRows,
        ];
        const drawRing = (ring: number[][]) => {
            ring.forEach(([lng, lat], idx) => {
                const [x, y] = project(lng, lat);
                idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.closePath();
        };
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        const geom = boundaryGeoJSON.geometry ?? boundaryGeoJSON;
        if (geom.type === 'Polygon') {
            geom.coordinates.forEach(drawRing);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach((poly: number[][][]) => poly.forEach(drawRing));
        }
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    return canvas.toDataURL('image/png');
}

// Projects boundaryGeoJSON to an SVG path in a 1000×1000 viewBox so it aligns
// with the noise PNG when both are stretched with objectFit:fill / preserveAspectRatio:none.
function buildSvgPath(
    boundaryGeoJSON: any,
    bounds: { north: number; south: number; east: number; west: number },
): string {
    const { north, south, east, west } = bounds;
    const W = 1000, H = 1000;
    const project = (lng: number, lat: number): [number, number] => [
        (lng - west)  / (east  - west)  * W,
        (north - lat) / (north - south) * H,
    ];
    const ringToPath = (ring: number[][]) =>
        ring.map(([lng, lat], idx) => {
            const [x, y] = project(lng, lat);
            return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ') + 'Z';

    const geom = boundaryGeoJSON?.geometry ?? boundaryGeoJSON;
    if (!geom) return '';
    if (geom.type === 'Polygon') return geom.coordinates.map(ringToPath).join(' ');
    if (geom.type === 'MultiPolygon') {
        return geom.coordinates.flatMap((poly: number[][][]) => poly.map(ringToPath)).join(' ');
    }
    return '';
}

interface LayerState {
    noiseDataUrl: string;
    bgUrl: string;
    boundaryPath: string;
    isLive?: boolean;
}

const CityNoiseMap: React.FC<CityNoiseMapProps> = ({ city }) => {
    const [layers, setLayers]       = useState<LayerState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError]         = useState<string | null>(null);

    useEffect(() => {
        if (!city) { setIsLoading(false); return; }

        const citySlug = city.toLowerCase().replace(/\s+/g, '_');
        const lsKey    = `${LS_KEY_PREFIX}${citySlug}`;

        // ── 1. Instant load from localStorage ──────────────────────────────────
        try {
            const stored = localStorage.getItem(lsKey);
            if (stored) {
                const parsed = JSON.parse(stored) as LayerState;
                if (parsed.noiseDataUrl) {
                    setLayers(parsed);
                    setIsLoading(false);
                    return;
                }
            }
        } catch (_) {}

        // ── 2. Load from Firestore cache (with fallback to live simulation) ────
        (async () => {
            try {
                let cacheData: any = null;
                
                try {
                    if (db) {
                        const snap = await getDoc(doc(db, 'city_noise_cache', citySlug));
                        if (snap.exists()) {
                            const d = snap.data();
                            const age = Date.now() - (d.cachedAt?.toMillis?.() ?? 0);
                            if (age < CACHE_TTL_MS && d.schemaVersion === CACHE_SCHEMA_VERSION) {
                                cacheData = d;
                            }
                        }
                    }
                } catch (firestoreError) {
                    console.warn('[CityNoiseMap] Firestore cache inaccessible:', firestoreError);
                }

                const radarKey: string =
                    APP_CONFIG.radar.key ||
                    (import.meta as any).env?.VITE_RADAR_KEY || '';

                let noiseDataUrl: string;
                let bounds: { north: number; south: number; east: number; west: number };
                let boundaryGeoJSON: any;
                let isLive = false;

                if (cacheData) {
                    // Use cached data
                    bounds = cacheData.bounds;
                    boundaryGeoJSON = cacheData.boundaryGeoJSON ?? null;
                    if (cacheData.gridDataB64) {
                        const buf  = Uint8Array.from(atob(cacheData.gridDataB64), c => c.charCodeAt(0)).buffer;
                        const grid = new Float32Array(buf);
                        noiseDataUrl = buildNoiseDataUrl(grid, cacheData.gridCols, cacheData.gridRows, bounds, boundaryGeoJSON);
                    } else {
                        noiseDataUrl = cacheData.dataUrl;
                    }
                } else {
                    // LIVE FALLBACK: Fetch and compute on the fly
                    isLive = true;
                    const boundaryData = await fetchCityBoundary(city);
                    if (!boundaryData) throw new Error(`Could not locate boundary for ${city}`);
                    
                    const gridResult = await computeCityNoiseGrid(
                        (boundaryData.bbox.north + boundaryData.bbox.south) / 2,
                        (boundaryData.bbox.east + boundaryData.bbox.west) / 2,
                        4, 
                        150, // Slightly coarser grid for live perf
                        boundaryData
                    );
                    
                    bounds = gridResult.bounds;
                    boundaryGeoJSON = boundaryData.geojson;
                    noiseDataUrl = buildNoiseDataUrl(gridResult.dbGrid, gridResult.gridCols, gridResult.gridRows, bounds, boundaryGeoJSON);
                }

                const { north, south, east, west } = bounds;
                const bgUrl = radarKey
                    ? `https://api.radar.io/maps/static?publishableKey=${radarKey}&style=radar-default-v1&width=800&height=800&bbox=${west},${south},${east},${north}`
                    : '';
                const boundaryPath = boundaryGeoJSON ? buildSvgPath(boundaryGeoJSON, bounds) : '';

                const state: LayerState = { noiseDataUrl, bgUrl, boundaryPath, isLive };
                setLayers(state);

                try { localStorage.setItem(lsKey, JSON.stringify(state)); } catch (_) {}
            } catch (e: any) {
                console.error('[CityNoiseMap]', e);
                setError(`Could not load acoustic data: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        })();
    }, [city]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#dde4ed' }}>

            {/* Radar static map base */}
            {layers?.bgUrl && (
                <img
                    src={layers.bgUrl}
                    alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
                />
            )}

            {/* Noise heatmap — PNG with transparent bg, fills same bbox as background */}
            {layers?.noiseDataUrl && (
                <img
                    src={layers.noiseDataUrl}
                    alt=""
                    style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'fill',
                        opacity: 0.45,
                        display: 'block',
                    }}
                />
            )}

            {/* SVG city boundary — glow + solid stroke, viewBox matches noise projection */}
            {layers?.boundaryPath && (
                <svg
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
                >
                    <path d={layers.boundaryPath} fill="none" stroke="white" strokeWidth="10" strokeOpacity="0.18" />
                    <path d={layers.boundaryPath} fill="none" stroke="white" strokeWidth="3"  strokeOpacity="0.85" />
                </svg>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm rounded-2xl z-10">
                    <div className="flex flex-col items-center gap-3 bg-white/95 px-8 py-5 rounded-2xl shadow-xl border border-slate-100">
                        <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-xl" />
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Loading Acoustic Layer...</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && !isLoading && (
                <div className="absolute top-4 left-4 right-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 z-10">
                    <p className="text-[11px] font-bold text-rose-600">{error}</p>
                </div>
            )}

            {/* City name pill */}
            {city && !isLoading && !error && layers && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full z-10 flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">{city}</span>
                    <span className="text-[10px] text-white/55">City Acoustic Map</span>
                </div>
            )}

            {/* Status badge */}
            {!isLoading && layers && (
                <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg z-10">
                    <span className={`text-[9px] font-black uppercase tracking-widest ${layers.isLive ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {layers.isLive ? 'simulated' : 'cached'}
                    </span>
                </div>
            )}
        </div>
    );
};

export default CityNoiseMap;
