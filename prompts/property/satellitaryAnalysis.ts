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
 * When the street-view camera heading is known we inject it directly into the
 * prompt so Gemini does NOT need to guess which compass direction it was facing.
 */
export function buildOrientationPromptDual(streetViewHeading?: number | null, address?: string, description?: string | null): string {
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

    const descriptionOverride = buildDescriptionHint(description);

    const headingAuthority = streetViewHeading != null
        ? `\n\nCAMERA HEADING: ${streetViewHeading}° (0°=North, 90°=East, 180°=South, 270°=West)\n` +
        `The Street View camera was pointing in direction ${streetViewHeading}° when it photographed this property.\n` +
        `\n` +
        `⚠️  CRITICAL — THE HEADING IS AMBIGUOUS ON ITS OWN:\n` +
        `The heading tells you which direction the camera was pointing, but NOT whether it was\n` +
        `photographing the FRONT or the BACK/SIDE of the house. Both are equally possible:\n` +
        `\n` +
        `  SCENARIO A — Camera photographed the FRONT (common for through-streets):\n` +
        `    → Camera is parked on the road the front faces, looking at the front door.\n` +
        `    → Front wall faces back toward the camera = faces ~${(streetViewHeading + 180) % 360}°.\n` +
        `\n` +
        `  SCENARIO B — Camera photographed the BACK or SIDE (common for courts, cul-de-sacs,\n` +
        `    corner lots, or multi-unit complexes where the public road borders the rear):\n` +
        `    → Camera drove up to or past the property from the side/back approach.\n` +
        `    → The FRONT is on a completely different side — determine it from the aerial.\n` +
        `\n` +
        `STEP 0.5 — RESOLVE USING IMAGE A (do this before deciding how to use the heading):\n` +
        `Look at the aerial and identify which side of the building is the FRONT by finding:\n` +
        `  • Driveway and/or garage door (strongest signal — which direction does it open toward?)\n` +
        `  • Front walkway or landscaped front yard\n` +
        `  • Which road the main entrance faces\n` +
        `  • For courts/cul-de-sacs: the front faces INTO the court (toward the court center/opening)\n` +
        `  • For complexes: the fronts face an internal private lane, NOT the bordering public road\n` +
        `\n` +
        `Once you know from the aerial which side is the front and what direction it faces,\n` +
        `use the heading only to confirm — not to override — your aerial-based conclusion.\n` +
        `If the heading is inconsistent with the aerial evidence, trust the aerial.`
        : '';


    return `
You are a spatial analysis expert. I am providing two images of the same property.

IMAGE A (Aerial Satellite): A top-down satellite view of the property parcel (zoom 20, scale 2 — 1280×1280 px).
IMPORTANT: In this image, North is ALWAYS at the top of the frame, East is to the right,
South is at the bottom, and West is to the left.

IMAGE B (Street View): A street-level photograph taken from the street directly in front of the property.${headingAuthority}${addressClue}${descriptionOverride}

STEP 0 — IMAGE QUALITY CHECK (do this first, before any analysis):
Assess the sharpness and resolution of Image A (Aerial Satellite).
- If the image is blurry, heavily pixelated, or too low-resolution to distinguish individual
  building edges or roof lines, set image_quality to "blurry", set final_orientation to
  "UNCLEAR_IMAGE", set confidence to "low", and stop — do not attempt any orientation analysis.
- If the image is usable but somewhat soft or compressed, set image_quality to "acceptable" and continue.
- If the image is sharp and detailed, set image_quality to "clear" and continue.

TASK:
1. FIRST — use Image A (aerial) to identify the FRONT of the property:
   - Look for: driveway, garage door opening direction, front walkway, landscaped front yard.
   - Strongest signal: which direction does the driveway/garage open toward on the North-up aerial?
   - For courts/cul-de-sacs: the front faces INTO the court (toward the court center/opening).
   - For multi-unit complexes: fronts face an internal private lane, NOT the bordering public road.
   - Determine the compass direction that front wall points on the North-up aerial frame.

2. Use the camera heading (${streetViewHeading != null ? `${streetViewHeading}°` : 'not available'}) as a SUPPORTING clue only:
   - First decide which wall Image B is showing (front, back, or side) based on your aerial analysis.
   - If Image B shows the FRONT: the front orientation = the direction that wall faces back toward the camera
     (i.e., ~${streetViewHeading != null ? `${(streetViewHeading + 180) % 360}°` : 'N/A'} if scenario A applies).
   - If Image B shows the BACK or SIDE: ignore the heading formula; use aerial cues for orientation.
   - The heading is NOT a blindly-applied formula — confirm it makes sense against the aerial first.

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
  Step 1: Describe what you see in Image A. Identify which side of the building is the front
          (look for driveway, garage, front yard, access road relationship). State the compass direction it faces.
  Step 2: State the camera heading. Determine which face Image B is showing (front/back/side)
          based on your Step 1 aerial conclusion. Confirm or revise accordingly.
  Step 3: State your final compass direction and azimuth.
  Step 4: Give confidence level and brief rationale.

KEY HEURISTICS:
- Driveway + garage door direction on the aerial = the most reliable front indicator.
- Courts and cul-de-sacs: homes face INTO the court. The camera often drives up photographing the front.
  In this case the front faces the direction the camera was pointing (heading), NOT heading+180.
- Through-streets: front faces the road; camera is across from the front; front = ~heading+180.
- Multi-unit complexes: fronts face an internal lane, NOT the arterial road.
- When aerial and heading conflict, trust the aerial.
`.trim();
}

// ─── Aerial-Only Prompt (No Street View) ──────────────────────────────────────

/**
 * Prompt used when ONLY the aerial satellite image is available (no street view).
 * Gemini uses indirect cues — road adjacency, driveway, front yard, shadow angle,
 * and garage doors — to infer which face of the building is the "street-facing" front.
 */
export function buildOrientationPromptAerialOnly(address?: string, description?: string | null): string {
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

    const descriptionOverride = buildDescriptionHint(description);

    return `
You are a spatial analysis expert. I am providing one aerial satellite image of a property.

IMAGE A (Aerial Satellite): A top-down satellite view at high zoom (zoom level 20, scale 2 — 1280×1280 px).
IMPORTANT: North is ALWAYS at the top of the frame, East is to the right,
South is at the bottom, and West is to the left.
${addressClue}${descriptionOverride}
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

// ─── Legacy Aliases ───────────────────────────────────────────────────────────

/** Legacy alias — dual-image prompt with no heading/address context. */
export const ORIENTATION_PROMPT_DUAL = buildOrientationPromptDual();

/** Legacy alias — aerial-only prompt with no address context. */
export const ORIENTATION_PROMPT_AERIAL_ONLY = buildOrientationPromptAerialOnly();

/** Legacy alias kept for backward compatibility. */
export const ORIENTATION_PROMPT = ORIENTATION_PROMPT_DUAL;
