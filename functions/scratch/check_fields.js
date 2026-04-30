const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const zpids = ['456273155', '64965169', '460689246', '452028262', '25063936', '458164922', '153093781', '456932661', '448162105', '457088887'];

async function main() {
    for (const zpid of zpids) {
        const propSnap = await db.collection('properties').doc(zpid).get();
        const prop = propSnap.data() || {};
        const visualSnap = await db.collection('properties').doc(zpid).collection('analysis').doc('visual').get();
        const visual = visualSnap.data() || {};
        const riso = prop?.resoFacts || {};
        const neighborhoodInsights = visual?.exterior_and_neighborhood?.neighborhood_street_insights;

        const climate = [prop.floodRiskScore, prop.fireRiskScore, prop.heatRiskScore, prop.windRiskScore];
        const climatePresent = climate.filter(v => v != null).length;

        console.log(`\n── ${zpid} (${prop.city || '?'}) ──`);
        console.log(`  Climate: flood=${prop.floodRiskScore??'–'} fire=${prop.fireRiskScore??'–'} heat=${prop.heatRiskScore??'–'} wind=${prop.windRiskScore??'–'} [${climatePresent}/4]`);
        console.log(`  RESO interiorFeatures: ${riso.interiorFeatures != null ? JSON.stringify(riso.interiorFeatures).slice(0,80) : 'MISSING'}`);
        console.log(`  RESO electric:         ${riso.electric != null ? JSON.stringify(riso.electric).slice(0,80) : 'MISSING'}`);
        console.log(`  AI Neighborhood:       ${neighborhoodInsights ? `${neighborhoodInsights.length} chars` : 'MISSING'}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
