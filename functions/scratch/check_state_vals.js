const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').limit(50).get();
    const stateCounts = {};
    for (const doc of snap.docs) {
        const s = doc.data().state ?? 'MISSING';
        stateCounts[s] = (stateCounts[s] || 0) + 1;
    }
    console.log('state field values across 50 Dublin properties:');
    Object.entries(stateCounts).sort((a,b) => b[1]-a[1]).forEach(([s,c]) => console.log(`  "${s}": ${c}`));
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
