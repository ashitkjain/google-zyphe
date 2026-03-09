/**
 * Smoke Test Service
 *
 * Runs a set of data-completeness checks on all cached properties for a city.
 * Each check has a severity: 'error' | 'warn'. Errors are blocking gaps; warnings
 * are missing-but-optional fields.
 *
 * Collections read:
 *   properties               — core listing + env data
 *   property_assets          — Firebase Storage URLs (images, maps, street view)
 *   property_analyses_visual — Gemini visual/neighborhood/orientation AI
 *
 * Usage: called from CityDataTab smoke test panel.
 */

import {
    doc, getDoc, getDocs, query, collection, where, documentId
} from 'firebase/firestore';
import { db } from './firebase/config';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckSeverity = 'error' | 'warn';

export interface SmokeCheck {
    id: string;
    label: string;
    severity: CheckSeverity;
    passed: boolean;
    detail?: string;  // e.g. "3 images found" or "missing"
}

export interface PropertySmokeResult {
    zpid: string;
    address: string;
    city?: string;
    passed: boolean;   // true = zero errors (warnings OK)
    errorCount: number;
    warnCount: number;
    checks: SmokeCheck[];
}

export interface CitySmokeSummary {
    totalProperties: number;
    passedCount: number;
    failedCount: number;
    results: PropertySmokeResult[];
    ranAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chk(
    checks: SmokeCheck[],
    id: string,
    label: string,
    severity: CheckSeverity,
    passed: boolean,
    detail?: string
) {
    checks.push({ id, label, severity, passed, detail });
}

const isFirebaseStorageUrl = (url?: string | null) =>
    !!url && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com'));

// ─── Per-property checker ─────────────────────────────────────────────────────

function runChecks(
    zpid: string,
    prop: any,
    assets: any | null,
    visual: any | null,
    env: any | null
): PropertySmokeResult {
    const checks: SmokeCheck[] = [];

    // ── 1. Core listing data ─────────────────────────────────────────────────
    chk(checks, 'bedrooms', 'Bedrooms', 'error', prop?.bedrooms != null && prop.bedrooms > 0,
        prop?.bedrooms != null ? `${prop.bedrooms} bd` : 'missing');
    chk(checks, 'bathrooms', 'Bathrooms', 'error', prop?.bathrooms != null && prop.bathrooms > 0,
        prop?.bathrooms != null ? `${prop.bathrooms} ba` : 'missing');
    chk(checks, 'livingArea', 'Living Area (sqft)', 'error', prop?.livingAreaValue != null && prop.livingAreaValue > 0,
        prop?.livingAreaValue ? `${prop.livingAreaValue.toLocaleString()} sf` : 'missing');
    chk(checks, 'lotSize', 'Lot Size', 'warn', !!(prop?.lotSize || prop?.lotAreaValue),
        prop?.lotSize || prop?.lotAreaValue ? String(prop.lotSize || prop.lotAreaValue) : 'missing');
    chk(checks, 'price', 'Listing Price', 'error', prop?.price != null && prop.price > 0,
        prop?.price ? `$${prop.price.toLocaleString()}` : 'missing');
    chk(checks, 'description', 'Description', 'error', !!(prop?.description && prop.description.length > 50),
        prop?.description ? `${prop.description.length} chars` : 'missing/too short');
    chk(checks, 'yearBuilt', 'Year Built', 'warn', prop?.yearBuilt != null && prop.yearBuilt > 1800,
        prop?.yearBuilt ? String(prop.yearBuilt) : 'missing');
    chk(checks, 'homeType', 'Home Type', 'warn', !!prop?.homeType,
        prop?.homeType || 'missing');
    chk(checks, 'coordinates', 'Coordinates', 'error', !!(prop?.coordinates?.latitude && prop.coordinates?.longitude),
        prop?.coordinates ? `${prop.coordinates.latitude.toFixed(4)}, ${prop.coordinates.longitude.toFixed(4)}` : 'missing');

    // ── 2. Walk/Transit/Bike scores ──────────────────────────────────────────
    chk(checks, 'walkScore', 'Walk Score', 'warn', prop?.walkScore != null,
        prop?.walkScore != null ? String(prop.walkScore) : 'missing');
    chk(checks, 'transitScore', 'Transit Score', 'warn', prop?.transitScore != null,
        prop?.transitScore != null ? String(prop.transitScore) : 'missing');
    chk(checks, 'bikeScore', 'Bike Score', 'warn', prop?.bikeScore != null,
        prop?.bikeScore != null ? String(prop.bikeScore) : 'missing');

    // ── 3. Images ────────────────────────────────────────────────────────────
    const imgCount = (prop?.images?.length || assets?.images?.length || 0);
    chk(checks, 'images', 'Property Images', 'error', imgCount >= 3,
        imgCount > 0 ? `${imgCount} images` : 'none downloaded');

    // ── 4. Firebase Storage assets ───────────────────────────────────────────
    chk(checks, 'mapZoomIn', 'Map Zoom-In (Storage)', 'error', isFirebaseStorageUrl(assets?.mapZoomIn || prop?.mapZoomIn),
        isFirebaseStorageUrl(assets?.mapZoomIn || prop?.mapZoomIn) ? 'present' : 'missing/not in Storage');
    chk(checks, 'mapZoomOut', 'Map Zoom-Out (Storage)', 'error', isFirebaseStorageUrl(assets?.mapZoomOut || prop?.mapZoomOut),
        isFirebaseStorageUrl(assets?.mapZoomOut || prop?.mapZoomOut) ? 'present' : 'missing/not in Storage');
    chk(checks, 'streetView', 'Street View (Storage)', 'warn', isFirebaseStorageUrl(assets?.streetView || prop?.streetView),
        isFirebaseStorageUrl(assets?.streetView || prop?.streetView) ? 'present' : 'missing');
    chk(checks, 'satellite', 'Satellite Image (Storage)', 'warn', isFirebaseStorageUrl(assets?.satelliteImageUrl || prop?.satelliteImageUrl),
        isFirebaseStorageUrl(assets?.satelliteImageUrl || prop?.satelliteImageUrl) ? 'present' : 'missing');

    // ── 5. Parcel / APN data ─────────────────────────────────────────────────
    const hasPolygon = Array.isArray(prop?.parcelPolygon) && prop.parcelPolygon.length > 3;
    chk(checks, 'parcelPolygon', 'Parcel Polygon', 'warn', hasPolygon,
        hasPolygon ? `${prop.parcelPolygon.length} vertices` : 'missing');
    chk(checks, 'parcelApn', 'APN', 'warn', !!prop?.parcelApn,
        prop?.parcelApn || 'missing');
    chk(checks, 'parcelArea', 'Parcel Area (sqft)', 'warn', prop?.parcelAreaSqft != null && prop.parcelAreaSqft > 0,
        prop?.parcelAreaSqft ? `${prop.parcelAreaSqft.toLocaleString()} sf` : 'missing');
    chk(checks, 'taxSqft', 'Tax Record Sqft', 'warn', prop?.taxSqft != null && prop.taxSqft > 0,
        prop?.taxSqft ? `${prop.taxSqft.toLocaleString()} sf (${prop.taxSqftSource || 'unknown source'})` : 'missing');

    // ── 6. Google Environmental APIs ─────────────────────────────────────────
    // These now primarily live in google_environmental_data
    const solar = env?.solarData || prop?.solarData;
    const aqi = env?.airQuality || prop?.airQuality;
    const pollen = env?.pollen || prop?.pollen;
    const noise = env?.noiseScore ?? prop?.noiseScore;
    const places = env?.neighborhoodPlaces || prop?.neighborhoodPlaces;

    chk(checks, 'solarData', 'Solar API', 'warn', !!(solar?.maxSunshineHoursPerYear),
        solar ? `${solar.maxSunshineHoursPerYear || '?'} hrs/yr sunshine` : 'not fetched');
    chk(checks, 'airQuality', 'Air Quality API', 'warn', !!(aqi?.aqi != null),
        aqi ? `AQI ${aqi.aqi} (${aqi.category})` : 'not fetched');
    chk(checks, 'pollen', 'Pollen API', 'warn', !!(pollen?.grass || pollen?.score != null),
        pollen ? `Fetched (${pollen.category || 'present'})` : 'not fetched');
    chk(checks, 'noiseScore', 'Noise Score API', 'warn', noise != null,
        noise != null ? `${noise} (${env?.noiseScoreDesc || prop?.noiseScoreDesc || '?'})` : 'not fetched');
    chk(checks, 'neighborhoodPlaces', 'Nearby Places (POI)', 'warn', !!places,
        places ? 'cached' : 'not fetched');

    // ── 7. AI Analysis ───────────────────────────────────────────────────────
    // Visual AI (interior / exterior)
    const hasVisualInterior = !!(visual?.home_interior?.overall_description && visual.home_interior.overall_description.length > 30);
    const hasVisualExterior = !!(visual?.exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style);
    chk(checks, 'aiVisualInterior', 'AI Visual — Interior', 'error', hasVisualInterior,
        hasVisualInterior ? 'analysis present' : 'missing (needs Full Intel)');
    chk(checks, 'aiVisualExterior', 'AI Visual — Exterior', 'error', hasVisualExterior,
        hasVisualExterior ? 'analysis present' : 'missing');

    // Neighborhood spatial analysis
    const hasNeighborhood = !!(visual?.neighborhood?.overview && visual.neighborhood.overview.length > 30);
    chk(checks, 'aiNeighborhood', 'AI Neighborhood/Spatial', 'error', hasNeighborhood,
        hasNeighborhood ? 'analysis present' : 'missing');

    // Orientation AI
    const hasOrientation = !!(prop?.orientation_ai?.final_orientation);
    chk(checks, 'orientationAi', 'Orientation AI', 'warn', hasOrientation,
        hasOrientation ? prop.orientation_ai.final_orientation : 'missing');

    // Street view AI
    const hasStreetViewAi = !!(prop?.streetViewAnalysis?.overall_assessment);
    chk(checks, 'streetViewAi', 'Street View AI', 'warn', hasStreetViewAi,
        hasStreetViewAi ? 'analysis present' : 'missing');

    // Pollen AI analysis
    const hasPollenAi = !!(prop?.pollen?.analysis?.summary);
    chk(checks, 'pollenAi', 'Pollen AI Analysis', 'warn', hasPollenAi,
        hasPollenAi ? 'analysis present' : 'missing');

    // Custom visual analysis (optional — may not be run for all properties)
    const hasCustomAnalysis = !!(prop?.visual_analysis?.executiveSummary || prop?.analysis?.executiveSummary);
    chk(checks, 'customAnalysis', 'Custom AI Analysis', 'warn', hasCustomAnalysis,
        hasCustomAnalysis ? 'present' : 'not run yet');

    // ── 8. Data sanity checks ────────────────────────────────────────────────
    // Listing sqft vs tax record sqft anomaly (>20% discrepancy = red flag)
    if (prop?.livingAreaValue && prop?.taxSqft) {
        const diff = Math.abs(prop.livingAreaValue - prop.taxSqft) / prop.taxSqft;
        chk(checks, 'sqftSanity', 'Sqft Discrepancy (>20%)', 'warn', diff <= 0.20,
            `${Math.round(diff * 100)}% diff — listing ${prop.livingAreaValue.toLocaleString()} vs tax ${prop.taxSqft.toLocaleString()}`);
    }
    // Price per sqft sanity ($100–$5000/sf)
    if (prop?.price && prop?.livingAreaValue && prop.livingAreaValue > 0) {
        const ppsf = prop.price / prop.livingAreaValue;
        chk(checks, 'ppsfSanity', 'Price/Sqft Sanity', 'warn', ppsf >= 100 && ppsf <= 5000,
            `$${Math.round(ppsf)}/sf`);
    }
    // Image count sanity
    if (imgCount > 0 && imgCount < 3) {
        chk(checks, 'imageCountSanity', 'Image Count (<3)', 'warn', false, `only ${imgCount} image(s) — may be incomplete`);
    }

    const errorCount = checks.filter(c => c.severity === 'error' && !c.passed).length;
    const warnCount = checks.filter(c => c.severity === 'warn' && !c.passed).length;

    return {
        zpid,
        address: prop?.address || zpid,
        city: prop?.city,
        passed: errorCount === 0,
        errorCount,
        warnCount,
        checks,
    };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Fetches all property, asset, and visual-analysis documents for the given
 * list of ZPIDs (already loaded from the listing feed) and runs smoke checks.
 */
export const runCitySmokeTest = async (
    zpids: string[],
    onProgress?: (done: number, total: number) => void
): Promise<CitySmokeSummary> => {
    if (!db) throw new Error('Firestore not initialized');
    if (zpids.length === 0) return { totalProperties: 0, passedCount: 0, failedCount: 0, results: [], ranAt: new Date() };

    const CHUNK = 10; // Firestore `in` query limit
    const allProps: Record<string, any> = {};
    const allAssets: Record<string, any> = {};
    const allVisual: Record<string, any> = {};
    const allEnv: Record<string, any> = {};

    // Batch-fetch all three collections in parallel chunks
    const chunks: string[][] = [];
    for (let i = 0; i < zpids.length; i += CHUNK) chunks.push(zpids.slice(i, i + CHUNK));

    let done = 0;
    await Promise.all(chunks.map(async (chunk) => {
        const [propSnap, assetSnap, visualSnap, envSnap] = await Promise.all([
            getDocs(query(collection(db!, 'properties'), where(documentId(), 'in', chunk))),
            getDocs(query(collection(db!, 'property_assets'), where(documentId(), 'in', chunk))),
            getDocs(query(collection(db!, 'property_analyses_visual'), where(documentId(), 'in', chunk))),
            getDocs(query(collection(db!, 'google_environmental_data'), where(documentId(), 'in', chunk))),
        ]);
        propSnap.forEach(d => { allProps[d.id] = d.data(); });
        assetSnap.forEach(d => { allAssets[d.id] = d.data(); });
        visualSnap.forEach(d => { allVisual[d.id] = d.data(); });
        envSnap.forEach(d => { allEnv[d.id] = d.data(); });
        done += chunk.length;
        onProgress?.(done, zpids.length);
    }));

    const results = zpids.map(zpid =>
        runChecks(zpid, allProps[zpid] || null, allAssets[zpid] || null, allVisual[zpid] || null, allEnv[zpid] || null)
    );

    const passedCount = results.filter(r => r.passed).length;

    return {
        totalProperties: zpids.length,
        passedCount,
        failedCount: zpids.length - passedCount,
        results,
        ranAt: new Date(),
    };
};
