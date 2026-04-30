const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    for (const zpid of ['79533474', '25064628']) {
        const snap = await db.collection('properties').doc(zpid).get();
        const p = snap.data() || {};
        console.log(`\n══ ${zpid} (${p.address || '?'}) ══`);
        console.log(`  coordinates: ${JSON.stringify(p.coordinates)}`);
        console.log(`  address: ${p.address}`);
        console.log(`  state: ${p.state}, city: ${p.city}`);
        console.log(`  mapZoomIn: ${p.mapZoomIn ? 'present' : 'null'}`);
        console.log(`  mapZoomOut: ${p.mapZoomOut ? 'present' : 'null'}`);
        console.log(`  streetView: ${p.streetView ? 'present' : 'null'}`);
        console.log(`  satelliteImageUrl: ${p.satelliteImageUrl ? 'present' : 'null'}`);
        console.log(`  updatedAt: ${p.updatedAt?.toDate?.()}`);
        console.log(`  latitude/longitude (flat): ${p.latitude} / ${p.longitude}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
