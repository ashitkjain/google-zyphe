#!/usr/bin/env node
/**
 * Heals missing Street View images in Firebase Storage.
 * Fetches from Google Street View Static API → uploads to Storage → writes URL to
 * properties/{zpid} and properties/{zpid}/analysis/assets.
 *
 * Only processes properties where Street View exists at source (confirmed via Metadata API).
 * Usage: node functions/healStreetView.js [cityName]
 */
'use strict';

const admin = require('firebase-admin');
try { admin.initializeApp({ projectId: 'zyphe-af0bf' }); } catch(e) {}
const db = admin.firestore();

const MAPS_KEY = process.env.MAPS_API_KEY || '';
const CITY = process.argv[2] || 'Pleasanton';
const CONCURRENCY = 3;

const isStorage = url => !!(url && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')));

async function svExistsAtSource(lat, lng) {
    try {
        const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${MAPS_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return false;
        const data = await res.json();
        return data.status === 'OK';
    } catch(e) {
        return false;
    }
}

async function fetchAndStoreStreetView(zpid, lat, lng) {
    const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${lat},${lng}&fov=80&heading=0&pitch=0&key=${MAPS_KEY}`;
    const res = await fetch(svUrl);
    if (!res.ok) throw new Error(`SV Static API HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucket = admin.storage().bucket('zyphe-af0bf.firebasestorage.app');
    const storagePath = `properties/${zpid}/maps/street_view.jpg`;
    const file = bucket.file(storagePath);
    await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
    await file.makePublic();

    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
    const propRef = db.collection('properties').doc(zpid);
    await propRef.set({ streetView: storageUrl }, { merge: true });
    return storageUrl;
}

async function healOne(zpid, prop) {
    const lat = prop.coordinates?.latitude;
    const lng = prop.coordinates?.longitude;
    if (!lat || !lng) return `${zpid}: skip (no coords)`;

    const assetsSnap = await db.collection('properties').doc(zpid).collection('analysis').doc('assets').get();
    const assets = assetsSnap.data() || {};
    if (isStorage(assets.streetView) || isStorage(prop.streetView)) return `${zpid}: skip (already stored)`;

    const exists = await svExistsAtSource(lat, lng);
    if (!exists) return `${zpid} (${prop.streetAddress || ''}): ⚠️  not available at source`;

    try {
        await fetchAndStoreStreetView(zpid, lat, lng);
        return `${zpid} (${prop.streetAddress || ''}): ✅`;
    } catch(e) {
        return `${zpid}: ❌ ${e.message}`;
    }
}

async function main() {
    console.log(`\nStreet View healing for ${CITY}\n`);

    const snap = await db.collection('properties')
        .where('city', '==', CITY)
        .select('city', 'homeType', 'coordinates', 'streetAddress', 'streetView')
        .get();

    // Only consider properties without a storage street view URL
    const toCheck = snap.docs
        .filter(d => !isStorage(d.data().streetView))
        .map(d => ({ zpid: d.id, ...d.data() }));

    console.log(`${toCheck.length} properties need checking. Confirming source availability...\n`);

    let done = 0;
    for (let i = 0; i < toCheck.length; i += CONCURRENCY) {
        const batch = toCheck.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(p => healOne(p.zpid, p)));
        results.forEach(r => console.log(`  ${r}`));
        done += batch.length;
        console.log(`  [${done}/${toCheck.length}]\n`);
    }

    console.log('Done. Re-run diagCity.js or smoke test to verify.\n');
    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
