
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { _processOneIntel } = require('./intelBatch'); // We'll need to export this or wrap it

// Mock environment for testing
async function runTest(zpid) {
    console.log(`[Test] Starting Visual Analysis test for ${zpid}...`);
    
    if (!admin.apps.length) {
        admin.initializeApp({
            storageBucket: 'zyphe-af0bf.firebasestorage.app'
        });
    }
    
    const db = admin.firestore();
    
    // Fetch API Keys
    const keysSnap = await db.collection('app_config').doc('api_keys').get();
    const keys = keysSnap.exists ? keysSnap.data() : {};
    const apiKey = keys.gemini_key;
    
    if (!apiKey) {
        throw new Error("Missing Gemini API Key in Firestore app_config/api_keys");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Trigger the actual processing logic (forcing a refresh)
    const result = await _processOneIntel(zpid, db, genAI, true);
    
    console.log("[Test] Result:", JSON.stringify(result, null, 2));
    
    if (result.status === 'success') {
        console.log("[Test] ✅ SUCCESS: Visual analysis completed and saved.");
    } else {
        console.log("[Test] ❌ FAILURE:", result.message);
    }
}

const zpid = process.argv[2] || '461622240';
runTest(zpid).catch(console.error);
