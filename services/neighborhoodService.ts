/**
 * Neighborhood Matching Service
 *
 * Maps property addresses to neighborhoods using:
 * 1. Street-name lookup built from Alameda County Assessor parcels
 *    matched against NCES SABS 2015-16 PUSD attendance zone polygons
 * 2. PUSD attendance zone polygon match (coordinate fallback)
 * 3. City of Pleasanton Specific Plan polygon match (coordinate fallback)
 *
 * Data sources:
 *   - NCES School Attendance Boundary Survey (SABS) 2015-2016
 *   - Alameda County Assessor Parcels (data.acgov.org)
 *   - City of Pleasanton GIS - Specific Plan Boundaries
 */

import neighborhoodData from '../data/neighborhoods.json';
import streetData from '../data/street-neighborhoods.json';

// ── Types ──────────────────────────────────────────────────────────────────

interface GeoJSONPolygon {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
}

interface GeoJSONFeature {
    type: 'Feature';
    properties: { name: string; source?: string };
    geometry: GeoJSONPolygon;
}

interface NeighborhoodDataFile {
    polygons: {
        pusd: { type: string; features: GeoJSONFeature[] };
        city: { type: string; features: GeoJSONFeature[] };
    };
    attribution: Record<string, string>;
    cities: string[];
}

interface StreetDataFile {
    city: string;
    source: string;
    mapping: Record<string, string>;
}

const data = neighborhoodData as unknown as NeighborhoodDataFile;
const streets = streetData as unknown as StreetDataFile;

// ── Street name normalization ──────────────────────────────────────────────

function extractStreetName(address: string): string {
    if (!address) return '';
    let s = address.split(',')[0].trim();
    s = s.replace(/^\d+\s+/, '');
    return s.toUpperCase().trim();
}

// ── Geo helpers ────────────────────────────────────────────────────────────

function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        if (((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

function pointInGeometry(lat: number, lng: number, geometry: GeoJSONPolygon): boolean {
    if (geometry.type === 'Polygon') {
        const rings = geometry.coordinates as number[][][];
        if (!pointInPolygon(lat, lng, rings[0])) return false;
        for (let i = 1; i < rings.length; i++) {
            if (pointInPolygon(lat, lng, rings[i])) return false;
        }
        return true;
    } else if (geometry.type === 'MultiPolygon') {
        const polys = geometry.coordinates as number[][][][];
        for (const poly of polys) {
            if (pointInPolygon(lat, lng, poly[0])) {
                let inHole = false;
                for (let i = 1; i < poly.length; i++) {
                    if (pointInPolygon(lat, lng, poly[i])) { inHole = true; break; }
                }
                if (!inHole) return true;
            }
        }
        return false;
    }
    return false;
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface NeighborhoodMatch {
    name: string;
    source: 'county_parcel' | 'pusd_boundary' | 'city_specific_plan';
    confidence: 'high' | 'medium';
}

/**
 * Find the neighborhood for a property.
 *
 * Priority:
 *   1) Street-name lookup from county parcel data (high confidence)
 *   2) PUSD attendance zone polygon match via coordinates (medium confidence)
 *   3) City Specific Plan polygon match via coordinates (medium confidence)
 */
export function getNeighborhood(
    lat: number,
    lng: number,
    address?: string,
): NeighborhoodMatch | null {
    // 1. Street-name lookup — built from county assessor parcels
    if (address) {
        const streetName = extractStreetName(address);
        const hood = streets.mapping[streetName];
        if (hood) {
            return { name: hood, source: 'county_parcel', confidence: 'high' };
        }
    }

    if (!lat || !lng) return null;

    // 2. PUSD attendance zone polygons
    for (const feature of data.polygons.pusd.features) {
        if (pointInGeometry(lat, lng, feature.geometry)) {
            return {
                name: feature.properties.name,
                source: 'pusd_boundary',
                confidence: 'medium',
            };
        }
    }

    // 3. City Specific Plan polygons
    for (const feature of data.polygons.city.features) {
        if (pointInGeometry(lat, lng, feature.geometry)) {
            return {
                name: feature.properties.name,
                source: 'city_specific_plan',
                confidence: 'medium',
            };
        }
    }

    return null;
}

/**
 * City Plan data combining multiple layers from the City of Pleasanton ArcGIS server.
 */
export interface CityPlanData {
    lmd_name: string | null;              // Landscape Maintenance District (e.g., "Bonde Ranch")
    specific_plan: string | null;         // Specific Plan area (e.g., "Hacienda")
    land_use_designation: string | null;  // General Plan designation (e.g., "Medium Density")
    land_use_category: string | null;     // Broad category (e.g., "Residential")
}

/** Helper: query a City of Pleasanton ArcGIS layer by point */
async function queryPleasantonLayer(
    layerUrl: string, lat: number, lng: number, outFields: string
): Promise<Record<string, any> | null> {
    try {
        const url = `${layerUrl}/query?geometry=${lng},${lat}` +
            `&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects` +
            `&inSR=4326&outFields=${outFields}&f=json&returnGeometry=false`;
        const res = await fetch(url);
        const data = await res.json();
        return data?.features?.[0]?.attributes || null;
    } catch {
        return null;
    }
}

/**
 * Fetch city plan data from multiple City of Pleasanton ArcGIS layers in parallel.
 */
export async function fetchCityPlanData(
    lat: number,
    lng: number,
): Promise<CityPlanData | null> {
    if (!lat || !lng) return null;

    const CITY_BASE = 'https://maps.cityofpleasantonca.gov/server/rest/services/Hosted';
    const LAND_USE_BASE = 'https://services1.arcgis.com/vQBE9cyhukJHVTrT/arcgis/rest/services';

    // Query 3 layers in parallel
    const [lmd, specificPlan, landUse] = await Promise.allSettled([
        // 1. Landscape Maintenance Districts (5 named communities)
        queryPleasantonLayer(
            `${CITY_BASE}/LandscapeMaintenanceDistrictNoticingArea_Public/FeatureServer/0`,
            lat, lng, 'districtname'
        ),
        // 2. Specific Plan Areas (11 designated development areas)
        queryPleasantonLayer(
            `${CITY_BASE}/SpecificPlanAreas_Public/FeatureServer/0`,
            lat, lng, 'boundary'
        ),
        // 3. General Plan Land Use 2005-2025 (full city coverage)
        queryPleasantonLayer(
            `${LAND_USE_BASE}/GeneralPlanLandUse20052025_vwPublic/FeatureServer/0`,
            lat, lng, 'landusedesignation,landusecategory'
        ),
    ]);

    const lmdAttrs = lmd.status === 'fulfilled' ? lmd.value : null;
    const spAttrs = specificPlan.status === 'fulfilled' ? specificPlan.value : null;
    const luAttrs = landUse.status === 'fulfilled' ? landUse.value : null;

    // Format camelCase to readable: "MediumDensity" -> "Medium Density"
    const formatCamel = (s: string | null | undefined) =>
        s ? s.replace(/([A-Z])/g, ' $1').trim() : null;

    // Clean up specific plan name: "Happy Valley Specific Plan Area Boundary" -> "Happy Valley"
    const cleanSpName = (s: string | null | undefined) =>
        s ? s.replace(/ Specific Plan Area Boundary$/i, '').trim() : null;

    // Format LMD name: "BondeRanch" -> "Bonde Ranch"
    const lmdName = lmdAttrs?.districtname ? formatCamel(lmdAttrs.districtname) : null;

    const result: CityPlanData = {
        lmd_name: lmdName,
        specific_plan: cleanSpName(spAttrs?.boundary),
        land_use_designation: formatCamel(luAttrs?.landusedesignation),
        land_use_category: formatCamel(luAttrs?.landusecategory),
    };

    // Return null only if absolutely nothing matched
    if (!result.lmd_name && !result.specific_plan && !result.land_use_designation) {
        return null;
    }

    return result;
}

/**
 * Directly query Alameda County Assessor Parcels via ArcGIS spatial query.
 * Returns raw parcel data — NOT mapped through school zones.
 */
export interface CountyParcelData {
    apn: string;
    situs_street: string;
    situs_city: string;
    land_value: number | null;
    improvement_value: number | null;
    use_code: string;
    latest_doc_date: string;
}

export async function fetchCountyParcelData(
    lat: number,
    lng: number,
): Promise<CountyParcelData | null> {
    if (!lat || !lng) return null;
    try {
        const url = `https://services5.arcgis.com/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer/0/query?` +
            `geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects` +
            `&inSR=4326&outFields=APN,SitusStreetName,SitusStreetNumber,SitusCity,Land,Imps,UseCode,LatestDocumentDate&f=json&returnGeometry=false`;
        const res = await fetch(url);
        const data = await res.json();
        const feat = data?.features?.[0]?.attributes;
        if (!feat) return null;
        return {
            apn: feat.APN || '',
            situs_street: `${feat.SitusStreetNumber || ''} ${feat.SitusStreetName || ''}`.trim(),
            situs_city: feat.SitusCity || '',
            land_value: feat.Land || null,
            improvement_value: feat.Imps || null,
            use_code: feat.UseCode || '',
            latest_doc_date: feat.LatestDocumentDate || ''
        };
    } catch {
        return null;
    }
}

/**
 * Get all available neighborhood names (for filtering UI)
 */
export function getAllNeighborhoodNames(): string[] {
    const names = new Set<string>();
    for (const hood of Object.values(streets.mapping)) {
        names.add(hood);
    }
    return Array.from(names).sort();
}
