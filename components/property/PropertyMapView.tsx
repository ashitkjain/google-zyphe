import React, { useEffect, useRef, useCallback } from 'react';
import Radar from 'radar-sdk-js';
import { createMapsPlugin } from '@radarlabs/plugin-maps';
import '@radarlabs/plugin-maps/dist/radar-maps.css';
import { APP_CONFIG } from '../../config';
import { CityPropertySummary } from '../../services/firebase/properties';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PropertyMapViewProps {
    properties: CityPropertySummary[];
    onPropertyClick: (address: string) => void;
    selectedCity?: string;
    /** Optional: highlight matched properties with their scores */
    matchMap?: Record<string, { score: number; rank: number }>;
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
            border: 2px solid ${borderColor};
            border-radius: 8px;
            padding: 3px 8px;
            font-size: 11px;
            font-weight: 900;
            white-space: nowrap;
            cursor: pointer;
            box-shadow: ${shadow};
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            position: relative;
            letter-spacing: -0.3px;
        ">
            ${match ? `<span style="opacity:0.7;font-size:9px;margin-right:2px">#${match.rank}</span>` : ''}${label}
        </div>
        <div style="
            width: 0; height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid ${bgColor};
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

const buildPopupHtml = (property: CityPropertySummary, match?: { score: number; rank: number }): string => {
    const price = property.listPrice ? fmt(property.listPrice) : 'Price N/A';
    const heroImage = property.images?.[0] || '';
    const specs = [
        property.bedrooms != null ? `${property.bedrooms} bd` : '',
        property.bathrooms != null ? `${property.bathrooms} ba` : '',
        property.livingArea != null ? `${property.livingArea.toLocaleString()} sqft` : '',
    ].filter(Boolean).join(' · ');

    const matchBadge = match
        ? `<div style="position:absolute;top:6px;left:6px;display:flex;gap:3px;">
             <span style="background:${match.score >= 80 ? '#059669' : match.score >= 60 ? '#D97706' : '#6366f1'};color:white;font-size:9px;font-weight:900;padding:2px 6px;border-radius:4px;">#${match.rank}</span>
             <span style="background:${match.score >= 80 ? '#059669' : match.score >= 60 ? '#D97706' : '#6366f1'};color:white;font-size:9px;font-weight:900;padding:2px 6px;border-radius:4px;">${match.score}%</span>
           </div>`
        : '';

    return `
        <div style="width:240px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;cursor:pointer;" class="zyphe-popup" data-address="${property.address.replace(/"/g, '&quot;')}">
            ${heroImage ? `
                <div style="position:relative;width:100%;height:100px;overflow:hidden;background:#f1f5f9;">
                    <img src="${heroImage}" alt="" style="width:100%;height:100%;object-fit:cover;" />
                    ${matchBadge}
                </div>
            ` : ''}
            <div style="padding:10px 12px;">
                <div style="font-size:16px;font-weight:900;color:#0f172a;letter-spacing:-0.5px;">${price}</div>
                <div style="font-size:11px;font-weight:700;color:#64748b;margin-top:1px;">${specs}</div>
                <div style="font-size:10px;font-weight:600;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${property.address}</div>
                ${property.neighborhood ? `<div style="font-size:9px;font-weight:800;color:#6366f1;margin-top:3px;text-transform:uppercase;letter-spacing:0.5px;">${property.neighborhood}</div>` : ''}
                <div style="margin-top:8px;text-align:center;">
                    <span style="font-size:10px;font-weight:800;color:white;text-transform:uppercase;letter-spacing:1px;background:#4F46E5;padding:6px 16px;border-radius:8px;display:inline-block;cursor:pointer;">View Property →</span>
                </div>
            </div>
        </div>
    `;
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
            try { m.remove(); } catch (_) {}
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
                try { mapRef.current.remove(); } catch (_) {}
                mapRef.current = null;
            }
            initializedRef.current = false;
        };
    }, []); // Only run once

    // Update map center when city changes
    useEffect(() => {
        if (!mapRef.current || !selectedCity) return;
        const center = CITY_CENTERS[selectedCity] || TRI_VALLEY_CENTER;
        mapRef.current.flyTo({ center, zoom: 12, duration: 1200 });
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
                    // @ts-ignore
                    const marker = Radar.ui.marker({
                        element: markerEl,
                        popup: {
                            html: buildPopupHtml(prop, match),
                        },
                    })
                    .setLngLat([prop.coordinates!.longitude, prop.coordinates!.latitude])
                    .addTo(mapRef.current);

                    markersRef.current.push(marker);
                } catch (e) {
                    console.warn('[PropertyMapView] Failed to add marker:', e);
                }
            });

            // Fit map to all markers with padding
            if (propertiesWithCoords.length > 1) {
                try {
                    mapRef.current.fitToMarkers({ maxZoom: 15, padding: 60 });
                } catch (_) {}
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
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
            {/* Map Container */}
            <div
                ref={mapContainerRef}
                className="w-full"
                style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}
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
