import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';

export interface FaultLine {
    id: string;
    name: string;
    age: string;
    slipRate: string;
    slipSense: string;
    dipDirection: string;
    distanceMi: number;
    geometry: { lat: number; lng: number }[]; // We'll simplify to a single line or multiple paths
}

export interface FaultData {
    faults: FaultLine[];
    fetchedAt: number;
}

/**
 * Fetches nearby quaternary faults from USGS ArcGIS REST API.
 * Docs: https://services.arcgis.com/jIL9qeH9vMvXYAeY/arcgis/rest/services/Quaternary_Faults/FeatureServer/0
 */
export const fetchNearbyFaults = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string
): Promise<FaultData | null> => {
    const start = Date.now();
    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid, address,
        api_name: 'USGS Quaternary Faults',
        endpoint: 'Quaternary_Faults/FeatureServer/0/query',
        params: { lat, lng },
        status: 'pending'
    });

    try {
        // Query within approx 35 miles (0.5 degrees)
        const buffer = 0.5;
        const geometry = JSON.stringify({
            xmin: lng - buffer,
            ymin: lat - buffer,
            xmax: lng + buffer,
            ymax: lat + buffer,
            spatialReference: { wkid: 4326 }
        });
        
        // Use proxy to avoid CORS
        const url = `https://us-central1-zyphe-af0bf.cloudfunctions.net/proxyFaults?geometry=${encodeURIComponent(geometry)}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`USGS API Error: ${response.status}`);

        const data = await response.json();
        const features = data.features || [];

        const faults: FaultLine[] = features.map((f: any, idx: number) => {
            const attrs = f.attributes;
            const geom = f.geometry;
            
            // Simplify geometry to lat/lng points for the first path
            const path = (geom.paths?.[0] || []).map((p: number[]) => ({
                lng: p[0],
                lat: p[1]
            }));

            // Calculate approximate distance to the center of the fault path
            let minDist = 999;
            path.forEach((p: any) => {
                const d = haversineDistance(lat, lng, p.lat, p.lng);
                if (d < minDist) minDist = d;
            });

            return {
                id: `fault-${idx}-${attrs.fault_name || 'unknown'}`,
                name: attrs.fault_name || 'Unnamed Fault',
                age: attrs.age || 'Unknown',
                slipRate: attrs.slip_rate || 'Unknown',
                slipSense: attrs.slip_sense || 'Unknown',
                dipDirection: attrs.dip_direction || 'Unknown',
                distanceMi: Math.round(minDist * 0.621371 * 10) / 10,
                geometry: path
            };
        });

        // Sort by distance
        faults.sort((a, b) => a.distanceMi - b.distanceMi);

        if (logId) {
            updateAPICall(logId, {
                status: 'completed',
                response_time_ms: Date.now() - start
            });
        }

        return {
            faults: faults.slice(0, 10), // Return top 10 nearest
            fetchedAt: Date.now()
        };
    } catch (e) {
        console.error('[USGS Faults] Fetch failed:', e);
        if (logId) updateAPICall(logId, { status: 'failed', error: String(e) });
        return null;
    }
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number { return deg * Math.PI / 180; }
