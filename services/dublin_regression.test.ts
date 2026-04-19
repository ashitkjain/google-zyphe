// @vitest-environment node
/**
 * Dublin — 5-Property Regression Test
 *
 * Tests 5 representative Dublin properties that were previously correct ("Good")
 * against known ground truth orientations. Detects regressions from GPS heading math
 * architectural changes in commits 90c0ba5, c45eee2, 4dd677b, 0b44302.
 *
 * Run:
 *   npx vitest run services/dublin_regression.test.ts --reporter=verbose
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { APP_CONFIG } from '../config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Ground truth for 5 representative Dublin properties ───────────────────────
// Picked from DUBLIN_GROUND_TRUTH where remark='Good' + clear expected_orientation
const CASES = [
    {
        label:    '2539 Brandini Dr (standard, South)',
        address:  '2539 Brandini Dr, Dublin, CA 94568 US',
        expected: ['S'],                  // was correct; tests standard GPS math
        city:     'dublin',
    },
    {
        label:    '4026 Chalk Hill Way (standard, North)',
        address:  '4026 Chalk Hill Way, Dublin, CA 94568',
        expected: ['N'],                  // was correct; simple baseline
        city:     'dublin',
    },
    {
        label:    '4302 Keegan St (standard, East)',
        address:  '4302 Keegan St, Dublin, CA 94568 US',
        expected: ['E'],                  // tests facing-convention change (c45eee2)
        city:     'dublin',
    },
    {
        label:    '5271 Salerno Dr (corner lot → NW)',
        address:  '5271 Salerno Dr, Dublin, CA 94568 US',
        expected: ['NW'],                 // root case for 4dd677b perpendicular bailout
        city:     'dublin',
    },
    {
        label:    '4066 Rosehill Pl (cul-de-sac → W)',
        address:  '4066 Rosehill Pl, Dublin, CA 94568 US',
        expected: ['W'],                  // root case for 0b44302 diagonal collapse fix
        city:     'dublin',
    },
] as const;

// ── Firestore REST helper ─────────────────────────────────────────────────────
const FIREBASE_PROJECT  = 'zyphe-af0bf';
const FIREBASE_API_KEY  = 'AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI';
const FIRESTORE_BASE    = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

async function firestoreGet(path: string): Promise<Record<string, any> | null> {
    try {
        const res  = await fetch(`${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`);
        if (!res.ok) return null;
        const json = await res.json();
        if (json.error) return null;

        // Recursively parse Firestore field values
        function parseValue(v: any): any {
            if (v.stringValue  !== undefined) return v.stringValue;
            if (v.integerValue !== undefined) return Number(v.integerValue);
            if (v.doubleValue  !== undefined) return Number(v.doubleValue);
            if (v.booleanValue !== undefined) return v.booleanValue;
            if (v.nullValue    !== undefined) return null;
            if (v.mapValue)                  return parseFields(v.mapValue.fields || {});
            if (v.arrayValue)                return (v.arrayValue.values || []).map(parseValue);
            return null;
        }
        function parseFields(fields: any): Record<string, any> {
            const out: Record<string, any> = {};
            for (const [k, val] of Object.entries(fields) as any[]) out[k] = parseValue(val);
            return out;
        }
        return parseFields(json.fields || {});
    } catch { return null; }
}

// ── Direction range helpers ───────────────────────────────────────────────────
const DIR_RANGES: Record<string, [number, number]> = {
    N:  [338, 382], NE: [23,   67], E:  [68,  112], SE: [113, 157],
    S:  [158, 202], SW: [203, 247], W:  [248, 292], NW: [293, 337],
};

function inRange(az: number, dir: string): boolean {
    const r = DIR_RANGES[dir];
    if (!r) return false;
    const [lo, hi] = r;
    if (hi > 360) return az >= lo || az <= (hi - 360);
    return az >= lo && az <= hi;
}

function matchesAny(az: number | null, dirs: readonly string[]): boolean {
    if (az == null) return false;
    return dirs.some(d => inRange(az, d));
}

// ── Geocode helper ────────────────────────────────────────────────────────────
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${APP_CONFIG.maps.key}`
    ).then(r => r.json());
    if (res.status !== 'OK') return null;
    return res.results[0].geometry.location;
}

// ── Resolve zpid + cached Street View URL from Firestore ─────────────────────
async function resolveCachedSV(
    city: string,
    address: string
): Promise<{ zpid: string | null; svUrl: string | null; heading: number | null }> {
    const norm = (s: string) => s.toLowerCase()
        .replace(/,?\s*\bus\b\s*$/, '')   // strip trailing ", US" or " US"
        .replace(/[,\s]+/g, ' ')           // collapse commas+spaces
        .trim();
    const indexData = await firestoreGet(`address_index/${city}`);
    const entries: Array<{ a: string; z: string }> = indexData?.entries || [];
    const entry = entries.find(e => norm(e.a) === norm(address));
    if (!entry?.z) return { zpid: null, svUrl: null, heading: null };

    const zpid = entry.z;
    const propData = await firestoreGet(`properties/${zpid}`);
    const heading: number | null = propData?.streetViewHeadingDeg ?? null;

    // Try to get SV URL from analysis/assets sub-document
    const assetData = await firestoreGet(`properties/${zpid}/analysis/assets`);
    let svUrl: string | null = assetData?.streetView ?? propData?.streetView ?? null;

    // Append heading if we have it (needed for correct GPS math)
    if (svUrl && heading != null && !svUrl.includes('heading=')) {
        svUrl = `${svUrl}&heading=${Math.round(heading)}`;
    }
    return { zpid, svUrl, heading };
}

// ── Per-case state ────────────────────────────────────────────────────────────
type CaseState = {
    coords:  { lat: number; lng: number } | null;
    svUrl:   string | null;
    heading: number | null;
    zpid:    string | null;
};

const caseStates: Map<string, CaseState> = new Map();

// ── Setup: geocode & load cached SVs ─────────────────────────────────────────
beforeAll(async () => {
    // Load API keys
    try {
        const keys = JSON.parse(readFileSync(resolve('./tests/.batch-keys.json'), 'utf-8')) as Record<string, string>;
        if (keys.VITE_GEMINI_API_KEY)      (APP_CONFIG as any).gemini.key = keys.VITE_GEMINI_API_KEY;
        if (keys.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key   = keys.VITE_GOOGLE_MAPS_API_KEY;
    } catch { /* fall through to env */ }

    if (!APP_CONFIG.gemini.key && process.env.VITE_GEMINI_API_KEY)
        (APP_CONFIG as any).gemini.key = process.env.VITE_GEMINI_API_KEY;
    if (!APP_CONFIG.maps.key && process.env.VITE_GOOGLE_MAPS_API_KEY)
        (APP_CONFIG as any).maps.key = process.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!APP_CONFIG.gemini.key) throw new Error('Gemini API key not loaded');
    if (!APP_CONFIG.maps.key)   throw new Error('Maps API key not loaded');

    // For each case: geocode + resolve cached SV
    await Promise.all(CASES.map(async (c) => {
        const [coords, { zpid, svUrl, heading }] = await Promise.all([
            geocode(c.address),
            resolveCachedSV(c.city, c.address),
        ]);
        caseStates.set(c.address, { coords, svUrl, heading, zpid });
        console.log(
            `[Setup] ${c.label}\n` +
            `  coords:  ${coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'null'}\n` +
            `  zpid:    ${zpid ?? 'not found'}\n` +
            `  heading: ${heading != null ? `${heading}°` : 'unknown'}\n` +
            `  svUrl:   ${svUrl ? svUrl.substring(0, 80) + '...' : 'none'}`
        );
    }));
}, 60_000);

// ── Helper to format result log ───────────────────────────────────────────────
function logResult(label: string, result: any, expected: readonly string[], pass: boolean) {
    const az = result.azimuth_degrees ?? 'null';
    console.log(
        `\n[${pass ? '✅ PASS' : '❌ FAIL'}] ${label}\n` +
        `  got:       ${result.final_orientation} (${az}°, confidence=${result.confidence})\n` +
        `  expected:  ${expected.join(' or ')}\n` +
        `  mode:      ${result.aerial_only_mode ? 'AERIAL-ONLY' : 'DUAL-IMAGE'}\n` +
        `  layout:    ${result.property_layout_type ?? 'unknown'}\n` +
        `  sv_front:  ${result.street_view_shows_front}\n` +
        `  explain:   ${result.explanation?.substring(0, 300)}`
    );
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Dublin — 5-Property Regression Test', () => {

    for (const c of CASES) {

        it(c.label, async () => {
            const state = caseStates.get(c.address);
            if (!state?.coords) {
                console.warn(`[SKIP] ${c.label} — no coordinates`);
                return;
            }

            const { coords, svUrl, heading } = state;

            // Use cached URL only when it has an embedded heading (&heading=N).
            // Without a heading, GPS math can't run and the token may be stale (returns 404).
            // Fall back to live Street View fetch (undefined) in those cases.
            const hasEmbeddedHeading = (svUrl ?? '').includes('heading=');
            const svArg: string | null | undefined = (svUrl !== null && hasEmbeddedHeading)
                ? svUrl      // cached URL with heading → deterministic result
                : undefined; // trigger live GSV fetch (or aerial-only if no pano found)

            const result = await runSatellitaryAnalysis(
                coords.lat,
                coords.lng,
                svArg,
                `test-dublin-${c.address.split(' ')[0]}`,
                undefined,
                c.address,
                null
            );

            const pass = matchesAny(result.azimuth_degrees, c.expected);
            logResult(c.label, result, c.expected, pass);

            expect(
                pass,
                `${c.label}: expected ${c.expected.join(' or ')}, got ${result.final_orientation} (${result.azimuth_degrees}°)`
            ).toBe(true);
        }, 120_000);

    }

    // ── Summary: run all 5 and print pass/fail table ──────────────────────────
    it('SUMMARY — aerial-only fallback for all 5 (should be UNCLEAR for cul-de-sac + corner lot)', async () => {
        const results: Array<{ label: string; orientation: string; az: number | null; pass: boolean }> = [];

        for (const c of CASES) {
            const state = caseStates.get(c.address);
            if (!state?.coords) { results.push({ label: c.label, orientation: 'SKIP', az: null, pass: false }); continue; }

            const result = await runSatellitaryAnalysis(
                state.coords.lat,
                state.coords.lng,
                null,                    // force aerial-only
                `test-aerial-${c.address.split(' ')[0]}`,
                undefined,
                c.address,
                null
            );

            const isUnclear = (result.final_orientation ?? '').toLowerCase().includes('unclear');
            const isExpected = c.label.includes('cul-de-sac') || c.label.includes('corner lot');
            const pass = isExpected ? isUnclear : matchesAny(result.azimuth_degrees, c.expected);
            results.push({ label: c.label, orientation: result.final_orientation ?? 'null', az: result.azimuth_degrees, pass });
        }

        console.log('\n━━━━━━━━━━ AERIAL-ONLY SUMMARY ━━━━━━━━━━');
        for (const r of results) {
            console.log(`  ${r.pass ? '✅' : '❌'} ${r.label}: ${r.orientation} (${r.az ?? 'null'}°)`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Aerial-only for cul-de-sac and corner lot MUST be UNCLEAR
        const culDeSac  = results.find(r => r.label.includes('cul-de-sac'));
        const cornerLot = results.find(r => r.label.includes('corner lot'));
        if (culDeSac)  expect(culDeSac.orientation.toLowerCase(),  'Cul-de-sac aerial-only → UNCLEAR').toContain('unclear');
        if (cornerLot) expect(cornerLot.orientation.toLowerCase(), 'Corner lot aerial-only → UNCLEAR').toContain('unclear');
    }, 600_000);
});
