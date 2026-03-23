/**
 * Host → Realtor ID Mapping
 *
 * Maps hostnames to realtorIds so the app can determine which realtor
 * owns the current IDX site. When a client visits a branded domain
 * (e.g. homes.janedoe.com), the app resolves the realtorId from this map
 * and uses it to write leads into the correct /realtors/{rid}/leads collection.
 *
 * For admin hosts (localhost, zyphe.ai), we use the currently logged-in
 * user's UID as the realtorId (they ARE the admin realtor).
 */

import { auth } from './firebase/config';

// ── Hostname → RealtorId Map ─────────────────────────────────────────────────

// 'admin' is a sentinel value meaning "use the logged-in user's UID"
const ADMIN_SENTINEL = 'admin';

const HOST_TO_REALTOR: Record<string, string> = {
    // Default / Admin — resolves to current user's UID at runtime
    'localhost':                ADMIN_SENTINEL,
    '127.0.0.1':                ADMIN_SENTINEL,
    'zyphe.ai':                 ADMIN_SENTINEL,
    'www.zyphe.ai':             ADMIN_SENTINEL,
    'zyphe-af0bf.web.app':      ADMIN_SENTINEL,
    'zyphe-af0bf.firebaseapp.com': ADMIN_SENTINEL,

    // ── Add realtor domains below ──────────────────────────────────────────
    // 'homes.janedoe.com':     'firebase_uid_of_jane_doe',
    // 'realestate.bobsmith.com': 'firebase_uid_of_bob_smith',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves the realtorId for the current hostname.
 *
 * For admin hosts (localhost, zyphe.ai, Firebase hosting):
 *   → returns the logged-in user's Firebase UID
 *
 * For branded realtor domains:
 *   → returns the mapped realtor UID from HOST_TO_REALTOR
 *
 * Falls back to the logged-in user's UID if hostname is unknown.
 */
export const getRealtorIdFromHost = (): string => {
    const hostname = window.location.hostname.toLowerCase();

    // Exact match first
    let mapped = HOST_TO_REALTOR[hostname];

    // Strip port for localhost variants (e.g. localhost:3000)
    if (!mapped) {
        const bare = hostname.split(':')[0];
        mapped = HOST_TO_REALTOR[bare];
    }

    // If it's the admin sentinel, resolve to the logged-in user's UID
    if (mapped === ADMIN_SENTINEL) {
        const uid = auth?.currentUser?.uid;
        if (uid) return uid;
        console.warn('[HostMapping] Admin host but no user logged in — realtorId will be empty');
        return '';
    }

    // Branded domain — return the mapped UID directly
    if (mapped) return mapped;

    // Unknown host — fall back to logged-in user
    const uid = auth?.currentUser?.uid;
    if (uid) {
        console.warn(`[HostMapping] Unknown hostname "${hostname}", using current user UID`);
        return uid;
    }

    console.warn(`[HostMapping] Unknown hostname "${hostname}" and no user logged in`);
    return '';
};

/**
 * Returns true if the current host is the main Zyphe admin site
 * (localhost, zyphe.ai, or Firebase hosting).
 */
export const isAdminHost = (): boolean => {
    const hostname = window.location.hostname.toLowerCase();
    const bare = hostname.split(':')[0];
    return HOST_TO_REALTOR[hostname] === ADMIN_SENTINEL ||
           HOST_TO_REALTOR[bare] === ADMIN_SENTINEL;
};

/**
 * Adds a mapping at runtime (useful for dynamic tenant onboarding).
 * Use an actual Firebase UID, not 'admin'.
 */
export const registerHostMapping = (hostname: string, realtorId: string) => {
    HOST_TO_REALTOR[hostname.toLowerCase()] = realtorId;
};
