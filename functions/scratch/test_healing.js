const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'zyphe-af0bf'
    });
}

const db = admin.firestore();
const { _enrichEnvironmentalData } = require('../shared/propertyUtils');

async function testHealing() {
    const zpid = "53050869"; // 5345 W Chesterfield Cir
    console.log(`\n--- Testing Healing Logic for ${zpid} ---`);

    // 1. Fetch API Keys from Firestore
    const keysSnap = await db.collection('app_config').doc('api_keys').get();
    const keys = keysSnap.exists ? keysSnap.data() : {};
    const apiKeys = {
        rapidapi_key: keys.rapidapi_key || process.env.RAPIDAPI_KEY,
        rapidapi_host: keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com',
        radar_key: keys.radar_key || process.env.RADAR_KEY,
        google_maps_key: keys.google_maps_key || process.env.MAPS_API_KEY,
        howloud_key: keys.howloud_key || process.env.HOWLOUD_KEY
    };

    // 2. Get property coordinates
    const propSnap = await db.collection('properties').doc(zpid).get();
    if (!propSnap.exists) {
        console.error("Property not found in Firestore. Please ensure it exists.");
        process.exit(1);
    }
    const propData = propSnap.data();
    const lat = propData.coordinates?.latitude;
    const lng = propData.coordinates?.longitude;

    console.log(`Target: ${propData.address}`);
    console.log(`Coords: ${lat}, ${lng}`);

    // 3. Clear existing data to force healing
    await db.collection('properties').doc(zpid).update({
        walkScore: admin.firestore.FieldValue.delete(),
        transitScore: admin.firestore.FieldValue.delete(),
        parcelPolygon: admin.firestore.FieldValue.delete(),
        satelliteImageUrl: admin.firestore.FieldValue.delete()
    });
    console.log("Cleared existing scores/parcel for testing.");

    // 4. Run Enrichment
    console.log("\nRunning _enrichEnvironmentalData...");
    try {
        const results = await _enrichEnvironmentalData(zpid, db, apiKeys, lat, lng);
        console.log("\n--- Enrichment Results ---");
        console.log(JSON.stringify(results, null, 2));

        if (results.__healed) {
            console.log("\n--- Healing Stats ---");
            console.log(`Scores Healed: ${results.__healed.scores}`);
            console.log(`Parcel Healed: ${results.__healed.parcel}`);
            console.log(`Satellite Healed: ${results.__healed.satellite}`);
        }

        // 5. Verify Firestore Main Doc
        const finalSnap = await db.collection('properties').doc(zpid).get();
        const finalData = finalSnap.data();

        console.log("\n--- Firestore Verification ---");
        console.log(`Walk Score: ${finalData.walkScore}`);
        console.log(`Transit Score: ${finalData.transitScore}`);
        console.log(`Parcel Polygon: ${finalData.parcelPolygon ? 'Present ✅' : 'MISSING ❌'}`);
        console.log(`Satellite URL: ${finalData.satelliteImageUrl ? 'Present ✅' : 'MISSING ❌'}`);

    } catch (e) {
        console.error("\n❌ Enrichment Failed:", e);
    }

    process.exit(0);
}

testHealing();
