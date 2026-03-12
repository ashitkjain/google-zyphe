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

// ─── Dual-Image Prompt (Aerial + Street View) ────────────────────────────────

/**
 * Builds the dual-image orientation prompt.
 * When the street-view camera heading is known we inject it directly into the
 * prompt so Gemini does NOT need to guess which compass direction it was facing.
 */
export function buildOrientationPromptDual(streetViewHeading?: number | null, address?: string): string {
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

// ─── Aerial-Only Prompt (No Street View) ──────────────────────────────────────

/**
 * Prompt used when ONLY the aerial satellite image is available (no street view).
 * Gemini uses indirect cues — road adjacency, driveway, front yard, shadow angle,
 * and garage doors — to infer which face of the building is the "street-facing" front.
 */
export function buildOrientationPromptAerialOnly(address?: string): string {
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
