#!/usr/bin/env npx tsx
/**
 * backfill_street_view_heading.ts
 *
 * Populates `streetViewHeadingDeg` on all properties for a given city
 * that have a cached Firebase street view URL but no stored heading.
 *
 * This enables the wrong-road cache fallback in runSatellitaryAnalysis:
 * when the Street View metadata API returns a pano on an adjacent road the
 * service recovers the correct heading from Firestore and uses the cached
 * street view image for proper dual-direct analysis.
 *
 * Uses the Firebase client SDK (no service account needed — same credentials
 * as the web app).
 *
 * Usage:
 *   npx tsx scripts/backfill_street_view_heading.ts                  # Pleasanton, live run
 *   npx tsx scripts/backfill_street_view_heading.ts --dry-run        # Preview only
 *   npx tsx scripts/backfill_street_view_heading.ts --city=dublin    # Different city
 */

// Shim import.meta.env for Vite modules
if (!(import.meta as any).env) (import.meta as any).env = {};

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
    getFirestore, collection, getDocs, query, where, doc, updateDoc
} from 'firebase/firestore';

// ─── Firebase (client SDK — same as app) ─────────────────────────────────────

const firebaseConfig = {
    apiKey:            'AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI',
    authDomain:        'zyphe-af0bf.firebaseapp.com',
    projectId:         'zyphe-af0bf',
    storageBucket:     'zyphe-af0bf.firebasestorage.app',
    messagingSenderId: '434538487700',
    appId:             '1:434538487700:web:2d0880addbfdca71c13981',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db  = getFirestore(app);

// ─── Config ───────────────────────────────────────────────────────────────────

const MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY ?? 'AIzaSyCQ-OcGRDMK8nGmCMzpuxHT0Y9vJgqajRI';
const CONCURRENCY  = 6;
const SV_RADIUS    = 150; // metres

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CITY_LC = (args.find(a => a.startsWith('--city='))?.split('=')[1] ?? 'pleasanton').toLowerCase();
const CITY_TC = CITY_LC.charAt(0).toUpperCase() + CITY_LC.slice(1); // Title-case

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bearingTo(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
    const r = (d: number) => d * (Math.PI / 180);
    const lat1 = r(fromLat), lat2 = r(toLat);
    const dLon = r(toLng - fromLng);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return Math.round(((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360);
}

async function fetchHeading(lat: number, lng: number): Promise<number | null> {
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata` +
        `?location=${lat},${lng}&radius=${SV_RADIUS}&source=outdoor&key=${MAPS_API_KEY}`;
    try {
        const res  = await fetch(url);
        const meta = await res.json() as any;
        if (meta.status !== 'OK') return null;
        const pano = meta.location as { lat: number; lng: number } | undefined;
        if (!pano?.lat || !pano?.lng) return null;
        return bearingTo(pano.lat, pano.lng, lat, lng);
    } catch {
        return null;
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function backfillHeadings() {
    console.log('═'.repeat(70));
    console.log(`  Street View Heading Backfill — city="${CITY_LC}"${DRY_RUN ? '  [DRY RUN]' : ''}`);
    console.log('═'.repeat(70) + '\n');

    // 1. Load all properties for city (try both casings)
    console.log(`Querying properties for city "${CITY_LC}" / "${CITY_TC}" …`);
    const [snapTC, snapLC] = await Promise.all([
        getDocs(query(collection(db, 'properties'), where('city', '==', CITY_TC))),
        getDocs(query(collection(db, 'properties'), where('city', '==', CITY_LC))),
    ]);

    const seen   = new Set<string>();
    const unique = [...snapTC.docs, ...snapLC.docs].filter(d => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
    });
    console.log(`  → ${unique.length} properties found.\n`);

    // 2. Partition
    const candidates = unique.filter(d => {
        const data = d.data();
        return (
            typeof data.streetView === 'string' &&
            data.streetView.includes('firebasestorage') &&
            typeof data.streetViewHeadingDeg !== 'number'
        );
    });

    const alreadyDone   = unique.filter(d => typeof d.data().streetViewHeadingDeg === 'number').length;
    const noSvUrl       = unique.filter(d => !d.data().streetView?.includes('firebasestorage')).length;

    console.log(`  Has heading already  : ${alreadyDone}`);
    console.log(`  No cached SV URL     : ${noSvUrl}`);
    console.log(`  Needs backfill       : ${candidates.length}\n`);

    if (candidates.length === 0) {
        console.log('✅  Nothing to backfill — all properties already have a heading.');
        return;
    }

    // 3. Fetch headings + write
    let updated = 0, noCoords = 0, noSv = 0, errors = 0;

    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
        const batch = candidates.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (d) => {
            const data = d.data();
            const zpid = d.id;
            const addr = data.address ?? zpid;
            const lat  = data.coordinates?.latitude;
            const lng  = data.coordinates?.longitude;

            if (!lat || !lng) {
                console.log(`  ⚠️  SKIP (no coords) : ${addr}`);
                noCoords++;
                return;
            }

            const heading = await fetchHeading(lat, lng);
            if (heading == null) {
                console.log(`  🚫  NO SV COVERAGE   : ${addr}`);
                noSv++;
                return;
            }

            console.log(`  ✅  heading=${String(heading).padStart(3)}° : ${addr} (${zpid})` +
                (DRY_RUN ? ' [DRY]' : ''));

            if (!DRY_RUN) {
                try {
                    await updateDoc(doc(db, 'properties', zpid), { streetViewHeadingDeg: heading });
                    updated++;
                } catch (e) {
                    console.error(`  ❌  WRITE ERROR: ${addr}`, e);
                    errors++;
                }
            } else {
                updated++;
            }
        }));
    }

    console.log('\n' + '═'.repeat(70));
    console.log('  RESULTS');
    console.log('═'.repeat(70));
    console.log(`  ✅  Updated  : ${updated}`);
    console.log(`  ⚠️   No coords: ${noCoords}`);
    console.log(`  🚫  No SV    : ${noSv}`);
    console.log(`  ❌  Errors   : ${errors}`);
    if (DRY_RUN) console.log('\n  [DRY RUN] — no writes made. Re-run without --dry-run to apply.');
    console.log('═'.repeat(70) + '\n');
}

backfillHeadings()
    .then(() => { console.log('Done.'); process.exit(0); })
    .catch(err => { console.error('Script failed:', err); process.exit(1); });
