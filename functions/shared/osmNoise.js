'use strict';
/**
 * Zyphe Proprietary Noise Simulation — Cloud Function port
 * Pure-JS port of services/api/osmNoise.ts (no @turf/turf dependency).
 * Uses the OpenStreetMap Overpass API + acoustic propagation physics.
 */

const AMBIENT_FLOOR_DB = 42.0;
const NOISE_RADIUS_METERS = 800;

const BASE_DB = {
    motorway: 90,
    trunk: 84,
    primary: 78,
    secondary: 70,
    tertiary: 62,
    rail: 85,
    runway: 95,
};

// ─── Haversine distance in meters ────────────────────────────────────────────
function _haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Nearest point on polyline (returns {distMeters, coord:[lng,lat]}) ───────
function _nearestOnPolyline(lat, lng, coords) {
    let minDist = Infinity;
    let closestCoord = coords[0];
    for (let i = 0; i < coords.length - 1; i++) {
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[i + 1];
        const dx = x2 - x1, dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        const t = lenSq > 0 ? Math.max(0, Math.min(1, ((lng - x1) * dx + (lat - y1) * dy) / lenSq)) : 0;
        const cx = x1 + t * dx, cy = y1 + t * dy;
        const d = _haversineMeters(lat, lng, cy, cx);
        if (d < minDist) { minDist = d; closestCoord = [cx, cy]; }
    }
    return { distMeters: minDist, coord: closestCoord };
}

// ─── 2D segment intersection (geographic coords, equirectangular OK at <1km) ─
function _segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    const dax = ax2 - ax1, day = ay2 - ay1;
    const dbx = bx2 - bx1, dby = by2 - by1;
    const denom = dax * dby - day * dbx;
    if (Math.abs(denom) < 1e-12) return false;
    const t = ((bx1 - ax1) * dby - (by1 - ay1) * dbx) / denom;
    const u = ((bx1 - ax1) * day - (by1 - ay1) * dax) / denom;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ─── Count building-polygon barriers along line-of-sight ─────────────────────
function _countBarriers(propLng, propLat, targetLng, targetLat, buildingPolygons) {
    let count = 0;
    for (const coords of buildingPolygons) {
        for (let i = 0; i < coords.length - 1; i++) {
            const [bx1, by1] = coords[i];
            const [bx2, by2] = coords[i + 1];
            if (_segmentsIntersect(propLng, propLat, targetLng, targetLat, bx1, by1, bx2, by2)) {
                count++;
                break;
            }
        }
    }
    return count;
}

function _getCharacterization(score) {
    if (score >= 90) return 'Quiet (Serene)';
    if (score >= 75) return 'Quiet';
    if (score >= 60) return 'Moderate';
    if (score >= 45) return 'Loud';
    return 'Very Loud';
}

// ─── Main export ──────────────────────────────────────────────────────────────
async function calculateZypheNoiseScore(lat, lng) {
    try {
        const dLat = 0.009;
        const dLng = 0.009 / Math.cos(lat * Math.PI / 180);
        const [minLat, maxLat] = [lat - dLat, lat + dLat];
        const [minLng, maxLng] = [lng - dLng, lng + dLng];

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

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: {
                'User-Agent': 'Zyphe-Noise-Simulation/1.0 (https://zyphe.ai)',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (!response.ok) {
            if (response.status === 429) throw new Error('429 Too Many Requests from Overpass');
            throw new Error(`Overpass API ${response.status}`);
        }
        const data = await response.json();

        // Parse nodes, roads, building polygons
        const elements = data.elements || [];
        const nodes = new Map();
        const roads = [];
        const buildingPolygons = [];

        elements.filter(e => e.type === 'node').forEach(n => nodes.set(n.id, [n.lon, n.lat]));

        elements.filter(e => e.type === 'way').forEach(w => {
            const coords = (w.nodes || []).map(id => nodes.get(id)).filter(Boolean);
            if (coords.length < 2) return;
            const tags = w.tags || {};
            if (tags.building) {
                if (w.nodes[0] === w.nodes[w.nodes.length - 1] && coords.length > 3) {
                    buildingPolygons.push(coords);
                }
                return;
            }
            const highwayType = tags.highway || (tags.railway ? 'rail' : tags.aeroway ? 'runway' : null);
            if (highwayType && BASE_DB[highwayType] != null) {
                roads.push({ coords, highwayType, name: tags.name || tags.ref || highwayType });
            }
        });

        // Simulate acoustic propagation
        let totalEnergy = Math.pow(10, AMBIENT_FLOOR_DB / 10);
        let maxImpactDb = AMBIENT_FLOOR_DB;
        let primarySource = 'Ambient (Quiet Neighborhood)';

        for (const road of roads) {
            const baseDb = BASE_DB[road.highwayType];
            const { distMeters, coord: closestCoord } = _nearestOnPolyline(lat, lng, road.coords);
            if (distMeters > NOISE_RADIUS_METERS) continue;

            const numBarriers = _countBarriers(lng, lat, closestCoord[0], closestCoord[1], buildingPolygons);
            let barrierReduction = 0;
            if (numBarriers === 1) barrierReduction = 8;
            else if (numBarriers === 2) barrierReduction = 11;
            else if (numBarriers >= 3) barrierReduction = Math.min(20, 11 + (numBarriers - 2));

            const distAttenuation = 20 * Math.log10(Math.max(distMeters, 10) / 10);
            const finalDb = baseDb - distAttenuation - barrierReduction;

            if (finalDb > maxImpactDb) {
                maxImpactDb = finalDb;
                const label = road.highwayType.charAt(0).toUpperCase() + road.highwayType.slice(1);
                primarySource = `${label}: ${road.name}`;
            }
            totalEnergy += Math.pow(10, finalDb / 10);
        }

        const finalDb = 10 * Math.log10(totalEnergy);
        const score = Math.max(0, Math.min(100, Math.round(100 - (finalDb - AMBIENT_FLOOR_DB) * (100 / (85 - AMBIENT_FLOOR_DB)))));

        return {
            score,
            characterization: _getCharacterization(score),
            primarySource,
            decibels: Math.round(finalDb),
        };
    } catch (e) {
        console.warn(`[OSM Noise] Failed for (${lat},${lng}):`, e.message);
        return null;
    }
}

// ─── City Boundary (Nominatim) ────────────────────────────────────────────────

function _bboxFromGeom(geom) {
    const flat = geom.type === 'Polygon'
        ? geom.coordinates.flat()
        : geom.coordinates.flat(2);
    const lngs = flat.map(c => c[0]);
    const lats = flat.map(c => c[1]);
    return {
        west: Math.min(...lngs), east: Math.max(...lngs),
        south: Math.min(...lats), north: Math.max(...lats),
    };
}

async function fetchCityBoundary(city, state = 'CA') {
    const params = new URLSearchParams({
        city, state, country: 'US',
        polygon_geojson: '1', format: 'geojson', limit: '1',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': 'Zyphe-Noise-Simulation/1.0 (https://zyphe.ai)' },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    if (!data.features?.length) return null;
    const feature = data.features[0];
    if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return null;
    return { geojson: feature, bbox: _bboxFromGeom(feature.geometry) };
}

// ─── City-Wide Acoustic Grid (returns raw Float32Array as base64) ─────────────

async function computeCityNoiseGridRaw(centerLat, centerLng, radiusKm = 4, gridSpacingMeters = 120, boundary = null) {
    let minLng, minLat, maxLng, maxLat;
    if (boundary) {
        ({ west: minLng, south: minLat, east: maxLng, north: maxLat } = boundary.bbox);
    } else {
        const dLat = (radiusKm * 1000) / 111320;
        const dLng = dLat / Math.cos(centerLat * Math.PI / 180);
        minLat = centerLat - dLat; maxLat = centerLat + dLat;
        minLng = centerLng - dLng; maxLng = centerLng + dLng;
    }

    const query = `
        [out:json][timeout:60];
        (
          way["highway"~"motorway|trunk|primary|secondary|tertiary"](${minLat},${minLng},${maxLat},${maxLng});
          way["railway"="rail"](${minLat},${minLng},${maxLat},${maxLng});
          way["aeroway"="runway"](${minLat},${minLng},${maxLat},${maxLng});
        );
        out body;>;out skel qt;
    `;

    const OVERPASS_MIRRORS = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
    ];
    const body = `data=${encodeURIComponent(query)}`;
    const headers = {
        'User-Agent': 'Zyphe-Noise-Simulation/1.0 (https://zyphe.ai)',
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    let res = null;
    for (const mirror of OVERPASS_MIRRORS) {
        try {
            res = await fetch(mirror, { method: 'POST', body, headers });
            if (res.ok) break;
            console.warn(`[CityNoiseGrid] Mirror ${mirror} returned ${res.status}, trying next...`);
        } catch (e) {
            console.warn(`[CityNoiseGrid] Mirror ${mirror} failed: ${e.message}, trying next...`);
        }
    }
    if (!res || !res.ok) throw new Error(`Overpass API error: all mirrors failed (last: ${res?.status ?? 'no response'})`);
    const osmData = await res.json();

    const nodes = new Map();
    osmData.elements.filter(e => e.type === 'node').forEach(n => nodes.set(n.id, [n.lon, n.lat]));

    const ATTENUATION = { motorway: 28, trunk: 28, rail: 16, runway: 16 };
    const roadLines = [];
    const tolDeg = NOISE_RADIUS_METERS / 111320;

    osmData.elements.filter(e => e.type === 'way').forEach(w => {
        const coords = (w.nodes || []).map(id => nodes.get(id)).filter(Boolean);
        if (coords.length < 2) return;
        const tags = w.tags || {};
        const roadType = tags.highway || (tags.railway === 'rail' ? 'rail' : null) || (tags.aeroway === 'runway' ? 'runway' : null);
        if (!roadType || !BASE_DB[roadType]) return;
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        roadLines.push({
            coords,
            baseDb: BASE_DB[roadType],
            attenFactor: ATTENUATION[roadType] || 22,
            bboxMinLat: Math.min(...lats) - tolDeg,
            bboxMaxLat: Math.max(...lats) + tolDeg,
            bboxMinLng: Math.min(...lngs) - tolDeg * 1.4,
            bboxMaxLng: Math.max(...lngs) + tolDeg * 1.4,
        });
    });

    const stepLat = gridSpacingMeters / 111320;
    const stepLng = gridSpacingMeters / (111320 * Math.cos(centerLat * Math.PI / 180));
    const gridRows = Math.ceil((maxLat - minLat) / stepLat);
    const gridCols = Math.ceil((maxLng - minLng) / stepLng);
    const dbGrid = new Float32Array(gridRows * gridCols);
    const ambientEnergy = Math.pow(10, AMBIENT_FLOOR_DB / 10);

    for (let row = 0; row < gridRows; row++) {
        const lat = maxLat - row * stepLat;
        for (let col = 0; col < gridCols; col++) {
            const lng = minLng + col * stepLng;
            let totalEnergy = ambientEnergy;

            for (const road of roadLines) {
                if (lat < road.bboxMinLat || lat > road.bboxMaxLat) continue;
                if (lng < road.bboxMinLng || lng > road.bboxMaxLng) continue;
                const { distMeters } = _nearestOnPolyline(lat, lng, road.coords);
                if (distMeters > NOISE_RADIUS_METERS) continue;
                const attenuation = road.attenFactor * Math.log10(Math.max(distMeters, 10) / 10);
                const finalDb = road.baseDb - attenuation;
                if (finalDb > 20) totalEnergy += Math.pow(10, finalDb / 10);
            }

            dbGrid[row * gridCols + col] = 10 * Math.log10(totalEnergy);
        }
    }

    const gridDataB64 = Buffer.from(dbGrid.buffer).toString('base64');
    return {
        gridDataB64,
        gridCols,
        gridRows,
        bounds: { north: maxLat, south: minLat, east: maxLng, west: minLng },
        roadCount: roadLines.length,
    };
}

module.exports = { calculateZypheNoiseScore, fetchCityBoundary, computeCityNoiseGridRaw };
