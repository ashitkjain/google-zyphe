/**
 * Land Utility / Slope Analysis Test — TWO-STEP + IMPROVED DEPTH
 * 
 * Fixes: Gemini retry on 503, fuzzy address matching, lot-size-based fallback depth
 *
 * Run with: npx tsx tests/landUtility.test.ts
 */

import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, memoryLocalCache, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: 'AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI',
    authDomain: 'zyphe-af0bf.firebaseapp.com',
    projectId: 'zyphe-af0bf',
    storageBucket: 'zyphe-af0bf.firebasestorage.app',
    messagingSenderId: '434538487700',
    appId: '1:434538487700:web:2d0880addbfdca71c13981',
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = initializeFirestore(app, { localCache: memoryLocalCache() });

const GEMINI_API_KEY = 'AIzaSyDurfAUpqimcv87c4sc5E4KRDGM1OLSj7g';
const GOOGLE_MAPS_KEY = 'AIzaSyCQ-OcGRDMK8nGmCMzpuxHT0Y9vJgqajRI';
const MODEL = 'gemini-3.1-pro-preview';

const DEG_LAT_PER_FT = 1 / 364000;
const DEG_LON_PER_FT = 1 / 288000;

const COMPASS = [
    { name: 'N', dLat: 1, dLon: 0 },
    { name: 'NE', dLat: 0.707, dLon: 0.707 },
    { name: 'E', dLat: 0, dLon: 1 },
    { name: 'SE', dLat: -0.707, dLon: 0.707 },
    { name: 'S', dLat: -1, dLon: 0 },
    { name: 'SW', dLat: -0.707, dLon: -0.707 },
    { name: 'W', dLat: 0, dLon: -1 },
    { name: 'NW', dLat: 0.707, dLon: -0.707 },
];

const TEST_PROPERTIES = [
    // Old = previous Gemini function-calling method results from initial test runs
    { address: '3280 Ohlone Way, Fairview, CA 94541', refDelta: 60, refSlope: 33.3, refCat: 'Heavy', refDepth: 180, oldDelta: 60, oldSlope: 33.3, oldCat: 'Heavy', oldNote: 'Gemini+FnCall' },
    { address: '22555 Northview Dr, Hayward, CA 94541', refDelta: 34, refSlope: 30.9, refCat: 'Heavy', refDepth: 110, oldDelta: 34, oldSlope: 30.9, oldCat: 'Heavy', oldNote: 'Gemini+FnCall' },
    { address: '2936 Pickford Way, Hayward, CA 94541', refDelta: 18, refSlope: 12.8, refCat: 'Moderate', refDepth: 140, oldDelta: 18, oldSlope: 12.8, oldCat: 'Moderate', oldNote: 'Gemini+FnCall' },
    { address: '27449 Dobbel Ave, Hayward, CA 94542', refDelta: 16, refSlope: 7.0, refCat: 'Gentle', refDepth: 231, oldDelta: 16, oldSlope: 7.0, oldCat: 'Gentle', oldNote: 'Gemini+FnCall' },
    { address: '27030 Parkside Dr, Hayward, CA 94542', refDelta: 40, refSlope: 32.0, refCat: 'Heavy', refDepth: 125, oldDelta: 40, oldSlope: 32.0, oldCat: 'Heavy', oldNote: 'Gemini+FnCall' },
];

// ─── Elevation API ────────────────────────────────────────────────────────────

async function getElevation(lat: number, lon: number): Promise<{ ft: number; source: string } | null> {
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 4000);
        const r = await fetch(`https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet`, { signal: c.signal });
        clearTimeout(t);
        const d = await r.json();
        const v = d?.value;
        if (v !== undefined && v !== null && v !== -1000000) return { ft: typeof v === 'string' ? parseFloat(v) : v, source: 'USGS' };
    } catch { }
    try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lon}&key=${GOOGLE_MAPS_KEY}`);
        const d = await r.json();
        if (d.status === 'OK' && d.results?.[0]) return { ft: d.results[0].elevation * 3.28084, source: 'GOOG' };
    } catch { }
    return null;
}

// ─── Two-Step Slope ───────────────────────────────────────────────────────────

interface SlopeResult {
    address: string;
    lotDepth: number;
    frontElev: number;
    rearElev: number;
    uphillDir: string;
    elevDelta: number;
    slopePercent: number;
    category: string;
    source: string;
}

async function measureSlope(address: string, lat: number, lon: number, depth: number): Promise<SlopeResult> {
    // STEP 1: Scout 8 directions at 100ft to find uphill direction
    const scoutAt = async (radius: number) => Promise.all(
        COMPASS.map(async d => {
            const e = await getElevation(lat + d.dLat * radius * DEG_LAT_PER_FT, lon + d.dLon * radius * DEG_LON_PER_FT);
            return { ...d, elev: e?.ft ?? 0 };
        })
    );

    let scouts = await scoutAt(100);
    const maxElev = Math.max(...scouts.map(s => s.elev));
    const minElev = Math.min(...scouts.map(s => s.elev));
    const scoutVariance = maxElev - minElev;

    console.log(`   Scout@100ft: ${scouts.map(s => `${s.name}=${s.elev.toFixed(0)}`).join(', ')} (Δ${scoutVariance.toFixed(0)}ft)`);

    // ADAPTIVE: If terrain appears flat at 100ft (<15ft variance), the pin may
    // be on a ridge/plateau. Re-scout at depth/2 to capture boundary slopes.
    if (scoutVariance < 15 && depth > 100) {
        const wideRadius = Math.round(depth / 2);
        console.log(`   ⚡ Flat at 100ft — re-scouting at ${wideRadius}ft to find boundary slopes...`);
        const wideScouts = await scoutAt(wideRadius);
        const wideVariance = Math.max(...wideScouts.map(s => s.elev)) - Math.min(...wideScouts.map(s => s.elev));
        console.log(`   Scout@${wideRadius}ft: ${wideScouts.map(s => `${s.name}=${s.elev.toFixed(0)}`).join(', ')} (Δ${wideVariance.toFixed(0)}ft)`);
        if (wideVariance > scoutVariance) {
            scouts = wideScouts;
        }
    }

    const uphill = scouts.reduce((a, b) => a.elev > b.elev ? a : b);

    // STEP 2: Measure front (half_depth DOWNHILL from pin) → rear (half_depth UPHILL from pin)
    const halfD = depth / 2;
    const frontLat = lat - uphill.dLat * halfD * DEG_LAT_PER_FT;
    const frontLon = lon - uphill.dLon * halfD * DEG_LON_PER_FT;
    const rearLat = lat + uphill.dLat * halfD * DEG_LAT_PER_FT;
    const rearLon = lon + uphill.dLon * halfD * DEG_LON_PER_FT;

    const [front, rear] = await Promise.all([
        getElevation(frontLat, frontLon),
        getElevation(rearLat, rearLon),
    ]);

    const fFt = front?.ft ?? 0, rFt = rear?.ft ?? 0;
    const delta = Math.abs(rFt - fFt);
    const slope = (delta / depth) * 100;

    const cat = slope < 5 ? 'Flat' : slope <= 15 ? 'Moderate' : slope <= 30 ? 'Steep' : 'Heavy';

    console.log(`   Front(${halfD}ft ↙): ${fFt.toFixed(0)}ft → Rear(${halfD}ft ↗${uphill.name}): ${rFt.toFixed(0)}ft → Δ${delta.toFixed(0)}ft / ${depth}ft = ${slope.toFixed(1)}% ${cat}`);

    return {
        address, lotDepth: depth,
        frontElev: fFt, rearElev: rFt, uphillDir: uphill.name,
        elevDelta: delta, slopePercent: Math.round(slope * 10) / 10, category: cat,
        source: [front?.source, rear?.source].includes('GOOG') ? 'MIXED' : 'USGS',
    };
}

// ─── Firestore Lookup ─────────────────────────────────────────────────────────

async function findCoords(address: string): Promise<{ lat: number; lon: number } | null> {
    const needle = address.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    for (const coll of ['properties', 'sold_or_unlisted_properties']) {
        const snap = await getDocs(collection(db, coll));
        for (const d of snap.docs) {
            const data = d.data();
            const docAddr = (data.address || data.formattedAddress || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (docAddr.includes(needle) || needle.includes(docAddr.slice(0, 20))) {
                const lat = data.coordinates?.latitude || data.latitude;
                const lon = data.coordinates?.longitude || data.longitude;
                if (lat && lon) return { lat, lon };
            }
        }
    }
    return null;
}

// ─── Gemini with Retry ────────────────────────────────────────────────────────

async function geminiWithRetry(ai: any, config: any, maxRetries = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await (ai.models as any).generateContent(config);
            return typeof result.text === 'function' ? result.text() : result.text;
        } catch (e: any) {
            if (e.status === 503 && attempt < maxRetries) {
                console.log(`   ⚠️ Gemini 503, retrying (${attempt}/${maxRetries})...`);
                await new Promise(r => setTimeout(r, 2000 * attempt));
                continue;
            }
            throw e;
        }
    }
    throw new Error('Gemini failed after retries');
}

// ─── Fuzzy Address Match ──────────────────────────────────────────────────────

function extractStreet(addr: string): string {
    // Extract street name without number: "3280 Ohlone Way, Fairview, CA" → "ohloneway"
    const parts = addr.split(',')[0].trim().split(/\s+/);
    return parts.slice(1).join('').toLowerCase().replace(/[^a-z]/g, '');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTest() {
    console.log('━'.repeat(100));
    console.log('  LAND UTILITY — TWO-STEP SLOPE + IMPROVED DEPTH');
    console.log(`  Model: ${MODEL}`);
    console.log('  Scout: 8 dir × 100ft | Measure: pin→rear | Gemini: lot depth (with retry)');
    console.log('━'.repeat(100));

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' } });

    // ═══ STEP 1: Firestore coords ═══
    console.log('\n═══ STEP 1: Firestore coordinates ═══\n');
    const props: { address: string; lat: number; lon: number; refDepth: number }[] = [];
    for (const tp of TEST_PROPERTIES) {
        const c = await findCoords(tp.address);
        if (c) {
            console.log(`  ✅ ${tp.address}: (${c.lat}, ${c.lon})`);
            props.push({ address: tp.address, lat: c.lat, lon: c.lon, refDepth: tp.refDepth });
        } else {
            console.log(`  ❌ ${tp.address}: NOT FOUND`);
        }
    }

    // ═══ STEP 2: Gemini → lot depth (with retry) ═══
    console.log('\n═══ STEP 2: Gemini → lot depth (with retry) ═══\n');

    const addrList = props.map(p => `- ${p.address}`).join('\n');
    const prompt = `Find the LOT DEPTH for each property below.

LOT DEPTH = the distance from the STREET (front) to the REAR BOUNDARY (back), measured in FEET.
This is NOT the lot frontage width. Depth is typically the LONGER dimension.

Properties:
${addrList}

INSTRUCTIONS:
1. Search Zillow, Redfin, or county assessor for each property to find lot size and dimensions.
2. If lot dimensions are given as "WxD" (e.g., "60x150"), the DEPTH is the larger number (150ft).
3. If only lot SIZE (sqft) is available, calculate: depth = lot_size / frontage_width
   - Standard frontage: 60-80ft for regular lots, 80-120ft for large hillside lots
   - 6,000 sqft lot → depth ≈ 6000/60 = 100ft
   - 36,000 sqft lot → depth ≈ 36000/100 = 360ft
   - 67,000 sqft lot → depth ≈ 67000/150 = 447ft
4. CONSTRAINT: Lot depth is ALWAYS 80-600ft for residential. Never return under 80.

Return ONLY valid JSON:
{
  "parcels": [
    { "address": "string", "lot_depth_ft": number, "lot_size_sqft": number, "zoning": "string" }
  ]
}`;

    let geminiText: string;
    try {
        geminiText = await geminiWithRetry(ai, {
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: 'Find lot DEPTH (front-to-rear, 80-600ft). Search Zillow, assessor records. Return JSON only.',
                tools: [{ googleSearch: {} }],
                maxOutputTokens: 2048,
            },
        });
    } catch (e: any) {
        console.log(`  ❌ Gemini failed: ${e.message}`);
        geminiText = '{}';
    }

    // Parse with fuzzy matching
    let parcels: any[];
    try { parcels = JSON.parse(geminiText).parcels || []; } catch {
        const m = geminiText.match(/\{[\s\S]*\}/);
        parcels = m ? (JSON.parse(m[0]).parcels || []) : [];
    }

    // Build depth map with fuzzy address matching
    const depthMap = new Map<string, number>();
    for (const p of parcels) {
        const key = extractStreet(p.address || '');
        const depth = (p.lot_depth_ft && p.lot_depth_ft >= 80) ? p.lot_depth_ft : null;
        if (key && depth) depthMap.set(key, depth);
        console.log(`  Gemini: ${p.address}: depth=${p.lot_depth_ft}ft, lot=${p.lot_size_sqft}sqft, zone=${p.zoning}`);
    }

    // ═══ STEP 3: Two-step slope measurement ═══
    console.log('\n═══ STEP 3: Slope measurement ═══\n');
    const results: (SlopeResult & { refDepth: number })[] = [];

    for (const prop of props) {
        const street = extractStreet(prop.address);
        let depth = depthMap.get(street) || 150;
        if (depth < 80) depth = 150;

        console.log(`📍 ${prop.address}`);
        console.log(`   Depth: ${depth}ft (Gemini) | Ref: ${prop.refDepth}ft`);

        const r = await measureSlope(prop.address, prop.lat, prop.lon, depth);
        results.push({ ...r, refDepth: prop.refDepth });

        // Also compute what the slope would be at reference depth
        if (depth !== prop.refDepth) {
            const refSlope = (r.elevDelta / prop.refDepth) * 100;
            console.log(`   @ ref depth (${prop.refDepth}ft): ${refSlope.toFixed(1)}%`);
        }
        console.log();
    }

    // ═══ STEP 4: Run OLD Gemini approach for comparison ═══
    console.log('\n═══ STEP 4: OLD METHOD — Gemini (front/rear coords + slope) ═══\n');

    const oldPrompt = `For each property below, determine the uphill direction, then find:
1. Front coordinate (street-side, lower elevation)
2. Rear coordinate (back boundary, higher elevation) 
3. Get elevation at both points using USGS National Map
4. Calculate slope % = (elevation_difference / lot_depth) × 100

Properties:
${props.map(p => `- ${p.address} (lat: ${p.lat}, lon: ${p.lon})`).join('\n')}

For each property, use Google Maps terrain view to determine uphill direction, find the lot depth from assessor data, and calculate slope from front to rear elevation difference.

Return JSON:
{
  "properties": [
    {
      "address": "string",
      "front_elev_ft": number, "rear_elev_ft": number,
      "lot_depth_ft": number, "elevation_delta_ft": number,
      "slope_percent": number, "slope_category": "Flat|Moderate|Steep|Heavy",
      "uphill_direction": "string"
    }
  ]
}`;

    let oldResults: any[] = [];
    try {
        const oldText = await geminiWithRetry(ai, {
            model: MODEL,
            contents: [{ role: 'user', parts: [{ text: oldPrompt }] }],
            config: {
                systemInstruction: 'You are a topographer. For each property, determine uphill direction, find front/rear elevations, and calculate slope. Use USGS or Google Maps elevation data. Return JSON only.',
                tools: [{ googleSearch: {} }],
                maxOutputTokens: 4096,
            },
        });

        try { oldResults = JSON.parse(oldText).properties || []; } catch {
            const m = oldText.match(/\{[\s\S]*\}/);
            oldResults = m ? (JSON.parse(m[0]).properties || []) : [];
        }

        for (const o of oldResults) {
            console.log(`  ${o.address}: Δ${o.elevation_delta_ft}ft / ${o.lot_depth_ft}ft = ${o.slope_percent}% ${o.slope_category} (dir: ${o.uphill_direction})`);
        }
    } catch (e: any) {
        console.log(`  ❌ Old method failed: ${e.message}`);
    }

    // ═══ 3-WAY COMPARISON TABLE ═══
    console.log('\n' + '━'.repeat(130));
    console.log('  3-WAY COMPARISON: Reference (Gemini Chat) vs Old Prompt (Gemini) vs New Method (Adaptive Scout + USGS)');
    console.log('━'.repeat(130));
    console.log();
    console.log(
        'Property'.padEnd(18) +
        '│ REFERENCE (Chat)'.padEnd(28) +
        '│ OLD PROMPT (Gemini)'.padEnd(28) +
        '│ NEW (Scout+USGS)'.padEnd(28) +
        '│ Closest'
    );
    console.log('─'.repeat(130));

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const tp = TEST_PROPERTIES[i];
        const name = r.address.split(',')[0].replace(/^\d+\s+/, '');

        // Find old result for this property
        const oldR = oldResults.find((o: any) => {
            const n = name.toLowerCase().replace(/\s/g, '');
            const oa = (o.address || '').toLowerCase().replace(/[^a-z]/g, '');
            return oa.includes(n) || n.includes(oa.slice(0, 10));
        });

        const refStr = `Δ${tp.refDelta}ft ${tp.refSlope}% ${tp.refCat}`;
        const oldStr = oldR
            ? `Δ${Math.round(oldR.elevation_delta_ft)}ft ${Number(oldR.slope_percent).toFixed(1)}% ${oldR.slope_category}`
            : '(failed)';
        const newStr = `Δ${Math.round(r.elevDelta)}ft ${r.slopePercent.toFixed(1)}% ${r.category}`;

        // Which method is closer to reference slope?
        const oldDiff = oldR ? Math.abs(Number(oldR.slope_percent) - tp.refSlope) : 999;
        const newDiff = Math.abs(r.slopePercent - tp.refSlope);
        const winner = oldDiff < newDiff ? '← Old' : newDiff < oldDiff ? 'New →' : 'Tie';

        console.log(
            name.slice(0, 17).padEnd(18) +
            '│ ' + refStr.padEnd(26) +
            '│ ' + oldStr.padEnd(26) +
            '│ ' + newStr.padEnd(26) +
            '│ ' + winner
        );
    }
    console.log('─'.repeat(130));

    // ═══ SCORECARD ═══
    let oldWins = 0, newWins = 0;
    for (let i = 0; i < results.length; i++) {
        const tp = TEST_PROPERTIES[i];
        const r = results[i];
        const oldR = oldResults.find((o: any) => {
            const n = r.address.split(',')[0].replace(/^\d+\s+/, '').toLowerCase().replace(/\s/g, '');
            return (o.address || '').toLowerCase().replace(/[^a-z]/g, '').includes(n);
        });
        const oldDiff = oldR ? Math.abs(Number(oldR.slope_percent) - tp.refSlope) : 999;
        const newDiff = Math.abs(r.slopePercent - tp.refSlope);
        if (oldDiff < newDiff) oldWins++;
        else if (newDiff < oldDiff) newWins++;
    }

    console.log('\n  SCORECARD:');
    console.log(`    Old Prompt wins: ${oldWins}/5`);
    console.log(`    New Method wins: ${newWins}/5`);
    console.log();
    console.log('  KEY DIFFERENCES:');
    console.log('    Old: Gemini picks coords + elevations (non-deterministic, varies each run)');
    console.log('    New: USGS LiDAR data + adaptive scout (deterministic, same every run)');

    process.exit(0);
}

runTest().catch(e => { console.error(e); process.exit(1); });
