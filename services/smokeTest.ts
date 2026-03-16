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
    env: any | null,
    comprehensive: any | null,
    investment: any | null,
    addressHint?: string
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
    const priceVal = prop?.listPrice ?? prop?.price ?? null;
    chk(checks, 'price', 'Listing Price', 'error', priceVal != null && priceVal > 0,
        priceVal ? `$${priceVal.toLocaleString()}` : 'missing');
    chk(checks, 'description', 'Description', 'error', !!(prop?.description && prop.description.length > 50),
        prop?.description ? `${prop.description.length} chars` : 'missing/too short');
    chk(checks, 'yearBuilt', 'Year Built', 'warn', prop?.yearBuilt != null && prop.yearBuilt > 1800,
        prop?.yearBuilt ? String(prop.yearBuilt) : 'missing');
    chk(checks, 'homeType', 'Home Type', 'warn', !!prop?.homeType,
        prop?.homeType || 'missing');
    chk(checks, 'coordinates', 'Coordinates', 'error', !!(prop?.coordinates?.latitude && prop.coordinates?.longitude),
        prop?.coordinates ? `${prop.coordinates.latitude.toFixed(4)}, ${prop.coordinates.longitude.toFixed(4)}` : 'missing');

    // ── 2. Walk/Transit/Bike scores ──────────────────────────────────────────
    const hasWalkScoreApi = prop?.walkScore != null || prop?.bikeScore != null;
    chk(checks, 'walkScore', 'Walk Score', 'warn', prop?.walkScore != null,
        prop?.walkScore != null ? String(prop.walkScore) : 'missing');
    // Transit score may legitimately be null for suburban areas with no transit service.
    // Only warn if the Walk Score API was never called at all.
    const transitAvailable = prop?.transitScore != null;
    chk(checks, 'transitScore', 'Transit Score', 'warn',
        transitAvailable || hasWalkScoreApi, // pass if score exists OR if API was called (area has no transit)
        transitAvailable ? String(prop.transitScore) : (hasWalkScoreApi ? 'not available for this area' : 'missing'));
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
    const svImgUrl = assets?.streetView || prop?.streetView || prop?.streetViewAnalysis?.imageUrl || env?.streetViewAnalysis?.imageUrl;
    chk(checks, 'streetView', 'Street View (Storage)', 'warn', isFirebaseStorageUrl(svImgUrl),
        isFirebaseStorageUrl(svImgUrl) ? 'present' : 'missing');
    const satUrl = assets?.satelliteImageUrl || assets?.satellite || prop?.satelliteImageUrl;
    chk(checks, 'satellite', 'Satellite Image (Storage)', 'warn', isFirebaseStorageUrl(satUrl),
        isFirebaseStorageUrl(satUrl) ? 'present' : (satUrl ? 'present (not in Storage)' : 'missing'));

    // ── 5. Parcel / APN data ─────────────────────────────────────────────────
    // Parcel data is fetched lazily by ParcelValidationCard on first Explore visit.
    // Also check the parcelValidation sub-object which caches validation results.
    const polygon = prop?.parcelPolygon || prop?.parcel_polygon || prop?.parcelValidation?.polygon;
    const hasPolygon = Array.isArray(polygon) && polygon.length > 3;
    chk(checks, 'parcelPolygon', 'Parcel Polygon', 'warn', hasPolygon,
        hasPolygon ? `${polygon.length} vertices` : 'not fetched');
    const apnVal = prop?.parcelApn || prop?.parcel_apn || prop?.apn || prop?.APN;
    chk(checks, 'parcelApn', 'APN', 'warn', !!apnVal,
        apnVal || 'not fetched');
    const parcelArea = prop?.parcelAreaSqft || prop?.parcel_area_sqft || prop?.parcelArea;
    chk(checks, 'parcelArea', 'Parcel Area (sqft)', 'warn', parcelArea != null && parcelArea > 0,
        parcelArea ? `${parcelArea.toLocaleString()} sf` : 'not fetched');
    chk(checks, 'taxSqft', 'Tax Record Sqft', 'warn', prop?.taxSqft != null && prop.taxSqft > 0,
        prop?.taxSqft ? `${prop.taxSqft.toLocaleString()} sf (${prop.taxSqftSource || 'unknown source'})` : 'not fetched');

    // ── 6. Google Environmental APIs ─────────────────────────────────────────
    // These now primarily live in google_environmental_data
    const solar = env?.solarData || prop?.solarData;
    const aqi = env?.airQuality || prop?.airQuality;
    const pollen = env?.pollen || prop?.pollen;
    const noise = env?.noiseScore ?? prop?.noiseScore;
    const places = env?.neighborhoodPlaces || prop?.neighborhoodPlaces;

    // Solar: check both maxSunshineHoursPerYear and solarPotential as indicators
    const hasSolar = !!(solar?.maxSunshineHoursPerYear || solar?.solarPotential || solar?.yearlyEnergyDcKwh);
    chk(checks, 'solarData', 'Solar API', 'warn', hasSolar,
        solar ? `${solar.maxSunshineHoursPerYear || solar.yearlyEnergyDcKwh || '?'} hrs/yr sunshine` : 'not fetched');
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

    // Orientation AI (may be on properties doc or env doc)
    const orientationAi = prop?.orientation_ai || env?.orientation_ai;
    const hasOrientation = !!(orientationAi?.final_orientation);
    chk(checks, 'orientationAi', 'Orientation AI', 'warn', hasOrientation,
        hasOrientation ? orientationAi.final_orientation : 'missing');

    // Street view AI (may be on properties doc or env doc)
    // UI checks: analysis.privacyRating || analysis.curbAppealScore || analysis.neighborhoodVibe
    const svAnalysis = prop?.streetViewAnalysis || env?.streetViewAnalysis;
    const hasStreetViewAi = !!(svAnalysis?.privacyRating || svAnalysis?.curbAppealScore || svAnalysis?.neighborhoodVibe);
    chk(checks, 'streetViewAi', 'Street View AI', 'warn', hasStreetViewAi,
        hasStreetViewAi ? `curb appeal: ${svAnalysis.curbAppealScore ?? '?'}/10` : 'missing');

    // Pollen AI analysis (pollen raw is in env, analysis may be nested)
    // UI checks: data.pollen.analysis?.breathe_easy_summary
    const pollenData = pollen || env?.pollen || prop?.pollen;
    const hasPollenAi = !!(pollenData?.analysis?.breathe_easy_summary);
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
    if (priceVal && prop?.livingAreaValue && prop.livingAreaValue > 0) {
        const ppsf = priceVal / prop.livingAreaValue;
        chk(checks, 'ppsfSanity', 'Price/Sqft Sanity', 'warn', ppsf >= 100 && ppsf <= 5000,
            `$${Math.round(ppsf)}/sf`);
    }
    // Image count sanity
    if (imgCount > 0 && imgCount < 3) {
        chk(checks, 'imageCountSanity', 'Image Count (<3)', 'warn', false, `only ${imgCount} image(s) — may be incomplete`);
    }

    // ── 9. Comprehensive Narrative (property_analyses_comprehensive) ──────────
    const hasSummary = !!(comprehensive?.summary && comprehensive.summary.length > 30);
    chk(checks, 'compSummary', 'Narrative Summary', 'error', hasSummary,
        hasSummary ? `${comprehensive.summary.length} chars` : 'missing');
    chk(checks, 'compRisks', 'Risks & Considerations', 'warn', !!(comprehensive?.risks_considerations),
        comprehensive?.risks_considerations ? 'present' : 'missing');

    // ── 10. Interior Summary (inside property_analyses_comprehensive) ─────────
    const intSum = comprehensive?.interior_summary;
    const hasIntSummary = !!(intSum?.interior_summary && intSum.interior_summary.length > 20);
    const hasRoomsSummary = !!(intSum?.rooms_summary && intSum.rooms_summary.length > 20);
    const hasVibe = !!(intSum?.vibe);
    const hasTags = Array.isArray(intSum?.objective_tags) && intSum.objective_tags.length > 0;
    chk(checks, 'intSummary', 'Interior Summary', 'error', hasIntSummary,
        hasIntSummary ? `${intSum.interior_summary.length} chars` : 'missing');
    chk(checks, 'intRooms', 'Rooms Summary', 'error', hasRoomsSummary,
        hasRoomsSummary ? `${intSum.rooms_summary.length} chars` : 'missing');
    chk(checks, 'intVibe', 'Interior Vibe', 'warn', hasVibe,
        hasVibe ? intSum.vibe : 'missing');
    chk(checks, 'intTags', 'Interior Tags', 'warn', hasTags,
        hasTags ? `${intSum.objective_tags.length} tags` : 'missing');

    // ── 11. Schools Summary (inside property_analyses_comprehensive) ──────────
    chk(checks, 'schoolsSummary', 'Schools Summary (Narrative)', 'warn', !!(comprehensive?.schools_summary),
        comprehensive?.schools_summary ? 'present' : 'missing');

    // Schools data on the property (from RapidAPI)
    const schoolCount = Array.isArray(prop?.schools) ? prop.schools.length : 0;
    chk(checks, 'nearbySchools', 'Nearby Schools Data', 'warn', schoolCount > 0,
        schoolCount > 0 ? `${schoolCount} schools` : 'no schools on property');

    // ── 12. Lifestyle Insights (inside property_analyses_comprehensive) ────────
    const life = comprehensive?.lifestyle_insights;
    const hasLifestyle = !!(life?.outdoor && life?.family);
    chk(checks, 'lifestyleInsights', 'Lifestyle Insights', 'warn', hasLifestyle,
        hasLifestyle ? 'present (outdoor, family, etc.)' : 'missing');

    // ── 13. Property Investment Research (property_investment_research) ───────
    const hasSTR = !!(investment?.str_performance?.adr);
    const hasLTR = !!(investment?.ltr_analysis?.monthly_rent);
    chk(checks, 'investmentSTR', 'STR Performance (ADR)', 'warn', hasSTR,
        hasSTR ? `ADR: ${investment.str_performance.adr}` : 'missing');
    chk(checks, 'investmentLTR', 'LTR Analysis (Rent)', 'warn', hasLTR,
        hasLTR ? `Rent: ${investment.ltr_analysis.monthly_rent}` : 'missing');

    // ── 16. Risk Scores (on properties doc) ──────────────────────────────────
    chk(checks, 'floodRisk', 'Flood Risk Score', 'warn', prop?.floodRiskScore != null,
        prop?.floodRiskScore != null ? String(prop.floodRiskScore) : 'missing');
    chk(checks, 'fireRisk', 'Fire Risk Score', 'warn', prop?.fireRiskScore != null,
        prop?.fireRiskScore != null ? String(prop.fireRiskScore) : 'missing');

    const errorCount = checks.filter(c => c.severity === 'error' && !c.passed).length;
    const warnCount = checks.filter(c => c.severity === 'warn' && !c.passed).length;

    // Build full address: prefer feed address (addressHint), then streetAddress fields, then address field
    const street = prop?.streetAddress || prop?.street || '';
    const fullAddress = addressHint
        || (street ? `${street}, ${prop?.city || ''}, ${prop?.state || ''} ${prop?.zipCode || prop?.zipcode || ''}`.replace(/,\s*,/g, ',').trim() : '')
        || prop?.address
        || zpid;

    return {
        zpid,
        address: fullAddress,
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
    onProgress?: (done: number, total: number) => void,
    addressMap?: Record<string, string>
): Promise<CitySmokeSummary> => {
    if (!db) throw new Error('Firestore not initialized');
    if (zpids.length === 0) return { totalProperties: 0, passedCount: 0, failedCount: 0, results: [], ranAt: new Date() };

    const CHUNK = 10; // Firestore `in` query limit
    const allProps: Record<string, any> = {};
    const allAssets: Record<string, any> = {};
    const allVisual: Record<string, any> = {};
    const allEnv: Record<string, any> = {};
    const allComp: Record<string, any> = {};
    const allInvest: Record<string, any> = {};

    // Batch-fetch all collections in parallel chunks
    const chunks: string[][] = [];
    for (let i = 0; i < zpids.length; i += CHUNK) chunks.push(zpids.slice(i, i + CHUNK));

    let done = 0;
    await Promise.all(chunks.map(async (chunk) => {
        const [propSnap, assetSnap, visualSnap, envSnap, compSnap, investSnap] = await Promise.all([
            getDocs(query(collection(db!, 'properties'), where(documentId(), 'in', chunk))),
            getDocs(query(collection(db!, 'property_assets'), where(documentId(), 'in', chunk))),
            getDocs(query(collection(db!, 'property_analyses_visual'), where(documentId(), 'in', chunk))),
            getDocs(query(collection(db!, 'google_environmental_data'), where(documentId(), 'in', chunk))),
            getDocs(query(collection(db!, 'property_analyses_comprehensive'), where(documentId(), 'in', chunk))),
            getDocs(query(collection(db!, 'property_investment_research'), where(documentId(), 'in', chunk))),
        ]);
        propSnap.forEach(d => { allProps[d.id] = d.data(); });
        assetSnap.forEach(d => { allAssets[d.id] = d.data(); });
        visualSnap.forEach(d => { allVisual[d.id] = d.data(); });
        envSnap.forEach(d => { allEnv[d.id] = d.data(); });
        compSnap.forEach(d => { allComp[d.id] = d.data(); });
        investSnap.forEach(d => { allInvest[d.id] = d.data(); });
        done += chunk.length;
        onProgress?.(done, zpids.length);
    }));

    // Skip zpids that have no property document (never ingested / no real ZPID)
    const resolvedZpids = zpids.filter(zpid => !!allProps[zpid]);

    const results = resolvedZpids.map(zpid =>
        runChecks(
            zpid,
            allProps[zpid] || null,
            allAssets[zpid] || null,
            allVisual[zpid] || null,
            allEnv[zpid] || null,
            allComp[zpid] || null,
            allInvest[zpid] || null,
            addressMap?.[zpid]
        )
    );

    const passedCount = results.filter(r => r.passed).length;

    return {
        totalProperties: resolvedZpids.length,
        passedCount,
        failedCount: resolvedZpids.length - passedCount,
        results,
        ranAt: new Date(),
    };
};
