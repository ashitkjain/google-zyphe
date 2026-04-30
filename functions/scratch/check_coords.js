const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();
    const missing = snap.docs.filter(d => {
        const p = d.data();
        return !p.latitude || !p.longitude;
    }).map(d => ({ zpid: d.id, ...d.data() }));

    console.log(`Missing coordinates: ${missing.length} / ${snap.size}`);
    for (const p of missing.slice(0, 10)) {
        const keys = Object.keys(p).filter(k => /lat|lng|lon|coord|geo/i.test(k));
        console.log(`  ${p.zpid} homeType=${p.homeType} yearBuilt=${p.yearBuilt} lat=${p.latitude} lng=${p.longitude}`);
        console.log(`    geo-related keys: ${keys.join(', ') || 'NONE'}`);
        console.log(`    address: ${p.streetAddress || p.address || '?'}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
