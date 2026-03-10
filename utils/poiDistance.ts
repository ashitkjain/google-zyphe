/**
 * POI Distance Calculator
 *
 * Converts Gemini's normalized bounding-box coordinates (0–1000 scale) into
 * real-world distance in meters from the subject property.
 *
 * How it works:
 * 1. Gemini returns each POI's bounding box as [ymin, xmin, ymax, xmax] on a 0–1000 grid.
 * 2. The property is at the map centre, approximately [500, 500].
 * 3. We compute the pixel distance (Pythagorean) from map centre to the POI centre.
 * 4. We convert pixel distance → meters using the known map width at the given zoom level.
 *
 * Radar Static Map dimensions at various zooms (Pleasanton, CA — ~37.66 °N):
 *   Zoom 13 → ~15,200 m wide (1024 px)
 *   Zoom 14 → ~ 7,600 m
 *   Zoom 15 → ~ 3,800 m  ← default for zoomOut
 *   Zoom 16 → ~ 1,900 m
 *   Zoom 20 → ~  119 m   ← zoomIn
 *
 * The formula for map width at a given zoom and latitude:
 *   widthMeters = (256 * 2^zoom) * (cos(lat) / 2^zoom) ... simplified:
 *   widthMeters = C * cos(lat) / 2^zoom * imageWidthPx / 256
 *   where C = 2 * π * R_earth ≈ 40,075,017 m
 *
 * For flexibility we let the caller specify mapWidthMeters directly (since it
 * depends on zoom + lat + image pixel width) OR compute it from zoom + lat.
 */

export interface BoundingBox {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
}

export interface PoiWithDistance {
    name: string;
    category: string;
    bounding_box: BoundingBox;
    highlights?: string;
    /** Centre of the POI in normalized coords */
    center: { x: number; y: number };
    /** Pixel distance from map centre (0–1000 scale) */
    pixelDistance: number;
    /** Real-world distance in meters */
    distanceMeters: number;
    /** Real-world distance in miles */
    distanceMiles: number;
}

const EARTH_CIRCUMFERENCE = 40_075_017; // meters

/**
 * Compute the real-world width (in meters) that a Radar static map covers.
 *
 * @param zoom        Radar map zoom level (e.g. 15)
 * @param latDegrees  Latitude of the map centre
 * @param imageWidth  Image width in CSS pixels (Radar `width` param, default 1024)
 * @param scale       Radar `scale` param (default 1)
 */
export function mapWidthInMeters(
    zoom: number,
    latDegrees: number,
    imageWidth: number = 1024,
    scale: number = 1,
): number {
    const latRad = (latDegrees * Math.PI) / 180;
    // Each tile is 256 px at scale=1. Ground resolution at this zoom:
    //   metersPerPixel = (C * cos(lat)) / (256 * 2^zoom * scale)
    const metersPerPixel =
        (EARTH_CIRCUMFERENCE * Math.cos(latRad)) / (256 * Math.pow(2, zoom) * scale);
    return metersPerPixel * imageWidth;
}

/**
 * Calculate pixel distance from centre [500, 500] to a POI bounding box centre.
 */
export function pixelDistanceFromCenter(
    box: BoundingBox,
    propertyCenterX: number = 500,
    propertyCenterY: number = 500,
): number {
    const poiX = (box.xmin + box.xmax) / 2;
    const poiY = (box.ymin + box.ymax) / 2;
    return Math.sqrt(
        Math.pow(poiX - propertyCenterX, 2) + Math.pow(poiY - propertyCenterY, 2),
    );
}

/**
 * Convert a pixel distance (on the 0–1000 normalised grid) to meters.
 *
 * @param pixelDist       Distance in normalised pixels (0–1000 scale)
 * @param mapTotalMeters  Real-world width the map covers (see mapWidthInMeters)
 * @param normalisedSize  The normalised grid size (default 1000)
 */
export function pixelDistToMeters(
    pixelDist: number,
    mapTotalMeters: number,
    normalisedSize: number = 1000,
): number {
    return (pixelDist / normalisedSize) * mapTotalMeters;
}

/**
 * Full pipeline: take raw Gemini POI output and enrich with distances.
 */
export function enrichPoisWithDistance(
    pois: Array<{
        name: string;
        category: string;
        bounding_box: BoundingBox;
        highlights?: string;
    }>,
    mapTotalMeters: number,
    propertyCenterX: number = 500,
    propertyCenterY: number = 500,
): PoiWithDistance[] {
    return pois.map((poi) => {
        const centerX = (poi.bounding_box.xmin + poi.bounding_box.xmax) / 2;
        const centerY = (poi.bounding_box.ymin + poi.bounding_box.ymax) / 2;
        const pixelDistance = pixelDistanceFromCenter(
            poi.bounding_box,
            propertyCenterX,
            propertyCenterY,
        );
        const distanceMeters = pixelDistToMeters(pixelDistance, mapTotalMeters);
        const distanceMiles = distanceMeters / 1609.34;

        return {
            ...poi,
            center: { x: centerX, y: centerY },
            pixelDistance,
            distanceMeters: Math.round(distanceMeters),
            distanceMiles: parseFloat(distanceMiles.toFixed(2)),
        };
    });
}
