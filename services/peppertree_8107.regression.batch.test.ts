// @vitest-environment node
/**
 * 8107 Peppertree Rd, Dublin, CA — Regression Test
 *
 * GT expected: West
 * Currently returning: North
 *
 * Hypothesis: street view camera heading ≈ 180° (south) + street_view_shows_front=TRUE
 * → (180+180)%360 = 0° = North (wrong — front is actually West, not North)
 *
 * Run:
 *   vitest run services/peppertree_8107.regression.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runSatellitaryAnalysis } from './satellitaryService';
import { normalizeAddress } from './api/geocoding';
import { APP_CONFIG } from '../config';

const ADDRESS  = '8107 Peppertree Rd, Dublin, CA 94568';
const COORDS   = { lat: 37.7101, lng: -121.9089 }; // approximate

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

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const res = await normalizeAddress(address);
        return { lat: res.coordinates.latitude, lng: res.coordinates.longitude };
    } catch {
        return null;
    }
}

// ── Find zpid by address ─────────────────────────────────────────────────────
async function findZpidByAddress(): Promise<string | null> {
    const res = await fetch(
        `${FIRESTORE_BASE}/properties?key=${FIREBASE_API_KEY}&pageSize=300`
    ).then(r => r.json()) as any;
    const docs = res.documents || [];
    for (const doc of docs) {
        const addr = doc.fields?.address?.stringValue || '';
        if (addr.includes('8107 Peppertree')) {
            return doc.name.split('/').pop() || null;
        }
    }
    return null;
}

describe('8107 Peppertree Rd — North-vs-West regression', () => {
    let coords: { lat: number; lng: number };
    let zpid: string | null = null;
    let cachedSvUrl: string | null = null;

    beforeAll(async () => {
        // Geocode the address
        const geo = await geocodeAddress(ADDRESS);
        coords = geo ?? COORDS;
        console.log(`[Setup] Coords: ${coords.lat}, ${coords.lng}`);

        // Try to find zpid and cached SV
        zpid = await findZpidByAddress();
        console.log(`[Setup] zpid: ${zpid}`);

        if (zpid) {
            const prop = await firestoreGet(`properties/${zpid}`);
            cachedSvUrl = prop?.street_view_url || prop?.streetViewUrl || null;
            const svHeading = prop?.street_view_heading_deg ?? prop?.streetViewHeadingDeg;
            console.log(`[Setup] Cached SV URL: ${cachedSvUrl ? 'yes' : 'none'}`);
            console.log(`[Setup] Cached SV heading: ${svHeading ?? 'not stored'}`);
            console.log(`[Setup] Cached final_orientation: ${prop?.orientation_ai?.final_orientation ?? 'none'}`);
        }
    }, 30_000);

    it('should return West (not North) — dual-image pano heading math check', async () => {
        const result = await runSatellitaryAnalysis(
            coords.lat, coords.lng,
            cachedSvUrl,      // use cached SV if available
            'test-user',
            zpid ?? undefined,
            ADDRESS,
            null,             // no description
            'SINGLE_FAMILY',
        );

        const orientation = result.final_orientation;
        const azimuth     = result.azimuth_degrees;
        const explanation = result.explanation ?? '';
        const svFront     = (result as any).street_view_shows_front;
        const aerialOnly  = result.aerial_only_mode;

        console.log(`\n[RESULT] ${orientation} (${azimuth}°)`);
        console.log(`  aerial_only_mode: ${aerialOnly}`);
        console.log(`  street_view_shows_front: ${svFront}`);
        console.log(`  explain: ${explanation.slice(0, 300)}`);

        // Must NOT be North — that's the heading-math trap we fixed
        expect(orientation, 'Must not return North (heading math bug)').not.toMatch(/^N(?!E|W)/i);

        // Should be West-facing OR UNCLEAR (aerial ambiguity is ok; North is not)
        const aiDir = orientation.split(/[\s(]/)[0].toLowerCase();
        const acceptableDirs = ['west', 'southwest', 'northwest', 'unclear'];
        const isOk = acceptableDirs.some(d => aiDir.startsWith(d));
        console.log(`\n[✅ VERDICT] ${isOk ? 'PASS' : 'FAIL'} — got ${orientation} (acceptable: ${acceptableDirs.join('/')})`);
        expect(isOk, `Expected West-facing or UNCLEAR, got: ${orientation}`).toBe(true);
    }, 60_000);
});
