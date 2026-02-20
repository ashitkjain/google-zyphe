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

const MAPS_API_KEY = APP_CONFIG.maps.key;

export interface SatellitaryResult {
    final_orientation: string;        // e.g. "Northeast (approx. 45°)"
    azimuth_degrees: number | null;   // 0–360, null if uncertain
    confidence: 'high' | 'medium' | 'low';
    explanation: string;              // Detailed step-by-step reasoning
    aerial_url: string;               // Public URL of satellite image used
    street_view_url: string;          // Public URL of street view used
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

/**
 * Build the Street View Static API URL for the given coordinates.
 * Uses outdoor source and a broad radius to find the best shot.
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

const ORIENTATION_PROMPT = `
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
    const streetViewUrl = (cachedStreetViewUrl && cachedStreetViewUrl.includes('firebasestorage'))
        ? cachedStreetViewUrl
        : buildStreetViewUrl(lat, lng);

    console.log('[Satellitary] Aerial URL:', aerialUrl);
    console.log('[Satellitary] Street View URL:', streetViewUrl);

    // ── 2. Convert both to base64 in parallel ─────────────────────────────────
    const [aerialB64, streetB64] = await Promise.all([
        urlToBase64(aerialUrl),
        urlToBase64(streetViewUrl)
    ]);

    // ── 3. Call Gemini via the project's executeGeminiRequest wrapper ──────────
    const { data } = await executeGeminiRequest<Omit<SatellitaryResult, 'aerial_url' | 'street_view_url'>>({
        model: FLASH_MODEL,
        contents: {
            parts: [
                { text: ORIENTATION_PROMPT },
                { inlineData: { data: aerialB64.data, mimeType: aerialB64.mimeType } },
                { inlineData: { data: streetB64.data, mimeType: streetB64.mimeType } }
            ]
        },
        config: { temperature: 0.2 },
        userId,
        zpid,
        address,
        promptFilename: 'satellitaryAnalysis.ts',
        extractResultJson: true,
        schema: satellitarySchema,
        imageUrls: [aerialUrl, streetViewUrl]
    });

    return {
        ...data,
        azimuth_degrees: data.azimuth_degrees ?? null,
        aerial_url: aerialUrl,
        street_view_url: streetViewUrl
    };
}
