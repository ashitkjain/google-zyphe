const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    for (const zpid of ['79533474', '25064628']) {
        const snap = await db.collection('properties').doc(zpid).get();
        const p = snap.data() || {};
        const visualSnap = await db.collection('properties').doc(zpid).collection('analysis').doc('visual').get();
        const visual = visualSnap.data() || {};
        const neighborhoodInsights = visual?.exterior_and_neighborhood?.neighborhood_street_insights;

        console.log(`\n══ ${zpid} ══`);
        console.log(`  address:      ${p.address}`);
        console.log(`  coordinates:  ${JSON.stringify(p.coordinates)}`);
        console.log(`  state/city:   ${p.state} / ${p.city}`);
        console.log(`  mapZoomIn:    ${p.mapZoomIn ? '✓' : '✗ missing'}`);
        console.log(`  mapZoomOut:   ${p.mapZoomOut ? '✓' : '✗ missing'}`);
        console.log(`  streetView:   ${p.streetView ? '✓' : '✗ missing'}`);
        console.log(`  satellite:    ${p.satelliteImageUrl ? '✓' : '✗ missing'}`);
        console.log(`  neighborhood: ${neighborhoodInsights ? `✓ (${neighborhoodInsights.length} chars)` : '✗ missing'}`);
        console.log(`  orientation:  ${p.orientation_ai?.final_orientation ?? '?'} (conf: ${p.orientation_ai?.confidence ?? '?'})`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
