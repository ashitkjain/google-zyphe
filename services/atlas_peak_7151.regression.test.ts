// @vitest-environment node
/**
 * 7151 Atlas Peak Dr, Dublin, CA — GPS Self-Check Regression Test
 *
 * This is a standard lot sandwiched between Atlas Peak Dr (residential, diagonal NW-SE)
 * and I-580 freeway to the north.
 *
 * Without bearing hint: Gemini sees the freeway and returns North or West
 * With bearing hint + Step 6 GPS self-check: should return Southwest
 *
 * Run:
 *   vitest run services/atlas_peak_7151.regression.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { APP_CONFIG } from '../config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ADDRESS  = '7151 Atlas Peak Dr, Dublin, CA 94568';
const EXPECTED = ['SW', 'S', 'SE'] as const;  // SW is GT; S/SE acceptable
const BAD_WAS  = 'N';                          // freeway trap — what it used to return

// ── Direction range helpers ──────────────────────────────────────────────────
const DIR_RANGES: Record<string, [number, number]> = {
    N:  [338, 382],
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

function matchesExpected(az: number | null): boolean {
    if (az == null) return false;
    return EXPECTED.some(d => inRange(az, d));
}

// ── Setup ────────────────────────────────────────────────────────────────────
let coords: { lat: number; lng: number } | null = null;

beforeAll(async () => {
    // Load API keys
    try {
        const keys = JSON.parse(readFileSync(resolve('./tests/.batch-keys.json'), 'utf-8')) as Record<string, string>;
        if (keys.VITE_GEMINI_API_KEY)      (APP_CONFIG as any).gemini.key = keys.VITE_GEMINI_API_KEY;
        if (keys.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key   = keys.VITE_GOOGLE_MAPS_API_KEY;
    } catch { /* fall through to env */ }

    (APP_CONFIG as any).models.flash = 'gemini-2.5-flash';
    if (!APP_CONFIG.gemini.key && process.env.VITE_GEMINI_API_KEY)
        (APP_CONFIG as any).gemini.key = process.env.VITE_GEMINI_API_KEY;
    if (!APP_CONFIG.maps.key && process.env.VITE_GOOGLE_MAPS_API_KEY)
        (APP_CONFIG as any).maps.key = process.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!APP_CONFIG.gemini.key) throw new Error('Gemini API key not loaded');
    if (!APP_CONFIG.maps.key)   throw new Error('Maps API key not loaded');

    // Geocode
    const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(ADDRESS)}&key=${APP_CONFIG.maps.key}`
    ).then(r => r.json());
    if (geoRes.status === 'OK') {
        coords = geoRes.results[0].geometry.location;
        console.log(`[Setup] Coords: ${coords!.lat}, ${coords!.lng}`);
    } else {
        console.warn('[Setup] Geocode failed:', geoRes.status);
    }
}, 30_000);

// ── Helper ───────────────────────────────────────────────────────────────────
function logResult(label: string, result: any) {
    const az   = result.azimuth_degrees ?? -1;
    const pass = matchesExpected(result.azimuth_degrees);
    console.log(
        `\n[${pass ? '✅ PASS' : '❌ FAIL'}] ${label}\n` +
        `  got:       ${result.final_orientation} (${az}°, confidence=${result.confidence})\n` +
        `  expected:  ${EXPECTED.join(' or ')}  (used to be: ${BAD_WAS})\n` +
        `  path:      ${result.aerial_only_mode ? 'AERIAL-ONLY' : 'DUAL'}\n` +
        `  explain:   ${result.explanation?.substring(0, 300)}`
    );
    return pass;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('7151 Atlas Peak Dr — GPS bearing self-check regression', () => {

    it('aerial-only (null SV) — should return SW not N/W due to GPS self-check', async () => {
        if (!coords) { console.warn('[SKIP] No coords'); return; }

        const result = await runSatellitaryAnalysis(
            coords.lat, coords.lng,
            null,               // force aerial-only (no street view)
            'test-atlas-aerial',
            undefined,
            ADDRESS,
            null
        );

        const pass = logResult('aerial-only (null SV)', result);

        // Must NOT return North — the freeway trap
        expect(result.final_orientation, 'Must not return North (freeway trap)')
            .not.toMatch(/^N(?!E|W)/i);

        // Must NOT return West alone
        expect(result.final_orientation, 'Must not return West (was 270°, ~45° off SW)')
            .not.toMatch(/^West$/i);

        // Should be SW, S, or SE (facing Atlas Peak Dr)
        expect(pass, `Expected SW/S/SE, got: ${result.final_orientation} (${result.azimuth_degrees}°)`).toBe(true);
    }, 90_000);

});
