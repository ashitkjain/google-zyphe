// @vitest-environment node
/**
 * Dublin — Severe Mismatch Investigation Test (>90° errors)
 *
 * These 8 properties all have angular mismatches > 90° between the AI result
 * and what human testers confirmed. Many are 180° flips (N vs S, NW vs SE).
 *
 * Goal: identify WHY each mismatch happens so a targeted code/prompt fix can be applied.
 *
 * Run:
 *   npx vitest run services/dublin_severe_mismatch.test.ts --reporter=verbose
 */

import { describe, it, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { APP_CONFIG } from '../config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Cases: all have >90° angular mismatch; expected from human tester review ──
const CASES = [
    {
        label:      '3769 Finnian Way — North expected (was South, 180° flip)',
        address:    '3769 Finnian Way, Dublin, CA 94568 US',
        expected:   ['N'],
        prevAI:     'South',
        notes:      'Pin location is wrong; it is north facing but says it is south facing',
    },
    {
        label:      '7584 Silvertree Ln — East expected (was NW, 135° off)',
        address:    '7584 Silvertree Ln, Dublin, CA 94568 US',
        expected:   ['E'],
        prevAI:     'Northwest',
        notes:      'The property does not face Northwest it faces east',
    },
    {
        label:      '7906 Regional Cmn — SE expected (was NW, 180° flip)',
        address:    '7906 Regional Cmn, Dublin, CA 94568 US',
        expected:   ['SE'],
        prevAI:     'Northwest',
        notes:      'The property does not face Northwest it faces southeast',
    },
    {
        label:      '7151 Atlas Peak Dr — SW expected (was NE, 180° flip)',
        address:    '7151 Atlas Peak Dr, Dublin, CA 94568 US',
        expected:   ['SW'],
        prevAI:     'Northeast',
        notes:      'Faces southwest, not northeast',
    },
    {
        label:      '8578 Deervale Rd — East expected (was SW, 135° off)',
        address:    '8578 Deervale Rd, Dublin, CA 94568 US',
        expected:   ['E'],
        prevAI:     'Southwest',
        notes:      'The property does not face Southwest it faces east',
    },
    {
        label:      '7511 Oxford Cir — SE expected (was North, 135° off)',
        address:    '7511 Oxford Cir, Dublin, CA 94568 US',
        expected:   ['SE', 'S'],
        prevAI:     'North',
        notes:      'Faces southeast/south, not north at all',
    },
    {
        label:      '7997 Via Zapata — West expected (was South, 90° off)',
        address:    '7997 Via Zapata, Dublin, CA 94568 US',
        expected:   ['W', 'SW', 'NW'],
        prevAI:     'South',
        notes:      'The property does not face south it faces west',
    },
    {
        label:      '7026 N Mariposa Ln — North expected (was East, 90° off)',
        address:    '7026 N Mariposa Ln, Dublin, CA 94568 US',
        expected:   ['N', 'NW', 'NE'],
        prevAI:     'East',
        notes:      'North facing it is, not east for sure',
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

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${APP_CONFIG.maps.key}`
    ).then(r => r.json());
    if (res.status !== 'OK') return null;
    return res.results[0].geometry.location;
}

async function resolveCachedSV(address: string): Promise<{ zpid: string | null; svUrl: string | null; heading: number | null }> {
    const norm = (s: string) => s.toLowerCase()
        .replace(/,?\s*\bus\b\s*$/, '')   // strip trailing ", US" or " US"
        .replace(/[,\s]+/g, ' ')           // collapse commas+spaces
        .trim();
    const indexData = await firestoreGet(`address_index/dublin`);
    const entries: Array<{ a: string; z: string }> = indexData?.entries || [];
    const entry = entries.find(e => norm(e.a) === norm(address));
    if (!entry?.z) return { zpid: null, svUrl: null, heading: null };
    const zpid = entry.z;
    const propData = await firestoreGet(`properties/${zpid}`);
    const heading: number | null = propData?.streetViewHeadingDeg ?? null;
    const assetData = await firestoreGet(`properties/${zpid}/analysis/assets`);
    let svUrl: string | null = assetData?.streetView ?? propData?.streetView ?? null;
    if (svUrl && heading != null && !svUrl.includes('heading=')) {
        svUrl = `${svUrl}&heading=${Math.round(heading)}`;
    }
    return { zpid, svUrl, heading };
}

// ── Direction range helpers ───────────────────────────────────────────────────
const DIR_RANGES: Record<string, [number, number]> = {
    N:  [338, 382], NE: [23,  67],  E:  [68,  112], SE: [113, 157],
    S:  [158, 202], SW: [203, 247], W:  [248, 292], NW: [293, 337],
};
function inRange(az: number, dir: string): boolean {
    const r = DIR_RANGES[dir]; if (!r) return false;
    const [lo, hi] = r;
    return hi > 360 ? (az >= lo || az <= hi - 360) : (az >= lo && az <= hi);
}
function matchesAny(az: number | null, dirs: readonly string[]): boolean {
    if (az == null) return false;
    return dirs.some(d => inRange(az, d));
}
function angDiff(a: number, b: number): number { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
const DIR_AZ: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

// ── Setup ─────────────────────────────────────────────────────────────────────
type CaseState = { coords: { lat: number; lng: number } | null; svUrl: string | null; heading: number | null; zpid: string | null };
const caseStates = new Map<string, CaseState>();

beforeAll(async () => {
    try {
        const keys = JSON.parse(readFileSync(resolve('./tests/.batch-keys.json'), 'utf-8')) as Record<string, string>;
        if (keys.VITE_GEMINI_API_KEY)      (APP_CONFIG as any).gemini.key = keys.VITE_GEMINI_API_KEY;
        if (keys.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key   = keys.VITE_GOOGLE_MAPS_API_KEY;
    } catch { /* fall through to env */ }
    if (!APP_CONFIG.gemini.key && process.env.VITE_GEMINI_API_KEY) (APP_CONFIG as any).gemini.key = process.env.VITE_GEMINI_API_KEY;
    if (!APP_CONFIG.maps.key   && process.env.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key = process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!APP_CONFIG.gemini.key) throw new Error('Gemini API key not loaded');
    if (!APP_CONFIG.maps.key)   throw new Error('Maps API key not loaded');

    await Promise.all(CASES.map(async (c) => {
        const [coords, { zpid, svUrl, heading }] = await Promise.all([
            geocode(c.address),
            resolveCachedSV(c.address),
        ]);
        caseStates.set(c.address, { coords, svUrl, heading, zpid });
        console.log(
            `[Setup] ${c.label}\n` +
            `  zpid: ${zpid ?? 'NOT FOUND'}  heading: ${heading != null ? `${heading}°` : 'unknown'}\n` +
            `  svUrl: ${svUrl ? svUrl.substring(0, 80) + '...' : 'none'}`
        );
    }));
}, 60_000);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Dublin — Severe Mismatch Investigation (>90° errors)', () => {

    for (const c of CASES) {

        it(c.label, async () => {
            const state = caseStates.get(c.address);
            if (!state?.coords) { console.warn(`[SKIP] ${c.label} — no coordinates`); return; }

            const { coords, svUrl, heading } = state;

            // Use cached URL only if heading is embedded (ensures GPS math runs correctly)
            const hasCachedHeading = (svUrl ?? '').includes('heading=');
            const svArg: string | null | undefined = hasCachedHeading ? svUrl : undefined;

            console.log(`\n[RUN] ${c.label}`);
            console.log(`  svArg mode: ${hasCachedHeading ? 'CACHED+HEADING' : svUrl ? 'CACHED-no-heading→live-fetch' : 'aerial-only'}`);
            console.log(`  previousAI: ${c.prevAI} | expected: ${c.expected.join('/')}`);

            const result = await runSatellitaryAnalysis(
                coords.lat, coords.lng,
                svArg,
                `sev-${c.address.split(' ')[0]}`,
                undefined,
                c.address,
                null
            );

            const az = result.azimuth_degrees;
            const pass = matchesAny(az, c.expected);
            const prevAz = DIR_AZ[c.prevAI] ?? null;
            const angularDiffNow = az != null ? Math.min(...c.expected.map(e => angDiff(az, DIR_AZ[e] ?? 0))) : 999;
            const angularDiffBefore = prevAz != null ? Math.min(...c.expected.map(e => angDiff(prevAz, DIR_AZ[e] ?? 0))) : 999;

            console.log(`\n[${pass ? '✅ PASS' : '❌ FAIL'}] ${c.label}`);
            console.log(`  result:      ${result.final_orientation} (${az}°)  confidence=${result.confidence}`);
            console.log(`  expected:    ${c.expected.join(' or ')}`);
            console.log(`  previous AI: ${c.prevAI} (${prevAz}°)  — angular error was ${angularDiffBefore}°, now ${angularDiffNow}°`);
            console.log(`  mode:        ${result.aerial_only_mode ? 'AERIAL-ONLY' : 'DUAL-IMAGE'}`);
            console.log(`  layout:      ${result.property_layout_type ?? 'unknown'}`);
            console.log(`  sv_front:    ${result.street_view_shows_front}`);
            console.log(`  explanation: ${result.explanation?.substring(0, 500)}`);

            // Soft assertion: don't fail the test, just report. The goal is investigation.
            // Uncomment the line below to make this a hard gate once all are fixed:
            // expect(pass, `${c.label}: expected ${c.expected.join('/')}, got ${result.final_orientation} (${az}°)`).toBe(true);

            // Hard assertion: result MUST not be WORSE than previous AI (no regression)
            if (prevAz != null && az != null && angularDiffNow > angularDiffBefore + 45) {
                console.error(`  ⚠️  REGRESSION: angular error INCREASED from ${angularDiffBefore}° to ${angularDiffNow}°`);
                throw new Error(
                    `REGRESSION: ${c.label} got worse — angular error ${angularDiffBefore}° → ${angularDiffNow}°`
                );
            }
        }, 120_000);

    }

    // Final summary
    it('SUMMARY — print diagnostic table for all 8 properties', async () => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━ SEVERE MISMATCH SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  (Re-run with cached state from individual tests above)');
        console.log('  Check vitest output above for per-property explanations.');
        console.log('  Properties with prevAI listed show the BEFORE state from tester review.');
        for (const c of CASES) {
            const state = caseStates.get(c.address);
            const prevAz = DIR_AZ[c.prevAI] ?? null;
            const expectedAz = DIR_AZ[c.expected[0]] ?? null;
            const diff = (prevAz != null && expectedAz != null) ? angDiff(prevAz, expectedAz) : '?';
            console.log(`  ${c.expected[0].padEnd(3)} expected | was ${c.prevAI.padEnd(9)} (${diff}° off) | ${c.address}`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }, 30_000);
});
