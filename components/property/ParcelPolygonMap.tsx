
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ParcelPolygonMapProps {
    polygon: [number, number][]; // [[lon, lat], ...]
    center: { latitude: number; longitude: number };
    apn?: string;
    areaSqft?: number;
}

const ParcelPolygonMap: React.FC<ParcelPolygonMapProps> = ({ polygon, center, apn, areaSqft }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMap = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!mapRef.current || polygon.length < 3) return;

        // Convert [lon, lat] → [lat, lon] for Leaflet
        const latLngs: L.LatLngExpression[] = polygon.map(([lon, lat]) => [lat, lon]);

        // Create map if not already created
        if (!leafletMap.current) {
            leafletMap.current = L.map(mapRef.current, {
                zoomControl: true,
                scrollWheelZoom: true,
                attributionControl: false,
            });

            // Satellite tiles from Esri
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 20,
            }).addTo(leafletMap.current);

            // Light labels overlay
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 20,
                opacity: 0.6,
            }).addTo(leafletMap.current);
        }

        const map = leafletMap.current;

        // Clear existing layers (except tile layers)
        map.eachLayer((layer) => {
            if (layer instanceof L.Polygon || layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        // Draw polygon
        const poly = L.polygon(latLngs, {
            color: '#6366f1',
            weight: 3,
            fillColor: '#6366f1',
            fillOpacity: 0.15,
            dashArray: '6, 4',
        }).addTo(map);

        // Fit map to polygon bounds with padding
        const bounds = poly.getBounds();
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });

        // Add a tooltip
        if (apn || areaSqft) {
            const acres = areaSqft ? (areaSqft / 43560).toFixed(2) : null;
            const tooltipText = [
                apn ? `APN: ${apn}` : null,
                areaSqft ? `${areaSqft.toLocaleString()} sf (${acres} ac)` : null,
            ].filter(Boolean).join('\n');

            poly.bindTooltip(tooltipText, {
                permanent: true,
                direction: 'center',
                className: 'parcel-tooltip',
            });
        }

        return () => {
            // Don't destroy map on cleanup — we reuse it
        };
    }, [polygon, center.latitude, center.longitude, apn, areaSqft]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (leafletMap.current) {
                leafletMap.current.remove();
                leafletMap.current = null;
            }
        };
    }, []);

    return (
        <div className="relative rounded-3xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
            <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100">
                Parcel Boundary
            </div>
            <div
                ref={mapRef}
                className="w-full aspect-square"
                style={{ zIndex: 0 }}
            />
            <style>{`
                .parcel-tooltip {
                    background: rgba(15, 23, 42, 0.85) !important;
                    color: white !important;
                    border: 1px solid rgba(99, 102, 241, 0.5) !important;
                    border-radius: 8px !important;
                    font-size: 10px !important;
                    font-weight: 700 !important;
                    letter-spacing: 0.05em !important;
                    padding: 4px 8px !important;
                    white-space: pre-line !important;
                    text-align: center !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
                }
                .parcel-tooltip::before {
                    display: none !important;
                }
            `}</style>
        </div>
    );
};

export default ParcelPolygonMap;
