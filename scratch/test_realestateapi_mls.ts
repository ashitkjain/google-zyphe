/**
 * Probe MLSDetail response structure.
 * Run: npx tsx scratch/test_realestateapi_mls.ts
 */

const KEY  = 'ZYPHE-7657-c4a7-bbdf-c649ea8b4b1c';
const BASE = 'https://api.realestateapi.com/v2';
const ADDRESS = '6235 Roslin Ct, Pleasanton, CA 94588';

async function post(endpoint: string, body: Record<string, any>) {
    const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    return { status: res.status, json };
}

async function main() {
    const { status, json } = await post('/MLSDetail', { address: ADDRESS });
    console.log('status:', status);
    const data = Array.isArray(json.data) ? json.data[0] : json.data;
    if (!data) { console.log('no data:', JSON.stringify(json)); return; }

    // Print each top-level field
    for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'object' && v !== null) {
            console.log(`\n[${k}]`, JSON.stringify(v, null, 2).slice(0, 800));
        } else {
            console.log(`${k}:`, v);
        }
    }
}

main().catch(console.error);
