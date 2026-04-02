import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// Firebase project config (public values — same as client SDK)
const PROJECT_ID = 'zyphe-af0bf';
const KEYS_FILE   = resolve('./tests/.batch-keys.json');

export async function setup() {
    let app;
    try {
        app = getApps().length ? getApp() : initializeApp({ projectId: PROJECT_ID });
    } catch (e: any) {
        console.warn('[GlobalSetup] Firebase Admin init failed:', e.message);
        writeFileSync(KEYS_FILE, '{}', 'utf-8');
        return;
    }

    try {
        const db = getFirestore(app);
        const snap = await db.collection('app_config').doc('api_keys').get();

        if (!snap.exists) {
            console.warn('[GlobalSetup] app_config/api_keys not found — using .env.local values only');
            writeFileSync(KEYS_FILE, '{}', 'utf-8');
            return;
        }

        const data = snap.data() as Record<string, string>;

        const keys: Record<string, string> = {};
        const map: Record<string, string> = {
            VITE_GEMINI_API_KEY:      'gemini_key',
            VITE_GOOGLE_MAPS_API_KEY: 'google_maps_key',
            VITE_RAPIDAPI_KEY:        'rapidapi_key',
            VITE_RADAR_KEY:           'radar_key',
            VITE_GROQ_API_KEY:        'groq_key',
            VITE_HOWLOUD_API_KEY:     'howloud_key',
            VITE_RENTCAST_KEY:        'rentcast_key',
            VITE_FOURSQUARE_API_KEY:  'foursquare_key',
            VITE_TOMORROW_API_KEY:    'tomorrow_key',
        };

        for (const [viteName, firestoreKey] of Object.entries(map)) {
            const val = data[firestoreKey];
            if (val && val.length > 5) keys[viteName] = val;
        }

        writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
        console.log(`[GlobalSetup] Wrote ${Object.keys(keys).length} API keys to ${KEYS_FILE}`);

    } catch (e: any) {
        console.warn(`[GlobalSetup] Firestore read failed: ${e.message} — falling back to .env.local`);
        writeFileSync(KEYS_FILE, '{}', 'utf-8');
    }
}

export async function teardown() {
    // Optionally clean up the temp keys file
    try {
        const { unlinkSync } = await import('fs');
        unlinkSync(KEYS_FILE);
    } catch (_) { /* ignore */ }
}
