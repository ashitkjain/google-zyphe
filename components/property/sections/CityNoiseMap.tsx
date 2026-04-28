
import React, { useEffect, useRef, useMemo } from 'react';
import Radar from 'radar-sdk-js';
import { createMapsPlugin } from '@radarlabs/plugin-maps';
import '@radarlabs/plugin-maps/dist/radar-maps.css';
import { APP_CONFIG } from '../../../config';
import { CityPropertySummary } from '../../../services/firebase/properties';

interface CityNoiseMapProps {
    cityProperties: CityPropertySummary[];
    center?: { lat: number; lng: number };
    subjectZpid?: string;
}

const CityNoiseMap: React.FC<CityNoiseMapProps> = ({ cityProperties, center, subjectZpid }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<Map<string, any>>(new Map());

    // 1. Initialize Map (Once)
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const radarKey = APP_CONFIG.radar.key || (import.meta as any).env?.VITE_RADAR_KEY || '';
        if (!radarKey) {
            console.error("[CityNoiseMap] Missing Radar API Key");
            return;
        }

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
            if (typeof Radar !== 'undefined') {
                Radar.initialize(radarKey);
            }
        } catch (e) {
            console.warn("[CityNoiseMap] Radar initialization warning:", e);
        }

        const validCenter = center && typeof center.lat === 'number' && typeof center.lng === 'number' 
            ? [center.lng, center.lat] 
            : [-121.8747, 37.6604];

        console.log("[CityNoiseMap] Creating Map Instance", { validCenter });

        let map: any = null;
        try {
            // @ts-ignore
            map = Radar.ui.map({
                container: mapContainerRef.current,
                style: 'radar-default-v1',
                center: validCenter,
                zoom: 12,
            });
            mapRef.current = map;
        } catch (err) {
            console.error("[CityNoiseMap] Map Init Error:", err);
            return;
        }

        return () => {
            if (mapRef.current) {
                console.log("[CityNoiseMap] Cleaning up map instance");
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []); // Empty dependency array = only once

    // 2. Sync Markers (When cityProperties or subject changes)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Ensure map is loaded before adding markers
        const syncMarkers = () => {
            console.log("[CityNoiseMap] Syncing markers for", cityProperties.length, "props");
            
            cityProperties.forEach(prop => {
                if (!prop.coordinates || typeof prop.coordinates.latitude !== 'number' || !prop.zypheNoiseScore) return;

                const zpid = prop.zpid;
                const score = prop.zypheNoiseScore;
                const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#f97316';
                const isSubject = zpid === subjectZpid;

                // Update or Create
                if (markersRef.current.has(zpid)) {
                    // Update color if needed
                    const existingMarker = markersRef.current.get(zpid);
                    // Existing markers in Radar UI don't have a simple setColor, 
                    // but we can check if we need to recreate it if the score changed significantly.
                    // For now, let's just keep it simple.
                } else {
                    try {
                        // @ts-ignore
                        const marker = Radar.ui.marker({ 
                            color: color,
                            scale: isSubject ? 1.2 : 0.8
                        })
                        .setLngLat([prop.coordinates.longitude, prop.coordinates.latitude])
                        .addTo(map);

                        if (isSubject) {
                            // @ts-ignore
                            const popup = Radar.ui.popup({ offset: 25 })
                                .setHTML(`<div style="padding: 8px; font-family: sans-serif; min-width: 120px;">
                                    <div style="font-weight: 900; font-size: 10px; color: #64748b; letter-spacing: 0.05em;">SUBJECT PROPERTY</div>
                                    <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">${prop.address}</div>
                                    <div style="font-weight: 900; font-size: 14px; color: ${color}; margin-top: 6px;">${score}/100</div>
                                </div>`);
                            marker.setPopup(popup);
                        }
                        markersRef.current.set(zpid, marker);
                    } catch (err) {
                        console.error("[CityNoiseMap] Marker Error:", err);
                    }
                }
            });
        };

        if (map.loaded()) {
            syncMarkers();
        } else {
            map.on('load', syncMarkers);
        }
    }, [cityProperties, subjectZpid]);

    // 3. Sync Center
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !center || typeof center.lat !== 'number') return;
        
        map.flyTo({
            center: [center.lng, center.lat],
            zoom: 13,
            speed: 0.8
        });
    }, [center?.lat, center?.lng]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

export default CityNoiseMap;
