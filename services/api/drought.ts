import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DroughtData {
    countyFips: string;
    countyName: string;
    state: string;
    /** % of county area with NO drought */
    none: number;
    /** D0 – Abnormally Dry (%) */
    d0: number;
    /** D1 – Moderate Drought (%) */
    d1: number;
    /** D2 – Severe Drought (%) */
    d2: number;
    /** D3 – Extreme Drought (%) */
    d3: number;
    /** D4 – Exceptional Drought (%) */
    d4: number;
    /** Worst active severity label */
    severity: 'None' | 'Abnormally Dry' | 'Moderate' | 'Severe' | 'Extreme' | 'Exceptional';
    /** Worst active severity level (0–4, -1 = none) */
    severityLevel: number;
    /** Date of this reading */
    mapDate: string;
    fetchedAt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_LABELS: Record<number, DroughtData['severity']> = {
    4: 'Exceptional',
    3: 'Extreme',
    2: 'Severe',
    1: 'Moderate',
    0: 'Abnormally Dry',
    [-1]: 'None',
};

/**
 * Step 1: Get county FIPS from lat/lng via the FCC Census Area API (free, no key).
 */
const getCountyFips = async (lat: number, lng: number): Promise<{ fips: string; county: string; state: string } | null> => {
    try {
        const res = await fetch(
            `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lng}&censusYear=2020&format=json`
        );
        if (!res.ok) return null;
        const data = await res.json();
        const result = data?.results?.[0];
        if (!result?.county_fips) return null;
        return {
            fips: result.county_fips,
            county: result.county_name || '',
            state: result.state_code || '',
        };
    } catch (e) {
        console.warn('[Drought] FCC Census lookup failed:', e);
        return null;
    }
};

// ─── Main Fetcher ─────────────────────────────────────────────────────────────

/**
 * Fetch current drought conditions for a location using:
 *   1. FCC Census Area API → county FIPS
 *   2. US Drought Monitor API → drought severity percentages
 *
 * Both are free, no API key needed.
 */
export const fetchDroughtData = async (
    lat: number,
    lng: number,
    zpid?: string,
    address?: string
): Promise<DroughtData | null> => {
    const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid, address,
        api_name: 'US Drought Monitor',
        endpoint: 'usdmdataservices.unl.edu',
        params: { lat, lng },
        status: 'pending'
    });
    const start = Date.now();

    try {
        // Step 1: Resolve county FIPS
        const county = await getCountyFips(lat, lng);
        if (!county) {
            if (logId) updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: 'County FIPS lookup failed' });
            return null;
        }

        // Step 2: Query USDM for latest drought data (last 2 weeks to ensure we get at least 1 reading)
        const now = new Date();
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

        // USDM doesn't support CORS — use the Vite dev proxy; in production this will
        // gracefully fail and return null (data is cached from ingestion runs).
        const usdmBase = '/usdm-proxy';

        const res = await fetch(
            `${usdmBase}/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent?aoi=${county.fips}&startdate=${fmt(twoWeeksAgo)}&enddate=${fmt(now)}&statisticsType=1`,
            { headers: { 'Accept': 'application/json' } }
        );

        if (logId) {
            updateAPICall(logId, {
                status: res.ok ? 'completed' : 'failed',
                response_time_ms: Date.now() - start,
                error: res.ok ? undefined : `Status ${res.status}`
            });
        }

        if (!res.ok) return null;

        const records = await res.json();
        if (!Array.isArray(records) || records.length === 0) return null;

        // Use the most recent record
        const latest = records[0];

        // Determine worst active severity
        let severityLevel = -1;
        if (latest.d4 > 0) severityLevel = 4;
        else if (latest.d3 > 0) severityLevel = 3;
        else if (latest.d2 > 0) severityLevel = 2;
        else if (latest.d1 > 0) severityLevel = 1;
        else if (latest.d0 > 0) severityLevel = 0;

        return {
            countyFips: county.fips,
            countyName: latest.county || county.county,
            state: latest.state || county.state,
            none: latest.none ?? 0,
            d0: latest.d0 ?? 0,
            d1: latest.d1 ?? 0,
            d2: latest.d2 ?? 0,
            d3: latest.d3 ?? 0,
            d4: latest.d4 ?? 0,
            severity: SEVERITY_LABELS[severityLevel] || 'None',
            severityLevel,
            mapDate: latest.mapDate?.split('T')[0] || '',
            fetchedAt: Date.now(),
        };
    } catch (e) {
        console.error('[Drought] Failed to fetch drought data:', e);
        if (logId) {
            updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: String(e) });
        }
        return null;
    }
};
