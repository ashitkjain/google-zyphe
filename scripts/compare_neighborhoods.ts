
import admin from 'firebase-admin';
import fetch from 'node-fetch';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

// ── Pleasanton bounding box (S, W, N, E) ──
const BBOX = '37.59,−121.97,37.73,−121.80';
// Overpass QL format: (south,west,north,east)
const OVERPASS_BBOX = '37.59,-121.97,37.73,-121.80';

async function getFirestoreNeighborhoods(): Promise<{ name: string; tier: string; alternatives: string[] }[]> {
    const ref = db.doc('cities/pleasanton_ca/index/neighborhoods');
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No Firestore neighborhoods found!');
    return snap.data()!.neighborhoods.map((n: any) => ({
        name: n.neighborhood_name as string,
        tier: n.price_context?.tier || 'Unknown',
        alternatives: n.alternative_names || []
    }));
}

async function getOSMNeighborhoods(): Promise<string[]> {
    // Query Overpass API for all named places tagged as neighbourhood/suburb/residential in Pleasanton
    const query = `
[out:json][timeout:30];
(
  node["place"~"neighbourhood|suburb|quarter"]["name"](${OVERPASS_BBOX});
  way["place"~"neighbourhood|suburb|quarter"]["name"](${OVERPASS_BBOX});
  relation["place"~"neighbourhood|suburb|quarter"]["name"](${OVERPASS_BBOX});
  node["landuse"="residential"]["name"](${OVERPASS_BBOX});
  way["landuse"="residential"]["name"](${OVERPASS_BBOX});
);
out body;
    `.trim();

    const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!res.ok) throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
    const data: any = await res.json();

    const names = new Set<string>();
    for (const el of data.elements || []) {
        const name = el.tags?.name;
        if (name) names.add(name);
    }
    return Array.from(names).sort();
}

// Also query Mapbox Streets v8 via the public vector tile for Pleasanton center
// Tile z=12 contains the 'place_label' layer which has neighborhood polygons
async function getMapboxNeighborhoods(): Promise<string[]> {
    // Pleasanton is at roughly tile 12/668/1583 (z/x/y)
    // We'll use Radar's public key to access Mapbox tiles
    const RADAR_KEY = 'prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb';
    
    // Radar geocoding: search for neighborhoods near Pleasanton center
    const center = { lat: 37.6624, lng: -121.8747 };
    
    const names = new Set<string>();
    
    // Use Radar's Places API — it returns neighborhood-level data
    const radarUrl = `https://api.radar.io/v1/geocode/reverse?coordinates=${center.lat},${center.lng}&layers=neighborhood`;
    const radarRes = await fetch(radarUrl, {
        headers: { 'Authorization': RADAR_KEY }
    });

    if (radarRes.ok) {
        const radarData: any = await radarRes.json();
        const addresses = radarData.addresses || [];
        for (const addr of addresses) {
            if (addr.neighborhood) names.add(addr.neighborhood);
        }
    }
    
    return Array.from(names).sort();
}

// Direct Nominatim search — search for specific neighborhood names across the city
async function getNominatimNeighborhoods(): Promise<string[]> {
    const names = new Set<string>();
    
    // Search grid of points across Pleasanton
    const points = [
        { lat: 37.6624, lng: -121.8747 }, // center
        { lat: 37.680, lng: -121.880 },   // north
        { lat: 37.645, lng: -121.860 },   // south
        { lat: 37.665, lng: -121.900 },   // west
        { lat: 37.665, lng: -121.845 },   // east
        { lat: 37.700, lng: -121.895 },   // NW - Hacienda area
        { lat: 37.630, lng: -121.870 },   // SW - Vineyard
        { lat: 37.650, lng: -121.890 },   // W - Stoneridge
        { lat: 37.675, lng: -121.860 },   // NE - Birdland area
        { lat: 37.690, lng: -121.870 },   // N - Fairlands
        { lat: 37.655, lng: -121.845 },   // SE - Kottinger
        { lat: 37.637, lng: -121.900 },   // far SW - Vineyard
        { lat: 37.710, lng: -121.870 },   // far N  
        { lat: 37.660, lng: -121.920 },   // W - Ruby Hill area
        { lat: 37.640, lng: -121.930 },   // far W - Vineyard/Livermore border
        { lat: 37.670, lng: -121.840 },   // far E
    ];

    for (const pt of points) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${pt.lat}&lon=${pt.lng}&zoom=14&addressdetails=1&format=json`;
            const res = await fetch(url, { headers: { 'User-Agent': 'ZypheApp/1.0 (neighborhood-comparison)' } });
            if (!res.ok) continue;
            const data: any = await res.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || '';
            if (!city.toLowerCase().includes('pleasanton')) continue;
            const name = addr.neighbourhood || addr.suburb;
            if (name) names.add(name);
        } catch {}
        await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
    }

    return Array.from(names).sort();
}

async function main() {
    console.log('Fetching data from 3 sources in parallel where possible...\n');

    // Run Firestore + OSM in parallel (OSM is one fast bulk query, no rate limit)
    const [firestoreRaw, osmNames] = await Promise.all([
        getFirestoreNeighborhoods(),
        getOSMNeighborhoods().catch(err => {
            console.warn('OSM Overpass failed:', err.message);
            return [] as string[];
        })
    ]);

    console.log('═══ FIRESTORE (Gemini-mined list) ═══');
    console.log(`${firestoreRaw.length} neighborhoods:`);
    firestoreRaw.forEach(n => console.log(`  [${n.tier.padEnd(18)}] ${n.name}${n.alternatives.length ? ` (aka: ${n.alternatives.join(', ')})` : ''}`));

    console.log('\n═══ OSM/OpenStreetMap (Mapbox-equivalent data) ═══');
    console.log(`${osmNames.length} neighborhoods from Overpass API:`);
    osmNames.forEach(n => console.log(`  • ${n}`));

    // Sequential Nominatim spot-check
    console.log('\n═══ Nominatim spot-checks (16 key points) ═══');
    const nominatimNames = await getNominatimNeighborhoods();
    console.log(`${nominatimNames.length} unique neighborhoods from Nominatim:`);
    nominatimNames.forEach(n => console.log(`  • ${n}`));

    // ── Merge OSM sources ──
    const allMapboxNames = Array.from(new Set([...osmNames, ...nominatimNames])).sort();
    console.log(`\n═══ COMBINED MAPBOX-EQUIVALENT (OSM + Nominatim): ${allMapboxNames.length} ═══`);
    allMapboxNames.forEach(n => console.log(`  • ${n}`));

    // ── COMPARISON ──
    const firestoreNames = firestoreRaw.map(n => n.name);
    const firestoreSet = new Set(firestoreNames.map(n => n.toLowerCase().trim()));
    const mapboxSet = new Set(allMapboxNames.map(n => n.toLowerCase().trim()));

    // Also check alternative names
    const firestoreAliasSet = new Set<string>();
    firestoreRaw.forEach(n => {
        firestoreAliasSet.add(n.name.toLowerCase().trim());
        n.alternatives.forEach(a => firestoreAliasSet.add(a.toLowerCase().trim()));
    });

    const inFirestoreOnly = firestoreNames.filter(n => !mapboxSet.has(n.toLowerCase().trim()));
    const inMapboxOnly = allMapboxNames.filter(n => !firestoreAliasSet.has(n.toLowerCase().trim()));
    const inBoth = firestoreNames.filter(n => mapboxSet.has(n.toLowerCase().trim()));

    console.log(`\n${'═'.repeat(55)}`);
    console.log('COMPARISON RESULTS');
    console.log(`${'═'.repeat(55)}`);

    console.log(`\n✅  MATCHING (${inBoth.length}) — confirmed in both:`);
    inBoth.forEach(n => console.log(`    ✓ ${n}`));

    console.log(`\n🟡  IN FIRESTORE ONLY (${inFirestoreOnly.length}) — Gemini found, Mapbox/OSM missed:`);
    inFirestoreOnly.forEach(n => {
        const entry = firestoreRaw.find(e => e.name === n)!;
        console.log(`    + ${n} [${entry.tier}]`);
    });

    console.log(`\n🔴  IN MAPBOX ONLY (${inMapboxOnly.length}) — OSM/Mapbox found, Gemini missed:`);
    inMapboxOnly.forEach(n => console.log(`    - ${n}`));

    console.log(`\n${'─'.repeat(55)}`);
    console.log(`SUMMARY`);
    console.log(`  Firestore/Gemini:    ${firestoreNames.length} neighborhoods`);
    console.log(`  Mapbox/OSM:          ${allMapboxNames.length} neighborhoods`);
    console.log(`  Matched:             ${inBoth.length}`);
    console.log(`  Missing from Gemini: ${inMapboxOnly.length}`);
    console.log(`  Missing from Mapbox: ${inFirestoreOnly.length}`);
    console.log(`${'─'.repeat(55)}`);

    process.exit(0);
}

main().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
});
