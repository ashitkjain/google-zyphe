const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();
    const missing = snap.docs.filter(d => {
        const p = d.data();
        return [p.floodRiskScore, p.fireRiskScore, p.heatRiskScore, p.windRiskScore].filter(v => v != null).length === 0;
    });

    console.log(`Missing all climate scores: ${missing.length} / ${snap.size}`);

    // Show actual values for sample of 10
    for (const doc of missing.slice(0, 10)) {
        const p = doc.data();
        console.log(`\n  ${doc.id} yearBuilt=${p.yearBuilt} homeType=${p.homeType}`);
        console.log(`    flood=${JSON.stringify(p.floodRiskScore)}  fire=${JSON.stringify(p.fireRiskScore)}  heat=${JSON.stringify(p.heatRiskScore)}  wind=${JSON.stringify(p.windRiskScore)}`);
        // Also check if there's a raw rapidapi snapshot or resoFacts that might hold risk data
        const resoKeys = Object.keys(p.resoFacts || {}).filter(k => /flood|fire|risk|climate/i.test(k));
        if (resoKeys.length) console.log(`    resoFacts risk keys: ${resoKeys.join(', ')}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
