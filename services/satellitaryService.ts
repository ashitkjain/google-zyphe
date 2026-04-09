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
import { buildOrientationPromptDual, buildOrientationPromptAerialOnly, satellitarySchema, getDualPromptFinalInstructions } from '../prompts/property/satellitaryAnalysis';
import { savePropertyOrientationToCloud } from './firebase/properties';
import { logOrientationVersion } from './firebase/orientation_history';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';

const getMapsApiKey = () => APP_CONFIG.maps.key;

export interface SatellitaryResult {
    final_orientation: string;        // e.g. "Northeast (approx. 45°)"
    azimuth_degrees: number | null;   // 0–360, GPS-accurate refined azimuth
    visual_azimuth_estimate: number | null; // The AI's raw visual guess before GPS refinement
    confidence: 'high' | 'medium' | 'low';
    property_layout_type: 'standard' | 'standard_lot' | 'corner_lot' | 'cul_de_sac' | 'flag_lot' | 'irregular_lot' | 'other';
    image_quality: 'clear' | 'acceptable' | 'blurry'; // Satellite image clarity assessment
    explanation: string;              // Detailed step-by-step reasoning
    feng_shui_vastu: string | null;   // Feng Shui / Vastu tips (null if not applicable)
    // Aerial analysis extras
    privacy_insight: string;          // Neighbor proximity & sightline assessment
    lot_coverage_hardscape: number | null;  // % of lot covered by hardscape (0-100)
    lot_coverage_pervious: number | null;   // % of lot covered by green/pervious space (0-100)
    buyer_pro: string;                // One buyer-facing Pro based on privacy + lot coverage
    buyer_con: string;                // One buyer-facing Con based on privacy + lot coverage
    orientation_highlights: string;   // Probabilistic comment on what this facing direction tends to mean
    // Tier 2: aerial site-feature analysis
    pool_visible: boolean | null;         // Is a pool/water body visible on the lot?
    pool_direction: string | null;        // Compass dir of pool from house (N/NE/E…), null if no pool
    garage_direction: string | null;      // Compass dir the garage/driveway opens toward
    open_sky_direction: string | null;    // Compass dir of most open/unobstructed yard
    // Image URLs
    aerial_url: string;               // Public URL of satellite image used
    street_view_url: string;          // Public URL of street view used (empty string if none)
    aerial_only_mode: boolean;        // true when no street view was available
    _debug?: any;                     // Internal metadata for auditing (heading, raw guess)
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
        `&key=${getMapsApiKey()}`
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
    const { getDownloadURL, ref } = await import('firebase/storage');
    const { storage } = await import('./firebase/config');
    const aerialUrl = buildAerialUrl(lat, lng);
    const storagePath = `properties/${zpid}/maps/aerial_satellite_scale2.jpg`;

    // 1. Try to get existing download URL first (free)
    if (storage) {
        try {
            const storageRef = ref(storage, storagePath);
            const existingUrl = await getDownloadURL(storageRef);
            console.log(`[Satellitary] Cache hit for ${zpid}: ${existingUrl}`);
            
            // Ensure the property doc is in sync with this URL
            const { savePropertyToCloud } = await import('./firebase/properties');
            await savePropertyToCloud(zpid, { satelliteImageUrl: existingUrl } as any).catch(() => {});
            
            return existingUrl;
        } catch (err: any) {
            // object-not-found is expected if this is the first run
            if (err?.code !== 'storage/object-not-found' && err?.code !== 'storage/unknown') {
                console.log(`[Satellitary] Cache miss for ${zpid} — proceeding to download.`);
            }
        }
    }

    // 2. Download and upload if not found
    const { uploadRemoteImageToStorage } = await import('./firebase/storage');
    const freshUrl = await uploadRemoteImageToStorage(aerialUrl, storagePath);

    // Persist the cached URL to Firestore under its own dedicated field
    if (freshUrl.includes('firebasestorage')) {
        const { savePropertyToCloud } = await import('./firebase/properties');
        savePropertyToCloud(zpid, { satelliteImageUrl: freshUrl } as any)
            .catch(e => console.warn('[Satellitary] Failed to cache satellite URL to property doc:', e));
    }

    return freshUrl;
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
 * Converts a degree azimuth (0-360) to a human-readable compass label.
 */
function azimuthToCompassLabel(azimuth: number | null): string {
    if (azimuth == null) return 'Unknown';
    const directions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    const index = Math.round(azimuth / 45) % 8;
    return `${directions[index]} (~${Math.round(azimuth)}°)`;
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
        `&key=${getMapsApiKey()}`
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
            `&key=${getMapsApiKey()}`;
        const meta = await fetch(metaUrl).then(r => r.json());

        // null == truly unavailable at this location
        if (meta.status !== 'OK') {

            return null;
        }

        // 1. Derive heading from panorama position → property position.
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
 * Computes the GPS-accurate azimuth using Gemini's explicit front-face determination.
 *
 * Gemini's \`street_view_shows_front\` boolean tells us how to use the GPS heading:
 *   - true  → camera is looking at the FRONT DOOR → front faces back toward camera → (heading+180)%360
 *   - false → camera is looking at something else (side garage/back) → trust Gemini's reasoned aerial estimate.
 *     (We can't safely assume it's the "back" because it might be a side-facing street.)
 *   - null  → ambiguous/not asked → fall back to proximity-based voting.
 */
function computeAccurateAzimuth(
    geminiAzimuth: number | null,
    heading: number | null,
    streetViewShowsFront: boolean | null | undefined
): number | null {
    // If we have no street view heading, we MUST trust Gemini's aerial estimate
    if (heading == null) return geminiAzimuth;

    // The heading is the CAMERA's looking direction.
    // If the camera looks at the FRONT face, the home faces BACK toward the camera (heading + 180).
    const candidateFront = (heading + 180) % 360;
    const candidateBack  = heading;
    const candidateLeft  = (heading + 90) % 360;
    const candidateRight = (heading + 270) % 360;

    // Use Gemini's visual guess from the aerial image to "vote" for which candidate is most likely.
    // Aerial guesses are usually fuzzy but get the "general quadrant" right.
    const angularDist = (a: number, b: number): number => {
        const d = Math.abs(a - b) % 360;
        return d > 180 ? 360 - d : d;
    };

    // If Gemini explicitly says street view is the front, we trust the heading+180 formula completely
    if (streetViewShowsFront === true) {
        return Math.round(candidateFront);
    }

    // If Gemini is unsure or says it's NOT the front (side/back), 
    // we use geminiAzimuth as a compass to pick the closest 90-degree orthogonal candidate.
    // This snaps Gemini's fuzzy visual guess to a GPS-accurate camera axis.
    if (geminiAzimuth != null) {
        const candidates = [
            { angle: candidateFront, weight: streetViewShowsFront === false ? 0.5 : 1.0 }, // discount front if Gemini said it's not the front
            { angle: candidateBack,  weight: streetViewShowsFront === false ? 1.5 : 1.0 }, // boost back/sides if Gemini said it's not the front
            { angle: candidateLeft,  weight: streetViewShowsFront === false ? 1.5 : 1.0 },
            { angle: candidateRight, weight: streetViewShowsFront === false ? 1.5 : 1.0 }
        ];

        let bestAngle = candidateFront;
        let minDist = 360;

        for (const c of candidates) {
            const d = angularDist(c.angle, geminiAzimuth);
            // Apply a small bias to the distance based on weight
            const weightedDist = d / c.weight; 
            if (weightedDist < minDist) {
                minDist = weightedDist;
                bestAngle = c.angle;
            }
        }
        return Math.round(bestAngle);
    }

    return geminiAzimuth;
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
    // Use the cached satellite downloader to ensure the image is persisted to Storage
    // and registered on the property doc as satelliteImageUrl.
    let aerialUrl: string;
    if (zpid) {
        aerialUrl = await getOrCacheAerialSatelliteUrl(zpid, lat, lng);
        console.log(`[Satellitary] Using secured satellite URL: ${aerialUrl}`);
    } else {
        aerialUrl = buildAerialUrl(lat, lng);
    }

    // Prefer Firebase Storage cached URL. Fall back to live Street View API.
    // If street view completely unavailable, run aerial-only analysis.
    let streetViewUrl: string | null = null;
    let streetViewHeading: number | null = null;

    // Always fetch the GPS heading from metadata (free call) regardless of cached URL.
    // A cached Firebase URL may have been stored without a heading param, meaning
    // the camera angle is unknown — sending that to Gemini causes wrong orientation.
    // We always build a fresh heading-locked live URL for AI analysis.
    try {
        const headingResult = await fetchStreetViewHeading(lat, lng);
        if (headingResult) {
            streetViewHeading = headingResult.heading;
            // Build a fresh URL with the heading baked in — used for AI analysis
            streetViewUrl = buildStreetViewUrl(lat, lng, streetViewHeading);
        } else if (!headingResult && !cachedStreetViewUrl) {
            // Truly unavailable (status !== OK) and no cached fallback → aerial-only
            streetViewUrl = null;
        } else if (!headingResult && cachedStreetViewUrl?.includes('firebasestorage')) {
            // Street view unavailable via metadata but we have a cached image — use it
            streetViewUrl = cachedStreetViewUrl;
        }
    } catch (e) {
        console.warn('[Satellitary] Street View metadata check failed; running aerial-only.', e);
        // Fall back to cached URL if we have one
        if (cachedStreetViewUrl?.includes('firebasestorage')) {
            streetViewUrl = cachedStreetViewUrl;
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
    const basePrompt = usesDualImage
        ? buildOrientationPromptDual(streetViewHeading, address, description)
        : buildOrientationPromptAerialOnly(address, description);

    // Reinforce final instructions to ensure accurate door-vs-garage differentiation for corner lots
    const prompt = basePrompt + "\n\n" + getDualPromptFinalInstructions(streetViewHeading);

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

    const resultAzimuth = computeAccurateAzimuth(
        data.azimuth_degrees ?? null,
        usesDualImage ? streetViewHeading : null,
        usesDualImage ? (data as any).street_view_shows_front ?? null : null
    );

    const result: SatellitaryResult = {
        ...data,
        image_quality: data.image_quality ?? 'acceptable',
        visual_azimuth_estimate: data.azimuth_degrees ?? null,
        azimuth_degrees: resultAzimuth,
        final_orientation: azimuthToCompassLabel(resultAzimuth),
        feng_shui_vastu: data.feng_shui_vastu ?? null,
        privacy_insight: data.privacy_insight ?? '',
        lot_coverage_hardscape: data.lot_coverage_hardscape ?? null,
        lot_coverage_pervious: data.lot_coverage_pervious ?? null,
        buyer_pro: data.buyer_pro ?? '',
        buyer_con: data.buyer_con ?? '',
        orientation_highlights: data.orientation_highlights ?? '',
        pool_visible: (data as any).pool_visible ?? null,
        pool_direction: (data as any).pool_direction ?? null,
        garage_direction: (data as any).garage_direction ?? null,
        open_sky_direction: (data as any).open_sky_direction ?? null,
        aerial_url: aerialUrl,
        street_view_url: streetViewUrl ?? '',
        aerial_only_mode: !usesDualImage,
        _debug: {
            streetViewHeading,
            geminiAzimuth: data.azimuth_degrees ?? null,
            streetViewShowsFront: (data as any).street_view_shows_front ?? null
        } as any
    };

    // ── 4. Cache results to Firestore (fire-and-forget) ───────────────────────
    if (zpid) {
        // Log orientation version for history
        const docRef = doc(db, 'properties', zpid);
        const propSnap = await getDoc(docRef);
        const propertyData = propSnap.data() as any;
        
        await logOrientationVersion({
            zpid,
            city: propertyData?.city || 'unknown',
            zip: propertyData?.zipCode || propertyData?.zip || 'unknown',
            orientation: result.final_orientation,
            azimuth: result.azimuth_degrees,
            layout: result.property_layout_type
        });

        // Main persistence
        savePropertyOrientationToCloud(
            zpid,
            {
                final_orientation: result.final_orientation,
                azimuth_degrees: result.azimuth_degrees,
                visual_azimuth_estimate: result.visual_azimuth_estimate,
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
                pool_visible: result.pool_visible ?? null,
                pool_direction: result.pool_direction ?? null,
                garage_direction: result.garage_direction ?? null,
                open_sky_direction: result.open_sky_direction ?? null,
                layout: result.property_layout_type,
            }
        ).catch(e => console.warn('[Satellitary] Orientation cache write failed (non-blocking):', e));
    }

    return result;
}
