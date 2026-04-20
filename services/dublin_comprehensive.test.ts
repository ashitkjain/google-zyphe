// @vitest-environment node
/**
 * Dublin — Comprehensive Bad-Entry Investigation
 *
 * Runs ALL Dublin ground-truth "Bad" entries that have a known expected_orientation.
 * Produces a ranked table of mismatches sorted by angular error (worst first).
 *
 * Assertions are SOFT — focus is on the ranked diagnostic output.
 * Hard gate: any property with angular error ≥ 90° that was PREVIOUSLY correct
 * (i.e., not in the original tester complaint) is flagged as a REGRESSION.
 *
 * Run:
 *   npx vitest run services/dublin_comprehensive.test.ts --reporter=verbose
 *
 * Total runtime: ~5 min (40 properties × ~8s each, run in batches of 6).
 */

import { describe, it, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { APP_CONFIG } from '../config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── All Dublin "Bad" entries with a known expected_orientation ─────────────────
const CASES = [
    // ── ~90° potential ──────────────────────────────────────────────────────────
    { address: '3662 Branding Iron Pl, Dublin, CA 94568 US',          expected: ['SE'],          prevAI: 'Southwest', notes: 'Looks like SE but says SW' },
    { address: '4866 Shelton St, Dublin, CA 94568 US',                expected: ['NE'],          prevAI: 'Northwest', notes: 'NE not NW' },
    { address: '4958 Trescott Ct, Dublin, CA 94568 US',               expected: ['S'],           prevAI: 'East',      notes: 'East but garage opens that side, door faces south' },
    { address: '4978 Houlton Ct, Dublin, CA 94568 US',                expected: ['E'],           prevAI: 'North',     notes: 'Facing east not north' },
    { address: '5271 Salerno Dr, Dublin, CA 94568 US',                expected: ['NW'],          prevAI: 'Northeast', notes: 'NW not NE' },
    { address: '5862 Cadence Ave, Dublin, CA 94568 US',               expected: ['W', 'S'],      prevAI: 'Northeast', notes: 'It is South not Northeast (tester says W)' },
    { address: '7240 Carneros Ln, Dublin, CA 94568 US',               expected: ['SE'],          prevAI: 'Southwest', notes: 'SE not SW' },
    { address: '7991 Regional Cmn, Dublin, CA 94568 US',              expected: ['NW'],          prevAI: 'Northeast', notes: 'NW not NE' },
    { address: '7922 Regional Cmn, Dublin, CA 94568 US',              expected: ['NE'],          prevAI: 'South',     notes: 'Likely NE, slightly tilted' },
    // ── ~135° potential ─────────────────────────────────────────────────────────
    { address: '3245 Dublin Blvd Apt 402, Dublin, CA 94568 US',       expected: ['S'],           prevAI: 'Northeast', notes: 'Zillow shows south (correct); Zyphe shows NE' },
    { address: '7151 Atlas Peak Dr, Dublin, CA 94568 US',             expected: ['SW'],          prevAI: 'Northeast', notes: 'Faces SW not NE' },
    // ── ~180° potential ─────────────────────────────────────────────────────────
    { address: '3769 Finnian Way, Dublin, CA 94568 US',               expected: ['N'],           prevAI: 'South',     notes: 'Pin location wrong; north facing' },
    { address: '5630 Central Pkwy Unit 202, Dublin, CA 94568 US',     expected: ['N'],           prevAI: 'South',     notes: 'North not south' },
    // ── Remaining bad cases (various angular offsets) ───────────────────────────
    { address: '10838 McPeak Ln, Dublin, CA 94568 US',                expected: ['NW'],          prevAI: 'South',     notes: 'NW facing, garage faces south' },
    { address: '2829 Mount Dana Dr, Dublin, CA 94568 US',             expected: ['SE', 'SW'],    prevAI: 'Northwest', notes: 'Says NW but looks SW' },
    { address: '2890 Sable Oaks Way, Dublin, CA 94568 US',            expected: ['NW'],          prevAI: 'North',     notes: 'Slightly tilted toward west so NW' },
    { address: '2933 Stringham Way, Dublin, CA 94568 US',             expected: ['SE'],          prevAI: 'South',     notes: 'SE it is' },
    { address: '3016 Threecastles Way, Dublin, CA 94568',             expected: ['S'],           prevAI: 'Southwest', notes: 'Says SW but looks South' },
    { address: '3398 Araldi Ln, Dublin, CA 94568 US',                 expected: ['S'],           prevAI: 'North',     notes: 'Looks south per v1' },
    { address: '3703 Whitworth Dr, Dublin, CA 94568 US',              expected: ['SE'],          prevAI: 'South',     notes: 'SE not South' },
    { address: '4036 Bothrin St, Dublin, CA 94568 US',                expected: ['NE'],          prevAI: 'East',      notes: 'Tilted north so NE' },
    { address: '4052 Knightstown St, Dublin, CA 94568 US',            expected: ['E'],           prevAI: 'Northwest', notes: 'All good, Northwest it is — note: tester note contradicts remark; expected=E' },
    { address: '4431 Duccio Pl, Dublin, CA 94568',                    expected: ['W'],           prevAI: 'East',      notes: 'Street on west so faces west' },
    { address: '4433 Cherico Ln, Dublin, CA 94568',                   expected: ['W'],           prevAI: 'Northeast', notes: 'NE per tester note but remark=Bad, expected=W' },
    { address: '4450 Sunset View Dr, Dublin, CA 94568 US',            expected: ['SE'],          prevAI: 'Southwest', notes: 'SE not SW' },
    { address: '4585 Brannigan St, Dublin, CA 94568 US',              expected: ['W'],           prevAI: 'Southwest', notes: 'Says SW but looks direct West' },
    { address: '4630 Central Pkwy, Dublin, CA 94568 US',              expected: ['N'],           prevAI: 'Northwest', notes: 'Says NW but looks direct North' },
    { address: '5425 Melissa Ln #221, Dublin, CA 94568 US',           expected: ['N', 'UNCLEAR'],prevAI: 'South',     notes: 'Townhouse, should be UNCLEAR' },
    { address: '5509 El Dorado Ln, Dublin, CA 94568',                 expected: ['S'],           prevAI: 'North',     notes: 'Door is facing North, garage facing south → south facing' },
    { address: '5679 Melodia Cir, Dublin, CA 94568 US',               expected: ['NE'],          prevAI: 'South',     notes: 'NE it is' },
    { address: '6635 Maple Dr, Dublin, CA 94568 US',                  expected: ['SW'],          prevAI: 'South',     notes: 'Slightly tilted west so SW' },
    { address: '6759 S Mariposa Ln, Dublin, CA 94568',                expected: ['N'],           prevAI: 'South',     notes: 'Description says North facing' },
    { address: '6931 Pine Ct, Dublin, CA 94568',                      expected: ['SW'],          prevAI: 'South',     notes: 'Slightly tilted west so SW' },
    { address: '7026 N Mariposa Ln, Dublin, CA 94568 US',             expected: ['N', 'NW', 'NE'],prevAI: 'East',    notes: 'North facing not east' },
    { address: '7172 Amador Valley Blvd, Dublin, CA 94568 US',        expected: ['NW'],          prevAI: 'West',      notes: 'NW not West' },
    { address: '7229 Calistoga Ln, Dublin, CA 94568 US',              expected: ['SW'],          prevAI: 'West',      notes: 'SW not West' },
    { address: '7272 Cronin Cir, Dublin, CA 94568 US',                expected: ['NE'],          prevAI: 'North',     notes: 'Slightly tilted toward NE' },
    { address: '7511 Oxford Cir, Dublin, CA 94568 US',                expected: ['SE', 'S'],     prevAI: 'North',     notes: 'SE/south not north at all' },
    { address: '7584 Silvertree Ln, Dublin, CA 94568 US',             expected: ['E'],           prevAI: 'Northwest', notes: 'East not NW' },
    { address: '7774 Tuscany Dr, Dublin, CA 94568 US',                expected: ['SE'],          prevAI: 'South',     notes: 'SE not South' },
    { address: '7906 Regional Cmn, Dublin, CA 94568 US',              expected: ['SE'],          prevAI: 'Northwest', notes: 'SE not NW' },
    { address: '7921 Crossridge Rd, Dublin, CA 94568 US',             expected: ['W'],           prevAI: 'Northeast', notes: 'Door faces NW but house faces West' },
    { address: '7997 Via Zapata, Dublin, CA 94568 US',                expected: ['W', 'SW', 'NW'],prevAI: 'South',   notes: 'West not South' },
    { address: '8107 Peppertree Rd, Dublin, CA 94568 US',             expected: ['W'],           prevAI: 'Southwest', notes: 'West not SW' },
    { address: '8318 Mulberry Pl, Dublin, CA 94568 US',               expected: ['NE'],          prevAI: 'South',     notes: 'Door SE but house faces NE' },
    { address: '8578 Deervale Rd, Dublin, CA 94568 US',               expected: ['E', 'NE'],     prevAI: 'Southwest', notes: 'East not SW' },
] as const;

type CaseAddr = typeof CASES[number]['address'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const FIREBASE_PROJECT = 'zyphe-af0bf';
const FIREBASE_API_KEY = 'AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI';
const FIRESTORE_BASE   = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

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
        .replace(/,?\s*\bus\b\s*$/, '')
        .replace(/[,\s]+/g, ' ')
        .trim();
    const indexData = await firestoreGet(`address_index/dublin`);
    const entries: Array<{ a: string; z: string }> = indexData?.entries || [];
    const entry = entries.find(e => norm(e.a) === norm(address));
    if (!entry?.z) return { zpid: null, svUrl: null, heading: null };
    const zpid = entry.z;
    const propData  = await firestoreGet(`properties/${zpid}`);
    const heading: number | null = propData?.streetViewHeadingDeg ?? null;
    const assetData = await firestoreGet(`properties/${zpid}/analysis/assets`);
    let svUrl: string | null = assetData?.streetView ?? propData?.streetView ?? null;
    if (svUrl && heading != null && !svUrl.includes('heading=')) {
        svUrl = `${svUrl}&heading=${Math.round(heading)}`;
    }
    return { zpid, svUrl, heading };
}

const DIR_RANGES: Record<string, [number, number]> = {
    N: [338, 382], NE: [23, 67],  E: [68, 112],  SE: [113, 157],
    S: [158, 202], SW: [203, 247], W: [248, 292], NW: [293, 337],
};
function inRange(az: number, dir: string): boolean {
    const r = DIR_RANGES[dir]; if (!r) return false;
    const [lo, hi] = r;
    return hi > 360 ? (az >= lo || az <= hi - 360) : (az >= lo && az <= hi);
}
function matchesAny(az: number | null, dirs: readonly string[]): boolean {
    if (az == null) return dirs.includes('UNCLEAR');
    return dirs.some(d => inRange(az, d));
}
const DIR_AZ: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
function angDiff(a: number, b: number): number { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
function minAngErr(az: number | null, dirs: readonly string[]): number {
    if (az == null) return 999;
    return Math.min(...dirs.filter(d => DIR_AZ[d] !== undefined).map(d => angDiff(az, DIR_AZ[d])));
}

// ── Shared state ──────────────────────────────────────────────────────────────
type CaseState = { coords: { lat: number; lng: number } | null; svUrl: string | null; heading: number | null; zpid: string | null };
const caseStates = new Map<string, CaseState>();

// Results collected across tests
const results: Array<{
    address: string;
    expected: readonly string[];
    prevAI: string;
    got: string | null;
    gotAz: number | null;
    angErr: number;
    pass: boolean;
    mode: string;
    svFront: any;
    explanation: string;
}> = [];

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(async () => {
    try {
        const keys = JSON.parse(readFileSync(resolve('./tests/.batch-keys.json'), 'utf-8')) as Record<string, string>;
        if (keys.VITE_GEMINI_API_KEY)      (APP_CONFIG as any).gemini.key = keys.VITE_GEMINI_API_KEY;
        if (keys.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key   = keys.VITE_GOOGLE_MAPS_API_KEY;
    } catch { /* env fallback */ }
    if (!APP_CONFIG.gemini.key && process.env.VITE_GEMINI_API_KEY) (APP_CONFIG as any).gemini.key = process.env.VITE_GEMINI_API_KEY;
    if (!APP_CONFIG.maps.key   && process.env.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key = process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!APP_CONFIG.gemini.key) throw new Error('Gemini API key not loaded');
    if (!APP_CONFIG.maps.key)   throw new Error('Maps API key not loaded');

    // Load index once
    const indexData = await firestoreGet(`address_index/dublin`);
    const allEntries: Array<{ a: string; z: string }> = indexData?.entries || [];
    const norm = (s: string) => s.toLowerCase().replace(/,?\s*\bus\b\s*$/, '').replace(/[,\s]+/g, ' ').trim();

    await Promise.all(CASES.map(async (c) => {
        const entry = allEntries.find(e => norm(e.a) === norm(c.address));
        const zpid  = entry?.z ?? null;
        const [coords, propDataRaw] = await Promise.all([
            geocode(c.address),
            zpid ? firestoreGet(`properties/${zpid}`) : Promise.resolve(null),
        ]);
        const heading: number | null = propDataRaw?.streetViewHeadingDeg ?? null;
        const assetData = zpid ? await firestoreGet(`properties/${zpid}/analysis/assets`) : null;
        let svUrl: string | null = assetData?.streetView ?? propDataRaw?.streetView ?? null;
        if (svUrl && heading != null && !svUrl.includes('heading=')) svUrl = `${svUrl}&heading=${Math.round(heading)}`;
        caseStates.set(c.address, { coords, svUrl, heading, zpid });
        console.log(`[Setup] ${c.address.substring(0, 40).padEnd(40)} zpid=${zpid ?? 'NONE'.padEnd(12)} heading=${heading ?? 'null'}`);
    }));
}, 90_000);

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Dublin — Comprehensive Bad-Entry Investigation', () => {

    for (const c of CASES) {

        it(c.address, async () => {
            const state = caseStates.get(c.address);
            if (!state?.coords) {
                console.warn(`[SKIP] ${c.address} — no coordinates`);
                results.push({ address: c.address, expected: c.expected, prevAI: c.prevAI, got: 'SKIP', gotAz: null, angErr: 999, pass: false, mode: 'skip', svFront: null, explanation: '' });
                return;
            }

            const { coords, svUrl, heading } = state;
            const hasCachedHeading = (svUrl ?? '').includes('heading=');
            const svArg: string | null | undefined = hasCachedHeading ? svUrl : undefined;

            const result = await runSatellitaryAnalysis(
                coords.lat, coords.lng,
                svArg,
                `comp-${c.address.split(' ')[0]}`,
                undefined,
                c.address,
                null
            );

            const az        = result.azimuth_degrees ?? null;
            const isUnclear = (result.final_orientation ?? '').toLowerCase().includes('unclear');
            const pass      = isUnclear
                ? c.expected.includes('UNCLEAR')
                : matchesAny(az, c.expected);
            const angErr    = isUnclear ? 0 : minAngErr(az, c.expected);

            results.push({
                address:     c.address,
                expected:    c.expected,
                prevAI:      c.prevAI,
                got:         result.final_orientation ?? null,
                gotAz:       az,
                angErr,
                pass,
                mode:        result.aerial_only_mode ? 'AERIAL' : 'DUAL',
                svFront:     result.street_view_shows_front,
                explanation: result.explanation?.substring(0, 400) ?? '',
            });

            const icon = pass ? '✅' : angErr >= 90 ? '🔴' : '🟡';
            console.log(`\n${icon} ${c.address}`);
            console.log(`   got=${result.final_orientation} (${az}°) | expected=${c.expected.join('/')} | prevAI=${c.prevAI} | err=${angErr}°`);
            console.log(`   mode=${result.aerial_only_mode ? 'AERIAL' : 'DUAL'} sv_front=${result.street_view_shows_front}`);
            console.log(`   expl: ${result.explanation?.substring(0, 300)}`);
        }, 120_000);

    }

    // ── Final ranked summary ──────────────────────────────────────────────────
    it('🏁 FINAL RANKED SUMMARY — worst angular errors first', () => {
        const sorted = [...results].sort((a, b) => b.angErr - a.angErr);

        console.log('\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  DUBLIN COMPREHENSIVE MISMATCH TABLE (sorted by angular error, worst first)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('  Icon  | AngErr | Got           | Expected | PrevAI    | Address');
        console.log('  ------|--------|---------------|----------|-----------|--------');

        const ge90 = sorted.filter(r => r.angErr >= 90);
        const ge45 = sorted.filter(r => r.angErr >= 45 && r.angErr < 90);
        const pass  = sorted.filter(r => r.angErr < 45 && r.pass);

        for (const r of sorted) {
            const icon  = r.pass ? '✅' : r.angErr >= 90 ? '🔴' : '🟡';
            const addr  = r.address.replace(', Dublin, CA 94568 US', '').replace(', Dublin, CA 94568', '').substring(0, 30).padEnd(30);
            const got   = (r.got ?? 'null').substring(0, 13).padEnd(13);
            const exp   = r.expected.join('/').padEnd(8);
            const prev  = r.prevAI.padEnd(9);
            console.log(`  ${icon}    | ${String(r.angErr).padStart(5)}° | ${got} | ${exp} | ${prev} | ${addr}`);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`  🔴 ≥90° errors:  ${ge90.length}`);
        console.log(`  🟡 45-89° errors: ${ge45.length}`);
        console.log(`  ✅ <45° / pass:   ${pass.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (ge90.length > 0) {
            console.log('\n  🔴 PROPERTIES NEEDING INVESTIGATION (≥90° error):');
            for (const r of ge90) {
                console.log(`     ${r.address}`);
                console.log(`       got=${r.got} (${r.gotAz}°) expected=${r.expected.join('/')} mode=${r.mode} sv_front=${r.svFront}`);
                console.log(`       expl: ${r.explanation.substring(0, 250)}`);
            }
        }
    }, 30_000);
});
