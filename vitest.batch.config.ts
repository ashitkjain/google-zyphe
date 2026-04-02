/**
 * Separate vitest config for batch integration tests.
 * These tests need REAL Firebase/Firestore (no mocks) and Node environment.
 * Run with: npx vitest run --config vitest.batch.config.ts
 */
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load .env.local so VITE_* keys are available to import.meta.env
    const env = loadEnv(mode || 'test', '.', '');

    return {
        plugins: [react()],
        define: {
            // Expose all VITE_ vars to import.meta.env (needed by config.ts)
            'import.meta.env.VITE_GEMINI_API_KEY':        JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
            'import.meta.env.VITE_GOOGLE_MAPS_API_KEY':   JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY || ''),
            'import.meta.env.VITE_RAPIDAPI_KEY':          JSON.stringify(env.VITE_RAPIDAPI_KEY || ''),
            'import.meta.env.VITE_RADAR_KEY':             JSON.stringify(env.VITE_RADAR_KEY || ''),
            'import.meta.env.VITE_GROQ_API_KEY':          JSON.stringify(env.VITE_GROQ_API_KEY || ''),
            'import.meta.env.VITE_HOWLOUD_API_KEY':       JSON.stringify(env.VITE_HOWLOUD_API_KEY || ''),
            'import.meta.env.VITE_RENTCAST_KEY':          JSON.stringify(env.VITE_RENTCAST_KEY || ''),
            'import.meta.env.VITE_FOURSQUARE_API_KEY':    JSON.stringify(env.VITE_FOURSQUARE_API_KEY || ''),
            'import.meta.env.VITE_TOMORROW_API_KEY':      JSON.stringify(env.VITE_TOMORROW_API_KEY || ''),
        },
        test: {
            environment: 'node',
            globals: true,
            // NO setupFiles from unit tests — we want real Firebase
            globalSetup: ['./tests/batchSetup.ts'],
            setupFiles: ['./tests/batchFileSetup.ts'],
            include: ['**/*.batch.test.ts'],
            testTimeout: 15 * 60 * 1000, // 15 min
            hookTimeout: 60_000,
        },
    };
});

