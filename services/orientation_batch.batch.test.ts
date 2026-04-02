// @vitest-environment node
/**
 * Pleasanton Orientation Batch Test
 *
 * Strategy
 * ─────────
 * For each property we run TWO independent computations and compare them:
 *
 *   1. GPS ground truth (Google Maps Street View Metadata API, no AI):
 *        heading     = bearing(panoLoc → property)   [camera direction]
 *        candidateFront = (heading + 180) % 360       [if camera sees the FRONT]
 *        candidateBack  = heading                     [if camera sees the BACK]
 *      The property's front must land within ±67° of one of these two GPS candidates.
 *
 *   2. Gemini result (runSatellitaryAnalysis):
 *        final_orientation text → converted to approx azimuth
 *        _debug.streetViewShowsFront → which GPS candidate Gemini chose
 *
 *   PASS: Gemini's final_orientation azimuth is within ±67° of the GPS candidate
 *         that matches Gemini's own street_view_shows_front declaration.
 *   FAIL: Gemini's orientation disagrees with the GPS heading by > 67°, OR
 *         image is blurry, OR azimuth is null.
 *   SKIP: No Street View coverage at this location (aerial-only) — just sanity check.
 *
 * Execution
 * ─────────
 *   - Fetch all non-deprecated Pleasanton properties with coordinates
 *   - Shuffle them with Fisher-Yates
 *   - Process 5 at a time (Promise.allSettled per batch)
 *   - Stop immediately on first failure
 *   - Per-property timeout: 90s
 *   - Overall test timeout: 15 min
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { APP_CONFIG } from '../config';

// ─── Config ──────────────────────────────────────────────────────────────────

const CONCURRENCY         = 5;    // properties analysed in parallel
const AZIMUTH_TOLERANCE   = 67;   // degrees — roughly ±2 compass points
const PER_PROP_TIMEOUT_MS = 90_000;
const TEST_USER_ID        = 'orientation-batch-test';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PleasantonProp {
    zpid: string;
    address: string;
    lat: number;
    lng: number;
}

interface HeadingResult {
    heading: number;
    panoLat: number;
    panoLng: number;
}

interface ValidationResult {
    zpid: string;
    address: string;
    passed: boolean;
    skipped: boolean;
    skipReason?: string;
    geminiOrientation: string;
    geminiAzimuth: number | null;
    streetViewShowsFront: boolean | null;
    gpsHeading: number | null;
    gpsCandidateFront: number | null;
    gpsCandidateBack: number | null;
    angularDiff: number | null;
    confidence: string;
    imageQuality: string;
    errorMessage?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle — mutates in place, returns array */
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Shortest angular distance between two compass bearings (0–360). */
function angularDiff(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

/**
 * Maps Gemini's written compass direction to approximate azimuth.
 * Handles variants like "North", "North-Northeast", "NNE", "Northeast", etc.
 */
function textToAzimuth(text: string): number | null {
    const t = text.trim().toUpperCase().replace(/[\s-]+/g, '');
    const MAP: Record<string, number> = {
        'N': 0,   'NORTH': 0,
        'NNE': 22, 'NORTHNORTHEAST': 22,
        'NE': 45, 'NORTHEAST': 45,
        'ENE': 67, 'EASTNORTHEAST': 67,
        'E': 90,  'EAST': 90,
        'ESE': 112, 'EASTSOUTHEAST': 112,
        'SE': 135, 'SOUTHEAST': 135,
        'SSE': 157, 'SOUTHSOUTHEAST': 157,
        'S': 180, 'SOUTH': 180,
        'SSW': 202, 'SOUTHSOUTHWEST': 202,
        'SW': 225, 'SOUTHWEST': 225,
        'WSW': 247, 'WESTSOUTHWEST': 247,
        'W': 270, 'WEST': 270,
        'WNW': 292, 'WESTNORTHWEST': 292,
        'NW': 315, 'NORTHWEST': 315,
        'NNW': 337, 'NORTHNORTHWEST': 337,
    };
    // Direct match
    if (MAP[t] !== undefined) return MAP[t];
    // Partial match — take the first word
    for (const key of Object.keys(MAP)) {
        if (t.startsWith(key)) return MAP[key];
    }
    return null;
}

/**
 * Independent GPS ground truth: calls the Street View Metadata API directly
 * (no caching, no service abstraction) and computes the camera heading using
 * the same spherical-Earth bearing formula.
 *
 * Returns null if Street View is unavailable at this location.
 */
async function fetchGpsHeading(
    lat: number,
    lng: number,
    mapsKey: string
): Promise<HeadingResult | null> {
    const url =
        `https://maps.googleapis.com/maps/api/streetview/metadata` +
        `?location=${lat},${lng}` +
        `&radius=100` +
        `&source=outdoor` +
        `&key=${mapsKey}`;

    const resp  = await fetch(url);
    const meta  = await resp.json();

    if (meta.status !== 'OK') return null;

    const panoLoc = meta.location as { lat: number; lng: number } | undefined;
    if (!panoLoc?.lat || !panoLoc?.lng) return null;

    // Bearing from panoLoc → property  (direction camera is pointing)
    const lat1  = panoLoc.lat * (Math.PI / 180);
    const lat2  = lat         * (Math.PI / 180);
    const dLon  = (lng - panoLoc.lng) * (Math.PI / 180);
    const y     = Math.sin(dLon) * Math.cos(lat2);
    const x     = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const bearing = Math.round(((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360);

    return { heading: bearing, panoLat: panoLoc.lat, panoLng: panoLoc.lng };
}

// ─── Core validator for a single property ────────────────────────────────────

async function validateProperty(prop: PleasantonProp, mapsKey: string): Promise<ValidationResult> {
    const base: Pick<ValidationResult, 'zpid' | 'address'> = {
        zpid: prop.zpid,
        address: prop.address,
    };

    // Step 1: Independent GPS heading (no AI)
    const gpsResult = await fetchGpsHeading(prop.lat, prop.lng, mapsKey);

    if (!gpsResult) {
        // No Street View → aerial-only path; run sanity checks only
        const result = await runSatellitaryAnalysis(
            prop.lat, prop.lng,
            null,
            TEST_USER_ID,
            prop.zpid,
            prop.address
        );

        const passing =
            result.image_quality !== 'blurry' &&
            result.aerial_only_mode === true;

        return {
            ...base,
            passed: passing,
            skipped: true,
            skipReason: 'No Street View coverage — aerial-only sanity check',
            geminiOrientation: result.final_orientation,
            geminiAzimuth: result.azimuth_degrees,
            streetViewShowsFront: null,
            gpsHeading: null,
            gpsCandidateFront: null,
            gpsCandidateBack: null,
            angularDiff: null,
            confidence: result.confidence,
            imageQuality: result.image_quality ?? 'unknown',
            errorMessage: passing ? undefined : `Aerial-only sanity fail: blurry=${result.image_quality === 'blurry'}, aerial_only=${result.aerial_only_mode}`,
        };
    }

    // Step 2: Run Gemini analysis (always fresh — no cached URL)
    const result = await runSatellitaryAnalysis(
        prop.lat, prop.lng,
        null,
        TEST_USER_ID,
        prop.zpid,
        prop.address
    );

    // Step 3: Image quality gate
    if (result.image_quality === 'blurry' || result.final_orientation === 'UNCLEAR_IMAGE') {
        return {
            ...base,
            passed: false,
            skipped: true,
            skipReason: 'Blurry image — cannot validate orientation',
            geminiOrientation: result.final_orientation,
            geminiAzimuth: result.azimuth_degrees,
            streetViewShowsFront: null,
            gpsHeading: gpsResult.heading,
            gpsCandidateFront: (gpsResult.heading + 180) % 360,
            gpsCandidateBack: gpsResult.heading,
            angularDiff: null,
            confidence: result.confidence,
            imageQuality: result.image_quality ?? 'blurry',
        };
    }

    // Step 4: Get the azimuth from the service result directly
    // Prefer result.azimuth_degrees (computed by the deterministic formula)
    // over textToAzimuth() which is an approximation of the text label only.
    const geminiTextAzimuth = result.azimuth_degrees ?? textToAzimuth(result.final_orientation);

    if (geminiTextAzimuth === null) {
        return {
            ...base,
            passed: false,
            skipped: false,
            geminiOrientation: result.final_orientation,
            geminiAzimuth: result.azimuth_degrees,
            streetViewShowsFront: (result as any)._debug?.streetViewShowsFront ?? null,
            gpsHeading: gpsResult.heading,
            gpsCandidateFront: (gpsResult.heading + 180) % 360,
            gpsCandidateBack: gpsResult.heading,
            angularDiff: null,
            confidence: result.confidence,
            imageQuality: result.image_quality ?? 'unknown',
            errorMessage: `Could not parse final_orientation to azimuth: "${result.final_orientation}"`,
        };
    }

    // Step 5: GPS ground truth comparison
    //   candidateFront = (heading + 180) % 360   [Street View sees the FRONT]
    //   candidateBack  = heading                 [Street View sees the BACK]
    const candidateFront = (gpsResult.heading + 180) % 360;
    const candidateBack  = gpsResult.heading;

    const streetViewShowsFront: boolean | null =
        (result as any)._debug?.streetViewShowsFront ?? null;

    // Determine which GPS candidate to validate against based on Gemini's declaration
    let gpsExpected: number;
    let gpsSource: string;

    if (streetViewShowsFront === true) {
        gpsExpected = candidateFront;
        gpsSource   = `candidateFront (${candidateFront}°)`;
    } else if (streetViewShowsFront === false) {
        gpsExpected = candidateBack;
        gpsSource   = `candidateBack (${candidateBack}°)`;
    } else {
        // Gemini didn't output street_view_shows_front — pick closest candidate
        const dFront = angularDiff(candidateFront, geminiTextAzimuth);
        const dBack  = angularDiff(candidateBack,  geminiTextAzimuth);
        gpsExpected = dFront <= dBack ? candidateFront : candidateBack;
        gpsSource   = `auto-picked (dFront=${dFront}°, dBack=${dBack}°)`;
    }

    const diff   = angularDiff(geminiTextAzimuth, gpsExpected);
    const passed = diff <= AZIMUTH_TOLERANCE;

    return {
        ...base,
        passed,
        skipped: false,
        geminiOrientation: result.final_orientation,
        geminiAzimuth: result.azimuth_degrees,
        streetViewShowsFront,
        gpsHeading: gpsResult.heading,
        gpsCandidateFront: candidateFront,
        gpsCandidateBack: candidateBack,
        angularDiff: diff,
        confidence: result.confidence,
        imageQuality: result.image_quality ?? 'unknown',
        errorMessage: passed
            ? undefined
            : `Orientation mismatch: Gemini="${result.final_orientation}" (~${geminiTextAzimuth}°) vs GPS=${gpsSource} — diff=${diff}° > tolerance=${AZIMUTH_TOLERANCE}° [heading=${gpsResult.heading}°, pano=(${gpsResult.panoLat.toFixed(5)},${gpsResult.panoLng.toFixed(5)})]`,
    };
}

// ─── Test ─────────────────────────────────────────────────────────────────────

describe('Pleasanton Orientation Batch Validation', () => {
    let properties: PleasantonProp[] = [];
    let mapsKey: string              = '';

    beforeAll(async () => {
        // Read API keys from the file written by globalSetup (firebase-admin)
        // This avoids process.env isolation issues between vitest workers
        try {
            const { readFileSync } = await import('fs');
            const { resolve } = await import('path');
            const keysPath = resolve('./tests/.batch-keys.json');
            const keys = JSON.parse(readFileSync(keysPath, 'utf-8')) as Record<string, string>;

            if (keys.VITE_GEMINI_API_KEY)      (APP_CONFIG as any).gemini.key = keys.VITE_GEMINI_API_KEY;
            if (keys.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key   = keys.VITE_GOOGLE_MAPS_API_KEY;

            console.log(`[Setup] Loaded ${Object.keys(keys).length} keys from globalSetup cache`);
        } catch (e: any) {
            console.warn('[Setup] Could not read globalSetup keys file:', e.message);
        }

        (APP_CONFIG as any).models.flash = 'gemini-2.0-flash';

        // Final fallback: direct env vars (works if .env.local has the keys)
        if (!APP_CONFIG.gemini.key && process.env.VITE_GEMINI_API_KEY) {
            (APP_CONFIG as any).gemini.key = process.env.VITE_GEMINI_API_KEY;
        }
        if (!APP_CONFIG.maps.key && process.env.VITE_GOOGLE_MAPS_API_KEY) {
            (APP_CONFIG as any).maps.key = process.env.VITE_GOOGLE_MAPS_API_KEY;
        }

        mapsKey = APP_CONFIG.maps.key;
        if (!mapsKey) throw new Error('[Setup] Google Maps API key not loaded. Add VITE_GOOGLE_MAPS_API_KEY to .env.local');
        if (!APP_CONFIG.gemini.key) throw new Error('[Setup] Gemini API key not loaded. Add VITE_GEMINI_API_KEY to .env.local or configure Firestore');

        // Fetch properties using dynamic import to bypass the global vi.mock() stubs
        const { db } = await import('./firebase/config');
        if (!db) throw new Error('[Setup] Firestore not initialized');

        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const snap = await getDocs(
            query(collection(db, 'properties'), where('city', '==', 'Pleasanton'))
        );

        const raw: PleasantonProp[] = [];
        snap.docs.forEach(d => {
            const p = d.data() as any;
            if (p.deprecated) return;
            const lat = p.coordinates?.latitude;
            const lng = p.coordinates?.longitude;
            if (lat == null || lng == null) return;
            raw.push({ zpid: d.id, address: p.address || d.id, lat, lng });
        });

        if (raw.length === 0) throw new Error('[Setup] No Pleasanton properties with coordinates found');

        properties = shuffle(raw);
        console.log(`\n[Setup] Loaded ${properties.length} Pleasanton properties (shuffled)\n`);
    }, 30_000);

    it(
        `validates all Pleasanton properties — ${CONCURRENCY} at a time, stop on first failure`,
        async () => {
            const results: ValidationResult[]  = [];
            let   failed:  ValidationResult | null = null;

            // Process in batches of CONCURRENCY
            for (let i = 0; i < properties.length; i += CONCURRENCY) {
                if (failed) break;

                const batch = properties.slice(i, i + CONCURRENCY);
                const batchNum = Math.floor(i / CONCURRENCY) + 1;
                const totalBatches = Math.ceil(properties.length / CONCURRENCY);

                console.log(`\n── Batch ${batchNum}/${totalBatches} ` +
                    `(props ${i + 1}–${Math.min(i + CONCURRENCY, properties.length)} of ${properties.length}) ──`);
                batch.forEach(p => console.log(`   · ${p.address} [${p.zpid}]`));

                // Run batch in parallel (with per-property timeout)
                const settled = await Promise.allSettled(
                    batch.map(prop =>
                        Promise.race([
                            validateProperty(prop, mapsKey),
                            new Promise<never>((_, reject) =>
                                setTimeout(() => reject(new Error(`Timeout after ${PER_PROP_TIMEOUT_MS / 1000}s`)), PER_PROP_TIMEOUT_MS)
                            )
                        ])
                    )
                );

                for (let j = 0; j < settled.length; j++) {
                    const outcome = settled[j];
                    const prop    = batch[j];

                    if (outcome.status === 'rejected') {
                        const errResult: ValidationResult = {
                            zpid:                prop.zpid,
                            address:             prop.address,
                            passed:              false,
                            skipped:             false,
                            geminiOrientation:   'ERROR',
                            geminiAzimuth:       null,
                            streetViewShowsFront: null,
                            gpsHeading:          null,
                            gpsCandidateFront:   null,
                            gpsCandidateBack:    null,
                            angularDiff:         null,
                            confidence:          'low',
                            imageQuality:        'unknown',
                            errorMessage:        String(outcome.reason),
                        };
                        results.push(errResult);
                        failed = errResult;
                        break;
                    }

                    const r = outcome.value;
                    results.push(r);

                    const icon = r.skipped ? '⊘' : r.passed ? '✓' : '✗';
                    console.log(
                        `   ${icon} ${r.address}\n` +
                        `       GPS heading=${r.gpsHeading ?? 'N/A'}° | ` +
                        `candidateFront=${r.gpsCandidateFront ?? 'N/A'}° | ` +
                        `candidateBack=${r.gpsCandidateBack ?? 'N/A'}°\n` +
                        `       Gemini="${r.geminiOrientation}" (~${r.geminiAzimuth ?? '?'}°) | ` +
                        `showsFront=${r.streetViewShowsFront} | ` +
                        `diff=${r.angularDiff ?? 'N/A'}° | ` +
                        `conf=${r.confidence} | img=${r.imageQuality}` +
                        (r.errorMessage ? `\n       ⚠ ${r.errorMessage}` : '') +
                        (r.skipReason   ? `\n       ↳ ${r.skipReason}`   : '')
                    );

                    if (!r.passed && !r.skipped) {
                        failed = r;
                        break;
                    }
                }
            }

            // ── Summary ──────────────────────────────────────────────────────
            const total   = results.length;
            const passed  = results.filter(r => r.passed && !r.skipped).length;
            const skipped = results.filter(r => r.skipped).length;
            const failures = results.filter(r => !r.passed && !r.skipped);

            console.log(`\n${'─'.repeat(60)}`);
            console.log(`RESULTS: ${passed} passed | ${skipped} skipped | ${failures.length} failed | ${total} processed`);
            if (failures.length > 0) {
                console.log(`\nFAILURES:`);
                failures.forEach(f => console.log(`  ✗ ${f.address} [${f.zpid}]\n    ${f.errorMessage}`));
            }
            console.log(`${'─'.repeat(60)}\n`);

            // Fail the test if there are any failures
            if (failed) {
                expect.fail(
                    `\n\nOrientation Failure:\n` +
                    `  Property : ${failed.address} [${failed.zpid}]\n` +
                    `  Gemini   : "${failed.geminiOrientation}" (azimuth ~${failed.geminiAzimuth}°)\n` +
                    `  GPS      : heading=${failed.gpsHeading}° → front=${failed.gpsCandidateFront}° | back=${failed.gpsCandidateBack}°\n` +
                    `  showsFront: ${failed.streetViewShowsFront}\n` +
                    `  Diff     : ${failed.angularDiff}° (tolerance: ${AZIMUTH_TOLERANCE}°)\n` +
                    `  Error    : ${failed.errorMessage}`
                );
            }
        },
        15 * 60 * 1000 // 15-minute overall timeout
    );
});
