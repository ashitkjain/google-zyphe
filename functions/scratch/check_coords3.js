const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();
    const bad = snap.docs.filter(d => d.data().coordinates === null).map(d => ({ zpid: d.id, ...d.data() }));
    console.log(`coordinates=null: ${bad.length}`);

    // Check status distribution
    const statusCounts = {};
    const addressMissing = bad.filter(p => !p.streetAddress && !p.address || p.address === p.zpid || p.streetAddress === p.zpid).length;
    for (const p of bad) {
        const s = p.propertyStatus || p.homeStatus || p.status || 'unknown';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    console.log('Status distribution:', statusCounts);
    console.log(`Properties with no real address (just zpid): ${addressMissing}`);

    // Sample a few with real addresses vs no address
    const withAddr = bad.filter(p => p.streetAddress && p.streetAddress !== p.zpid).slice(0, 3);
    const noAddr = bad.filter(p => !p.streetAddress || p.streetAddress === p.zpid).slice(0, 3);
    console.log('\nWith real addresses:');
    withAddr.forEach(p => console.log(`  ${p.zpid}: ${p.streetAddress}, status=${p.homeStatus||p.status}, lastUpdated=${p.lastUpdated?.toDate?.()}`));
    console.log('\nNo real address:');
    noAddr.forEach(p => console.log(`  ${p.zpid}: addr=${p.address||p.streetAddress}, status=${p.homeStatus||p.status}, lastUpdated=${p.lastUpdated?.toDate?.()}`));
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
