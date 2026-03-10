import { describe, it, expect } from 'vitest';
import {
    mapWidthInMeters,
    pixelDistanceFromCenter,
    pixelDistToMeters,
    enrichPoisWithDistance,
    BoundingBox,
} from '../utils/poiDistance';

/**
 * POI Bounding Box Distance Calculation Tests
 *
 * Tests the pure math utilities that convert Gemini's normalised
 * bounding-box coordinates (0–1000) into real-world distances.
 *
 * Reference property: 4251 Lucero Ct, Pleasanton, CA 94588
 *   Latitude: ~37.66 °N
 *   Radar zoom-out: zoom=15, width=1024, scale=1
 */

const PLEASANTON_LAT = 37.66;
const ZOOM_OUT_ZOOM = 15;
const MAP_IMAGE_WIDTH = 1024;

describe('mapWidthInMeters', () => {
    it('should compute reasonable width for Pleasanton at zoom 15', () => {
        const width = mapWidthInMeters(ZOOM_OUT_ZOOM, PLEASANTON_LAT, MAP_IMAGE_WIDTH);
        // At zoom 15, lat ~37.66, 1024 px → ~3,800 m (within ±200 m tolerance)
        expect(width).toBeGreaterThan(3500);
        expect(width).toBeLessThan(4100);
    });

    it('should double when zoom decreases by 1', () => {
        const z15 = mapWidthInMeters(15, PLEASANTON_LAT);
        const z14 = mapWidthInMeters(14, PLEASANTON_LAT);
        // z14 should be ≈ 2x z15
        expect(z14 / z15).toBeCloseTo(2, 1);
    });

    it('should halve when zoom increases by 1', () => {
        const z15 = mapWidthInMeters(15, PLEASANTON_LAT);
        const z16 = mapWidthInMeters(16, PLEASANTON_LAT);
        expect(z15 / z16).toBeCloseTo(2, 1);
    });

    it('should scale linearly with imageWidth', () => {
        const w1024 = mapWidthInMeters(15, PLEASANTON_LAT, 1024);
        const w512 = mapWidthInMeters(15, PLEASANTON_LAT, 512);
        expect(w1024 / w512).toBeCloseTo(2, 1);
    });

    it('should handle equator (lat=0) as maximum width', () => {
        const equator = mapWidthInMeters(15, 0, 1024);
        const pleasant = mapWidthInMeters(15, PLEASANTON_LAT, 1024);
        expect(equator).toBeGreaterThan(pleasant);
    });
});

describe('pixelDistanceFromCenter', () => {
    it('should return 0 for a POI at the centre', () => {
        const box: BoundingBox = { ymin: 490, xmin: 490, ymax: 510, xmax: 510 };
        expect(pixelDistanceFromCenter(box)).toBe(0);
    });

    it('should compute correct distance for a POI directly to the right', () => {
        // Centre of box at (700, 500) → 200 units from centre
        const box: BoundingBox = { ymin: 490, xmin: 690, ymax: 510, xmax: 710 };
        expect(pixelDistanceFromCenter(box)).toBeCloseTo(200, 0);
    });

    it('should compute correct distance for a diagonal POI', () => {
        // Centre at (600, 600) → distance = √(100² + 100²) = √20000 ≈ 141.4
        const box: BoundingBox = { ymin: 590, xmin: 590, ymax: 610, xmax: 610 };
        expect(pixelDistanceFromCenter(box)).toBeCloseTo(141.42, 0);
    });

    it('should handle edge-of-map POI at (0, 0)', () => {
        const box: BoundingBox = { ymin: 0, xmin: 0, ymax: 10, xmax: 10 };
        // Centre at (5, 5) → distance from (500, 500) = √(495² + 495²) ≈ 699.9
        const dist = pixelDistanceFromCenter(box);
        expect(dist).toBeCloseTo(699.9, 0);
    });

    it('should handle corner POI at (1000, 1000)', () => {
        const box: BoundingBox = { ymin: 990, xmin: 990, ymax: 1000, xmax: 1000 };
        // Centre at (995, 995) → distance from (500, 500) = √(495² + 495²) ≈ 699.9
        const dist = pixelDistanceFromCenter(box);
        expect(dist).toBeCloseTo(699.9, 0);
    });

    it('should use custom property center when provided', () => {
        const box: BoundingBox = { ymin: 290, xmin: 290, ymax: 310, xmax: 310 };
        // Centre at (300, 300), property at (300, 300) → 0
        const dist = pixelDistanceFromCenter(box, 300, 300);
        expect(dist).toBeCloseTo(0, 0);
    });
});

describe('pixelDistToMeters', () => {
    it('should convert full map width correctly', () => {
        // A POI at the very edge (1000 units away) = full map width
        const mapWidth = 3800;
        expect(pixelDistToMeters(1000, mapWidth)).toBe(3800);
    });

    it('should convert half-distance correctly', () => {
        const mapWidth = 3800;
        expect(pixelDistToMeters(500, mapWidth)).toBe(1900);
    });

    it('should return 0 for zero pixel distance', () => {
        expect(pixelDistToMeters(0, 3800)).toBe(0);
    });
});

describe('enrichPoisWithDistance', () => {
    // Simulated Gemini response for 4251 Lucero Ct, Pleasanton
    const mapWidthMeters = mapWidthInMeters(ZOOM_OUT_ZOOM, PLEASANTON_LAT, MAP_IMAGE_WIDTH);

    const mockPois = [
        {
            name: 'Safeway',
            category: 'shopping',
            bounding_box: { ymin: 340, xmin: 460, ymax: 360, xmax: 540 } as BoundingBox,
            highlights: 'Major grocery store',
        },
        {
            name: 'Starbucks',
            category: 'dining',
            bounding_box: { ymin: 210, xmin: 340, ymax: 230, xmax: 360 } as BoundingBox,
        },
        {
            name: 'Valley Community Church',
            category: 'community',
            bounding_box: { ymin: 600, xmin: 700, ymax: 620, xmax: 780 } as BoundingBox,
            highlights: 'Large congregation',
        },
    ];

    it('should enrich all POIs with distance fields', () => {
        const enriched = enrichPoisWithDistance(mockPois, mapWidthMeters);

        expect(enriched).toHaveLength(3);
        enriched.forEach((poi) => {
            expect(poi).toHaveProperty('center');
            expect(poi).toHaveProperty('pixelDistance');
            expect(poi).toHaveProperty('distanceMeters');
            expect(poi).toHaveProperty('distanceMiles');
            expect(poi.center.x).toBeGreaterThanOrEqual(0);
            expect(poi.center.y).toBeGreaterThanOrEqual(0);
            expect(poi.distanceMeters).toBeGreaterThanOrEqual(0);
            expect(poi.distanceMiles).toBeGreaterThanOrEqual(0);
        });
    });

    it('should compute Safeway as closer than Starbucks (based on mock coords)', () => {
        const enriched = enrichPoisWithDistance(mockPois, mapWidthMeters);
        const safeway = enriched.find((p) => p.name === 'Safeway')!;
        const starbucks = enriched.find((p) => p.name === 'Starbucks')!;

        // Safeway centre: (500, 350) → ~150 px from centre
        // Starbucks centre: (350, 220) → ~√(150²+280²) ≈ 317 px
        expect(safeway.pixelDistance).toBeLessThan(starbucks.pixelDistance);
        expect(safeway.distanceMeters).toBeLessThan(starbucks.distanceMeters);
    });

    it('should produce distances in sensible range for zoom 15 map', () => {
        const enriched = enrichPoisWithDistance(mockPois, mapWidthMeters);

        enriched.forEach((poi) => {
            // At zoom 15, map is ~3,800 m wide.
            // Max possible normalised distance from centre to corner = √(500²+500²) ≈ 707 units
            // → 707/1000 * 3800 ≈ 2,687 m → ~1.7 miles
            expect(poi.distanceMeters).toBeLessThan(3000);
            expect(poi.distanceMiles).toBeLessThan(2);
        });
    });

    it('should preserve original POI fields', () => {
        const enriched = enrichPoisWithDistance(mockPois, mapWidthMeters);
        const safeway = enriched.find((p) => p.name === 'Safeway')!;

        expect(safeway.category).toBe('shopping');
        expect(safeway.highlights).toBe('Major grocery store');
        expect(safeway.bounding_box).toEqual({
            ymin: 340, xmin: 460, ymax: 360, xmax: 540,
        });
    });

    it('should handle custom property center', () => {
        // If Gemini reports the property centre is not at [500, 500]
        const enriched = enrichPoisWithDistance(mockPois, mapWidthMeters, 480, 520);
        const safeway = enriched.find((p) => p.name === 'Safeway')!;

        // Safeway centre: (500, 350), property at (480, 520)
        // distance = √((500-480)² + (350-520)²) = √(400 + 28900) ≈ 171
        expect(safeway.pixelDistance).toBeCloseTo(171, -1);
    });

    it('should produce round meter values and 2-decimal mile values', () => {
        const enriched = enrichPoisWithDistance(mockPois, mapWidthMeters);

        enriched.forEach((poi) => {
            expect(Number.isInteger(poi.distanceMeters)).toBe(true);
            expect(poi.distanceMiles.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
        });
    });
});
