const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();

    // Find properties with a real address (not zpid) to compare formats
    const sample = snap.docs
        .filter(d => {
            const p = d.data();
            return p.address && p.address !== p.zpid && typeof p.address === 'string';
        })
        .slice(0, 15);

    console.log(`Comparing address fields on ${sample.length} properties:\n`);
    for (const doc of sample) {
        const p = doc.data();
        // All address-like fields RapidAPI might have stored
        console.log(`${doc.id}`);
        console.log(`  address (Radar formatted):  ${p.address}`);
        console.log(`  streetAddress:              ${p.streetAddress ?? '—'}`);
        console.log(`  formattedAddress:           ${p.formattedAddress ?? '—'}`);
        // Check if they differ
        const radarAddr = p.address || '';
        const rapidAddr = p.streetAddress || p.formattedAddress || '';
        const differ = rapidAddr && radarAddr.toLowerCase() !== rapidAddr.toLowerCase();
        if (differ) console.log(`  *** DIFFER ***`);
        console.log();
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
