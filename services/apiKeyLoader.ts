/**
 * Centralized API Key Loader
 * 
 * Loads all API keys from Firestore (app_config/api_keys) on first call,
 * caches them in memory, and patches APP_CONFIG so the rest of the app
 * reads keys transparently.
 * 
 * Firestore fetch happens once per session. Falls back to env vars if
 * Firestore is unavailable (e.g., offline or not yet authenticated).
 */

import { APP_CONFIG } from '../config';

let loaded = false;

/**
 * Loads API keys from Firestore into APP_CONFIG.
 * Safe to call multiple times — only fetches once.
 */
export async function loadApiKeys(): Promise<void> {
    if (loaded) return;

    try {
        const { db } = await import('./firebase/config');
        if (!db) return;

        const { doc, getDoc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'app_config', 'api_keys'));

        if (!snap.exists()) {
            console.warn('[ApiKeys] app_config/api_keys not found in Firestore — using env vars');
            loaded = true;
            return;
        }

        const data = snap.data();

        // Patch APP_CONFIG with Firestore values (only if non-empty)
        const patch = (configKey: string, firestoreKey: string) => {
            const val = data[firestoreKey];
            if (val && typeof val === 'string' && val.length > 5) {
                return val;
            }
            return undefined; // keep existing env value
        };

        // Apply patches — Firestore overrides env, env overrides empty
        const gemini = patch('gemini', 'gemini_key');
        if (gemini) (APP_CONFIG as any).gemini.key = gemini;

        const rapidapi = patch('rapidapi', 'rapidapi_key');
        if (rapidapi) {
            (APP_CONFIG as any).rapidapi.realtyInUsApi.key = rapidapi;
            (APP_CONFIG as any).rapidapi.zipCodesApi.key = rapidapi;
            (APP_CONFIG as any).usHousingApi.key = rapidapi;
        }

        const radar = patch('radar', 'radar_key');
        if (radar) (APP_CONFIG as any).radar.key = radar;

        const groq = patch('groq', 'groq_key');
        if (groq) (APP_CONFIG as any).groq.key = groq;

        const howloud = patch('howloud', 'howloud_key');
        if (howloud) (APP_CONFIG as any).howLoud.key = howloud;

        const rentcast = patch('rentcast', 'rentcast_key');
        if (rentcast) (APP_CONFIG as any).rentcast.key = rentcast;

        const tomorrow = patch('tomorrow', 'tomorrow_key');
        if (tomorrow) (APP_CONFIG as any).tomorrow.key = tomorrow;

        const maps = patch('maps', 'google_maps_key');
        if (maps) (APP_CONFIG as any).maps.key = maps;

        const foursquare = patch('foursquare', 'foursquare_key');
        if (foursquare) (APP_CONFIG as any).foursquare.key = foursquare;

        const realestateapi = patch('realestateapi', 'realestateapi_key');
        if (realestateapi) (APP_CONFIG as any).realEstateApi.key = realestateapi;

        const keyCount = [gemini, rapidapi, radar, groq, howloud, rentcast, tomorrow, maps, foursquare, realestateapi]
            .filter(Boolean).length;
        console.log(`[ApiKeys] Loaded ${keyCount} keys from Firestore`);

        loaded = true;
    } catch (e: any) {
        const isPermissionError = e.code === 'permission-denied' || e.message?.includes('permission');
        console.warn(`[ApiKeys] Failed to load from Firestore (Retryable: ${isPermissionError}), using env vars:`, e.message);
        
        // If it was a permission error, don't mark as 'loaded' so we can retry after login
        if (!isPermissionError) {
            loaded = true;
        }
    }
}
