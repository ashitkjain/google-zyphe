/**
 * Satellitary Orientation Analysis — Prompt & Schema (JS Mirror of satellitaryAnalysis.ts)
 */

/** Inline azimuth→compass label for use in prompt builders. */
function azimuthToCompassLabel(az) {
    if (az == null) return 'UNCLEAR';
    const dirs = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    return dirs[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

/** Builds a listing description hint block for orientation prompts. */
function buildDescriptionHint(description) {
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
 */
export function buildOrientationPromptDual(streetViewHeading, address, description, streetBearing, homeType) {
    const headingContext = streetViewHeading != null
        ? `\n\nCAMERA HEADING: ${streetViewHeading}° (0°=North, 90°=East, 180°=South, 270°=West)\nThe camera was pointing in direction ${streetViewHeading}° when it captured Image B.`
        : '';

    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const typeLabel = homeType ? `\n\nPROPERTY TYPE: ${homeType}` : '';
    const addressClue = address ? `\n\nPROPERTY ADDRESS: "${address}"${typeLabel}\nThe front entrance usually faces "${streetName || address}", but for townhouses/multi-unit complexes, it may face an internal courtyard, shared walkway, or park instead.` : '';
    const descriptionOverride = buildDescriptionHint(description);

    const compassLabel = (az) => ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
    const bearingHintDual = streetBearing != null ? (() => {
        const perp1 = (streetBearing + 90) % 360;
        const perp2 = (streetBearing - 90 + 360) % 360;
        const par2 = (streetBearing + 180) % 360;
        return `\n\nGPS STREET BEARING ADVISORY: GPS data estimates the address street runs at ~${Math.round(streetBearing)}°.
\u26a0 VISUAL OVERRIDE — Before using this hint, look at Image A: if the road is curved, a cul-de-sac/dead-end loop, or this is a corner lot with two distinct street frontages, IGNORE this GPS hint entirely and determine orientation from the aerial image visually.
If the road IS straight and the lot IS standard: the front most likely faces ${compassLabel(perp1)} (~${Math.round(perp1)}°) or ${compassLabel(perp2)} (~${Math.round(perp2)}°) — perpendicular to the road. Use the driveway apron (Image A) and the visible door/walkway (Image B) to decide which is correct.
\u26d4 FORBIDDEN (straight standard lot only): ~${Math.round(streetBearing)}° and ~${Math.round(par2)}° are the road-parallel directions. Do NOT output these unless you have overridden the hint due to a curved or complex layout.
VISUAL CROSS-CHECK: Independently estimate the road bearing from Image A using the diagonal guide (lower-left→upper-right = SW↔NE \u2248 45°, lower-right→upper-left = SE↔NW \u2248 135°, left↔right = E↔W \u2248 90°, top↔bottom = N↔S \u2248 0°). Set street_bearing_visual_degrees to that estimate. If your visual estimate and the GPS bearing above differ by more than 45° when treated as road directions (0–179° scale), note the conflict in your explanation and set confidence='low'.`;
    })() : `\n\nVISUAL BEARING ESTIMATE: No GPS bearing is available. Estimate the road bearing from Image A using the diagonal guide: lower-left→upper-right = SW↔NE \u2248 45°, lower-right→upper-left = SE↔NW \u2248 135°, left↔right = E↔W \u2248 90°, top↔bottom = N↔S \u2248 0°. Set street_bearing_visual_degrees to that estimate.`;

    return `
You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and a Street View image (Image B) of a property.
${headingContext}${addressClue}${descriptionOverride}${bearingHintDual}

GUIDING PRINCIPLES:
1. IMAGE A (AERIAL) IS THE ANCHOR: North is strictly at the top. Use it to identify the building footprint, street layout, and architectural features.
2. THE WALKWAY RULE: Trace the pedestrian walkway from the public sidewalk to the main door. The wall it leads to is the architectural FRONT.
3. DRIVEWAY & GARAGE (supporting): In typical single-family homes, the garage and front door are on the SAME wall. The driveway runs from the public street to the garage — the side where the driveway meets the street is generally the front.
4. CORNER LOTS: Garages sometimes face secondary streets or rear alleys. Always verify with the pedestrian walkway or porch, not just the garage.
5. TOWARD RULE (most common error): The front faces TOWARD the road — in the direction FROM the lot center TO the road. The direction the road TRAVELS is irrelevant.
   → Road on the NORTHEAST edge → front faces NORTHEAST (~45°). NOT NW or SE (those are the road's travel directions).
   TRAP: "The road runs NW/SE along the NE edge" → front faces NE — never NW or SE.
6. THE ANCHOR STRATEGY (Anti-Hallucination): Before determining orientation, identify one "Anchor Feature" visible in both the Aerial (Image A) and the Street View (Image B) — e.g., a specific tree, neighbor's roof color, chimney, or driveway curve. Describe its relative position in both images to ensure you haven't lost track of "North" when switching perspectives.
7. THE 3X3 GRID RULE: Mentally divide the lot into a 3x3 grid. Label the center square "House". Identify which squares contain the "Primary Road" (e.g., "Top-Center" and "Top-Right"). The orientation vector must originate in the "House" square and terminate in a "Road" square.

TASK SEQUENCE:
Step 0: Quality & Construction Check.
   - If Image A is too blurry, set image_quality="blurry", final_orientation="UNCLEAR_IMAGE", and stop.
   - If the site is under active construction, set is_under_construction=true, final_orientation="UNDER_CONSTRUCTION", and stop.

Step 0b: Street View Usability Check (MANDATORY before Steps 3–4).
   - Examine Image B. If ANY of the following apply, the street view is UNINFORMATIVE:
       \u2022 Privacy blur (foggy/milky white overlay) covering the majority of the image
       \u2022 Solid fence, wall, or gate with no architectural features visible
       \u2022 The house is too far away or obstructed by trees/vegetation/parked vehicles to identify architectural details
       \u2022 The image shows a generic street scene with no clear view of this property's facade
     If uninformative:
       → Mark street_view_shows_front = null (unknown)
       → Set front_door_clearly_visible = false
       → Skip Step 3 entirely — do NOT apply heading math
       → Rely SOLELY on Step 2 aerial analysis (driveway apron + walkway) for azimuth
       → Set confidence = 'medium' at most (downgrade to 'low' if driveway is also ambiguous)
   - Only proceed to Step 3 heading math if Image B clearly shows the front door, porch, or entry steps confirming FRONT vs BACK. A garage door or windows alone are NOT sufficient.

   TOWNHOUSE / CONDO / UNIT EXTRA GATE (MANDATORY IF PROPERTY_TYPE IS MULTI-UNIT):
   Multi-unit buildings often have side alleys, shared lobbies, parking bays, or rear gates visible in street view. These are NOT the primary front door.
   For multi-unit properties, set front_door_clearly_visible = true ONLY if ALL of the following are true:
     a) You can see a clearly distinct residential PEDESTRIAN front door — a walk-through door with a handle/knocker — belonging to this specific unit.
        A GARAGE DOOR (a vehicle roller or sectional door that opens for a car) is NEVER a front door, even if it faces the main road.
     b) The pedestrian door has a direct path from the public sidewalk (steps, porch, or stoop leading to THAT door).
     c) You are confident this pedestrian door — not a garage roller door, side gate, or rear gate — is the PRIMARY residential entrance.
     d) The door is close and distinct enough to identify as THIS unit specifically — not one of many identical-looking doors far in the distance.

   GARAGE IS NOT A DOOR (MANDATORY): Modern townhouses frequently have their GARAGE FACE on the road side. This view shows the VEHICLE ACCESS SIDE, NOT the primary residential front.
     → You are strictly FORBIDDEN from setting front_door_clearly_visible = true if the only visible entry is a garage/roller door.
     → If Image B shows only garages with no pedestrian door, you MUST set front_door_clearly_visible = false. This is a deliberate signal to the system to fall back to listing photos.

   SIDE-ENTRY / ALCOVE RULE: If the front door is recessed in an alcove or located on a side wall (common for townhouses), the orientation is the direction the door itself faces when walking out of it, NOT necessarily the direction of the building's main facade.
   UNIT-LEVEL ACCURACY: identify the specific unit (marked by the red pin). Do not assume its orientation matches the whole building if the unit has a unique entry.

   SIDE-LOADING GARAGE TRAP (CRITICAL FOR CORNER LOTS): In modern townhouses, the GARAGE and DRIVEWAY are often on one street (the side or back) while the FRONT DOOR and WALKWAY are on the other street (the main front).
     → DRIVEWAY RECONCILIATION: If Image B shows a porch but NO driveway, and Image A shows a driveway on the South side, the front is NOT the South side. You must find the porch on the aerial and orient to THAT wall.
     → If the driveway and walkway lead to DIFFERENT streets: The orientation is the direction of the WALKWAY/FRONT DOOR.
     → RECTANGULAR FOOTPRINT RULE (MANDATORY): Most houses are rectangular with walls facing 0, 90, 180, or 270 degrees. Do NOT use diagonal azimuths (45, 135, 225, 315) just because a house is on a corner or a curve. 
      \u2022 If the house walls are parallel to the North-up edges of the image, the orientation is a cardinal direction (0, 90, 180, or 270). 
      \u2022 A property's edge touching a slanted road (Southwest) DOES NOT mean it faces Southwest. If the house faces South, its orientation is 180\u00b0, even if the street is to its SW.
      \u2022 Only use slanted/diagonal azimuths if the building structure itself is visibly rotated at an angle relative to the cardinal grid of the neighborhood.

   ELIMINATION & VALIDATION LOGIC:
     → RULE OUT DIRECTIONS: Use Image B to validate your assumptions. If Image B shows a back patio, a side wall with no entry, or a garage-only facade, then the direction that camera is facing is highly unlikely to be the correct final_orientation.
     → CROSS-CHECK AERIAL ASSUMPTIONS: If you assume the house faces North from the aerial, but the North-facing Street View (Image B) shows a featureless wall or back fence, your aerial assumption is likely incorrect and should be re-evaluated.
     → DRIVEWAY/PORCH RECONCILIATION: If Image B shows a residential porch but NO driveway, and the aerial shows a driveway on the South side, the front is likely NOT the South side. Seek visual evidence of the porch wall on the aerial.

   TOWNHOUSE COMPLEX LAYOUT RULE: If the PROPERTY_TYPE is a townhouse/condo (shared walls) AND the layout is non-standard (corner lot, cul-de-sac, internal shared driveway, or eyebrow/widened curve):
     → You should default to final_orientation = 'UNCLEAR' unless the front door and orientation are indisputable (e.g., clearly visible entry in Street View matching exactly one wall on the Aerial with high confidence).

   STALE AERIAL / NEW CONSTRUCTION RULE: If Image A (Satellite) shows a construction site (dirt lot, framing, or foundations) but the Listing Photos or Street View show a finished home, the aerial imagery is STALE.
     → You MUST set is_under_construction = false (because the home is now finished).
     → You should set confidence = 'low' due to the imagery discrepancy.
     → If the Roadmap does not yet show the street or you are "inferring" the path of a road that isn't clearly paved in the aerial, you should set final_orientation = 'UNCLEAR'. Do not guess the orientation of a house that hasn't been built yet in the satellite view.

Step 1: LAYOUT DETECTION — Examine Image A FIRST to determine the street layout:
   OPTION A — CUL-DE-SAC / COURT: Is there a clearly visible rounded bulb/teardrop dead-end terminus in the street AND the subject lot abuts this circular area directly?
      \u26a0 PROXIMITY TRAP: A property is ONLY a cul_de_sac lot if its front boundary abuts the CURVED/CIRCULAR bulb. If the road segment directly in front of the driveway is STRAIGHT, it is a STANDARD_STREET_LAYOUT, even if a cul-de-sac bulb exists nearby on the same street.
      → If YES (must abut the curve): Set property_layout_type = "cul_de_sac".
          CUL-DE-SAC DIRECTION METHOD — Prioritize physical evidence:
            \u2022 PRIMARY SIGNAL: Locate the Driveway Apron and Pedestrian Walkway in Image A. Trace the vector through that connection to the street.
            \u2022 SECONDARY FALLBACK (Verification): Locate the center of the cul-de-sac bulb (Point C) and the property center (Point P). The vector P\u2192C usually aligns with the front, but ONLY if the driveway also points that way.
            \u2022 If the P\u2192C vector and the Driveway vector disagree, the DRIVEWAY CONNECTION is authoritative.
            \u2022 Snap to the nearest CARDINAL direction (N, S, E, W) if the house matches the neighborhood grid.
            \u2022 Roadmap Note: Ignore local tangents on curves. Focus on the main building facade.

           CUL-DE-SAC EXTRA GATE: The Street View camera (Image C) may be on a side-street segment.
           - FENCE = SIDE RULE (MANDATORY): If Image C shows a fence, a side-yard gate, a chimney-side wall, or a backyard-style lawn, it is a SIDE view. Set street_view_shows_front = FALSE.
           - Set street_view_shows_front = TRUE ONLY if the house face in Image C contains the FRONT DOOR or GARAGE DOORS.
           - If the camera sees a SIDE or BACK wall, set street_view_shows_front = FALSE.
    OPTION B — STANDARD lot: Straight or gently curved street segment. Use the walkway rule.
    OPTION C — CORNER lot: Two distinct street frontages visible. Use pedestrian walkway to determine primary front.
    OPTION D — FLAG lot: Long driveway/easement leads to a setback lot hidden behind another property.

   DRIVEWAY CONNECTION RULE (applies to ALL layout types — check this before deciding the front street):
   A road is only a valid front street if there is a DIRECT VISIBLE CONNECTION from the property to that road:
     \u2022 A driveway or apron leading from the garage/parking to the road, OR
     \u2022 A pedestrian walkway from the front door to the sidewalk on that road.
   If a road is separated from the property by a green belt, tree row, park strip, retaining wall, fence, or any physical barrier (including a private lawn with no path):
     → That road is NOT the front street, regardless of how prominent or close it appears.
     → Do NOT default to the largest or nearest road — look for where the driveway actually exits.
   
   CARDINAL EXCLUSION (MANDATORY): Before deciding a direction (e.g., East), you MUST check all other directions (N, S, W). If another direction (e.g., North) has a clear driveway connection while the first direction (East) has a fence/lawn barrier, you MUST pivot to the clear connection.
   
   If you cannot find a clear driveway connection to any road, set confidence='low' and final_orientation='UNCLEAR'.

Step 2: Aerial Front-Wall Identification.
   Using the layout you identified in Step 1, identify which compass direction the front wall faces. Confirm with: (a) pedestrian walkway, (b) driveway direction, (c) lot orientation.

   FACING CONVENTION (CRITICAL — read carefully):
   The front wall faces TOWARD the street — its azimuth points FROM the house IN THE DIRECTION OF the street.
   This applies to ALL 8 compass directions:
      → Street to the SOUTH           → front faces SOUTH  (~180\u00b0)
      → Street to the NORTH           → front faces NORTH  (~0\u00b0)
      → Street to the EAST            → front faces EAST   (~90\u00b0)
      → Street to the WEST            → front faces WEST   (~270\u00b0)
      → Street to the SOUTHEAST       → front faces SE     (~135\u00b0)  — use SE, not "south" or "east"
      → Street to the SOUTHWEST       → front faces SW     (~225\u00b0)  — use SW, not "south" or "west"
      → Street to the NORTHEAST       → front faces NE     (~45\u00b0)   — use NE, not "north" or "east"
      → Street to the NORTHWEST       → front faces NW     (~315\u00b0)  — use NW, not "north" or "west"
   NEVER collapse a diagonal to a cardinal just because south/north is the dominant axis.
   NEVER invert (if street is south \u2192 face south, NOT north).

   DIRECTION PRECISION — trace the driveway from the house TOWARD the street:
     \u2022 Upper-left  = NORTHWEST — do NOT call this \u201cwest\u201d or \u201csouthwest\u201d
     \u2022 Upper-right = NORTHEAST — do NOT call this \u201cnorth\u201d or \u201ceast\u201d
     \u2022 Lower-left  = SOUTHWEST — do NOT call this \u201csouth\u201d or \u201cwest\u201d
     \u2022 Lower-right = SOUTHEAST — do NOT call this \u201csouth\u201d or \u201ceast\u201d
   If the driveway moves diagonally (has BOTH horizontal AND vertical components), use the intercardinal. Only use N/E/S/W when movement is almost entirely in ONE axis.

Step 3: Cross-check with Image B (street view). GPS camera heading = ${streetViewHeading != null ? `${streetViewHeading}\u00b0` : 'N/A'} (exact, GPS-measured).
   Your ONLY job in Step 3: look at Image B and judge whether it shows the front or back of the house.
   Judge from IMAGE B ALONE — do NOT set this to match your Step 2 aerial conclusion.
   RULE A — Image B clearly shows a PEDESTRIAN front door (a walk-through door with a handle/knocker), porch, or front steps with a direct path from the public sidewalk:
      \u2192 street_view_shows_front = TRUE
      \u26a0  RULE A EXCLUSIONS — NONE of the following count as a "front door" for Rule A:
         \u2022 A garage door, roller door, sectional door, or any vehicle bay opening — even if it faces the main road
         \u2022 A carport (covered parking bay open on the sides) — this is VEHICLE ACCESS, not the residential front
         \u2022 A covered breezeway leading to parking
         \u2022 A gate, side alley, or shared building lobby
         \u2022 Windows or balconies with no ground-level door
      If Image B shows ONLY vehicle access structures (carports, garages, roller bays) with no clearly visible PEDESTRIAN door:
         \u2192 front_door_clearly_visible = false
         \u2192 street_view_shows_front = FALSE (even if the roof looks like it could have an entry beneath)
   \u26a0  TOWNHOUSE / CONDO RE-CHECK: Before setting street_view_shows_front = TRUE for any townhouse, row house, or multi-unit building, re-apply the conditions from Step 0b. If front_door_clearly_visible is false (as set in Step 0b), you MUST set street_view_shows_front = FALSE here. These two fields must be consistent.
   RULE B — Image B shows ONLY a blank wall, fence, carport, garage bay, or side with no pedestrian opening:
      \u2192 street_view_shows_front = FALSE

Step 4: Finalize.
   IF street_view_shows_front = FALSE (set in Step 3):
      \u26a0  GARAGE-SIDE CORRECTION — The camera is on the NON-FRONT side of the house.
      This means the driveway you traced in Step 2 connects to the GARAGE, not the front entrance.
      The Step 2 azimuth is the GARAGE direction, NOT the front orientation.
      You must now look at Image A for the REAL front:
        a) Identify the faces of the house that are NOT connected to the Step 2 driveway.
        b) Look for a pedestrian walkway (narrower paved path from public sidewalk to a door) on any other face.
        c) If a clear pedestrian walkway is visible on another face \u2192 that face is the architectural front.
           Revise azimuth_degrees and final_orientation to reflect that face.
        d) If no other face shows a clear pedestrian entry path \u2192 set final_orientation = 'UNCLEAR',
            azimuth_degrees = null, confidence = 'low'.
            Do NOT use the garage-facing direction as the final answer.

Step 5: CLOCK-FACE CHECK (Geometric Verification):
    Map the road and the front door to a clock face where 12:00 is North.
    - Which "hour" does the road lie on relative to the house center?
    - Which "hour" does the front door point toward?
    - VERIFICATION: These must be within 3 "hours" (90 degrees) of each other. If they are not, you have likely hallucinated a direction — RE-EVALUATE.

ADDITIONAL ANALYSIS:
- Privacy: Assess neighboring sightlines into the backyard/pool.
- Coverage: Estimate % Lot Coverage (Hardscape vs. Pervious).
- Site Features: Identify Pool, Garage, and Open Yard directions (N/NE/E/SE/S/SW/W/NW).
- Buyer Pro/Con: One punchy sentence each.

EXPLANATION FORMAT — use this EXACT structure, one numbered sentence per step:
(1) LAYOUT: layout type and one visual reason.
(2) STREET CONTEXT: name the address street, its bearing as read from the road map (Image C/B), and which edge of the property it runs along.
(3) AERIAL EVIDENCE: what the driveway/walkway shows, which road edge it connects to, and the raw aerial azimuth estimate.
(4) IMAGE B EVIDENCE: state the camera heading in degrees, what Image B shows (front/back/uninformative), and how street_view_shows_front was set.
(5) FINAL: State the final azimuth in degrees and the compass label (e.g. "Final orientation: North (~0\u00b0), confidence = high").
`.trim();
}

/**
 * Builds the aerial-only orientation prompt.
 */
export function buildOrientationPromptAerialOnly(address, description, streetBearing, streetSide, homeType) {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const sideLabel = streetSide === 'N' ? 'NORTH' : streetSide === 'S' ? 'SOUTH' : streetSide === 'E' ? 'EAST' : streetSide === 'W' ? 'WEST' : null;
    const sideFact = (streetBearing == null && sideLabel)
        ? ` GPS geocoding confirms "${streetName || address}" is to the ${sideLabel} of this property — the front likely faces ${sideLabel}.`
        : '';
    const typeLabel = homeType ? `\n\nPROPERTY TYPE: ${homeType}` : '';
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}"${typeLabel}\nThe front entrance usually faces "${streetName || address}" — this is the primary reference street. However, for townhouses or multi-unit complexes, the pedestrian entry may face an internal courtyard or shared walkway instead. Rules:\n\u2022 DRIVEWAY CONNECTION: While a driveway usually connects to the front street, townhomes often have rear-loading or side-loading garages. Locate the PEDESTRIAN entry first.\n\u2022 If a road is separated from the property by a green belt, tree row, park strip, or any physical barrier with NO driveway crossing it \u2014 that road is likely NOT the front street.\n\u2022 Do NOT default to the largest or most prominent visible road. Look for where the pedestrian walkway actually leads.\n\u2022 Override the address street only if you can visually identify a clear pedestrian entry facing a different direction.`
        : '';
    const descriptionOverride = buildDescriptionHint(description);
    const compassLabel = (az) => ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
    const bearingHint = streetBearing != null ? (() => {
        const perp1 = (streetBearing + 90) % 360;
        const perp2 = (streetBearing - 90 + 360) % 360;
        const par2 = (streetBearing + 180) % 360;
        const label = (az) => ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
        return `\nGPS STREET BEARING ADVISORY: GPS data estimates the address street runs at ~${Math.round(streetBearing)}\u00b0.\n\u26a0 VISUAL OVERRIDE — Before using this hint, look at the aerial: if the road is curved, a cul-de-sac/dead-end loop, or this is a corner lot with two distinct street frontages, IGNORE this GPS hint entirely and determine orientation from the aerial image visually.\nIf the road IS straight and the lot IS standard: the front most likely faces ${label(perp1)} (~${Math.round(perp1)}\u00b0) or ${label(perp2)} (~${Math.round(perp2)}\u00b0) — perpendicular to the road.\n\u26d4 SLANTED ROAD PRECISION: If the road is slanted (not perfectly N/E/S/W), the front azimuth MUST also be slanted. Do NOT round to the nearest cardinal direction (N/E/S/W) if it means sacrificing more than 10\u00b0 of accuracy. If a road is at 165\u00b0 (SSE), the perpendicular is 255\u00b0 (WSW), NOT 270\u00b0 (West). Use the lot lines in the Road Map (if provided) as a high-precision reference for perpendicularity.\n\u26d4 FORBIDDEN (straight standard lot only): ~${Math.round(streetBearing)}\u00b0 and ~${Math.round(par2)}\u00b0 are the road-parallel directions. Do NOT output these unless the visual override applies.\nVISUAL CROSS-CHECK: Independently estimate the road bearing from the aerial using the diagonal guide (lower-left\u2192upper-right = SW\u2194NE \u2248 45\u00b0, lower-right\u2192upper-left = SE\u2194NW \u2248 135\u00b0, left\u2194right = E\u2194W \u2248 90\u00b0, top\u2194bottom = N\u2194S \u2248 0\u00b0). Set street_bearing_visual_degrees to that estimate. If your visual estimate and the GPS bearing above differ by more than 45\u00b0 as road directions (0\u2013179\u00b0 scale), note the conflict and set confidence='low'.`;
    })() : `\nVISUAL BEARING ESTIMATE: No GPS bearing is available. Estimate the road bearing from the aerial using the diagonal guide: lower-left\u2192upper-right = SW\u2194NE \u2248 45\u00b0, lower-right\u2192upper-left = SE\u2194NW \u2248 135\u00b0, left\u2194right = E\u2194W \u2248 90\u00b0, top\u2194bottom = N\u2194S \u2248 0\u00b0. Set street_bearing_visual_degrees to that estimate.`;

    return `
You are a spatial analysis expert. I am providing one high-resolution aerial satellite image (North-up, blue "N" dot marks North).
${addressClue}${bearingHint}${descriptionOverride}

GUIDING PRINCIPLES:
1. NORTH IS UP: The top of the image is strictly 0\u00b0 North.
2. SCREEN-TO-COMPASS MAPPING:
   \u2022 Toward TOP of screen    = NORTH (0\u00b0)
   \u2022 Toward BOTTOM of screen = SOUTH (180\u00b0)
   \u2022 Toward RIGHT of screen  = EAST (90\u00b0)
   \u2022 Toward LEFT of screen   = WEST (270\u00b0)
   \u2022 Toward TOP-RIGHT        = NORTHEAST (45\u00b0)
   \u2022 Toward BOTTOM-RIGHT     = SOUTHEAST (135\u00b0)
   \u2022 Toward BOTTOM-LEFT      = SOUTHWEST (225\u00b0)
   \u2022 Toward TOP-LEFT         = NORTHWEST (315\u00b0)
3. WALKWAY RULE (MANDATORY): The architectural front is where the pedestrian path from the PUBLIC SIDEWALK leads to the main door \u2014 NOT the driveway or garage.
4. ADDRESS STREET PRIORITY: When multiple streets are visible, give strong priority to the address street.
5. TOWARD RULE (most common error): The front faces TOWARD the road \u2014 in the direction FROM the house TO the road.
   \u2022 If the road is BELOW the house (bottom of screen) \u2192 front faces SOUTH (180\u00b0).
   \u2022 If the road is ABOVE the house (top of screen)    \u2192 front faces NORTH (0\u00b0).
   \u2022 If the road is to the RIGHT of the house         \u2192 front faces EAST (90\u00b0).
   \u2022 If the road is to the LEFT of the house          \u2192 front faces WEST (270\u00b0).
   \u26a0 INVERSION TRAP: If the camera is on the road looking NORTH at the house, the house is facing SOUTH toward the camera. Do not confuse the camera's direction with the house's facing direction.
6. 3x3 GRID ANCHORING: Imagine a 3x3 grid over the property. The house center is the middle square. Determine the direction of the road relative to this center point to anchor your facing direction.
7. DRIVEWAY CONNECTION REQUIRED: A road is only a valid front street if there is a direct visible connection from the property to that road with no barrier.
8. NEW CONSTRUCTION / STALE SATELLITE: If Image A (Satellite) shows a dirt lot or construction site but listing photos or ground-level cues indicate a finished home, the aerial is STALE. Set is_under_construction=false and prioritize the finished state for orientation. Only set is_under_construction=true if ALL images show an unfinished state.
   TRAP: "The road runs NW/SE along the NE edge" \u2192 front faces NE \u2014 never NW or SE.

LAYOUT CLASSIFICATION (do this FIRST, before orientation):
Classify the property as standard_street_layout = FALSE if ANY of the following apply:
  \u2022 CORNER LOT: The lot abuts two or more streets on different sides. Two or more road edges are visible in the aerial.
  \u2022 SIDE-LOADING ENTRY: The main door is tucked into a courtyard or on a side face perpendicular to the street \u2014 not directly facing the road.
  \u2022 FLAG LOT: The house is set far back behind another home, accessed only by a long narrow private driveway. No direct street frontage.
  \u2022 RURAL/ACREAGE: Large lot with significant distance from any public road. The house may face a view (lake, valley, hills) rather than the road.
  \u2022 CURVED OR LOOPING STREET: The address street visibly curves or loops so a single perpendicular direction is ambiguous. Addresses with CT, CIR, LOOP, WAY, or COURT in the street name are likely this type UNLESS the property is on a clearly straight segment.
If NONE of the above apply \u2192 standard_street_layout = TRUE (simple rectangular lot on a straight road, even if the road ends in a cul-de-sac elsewhere).

CONFIDENCE GATE (MANDATORY \u2014 read before answering):
If you CANNOT clearly identify the driveway apron OR pedestrian walkway with HIGH confidence \u2014 because the image is ambiguous, the driveway is not clearly visible, or features are obscured \u2014 you MUST:
  \u2192 Set confidence = 'low'
  \u2192 Set final_orientation = 'UNCLEAR'
  \u2192 Set azimuth_degrees = null
An UNCLEAR result is far better than a confidently wrong one.

TASK:
Step 1 \u2014 LAYOUT DETECTION: Identify lot type (cul-de-sac, corner, standard, flag).
   \u26a0 CUL-DE-SAC vs STANDARD: A lot is "cul_de_sac" ONLY if it abuts a circular dead-end bulb/terminus directly. If it is on a straight segment leading to the bulb, or on a widened curve of a through-street (an "eyebrow"), it is "standard".
Step 2 \u2014 DRIVEWAY APRON (primary signal):
   A driveway is ONLY valid if it satisfies ALL of the following:
   a) It is a paved strip that STARTS at the garage and ENDS with a CURB CUT \u2014 where the private pavement meets the public road surface at a lowered or flush curb. The transition from private to public road must be continuous with no gap.
   b) DEAD-END PAVING TRAP: Paved areas along the side or rear of a house that terminate before reaching the road (stopping at a fence, landscaping, another lot, or a strip of grass between the paving and the road) are NOT driveway aprons \u2014 they are internal pathways or court areas. Do NOT treat them as the front.
   c) When two roads are visible north and south of the property, trace EACH candidate driveway all the way to the road to verify which road it actually connects to. Do not assume the north-side paving connects to the north road without tracing the connection.
   The side where a verified driveway apron meets the public street is where the front faces.
Step 3 \u2014 FRONT WALK (confirmation): Look for a narrower concrete/brick path leading to a porch or front door.
Step 4 \u2014 State the compass direction the FRONT WALL faces outward (0\u00b0=North, 90\u00b0=East, 180\u00b0=South, 270\u00b0=West).
    PERPENDICULAR RULE (MANDATORY): Your azimuth_degrees MUST be roughly perpendicular (\u00b145\u00b0) to the road bearing.
    The front wall faces TOWARD or AWAY from the road \u2014 NEVER along it.
    \u2192 If the road runs at ~315\u00b0 (NW\u2194SE), valid azimuths are ~45\u00b0(NE) or ~225\u00b0(SW). NOT 315\u00b0 or 135\u00b0.
    \u2192 If the road runs at ~90\u00b0 (E\u2194W), valid azimuths are ~0\u00b0(N) or ~180\u00b0(S). NOT 90\u00b0 or 270\u00b0.
     If your azimuth is within 15\u00b0 of the road bearing, you have made an error \u2014 CORRECT IT to the nearest perpendicular.
Step 4b \u2014 CLOCK-FACE CHECK (Geometric Verification):
    Map the road and the front door to a clock face where 12:00 is North.
    - Which "hour" does the road lie on relative to the house center?
    - Which "hour" does the front door point toward?
    - VERIFICATION: These must be within 3 "hours" (90 degrees) of each other. If they are not, you have likely hallucinated a direction \u2014 RE-EVALUATE.
Step 5 \u2014 Assess Privacy, Lot Coverage (Hardscape %), and Site Features (Pool/Garage/Yard directions).
Step 6 \u2014 GPS SELF-CHECK (only if a GPS STREET BEARING PRIOR appears above):
   a) The prior already told you the two valid perpendicular directions for this lot.
   b) Compare your Step 4 azimuth against those two options.
   c) If your azimuth is within 45\u00b0 of one of the GPS perpendiculars AND the image does NOT show a clear physical reason the front faces elsewhere (e.g. no driveway, a solid wall, or a fence on that side), then CORRECT your final_orientation and azimuth_degrees to that exact perpendicular.
   d) If your azimuth is already within 15\u00b0 of a perpendicular, no correction needed \u2014 you're already aligned.
   e) If correcting, note it explicitly: "GPS self-check: adjusted from [original] to [corrected]."
   PARALLEL CHECK (always run): If your azimuth is within 15\u00b0 of the road bearing itself (NOT the perpendicular), you have made the most common error \u2014 outputting the road direction instead of the facing direction. CORRECT to the nearest perpendicular, or set UNCLEAR if uncertain.

EXPLANATION FORMAT \u2014 use this EXACT structure, one numbered sentence per step:
(1) LAYOUT: State standard_street_layout=true/false and one specific visual reason (e.g. "Corner lot \u2014 two distinct road frontages visible in Image A").
(2) STREET CONTEXT: Name the address street and which edge of the lot it runs along. State your visual bearing estimate and the GPS bearing (if provided). Format: "Chalk Hill Way runs along the NORTH edge. Visual bearing: ~90\u00b0 (E\u2194W). GPS bearing: 89\u00b0 (provided) \u2014 agree." or "Visual bearing: ~45\u00b0 (SW\u2194NE). GPS bearing: n/a (not provided)." or "Visual bearing: ~45\u00b0. GPS bearing: 90\u00b0 \u2014 CONFLICT (differ by 45\u00b0 as road directions) \u2192 confidence lowered."
(3) AERIAL EVIDENCE: State what the driveway / walkway shows and which road edge it connects to (e.g. "Driveway curb cut connects to Chalk Hill Way on the north edge \u2192 front faces North"). Include your raw aerial azimuth estimate before any GPS self-check.
(4) GPS SELF-CHECK: State whether a GPS correction was applied and show the numbers. Format: "GPS self-check: visual azimuth ~225\u00b0, GPS perpendiculars ~135\u00b0/~315\u00b0 \u2014 adjusted to 225\u00b0 (already aligned)." or "GPS self-check: no GPS bearing available \u2014 using visual bearing only."
(5) FINAL: State the resulting orientation and confidence (e.g. "Final orientation: North (~0\u00b0), confidence = high").
Also set front_street_name to the road name identified in step 2.
`.trim();
}

/**
 * Builds the prompt for multi-pano mode.
 */
export function buildOrientationPromptMultiPano(
    imageBHeading, imageBDir, imageCHeading, imageCDir, address, description, 
    imageDHeading, imageDDir, imageEHeading, imageEDir, streetPrior
) {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}" (front typically faces ${streetName || 'address street'}).`
        : '';
    const descriptionOverride = description ? `\n\n🏷️  LISTING DESCRIPTION:\n"${Array.isArray(description) ? description.join(' ') : description}"` : '';

    const oppDir = (d) =>
        d === 'south' ? 'north' : d === 'north' ? 'south' : d === 'east' ? 'west' : 'east';

    const hasDE = imageDDir && imageDHeading != null && imageEDir && imageEHeading != null;
    const totalImages = hasDE ? 'FIVE' : 'THREE';
    const imageList = hasDE
        ? `- Image A: Aerial satellite (North-up \u2014 north is the TOP of this image)
- Image B: Street view from the ${imageBDir.toUpperCase()} side \u2192 camera points ${oppDir(imageBDir)} \u2192 shows the ${imageBDir}-facing wall
- Image C: Street view from the ${imageCDir.toUpperCase()} side \u2192 camera points ${oppDir(imageCDir)} \u2192 shows the ${imageCDir}-facing wall
- Image D: Street view from the ${imageDDir.toUpperCase()} side \u2192 camera points ${oppDir(imageDDir)} \u2192 shows the ${imageDDir}-facing wall
- Image E: Street view from the ${imageEDir.toUpperCase()} side \u2192 camera points ${oppDir(imageEDir)} \u2192 shows the ${imageEDir}-facing wall`
        : `- Image A: Aerial satellite (North-up \u2014 north is the TOP of this image)
- Image B: Street view from the ${imageBDir.toUpperCase()} side \u2192 camera points ${oppDir(imageBDir)} \u2192 shows the ${imageBDir}-facing wall
- Image C: Street view from the ${imageCDir.toUpperCase()} side \u2192 camera points ${oppDir(imageCDir)} \u2192 shows the ${imageCDir}-facing wall`;

    const frontLetterInstruction = hasDE
        ? `Set front_image_letter to the letter (B/C/D/E) of the image whose wall is the FRONT (has the main entrance/walkway/porch).
   B = ${imageBDir}-facing wall, C = ${imageCDir}-facing wall, D = ${imageDDir}-facing wall, E = ${imageEDir}-facing wall.`
        : `Set front_image_letter to "B" if the ${imageBDir}-facing wall is the FRONT, or "C" if the ${imageCDir}-facing wall is the FRONT.`;

    const garageImages = hasDE
        ? `Images B, C, D, and E (each shows one cardinal wall):
         B=${imageBDir}, C=${imageCDir}, D=${imageDDir}, E=${imageEDir}.
         Set garage_direction to the direction of whichever image shows visible garage doors.`
        : `Images B and C \u2014 B shows the ${imageBDir} wall, C shows the ${imageCDir} wall.`;

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
2. WALKWAY RULE: The front is the side where a pedestrian path (including stairs, steps, or tiered walkways) from a public street leads to the main door.
3. GARAGE: Garages are supporting evidence only. Confirm with porch/front door.
4. ADDRESS STREET: The front typically faces ${streetName || 'the address street'}.
5. THE ANCHOR STRATEGY (Anti-Hallucination): Before deciding on orientation, identify one "Anchor Feature" visible in both the Aerial (Image A) and the Street View panoramas \u2014 e.g., a specific tree, neighbor's roof color, chimney, or driveway curve. Describe its position in Image A versus its position in the street-view letter you select.
6. THE 3X3 GRID RULE: Mentally divide the lot into a 3x3 grid. Label the center square "House". Identify which squares contain the "Primary Road". The orientation vector must originate in the "House" square and terminate in a "Road" square.

TASK:
Step 1: Using Image A, find the WALKWAY \u2014 a paved/concrete path, set of stairs, or steps from a public road leading to the main door. Which compass direction does it face? (The front wall faces outward in the same direction as the walkway.)
Step 2: Set azimuth_degrees to the direction the FRONT WALL faces outward (0=North, 90=East, 180=South, 270=West).
         \u26a0  AZIMUTH-LETTER CONSISTENCY CHECK: These must match exactly:
         \u2022 If front_image_letter = "B" \u2192 azimuth_degrees \u2248 ${Math.round((imageBHeading + 180) % 360)} (the ${imageBDir}-facing wall)
         \u2022 If front_image_letter = "C" \u2192 azimuth_degrees \u2248 ${Math.round((imageCHeading + 180) % 360)} (the ${imageCDir}-facing wall)
         Re-check: does the azimuth you set match the image letter you chose?
Step 3: Set final_orientation to the compass label (e.g. "South", "Southeast").
Step 4: ${frontLetterInstruction}
Step 5: Determine additional fields:
  - garage_direction: Priority order:
      1. STREET VIEW: Look for visible garage doors in ${garageImages}
      2. DEFAULT: If street views are unclear, assume garage faces same direction as the front entrance.
         Override only if Image A aerial shows a driveway connecting from a clearly different direction.
  - pool_visible: true/false \u2014 use Image A aerial.
  - pool_direction: Which side the pool is on, using Image A cardinal axes.
  - open_sky_direction: Direction with most open space/sky, using Image A.
  - All other fields (privacy, lot coverage, buyer_pro/con, feng_shui_vastu, etc.).

EXPLANATION FORMAT: ${explainFormat}
`.trim();
}

/**
 * Prompt for the listing-photos fallback mode.
 */
export function buildListingPhotoPrompt(address, description, streetBearing, streetSide, photoCount = 0, photoMeta = [], homeType) {
    const streetName = address ? (address.split(',')[0] || '').replace(/^\d+[A-Za-z]?\s+/, '').trim() : null;
    const typeLabel = homeType ? `\n\nPROPERTY_TYPE: ${homeType}` : '';
    const sideLabel = { N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST', NE: 'NORTHEAST', NW: 'NORTHWEST', SE: 'SOUTHEAST', SW: 'SOUTHWEST' }[streetSide || ''] || null;
    const SIDE_AZ_MAP2 = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
    const sideAzimuth2 = streetSide ? SIDE_AZ_MAP2[streetSide] : null;
    const sideFact = (streetBearing == null && sideLabel && sideAzimuth2 != null)
        ? ` \u26a0\ufe0f GPS DIRECT ANSWER (override roadmap perpendicular rule): GPS road-offset geometry confirms "${streetName || address}" is to the ${sideLabel} of this property. Set azimuth_degrees \u2248 ${sideAzimuth2}\u00b0 (${sideLabel}). Only override if the aerial driveway/walkway CLEARLY exits in a completely different direction.`
        : '';
    const lastWord2 = (streetName || '').trim().split(/\s+/).pop()?.toLowerCase() || '';
    const culDeSacSuffix2 = /^(ct|court|cir|circle|pl|place)$/.test(lastWord2);
    const culDeSacSuffixHint2 = culDeSacSuffix2
        ? `\n\u26a0\ufe0f CUL-DE-SAC / DEAD-END ALERT: "${streetName}" ends in "${lastWord2.charAt(0).toUpperCase() + lastWord2.slice(1)}" \u2014 streets with this suffix are almost always cul-de-sacs or dead-end courts. Look for a circular loop or dead-end terminus for "${streetName}". If found: classify as cul_de_sac and derive the front direction by tracing the physical driveway connection to the specific segment it meets.
           \u26a0\ufe0f THROUGH-STREET TRAP: If the street continues in both directions past the circular area, it is a widened curve (an "eyebrow"), NOT a cul-de-sac.`
        : '';
    const addressClue = address
        ? `\nPROPERTY ADDRESS: "${address}"${typeLabel}\nThe front entrance usually faces "${streetName || address}". However, for townhouses or multi-unit complexes, the pedestrian entry may face an internal courtyard or shared walkway instead.${sideFact}${culDeSacSuffixHint2}\n\u2022 DRIVEWAY CONNECTION: While a driveway usually connects to the front street, townhomes often have rear-loading or side-loading garages. Locate the PEDESTRIAN entry first.` : '';
    const descHint = buildDescriptionHint(description);
    const bearingHint = streetBearing != null ? (() => {
        const p1 = (streetBearing + 90) % 360, p2 = (streetBearing - 90 + 360) % 360;
        const p3 = (streetBearing + 180) % 360;
        const dir8 = (az) => ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
        return `\nGPS STREET BEARING ADVISORY \u2014 READ BEFORE USING:\n`
            + `\u26d4 CUL-DE-SAC / DEAD-END COURT OVERRIDE (MANDATORY \u2014 check FIRST):\n`
            + `   Before using this bearing, look at Image A: is this a cul-de-sac (circular dead-end) or dead-end court?\n`
            + `   YES \u2192 DISCARD this GPS bearing completely. Do NOT use it AT ALL. Derive the front direction\n`
            + `          purely from aerial: trace the driveway apron and pedestrian walkway to the specific road segment connection.\n`
            + `   NO  \u2192 Street runs at ~${Math.round(streetBearing)}\u00b0. Front most likely faces `
            + `${dir8(p1)} (~${Math.round(p1)}\u00b0) or ${dir8(p2)} (~${Math.round(p2)}\u00b0).\n`
            + `\u26d4 FORBIDDEN (straight standard lot only): ~${Math.round(streetBearing)}\u00b0 and ~${Math.round(p3)}\u00b0 are road-parallel.`;
    })() : '';

    const photoLabels = photoMeta.map((p, i) => {
        const isAerial = /aerial|drone|bird|overhead|top.?down|from above/i.test(p.analysisSnippet || '');
        const imgLetter = String.fromCharCode(66 + i); // B, C, D...
        const typeLabel = isAerial
            ? 'AERIAL/DRONE listing photo \u2014 shows building footprint from above (different angle than Image A)'
            : 'exterior/ground-level listing photo';
        return `  Image ${imgLetter} = Listing photo #${p.index + 1} (${typeLabel}): "${(p.analysisSnippet || '').trim()}"`;
    }).join('\n');

    return `
You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and ${photoCount} listing photo(s) from the property gallery.

IMAGE GUIDE:
  Image A = cached satellite aerial \u2014 North is UP. Use as authoritative layout reference.
${photoLabels ? photoLabels : ''}

\u26a0 LISTING PHOTOS KEY RULES:
  \u2022 AERIAL/DRONE listing photos: compare with Image A to confirm which face of the building has the main entry/driveway toward the address street. They may show the property at a different zoom/angle than the cached satellite.
  \u2022 GROUND-LEVEL exterior photos: look for front door, porch, entryway, or driveway apron. Set street_view_shows_front=true if the main entry is clearly visible; false if only garage/side/back; null if inconclusive.
  \u2022 Do NOT set street_view_shows_front=true unless you can clearly see the front door or main pedestrian entry.
${addressClue}${descHint}${bearingHint}

GUIDING PRINCIPLES:
1. NORTH IS UP: The top of Image A is strictly 0\u00b0 North. Identify the building footprint, street, and driveway.
2. SCREEN-TO-COMPASS MAPPING:
   \u2022 Toward TOP of screen    = NORTH (0\u00b0)
   \u2022 Toward BOTTOM of screen = SOUTH (180\u00b0)
   \u2022 Toward RIGHT of screen  = EAST (90\u00b0)
   \u2022 Toward LEFT of screen   = WEST (270\u00b0)
   \u2022 Toward TOP-RIGHT        = NORTHEAST (45\u00b0)
   \u2022 Toward BOTTOM-RIGHT     = SOUTHEAST (135\u00b0)
   \u2022 Toward BOTTOM-LEFT      = SOUTHWEST (225\u00b0)
   \u2022 Toward TOP-LEFT         = NORTHWEST (315\u00b0)
3. WALKWAY RULE (MANDATORY): Trace the pedestrian walkway from the public sidewalk to the main door. That wall is the architectural FRONT.
4. UNIT-SPECIFIC ACCURACY: In rows of townhouses or condos, identify the specific unit (marked by the red pin). Do not simply state the building's overall orientation. Verify that the door you see in the listing photos actually belongs to the unit at the pin location by matching features (walkway shapes, window patterns, balconies) between the photos and Image A.
5. FRONT DOOR VS BUILDING FACE: The front orientation is the direction the FRONT DOOR itself faces. If the door is in an alcove, side-entry, or recessed area, the azimuth must reflect the direction you face when walking out the door, NOT necessarily the building's main street-facing facade.
6. LISTING PHOTOS supplement the aerial by confirming which face of the building matches the front entry.
7. THE ANCHOR STRATEGY (Anti-Hallucination): Before determining orientation, identify one "Anchor Feature" visible in both the Aerial (Image A) and the Listing Photos \u2014 e.g., a specific tree, neighbor's roof color, chimney, or driveway curve. Describe its relative position in both images to ensure you haven't lost track of "North" when switching perspectives.
8. THE 3X3 GRID RULE: Mentally divide the lot into a 3x3 grid. Label the center square "House". Identify which squares contain the "Primary Road" (e.g., "Top-Center" and "Top-Right"). The orientation vector must originate in the "House" square and terminate in a "Road" square.
9. NEW CONSTRUCTION / STALE SATELLITE: Listing photos are the GROUND TRUTH for current state. 
   \u2022 If listing photos show a finished exterior (windows, roof, siding complete), set is_under_construction=false (even if aerial shows dirt).
   \u2022 If listing photos show an unfinished state (exposed framing, scaffolding, foundation, or active construction site), set is_under_construction=true.
   \u2022 If NO listing photos are available, use Image A (aerial) to decide.
   \u2022 Classification: set final_orientation="UNDER_CONSTRUCTION" and azimuth_degrees=null if the building footprint is not yet defined. If framing is complete but unfinished, you can still provide an orientation.
10. TOWARD RULE: The front faces TOWARD the road \u2014 in the direction FROM house center TO the road.
   \u2022 Road BELOW house (bottom) \u2192 faces SOUTH (180\u00b0).
   \u2022 Road ABOVE house (top)    \u2192 faces NORTH (0\u00b0).
   \u2022 Road to the RIGHT of house \u2192 faces EAST (90\u00b0).
   \u2022 Road to the LEFT of house  \u2192 faces WEST (270\u00b0).
   IMPORTANT: The orientation is ALWAYS the vector from house center TOWARD the specific road. If the house is Southeast of a Northwest-running road, it faces Northwest. Never assume diagonal roads forbid diagonal orientations. Use Image A cardinal axes strictly.
11. SLANTED ROAD PRECISION: If the road is slanted (not perfectly N/E/S/W), the front azimuth MUST also be slanted. Do NOT round to the nearest cardinal direction (N/E/S/W) if it means sacrificing more than 10\u00b0 of accuracy. If a road is at 165\u00b0 (SSE), the perpendicular is 255\u00b0 (WSW), NOT 270\u00b0 (West). Use the lot lines in the Road Map (if provided) as a high-precision reference for perpendicularity.
12. CURVED ROAD / CUL-DE-SAC TIE-BREAKER (CRITICAL): If a property sits on a curve or a cul-de-sac where the road is visible on multiple sides, the orientation is strictly defined by the physical connection. Trace the Driveway Apron and Pedestrian Walkway. Use the vector to the "center of the loop" ONLY as a secondary confirmation. If the driveway connection and the loop center vector disagree, the physical driveway connection is the AUTHORITATIVE signal.
13. SIDE-BY-SIDE CONSISTENCY: If listing photos show the garage door, driveway, and front door are all on the same face of the house, their orientation in Image A MUST be identical. If you see the driveway going North in the aerial, but you conclude the front door faces East, you have likely made a 90\u00b0 spatial error. Re-evaluate using the driveway as your cardinal anchor.
14. FENCE / SIDE-WALL REJECTION (STRICT): If an image (especially Street View Image C) only shows a fence, a side wall, a chimney, or a side-yard lawn without an entrance, set street_view_shows_front=false. Do NOT set it to true unless the main architectural entryway or garage doors are clearly visible.
15. CUL-DE-SAC SIDE-STREET TRAP: On cul-DE-sacs, the road often wraps around the property side. If Street View (Image C) shows a side fence/lawn while Listing Photos (Image B) show the front door/garage, you are likely looking at a side-street. The front orientation is defined by the listing photos' features, NOT by whatever road segment the Street View camera happens to be on. Follow the architectural features back to Image A to decide the cardinal direction.
16. FRONT DOOR MANDATORY: The ultimate goal is to identify the direction the FRONT DOOR faces. If you cannot clearly see the front door (or the main architectural entryway) in either the Listing Photos or Street View, you MUST set final_orientation='UNCLEAR' and confidence='low', regardless of how clear the driveway is. A driveway alone is not enough to guarantee the front door direction (as it could be a side or rear entry).

LAYOUT CLASSIFICATION (do FIRST):
CORNER LOT: Two named public roads meeting at an intersection adjacent to the lot \u2192 corner_lot.
CUL-DE-SAC: Circular dead-end street; driveway connects to the circle \u2192 cul_de_sac.
Set standard_street_layout=FALSE for: corner lot, flag lot, curved/loop street, cul-de-sac.
CUL-DE-SAC VERIFICATION: Before classifying as cul_de_sac, you MUST verify that the road in front of the driveway is CURVED. If it is straight, you MUST classify as standard_street_layout (Option B).
CORNER LOT FACING: If a property is at an intersection, it has two potential frontages. Identify the main pedestrian entrance/walkway. The orientation is the vector from that entrance TOWARD the street it faces. Do NOT average the two street bearings or use the bearing of the secondary street.

CONFIDENCE GATE (MANDATORY):
1. If you cannot clearly see the FRONT DOOR or main architectural entryway in either the Listing Photos or Street View \u2192 confidence='low', final_orientation='UNCLEAR'.
2. If you cannot clearly identify the driveway apron OR pedestrian walkway from the aerial (Image A) \u2192 confidence='low', final_orientation='UNCLEAR'.
In both cases, set azimuth_degrees=null.

TASK:
Step 1 \u2014 Layout: classify lot type.
Step 2 \u2014 Aerial analysis: identify building footprint, driveway, and candidate front wall from Image A.
Step 3 \u2014 Listing photo confirmation: for each listing photo (Images B, C, D\u2026), decide if it shows the building exterior or front door \u2014 NOT an interior room (kitchen, bedroom, bathroom, living area, etc.). Set street_view_shows_front based on the best exterior photo found. Set listing_photos_showing_front to an array of image labels (e.g. ["B","C"]) for every photo that showed the exterior or front door; use an empty array if none did.
Step 4 \u2014 Front wall compass direction (0\u00b0=N, 90\u00b0=E, 180\u00b0=S, 270\u00b0=W). 
    - VERIFY: Does the front door visible in ground-level imagery face the SAME direction as the driveway/garage seen in Image A? 
    - If they disagree (e.g., door faces North, driveway exits East), or if the door/entryway is not clearly visible in ground-level photos, you MUST set final_orientation='UNCLEAR'.
    - PERPENDICULAR RULE: azimuth must be ~perpendicular (\u00b145\u00b0) to the road bearing. If parallel \u2192 correct or set UNCLEAR.
Step 4b \u2014 CLOCK-FACE CHECK (Geometric Verification):
    Map the road and the front door to a clock face where 12:00 is North.
    - Which "hour" does the road lie on relative to the house center?
    - Which "hour" does the front door point toward?
    - VERIFICATION: These must be within 3 "hours" (90 degrees) of each other.
Step 5 \u2014 Assess: privacy sightlines, lot coverage (hardscape/pervious %), pool/garage directions, buyer pro/con.
`.trim();
}

/** Legacy support: Unified getOrientationPrompt for batch compatibility. */
export function getOrientationPrompt(params) {
    const { usesDualImage, svHeading, address, description, streetBearing, streetSide, homeType } = params;
    if (usesDualImage) return buildOrientationPromptDual(svHeading, address, description, streetBearing, homeType);
    return buildOrientationPromptAerialOnly(address, description, streetBearing, streetSide, homeType);
}

export function getDualPromptFinalInstructions(streetViewHeading) {
    return `
FINAL REMINDER:
1. WALKWAY RULE: The side where the path (or stairs/steps) from the street leads to a door is the FRONT. Priority: Pedestrian Entry > Garage Direction.
2. FACING DIRECTION: The azimuth is the direction from the house TOWARD the street (never away from it). All 8 directions are valid \u2014 do NOT collapse diagonals to cardinals. Examples: street to south\u2192S(180\u00b0), to SE\u2192SE(135\u00b0), to NW\u2192NW(315\u00b0). Do NOT invert (street south = face south, not north).
3. AMBIGUITY: If Image B shows the front door, use the heading ${streetViewHeading != null ? `${streetViewHeading}\u00b0` : 'provided'} to derive the exact azimuth. If Image B shows a garage, carport, or vehicle bay \u2014 even facing the main road \u2014 street_view_shows_front must be FALSE. A carport or garage door is NEVER a front door.
4. CONFIDENCE: Be low/medium if the image is soft or cues are conflicting.
`.trim();
}

export const satellitarySchema = {
    type: "OBJECT",
    properties: {
        image_quality: { type: "STRING", enum: ["clear", "acceptable", "blurry"] },
        final_orientation: { type: "STRING" },
        azimuth_degrees: { type: "NUMBER", nullable: true },
        property_layout_type: { type: "STRING", enum: ["corner_lot", "cul_de_sac", "flag_lot", "irregular_lot", "standard", "other"] },
        confidence: { type: "STRING", enum: ["high", "medium", "low"] },
        is_under_construction: { type: "BOOLEAN" },
        standard_street_layout: { type: "BOOLEAN", nullable: true },
        explanation: { type: "STRING" },
        front_door_clearly_visible: { type: "BOOLEAN", nullable: true },
        front_street_name: { type: "STRING", nullable: true },
        street_bearing_visual_degrees: { type: "NUMBER", nullable: true },
        feng_shui_vastu: { type: "STRING", nullable: true },
        privacy_insight: { type: "STRING" },
        lot_coverage_hardscape: { type: "NUMBER", nullable: true },
        lot_coverage_pervious: { type: "NUMBER", nullable: true },
        buyer_pro: { type: "STRING" },
        buyer_con: { type: "STRING" },
        orientation_highlights: { type: "STRING" },
        listing_photos_showing_front: { type: "ARRAY", items: { type: "STRING" }, nullable: true },
        street_view_shows_front: { type: "BOOLEAN", nullable: true },
        front_image_letter: { type: "STRING", enum: ["B", "C", "D", "E"], nullable: true },
        pool_visible: { type: "BOOLEAN", nullable: true },
        pool_direction: { type: "STRING", enum: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"], nullable: true },
        garage_direction: { type: "STRING", enum: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"], nullable: true },
        open_sky_direction: { type: "STRING", enum: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"], nullable: true }
    },
    required: ["property_layout_type", "image_quality", "final_orientation", "confidence", "explanation", "privacy_insight", "buyer_pro", "buyer_con", "orientation_highlights"]
};
