/**
 * Satellitary Analysis Service
 *
 * Fetches:
 *   Image A — Google Maps Static API aerial satellite (zoom=20, North-up)
 *   Image B — Street View of the front of the property
 *             (Firebase Storage cached URL preferred; falls back to live API)
 *
 * Both images are sent to Gemini with a purpose-built orientation prompt
 * asking it to identify the front door on the street view, locate it on the
 * aerial footprint, and derive the compass orientation.
 *
 * NO caching — always runs fresh by design.
 */

import { APP_CONFIG } from '../config';
import { urlToBase64, executeGeminiRequest, FLASH_MODEL } from './geminiService';
import { Type } from '@google/genai';
import { savePropertyOrientationToCloud } from './firebase/properties';

const MAPS_API_KEY = APP_CONFIG.maps.key;

export interface SatellitaryResult {
    final_orientation: string;        // e.g. "Northeast (approx. 45°)"
    azimuth_degrees: number | null;   // 0–360, null if uncertain (AI estimate)
    confidence: 'high' | 'medium' | 'low';
    explanation: string;              // Detailed step-by-step reasoning
    aerial_url: string;               // Public URL of satellite image used
    street_view_url: string;          // Public URL of street view used (empty string if none)
    aerial_only_mode: boolean;        // true when no street view was available
    // Geocoding API — entrance-based precise azimuth (null if no entrance data)
    geocoding_azimuth_degrees: number | null;
    geocoding_orientation: string | null;      // e.g. "Northeast"
    geocoding_entrance_available: boolean;     // true when Geocoding API had entrance data
}

/**
 * Build the aerial satellite URL for the given coordinates.
 * Zoom 20 gives per-lot resolution; maptype=satellite for imagery.
 */
function buildAerialUrl(lat: number, lng: number): string {
    return (
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=20` +
        `&size=640x640` +
        `&maptype=satellite` +
        `&key=${MAPS_API_KEY}`
    );
}

// ─── Geocoding Azimuth (entrance-based precise bearing) ───────────────────────

/**
 * Converts a bearing in degrees (0–360) to a cardinal/intercardinal compass label.
 */
function bearingToOrientation(deg: number): string {
    const dirs = [
        'North', 'North-Northeast', 'Northeast', 'East-Northeast',
        'East', 'East-Southeast', 'Southeast', 'South-Southeast',
        'South', 'South-Southwest', 'Southwest', 'West-Southwest',
        'West', 'West-Northwest', 'Northwest', 'North-Northwest',
    ];
    const idx = Math.round(deg / 22.5) % 16;
    return dirs[idx];
}

/**
 * TypeScript port of the Python `calculate_home_orientation` function.
 *
 * Calls Google Geocoding API with extra_computations=BUILDING_AND_ENTRANCES
 * which returns entrance locations for the parcel. The bearing from the building
 * centroid to the PREFERRED entrance is the direction the front faces.
 *
 * Formula: atan2(sin(Δlon)·cos(lat2), cos(lat1)·sin(lat2) − sin(lat1)·cos(lat2)·cos(Δlon))
 * This is the standard forward azimuth calculation (spherical Earth approximation).
 *
 * Returns null if the Geocoding API returns no entrance data.
 */
async function computeGeocodingAzimuth(
    lat: number,
    lng: number,
    address?: string
): Promise<{ azimuth: number; orientation: string } | null> {
    try {
        // Prefer reverse geocoding by latlng (more precise for a known location)
        const query = address
            ? `address=${encodeURIComponent(address)}`
            : `latlng=${lat},${lng}`;
        const url =
            `https://maps.googleapis.com/maps/api/geocode/json` +
            `?${query}` +
            `&extra_computations=BUILDING_AND_ENTRANCES` +
            `&key=${MAPS_API_KEY}`;

        const response = await fetch(url);
        const geocodeResult = await response.json();

        if (!response.ok || geocodeResult.status !== 'OK') {
            console.warn('[Satellitary/Geocoding] Non-OK status:', geocodeResult.status);
            return null;
        }

        const result = geocodeResult.results?.[0];
        if (!result) return null;

        // 1. Building centroid
        const center = result.geometry?.location;
        if (!center?.lat || !center?.lng) return null;
        const lat1 = center.lat;
        const lon1 = center.lng;

        // 2. Preferred entrance (falls back to first entrance)
        const entrances: any[] = result.entrances ?? [];
        const preferred = entrances.find(
            (e: any) => Array.isArray(e.entrance_tags) && e.entrance_tags.includes('PREFERRED')
        ) ?? entrances[0] ?? null;

        if (!preferred?.location?.lat || !preferred?.location?.lng) {
            console.log('[Satellitary/Geocoding] No entrance data in response.');
            return null;
        }

        const lat2 = preferred.location.lat;
        const lon2 = preferred.location.lng;

        // 3. Bearing formula (atan2) — same as the Python original
        const dLonRad = (lon2 - lon1) * (Math.PI / 180);
        const lat1Rad = lat1 * (Math.PI / 180);
        const lat2Rad = lat2 * (Math.PI / 180);

        const y = Math.sin(dLonRad) * Math.cos(lat2Rad);
        const x =
            Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLonRad);

        const bearingRad = Math.atan2(y, x);
        const azimuth = Math.round(((bearingRad * (180 / Math.PI)) + 360) % 360 * 100) / 100;

        console.log(`[Satellitary/Geocoding] Centroid (${lat1}, ${lon1}) → Entrance (${lat2}, ${lon2}) = ${azimuth}°`);
        return { azimuth, orientation: bearingToOrientation(azimuth) };

    } catch (e: any) {
        console.warn('[Satellitary/Geocoding] Failed to compute entrance azimuth:', e.message);
        return null;
    }
}

/**
 * Build the Street View Static API URL for the given coordinates.
 * Only used as a last-resort reference — prefer Firebase cached URL.
 */
function buildStreetViewUrl(lat: number, lng: number): string {
    return (
        `https://maps.googleapis.com/maps/api/streetview` +
        `?size=640x640` +
        `&location=${lat},${lng}` +
        `&fov=90` +
        `&radius=100` +
        `&source=outdoor` +
        `&return_error_code=true` +
        `&key=${MAPS_API_KEY}`
    );
}

/**
 * Prompt used when BOTH aerial and street view images are available.
 * Gemini cross-references the front door visible in the street view with
 * the building footprint in the aerial to derive compass orientation.
 */
const ORIENTATION_PROMPT_DUAL = `
You are a spatial analysis expert. I am providing two images of the same property.

IMAGE A (Aerial Satellite): A top-down satellite view of the property parcel.
IMPORTANT: In this image, North is ALWAYS at the top of the frame, East is to the right,
South is at the bottom, and West is to the left.

IMAGE B (Street View): A street-level photograph of the front of the house.

TASK:
1. In Image B, identify the front door or main entrance of the house.
2. In Image A, find the building footprint. Locate the edge or face of the building that
   contains the front door identified in Image B.
3. Determine which compass direction that front-facing wall or door faces, using the
   North-up orientation of Image A.
4. Express the result as a specific compass direction and, if possible, an approximate
   azimuth in degrees (0° = North, 90° = East, 180° = South, 270° = West).

Use this step-by-step reasoning format in your explanation:
  Step 1: Describe what the front door / entrance looks like in Image B (color, features, position within the frame).
  Step 2: Locate the corresponding face of the building in Image A (which edge of the footprint).
  Step 3: State which compass direction that edge points toward, referencing the North-up orientation.
  Step 4: Give your final orientation with an estimated azimuth range.

Be precise. If the front is ambiguous in the street view, state that and give your best estimate.
`.trim();

/**
 * Prompt used when ONLY the aerial satellite image is available (no street view).
 * Gemini uses indirect cues — road adjacency, driveway, front yard, shadow angle,
 * and garage doors — to infer which face of the building is the "street-facing" front.
 */
const ORIENTATION_PROMPT_AERIAL_ONLY = `
You are a spatial analysis expert. I am providing one aerial satellite image of a property.

IMAGE A (Aerial Satellite): A top-down satellite view at high zoom (zoom level 20).
IMPORTANT: North is ALWAYS at the top of the frame, East is to the right,
South is at the bottom, and West is to the left.

No street view image is available. You must determine which compass direction the FRONT
of the house faces using aerial cues only.

TASK:
1. Identify the building footprint.
2. Determine which side of the building faces the street or public road
   (look for driveway, front walkway, proximity to road, front yard, garage door,
   or any visible entrance features).
3. Determine which compass direction that front-facing wall points toward,
   using the strict North-up orientation of the image.
4. Express the result as a compass direction and an approximate azimuth in degrees.

Use this step-by-step reasoning format in your explanation:
  Step 1: Describe the overall shape of the building footprint and where roads/driveways appear.
  Step 2: Identify which side of the building faces the street or has a driveway / front yard.
  Step 3: Determine the compass direction from the North-up frame.
  Step 4: Give your final orientation with an estimated azimuth range and note the confidence level.
  Note: If it was impossible to determine without street view, state that clearly.

Be honest about confidence. Aerial-only analysis is inherently less precise than
cross-referencing with street view, so use 'medium' or 'low' confidence unless
the evidence is unambiguous.
`.trim();

// Legacy alias (keep in case anything imports it)
const ORIENTATION_PROMPT = ORIENTATION_PROMPT_DUAL;

const satellitarySchema = {
    type: Type.OBJECT,
    properties: {
        final_orientation: {
            type: Type.STRING,
            description: 'Short compass direction the front of the house faces, e.g. "Northeast", "South", "East-Southeast".'
        },
        azimuth_degrees: {
            type: Type.NUMBER,
            description: 'Approximate azimuth in degrees (0=North, 90=East, 180=South, 270=West). Omit or use null if truly uncertain.',
            nullable: true
        },
        confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
            description: 'How confident you are in the orientation based on image clarity.'
        },
        explanation: {
            type: Type.STRING,
            description: 'Full step-by-step reasoning as described in the prompt.'
        }
    },
    required: ['final_orientation', 'confidence', 'explanation']
};

export async function runSatellitaryAnalysis(
    lat: number,
    lng: number,
    cachedStreetViewUrl?: string | null,
    userId: string = 'unknown',
    zpid?: string,
    address?: string
): Promise<SatellitaryResult> {
    // ── 1. Resolve image URLs ──────────────────────────────────────────────────
    const aerialUrl = buildAerialUrl(lat, lng);

    // Prefer Firebase Storage cached URL. Fall back to live Street View API.
    // If street view completely unavailable, run aerial-only analysis.
    let streetViewUrl: string | null = null;
    if (cachedStreetViewUrl?.includes('firebasestorage')) {
        streetViewUrl = cachedStreetViewUrl;
    } else {
        // Try live Street View API — check metadata first (free call)
        try {
            const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=100&source=outdoor&key=${MAPS_API_KEY}`;
            const meta = await fetch(metaUrl).then(r => r.json());
            if (meta.status === 'OK') {
                streetViewUrl = buildStreetViewUrl(lat, lng);
                console.log('[Satellitary] No cached street view; using live Street View API.');
            } else {
                console.log(`[Satellitary] Street View metadata: ${meta.status} — running aerial-only analysis.`);
            }
        } catch (e) {
            console.warn('[Satellitary] Street View metadata check failed; running aerial-only.', e);
        }
    }

    console.log('[Satellitary] Aerial URL:', aerialUrl);
    console.log('[Satellitary] Street View URL:', streetViewUrl ?? '(none — aerial-only)');

    // ── 2. Fetch base64 images + geocoding azimuth in parallel ────────────────
    const aerialB64Promise = urlToBase64(aerialUrl);
    const streetB64Promise = streetViewUrl ? urlToBase64(streetViewUrl) : Promise.resolve(null);
    const geocodingAzimuthPromise = computeGeocodingAzimuth(lat, lng, address);

    const [aerialB64, streetB64, geocodingResult] = await Promise.all([
        aerialB64Promise,
        streetB64Promise,
        geocodingAzimuthPromise,
    ]);

    const usesDualImage = !!streetB64;
    const prompt = usesDualImage ? ORIENTATION_PROMPT_DUAL : ORIENTATION_PROMPT_AERIAL_ONLY;

    // ── 3. Call Gemini ────────────────────────────────────────────────────────
    const parts: any[] = [
        { text: prompt },
        { inlineData: { data: aerialB64.data, mimeType: aerialB64.mimeType } },
    ];
    if (streetB64) {
        parts.push({ inlineData: { data: streetB64.data, mimeType: streetB64.mimeType } });
    }

    const { data } = await executeGeminiRequest<Omit<SatellitaryResult, 'aerial_url' | 'street_view_url' | 'aerial_only_mode' | 'geocoding_azimuth_degrees' | 'geocoding_orientation' | 'geocoding_entrance_available'>>({
        model: FLASH_MODEL,
        contents: { parts },
        config: { temperature: 0.2 },
        userId,
        zpid,
        address,
        promptFilename: 'satellitaryAnalysis.ts',
        extractResultJson: true,
        schema: satellitarySchema,
        imageUrls: streetViewUrl ? [aerialUrl, streetViewUrl] : [aerialUrl]
    });

    const result: SatellitaryResult = {
        ...data,
        azimuth_degrees: data.azimuth_degrees ?? null,
        aerial_url: aerialUrl,
        street_view_url: streetViewUrl ?? '',
        aerial_only_mode: !usesDualImage,
        geocoding_azimuth_degrees: geocodingResult?.azimuth ?? null,
        geocoding_orientation: geocodingResult?.orientation ?? null,
        geocoding_entrance_available: !!geocodingResult,
    };

    // ── 4. Cache results to Firestore (fire-and-forget) ───────────────────────
    if (zpid) {
        savePropertyOrientationToCloud(
            zpid,
            {
                final_orientation: result.final_orientation,
                azimuth_degrees: result.azimuth_degrees,
                confidence: result.confidence,
                aerial_only_mode: result.aerial_only_mode,
                aerial_url: result.aerial_url,
                street_view_url: result.street_view_url,
            },
            geocodingResult ? { azimuth_degrees: geocodingResult.azimuth, orientation: geocodingResult.orientation } : null
        ).catch(e => console.warn('[Satellitary] Orientation cache write failed (non-blocking):', e));
    }

    return result;
}
