#!/usr/bin/env node
/**
 * fetchRawOrientation.js
 *
 * Dumps the full orientation_ai document for specific properties.
 * Usage:
 *   node functions/fetchRawOrientation.js 25076234 <zpid2> ...
 */
'use strict';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'zyphe-af0bf' });
const db = admin.firestore();

const zpids = process.argv.slice(2);
if (!zpids.length) {
    // Defaults: the three problematic ones
    zpids.push(
        '25076234', // 4073 Stanley Blvd  (174° off)
    );
    // Find 1237 Concord St and 4022 Silver St by address
    console.log('No zpids given — fetching by address for key bad cases...\n');
}

async function findByAddress(term) {
    const snap = await db.collection('properties')
        .where('city', '==', 'Pleasanton')
        .limit(200)
        .get();
    const doc = snap.docs.find(d => (d.data().address || '').toLowerCase().includes(term.toLowerCase()));
    return doc ? { zpid: doc.id, ...doc.data() } : null;
}

async function main() {
    const addresses = [
        { key: '4073 Stanley Blvd', note: '174° off — the critical failure' },
        { key: '1237 Concord St',   note: '90° off — borderline' },
        { key: '4022 Silver St',    note: '87° off — borderline' },
        { key: '215 Mavis Dr',      note: 'GT=East, not in summary table — check if missing' },
        { key: '1421 Calle Enrique',note: 'GT=Southeast' },
    ];

    for (const { key, note } of addresses) {
        const prop = await findByAddress(key.split(' ')[0] + ' ' + key.split(' ')[1]);
        if (!prop) {
            console.log(`\n❌ NOT FOUND: ${key}`);
            continue;
        }
        const ai = prop.orientation_ai;
        console.log(`\n${'═'.repeat(70)}`);
        console.log(`📍 ${prop.address}  [${note}]`);
        console.log(`   zpid: ${prop.zpid}`);
        console.log(`   streetViewHeadingDeg: ${prop.streetViewHeadingDeg ?? 'NOT SET'}`);
        console.log(`   streetView URL set: ${!!prop.streetView}`);
        console.log(`   satelliteImageUrl set: ${!!prop.satelliteImageUrl}`);
        if (!ai) {
            console.log('   orientation_ai: NOT SET');
            continue;
        }
        console.log(`\n   orientation_ai:`);
        console.log(`     final_orientation:    ${ai.final_orientation}`);
        console.log(`     azimuth_degrees:      ${ai.azimuth_degrees}`);
        console.log(`     visual_azimuth_est:   ${ai.visual_azimuth_estimate}`);
        console.log(`     confidence:           ${ai.confidence}`);
        console.log(`     aerial_only_mode:     ${ai.aerial_only_mode}`);
        console.log(`     property_layout_type: ${ai.property_layout_type}`);
        console.log(`     garage_direction:     ${ai.garage_direction}`);
        console.log(`     pool_visible:         ${ai.pool_visible}`);
        console.log(`     _debug (full):        ${JSON.stringify(ai._debug ?? {})}`);
        console.log(`\n   EXPLANATION (raw):\n`);
        console.log((ai.explanation || '').split('\n').map(l => '   ' + l).join('\n'));
    }
}

main().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});
