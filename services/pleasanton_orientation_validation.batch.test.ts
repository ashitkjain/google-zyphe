// @vitest-environment node
/**
 * Pleasanton Orientation Validation Suite
 * Source: Tester report "Revalidation - Pleasanton Orientation"
 *
 * This test covers all properties marked "Bad" in the tester report,
 * with the tester-confirmed correct expected orientation.
 *
 * Run ALL bad cases:
 *   vitest run services/pleasanton_orientation_validation.batch.test.ts
 *
 * Run only regressions (cases that were correct before and broke):
 *   vitest run --test-name-pattern "REGRESSION" services/pleasanton_orientation_validation.batch.test.ts
 *
 * Run a single address:
 *   vitest run --test-name-pattern "1565 Mendoza" services/pleasanton_orientation_validation.batch.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { APP_CONFIG } from '../config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Firestore REST helpers (bypass SDK / Vitest auto-mock) ────────────────────
const FIREBASE_PROJECT = 'zyphe-af0bf';
const FIREBASE_API_KEY = 'AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI';  // public web key from config.ts
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

async function firestoreGet(path: string): Promise<Record<string, any> | null> {
    try {
        const url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        if (json.error) return null;
        // Firestore REST returns typed fields: { fieldName: { stringValue: '...' } }
        const fields = json.fields || {};
        const parsed: Record<string, any> = {};
        for (const [k, v] of Object.entries(fields) as any[]) {
            if (v.stringValue !== undefined) parsed[k] = v.stringValue;
            else if (v.integerValue !== undefined) parsed[k] = Number(v.integerValue);
            else if (v.booleanValue !== undefined) parsed[k] = v.booleanValue;
            else if (v.arrayValue !== undefined) {
                parsed[k] = (v.arrayValue.values || []).map((item: any) => {
                    if (item.mapValue?.fields) {
                        const map: Record<string, any> = {};
                        for (const [mk, mv] of Object.entries(item.mapValue.fields) as any[]) {
                            if (mv.stringValue !== undefined) map[mk] = mv.stringValue;
                        }
                        return map;
                    }
                    return item.stringValue ?? item;
                });
            }
        }
        return parsed;
    } catch { return null; }
}

// ─── Direction range helpers ───────────────────────────────────────────────────

const DIR_RANGES: Record<string, [number, number]> = {
    N:  [338, 382], // wraps: 338-360 + 0-22
    NE: [23,   67],
    E:  [68,  112],
    SE: [113, 157],
    S:  [158, 202],
    SW: [203, 247],
    W:  [248, 292],
    NW: [293, 337],
};

function inRange(az: number, dir: string): boolean {
    const r = DIR_RANGES[dir];
    if (!r) return false;
    const [lo, hi] = r;
    if (hi > 360) return az >= lo || az <= (hi - 360);
    return az >= lo && az <= hi;
}

function matchesExpected(az: number | null, expected: string[]): boolean {
    if (az == null) return false;
    return expected.some(d => inRange(az, d));
}

// ─── Geocoding helper ──────────────────────────────────────────────────────────

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    const key = APP_CONFIG.maps.key;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    try {
        const res = await fetch(url).then(r => r.json());
        if (res.status !== 'OK') {
            console.warn(`[Geocode] Failed for "${address}": ${res.status}`);
            return null;
        }
        return res.results[0].geometry.location as { lat: number; lng: number };
    } catch (e) {
        console.warn(`[Geocode] Error for "${address}":`, e);
        return null;
    }
}

// ─── Property cases ────────────────────────────────────────────────────────────

interface PropertyCase {
    address: string;
    expected: string[];      // acceptable azimuth directions, e.g. ['S', 'SE']
    badShowing: string;      // what the system incorrectly showed
    regression?: boolean;    // true = was correct before, broke with recent changes
}

// All properties marked "Bad" in the tester report, with tester-confirmed correct orientations.
const ALL_BAD: PropertyCase[] = [
    // ── Regressions (highlighted in report — were correct in earlier version) ──
    { address: '1565 Mendoza Ct, Pleasanton, CA 94566 US',    expected: ['W', 'SW'], badShowing: 'E',   regression: true },
    { address: '4019 Rennellwood Way, Pleasanton, CA 94566 US', expected: ['NW'],    badShowing: 'SE',  regression: true },
    { address: '674 Crystal Ct, Pleasanton, CA 94566 US',      expected: ['SW'],     badShowing: 'NE',  regression: true },
    { address: '7543 Maywood Dr, Pleasanton, CA 94588 US',     expected: ['S'],      badShowing: 'N',   regression: true },
    { address: '7551 Maywood Dr, Pleasanton, CA 94588 US',     expected: ['S'],      badShowing: 'E',   regression: true },

    // ── Non-regression bad cases ───────────────────────────────────────────────
    { address: '1237 Concord St, Pleasanton, CA 94566 US',     expected: ['NE'],     badShowing: 'SW'  },
    { address: '1380 Brookline Loop, Pleasanton, CA 94566 US', expected: ['SW'],     badShowing: 'N'   },
    { address: '1398 Piemonte Dr, Pleasanton, CA 94566 US',    expected: ['NE'],     badShowing: 'NW'  },
    { address: '1448 Freeman Ln, Pleasanton, CA 94566 US',     expected: ['SE'],     badShowing: 'SW'  },
    { address: '1515 Germano Way, Pleasanton, CA 94566 US',    expected: ['SE'],     badShowing: 'E'   },
    { address: '1527 Honey Suckle Ct, Pleasanton, CA 94566 US', expected: ['NW'],   badShowing: 'NE'  },
    { address: '1825 Crestline Rd, Pleasanton, CA 94566 US',   expected: ['S'],      badShowing: 'W'   },
    { address: '226 Birch Creek Dr, Pleasanton, CA 94566 US',  expected: ['S'],      badShowing: 'E'   },
    { address: '2270 Doccia Ct, Pleasanton, CA 94566 US',      expected: ['SE'],     badShowing: 'NE'  },
    { address: '254 Joseph Ln, Pleasanton, CA 94566 US',       expected: ['E'],      badShowing: 'NE'  },
    { address: '2577 Arlotta Pl, Pleasanton, CA 94588 US',     expected: ['NW'],     badShowing: 'SE'  },
    { address: '282 Del Valle Ct, Pleasanton, CA 94566 US',    expected: ['S'],      badShowing: 'NW'  },
    { address: '3492 Dorset St, Pleasanton, CA 94566 US',      expected: ['SE', 'S'], badShowing: 'SW', },
    { address: '3696 Woodbine Way, Pleasanton, CA 94588 US',   expected: ['W'],      badShowing: 'NW'  },
    { address: '3825 Brockton Dr, Pleasanton, CA 94588 US',    expected: ['W'],      badShowing: 'S'   },
    { address: '4159 Amberwood Cir, Pleasanton, CA 94588 US',  expected: ['NE'],     badShowing: 'SW'  },
    { address: '4173 Georgis Pl, Pleasanton, CA 94588 US',     expected: ['NE'],     badShowing: 'NW'  },
    { address: '4207 Zevanove Ct, Pleasanton, CA 94588 US',    expected: ['SE'],     badShowing: 'NW'  },
    { address: '4251 Lucero Ct, Pleasanton, CA 94588 US',      expected: ['SW'],     badShowing: 'SE'  },
    { address: '4253 Dorman Rd, Pleasanton, CA 94588 US',      expected: ['SW'],     badShowing: 'S'   },
    { address: '4262 Tamur Ct, Pleasanton, CA 94588 US',       expected: ['N'],      badShowing: 'S'   },
    { address: '4451 Fairlands Dr, Pleasanton, CA 94588 US',   expected: ['S'],      badShowing: 'E'   },
    { address: '5261 Springdale Ave, Pleasanton, CA 94566 US', expected: ['SW'],     badShowing: 'NE'  },
    { address: '5656 Belleza Dr, Pleasanton, CA 94588 US',     expected: ['S', 'SE'], badShowing: 'NW' },
    { address: '6156 Corte Padre, Pleasanton, CA 94588 US',    expected: ['N'],      badShowing: 'S'   },
    { address: '685 Palomino Dr Unit D, Pleasanton, CA 94566 US', expected: ['E'],   badShowing: 'N'  },
    { address: '7518 Rosedale Ct, Pleasanton, CA 94588 US',    expected: ['NE'],     badShowing: 'W'   },
    { address: '9500 Santos Ranch Rd, Pleasanton, CA 94588 US', expected: ['W'],     badShowing: 'NE'  },
];

// Geocoded coords cache filled in beforeAll
const coords: Map<string, { lat: number; lng: number }> = new Map();

// Address → zpid lookup from Firestore address_index
const zpidMap: Map<string, string> = new Map();

// zpid → cached street view URL from Firestore
const cachedSvUrls: Map<string, string | null> = new Map();

// ─── Test setup ────────────────────────────────────────────────────────────────

beforeAll(async () => {
    // Load API keys
    try {
        const keysPath = resolve('./tests/.batch-keys.json');
        const keys = JSON.parse(readFileSync(keysPath, 'utf-8')) as Record<string, string>;
        if (keys.VITE_GEMINI_API_KEY)      (APP_CONFIG as any).gemini.key = keys.VITE_GEMINI_API_KEY;
        if (keys.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key   = keys.VITE_GOOGLE_MAPS_API_KEY;
    } catch { /* fall through to env vars */ }

    (APP_CONFIG as any).models.flash = 'gemini-2.0-flash';

    if (!APP_CONFIG.gemini.key && process.env.VITE_GEMINI_API_KEY)
        (APP_CONFIG as any).gemini.key = process.env.VITE_GEMINI_API_KEY;
    if (!APP_CONFIG.maps.key && process.env.VITE_GOOGLE_MAPS_API_KEY)
        (APP_CONFIG as any).maps.key = process.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!APP_CONFIG.gemini.key) throw new Error('Gemini API key not loaded');
    if (!APP_CONFIG.maps.key)   throw new Error('Maps API key not loaded');

    // Geocode all addresses (parallelized — Maps API calls are cheap)
    console.log(`[Setup] Geocoding ${ALL_BAD.length} addresses...`);
    await Promise.all(ALL_BAD.map(async (c) => {
        const loc = await geocode(c.address);
        if (loc) coords.set(c.address, loc);
        else console.warn(`[Setup] Could not geocode: ${c.address}`);
    }));
    console.log(`[Setup] Geocoded ${coords.size}/${ALL_BAD.length} addresses.`);

    // Load address_index/pleasanton from Firestore (REST API — bypasses SDK mock)
    try {
        const indexData = await firestoreGet('address_index/pleasanton');
        const entries: Array<{ a: string; z: string }> = indexData?.entries || [];
        for (const e of entries) {
            if (e.a && e.z) zpidMap.set(e.a, e.z);
        }
        console.log(`[Setup] Loaded ${zpidMap.size} zpids from address_index/pleasanton`);

        // For each test address, resolve zpid and fetch cached street view URL + heading
        const norm = (s: string) => s.toLowerCase().replace(/[,\s]+/g, ' ').trim();
        await Promise.all(ALL_BAD.map(async (c) => {
            const zpid = zpidMap.get(c.address) ??
                [...zpidMap.entries()].find(([a]) => norm(a) === norm(c.address))?.[1];
            if (!zpid) return;

            // Fetch street view URL from assets subcollection
            const assetData = await firestoreGet(`properties/${zpid}/analysis/assets`);
            let svUrl = assetData?.streetView ?? null;

            if (svUrl?.includes('firebasestorage')) {
                // Also fetch heading from property root doc (stored by forceRefreshStreetViewUrl)
                const propData = await firestoreGet(`properties/${zpid}`);
                const heading = propData?.streetViewHeadingDeg;
                if (typeof heading === 'number') {
                    // Append heading so the wrong-road fallback in satellitaryService can parse it
                    svUrl = svUrl + `&heading=${Math.round(heading)}`;
                }
                cachedSvUrls.set(c.address, svUrl);
                console.log(`[Setup] Cached SV URL for "${c.address}" (zpid=${zpid}, heading=${heading ?? 'none'})`);
            }
        }));
    } catch (e) {
        console.warn('[Setup] Failed to load address_index:', e);
    }
}, 60_000);

// ─── Regression tests (highest priority — were correct before) ────────────────

describe('REGRESSION — was correct in earlier version, broke with recent changes', () => {
    for (const c of ALL_BAD.filter(p => p.regression)) {
        it(`${c.address} → expected ${c.expected.join('/')} (was showing ${c.badShowing})`, async () => {
            const loc = coords.get(c.address);
            if (!loc) {
                console.warn(`[SKIP] No coords for ${c.address}`);
                return;
            }

            const result = await runSatellitaryAnalysis(
                loc.lat, loc.lng,
                cachedSvUrls.get(c.address) ?? null,   // use Firebase cached URL if available
                'test-validation',
                undefined,          // no zpid — skip Firestore read/write
                c.address,
                null
            );

            const az = result.azimuth_degrees ?? -1;
            const pass = matchesExpected(az, c.expected);

            console.log(
                `[${pass ? 'PASS' : 'FAIL'}] ${c.address}\n` +
                `         got: ${result.final_orientation} (${az}°, confidence=${result.confidence})\n` +
                `    expected: ${c.expected.join(' or ')}\n` +
                `    path:     ${(result as any)._debug?.multiPano ? 'multi-pano' : result.aerial_only_mode ? 'aerial-only' : 'dual-direct'}\n` +
                `    explain:  ${result.explanation?.substring(0, 150)}`
            );

            expect(pass, `Expected ${c.expected.join('/')} but got ${result.final_orientation} (${az}°)`).toBe(true);
        }, 90_000);
    }
});

// ─── All other bad cases ───────────────────────────────────────────────────────

describe('BAD — incorrect orientation detected by testers', () => {
    for (const c of ALL_BAD.filter(p => !p.regression)) {
        it(`${c.address} → expected ${c.expected.join('/')} (was showing ${c.badShowing})`, async () => {
            const loc = coords.get(c.address);
            if (!loc) {
                console.warn(`[SKIP] No coords for ${c.address}`);
                return;
            }

            const result = await runSatellitaryAnalysis(
                loc.lat, loc.lng,
                cachedSvUrls.get(c.address) ?? null,   // use Firebase cached URL if available
                'test-validation',
                undefined,
                c.address,
                null
            );

            const az = result.azimuth_degrees ?? -1;
            const pass = matchesExpected(az, c.expected);

            console.log(
                `[${pass ? 'PASS' : 'FAIL'}] ${c.address}\n` +
                `         got: ${result.final_orientation} (${az}°, confidence=${result.confidence})\n` +
                `    expected: ${c.expected.join(' or ')}\n` +
                `    path:     ${(result as any)._debug?.multiPano ? 'multi-pano' : result.aerial_only_mode ? 'aerial-only' : 'dual-direct'}\n` +
                `    explain:  ${result.explanation?.substring(0, 150)}`
            );

            expect(pass, `Expected ${c.expected.join('/')} but got ${result.final_orientation} (${az}°)`).toBe(true);
        }, 90_000);
    }
});
