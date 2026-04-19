/**
 * Satellitary Orientation Analysis — Prompt & Schema
 *
 * Dual-image mode:  Gemini receives both an aerial satellite image (north-up)
 *                   and a street-view image, cross-referencing the front door
 *                   with the building footprint to derive compass orientation.
 *
 * Aerial-only mode: When no street view is available, Gemini uses indirect
 *                   cues — road adjacency, driveway, front yard, shadow angle,
 *                   and garage doors — to infer the "street-facing" front.
 */

import { Type } from '@google/genai';

/** Inline azimuth→compass label for use in prompt builders (avoids circular import). */
function azimuthToCompassLabel(az: number | null): string {
    if (az == null) return 'UNCLEAR';
    const dirs = ['North','Northeast','East','Southeast','South','Southwest','West','Northwest'];
    return dirs[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}


/** Builds a listing description hint block for orientation prompts. */
function buildDescriptionHint(description?: string | null): string {
    if (!description) return '';
    const text = Array.isArray(description) ? description.join(' ') : description;
    return `\n\n🏷️  LISTING DESCRIPTION (seller-provided — highest priority signal):\n"${text}"\n` +
        `If the description explicitly states a facing direction (e.g. "north facing", "south-facing",\n` +
        `"faces east"), treat it as ground truth and make your final_orientation match it UNLESS\n` +
        `the satellite image makes it physically impossible. Acknowledge it in your explanation.`;
}

// ─── Dual-Image Prompt (Aerial + Street View) ────────────────────────────────

/**
 * Builds the dual-image orientation prompt.
 * Consolidates spatial reasoning rules and task steps to avoid redundancy.
 */
export function buildOrientationPromptDual(streetViewHeading?: number | null, address?: string, description?: string | null, streetBearing?: number | null): string {
    const headingContext = streetViewHeading != null
        ? `\n\nCAMERA HEADING: ${streetViewHeading}° (0°=North, 90°=East, 180°=South, 270°=West)\nThe camera was pointing in direction ${streetViewHeading}° when it captured Image B.`
        : '';

    const addressClue = address ? `\n\nPROPERTY ADDRESS: "${address}"` : '';
    const descriptionOverride = buildDescriptionHint(description);

    const compassLabel = (az: number) => ['North','Northeast','East','Southeast','South','Southwest','West','Northwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
    const bearingHintDual = streetBearing != null ? (() => {
        const perp1 = (streetBearing + 90) % 360;
        const perp2 = (streetBearing - 90 + 360) % 360;
        const par2  = (streetBearing + 180) % 360;
        return `\n\nGPS STREET BEARING PRIOR: GPS data confirms the address street runs at ~${Math.round(streetBearing)}°. For a standard lot the front MUST face ${compassLabel(perp1)} (~${Math.round(perp1)}°) or ${compassLabel(perp2)} (~${Math.round(perp2)}°) — perpendicular to the road. Use the driveway apron (Image A) and the visible door/walkway (Image B) to decide which is correct.\n⛔ FORBIDDEN azimuths: ~${Math.round(streetBearing)}° and ~${Math.round(par2)}° are the road-parallel directions and are ALWAYS WRONG for a standard lot. Your azimuth_degrees MUST NOT be within 15° of ${Math.round(streetBearing)}° or ${Math.round(par2)}°.`;
    })() : '';

    return `
You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and a Street View image (Image B) of a property.
${headingContext}${addressClue}${descriptionOverride}${bearingHintDual}

GUIDING PRINCIPLES:
1. IMAGE A (AERIAL) IS THE ANCHOR: North is strictly at the top. Use it to identify the building footprint, street layout, and architectural features.
2. THE WALKWAY RULE: Trace the pedestrian walkway from the public sidewalk to the main door. The wall it leads to is the architectural FRONT.
3. DRIVEWAY & GARAGE (supporting): In typical single-family homes, the garage and front door are on the SAME wall. The driveway runs from the public street to the garage — the side where the driveway meets the street is generally the front.
4. CORNER LOTS: Garages sometimes face secondary streets or rear alleys. Always verify with the pedestrian walkway or porch, not just the garage.

TASK SEQUENCE:
Step 0: Quality & Construction Check.
   - If Image A is too blurry, set image_quality="blurry", final_orientation="UNCLEAR_IMAGE", and stop.
   - If the site is under active construction, set is_under_construction=true, final_orientation="UNDER_CONSTRUCTION", and stop.

Step 0b: Street View Usability Check (MANDATORY before Steps 3–4).
   - Examine Image B. If ANY of the following apply, the street view is UNINFORMATIVE:
       • Privacy blur (foggy/milky white overlay) covering the majority of the image
       • Solid fence, wall, or gate with no architectural features visible
       • The house is too far away or obstructed by trees/vegetation/parked vehicles to identify architectural details
       • The image shows a generic street scene with no clear view of this property's facade
     If uninformative:
       → Mark street_view_shows_front = null (unknown)
       → Set front_door_clearly_visible = false
       → Skip Step 3 entirely — do NOT apply heading math
       → Rely SOLELY on Step 2 aerial analysis (driveway apron + walkway) for azimuth
       → Set confidence = 'medium' at most (downgrade to 'low' if driveway is also ambiguous)
   - Only proceed to Step 3 heading math if Image B clearly shows the front door, porch, or entry steps confirming FRONT vs BACK. A garage door or windows alone are NOT sufficient.

   TOWNHOUSE / CONDO / UNIT EXTRA GATE (apply if the building is a townhouse, row house, condo, or any address containing "Unit", "Apt", or "#"):
   Multi-unit buildings often have side alleys, shared lobbies, parking bays, or rear gates visible in street view. These are NOT the primary front door.
   For a townhouse, set front_door_clearly_visible = true ONLY if ALL of the following are true:
     a) You can see a clearly distinct residential PEDESTRIAN front door — a walk-through door with a handle/knocker — belonging to this specific unit.
        A GARAGE DOOR (a vehicle roller or sectional door that opens for a car) is NEVER a front door, even if it faces the main road.
     b) The pedestrian door has a direct path from the public sidewalk (steps, porch, or stoop leading to THAT door).
     c) You are confident this pedestrian door — not a garage roller door, side gate, or rear gate — is the PRIMARY residential entrance.
     d) The door is close and distinct enough to identify as THIS unit specifically — not one of many identical-looking doors far in the distance.

   GARAGE-ONLY TRAP (most common failure mode for modern townhouses):
   Modern townhouses frequently have their GARAGE FACE on the road side — two or more identical grey/brown roller doors fill the ground floor facade.
   This view shows the VEHICLE ACCESS SIDE, NOT the primary residential front.
   If Image B shows:
     • Only garage/roller doors (vehicle bays) — even just one, even if it faces the main street
     • No walk-through pedestrian door with a handle anywhere on the visible facade
     • No steps, porch, or stoop leading to a residential entry
   THEN → front_door_clearly_visible = false IMMEDIATELY. Do not look for workarounds.

   DISTANCE / AMBIGUITY TRAP: If the building complex is visible but the front doors are far away (behind a fence, across a parking lot) OR multiple identical-looking unit doors are visible with no way to identify which belongs to THIS specific address:
     → front_door_clearly_visible = false. You are seeing the building from outside — not this unit's door.
   If ANY condition is uncertain or unmet:
     → Set front_door_clearly_visible = false
     → Do NOT apply heading math from Image B
     → Rely on aerial analysis only
     → Set confidence = 'low'

Step 1: LAYOUT DETECTION — Examine Image A FIRST to determine the street layout:
   OPTION A — CUL-DE-SAC / COURT: Is there a clearly visible rounded bulb/teardrop dead-end terminus in the street AND the subject lot abuts this circular area directly?
      → If YES (both must be true): Set property_layout_type = "cul_de_sac".
         The FRONT WALL of the house FACES OUTWARD toward the center of that circular open area.
         (Think of it as: the front door and garage open onto the circular paved court — cars drive from the circle to the garage.)
         CUL-DE-SAC DIRECTION METHOD — compute the direction from property to cul-de-sac center precisely:
           • Locate the center of the cul-de-sac bulb (point C).
           • Locate the center of the subject property (point P, marked by the pin).
           • Draw a vector P → C and read its compass direction using BOTH axes:
               Upper-left of P  = NORTHWEST (~315°) — NOT west, NOT southwest
               Upper-right of P = NORTHEAST (~45°)  — NOT north, NOT east
               Lower-left of P  = SOUTHWEST (~225°) — NOT south, NOT west
               Lower-right of P = SOUTHEAST (~135°) — NOT south, NOT east
               Directly above P = NORTH (0°)   |  Directly right = EAST (90°)
               Directly below P = SOUTH (180°) |  Directly left  = WEST (270°)
           • If the cul-de-sac is diagonally placed (both horizontal AND vertical offset), you MUST use the diagonal compass direction (NW/NE/SW/SE). Do NOT reduce it to a cardinal direction (N/E/S/W) unless the offset is almost entirely in one axis.
           • The front wall azimuth = the angle from P toward C (the direction the front wall FACES).
          CUL-DE-SAC EXTRA GATE FOR Step 3: The Street View camera may be positioned ANYWHERE on the curved road — it is NOT guaranteed to be looking at the front.
          Set street_view_shows_front = TRUE ONLY if the face of the house visible in Image B faces the SAME direction as the cul-de-sac center (the direction computed in your P→C vector above).
          If the camera heading puts it looking at a SIDE or BACK wall (i.e., the visible face runs parallel to or away from the P→C vector), set street_view_shows_front = FALSE.
          Do NOT set sv_front = TRUE just because a wall, fence, or garage door is visible in Image B — it must be the face that OPENS toward the cul-de-sac circle.
   OPTION B — STANDARD lot: Straight or gently curved street, no dead-end bulb visible. Use the walkway rule.
   OPTION C — CORNER lot: Two distinct street frontages visible. Use pedestrian walkway to determine primary front.
   OPTION D — FLAG lot: Long driveway/easement leads to a setback lot hidden behind another property.

   DRIVEWAY CONNECTION RULE (applies to ALL layout types — check this before deciding the front street):
   A road is only a valid front street if there is a DIRECT VISIBLE CONNECTION from the property to that road:
     • A driveway or apron leading from the garage/parking to the road, OR
     • A pedestrian walkway from the front door to the sidewalk on that road.
   If a road is separated from the property by a green belt, tree row, park strip, retaining wall, or any physical barrier with NO driveway or path crossing it:
     → That road is NOT the front street, regardless of how prominent or close it appears.
     → Do NOT default to the largest or nearest road — look for where the driveway actually exits.
   If you cannot find a clear driveway connection to any road, set confidence='low' and final_orientation='UNCLEAR'.

Step 2: Aerial Front-Wall Identification.
Step 2: Aerial Front-Wall Identification.
   Using the layout you identified in Step 1, identify which compass direction the front wall faces. Confirm with: (a) pedestrian walkway, (b) driveway direction, (c) lot orientation.

   FACING CONVENTION (CRITICAL — read carefully):
   The front wall faces TOWARD the street — its azimuth points FROM the house IN THE DIRECTION OF the street.
   This applies to ALL 8 compass directions:
      → Street to the SOUTH           → front faces SOUTH  (~180°)
      → Street to the NORTH           → front faces NORTH  (~0°)
      → Street to the EAST            → front faces EAST   (~90°)
      → Street to the WEST            → front faces WEST   (~270°)
      → Street to the SOUTHEAST       → front faces SE     (~135°)  — use SE, not "south" or "east"
      → Street to the SOUTHWEST       → front faces SW     (~225°)  — use SW, not "south" or "west"
      → Street to the NORTHEAST       → front faces NE     (~45°)   — use NE, not "north" or "east"
      → Street to the NORTHWEST       → front faces NW     (~315°)  — use NW, not "north" or "west"
   NEVER collapse a diagonal to a cardinal just because south/north is the dominant axis.
   NEVER invert (if street is south → face south, NOT north).

   DIRECTION PRECISION — trace the driveway from the house TOWARD the street:
     • Upper-left  = NORTHWEST — do NOT call this “west” or “southwest”
     • Upper-right = NORTHEAST — do NOT call this “north” or “east”
     • Lower-left  = SOUTHWEST — do NOT call this “south” or “west”
     • Lower-right = SOUTHEAST — do NOT call this “south” or “east”
   If the driveway moves diagonally (has BOTH horizontal AND vertical components), use the intercardinal. Only use N/E/S/W when movement is almost entirely in ONE axis.
   If the driveway moves diagonally (has BOTH horizontal AND vertical components), use the intercardinal. Only use N/E/S/W when movement is almost entirely in ONE axis.

Step 3: Cross-check with Image B (street view). GPS camera heading = ${streetViewHeading != null ? `${streetViewHeading}°` : 'N/A'} (exact, GPS-measured).
   Your ONLY job in Step 3: look at Image B and judge whether it shows the front or back of the house.
   Judge from IMAGE B ALONE — do NOT set this to match your Step 2 aerial conclusion.
   RULE A — Image B shows front door, porch, covered entry, or steps:
      → street_view_shows_front = TRUE
   RULE B — Image B shows ONLY a blank wall, fence, or side with no openings:
      → street_view_shows_front = FALSE

Step 4: Finalize.

ADDITIONAL ANALYSIS:
- Privacy: Assess neighboring sightlines into the backyard/pool.
- Coverage: Estimate % Lot Coverage (Hardscape vs. Pervious).
- Site Features: Identify Pool, Garage, and Open Yard directions (N/NE/E/SE/S/SW/W/NW).
- Buyer Pro/Con: One punchy sentence each.

EXPLANATION FORMAT — use this EXACT structure, one numbered sentence per step:
(1) LAYOUT: State the layout type (standard / cul-de-sac / corner / flag) and one visual reason why (e.g. "Standard lot — straight road, single street frontage visible in Image A").
(2) STREET CONTEXT: Name the address street and state which edge of the lot it runs along and at what bearing (e.g. "Chalk Hill Way runs East-West along the NORTH edge, bearing ≈ 270°").
(3) AERIAL EVIDENCE: State what the driveway / walkway in Image A shows (e.g. "Driveway exits the garage on the NORTH side, connecting to Chalk Hill Way → front faces NORTH"). Include the raw azimuth you read from Image A (e.g. "aerial azimuth estimate: ~0°").
(4) IMAGE B EVIDENCE: State the camera heading in degrees and what Image B shows (e.g. "Camera heading 269° (pointing West). Image B shows front door on the North-facing wall → street_view_shows_front = TRUE → GPS: (269+180)%360 = 89° but the perpendicular-street bailout fires because both GPS candidates are >90° from aerial estimate, so aerial azimuth ~0° is used"). If Image B was uninformative, state that explicitly.
(5) FINAL: State the final azimuth in degrees and the compass label (e.g. "Final orientation: North (~0°), confidence = high").
`.trim();
}

// ─── Aerial-Only Prompt (No Street View) ──────────────────────────────────────

/**
 * Prompt used when ONLY the aerial satellite image is available.
 */
export function buildOrientationPromptAerialOnly(address?: string, description?: string | null, streetBearing?: number | null, streetSide?: 'N' | 'S' | 'E' | 'W' | null): string {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const sideLabel = streetSide === 'N' ? 'NORTH' : streetSide === 'S' ? 'SOUTH' : streetSide === 'E' ? 'EAST' : streetSide === 'W' ? 'WEST' : null;
    // sideFact fires ONLY when bearing is suppressed (null) — i.e. the road is curved/looping
    // so bearingHint can't run. When bearing IS available, bearingHint below provides the
    // correct perpendicular directions and sideFact should stay silent to avoid confusion.
    // For stable N-S/E-W roads, "front faces NORTH" would be wrong (front faces perpendicular).
    const sideFact = (streetBearing == null && sideLabel)
        ? ` GPS geocoding confirms "${streetName || address}" is to the ${sideLabel} of this property — the front likely faces ${sideLabel}.`
        : '';
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}"\nThe front entrance MUST face "${streetName || address}" — this is the authoritative front street.${sideFact} Rules:\n• DRIVEWAY CONNECTION REQUIRED: A road is only a valid front street if a driveway or pedestrian walkway directly connects the property to it with no barrier in between.\n• If a road is separated from the property by a green belt, tree row, park strip, or any physical barrier with NO driveway crossing it — that road is NOT the front street.\n• Do NOT default to the largest or most prominent visible road. Look for where the driveway actually exits.\n• Override the address street ONLY if BOTH a visible driveway AND pedestrian walkway clearly connect to a different street. One cue alone is not enough to override.`
        : '';
    const descriptionOverride = buildDescriptionHint(description);
    const compassLabel = (az: number) => ['North','Northeast','East','Southeast','South','Southwest','West','Northwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
    const bearingHint = streetBearing != null ? (() => {
        const perp1 = (streetBearing + 90) % 360;
        const perp2 = (streetBearing - 90 + 360) % 360;
        const par2  = (streetBearing + 180) % 360;
        const label = (az: number) => ['North','Northeast','East','Southeast','South','Southwest','West','Northwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
        return `\nGPS STREET BEARING PRIOR: GPS data confirms the address street runs at ~${Math.round(streetBearing)}°. For a standard lot the front MUST face ${label(perp1)} (~${Math.round(perp1)}°) or ${label(perp2)} (~${Math.round(perp2)}°) — perpendicular to the road. Use the driveway apron to confirm which of the two is correct.\n⛔ FORBIDDEN azimuths: ~${Math.round(streetBearing)}° and ~${Math.round(par2)}° are the road-parallel directions and are ALWAYS WRONG for a standard lot. Your azimuth_degrees MUST NOT be within 15° of ${Math.round(streetBearing)}° or ${Math.round(par2)}°. If you find yourself wanting to output one of these, stop, re-examine the driveway, and use the perpendicular instead.`;
    })() : '';

    return `
You are a spatial analysis expert. I am providing one high-resolution aerial satellite image (North-up, blue "N" dot marks North).
${addressClue}${bearingHint}${descriptionOverride}

GUIDING PRINCIPLES:
1. NORTH IS UP: Use the strict top-of-frame as 0° North.
2. WALKWAY RULE (MANDATORY): The architectural front is where the pedestrian path from the PUBLIC SIDEWALK leads to the main door — NOT the driveway or garage.
3. GARAGE NOTE: Supporting evidence only. On corner lots, the garage may face a side street while the main entrance faces the address street.
4. ADDRESS STREET PRIORITY: When multiple streets are visible, give strong priority to the address street as the front street.

LAYOUT CLASSIFICATION (do this FIRST, before orientation):
Classify the property as standard_street_layout = FALSE if ANY of the following apply:
  • CORNER LOT: The lot abuts two or more streets on different sides. Two or more road edges are visible in the aerial.
  • SIDE-LOADING ENTRY: The main door is tucked into a courtyard or on a side face perpendicular to the street — not directly facing the road.
  • FLAG LOT: The house is set far back behind another home, accessed only by a long narrow private driveway. No direct street frontage.
  • RURAL/ACREAGE: Large lot with significant distance from any public road. The house may face a view (lake, valley, hills) rather than the road.
  • CURVED OR LOOPING STREET: The address street visibly curves or loops so a single perpendicular direction is ambiguous. Addresses with CT, CIR, LOOP, WAY, or COURT in the street name are likely this type.
If NONE of the above apply → standard_street_layout = TRUE (simple rectangular lot on a straight road).

CONFIDENCE GATE (MANDATORY — read before answering):
If you CANNOT clearly identify the driveway apron OR pedestrian walkway with HIGH confidence — because the image is ambiguous, the driveway is not clearly visible, or features are obscured — you MUST:
  → Set confidence = 'low'
  → Set final_orientation = 'UNCLEAR'
  → Set azimuth_degrees = null
An UNCLEAR result is far better than a confidently wrong one.

TASK:
Step 1 — LAYOUT DETECTION: Identify lot type (cul-de-sac, corner, standard, flag) from the aerial.
Step 2 — DRIVEWAY APRON (primary signal):
   A driveway is ONLY valid if it satisfies ALL of the following:
   a) It is a paved strip that STARTS at the garage and ENDS with a CURB CUT — where the private pavement meets the public road surface at a lowered or flush curb. The transition from private to public road must be continuous with no gap.
   b) DEAD-END PAVING TRAP: Paved areas along the side or rear of a house that terminate before reaching the road (stopping at a fence, landscaping, another lot, or a strip of grass between the paving and the road) are NOT driveway aprons — they are internal pathways or court areas. Do NOT treat them as the front.
   c) When two roads are visible north and south of the property, trace EACH candidate driveway all the way to the road to verify which road it actually connects to. Do not assume the north-side paving connects to the north road without tracing the connection.
   The side where a verified driveway apron meets the public street is where the front faces.
Step 3 — FRONT WALK (confirmation): Look for a narrower concrete/brick path leading to a porch or front door.
Step 4 — State the compass direction the FRONT WALL faces outward (0°=North, 90°=East, 180°=South, 270°=West).
   PERPENDICULAR RULE (MANDATORY): Your azimuth_degrees MUST be roughly perpendicular (±45°) to the road bearing.
   The front wall faces TOWARD or AWAY from the road — NEVER along it.
   → If the road runs at ~315° (NW↔SE), valid azimuths are ~45°(NE) or ~225°(SW). NOT 315° or 135°.
   → If the road runs at ~90° (E↔W), valid azimuths are ~0°(N) or ~180°(S). NOT 90° or 270°.
   If your azimuth is within 15° of the road bearing, you have made an error — CORRECT IT to the nearest perpendicular.
Step 5 — Assess Privacy, Lot Coverage (Hardscape %), and Site Features (Pool/Garage/Yard directions).
Step 6 — GPS SELF-CHECK (only if a GPS STREET BEARING PRIOR appears above):
   a) The prior already told you the two valid perpendicular directions for this lot.
   b) Compare your Step 4 azimuth against those two options.
   c) If your azimuth is within 45° of one of the GPS perpendiculars AND the image does NOT show a clear physical reason the front faces elsewhere (e.g. no driveway, a solid wall, or a fence on that side), then CORRECT your final_orientation and azimuth_degrees to that exact perpendicular.
   d) If your azimuth is already within 15° of a perpendicular, no correction needed — you're already aligned.
   e) If correcting, note it explicitly: "GPS self-check: adjusted from [original] to [corrected]."
   PARALLEL CHECK (always run): If your azimuth is within 15° of the road bearing itself (NOT the perpendicular), you have made the most common error — outputting the road direction instead of the facing direction. CORRECT to the nearest perpendicular, or set UNCLEAR if uncertain.

EXPLANATION FORMAT — use this EXACT structure, one numbered sentence per step:
(1) LAYOUT: State standard_street_layout=true/false and one specific visual reason (e.g. "Corner lot — two distinct road frontages visible in Image A").
(2) STREET CONTEXT: Name the address street, which edge of the lot it runs along, and the approximate bearing (e.g. "Chalk Hill Way runs East-West (~269°) along the NORTH edge of the lot").
(3) AERIAL EVIDENCE: State what the driveway / walkway shows and which road edge it connects to (e.g. "Driveway curb cut connects to Chalk Hill Way on the north edge → front faces North"). Include your raw aerial azimuth estimate before any GPS self-check.
(4) GPS SELF-CHECK: State whether a GPS correction was applied. If yes: "GPS self-check: adjusted from [original]° to [corrected]°." If no: "GPS self-check: no correction needed — aerial estimate already within 15° of perpendicular."
(5) FINAL: State the resulting orientation and confidence (e.g. "Final orientation: North (~0°), confidence = high").
Also set front_street_name to the road name identified in step 2.
`.trim();
}




// ─── Response Schema ──────────────────────────────────────────────────────────

export const satellitarySchema = {
    type: Type.OBJECT,
    properties: {
        image_quality: {
            type: Type.STRING,
            enum: ['clear', 'acceptable', 'blurry'],
            description: 'Assessed clarity of the satellite image. Set to "blurry" if the image is too low-resolution for reliable analysis.'
        },
        final_orientation: {
            type: Type.STRING,
            description: 'Short compass direction the front of the house likely faces, e.g. "Northeast", "South", "East-Southeast". Use "UNCLEAR_IMAGE" if image_quality is blurry or "UNDER_CONSTRUCTION" if the site is not a finished home.'
        },
        azimuth_degrees: {
            type: Type.NUMBER,
            description: 'Approximate azimuth in degrees (0=North, 90=East, 180=South, 270=West). Omit or use null if truly uncertain.',
            nullable: true
        },
        property_layout_type: {
            type: Type.STRING,
            enum: ['corner_lot', 'cul_de_sac', 'flag_lot', 'irregular_lot', 'standard', 'other'],
            description:
                'Categorize the property layout by checking these types IN ORDER. Stop at the first one that fits: ' +
                '1. corner_lot: lot sits at a street intersection, exposed on two street sides. ' +
                '2. cul_de_sac: the house faces a rounded dead-end / circular street terminus (teardrop shape). ' +
                '3. flag_lot: lot is set back behind another, accessed via a long narrow "pole" driveway. ' +
                '4. irregular_lot: non-rectangular boundary with significant curves or angles. ' +
                '5. standard: most typical lots (rectangular, on a non-ending through-street). ' +
                '6. other: none of the above match.'
        },
        confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
            description: 'How confident you are in the orientation based on image clarity.'
        },
        is_under_construction: {
            type: Type.BOOLEAN,
            description: 'Set to true if the property appears to be a dirt lot, foundation, or framed structure under active construction. If true, set orientation to UNDER_CONSTRUCTION.'
        },
        standard_street_layout: {
            type: Type.BOOLEAN,
            description: 'MANDATORY for aerial-only analysis. Set to TRUE only if ALL of the following hold: (1) the lot is rectangular or near-rectangular on a straight non-looping street, (2) no second road edge is visible on an adjacent side (not a corner lot), (3) the house is NOT set far back behind another property via a long narrow access driveway (not a flag lot), (4) the entry does not appear to be a courtyard or side-tucked arrangement (not side-loading), (5) the lot is not a large rural/acreage property where the house may face a view rather than the road, and (6) the street is not curved or looping. Set to FALSE for: corner lots, flag lots, curved/loop streets (CT, CIR, LOOP in address), side-loading entries, rural acreage properties.',
            nullable: true
        },
        explanation: {
            type: Type.STRING,
            description: 'Full step-by-step reasoning as described in the prompt.'
        },
        front_door_clearly_visible: {
            type: Type.BOOLEAN,
            description: 'Set to true ONLY if the street view image shows the front door of this specific unit clearly and unambiguously with a direct pedestrian path from the public sidewalk. For townhouses, requires a distinct unit door — not a shared lobby or side gate. Set to false if the front door is not visible, obstructed, or uncertain.',
            nullable: true
        },
        front_street_name: {
            type: Type.STRING,
            description: 'The name of the road the front of the house faces (e.g. "Atlas Peak Dr", "Main St"). This is the street the driveway/walkway connects to — not a highway or back alley. Omit if unknown.',
            nullable: true
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
            description: 'ONE or TWO sentences on what this facing direction typically means for a home. MANDATORY: every sentence MUST use a hedging word — "often", "typically", "may", "tends to", "can", "in many cases".'
        },
        street_view_shows_front: {
            type: Type.BOOLEAN,
            description: 'REQUIRED when a single street view is available. Set to true if Image B shows the FRONT (main entrance / front door visible). Set to false if it shows the side or back. Base this on your aerial/walkway analysis.',
            nullable: true
        },
        front_image_letter: {
            type: Type.STRING,
            enum: ['B', 'C', 'D', 'E'],
            description: 'REQUIRED in multi-pano mode. Set to the letter of the image that shows the FRONT entrance: B=south wall, C=north wall, D=east wall (if provided), E=west wall (if provided).',
            nullable: true
        },
        pool_visible: {
            type: Type.BOOLEAN,
            description: 'True if a pool/water feature is visible on the lot.',
            nullable: true
        },
        pool_direction: {
            type: Type.STRING,
            enum: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
            description: 'Compass direction of the pool from house center.',
            nullable: true
        },
        garage_direction: {
            type: Type.STRING,
            enum: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
            description: 'Compass direction the garage opening/driveway exit faces.',
            nullable: true
        },
        open_sky_direction: {
            type: Type.STRING,
            enum: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
            description: 'Compass direction of the largest unobstructed yard area.',
            nullable: true
        }
    },
    required: ['property_layout_type', 'image_quality', 'final_orientation', 'confidence', 'explanation', 'privacy_insight', 'buyer_pro', 'buyer_con', 'orientation_highlights']
};

// ─── Multi-Pano Prompt (No Named-Street Coverage) ───────────────────────────

/**
 * Prompt for properties where the named address street has no Street View coverage.
 * Provides TWO street-view images from opposite sides (e.g. south + north, or east + west)
 * and asks Gemini to identify which one shows the architectural front.
 *
 * @param imageBHeading  Camera heading for Image B (degrees, 0=North)
 * @param imageBDir      Human label for Image B direction (e.g. 'south')
 * @param imageCHeading  Camera heading for Image C (degrees)
 * @param imageCDir      Human label for Image C direction (e.g. 'north')
 */
/**
 * Prompt for properties where the named address street has no Street View coverage.
 * Provides FOUR street-view images from all cardinal sides (S, N, E, W)
 * and asks Gemini to identify which one shows the architectural front.
 *
 * @param panos  Array of { heading, dir, label } for each cardinal image (B through E)
 */
export function buildOrientationPromptMultiPano(
    imageBHeading: number,
    imageBDir: string,
    imageCHeading: number,
    imageCDir: string,
    address?: string,
    description?: string | null,
    imageDHeading?: number,
    imageDDir?: string,
    imageEHeading?: number,
    imageEDir?: string,
    streetPrior?: string,
): string {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}" (front typically faces ${streetName || 'address street'}).`
        : '';
    const descriptionOverride = description ? `\n\n🏷️  LISTING DESCRIPTION:\n"${Array.isArray(description) ? description.join(' ') : description}"` : '';

    const oppDir = (d: string) =>
        d === 'south' ? 'north' : d === 'north' ? 'south' : d === 'east' ? 'west' : 'east';

    const hasDE = imageDDir && imageDHeading != null && imageEDir && imageEHeading != null;
    const totalImages = hasDE ? 'FIVE' : 'THREE';
    const imageList = hasDE
        ? `- Image A: Aerial satellite (North-up — north is the TOP of this image)
- Image B: Street view from the ${imageBDir.toUpperCase()} side → camera points ${oppDir(imageBDir)} → shows the ${imageBDir}-facing wall
- Image C: Street view from the ${imageCDir.toUpperCase()} side → camera points ${oppDir(imageCDir)} → shows the ${imageCDir}-facing wall
- Image D: Street view from the ${imageDDir!.toUpperCase()} side → camera points ${oppDir(imageDDir!)} → shows the ${imageDDir}-facing wall
- Image E: Street view from the ${imageEDir!.toUpperCase()} side → camera points ${oppDir(imageEDir!)} → shows the ${imageEDir}-facing wall`
        : `- Image A: Aerial satellite (North-up — north is the TOP of this image)
- Image B: Street view from the ${imageBDir.toUpperCase()} side → camera points ${oppDir(imageBDir)} → shows the ${imageBDir}-facing wall
- Image C: Street view from the ${imageCDir.toUpperCase()} side → camera points ${oppDir(imageCDir)} → shows the ${imageCDir}-facing wall`;

    const frontLetterInstruction = hasDE
        ? `Set front_image_letter to the letter (B/C/D/E) of the image whose wall is the FRONT (has the main entrance/walkway/porch).
   B = ${imageBDir}-facing wall, C = ${imageCDir}-facing wall, D = ${imageDDir}-facing wall, E = ${imageEDir}-facing wall.`
        : `Set front_image_letter to "B" if the ${imageBDir}-facing wall is the FRONT, or "C" if the ${imageCDir}-facing wall is the FRONT.`;

    const garageImages = hasDE
        ? `Images B, C, D, and E (each shows one cardinal wall):
         B=${imageBDir}, C=${imageCDir}, D=${imageDDir}, E=${imageEDir}.
         Set garage_direction to the direction of whichever image shows visible garage doors.`
        : `Images B and C — B shows the ${imageBDir} wall, C shows the ${imageCDir} wall.`;

    const explainFormat = hasDE
        ? `State (1) which wall the walkway leads to in Image A, (2) which image (B/C/D/E) confirms that wall with the front door, (3) the azimuth, (4) garage_direction.`
        : `State (1) which wall the walkway leads to in Image A, (2) which street view (B or C) shows that wall and any garage doors, (3) the azimuth, (4) the garage_direction.`;

    return `
You are a spatial analysis expert. I am providing ${totalImages} images:
${imageList}
${addressClue}${descriptionOverride}
${streetPrior ? `\n${streetPrior}\n` : ''}
IMPORTANT CONTEXT: The address street (${streetName || 'front street'}) has no direct Street View coverage.
The images are from nearby streets on each side of the property. Use them together with the aerial to determine the front.

GUIDING PRINCIPLES:
1. NORTH IS UP on Image A. The top of Image A = North. Left = West. Bottom = South. Right = East.
2. WALKWAY RULE: The front is the side where a pedestrian path from a public street leads to the main door.
3. GARAGE: Garages are supporting evidence only. Confirm with porch/front door.
4. ADDRESS STREET: The front typically faces ${streetName || 'the address street'}.

TASK:
Step 1: Using Image A, find the WALKWAY — a paved/concrete path from a public road leading to the main door. Which compass direction does it face? (The front wall faces outward in the same direction as the walkway.)
Step 2: Set azimuth_degrees to the direction the FRONT WALL faces outward (0=North, 90=East, 180=South, 270=West).
         ⚠️  AZIMUTH-LETTER CONSISTENCY CHECK: These must match exactly:
         • If front_image_letter = "B" → azimuth_degrees ≈ ${Math.round((imageBHeading + 180) % 360)} (the ${imageBDir}-facing wall)
         • If front_image_letter = "C" → azimuth_degrees ≈ ${Math.round((imageCHeading + 180) % 360)} (the ${imageCDir}-facing wall)
         Re-check: does the azimuth you set match the image letter you chose?
Step 3: Set final_orientation to the compass label (e.g. "South", "Southeast").
Step 4: ${frontLetterInstruction}
Step 5: Determine additional fields:
  - garage_direction: Priority order:
      1. STREET VIEW: Look for visible garage doors in ${garageImages}
      2. DEFAULT: If street views are unclear, assume garage faces same direction as the front entrance.
         Override only if Image A aerial shows a driveway connecting from a clearly different direction.
  - pool_visible: true/false — use Image A aerial.
  - pool_direction: Which side the pool is on, using Image A cardinal axes.
  - open_sky_direction: Direction with most open space/sky, using Image A.
  - All other fields (privacy, lot coverage, buyer_pro/con, feng_shui_vastu, etc.).

EXPLANATION FORMAT: ${explainFormat}
`.trim();
}


export const ORIENTATION_PROMPT_DUAL = buildOrientationPromptDual();
export const ORIENTATION_PROMPT_AERIAL_ONLY = buildOrientationPromptAerialOnly();
export const ORIENTATION_PROMPT = ORIENTATION_PROMPT_DUAL;

// ─── Final Reinforcement (Appended in code) ──────────────────────────────────

export function getDualPromptFinalInstructions(streetViewHeading?: number | null): string {
    return `
FINAL REMINDER:
1. WALKWAY RULE: The side where the path from the street leads to a door is the FRONT.
2. FACING DIRECTION: The azimuth is the direction from the house TOWARD the street (never away from it). All 8 directions are valid — do NOT collapse diagonals to cardinals. Examples: street to south→S(180°), to SE→SE(135°), to NW→NW(315°). Do NOT invert (street south = face south, not north).
3. AMBIGUITY: If Image B shows the front door, use the heading ${streetViewHeading != null ? `${streetViewHeading}°` : 'provided'} to derive the exact azimuth. If Image B shows a garage but the front door is elsewhere, street_view_shows_front must be FALSE.
4. CONFIDENCE: Be low/medium if the image is soft or cues are conflicting.
`.trim();
}
