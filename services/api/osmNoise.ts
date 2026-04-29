import * as turf from '@turf/turf';
import { logAPICall } from '../firebase/api_logs';

// ─── Configuration ───────────────────────────────────────────────────────────

const AMBIENT_FLOOR_DB = 42.0;
const NOISE_RADIUS_METERS = 800; // Search radius for sources

const BASE_DB: Record<string, number> = {
    'motorway': 90,
    'trunk': 84,
    'primary': 78,
    'secondary': 70,
    'tertiary': 62,
    'rail': 85,
    'runway': 95
};

export interface NoiseSimulationResult {
    score: number;
    characterization: string;
    primarySource: string;
    decibels: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Fetches OSM data and calculates a proprietary noise score based on 
 * acoustic propagation physics, including building barriers and distance decay.
 */
export async function calculateZypheNoiseScore(lat: number, lng: number): Promise<NoiseSimulationResult | null> {
    try {
        // 1. Fetch OSM Data (Overpass API)
        // We query for roads, railways, aeroways, and buildings within a bounding box
        const bbox = turf.bbox(turf.circle([lng, lat], 1, { units: 'kilometers' }));
        const [minLng, minLat, maxLng, maxLat] = bbox;
        
        const query = `
            [out:json][timeout:25];
            (
              way["highway"~"motorway|trunk|primary|secondary|tertiary"](${minLat},${minLng},${maxLat},${maxLng});
              way["railway"="rail"](${minLat},${minLng},${maxLat},${maxLng});
              way["aeroway"="runway"](${minLat},${minLng},${maxLat},${maxLng});
              way["building"](${minLat},${minLng},${maxLat},${maxLng});
              relation["building"](${minLat},${minLng},${maxLat},${maxLng});
            );
            out body;
            >;
            out skel qt;
        `;
        
        logAPICall({ user_id: 'unknown', api_name: 'osm_overpass', endpoint: 'noise_simulation', params: { lat, lng }, status: 'completed' });
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: {
                'User-Agent': 'Zyphe-Noise-Simulation/1.0 (https://zyphe.ai)',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 429) {
                throw new Error('429 Too Many Requests');
            }
            throw new Error(`Overpass API failure: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}`);
        }
        const data = await response.json();
        
        // 2. Parse OSM into Turf Features
        const elements = data.elements || [];
        const roads: any[] = [];
        const buildings: any[] = [];
        const nodes = new Map();
        
        // First pass: collect nodes
        elements.filter((e: any) => e.type === 'node').forEach((n: any) => nodes.set(n.id, [n.lon, n.lat]));
        
        // Second pass: build ways
        elements.filter((e: any) => e.type === 'way').forEach((w: any) => {
            const coords = w.nodes.map((id: number) => nodes.get(id)).filter(Boolean);
            if (coords.length < 2) return;
            
            const feature = turf.lineString(coords, w.tags);
            if (w.tags && w.tags.building) {
                // If it's a closed way, treat as polygon
                if (w.nodes[0] === w.nodes[w.nodes.length - 1] && coords.length > 3) {
                    buildings.push(turf.polygon([coords], w.tags));
                } else {
                    buildings.push(feature);
                }
            } else {
                roads.push(feature);
            }
        });

        // 3. Simulation Math
        const propertyPoint = turf.point([lng, lat]);
        let totalEnergy = Math.pow(10, AMBIENT_FLOOR_DB / 10);
        let maxImpactDb = AMBIENT_FLOOR_DB;
        let primarySource = "Ambient (Quiet Neighborhood)";

        for (const road of roads) {
            const highwayType = road.properties.highway || (road.properties.railway ? 'rail' : road.properties.aeroway ? 'runway' : 'tertiary');
            const baseDb = BASE_DB[highwayType] || 60;
            
            // Find closest point on road
            const closestPoint = turf.nearestPointOnLine(road, propertyPoint);
            const distanceMeters = turf.distance(propertyPoint, closestPoint, { units: 'meters' });
            
            if (distanceMeters > NOISE_RADIUS_METERS) continue;
            
            // Check Barriers (Line of Sight)
            const los = turf.lineString([[lng, lat], closestPoint.geometry.coordinates]);
            let numBarriers = 0;
            for (const building of buildings) {
                if (turf.booleanIntersects(los, building)) {
                    numBarriers++;
                }
            }
            
            // Refined Barrier Reduction Math
            let barrierReduction = 0;
            if (numBarriers === 1) barrierReduction = 8;
            else if (numBarriers === 2) barrierReduction = 11;
            else if (numBarriers >= 3) barrierReduction = Math.min(20, 11 + (numBarriers - 2) * 1);
            
            // Logarithmic Distance Decay (reference 10m)
            const distAttenuation = 20 * Math.log10(Math.max(distanceMeters, 10) / 10);
            
            const finalDb = baseDb - distAttenuation - barrierReduction;
            
            if (finalDb > maxImpactDb) {
                maxImpactDb = finalDb;
                const name = road.properties.name || road.properties.ref || highwayType;
                primarySource = `${highwayType.charAt(0).toUpperCase() + highwayType.slice(1)}: ${name}`;
            }
            
            totalEnergy += Math.pow(10, finalDb / 10);
        }

        const finalTotalDb = 10 * Math.log10(totalEnergy);
        
        // 0-100 Score Mapping (42dB -> 100, 85dB -> 0)
        const score = Math.max(0, Math.min(100, 100 - (finalTotalDb - AMBIENT_FLOOR_DB) * (100 / (85 - AMBIENT_FLOOR_DB))));

        return {
            score: Math.round(score),
            characterization: getCharacterization(score),
            primarySource: primarySource,
            decibels: Math.round(finalTotalDb)
        };

    } catch (error) {
        console.error('[OSM Noise Simulation] Failed:', error);
        return null;
    }
}

function getCharacterization(score: number): string {
    if (score >= 90) return "Quiet (Serene)";
    if (score >= 75) return "Quiet";
    if (score >= 60) return "Moderate";
    if (score >= 45) return "Loud";
    return "Very Loud";
}
