
import { describe, it, expect, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { loadApiKeys } from './apiKeyLoader';
import { APP_CONFIG } from '../config';

/**
 * Orientation Analysis Test: 1039 Hopkins Way, Pleasanton
 * 
 * This test validates that the AI correctly identifies the orientation
 * of the property at 1039 Hopkins Way, Pleasanton.
 * 
 * Based on visual verification:
 * - The front door faces North.
 * - The property does NOT have a pool.
 * 
 * Requirements:
 * - Valid Gemini API key in Firestore or VITE_GEMINI_API_KEY env var.
 */
describe('Property Orientation Analysis - 1039 Hopkins Way', () => {
    beforeAll(async () => {
        // Load API keys from Firestore or Env
        await loadApiKeys();
        
        // Ensure we are using the primary models for testing
        (APP_CONFIG as any).models.flash = 'gemini-2.0-flash';
    });

    it('should correctly identify the orientation as North and detect no pool', async () => {
        const zpid = "25086332";
        const lat = 37.6460824;
        const lng = -121.8699326;
        const address = "1039 Hopkins Way, Pleasanton, CA 94566";
        const userId = "test-user-orientation-validation";

        console.log(`[Test] Running orientation analysis for ${address}...`);

        try {
            const result = await runSatellitaryAnalysis(
                lat,
                lng,
                null, // No cached URL, force live fetch
                userId,
                zpid,
                address,
                "Beautiful home in Pleasanton"
            );

            console.log(`[Test] Result for ${address}:`);
            console.log(`   - Final Orientation: ${result.final_orientation}`);
            console.log(`   - Raw Visual Guess (Direct): ${result.visual_azimuth_estimate}°`);
            console.log(`   - Refined Azimuth (Algo): ${result.azimuth_degrees}°`);
            console.log(`   - Confidence: ${result.confidence}`);
            console.log(`   - Pool Visible: ${result.pool_visible}`);
            console.log(`   - Explanation: ${result.explanation.substring(0, 100)}...`);

            // 1. Validate Orientation
            // Gemini usually returns "North", "North-Northeast", etc.
            expect(result.final_orientation.toLowerCase()).toContain('north');
            
            // 2. Validate Pool (Visual confirmed: No Pool)
            // It should be false or null if unsure, but certainly not true.
            expect(result.pool_visible).toBe(false);

            // 3. Quality checks
            expect(result.image_quality).not.toBe('blurry');
            expect(['medium', 'high']).toContain(result.confidence);

        } catch (e: any) {
            console.error("[Test] AI Execution Failed. Ensure your API key has 'Generative Language API' enabled.");
            if (e.message) console.error(`[Test] Error Message: ${e.message}`);
            throw e;
        }
    }, 60000); // 60s timeout
});
