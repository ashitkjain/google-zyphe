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
import { db, generateCityStateKey } from './firebase/config';
import { normalizeEnvDoc } from './firebase/googleData';
import { getCommunityPulseFromCloud, getDeepInvestmentResearchFromCloud, getSchoolAnalysisFromCloud, getLivingWageFromCloud } from './firebase/properties';
import { resoFieldKey } from '../utils/propertyFieldConfig';
import { isSupportedPropertyType, isGhostListing, isSingleFamily, isTownhome } from '../utils/propertyPolicies';
import { APP_CONFIG } from '../config';
import { getSchoolCacheKey as _getSchoolCacheKey } from '../prompts/property/schoolsAnalysis';


// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckSeverity = 'error' | 'warn';

/**
 * Declares which API/system can fix a failed check.
 * Used by the pipeline to dynamically decide which APIs to call for healing.
 */
export type CheckSource =
    | 'rapidapi'          // RapidAPI /property endpoint (fetchPropertySpecs)
    | 'environmental'     // Google/USGS/NREL environmental APIs (fetchPropertyDataFull)
    | 'assets'            // Firebase Storage asset pipeline (securePropertyAssets)
    | 'parcel'            // ArcGIS parcel lookup + Gemini tax record fallback
    | 'ai_visual'         // Gemini visual analysis (analyzePropertyImages + analyzeNeighborhood)
    | 'ai_comprehensive'  // Gemini comprehensive/narrative analysis
    | 'ai_investment'     // Investment research analysis
    | 'city_data'         // City-level community pulse / market intelligence
    | 'computed';         // Derived/computed fields — no single API can fix

export interface SmokeCheck {
    id: string;
    label: string;
    severity: CheckSeverity;
    source: CheckSource;
    passed: boolean;
    detail?: string;  // e.g. "3 images found" or "missing"
    sourceNull?: boolean; // true = API was called but data doesn't exist at source (futile to retry)
}

export interface PropertySmokeResult {
    zpid: string;
    address: string;
    homeType?: string;
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
    source: CheckSource,
    passed: boolean,
    detail?: string,
    sourceNull?: boolean
) {
    checks.push({ id, label, severity, source, passed, detail, sourceNull });
}

/**
 * Helper: check a field, but if _fetchMeta says the API returned null for this field,
 * mark it as sourceNull (unavailable at source) and downgrade severity to 'warn'.
 */
function chkWithMeta(
    checks: SmokeCheck[],
    id: string,
    label: string,
    severity: CheckSeverity,
    source: CheckSource,
    passed: boolean,
    detail: string,
    fetchMeta: any,
    metaFieldName: string
) {
    const nullFields: string[] = fetchMeta?.fieldsNull || [];
    const isSourceNull = !passed && nullFields.includes(metaFieldName);
    if (isSourceNull) {
        checks.push({
            id, label, severity: 'warn', source, passed: true,
            detail: `unavailable at source (${detail})`, sourceNull: true
        });
    } else {
        checks.push({ id, label, severity, source, passed, detail });
    }
}

/**
 * Checks Google Street View Metadata API to confirm if imagery exists.
 */
async function checkStreetViewExists(lat: number, lng: number): Promise<boolean> {
    try {
        const apiKey = APP_CONFIG.maps.key;
        if (!apiKey) return false;
        const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=50&source=outdoor&key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) return false;
        const data = await resp.json();
        return data.status === 'OK';
    } catch {
        return false;
    }
}

// ─── Per-property checker ─────────────────────────────────────────────────────

export async function runChecks(
    zpid: string,
    prop: any,
    assets: any | null,
    visual: any | null,
    env: any | null,
    comprehensive: any | null,
    investment: any | null,
    lifestyleInsights: any | null,
    lifestyleFit: any | null,
    contextGraph: any | null,
    schoolAnalyses: Record<string, any>,
    addressHint?: string,
    cityData?: { communityPulse?: any; deepInvestmentResearch?: any; livingWage?: any; livingWageGeo?: string }
): Promise<PropertySmokeResult> {
    const checks: SmokeCheck[] = [];
    const rapidapiMeta = prop?._fetchMeta?.rapidapi;
    const envMeta = env?._fetchMeta?.environmental;
    let liveSvExists: boolean | null = null; // cached metadata result

    // ── 0. Property Type Validation ──────────────────────────────────────────
    // Determine if this is a supported property type (Single Family, Townhouse, Condo).
    const isSupported = isSupportedPropertyType(prop || {});
    const isGhost = isGhostListing(prop || { address: addressHint });
    const isUnderperformingLot = !isGhost && isSupported && (prop?.bedrooms <= 0 || prop?.bathrooms <= 0 || prop?.livingAreaValue <= 0);
    const hasTypeFailure = !isSupported || isGhost || isUnderperformingLot;
    chk(checks, 'typeValidation', 'Property Type Support', 'error', 'rapidapi', !hasTypeFailure,
        isGhost ? 'Ghost/Placeholder' : !isSupported ? `Unsupported (${prop?.homeType || 'LOT/LAND'})` : isUnderperformingLot ? 'Lot-like (Zero rooms/sqft)' : 'Valid Residential');

    // ── 1. Core listing data ─────────────────────────────────────────────────

    // These fields are always present from RapidAPI — one group check
    const isAuction = !!(prop?.listingSubType?.is_forAuction);
    const coreFields = isAuction
        ? [prop?.bedrooms, prop?.bathrooms, prop?.livingAreaValue]
        : [prop?.bedrooms, prop?.bathrooms, prop?.livingAreaValue, prop?.listPrice ?? prop?.price];
    const corePresent = coreFields.filter(v => v != null && v > 0).length;
    chk(checks, 'coreListing', isAuction ? 'Core Listing (beds/baths/sqft)' : 'Core Listing (beds/baths/sqft/price)', 'error', 'rapidapi', corePresent === coreFields.length,
        `${corePresent}/${coreFields.length} present${isAuction ? ' (auction — price skipped)' : ''}`);
    const priceVal = prop?.listPrice ?? prop?.price ?? null;
    chkWithMeta(checks, 'description', 'Description', 'error', 'rapidapi', !!(prop?.description && prop.description.length > 50),
        prop?.description ? `${prop.description.length} chars` : 'missing/too short', rapidapiMeta, 'description');
    chkWithMeta(checks, 'coordinates', 'Coordinates', 'error', 'rapidapi', !!(prop?.coordinates?.latitude && prop.coordinates?.longitude),
        prop?.coordinates ? `${prop.coordinates.latitude.toFixed(4)}, ${prop.coordinates.longitude.toFixed(4)}` : 'missing', rapidapiMeta, 'coordinates');

    // ── 2. Walk/Transit/Bike scores ──────────────────────────────────────────
    const hasWalkScoreApi = prop?.walkScore != null || prop?.bikeScore != null;
    chkWithMeta(checks, 'walkScore', 'Walk Score', 'warn', 'environmental', prop?.walkScore != null,
        prop?.walkScore != null ? String(prop.walkScore) : 'missing', rapidapiMeta, 'walkScore');
    // Transit score may legitimately be null for suburban areas with no transit service.
    const transitAvailable = prop?.transitScore != null;
    chkWithMeta(checks, 'transitScore', 'Transit Score', 'warn', 'environmental',
        transitAvailable || hasWalkScoreApi,
        transitAvailable ? String(prop.transitScore) : (hasWalkScoreApi ? 'not available for this area' : 'missing'),
        rapidapiMeta, 'transitScore');
    chkWithMeta(checks, 'bikeScore', 'Bike Score', 'warn', 'environmental', prop?.bikeScore != null,
        prop?.bikeScore != null ? String(prop.bikeScore) : 'missing', rapidapiMeta, 'bikeScore');

    const isFirebaseStorageUrl = (url?: string | null) =>
        !!url && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com'));

    // ── 3. Images ────────────────────────────────────────────────────────────
    const downloadedImgCount = (assets?.images?.length || 0);
    const sourceImgCount = (prop?.images?.length || 0);
    const expectedImgCount = (prop?.photoCount || sourceImgCount || 0);
    
    // Flag as shallow if we only have 1 image but the record (or common sense) suggests more.
    // 1 image is almost always a search result placeholder.
    const isShallow = downloadedImgCount === 1 && expectedImgCount <= 1; 
    const isMissing = expectedImgCount > 0 && downloadedImgCount < expectedImgCount;
    const imgOk = !isMissing && !isShallow;

    chk(checks, 'images', 'Property Images', 'error', 'assets', imgOk,
        isShallow ? 'Shallow ingestion (1 image) \u2014 needs Detail Sync' :
        isMissing ? `${downloadedImgCount}/${expectedImgCount} downloaded` :
        expectedImgCount === 0 ? 'no images listed' : 'present');

    // ── 4. Firebase Storage assets ───────────────────────────────────────────
    chk(checks, 'mapZoomIn', 'Map Zoom-In (Storage)', 'error', 'assets', isFirebaseStorageUrl(assets?.mapZoomIn || prop?.mapZoomIn),
        isFirebaseStorageUrl(assets?.mapZoomIn || prop?.mapZoomIn) ? 'present' : 'missing/not in Storage');
    chk(checks, 'mapZoomOut', 'Map Zoom-Out (Storage)', 'error', 'assets', isFirebaseStorageUrl(assets?.mapZoomOut || prop?.mapZoomOut),
        isFirebaseStorageUrl(assets?.mapZoomOut || prop?.mapZoomOut) ? 'present' : 'missing/not in Storage');
    const svImgUrl = assets?.streetView || env?.streetViewAnalysis?.imageUrl;
    const hasSvStorage = isFirebaseStorageUrl(svImgUrl);
    
    // Perform live metadata check if missing from storage to see if it's a pipeline gap or source gap
    if (liveSvExists === null && !hasSvStorage && prop?.coordinates?.latitude) {
        liveSvExists = await checkStreetViewExists(prop.coordinates.latitude, prop.coordinates.longitude);
    }

    if (hasSvStorage) {
        chk(checks, 'streetView', 'Street View (Storage)', 'error', 'assets', true, 'present');
    } else if (!liveSvExists && prop?.coordinates?.latitude) {
        // Confirmed missing at source via free Metadata API
        chk(checks, 'streetView', 'Street View (Storage)', 'warn', 'assets', true, 'unavailable at source (confirmed via API)', true);
    } else {
        // Exists at source but not in our storage
        chk(checks, 'streetView', 'Street View (Storage)', 'error', 'assets', false, 'missing (exists at source \u2014 needs download)');
    }
    const satUrl = assets?.satelliteImageUrl || assets?.satellite || prop?.satelliteImageUrl;
    chk(checks, 'satellite', 'Satellite Image (Storage)', 'error', 'assets', isFirebaseStorageUrl(satUrl),
        isFirebaseStorageUrl(satUrl) ? 'present' : (satUrl ? 'present (not in Storage)' : 'missing'));

    // ── 5. Parcel / APN data ──────────────────────────────────────────────────
    // parcelNotFound = ArcGIS was called but has no record for this address (source confirmed)
    // parcelFetchedAt = ArcGIS was called; without parcelNotFound means it succeeded
    const parcelFetched = !!(prop?.parcelFetchedAt || prop?.parcelCachedAt || prop?.parcelPolygon);
    const parcelNotFound = !!(prop as any)?.parcelNotFound;

    const polygon = prop?.parcelPolygon || prop?.parcel_polygon || prop?.parcelValidation?.polygon;
    const hasPolygon = Array.isArray(polygon) && polygon.length > 3;
    checks.push({
        id: 'parcelPolygon', label: 'Parcel Polygon', severity: 'warn', source: 'parcel',
        passed: hasPolygon || parcelNotFound,
        detail: hasPolygon ? `${polygon.length} vertices` : parcelNotFound ? 'no ArcGIS record for address' : 'not fetched',
        sourceNull: !hasPolygon && parcelNotFound,
    });
    const apnVal = prop?.parcelApn || prop?.parcel_apn || prop?.apn || prop?.APN;
    checks.push({
        id: 'parcelApn', label: 'APN', severity: 'warn', source: 'parcel',
        passed: !!apnVal || parcelNotFound,
        detail: apnVal ? String(apnVal) : parcelNotFound ? 'no ArcGIS record' : 'not fetched',
        sourceNull: !apnVal && parcelNotFound,
    });
    const parcelArea = prop?.parcelAreaSqft || prop?.parcel_area_sqft || prop?.parcelArea;
    checks.push({
        id: 'parcelArea', label: 'Parcel Area (sqft)', severity: 'warn', source: 'parcel',
        passed: (parcelArea != null && parcelArea > 0) || parcelNotFound,
        detail: parcelArea ? `${parcelArea.toLocaleString()} sf` : parcelNotFound ? 'no ArcGIS record' : 'not fetched',
        sourceNull: !parcelArea && parcelNotFound,
    });
    chkWithMeta(checks, 'taxSqft', 'Tax Record Sqft', 'warn', 'parcel', prop?.taxSqft != null && prop.taxSqft > 0,
        prop?.taxSqft ? `${prop.taxSqft.toLocaleString()} sf (${prop.taxSqftSource || 'unknown source'})` : 'not fetched', envMeta, 'taxSqft');

    // ── 6. Google Environmental APIs ─────────────────────────────────────────
    // These now primarily live in google_environmental_data
    const solar = env?.solarData;
    const aqi = env?.airQuality;
    const pollen = env?.pollen;
    // Zyphe proprietary noise (OSM simulation) — falls back to legacy HowLoud score for old docs
    const zypheNoise = env?.zypheNoiseScore ?? env?.noiseScore ?? null;
    const places = env?.google_places;

    // Solar: check both maxSunshineHoursPerYear and solarPotential as indicators
    const hasSolar = !!(solar?.maxSunshineHoursPerYear || solar?.solarPotential || solar?.yearlyEnergyDcKwh);
    chkWithMeta(checks, 'solarData', 'Solar API', 'warn', 'environmental', hasSolar,
        solar ? `${solar.maxSunshineHoursPerYear || solar.yearlyEnergyDcKwh || '?'} hrs/yr sunshine` : 'not fetched', envMeta, 'solarData');

    // Solar financial data (panels, system capacity, 20yr savings)
    const solarProd = solar?.estimatedSolarProduction;
    const hasSolarFinancial = !!(solarProd?.annualKwh && solarProd?.estimatedPanels) || !!(solar?.maxArrayPanelsCount && solar?.maxSunshineHoursPerYear);
    chkWithMeta(checks, 'solarFinancial', 'Solar — Panels & Production', 'warn', 'environmental', hasSolarFinancial,
        solarProd?.annualKwh
            ? `${solarProd.estimatedPanels} panels, ${solarProd.annualKwh.toLocaleString()} kWh/yr`
            : solar?.maxArrayPanelsCount
                ? `${solar.maxArrayPanelsCount} panels, ${solar.maxSunshineHoursPerYear?.toLocaleString() ?? '?'} hrs/yr`
                : 'missing (no panel/kWh data)', envMeta, 'solarData');

    chkWithMeta(checks, 'airQuality', 'Air Quality API', 'warn', 'environmental', !!(aqi?.aqi != null),
        aqi ? `AQI ${aqi.aqi} (${aqi.category})` : 'not fetched', envMeta, 'airQuality');
    chkWithMeta(checks, 'pollen', 'Pollen API', 'warn', 'environmental', !!(pollen?.grass || pollen?.score != null),
        pollen ? `Fetched (${pollen.category || 'present'})` : 'not fetched', envMeta, 'pollen');
    chkWithMeta(checks, 'noiseScore', 'Noise Score', 'warn', 'environmental', zypheNoise != null,
        zypheNoise != null
            ? `${zypheNoise} (${env?.noiseCharacterization || env?.noiseScoreDesc || '?'})`
            : 'not fetched', envMeta, 'zypheNoiseScore');
    chkWithMeta(checks, 'googlePlaces', 'Nearby Places (POI)', 'warn', 'environmental', !!places,
        places ? 'cached' : 'not fetched', envMeta, 'google_places');

    // ── 6b. Seismic & Historical Disasters ───────────────────────────────────
    const hd = env?.historical_disasters;
    const sz = hd?.seismicZone;
    chkWithMeta(checks, 'seismicZone', 'Seismic Zone Data', 'warn', 'environmental', !!(sz?.designCategory),
        sz?.designCategory
            ? `Zone ${sz.designCategory}${sz.riskLevel ? ` (${sz.riskLevel})` : ''}${sz.pga ? ` PGA ${sz.pga.toFixed(2)}g` : ''}`
            : 'missing', envMeta, 'historical_disasters');
    const quakes = hd?.earthquakes;
    // An empty array from USGS means the API was called and genuinely found no M3.0+ events
    // within the search radius — it's source-confirmed "none nearby", not a missing fetch.
    const disastersFetched = !!(hd?.fetchedAt);
    const earthquakeSourceNull = disastersFetched && Array.isArray(quakes) && quakes.length === 0;
    checks.push({
        id: 'earthquakeHistory',
        label: 'Earthquake History',
        severity: 'warn',
        source: 'environmental',
        passed: earthquakeSourceNull || (Array.isArray(quakes) && quakes.length > 0),
        detail: Array.isArray(quakes) ? (quakes.length > 0 ? `${quakes.length} events recorded` : 'none within 5mi radius') : 'not fetched',
        sourceNull: earthquakeSourceNull,
    });

    // ── 7. AI Analysis ───────────────────────────────────────────────────────
    // Visual AI (interior / exterior)
    const hasVisualInterior = !!(visual?.home_interior?.overall_description && visual.home_interior.overall_description.length > 30);
    const hasVisualExterior = !!(visual?.exterior_and_neighborhood?.exterior_and_lot_appeal?.architecture_style);
    chk(checks, 'aiVisualInterior', 'AI Visual — Interior', 'error', 'ai_visual', hasVisualInterior,
        hasVisualInterior ? 'analysis present' : 'missing (needs Full Intel)');
    chk(checks, 'aiVisualExterior', 'AI Visual — Exterior', 'error', 'ai_visual', hasVisualExterior,
        hasVisualExterior ? 'analysis present' : 'missing');

    // Visual sub-fields: design_style, condition, room_highlights
    const hi = visual?.home_interior;
    chk(checks, 'designStyle', 'AI Visual — Design Style', 'warn', 'ai_visual', !!(hi?.design_style?.style),
        hi?.design_style?.style || 'missing');
    chk(checks, 'conditionFinish', 'AI Visual — Condition & Finish', 'warn', 'ai_visual', !!(hi?.condition_and_finish && hi.condition_and_finish.length > 10),
        hi?.condition_and_finish ? `${hi.condition_and_finish.length} chars` : 'missing');
    const roomCount = Array.isArray(visual?.room_highlights) ? visual.room_highlights.length : 0;
    // Compare AI rooms against property bedrooms — the AI should document at least every bedroom.
    // resoFacts.rooms is the total room count (often 8-10+), but bedrooms is the reliable minimum.
    const bedroomCount = prop?.bedrooms ?? 0;
    const roomCoverageOk = roomCount >= 1 && (bedroomCount === 0 || roomCount >= bedroomCount);
    chk(checks, 'roomHighlights', 'AI Visual — Room Highlights', 'warn', 'ai_visual', roomCoverageOk,
        roomCount > 0
            ? `${roomCount} rooms vs ${bedroomCount}BR${!roomCoverageOk ? ' — incomplete coverage' : ''}`
            : 'missing');

    // Visual sub-fields: curb appeal, backyard, privacy
    const ext = visual?.exterior_and_neighborhood;
    chk(checks, 'curbAppeal', 'AI Visual — Curb Appeal', 'warn', 'ai_visual', !!(ext?.exterior_and_lot_appeal?.curb_appeal),
        ext?.exterior_and_lot_appeal?.curb_appeal ? `${ext.exterior_and_lot_appeal.curb_appeal.length} chars` : 'missing');
    chk(checks, 'backyardPatio', 'AI Visual — Backyard/Patio', 'warn', 'ai_visual', !!(ext?.exterior_and_lot_appeal?.backyard_and_patio),
        ext?.exterior_and_lot_appeal?.backyard_and_patio ? `${ext.exterior_and_lot_appeal.backyard_and_patio.length} chars` : 'missing');
    chk(checks, 'privacyVisual', 'AI Visual — Privacy', 'error', 'ai_visual', !!(ext?.views_privacy_orientation?.privacy),
        ext?.views_privacy_orientation?.privacy || 'missing');

    // Neighborhood spatial analysis - check both visual and comprehensive outputs
    const neighborhoodInsights = visual?.exterior_and_neighborhood?.neighborhood_street_insights;
    const comprehensiveNeighborhood = comprehensive?.detailed_analysis?.community_pulse;
    const hasNeighborhood = !!((neighborhoodInsights && neighborhoodInsights.length > 30) || (comprehensiveNeighborhood && comprehensiveNeighborhood.length > 30));
    chk(checks, 'aiNeighborhood', 'AI Neighborhood/Spatial', 'error', 'ai_visual', hasNeighborhood,
        hasNeighborhood ? 'analysis present' : 'missing');

    // Orientation AI (saved on properties doc)
    const orientationAi = prop?.orientation_ai;
    const orientationVal = orientationAi?.final_orientation;
    const isUnclear = orientationVal === 'UNCLEAR';
    const hasOrientation = !!orientationVal && !isUnclear;
    const isV30 = orientationAi?.batch_version === 'v30' || orientationAi?.orientation_version === 'v30';

    chk(checks, 'orientationAi', 'Front Orientation AI', 'warn', 'ai_visual', hasOrientation,
        isUnclear ? 'UNCLEAR (ambiguous)' : (hasOrientation ? orientationVal : 'missing'));

    if (hasOrientation) {
        chk(checks, 'orientationConfidence', 'Orientation Confidence', 'warn', 'ai_visual', orientationAi.confidence === 'high',
            orientationAi.confidence || 'unknown');
        chk(checks, 'orientationVersion', 'Orientation Version (v30)', 'warn', 'ai_visual', isV30,
            isV30 ? 'v30' : (orientationAi?.batch_version || orientationAi?.orientation_version || 'old version'));
    }

    // ── 3. Street View AI (environmental.streetViewAnalysis or fallback to visual) ──
    const svAnalysis = env?.streetViewAnalysis;
    const aiCurbAppeal = visual?.exterior_and_neighborhood?.exterior_and_lot_appeal?.curb_appeal;
    const hasStreetViewAi = !!(svAnalysis || (aiCurbAppeal && aiCurbAppeal.length > 20));
    
    // Check if it's confirmed missing at source in cache
    const svSourceNull = !!(envMeta?.fieldsNull?.includes('streetViewAnalysis'));
    
    // If it's missing but not confirmed missing, perform a live check to determine severity
    if (liveSvExists === null && !hasStreetViewAi && !svSourceNull && prop?.coordinates?.latitude) {
        liveSvExists = await checkStreetViewExists(prop.coordinates.latitude, prop.coordinates.longitude);
    }

    if (hasStreetViewAi) {
        const detail = svAnalysis 
            ? `curb appeal: ${svAnalysis.curbAppealScore ?? '?'}/10` 
            : `AI detected: ${aiCurbAppeal?.substring(0, 30)}...`;
        chk(checks, 'streetViewAi', 'Street View AI', 'warn', 'environmental', true, detail);
    } else if (svSourceNull || ( !hasStreetViewAi && !liveSvExists && prop?.coordinates?.latitude)) {
        chk(checks, 'streetViewAi', 'Street View AI', 'warn', 'environmental', true, 'unavailable at source', true);
    } else {
        chk(checks, 'streetViewAi', 'Street View AI', 'error', 'environmental', false, 'missing (imagery exists — needs analysis)');
    }

    // Pollen AI analysis (env is source of truth for pollen)
    const pollenData = env?.pollen;
    const hasPollenAi = !!(pollenData?.analysis?.breathe_easy_summary);
    chk(checks, 'pollenAi', 'Pollen AI Analysis', 'warn', 'environmental', hasPollenAi,
        hasPollenAi ? 'analysis present' : 'missing');

    // ── 7b. Community Pulse (city-level collection: community_pulse) ─────────
    const cp = cityData?.communityPulse;
    const hasCpLike = !!(cp?.what_residents_like?.points?.length);
    const hasCpComplaint = !!(cp?.common_complaints?.points?.length);
    chk(checks, 'communityPulse', 'Community Pulse', 'warn', 'city_data', !!(hasCpLike || hasCpComplaint),
        cp ? `like: ${cp.what_residents_like?.points?.length || 0}, complaints: ${cp.common_complaints?.points?.length || 0}` : 'missing');

    // ── 7c. MIT Living Wage (city-level, metro or county scope) ──────────────
    const lw = cityData?.livingWage;
    const hasLivingWage = !!(lw?.living_wage_hourly && lw.living_wage_hourly > 0);
    const lwContext = cityData?.livingWageGeo || 'unknown region';
    chk(checks, 'livingWage', 'MIT Living Wage Data', 'warn', 'city_data', hasLivingWage,
        hasLivingWage
            ? `$${lw.living_wage_hourly}/hr per adult · ${lw.geographic_level || '?'}-level · ${lw.data_updated || 'date unknown'}`
            : `not found for ${lwContext} — run Intelligence Suite to populate`);

    // Custom visual analysis (lives on property_analyses_visual doc)
    const hasCustomAnalysis = !!(visual?.report_title || visual?.home_interior);
    chk(checks, 'customAnalysis', 'Custom AI Analysis', 'warn', 'ai_visual', hasCustomAnalysis,
        hasCustomAnalysis ? 'present' : 'not run yet');

    // ── 8. Data sanity checks ────────────────────────────────────────────────
    // Listing sqft vs tax record sqft anomaly (>20% discrepancy = red flag)
    if (prop?.livingAreaValue && prop?.taxSqft) {
        const diff = Math.abs(prop.livingAreaValue - prop.taxSqft) / prop.taxSqft;
        chk(checks, 'sqftSanity', 'Sqft Discrepancy (>20%)', 'warn', 'computed', diff <= 0.20,
            `${Math.round(diff * 100)}% diff — listing ${prop.livingAreaValue.toLocaleString()} vs tax ${prop.taxSqft.toLocaleString()}`);
    }
    // Price per sqft sanity ($100–$5000/sf) — skip for auction properties
    if (priceVal && prop?.livingAreaValue && prop.livingAreaValue > 0 && !isAuction) {
        const ppsf = priceVal / prop.livingAreaValue;
        chk(checks, 'ppsfSanity', 'Price/Sqft Sanity', 'warn', 'computed', ppsf >= 100 && ppsf <= 5000,
            `$${Math.round(ppsf)}/sf`);
    }
    // Image count sanity — warn if we have some images but fewer than expected
    if (downloadedImgCount > 0 && expectedImgCount > 0 && downloadedImgCount < expectedImgCount) {
        chk(checks, 'imageCountSanity', 'Image Count Mismatch', 'warn', 'assets', false, `${downloadedImgCount}/${expectedImgCount} — some images may have failed to download`);
    }

    // ── 9. Comprehensive Narrative (property_analyses_comprehensive) ──────────
    const hasSummary = !!(comprehensive?.summary && comprehensive.summary.length > 30);
    chk(checks, 'compSummary', 'Narrative Summary', 'error', 'ai_comprehensive', hasSummary,
        hasSummary ? `${comprehensive.summary.length} chars` : 'missing');
    chk(checks, 'compRisks', 'Risks & Considerations', 'error', 'ai_comprehensive', !!(comprehensive?.risks_considerations),
        comprehensive?.risks_considerations ? 'present' : 'missing');

    // ── 10. Interior Summary (now inside property_analyses_visual) ───────────
    const intSum = visual?.home_interior;
    const hasIntSummary = !!(intSum?.interior_summary && intSum.interior_summary.length > 20);
    const hasRoomsSummary = !!(intSum?.rooms_summary && intSum.rooms_summary.length > 20);
    const hasVibe = !!(intSum?.vibe);
    const hasTags = Array.isArray(intSum?.objective_tags) && intSum.objective_tags.length > 0;
    chk(checks, 'intSummary', 'Interior Summary', 'error', 'ai_visual', hasIntSummary,
        hasIntSummary ? `${intSum.interior_summary.length} chars` : 'missing');
    chk(checks, 'intRooms', 'Rooms Summary', 'error', 'ai_visual', hasRoomsSummary,
        hasRoomsSummary ? `${intSum.rooms_summary.length} chars` : 'missing');
    chk(checks, 'intVibe', 'Interior Vibe', 'warn', 'ai_visual', hasVibe,
        hasVibe ? intSum.vibe : 'missing');
    chk(checks, 'intTags', 'Interior Tags', 'warn', 'ai_visual', hasTags,
        hasTags ? `${intSum.objective_tags.length} tags` : 'missing');

    // ── 11. Graph & Schools ──────────────────────────────────────────────────
    const graph = contextGraph;
    const factors = graph?.factors || graph?.entities || [];
    const hasGraph = Array.isArray(factors) && factors.length > 0;
    chk(checks, 'contextGraph', 'AI Context Graph', 'warn', 'ai_graph', hasGraph,
        hasGraph ? `${factors.length} factors identified` : 'missing');

    // Schools data on the property (from RapidAPI)
    const schoolCount = Array.isArray(prop?.schools) ? prop.schools.length : 0;
    chkWithMeta(checks, 'nearbySchools', 'Nearby Schools Data', 'warn', 'rapidapi', schoolCount > 0,
        schoolCount > 0 ? `${schoolCount} schools` : 'no schools on property', rapidapiMeta, 'schools');

    // Per-school analysis quality — validate ALL schema-required fields
    if (schoolCount > 0 && prop?.city) {
        const requiredSchoolFields = [
            'name', 'type', 'level', 'grades_served', 'district_name',
            'test_scores', 'student_teacher_ratio', 'enrollment',
            'parent_sentiment_positive', 'parent_sentiment_concerns',
            'extracurriculars', 'overall_assessment'
        ];
        const isFieldEmpty = (val: any) =>
            val == null || val === '' || (typeof val === 'string' && (
                val.toLowerCase().includes('current data not available') ||
                val.toLowerCase().includes('not possible') ||
                val.toLowerCase().includes('data not available')
            ));

        let analyzedCount = 0;
        let staleCount = 0;
        const staleNames: string[] = [];
        const missingFieldSummary: string[] = [];

        for (const school of prop.schools) {
            const key = _getSchoolCacheKey(school.name, prop.city || '', prop.state || '');
            const analysis = schoolAnalyses[key];
            if (analysis?.name) {
                analyzedCount++;
                const emptyFields = requiredSchoolFields.filter(f => isFieldEmpty(analysis[f]));
                if (emptyFields.length >= 3) {
                    staleCount++;
                    staleNames.push(school.name);
                    missingFieldSummary.push(`${school.name}: missing ${emptyFields.join(', ')}`);
                }
                // Check sources
                const hasSources = Array.isArray(analysis.sources) && analysis.sources.length > 0;
                if (!hasSources) {
                    missingFieldSummary.push(`${school.name}: no sources`);
                }
            }
        }

        chk(checks, 'schoolAnalyses', 'School Intelligence', 'warn', 'ai_comprehensive', analyzedCount > 0,
            analyzedCount > 0 ? `${analyzedCount}/${schoolCount} analyzed` : 'none analyzed');
        chk(checks, 'schoolQuality', 'School Analysis Quality', 'warn', 'ai_comprehensive', staleCount === 0,
            staleCount === 0
                ? (analyzedCount > 0 ? 'all schools have valid data' : 'no data to check')
                : `${staleCount} stale: ${staleNames.join(', ')}`);

    }

    // ── 12. Lifestyle Insights (property_analyses_lifestyle_insights) ─────────
    const life = lifestyleInsights;
    const hasLifestyle = !!(life?.outdoor && life?.family && life?.senior && life?.pets && life?.food && life?.professionals);
    chk(checks, 'lifestyleInsights', 'Lifestyle Insights', 'error', 'ai_lifestyle_insights', hasLifestyle,
        hasLifestyle ? `present (${Object.keys(life).length} sections)` : 'missing — run intel batch');

    // ── 12b. Lifestyle Fit (property_analyses_lifestyle_fit) ──────────────────
    const fit = lifestyleFit;
    const fitComplete = !!(fit?.working_professionals?.verdict && fit?.families_with_kids?.verdict && fit?.seniors?.verdict);
    chk(checks, 'lifestyleFit', 'Lifestyle Fit Analysis', 'error', 'ai_lifestyle_fit', fitComplete,
        fitComplete ? `WP: ${fit.working_professionals.verdict}, Fam: ${fit.families_with_kids.verdict}, Sr: ${fit.seniors.verdict}` : 'missing or incomplete — run intel batch');

    // ── 13. Property Investment Research (property_investment_research) ───────
    const hasSTR = !!(investment?.str_performance?.adr);
    const hasLTR = !!(investment?.ltr_analysis?.monthly_rent);
    chk(checks, 'investmentSTR', 'STR Performance (ADR)', 'error', 'ai_investment', hasSTR,
        hasSTR ? `ADR: ${investment.str_performance.adr}` : 'missing');
    chk(checks, 'investmentLTR', 'LTR Analysis (Rent)', 'error', 'ai_investment', hasLTR,
        hasLTR ? `Rent: ${investment.ltr_analysis.monthly_rent}` : 'missing');

    // ── 16. Risk Scores (properties doc — flat fields, single source of truth) ──
    const riskPresent = [prop?.floodRiskScore, prop?.fireRiskScore, prop?.heatRiskScore, prop?.windRiskScore]
        .filter(v => v != null).length;
    chkWithMeta(checks, 'climateRiskScores', 'Climate Risk Scores (4)', 'warn', 'rapidapi', riskPresent >= 3,
        `${riskPresent}/4 present${riskPresent > 0 ? ` (flood:${prop?.floodRiskScore ?? '—'} fire:${prop?.fireRiskScore ?? '—'} heat:${prop?.heatRiskScore ?? '—'} wind:${prop?.windRiskScore ?? '—'})` : ''}`, rapidapiMeta, 'floodRiskScore');

    // ── 17. Broadband / Connectivity (on google_environmental_data or properties) ─
    const bb = env?.broadband;
    chkWithMeta(checks, 'broadband', 'Broadband Data', 'warn', 'environmental', !!(bb?.providerCount),
        bb ? `${bb.providerCount} ISPs, ↓${bb.topDownloadMbps || '?'} Mbps${bb.hasFiber ? ', Fiber ✓' : ''}${bb.has5G ? ', 5G ✓' : ''}` : 'not fetched', envMeta, 'broadband');

    // ── 18. Drought Data (google_environmental_data) ──────────────────────────
    const droughtData = env?.drought;
    chkWithMeta(checks, 'drought', 'Drought Monitor', 'warn', 'environmental',
        !!(droughtData?.severity || droughtData?.severityLevel != null),
        droughtData ? `${droughtData.severity || 'Level ' + droughtData.severityLevel}` : 'not fetched', envMeta, 'drought');

    // ── 19. EV Charger Data (google_environmental_data) ──────────────────────
    const evData = env?.evChargers;
    const evCount = evData?.totalStations ?? 0;
    chkWithMeta(checks, 'evChargers', 'EV Charging Stations', 'warn', 'environmental', evCount > 0 || evData != null,
        evData ? `${evCount} stations nearby` : 'not fetched', envMeta, 'evChargers');

    // ── 20. ResoFacts — Property Details ──────────────────────────────────────
    const reso = prop?.resoFacts;
    const resoFieldCount = reso ? Object.values(reso).filter((v: any) => v != null && v !== '').length : 0;
    chkWithMeta(checks, 'resoFacts', 'Property Details (ResoFacts)', 'error', 'rapidapi', resoFieldCount >= 5,
        resoFieldCount > 0 ? `${resoFieldCount} fields populated` : 'missing', rapidapiMeta, 'resoFacts');

    // ── 20b. RESO Structure Fields (stories, parking, condition) ─────────────
    const resoStructure = [reso?.stories, reso?.parkingFeatures, reso?.propertyCondition].filter(v => v != null);
    chkWithMeta(checks, 'resoStructure', 'RESO Structure (stories/parking/condition)', 'warn', 'rapidapi',
        resoStructure.length >= 1,
        `${resoStructure.length}/3 present${reso?.stories ? ` — ${reso.stories} stories` : ''}${reso?.propertyCondition ? ` — ${reso.propertyCondition}` : ''}`,
        rapidapiMeta,
        resoStructure.length === 0 ? resoFieldKey('stories') : 'resoFacts');

    // ── 20c. RESO Interior & Systems (interiorFeatures, electric) ─────────────
    const resoInterior = [reso?.interiorFeatures, reso?.electric].filter(v => v != null);
    chkWithMeta(checks, 'resoInterior', 'RESO Interior/Systems (interior/electric)', 'warn', 'rapidapi',
        resoInterior.length >= 1,
        `${resoInterior.length}/2 present`,
        rapidapiMeta,
        resoInterior.length === 0 ? resoFieldKey('interiorFeatures') : 'resoFacts');

    // ── 21. HOA Info ──────────────────────────────────────────────────────────
    // Only flag if the property is likely in an HOA (condo, townhouse, or fee field present)
    const isHoaExpected = prop?.homeType?.toLowerCase()?.includes('condo') || prop?.homeType?.toLowerCase()?.includes('town');
    const hasHoa = !!(prop?.hoa?.fee);
    if (isHoaExpected) {
        chkWithMeta(checks, 'hoaInfo', 'HOA Info', 'warn', 'rapidapi', hasHoa,
            hasHoa ? prop.hoa.fee : 'expected for this property type but missing', rapidapiMeta, 'hoa');
    }
    // HOA detail — amenities, feeIncludes, community size
    // These sub-fields are optional Zillow fields — many HOAs don't publish them.
    // If hoa exists (fee present) but sub-fields are absent, and rapidapi was fetched,
    // it's source-confirmed missing, not a pipeline failure.
    if (hasHoa || isHoaExpected) {
        const hoaAmenities = prop?.hoa?.amenities?.length ? 'amenities' : null;
        const hoaFeeIncludes = prop?.hoa?.feeIncludes?.length ? 'feeIncludes' : null;
        const hoaUnits = reso?.numberOfUnitsInCommunity ? 'units' : null;
        const hoaDetail = [hoaAmenities, hoaFeeIncludes, hoaUnits].filter(Boolean);
        // If hoa top-level exists, sub-fields absent = source-null (Zillow doesn't publish them)
        const hoaDetailSourceNull = hoaDetail.length === 0 && hasHoa && !!(rapidapiMeta?.lastFetched);
        checks.push({
            id: 'hoaDetail',
            label: 'HOA Detail (amenities/feeIncludes/units)',
            severity: 'warn',
            source: 'rapidapi',
            passed: hoaDetail.length >= 1 || hoaDetailSourceNull,
            detail: hoaDetail.length > 0
                ? `${hoaDetail.join(', ')} present${reso?.numberOfUnitsInCommunity ? ` — ${reso.numberOfUnitsInCommunity} units` : ''}`
                : 'not published on Zillow',
            sourceNull: hoaDetailSourceNull,
        });
    }

    // ── 22. Price History ─────────────────────────────────────────────────────
    const phCount = Array.isArray(prop?.priceHistory) ? prop.priceHistory.length : 0;
    chkWithMeta(checks, 'priceHistory', 'Price History', 'warn', 'rapidapi', phCount > 0,
        phCount > 0 ? `${phCount} events` : 'missing', rapidapiMeta, 'priceHistory');

    // ── 23. Neighborhood Identity (Gemini + ArcGIS) ───────────────────────────
    const nid = prop?.neighborhood_identity;
    chk(checks, 'neighborhoodIdentity', 'Neighborhood Identity', 'warn', 'ai_comprehensive', !!(nid?.resolved_name),
        nid?.resolved_name ? `${nid.resolved_name}${nid.city_plan_data?.specific_plan ? ` (${nid.city_plan_data.specific_plan})` : ''}` : 'not resolved');

    // Lifestyle Fit check moved up to 12b for clarity

    // ── 25. Attribution (Agent / Brokerage) ───────────────────────────────────
    const attr = prop?.attribution;
    chkWithMeta(checks, 'attribution', 'Listing Attribution', 'error', 'rapidapi', !!(attr?.listingAgentName || attr?.brokerageName),
        attr?.listingAgentName ? `${attr.listingAgentName}${attr.brokerageName ? ` — ${attr.brokerageName}` : ''}` : 'missing',
        rapidapiMeta, 'attribution');

    const errorCount = checks.filter(c => c.severity === 'error' && !c.passed).length;
    const warnCount = checks.filter(c => c.severity === 'warn' && !c.passed).length;

    // Smart address construction: deduplicate if street already contains city/state
    const street = prop?.streetAddress || prop?.street || '';
    const city = prop?.city || '';
    const state = prop?.state || '';
    const zip = prop?.zipCode || prop?.zipcode || '';

    let fullAddress = addressHint || prop?.address || '';
    if (!fullAddress && street) {
        if (city && street.toLowerCase().includes(city.toLowerCase())) {
            fullAddress = street;
        } else {
            fullAddress = `${street}, ${city}, ${state} ${zip}`.replace(/,\s*,/g, ',').trim();
        }
    }
    if (!fullAddress) fullAddress = zpid;

    return {
        zpid,
        address: fullAddress,
        homeType: prop?.homeType || 'Residential',
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
    const allInsights: Record<string, any> = {};
    const allFit: Record<string, any> = {};
    const allGraph: Record<string, any> = {};
    const allComp: Record<string, any> = {};
    const allInvest: Record<string, any> = {};
    const allSchoolAnalyses: Record<string, any> = {};

    // Batch-fetch all collections in parallel chunks
    const chunks: string[][] = [];
    for (let i = 0; i < zpids.length; i += CHUNK) chunks.push(zpids.slice(i, i + CHUNK));

    let done = 0;
    await Promise.all(chunks.map(async (chunk) => {
        // Properties: still in flat collection
        const propSnap = await getDocs(query(collection(db!, 'properties'), where(documentId(), 'in', chunk)));
        propSnap.forEach(d => { allProps[d.id] = d.data(); });

        // Migrated analyses: now at properties/{zpid}/analysis/{type}
        // Env data: now at properties/{zpid}/environmental/thirdparty_data
        await Promise.all(chunk.map(async (zpid) => {
            const [assetSnap, visualSnap, compSnap, investSnap, insightsSnap, fitSnap, graphSnap, envSnap, envLegacySnap] = await Promise.all([
                getDoc(doc(db!, 'properties', zpid, 'analysis', 'assets')),
                getDoc(doc(db!, 'properties', zpid, 'analysis', 'visual')),
                getDoc(doc(db!, 'properties', zpid, 'analysis', 'comprehensive')),
                getDoc(doc(db!, 'properties', zpid, 'analysis', 'investment')),
                getDoc(doc(db!, 'properties', zpid, 'analysis', 'lifestyle_insights')),
                getDoc(doc(db!, 'properties', zpid, 'analysis', 'lifestyle_fit')),
                getDoc(doc(db!, 'properties', zpid, 'analysis', 'context_graph')),
                getDoc(doc(db!, 'properties', zpid, 'environmental', 'thirdparty_data')),
                getDoc(doc(db!, 'properties', zpid, 'environmental', 'google_data')), // legacy fallback
            ]);
            if (assetSnap.exists()) allAssets[zpid] = assetSnap.data();
            if (visualSnap.exists()) allVisual[zpid] = visualSnap.data();
            if (compSnap.exists()) allComp[zpid] = compSnap.data();
            if (investSnap.exists()) allInvest[zpid] = investSnap.data();
            if (insightsSnap.exists()) allInsights[zpid] = insightsSnap.data();
            if (fitSnap.exists()) allFit[zpid] = fitSnap.data();
            if (graphSnap.exists()) allGraph[zpid] = graphSnap.data();
            const envData = envSnap.exists() ? envSnap.data() : (envLegacySnap.exists() ? envLegacySnap.data() : null);
            if (envData) allEnv[zpid] = normalizeEnvDoc(envData as Record<string, any>);
        }));

        done += chunk.length;
        onProgress?.(done, zpids.length);
    }));

    // Skip zpids that have no property document or aren't supported types (Single Family, Townhouse, Condo)
    const resolvedZpids = zpids.filter(zpid => {
        const prop = allProps[zpid];
        if (!prop) return false;
        return isSupportedPropertyType(prop);
    });

    // Batch-fetch school analyses: derive cache keys from each property's schools list
    const schoolCacheKeys = new Set<string>();
    for (const zpid of resolvedZpids) {
        const prop = allProps[zpid];
        if (Array.isArray(prop?.schools) && prop?.city) {
            for (const school of prop.schools) {
                schoolCacheKeys.add(_getSchoolCacheKey(school.name, prop.city || '', prop.state || ''));
            }
        }
    }

    // Fetch school analyses — now at cities/{city_state}/schools/{cacheKey}
    if (schoolCacheKeys.size > 0) {
        // Fetch per city-state group so we always pass cityStateKey explicitly
        // (getSchoolAnalysisFromCloud now requires it — never tries to split the key)
        const keyToCityState = new Map<string, string>();
        for (const zpid of resolvedZpids) {
            const prop = allProps[zpid];
            const csk = generateCityStateKey(prop?.city, prop?.state) || '';
            if (!prop?.schools || !prop?.city || !csk) continue;
            for (const school of prop.schools) {
                const k = _getSchoolCacheKey(school.name, prop.city || '', prop.state || '');
                keyToCityState.set(k, csk);
            }
        }
        await Promise.all(Array.from(keyToCityState.entries()).map(async ([key, csk]) => {
            const data = await getSchoolAnalysisFromCloud(key, csk);
            if (data) allSchoolAnalyses[key] = data;
        }));
    }

    // Fetch city-level data (community_pulse, deep_investment_research)
    // These are keyed by cityStateKey — use the same getCityDocWithFallback-backed
    // helpers that the app uses, so nested + legacy paths are both covered.
    const cityDataMap: Record<string, { communityPulse?: any; deepInvestmentResearch?: any; livingWage?: any; livingWageGeo?: string }> = {};
    const canonicalCityKeys = new Set<string>();

    // Collect unique metro/county keys for living wage lookup
    // Living wage is scoped to metro CBSA (preferred) or county FIPS
    const livingWageKeys = new Map<string, { cacheKey: string; geoLevel: 'metro' | 'county' }>();
    for (const zpid of resolvedZpids) {
        const prop = allProps[zpid];
        const key = generateCityStateKey(prop?.city, prop?.state);
        if (key) canonicalCityKeys.add(key);

        // Derive the living wage cache key from census_demographics
        let metroCode = prop?.census_demographics?.metroCbsaCode || prop?.metroCbsaCode;
        let countyFips = prop?.census_demographics?.countyFips || prop?.countyFips;

        // Fallback for known test cities (like Dublin) if code is missing on the listing
        if (!metroCode && !countyFips && prop?.city?.toLowerCase() === 'dublin' && prop?.state?.toUpperCase() === 'CA') {
            countyFips = '06001'; // Alameda County
        }

        if (metroCode) {
            const sCode = String(metroCode);
            livingWageKeys.set(sCode, { cacheKey: sCode, geoLevel: 'metro' });
        } else if (countyFips) {
            const sFips = String(countyFips);
            livingWageKeys.set(sFips, { cacheKey: sFips, geoLevel: 'county' });
        }
    }

    await Promise.all(Array.from(canonicalCityKeys).map(async (key) => {
        const [cp, dir] = await Promise.all([
            getCommunityPulseFromCloud(key),
            getDeepInvestmentResearchFromCloud(key),
        ]);
        if (!cityDataMap[key]) cityDataMap[key] = {};
        if (cp) cityDataMap[key].communityPulse = cp;
        if (dir) cityDataMap[key].deepInvestmentResearch = dir;
    }));

    // Fetch living wage data for all unique metro/county keys
    const livingWageCache = new Map<string, any>();
    await Promise.all(Array.from(livingWageKeys.values()).map(async ({ cacheKey, geoLevel }) => {
        const lw = await getLivingWageFromCloud(cacheKey, geoLevel);
        if (lw) livingWageCache.set(cacheKey, lw);
    }));

    // Attach living wage to each city's data slot
    for (const zpid of resolvedZpids) {
        const prop = allProps[zpid];
        const cityKey = generateCityStateKey(prop?.city, prop?.state) || '';
        if (!cityDataMap[cityKey]) cityDataMap[cityKey] = {};
        const metroCode = prop?.census_demographics?.metroCbsaCode || prop?.metroCbsaCode;
        const countyFips = prop?.census_demographics?.countyFips || prop?.countyFips;
        const lw = metroCode
            ? livingWageCache.get(String(metroCode))
            : countyFips ? livingWageCache.get(String(countyFips)) : null;
        if (lw) cityDataMap[cityKey].livingWage = lw;
    }

    const results = await Promise.all(resolvedZpids.map(async zpid => {
        const prop = allProps[zpid];
        const cityKey = generateCityStateKey(prop?.city, prop?.state) || '';
        return await runChecks(
            zpid,
            prop || null,
            allAssets[zpid] || null,
            allVisual[zpid] || null,
            allEnv[zpid] || null,
            allComp[zpid] || null,
            allInvest[zpid] || null,
            allInsights[zpid] || null,
            allFit[zpid] || null,
            allGraph[zpid] || null,
            allSchoolAnalyses,
            addressMap?.[zpid],
            cityDataMap[cityKey] || undefined
        );
    }));

    const passedCount = results.filter(r => r.passed).length;

    return {
        totalProperties: resolvedZpids.length,
        passedCount,
        failedCount: resolvedZpids.length - passedCount,
        results,
        ranAt: new Date(),
    };
};
