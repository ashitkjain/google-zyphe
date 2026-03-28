
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function checkOrphansViaGroups() {
    console.log('--- Checking for orphaned analyses using CollectionGroup query ---');
    
    // Check 'visual' analysis documents in any subcollection named 'analysis'
    const snapshot = await db.collectionGroup('analysis').get();
    console.log(`Found ${snapshot.size} analysis documents across all properties.`);

    let orphans = 0;
    for (const d of snapshot.docs) {
        if (d.id !== 'visual') continue; // Only check visual for now

        const zpid = d.ref.parent.parent?.id;
        if (!zpid) continue;

        const propSnap = await db.collection('properties').doc(zpid).get();
        if (!propSnap.exists) {
            console.log(`  ORPHANED ANALYSIS: ZPID ${zpid} has visual analysis but NO properties document data.`);
            orphans++;
        }
    }

    console.log(`--- Total Orphans: ${orphans} / ${snapshot.size} ---`);
}

checkOrphansViaGroups()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Check failed:', err);
        process.exit(1);
    });
