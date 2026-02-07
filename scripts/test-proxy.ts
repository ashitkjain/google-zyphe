import { db, auth, functions } from '../services/firebase/config';
import { httpsCallable } from 'firebase/functions';
import { APP_CONFIG } from '../config';

async function testStreetViewProxy() {
    console.log("--- Testing Street View Proxy Function ---");

    if (!functions) {
        console.error("Firebase Functions not initialized.");
        return;
    }

    // Use a sample coordinates for Pleasanton, CA (from the user's previous context)
    const lat = 37.6624;
    const lon = -121.8747;
    const MAPS_API_KEY = APP_CONFIG.maps.key;

    const testUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lon}&fov=90&heading=0&pitch=0&key=${MAPS_API_KEY}`;

    console.log(`URL to fetch: ${testUrl.split('&key=')[0]}...`);

    try {
        const proxyFunc = httpsCallable(functions, 'proxyStreetViewImage');
        console.log("Calling 'proxyStreetViewImage' via Cloud Functions...");

        // Note: This requires the user to be logged in if the function has 'context.auth' check
        // If running via CLI, we might need to sign in first.

        const result = await proxyFunc({ url: testUrl });
        const data = result.data as any;

        if (data.base64 && data.mimeType) {
            console.log("✅ Success!");
            console.log(`MimeType: ${data.mimeType}`);
            console.log(`Base64 length: ${data.base64.length}`);
            console.log(`Preview (first 50 chars): ${data.base64.substring(0, 50)}...`);
        } else {
            console.error("❌ Failed: Unexpected response structure", data);
        }
    } catch (error: any) {
        console.error("❌ Error calling proxy function:", error.message);
        if (error.message.includes("unauthenticated")) {
            console.warn("TIP: Please make sure you are logged into the app or use a test account with the Firebase CLI.");
        }
    }
}

// Run the test
testStreetViewProxy();

export { testStreetViewProxy };
