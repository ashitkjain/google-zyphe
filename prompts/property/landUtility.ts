/**
 * Land Utility Analysis — ArcGIS Polygon + USGS Elevation
 *
 * Architecture:
 * 1. ArcGIS: Fetch exact parcel polygon from county GIS (free, exact boundaries)
 * 2. Scout: Sample 8 compass directions to find uphill axis
 * 3. Polygon Projection: Project parcel onto slope axis → true lot depth
 * 4. USGS Elevation: Sample at polygon boundary vertices → min/max elevation
 * 5. Slope: elevation_delta / lot_depth × 100
 * 6. Gemini: Fallback for lot depth + zoning info
 *
 * Data Sources:
 *   Parcel Boundaries: Alameda County ArcGIS REST API (free)
 *   Elevation: USGS National Map LiDAR (free, ~3m resolution)
 *   Fallback Elevation: Google Maps Elevation API
 *   Zoning/Depth Fallback: Gemini + Google Search
 */

import { APP_CONFIG } from '../../config';

// ─── Elevation API ────────────────────────────────────────────────────────────

/**
 * Gets elevation at a point, trying USGS first, then Google as fallback.
 * Returns elevation in feet or null if both fail.
 */
export async function getElevation(lat: number, lon: number): Promise<{ ft: number; source: string } | null> {
    // Try USGS first (free, LiDAR-grade)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(
            `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);
        const data = await response.json();
        const val = data?.value;
        if (val !== undefined && val !== null && val !== -1000000) {
            return { ft: typeof val === 'string' ? parseFloat(val) : val, source: 'USGS_LIDAR' };
        }
    } catch { }

    // Fallback: Google Maps Elevation
    try {
        const apiKey = APP_CONFIG.maps.key;
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lon}&key=${apiKey}`
        );
        const data = await response.json();
        if (data.status === 'OK' && data.results?.[0]) {
            return { ft: data.results[0].elevation * 3.28084, source: 'GOOGLE_MAPS' };
        }
    } catch { }

    return null;
}

// ─── ArcGIS Parcel Polygon → Lot Depth ────────────────────────────────────────

import { fetchParcelFromCounty, polygonToFirestore, firestoreToPolygon } from '../../services/arcgis/countyParcels';

interface ParcelInfo {
    apn: string;
    address: string;
    areaSqft: number;
    polygon: [number, number][];  // [lon, lat] ring
    depthFt: number;              // depth projected onto slope axis
    widthFt: number;              // width perpendicular to slope axis
    county?: string;              // which county GIS provided the data
    vertexElevations?: { lat: number; lon: number; elev: number }[];
}

/**
 * Fetch parcel polygon from the appropriate Bay Area county ArcGIS and
 * compute lot depth along the specified slope axis.
 *
 * Supports: Alameda, Santa Clara, Contra Costa counties.
 * Falls back to null for unsupported counties (San Mateo, SF — coming soon).
 *
 * @param lat - Property latitude
 * @param lon - Property longitude
 * @param slopeAzimuthDeg - Uphill direction as compass azimuth (0=N, 90=E, etc.)
 * @returns ParcelInfo with computed depth, or null if ArcGIS fails
 */
export async function fetchParcelDepth(
    lat: number,
    lon: number,
    slopeAzimuthDeg: number,
): Promise<ParcelInfo | null> {
    try {
        const result = await fetchParcelFromCounty(lat, lon);
        if (!result) return null;

        const { polygon: ring, apn, areaSqft, county } = result;

        // Project polygon onto slope axis to get depth
        const azRad = slopeAzimuthDeg * Math.PI / 180;
        const cosLat = Math.cos(lat * Math.PI / 180);
        const ftPerDegLon = cosLat * 364000;
        const ftPerDegLat = 364000;

        const projections = ring.map(([pLon, pLat]) => {
            const xFt = (pLon - ring[0][0]) * ftPerDegLon;
            const yFt = (pLat - ring[0][1]) * ftPerDegLat;
            return xFt * Math.sin(azRad) + yFt * Math.cos(azRad);
        });

        const depthFt = Math.max(...projections) - Math.min(...projections);

        // Width = perpendicular to slope axis
        const perpAzRad = ((slopeAzimuthDeg + 90) % 360) * Math.PI / 180;
        const perpProj = ring.map(([pLon, pLat]) => {
            const xFt = (pLon - ring[0][0]) * ftPerDegLon;
            const yFt = (pLat - ring[0][1]) * ftPerDegLat;
            return xFt * Math.sin(perpAzRad) + yFt * Math.cos(perpAzRad);
        });
        const widthFt = Math.max(...perpProj) - Math.min(...perpProj);

        return {
            apn,
            address: '',
            areaSqft,
            polygon: ring,
            depthFt: Math.round(depthFt),
            widthFt: Math.round(widthFt),
            county,
        };
    } catch (e: any) {
        console.warn(`[LandUtility] ArcGIS fetch failed for (${lat},${lon}): ${e.message}`);
        return null;
    }
}

function compassAzimuth(dir: string): number {
    const m: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    return m[dir] ?? 0;
}

// ─── Multi-Directional Slope Sampling ─────────────────────────────────────────

const DEG_LAT_PER_FT = 1 / 364000;   // 1° lat ≈ 364,000 ft
const DEG_LON_PER_FT = 1 / 288000;   // 1° lon ≈ 288,000 ft at ~37.6°

const COMPASS_DIRECTIONS = [
    { name: 'N', dLat: 1, dLon: 0 },
    { name: 'NE', dLat: 0.707, dLon: 0.707 },
    { name: 'E', dLat: 0, dLon: 1 },
    { name: 'SE', dLat: -0.707, dLon: 0.707 },
    { name: 'S', dLat: -1, dLon: 0 },
    { name: 'SW', dLat: -0.707, dLon: -0.707 },
    { name: 'W', dLat: 0, dLon: -1 },
    { name: 'NW', dLat: 0.707, dLon: -0.707 },
];

export interface SlopeResult {
    address: string;
    frontElevFt: number;    // elevation at pin (street/front)
    rearElevFt: number;     // elevation at lot_depth distance uphill from pin
    uphillDir: string;      // detected uphill direction
    elevDeltaFt: number;    // rear - front elevation difference
    lotDepthFt: number;     // lot depth used for slope calc
    slopePercent: number;
    category: 'Flat' | 'Moderate' | 'Steep' | 'Heavy';
    source: string;
}

/**
 * Slope measurement with optional ArcGIS polygon.
 *
 * STEP 1: Scout 8 directions at 100ft to find uphill axis.
 * STEP 2a (polygon): Sample elevation at ALL polygon vertices, use min/max.
 * STEP 2b (no polygon): Measure at half_depth from pin along slope axis.
 */
export async function sampleSlope(
    address: string,
    pinLat: number,
    pinLon: number,
    lotDepthFt: number,
    polygon?: [number, number][],
): Promise<SlopeResult> {
    // ── STEP 1: Scout 8 directions at 100ft for uphill direction ──
    const scoutAt = async (radius: number) => Promise.all(
        COMPASS_DIRECTIONS.map(async d => {
            const elev = await getElevation(
                pinLat + d.dLat * radius * DEG_LAT_PER_FT,
                pinLon + d.dLon * radius * DEG_LON_PER_FT
            );
            return { ...d, ft: elev?.ft ?? 0, source: elev?.source ?? 'NONE' };
        })
    );

    let scoutElevs = await scoutAt(100);
    const maxFt = Math.max(...scoutElevs.map(s => s.ft));
    const minFt = Math.min(...scoutElevs.map(s => s.ft));
    const scoutVariance = maxFt - minFt;

    if (scoutVariance < 15 && lotDepthFt > 100) {
        const wideRadius = Math.round(lotDepthFt / 2);
        console.log(`[LandUtility]   ${address}: Scout@100ft flat (Δ${scoutVariance.toFixed(0)}ft), re-scout at ${wideRadius}ft`);
        const wideScouts = await scoutAt(wideRadius);
        const wideVar = Math.max(...wideScouts.map(s => s.ft)) - Math.min(...wideScouts.map(s => s.ft));
        if (wideVar > scoutVariance) scoutElevs = wideScouts;
    }

    const uphillPoint = scoutElevs.reduce((a, b) => a.ft > b.ft ? a : b);
    let frontFt: number, rearFt: number, delta: number, depth: number, source: string;

    if (polygon && polygon.length > 3) {
        // ── STEP 2a: POLYGON — sample ALL vertex elevations ──
        const uniqueRing = polygon.slice(0, -1);
        const vElevs = await Promise.all(
            uniqueRing.map(async ([pLon, pLat]) => {
                const e = await getElevation(pLat, pLon);
                return { lat: pLat, lon: pLon, ft: e?.ft ?? 0, src: e?.source ?? 'NONE' };
            })
        );
        const lo = vElevs.reduce((a, b) => a.ft < b.ft ? a : b);
        const hi = vElevs.reduce((a, b) => a.ft > b.ft ? a : b);
        const vDist = Math.sqrt(
            ((hi.lat - lo.lat) * 364000) ** 2 +
            ((hi.lon - lo.lon) * Math.cos(hi.lat * Math.PI / 180) * 364000) ** 2
        );
        frontFt = lo.ft; rearFt = hi.ft;
        delta = Math.abs(hi.ft - lo.ft);
        // Use max of computed distance, lot depth, or 50ft minimum to prevent absurd slopes on tiny parcels (condos/townhomes)
        depth = Math.max(vDist > 0 ? vDist : lotDepthFt, lotDepthFt, 50);
        source = vElevs.some(v => v.src === 'GOOGLE_MAPS') ? 'MIXED' : 'USGS_LIDAR';
        console.log(`[LandUtility]   ${address}: POLYGON ${uniqueRing.length}pts | uphill=${uphillPoint.name} | low=${frontFt.toFixed(0)}ft high=${rearFt.toFixed(0)}ft Δ=${delta.toFixed(0)}ft/${Math.round(depth)}ft [${source}]`);
    } else {
        // ── STEP 2b: FALLBACK — half_depth from pin ──
        const halfD = lotDepthFt / 2;
        const [fE, rE] = await Promise.all([
            getElevation(pinLat - uphillPoint.dLat * halfD * DEG_LAT_PER_FT, pinLon - uphillPoint.dLon * halfD * DEG_LON_PER_FT),
            getElevation(pinLat + uphillPoint.dLat * halfD * DEG_LAT_PER_FT, pinLon + uphillPoint.dLon * halfD * DEG_LON_PER_FT),
        ]);
        frontFt = fE?.ft ?? 0; rearFt = rE?.ft ?? 0;
        delta = Math.abs(rearFt - frontFt);
        depth = lotDepthFt;
        source = [fE?.source, rE?.source].includes('GOOGLE_MAPS') ? 'MIXED' : 'USGS_LIDAR';
        console.log(`[LandUtility]   ${address}: NO POLYGON | uphill=${uphillPoint.name} | front=${frontFt.toFixed(0)}ft rear=${rearFt.toFixed(0)}ft Δ=${delta.toFixed(0)}ft/${lotDepthFt}ft [${source}]`);
    }

    // Cap slope at 100% — even a 45° cliff is 100%. Values above indicate data issues (tiny parcels, GPS drift).
    const slope = Math.min((delta / depth) * 100, 100);
    let category: 'Flat' | 'Moderate' | 'Steep' | 'Heavy';
    if (slope < 5) category = 'Flat';
    else if (slope <= 15) category = 'Moderate';
    else if (slope <= 30) category = 'Steep';
    else category = 'Heavy';

    return {
        address, frontElevFt: frontFt, rearElevFt: rearFt,
        uphillDir: uphillPoint.name, elevDeltaFt: delta,
        lotDepthFt: Math.round(depth),
        slopePercent: Math.round(slope * 10) / 10,
        category, source,
    };
}

// ─── Parcel Validation Engine ─────────────────────────────────────────────────
// Cross-references ArcGIS ground truth against seller listing claims.

export interface ValidationFlag {
    check: string;           // e.g. "lot_size", "slope_reality", "orientation"
    severity: 'info' | 'warning' | 'alert';
    listed: string;          // what the seller claimed
    measured: string;        // what we found
    delta: string;           // numeric difference or "N/A"
    finding: string;         // human-readable explanation
}

/**
 * Validates a property's listing claims against ArcGIS + USGS ground truth.
 *
 * Check #1: Lot Size — ArcGIS Shape_Area vs listed lotSize
 * Check #2: Slope Reality — USGS-measured slope vs description keywords
 * Check #3: Orientation — polygon-derived backyard direction vs "sunny" claims
 */
export function validateParcel(opts: {
    listedLotSqft?: number;
    arcgisAreaSqft?: number;
    slopePercent: number;
    slopeCategory: string;
    uphillDir: string;
    description?: string | null;
}): ValidationFlag[] {
    const flags: ValidationFlag[] = [];

    // ── CHECK 1: Lot Size Discrepancy ──
    if (opts.listedLotSqft && opts.arcgisAreaSqft && opts.listedLotSqft > 0 && opts.arcgisAreaSqft > 0) {
        const pctDiff = ((opts.listedLotSqft - opts.arcgisAreaSqft) / opts.arcgisAreaSqft) * 100;
        const absDiff = Math.abs(pctDiff);

        if (absDiff > 5) {
            const direction = pctDiff > 0 ? 'larger' : 'smaller';
            flags.push({
                check: 'lot_size',
                severity: absDiff > 15 ? 'alert' : 'warning',
                listed: `${opts.listedLotSqft.toLocaleString()} sqft`,
                measured: `${opts.arcgisAreaSqft.toLocaleString()} sqft (ArcGIS)`,
                delta: `${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(1)}%`,
                finding: `Listed lot is ${absDiff.toFixed(0)}% ${direction} than ArcGIS parcel boundary (${Math.abs(opts.listedLotSqft - opts.arcgisAreaSqft).toLocaleString()} sqft difference). ${absDiff > 15 ? 'Possible easement, right-of-way, or measurement discrepancy.' : 'Minor rounding.'}`,
            });
        } else {
            flags.push({
                check: 'lot_size',
                severity: 'info',
                listed: `${opts.listedLotSqft.toLocaleString()} sqft`,
                measured: `${opts.arcgisAreaSqft.toLocaleString()} sqft (ArcGIS)`,
                delta: `${pctDiff > 0 ? '+' : ''}${pctDiff.toFixed(1)}%`,
                finding: 'Lot size matches county records within 5%.',
            });
        }
    }

    // ── CHECK 2: Slope Reality vs Description ──
    const desc = (opts.description || '').toLowerCase();
    const claimsFlat = /\b(flat|level|gentle slope|gently?\s*slop|mostly flat|near flat)\b/i.test(desc);
    const claimsSteep = /\b(steep|hillside|hilltop|dramatic slope|significant slope|canyon)\b/i.test(desc);
    const claimsViews = /\b(view|panoramic|vista|overlook|bay view|mountain view|city view|sweeping)\b/i.test(desc);

    if (claimsFlat && opts.slopePercent > 15) {
        flags.push({
            check: 'slope_reality',
            severity: 'alert',
            listed: 'Description implies flat/level',
            measured: `${opts.slopePercent}% slope (${opts.slopeCategory})`,
            delta: `${opts.slopePercent}%`,
            finding: `Listing describes "flat" terrain but USGS LiDAR measures ${opts.slopePercent}% grade — classified ${opts.slopeCategory}. Foundation costs may be $50k–$100k above standard.`,
        });
    } else if (claimsFlat && opts.slopePercent > 8) {
        flags.push({
            check: 'slope_reality',
            severity: 'warning',
            listed: 'Description implies flat/level',
            measured: `${opts.slopePercent}% slope (${opts.slopeCategory})`,
            delta: `${opts.slopePercent}%`,
            finding: `Listing suggests flat terrain but measured slope is ${opts.slopePercent}%. This is ${opts.slopeCategory} — grading costs apply.`,
        });
    } else if (!claimsSteep && opts.slopePercent > 25) {
        flags.push({
            check: 'slope_reality',
            severity: 'warning',
            listed: 'Description does not mention steep slope',
            measured: `${opts.slopePercent}% slope (${opts.slopeCategory})`,
            delta: `${opts.slopePercent}%`,
            finding: `${opts.slopeCategory} slope of ${opts.slopePercent}% not disclosed in listing. Significant earthwork and retaining walls likely required.`,
        });
    }

    if (claimsViews && opts.slopePercent < 5) {
        flags.push({
            check: 'slope_reality',
            severity: 'info',
            listed: 'Description claims views',
            measured: `${opts.slopePercent}% slope (Flat)`,
            delta: 'N/A',
            finding: 'Listing mentions views but property is on flat terrain. Views may be limited unless elevated position is confirmed by elevation data.',
        });
    }

    // ── CHECK 3: Orientation / Solar Validation ──
    // Backyard typically faces OPPOSITE the uphill direction (uphill = rear, downhill = front/street)
    const backyardDir = OPPOSITE_DIR[opts.uphillDir] || opts.uphillDir;
    const isSouthFacing = ['S', 'SE', 'SW'].includes(backyardDir);
    const isNorthFacing = ['N', 'NE', 'NW'].includes(backyardDir);

    const claimsSunny = /\b(sunny|sun-filled|sun[\s-]*drenched|bright backyard|solar|south.?facing)\b/i.test(desc);
    const claimsSolar = /\b(solar ready|solar panels|solar potential|solar roof)\b/i.test(desc);

    if (claimsSunny && isNorthFacing) {
        flags.push({
            check: 'orientation',
            severity: 'warning',
            listed: 'Description claims sunny/bright',
            measured: `Backyard faces ${backyardDir} (shaded)`,
            delta: 'N/A',
            finding: `Listing promotes "sunny" but the backyard faces ${backyardDir} — a shaded orientation in the Northern Hemisphere. Expect limited direct sunlight, especially in winter.`,
        });
    } else if (isSouthFacing) {
        flags.push({
            check: 'orientation',
            severity: 'info',
            listed: claimsSunny ? 'Description confirms sunny' : 'Not mentioned',
            measured: `Backyard faces ${backyardDir} (south-facing)`,
            delta: 'N/A',
            finding: `South-facing backyard confirmed. Optimal for natural light and solar potential.`,
        });
    }

    if (claimsSolar && isNorthFacing) {
        flags.push({
            check: 'solar_roi',
            severity: 'alert',
            listed: 'Description claims solar potential',
            measured: `Primary rear exposure faces ${backyardDir}`,
            delta: 'N/A',
            finding: `Listing promotes solar but rear roof pitch likely faces ${backyardDir}. Solar panel efficiency could be 30–50% below optimal south-facing installations.`,
        });
    }

    return flags;
}

const OPPOSITE_DIR: Record<string, string> = {
    N: 'S', NE: 'SW', E: 'W', SE: 'NW',
    S: 'N', SW: 'NE', W: 'E', NW: 'SE',
};

// ─── Gemini Phase 1: Lot Depth + Zoning via Google Search ─────────────────────

const PHASE1_SYSTEM_INSTRUCTION = `You are a parcel dimension analyst.
You are given property addresses. You do NOT need to find coordinates — those are already known.

YOUR TASK: Use Google Search to find for each property:
1. LOT DEPTH in feet — this is the front-to-rear distance (from street to back boundary), NOT the frontage width.
   - Search: "[address] lot dimensions" or "[address] assessor parcel"
   - If lot dimensions say "60x150", the DEPTH is 150 (the longer dimension for most residential lots)
   - If only lot size is available, estimate: depth = lot_size_sqft / frontage_width (typical frontage = 60-80ft)
   - IMPORTANT: Lot depth is typically 100-500ft for residential lots. Values under 50ft are almost certainly wrong.
2. LOT SIZE in square feet
3. ZONING DISTRICT code

Return ONLY valid JSON (no markdown, no code fences).`;

function buildPhase1Prompt(
    subjectInfo: string,
    compsList: any[],
): string {
    const propList = compsList.map((c: any) => `- ${c.address}`).join('\n');
    return `Find lot depth and zoning for these properties.

Subject: ${subjectInfo}

Properties:
${propList}

For EACH property (including subject), search Zillow, Redfin, or the county assessor to find:
- Lot depth in feet (front-to-rear, the LONGER dimension, typically 100-500ft)
- Lot size in sqft
- Zoning district

IMPORTANT: Residential lot depth is almost always between 100-500ft.
If you find a lot is 36,000 sqft with 100ft frontage, depth = 360ft.
If you find a lot is 6,000 sqft with 60ft frontage, depth = 100ft.

Return JSON:
{
  "parcels": [
    { "address": "string", "lot_depth_ft": number, "lot_size_sqft": number, "zoning_district": "string" }
  ]
}`;
}

// ─── Main Orchestration ───────────────────────────────────────────────────────

/**
 * Executes the land utility analysis:
 *
 * 1. Gemini + Google Search → lot depth + zoning (we already have lat/lon)
 * 2. Multi-directional elevation sampling → 9 USGS/Google API calls per property
 * 3. Math → find steepest axis, compute slope, categorize
 */
export async function executeLandUtilityAnalysis(
    eligibleCount: number,
    subjectInfo: string,
    compsList: any[],
    subjectZpid?: string,
    address?: string,
    subjectLat?: number,
    subjectLng?: number,
    subjectLotSqft?: number,
    subjectDescription?: string,
    subjectTaxSqft?: number,
): Promise<any> {
    const { getAi } = await import('../../services/geminiService');
    const { logLLMCall, updateLLMCall } = await import('../../services/firebase/llm_logs');
    const { serverTimestamp } = await import('firebase/firestore');

    const ai = getAi();
    const MODEL = 'gemini-3.1-pro-preview';

    const logId = await logLLMCall({
        user_id: 'unknown',
        zpid: subjectZpid,
        address,
        prompt_filename: 'landUtility',
        llm_name: MODEL,
        raw_payload: { subject: subjectInfo.slice(0, 500), compCount: eligibleCount },
        raw_response: null,
        status: 'pending',
        request_sent_at: serverTimestamp(),
    });

    try {
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1: Gemini + Google Search → lot depth + zoning
        // ═══════════════════════════════════════════════════════════════════
        console.log('[LandUtility] ═══ Phase 1: Finding lot depth via Google Search...');
        const phase1Prompt = buildPhase1Prompt(subjectInfo, compsList);

        let phase1Text = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const phase1Result = await (ai.models as any).generateContent({
                    model: MODEL,
                    contents: [{ role: 'user', parts: [{ text: phase1Prompt }] }],
                    config: {
                        systemInstruction: PHASE1_SYSTEM_INSTRUCTION,
                        tools: [{ googleSearch: {} }],
                        maxOutputTokens: 4096,
                    },
                });
                phase1Text = typeof phase1Result.text === 'function' ? phase1Result.text() : phase1Result.text;
                break;
            } catch (e: any) {
                if (e.status === 503 && attempt < 3) {
                    console.warn(`[LandUtility] Gemini 503, retrying (${attempt}/3)...`);
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    continue;
                }
                throw e;
            }
        }

        let phase1Parcels: any[];
        try {
            phase1Parcels = JSON.parse(phase1Text).parcels || [];
        } catch {
            const match = phase1Text.match(/\{[\s\S]*\}/);
            phase1Parcels = match ? (JSON.parse(match[0]).parcels || []) : [];
        }

        // Build depth + zoning lookup
        const depthMap = new Map<string, { depth: number; zoning: string; lotSqft: number }>();
        for (const p of phase1Parcels) {
            const depth = (p.lot_depth_ft && p.lot_depth_ft >= 80) ? p.lot_depth_ft : 150;
            depthMap.set(p.address?.toLowerCase(), { depth, zoning: p.zoning_district || 'Unknown', lotSqft: p.lot_size_sqft || 0 });
            console.log(`[LandUtility]   ${p.address}: depth=${depth}ft, zoning=${p.zoning_district}`);
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: ArcGIS polygon + USGS elevation sampling
        // ═══════════════════════════════════════════════════════════════════
        console.log('[LandUtility] ═══ Phase 2: ArcGIS polygon + elevation sampling...');

        // Import Firestore for polygon caching
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const { db } = await import('../../services/firebase/config');

        // Helper: get polygon from cache or ArcGIS, then save to Firestore
        const getPolygonWithCache = async (
            lat: number, lon: number, azimuth: number, zpid?: string, addr?: string,
        ): Promise<{ polygon?: [number, number][]; depth: number; apn?: string; areaSqft?: number; fromCache: boolean }> => {
            // 1. Check Firestore cache (both collections)
            if (zpid) {
                for (const coll of ['properties', 'sold_or_unlisted_properties']) {
                    try {
                        const snap = await getDoc(doc(db, coll, String(zpid)));
                        if (snap.exists()) {
                            const d = snap.data();
                            if (d.parcelPolygon && d.parcelPolygon.length > 3) {
                                const ring = firestoreToPolygon(d.parcelPolygon);
                                console.log(`[LandUtility]   ${addr || zpid}: cached polygon from ${coll} (${ring.length} pts, APN: ${d.parcelApn || '?'})`);
                                // Re-project cached polygon onto the current slope axis
                                const azRad = azimuth * Math.PI / 180;
                                const cosLat = Math.cos(lat * Math.PI / 180);
                                const ftPerDegLon = cosLat * 364000;
                                const ftPerDegLat = 364000;
                                const projections = ring.map(([pLon, pLat]) => {
                                    const xFt = (pLon - ring[0][0]) * ftPerDegLon;
                                    const yFt = (pLat - ring[0][1]) * ftPerDegLat;
                                    return xFt * Math.sin(azRad) + yFt * Math.cos(azRad);
                                });
                                const depth = Math.max(...projections) - Math.min(...projections);
                                return {
                                    polygon: ring,
                                    depth: Math.round(depth),
                                    apn: d.parcelApn,
                                    areaSqft: d.parcelAreaSqft,
                                    fromCache: true,
                                };
                            }
                        }
                    } catch { }
                }
            }

            // 2. Fetch from ArcGIS
            const parcel = await fetchParcelDepth(lat, lon, azimuth);
            if (!parcel) return { depth: 150, fromCache: false };

            // 3. Save polygon to Firestore
            if (zpid) {
                const coll = 'sold_or_unlisted_properties';
                try {
                    await setDoc(doc(db, coll, String(zpid)), {
                        parcelPolygon: polygonToFirestore(parcel.polygon),
                        parcelApn: parcel.apn,
                        parcelAreaSqft: Math.round(parcel.areaSqft),
                        parcelDepthFt: parcel.depthFt,
                        parcelWidthFt: parcel.widthFt,
                        parcelCachedAt: new Date().toISOString(),
                    }, { merge: true });
                    console.log(`[LandUtility]   ${addr || zpid}: polygon saved to ${coll} (APN: ${parcel.apn})`);
                } catch (e: any) {
                    console.warn(`[LandUtility]   ${addr || zpid}: failed to cache polygon: ${e.message}`);
                }
            }

            return {
                polygon: parcel.polygon,
                depth: parcel.depthFt,
                apn: parcel.apn,
                areaSqft: parcel.areaSqft,
                fromCache: false,
            };
        };

        const properties: SlopeResult[] = [];
        const parcelAreas: (number | undefined)[] = [];  // ArcGIS area per comp for validation

        // Process comps
        for (const comp of compsList) {
            const lat = comp.latitude;
            const lon = comp.longitude;
            if (!lat || !lon) {
                console.warn(`[LandUtility] Missing lat/lon for ${comp.address}, skipping`);
                continue;
            }

            // Quick scout to find uphill direction (needed for polygon projection)
            const quickScout = await Promise.all(
                COMPASS_DIRECTIONS.map(async d => {
                    const e = await getElevation(lat + d.dLat * 100 * DEG_LAT_PER_FT, lon + d.dLon * 100 * DEG_LON_PER_FT);
                    return { ...d, ft: e?.ft ?? 0 };
                })
            );
            const upDir = quickScout.reduce((a, b) => a.ft > b.ft ? a : b);
            const az = compassAzimuth(upDir.name);

            // Get polygon (from cache or ArcGIS)
            const pResult = await getPolygonWithCache(lat, lon, az, comp.zpid, comp.address);
            const geminiP1 = depthMap.get(comp.address?.toLowerCase()) || { depth: 150, zoning: 'Unknown', lotSqft: 0 };

            const depth = pResult.polygon ? pResult.depth : geminiP1.depth;
            const src = pResult.fromCache ? '(cached)' : pResult.polygon ? '(ArcGIS)' : '(Gemini)';
            console.log(`[LandUtility]   ${comp.address}: depth=${depth}ft ${src}${pResult.apn ? ` APN:${pResult.apn}` : ''}`);

            const result = await sampleSlope(comp.address, lat, lon, depth, pResult.polygon);
            properties.push(result);
            parcelAreas.push(pResult.areaSqft ? Math.round(pResult.areaSqft) : undefined);
        }

        // Process subject
        let subjectResult: SlopeResult | null = null;
        let subjectArcgisAreaSqft: number | undefined;
        let subjectGeminiP1 = { depth: 150, zoning: 'Unknown', lotSqft: 0 };
        if (subjectLat && subjectLng) {
            const quickScout = await Promise.all(
                COMPASS_DIRECTIONS.map(async d => {
                    const e = await getElevation(subjectLat + d.dLat * 100 * DEG_LAT_PER_FT, subjectLng + d.dLon * 100 * DEG_LON_PER_FT);
                    return { ...d, ft: e?.ft ?? 0 };
                })
            );
            const upDir = quickScout.reduce((a, b) => a.ft > b.ft ? a : b);
            const az = compassAzimuth(upDir.name);

            const pResult = await getPolygonWithCache(subjectLat, subjectLng, az, subjectZpid, address);
            subjectArcgisAreaSqft = pResult.areaSqft ? Math.round(pResult.areaSqft) : undefined;
            subjectGeminiP1 = Array.from(depthMap.entries()).find(([k]) => (address?.toLowerCase() || '').includes(k.split(',')[0]))?.[1]
                || { depth: 150, zoning: 'Unknown', lotSqft: 0 };

            const depth = pResult.polygon ? pResult.depth : subjectGeminiP1.depth;
            subjectResult = await sampleSlope(address || 'Subject', subjectLat, subjectLng, depth, pResult.polygon);
        }

        // ═══════════════════════════════════════════════════════════════════
        // Build final response JSON + Validation Scorecard
        // ═══════════════════════════════════════════════════════════════════
        const data: any = {
            subject_audit: subjectResult ? (() => {
                const subjectFlags = validateParcel({
                    listedLotSqft: subjectLotSqft,
                    arcgisAreaSqft: subjectArcgisAreaSqft,
                    slopePercent: subjectResult.slopePercent,
                    slopeCategory: subjectResult.category,
                    uphillDir: subjectResult.uphillDir,
                    description: subjectDescription || null,
                });
                return {
                    tax_sqft: subjectTaxSqft || null,
                    zoning_district: subjectGeminiP1.zoning || 'Unknown',
                    topography: `Measured ${subjectResult.category} based on ${Math.round(subjectResult.elevDeltaFt)}ft elevation change over ${subjectResult.lotDepthFt}ft depth. Source: ${subjectResult.source}. Uphill: ${subjectResult.uphillDir}.`,
                    slope_percent: subjectResult.slopePercent,
                    slope_category: subjectResult.category,
                    elevation_source: subjectResult.source,
                    front_elevation_ft: Math.round(subjectResult.frontElevFt),
                    rear_elevation_ft: Math.round(subjectResult.rearElevFt),
                    slope_direction: subjectResult.uphillDir,
                    gross_lot_sqft: subjectLotSqft || null,
                    arcgis_lot_sqft: subjectArcgisAreaSqft || null,
                    notes: `Front(pin): ${Math.round(subjectResult.frontElevFt)}ft → Rear(${subjectResult.uphillDir}): ${Math.round(subjectResult.rearElevFt)}ft`,
                    validation_flags: subjectFlags.length > 0 ? subjectFlags : undefined,
                };
            })() : null,
            properties: properties.map((r, i) => {
                const comp = compsList[i];
                const p1 = depthMap.get(comp?.address?.toLowerCase()) || { depth: 150, zoning: 'Unknown', lotSqft: 0 };
                const arcArea = parcelAreas[i];
                const listedLot = p1.lotSqft || comp?.lotSize || undefined;

                // Run validation for this comp
                const flags = validateParcel({
                    listedLotSqft: listedLot,
                    arcgisAreaSqft: arcArea,
                    slopePercent: r.slopePercent,
                    slopeCategory: r.category,
                    uphillDir: r.uphillDir,
                    description: comp?.description,
                });

                const alertCount = flags.filter(f => f.severity === 'alert').length;
                const warnCount = flags.filter(f => f.severity === 'warning').length;

                return {
                    address: r.address,
                    zpid: comp?.zpid || '',
                    lot_utility: {
                        gross_lot_sqft: listedLot || null,
                        arcgis_lot_sqft: arcArea || null,
                        zoning_district: p1.zoning,
                        topography: `Measured ${r.category} based on ${Math.round(r.elevDeltaFt)}ft elevation change over ${r.lotDepthFt}ft depth. Source: ${r.source}. Uphill: ${r.uphillDir}.`,
                        slope_percent: r.slopePercent,
                        slope_category: r.category,
                        elevation_source: r.source,
                        front_elevation_ft: Math.round(r.frontElevFt),
                        rear_elevation_ft: Math.round(r.rearElevFt),
                        slope_direction: r.uphillDir,
                        notes: `Front(pin): ${Math.round(r.frontElevFt)}ft → Rear(${r.uphillDir}): ${Math.round(r.rearElevFt)}ft`,
                        validation_flags: flags.length > 0 ? flags : undefined,
                        validation_summary: alertCount > 0 ? `⚠️ ${alertCount} alert(s), ${warnCount} warning(s)` : warnCount > 0 ? `${warnCount} warning(s)` : '✅ Verified',
                    },
                };
            }),
            confidence_score: 8,
        };

        const rawResponse = JSON.stringify(data, null, 2);

        if (logId) {
            await updateLLMCall(logId, {
                raw_response: rawResponse.slice(0, 5000),
                status: 'completed',
                response_received_at: serverTimestamp(),
            });
        }

        return { data, rawResponse };
    } catch (error: any) {
        console.error('[LandUtility] Analysis failed:', error.message);
        if (logId) {
            await updateLLMCall(logId, {
                raw_response: error.message,
                status: 'failed',
                error: error.stack || error.message,
                response_received_at: serverTimestamp(),
            });
        }
        throw error;
    }
}
