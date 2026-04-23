const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties')
        .where('city', '==', 'Pleasanton')
        .get();

    const aerialOnly = [];
    snap.docs.forEach(d => {
        const p = d.data();
        if (p.deprecated) return;
        const ai = p.orientation_ai;
        if (!ai) return;
        if (ai.aerial_only_mode === true && ai.final_orientation === 'UNCLEAR') {
            aerialOnly.push({
                zpid: d.id,
                address: p.address,
                images: (p.images || []).slice(0, 6),
                imageCount: (p.images || []).length,
                explanation: (ai.explanation || '').slice(0, 300),
            });
        }
    });

    console.log(`Found ${aerialOnly.length} aerial-only UNCLEAR in Pleasanton`);
    aerialOnly.slice(0, 6).forEach(p => {
        console.log(`\n--- ZPID: ${p.zpid}`);
        console.log(`Address: ${p.address}`);
        console.log(`Images: ${p.imageCount} total`);
        p.images.forEach((img, i) => console.log(`  [${i}] ${img}`));
        console.log(`Explanation: ${p.explanation}`);
    });

    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
