import * as turf from '@turf/turf';
import { logAPICall } from '../firebase/api_logs';

// ─── Configuration ───────────────────────────────────────────────────────────

const AMBIENT_FLOOR_DB = 42.0;
const NOISE_RADIUS_METERS = 800; // Search radius for sources

const BASE_DB: Record<string, number> = {
    'motorway': 92,
    'motorway_link': 82,
    'trunk': 86,
    'trunk_link': 78,
    'primary': 80,
    'primary_link': 72,
    'secondary': 72,
    'secondary_link': 65,
    'tertiary': 65,
    'tertiary_link': 60,
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
              way["barrier"~"wall|fence|noise_barrier"](${minLat},${minLng},${maxLat},${maxLng});
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
            
            const tags = w.tags || {};
            const feature = turf.lineString(coords, tags);
            
            if (tags.building) {
                // If it's a closed way, treat as polygon
                if (w.nodes[0] === w.nodes[w.nodes.length - 1] && coords.length > 3) {
                    buildings.push(turf.polygon([coords], tags));
                } else {
                    buildings.push(feature);
                }
            } else if (tags.barrier) {
                buildings.push(feature); // Barriers act like thin buildings (blocking LOS)
            } else if (tags.highway || tags.railway || tags.aeroway) {
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
            const barrierReductionPerObject = (road.properties.highway === 'motorway' || road.properties.highway === 'trunk') ? 12 : 8;
            
            if (numBarriers >= 1) {
                barrierReduction = barrierReductionPerObject + (numBarriers - 1) * 3;
            }
            barrierReduction = Math.min(25, barrierReduction);
            
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

        // Calibrated to match HowLoud residential range: 42dB→92, 85dB→55
        const score = Math.max(0, Math.min(100, Math.round(55 + 37 * (85 - finalTotalDb) / 43)));

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
    if (score >= 85) return "Quiet (Serene)";
    if (score >= 75) return "Quiet";
    if (score >= 68) return "Moderate";
    if (score >= 60) return "Loud";
    return "Very Loud";
}

// ─── City Boundary ────────────────────────────────────────────────────────────

export interface CityBoundary {
    geojson: any; // GeoJSON Feature<Polygon | MultiPolygon>
    bbox: { north: number; south: number; east: number; west: number };
}

export async function fetchCityBoundary(city: string, state = 'CA'): Promise<CityBoundary | null> {
    try {
        const params = new URLSearchParams({
            city,
            state,
            country: 'US',
            polygon_geojson: '1',
            format: 'geojson',
            limit: '1',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: { 'User-Agent': 'Zyphe-Noise-Simulation/1.0 (https://zyphe.ai)' },
        });
        if (!res.ok) throw new Error(`Nominatim ${res.status}`);
        const data = await res.json();
        if (!data.features?.length) return null;
        const feature = data.features[0];
        if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return null;
        const [minLng, minLat, maxLng, maxLat] = turf.bbox(feature);
        return { geojson: feature, bbox: { north: maxLat, south: minLat, east: maxLng, west: minLng } };
    } catch (e) {
        console.error('[fetchCityBoundary] Failed:', e);
        return null;
    }
}

// ─── City-Wide Acoustic Grid ──────────────────────────────────────────────────

interface RoadLine {
    line: ReturnType<typeof turf.lineString>;
    baseDb: number;
    type: string;
    // Pre-computed bbox for fast grid-cell pre-filter
    bboxMinLat: number;
    bboxMaxLat: number;
    bboxMinLng: number;
    bboxMaxLng: number;
}

export interface CityNoiseGridResult {
    /** dB values row-major, top row = northernmost (matches canvas pixel order) */
    dbGrid: Float32Array;
    gridCols: number;
    gridRows: number;
    bounds: { north: number; south: number; east: number; west: number };
    roadCount: number;
    boundary: CityBoundary | null;
}

/**
 * Computes a city-wide acoustic noise grid using the same log-distance-decay physics
 * as calculateZypheNoiseScore. Each road contributes ONCE per grid cell (nearest-point
 * on its line geometry) — preventing the artificial energy accumulation that happens
 * when roads are over-sampled as independent point sources.
 */
export async function computeCityNoiseGrid(
    centerLat: number,
    centerLng: number,
    radiusKm: number = 4,
    gridSpacingMeters: number = 120,
    boundary?: CityBoundary | null,
): Promise<CityNoiseGridResult> {
    // 1. Fetch roads for the area — use city bbox if boundary provided
    let minLng: number, minLat: number, maxLng: number, maxLat: number;
    if (boundary) {
        ({ west: minLng, south: minLat, east: maxLng, north: maxLat } = boundary.bbox);
    } else {
        const areaBbox = turf.bbox(turf.circle([centerLng, centerLat], radiusKm, { units: 'kilometers' }));
        [minLng, minLat, maxLng, maxLat] = areaBbox;
    }

    const query = `
        [out:json][timeout:30];
        (
          way["highway"~"motorway|trunk|primary|secondary|tertiary"](${minLat},${minLng},${maxLat},${maxLng});
          way["railway"="rail"](${minLat},${minLng},${maxLat},${maxLng});
          way["aeroway"="runway"](${minLat},${minLng},${maxLat},${maxLng});
          way["barrier"~"wall|fence|noise_barrier"](${minLat},${minLng},${maxLat},${maxLng});
          way["building"](${minLat},${minLng},${maxLat},${maxLng});
        );
        out body;>;out skel qt;
    `;

    const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
            'User-Agent': 'Zyphe-Noise-Simulation/1.0 (https://zyphe.ai)',
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
    if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
    const osmData = await res.json();

    // 2. Build road LINE geometries (not sample points — avoids double-counting)
    const nodes = new Map<number, [number, number]>();
    osmData.elements
        .filter((e: any) => e.type === 'node')
        .forEach((n: any) => nodes.set(n.id, [n.lon, n.lat]));

    const roadLines: RoadLine[] = [];
    const barrierFeatures: any[] = [];

    osmData.elements
        .filter((e: any) => e.type === 'way')
        .forEach((w: any) => {
            const coords = (w.nodes || [])
                .map((id: number) => nodes.get(id))
                .filter(Boolean) as [number, number][];
            if (coords.length < 2) return;

            const tags = w.tags || {};
            const roadType =
                tags.highway ||
                (tags.railway === 'rail' ? 'rail' : null) ||
                (tags.aeroway === 'runway' ? 'runway' : null);
            
            if (roadType && !tags.barrier && !tags.building) {
                const baseDb = BASE_DB[roadType] ?? 55;
                const line = turf.lineString(coords);
                const [rMinLng, rMinLat, rMaxLng, rMaxLat] = turf.bbox(line);
                const tolDeg = NOISE_RADIUS_METERS / 111320;
                roadLines.push({
                    line,
                    baseDb,
                    type: roadType,
                    bboxMinLat: rMinLat - tolDeg,
                    bboxMaxLat: rMaxLat + tolDeg,
                    bboxMinLng: rMinLng - tolDeg * 1.4,
                    bboxMaxLng: rMaxLng + tolDeg * 1.4,
                });
            } else if (tags.barrier || tags.building) {
                barrierFeatures.push(turf.lineString(coords));
            }
        });

    // 3. Build grid — rows NORTH→SOUTH (row 0 = maxLat, matches canvas pixel order)
    const stepLat = gridSpacingMeters / 111320;
    const stepLng = gridSpacingMeters / (111320 * Math.cos(centerLat * (Math.PI / 180)));

    const gridRows = Math.ceil((maxLat - minLat) / stepLat);
    const gridCols = Math.ceil((maxLng - minLng) / stepLng);
    const dbGrid = new Float32Array(gridRows * gridCols);
    const ambientEnergy = Math.pow(10, AMBIENT_FLOOR_DB / 10);

    for (let row = 0; row < gridRows; row++) {
        const lat = maxLat - row * stepLat;

        for (let col = 0; col < gridCols; col++) {
            const lng = minLng + col * stepLng;
            let totalEnergy = ambientEnergy;
            const cellPt = turf.point([lng, lat]);

            for (const road of roadLines) {
                // Fast bbox pre-filter — skip roads that can't possibly be within range
                if (lat < road.bboxMinLat || lat > road.bboxMaxLat) continue;
                if (lng < road.bboxMinLng || lng > road.bboxMaxLng) continue;

                // One nearestPointOnLine call per road — the correct physical model
                // (a road is a single extended source, not N independent point sources)
                const nearest = turf.nearestPointOnLine(road.line, cellPt);
                const distM = turf.distance(cellPt, nearest, { units: 'meters' });

                if (distM > NOISE_RADIUS_METERS) continue;

                // Barrier Check
                let numBarriers = 0;
                const los = turf.lineString([[lng, lat], nearest.geometry.coordinates]);
                for (const barrier of barrierFeatures) {
                    if (turf.booleanIntersects(los, barrier)) numBarriers++;
                }

                let barrierReduction = 0;
                const reductionPerObj = (road.type === 'motorway' || road.type === 'trunk') ? 12 : 8;
                if (numBarriers >= 1) barrierReduction = reductionPerObj + (numBarriers - 1) * 3;
                barrierReduction = Math.min(25, barrierReduction);

                const attenuation = 20 * Math.log10(Math.max(distM, 10) / 10);
                const finalDb = road.baseDb - attenuation - barrierReduction;
                if (finalDb > 20) totalEnergy += Math.pow(10, finalDb / 10);
            }

            dbGrid[row * gridCols + col] = 10 * Math.log10(totalEnergy);
        }
    }

    return {
        dbGrid,
        gridCols,
        gridRows,
        bounds: { north: maxLat, south: minLat, east: maxLng, west: minLng },
        roadCount: roadLines.length,
        boundary: boundary ?? null,
    };
}
