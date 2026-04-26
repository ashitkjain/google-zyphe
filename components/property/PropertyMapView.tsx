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
    /** Optional: highlight matched properties with their scores */
    matchMap?: Record<string, { score: number; rank: number; matchWriteup: string }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
};

// Tri-Valley center coordinates (fallback)
const TRI_VALLEY_CENTER: [number, number] = [-121.875, 37.66];

// City center coordinates
const CITY_CENTERS: Record<string, [number, number]> = {
    'Pleasanton': [-121.875, 37.66],
    'Dublin': [-121.9358, 37.7022],
    'Livermore': [-121.768, 37.6819],
    'San Ramon': [-121.9781, 37.7628],
    'Danville': [-121.9999, 37.8216],
};

// ── Custom Price Marker Element ────────────────────────────────────────────────

const createPriceMarkerElement = (
    property: CityPropertySummary,
    match?: { score: number; rank: number }
): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'zyphe-map-marker';

    const price = property.listPrice;
    const label = price ? fmt(price) : '—';

    // Color based on match score or default
    let bgColor = '#4F46E5'; // indigo
    let textColor = 'white';
    let borderColor = '#3730A3';
    let shadow = '0 2px 8px rgba(79,70,229,0.35)';

    if (match) {
        if (match.score >= 80) {
            bgColor = '#059669'; textColor = 'white'; borderColor = '#047857';
            shadow = '0 2px 8px rgba(5,150,105,0.4)';
        } else if (match.score >= 60) {
            bgColor = '#D97706'; textColor = 'white'; borderColor = '#B45309';
            shadow = '0 2px 8px rgba(217,119,6,0.4)';
        }
    }

    el.innerHTML = `
        <div style="
            background: ${bgColor};
            color: ${textColor};
            border: 1.5px solid ${borderColor};
            border-radius: 5px;
            padding: 2px 6px;
            font-size: 9.5px;
            font-weight: 800;
            white-space: nowrap;
            cursor: pointer;
            box-shadow: ${shadow};
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            position: relative;
            letter-spacing: -0.2px;
            line-height: 1.4;
        ">
            ${match ? `<span style="opacity:0.7;font-size:8px;margin-right:1px">#${match.rank}</span>` : ''}${label}
        </div>
        <div class="zyphe-marker-tip" style="
            width: 0; height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 4px solid ${bgColor};
            margin: 0 auto;
        "></div>
    `;

    el.style.cursor = 'pointer';

    el.addEventListener('mouseenter', () => {
        const inner = el.firstElementChild as HTMLElement;
        if (inner) {
            inner.style.transform = 'scale(1.15)';
            inner.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
            inner.style.zIndex = '999';
        }
    });
    el.addEventListener('mouseleave', () => {
        const inner = el.firstElementChild as HTMLElement;
        if (inner) {
            inner.style.transform = 'scale(1)';
            inner.style.boxShadow = shadow;
            inner.style.zIndex = '';
        }
    });

    return el;
};

// ── Build HTML popup content ───────────────────────────────────────────────────

const buildPopupHtml = (property: CityPropertySummary, match?: { score: number; rank: number; matchWriteup: string }): string => {
    // We cast CityPropertySummary to PropertyData for the component. 
    // They share enough fields for the card to render correctly.
    const propData = {
        ...property,
        livingAreaValue: property.livingArea
    } as any;

    return ReactDOMServer.renderToString(
        <div style={{ width: '320px', pointerEvents: 'auto' }} className="zyphe-popup" data-address={property.address}>
            <PropertyCard 
                property={propData} 
                match={match}
            />
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const PropertyMapView: React.FC<PropertyMapViewProps> = ({
    properties,
    onPropertyClick,
    selectedCity,
    matchMap,
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const initializedRef = useRef(false);

    // Clean up markers
    const clearMarkers = useCallback(() => {
        markersRef.current.forEach(m => {
            try { m.remove(); } catch (_) { }
        });
        markersRef.current = [];
    }, []);

    // Stable ref for onPropertyClick so the MutationObserver always uses the latest
    const onPropertyClickRef = useRef(onPropertyClick);
    onPropertyClickRef.current = onPropertyClick;

    // Initialize Radar + create map
    useEffect(() => {
        if (!mapContainerRef.current || initializedRef.current) return;

        const radarKey = APP_CONFIG.radar.key || (import.meta as any).env?.VITE_RADAR_KEY || '';
        if (!radarKey) {
            console.error('[PropertyMapView] No Radar API key found — set VITE_RADAR_KEY in .env.local');
            return;
        }

        try {
            Radar.registerPlugin(createMapsPlugin());
            // @ts-ignore – initialize accepts 2nd arg for options
            Radar.initialize(radarKey);
            initializedRef.current = true;
        } catch (e) {
            console.warn('[PropertyMapView] Radar already initialized:', e);
            initializedRef.current = true;
        }

        const center = selectedCity ? (CITY_CENTERS[selectedCity] || TRI_VALLEY_CENTER) : TRI_VALLEY_CENTER;

        // @ts-ignore – Radar.ui.map returns a MapLibre-compatible map
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
            if (mapRef.current) {
                try { mapRef.current.resize(); } catch (_) {}
            }
        });
        map.once('load', () => {
            try { map.resize(); } catch (_) {}
        });

        // Suppress "Image X could not be loaded" warnings from MapLibre for
        // missing POI sprite icons in the radar-default-v1 style.
        // We inject a 1×1 transparent image so MapLibre stops trying to reload them.
        map.on('styleimagemissing', (e: { id: string }) => {
            if (!map.hasImage(e.id)) {
                // 1×1 transparent PNG as ImageData
                const blankImage = { width: 1, height: 1, data: new Uint8Array(4) };
                map.addImage(e.id, blankImage);
            }
        });

        // MutationObserver: watch for popup elements appearing in the DOM
        // and attach click handlers to .zyphe-popup so "View Property →" works
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node instanceof HTMLElement) {
                        const popups = node.querySelectorAll
                            ? node.querySelectorAll('.zyphe-popup')
                            : [];
                        popups.forEach((popup) => {
                            const address = (popup as HTMLElement).dataset.address;
                            if (address && !(popup as any).__zyphe_bound) {
                                (popup as any).__zyphe_bound = true;
                                popup.addEventListener('click', () => {
                                    onPropertyClickRef.current(address);
                                });
                            }
                        });
                        // Also check if the node itself is a popup container
                        if (node.classList?.contains('maplibregl-popup')) {
                            const popup = node.querySelector('.zyphe-popup') as HTMLElement;
                            if (popup?.dataset.address && !(popup as any).__zyphe_bound) {
                                (popup as any).__zyphe_bound = true;
                                popup.addEventListener('click', () => {
                                    onPropertyClickRef.current(popup.dataset.address!);
                                });
                            }
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
                try { mapRef.current.remove(); } catch (_) { }
                mapRef.current = null;
            }
            initializedRef.current = false;
        };
    }, []); // Only run once


    // Update map center and draw boundaries when city changes
    useEffect(() => {
        if (!selectedCity) return;

        // Capture city at effect-creation time so the inner helpers always
        // reference the same value even after a re-render.
        const city = selectedCity;

        function applyBoundary(map: any, boundary: any) {
            // Remove stale layers/source
            try { if (map.getLayer('city-boundary-fill'))   map.removeLayer('city-boundary-fill');   } catch (_) {}
            try { if (map.getLayer('city-boundary-stroke')) map.removeLayer('city-boundary-stroke'); } catch (_) {}
            try { if (map.getSource('city-boundary'))       map.removeSource('city-boundary');       } catch (_) {}

            if (!boundary) {
                const center = CITY_CENTERS[city] || TRI_VALLEY_CENTER;
                map.flyTo({ center, zoom: 12, duration: 1200 });
                return;
            }

            try {
                map.addSource('city-boundary', { type: 'geojson', data: boundary });

                map.addLayer({
                    id: 'city-boundary-fill',
                    type: 'fill',
                    source: 'city-boundary',
                    paint: { 'fill-color': '#4f46e5', 'fill-opacity': 0.12 },
                });

                map.addLayer({
                    id: 'city-boundary-stroke',
                    type: 'line',
                    source: 'city-boundary',
                    paint: { 'line-color': '#4f46e5', 'line-width': 3, 'line-opacity': 0.7 },
                });

                if (boundary.bbox) {
                    const [s, n, w, e] = boundary.bbox.map(Number);
                    map.fitBounds([w, s, e, n], { padding: 40, duration: 1500, essential: true });
                }

                console.log('[Boundary] layers added for', city);
            } catch (err) {
                console.error('[Boundary] addLayer/addSource failed:', err);
            }
        }

        let cancelled = false;

        fetchCityBoundary(city).then(boundary => {
            if (cancelled) return;
            const map = mapRef.current;
            if (!map) return;

            if (map.isStyleLoaded()) {
                applyBoundary(map, boundary);
            } else {
                map.once('load', () => {
                    if (!cancelled && mapRef.current) applyBoundary(mapRef.current, boundary);
                });
            }
        }).catch(err => {
            console.error('[Boundary] fetch failed:', err);
        });

        return () => { cancelled = true; };
    }, [selectedCity]);

    // Add/update markers when properties change
    useEffect(() => {
        if (!mapRef.current) return;

        // Wait for map to be loaded
        const addMarkers = () => {
            clearMarkers();

            const propertiesWithCoords = properties.filter(
                p => p.coordinates?.latitude && p.coordinates?.longitude
            );

            if (propertiesWithCoords.length === 0) return;

            propertiesWithCoords.forEach(prop => {
                const match = matchMap?.[prop.zpid];
                const markerEl = createPriceMarkerElement(prop, match);

                // Click on marker element → navigate
                markerEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                try {
                    // Create popup separately so we can control when it opens
                    // @ts-ignore
                    const popup = Radar.ui.popup({
                        closeButton: false,
                        closeOnClick: false,
                        anchor: 'bottom',
                        offset: [0, -40]
                    }).setHTML(buildPopupHtml(prop, match as any));

                    // @ts-ignore
                    const marker = Radar.ui.marker({
                        element: markerEl,
                    })
                        .setLngLat([prop.coordinates!.longitude, prop.coordinates!.latitude])
                        .setPopup(popup)
                        .addTo(mapRef.current);

                    // Add hover listeners to the marker element
                    let hoverTimeout: any;

                    markerEl.addEventListener('mouseenter', () => {
                        clearTimeout(hoverTimeout);
                        if (!popup.isOpen()) {
                            popup.addTo(mapRef.current);
                        }
                    });

                    markerEl.addEventListener('mouseleave', () => {
                        hoverTimeout = setTimeout(() => {
                            if (popup.isOpen()) {
                                popup.remove();
                            }
                        }, 100);
                    });

                    // Also keep it open if mouse is inside the popup itself
                    popup.on('open', () => {
                        const popupEl = popup.getElement();
                        if (popupEl) {
                            popupEl.addEventListener('mouseenter', () => {
                                clearTimeout(hoverTimeout);
                            });
                            popupEl.addEventListener('mouseleave', () => {
                                hoverTimeout = setTimeout(() => {
                                    if (popup.isOpen()) {
                                        popup.remove();
                                    }
                                }, 100);
                            });
                        }
                    });

                    markersRef.current.push(marker);
                } catch (e) {
                    console.warn('[PropertyMapView] Failed to add marker:', e);
                }
            });

            // Fit map to all markers with padding
            if (propertiesWithCoords.length > 1) {
                try {
                    mapRef.current.fitToMarkers({ maxZoom: 15, padding: 60 });
                } catch (_) { }
            }
        };

        // Check if map is loaded
        if (mapRef.current._loaded) {
            addMarkers();
        } else {
            mapRef.current.on('load', addMarkers);
        }
    }, [properties, matchMap, clearMarkers]);

    const hasCoords = properties.some(p => p.coordinates?.latitude && p.coordinates?.longitude);

    return (
        <div className="w-full basis-full relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
            {/* Map Container */}
            <div
                ref={mapContainerRef}
                className="w-full"
                style={{ height: 'calc(100dvh - 310px)', minHeight: '480px' }}
            />

            {/* Overlay: No coordinates warning */}
            {!hasCoords && properties.length > 0 && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                        <i className="fa-solid fa-map-location-dot text-slate-400 text-2xl"></i>
                    </div>
                    <p className="text-sm font-bold text-slate-600">No coordinate data available for these properties</p>
                    <p className="text-xs font-medium text-slate-400">Properties need geocoding to display on the map</p>
                </div>
            )}

            {/* Map legend */}
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

            {/* Custom CSS for popups */}
            <style>{`
                .maplibregl-popup {
                    z-index: 500 !important;
                }
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
                .zyphe-map-marker {
                    z-index: 1;
                }
                .zyphe-map-marker:hover {
                    z-index: 999 !important;
                }
            `}</style>
        </div>
    );
};

export default PropertyMapView;
