/**
 * Pipeline Check Configuration
 *
 * Single source of truth for smoke check ID groupings and source routing.
 * Imported by:
 *   services/preloadService.ts  — post-pipeline smoke retry logic
 *   services/smokeTest.ts       — CheckSource type (re-exported here)
 *   components/client-hub/CityDataTab.tsx — bulk healing phase routing
 *
 * When you add a new smoke check in smokeTest.ts, register its ID here
 * in the appropriate group so the pipeline knows how to heal it.
 */

// ── Check Source classification ───────────────────────────────────────────────
// Maps directly to the CheckSource union type in smokeTest.ts.
// Used by CityDataTab to route failing properties to the right healing phase.

/** Sources that require Gemini AI (cost-incurring, batched, image-gated). */
export const GEMINI_CHECK_SOURCES = new Set([
    'ai_visual',
    'ai_comprehensive',
    'ai_investment',
]);

/** Sources that can be healed without Gemini (free API calls or computed). */
export const NON_GEMINI_CHECK_SOURCES = new Set([
    'rapidapi',
    'environmental',
    'parcel',
    'assets',
    'computed',
]);

// ── Check ID groupings ────────────────────────────────────────────────────────
// Used by the post-pipeline smoke retry in runFullIntelligencePipeline.
// Each group maps to a specific remediation action.

/** Smoke check IDs that require Gemini visual analysis to heal. */
export const VISUAL_CHECK_IDS = [
    'aiVisualInterior',
    'aiVisualExterior',
    'designStyle',
    'conditionFinish',
    'roomHighlights',
    'curbAppeal',
    'backyardPatio',
    'privacyVisual',
    'orientationAi',
    'customAnalysis',
];

/** Smoke check IDs that require the comprehensive narrative pipeline to heal. */
export const NARRATIVE_CHECK_IDS = [
    'compSummary',
    'compRisks',
    'intSummary',
    'intRooms',
    'intVibe',
    'intTags',
    'schoolsSummary',
    'lifestyleInsights',
    'lifestyleFit',
    'schoolAnalyses',
    'schoolQuality',
];

/** Smoke check IDs for neighborhood/spatial analysis. */
export const NEIGHBORHOOD_CHECK_IDS = [
    'aiNeighborhood',
    'neighborhoodIdentity',
];
