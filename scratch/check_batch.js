
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkBatch(jobId) {
    const snap = await db.collection('full_intel_batch_jobs').doc(jobId).get();
    if (!snap.exists) {
        console.log('Job not found');
        return;
    }
    console.log(JSON.stringify(snap.data(), null, 2));
}

checkBatch('intel_batch_1777243411320');
