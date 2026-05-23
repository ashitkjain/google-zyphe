import { APP_CONFIG } from '../config';

async function test() {
    // Dynamically import apiKeyLoader to patch process.env with Firestore keys if needed
    try {
        const { loadApiKeys } = await import('../services/apiKeyLoader');
        await loadApiKeys();
    } catch (e) {
        console.warn("Could not load Firestore keys, using process.env directly");
    }

    const config = APP_CONFIG.usHousingApi;
    const address = "2466 Armstrong Pl, Santa Clara, CA 95050";
    const url = `https://${config.host}/property?address=${encodeURIComponent(address)}`;
    console.log("Calling URL:", url);
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'x-rapidapi-host': config.host,
            'x-rapidapi-key': config.key
        }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data sample:", JSON.stringify(data).slice(0, 1000));
}

test().catch(console.error);
