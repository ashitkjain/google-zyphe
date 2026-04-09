
/**
 * check_orientation_regressions.ts
 *
 * For every property whose orientation DIRECTION changed between the two most
 * recent versions, this script validates BOTH versions against GPS ground
 * truth (Google Street View Metadata API — no AI) and classifies each change:
 *
 *   ✅ IMPROVEMENT  — new orientation is closer to GPS truth than the old one
 *   ❌ REGRESSION   — old orientation was closer to GPS truth
 *   ⚠️  AMBIGUOUS   — both are equally wrong/right, or no Street View coverage
 *   🔄 UNKNOWN→NEW  — previous was "Unknown", new has a real direction
 *                     (treated as possible improvement, not comparable)
 *
 * GPS ground truth method (same as orientation_batch.batch.test.ts):
 *   heading      = bearing(panoLocation → property)   [camera direction]
 *   candidateFront = (heading + 180) % 360            [Street View sees FRONT]
 *   candidateBack  = heading                          [Street View sees BACK]
 *   score(orientation) = min(angularDiff(azimuth, candidateFront),
 *                            angularDiff(azimuth, candidateBack))
 *
 * Usage:
 *   npx tsx scripts/check_orientation_regressions.ts
 */

import admin from 'firebase-admin';

// ─── Config ──────────────────────────────────────────────────────────────────

const PROJECT_ID       = 'zyphe-af0bf';
const MAPS_API_KEY     = process.env.VITE_GOOGLE_MAPS_API_KEY ?? 'AIzaSyCQ-OcGRDMK8nGmCMzpuxHT0Y9vJgqajRI';
const AZIMUTH_TOLERANCE = 67;  // degrees — same threshold as batch test

if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
}
const db = admin.firestore();

// ─── Types ────────────────────────────────────────────────────────────────────

interface VersionEntry {
    zpid: string;
    city: string;
    zip: string;
    version: number;
    details: {
        orientation: string;
        azimuth: number | null;
        layout?: string;
    };
    dateMined: FirebaseFirestore.Timestamp | null;
}

type Classification = 'improvement' | 'regression' | 'ambiguous' | 'unknown_to_new' | 'no_street_view';

interface RegressionResult {
    zpid: string;
    address: string;
    city: string;
    zip: string;
    previousOrientation: string;
    latestOrientation: string;
    previousAzimuth: number | null;
    latestAzimuth: number | null;
    previousVersion: number;
    latestVersion: number;
    previousDate: string;
    latestDate: string;
    // GPS validation
    gpsHeading: number | null;
    candidateFront: number | null;
    candidateBack: number | null;
    oldGpsScore: number | null;   // angular diff from best GPS candidate
    newGpsScore: number | null;
    oldPasses: boolean | null;    // within AZIMUTH_TOLERANCE
    newPasses: boolean | null;
    classification: Classification;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normaliseDirection(raw: string): string {
    return raw.trim().toLowerCase().replace(/[\s\-_~()°0-9.]+/g, '');
}

const DIRECTION_MAP: Record<string, number> = {
    'n': 0,   'north': 0,
    'nne': 22, 'northnortheast': 22,
    'ne': 45,  'northeast': 45,
    'ene': 67, 'eastnortheast': 67,
    'e': 90,   'east': 90,
    'ese': 112,'eastsoutheast': 112,
    'se': 135, 'southeast': 135,
    'sse': 157,'southsoutheast': 157,
    's': 180,  'south': 180,
    'ssw': 202,'southsouthwest': 202,
    'sw': 225, 'southwest': 225,
    'wsw': 247,'westsouthwest': 247,
    'w': 270,  'west': 270,
    'wnw': 292,'westnorthwest': 292,
    'nw': 315, 'northwest': 315,
    'nnw': 337,'northnorthwest': 337,
};

function labelToAzimuth(label: string): number | null {
    const t = label.trim().toLowerCase().replace(/[\s\-_]+/g, '');
    if (DIRECTION_MAP[t] !== undefined) return DIRECTION_MAP[t];
    for (const key of Object.keys(DIRECTION_MAP)) {
        if (t.startsWith(key)) return DIRECTION_MAP[key];
    }
    return null;
}

/** Shortest angular distance between two compass bearings (0–360). */
function angularDiff(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

function fmtDate(ts: FirebaseFirestore.Timestamp | null): string {
    if (!ts) return 'unknown';
    return (ts as any).toDate().toISOString().split('T')[0];
}

/**
 * Calls Street View Metadata API and returns the camera heading
 * (bearing from pano location → property location).
 */
async function fetchGpsHeading(lat: number, lng: number): Promise<{heading: number, candidateFront: number, candidateBack: number} | null> {
    const url =
        `https://maps.googleapis.com/maps/api/streetview/metadata` +
        `?location=${lat},${lng}&radius=100&source=outdoor&key=${MAPS_API_KEY}`;
    
    const resp = await fetch(url);
    const meta = await resp.json() as any;
    if (meta.status !== 'OK') return null;

    const pano = meta.location as {lat: number; lng: number} | undefined;
    if (!pano?.lat || !pano?.lng) return null;

    const lat1  = pano.lat * (Math.PI / 180);
    const lat2  = lat     * (Math.PI / 180);
    const dLon  = (lng - pano.lng) * (Math.PI / 180);
    const y     = Math.sin(dLon) * Math.cos(lat2);
    const x     = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const heading = Math.round(((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360);

    return {
        heading,
        candidateFront: (heading + 180) % 360,
        candidateBack: heading,
    };
}

/** Best GPS score for an orientation (min diff to either front/back candidate). */
function gpsScore(azimuth: number, candidateFront: number, candidateBack: number): number {
    return Math.min(
        angularDiff(azimuth, candidateFront),
        angularDiff(azimuth, candidateBack)
    );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function checkOrientationRegressions() {
    console.log('─'.repeat(72));
    console.log('  Orientation Change Classifier (GPS Ground Truth Validation)');
    console.log('  improvement = new closer to GPS | regression = old was closer');
    console.log('─'.repeat(72));

    // 1. Fetch all orientation history
    console.log('\nFetching all orientation_versions/*/history records …');
    const snap = await db.collectionGroup('history').get();
    console.log(`  → ${snap.size} total history documents.\n`);

    // 2. Group by ZPID
    const grouped: Record<string, VersionEntry[]> = {};
    snap.docs.forEach(d => {
        const data = d.data() as VersionEntry;
        const zpid = String(data.zpid);
        if (!grouped[zpid]) grouped[zpid] = [];
        grouped[zpid].push(data);
    });

    // 3. Find properties with direction changes
    const changed: { zpid: string; latest: VersionEntry; previous: VersionEntry }[] = [];

    for (const zpid of Object.keys(grouped)) {
        const versions = grouped[zpid];
        if (versions.length < 2) continue;

        const sorted = versions.sort((a, b) =>
            (b.dateMined as any)?.toMillis?.() - (a.dateMined as any)?.toMillis?.() || 0
        );

        const latest   = sorted[0];
        const previous = sorted[1];

        const latD = normaliseDirection(latest.details?.orientation ?? '');
        const preD = normaliseDirection(previous.details?.orientation ?? '');

        if (latD !== preD) {
            changed.push({ zpid, latest, previous });
        }
    }

    console.log(`Properties with direction changes: ${changed.length}\n`);
    if (changed.length === 0) {
        console.log('✅  No direction changes found.');
        return;
    }

    // 4. Fetch coordinates for changed properties
    console.log('Fetching property coordinates from Firestore …');
    const coordMap: Record<string, { lat: number; lng: number; address: string } | null> = {};
    const zpidChunks: string[][] = [];
    const zpids = changed.map(c => c.zpid);
    for (let i = 0; i < zpids.length; i += 30) zpidChunks.push(zpids.slice(i, i + 30));

    for (const chunk of zpidChunks) {
        const propSnaps = await Promise.all(chunk.map(z => db.collection('properties').doc(z).get()));
        propSnaps.forEach((ps, i) => {
            const zpid = chunk[i];
            if (ps.exists) {
                const p = ps.data()!;
                const lat = p.coordinates?.latitude;
                const lng = p.coordinates?.longitude;
                coordMap[zpid] = lat != null && lng != null
                    ? { lat, lng, address: p.address ?? zpid }
                    : null;
            } else {
                coordMap[zpid] = null;
            }
        });
    }
    console.log(`  → Coordinates fetched for ${Object.values(coordMap).filter(Boolean).length}/${changed.length} properties.\n`);

    // 5. Validate each changed property against GPS
    console.log('Validating against GPS Street View ground truth …\n');
    const results: RegressionResult[] = [];

    const CONCURRENCY = 8;
    for (let i = 0; i < changed.length; i += CONCURRENCY) {
        const batch = changed.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async ({ zpid, latest, previous }) => {
            const coords = coordMap[zpid];
            const address = coords?.address ?? zpid;
            const city = latest.city ?? previous.city ?? 'Unknown';
            const zip  = latest.zip  ?? previous.zip  ?? 'Unknown';

            const oldLabel = previous.details?.orientation ?? 'Unknown';
            const newLabel = latest.details?.orientation   ?? 'Unknown';

            // Resolve azimuths — prefer stored value, fallback to text parse
            const oldAzimuth = previous.details?.azimuth ?? labelToAzimuth(oldLabel);
            const newAzimuth = latest.details?.azimuth   ?? labelToAzimuth(newLabel);

            const base: Omit<RegressionResult, 'gpsHeading' | 'candidateFront' | 'candidateBack' | 'oldGpsScore' | 'newGpsScore' | 'oldPasses' | 'newPasses' | 'classification'> = {
                zpid, address, city, zip,
                previousOrientation: oldLabel,
                latestOrientation:   newLabel,
                previousAzimuth:     oldAzimuth,
                latestAzimuth:       newAzimuth,
                previousVersion:     previous.version,
                latestVersion:       latest.version,
                previousDate:        fmtDate(previous.dateMined as any),
                latestDate:          fmtDate(latest.dateMined as any),
            };

            // Previous was "Unknown" — can't do a meaningful GPS comparison
            if (!oldAzimuth && oldLabel.toLowerCase().includes('unknown')) {
                results.push({ ...base, gpsHeading: null, candidateFront: null, candidateBack: null, oldGpsScore: null, newGpsScore: null, oldPasses: null, newPasses: null, classification: 'unknown_to_new' });
                return;
            }

            if (!coords) {
                results.push({ ...base, gpsHeading: null, candidateFront: null, candidateBack: null, oldGpsScore: null, newGpsScore: null, oldPasses: null, newPasses: null, classification: 'ambiguous' });
                return;
            }

            const gps = await fetchGpsHeading(coords.lat, coords.lng);

            if (!gps) {
                results.push({ ...base, gpsHeading: null, candidateFront: null, candidateBack: null, oldGpsScore: null, newGpsScore: null, oldPasses: null, newPasses: null, classification: 'no_street_view' });
                return;
            }

            const { candidateFront, candidateBack } = gps;

            const oldScore = oldAzimuth != null ? gpsScore(oldAzimuth, candidateFront, candidateBack) : null;
            const newScore = newAzimuth != null ? gpsScore(newAzimuth, candidateFront, candidateBack) : null;

            let classification: Classification;
            if (oldScore == null || newScore == null) {
                classification = 'ambiguous';
            } else if (newScore < oldScore - 5) {
                classification = 'improvement';
            } else if (oldScore < newScore - 5) {
                classification = 'regression';
            } else {
                classification = 'ambiguous';
            }

            results.push({
                ...base,
                gpsHeading:     gps.heading,
                candidateFront,
                candidateBack,
                oldGpsScore:    oldScore,
                newGpsScore:    newScore,
                oldPasses:      oldScore != null ? oldScore <= AZIMUTH_TOLERANCE : null,
                newPasses:      newScore != null ? newScore <= AZIMUTH_TOLERANCE : null,
                classification,
            });
        }));
        process.stdout.write(`  Validated ${Math.min(i + CONCURRENCY, changed.length)}/${changed.length} …\r`);
    }
    console.log('\n');

    // 6. Sort & print
    const improvements  = results.filter(r => r.classification === 'improvement');
    const regressions   = results.filter(r => r.classification === 'regression');
    const ambiguous     = results.filter(r => r.classification === 'ambiguous');
    const unknownToNew  = results.filter(r => r.classification === 'unknown_to_new');
    const noStreetView  = results.filter(r => r.classification === 'no_street_view');

    // ─── Regressions (most important) ────────────────────────────────────────
    console.log('─'.repeat(72));
    console.log(`❌  REGRESSIONS (${regressions.length}) — old was more accurate`);
    console.log('─'.repeat(72));
    regressions.forEach((r, i) => {
        console.log(
            `\n${i + 1}. ${r.address} [ZPID ${r.zpid}]\n` +
            `   ${r.city}, ${r.zip}  •  v${r.previousVersion} → v${r.latestVersion}  •  ${r.previousDate} → ${r.latestDate}\n` +
            `   OLD: "${r.previousOrientation}" (${r.previousAzimuth ?? 'N/A'}°) — GPS score ${r.oldGpsScore}° ${r.oldPasses ? '✓ passed' : '✗ failed'}\n` +
            `   NEW: "${r.latestOrientation}" (${r.latestAzimuth ?? 'N/A'}°) — GPS score ${r.newGpsScore}° ${r.newPasses ? '✓ passed' : '✗ failed'}\n` +
            `   GPS: heading=${r.gpsHeading}° | front=${r.candidateFront}° | back=${r.candidateBack}°`
        );
    });

    // ─── Improvements ────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(72));
    console.log(`✅  IMPROVEMENTS (${improvements.length}) — new is more accurate`);
    console.log('─'.repeat(72));
    improvements.forEach((r, i) => {
        console.log(
            `\n${i + 1}. ${r.address} [ZPID ${r.zpid}]\n` +
            `   ${r.city}, ${r.zip}  •  v${r.previousVersion} → v${r.latestVersion}  •  ${r.previousDate} → ${r.latestDate}\n` +
            `   OLD: "${r.previousOrientation}" (${r.previousAzimuth ?? 'N/A'}°) — GPS score ${r.oldGpsScore}°\n` +
            `   NEW: "${r.latestOrientation}" (${r.latestAzimuth ?? 'N/A'}°) — GPS score ${r.newGpsScore}°`
        );
    });

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(72));
    console.log('SUMMARY');
    console.log('═'.repeat(72));
    console.log(`  Total direction changes : ${results.length}`);
    console.log(`  ✅ Improvements         : ${improvements.length}`);
    console.log(`  ❌ Regressions          : ${regressions.length}`);
    console.log(`  ⚠️  Ambiguous            : ${ambiguous.length}`);
    console.log(`  🔄 Unknown → New        : ${unknownToNew.length}  (previously had no orientation)`);
    console.log(`  🚫 No Street View        : ${noStreetView.length}`);

    if (regressions.length > 0) {
        console.log(`\n  ⚠️  The prompt change introduced ${regressions.length} confirmed regressions.`);
    } else if (improvements.length > 0) {
        console.log(`\n  ✅ The prompt change is net positive — no validated regressions found.`);
    }
    console.log('═'.repeat(72) + '\n');
}

checkOrientationRegressions()
    .then(() => { console.log('Done.'); process.exit(0); })
    .catch(err => { console.error('Script failed:', err); process.exit(1); });
