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

import { isTargetForOrientationAnalysis } from '../utils/propertyPolicies';

const getMapsApiKey = () => APP_CONFIG.maps.key;

/**
 * Removes orientation-related data from a property document and deletes its history.
 * Accepts optional city + zip so it can navigate straight to the known subcollection path
 * (orientation_versions/{city}/zips/{zip}/zpids/{zpid}/history) without needing a
 * collectionGroup index. Falls back to collectionGroup only when city/zip are absent.
 */
export async function deleteOrientationVersionsForProperty(
    zpid: string,
    city?: string | null,
    zip?: string | null,
): Promise<{ deleted: boolean }> {
    const { collection, getDocs, writeBatch, deleteField } = await import('firebase/firestore');

    try {
        // 1. Clear orientation fields on property document (exact Firestore snake_case names)
        const propRef = doc(db, 'properties', zpid);
        await updateDoc(propRef, {
            orientation_ai: deleteField(),
            orientation_calculated_at: deleteField(),
            orientation_history: deleteField(),
            satelliteImageUrl: deleteField(),
        });

        // 2. Delete history subcollection docs
        // Use the known direct path when city+zip are provided (no index required).
        // Fall back to collectionGroup only as a last resort.
        let historySnap: any;
        if (city && zip) {
            const historyColRef = collection(
                db,
                'orientation_versions', city.trim(),
                'zips', zip.trim(),
                'zpids', zpid,
                'history'
            );
            historySnap = await getDocs(historyColRef);
        } else {
            // Fallback: collectionGroup (requires Firestore index on zpid)
            const { collectionGroup, query, where } = await import('firebase/firestore');
            const q = query(collectionGroup(db, 'history'), where('zpid', '==', zpid));
            historySnap = await getDocs(q);
        }

        if (!historySnap.empty) {
            const batch = writeBatch(db);
            historySnap.docs.forEach((d: any) => batch.delete(d.ref));
            await batch.commit();
            console.log(`[Satellitary] Deleted ${historySnap.size} orientation history records for ${zpid}`);
        }

        return { deleted: true };
    } catch (e) {
        console.error(`[Satellitary] Cleanup failed for ${zpid}:`, e);
        return { deleted: false };
    }
}

export interface SatellitaryResult {
    final_orientation: string;        // e.g. "Northeast (approx. 45°)"
    azimuth_degrees: number | null;   // 0–360, GPS-accurate refined azimuth
    visual_azimuth_estimate: number | null; // The AI's raw visual guess before GPS refinement
    confidence: 'high' | 'medium' | 'low';
    property_layout_type: 'standard' | 'corner_lot' | 'cul_de_sac' | 'flag_lot' | 'irregular_lot' | 'other';
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
            await savePropertyToCloud(zpid, { satelliteImageUrl: existingUrl } as any).catch(() => { });

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
 * Extracts just the street name from a full address string.
 * "4052 Knightstown St, Dublin, CA 94568 US" → "knightstown st"
 * Used to match panos to the property's front street by name.
 */
function extractStreetName(address: string): string {
    // Remove house number (leading digits + optional directly-attached letter like "123A"),
    // then the mandatory whitespace, grab everything before the first comma.
    // e.g. "4052 Knightstown St, Dublin..." → "knightstown st"
    //      "123B Oak Ave, ..."              → "oak ave"
    return (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim().toLowerCase();
}

/** Compute compass bearing (0–360°) from (lat1,lng1) to (lat2,lng2). */
function computeBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const φ1 = lat1 * (Math.PI / 180);
    const φ2 = lat2 * (Math.PI / 180);
    const dλ = (lng2 - lng1) * (Math.PI / 180);
    const y = Math.sin(dλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
    return Math.round(((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360);
}

/**
 * Fetches a Street View pano for the property and derives the camera heading.
 *
 * Simple principle: "house is on the left/right of a named street → front faces that street."
 *
 * Step 1: fetch the nearest pano (existing behaviour, radius=100m).
 * Step 2: if `address` is provided, reverse-geocode the pano to check the road name.
 *         If the pano road does NOT match the address street (e.g. pano landed on a
 *         back alley instead of the front street), try panos at ±60m offsets in all
 *         four cardinal directions until we find one on the correct street.
 * Step 3: return bearing(winning pano → property) as the heading.
 *
 * Returns null only when Street View is genuinely unavailable everywhere (status !== 'OK').
 */
async function fetchStreetViewHeading(
    propertyLat: number,
    propertyLng: number,
    address?: string | null
): Promise<{ heading: number | null; status: string; panoCoords?: { lat: number; lng: number } } | null> {

    const apiKey = getMapsApiKey();

    /** Fetch Street View metadata for a search point, return pano location + status. */
    const fetchPanoAt = async (lat: number, lng: number, radius = 100) => {
        const url =
            `https://maps.googleapis.com/maps/api/streetview/metadata` +
            `?location=${lat},${lng}&radius=${radius}&source=outdoor&key=${apiKey}`;
        try {
            return await fetch(url).then(r => r.json()) as any;
        } catch { return null; }
    };

    /** Reverse-geocode a latlng and return the first road/route name (lower-case). */
    const getRoadName = async (lat: number, lng: number): Promise<string> => {
        try {
            const url =
                `https://maps.googleapis.com/maps/api/geocode/json` +
                `?latlng=${lat},${lng}&result_type=route&key=${apiKey}`;
            const res = await fetch(url).then(r => r.json()) as any;
            const name = res.results?.[0]?.address_components?.find(
                (c: any) => c.types.includes('route')
            )?.long_name || '';
            return name.toLowerCase();
        } catch { return ''; }
    };

    try {
        // ── Step 1: nearest pano ──────────────────────────────────────────────────
        const primaryMeta = await fetchPanoAt(propertyLat, propertyLng);
        if (!primaryMeta || primaryMeta.status !== 'OK') return null;

        const primaryPano = primaryMeta.location as { lat: number; lng: number } | undefined;

        // ── Step 2: if we have an address, verify the pano is on the right street ─
        if (address && primaryPano?.lat != null) {
            const targetStreet = extractStreetName(address); // e.g. "knightstown st"

            if (targetStreet) {
                const primaryRoad = await getRoadName(primaryPano.lat, primaryPano.lng);

                // Fuzzy match: remove spaces/punctuation and compare first 4 chars
                const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                const targetNorm = normalize(targetStreet);
                const primaryNorm = normalize(primaryRoad);

                const onFrontStreet = primaryNorm.includes(targetNorm.substring(0, 4));

                if (!onFrontStreet) {
                    // Primary pano is on the wrong road (e.g. back alley).
                    // Try 4 offsets ~80m in each cardinal direction to find the front street.
                    const OFFSET = 0.00075; // ≈ 80 m
                    const offsets = [
                        [propertyLat + OFFSET, propertyLng],          // N
                        [propertyLat - OFFSET, propertyLng],          // S
                        [propertyLat, propertyLng + OFFSET],  // E
                        [propertyLat, propertyLng - OFFSET],  // W
                    ];
                    for (const [oLat, oLng] of offsets) {
                        const altMeta = await fetchPanoAt(oLat, oLng, 80);
                        const altPano = altMeta?.location as { lat: number; lng: number } | undefined;
                        if (altMeta?.status !== 'OK' || !altPano?.lat) continue;

                        const altRoad = await getRoadName(altPano.lat, altPano.lng);
                        const altNorm = (altRoad || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        // targetNorm and targetStreet should be available in the scope
                        if (altNorm.includes(targetStreet.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 4))) {
                            // Found a pano on the correct (front) street → use it.
                            // IMPORTANT: also return panoCoords so the caller builds the
                            // Street View *image* URL from this pano, not from the property
                            // centroid (which would revert to the nearest/wrong pano).
                            console.log(`[Satellitary] Switched to front-street pano: ${altRoad} (was ${primaryRoad})`);
                            return {
                                heading: computeBearing(altPano.lat, altPano.lng, propertyLat, propertyLng),
                                status: altMeta.status,
                                panoCoords: { lat: altPano.lat, lng: altPano.lng },
                            };
                        }
                    }
                    // None of the offsets found the named street — fall through to primary pano
                    console.warn(`[Satellitary] Could not find pano on "${targetStreet}"; using nearest (${primaryRoad})`);
                }
            }
        }

        // ── Step 3: use primary pano ──────────────────────────────────────────────
        if (primaryPano?.lat != null && primaryPano?.lng != null) {
            return {
                heading: computeBearing(primaryPano.lat, primaryPano.lng, propertyLat, propertyLng),
                status: primaryMeta.status,
                panoCoords: { lat: primaryPano.lat, lng: primaryPano.lng },
            };
        }

        return { heading: null, status: primaryMeta.status };

    } catch (e) {
        console.warn('[Satellitary] Failed to fetch street view heading:', e);
        return null;
    }
}

/**
 * Computes the GPS-accurate azimuth using Gemini's explicit front-face determination.
 *
 * `heading` = bearing(pano → property): the compass direction FROM the Street View
 * camera TO the house. This gives us two GPS-grounded candidate front azimuths:
 *
 *   candidateFront = (heading + 180) % 360
 *     → the face the camera is LOOKING AT (visible face).
 *     → front = this face when shows_front = true.
 *
 *   candidateBack = heading
 *     → the face pointing TOWARD where the camera came from (the other street).
 *     → front = this face when shows_front = false (camera on back/side road).
 *
 * Side candidates (heading ± 90°) are intentionally excluded to prevent the
 * systematic 90° errors seen on cul-de-sac and complex lots where aerials drift.
 *
 * Gemini's `street_view_shows_front` boolean tells us which candidate wins:
 *   - true  → camera sees FRONT DOOR → front = candidateFront
 *   - false → camera sees BACK/SIDE  → front = candidateBack
 *             (e.g. pano is on a back alley; GPS bearing still gives correct answer)
 *   - null  → ambiguous → proximity-vote between front and back only
 */
function computeAccurateAzimuth(
    geminiAzimuth: number | null,
    heading: number | null,
    streetViewShowsFront: boolean | null | undefined
): number | null {
    // No heading → can't GPS-correct; trust Gemini's aerial estimate
    if (heading == null) return geminiAzimuth;

    const angularDist = (a: number, b: number): number => {
        const d = Math.abs(a - b) % 360;
        return d > 180 ? 360 - d : d;
    };

    const candidateFront = (heading + 180) % 360;  // face VISIBLE to camera
    const candidateBack = heading;                  // face AWAY from camera (toward camera's street)

    // Gemini definitively identified the FRONT DOOR → snap to the visible face
    if (streetViewShowsFront === true) {
        return Math.round(candidateFront);
    }

    // Gemini says NOT the front door (back or side visible).
    // The GPS bearing from pano→property points toward the house from the camera's side road.
    // → The front faces in that SAME direction (candidateBack = heading).
    // This correctly handles back-alley panos: if camera on west alley sees the back,
    // candidateBack = East = front street direction ✓
    if (streetViewShowsFront === false) {
        return Math.round(candidateBack);
    }

    // Ambiguous (null/undefined): trust Gemini's high-level spatial reasoning 
    // over my distance-based candidate logic. Aerial reasoning (driveways/walkways)
    // is often more stable than guessing which face a side-street pano sees.
    return geminiAzimuth;
}

// ─── Description-First Orientation ───────────────────────────────────────────

const DIRECTION_MAP: Record<string, { label: string; azimuth: number }> = {
    'north': { label: 'North', azimuth: 0 },
    'northeast': { label: 'Northeast', azimuth: 45 },
    'east': { label: 'East', azimuth: 90 },
    'southeast': { label: 'Southeast', azimuth: 135 },
    'south': { label: 'South', azimuth: 180 },
    'southwest': { label: 'Southwest', azimuth: 225 },
    'west': { label: 'West', azimuth: 270 },
    'northwest': { label: 'Northwest', azimuth: 315 },
    'ne': { label: 'Northeast', azimuth: 45 },
    'se': { label: 'Southeast', azimuth: 135 },
    'sw': { label: 'Southwest', azimuth: 225 },
    'nw': { label: 'Northwest', azimuth: 315 },
};

/**
 * Scans a listing description for explicit orientation phrases and returns the
 * front-door direction if found with high confidence.
 *
 * Handles front-of-house phrases:
 *   "north-facing", "facing north", "north facing", "faces north"
 *
 * Handles backyard phrases (front = opposite):
 *   "east-facing backyard/yard/garden/patio" → front faces West
 *
 * Returns null when no clear orientation phrase is present so Gemini runs normally.
 */
export function extractOrientationFromDescription(
    description: string | string[] | null | undefined
): { direction: string; azimuth: number } | null {
    if (!description) return null;
    const text = (Array.isArray(description) ? description.join(' ') : description).toLowerCase();

    const DIRS = 'north(?:east|west)?|south(?:east|west)?|east|west|ne|nw|se|sw';
    // Words that indicate the described direction is the BACKYARD (so front = opposite).
    const BACK_WORDS = /\b(backyard|back[\s-]yard|rear\s+yard|garden|patio|pool area|rear\s+exposure)\b/;
    // Words that confirm a front-facing reference.
    const FRONT_WORDS = /\b(home|house|front|entry|entrance|door|property|lot|unit|condo|townhome|facing home)\b/;

    /** Resolve direction key → {label, azimuth}, or null. */
    const resolve = (key: string) => DIRECTION_MAP[key.toLowerCase()] ?? null;

    /** Flip a cardinal azimuth 180°. */
    const opposite = (az: number) => (az + 180) % 360;
    const labelFor = (az: number) =>
        Object.values(DIRECTION_MAP).find(v => v.azimuth === az)?.label ?? String(az);

    // ── Pattern 1: "(dir)-facing (word)" ──────────────────────────────────────
    const hyphenRe = new RegExp(`(${DIRS})-facing\\s*(\\w+(?:[\\s-]\\w+)?)`, 'gi');
    for (const m of text.matchAll(hyphenRe)) {
        const info = resolve(m[1]);
        const context = m[2]?.toLowerCase() ?? '';
        if (!info) continue;
        if (BACK_WORDS.test(context)) {
            // "east-facing backyard" → front faces West
            const az = opposite(info.azimuth);
            return { direction: labelFor(az), azimuth: az };
        }
        // Everything else → treat as front-facing
        return { direction: info.label, azimuth: info.azimuth };
    }

    // ── Pattern 2: "facing (dir)" ──────────────────────────────────────────────
    const facingRe = new RegExp(`\\bfacing\\s+(${DIRS})\\b`, 'gi');
    for (const m of text.matchAll(facingRe)) {
        const info = resolve(m[1]);
        if (info) return { direction: info.label, azimuth: info.azimuth };
    }

    // ── Pattern 3: "(dir) facing" (standalone, not already caught by pattern 1) ─
    const dirFacingRe = new RegExp(`\\b(${DIRS})\\s+facing\\b`, 'gi');
    for (const m of text.matchAll(dirFacingRe)) {
        const info = resolve(m[1]);
        if (info) return { direction: info.label, azimuth: info.azimuth };
    }

    // ── Pattern 4: "faces (dir)" ───────────────────────────────────────────────
    const facesRe = new RegExp(`\\bfaces\\s+(${DIRS})\\b`, 'gi');
    for (const m of text.matchAll(facesRe)) {
        const info = resolve(m[1]);
        if (info) return { direction: info.label, azimuth: info.azimuth };
    }

    return null;
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
    let result: SatellitaryResult | null = null;
    let usesDualImage = false;
    let streetViewHeading: number | null = null;
    let aerialUrl: string;
    let streetViewUrl: string | null = null;

    // ── 0. Description-first: skip Gemini if orientation is explicit ──────────
    const descMatch = extractOrientationFromDescription(description);
    if (descMatch) {
        console.log(`[Satellitary] Orientation from description: ${descMatch.direction} (~${descMatch.azimuth}°) — skipping Gemini.`);
        aerialUrl = zpid
            ? await getOrCacheAerialSatelliteUrl(zpid, lat, lng)
            : buildAerialUrl(lat, lng);
        
        result = {
            final_orientation: `${descMatch.direction} (~${descMatch.azimuth}°)`,
            azimuth_degrees: descMatch.azimuth,
            visual_azimuth_estimate: descMatch.azimuth,
            confidence: 'high',
            property_layout_type: 'standard',
            image_quality: 'clear',
            explanation: `Orientation extracted directly from listing description. No AI analysis required.`,
            feng_shui_vastu: null,
            privacy_insight: 'Not assessed — orientation sourced from listing description.',
            lot_coverage_hardscape: null,
            lot_coverage_pervious: null,
            buyer_pro: '',
            buyer_con: '',
            orientation_highlights: '',
            pool_visible: null,
            pool_direction: null,
            garage_direction: null,
            open_sky_direction: null,
            aerial_url: aerialUrl,
            street_view_url: '',
            aerial_only_mode: false,
        };
    }

    if (!result) {
        // ── 1. Resolve image URLs ──────────────────────────────────────────────────
        if (zpid) {
            aerialUrl = await getOrCacheAerialSatelliteUrl(zpid, lat, lng);
            console.log(`[Satellitary] Using secured satellite URL: ${aerialUrl}`);
        } else {
            aerialUrl = buildAerialUrl(lat, lng);
        }

        // Always fetch the GPS heading from metadata (free call) to ensure heading-locked URL
        try {
            const headingResult = await fetchStreetViewHeading(lat, lng, address);
            if (headingResult) {
                streetViewHeading = headingResult.heading;
                const svLat = headingResult.panoCoords?.lat ?? lat;
                const svLng = headingResult.panoCoords?.lng ?? lng;
                streetViewUrl = buildStreetViewUrl(svLat, svLng, streetViewHeading);
            } else if (!headingResult && !cachedStreetViewUrl) {
                streetViewUrl = null;
            } else if (!headingResult && cachedStreetViewUrl?.includes('firebasestorage')) {
                streetViewUrl = cachedStreetViewUrl;
            }
        } catch (e) {
            console.warn('[Satellitary] Street View metadata check failed; running aerial-only.', e);
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

        usesDualImage = !!streetB64;
        const basePrompt = usesDualImage
            ? buildOrientationPromptDual(streetViewHeading, address, description)
            : buildOrientationPromptAerialOnly(address, description);

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

        const resultAzimuth = computeAccurateAzimuth(
            data.azimuth_degrees ?? null,
            usesDualImage ? streetViewHeading : null,
            usesDualImage ? (data as any).street_view_shows_front ?? null : null
        );

        result = {
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
    }

    // ── 4. Cache results to Firestore (fire-and-forget) ───────────────────────
    if (zpid && result) {
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
            property_layout_type: result.property_layout_type
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
                property_layout_type: result.property_layout_type,
            }
        ).catch(e => console.warn('[Satellitary] Orientation cache write failed (non-blocking):', e));
    }

    return result;
}
