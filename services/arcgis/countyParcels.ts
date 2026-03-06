/**
 * Bay Area County ArcGIS Parcel API Configuration
 *
 * Each county exposes parcel boundary data through different ArcGIS endpoints
 * with different field names and area units. This config normalizes them.
 *
 * Coverage (verified working):
 *   - Alameda County: FeatureServer (free, no auth)
 *   - Santa Clara County: MapServer (free, no auth)
 *   - Contra Costa County: MapServer (free, no auth)
 *   - San Mateo County: ArcGIS Hub (needs different query approach) [TODO]
 *   - San Francisco: Socrata API (needs different query approach) [TODO]
 *
 * Usage:
 *   const config = getCountyParcelConfig(lat, lon);
 *   if (config) { // query ArcGIS }
 */

export interface CountyParcelConfig {
    county: string;
    url: string;
    apnField: string;           // Field name for Assessor Parcel Number
    areaField: string;          // Field name for area
    areaUnit: 'sqm' | 'acres';  // Area unit returned by the API
    outFields: string;          // Comma-separated fields to request
    addressField?: string;      // Optional situs address field
    buildingSqftField?: string; // Optional field for building/living area sqft
}

/**
 * Bounding boxes for Bay Area counties (approximate, in WGS84)
 * Format: [minLon, minLat, maxLon, maxLat]
 */
const COUNTY_BOUNDS: Array<{
    county: string;
    bounds: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
    config: CountyParcelConfig;
}> = [
        {
            county: 'Alameda',
            bounds: [-122.37, 37.45, -121.47, 37.91],
            config: {
                county: 'Alameda',
                url: 'https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer/0/query',
                apnField: 'APN',
                areaField: 'Shape__Area',
                areaUnit: 'sqm',
                outFields: 'APN,SitusAddress,Shape__Area',
                addressField: 'SitusAddress',
            },
        },
        {
            county: 'Santa Clara',
            bounds: [-122.20, 36.89, -121.21, 37.48],
            config: {
                county: 'Santa Clara',
                url: 'https://mapservices.sccgov.org/arcgis/rest/services/property/SCCProperty/MapServer/0/query',
                apnField: 'APN',
                areaField: 'Shape_Area',
                areaUnit: 'sqm',
                outFields: 'APN,SITUS_STREET_NAME,SITUS_HOUSE_NUMBER,SITUS_CITY_NAME,Shape_Area',
                addressField: 'SITUS_STREET_NAME',
            },
        },
        {
            county: 'Contra Costa',
            bounds: [-122.44, 37.73, -121.56, 38.08],
            config: {
                county: 'Contra Costa',
                url: 'https://gis.cccounty.us/arcgis/rest/services/CCMAP/Assessment_Parcels_ArcPro/MapServer/0/query',
                apnField: 'APN',
                areaField: 'ACREAGE',
                areaUnit: 'acres',
                outFields: 'APN,full_address_display,ACREAGE,BLDG_SQFT',
                addressField: 'full_address_display',
                buildingSqftField: 'BLDG_SQFT',
            },
        },
        // San Mateo and San Francisco use non-standard APIs (Socrata/Hub).
        // They'll be added when their query formats are implemented.
        // San Mateo portal: https://data-smcmaps.opendata.arcgis.com/
        // San Francisco portal: https://data.sfgov.org/
    ];

/**
 * Given a lat/lon, returns the ArcGIS parcel config for the matching county.
 * Returns null if the property is outside supported Bay Area counties.
 */
export function getCountyParcelConfig(lat: number, lon: number): CountyParcelConfig | null {
    for (const entry of COUNTY_BOUNDS) {
        const [minLon, minLat, maxLon, maxLat] = entry.bounds;
        if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
            return entry.config;
        }
    }
    return null;
}

/**
 * Converts the area value from the county's native unit to square feet.
 *
 * IMPORTANT: When areaUnit is 'sqm' and the source SRS is Web Mercator (3857 / 102100),
 * the Shape__Area / Shape_Area values are inflated by the Mercator distortion factor.
 * At Bay Area latitudes (~37.5°N) this is ~59% larger than geodetic area.
 * We apply cos²(lat) correction to get true geodetic square feet.
 */
export function toSqft(value: number, unit: 'sqm' | 'acres', latDeg?: number): number {
    if (unit === 'sqm') {
        let sqft = value * 10.7639;
        // Apply Web Mercator area correction: true_area = mercator_area × cos²(lat)
        if (latDeg != null) {
            const latRad = latDeg * Math.PI / 180;
            sqft *= Math.cos(latRad) * Math.cos(latRad);
        }
        return Math.round(sqft);
    }
    if (unit === 'acres') return Math.round(value * 43560);
    return Math.round(value);
}

/**
 * Fetches parcel polygon from the appropriate county ArcGIS endpoint.
 * Returns null if the county is not supported or the API fails.
 */
export async function fetchParcelFromCounty(
    lat: number,
    lon: number,
    timeoutMs: number = 6000
): Promise<{
    polygon: [number, number][];
    apn: string;
    areaSqft: number;
    county: string;
    buildingSqft?: number;
} | null> {
    const config = getCountyParcelConfig(lat, lon);
    if (!config) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const resp = await fetch(
            `${config.url}?geometry=${lon},${lat}` +
            `&geometryType=esriGeometryPoint` +
            `&spatialRel=esriSpatialRelIntersects` +
            `&outFields=${config.outFields}` +
            `&returnGeometry=true` +
            `&f=json` +
            `&inSR=4326` +
            `&outSR=4326`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        const data = await resp.json();
        if (!data.features?.length) return null;

        const feature = data.features[0];
        const ring = feature.geometry?.rings?.[0];
        if (!ring?.length) return null;

        const attrs = feature.attributes || {};
        const rawArea = attrs[config.areaField] || 0;
        // Pass lat for Web Mercator cos²(lat) correction on sqm-based fields
        const areaSqft = toSqft(rawArea, config.areaUnit, lat);
        const apn = attrs[config.apnField] || '';
        const buildingSqft = config.buildingSqftField
            ? (attrs[config.buildingSqftField] ? Number(attrs[config.buildingSqftField]) : undefined)
            : undefined;

        return { polygon: ring, apn, areaSqft, county: config.county, buildingSqft };
    } catch (e: any) {
        clearTimeout(timeout);
        console.warn(`[ArcGIS/${config.county}] Fetch failed:`, e.message);
        return null;
    }
}

// ─── Firestore Polygon Serialization ──────────────────────────────────────────
// Firestore does NOT support nested arrays like [[lon, lat], ...].
// We store as [{lon, lat}, ...] and convert back on read.

/** Convert [[lon, lat], ...] → [{lon, lat}, ...] for Firestore storage */
export function polygonToFirestore(ring: [number, number][]): { lon: number; lat: number }[] {
    return ring.map(([lon, lat]) => ({ lon, lat }));
}

/** Convert [{lon, lat}, ...] OR [[lon, lat], ...] back to [[lon, lat], ...] for code use */
export function firestoreToPolygon(stored: any[]): [number, number][] {
    if (!stored?.length) return [];
    // Handle both formats: [{lon, lat}] (new) and [[lon, lat]] (legacy)
    if (Array.isArray(stored[0])) return stored as [number, number][];
    return stored.map((pt: any) => [pt.lon, pt.lat] as [number, number]);
}
