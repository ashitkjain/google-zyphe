#!/usr/bin/env node
/**
 * fullDiagnose.js
 *
 * Comprehensive orientation mismatch diagnostic using:
 *   1. Full PLEASANTON_GROUND_TRUTH static dataset (100 entries)
 *   2. Firestore orientation_ground_truth/{zpid}.expected_orientation (manual/description GT)
 *
 * Firestore GT takes priority over static data (same as UI logic).
 * Reports all properties with angular error ≥ 45°, sorted worst first.
 *
 * Usage:
 *   node functions/fullDiagnose.js [--threshold 90]
 */
'use strict';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'zyphe-af0bf' });
const db = admin.firestore();

// ─── Threshold ────────────────────────────────────────────────────────────────
const THRESHOLD = parseInt((process.argv.find(a => a.match(/^\d+$/))) || '45', 10);

// ─── Azimuth helpers ──────────────────────────────────────────────────────────
const AZ = { north:0, northeast:45, east:90, southeast:135, south:180, southwest:225, west:270, northwest:315 };
function dirToAz(dir) {
    if (!dir) return null;
    const clean = dir.toLowerCase().replace(/\s*\(~.*?\)/,'').replace(/\s*\(v\d+\)/,'').trim();
    return AZ[clean] ?? null;
}
function angularDist(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}
const norm = s => (s||'').toLowerCase().replace(/[,.\s]+/g,' ').trim();

// ─── Full PLEASANTON static GT (from orientation_ground_truth_data.ts) ────────
const PLEASANTON_GT = [
    { address: '1039 Hopkins Way, Pleasanton, CA 94566 US',       expected: 'North' },
    { address: '1131 Mataro Ct, Pleasanton, CA 94566 US',         expected: 'East' },
    { address: '1149 Hopkins Way, Pleasanton, CA 94566 US',       expected: 'Northwest' },
    { address: '1224 Harvest Rd, Pleasanton, CA 94566 US',        expected: 'Northeast' },
    { address: '1237 Concord St, Pleasanton, CA 94566 US',        expected: 'Northeast' },
    { address: '1380 Brookline Loop, Pleasanton, CA 94566 US',    expected: 'Southwest' },
    { address: '1398 Piemonte Dr, Pleasanton, CA 94566 US',       expected: 'Northeast' },
    { address: '1421 Calle Enrique, Pleasanton, CA 94566 US',     expected: 'Southeast' },
    { address: '1448 Freeman Ln, Pleasanton, CA 94566 US',        expected: 'Southeast' },
    { address: '1450 Finley Rd, Pleasanton, CA 94588 US',         expected: 'East' },
    { address: '1515 Germano Way, Pleasanton, CA 94566 US',       expected: 'Southeast' },
    { address: '1527 Honey Suckle Ct, Pleasanton, CA 94588 US',   expected: 'Northwest' },
    { address: '1558 Calle Enrique, Pleasanton, CA 94566 US',     expected: 'Northeast' },
    { address: '1565 Mendoza Ct, Pleasanton, CA 94566 US',        expected: 'Southwest' },
    { address: '1621 Harvest Rd, Pleasanton, CA 94566 US',        expected: 'Southwest' },
    { address: '1825 Crestline Rd, Pleasanton, CA 94566 US',      expected: 'South' },
    { address: '1889 Via Di Salerno, Pleasanton, CA 94566 US',    expected: 'Southwest' },
    { address: '2004 W Lagoon Rd, Pleasanton, CA 94566 US',       expected: 'Northeast' },
    { address: '2128 Alexander Way, Pleasanton, CA 94588 US',     expected: 'Northeast' },
    { address: '215 Mavis Dr, Pleasanton, CA 94566 US',           expected: 'East' },
    { address: '218 Birch Creek Dr, Pleasanton, CA 94566 US',     expected: 'South' },
    { address: '226 Birch Creek Dr, Pleasanton, CA 94566 US',     expected: 'South' },
    { address: '2270 Doccia Ct, Pleasanton, CA 94566 US',         expected: 'Southeast' },
    { address: '2415 Crestline Rd, Pleasanton, CA 94566 US',      expected: 'West' },
    { address: '254 Joseph Ln, Pleasanton, CA 94588 US',          expected: 'East' },
    { address: '2577 Arlotta Pl, Pleasanton, CA 94588 US',        expected: 'Northwest' },
    { address: '2733 Corte Vera Cruz, Pleasanton, CA 94566 US',   expected: 'Southwest' },
    { address: '282 Del Valle Ct, Pleasanton, CA 94566 US',       expected: 'South' },
    { address: '298 Sullivan Ct, Pleasanton, CA 94566 US',        expected: 'Southeast' },
    { address: '3019 Boardwalk St, Pleasanton, CA 94588 US',      expected: 'West' },
    { address: '3208 Touriga Dr, Pleasanton, CA 94566 US',        expected: 'West' },
    { address: '3219 Touriga Dr, Pleasanton, CA 94566 US',        expected: 'East' },
    { address: '3329 Vermont Pl, Pleasanton, CA 94588 US',        expected: 'East' },
    { address: '337 Trenton Cir, Pleasanton, CA 94566 US',        expected: 'East' },
    { address: '3492 Dorset St, Pleasanton, CA 94566 US',         expected: 'Southeast' },
    { address: '3550 Vine St, Pleasanton, CA 94566 US',           expected: 'North' },
    { address: '3593 Whitehall Ct, Pleasanton, CA 94588 US',      expected: 'South' },
    { address: '3624 Canelli Ct, Pleasanton, CA 94566 US',        expected: 'North' },
    { address: '3636 Shenandoah Ct, Pleasanton, CA 94588 US',     expected: 'Northwest' },
    { address: '3641 Shenandoah Ct, Pleasanton, CA 94588 US',     expected: 'South' },
    { address: '3653 Kamp Dr, Pleasanton, CA 94588 US',           expected: 'West' },
    { address: '3691 Chillingham Ct, Pleasanton, CA 94588 US',    expected: 'West' },
    { address: '3696 Woodbine Way, Pleasanton, CA 94588 US',      expected: 'West' },
    { address: '3817 Muirwood Dr, Pleasanton, CA 94588 US',       expected: 'West' },
    { address: '3825 Brockton Dr, Pleasanton, CA 94588 US',       expected: 'West' },
    { address: '3921 Alma Ct, Pleasanton, CA 94588 US',           expected: 'West' },
    { address: '4019 Rennellwood Way, Pleasanton, CA 94566 US',   expected: 'Northwest' },
    { address: '4022 Silver St, Pleasanton, CA 94566 US',         expected: 'North' },
    { address: '4034 Francisco St, Pleasanton, CA 94566 US',      expected: 'North' },
    { address: '4034 Rennellwood Way, Pleasanton, CA 94566 US',   expected: 'Southeast' },
    { address: '4061 Holland Dr, Pleasanton, CA 94588 US',        expected: 'South' },
    { address: '4067 Alvarado St, Pleasanton, CA 94566 US',       expected: 'South' },
    { address: '4071 Walnut Dr, Pleasanton, CA 94566 US',         expected: 'Southeast' },
    { address: '4073 Stanley Blvd, Pleasanton, CA 94566 US',      expected: 'North' },
    { address: '4127 Alvarado St, Pleasanton, CA 94566 US',       expected: 'South' },
    { address: '4153 Alba Ct, Pleasanton, CA 94588 US',           expected: 'Northwest' },
    { address: '4159 Amberwood Cir, Pleasanton, CA 94588 US',     expected: 'Northeast' },
    { address: '4173 Georgis Pl, Pleasanton, CA 94588 US',        expected: 'Northeast' },
    { address: '4181 Georgis Pl, Pleasanton, CA 94588 US',        expected: 'Northeast' },
    { address: '4207 Zevanove Ct, Pleasanton, CA 94588 US',       expected: 'Southeast' },
    { address: '4251 Lucero Ct, Pleasanton, CA 94588 US',         expected: 'Southwest' },
    { address: '4253 Dorman Rd, Pleasanton, CA 94588 US',         expected: 'Southwest' },
    { address: '4262 Tamur Ct, Pleasanton, CA 94566 US',          expected: 'North' },
    { address: '4374 Valley Ave #D1, Pleasanton, CA 94566 US',    expected: 'North' },
    { address: '4433 Fairlands Dr, Pleasanton, CA 94588 US',      expected: 'East' },
    { address: '4451 Fairlands Dr, Pleasanton, CA 94588 US',      expected: 'South' },
    { address: '4563 Gatetree Cir, Pleasanton, CA 94566 US',      expected: 'West' },
    { address: '4580 Harper Ct, Pleasanton, CA 94588 US',         expected: 'East' },
    { address: '4726 Black Ave, Pleasanton, CA 94566 US',         expected: 'North' },
    { address: '496 Montori Ct, Pleasanton, CA 94566 US',         expected: 'West' },
    { address: '5111 Venice Ct, Pleasanton, CA 94588 US',         expected: 'Southwest' },
    { address: '5130 Bianco Ct, Pleasanton, CA 94588 US',         expected: 'Southeast' },
    { address: '5207 Crestline Way, Pleasanton, CA 94566 US',     expected: 'North' },
    { address: '5261 Springdale Ave, Pleasanton, CA 94588 US',    expected: 'Southwest' },
    { address: '535 San Gabriel Ct, Pleasanton, CA 94566 US',     expected: 'North' },
    { address: '5534 Blackbird Dr, Pleasanton, CA 94566 US',      expected: 'West' },
    { address: '562 Touriga Ct, Pleasanton, CA 94566 US',         expected: 'South' },
    { address: '5656 Belleza Dr, Pleasanton, CA 94588 US',        expected: 'South' },
    { address: '6156 Corte Padre, Pleasanton, CA 94588 US',       expected: 'North' },
    { address: '6168 Inglewood Dr, Pleasanton, CA 94588 US',      expected: 'North' },
    { address: '6427 Paseo Santa Maria, Pleasanton, CA 94566 US', expected: 'Southwest' },
    { address: '6650 Johnston Rd, Pleasanton, CA 94588 US',       expected: 'North' },
    { address: '674 Crystal Ct, Pleasanton, CA 94566 US',         expected: 'Southwest' },
    { address: '685 Palomino Dr Unit D, Pleasanton, CA 94566 US', expected: 'East' },
    { address: '7332 Stonedale Dr, Pleasanton, CA 94588 US',      expected: 'North' },
    { address: '7333 Tulipwood Cir, Pleasanton, CA 94588 US',     expected: 'West' },
    { address: '7518 Rosedale Ct, Pleasanton, CA 94588 US',       expected: 'Northeast' },
    { address: '7543 Maywood Dr, Pleasanton, CA 94588 US',        expected: 'South' },
    { address: '7551 Maywood Dr, Pleasanton, CA 94588 US',        expected: 'South' },
    { address: '7738 Fairoaks Dr, Pleasanton, CA 94588 US',       expected: 'North' },
    { address: '7814 Knollbrook Dr, Pleasanton, CA 94588 US',     expected: 'Northwest' },
    { address: '788 Crystal Ln, Pleasanton, CA 94566 US',         expected: 'Southwest' },
    { address: '8044 Golden Eagle Way, Pleasanton, CA 94588 US',  expected: 'Northwest' },
    { address: '859 Gray Fox Cir, Pleasanton, CA 94566 US',       expected: 'Northwest' },
    { address: '884 Bonita Ave, Pleasanton, CA 94566 US',         expected: 'Northwest' },
    { address: '9500 Santos Ranch Rd, Pleasanton, CA 94588 US',   expected: 'West' },
    { address: '1265 Koln St, Pleasanton, CA 94566 US',           expected: null },
    { address: '388 Oak Ln, Pleasanton, CA 94566 US',             expected: null },
    { address: '8158 Canyon Creek Cir, Pleasanton, CA 94588 US',  expected: null },
];

// Build lookup: normalized address → GT
const addrToGt = new Map();
PLEASANTON_GT.forEach(r => {
    if (r.expected) addrToGt.set(norm(r.address), r.expected);
});

async function main() {
    const reportThreshold = THRESHOLD;

    console.log(`\n${'═'.repeat(72)}`);
    console.log(`  Full Pleasanton Orientation Diagnostics (error ≥ ${reportThreshold}°)`);
    console.log(`${'═'.repeat(72)}\n`);

    // ── 1. Load Firestore GT overrides ──
    console.log('Loading Firestore GT overrides...');
    const gtSnap = await db.collection('orientation_ground_truth').get();
    const firestoreGt = {};  // zpid → { expected, source }
    const firestoreGtByAddr = {};  // norm(addr) → { expected, source, zpid }
    gtSnap.docs.forEach(d => {
        const data = d.data();
        if (data.expected_orientation) {
            firestoreGt[d.id] = { expected: data.expected_orientation, source: data.gt_source || 'unknown' };
            if (data.address) firestoreGtByAddr[norm(data.address)] = { expected: data.expected_orientation, source: data.gt_source || 'unknown', zpid: d.id };
        }
    });
    console.log(`  Loaded ${Object.keys(firestoreGt).length} Firestore GT entries\n`);

    // ── 2. Load all Pleasanton properties with orientation_ai ──
    console.log('Loading Pleasanton properties...');
    const propSnap = await db.collection('properties')
        .where('city', '==', 'Pleasanton')
        .limit(500)
        .get();
    console.log(`  Found ${propSnap.docs.length} Pleasanton properties\n`);

    const results = [];
    let noGt = 0, noAi = 0, isUnclear = 0;

    for (const doc of propSnap.docs) {
        const d = doc.data();
        const ai = d.orientation_ai;
        if (!ai || !ai.final_orientation) { noAi++; continue; }

        // Determine GT: Firestore zpid-keyed → Firestore addr-keyed → static addr-keyed
        let gtDir = null, gtSource = 'static';
        const zpid = doc.id;
        const addrNorm = norm(d.address || '');

        if (firestoreGt[zpid]) {
            gtDir = firestoreGt[zpid].expected;
            gtSource = firestoreGt[zpid].source;
        } else if (firestoreGtByAddr[addrNorm]) {
            gtDir = firestoreGtByAddr[addrNorm].expected;
            gtSource = firestoreGtByAddr[addrNorm].source;
        } else {
            gtDir = addrToGt.get(addrNorm) ?? null;
        }

        if (!gtDir) { noGt++; continue; }

        const aiDir = ai.final_orientation;
        const aiLabel = aiDir.split(/[\s(]/)[0].toLowerCase().trim();
        if (aiLabel === 'unclear') { isUnclear++; continue; }

        const aiAz = ai.azimuth_degrees ?? dirToAz(aiDir);
        const gtAz = dirToAz(gtDir);
        if (aiAz == null || gtAz == null) continue;

        const err = Math.round(angularDist(aiAz, gtAz));

        results.push({
            zpid,
            address: d.address,
            aiDir,
            aiAz,
            gtDir,
            gtAz,
            err,
            gtSource,
            confidence: ai.confidence,
            aerialOnly: ai.aerial_only_mode,
            layoutType: ai.property_layout_type,
            visualEst: ai.visual_azimuth_estimate,
            heading: d.streetViewHeadingDeg ?? null,
            imageQuality: ai.image_quality,
            explanation: ai.explanation,
            debug: ai._debug,
        });
    }

    results.sort((a, b) => b.err - a.err);

    const bad = results.filter(r => r.err >= reportThreshold);
    const warn = results.filter(r => r.err >= 45 && r.err < reportThreshold);
    const ok   = results.filter(r => r.err < 45);

    console.log(`Coverage: ${results.length} matched | ${noGt} no-GT | ${noAi} no-AI | ${isUnclear} UNCLEAR`);
    console.log(`  ❌ ≥${reportThreshold}° error:  ${bad.length}`);
    if (reportThreshold > 45) console.log(`  ⚠️  45–${reportThreshold-1}° error: ${warn.length}`);
    console.log(`  ✅ <45° error:    ${ok.length}\n`);

    // ── Detail blocks for bad cases ──
    for (const r of bad) {
        console.log(`${'─'.repeat(68)}`);
        console.log(`❌ ${r.address}`);
        console.log(`   zpid:          ${r.zpid}`);
        console.log(`   AI:            ${r.aiDir} (${r.aiAz}°)`);
        console.log(`   GT:            ${r.gtDir} (${r.gtAz}°)  [source: ${r.gtSource}]`);
        console.log(`   Error:         ${r.err}°`);
        console.log(`   Confidence:    ${r.confidence}  |  aerial_only: ${r.aerialOnly}  |  layout: ${r.layoutType}`);
        console.log(`   visualEst:     ${r.visualEst != null ? r.visualEst + '°' : 'N/A'}  |  heading: ${r.heading != null ? r.heading + '°' : 'N/A'}  |  imageQ: ${r.imageQuality}`);
        if (r.explanation) {
            console.log(`\n   EXPLANATION:\n`);
            const lines = r.explanation.match(/.{1,80}/g) || [];
            lines.forEach(l => console.log(`   ${l}`));
        }
        console.log();
    }

    // ── Summary Table ──
    console.log(`\n${'═'.repeat(72)}`);
    console.log('  FULL TABLE (all matched, sorted worst→best)');
    console.log(`${'═'.repeat(72)}`);
    console.log(`  ${'Address'.padEnd(33)} ${'AI'.padEnd(14)} ${'GT'.padEnd(11)} ${'Err'.padEnd(5)} Conf   AO    Layout`);
    console.log(`  ${'─'.repeat(95)}`);
    for (const r of results) {
        const flag = r.err >= reportThreshold ? '❌' : r.err >= 45 ? '⚠️ ' : '✅';
        const addr = (r.address||'').split(',')[0].padEnd(32);
        const ai   = r.aiDir.padEnd(13);
        const gt   = r.gtDir.padEnd(10);
        const err  = (r.err + '°').padEnd(5);
        const conf = (r.confidence||'?').padEnd(6);
        const ao   = String(r.aerialOnly).padEnd(5);
        const lay  = r.layoutType || '';
        console.log(`  ${flag} ${addr} ${ai} ${gt} ${err} ${conf} ${ao} ${lay}`);
    }
    console.log();

    // ── Pattern summary ──
    console.log(`\n${'═'.repeat(72)}`);
    console.log('  PATTERN ANALYSIS for ≥45° errors');
    console.log(`${'═'.repeat(72)}`);
    const all45 = results.filter(r => r.err >= 45);
    const aerialOnlyCount = all45.filter(r => r.aerialOnly).length;
    const highConfWrong   = all45.filter(r => r.confidence === 'high').length;
    const cornerLot       = all45.filter(r => r.layoutType === 'corner_lot').length;
    const blurryImg       = all45.filter(r => r.imageQuality === 'blurry').length;
    const noHeading       = all45.filter(r => r.heading == null).length;
    const visualCorrect   = all45.filter(r => {
        if (r.visualEst == null) return false;
        return angularDist(r.visualEst, r.gtAz) < 45;
    }).length;
    console.log(`  Total ≥45° errors:          ${all45.length}`);
    console.log(`  → aerial_only_mode=true:     ${aerialOnlyCount} (${pct(aerialOnlyCount, all45.length)}%)`);
    console.log(`  → high confidence but wrong: ${highConfWrong} (${pct(highConfWrong, all45.length)}%)`);
    console.log(`  → corner_lot layout:         ${cornerLot} (${pct(cornerLot, all45.length)}%)`);
    console.log(`  → blurry image:              ${blurryImg} (${pct(blurryImg, all45.length)}%)`);
    console.log(`  → no GPS heading available:  ${noHeading} (${pct(noHeading, all45.length)}%)`);
    console.log(`  → visual estimate was right: ${visualCorrect} (${pct(visualCorrect, all45.length)}%) ← GPS/GPS-logic overrode correct aerial`);
    console.log();
}

function pct(n, total) { return total ? Math.round(n/total*100) : 0; }

main().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});
