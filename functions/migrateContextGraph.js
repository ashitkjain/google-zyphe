#!/usr/bin/env node
/**
 * Migrates context_graph data from the old subcollection path
 * (properties/{zpid}/analysis/context_graph) into the canonical top-level
 * context_graph/{zpid} collection, preserving factors/summary/keyMetrics.
 *
 * Safe to re-run: skips properties that already have top-level data with factors.
 * Usage: node functions/migrateContextGraph.js [cityName]
 */
'use strict';

const admin = require('firebase-admin');
try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch(e) {}
const db = admin.firestore();

const CITY = process.argv[2] || 'Pleasanton';
const CONCURRENCY = 5;

async function migrateOne(zpid, propData) {
    const [topSnap, subSnap] = await Promise.all([
        db.collection('context_graph').doc(zpid).get(),
        db.collection('properties').doc(zpid).collection('analysis').doc('context_graph').get(),
    ]);

    const topData = topSnap.data();
    const subData = subSnap.data();

    const topHasFactors = topSnap.exists && Array.isArray(topData?.factors) && topData.factors.length > 0;
    const subHasFactors = subSnap.exists && Array.isArray(subData?.factors) && subData.factors.length > 0;

    if (topHasFactors) return `${zpid}: skip (already in top-level, ${topData.factors.length} factors)`;
    if (!subHasFactors) return `${zpid}: skip (no data in either location)`;

    // Migrate subcollection → top-level, adding city/state metadata for queries
    const saveData = {
        ...subData,
        city: (propData.city || CITY).toLowerCase().trim(),
        state: (propData.state || 'CA').toUpperCase().trim(),
        price: propData.price ?? propData.zestimate ?? null,
        beds: propData.bedrooms ?? null,
        baths: propData.bathrooms ?? null,
        sqft: propData.livingAreaValue ?? null,
        yearBuilt: propData.yearBuilt ?? null,
        homeType: propData.homeType ?? null,
        address: propData.streetAddress ?? propData.address ?? null,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('context_graph').doc(zpid).set(saveData, { merge: true });
    return `${zpid} (${propData.streetAddress || ''}): ✅ migrated ${subData.factors.length} factors`;
}

async function main() {
    console.log(`\nContext Graph migration for ${CITY}\n`);

    const snap = await db.collection('properties').where('city', '==', CITY).get();
    const props = snap.docs.map(d => ({ zpid: d.id, ...d.data() }));
    console.log(`${props.length} properties found\n`);

    let migrated = 0, skippedOk = 0, skippedMissing = 0;

    for (let i = 0; i < props.length; i += CONCURRENCY) {
        const batch = props.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(p => migrateOne(p.zpid, p)));
        results.forEach(r => {
            console.log(' ', r);
            if (r.includes('✅')) migrated++;
            else if (r.includes('already in top-level')) skippedOk++;
            else skippedMissing++;
        });
    }

    console.log(`\nDone: ${migrated} migrated, ${skippedOk} already ok, ${skippedMissing} missing both`);
    console.log('Properties missing both still need Context Graph batch from CityDataTab.\n');
    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
