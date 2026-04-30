const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function main() {
    const snap = await db.collection('properties').where('city', '==', 'Dublin').get();
    const missing = snap.docs.filter(d => {
        const p = d.data();
        return [p.floodRiskScore, p.fireRiskScore, p.heatRiskScore, p.windRiskScore].filter(v => v != null).length === 0;
    }).map(d => d.data());

    // Check yearBuilt distribution
    const yearCounts = {};
    const homeTypeCounts = {};
    for (const p of missing) {
        const y = p.yearBuilt ?? 'unknown';
        yearCounts[y] = (yearCounts[y] || 0) + 1;
        const h = p.homeType ?? 'unknown';
        homeTypeCounts[h] = (homeTypeCounts[h] || 0) + 1;
    }
    console.log('yearBuilt distribution among 49 missing:');
    Object.entries(yearCounts).sort((a,b) => b[1]-a[1]).forEach(([y,c]) => console.log(`  ${y}: ${c}`));
    console.log('\nhomeType distribution:');
    Object.entries(homeTypeCounts).sort((a,b) => b[1]-a[1]).forEach(([h,c]) => console.log(`  ${h}: ${c}`));
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
