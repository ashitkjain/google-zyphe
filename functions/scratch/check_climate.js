const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    // Get all Dublin properties
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();
    const missing = snap.docs
        .filter(d => {
            const p = d.data();
            return [p.floodRiskScore, p.fireRiskScore, p.heatRiskScore, p.windRiskScore].filter(v => v != null).length === 0;
        })
        .map(d => ({ zpid: d.id, ...d.data() }));

    console.log(`Total Dublin properties: ${snap.size}`);
    console.log(`Missing all climate scores: ${missing.length}`);
    console.log('\nSampling 10:');

    const sample = missing.slice(0, 10);
    for (const p of sample) {
        // Check what raw RapidAPI fields exist related to climate/risk
        const keys = Object.keys(p).filter(k => /flood|fire|heat|wind|risk|climate|fema|hazard/i.test(k));
        console.log(`\n  ${p.zpid} (${p.address || p.streetAddress || '?'})`);
        console.log(`    Risk-related keys on doc: ${keys.length > 0 ? keys.join(', ') : 'NONE'}`);
        console.log(`    homeType: ${p.homeType}, yearBuilt: ${p.yearBuilt}, price: ${p.price}`);
        console.log(`    lastUpdated: ${p.lastUpdated?.toDate?.() ?? p.lastUpdated ?? '?'}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
