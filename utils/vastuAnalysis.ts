/**
 * vastuAnalysis.ts
 *
 * Deterministic Vastu Shastra zone analysis from front-door azimuth (degrees).
 * Zero API calls — pure compass math.
 *
 * Each of the 8 Vastu zones spans exactly 45°, anchored to true North (0°/360°).
 * The entrance direction is the most critical factor in Vastu for homebuyers.
 */

export type VastuDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type VastuAuspiciousness = 'Auspicious' | 'Neutral' | 'Inauspicious';

export interface VastuZone {
    dir: VastuDirection;
    name: string;           // Sanskrit zone name
    deity: string;          // Presiding deity
    ideal_rooms: string;    // Best room type for this zone
    start: number;          // Start angle (degrees, inclusive)
    end: number;            // End angle (degrees, exclusive)
}

export interface VastuEntranceResult {
    azimuth: number;                      // Raw azimuth input
    entranceZone: VastuZone;             // Which zone the door falls in
    auspiciousness: VastuAuspiciousness; // Overall verdict
    verdict: string;                      // 1-line buyer-facing sentence
    scoreLabel: string;                   // e.g. '⭐ Highly Auspicious'
    scoreColor: string;                   // Tailwind color token (text-*)
    scoreBg: string;                      // Tailwind bg token
    allZones: VastuZoneWithAngle[];       // All 8 zones with relative angles for rendering
    backAzimuth: number;                  // Opposite face of home
    rightAzimuth: number;
    leftAzimuth: number;
}

export interface VastuZoneWithAngle extends VastuZone {
    midAngle: number;                     // Center angle of zone (for compass dial)
    isEntrance: boolean;
    relativePosition: string;            // e.g. 'Front', 'Back', 'Right', 'Left', 'Front-Right', etc.
}

// ── 8 Vastu zones, each 45° ───────────────────────────────────────────────────
// Centered on compass points: N=0, NE=45, E=90, SE=135, S=180, SW=225, W=270, NW=315
// Zone edges are at 22.5° offsets from each compass point.
const VASTU_ZONES: VastuZone[] = [
    {
        dir: 'N', name: 'Kubera', deity: 'Kubera (Wealth)',
        ideal_rooms: 'Living room, study, treasury',
        start: 337.5, end: 22.5,
    },
    {
        dir: 'NE', name: 'Ishanya', deity: 'Lord Shiva',
        ideal_rooms: 'Pooja/prayer room, water bodies, meditation',
        start: 22.5, end: 67.5,
    },
    {
        dir: 'E', name: 'Indra', deity: 'Indra (Sun rise)',
        ideal_rooms: 'Living room, morning sunroom',
        start: 67.5, end: 112.5,
    },
    {
        dir: 'SE', name: 'Agni', deity: 'Agni (Fire)',
        ideal_rooms: 'Kitchen — most auspicious kitchen placement',
        start: 112.5, end: 157.5,
    },
    {
        dir: 'S', name: 'Yama', deity: 'Yama (Death)',
        ideal_rooms: 'Storage, garage — avoid main entrance',
        start: 157.5, end: 202.5,
    },
    {
        dir: 'SW', name: 'Nairutya', deity: 'Nirriti',
        ideal_rooms: 'Master bedroom — most stable, grounding energy',
        start: 202.5, end: 247.5,
    },
    {
        dir: 'W', name: 'Varuna', deity: 'Varuna (Water)',
        ideal_rooms: 'Study, dining room, children\'s bedroom',
        start: 247.5, end: 292.5,
    },
    {
        dir: 'NW', name: 'Vayu', deity: 'Vayu (Wind)',
        ideal_rooms: 'Guest room, garage, bathroom',
        start: 292.5, end: 337.5,
    },
];

// Entrance auspiciousness by zone
const ZONE_AUSPICIOUSNESS: Record<VastuDirection, {
    level: VastuAuspiciousness;
    verdict: string;
}> = {
    N: { level: 'Auspicious', verdict: 'North-facing — governed by Kubera (wealth). Auspicious for prosperity and career growth.' },
    NE: { level: 'Auspicious', verdict: 'Northeast-facing (Ishanya) — the most sacred direction in Vastu. Highly auspicious for overall wellbeing.' },
    E: { level: 'Auspicious', verdict: 'East-facing — governed by Indra, receives first morning light. Excellent for health and positive energy.' },
    SE: { level: 'Neutral', verdict: 'Southeast-facing (Agni zone) — acceptable but not ideal for main entrance; better suited for kitchen placement.' },
    S: { level: 'Inauspicious', verdict: 'South-facing (Yama zone) — traditionally considered inauspicious for the main entrance in Vastu Shastra.' },
    SW: { level: 'Inauspicious', verdict: 'Southwest-facing (Nairutya) — inauspicious for entrance; associated with instability. Best zone for master bedroom, not entry.' },
    W: { level: 'Neutral', verdict: 'West-facing (Varuna) — neutral to slightly unfavorable. Acceptable with proper Vastu remedies.' },
    NW: { level: 'Neutral', verdict: 'Northwest-facing (Vayu) — neutral; associated with movement and transience. Generally acceptable.' },
};

/**
 * Normalize an azimuth to [0, 360).
 */
function normalizeAz(deg: number): number {
    return ((deg % 360) + 360) % 360;
}

/**
 * Find which Vastu zone a given azimuth falls in.
 */
function findZone(azimuth: number): VastuZone {
    const az = normalizeAz(azimuth);
    for (const zone of VASTU_ZONES) {
        // Handle wrap-around for North zone (337.5 → 22.5)
        if (zone.start > zone.end) {
            if (az >= zone.start || az < zone.end) return zone;
        } else {
            if (az >= zone.start && az < zone.end) return zone;
        }
    }
    return VASTU_ZONES[0]; // fallback: N
}

/**
 * Compute the relative position label of a zone relative to the entrance azimuth.
 * Returns 'Front', 'Back', 'Right', 'Left', or diagonal variations.
 */
function relativePosition(entranceAz: number, zoneMid: number): string {
    const rel = normalizeAz(zoneMid - entranceAz);
    if (rel < 22.5 || rel >= 337.5) return 'Front';
    if (rel < 67.5) return 'Front-Right';
    if (rel < 112.5) return 'Right';
    if (rel < 157.5) return 'Back-Right';
    if (rel < 202.5) return 'Back';
    if (rel < 247.5) return 'Back-Left';
    if (rel < 292.5) return 'Left';
    return 'Front-Left';
}

/**
 * Main entry point — compute full Vastu analysis from azimuth_degrees.
 * Returns null if azimuth is null/undefined.
 */
export function computeVastu(azimuth_degrees: number | null | undefined): VastuEntranceResult | null {
    if (azimuth_degrees == null || isNaN(azimuth_degrees)) return null;

    const az = normalizeAz(azimuth_degrees);
    const entranceZone = findZone(az);
    const { level, verdict } = ZONE_AUSPICIOUSNESS[entranceZone.dir];

    const scoreLabel =
        level === 'Auspicious' ? '⭐ Auspicious' :
            level === 'Inauspicious' ? '⚠️ Inauspicious' :
                '◎ Neutral';

    const scoreColor =
        level === 'Auspicious' ? 'text-emerald-700' :
            level === 'Inauspicious' ? 'text-red-700' :
                'text-amber-700';

    const scoreBg =
        level === 'Auspicious' ? 'bg-emerald-50 border-emerald-200' :
            level === 'Inauspicious' ? 'bg-red-50 border-red-200' :
                'bg-amber-50 border-amber-200';

    const allZones: VastuZoneWithAngle[] = VASTU_ZONES.map(zone => {
        // Mid angle: handle wrap-around (N zone: 337.5→22.5 → mid = 0)
        const midAngle = zone.start > zone.end
            ? normalizeAz((zone.start + zone.end + 360) / 2)
            : (zone.start + zone.end) / 2;

        return {
            ...zone,
            midAngle,
            isEntrance: zone.dir === entranceZone.dir,
            relativePosition: relativePosition(az, midAngle),
        };
    });

    return {
        azimuth: az,
        entranceZone,
        auspiciousness: level,
        verdict,
        scoreLabel,
        scoreColor,
        scoreBg,
        allZones,
        backAzimuth: normalizeAz(az + 180),
        rightAzimuth: normalizeAz(az + 90),
        leftAzimuth: normalizeAz(az - 90),
    };
}

/**
 * Compact human-readable compass label from azimuth: "NNE (19°)"
 */
export function azimuthToLabel(az: number): string {
    const n = normalizeAz(az);
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(n / 22.5) % 16;
    return `${dirs[idx]} (${Math.round(n)}°)`;
}

/** Expand 8-point compass abbreviation to full English: "NE" → "Northeast" */
export function dirLabel(dir: string | null | undefined): string {
    const map: Record<string, string> = {
        N: 'North', NE: 'Northeast', E: 'East', SE: 'Southeast',
        S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest',
    };
    return dir ? (map[dir] ?? dir) : '';
}
