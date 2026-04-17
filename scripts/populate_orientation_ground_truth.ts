#!/usr/bin/env npx tsx
/**
 * populate_orientation_ground_truth.ts
 *
 * Seeds the `orientation_ground_truth` Firestore collection from the tester
 * revalidation sheet ("Revalidation - Pleasanton Orientation").
 *
 * Each document is keyed by ZPID and contains:
 *   city                  — "Pleasanton"
 *   address               — full address string
 *   zpid                  — string
 *   expected_orientation  — canonical compass label ("North" | "Northeast" | ...)
 *   expected_azimuth_deg  — center azimuth for that label (0, 45, 90, ...)
 *   remark                — "Good" | "Bad" | ""
 *   tester_notes          — raw comment from revalidation sheet
 *   created_at            — server timestamp
 *
 * Uses the Firebase CLIENT SDK (no service account needed).
 *
 * Usage:
 *   npx tsx scripts/populate_orientation_ground_truth.ts            # live write
 *   npx tsx scripts/populate_orientation_ground_truth.ts --dry-run  # preview only
 */

// Shim import.meta.env for Vite modules
if (!(import.meta as any).env) (import.meta as any).env = {};

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
    getFirestore, collection, getDocs, doc, setDoc, serverTimestamp
} from 'firebase/firestore';

// ─── Firebase (client SDK) ────────────────────────────────────────────────────

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

// ─── CLI ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Orientation helpers ──────────────────────────────────────────────────────

const AZIMUTH: Record<string, number> = {
    'North': 0, 'Northeast': 45, 'East': 90, 'Southeast': 135,
    'South': 180, 'Southwest': 225, 'West': 270, 'Northwest': 315,
};

// ─── Tester dataset ───────────────────────────────────────────────────────────
// Source: "Revalidation - Pleasanton Orientation" spreadsheet
// expected_orientation is null when tester said "Good" with no explicit direction
// and no lookup was possible from the comment.

interface TesterRow {
    address: string;
    remark: 'Good' | 'Bad' | '';
    expected_orientation: string | null;  // null = "Good, current is correct" — derive from DB
    tester_notes: string;
}

const TESTER_DATA: TesterRow[] = [
    { address: '1039 Hopkins Way, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'North',     tester_notes: 'the property do face north' },
    { address: '1131 Mataro Ct, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'East',      tester_notes: 'the property do face east' },
    { address: '1149 Hopkins Way, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'the property do face northwest' },
    { address: '1224 Harvest Rd, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'it actually faces a bit towards northeast' },
    { address: '1237 Concord St, Pleasanton, CA 94566 US',       remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'the property do not face Southwest it faces Northeast' },
    { address: '1265 Koln St, Pleasanton, CA 94566 US',          remark: 'Good', expected_orientation: null,        tester_notes: '' },
    { address: '1380 Brookline Loop, Pleasanton, CA 94566 US',   remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'the property do not face North it faces Southwest' },
    { address: '1398 Piemonte Dr, Pleasanton, CA 94566 US',      remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'the property do not face Northwest it faces Northeast' },
    { address: '1421 Calle Enrique, Pleasanton, CA 94566 US',    remark: 'Good', expected_orientation: 'Southeast', tester_notes: 'the property do not face west it faces Southeast' },
    { address: '1448 Freeman Ln, Pleasanton, CA 94566 US',       remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'the property do not face southwest it faces southeast based on the streetview' },
    { address: '1450 Finley Rd, Pleasanton, CA 94588 US',        remark: 'Good', expected_orientation: 'East',      tester_notes: 'the property do face east' },
    { address: '1515 Germano Way, Pleasanton, CA 94566 US',      remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'the property do not face east it faces southeast' },
    { address: '1527 Honey Suckle Ct, Pleasanton, CA 94588 US',  remark: 'Bad',  expected_orientation: 'Northwest', tester_notes: 'the property do not face Northeast it faces Northwest' },
    { address: '1558 Calle Enrique, Pleasanton, CA 94566 US',    remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'the property do face northeast' },
    { address: '1565 Mendoza Ct, Pleasanton, CA 94566 US',       remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'the Property do not face East it faces west/southwest (which was correct in earlier version)' },
    { address: '1621 Harvest Rd, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'the property do face Southwest' },
    { address: '1825 Crestline Rd, Pleasanton, CA 94566 US',     remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face west it faces South' },
    { address: '1889 Via Di Salerno, Pleasanton, CA 94566 US',   remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'the property do face Southwest' },
    { address: '2004 W Lagoon Rd, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'the property do faces Northeast' },
    { address: '2128 Alexander Way, Pleasanton, CA 94588 US',    remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'the property do faces Northeast' },
    { address: '215 Mavis Dr, Pleasanton, CA 94566 US',          remark: 'Good', expected_orientation: 'East',      tester_notes: 'the updated orientation is correct, the property front door is towards east' },
    { address: '218 Birch Creek Dr, Pleasanton, CA 94566 US',    remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face East it faces south (which was correct in earlier version)' },
    { address: '226 Birch Creek Dr, Pleasanton, CA 94566 US',    remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face East it faces south' },
    { address: '2270 Doccia Ct, Pleasanton, CA 94566 US',        remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'the property do not face Northeast it faces Southeast' },
    { address: '2415 Crestline Rd, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'West',      tester_notes: 'the property do face West' },
    { address: '254 Joseph Ln, Pleasanton, CA 94588 US',         remark: 'Bad',  expected_orientation: 'East',      tester_notes: 'the property do not face northeast it faces East' },
    { address: '2577 Arlotta Pl, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'Northwest', tester_notes: 'the property do not face Southeast it faces northwest' },
    { address: '2733 Corte Vera Cruz, Pleasanton, CA 94566 US',  remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'the Property do face southwest' },
    { address: '282 Del Valle Ct, Pleasanton, CA 94566 US',      remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'The property do not face Northwest it faces south' },
    { address: '298 Sullivan Ct, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'Southeast', tester_notes: 'the property do face Southeast' },
    { address: '3019 Boardwalk St, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { address: '3208 Touriga Dr, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { address: '3219 Touriga Dr, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'East',      tester_notes: 'The property do face EAST' },
    { address: '3329 Vermont Pl, Pleasanton, CA 94588 US',       remark: 'Good', expected_orientation: 'East',      tester_notes: 'The property do face EAST' },
    { address: '337 Trenton Cir, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'East',      tester_notes: 'The property do face EAST (bit towards Northeast)' },
    { address: '3492 Dorset St, Pleasanton, CA 94566 US',        remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'determining front door orientation is difficult, but it is definitely not Southwest - Could be southeast/south' },
    { address: '3550 Vine St, Pleasanton, CA 94566 US',          remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '3593 Whitehall Ct, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { address: '3624 Canelli Ct, Pleasanton, CA 94566 US',       remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North (slight towards Northeast)' },
    { address: '3636 Shenandoah Ct, Pleasanton, CA 94588 US',    remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { address: '3641 Shenandoah Ct, Pleasanton, CA 94588 US',    remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { address: '3653 Kamp Dr, Pleasanton, CA 94588 US',          remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { address: '3691 Chillingham Ct, Pleasanton, CA 94588 US',   remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { address: '3696 Woodbine Way, Pleasanton, CA 94588 US',     remark: 'Bad',  expected_orientation: 'West',      tester_notes: 'the property do not face Northwest - it is hard to define orientation but based on images it faces West' },
    { address: '3817 Muirwood Dr, Pleasanton, CA 94588 US',      remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { address: '3825 Brockton Dr, Pleasanton, CA 94588 US',      remark: 'Bad',  expected_orientation: 'West',      tester_notes: 'the property do not face South it faces west' },
    { address: '388 Oak Ln, Pleasanton, CA 94566 US',            remark: '',     expected_orientation: null,        tester_notes: 'New construction' },
    { address: '3921 Alma Ct, Pleasanton, CA 94588 US',          remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { address: '4019 Rennellwood Way, Pleasanton, CA 94566 US',  remark: 'Bad',  expected_orientation: 'Northwest', tester_notes: 'the property do not face Southeast it faces northwest (which was correct in earlier version)' },
    { address: '4022 Silver St, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '4034 Francisco St, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '4034 Rennellwood Way, Pleasanton, CA 94566 US',  remark: 'Good', expected_orientation: 'Southeast', tester_notes: 'The property do face Southeast' },
    { address: '4061 Holland Dr, Pleasanton, CA 94588 US',       remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { address: '4067 Alvarado St, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { address: '4071 Walnut Dr, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'Southeast', tester_notes: 'The property do face Southeast' },
    { address: '4073 Stanley Blvd, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '4127 Alvarado St, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { address: '4153 Alba Ct, Pleasanton, CA 94588 US',          remark: 'Bad',  expected_orientation: 'Northwest', tester_notes: 'The property do not face Southwest it faces Northwest (A bit difficult to determine - northwest on the basis of photos)' },
    { address: '4159 Amberwood Cir, Pleasanton, CA 94588 US',    remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'The Property does not face Southwest it faces northeast' },
    { address: '4173 Georgis Pl, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'The Property does not face North it faces northeast' },
    { address: '4181 Georgis Pl, Pleasanton, CA 94588 US',       remark: 'Good', expected_orientation: 'Northeast', tester_notes: 'The property do face Northeast' },
    { address: '4207 Zevanove Ct, Pleasanton, CA 94588 US',      remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'The property does not face Northwest it faces southeast' },
    { address: '4251 Lucero Ct, Pleasanton, CA 94588 US',        remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'The Property does not face northeast it faces southwest' },
    { address: '4253 Dorman Rd, Pleasanton, CA 94588 US',        remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'The property do not face south it faces southwest' },
    { address: '4262 Tamur Ct, Pleasanton, CA 94566 US',         remark: 'Bad',  expected_orientation: 'North',     tester_notes: 'The Property does not face south it faces North' },
    { address: '4374 Valley Ave #D1, Pleasanton, CA 94566 US',   remark: 'Good', expected_orientation: 'North',     tester_notes: 'The front door do face North' },
    { address: '4433 Fairlands Dr, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'East',      tester_notes: 'The front door do face East' },
    { address: '4451 Fairlands Dr, Pleasanton, CA 94588 US',     remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'The property does not face East it faces south' },
    { address: '4563 Gatetree Cir, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { address: '4580 Harper Ct, Pleasanton, CA 94588 US',        remark: 'Good', expected_orientation: 'East',      tester_notes: 'The property do face East' },
    { address: '4726 Black Ave, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '496 Montori Ct, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face West' },
    { address: '5111 Venice Ct, Pleasanton, CA 94588 US',        remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'The property do face SouthWest' },
    { address: '5130 Bianco Ct, Pleasanton, CA 94588 US',        remark: 'Bad',  expected_orientation: 'Southeast', tester_notes: 'The Property does not face East it faces southeast' },
    { address: '5207 Crestline Way, Pleasanton, CA 94566 US',    remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '5261 Springdale Ave, Pleasanton, CA 94588 US',   remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'The property does not face Northeast it faces Southwest' },
    { address: '535 San Gabriel Ct, Pleasanton, CA 94566 US',    remark: 'Good', expected_orientation: 'North',     tester_notes: 'The Property do face North' },
    { address: '5534 Blackbird Dr, Pleasanton, CA 94566 US',     remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property do face west' },
    { address: '562 Touriga Ct, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'South',     tester_notes: 'The property do face South' },
    { address: '5656 Belleza Dr, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'The Property does not face Northwest it faces South/southeast' },
    { address: '6156 Corte Padre, Pleasanton, CA 94588 US',      remark: 'Bad',  expected_orientation: 'North',     tester_notes: 'The property do not face South it faces North' },
    { address: '6168 Inglewood Dr, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '6427 Paseo Santa Maria, Pleasanton, CA 94566 US',remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'The property do face Southwest' },
    { address: '6650 Johnston Rd, Pleasanton, CA 94588 US',      remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '674 Crystal Ct, Pleasanton, CA 94566 US',        remark: 'Bad',  expected_orientation: 'Southwest', tester_notes: 'the property do not face Northeast it faces Southwest (which was correct in earlier versions)' },
    { address: '685 Palomino Dr Unit D, Pleasanton, CA 94566 US',remark: 'Bad',  expected_orientation: 'East',      tester_notes: 'The property do not face North it faces east' },
    { address: '7332 Stonedale Dr, Pleasanton, CA 94588 US',     remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '7333 Tulipwood Cir, Pleasanton, CA 94588 US',    remark: 'Good', expected_orientation: 'West',      tester_notes: 'The property faces west/southwest' },
    { address: '7518 Rosedale Ct, Pleasanton, CA 94588 US',      remark: 'Bad',  expected_orientation: 'Northeast', tester_notes: 'the property do not face west it faces Northeast' },
    { address: '7543 Maywood Dr, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face North it faces south (which was correct in earlier verions)' },
    { address: '7551 Maywood Dr, Pleasanton, CA 94588 US',       remark: 'Bad',  expected_orientation: 'South',     tester_notes: 'the property do not face East it faces south (which was correct in earlier verions)' },
    { address: '7738 Fairoaks Dr, Pleasanton, CA 94588 US',      remark: 'Good', expected_orientation: 'North',     tester_notes: 'The property do face North' },
    { address: '7814 Knollbrook Dr, Pleasanton, CA 94588 US',    remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { address: '788 Crystal Ln, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'Southwest', tester_notes: 'The property do face Southwest' },
    { address: '8044 Golden Eagle Way, Pleasanton, CA 94588 US', remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { address: '8158 Canyon Creek Cir, Pleasanton, CA, 94588',   remark: 'Good', expected_orientation: null,        tester_notes: 'property descriptions do not load' },
    { address: '859 Gray Fox Cir, Pleasanton, CA 94566 US',      remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { address: '884 Bonita Ave, Pleasanton, CA 94566 US',        remark: 'Good', expected_orientation: 'Northwest', tester_notes: 'The property do face Northwest' },
    { address: '9500 Santos Ranch Rd, Pleasanton, CA 94588 US',  remark: 'Bad',  expected_orientation: 'West',      tester_notes: 'The property do not face northeast it faces west' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═'.repeat(70));
    console.log(`  Orientation Ground Truth — Pleasanton (${TESTER_DATA.length} properties)${DRY_RUN ? '  [DRY RUN]' : ''}`);
    console.log('═'.repeat(70) + '\n');

    // 1. Load address → ZPID map from address_index/pleasanton
    console.log('Loading address_index/pleasanton …');
    const indexSnap = await getDocs(collection(db, 'address_index', 'pleasanton', 'addresses'));
    const zpidMap = new Map<string, string>();
    indexSnap.docs.forEach(d => {
        const data = d.data();
        if (data.zpid) zpidMap.set(d.id, String(data.zpid));
    });

    // Also build a normalised fallback map
    const norm = (s: string) => s.toLowerCase().replace(/[,.\s]+/g, ' ').trim();
    const normMap = new Map<string, string>();
    zpidMap.forEach((zpid, addr) => normMap.set(norm(addr), zpid));
    console.log(`  → ${zpidMap.size} ZPIDs loaded.\n`);

    // 2. Match each tester row to a ZPID and write to Firestore
    let written = 0, skipped = 0, noZpid = 0;

    for (const row of TESTER_DATA) {
        // Skip rows with no useful orientation data
        if (row.expected_orientation == null && row.remark === '') {
            console.log(`  ⏭️  SKIP (no data)  : ${row.address.split(',')[0]}`);
            skipped++;
            continue;
        }

        // ZPID lookup — try exact match first, then normalised
        const zpid = zpidMap.get(row.address) ?? normMap.get(norm(row.address));
        if (!zpid) {
            console.log(`  ❓  NO ZPID         : ${row.address.split(',')[0]}`);
            noZpid++;
            continue;
        }

        const docData = {
            city:                  'Pleasanton',
            address:               row.address,
            zpid,
            expected_orientation:  row.expected_orientation,
            expected_azimuth_deg:  row.expected_orientation ? (AZIMUTH[row.expected_orientation] ?? null) : null,
            remark:                row.remark,
            tester_notes:          row.tester_notes,
            created_at:            serverTimestamp(),
        };

        const orientLabel = row.expected_orientation ?? '(derive from DB)';
        console.log(`  ✅  ${row.remark.padEnd(4)} zpid=${zpid.padEnd(12)} ${orientLabel.padEnd(12)} ${row.address.split(',')[0]}${DRY_RUN ? ' [DRY]' : ''}`);

        if (!DRY_RUN) {
            await setDoc(doc(db, 'orientation_ground_truth', zpid), docData, { merge: false });
        }
        written++;
    }

    console.log('\n' + '═'.repeat(70));
    console.log('  RESULTS');
    console.log('═'.repeat(70));
    console.log(`  ✅  Written  : ${written}`);
    console.log(`  ⏭️   Skipped  : ${skipped}  (no useful orientation data)`);
    console.log(`  ❓  No ZPID  : ${noZpid}`);
    if (DRY_RUN) console.log('\n  [DRY RUN] — no writes made. Re-run without --dry-run to apply.');
    console.log('═'.repeat(70) + '\n');
}

main()
    .then(() => { console.log('Done.'); process.exit(0); })
    .catch(err => { console.error('Script failed:', err); process.exit(1); });
