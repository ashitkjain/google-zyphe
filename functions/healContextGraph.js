#!/usr/bin/env node
/**
 * Backfills context_graph data from top-level context_graph/{zpid} collection
 * into properties/{zpid}/analysis/context_graph subcollection (the path smoke test reads).
 * Usage: node functions/healContextGraph.js [cityName]
 */
'use strict';

const admin = require('firebase-admin');
try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch(e) {}
const db = admin.firestore();

const CITY = process.argv[2] || 'Pleasanton';

async function main() {
    console.log(`\nContext Graph heal for ${CITY}\n`);

    const snap = await db.collection('properties').where('city', '==', CITY).get();
    const zpids = snap.docs.map(d => d.id);
    console.log(`${zpids.length} properties found\n`);

    let healed = 0, alreadyOk = 0, missingBoth = 0;

    for (const zpid of zpids) {
        const [topSnap, subSnap] = await Promise.all([
            db.collection('context_graph').doc(zpid).get(),
            db.collection('properties').doc(zpid).collection('analysis').doc('context_graph').get(),
        ]);

        const topData = topSnap.data();
        const subData = subSnap.data();

        const topOk = topSnap.exists && Array.isArray(topData?.factors) && topData.factors.length > 0;
        const subOk = subSnap.exists && Array.isArray(subData?.factors) && subData.factors.length > 0;

        if (subOk) {
            alreadyOk++;
            continue;
        }

        if (!topOk) {
            missingBoth++;
            console.log(`  ${zpid}: missing in both locations`);
            continue;
        }

        // Copy top-level → subcollection
        await db.collection('properties').doc(zpid).collection('analysis').doc('context_graph').set({
            factors: topData.factors,
            summary: topData.summary ?? null,
            keyMetrics: topData.keyMetrics ?? null,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`  ${zpid}: ✅ backfilled ${topData.factors.length} factors`);
        healed++;
    }

    console.log(`\nDone: ${healed} healed, ${alreadyOk} already ok, ${missingBoth} missing both`);
    console.log(`Properties missing both need a Context Graph batch run from CityDataTab.\n`);
    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
