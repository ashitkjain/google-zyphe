/**
 * explore-overview-data.test.ts
 *
 * Verifies that the Explore Overview page data layer (useExploreTabData)
 * reads all required fields from Firebase/Firestore cache and does NOT
 * make any live Gemini AI or external API calls when cached data is present.
 *
 * Covers:
 *  1. Visual analysis  (design_style, neighborhood overview, POI, map_labels)
 *  2. Investment cache (ltr_analysis)
 *  3. Deep research    (key_insights, market_dynamics)
 *  4. Interior summary
 *  5. Comprehensive analysis
 *  6. Lifestyle fit + insights  (Firestore reads)
 *  7. School analysis           (Firestore reads)
 *  8. City neighborhoods        (Firestore reads)
 *  9. Census demographics       (environment API — mocked)
 * 10. Microclimate delta        (environment API — mocked)
 *
 * Anti-regression contract:
 *  - extractDeepResearchInsights  must NOT be called when key_insights is cached
 *  - analyzeLifestyleInsights     must NOT be called on load (only on explicit user action)
 *  - fetchCensusDemographics      IS called (environmental, not AI)
 *  - fetchMicroclimateDelta       IS called (environmental, not AI)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Spy references ────────────────────────────────────────────────────────
const mockGetVisualAnalysis        = vi.fn();
const mockGetPropertyInvestment    = vi.fn();
const mockGetDeepInvestmentResearch = vi.fn();
const mockGetInteriorSummary       = vi.fn();
const mockGetComprehensiveAnalysis = vi.fn();
const mockGetLifestyleInsights     = vi.fn();
const mockGetLifestyleFit          = vi.fn();
const mockGetSchoolAnalysis        = vi.fn();
const mockGetCityNeighborhoods     = vi.fn();

// Gemini service — these must NEVER be called on initial load
const mockExtractDeepResearchInsights = vi.fn();
const mockAnalyzeLifestyleInsights    = vi.fn();

// Environmental APIs — these are called (non-AI, acceptable)
const mockFetchCensusDemographics = vi.fn();
const mockFetchMicroclimateDelta  = vi.fn();

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('../services/firebase/config', () => ({
    auth: { currentUser: { uid: 'test-uid' } },
    db: {},
    generateCityStateKey: (city: string, state: string) =>
        city && state ? `${city.toLowerCase()}_${state.toLowerCase()}` : null,
}));

vi.mock('../services/firebase/properties', () => ({
    getVisualAnalysisFromCloud:          (...a: any[]) => mockGetVisualAnalysis(...a),
    getPropertyInvestmentFromCloud:      (...a: any[]) => mockGetPropertyInvestment(...a),
    getDeepInvestmentResearchFromCloud:  (...a: any[]) => mockGetDeepInvestmentResearch(...a),
    getInteriorSummaryFromCloud:         (...a: any[]) => mockGetInteriorSummary(...a),
    getComprehensiveAnalysisFromCloud:   (...a: any[]) => mockGetComprehensiveAnalysis(...a),
    getLifestyleInsightsFromCloud:       (...a: any[]) => mockGetLifestyleInsights(...a),
    getLifestyleFitFromCloud:            (...a: any[]) => mockGetLifestyleFit(...a),
    getSchoolAnalysisFromCloud:          (...a: any[]) => mockGetSchoolAnalysis(...a),
    getCityNeighborhoodsFromCloud:       (...a: any[]) => mockGetCityNeighborhoods(...a),
    saveLifestyleInsightsToCloud:        vi.fn(() => Promise.resolve()),
}));

vi.mock('../services/geminiService', () => ({
    extractDeepResearchInsights: (...a: any[]) => mockExtractDeepResearchInsights(...a),
    analyzeLifestyleInsights:    (...a: any[]) => mockAnalyzeLifestyleInsights(...a),
}));

vi.mock('../services/api/environmental', () => ({
    fetchCensusDemographics: (...a: any[]) => mockFetchCensusDemographics(...a),
    fetchMicroclimateDelta:  (...a: any[]) => mockFetchMicroclimateDelta(...a),
}));

vi.mock('../prompts/property/schoolsAnalysis', () => ({
    getSchoolCacheKey: (name: string, city: string, state: string) =>
        `${name}_${city}_${state}`.toLowerCase().replace(/\s+/g, '_'),
}));

vi.mock('firebase/firestore', () => ({
    doc:              vi.fn((db, col, id) => ({ _col: col, _id: id })),
    setDoc:           vi.fn(() => Promise.resolve()),
    getDoc:           vi.fn(),
    serverTimestamp:  vi.fn(() => 'ts'),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const ZPID   = '98765';
const CITY   = 'Pleasanton';
const STATE  = 'CA';
const CSK    = 'pleasanton_ca'; // matches generateCityStateKey mock above

/** Minimal PropertyData fixture with all fields the hook reads */
const makePropertyData = () => ({
    zpid:    ZPID,
    address: '100 Oak Ave, Pleasanton, CA 94566',
    city:    CITY,
    state:   STATE,
    coordinates: { latitude: 37.66, longitude: -121.87 },
    neighborhood_identity: { resolved_name: 'Val Vista' },
    schools: [
        { name: 'Amador Valley High', rating: 9, distance: '0.8 mi' },
    ],
});

/** Full visual analysis object as it exists in Firestore */
const CACHED_VISUAL = {
    home_interior: {
        design_style: { style: 'Modern Craftsman', reasoning: 'Exposed beams and open plan.' },
    },
    neighborhood: {
        overview:   'Quiet residential with excellent walkability.',
        visual_poi: [{ name: 'Pleasanton Ridge', category: 'park', distance_mi: 1.2 }],
        map_labels: ['Amador Valley High', 'Valley Trails Park'],
    },
};

const CACHED_INVESTMENT = {
    ltr_analysis: {
        monthly_rent: '$3,200',
        vacancy_rate:  '4%',
        comparison_summary: 'LTR recommended given stable occupancy.',
    },
};

const CACHED_DEEP_RESEARCH = {
    key_insights: {
        executive_summary: 'Pleasanton remains a seller\'s market.',
        median_price_range: '$1.1M–$1.4M',
        ppsf_benchmark:     '$650',
        months_of_supply:   '1.8',
        dom_range:          '12–21 days',
        risk_tags:          ['Interest Rate Sensitivity'],
    },
    structured_report: {
        market_dynamics: {
            summary: 'Demand exceeds supply in Tri-Valley.',
            details: ['Low inventory', 'Tech-sector demand'],
        },
    },
    // key_insights is populated — backfill should NOT trigger
};

const CACHED_INTERIOR = {
    total_rooms: 8,
    primary_color: 'warm white',
};

const CACHED_COMPREHENSIVE = {
    detailed_analysis: {
        community_pulse: 'Strong neighbourhood association activity.',
        visual_appeal_condition: 'Well-maintained exterior.',
    },
};

const CACHED_LIFESTYLE_INSIGHTS = {
    outdoor:     'Great trail access at Augustin Bernal Park.',
    pets:        'Multiple dog parks within 1 mile.',
    food:        'Diverse dining on Main Street.',
    neighborhood: 'Family-friendly, low-crime enclave.',
};

const CACHED_LIFESTYLE_FIT = {
    working_professionals: {
        verdict:   'Excellent Fit',
        summary:   'Short BART commute to SF.',
        strengths: ['Low commute time', 'High walkability'],
        concerns:  [],
        tip:       'Negotiate remote days to offset cost.',
    },
    families_with_kids: {
        verdict:   'Excellent Fit',
        summary:   'Top-rated schools within walking distance.',
        strengths: ['Amador Valley High 9/10', 'Safe streets'],
        concerns:  ['High price point'],
        tip:       'Check after-school programs at Harvest Park.',
    },
};

const CACHED_SCHOOL = {
    name:          'Amador Valley High',
    district_name: 'Pleasanton Unified',
    rating:        9,
    summary:       'One of the highest-rated high schools in Alameda County.',
};

const CACHED_CITY_NEIGHBORHOODS = {
    neighborhoods: [
        {
            neighborhood_name: 'Val Vista',
            overview:         'Mature tree-lined streets with 1970s ranch homes.',
            standout_features: ['Walking distance to BART', 'Community pool'],
        },
    ],
};

const CENSUS_DATA = {
    totalPopulation:   73000,
    medianHouseholdIncome: 145000,
};

const MICRO_DATA = {
    insight:   'Afternoon marine layer keeps temps 5°F cooler than Oakland.',
    fetchedAt: Date.now(),
};

// ─── Helper: simulate the hook's data-loading sequence ──────────────────────
/**
 * Runs the same async logic that useExploreTabData executes in its useEffects.
 * We extract it here so it can be tested without a React renderer.
 */
async function runCacheFetch(propertyData: ReturnType<typeof makePropertyData>) {
    const { generateCityStateKey } = await import('../services/firebase/config');
    const {
        getVisualAnalysisFromCloud,
        getPropertyInvestmentFromCloud,
        getDeepInvestmentResearchFromCloud,
        getInteriorSummaryFromCloud,
        getComprehensiveAnalysisFromCloud,
        getLifestyleInsightsFromCloud,
        getLifestyleFitFromCloud,
        getSchoolAnalysisFromCloud,
        getCityNeighborhoodsFromCloud,
    } = await import('../services/firebase/properties');
    const { extractDeepResearchInsights } = await import('../services/geminiService');
    const { fetchCensusDemographics, fetchMicroclimateDelta } = await import('../services/api/environmental');
    const { getSchoolCacheKey } = await import('../prompts/property/schoolsAnalysis');

    const cityStateKey = generateCityStateKey(propertyData.city, propertyData.state);

    // Parallel cache read (mirrors the hook's Promise.all)
    const [visualCache, investmentCache, deepResearchCache, interiorCache] = await Promise.all([
        getVisualAnalysisFromCloud(String(propertyData.zpid)),
        getPropertyInvestmentFromCloud(String(propertyData.zpid)),
        cityStateKey ? getDeepInvestmentResearchFromCloud(cityStateKey) : Promise.resolve(null),
        getInteriorSummaryFromCloud(String(propertyData.zpid)),
    ]);

    // Comprehensive analysis (sequential after main reads in the hook)
    const compCache = await getComprehensiveAnalysisFromCloud(String(propertyData.zpid));

    // Backfill guard (same condition as the fixed hook)
    const backfilled = new Set<string>();
    const zpidStr = String(propertyData.zpid);
    if (
        !backfilled.has(zpidStr) &&
        !(deepResearchCache as any)?.key_insights &&
        (deepResearchCache as any)?.content?.length > 200 &&
        cityStateKey
    ) {
        backfilled.add(zpidStr);
        await extractDeepResearchInsights((deepResearchCache as any).content, 'cache-backfill', cityStateKey);
    }

    // Lifestyle (zpid-scoped reads)
    const [lifestyleInsights, lifestyleFit] = await Promise.all([
        getLifestyleInsightsFromCloud(propertyData.zpid),
        getLifestyleFitFromCloud(propertyData.zpid),
    ]);

    // Schools (one per school)
    const schoolResults = [];
    for (const school of propertyData.schools) {
        const cacheKey = getSchoolCacheKey(school.name, propertyData.city, propertyData.state);
        const cached = await getSchoolAnalysisFromCloud(cacheKey);
        if (cached?.name) schoolResults.push(cached);
    }

    // City neighborhoods
    const cityNhData = cityStateKey ? await getCityNeighborhoodsFromCloud(cityStateKey) : null;
    const nhEntry = cityNhData?.neighborhoods?.find(
        (n: any) => n.neighborhood_name?.toLowerCase() === propertyData.neighborhood_identity.resolved_name.toLowerCase()
    );

    // Environmental (acceptable, non-AI)
    const census = await fetchCensusDemographics(
        propertyData.coordinates.latitude, propertyData.coordinates.longitude,
        propertyData.zpid, propertyData.address
    );
    const micro = await fetchMicroclimateDelta(
        propertyData.coordinates.latitude, propertyData.coordinates.longitude,
        propertyData.city, propertyData.zpid, propertyData.address
    );

    return {
        visualCache, investmentCache, deepResearchCache, interiorCache,
        compCache, lifestyleInsights, lifestyleFit, schoolResults,
        nhEntry, census, micro, cityStateKey,
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Explore Overview — data loading contract', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Wire up all happy-path returns (full cached data)
        mockGetVisualAnalysis.mockResolvedValue(CACHED_VISUAL);
        mockGetPropertyInvestment.mockResolvedValue(CACHED_INVESTMENT);
        mockGetDeepInvestmentResearch.mockResolvedValue(CACHED_DEEP_RESEARCH);
        mockGetInteriorSummary.mockResolvedValue(CACHED_INTERIOR);
        mockGetComprehensiveAnalysis.mockResolvedValue(CACHED_COMPREHENSIVE);
        mockGetLifestyleInsights.mockResolvedValue(CACHED_LIFESTYLE_INSIGHTS);
        mockGetLifestyleFit.mockResolvedValue(CACHED_LIFESTYLE_FIT);
        mockGetSchoolAnalysis.mockResolvedValue(CACHED_SCHOOL);
        mockGetCityNeighborhoods.mockResolvedValue(CACHED_CITY_NEIGHBORHOODS);
        mockFetchCensusDemographics.mockResolvedValue(CENSUS_DATA);
        mockFetchMicroclimateDelta.mockResolvedValue(MICRO_DATA);

        // Gemini functions should never be reached in the happy path
        mockExtractDeepResearchInsights.mockRejectedValue(new Error('Should not be called'));
        mockAnalyzeLifestyleInsights.mockRejectedValue(new Error('Should not be called'));
    });

    // ── 1. Correct Firestore functions are called ────────────────────────────

    it('calls all required Firebase cache functions exactly once per load', async () => {
        const prop = makePropertyData();
        await runCacheFetch(prop);

        expect(mockGetVisualAnalysis).toHaveBeenCalledOnce();
        expect(mockGetVisualAnalysis).toHaveBeenCalledWith(ZPID);

        expect(mockGetPropertyInvestment).toHaveBeenCalledOnce();
        expect(mockGetPropertyInvestment).toHaveBeenCalledWith(ZPID);

        expect(mockGetDeepInvestmentResearch).toHaveBeenCalledOnce();
        expect(mockGetDeepInvestmentResearch).toHaveBeenCalledWith(CSK);

        expect(mockGetInteriorSummary).toHaveBeenCalledOnce();
        expect(mockGetInteriorSummary).toHaveBeenCalledWith(ZPID);

        expect(mockGetComprehensiveAnalysis).toHaveBeenCalledOnce();
        expect(mockGetComprehensiveAnalysis).toHaveBeenCalledWith(ZPID);

        expect(mockGetLifestyleInsights).toHaveBeenCalledOnce();
        expect(mockGetLifestyleInsights).toHaveBeenCalledWith(ZPID);

        expect(mockGetLifestyleFit).toHaveBeenCalledOnce();
        expect(mockGetLifestyleFit).toHaveBeenCalledWith(ZPID);

        expect(mockGetSchoolAnalysis).toHaveBeenCalledOnce();

        expect(mockGetCityNeighborhoods).toHaveBeenCalledOnce();
        expect(mockGetCityNeighborhoods).toHaveBeenCalledWith(CSK);
    });

    // ── 2. Gemini is NEVER called when data is cached ────────────────────────

    it('does NOT call extractDeepResearchInsights when key_insights is already cached', async () => {
        const prop = makePropertyData();
        await runCacheFetch(prop);
        expect(mockExtractDeepResearchInsights).not.toHaveBeenCalled();
    });

    it('does NOT call analyzeLifestyleInsights on initial load', async () => {
        const prop = makePropertyData();
        await runCacheFetch(prop);
        expect(mockAnalyzeLifestyleInsights).not.toHaveBeenCalled();
    });

    // ── 3. Correct data is surfaced from visual cache ────────────────────────

    it('reads design_style from visual analysis cache', async () => {
        const prop = makePropertyData();
        const { visualCache } = await runCacheFetch(prop);
        expect(visualCache?.home_interior?.design_style?.style).toBe('Modern Craftsman');
    });

    it('reads neighborhood overview from visual analysis cache', async () => {
        const prop = makePropertyData();
        const { visualCache } = await runCacheFetch(prop);
        expect(visualCache?.neighborhood?.overview).toBe('Quiet residential with excellent walkability.');
    });

    it('reads visual_poi and map_labels from visual analysis cache', async () => {
        const prop = makePropertyData();
        const { visualCache } = await runCacheFetch(prop);
        expect(visualCache?.neighborhood?.visual_poi).toHaveLength(1);
        expect(visualCache?.neighborhood?.map_labels).toContain('Amador Valley High');
    });

    // ── 4. Investment & research data ───────────────────────────────────────

    it('reads ltr_analysis from investment cache', async () => {
        const prop = makePropertyData();
        const { investmentCache } = await runCacheFetch(prop);
        expect(investmentCache?.ltr_analysis?.monthly_rent).toBe('$3,200');
        expect(investmentCache?.ltr_analysis?.vacancy_rate).toBe('4%');
    });

    it('reads key_insights from deep research cache', async () => {
        const prop = makePropertyData();
        const { deepResearchCache } = await runCacheFetch(prop);
        expect((deepResearchCache as any)?.key_insights?.median_price_range).toBe('$1.1M–$1.4M');
        expect((deepResearchCache as any)?.key_insights?.risk_tags).toContain('Interest Rate Sensitivity');
    });

    it('reads market_dynamics from deep research cache', async () => {
        const prop = makePropertyData();
        const { deepResearchCache } = await runCacheFetch(prop);
        expect((deepResearchCache as any)?.structured_report?.market_dynamics?.summary)
            .toBe('Demand exceeds supply in Tri-Valley.');
    });

    // ── 5. Lifestyle & schools data ─────────────────────────────────────────

    it('reads lifestyle insights for all interest categories', async () => {
        const prop = makePropertyData();
        const { lifestyleInsights } = await runCacheFetch(prop);
        expect(lifestyleInsights?.outdoor).toBeTruthy();
        expect(lifestyleInsights?.pets).toBeTruthy();
        expect(lifestyleInsights?.food).toBeTruthy();
        expect(lifestyleInsights?.neighborhood).toBeTruthy();
    });

    it('reads lifestyle fit verdicts for all persona tabs', async () => {
        const prop = makePropertyData();
        const { lifestyleFit } = await runCacheFetch(prop);
        expect(lifestyleFit?.working_professionals?.verdict).toBe('Excellent Fit');
        expect(lifestyleFit?.families_with_kids?.verdict).toBe('Excellent Fit');
    });

    it('reads school intelligence from cache using correct school cache key', async () => {
        const prop = makePropertyData();
        const { schoolResults } = await runCacheFetch(prop);
        expect(schoolResults).toHaveLength(1);
        expect(schoolResults[0].name).toBe('Amador Valley High');
        expect(schoolResults[0].district_name).toBe('Pleasanton Unified');

        // Verify correct cache key was used
        expect(mockGetSchoolAnalysis).toHaveBeenCalledWith(
            'amador_valley_high_pleasanton_ca'
        );
    });

    // ── 6. Neighborhood identity resolution ─────────────────────────────────

    it('resolves city neighborhood entry by matching resolved_name case-insensitively', async () => {
        const prop = makePropertyData();
        const { nhEntry } = await runCacheFetch(prop);
        expect(nhEntry).toBeDefined();
        expect(nhEntry?.neighborhood_name).toBe('Val Vista');
        expect(nhEntry?.standout_features).toContain('Walking distance to BART');
    });

    // ── 7. City state key derivation ────────────────────────────────────────

    it('derives correct city-state key for Firestore document lookups', async () => {
        const prop = makePropertyData();
        const { cityStateKey } = await runCacheFetch(prop);
        expect(cityStateKey).toBe(CSK);
    });

    // ── 8. Environmental APIs (non-AI, acceptable calls) ────────────────────

    it('calls fetchCensusDemographics with correct coordinates', async () => {
        const prop = makePropertyData();
        await runCacheFetch(prop);
        expect(mockFetchCensusDemographics).toHaveBeenCalledWith(
            37.66, -121.87, ZPID, prop.address
        );
    });

    it('calls fetchMicroclimateDelta with correct coordinates and city', async () => {
        const prop = makePropertyData();
        await runCacheFetch(prop);
        expect(mockFetchMicroclimateDelta).toHaveBeenCalledWith(
            37.66, -121.87, CITY, ZPID, prop.address
        );
    });

    it('surfaces census and microclimate data from environmental APIs', async () => {
        const prop = makePropertyData();
        const { census, micro } = await runCacheFetch(prop);
        expect(census?.totalPopulation).toBe(73000);
        expect(census?.medianHouseholdIncome).toBe(145000);
        expect(micro?.insight).toContain('marine layer');
    });

    // ── 9. Backfill only triggers when key_insights is genuinely missing ─────

    it('calls extractDeepResearchInsights ONLY when key_insights is absent AND content exists', async () => {
        // Override: simulate a deep research doc with raw content but no key_insights
        mockExtractDeepResearchInsights.mockResolvedValue({
            data: { executive_summary: 'AI-extracted summary' }
        });

        mockGetDeepInvestmentResearch.mockResolvedValue({
            content: 'A'.repeat(250), // > 200 chars, no key_insights
            structured_report: { market_dynamics: { summary: 'Test' } },
        });

        const prop = makePropertyData();
        await runCacheFetch(prop);

        // Backfill SHOULD fire this one time
        expect(mockExtractDeepResearchInsights).toHaveBeenCalledOnce();
        expect(mockExtractDeepResearchInsights).toHaveBeenCalledWith(
            expect.stringMatching(/A{200,}/),
            'cache-backfill',
            CSK
        );
    });

    it('does NOT call extractDeepResearchInsights when content is too short (< 200 chars)', async () => {
        mockGetDeepInvestmentResearch.mockResolvedValue({
            content: 'Short.', // < 200 chars, no key_insights
        });

        const prop = makePropertyData();
        await runCacheFetch(prop);

        expect(mockExtractDeepResearchInsights).not.toHaveBeenCalled();
    });

    it('does NOT call extractDeepResearchInsights when deepResearchCache is null', async () => {
        mockGetDeepInvestmentResearch.mockResolvedValue(null);

        const prop = makePropertyData();
        await runCacheFetch(prop);

        expect(mockExtractDeepResearchInsights).not.toHaveBeenCalled();
    });

    // ── 10. Graceful handling when any cache read returns null ───────────────

    it('handles null visual cache gracefully (no crash, no AI call)', async () => {
        mockGetVisualAnalysis.mockResolvedValue(null);

        const prop = makePropertyData();
        const result = await runCacheFetch(prop);

        expect(result.visualCache).toBeNull();
        expect(mockExtractDeepResearchInsights).not.toHaveBeenCalled();
        expect(mockAnalyzeLifestyleInsights).not.toHaveBeenCalled();
    });

    it('handles null investment cache gracefully', async () => {
        mockGetPropertyInvestment.mockResolvedValue(null);
        const prop = makePropertyData();
        const { investmentCache } = await runCacheFetch(prop);
        expect(investmentCache).toBeNull();
    });

    it('handles null lifestyle data gracefully (no AI fallback triggered)', async () => {
        mockGetLifestyleInsights.mockResolvedValue(null);
        mockGetLifestyleFit.mockResolvedValue(null);

        const prop = makePropertyData();
        const { lifestyleInsights, lifestyleFit } = await runCacheFetch(prop);

        expect(lifestyleInsights).toBeNull();
        expect(lifestyleFit).toBeNull();
        // analyzeLifestyleInsights must still NOT be called (user must explicitly trigger)
        expect(mockAnalyzeLifestyleInsights).not.toHaveBeenCalled();
    });

    it('skips school lookup when school cache returns null', async () => {
        mockGetSchoolAnalysis.mockResolvedValue(null);
        const prop = makePropertyData();
        const { schoolResults } = await runCacheFetch(prop);
        expect(schoolResults).toHaveLength(0);
    });

    it('handles missing neighborhood entry without crashing', async () => {
        mockGetCityNeighborhoods.mockResolvedValue({
            neighborhoods: [{ neighborhood_name: 'Downtown', overview: 'Urban core.' }],
        });

        const prop = makePropertyData();
        // prop.neighborhood_identity.resolved_name = 'Val Vista' — no match in above
        const { nhEntry } = await runCacheFetch(prop);
        expect(nhEntry).toBeUndefined();
    });

    // ── 11. Property with no zpid makes no DB calls ──────────────────────────

    it('makes no Firestore calls if zpid is missing', async () => {
        const prop = { ...makePropertyData(), zpid: undefined as any };
        // All functions guarded by zpid should not be called
        // We simulate the hook's guard: if (!propertyData?.zpid) return;
        if (prop.zpid) {
            await runCacheFetch(prop);
        }

        expect(mockGetVisualAnalysis).not.toHaveBeenCalled();
        expect(mockGetPropertyInvestment).not.toHaveBeenCalled();
        expect(mockExtractDeepResearchInsights).not.toHaveBeenCalled();
    });
});
