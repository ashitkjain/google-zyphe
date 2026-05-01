#!/usr/bin/env node
'use strict';
const admin = require('firebase-admin');
try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch(e) {}
const db = admin.firestore();
const { _enrichParcelData } = require('./shared/propertyUtils');

const CITY = process.argv[2] || 'Pleasanton';
const CONCURRENCY = 3;

async function main() {
    console.log(`\nParcel healing for ${CITY}\n`);

    const snap = await db.collection('properties')
        .where('city', '==', CITY)
        .select('city', 'homeType', 'coordinates', 'streetAddress', 'parcelPolygon', 'parcelNotFound')
        .get();

    const toHeal = snap.docs
        .filter(d => !d.data().parcelPolygon && !d.data().parcelNotFound)
        .map(d => ({ zpid: d.id, ...d.data() }));

    console.log(`${toHeal.length} properties need parcel healing.\n`);
    if (toHeal.length === 0) { process.exit(0); }

    let done = 0;
    for (let i = 0; i < toHeal.length; i += CONCURRENCY) {
        const batch = toHeal.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async p => {
            const lat = p.coordinates?.latitude;
            const lng = p.coordinates?.longitude;
            if (!lat || !lng) return `${p.zpid}: skip (no coords)`;
            try {
                const result = await _enrichParcelData(p.zpid, db, lat, lng);
                return result
                    ? `${p.zpid} (${p.streetAddress || ''}): ✅ parcel found`
                    : `${p.zpid} (${p.streetAddress || ''}): ⚠️  not found (parcelNotFound set)`;
            } catch(e) {
                return `${p.zpid}: ❌ ${e.message}`;
            }
        }));
        results.forEach(r => console.log(`  ${r}`));
        done += batch.length;
        console.log(`  [${done}/${toHeal.length}]\n`);
    }

    console.log('Done. Re-run diagCity.js to verify.\n');
    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
