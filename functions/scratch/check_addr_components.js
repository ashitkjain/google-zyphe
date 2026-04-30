const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').limit(10).get();
    for (const doc of snap.docs) {
        const p = doc.data();
        // What RapidAPI components do we already have?
        const reconstructed = [p.streetAddress, p.city, p.state, p.zipCode].filter(Boolean).join(', ');
        console.log(`stored address:    ${p.address}`);
        console.log(`from components:   ${reconstructed || '—'}`);
        console.log(`streetAddress key: ${p.streetAddress ?? '—'}`);
        console.log();
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
