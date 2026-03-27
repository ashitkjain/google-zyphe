
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function deleteCollection(path: string) {
    console.log(`Deleting collection: ${path}...`);
    const collectionRef = db.collection(path);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
        console.log(`  Collection ${path} is already empty.`);
        return;
    }

    console.log(`  Purging ${snapshot.size} documents...`);
    const batchSize = 100;
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = snapshot.docs.slice(i, i + batchSize);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    console.log(`  Purged ${path}.`);
}

async function cleanupUserData() {
    log('--- CLEANUP START: Top-Level User-Scoped Collections ---');

    await deleteCollection('user_preferences');
    await deleteCollection('user_property_comment');
    await deleteCollection('user_activity');

    log('--- CLEANUP COMPLETE ---');
}

const log = (msg: string) => console.log(`[CLEANUP] ${msg}`);

cleanupUserData()
    .then(() => {
        console.log('Success.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Cleanup failed:', err);
        process.exit(1);
    });
