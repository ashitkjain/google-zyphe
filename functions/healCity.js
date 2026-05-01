#!/usr/bin/env node
/**
 * City-wide env healing script.
 * Calls _enrichEnvironmentalData directly for each property that needs it.
 * No Cloud Function deploy needed — runs against Firestore directly.
 *
 * Usage: cd functions && node healCity.js [cityName]
 */
'use strict';

const admin = require('firebase-admin');
try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch (e) {}
const db = admin.firestore();

const { _enrichEnvironmentalData, ENV_SCHEMA_VERSION } = require('./shared/propertyUtils');

const CITY       = process.argv[2] || 'Pleasanton';
const CONCURRENCY = 3; // keep low to avoid rate limiting

const API_KEYS = {
    google_maps_key: 'AIzaSyCQ-OcGRDMK8nGmCMzpuxHT0Y9vJgqajRI',
    gemini_key:      'AIzaSyBG_lkm4nbHYUF9deJTkmxS7rng5o2eBw4',
    bypassCache:     false, // use TTL cache but still apply version-upgrade healing
};

async function needsHealing(zpid) {
    const envSnap = await db.collection('properties').doc(zpid)
        .collection('environmental').doc('thirdparty_data').get();
    if (!envSnap.exists) return false; // no env doc → needs Full Intel first
    const env = envSnap.data();
    const v = env.__env_version || 0;
    return v < ENV_SCHEMA_VERSION ||
        !env.solarData || !env.airQuality || !env.pollen ||
        env.zypheNoiseScore == null || !env.broadband ||
        !env.historical_disasters?.seismicZone ||
        (env.pollen && !env.pollen?.analysis?.breathe_easy_summary);
}

async function healOne(zpid, prop) {
    const lat = prop.coordinates?.latitude;
    const lng = prop.coordinates?.longitude;
    if (!lat || !lng) return `${zpid}: skip (no coords)`;

    try {
        await _enrichEnvironmentalData(zpid, db, API_KEYS, lat, lng, null);
        return `${zpid} (${prop.streetAddress || ''}): ✅`;
    } catch (e) {
        return `${zpid}: ❌ ${e.message}`;
    }
}

async function main() {
    console.log(`\nCity Healing: ${CITY} → target env v${ENV_SCHEMA_VERSION}\n`);

    const snap = await db.collection('properties')
        .where('city', '==', CITY)
        .select('city', 'homeType', 'coordinates', 'streetAddress')
        .get();

    const all = snap.docs.map(d => ({ zpid: d.id, ...d.data() }));
    console.log(`Found ${all.length} total properties. Scanning env docs...\n`);

    // Identify which need healing
    const toHeal = [];
    const CHUNK = 10;
    for (let i = 0; i < all.length; i += CHUNK) {
        const chunk = all.slice(i, i + CHUNK);
        await Promise.all(chunk.map(async p => {
            if (await needsHealing(p.zpid)) toHeal.push(p);
        }));
        process.stdout.write(`\r  Scanning ${Math.min(i + CHUNK, all.length)}/${all.length} → ${toHeal.length} need healing`);
    }
    console.log(`\n\n${toHeal.length} properties to heal. Starting...\n`);

    let done = 0;
    for (let i = 0; i < toHeal.length; i += CONCURRENCY) {
        const batch = toHeal.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(p => healOne(p.zpid, p)));
        results.forEach(r => console.log(`  ${r}`));
        done += batch.length;
        console.log(`  [${done}/${toHeal.length}]\n`);
    }

    console.log('✅ Done. Re-run smoke test to verify.\n');
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
