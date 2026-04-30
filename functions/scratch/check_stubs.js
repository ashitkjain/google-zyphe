const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();
    const stubs = snap.docs.filter(d => d.data().coordinates === null).slice(0, 3);

    for (const doc of stubs) {
        const p = doc.data();
        // Print ALL fields to see what came from RapidAPI
        console.log(`\n══ ${doc.id} ══`);
        const keys = Object.keys(p).sort();
        for (const k of keys) {
            const v = p[k];
            if (v === null || v === undefined) {
                console.log(`  ${k}: null`);
            } else if (typeof v === 'object' && !v.toDate) {
                console.log(`  ${k}: ${JSON.stringify(v).slice(0, 120)}`);
            } else {
                console.log(`  ${k}: ${v?.toDate?.() ?? v}`);
            }
        }
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
