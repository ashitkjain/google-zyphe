const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();
    let missingCoords = 0, nullLatLng = 0, hasCoords = 0;

    for (const doc of snap.docs) {
        const p = doc.data();
        const c = p.coordinates;
        if (!c) { missingCoords++; continue; }
        if (c.latitude == null || c.longitude == null) { nullLatLng++; continue; }
        hasCoords++;
    }
    console.log(`Total: ${snap.size}`);
    console.log(`coordinates field missing entirely: ${missingCoords}`);
    console.log(`coordinates exists but lat/lng null: ${nullLatLng}`);
    console.log(`coordinates.latitude + longitude present: ${hasCoords}`);

    // Sample the ones with missing/null coords
    const bad = snap.docs.filter(d => {
        const c = d.data().coordinates;
        return !c || c.latitude == null;
    }).slice(0, 5);
    for (const doc of bad) {
        const p = doc.data();
        console.log(`\n  ${doc.id}: coordinates=${JSON.stringify(p.coordinates)}`);
        console.log(`    address: ${p.streetAddress || p.address || '?'}, homeType: ${p.homeType}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
