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
import { buildOrientationPromptDual, buildOrientationPromptAerialOnly, satellitarySchema } from '../prompts/property/satellitaryAnalysis';
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
        `&markers=color:red%7Csize:mid%7C${lat},${lng}` +
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

    // Persist the cached URL to Firestore under its own dedicated field
    if (cachedUrl.includes('firebasestorage')) {
        savePropertyToCloud(zpid, { satelliteImageUrl: cachedUrl } as any)
            .catch(e => console.warn('[Satellitary] Failed to cache satellite URL to property doc:', e));
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
        savePropertyToCloud(zpid, { satelliteImageUrl: freshUrl } as any)
            .catch(e => console.warn('[Satellitary] Failed to update satellite URL in property doc:', e));
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
    address?: string,
    description?: string | null
): Promise<SatellitaryResult & { freshAerialUrl: string; freshStreetViewUrl: string }> {


    // Step 1 & 2: Re-download both images in parallel
    const [freshAerialUrl, freshStreetViewUrl] = await Promise.all([
        forceRefreshAerialSatelliteUrl(zpid, lat, lng),
        forceRefreshStreetViewUrl(zpid, lat, lng),
    ]);


    // Step 3: Run analysis with fresh images
    // Pass the freshStreetViewUrl as the cachedStreetViewUrl so the analysis skips
    // the metadata check and uses the image we just uploaded.
    const result = await runSatellitaryAnalysis(
        lat,
        lng,
        freshStreetViewUrl || null,
        userId,
        zpid,
        address,
        description
    );

    return { ...result, freshAerialUrl, freshStreetViewUrl };
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
 *      us the precise camera heading using the standard spherical-Earth atan2 formula.
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

            return null;
        }

        // 1. Use the API-provided heading if present
        if (meta.heading != null) {
            const heading = Math.round(meta.heading);

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

            return { heading: bearing, status: meta.status };
        }

        // Panorama location missing — street view available but no heading derivable

        return { heading: null, status: meta.status };

    } catch (e) {
        console.warn('[Satellitary] Failed to fetch street view heading:', e);
        return null;
    }
}

/**
 * Replaces Gemini's visual azimuth estimate with a GPS-accurate value.
 *
 * We have two candidate azimuths from the GPS-derived street view heading:
 *   - heading          → front = the direction the camera was POINTING (camera looked at the back)
 *   - (heading+180)%360 → front = opposite of camera direction (camera looked at the front)
 *
 * We pick whichever candidate is angularly closest to Gemini's stated direction,
 * then use that GPS-precise value instead of the AI's visual guess.
 *
 * Falls back to Gemini's estimate when:
 *   - No heading available (aerial-only mode)
 *   - The two candidates are equidistant (camera perpendicular to front wall — ambiguous)
 */
function computeAccurateAzimuth(
    geminiAzimuth: number | null,
    heading: number | null
): number | null {
    if (heading == null || geminiAzimuth == null) return geminiAzimuth;

    const angularDist = (a: number, b: number): number => {
        const d = Math.abs(a - b) % 360;
        return d > 180 ? 360 - d : d;
    };

    const candidateFront = (heading + 180) % 360;  // camera photographed the FRONT
    const candidateBack  = heading;                 // camera photographed the BACK (front = opposite)

    const dFront = angularDist(candidateFront, geminiAzimuth);
    const dBack  = angularDist(candidateBack,  geminiAzimuth);

    // If both are equidistant (camera perpendicular to front wall), keep Gemini's estimate
    if (Math.abs(dFront - dBack) < 5) return geminiAzimuth;

    return dFront < dBack ? candidateFront : candidateBack;
}

export async function runSatellitaryAnalysis(
    lat: number,
    lng: number,
    cachedStreetViewUrl?: string | null,
    userId: string = 'unknown',
    zpid?: string,
    address?: string,
    description?: string | null
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
            }
        } catch (e) {
            console.warn('[Satellitary] Street View metadata check failed; running aerial-only.', e);
        }
    }



    // ── 2. Fetch base64 images in parallel ─────────────────────────────────────
    const aerialB64Promise = urlToBase64(aerialUrl);
    const streetB64Promise = streetViewUrl ? urlToBase64(streetViewUrl) : Promise.resolve(null);

    const [aerialB64, streetB64] = await Promise.all([
        aerialB64Promise,
        streetB64Promise,
    ]);

    const usesDualImage = !!streetB64;
    // Pass the known camera heading, address, and listing description into the prompt
    // so Gemini has maximum context (description may contain explicit facing direction)
    const prompt = usesDualImage
        ? buildOrientationPromptDual(streetViewHeading, address, description)
        : buildOrientationPromptAerialOnly(address, description);

    // ── 3. Call Gemini ────────────────────────────────────────────────────────
    const parts: any[] = [
        { text: prompt },
        { inlineData: { data: aerialB64.data, mimeType: aerialB64.mimeType } },
    ];
    if (streetB64) {
        parts.push({ inlineData: { data: streetB64.data, mimeType: streetB64.mimeType } });
    }

    const { data } = await executeGeminiRequest<Omit<SatellitaryResult, 'aerial_url' | 'street_view_url' | 'aerial_only_mode'>>({
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
        };
    }

    const result: SatellitaryResult = {
        ...data,
        image_quality: data.image_quality ?? 'acceptable',
        azimuth_degrees: computeAccurateAzimuth(data.azimuth_degrees ?? null, usesDualImage ? streetViewHeading : null),
        feng_shui_vastu: data.feng_shui_vastu ?? null,
        privacy_insight: data.privacy_insight ?? '',
        lot_coverage_hardscape: data.lot_coverage_hardscape ?? null,
        lot_coverage_pervious: data.lot_coverage_pervious ?? null,
        buyer_pro: data.buyer_pro ?? '',
        buyer_con: data.buyer_con ?? '',
        orientation_highlights: data.orientation_highlights ?? '',
        aerial_url: aerialUrl,
        street_view_url: streetViewUrl ?? '',
        aerial_only_mode: !usesDualImage,
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
            }
        ).catch(e => console.warn('[Satellitary] Orientation cache write failed (non-blocking):', e));
    }

    return result;
}
