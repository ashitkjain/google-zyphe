'use strict';

/**
 * Bay Area County ArcGIS Parcel API Configuration (JS Port)
 */

const COUNTY_BOUNDS = [
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
];

function getCountyParcelConfig(lat, lon) {
    for (const entry of COUNTY_BOUNDS) {
        const [minLon, minLat, maxLon, maxLat] = entry.bounds;
        if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
            return entry.config;
        }
    }
    return null;
}

function toSqft(value, unit, latDeg) {
    if (unit === 'sqm') {
        let sqft = value * 10.7639;
        if (latDeg != null) {
            const latRad = latDeg * Math.PI / 180;
            sqft *= Math.cos(latRad) * Math.cos(latRad);
        }
        return Math.round(sqft);
    }
    if (unit === 'acres') return Math.round(value * 43560);
    return Math.round(value);
}

async function fetchParcelFromCounty(lat, lon, timeoutMs = 6000) {
    const config = getCountyParcelConfig(lat, lon);
    if (!config) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `${config.url}?geometry=${lon},${lat}` +
            `&geometryType=esriGeometryPoint` +
            `&spatialRel=esriSpatialRelIntersects` +
            `&outFields=${config.outFields}` +
            `&returnGeometry=true` +
            `&f=json` +
            `&inSR=4326` +
            `&outSR=4326`;
            
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data.features || !data.features.length) return null;

        const feature = data.features[0];
        const ring = feature.geometry && feature.geometry.rings ? feature.geometry.rings[0] : null;
        if (!ring || !ring.length) return null;

        const attrs = feature.attributes || {};
        const rawArea = attrs[config.areaField] || 0;
        const areaSqft = toSqft(rawArea, config.areaUnit, lat);
        const apn = attrs[config.apnField] || '';
        const buildingSqft = config.buildingSqftField
            ? (attrs[config.buildingSqftField] ? Number(attrs[config.buildingSqftField]) : undefined)
            : undefined;

        return { 
            polygon: ring.map(([lon, lat]) => ({ lon, lat })), 
            apn, 
            areaSqft, 
            county: config.county, 
            buildingSqft 
        };
    } catch (e) {
        clearTimeout(timeout);
        console.warn(`[ArcGIS/${config.county}] Fetch failed:`, e.message);
        return null;
    }
}

module.exports = {
    fetchParcelFromCounty
};
