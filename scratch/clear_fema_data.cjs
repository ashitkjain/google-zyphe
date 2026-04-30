
const admin = require('firebase-admin');

// Initialize Firebase Admin
// Note: This assumes you have the GOOGLE_APPLICATION_CREDENTIALS env var set 
// or you are running in an environment with default credentials.
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf' 
    });
}

const db = admin.firestore();

async function clearFemaData() {
    console.log('🚀 Starting FEMA NRI data cleanup...');
    
    const propertiesRef = db.collection('properties');
    const snapshot = await propertiesRef.get();
    
    console.log(`Found ${snapshot.size} properties. Processing...`);
    
    let count = 0;
    const batchSize = 400;
    let batch = db.batch();

    for (const doc of snapshot.docs) {
        const zpid = doc.id;
        
        // 1. Remove legacy FEMA data from root document
        batch.update(doc.ref, {
            'historical_disasters.femaRiskIndex': admin.firestore.FieldValue.delete()
        });

        // 2. Delete the new dedicated FEMA NRI document
        // Path: properties/{zpid}/environmental/fema_nri
        const nriDocRef = doc.ref.collection('environmental').doc('fema_nri');
        batch.delete(nriDocRef);

        count++;

        if (count % batchSize === 0) {
            await batch.commit();
            batch = db.batch();
            console.log(`Processed ${count} properties...`);
        }
    }

    if (count % batchSize !== 0) {
        await batch.commit();
    }

    console.log(`✅ Cleanup complete. Total properties processed: ${count}`);
    console.log('FEMA NRI data has been cleared from root docs and dedicated documents.');
    console.log('RapidAPI climate scores (floodRiskScore, etc.) were preserved.');
}

clearFemaData().catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
});
