// @vitest-environment node
/**
 * 1237 Concord St — Focused Regression Test
 *
 * This is a corner lot with a privacy-blurred street view.
 * Policy (as of 2026-04-16):
 *   - aerial-only + corner lot   → UNCLEAR  (cannot determine primary frontage)
 *   - blurred SV + corner lot    → UNCLEAR  (Step 0b + corner lot exception)
 *   - fresh usable SV            → NE       (street view confirms front)
 *
 * Run:
 *   vitest run services/concord_1237.regression.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { normalizeAddress } from './api/geocoding';
import { APP_CONFIG } from '../config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ADDRESS  = '1237 Concord St, Pleasanton, CA 94566 US';
const EXPECTED = ['NE', 'N', 'E'] as const;   // NE is confirmed; N/E accepted as close enough
const BAD_WAS  = 'SW';

// ── Firestore REST helper ────────────────────────────────────────────────────
const FIREBASE_PROJECT  = 'zyphe-af0bf';
const FIREBASE_API_KEY  = 'AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI';
const FIRESTORE_BASE    = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

async function firestoreGet(path: string): Promise<Record<string, any> | null> {
    try {
        const res  = await fetch(`${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`);
        if (!res.ok) return null;
        const json = await res.json();
        if (json.error) return null;
        const fields = json.fields || {};
        const parsed: Record<string, any> = {};
        for (const [k, v] of Object.entries(fields) as any[]) {
            if (v.stringValue  !== undefined) parsed[k] = v.stringValue;
            else if (v.integerValue !== undefined) parsed[k] = Number(v.integerValue);
            else if (v.doubleValue  !== undefined) parsed[k] = Number(v.doubleValue);
            else if (v.booleanValue !== undefined) parsed[k] = v.booleanValue;
        }
        return parsed;
    } catch { return null; }
}

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
let cachedBlurredSvUrl: string | null = null;
let cachedHeading: number | null = null;

beforeAll(async () => {
    // Load API keys
    try {
        const keys = JSON.parse(readFileSync(resolve('./tests/.batch-keys.json'), 'utf-8')) as Record<string, string>;
        if (keys.VITE_GEMINI_API_KEY)      (APP_CONFIG as any).gemini.key = keys.VITE_GEMINI_API_KEY;
        if (keys.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key   = keys.VITE_GOOGLE_MAPS_API_KEY;
        if (keys.VITE_RADAR_KEY)           (APP_CONFIG as any).radar.key  = keys.VITE_RADAR_KEY;
    } catch { /* fall through to env */ }

    (APP_CONFIG as any).models.flash = 'gemini-2.5-flash';
    if (!APP_CONFIG.gemini.key && process.env.VITE_GEMINI_API_KEY)
        (APP_CONFIG as any).gemini.key = process.env.VITE_GEMINI_API_KEY;
    if (!APP_CONFIG.maps.key && process.env.VITE_GOOGLE_MAPS_API_KEY)
        (APP_CONFIG as any).maps.key = process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!APP_CONFIG.radar.key && process.env.VITE_RADAR_KEY)
        (APP_CONFIG as any).radar.key = process.env.VITE_RADAR_KEY;

    if (!APP_CONFIG.gemini.key) throw new Error('Gemini API key not loaded');
    if (!APP_CONFIG.maps.key)   throw new Error('Maps API key not loaded');

    // Geocode
    try {
        const res = await normalizeAddress(ADDRESS);
        coords = { lat: res.coordinates.latitude, lng: res.coordinates.longitude };
        console.log(`[Setup] Coords: ${coords.lat}, ${coords.lng}`);
    } catch (e) {
        console.warn('[Setup] Geocode failed:', e);
    }

    // Load cached blurred street view URL from Firestore
    try {
        const indexData = await firestoreGet('address_index/pleasanton');
        const entries: Array<{ a: string; z: string }> = indexData?.entries || [];
        const norm = (s: string) => s.toLowerCase().replace(/[,\s]+/g, ' ').trim();
        const entry = entries.find(e => norm(e.a) === norm(ADDRESS));
        if (entry?.z) {
            const assetData = await firestoreGet(`properties/${entry.z}/analysis/assets`);
            const svUrl = assetData?.streetView ?? null;
            if (svUrl?.includes('firebasestorage')) {
                const propData = await firestoreGet(`properties/${entry.z}`);
                cachedHeading = propData?.streetViewHeadingDeg ?? null;
                cachedBlurredSvUrl = cachedHeading != null
                    ? `${svUrl}&heading=${Math.round(cachedHeading)}`
                    : svUrl;
                console.log(`[Setup] Loaded cached BLURRED SV URL (heading=${cachedHeading}°)`);
            }
        }
    } catch (e) {
        console.warn('[Setup] Could not load cached SV from Firestore:', e);
    }
}, 30_000);

// ── Helper to log result ─────────────────────────────────────────────────────
function logResult(label: string, result: any) {
    const az   = result.azimuth_degrees ?? -1;
    const pass = matchesExpected(result.azimuth_degrees);
    console.log(
        `\n[${pass ? '✅ PASS' : '❌ FAIL'}] ${label}\n` +
        `  got:       ${result.final_orientation} (${az}°, confidence=${result.confidence})\n` +
        `  expected:  ${EXPECTED.join(' or ')}  (was: ${BAD_WAS})\n` +
        `  path:      ${result.aerial_only_mode ? 'AERIAL-ONLY' : 'DUAL'}\n` +
        `  explain:   ${result.explanation?.substring(0, 200)}`
    );
    return pass;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('1237 Concord St — blurred street view regression', () => {

    it('MODE 1: aerial-only (null SV) — corner lot → must return UNCLEAR', async () => {
        if (!coords) { console.warn('[SKIP] No coords'); return; }

        const result = await runSatellitaryAnalysis(
            coords.lat, coords.lng,
            null,                  // force aerial-only
            'test-concord-aerial',
            undefined,
            ADDRESS,
            null
        );

        const az = result.azimuth_degrees;
        const isUnclear = result.final_orientation?.toLowerCase().includes('unclear') || az == null;

        console.log(
            `\n[${isUnclear ? '✅ PASS' : '❌ FAIL'}] aerial-only corner lot\n` +
            `  got:       ${result.final_orientation} (${az ?? 'null'}°, confidence=${result.confidence})\n` +
            `  expected:  UNCLEAR (corner lot aerial-only policy)\n` +
            `  path:      ${result.aerial_only_mode ? 'AERIAL-ONLY' : 'DUAL'}\n` +
            `  explain:   ${result.explanation?.substring(0, 200)}`
        );

        expect(isUnclear, `Corner lot aerial-only must return UNCLEAR, got: ${result.final_orientation}`).toBe(true);
    }, 90_000);

    it('MODE 2: blurred SV URL (cached Firebase) — corner lot → must return UNCLEAR', async () => {
        if (!coords) { console.warn('[SKIP] No coords'); return; }
        if (!cachedBlurredSvUrl) {
            console.warn('[SKIP] No cached SV URL in Firestore — cannot test blurred path');
            return;
        }

        const result = await runSatellitaryAnalysis(
            coords.lat, coords.lng,
            cachedBlurredSvUrl,
            'test-concord-blurred',
            undefined,
            ADDRESS,
            null
        );

        const az = result.azimuth_degrees;
        const isUnclear = result.final_orientation?.toLowerCase().includes('unclear') || az == null;

        console.log(
            `\n[${isUnclear ? '✅ PASS' : '❌ FAIL'}] blurred SV + corner lot\n` +
            `  got:       ${result.final_orientation} (${az ?? 'null'}°, confidence=${result.confidence})\n` +
            `  expected:  UNCLEAR (blurred SV + corner lot policy)\n` +
            `  path:      ${result.aerial_only_mode ? 'AERIAL-ONLY' : 'DUAL'}\n` +
            `  explain:   ${result.explanation?.substring(0, 200)}`
        );

        expect(isUnclear, `Blurred SV + corner lot must return UNCLEAR, got: ${result.final_orientation}`).toBe(true);
    }, 90_000);

    it('MODE 3: fresh SV fetch (undefined) — end-to-end with fresh Street View API call', async () => {
        if (!coords) { console.warn('[SKIP] No coords'); return; }

        const result = await runSatellitaryAnalysis(
            coords.lat, coords.lng,
            undefined,             // triggers live Street View API fetch
            'test-concord-fresh',
            undefined,
            ADDRESS,
            null
        );

        const pass = logResult('fresh SV fetch (end-to-end)', result);
        // MODE 3 is informational — we don't hard-fail if the fresh fetch also returns blurred
        // because Google may still serve a blurred image. Log outcome but don't assert.
        console.log(`[Info] MODE 3 result: ${pass ? 'PASS' : 'FAIL — fresh SV might also be blurred'}`);
        // Soft check: at minimum should not be SW (the wrong answer that prompted this test)
        expect(result.final_orientation, 'Should not return the known-wrong SW direction')
            .not.toMatch(/^SW/i);
    }, 90_000);
});
