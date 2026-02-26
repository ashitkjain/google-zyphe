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
    image_quality: 'clear' | 'acceptable' | 'blurry'; // Satellite image clarity assessment
    explanation: string;              // Detailed step-by-step reasoning
    feng_shui_vastu: string | null;   // Feng Shui / Vastu tips (null if not applicable)
    // Aerial analysis extras
    privacy_insight: string;          // Neighbor proximity & sightline assessment
    lot_coverage_hardscape: number | null;  // % of lot covered by hardscape (0-100)
    lot_coverage_pervious: number | null;   // % of lot covered by green/pervious space (0-100)
    buyer_pro: string;                // One buyer-facing Pro based on privacy + lot coverage
    buyer_con: string;                // One buyer-facing Con based on privacy + lot coverage
    orientation_highlights: string;   // Probabilistic comment on what this facing direction tends to mean ("often", "typically")
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
        `&scale=2` +
        `&maptype=satellite` +
        `&key=${MAPS_API_KEY}`
    );
}

/**
 * Fetches the Google Maps Static API aerial satellite image for a property,
 * uploads it to Firebase Storage (path: properties/{zpid}/maps/aerial_satellite.jpg),
 * and saves the Storage URL back to the property document.
 *
 * If the file already exists in Storage (checked by getDownloadURL before upload),
 * it returns the cached URL immediately without re-downloading.
 *
 * @returns Firebase Storage download URL (or the raw Google URL as fallback)
 */
export async function getOrCacheAerialSatelliteUrl(
    zpid: string,
    lat: number,
    lng: number
): Promise<string> {
    const { uploadRemoteImageToStorage } = await import('./firebase/storage');
    const { savePropertyToCloud } = await import('./firebase/properties');

    const aerialUrl = buildAerialUrl(lat, lng);
    const storagePath = `properties/${zpid}/maps/aerial_satellite_scale2.jpg`;

    // uploadRemoteImageToStorage already does a getDownloadURL check before uploading
    const cachedUrl = await uploadRemoteImageToStorage(aerialUrl, storagePath);

    // Persist the cached URL to Firestore so we can read it back without re-downloading
    if (cachedUrl.includes('firebasestorage')) {
        savePropertyToCloud(zpid, { mapZoomOut: cachedUrl } as any)
            .catch(e => console.warn('[Satellitary] Failed to cache aerial URL to property doc:', e));
    }

    return cachedUrl;
}

/**
 * Force-refreshes the aerial satellite image for a property.
 * Deletes any existing cached file in Firebase Storage first, then
 * re-downloads a fresh image from the Google Maps Static API and re-uploads it.
 *
 * Use this when you want to ignore the existing cache (e.g., after changing
 * the marker style or zoom level).
 */
export async function forceRefreshAerialSatelliteUrl(
    zpid: string,
    lat: number,
    lng: number
): Promise<string> {
    const { deleteFileFromStorage, uploadRemoteImageToStorage } = await import('./firebase/storage');
    const { savePropertyToCloud } = await import('./firebase/properties');

    const storagePath = `properties/${zpid}/maps/aerial_satellite_scale2.jpg`;

    // Delete the old cached file so uploadRemoteImageToStorage doesn't skip
    await deleteFileFromStorage(storagePath);

    // Re-download and re-upload
    const aerialUrl = buildAerialUrl(lat, lng);
    const freshUrl = await uploadRemoteImageToStorage(aerialUrl, storagePath);

    if (freshUrl.includes('firebasestorage')) {
        savePropertyToCloud(zpid, { mapZoomOut: freshUrl } as any)
            .catch(e => console.warn('[Satellitary] Failed to update aerial URL in property doc:', e));
    }

    return freshUrl;
}

/**
 * Force-refreshes the street view image for a property.
 * Deletes the existing cached file in Firebase Storage, then re-fetches
 * a fresh image from the Google Maps Street View Static API and re-uploads it.
 *
 * @returns Firebase Storage download URL for the fresh street view image,
 *          or an empty string if Street View is unavailable at this location.
 */
export async function forceRefreshStreetViewUrl(
    zpid: string,
    lat: number,
    lng: number
): Promise<string> {
    const { deleteFileFromStorage, uploadRemoteImageToStorage } = await import('./firebase/storage');
    const { savePropertyToCloud } = await import('./firebase/properties');

    const storagePath = `properties/${zpid}/maps/street_view.jpg`;

    // Delete old cached file first
    await deleteFileFromStorage(storagePath);

    // Check Street View availability + get camera heading (free metadata call)
    const headingResult = await fetchStreetViewHeading(lat, lng);
    if (!headingResult) {
        console.log(`[Satellitary] No street view available for zpid ${zpid} — skipping street view refresh.`);
        return '';
    }

    // Build URL locked to the known camera heading
    const streetViewUrl = buildStreetViewUrl(lat, lng, headingResult.heading);

    // Re-upload to Storage
    const freshUrl = await uploadRemoteImageToStorage(streetViewUrl, storagePath);

    if (freshUrl.includes('firebasestorage')) {
        // Persist the new URL back to the property doc under the same field the app reads
        savePropertyToCloud(zpid, { streetView: freshUrl } as any)
            .catch(e => console.warn('[Satellitary] Failed to persist street view URL:', e));
    }

    return freshUrl;
}

/**
 * Full force-refresh pipeline for a single property row:
 *   1. Delete & re-download the aerial satellite image
 *   2. Delete & re-download the street view image (if available)
 *   3. Run satellitary orientation analysis with the fresh images
 *   4. Cache the orientation result to Firestore (done inside runSatellitaryAnalysis)
 *
 * Returns the full SatellitaryResult so the caller can update its local state.
 */
export async function forceRefreshAllImagesAndAnalyze(
    zpid: string,
    lat: number,
    lng: number,
    userId: string = 'unknown',
    address?: string
): Promise<SatellitaryResult & { freshAerialUrl: string; freshStreetViewUrl: string }> {
    console.log(`[Satellitary] Force-refresh start for zpid ${zpid}`);

    // Step 1 & 2: Re-download both images in parallel
    const [freshAerialUrl, freshStreetViewUrl] = await Promise.all([
        forceRefreshAerialSatelliteUrl(zpid, lat, lng),
        forceRefreshStreetViewUrl(zpid, lat, lng),
    ]);

    console.log(`[Satellitary] Fresh aerial: ${freshAerialUrl}`);
    console.log(`[Satellitary] Fresh street view: ${freshStreetViewUrl || '(none)'}`);

    // Step 3: Run analysis with fresh images
    // Pass the freshStreetViewUrl as the cachedStreetViewUrl so the analysis skips
    // the metadata check and uses the image we just uploaded.
    const result = await runSatellitaryAnalysis(
        lat,
        lng,
        freshStreetViewUrl || null,
        userId,
        zpid,
        address
    );

    return { ...result, freshAerialUrl, freshStreetViewUrl };
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
export async function computeGeocodingAzimuth(
    lat: number,
    lng: number,
    _address?: string   // kept for API compatibility but unused — latlng is always more precise
): Promise<{ azimuth: number; orientation: string } | null> {
    try {
        // BUILDING_AND_ENTRANCES only works with latlng (reverse geocoding).
        // Forward address= queries don't return entrance data.
        const url =
            `https://maps.googleapis.com/maps/api/geocode/json` +
            `?latlng=${lat},${lng}` +
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
 * @param heading Optional camera heading in degrees (0=North, 90=East, etc.).
 *                When provided the image is locked to that exact bearing so
 *                Gemini knows which compass direction the camera was pointing.
 */
function buildStreetViewUrl(lat: number, lng: number, heading?: number | null): string {
    const headingParam = heading != null ? `&heading=${heading}` : '';
    return (
        `https://maps.googleapis.com/maps/api/streetview` +
        `?size=640x640` +
        `&location=${lat},${lng}` +
        `&fov=90` +
        `&radius=100` +
        `&source=outdoor` +
        `&return_error_code=true` +
        headingParam +
        `&key=${MAPS_API_KEY}`
    );
}

/**
 * Fetches the Street View metadata for the given coordinates and derives the
 * camera heading so Gemini always knows which direction the camera is pointing.
 *
 * Heading resolution order:
 *   1. meta.heading — when the API includes it directly.
 *   2. Computed bearing from panorama location → property location — the camera
 *      is on the street and aimed at the property, so the forward azimuth from
 *      the pano position (meta.location) to (propertyLat, propertyLng) gives
 *      us the precise camera heading using the same spherical-Earth formula
 *      already used by computeGeocodingAzimuth.
 *
 * Returns null ONLY when Street View is genuinely unavailable (status !== 'OK').
 */
async function fetchStreetViewHeading(
    propertyLat: number,
    propertyLng: number
): Promise<{ heading: number | null; status: string } | null> {
    try {
        const metaUrl =
            `https://maps.googleapis.com/maps/api/streetview/metadata` +
            `?location=${propertyLat},${propertyLng}` +
            `&radius=100` +
            `&source=outdoor` +
            `&key=${MAPS_API_KEY}`;
        const meta = await fetch(metaUrl).then(r => r.json());

        // null == truly unavailable at this location
        if (meta.status !== 'OK') {
            console.log(`[Satellitary] Street View metadata: ${meta.status} — unavailable.`);
            return null;
        }

        // 1. Use the API-provided heading if present
        if (meta.heading != null) {
            const heading = Math.round(meta.heading);
            console.log(`[Satellitary] Street View heading (from API): ${heading}°`);
            return { heading, status: meta.status };
        }

        // 2. Derive heading from panorama position → property position.
        //    meta.location = where the Street View camera is parked on the street.
        //    The camera faces the property, so bearing(pano → property) = camera heading.
        const panoLoc = meta.location; // { lat, lng }
        if (panoLoc?.lat != null && panoLoc?.lng != null) {
            const lat1 = panoLoc.lat * (Math.PI / 180);
            const lat2 = propertyLat * (Math.PI / 180);
            const dLon = (propertyLng - panoLoc.lng) * (Math.PI / 180);

            const y = Math.sin(dLon) * Math.cos(lat2);
            const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            const bearing = Math.round(((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360);

            console.log(
                `[Satellitary] Street View heading (computed from pano ${panoLoc.lat.toFixed(6)},` +
                `${panoLoc.lng.toFixed(6)} → property): ${bearing}°`
            );
            return { heading: bearing, status: meta.status };
        }

        // Panorama location missing — street view available but no heading derivable
        console.log('[Satellitary] Street View available but could not derive heading — building URL without heading param.');
        return { heading: null, status: meta.status };

    } catch (e) {
        console.warn('[Satellitary] Failed to fetch street view heading:', e);
        return null;
    }
}

/**
 * Prompt used when BOTH aerial and street view images are available.
 * Gemini cross-references the front door visible in the street view with
 * the building footprint in the aerial to derive compass orientation.
 */
/**
 * Builds the dual-image orientation prompt.
 * When the street-view camera heading is known we inject it directly into the
 * prompt so Gemini does NOT need to guess which compass direction it was facing.
 */
function buildOrientationPromptDual(streetViewHeading?: number | null, address?: string): string {
    const addressClue = address
        ? `\n\nPROPERTY ADDRESS: "${address}"
` +
        `IMPORTANT NOTE ON ADDRESS vs FRONT ORIENTATION:
` +
        `The address street name is used for navigation and mail delivery — it leads you TO the property.
` +
        `However, the front door does NOT necessarily face the address street directly. Common scenarios:
` +
        `  a) The address street leads into a smaller UNNAMED internal lane or private drive inside a
` +
        `     complex — the unit fronts face that internal lane, not the address street itself.
` +
        `  b) The address street is a major arterial that borders the property's BACK or SIDE —
` +
        `     the actual entrance faces a quieter residential road on the opposite side.
` +
        `  c) For standalone homes: the address street is usually what the front faces.
` +
        `Use the address as context to identify the area, but do NOT assume the front door faces the
` +
        `address road. Use the camera heading and/or aerial cues to find the true front orientation.`
        : '';

    const headingAuthority = streetViewHeading != null
        ? `\n\nCAMERA HEADING: ${streetViewHeading}° (0°=North, 90°=East, 180°=South, 270°=West)\n` +
        `The Street View camera was aimed at the visible exterior wall of the property.\n` +
        `Mathematical implication: the wall facing the camera points toward ~${(streetViewHeading + 180) % 360}°.\n` +
        `\n` +
        `⚠️  CRITICAL — READ BEFORE USING THE HEADING:\n` +
        `Google Street View cameras only travel on PUBLIC roads. For many residential properties,\n` +
        `this means the camera captures the BACK or SIDE exterior wall that faces the public road —\n` +
        `NOT the unit entrances, which may face a private internal lane inaccessible to Street View.\n` +
        `\n` +
        `STEP 0.5 — ASSESS PROPERTY TYPE (do this before deciding how to use the heading):\n` +
        `Look at Image A (aerial) and determine the property type:\n` +
        `\n` +
        `  TYPE A — STANDALONE HOME (single detached house, single rooftop, faces one street):\n` +
        `    → The street view likely shows the FRONT. Trust the heading as ground truth.\n` +
        `    → Derived front orientation: ~${(streetViewHeading + 180) % 360}° (high confidence from heading).\n` +
        `\n` +
        `  TYPE B — MULTI-UNIT COMPLEX (apartment, townhome, condo row, multiple rooftops,\n` +
        `    internal access lanes visible in aerial):\n` +
        `    → The street view almost certainly shows an EXTERIOR BACK/SIDE WALL facing the public road.\n` +
        `    → The true unit FRONTS face an internal private lane or internal court NOT shown in the street view.\n` +
        `    → DO NOT use the heading as the orientation. Instead, USE THE AERIAL (Image A) to find\n` +
        `       the internal lane or access road, and determine which direction the unit fronts face that lane.\n` +
        `    → The heading-derived direction (~${(streetViewHeading + 180) % 360}°) is likely the BACK of the units — the true front is often the OPPOSITE (~${streetViewHeading}°).`
        : '';


    return `
You are a spatial analysis expert. I am providing two images of the same property.

IMAGE A (Aerial Satellite): A top-down satellite view of the property parcel (zoom 20, scale 2 — 1280×1280 px).
IMPORTANT: In this image, North is ALWAYS at the top of the frame, East is to the right,
South is at the bottom, and West is to the left.

IMAGE B (Street View): A street-level photograph taken from the street directly in front of the property.${headingAuthority}${addressClue}

STEP 0 — IMAGE QUALITY CHECK (do this first, before any analysis):
Assess the sharpness and resolution of Image A (Aerial Satellite).
- If the image is blurry, heavily pixelated, or too low-resolution to distinguish individual
  building edges or roof lines, set image_quality to "blurry", set final_orientation to
  "UNCLEAR_IMAGE", set confidence to "low", and stop — do not attempt any orientation analysis.
- If the image is usable but somewhat soft or compressed, set image_quality to "acceptable" and continue.
- If the image is sharp and detailed, set image_quality to "clear" and continue.

TASK:
1. FIRST — classify the property type from Image A:
   - TYPE A (standalone home): single detached building, one rooftop, fronts a single street.
   - TYPE B (complex): multiple rooftop units, visible internal lane or courtyard, apartment/townhome style.

2. Based on property type, determine the front orientation:
   - TYPE A: Use the camera heading (${streetViewHeading != null ? `${streetViewHeading}° → front faces ~${(streetViewHeading + 180) % 360}°` : 'not available'}). Trust it as ground truth.
   - TYPE B: IGNORE the heading for orientation. In Image A, find the internal access lane or courtyard
     that the unit fronts face. Determine which compass direction those fronts point toward.
     The heading only tells you which wall faces the PUBLIC road (likely the BACK of the units).

3. Confirm the compass direction from the North-up aerial frame.
4. Express the result as a specific compass direction and approximate azimuth in degrees.
5. If the orientation has a notably positive or auspicious quality in Feng Shui or Vastu Shastra
   (e.g. South-facing in Vastu, North or East in many Feng Shui traditions), provide a brief,
   warm feng_shui_vastu tip. If the orientation is neutral or unfavourable, set feng_shui_vastu to null.
6. PRIVACY & OVERLOOK SCORE: Look at the aerial and assess neighbor proximity and sightlines.
   Identify heights of adjacent buildings compared to the target home. Flag any neighboring
   second-story windows or balconies likely to have a direct line-of-sight into the backyard or pool.
   Write 1-2 sentences as privacy_insight.
7. IMPERVIOUS SURFACE RATIO: Estimate the approximate percentage of the lot covered by hardscape
   (roof area, driveway, patio, concrete) vs pervious green space (lawn, trees, garden, soil).
   Output as lot_coverage_hardscape (0-100) and lot_coverage_pervious (0-100).
8. BUYER SUMMARY: Based on privacy_insight and lot coverage, write one buyer_pro and one buyer_con.
   Examples — Pro: "Total backyard privacy", "Generous garden space with low runoff risk".
   Examples — Con: "Overlooked by neighboring second-story balcony", "High runoff risk due to extensive concrete".
9. ORIENTATION HIGHLIGHTS: Write 1-2 sentences about what this specific facing direction (e.g. North, East, etc.)
   typically means for a home — phrased in a probabilistic, non-deterministic tone using words like
   "often", "typically", "may", "tends to", "can". Focus on practical lifestyle implications: light,
   solar gain, morning/afternoon sun, garden growth, heating/cooling. Do NOT make definitive claims.
   Example for North-facing: "North-facing homes often receive less direct sunlight through the front,
   which can keep interiors cooler in summer — though rear-facing rooms may benefit from afternoon light."
   Example for East-facing: "East-facing homes typically enjoy morning sun through the front, which may
   help reduce heating costs in winter and tend to keep afternoons cooler."

Use this step-by-step reasoning format in your explanation:
  Step 1: Classify the property type (TYPE A or TYPE B) based on Image A description.
  Step 2: For TYPE A — state the heading and derived front direction. For TYPE B — identify the
          internal lane/courtyard in Image A and which direction the unit fronts face it.
  Step 3: Confirm the compass direction from the North-up aerial frame.
  Step 4: Give your estimated orientation with an azimuth and confidence level.

REMINDER ON HEADING USE:
- TYPE A (standalone home): heading IS reliable → use it as main signal.
- TYPE B (complex): heading shows which wall faces the PUBLIC ROAD = likely the BACK.
  For TYPE B, the true front is often in the OPPOSITE direction (~${streetViewHeading != null ? streetViewHeading : '?'}°).
  Use aerial cues — internal lane, courtyard, unit door positions — as the primary signal.

MULTI-ROAD / COMPLEX HEURISTIC:
- For complexes: front faces the INTERNAL access lane, not the bordering arterial road.
- For standalone homes: front usually faces the address street.
- A wide arterial road is almost always a back or side boundary for residential complexes.
`.trim();
}

// Legacy string alias kept for backward compatibility
const ORIENTATION_PROMPT_DUAL = buildOrientationPromptDual();

/**
 * Prompt used when ONLY the aerial satellite image is available (no street view).
 * Gemini uses indirect cues — road adjacency, driveway, front yard, shadow angle,
 * and garage doors — to infer which face of the building is the "street-facing" front.
 */
function buildOrientationPromptAerialOnly(address?: string): string {
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}"
` +
        `IMPORTANT NOTE ON ADDRESS vs FRONT ORIENTATION:
` +
        `The address street leads you TO the property area but the front door may NOT face it directly.
` +
        `Look for a smaller unnamed internal lane or private drive inside the complex — units in
` +
        `apartments, townhomes, and planned communities commonly front onto these internal roads.
` +
        `A wide arterial road carrying the address name often borders the BACK or SIDE of the property.`
        : '';

    return `
You are a spatial analysis expert. I am providing one aerial satellite image of a property.

IMAGE A (Aerial Satellite): A top-down satellite view at high zoom (zoom level 20, scale 2 — 1280×1280 px).
IMPORTANT: North is ALWAYS at the top of the frame, East is to the right,
South is at the bottom, and West is to the left.
${addressClue}
STEP 0 — IMAGE QUALITY CHECK (do this first, before any analysis):
Assess the sharpness and resolution of Image A.
- If the image is blurry, heavily pixelated, or too low-resolution to distinguish individual
  building edges or roof lines, set image_quality to "blurry", set final_orientation to
  "UNCLEAR_IMAGE", set confidence to "low", and stop — do not attempt any orientation analysis.
- If the image is usable but somewhat soft or compressed, set image_quality to "acceptable" and continue.
- If the image is sharp and detailed, set image_quality to "clear" and continue.

No street view image is available. You must determine which compass direction the FRONT
of the house faces using aerial cues only.

TASK:
1. Identify the building footprint.
2. Determine which side of the building faces its primary entrance road.
   - First, check if there is a small unnamed internal lane or private drive within or adjacent
     to the complex — units in apartments/townhomes typically front onto these internal roads.
   - If no internal lane exists: prefer the smaller, narrower residential road over a wide arterial.
   - A wide arterial road is usually the back or side boundary of a residential complex, not the front.
   - Also look for: driveway, front walkway, front yard, garage door, or visible entrance features.
3. Determine which compass direction that front-facing wall points toward,
   using the strict North-up orientation of the image.
4. Express the result as a compass direction and an approximate azimuth in degrees.
5. If the orientation has a notably positive or auspicious quality in Feng Shui or Vastu Shastra
   (e.g. South-facing in Vastu, North or East in many Feng Shui traditions), provide a brief,
   warm feng_shui_vastu tip. If the orientation is neutral or unfavourable, set feng_shui_vastu to null.
6. PRIVACY & OVERLOOK SCORE: Look at the aerial and assess neighbor proximity and sightlines.
   Identify heights of adjacent buildings compared to the target home. Flag any neighboring
   second-story windows or balconies likely to have a direct line-of-sight into the backyard or pool.
   Write 1-2 sentences as privacy_insight.
7. IMPERVIOUS SURFACE RATIO: Estimate the approximate percentage of the lot covered by hardscape
   (roof area, driveway, patio, concrete) vs pervious green space (lawn, trees, garden, soil).
   Output as lot_coverage_hardscape (0-100) and lot_coverage_pervious (0-100).
8. BUYER SUMMARY: Based on privacy_insight and lot coverage, write one buyer_pro and one buyer_con.
   Examples — Pro: "Total backyard privacy", "Generous garden space with low runoff risk".
   Examples — Con: "Overlooked by neighboring second-story balcony", "High runoff risk due to extensive concrete".
9. ORIENTATION HIGHLIGHTS: Write 1-2 sentences about what this specific facing direction (e.g. North, East, etc.)
   typically means for a home — phrased in a probabilistic, non-deterministic tone using words like
   "often", "typically", "may", "tends to", "can". Focus on practical lifestyle implications: light,
   solar gain, morning/afternoon sun, garden growth, heating/cooling. Do NOT make definitive claims.
   Example for North-facing: "North-facing homes often receive less direct sunlight through the front,
   which can keep interiors cooler in summer — though rear-facing rooms may benefit from afternoon light."
   Example for East-facing: "East-facing homes typically enjoy morning sun through the front, which may
   help reduce heating costs in winter and tend to keep afternoons cooler."

Use this step-by-step reasoning format in your explanation:
  Step 1: Describe the overall shape of the building footprint and note all adjacent roads.
  Step 2: Identify which road the entrance faces. If multiple roads exist, explain which one was
          selected and why (address match, road width, driveway/front yard evidence).
  Step 3: Determine the compass direction from the North-up frame.
  Step 4: Give your estimated orientation with an azimuth range and confidence level.
  Note: If it was impossible to determine without street view, state that clearly.

Be honest about confidence. Aerial-only analysis is inherently less precise than
cross-referencing with street view, so use 'medium' or 'low' confidence unless
the evidence is unambiguous.
`.trim();
}

// Legacy alias kept for backward compatibility (no address context)
const ORIENTATION_PROMPT_AERIAL_ONLY = buildOrientationPromptAerialOnly();
// Legacy alias (keep in case anything imports it)
const ORIENTATION_PROMPT = ORIENTATION_PROMPT_DUAL;

const satellitarySchema = {
    type: Type.OBJECT,
    properties: {
        image_quality: {
            type: Type.STRING,
            enum: ['clear', 'acceptable', 'blurry'],
            description: 'Assessed clarity of the satellite image. Set to "blurry" if the image is too low-resolution for reliable analysis.'
        },
        final_orientation: {
            type: Type.STRING,
            description: 'Short compass direction the front of the house likely faces, e.g. "Northeast", "South", "East-Southeast". Use "UNCLEAR_IMAGE" if image_quality is blurry.'
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
        },
        feng_shui_vastu: {
            type: Type.STRING,
            description: 'Brief Feng Shui or Vastu Shastra tip if the orientation has a notably positive quality. Set to null if neutral or unfavourable.',
            nullable: true
        },
        privacy_insight: {
            type: Type.STRING,
            description: '1-2 sentences on neighbor proximity and sightlines. Flag any neighboring second-story windows or balconies with a direct line-of-sight into the target backyard or pool area.'
        },
        lot_coverage_hardscape: {
            type: Type.NUMBER,
            description: 'Approximate percentage (0-100) of the lot covered by hardscape: roof, driveway, patio, concrete.',
            nullable: true
        },
        lot_coverage_pervious: {
            type: Type.NUMBER,
            description: 'Approximate percentage (0-100) of the lot covered by pervious green space: lawn, trees, garden, soil.',
            nullable: true
        },
        buyer_pro: {
            type: Type.STRING,
            description: 'One buyer-facing Pro based on the privacy and lot coverage findings. E.g. "Total backyard privacy" or "Large green garden space".'
        },
        buyer_con: {
            type: Type.STRING,
            description: 'One buyer-facing Con based on the privacy and lot coverage findings. E.g. "High runoff risk due to extensive concrete" or "Overlooked by neighboring second-story balcony".'
        },
        orientation_highlights: {
            type: Type.STRING,
            description: 'ONE or TWO sentences on what this facing direction typically means for a home. MANDATORY: every sentence MUST use a hedging word — "often", "typically", "may", "tends to", "can", "in many cases". NEVER use bare deterministic verbs: do NOT write "gets sun", "receives light", "is cooler", "will be warmer". ALWAYS hedge: write "may get", "often receives", "tends to feel cooler", "can be warmer". Bad: "North-facing homes get less sun." Good: "North-facing homes often receive less direct sunlight, which can keep interiors cooler in summer."'
        }
    },
    required: ['image_quality', 'final_orientation', 'confidence', 'explanation', 'privacy_insight', 'buyer_pro', 'buyer_con', 'orientation_highlights']
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
    let streetViewHeading: number | null = null;

    if (cachedStreetViewUrl?.includes('firebasestorage')) {
        // Cached URL — fetch heading separately (free metadata call)
        streetViewUrl = cachedStreetViewUrl;
        const headingResult = await fetchStreetViewHeading(lat, lng);
        streetViewHeading = headingResult?.heading ?? null;
    } else {
        // Try live Street View API — check metadata first (free call, also gives us heading)
        try {
            const headingResult = await fetchStreetViewHeading(lat, lng);
            if (headingResult) {
                streetViewHeading = headingResult.heading;
                streetViewUrl = buildStreetViewUrl(lat, lng, streetViewHeading);
                console.log('[Satellitary] No cached street view; using live Street View API with heading', streetViewHeading);
            } else {
                console.log('[Satellitary] Street View unavailable — running aerial-only analysis.');
            }
        } catch (e) {
            console.warn('[Satellitary] Street View metadata check failed; running aerial-only.', e);
        }
    }

    console.log('[Satellitary] Aerial URL:', aerialUrl);
    console.log('[Satellitary] Street View URL:', streetViewUrl ?? '(none — aerial-only)');
    console.log('[Satellitary] Street View heading:', streetViewHeading != null ? `${streetViewHeading}°` : '(unknown)');

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
    // Pass the known camera heading and address into the prompt so Gemini has maximum context
    const prompt = usesDualImage
        ? buildOrientationPromptDual(streetViewHeading, address)
        : buildOrientationPromptAerialOnly(address);

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

    // If Gemini flagged the satellite image as blurry, bail out early without saving
    if (data.image_quality === 'blurry' || data.final_orientation === 'UNCLEAR_IMAGE') {
        console.warn('[Satellitary] Image quality too low for reliable analysis — skipping orientation save.');
        return {
            ...data,
            image_quality: 'blurry',
            final_orientation: 'UNCLEAR_IMAGE',
            azimuth_degrees: null,
            confidence: 'low',
            feng_shui_vastu: null,
            privacy_insight: data.privacy_insight ?? '',
            lot_coverage_hardscape: data.lot_coverage_hardscape ?? null,
            lot_coverage_pervious: data.lot_coverage_pervious ?? null,
            buyer_pro: data.buyer_pro ?? '',
            buyer_con: data.buyer_con ?? '',
            aerial_url: aerialUrl,
            street_view_url: streetViewUrl ?? '',
            aerial_only_mode: !usesDualImage,
            geocoding_azimuth_degrees: geocodingResult?.azimuth ?? null,
            geocoding_orientation: geocodingResult?.orientation ?? null,
            geocoding_entrance_available: !!geocodingResult,
        };
    }

    const result: SatellitaryResult = {
        ...data,
        image_quality: data.image_quality ?? 'acceptable',
        azimuth_degrees: data.azimuth_degrees ?? null,
        feng_shui_vastu: data.feng_shui_vastu ?? null,
        privacy_insight: data.privacy_insight ?? '',
        lot_coverage_hardscape: data.lot_coverage_hardscape ?? null,
        lot_coverage_pervious: data.lot_coverage_pervious ?? null,
        buyer_pro: data.buyer_pro ?? '',
        buyer_con: data.buyer_con ?? '',
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
                image_quality: result.image_quality,
                feng_shui_vastu: result.feng_shui_vastu ?? null,
                privacy_insight: result.privacy_insight,
                lot_coverage_hardscape: result.lot_coverage_hardscape,
                lot_coverage_pervious: result.lot_coverage_pervious,
                buyer_pro: result.buyer_pro,
                buyer_con: result.buyer_con,
                orientation_highlights: result.orientation_highlights,
            },
            geocodingResult ? { azimuth_degrees: geocodingResult.azimuth, orientation: geocodingResult.orientation } : null
        ).catch(e => console.warn('[Satellitary] Orientation cache write failed (non-blocking):', e));
    }

    return result;
}
