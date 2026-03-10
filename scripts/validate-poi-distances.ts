#!/usr/bin/env npx tsx
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║   POI Distance Validation — Google Places vs Gemini Bounding Box       ║
 * ║                                                                         ║
 * ║   Property: 4251 Lucero Ct, Pleasanton, CA 94588                        ║
 * ║                                                                         ║
 * ║   This script:                                                          ║
 * ║    1. Fetches POIs from Google Places API (ground truth distances)      ║
 * ║    2. Fetches POIs from Gemini bounding-box extraction                  ║
 * ║    3. Fuzzy-matches common POIs between both sources                    ║
 * ║    4. Compares Haversine distance vs pixel-calculated distance          ║
 * ║    5. Prints a validation report with accuracy metrics                  ║
 * ║                                                                         ║
 * ║   Run: npx tsx scripts/validate-poi-distances.ts                        ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { GoogleGenAI } from '@google/genai';
import { getPoiBoundingBoxPrompt, poiBoundingBoxSchema } from '../prompts/property/poiBoundingBox';
import { mapWidthInMeters, enrichPoisWithDistance } from '../utils/poiDistance';

// ─── Configuration ────────────────────────────────────────────────────────────

const GEMINI_API_KEY = 'AIzaSyCNXiqET26-cMRpoM9vttl13SfiA4ifQu4';
const RADAR_API_KEY = 'prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb';
const MAPS_API_KEY = 'AIzaSyCQ-OcGRDMK8nGmCMzpuxHT0Y9vJgqajRI';

const PROPERTY = {
    address: '4251 Lucero Ct, Pleasanton, CA 94588',
    lat: 37.6614,
    lng: -121.8753,
};

const ZOOM = 15;
const IMAGE_WIDTH = 1024;
const SCALE = 1;

// ─── Haversine (same formula as places.ts) ────────────────────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ─── Step 1: Google Places API ────────────────────────────────────────────────

interface GooglePlace {
    name: string;
    types: string[];
    rating?: number;
    distanceMeters: number;
    location: { latitude: number; longitude: number };
    googleMapsUri?: string;
}

async function fetchGooglePlaces(): Promise<GooglePlace[]> {
    console.log('\n🔍 Step 1: Fetching POIs from Google Places API...');
    const PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby';
    const FIELD_MASK =
        'places.displayName,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName,places.location';

    // Fetch both walkable and drivable in parallel (same queries as production)
    const [walkRes, driveRes] = await Promise.all([
        fetch(PLACES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': MAPS_API_KEY,
                'X-Goog-FieldMask': FIELD_MASK,
            },
            body: JSON.stringify({
                includedTypes: [
                    'cafe', 'bakery', 'restaurant', 'park', 'playground',
                    'hiking_area', 'school', 'primary_school', 'library',
                    'gym', 'grocery_store', 'bank',
                ],
                maxResultCount: 20,
                locationRestriction: {
                    circle: { center: { latitude: PROPERTY.lat, longitude: PROPERTY.lng }, radius: 5000.0 },
                },
                rankPreference: 'DISTANCE',
            }),
        }).catch(() => null),
        fetch(PLACES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': MAPS_API_KEY,
                'X-Goog-FieldMask': FIELD_MASK,
            },
            body: JSON.stringify({
                includedTypes: [
                    'supermarket', 'shopping_mall', 'hospital', 'police',
                    'fire_station', 'transit_station', 'pharmacy',
                ],
                maxResultCount: 20,
                locationRestriction: {
                    circle: { center: { latitude: PROPERTY.lat, longitude: PROPERTY.lng }, radius: 5000.0 },
                },
            }),
        }).catch(() => null),
    ]);

    const processRes = async (res: Response | null): Promise<GooglePlace[]> => {
        if (!res || !res.ok) {
            console.log(`   ⚠️  Places API response: ${res?.status || 'null'}`);
            return [];
        }
        const data = await res.json();
        return (data.places || []).map((p: any) => ({
            name: p.displayName?.text || 'Unknown',
            types: p.types || [],
            rating: p.rating,
            location: p.location,
            googleMapsUri: p.googleMapsUri,
            distanceMeters: p.location
                ? haversineDistance(PROPERTY.lat, PROPERTY.lng, p.location.latitude, p.location.longitude)
                : 0,
        }));
    };

    const walkPlaces = await processRes(walkRes);
    const drivePlaces = await processRes(driveRes);

    // Deduplicate by name
    const seen = new Set<string>();
    const all: GooglePlace[] = [];
    for (const p of [...walkPlaces, ...drivePlaces]) {
        const key = p.name.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            all.push(p);
        }
    }

    console.log(`   ✅ Google Places returned ${all.length} unique POIs (${walkPlaces.length} walk + ${drivePlaces.length} drive, deduplicated)`);
    return all;
}

// ─── Step 2: Gemini Bounding Box Extraction ───────────────────────────────────

interface GeminiPoi {
    name: string;
    category: string;
    distanceMeters: number;
    distanceMiles: number;
    pixelDistance: number;
    center: { x: number; y: number };
    bounding_box: { ymin: number; xmin: number; ymax: number; xmax: number };
    highlights?: string;
}

async function fetchGeminiPois(): Promise<GeminiPoi[]> {
    console.log('\n🤖 Step 2: Fetching POIs from Gemini bounding-box extraction...');

    // 2a. Get the Radar map
    const radarUrl =
        `https://api.radar.io/maps/static` +
        `?publishableKey=${RADAR_API_KEY}` +
        `&center=${PROPERTY.lat},${PROPERTY.lng}` +
        `&zoom=${ZOOM}` +
        `&width=${IMAGE_WIDTH}` +
        `&height=${IMAGE_WIDTH}` +
        `&style=radar-default-v1` +
        `&scale=${SCALE}` +
        `&markers=color:0x000257%7C${PROPERTY.lat},${PROPERTY.lng}`;

    const imgRes = await fetch(radarUrl);
    if (!imgRes.ok) throw new Error(`Radar API error: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString('base64');
    const mimeType = imgRes.headers.get('content-type') || 'image/png';
    console.log(`   📡 Radar map fetched: ${(imgBuffer.byteLength / 1024).toFixed(1)} KB`);

    // 2b. Call Gemini
    const ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
    });

    const prompt = getPoiBoundingBoxPrompt(PROPERTY.address);
    const startTime = Date.now();

    const result = await (ai.models as any).generateContent({
        model: 'gemini-2.0-flash',
        contents: [
            {
                parts: [
                    { text: prompt },
                    { inlineData: { data: base64, mimeType } },
                ],
            },
        ],
        config: {
            responseMimeType: 'application/json',
            responseSchema: poiBoundingBoxSchema,
        },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const responseText = typeof result.text === 'function' ? result.text() : result.text;
    const rawResult = JSON.parse(responseText);
    const tokens = result.usageMetadata || {};
    console.log(`   ✅ Gemini responded in ${elapsed}s (${tokens.totalTokenCount || '?'} tokens)`);

    // 2c. Enrich with distances
    const mapWidth = mapWidthInMeters(ZOOM, PROPERTY.lat, IMAGE_WIDTH, SCALE);
    const centerX = rawResult.property_center?.x ?? 500;
    const centerY = rawResult.property_center?.y ?? 500;

    const enriched = enrichPoisWithDistance(rawResult.pois || [], mapWidth, centerX, centerY);
    console.log(`   📌 Extracted ${enriched.length} POIs from map image`);

    return enriched as GeminiPoi[];
}

// ─── Step 3: Fuzzy Matching ───────────────────────────────────────────────────

interface MatchedPoi {
    googleName: string;
    geminiName: string;
    googleDistanceMeters: number;
    geminiDistanceMeters: number;
    differenceMeters: number;
    differencePercent: number;
    matchScore: number;
    googleTypes: string[];
    geminiCategory: string;
    googleMapsUri?: string;
}

/**
 * Simple fuzzy match score between two strings.
 * Returns a value between 0 and 1 (1 = perfect match).
 */
function fuzzyScore(a: string, b: string): number {
    const an = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const bn = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    if (an === bn) return 1.0;

    // Check if one contains the other
    if (an.includes(bn) || bn.includes(an)) return 0.85;

    // Word overlap
    const aWords = new Set(an.split(/\s+/));
    const bWords = new Set(bn.split(/\s+/));
    const intersection = [...aWords].filter((w) => bWords.has(w));
    const union = new Set([...aWords, ...bWords]);

    // Jaccard similarity
    const jaccard = intersection.length / union.size;

    // Bonus for matching the first word (business name)
    const firstWordMatch = an.split(/\s+/)[0] === bn.split(/\s+/)[0] ? 0.2 : 0;

    return Math.min(1, jaccard + firstWordMatch);
}

function findMatches(googlePois: GooglePlace[], geminiPois: GeminiPoi[]): MatchedPoi[] {
    const MATCH_THRESHOLD = 0.4;
    const matches: MatchedPoi[] = [];
    const usedGemini = new Set<number>();

    for (const gp of googlePois) {
        let bestScore = 0;
        let bestIdx = -1;

        for (let i = 0; i < geminiPois.length; i++) {
            if (usedGemini.has(i)) continue;
            const score = fuzzyScore(gp.name, geminiPois[i].name);
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        if (bestIdx >= 0 && bestScore >= MATCH_THRESHOLD) {
            usedGemini.add(bestIdx);
            const gm = geminiPois[bestIdx];
            const diff = Math.abs(gp.distanceMeters - gm.distanceMeters);
            const pct = gp.distanceMeters > 0 ? (diff / gp.distanceMeters) * 100 : 0;

            matches.push({
                googleName: gp.name,
                geminiName: gm.name,
                googleDistanceMeters: Math.round(gp.distanceMeters),
                geminiDistanceMeters: gm.distanceMeters,
                differenceMeters: Math.round(diff),
                differencePercent: parseFloat(pct.toFixed(1)),
                matchScore: parseFloat(bestScore.toFixed(2)),
                googleTypes: gp.types.slice(0, 3),
                geminiCategory: gm.category,
                googleMapsUri: gp.googleMapsUri,
            });
        }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);
    return matches;
}

// ─── Step 4: Print Report ─────────────────────────────────────────────────────

function printReport(
    matches: MatchedPoi[],
    googlePois: GooglePlace[],
    geminiPois: GeminiPoi[],
) {
    console.log('\n═══════════════════════════════════════════════════════════════════════════════════════');
    console.log('  VALIDATION REPORT — Google Places (Haversine) vs Gemini (Bounding Box)');
    console.log('═══════════════════════════════════════════════════════════════════════════════════════\n');

    if (matches.length === 0) {
        console.log('  ⚠️  No common POIs found between the two sources.');
        return;
    }

    // Table header
    const hdr = [
        'Google Name'.padEnd(30),
        'Gemini Name'.padEnd(30),
        'Google (m)'.padStart(10),
        'Gemini (m)'.padStart(10),
        'Diff (m)'.padStart(9),
        'Diff %'.padStart(8),
        'Match'.padStart(6),
        'Accuracy'.padStart(10),
    ].join(' │ ');

    console.log(`  ${hdr}`);
    console.log(`  ${'─'.repeat(hdr.length)}`);

    for (const m of matches) {
        const accuracy =
            m.differencePercent <= 15
                ? '✅ Great'
                : m.differencePercent <= 30
                    ? '🟡 OK'
                    : m.differencePercent <= 50
                        ? '🟠 Fair'
                        : '🔴 Poor';

        const row = [
            m.googleName.substring(0, 30).padEnd(30),
            m.geminiName.substring(0, 30).padEnd(30),
            String(m.googleDistanceMeters).padStart(10),
            String(m.geminiDistanceMeters).padStart(10),
            String(m.differenceMeters).padStart(9),
            `${m.differencePercent}%`.padStart(8),
            String(m.matchScore).padStart(6),
            accuracy.padStart(10),
        ].join(' │ ');

        console.log(`  ${row}`);
    }

    // ─── Accuracy Stats ─────────────────────────────────────────────────────
    const diffs = matches.map((m) => m.differencePercent);
    const avgDiffPct = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const medianDiffPct = diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)];
    const within15 = matches.filter((m) => m.differencePercent <= 15).length;
    const within30 = matches.filter((m) => m.differencePercent <= 30).length;
    const within50 = matches.filter((m) => m.differencePercent <= 50).length;
    const absDiffs = matches.map((m) => m.differenceMeters);
    const avgAbsDiff = Math.round(absDiffs.reduce((a, b) => a + b, 0) / absDiffs.length);
    const medianAbsDiff = absDiffs.sort((a, b) => a - b)[Math.floor(absDiffs.length / 2)];

    console.log('\n');
    console.log('  ┌─────────────────────────────────────────');
    console.log('  │  📊 ACCURACY SUMMARY');
    console.log('  ├─────────────────────────────────────────');
    console.log(`  │  Common POIs found:   ${matches.length} / ${googlePois.length} Google, ${geminiPois.length} Gemini`);
    console.log(`  │  Avg difference:      ${avgAbsDiff} m  (${avgDiffPct.toFixed(1)}%)`);
    console.log(`  │  Median difference:   ${medianAbsDiff} m  (${medianDiffPct.toFixed(1)}%)`);
    console.log(`  │  Within 15% (Great):  ${within15}/${matches.length} (${((within15 / matches.length) * 100).toFixed(0)}%)`);
    console.log(`  │  Within 30% (OK):     ${within30}/${matches.length} (${((within30 / matches.length) * 100).toFixed(0)}%)`);
    console.log(`  │  Within 50% (Fair):   ${within50}/${matches.length} (${((within50 / matches.length) * 100).toFixed(0)}%)`);
    console.log('  └─────────────────────────────────────────');

    // ─── Unmatched POIs ─────────────────────────────────────────────────────
    const matchedGoogleNames = new Set(matches.map((m) => m.googleName.toLowerCase()));
    const matchedGeminiNames = new Set(matches.map((m) => m.geminiName.toLowerCase()));

    const unmatchedGoogle = googlePois.filter((p) => !matchedGoogleNames.has(p.name.toLowerCase()));
    const unmatchedGemini = geminiPois.filter((p) => !matchedGeminiNames.has(p.name.toLowerCase()));

    console.log('\n');
    console.log('  ┌─── UNMATCHED GOOGLE PLACES (not found in Gemini) ───');
    unmatchedGoogle.slice(0, 15).forEach((p) => {
        console.log(`  │  • ${p.name.padEnd(35)} ${Math.round(p.distanceMeters).toString().padStart(5)} m   types: [${p.types.slice(0, 2).join(', ')}]`);
    });
    if (unmatchedGoogle.length > 15) console.log(`  │  ... +${unmatchedGoogle.length - 15} more`);

    console.log('  │');
    console.log('  ┌─── UNMATCHED GEMINI POIs (not found in Google Places) ───');
    unmatchedGemini.slice(0, 15).forEach((p) => {
        console.log(`  │  • ${p.name.padEnd(35)} ${p.distanceMeters.toString().padStart(5)} m   category: ${p.category}`);
    });
    if (unmatchedGemini.length > 15) console.log(`  │  ... +${unmatchedGemini.length - 15} more`);

    console.log('  └───────────────────────────────────────────────');

    // ─── Side-by-side name comparison for manual checking ───────────────────
    console.log('\n');
    console.log('  ┌─── ALL NAMES — Side by Side (for manual verification) ───');
    console.log('  │');
    console.log(`  │  ${'GOOGLE PLACES'.padEnd(40)} ${'GEMINI EXTRACTED'.padEnd(40)}`);
    console.log(`  │  ${'─'.repeat(40)} ${'─'.repeat(40)}`);

    const maxLen = Math.max(googlePois.length, geminiPois.length);
    const sortedGoogle = [...googlePois].sort((a, b) => a.distanceMeters - b.distanceMeters);
    const sortedGemini = [...geminiPois].sort((a, b) => a.distanceMeters - b.distanceMeters);

    for (let i = 0; i < Math.min(maxLen, 40); i++) {
        const gName = sortedGoogle[i]
            ? `${sortedGoogle[i].name.substring(0, 32).padEnd(32)} ${Math.round(sortedGoogle[i].distanceMeters).toString().padStart(5)}m`
            : '';
        const mName = sortedGemini[i]
            ? `${sortedGemini[i].name.substring(0, 32).padEnd(32)} ${sortedGemini[i].distanceMeters.toString().padStart(5)}m`
            : '';
        console.log(`  │  ${gName.padEnd(40)} ${mName.padEnd(40)}`);
    }
    console.log('  └───────────────────────────────────────────────');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  POI Distance Validation');
    console.log(`  Property: ${PROPERTY.address}`);
    console.log(`  Coordinates: (${PROPERTY.lat}, ${PROPERTY.lng})`);
    console.log('═══════════════════════════════════════════════════════════════');

    const [googlePois, geminiPois] = await Promise.all([
        fetchGooglePlaces(),
        fetchGeminiPois(),
    ]);

    console.log('\n🔗 Step 3: Fuzzy-matching common POIs between sources...');
    const matches = findMatches(googlePois, geminiPois);
    console.log(`   Found ${matches.length} common POIs`);

    printReport(matches, googlePois, geminiPois);

    console.log('\n✅ Validation complete.');
}

main().catch((err) => {
    console.error('\n❌ Validation failed:', err.message || err);
    process.exit(1);
});
