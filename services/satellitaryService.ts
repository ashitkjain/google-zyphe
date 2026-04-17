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

// Use a stronger model for orientation — spatial reasoning is the hardest task in the pipeline.
// Swapping independently of FLASH_MODEL so other services are unaffected.
const ORIENTATION_MODEL = 'gemini-2.5-flash-preview-04-17';



import { buildOrientationPromptDual, buildOrientationPromptAerialOnly, satellitarySchema, getDualPromptFinalInstructions } from '../prompts/property/satellitaryAnalysis';
import { savePropertyOrientationToCloud } from './firebase/properties';
import { logOrientationVersion, setGroundTruthFromDescription } from './firebase/orientation_history';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';

import { isTargetForOrientationAnalysis } from '../utils/propertyPolicies';

const getMapsApiKey = () => APP_CONFIG.maps.key;

/**
 * Removes orientation-related data from a property document and clears its AI run history
 * from orientation_ground_truth/{zpid}.test_results (automated entries only).
 * Manual tester entries are preserved.
 */
export async function deleteOrientationVersionsForProperty(
    zpid: string,
    city?: string | null,
    zip?: string | null,
): Promise<{ deleted: boolean }> {
    const { deleteField, getDoc: firestoreGetDoc } = await import('firebase/firestore');

    try {
        // 1. Clear orientation fields on property document
        const propRef = doc(db, 'properties', zpid);
        await updateDoc(propRef, {
            orientation_ai: deleteField(),
            orientation_calculated_at: deleteField(),
            orientation_history: deleteField(),
            satelliteImageUrl: deleteField(),
        });

        // 2. Strip automated test_results from orientation_ground_truth (keep manual entries)
        const { doc: fsDoc, getDoc: fsGetDoc, updateDoc: fsUpdateDoc } = await import('firebase/firestore');
        const gtRef = fsDoc(db, 'orientation_ground_truth', zpid);
        const gtSnap = await fsGetDoc(gtRef);
        if (gtSnap.exists()) {
            const existing = gtSnap.data()?.test_results ?? [];
            const manualOnly = existing.filter((r: any) => r.tester !== 'automated');
            await fsUpdateDoc(gtRef, { test_results: manualOnly });
            const removed = existing.length - manualOnly.length;
            if (removed > 0) {
                console.log(`[Satellitary] Cleared ${removed} automated orientation entries for ${zpid} from ground truth`);
            }
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
    // At zoom=20, the image covers ~75m N-S. Offset +0.00027° places the
    // "N" indicator ~30m north of center — top quarter of the frame.
    const northLat = Math.round((lat + 0.00027) * 1e7) / 1e7;
    return (
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=20` +
        `&size=640x640` +
        `&scale=2` +
        `&maptype=satellite` +
        `&markers=color:red%7Csize:tiny%7C${lat},${lng}` +
        `&markers=color:blue%7Csize:tiny%7Clabel:N%7C${northLat},${lng}` +
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
        // Persist the new URL AND heading back to the property doc.
        // Storing the heading lets the wrong-road fallback in runSatellitaryAnalysis
        // recover correct dual-direct analysis even when the metadata API later lands
        // on an adjacent road (streetViewHeadingDeg will be used instead of re-deriving).
        savePropertyToCloud(zpid, {
            streetView: freshUrl,
            streetViewHeadingDeg: headingResult.heading,
        } as any)
            .catch(e => console.warn('[Satellitary] Failed to persist street view URL:', e));
    }

    return freshUrl;
}

/**
 * Lightweight backfill: calls the Street View Metadata API for a single property
 * and stores the camera heading in Firestore as `streetViewHeadingDeg`.
 * Does NOT re-download or re-upload any images — metadata call only (~free).
 * Used by the Orientation Audit "Backfill Headings" button to populate the
 * heading for all cached-URL properties so the wrong-road fallback can activate.
 *
 * Returns the heading written (degrees), or null if no Street View coverage.
 */
export async function backfillStreetViewHeadingDeg(
    zpid: string,
    lat: number,
    lng: number
): Promise<number | null> {
    const { savePropertyToCloud } = await import('./firebase/properties');
    const headingResult = await fetchStreetViewHeading(lat, lng);
    if (!headingResult?.heading) return null;
    await savePropertyToCloud(zpid, { streetViewHeadingDeg: headingResult.heading } as any);
    return headingResult.heading;
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
    description?: string | null,
    homeType?: string | null,
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
        description,
        homeType,
    );

    return { ...result, freshAerialUrl, freshStreetViewUrl };
}




/**
 * Converts a degree azimuth (0-360) to a human-readable compass label.
 * Within 5° of any sector boundary the intercardinal (corner) direction is
 * preferred. e.g. 20° → "Northeast (~20°)" rather than "North (~20°)".
 * Rationale: boundary cases visually appear as corners; snapping to the
 * corner direction avoids false GT mismatches and matches Vastu intuition.
 */
function azimuthToCompassLabel(azimuth: number | null): string {
    if (azimuth == null) return 'Unknown';
    const az = ((azimuth % 360) + 360) % 360;

    // Each entry: [boundary°, preferred intercardinal label]
    // Boundaries lie between cardinal ↔ intercardinal sectors.
    // Within 5° of any boundary → snap to the intercardinal (NE/SE/SW/NW).
    const SNAP: [number, string][] = [
        [22.5,  'Northeast'], // N  ↔ NE
        [67.5,  'Northeast'], // NE ↔ E
        [112.5, 'Southeast'], // E  ↔ SE
        [157.5, 'Southeast'], // SE ↔ S
        [202.5, 'Southwest'], // S  ↔ SW
        [247.5, 'Southwest'], // SW ↔ W
        [292.5, 'Northwest'], // W  ↔ NW
        [337.5, 'Northwest'], // NW ↔ N
    ];
    for (const [boundary, label] of SNAP) {
        // Angular distance handles the 0°/360° wrap correctly
        const diff = Math.abs(((az - boundary + 540) % 360) - 180);
        if (diff <= 5) return `${label} (~${Math.round(az)}°)`;
    }

    const dirs = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    return `${dirs[Math.round(az / 45) % 8]} (~${Math.round(az)}°)`;
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
 * Computes the bearing of the address street by geocoding a 2nd point ~200 house
 * numbers away. Validates both points are on the same road before trusting result.
 */
async function getStreetBearing(address: string): Promise<{ bearing: number | null; streetSide: 'N' | 'S' | 'E' | 'W' | null } | null> {
    const apiKey = getMapsApiKey();
    const match = address.match(/^(\d+)/);
    if (!match) return null;
    const houseNum = parseInt(match[1], 10);

    // Try smaller offsets first to stay on the same curved road segment.
    // Larger offsets can span curves and give a misleading average bearing.
    const offsets = [50, 100];
    const STABILITY_THRESHOLD_DEG = 30; // if two offsets disagree by more than this, road is curved/ambiguous
    try {
        const geocodeWithRoad = async (addr: string): Promise<{ lat: number; lng: number; road: string } | null> => {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${apiKey}`;
            const res = await fetch(url).then(r => r.json()) as any;
            const result = res.results?.[0];
            if (!result) return null;
            const loc = result.geometry?.location;
            const road = (result.address_components?.find((c: any) => c.types.includes('route'))?.long_name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
            return loc ? { lat: loc.lat as number, lng: loc.lng as number, road } : null;
        };

        const p1 = await geocodeWithRoad(address);
        if (!p1) return null;

        const bearings: { offset: number; bearing: number; dist: number; p2lat: number; p2lng: number }[] = [];
        for (const offset of offsets) {
            const neighborAddress = address.replace(/^\d+/, String(houseNum + offset));
            const p2 = await geocodeWithRoad(neighborAddress);
            if (!p2) continue;
            if (p1.road && p2.road && p1.road !== p2.road) {
                console.log(`[Satellitary] getStreetBearing: offset +${offset} road mismatch "${p1.road}" vs "${p2.road}" — skipping`);
                continue;
            }
            const dlat = (p2.lat - p1.lat) * 111320;
            const dlng = (p2.lng - p1.lng) * 111320 * Math.cos(p1.lat * Math.PI / 180);
            const dist = Math.sqrt(dlat * dlat + dlng * dlng);
            if (dist < 20) {
                console.log(`[Satellitary] getStreetBearing: offset +${offset} too close (${Math.round(dist)}m) — skipping`);
                continue;
            }
            const bearing = computeBearing(p1.lat, p1.lng, p2.lat, p2.lng);
            bearings.push({ offset, bearing, dist, p2lat: p2.lat, p2lng: p2.lng });
            console.log(`[Satellitary] getStreetBearing: offset +${offset} → ${Math.round(bearing)}° (dist=${Math.round(dist)}m), p2=[${p2.lat.toFixed(5)},${p2.lng.toFixed(5)}]`);
        }

        if (bearings.length === 0) return null;

        // Derive rough cardinal street side from aggregate p2 positions
        // (reliable even when bearing is unstable because the road curves).
        const avgDlat = bearings.reduce((s, b) => s + (b.p2lat - p1.lat), 0) / bearings.length;
        const avgDlng = bearings.reduce((s, b) => s + (b.p2lng - p1.lng), 0) / bearings.length;
        const streetSide: 'N' | 'S' | 'E' | 'W' = Math.abs(avgDlat) >= Math.abs(avgDlng * Math.cos(p1.lat * Math.PI / 180))
            ? (avgDlat > 0 ? 'N' : 'S')
            : (avgDlng > 0 ? 'E' : 'W');
        console.log(`[Satellitary] getStreetBearing: street extends to the ${streetSide} of the property (avgDlat=${avgDlat.toFixed(5)}, avgDlng=${avgDlng.toFixed(5)})`);

        // Stability check: if we have two bearings, verify they agree within threshold.
        // Disagreement means the address numbers span different road segments (curve, loop, etc).
        if (bearings.length >= 2) {
            const angDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
            const diff = angDist(bearings[0].bearing, bearings[1].bearing);
            if (diff > STABILITY_THRESHOLD_DEG) {
                console.log(`[Satellitary] getStreetBearing: bearings disagree by ${Math.round(diff)}° — bearing suppressed, but streetSide=${streetSide} still usable`);
                return { bearing: null, streetSide };
            }
        }

        // Use the closest-offset bearing as the most local estimate
        const best = bearings[0];
        console.log(`[Satellitary] getStreetBearing: using offset +${best.offset}, bearing=${Math.round(best.bearing)}°, streetSide=${streetSide}`);
        return { bearing: best.bearing, streetSide };
    } catch { return null; }
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
): Promise<{ heading: number | null; status: string; panoCoords?: { lat: number; lng: number }; candidatePanos?: Array<{ lat: number; lng: number; heading: number; dir: 'N' | 'S' | 'E' | 'W' }> } | null> {

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
        let wrongRoadPrimary = false;

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
                    // Primary pano landed on the wrong road. Before jumping to multi-pano,
                    // try a wider radius (150m) — some properties have Street View on their
                    // own street that's just slightly further than 100m.
                    const widerMeta = await fetchPanoAt(propertyLat, propertyLng, 150);
                    const widerPano = widerMeta?.location as { lat: number; lng: number } | undefined;
                    let recoveredOnFrontStreet = false;
                    if (widerMeta?.status === 'OK' && widerPano?.lat != null) {
                        const widerRoad = await getRoadName(widerPano.lat, widerPano.lng);
                        const widerNorm = normalize(widerRoad);
                        recoveredOnFrontStreet = widerNorm.includes(targetNorm.substring(0, 4));
                        if (recoveredOnFrontStreet) {
                            console.log(`[Satellitary] Wider-radius pano on "${widerRoad}" — recovered to front street.`);
                            // Return heading from the wider pano directly
                            return {
                                heading: computeBearing(widerPano.lat, widerPano.lng, propertyLat, propertyLng),
                                status: widerMeta.status,
                                panoCoords: { lat: widerPano.lat, lng: widerPano.lng },
                            };
                        }
                    }
                    // Still on wrong road after wider retry — fall through to multi-pano.
                    console.log(`[Satellitary] Primary pano on "${primaryRoad}" (not "${targetStreet}"). Using multi-pano fallback.`);
                    wrongRoadPrimary = true;
                }
            }
        }

        // ── Step 3: return heading from primary pano ──────────────────────────────
        // Skip if the primary pano is on the wrong road (wrongRoadPrimary=true) OR
        // if it is too close to the property centroid (< 15m = inside a cul-de-sac).
        if (!wrongRoadPrimary && primaryPano?.lat != null && primaryPano?.lng != null) {
            const dLat = (primaryPano.lat - propertyLat) * 111320;
            const dLng = (primaryPano.lng - propertyLng) * 111320 * Math.cos(propertyLat * Math.PI / 180);
            const proximityDist = Math.sqrt(dLat * dLat + dLng * dLng);
            if (proximityDist < 15) {
                console.log(`[Satellitary] Primary pano too close (${Math.round(proximityDist)}m) — triggering multi-pano fallback.`);
                // Fall through to multi-pano path below
            } else {
                return {
                    heading: computeBearing(primaryPano.lat, primaryPano.lng, propertyLat, propertyLng),
                    status: primaryMeta.status,
                    panoCoords: { lat: primaryPano.lat, lng: primaryPano.lng },
                };
            }
        }

        // ── Step 4: multi-pano fallback — no named-street pano found ─────────────
        // Fetch all 4 cardinal offset panos and return them as candidatePanos.
        {
            const OFFSET = 0.00075; // ~80m
            const dirs: Array<{ dir: 'N' | 'S' | 'E' | 'W'; dlat: number; dlng: number }> = [
                { dir: 'N', dlat: +OFFSET, dlng: 0 },
                { dir: 'S', dlat: -OFFSET, dlng: 0 },
                { dir: 'E', dlat: 0, dlng: +OFFSET },
                { dir: 'W', dlat: 0, dlng: -OFFSET },
            ];
            const candidatePanos: Array<{ lat: number; lng: number; heading: number; dir: 'N' | 'S' | 'E' | 'W' }> = [];
            for (const { dir, dlat, dlng } of dirs) {
                const oLat = propertyLat + dlat;
                const oLng = propertyLng + dlng;
                const meta = await fetchPanoAt(oLat, oLng, 100);
                const pano = meta?.location as { lat: number; lng: number } | undefined;
                if (meta?.status === 'OK' && pano?.lat != null) {
                    candidatePanos.push({
                        lat: pano.lat, lng: pano.lng,
                        heading: computeBearing(pano.lat, pano.lng, propertyLat, propertyLng),
                        dir,
                    });
                }
            }
            if (candidatePanos.length >= 2) {
                console.log(`[Satellitary] Multi-pano fallback: ${candidatePanos.length} panos (${candidatePanos.map(p => p.dir).join(',')})`);
                return { heading: null, status: 'NO_NAMED_STREET', candidatePanos };
            }
        }

        return { heading: null, status: primaryMeta?.status ?? 'UNKNOWN' };

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
    streetViewShowsFront: boolean | null | undefined,
    streetBearing?: number | null
): number | null {
    // No heading → can't GPS-correct; trust Gemini's aerial estimate
    if (heading == null) return geminiAzimuth;

    const angularDist = (a: number, b: number): number => {
        const d = Math.abs(a - b) % 360;
        return d > 180 ? 360 - d : d;
    };

    const candidateFront = (heading + 180) % 360;  // face VISIBLE to camera
    const candidateBack = heading;                  // face AWAY from camera (toward camera's street)

    // Coerce string values from schema mis-fires (guard against "TRUE"/"false" strings)
    const showsFront: boolean | null | undefined =
        typeof streetViewShowsFront === 'string'
            ? (streetViewShowsFront.toLowerCase() === 'true' || streetViewShowsFront === '1')
            : streetViewShowsFront;

    // Gemini definitively identified the FRONT DOOR → snap to the visible face.
    // But if the camera is on a perpendicular street, candidateFront may not match the
    // aerial azimuth at all. Bail out to geminiAzimuth if both candidates are >70° away.
    if (showsFront === true) {
        if (geminiAzimuth != null) {
            const dFront = angularDist(geminiAzimuth, candidateFront);
            const dBack = angularDist(geminiAzimuth, candidateBack);
            if (dFront > 89 && dBack > 89) return Math.round(geminiAzimuth); // perp-street bailout
        }
        return Math.round(candidateFront);
    }

    // Gemini identified the BACK/SIDE → front faces toward the camera's street (candidateBack).
    // Same perpendicular-street bailout: if candidateBack disagrees much with the aerial, trust aerial.
    if (showsFront === false) {
        if (geminiAzimuth != null) {
            const dFront = angularDist(geminiAzimuth, candidateFront);
            const dBack = angularDist(geminiAzimuth, candidateBack);
            if (dFront > 89 && dBack > 89) return Math.round(geminiAzimuth); // perp-street bailout
        }
        return Math.round(candidateBack);
    }

    // showsFront=null/undefined → proximity-vote: snap to whichever GPS candidate is closer
    // to Gemini's aerial reasoning. Provides GPS-precision while preventing 180° flips.
    if (geminiAzimuth != null) {
        const dFront = angularDist(geminiAzimuth, candidateFront);
        const dBack = angularDist(geminiAzimuth, candidateBack);
        return Math.round(dFront <= dBack ? candidateFront : candidateBack);
    }

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

/**
 * Returns true for property types where a garage door in street view should NOT
 * be trusted as the front — townhouses, condos, and any unit-addressed property.
 * All three share the same structural problem: the garage may face a driving lane
 * while the actual front door faces a lobby, courtyard, or separate walkway.
 */
function isSharedWallProperty(homeType?: string | null, address?: string): boolean {
    if (homeType === 'TOWNHOUSE' || homeType === 'CONDO') return true;
    // Catch any address with a unit suffix (Unit 202, Apt 3B, #101, etc.)
    if (address && /\b(unit|apt|apartment|#)\s*\w+/i.test(address)) return true;
    return false;
}

export async function runSatellitaryAnalysis(
    lat: number,
    lng: number,
    cachedStreetViewUrl?: string | null,
    userId: string = 'unknown',
    zpid?: string,
    address?: string,
    description?: string | null,
    homeType?: string | null,
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

        // Auto-set GT expected_orientation from description (fire-and-forget).
        // Descriptions are treated as authoritative — more reliable than human tester notes.
        if (zpid) {
            // Read city/zip from properties doc for the GT record
            getDoc(doc(db, 'properties', zpid)).then(propSnap => {
                const pd = propSnap.data() as any;
                setGroundTruthFromDescription({
                    zpid,
                    city:        pd?.city || 'Unknown',
                    zip:         pd?.zipCode || pd?.zip || 'Unknown',
                    address:     address ?? null,
                    orientation: descMatch.direction,
                    azimuth:     descMatch.azimuth,
                });
            }).catch(e => console.error('[Satellitary] GT description write failed:', e));
        }
    }

    if (!result) {
        // ── 1. Resolve image URLs ──────────────────────────────────────────────────
        if (zpid) {
            aerialUrl = await getOrCacheAerialSatelliteUrl(zpid, lat, lng);
            console.log(`[Satellitary] Using secured satellite URL: ${aerialUrl}`);
        } else {
            aerialUrl = buildAerialUrl(lat, lng);
        }

        // Compute street bearing once — used by both multi-pano pair selection AND
        // the dual-direct heading inference in computeAccurateAzimuth.
        const streetBearingResult = address ? await getStreetBearing(address) : null;
        const streetBearingForAzimuth = streetBearingResult?.bearing ?? null;
        const streetSide = streetBearingResult?.streetSide ?? null;

        // Always fetch the GPS heading from metadata (free call) to ensure heading-locked URL
        let candidatePanos: Array<{ lat: number; lng: number; heading: number; dir: 'N' | 'S' | 'E' | 'W' }> | undefined;
        try {
            const headingResult = await fetchStreetViewHeading(lat, lng, address);
            if (headingResult && headingResult.heading !== null) {
                streetViewHeading = headingResult.heading;
                const svLat = headingResult.panoCoords?.lat ?? lat;
                const svLng = headingResult.panoCoords?.lng ?? lng;
                streetViewUrl = buildStreetViewUrl(svLat, svLng, streetViewHeading);
            } else if (headingResult && headingResult.heading === null && headingResult.candidatePanos?.length) {
                // No named-street pano. Check if we have a Firebase cached URL WITH a heading param.
                // The heading is stored by forceRefreshStreetViewUrl and appended by the test setup.
                // Only use cache if heading is recoverable — without it, computeAccurateAzimuth
                // produces incorrect null-coercion results (candidateFront defaults to 180°).
                const headingMatch = cachedStreetViewUrl?.includes('firebasestorage')
                    ? cachedStreetViewUrl.match(/[?&]heading=([0-9.]+)/)
                    : null;
                if (headingMatch) {
                    streetViewHeading = parseFloat(headingMatch[1]);
                    streetViewUrl = cachedStreetViewUrl!;
                    console.log(`[Satellitary] Wrong-road pano; using Firebase cache with heading=${Math.round(streetViewHeading)}°`);
                } else {
                    // No cached heading — fall through to multi-pano
                    candidatePanos = headingResult.candidatePanos;
                    streetViewUrl = null;
                }
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

        // ── 1b. Aerial-only + Shared-wall property → UNCLEAR ─────────────────────
        // Townhouses and condos share party walls and look identical from above.
        // Without a street view there is no reliable way to determine which face is front.
        if (!streetViewUrl && isSharedWallProperty(homeType, address)) {
            console.log(`[Satellitary] Aerial-only shared-wall property detected — returning UNCLEAR (homeType=${homeType}, address=${address})`);
            aerialUrl = aerialUrl ?? buildAerialUrl(lat, lng);
            return {
                final_orientation: 'UNCLEAR',
                azimuth_degrees: null,
                visual_azimuth_estimate: null,
                confidence: 'low',
                property_layout_type: 'standard',
                image_quality: 'clear',
                explanation: 'Aerial-only analysis is unreliable for townhouses and condos: shared party walls make it impossible to determine which face is the front without a street view image.',
                feng_shui_vastu: null,
                privacy_insight: 'Not assessed.',
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
                aerial_only_mode: true,
            };
        }

        if (candidatePanos && candidatePanos.length >= 2) {
            const angDistFn = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
            const byDir = Object.fromEntries(candidatePanos.map(p => [p.dir, p]));
            let panoB = byDir['S'] ?? byDir['E'];
            let panoC = byDir['N'] ?? byDir['W'];
            let streetPrior: string | undefined;

            // Street-bearing prior: geocode to get street direction, pick best pano pair
            const streetBearing = streetBearingForAzimuth;  // reuse the already-computed value
            if (streetBearing != null) {
                const perp1 = (streetBearing + 90) % 360;
                const perp2 = (streetBearing - 90 + 360) % 360;
                const score = (p: typeof candidatePanos[0]) => {
                    const cf = (p.heading + 180) % 360;
                    return Math.min(angDistFn(cf, perp1), angDistFn(cf, perp2));
                };
                const sorted = [...candidatePanos].sort((a, b) => score(a) - score(b));
                const bestPano = sorted[0];

                // Court addresses: skip smart pair swap (properties face inward)
                const streetWordsLocal = (address?.split(',')[0] ?? '')
                    .replace(/^\d+[A-Za-z]?\s+/, '').toUpperCase().split(/\s+/);
                const COURT_TYPES = new Set(['CT', 'CIR', 'LOOP', 'PL', 'WAY', 'CORTE', 'CV', 'CLOSE', 'COURT', 'PLACE']);
                const isCourtStreet = streetWordsLocal.some(w => COURT_TYPES.has(w));

                if (!isCourtStreet && score(bestPano) < 20) {
                    panoB = bestPano;
                    panoC = sorted.slice(1).sort((a, b) => {
                        const cfB = (panoB.heading + 180) % 360;
                        return angDistFn((b.heading + 180) % 360, cfB) - angDistFn((a.heading + 180) % 360, cfB);
                    })[0] ?? sorted[1];
                    console.log(`[Satellitary] Smart pair (score=${Math.round(score(bestPano))}deg) panoB=${panoB.dir} panoC=${panoC.dir}`);
                } else {
                    console.log(`[Satellitary] Default S+N pair (court=${isCourtStreet}, score=${Math.round(score(bestPano))}deg)`);
                }
                const perp1Label = azimuthToCompassLabel(perp1);
                const perp2Label = azimuthToCompassLabel(perp2);
                streetPrior = `GPS STREET DIRECTION PRIOR: The address street runs at approx ${Math.round(streetBearing)} deg. The front most likely faces ${perp1Label} (~${Math.round(perp1)} deg) or ${perp2Label} (~${Math.round(perp2)} deg). Set azimuth_degrees as close to one of these as the aerial evidence allows.`;
            }

            if (panoB && panoC) {
                const dirLabel = (dir: string) => ({ N: 'north', S: 'south', E: 'east', W: 'west' }[dir] ?? dir);
                console.log(`[Satellitary] Multi-pano B=${panoB.dir}(${panoB.heading}deg) C=${panoC.dir}(${panoC.heading}deg)`);

                const svUrlB = buildStreetViewUrl(panoB.lat, panoB.lng, panoB.heading);
                const svUrlC = buildStreetViewUrl(panoC.lat, panoC.lng, panoC.heading);

                const [aerialB64, bB64, cB64] = await Promise.all([
                    urlToBase64(aerialUrl),
                    urlToBase64(svUrlB),
                    urlToBase64(svUrlC),
                ]);

                const { buildOrientationPromptMultiPano } = await import('../prompts/property/satellitaryAnalysis');
                const mpPrompt = buildOrientationPromptMultiPano(
                    panoB.heading, dirLabel(panoB.dir),
                    panoC.heading, dirLabel(panoC.dir),
                    address, description,
                    undefined, undefined, undefined, undefined,
                    streetPrior,
                );

                const { data: mpData } = await executeGeminiRequest<Omit<SatellitaryResult, 'aerial_url' | 'street_view_url' | 'aerial_only_mode'>>({
                    model: ORIENTATION_MODEL,

                    contents: {
                        parts: [
                            { text: mpPrompt },
                            { inlineData: { data: aerialB64.data, mimeType: aerialB64.mimeType } },
                            { inlineData: { data: bB64.data, mimeType: bB64.mimeType } },
                            { inlineData: { data: cB64.data, mimeType: cB64.mimeType } },
                        ]
                    },
                    config: { temperature: 0 },  // deterministic — orientation is a factual spatial task

                    userId, zpid, address,
                    promptFilename: 'satellitaryAnalysis.ts',
                    extractResultJson: true,
                    schema: satellitarySchema,
                    imageUrls: [aerialUrl, svUrlB, svUrlC],
                });

                const mpAzimuth: number | null = mpData.azimuth_degrees ?? null;
                result = {
                    ...mpData,
                    image_quality: mpData.image_quality ?? 'acceptable',
                    confidence: mpData.confidence ?? 'medium',
                    visual_azimuth_estimate: mpData.azimuth_degrees ?? null,
                    azimuth_degrees: mpAzimuth,
                    final_orientation: azimuthToCompassLabel(mpAzimuth),
                    feng_shui_vastu: mpData.feng_shui_vastu ?? null,
                    privacy_insight: mpData.privacy_insight ?? '',
                    lot_coverage_hardscape: mpData.lot_coverage_hardscape ?? null,
                    lot_coverage_pervious: mpData.lot_coverage_pervious ?? null,
                    buyer_pro: mpData.buyer_pro ?? '',
                    buyer_con: mpData.buyer_con ?? '',
                    orientation_highlights: mpData.orientation_highlights ?? '',
                    pool_visible: (mpData as any).pool_visible ?? null,
                    pool_direction: (mpData as any).pool_direction ?? null,
                    garage_direction: (mpData as any).garage_direction ?? null,
                    open_sky_direction: (mpData as any).open_sky_direction ?? null,
                    aerial_url: aerialUrl,
                    street_view_url: svUrlB,
                    aerial_only_mode: false,
                    _debug: { multiPano: true, panoBDir: panoB.dir, panoCDir: panoC.dir, streetBearing } as any,
                };
            }
        }

        // ── 3. Fetch base64 images in parallel (standard dual/aerial path) ──────
        const aerialB64Promise = urlToBase64(aerialUrl);
        const streetB64Promise = streetViewUrl ? urlToBase64(streetViewUrl) : Promise.resolve(null);

        const [aerialB64, streetB64] = await Promise.all([
            aerialB64Promise,
            streetB64Promise,
        ]);

        usesDualImage = !!streetB64;
        const basePrompt = usesDualImage
            ? buildOrientationPromptDual(streetViewHeading, address, description, streetBearingForAzimuth)
            : buildOrientationPromptAerialOnly(address, description, streetBearingForAzimuth, streetSide);

        const prompt = basePrompt + "\n\n" + getDualPromptFinalInstructions(streetViewHeading);

        // ── 4. Call Gemini ────────────────────────────────────────────────────────
        const parts: any[] = [
            { text: prompt },
            { inlineData: { data: aerialB64.data, mimeType: aerialB64.mimeType } },
        ];
        if (streetB64) {
            parts.push({ inlineData: { data: streetB64.data, mimeType: streetB64.mimeType } });
        }

        const { data } = await executeGeminiRequest<Omit<SatellitaryResult, 'aerial_url' | 'street_view_url' | 'aerial_only_mode'>>({
            model: ORIENTATION_MODEL,

            contents: { parts },
            config: { temperature: 0 },  // deterministic — orientation is a factual spatial task

            userId,
            zpid,
            address,
            promptFilename: 'satellitaryAnalysis.ts',
            extractResultJson: true,
            schema: satellitarySchema,
            imageUrls: streetViewUrl ? [aerialUrl, streetViewUrl] : [aerialUrl]
        });


        // ── Cross-validate: azimuth_degrees vs explanation text ───────────────
        // Gemini's structured output can produce inconsistent values — the JSON
        // field (azimuth_degrees) may disagree with the prose reasoning.
        // e.g. explanation says "The final orientation is Southeast" but
        //      azimuth_degrees = 345 (North). When they disagree by >90°,
        //      the explanation is the deliberate chain-of-thought; trust it.
        {
            const DIRECTION_AZIMUTH: Record<string, number> = {
                north: 0, northeast: 45, east: 90, southeast: 135,
                south: 180, southwest: 225, west: 270, northwest: 315,
            };
            const angDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
            const explanation = (data as any).explanation ?? '';
            // Match "The final orientation is Southeast" or "front faces Southeast" etc.
            const dirMatch = explanation.match(
                /(?:final orientation is|front (?:of the house )?faces?)\s+([A-Z][a-z]+(?:east|west)?)/i
            );
            if (dirMatch) {
                const explainDir = dirMatch[1].toLowerCase();
                const explainAz = DIRECTION_AZIMUTH[explainDir];
                const schemaAz = data.azimuth_degrees ?? null;
                if (explainAz !== undefined && schemaAz !== null && angDiff(schemaAz, explainAz) > 90) {
                    console.warn(
                        `[Satellitary] Azimuth/explanation mismatch: schema=${schemaAz}° (${azimuthToCompassLabel(schemaAz)})` +
                        ` but explanation says "${explainDir}" (~${explainAz}°). Trusting explanation.`
                    );
                    data.azimuth_degrees = explainAz;
                    (data as any).final_orientation = explainDir.charAt(0).toUpperCase() + explainDir.slice(1);
                }
            }
        }

        const resultAzimuth = computeAccurateAzimuth(
            data.azimuth_degrees ?? null,
            usesDualImage ? streetViewHeading : null,
            usesDualImage ? (data as any).street_view_shows_front ?? null : null,
            usesDualImage ? streetBearingForAzimuth : null
        );

        // ── Aerial-only confidence gate ────────────────────────────────────────
        // Policy: "accurate or nothing". Aerial-only analysis is unreliable when
        // confidence is anything less than high — the model frequently misidentifies
        // driveway aprons on ambiguous satellite images. Only trust high-confidence
        // aerial-only results; emit UNCLEAR for medium/low/unknown.
        // Corner lots are always failed regardless of confidence: two street frontages
        // make it impossible to choose the primary front from aerial alone.
        const isCornerLotAerialOnly = !usesDualImage && data.property_layout_type === 'corner_lot';
        const aerialConfidenceFailed = !usesDualImage && (
            data.confidence !== 'high' ||
            resultAzimuth == null ||
            isCornerLotAerialOnly    // corner lot aerial-only → always UNCLEAR
        );

        // ── Street-bearing fallback for standard lots ──────────────────────────
        // If aerial-only confidence failed BUT Gemini classified the lot as a simple
        // standard layout (rectangular lot, straight street, no corner/flag/curved
        // complexity), we can derive orientation from the address street bearing.
        // The front is perpendicular to the street: bearing+90° or bearing-90°.
        // We pick whichever perpendicular is closest to Gemini's weak aerial azimuth.
        let streetBearingFallbackAzimuth: number | null = null;
        if (aerialConfidenceFailed && (data as any).standard_street_layout === true && streetBearingForAzimuth != null) {
            const angDistFn = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
            const perp1 = (streetBearingForAzimuth + 90) % 360;
            const perp2 = (streetBearingForAzimuth - 90 + 360) % 360;
            const weakAzimuth = data.azimuth_degrees ?? null;
            if (weakAzimuth != null) {
                streetBearingFallbackAzimuth = angDistFn(weakAzimuth, perp1) <= angDistFn(weakAzimuth, perp2) ? perp1 : perp2;
            } else {
                // No azimuth hint — default to perp1 (arbitrary but consistent)
                streetBearingFallbackAzimuth = perp1;
            }
            console.log(`[Satellitary] Street-bearing fallback: bearing=${Math.round(streetBearingForAzimuth)}° → azimuth=${Math.round(streetBearingFallbackAzimuth)}° (${azimuthToCompassLabel(streetBearingFallbackAzimuth)})`);
        }


        const finalAzimuth = aerialConfidenceFailed
            ? (streetBearingFallbackAzimuth ?? null)
            : resultAzimuth;
        const finalOrientation = aerialConfidenceFailed
            ? (streetBearingFallbackAzimuth != null ? azimuthToCompassLabel(streetBearingFallbackAzimuth) : 'UNCLEAR')
            : azimuthToCompassLabel(resultAzimuth);
        const finalConfidence = aerialConfidenceFailed
            ? (streetBearingFallbackAzimuth != null ? 'low' : 'low')
            : (data.confidence ?? 'medium');

        result = {
            ...data,
            image_quality: data.image_quality ?? 'acceptable',
            visual_azimuth_estimate: data.azimuth_degrees ?? null,
            azimuth_degrees: finalAzimuth,
            final_orientation: finalOrientation,
            confidence: finalConfidence,
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
                streetBearing: streetBearingForAzimuth,
                geminiAzimuth: data.azimuth_degrees ?? null,
                streetViewShowsFront: (data as any).street_view_shows_front ?? null,
                aerialConfidenceFailed,
            } as any
        };
    }

    // ── Post-processing: Aerial-only overrides ────────────────────────────────
    // Use Gemini's own aerial_only_mode flag (set when SV is null OR blurred)
    // to catch both explicit aerial-only runs AND blurred street view cases.
    if (result && result.aerial_only_mode) {

        // Townhouse/condo: shared party walls → cannot determine primary front face from aerial
        if (isSharedWallProperty(homeType, address)) {
            console.log(`[Satellitary] Post-Gemini override: aerial_only_mode + shared-wall (${homeType}) → UNCLEAR`);
            result = {
                ...result,
                final_orientation: 'UNCLEAR',
                azimuth_degrees: null,
                visual_azimuth_estimate: null,
                confidence: 'low',
                explanation: 'Aerial-only analysis is unreliable for townhouses and condos: shared party walls make it impossible to determine which face is the front without a usable street view image.',
            };
        }

        // Cul-de-sac: house faces outward toward the circular court, but without a
        // street view from inside the circle we cannot confirm the outward direction.
        else if (result.property_layout_type === 'cul_de_sac') {
            console.log(`[Satellitary] Post-Gemini override: aerial_only_mode + cul_de_sac → UNCLEAR`);
            result = {
                ...result,
                final_orientation: 'UNCLEAR',
                azimuth_degrees: null,
                visual_azimuth_estimate: null,
                confidence: 'low',
                explanation: 'Aerial-only analysis is unreliable for cul-de-sac properties: without a street view from inside the circular court, the outward-facing direction cannot be confirmed.',
            };
        }

        // Corner lot: two street frontages → unclear which is primary from aerial alone
        else if (result.property_layout_type === 'corner_lot') {
            console.log(`[Satellitary] Post-Gemini override: aerial_only_mode + corner_lot → UNCLEAR`);
            result = {
                ...result,
                final_orientation: 'UNCLEAR',
                azimuth_degrees: null,
                visual_azimuth_estimate: null,
                confidence: 'low',
                explanation: 'Aerial-only analysis is unreliable for corner lots: two street frontages exist and without a usable street view it is impossible to determine which street the front door faces.',
            };
        }
    }

    // ── Post-processing: Townhouse with unclear street view ───────────────────
    // Townhouses with street view can still return wrong results if:
    //   - The SV shows a side/alley entrance, not the primary front door
    //   - It's a corner townhouse with two facades visible
    //   - The SV is partially blurred or shot from an angle
    // Policy: only trust the result if Gemini explicitly confirmed the front door
    // was clearly visible (front_door_clearly_visible === true).
    // Confidence is NOT used here — Gemini over-reports high confidence.
    if (result && isSharedWallProperty(homeType, address) && !result.aerial_only_mode) {
        const frontDoorVisible = (result as any).front_door_clearly_visible;
        if (frontDoorVisible !== true) {
            console.log(`[Satellitary] Post-Gemini override: shared-wall (${homeType}) + street_view + front_door_clearly_visible=${frontDoorVisible} → UNCLEAR`);
            result = {
                ...result,
                final_orientation: 'UNCLEAR',
                azimuth_degrees: null,
                visual_azimuth_estimate: null,
                confidence: 'low',
                explanation: `Townhouse orientation marked unclear: the street view image was available but Gemini could not clearly identify the primary front door of this specific unit (front_door_clearly_visible=${frontDoorVisible}). Townhouses often have shared lobbies, side alleys, or parking bays visible in street view that are not the true front entrance.`,
            };
        }
    }


    // ── 5. Cache results to Firestore (fire-and-forget) ───────────────────────
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

        // Main persistence — awaited so Firestore write lands before the caller's
        // fetchData() timer fires (prevents UI snapping back to stale value)
        await savePropertyOrientationToCloud(
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
                explanation: result.explanation ?? null,
                is_under_construction: result.is_under_construction,
            }
        ).catch(e => console.warn('[Satellitary] Orientation cache write failed (non-blocking):', e));
    }

    return result;
}
