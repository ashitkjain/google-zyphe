import React, { useEffect, useRef } from 'react';
import Radar from 'radar-sdk-js';
import { createMapsPlugin } from '@radarlabs/plugin-maps';
import '@radarlabs/plugin-maps/dist/radar-maps.css';
import { APP_CONFIG } from '../../../config';
import { FaultLine } from '../../../services/api/faults';

interface FaultMapProps {
    lat: number;
    lng: number;
    faults: FaultLine[];
}

const FaultMap: React.FC<FaultMapProps> = ({ lat, lng, faults }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        if (!mapContainerRef.current) return;

        const radarKey = APP_CONFIG.radar.key || (import.meta as any).env?.VITE_RADAR_KEY || '';
        if (!radarKey) return;

        try {
            Radar.registerPlugin(createMapsPlugin());
            Radar.initialize(radarKey);
        } catch (e) {}

        // Initialize map
        // @ts-ignore
        const map = Radar.ui.map({
            container: mapContainerRef.current,
            style: 'radar-default-v1',
            center: [lng, lat],
            zoom: 11,
        });

        mapRef.current = map;

        map.on('load', () => {
            // Add property marker
            // @ts-ignore
            new Radar.ui.marker({ color: '#ef4444' })
                .setLngLat([lng, lat])
                .addTo(map);

            // Add fault lines
            faults.forEach((fault, i) => {
                if (fault.geometry.length < 2) return;

                const sourceId = `fault-source-${i}`;
                const layerId = `fault-layer-${i}`;

                map.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: { name: fault.name },
                        geometry: {
                            type: 'LineString',
                            coordinates: fault.geometry.map(p => [p.lng, p.lat])
                        }
                    }
                });

                map.addLayer({
                    id: layerId,
                    type: 'line',
                    source: sourceId,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#ef4444',
                        'line-width': 3,
                        'line-opacity': 0.6
                    }
                });

                // Add hover effect
                map.on('mouseenter', layerId, () => {
                    map.setPaintProperty(layerId, 'line-opacity', 1);
                    map.setPaintProperty(layerId, 'line-width', 5);
                });
                map.on('mouseleave', layerId, () => {
                    map.setPaintProperty(layerId, 'line-opacity', 0.6);
                    map.setPaintProperty(layerId, 'line-width', 3);
                });
            });

            // Fit bounds if we have faults
            if (faults.length > 0) {
                const allPoints = faults.flatMap(f => f.geometry);
                const bounds = allPoints.reduce((acc, p) => {
                    return [
                        Math.min(acc[0], p.lng),
                        Math.min(acc[1], p.lat),
                        Math.max(acc[2], p.lng),
                        Math.max(acc[3], p.lat)
                    ];
                }, [lng, lat, lng, lat]);

                map.fitBounds(bounds, { padding: 40, maxZoom: 13 });
            }
        });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [lat, lng, faults]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '300px', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.9)', backdropBlur: '4px', padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 10, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 3, background: '#ef4444', opacity: 0.6 }} />
                QUATERNARY FAULT LINE
            </div>
        </div>
    );
};

export default FaultMap;
