const admin = require('firebase-admin');
const serviceAccount = require('/Users/ashitjain/colorado/zyphe/google-zyphe/serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
    // Fetch Pleasanton properties with aerial_only_mode that are UNCLEAR
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
                images: p.images ? p.images.slice(0, 5) : [],
                imageCount: (p.images || []).length,
                orientation: ai.final_orientation,
                confidence: ai.confidence,
                explanation: (ai.explanation || '').slice(0, 200),
            });
        }
    });

    console.log(`Found ${aerialOnly.length} aerial-only UNCLEAR Pleasanton properties`);
    aerialOnly.slice(0, 8).forEach(p => {
        console.log(`\n---`);
        console.log(`ZPID: ${p.zpid}`);
        console.log(`Address: ${p.address}`);
        console.log(`Images: ${p.imageCount} total`);
        if (p.images.length > 0) {
            console.log(`First 3 images:`);
            p.images.forEach((img, i) => console.log(`  [${i}] ${img}`));
        }
        console.log(`Explanation: ${p.explanation}...`);
    });

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
