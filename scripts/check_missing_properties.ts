
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function checkMissingProperties() {
    console.log('--- Checking if any deprecated distressed property lacks a main property doc ---');
    
    const snapshot = await db.collection('deprecated_distressed_properties').get();
    console.log(`Checking ${snapshot.size} deprecated distressed properties...`);

    let missingCount = 0;
    for (const d of snapshot.docs) {
        const zpid = d.id;
        const propSnap = await db.collection('properties').doc(zpid).get();
        if (!propSnap.exists()) {
            console.log(`  ZPID ${zpid} is in deprecated_distressed_properties but NOT in properties.`);
            missingCount++;
        }
    }

    console.log(`--- Total Missing: ${missingCount} / ${snapshot.size} ---`);
}

checkMissingProperties()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Check failed:', err);
        process.exit(1);
    });
