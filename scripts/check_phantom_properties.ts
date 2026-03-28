
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function checkPhantomProperties() {
    console.log('--- Checking for phantom property documents (only have subcollections) ---');
    
    // listDocuments returns all refs, including those without data but having subcollections
    const refs = await db.collection('properties').listDocuments();
    console.log(`Checking ${refs.length} property references...`);

    let phantomCount = 0;
    for (const ref of refs) {
        const snap = await ref.get();
        if (!snap.exists()) {
            // Document reference exists in the list (likely due to subcollections) but snap.exists() is FALSE
            console.log(`  PHANTOM: ${ref.id} (exists as path but no data)`);
            phantomCount++;
        }
    }

    console.log(`--- Total Phantom Properties: ${phantomCount} / ${refs.length} ---`);
}

checkPhantomProperties()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Check failed:', err);
        process.exit(1);
    });
