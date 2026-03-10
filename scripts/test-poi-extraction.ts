#!/usr/bin/env npx tsx
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║        POI Bounding Box Extraction — Live Integration Test              ║
 * ║                                                                         ║
 * ║  Property: 4251 Lucero Ct, Pleasanton, CA 94588                         ║
 * ║                                                                         ║
 * ║  This script:                                                           ║
 * ║   1. Fetches the Radar zoom-out static map for the property             ║
 * ║   2. Sends it to Gemini 2.0 Flash for bounding-box POI extraction       ║
 * ║   3. Calculates real-world distance (meters + miles) for each POI       ║
 * ║   4. Prints a formatted report with all results                         ║
 * ║                                                                         ║
 * ║  Run: npx tsx scripts/test-poi-extraction.ts                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { GoogleGenAI } from '@google/genai';
import { getPoiBoundingBoxPrompt, poiBoundingBoxSchema } from '../prompts/property/poiBoundingBox';
import { mapWidthInMeters, enrichPoisWithDistance, BoundingBox } from '../utils/poiDistance';

// ─── Configuration ────────────────────────────────────────────────────────────

const GEMINI_API_KEY = 'AIzaSyCNXiqET26-cMRpoM9vttl13SfiA4ifQu4';
const RADAR_API_KEY = 'prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb';

const PROPERTY = {
    address: '4251 Lucero Ct, Pleasanton, CA 94588',
    lat: 37.6614,
    lng: -121.8753,
};

const ZOOM = 15;
const IMAGE_WIDTH = 1024;
const SCALE = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRadarMapUrl(): string {
    return (
        `https://api.radar.io/maps/static` +
        `?publishableKey=${RADAR_API_KEY}` +
        `&center=${PROPERTY.lat},${PROPERTY.lng}` +
        `&zoom=${ZOOM}` +
        `&width=${IMAGE_WIDTH}` +
        `&height=${IMAGE_WIDTH}` +
        `&style=radar-default-v1` +
        `&scale=${SCALE}` +
        `&markers=color:0x000257%7C${PROPERTY.lat},${PROPERTY.lng}`
    );
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
    console.log(`\n📡 Fetching map image from Radar...`);
    console.log(`   URL: ${url.substring(0, 80)}...`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Radar API returned ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/png';

    console.log(`   ✅ Image fetched: ${(buffer.byteLength / 1024).toFixed(1)} KB (${mimeType})`);
    return { data: base64, mimeType };
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  POI Bounding Box Extraction Test');
    console.log(`  Property: ${PROPERTY.address}`);
    console.log(`  Coordinates: (${PROPERTY.lat}, ${PROPERTY.lng})`);
    console.log(`  Map Config: zoom=${ZOOM}, width=${IMAGE_WIDTH}px, scale=${SCALE}`);
    console.log('═══════════════════════════════════════════════════════════════');

    // 1. Fetch the Radar map image
    const mapUrl = buildRadarMapUrl();
    const img = await fetchImageAsBase64(mapUrl);

    // 2. Compute map width in meters
    const mapWidth = mapWidthInMeters(ZOOM, PROPERTY.lat, IMAGE_WIDTH, SCALE);
    console.log(`\n📐 Map ground coverage: ${mapWidth.toFixed(0)} meters wide`);
    console.log(`   Conversion factor: ${(mapWidth / 1000).toFixed(2)} m per normalised unit`);

    // 3. Call Gemini
    console.log(`\n🤖 Sending to Gemini 2.0 Flash for POI bounding-box extraction...`);
    const startTime = Date.now();

    const ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: { baseUrl: 'https://generativelanguage.googleapis.com' },
    });

    const prompt = getPoiBoundingBoxPrompt(PROPERTY.address);

    const result = await (ai.models as any).generateContent({
        model: 'gemini-2.0-flash',
        contents: [
            {
                parts: [
                    { text: prompt },
                    { inlineData: { data: img.data, mimeType: img.mimeType } },
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

    const tokenUsage = result.usageMetadata || {};
    console.log(`   ✅ Gemini responded in ${elapsed}s`);
    console.log(`   Tokens: ${tokenUsage.promptTokenCount || '?'} in → ${tokenUsage.candidatesTokenCount || '?'} out (${tokenUsage.totalTokenCount || '?'} total)`);

    // 4. Parse and enrich with distances
    const propertyCenterX = rawResult.property_center?.x ?? 500;
    const propertyCenterY = rawResult.property_center?.y ?? 500;
    console.log(`\n📍 Property centre (Gemini-reported): [${propertyCenterY}, ${propertyCenterX}]`);

    const pois = rawResult.pois || [];
    console.log(`   Extracted ${pois.length} POIs`);

    const enriched = enrichPoisWithDistance(
        pois,
        mapWidth,
        propertyCenterX,
        propertyCenterY,
    );

    // 5. Print results
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  RESULTS — POIs with Distance');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Group by category
    const byCategory: Record<string, typeof enriched> = {};
    enriched.forEach((poi) => {
        if (!byCategory[poi.category]) byCategory[poi.category] = [];
        byCategory[poi.category].push(poi);
    });

    // Sort each category by distance
    for (const [category, items] of Object.entries(byCategory)) {
        items.sort((a, b) => a.distanceMeters - b.distanceMeters);
        console.log(`┌─── ${category.toUpperCase()} (${items.length}) ───`);
        items.forEach((poi) => {
            const flag =
                poi.pixelDistance > 700
                    ? '⚠️  (edge of map)'
                    : poi.pixelDistance < 100
                        ? '🟢 (very close)'
                        : '';
            console.log(
                `│  📌 ${poi.name.padEnd(35)} ${String(poi.distanceMeters).padStart(5)} m  (${poi.distanceMiles.toFixed(2)} mi)  [${Math.round(poi.center.x)}, ${Math.round(poi.center.y)}]  ${flag}`,
            );
            if (poi.highlights) {
                console.log(`│     └─ ${poi.highlights}`);
            }
        });
        console.log('│');
    }

    console.log('└───────────────────────────────────────────────────');

    // 6. Summary stats
    const distances = enriched.map((p) => p.distanceMeters);
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    const maxDist = Math.max(...distances);
    const minDist = Math.min(...distances);
    const edgePois = enriched.filter((p) => p.pixelDistance > 700);

    console.log('\n📊 Summary:');
    console.log(`   Total POIs extracted: ${enriched.length}`);
    console.log(`   Closest: ${minDist} m (${(minDist / 1609.34).toFixed(2)} mi)`);
    console.log(`   Farthest: ${maxDist} m (${(maxDist / 1609.34).toFixed(2)} mi)`);
    console.log(`   Average: ${Math.round(avgDist)} m (${(avgDist / 1609.34).toFixed(2)} mi)`);
    console.log(`   Edge-of-map POIs: ${edgePois.length} (flag for lower accuracy)`);
    console.log(`   Categories covered: ${Object.keys(byCategory).length}/9`);

    // 7. Raw JSON dump for debugging
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  RAW GEMINI RESPONSE (first 3 POIs)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(JSON.stringify(pois.slice(0, 3), null, 2));

    console.log('\n✅ Test complete.');
}

main().catch((err) => {
    console.error('\n❌ Test failed:', err.message || err);
    process.exit(1);
});
