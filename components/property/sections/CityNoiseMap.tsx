
import React, { useEffect, useRef, useState } from 'react';
import Radar from 'radar-sdk-js';
import { createMapsPlugin } from '@radarlabs/plugin-maps';
import '@radarlabs/plugin-maps/dist/radar-maps.css';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../services/firebase/config';
import { APP_CONFIG } from '../../../config';
import { computeCityNoiseGrid, fetchCityBoundary } from '../../../services/api/osmNoise';

interface CityNoiseMapProps {
    center?: { lat: number; lng: number };
    city?: string;
}

const PLEASANTON_DEFAULT = { lat: 37.6604, lng: -121.8747 };
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_SCHEMA_VERSION = 6;

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

function buildRasterDataUrl(
    dbGrid: Float32Array,
    gridCols: number,
    gridRows: number,
    bounds: { north: number; south: number; east: number; west: number },
    boundaryGeoJSON?: any,
): string {
    const canvas = document.createElement('canvas');
    canvas.width = gridCols;
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

    // Mask pixels outside city boundary using canvas clip — single GPU operation,
    // eliminates ~6000 per-pixel turf.booleanPointInPolygon calls.
    if (boundaryGeoJSON) {
        const project = (lng: number, lat: number): [number, number] => [
            (lng - bounds.west) / (bounds.east - bounds.west) * gridCols,
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

const CityNoiseMap: React.FC<CityNoiseMapProps> = ({ center, city }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fromCache, setFromCache] = useState(false);

    const mapCenter = center || PLEASANTON_DEFAULT;

    useEffect(() => {
        if (!mapContainerRef.current) return;

        const radarKey = APP_CONFIG.radar.key || (import.meta as any).env?.VITE_RADAR_KEY || '';
        if (!radarKey) { setError('Missing Radar API key'); return; }

        try {
            // @ts-ignore
            if (typeof window !== 'undefined' && !(window as any)._radarPluginRegistered) {
                // @ts-ignore
                if (typeof Radar !== 'undefined' && Radar.registerPlugin) {
                    Radar.registerPlugin(createMapsPlugin());
                    (window as any)._radarPluginRegistered = true;
                }
            }
            // @ts-ignore
            if (typeof Radar !== 'undefined') Radar.initialize(radarKey);
        } catch (e) {
            console.warn('[CityNoiseMap] Radar init warning:', e);
        }

        let map: any = null;
        try {
            // @ts-ignore
            map = Radar.ui.map({
                container: mapContainerRef.current,
                style: 'radar-default-v1',
                center: [mapCenter.lng, mapCenter.lat],
                zoom: 12,
            });
            mapRef.current = map;
        } catch (e) {
            setError('Failed to initialize map');
            return;
        }

        const citySlug = city ? city.toLowerCase().replace(/\s+/g, '_') : null;

        const addLayersToMap = (
            m: any,
            dataUrl: string,
            bounds: { north: number; south: number; east: number; west: number },
            boundaryGeoJSON: any,
            roadCount: number,
        ) => {
            void roadCount; // count is no longer displayed

            // City boundary outline
            if (boundaryGeoJSON) {
                if (m.getLayer('city-boundary-line')) m.removeLayer('city-boundary-line');
                if (m.getLayer('city-boundary-glow')) m.removeLayer('city-boundary-glow');
                if (m.getSource('city-boundary')) m.removeSource('city-boundary');
                m.addSource('city-boundary', { type: 'geojson', data: boundaryGeoJSON });
                // Outer glow
                m.addLayer({
                    id: 'city-boundary-glow',
                    type: 'line',
                    source: 'city-boundary',
                    paint: {
                        'line-color': '#ffffff',
                        'line-width': 6,
                        'line-opacity': 0.18,
                        'line-blur': 4,
                    },
                });
                // Solid inner line
                m.addLayer({
                    id: 'city-boundary-line',
                    type: 'line',
                    source: 'city-boundary',
                    paint: {
                        'line-color': '#ffffff',
                        'line-width': 2,
                        'line-opacity': 0.85,
                    },
                });
            }

            // Noise raster
            const { north, south, east, west } = bounds;
            const coords: [[number,number],[number,number],[number,number],[number,number]] = [
                [west, north], [east, north], [east, south], [west, south],
            ];
            if (m.getLayer('noise-raster')) m.removeLayer('noise-raster');
            if (m.getSource('noise-img')) m.removeSource('noise-img');
            m.addSource('noise-img', { type: 'image', url: dataUrl, coordinates: coords });
            m.addLayer({
                id: 'noise-raster',
                type: 'raster',
                source: 'noise-img',
                paint: {
                    'raster-opacity': 0.22,
                    'raster-resampling': 'linear',
                },
            });

            // Resize first so the canvas matches the (possibly aspect-ratio-sized) container
            m.resize();

            // Center on the polygon centroid rather than the bbox center — the bbox often
            // extends into uninhabited hills, skewing the center away from the actual city.
            const geom = boundaryGeoJSON?.geometry ?? boundaryGeoJSON;
            if (geom) {
                const ring: number[][] = geom.type === 'Polygon'
                    ? geom.coordinates[0]
                    : geom.coordinates.map((p: number[][][]) => p[0]).flat();
                const avgLng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
                const avgLat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
                // Derive zoom from the bbox span so the full city fits in view
                const span = Math.max(north - south, (east - west) * Math.cos(avgLat * Math.PI / 180));
                const zoom = Math.min(13, Math.max(10, Math.log2(0.35 / span) + 10));
                m.flyTo({ center: [avgLng, avgLat], zoom, duration: 600 });
            } else {
                m.fitBounds([[west, south], [east, north]], { padding: 40, duration: 600 });
            }
        };

        const loadAcousticLayer = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const m = mapRef.current;
                if (!m) return;

                // ── 1. Try Firestore cache ──────────────────────────────────────
                if (citySlug && db) {
                    try {
                        const cacheRef = doc(db, 'city_noise_cache', citySlug);
                        const snap = await getDoc(cacheRef);
                        if (snap.exists()) {
                            const d = snap.data();
                            const age = Date.now() - (d.cachedAt?.toMillis?.() ?? 0);
                            if (age < CACHE_TTL_MS && d.schemaVersion === CACHE_SCHEMA_VERSION) {
                                let dataUrl: string;
                                if (d.gridDataB64) {
                                    // Batch-prefetched format: decode base64 → Float32Array → canvas
                                    const buf = Uint8Array.from(atob(d.gridDataB64), c => c.charCodeAt(0)).buffer;
                                    const grid = new Float32Array(buf);
                                    dataUrl = buildRasterDataUrl(grid, d.gridCols, d.gridRows, d.bounds, d.boundaryGeoJSON ?? null);
                                } else {
                                    dataUrl = d.dataUrl;
                                }
                                addLayersToMap(m, dataUrl, d.bounds, d.boundaryGeoJSON ?? null, d.roadCount ?? 0);
                                setFromCache(true);
                                return;
                            }
                        }
                    } catch (e) {
                        console.warn('[CityNoiseMap] Cache read failed:', e);
                    }
                }

                // ── 2. Compute fresh ────────────────────────────────────────────
                setFromCache(false);

                // Fetch city boundary and road grid in sequence (boundary bbox feeds grid query)
                const boundary = city ? await fetchCityBoundary(city) : null;
                const result = await computeCityNoiseGrid(
                    mapCenter.lat, mapCenter.lng, 4, 120, boundary,
                );

                const boundaryGeoJSON = result.boundary?.geojson ?? null;
                const dataUrl = buildRasterDataUrl(
                    result.dbGrid, result.gridCols, result.gridRows, result.bounds, boundaryGeoJSON,
                );

                // ── 3. Save to cache ────────────────────────────────────────────
                if (citySlug && db) {
                    try {
                        const cacheRef = doc(db, 'city_noise_cache', citySlug);
                        await setDoc(cacheRef, {
                            dataUrl,
                            bounds: result.bounds,
                            boundaryGeoJSON,
                            roadCount: result.roadCount,
                            cachedAt: Timestamp.now(),
                            schemaVersion: CACHE_SCHEMA_VERSION,
                        });
                    } catch (e) {
                        console.warn('[CityNoiseMap] Cache write failed:', e);
                    }
                }

                addLayersToMap(m, dataUrl, result.bounds, boundaryGeoJSON, result.roadCount);
            } catch (e: any) {
                console.error('[CityNoiseMap] Error:', e);
                setError(`Could not compute acoustic layer: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        if (map.loaded()) {
            loadAcousticLayer();
        } else {
            map.on('load', loadAcousticLayer);
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // center prop intentionally not used for flyTo — city bounds drive the viewport via fitBounds in addLayersToMap

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm rounded-2xl z-10">
                    <div className="flex flex-col items-center gap-3 bg-white/95 px-8 py-5 rounded-2xl shadow-xl border border-slate-100">
                        <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-xl" />
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Computing Acoustic Layer...</p>
                        <p className="text-[10px] text-slate-400">Fetching OSM roads · Log-distance decay simulation</p>
                    </div>
                </div>
            )}

            {error && !isLoading && (
                <div className="absolute top-4 left-4 right-20 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 z-10">
                    <p className="text-[11px] font-bold text-rose-600">{error}</p>
                </div>
            )}

            {city && !isLoading && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-4 py-1.5 rounded-full z-10 flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">{city}</span>
                    <span className="text-[10px] text-white/55">City Acoustic Map</span>
                </div>
            )}

            {fromCache && !isLoading && (
                <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg z-10">
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">cached</span>
                </div>
            )}
        </div>
    );
};

export default CityNoiseMap;
