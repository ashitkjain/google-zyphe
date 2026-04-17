// @vitest-environment node
/**
 * Regression test: 218 Birch Creek Dr, Pleasanton, CA 94566
 * Townhome unit on Birch Creek Dr — street runs N-S on the west side.
 * Expected front orientation: WEST (faces Birch Creek Dr).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { APP_CONFIG } from '../config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const LAT = 37.664001;
const LNG = -121.864414;
const ADDRESS = '218 Birch Creek Dr, Pleasanton, CA 94566 US';

describe('218 Birch Creek Dr — multi-pano fallback orientation', () => {
    beforeAll(async () => {
        // Load API keys (same pattern as orientation_batch.batch.test.ts)
        try {
            const keysPath = resolve('./tests/.batch-keys.json');
            const keys = JSON.parse(readFileSync(keysPath, 'utf-8')) as Record<string, string>;
            if (keys.VITE_GEMINI_API_KEY)      (APP_CONFIG as any).gemini.key = keys.VITE_GEMINI_API_KEY;
            if (keys.VITE_GOOGLE_MAPS_API_KEY) (APP_CONFIG as any).maps.key   = keys.VITE_GOOGLE_MAPS_API_KEY;
        } catch { /* fall through to env */ }

        (APP_CONFIG as any).models.flash = 'gemini-2.0-flash';

        if (!APP_CONFIG.gemini.key && process.env.VITE_GEMINI_API_KEY)
            (APP_CONFIG as any).gemini.key = process.env.VITE_GEMINI_API_KEY;
        if (!APP_CONFIG.maps.key && process.env.VITE_GOOGLE_MAPS_API_KEY)
            (APP_CONFIG as any).maps.key = process.env.VITE_GOOGLE_MAPS_API_KEY;

        if (!APP_CONFIG.gemini.key) throw new Error('Gemini API key not loaded');
        if (!APP_CONFIG.maps.key)   throw new Error('Maps API key not loaded');
    });

    it('should identify front orientation as South (~180°)', async () => {
        console.log(`[Test] Running orientation for ${ADDRESS}...`);

        const result = await runSatellitaryAnalysis(
            LAT, LNG,
            null,               // no cached street view
            'test-birch-creek',
            undefined,          // no zpid — skip Firestore
            ADDRESS,
            null
        );

        const debug = (result as any)._debug;
        console.log('[Test] final_orientation:', result.final_orientation);
        console.log('[Test] confidence:       ', result.confidence);
        console.log('[Test] azimuth_degrees:  ', result.azimuth_degrees);
        console.log('[Test] garage_direction: ', result.garage_direction);
        console.log('[Test] pool_visible:     ', result.pool_visible);
        console.log('[Test] aerial_only_mode: ', result.aerial_only_mode);
        console.log('[Test] _debug:           ', JSON.stringify(debug));
        console.log('[Test] explanation:      ', result.explanation?.substring(0, 300));

        // Must be West (225°–315° covers WSW → W → WNW)
        // 218 Birch Creek Dr faces WEST toward Birch Creek Dr (a N-S street)
        const az = result.azimuth_degrees ?? -1;
        const isWest = result.final_orientation.toLowerCase().includes('west') ||
                        (az >= 225 && az <= 315);

        expect(isWest).toBe(true);
    }, 90_000);
});
