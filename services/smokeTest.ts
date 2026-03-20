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
    source: CheckSource,
    passed: boolean,
    detail?: string
) {
    checks.push({ id, label, severity, source, passed, detail });
}

const isFirebaseStorageUrl = (url?: string | null) =>
    !!url && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com'));

// ─── Per-property checker ─────────────────────────────────────────────────────

export function runChecks(
    zpid: string,
    prop: any,
    assets: any | null,
    visual: any | null,
    env: any | null,
    comprehensive: any | null,
    investment: any | null,
    schoolAnalyses: Record<string, any>,
    addressHint?: string,
    cityData?: { communityPulse?: any; deepInvestmentResearch?: any }
): PropertySmokeResult {
    const checks: SmokeCheck[] = [];

    // ── 1. Core listing data ─────────────────────────────────────────────────
    chk(checks, 'bedrooms', 'Bedrooms', 'error', 'rapidapi', prop?.bedrooms != null && prop.bedrooms > 0,
        prop?.bedrooms != null ? `${prop.bedrooms} bd` : 'missing');
    chk(checks, 'bathrooms', 'Bathrooms', 'error', 'rapidapi', prop?.bathrooms != null && prop.bathrooms > 0,
        prop?.bathrooms != null ? `${prop.bathrooms} ba` : 'missing');
    chk(checks, 'livingArea', 'Living Area (sqft)', 'error', 'rapidapi', prop?.livingAreaValue != null && prop.livingAreaValue > 0,
        prop?.livingAreaValue ? `${prop.livingAreaValue.toLocaleString()} sf` : 'missing');
    chk(checks, 'lotSize', 'Lot Size', 'warn', 'rapidapi', !!(prop?.lotSize || prop?.lotAreaValue),
        prop?.lotSize || prop?.lotAreaValue ? String(prop.lotSize || prop.lotAreaValue) : 'missing');
    const priceVal = prop?.listPrice ?? prop?.price ?? null;
    chk(checks, 'price', 'Listing Price', 'error', 'rapidapi', priceVal != null && priceVal > 0,
        priceVal ? `$${priceVal.toLocaleString()}` : 'missing');
    chk(checks, 'description', 'Description', 'error', 'rapidapi', !!(prop?.description && prop.description.length > 50),
        prop?.description ? `${prop.description.length} chars` : 'missing/too short');
    chk(checks, 'yearBuilt', 'Year Built', 'warn', 'rapidapi', prop?.yearBuilt != null && prop.yearBuilt > 1800,
        prop?.yearBuilt ? String(prop.yearBuilt) : 'missing');
    chk(checks, 'homeType', 'Home Type', 'warn', 'rapidapi', !!prop?.homeType,
        prop?.homeType || 'missing');
    chk(checks, 'coordinates', 'Coordinates', 'error', 'rapidapi', !!(prop?.coordinates?.latitude && prop.coordinates?.longitude),
        prop?.coordinates ? `${prop.coordinates.latitude.toFixed(4)}, ${prop.coordinates.longitude.toFixed(4)}` : 'missing');

    // ── 2. Walk/Transit/Bike scores ──────────────────────────────────────────
    const hasWalkScoreApi = prop?.walkScore != null || prop?.bikeScore != null;
    chk(checks, 'walkScore', 'Walk Score', 'warn', 'environmental', prop?.walkScore != null,
        prop?.walkScore != null ? String(prop.walkScore) : 'missing');
    // Transit score may legitimately be null for suburban areas with no transit service.
    // Only warn if the Walk Score API was never called at all.
    const transitAvailable = prop?.transitScore != null;
    chk(checks, 'transitScore', 'Transit Score', 'warn', 'environmental',
        transitAvailable || hasWalkScoreApi, // pass if score exists OR if API was called (area has no transit)
        transitAvailable ? String(prop.transitScore) : (hasWalkScoreApi ? 'not available for this area' : 'missing'));
    chk(checks, 'bikeScore', 'Bike Score', 'warn', 'environmental', prop?.bikeScore != null,
        prop?.bikeScore != null ? String(prop.bikeScore) : 'missing');

    // ── 3. Images ────────────────────────────────────────────────────────────
    const imgCount = (prop?.images?.length || assets?.images?.length || 0);
    chk(checks, 'images', 'Property Images', 'error', 'assets', imgCount >= 3,
        imgCount > 0 ? `${imgCount} images` : 'none downloaded');

    // ── 4. Firebase Storage assets ───────────────────────────────────────────
    chk(checks, 'mapZoomIn', 'Map Zoom-In (Storage)', 'error', 'assets', isFirebaseStorageUrl(assets?.mapZoomIn || prop?.mapZoomIn),
        isFirebaseStorageUrl(assets?.mapZoomIn || prop?.mapZoomIn) ? 'present' : 'missing/not in Storage');
    chk(checks, 'mapZoomOut', 'Map Zoom-Out (Storage)', 'error', 'assets', isFirebaseStorageUrl(assets?.mapZoomOut || prop?.mapZoomOut),
        isFirebaseStorageUrl(assets?.mapZoomOut || prop?.mapZoomOut) ? 'present' : 'missing/not in Storage');
    const svImgUrl = assets?.streetView || env?.streetViewAnalysis?.imageUrl;
    chk(checks, 'streetView', 'Street View (Storage)', 'warn', 'assets', isFirebaseStorageUrl(svImgUrl),
        isFirebaseStorageUrl(svImgUrl) ? 'present' : 'missing');
    const satUrl = assets?.satelliteImageUrl || assets?.satellite || prop?.satelliteImageUrl;
    chk(checks, 'satellite', 'Satellite Image (Storage)', 'warn', 'assets', isFirebaseStorageUrl(satUrl),
        isFirebaseStorageUrl(satUrl) ? 'present' : (satUrl ? 'present (not in Storage)' : 'missing'));

    // ── 5. Parcel / APN data ─────────────────────────────────────────────────
    // Parcel data is fetched lazily by ParcelValidationCard on first Explore visit.
    // Also check the parcelValidation sub-object which caches validation results.
    const polygon = prop?.parcelPolygon || prop?.parcel_polygon || prop?.parcelValidation?.polygon;
    const hasPolygon = Array.isArray(polygon) && polygon.length > 3;
    chk(checks, 'parcelPolygon', 'Parcel Polygon', 'warn', 'environmental', hasPolygon,
        hasPolygon ? `${polygon.length} vertices` : 'not fetched');
    const apnVal = prop?.parcelApn || prop?.parcel_apn || prop?.apn || prop?.APN;
    chk(checks, 'parcelApn', 'APN', 'warn', 'environmental', !!apnVal,
        apnVal || 'not fetched');
    const parcelArea = prop?.parcelAreaSqft || prop?.parcel_area_sqft || prop?.parcelArea;
    chk(checks, 'parcelArea', 'Parcel Area (sqft)', 'warn', 'environmental', parcelArea != null && parcelArea > 0,
        parcelArea ? `${parcelArea.toLocaleString()} sf` : 'not fetched');
    chk(checks, 'taxSqft', 'Tax Record Sqft', 'warn', 'environmental', prop?.taxSqft != null && prop.taxSqft > 0,
        prop?.taxSqft ? `${prop.taxSqft.toLocaleString()} sf (${prop.taxSqftSource || 'unknown source'})` : 'not fetched');

    // ── 6. Google Environmental APIs ─────────────────────────────────────────
    // These now primarily live in google_environmental_data
    const solar = env?.solarData;
    const aqi = env?.airQuality;
    const pollen = env?.pollen;
    const noise = env?.noiseScore;
    const places = env?.google_places;

    // Solar: check both maxSunshineHoursPerYear and solarPotential as indicators
    const hasSolar = !!(solar?.maxSunshineHoursPerYear || solar?.solarPotential || solar?.yearlyEnergyDcKwh);
    chk(checks, 'solarData', 'Solar API', 'warn', 'environmental', hasSolar,
        solar ? `${solar.maxSunshineHoursPerYear || solar.yearlyEnergyDcKwh || '?'} hrs/yr sunshine` : 'not fetched');

    // Solar financial data (panels, system capacity, 20yr savings)
    const solarProd = solar?.estimatedSolarProduction;
    const hasSolarFinancial = !!(solarProd?.annualKwh && solarProd?.estimatedPanels);
    chk(checks, 'solarFinancial', 'Solar — Panels & Production', 'warn', 'environmental', hasSolarFinancial,
        hasSolarFinancial
            ? `${solarProd.estimatedPanels} panels, ${solarProd.annualKwh.toLocaleString()} kWh/yr`
            : 'missing (no panel/kWh data)');
    const hasSolarSavings = !!(solar?.financialAnalysis?.cashPurchase?.savings?.savingsYear20);
    chk(checks, 'solarSavings', 'Solar — 20yr Savings', 'warn', 'environmental', hasSolarSavings,
        hasSolarSavings
            ? `$${solar.financialAnalysis.cashPurchase.savings.savingsYear20.toLocaleString()}`
            : 'missing');

    chk(checks, 'airQuality', 'Air Quality API', 'warn', 'environmental', !!(aqi?.aqi != null),
        aqi ? `AQI ${aqi.aqi} (${aqi.category})` : 'not fetched');
    chk(checks, 'pollen', 'Pollen API', 'warn', 'environmental', !!(pollen?.grass || pollen?.score != null),
        pollen ? `Fetched (${pollen.category || 'present'})` : 'not fetched');
    chk(checks, 'noiseScore', 'Noise Score API', 'warn', 'environmental', noise != null,
        noise != null ? `${noise} (${env?.noiseScoreDesc || '?'})` : 'not fetched');
    chk(checks, 'googlePlaces', 'Nearby Places (POI)', 'warn', 'environmental', !!places,
        places ? 'cached' : 'not fetched');

    // ── 6b. Seismic & Historical Disasters ───────────────────────────────────
    const hd = env?.historical_disasters;
    const sz = hd?.seismicZone;
    chk(checks, 'seismicZone', 'Seismic Zone Data', 'warn', 'environmental', !!(sz?.designCategory),
        sz?.designCategory
            ? `Zone ${sz.designCategory}${sz.riskLevel ? ` (${sz.riskLevel})` : ''}${sz.pga ? ` PGA ${sz.pga.toFixed(2)}g` : ''}`
            : 'missing');
    const quakes = hd?.earthquakes;
    chk(checks, 'earthquakeHistory', 'Earthquake History', 'warn', 'environmental', Array.isArray(quakes) && quakes.length > 0,
        Array.isArray(quakes) ? `${quakes.length} events recorded` : 'missing');

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
    chk(checks, 'roomHighlights', 'AI Visual — Room Highlights', 'warn', 'ai_visual', roomCount >= 3,
        roomCount > 0 ? `${roomCount} rooms detected` : 'missing');

    // Visual sub-fields: curb appeal, backyard, privacy
    const ext = visual?.exterior_and_neighborhood;
    chk(checks, 'curbAppeal', 'AI Visual — Curb Appeal', 'warn', 'ai_visual', !!(ext?.exterior_and_lot_appeal?.curb_appeal),
        ext?.exterior_and_lot_appeal?.curb_appeal ? `${ext.exterior_and_lot_appeal.curb_appeal.length} chars` : 'missing');
    chk(checks, 'backyardPatio', 'AI Visual — Backyard/Patio', 'warn', 'ai_visual', !!(ext?.exterior_and_lot_appeal?.backyard_and_patio),
        ext?.exterior_and_lot_appeal?.backyard_and_patio ? `${ext.exterior_and_lot_appeal.backyard_and_patio.length} chars` : 'missing');
    chk(checks, 'privacyVisual', 'AI Visual — Privacy', 'warn', 'ai_visual', !!(ext?.views_privacy_orientation?.privacy),
        ext?.views_privacy_orientation?.privacy || 'missing');

    // Neighborhood spatial analysis
    const hasNeighborhood = !!(visual?.neighborhood?.overview && visual.neighborhood.overview.length > 30);
    chk(checks, 'aiNeighborhood', 'AI Neighborhood/Spatial', 'error', 'ai_visual', hasNeighborhood,
        hasNeighborhood ? 'analysis present' : 'missing');

    // Orientation AI (saved on properties doc)
    const orientationAi = prop?.orientation_ai;
    const hasOrientation = !!(orientationAi?.final_orientation);
    chk(checks, 'orientationAi', 'Front Orientation AI', 'warn', 'ai_visual', hasOrientation,
        hasOrientation ? orientationAi.final_orientation : 'missing');

    // Street view AI (lives on google_environmental_data)
    const svAnalysis = env?.streetViewAnalysis;
    const hasStreetViewAi = !!(svAnalysis?.privacyRating || svAnalysis?.curbAppealScore || svAnalysis?.neighborhoodVibe);
    chk(checks, 'streetViewAi', 'Street View AI', 'warn', 'environmental', hasStreetViewAi,
        hasStreetViewAi ? `curb appeal: ${svAnalysis.curbAppealScore ?? '?'}/10` : 'missing');

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
    // Price per sqft sanity ($100–$5000/sf)
    if (priceVal && prop?.livingAreaValue && prop.livingAreaValue > 0) {
        const ppsf = priceVal / prop.livingAreaValue;
        chk(checks, 'ppsfSanity', 'Price/Sqft Sanity', 'warn', 'computed', ppsf >= 100 && ppsf <= 5000,
            `$${Math.round(ppsf)}/sf`);
    }
    // Image count sanity
    if (imgCount > 0 && imgCount < 3) {
        chk(checks, 'imageCountSanity', 'Image Count (<3)', 'warn', 'assets', false, `only ${imgCount} image(s) — may be incomplete`);
    }

    // ── 9. Comprehensive Narrative (property_analyses_comprehensive) ──────────
    const hasSummary = !!(comprehensive?.summary && comprehensive.summary.length > 30);
    chk(checks, 'compSummary', 'Narrative Summary', 'error', 'ai_comprehensive', hasSummary,
        hasSummary ? `${comprehensive.summary.length} chars` : 'missing');
    chk(checks, 'compRisks', 'Risks & Considerations', 'warn', 'ai_comprehensive', !!(comprehensive?.risks_considerations),
        comprehensive?.risks_considerations ? 'present' : 'missing');

    // ── 10. Interior Summary (inside property_analyses_comprehensive) ─────────
    const intSum = comprehensive?.interior_summary;
    const hasIntSummary = !!(intSum?.interior_summary && intSum.interior_summary.length > 20);
    const hasRoomsSummary = !!(intSum?.rooms_summary && intSum.rooms_summary.length > 20);
    const hasVibe = !!(intSum?.vibe);
    const hasTags = Array.isArray(intSum?.objective_tags) && intSum.objective_tags.length > 0;
    chk(checks, 'intSummary', 'Interior Summary', 'error', 'ai_comprehensive', hasIntSummary,
        hasIntSummary ? `${intSum.interior_summary.length} chars` : 'missing');
    chk(checks, 'intRooms', 'Rooms Summary', 'error', 'ai_comprehensive', hasRoomsSummary,
        hasRoomsSummary ? `${intSum.rooms_summary.length} chars` : 'missing');
    chk(checks, 'intVibe', 'Interior Vibe', 'warn', 'ai_comprehensive', hasVibe,
        hasVibe ? intSum.vibe : 'missing');
    chk(checks, 'intTags', 'Interior Tags', 'warn', 'ai_comprehensive', hasTags,
        hasTags ? `${intSum.objective_tags.length} tags` : 'missing');

    // ── 11. Schools Summary (inside property_analyses_comprehensive) ──────────
    chk(checks, 'schoolsSummary', 'Schools Summary (Narrative)', 'warn', 'ai_comprehensive', !!(comprehensive?.schools_summary),
        comprehensive?.schools_summary ? 'present' : 'missing');

    // Schools data on the property (from RapidAPI)
    const schoolCount = Array.isArray(prop?.schools) ? prop.schools.length : 0;
    chk(checks, 'nearbySchools', 'Nearby Schools Data', 'warn', 'rapidapi', schoolCount > 0,
        schoolCount > 0 ? `${schoolCount} schools` : 'no schools on property');

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
            const words = school.name.trim().split(/\s+/);
            const w1 = words[0] || '';
            const w2 = words[1] || '';
            const key = `${w1}_${w2}_${prop.city}_${prop.state || ''}`
                .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')
                .replace(/^_|_$/g, '').substring(0, 120);
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

    // ── 12. Lifestyle Insights (inside property_analyses_comprehensive) ────────
    const life = comprehensive?.lifestyle_insights;
    const hasLifestyle = !!(life?.outdoor && life?.family);
    chk(checks, 'lifestyleInsights', 'Lifestyle Insights', 'warn', 'ai_comprehensive', hasLifestyle,
        hasLifestyle ? 'present (outdoor, family, etc.)' : 'missing');

    // ── 13. Property Investment Research (property_investment_research) ───────
    const hasSTR = !!(investment?.str_performance?.adr);
    const hasLTR = !!(investment?.ltr_analysis?.monthly_rent);
    chk(checks, 'investmentSTR', 'STR Performance (ADR)', 'warn', 'ai_investment', hasSTR,
        hasSTR ? `ADR: ${investment.str_performance.adr}` : 'missing');
    chk(checks, 'investmentLTR', 'LTR Analysis (Rent)', 'warn', 'ai_investment', hasLTR,
        hasLTR ? `Rent: ${investment.ltr_analysis.monthly_rent}` : 'missing');

    // ── 16. Risk Scores (properties doc — from RapidAPI) ──────────────────────
    chk(checks, 'floodRisk', 'Flood Risk Score', 'warn', 'rapidapi', prop?.floodRiskScore != null,
        prop?.floodRiskScore != null ? String(prop.floodRiskScore) : 'missing');
    chk(checks, 'fireRisk', 'Fire Risk Score', 'warn', 'rapidapi', prop?.fireRiskScore != null,
        prop?.fireRiskScore != null ? String(prop.fireRiskScore) : 'missing');
    chk(checks, 'heatRisk', 'Heat Risk Score', 'warn', 'rapidapi', prop?.heatRiskScore != null,
        prop?.heatRiskScore != null ? String(prop.heatRiskScore) : 'missing');
    chk(checks, 'windRisk', 'Wind Risk Score', 'warn', 'rapidapi', prop?.windRiskScore != null,
        prop?.windRiskScore != null ? String(prop.windRiskScore) : 'missing');

    // ── 17. Broadband / Connectivity (on google_environmental_data or properties) ─
    const bb = env?.broadband;
    chk(checks, 'broadband', 'Broadband Data', 'warn', 'environmental', !!(bb?.providerCount),
        bb ? `${bb.providerCount} ISPs, ↓${bb.topDownloadMbps || '?'} Mbps${bb.hasFiber ? ', Fiber ✓' : ''}${bb.has5G ? ', 5G ✓' : ''}` : 'not fetched');

    // ── 18. Drought Data (on google_environmental_data or properties) ──────────
    const droughtData = env?.drought;
    chk(checks, 'drought', 'Drought Monitor', 'warn', 'environmental', !!(droughtData?.currentLevel != null || droughtData?.status),
        droughtData ? `${droughtData.status || droughtData.currentLevel || 'present'}` : 'not fetched');

    // ── 19. EV Charger Data (on google_environmental_data or properties) ──────
    const evData = env?.evChargers;
    const evCount = Array.isArray(evData) ? evData.length : (evData?.stations?.length || 0);
    chk(checks, 'evChargers', 'EV Charging Stations', 'warn', 'environmental', evCount > 0,
        evCount > 0 ? `${evCount} stations nearby` : 'not fetched');

    // ── 20. ResoFacts — Property Details ──────────────────────────────────────
    const reso = prop?.resoFacts;
    const resoFieldCount = reso ? Object.values(reso).filter((v: any) => v != null && v !== '').length : 0;
    chk(checks, 'resoFacts', 'Property Details (ResoFacts)', 'error', 'rapidapi', resoFieldCount >= 3,
        resoFieldCount > 0 ? `${resoFieldCount} fields populated` : 'missing');

    // ── 21. HOA Info ──────────────────────────────────────────────────────────
    // Only flag if the property is likely in an HOA (condo, townhouse, or fee field present)
    const isHoaExpected = prop?.homeType?.toLowerCase()?.includes('condo') || prop?.homeType?.toLowerCase()?.includes('town');
    const hasHoa = !!(prop?.hoa?.fee);
    if (isHoaExpected) {
        chk(checks, 'hoaInfo', 'HOA Info', 'warn', 'rapidapi', hasHoa,
            hasHoa ? prop.hoa.fee : 'expected for this property type but missing');
    }

    // ── 22. Price History ─────────────────────────────────────────────────────
    const phCount = Array.isArray(prop?.priceHistory) ? prop.priceHistory.length : 0;
    chk(checks, 'priceHistory', 'Price History', 'warn', 'rapidapi', phCount > 0,
        phCount > 0 ? `${phCount} events` : 'missing');

    // ── 23. Neighborhood Identity (Gemini + ArcGIS) ───────────────────────────
    const nid = prop?.neighborhood_identity;
    chk(checks, 'neighborhoodIdentity', 'Neighborhood Identity', 'warn', 'ai_comprehensive', !!(nid?.resolved_name),
        nid?.resolved_name ? `${nid.resolved_name}${nid.city_plan_data?.specific_plan ? ` (${nid.city_plan_data.specific_plan})` : ''}` : 'not resolved');

    // ── 24. Lifestyle Fit (3 persona verdicts) ────────────────────────────────
    const lf = comprehensive?.lifestyle_fit;
    const lfComplete = !!(lf?.working_professionals?.verdict && lf?.families_with_kids?.verdict && lf?.seniors?.verdict);
    chk(checks, 'lifestyleFit', 'Lifestyle Fit Analysis', 'warn', 'ai_comprehensive', lfComplete,
        lfComplete ? `WP: ${lf.working_professionals.verdict}, Fam: ${lf.families_with_kids.verdict}, Sr: ${lf.seniors.verdict}` : 'missing or incomplete');

    // ── 25. Attribution (Agent / Brokerage) ───────────────────────────────────
    const attr = prop?.attribution;
    chk(checks, 'attribution', 'Listing Attribution', 'error', 'rapidapi', !!(attr?.listingAgentName || attr?.brokerageName),
        attr?.listingAgentName ? `${attr.listingAgentName}${attr.brokerageName ? ` — ${attr.brokerageName}` : ''}` : 'missing');

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
    const allSchoolAnalyses: Record<string, any> = {};

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
        envSnap.forEach(d => {
            const envData = d.data() as any;
            // Backward compat: normalize old field name
            if (envData.neighborhoodPlaces && !envData.google_places) {
                envData.google_places = envData.neighborhoodPlaces;
            }
            allEnv[d.id] = envData;
        });
        compSnap.forEach(d => { allComp[d.id] = d.data(); });
        investSnap.forEach(d => { allInvest[d.id] = d.data(); });
        done += chunk.length;
        onProgress?.(done, zpids.length);
    }));

    // Skip zpids that have no property document (never ingested / no real ZPID)
    const resolvedZpids = zpids.filter(zpid => !!allProps[zpid]);

    // Batch-fetch school analyses: derive cache keys from each property's schools list
    const schoolCacheKeys = new Set<string>();
    for (const zpid of resolvedZpids) {
        const prop = allProps[zpid];
        if (Array.isArray(prop?.schools) && prop?.city) {
            for (const school of prop.schools) {
                const words = school.name.trim().split(/\s+/);
                const w1 = words[0] || '';
                const w2 = words[1] || '';
                const key = `${w1}_${w2}_${prop.city}_${prop.state || ''}`
                    .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')
                    .replace(/^_|_$/g, '').substring(0, 120);
                schoolCacheKeys.add(key);
            }
        }
    }

    // Fetch school analyses in chunks
    if (schoolCacheKeys.size > 0) {
        const schoolKeyArray = Array.from(schoolCacheKeys);
        const schoolChunks: string[][] = [];
        for (let i = 0; i < schoolKeyArray.length; i += CHUNK) schoolChunks.push(schoolKeyArray.slice(i, i + CHUNK));
        await Promise.all(schoolChunks.map(async (chunk) => {
            const snap = await getDocs(query(collection(db!, 'schools_intelligence'), where(documentId(), 'in', chunk)));
            snap.forEach(d => { allSchoolAnalyses[d.id] = d.data(); });
        }));
    }

    // Fetch city-level data (community_pulse, deep_investment_research)
    // These are keyed by cityStateKey (e.g. "pleasanton-ca"), not by zpid
    const cityDataMap: Record<string, { communityPulse?: any; deepInvestmentResearch?: any }> = {};
    const cityKeysSet = new Set<string>();
    // Build case variants (mirrors getCityDocWithFallback logic)
    const variantToCanonical: Record<string, string> = {};
    for (const zpid of resolvedZpids) {
        const prop = allProps[zpid];
        const key = generateCityStateKey(prop?.city, prop?.state);
        if (key) {
            cityKeysSet.add(key);
            // Generate case variants: pleasanton-ca, pleasanton-CA
            const parts = key.split('-');
            if (parts.length === 2) {
                const [city, state] = parts;
                const variants = [
                    `${city}-${state}`,                         // as-is
                    `${city}-${state.toUpperCase()}`,            // pleasanton-CA
                    `${city.toLowerCase()}-${state.toUpperCase()}`, // pleasanton-CA
                    `${city.toLowerCase()}-${state.toLowerCase()}`, // pleasanton-ca
                ];
                for (const v of variants) {
                    cityKeysSet.add(v);
                    variantToCanonical[v] = key;
                }
            }
            variantToCanonical[key] = key;
        }
    }
    const cityKeys = Array.from(cityKeysSet);
    if (cityKeys.length > 0) {
        const cityChunks: string[][] = [];
        for (let i = 0; i < cityKeys.length; i += CHUNK) cityChunks.push(cityKeys.slice(i, i + CHUNK));
        await Promise.all(cityChunks.map(async (chunk) => {
            const [cpSnap, dirSnap] = await Promise.all([
                getDocs(query(collection(db!, 'community_pulse'), where(documentId(), 'in', chunk))),
                getDocs(query(collection(db!, 'deep_investment_research'), where(documentId(), 'in', chunk))),
            ]);
            cpSnap.forEach(d => {
                const canonical = variantToCanonical[d.id] || d.id;
                if (!cityDataMap[canonical]) cityDataMap[canonical] = {};
                cityDataMap[canonical].communityPulse = d.data();
            });
            dirSnap.forEach(d => {
                const canonical = variantToCanonical[d.id] || d.id;
                if (!cityDataMap[canonical]) cityDataMap[canonical] = {};
                cityDataMap[canonical].deepInvestmentResearch = d.data();
            });
        }));
    }

    const results = resolvedZpids.map(zpid => {
        const prop = allProps[zpid];
        const cityKey = generateCityStateKey(prop?.city, prop?.state) || '';
        return runChecks(
            zpid,
            prop || null,
            allAssets[zpid] || null,
            allVisual[zpid] || null,
            allEnv[zpid] || null,
            allComp[zpid] || null,
            allInvest[zpid] || null,
            allSchoolAnalyses,
            addressMap?.[zpid],
            cityDataMap[cityKey] || undefined
        );
    });

    const passedCount = results.filter(r => r.passed).length;

    return {
        totalProperties: resolvedZpids.length,
        passedCount,
        failedCount: resolvedZpids.length - passedCount,
        results,
        ranAt: new Date(),
    };
};
