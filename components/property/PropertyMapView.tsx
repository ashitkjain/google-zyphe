import React, { useEffect, useRef, useCallback } from 'react';
import ReactDOMServer from 'react-dom/server';
import Radar from 'radar-sdk-js';
import { createMapsPlugin } from '@radarlabs/plugin-maps';
import '@radarlabs/plugin-maps/dist/radar-maps.css';
import { APP_CONFIG } from '../../config';
import { CityPropertySummary } from '../../services/firebase/properties';
import PropertyCard from './PropertyCard';
import { fetchCityBoundary } from '../../services/api/boundaries';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PropertyMapViewProps {
    properties: CityPropertySummary[];
    onPropertyClick: (address: string) => void;
    selectedCity?: string;
    matchMap?: Record<string, { score: number; rank: number; matchWriteup: string }>;
    containerClassName?: string;
}

type MarkerMode = 'price' | 'dot';

interface MarkerEntry {
    marker: any;
    el: HTMLElement;
    prop: CityPropertySummary;
    match?: { score: number; rank: number };
    lngLat: [number, number];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
};

const TRI_VALLEY_CENTER: [number, number] = [-121.875, 37.66];

const CITY_CENTERS: Record<string, [number, number]> = {
    'Pleasanton': [-121.875, 37.66],
    'Dublin': [-121.9358, 37.7022],
    'Livermore': [-121.768, 37.6819],
    'San Ramon': [-121.9781, 37.7628],
    'Danville': [-121.9999, 37.8216],
};

const getMarkerColors = (match?: { score: number; rank: number }) => {
    if (match) {
        if (match.score >= 80) return { bg: '#059669', border: '#047857', shadow: 'rgba(5,150,105,0.4)' };
        if (match.score >= 60) return { bg: '#D97706', border: '#B45309', shadow: 'rgba(217,119,6,0.4)' };
    }
    return { bg: '#4F46E5', border: '#3730A3', shadow: 'rgba(79,70,229,0.35)' };
};

// Mutates the marker element's innerHTML to either a price pill or a dot.
const applyMarkerMode = (
    el: HTMLElement,
    prop: CityPropertySummary,
    match: { score: number; rank: number } | undefined,
    mode: MarkerMode
) => {
    const { bg, border, shadow } = getMarkerColors(match);
    const label = prop.listPrice ? fmt(prop.listPrice) : '—';

    if (mode === 'dot') {
        el.innerHTML = `<div style="
            width:10px;height:10px;
            background:${bg};
            border-radius:50%;
            border:2px solid white;
            box-shadow:0 1px 4px ${shadow};
            cursor:pointer;
            transition:transform 0.12s ease;
        "></div>`;
    } else {
        el.innerHTML = `
            <div style="
                background:${bg};
                color:white;
                border:1.5px solid ${border};
                border-radius:5px;
                padding:2px 7px;
                font-size:11px;
                font-weight:800;
                white-space:nowrap;
                cursor:pointer;
                box-shadow:0 2px 8px ${shadow};
                transition:transform 0.15s ease,box-shadow 0.15s ease;
                position:relative;
                letter-spacing:-0.2px;
                line-height:1.4;
            ">${match ? `<span style="opacity:0.7;font-size:8px;margin-right:1px">#${match.rank}</span>` : ''}${label}</div>
            <div style="
                width:0;height:0;
                border-left:4px solid transparent;
                border-right:4px solid transparent;
                border-top:4px solid ${bg};
                margin:0 auto;
            "></div>`;
    }
};

const createMarkerElement = (
    prop: CityPropertySummary,
    match?: { score: number; rank: number }
): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'zyphe-map-marker';
    el.style.cursor = 'pointer';
    applyMarkerMode(el, prop, match, 'price'); // start as price badge; zoom logic will update

    el.addEventListener('mouseenter', () => {
        const inner = el.firstElementChild as HTMLElement;
        if (inner) { inner.style.transform = 'scale(1.2)'; (inner as any).style.zIndex = '999'; }
    });
    el.addEventListener('mouseleave', () => {
        const inner = el.firstElementChild as HTMLElement;
        if (inner) { inner.style.transform = ''; (inner as any).style.zIndex = ''; }
    });

    return el;
};

const buildPopupHtml = (
    property: CityPropertySummary,
    match?: { score: number; rank: number; matchWriteup: string }
): string => {
    const propData = { ...property, livingAreaValue: property.livingArea } as any;
    return ReactDOMServer.renderToString(
        <div style={{ width: '320px', pointerEvents: 'auto' }} className="zyphe-popup" data-address={property.address}>
            <PropertyCard property={propData} match={match} />
        </div>
    );
};

// ── Zoom-aware collision algorithm ─────────────────────────────────────────────

// Collision radius shrinks as the user zooms in (properties spread apart in pixel space).
// Kept small so most properties show price badges, matching Zillow/Redfin density.
const getCollisionRadius = (zoom: number): number => {
    if (zoom < 11) return 28;
    if (zoom < 12) return 18;
    if (zoom < 13) return 12;
    return 8;
};

// Greedy algorithm: sort by price descending. Each unprocessed marker claims a
// price badge and shadows all unprocessed neighbors within the collision radius.
// At zoom >= 13 every property shows a price badge (no culling at street level).
const computeMarkerModes = (map: any, entries: MarkerEntry[]): MarkerMode[] => {
    if (entries.length === 0) return [];

    const zoom = map.getZoom();
    if (zoom < 9.5) return entries.map(() => 'dot' as MarkerMode);
    if (zoom >= 13) return entries.map(() => 'price' as MarkerMode);

    const radius = getCollisionRadius(zoom);
    const radiusSq = radius * radius;

    const pixels = entries.map(e => map.project(e.lngLat) as { x: number; y: number });
    const modes: MarkerMode[] = new Array(entries.length).fill('dot');
    const processed = new Array<boolean>(entries.length).fill(false);

    const sortedIdx = entries
        .map((_, i) => i)
        .sort((a, b) => (entries[b].prop.listPrice || 0) - (entries[a].prop.listPrice || 0));

    for (const i of sortedIdx) {
        if (processed[i]) continue;
        modes[i] = 'price';
        processed[i] = true;

        const px = pixels[i];
        for (let j = 0; j < entries.length; j++) {
            if (processed[j]) continue;
            const dx = px.x - pixels[j].x;
            const dy = px.y - pixels[j].y;
            if (dx * dx + dy * dy < radiusSq) {
                processed[j] = true; // shadowed → stays 'dot'
            }
        }
    }

    return modes;
};

// ── Main Component ─────────────────────────────────────────────────────────────

const PropertyMapView: React.FC<PropertyMapViewProps> = ({
    properties,
    onPropertyClick,
    selectedCity,
    matchMap,
    containerClassName,
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const initializedRef = useRef(false);
    const markerDataRef = useRef<MarkerEntry[]>([]);

    // Stable ref so zoomend/moveend always call the latest version of the update function.
    // Re-assigned whenever properties/matchMap change (inside the markers effect).
    const updateStylesRef = useRef<() => void>(() => {});

    const clearMarkers = useCallback(() => {
        markerDataRef.current.forEach(({ marker }) => {
            try { marker.remove(); } catch (_) {}
        });
        markerDataRef.current = [];
    }, []);

    const onPropertyClickRef = useRef(onPropertyClick);
    onPropertyClickRef.current = onPropertyClick;

    // Initialize Radar + create map (runs once)
    useEffect(() => {
        if (!mapContainerRef.current || initializedRef.current) return;

        const radarKey = APP_CONFIG.radar.key || (import.meta as any).env?.VITE_RADAR_KEY || '';
        if (!radarKey) {
            console.error('[PropertyMapView] No Radar API key found — set VITE_RADAR_KEY in .env.local');
            return;
        }

        try {
            Radar.registerPlugin(createMapsPlugin());
            // @ts-ignore
            Radar.initialize(radarKey);
            initializedRef.current = true;
        } catch (e) {
            console.warn('[PropertyMapView] Radar already initialized:', e);
            initializedRef.current = true;
        }

        const center = selectedCity ? (CITY_CENTERS[selectedCity] || TRI_VALLEY_CENTER) : TRI_VALLEY_CENTER;

        // @ts-ignore
        const map = Radar.ui.map({
            container: mapContainerRef.current,
            style: 'radar-default-v1',
            center,
            zoom: 12,
        });

        mapRef.current = map;

        // Force MapLibre to recalculate canvas size after layout stabilizes.
        // Needed when initialized inside a flex container with deferred CSS application.
        requestAnimationFrame(() => {
            if (mapRef.current) { try { mapRef.current.resize(); } catch (_) {} }
        });
        map.once('load', () => { try { map.resize(); } catch (_) {} });

        // Re-evaluate dot vs price badge whenever the user zooms or pans.
        map.on('zoomend', () => updateStylesRef.current());
        map.on('moveend', () => updateStylesRef.current());

        // Suppress missing POI sprite icon warnings from MapLibre.
        map.on('styleimagemissing', (e: { id: string }) => {
            if (!map.hasImage(e.id)) {
                map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
            }
        });

        // MutationObserver: bind click handlers to popup "View Property" links.
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    node.querySelectorAll?.('.zyphe-popup').forEach((popup) => {
                        const address = (popup as HTMLElement).dataset.address;
                        if (address && !(popup as any).__zyphe_bound) {
                            (popup as any).__zyphe_bound = true;
                            popup.addEventListener('click', () => onPropertyClickRef.current(address));
                        }
                    });
                    if (node.classList?.contains('maplibregl-popup')) {
                        const popup = node.querySelector('.zyphe-popup') as HTMLElement;
                        if (popup?.dataset.address && !(popup as any).__zyphe_bound) {
                            (popup as any).__zyphe_bound = true;
                            popup.addEventListener('click', () => onPropertyClickRef.current(popup.dataset.address!));
                        }
                    }
                }
            }
        });
        observer.observe(mapContainerRef.current, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            clearMarkers();
            if (mapRef.current) {
                try { mapRef.current.remove(); } catch (_) {}
                mapRef.current = null;
            }
            initializedRef.current = false;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Update map center and draw city boundary when city changes
    useEffect(() => {
        if (!selectedCity) return;
        const city = selectedCity;

        function applyBoundary(map: any, boundary: any) {
            try { if (map.getLayer('city-boundary-fill'))   map.removeLayer('city-boundary-fill');   } catch (_) {}
            try { if (map.getLayer('city-boundary-stroke')) map.removeLayer('city-boundary-stroke'); } catch (_) {}
            try { if (map.getSource('city-boundary'))       map.removeSource('city-boundary');       } catch (_) {}

            if (!boundary) {
                map.flyTo({ center: CITY_CENTERS[city] || TRI_VALLEY_CENTER, zoom: 12, duration: 1200 });
                return;
            }

            try {
                map.addSource('city-boundary', { type: 'geojson', data: boundary });
                map.addLayer({ id: 'city-boundary-fill', type: 'fill', source: 'city-boundary', paint: { 'fill-color': '#4f46e5', 'fill-opacity': 0.12 } });
                map.addLayer({ id: 'city-boundary-stroke', type: 'line', source: 'city-boundary', paint: { 'line-color': '#4f46e5', 'line-width': 3, 'line-opacity': 0.7 } });
                if (boundary.bbox) {
                    const [s, n, w, e] = boundary.bbox.map(Number);
                    map.fitBounds([w, s, e, n], { padding: 40, duration: 1500, essential: true });
                }
            } catch (err) {
                console.error('[Boundary] addLayer/addSource failed:', err);
            }
        }

        let cancelled = false;
        fetchCityBoundary(city)
            .then(boundary => {
                if (cancelled) return;
                const map = mapRef.current;
                if (!map) return;
                if (map.isStyleLoaded()) {
                    applyBoundary(map, boundary);
                } else {
                    map.once('load', () => { if (!cancelled && mapRef.current) applyBoundary(mapRef.current, boundary); });
                }
            })
            .catch(err => console.error('[Boundary] fetch failed:', err));

        return () => { cancelled = true; };
    }, [selectedCity]);

    // Add/update markers when properties or matchMap change
    useEffect(() => {
        if (!mapRef.current) return;

        // Always update the style function ref first so it closes over the latest data.
        updateStylesRef.current = () => {
            const map = mapRef.current;
            if (!map) return;
            const entries = markerDataRef.current;
            const modes = computeMarkerModes(map, entries);
            entries.forEach((entry, i) => applyMarkerMode(entry.el, entry.prop, entry.match, modes[i]));
        };

        const addMarkers = () => {
            clearMarkers();

            const withCoords = properties.filter(p => p.coordinates?.latitude && p.coordinates?.longitude);
            if (withCoords.length === 0) return;

            withCoords.forEach(prop => {
                const match = matchMap?.[prop.zpid];
                const el = createMarkerElement(prop, match);
                const lngLat: [number, number] = [prop.coordinates!.longitude, prop.coordinates!.latitude];

                try {
                    // @ts-ignore
                    const popup = Radar.ui.popup({
                        closeButton: false,
                        closeOnClick: false,
                        anchor: 'bottom',
                        offset: [0, -40],
                    }).setHTML(buildPopupHtml(prop, match as any));

                    // @ts-ignore
                    const marker = Radar.ui.marker({ element: el })
                        .setLngLat(lngLat)
                        .setPopup(popup)
                        .addTo(mapRef.current);

                    let hoverTimeout: any;
                    el.addEventListener('mouseenter', () => {
                        clearTimeout(hoverTimeout);
                        if (!popup.isOpen()) popup.addTo(mapRef.current);
                    });
                    el.addEventListener('mouseleave', () => {
                        hoverTimeout = setTimeout(() => { if (popup.isOpen()) popup.remove(); }, 100);
                    });
                    popup.on('open', () => {
                        const popupEl = popup.getElement();
                        if (popupEl) {
                            popupEl.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
                            popupEl.addEventListener('mouseleave', () => {
                                hoverTimeout = setTimeout(() => { if (popup.isOpen()) popup.remove(); }, 100);
                            });
                        }
                    });
                    el.addEventListener('click', e => e.stopPropagation());

                    markerDataRef.current.push({ marker, el, prop, match, lngLat });
                } catch (e) {
                    console.warn('[PropertyMapView] Failed to add marker:', e);
                }
            });

            // Compute initial dot/price layout at current zoom
            updateStylesRef.current();

            if (withCoords.length > 1) {
                try { mapRef.current.fitToMarkers({ maxZoom: 15, padding: 80 }); } catch (_) {}
            }
        };

        if (mapRef.current._loaded) {
            addMarkers();
        } else {
            mapRef.current.on('load', addMarkers);
        }
    }, [properties, matchMap, clearMarkers]);

    const hasCoords = properties.some(p => p.coordinates?.latitude && p.coordinates?.longitude);

    return (
        <div className={containerClassName ?? 'w-full basis-full relative rounded-2xl border border-slate-200 bg-white shadow-sm'}>
            {/* Map canvas */}
            <div
                ref={mapContainerRef}
                className="w-full"
                style={{ height: 'calc(100dvh - 310px)', minHeight: '480px' }}
            />

            {/* No-coordinates warning overlay */}
            {!hasCoords && properties.length > 0 && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                        <i className="fa-solid fa-map-location-dot text-slate-400 text-2xl"></i>
                    </div>
                    <p className="text-sm font-bold text-slate-600">No coordinate data available for these properties</p>
                    <p className="text-xs font-medium text-slate-400">Properties need geocoding to display on the map</p>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg border border-white/50">
                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-indigo-600"></div>
                        <span className="text-slate-500">Property</span>
                    </div>
                    {matchMap && Object.keys(matchMap).length > 0 && (
                        <>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-emerald-600"></div>
                                <span className="text-slate-500">80+ Match</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-amber-600"></div>
                                <span className="text-slate-500">60+ Match</span>
                            </div>
                        </>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <i className="fa-solid fa-location-dot text-[8px]"></i>
                        <span>{properties.filter(p => p.coordinates?.latitude).length} pins</span>
                    </div>
                </div>
            </div>

            <style>{`
                .maplibregl-canvas { border-radius: 16px; }
                .maplibregl-popup { z-index: 500 !important; }
                .maplibregl-popup-content {
                    border-radius: 16px !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15) !important;
                    border: 1px solid rgba(0,0,0,0.05) !important;
                    max-height: none !important;
                }
                .maplibregl-popup-close-button {
                    font-size: 18px !important;
                    padding: 4px 8px !important;
                    color: white !important;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
                    z-index: 10 !important;
                    right: 4px !important;
                    top: 4px !important;
                }
                .maplibregl-popup-close-button:hover {
                    background: rgba(0,0,0,0.2) !important;
                    border-radius: 50% !important;
                }
                .zyphe-map-marker { z-index: 1; }
                .zyphe-map-marker:hover { z-index: 999 !important; }
            `}</style>
        </div>
    );
};

export default PropertyMapView;
