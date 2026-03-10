#!/usr/bin/env npx tsx
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  POI Distance Validation — Database Google Places vs Gemini BBox        ║
 * ║                                                                         ║
 * ║  Property: 4251 Lucero Ct, Pleasanton, CA 94588                         ║
 * ║                                                                         ║
 * ║  This script:                                                           ║
 * ║   1. Reads cached Google Places data from Firebase (google_env_data)   ║
 * ║   2. Runs Gemini bounding-box POI extraction on the Radar map           ║
 * ║   3. Fuzzy-matches overlapping POIs between the two sources             ║
 * ║   4. Compares Haversine vs pixel-calculated distances                   ║
 * ║                                                                         ║
 * ║  Run: npx tsx scripts/validate-poi-from-db.ts                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ─── Firebase SDK (same config as the app) ────────────────────────────────────
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { getPoiBoundingBoxPrompt, poiBoundingBoxSchema } from '../prompts/property/poiBoundingBox';
import { mapWidthInMeters, enrichPoisWithDistance } from '../utils/poiDistance';

// ─── Config ───────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI',
    authDomain: 'zyphe-af0bf.firebaseapp.com',
    projectId: 'zyphe-af0bf',
    storageBucket: 'zyphe-af0bf.firebasestorage.app',
    messagingSenderId: '434538487700',
    appId: '1:434538487700:web:2d0880addbfdca71c13981',
};

const GEMINI_API_KEY = 'AIzaSyCNXiqET26-cMRpoM9vttl13SfiA4ifQu4';
const RADAR_API_KEY = 'prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb';

const PROPERTY_ADDRESS = '4251 Lucero Ct, Pleasanton, CA 94588';
const PROPERTY_LAT = 37.6614;
const PROPERTY_LNG = -121.8753;
const ZOOM = 15;
const IMAGE_WIDTH = 1024;
const SCALE = 1;

// ─── Step 1: Find Property in Firebase & Get Cached Places ────────────────────

interface DbPlace {
    name: string;
    rating?: number;
    distanceMeters?: number;
    types?: string[];
    primaryTypeDisplayName?: string;
    source?: string;
}

interface DbNeighborhoodPlaces {
    walkable?: Record<string, DbPlace[]>;
    drivable?: Record<string, DbPlace[]>;
    [key: string]: any;
}

async function fetchGooglePlacesFromDb(): Promise<{ zpid: string; places: DbPlace[] }> {
    console.log('\n🗄️  Step 1: Finding property in Firebase...');

    const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();
    const db = getFirestore(app);

    // Search for property by address
    const q = query(
        collection(db, 'properties'),
        where('address', '==', PROPERTY_ADDRESS),
    );
    const snap = await getDocs(q);

    let zpid: string | null = null;

    if (snap.empty) {
        // Try partial match — search by city
        console.log('   ⚠️  Exact address not found, searching by city Pleasanton...');
        const cityQ = query(
            collection(db, 'properties'),
            where('city', '==', 'Pleasanton'),
        );
        const citySnap = await getDocs(cityQ);

        for (const d of citySnap.docs) {
            const addr = (d.data().address || '').toLowerCase();
            if (addr.includes('lucero')) {
                zpid = d.id;
                console.log(`   🔍 Found via city search: ZPID=${zpid}, address="${d.data().address}"`);
                break;
            }
        }

        if (!zpid) {
            // Last resort: list all Pleasanton properties for the user
            console.log('\n   Available Pleasanton properties in DB:');
            citySnap.docs.forEach((d) => {
                console.log(`     • ZPID: ${d.id.padEnd(15)} | ${d.data().address}`);
            });
            throw new Error('Could not find 4251 Lucero Ct in Firebase. Check the ZPIDs above.');
        }
    } else {
        zpid = snap.docs[0].id;
        console.log(`   ✅ Found property: ZPID=${zpid}`);
    }

    // Fetch the google_environmental_data doc which contains neighborhoodPlaces
    console.log(`   📡 Fetching google_environmental_data for ZPID ${zpid}...`);
    const envDocRef = doc(db, 'google_environmental_data', zpid);
    const envDocSnap = await getDoc(envDocRef);

    if (!envDocSnap.exists()) {
        throw new Error(`No google_environmental_data found for ZPID ${zpid}`);
    }

    const envData = envDocSnap.data();
    const raw: DbNeighborhoodPlaces = envData.neighborhoodPlaces;

    if (!raw) {
        throw new Error(`No neighborhoodPlaces cached for ZPID ${zpid}`);
    }

    // Flatten all places from walkable + drivable + top-level categories
    const allPlaces: DbPlace[] = [];
    const seen = new Set<string>();

    const addFrom = (source: Record<string, any>, label: string) => {
        const CATEGORIES = ['dining', 'shopping', 'parks', 'transit', 'fitness', 'schools', 'medical', 'community', 'others'];
        for (const cat of CATEGORIES) {
            const list = source[cat];
            if (Array.isArray(list)) {
                for (const p of list) {
                    const key = (p.name || '').toLowerCase().trim();
                    if (key && !seen.has(key)) {
                        seen.add(key);
                        allPlaces.push({
                            name: p.name,
                            rating: p.rating,
                            distanceMeters: p.distanceMeters,
                            types: p.types,
                            primaryTypeDisplayName: p.primaryTypeDisplayName,
                            source: label,
                        });
                    }
                }
            }
        }
    };

    // Pull from walkable/drivable sub-objects and top-level categories
    if (raw.walkable && typeof raw.walkable === 'object') addFrom(raw.walkable, 'walkable');
    if (raw.drivable && typeof raw.drivable === 'object') addFrom(raw.drivable, 'drivable');
    addFrom(raw, 'top-level');

    console.log(`   ✅ Loaded ${allPlaces.length} unique cached Google Places from Firebase`);
    return { zpid, places: allPlaces };
}

// ─── Step 2: Gemini Bounding Box Extraction ───────────────────────────────────

interface EnrichedPoi {
    name: string;
    category: string;
    distanceMeters: number;
    distanceMiles: number;
    pixelDistance: number;
    center: { x: number; y: number };
    bounding_box: { ymin: number; xmin: number; ymax: number; xmax: number };
    highlights?: string;
}

async function fetchGeminiPois(): Promise<EnrichedPoi[]> {
    console.log('\n🤖 Step 2: Running Gemini bounding-box extraction...');

    const radarUrl =
        `https://api.radar.io/maps/static` +
        `?publishableKey=${RADAR_API_KEY}` +
        `&center=${PROPERTY_LAT},${PROPERTY_LNG}` +
        `&zoom=${ZOOM}&width=${IMAGE_WIDTH}&height=${IMAGE_WIDTH}` +
        `&style=radar-default-v1&scale=${SCALE}` +
        `&markers=color:0x000257%7C${PROPERTY_LAT},${PROPERTY_LNG}`;

    const imgRes = await fetch(radarUrl);
    if (!imgRes.ok) throw new Error(`Radar: ${imgRes.status}`);
    const imgBuf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuf).toString('base64');
    const mimeType = imgRes.headers.get('content-type') || 'image/png';
    console.log(`   📡 Map fetched: ${(imgBuf.byteLength / 1024).toFixed(1)} KB`);

    const ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
    });

    const prompt = getPoiBoundingBoxPrompt(PROPERTY_ADDRESS);
    const start = Date.now();

    const result = await (ai.models as any).generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ parts: [{ text: prompt }, { inlineData: { data: base64, mimeType } }] }],
        config: { responseMimeType: 'application/json', responseSchema: poiBoundingBoxSchema },
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const text = typeof result.text === 'function' ? result.text() : result.text;
    const raw = JSON.parse(text);
    const tokens = result.usageMetadata || {};
    console.log(`   ✅ Gemini responded in ${elapsed}s (${tokens.totalTokenCount || '?'} tokens)`);

    const mapWidth = mapWidthInMeters(ZOOM, PROPERTY_LAT, IMAGE_WIDTH, SCALE);
    const cx = raw.property_center?.x ?? 500;
    const cy = raw.property_center?.y ?? 500;
    const enriched = enrichPoisWithDistance(raw.pois || [], mapWidth, cx, cy);
    console.log(`   📌 Extracted ${enriched.length} POIs from map`);
    return enriched as EnrichedPoi[];
}

// ─── Step 3: Fuzzy Match ──────────────────────────────────────────────────────

interface Match {
    googleName: string;
    geminiName: string;
    googleDist: number;
    geminiDist: number;
    diffMeters: number;
    diffPercent: number;
    matchScore: number;
    googleSource: string;
    geminiCategory: string;
}

function fuzzyScore(a: string, b: string): number {
    const an = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const bn = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (an === bn) return 1.0;
    if (an.includes(bn) || bn.includes(an)) return 0.85;

    const aWords = an.split(/\s+/).filter(w => w.length > 1);
    const bWords = bn.split(/\s+/).filter(w => w.length > 1);

    // Check if any significant word (4+ chars) from one appears in the other string
    const sigOverlap = aWords.some(w => w.length >= 4 && bn.includes(w)) ||
        bWords.some(w => w.length >= 4 && an.includes(w));
    if (sigOverlap) return 0.7;

    // Jaccard on meaningful words (>2 chars)
    const aSet = new Set(aWords.filter(w => w.length > 2));
    const bSet = new Set(bWords.filter(w => w.length > 2));
    const inter = [...aSet].filter(w => bSet.has(w));
    const union = new Set([...aSet, ...bSet]);
    const jaccard = union.size > 0 ? inter.length / union.size : 0;

    // First word bonus
    const firstMatch = aWords[0] && bWords[0] && aWords[0] === bWords[0] ? 0.25 : 0;
    return Math.min(1, jaccard + firstMatch);
}

function matchPois(dbPlaces: DbPlace[], geminiPois: EnrichedPoi[]): Match[] {
    const THRESHOLD = 0.35;
    const matches: Match[] = [];
    const usedGemini = new Set<number>();

    for (const gp of dbPlaces) {
        let best = 0;
        let bestIdx = -1;
        for (let i = 0; i < geminiPois.length; i++) {
            if (usedGemini.has(i)) continue;
            const s = fuzzyScore(gp.name, geminiPois[i].name);
            if (s > best) { best = s; bestIdx = i; }
        }

        if (bestIdx >= 0 && best >= THRESHOLD) {
            usedGemini.add(bestIdx);
            const gm = geminiPois[bestIdx];
            const gDist = Math.round(gp.distanceMeters || 0);
            const diff = Math.abs(gDist - gm.distanceMeters);
            const pct = gDist > 0 ? (diff / gDist) * 100 : 0;

            matches.push({
                googleName: gp.name,
                geminiName: gm.name,
                googleDist: gDist,
                geminiDist: gm.distanceMeters,
                diffMeters: Math.round(diff),
                diffPercent: parseFloat(pct.toFixed(1)),
                matchScore: parseFloat(best.toFixed(2)),
                googleSource: gp.source || 'unknown',
                geminiCategory: gm.category,
            });
        }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);
    return matches;
}

// ─── Step 4: Report ───────────────────────────────────────────────────────────

function printReport(matches: Match[], dbPlaces: DbPlace[], geminiPois: EnrichedPoi[]) {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log('  VALIDATION REPORT — Cached Google Places (DB) vs Gemini Bounding Box');
    console.log(`  Property: ${PROPERTY_ADDRESS}`);
    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════\n');

    if (matches.length === 0) {
        console.log('  ⚠️  No overlapping POIs found between the two sources.\n');
        printAllNames(dbPlaces, geminiPois);
        return;
    }

    // ─── Table ──────────────────────────────────────────────────────────────
    const hdr = [
        '#'.padStart(3),
        'Google Name (DB)'.padEnd(32),
        'Gemini Name (Map)'.padEnd(32),
        'G.Dist(m)'.padStart(10),
        'AI Dist(m)'.padStart(10),
        'Diff(m)'.padStart(8),
        'Diff%'.padStart(7),
        'Score'.padStart(6),
        'Rating'.padStart(10),
    ].join(' │ ');

    console.log(`  ${hdr}`);
    console.log(`  ${'─'.repeat(hdr.length)}`);

    matches.forEach((m, i) => {
        const rating =
            m.diffPercent <= 20 ? '✅ Great'
                : m.diffPercent <= 40 ? '🟡 OK'
                    : m.diffPercent <= 60 ? '🟠 Fair'
                        : '🔴 Poor';

        const row = [
            String(i + 1).padStart(3),
            m.googleName.substring(0, 32).padEnd(32),
            m.geminiName.substring(0, 32).padEnd(32),
            String(m.googleDist).padStart(10),
            String(m.geminiDist).padStart(10),
            String(m.diffMeters).padStart(8),
            `${m.diffPercent}%`.padStart(7),
            String(m.matchScore).padStart(6),
            rating.padStart(10),
        ].join(' │ ');

        console.log(`  ${row}`);
    });

    // ─── Stats ──────────────────────────────────────────────────────────────
    const diffs = matches.map(m => m.diffPercent);
    const absDiffs = matches.map(m => m.diffMeters);
    const avg = Math.round(absDiffs.reduce((a, b) => a + b, 0) / absDiffs.length);
    const avgPct = (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1);
    const sorted = [...absDiffs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const within20 = matches.filter(m => m.diffPercent <= 20).length;
    const within40 = matches.filter(m => m.diffPercent <= 40).length;

    console.log('\n');
    console.log('  ┌───────────────────────────────────────────────');
    console.log('  │  📊 ACCURACY SUMMARY');
    console.log('  ├───────────────────────────────────────────────');
    console.log(`  │  Overlapping POIs:    ${matches.length} / ${dbPlaces.length} DB, ${geminiPois.length} Gemini`);
    console.log(`  │  Avg difference:      ${avg} m  (${avgPct}%)`);
    console.log(`  │  Median difference:   ${median} m`);
    console.log(`  │  Within 20% (Great):  ${within20}/${matches.length} (${((within20 / matches.length) * 100).toFixed(0)}%)`);
    console.log(`  │  Within 40% (OK):     ${within40}/${matches.length} (${((within40 / matches.length) * 100).toFixed(0)}%)`);
    console.log('  └───────────────────────────────────────────────');

    printAllNames(dbPlaces, geminiPois);
}

function printAllNames(dbPlaces: DbPlace[], geminiPois: EnrichedPoi[]) {
    // ─── Full side-by-side name listing ─────────────────────────────────────
    console.log('\n');
    console.log('  ┌─── ALL NAMES — Sorted by Distance (for manual verification) ───');
    console.log('  │');
    console.log(`  │  ${'GOOGLE PLACES (from DB)'.padEnd(50)} ${'GEMINI EXTRACTED (from map)'.padEnd(50)}`);
    console.log(`  │  ${'─'.repeat(50)} ${'─'.repeat(50)}`);

    const sortedDb = [...dbPlaces].sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
    const sortedAi = [...geminiPois].sort((a, b) => a.distanceMeters - b.distanceMeters);
    const maxLen = Math.max(sortedDb.length, sortedAi.length);

    for (let i = 0; i < maxLen; i++) {
        const left = sortedDb[i]
            ? `${sortedDb[i].name.substring(0, 38).padEnd(38)} ${Math.round(sortedDb[i].distanceMeters || 0).toString().padStart(6)}m  (${sortedDb[i].source || ''})`
            : '';
        const right = sortedAi[i]
            ? `${sortedAi[i].name.substring(0, 38).padEnd(38)} ${sortedAi[i].distanceMeters.toString().padStart(6)}m  (${sortedAi[i].category})`
            : '';
        console.log(`  │  ${left.padEnd(50)} ${right.padEnd(50)}`);
    }
    console.log('  └──────────────────────────────────────────────────────────────────');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  POI Distance Validation — DB → Gemini');
    console.log(`  Property: ${PROPERTY_ADDRESS}`);
    console.log('═══════════════════════════════════════════════════════════════');

    // Run both in parallel
    const [dbResult, geminiPois] = await Promise.all([
        fetchGooglePlacesFromDb(),
        fetchGeminiPois(),
    ]);

    console.log(`\n🔗 Step 3: Fuzzy-matching overlapping POIs (threshold: 0.35)...`);
    const matches = matchPois(dbResult.places, geminiPois);
    console.log(`   Found ${matches.length} overlapping POIs`);

    printReport(matches, dbResult.places, geminiPois);

    console.log('\n✅ Validation complete.');
}

main().catch((err) => {
    console.error('\n❌ Failed:', err.message || err);
    process.exit(1);
});
