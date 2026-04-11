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
 * Consolidates spatial reasoning rules and task steps to avoid redundancy.
 */
export function buildOrientationPromptDual(streetViewHeading?: number | null, address?: string, description?: string | null): string {
    const headingContext = streetViewHeading != null
        ? `\n\nCAMERA HEADING: ${streetViewHeading}° (0°=North, 90°=East, 180°=South, 270°=West)
The camera was pointing in direction ${streetViewHeading}° when it captured Image B.
⚠️ HEADING AMBIGUITY: This is the looking direction. If the camera looks at the FRONT, the home faces back toward the camera at ${(streetViewHeading + 180) % 360}°. If it looks at the BACK, the home faces ${streetViewHeading}°. Resolve this using the aerial walkway.`
        : '';

    const addressClue = address ? `\n\nPROPERTY ADDRESS: "${address}"\nNote: The front door may face an internal lane or side street, not necessarily the address street.` : '';
    const descriptionOverride = buildDescriptionHint(description);

    return `
You are a spatial analysis expert. I am providing an Aerial Satellite image (Image A, North-up) and a Street View image (Image B) of a property.
${headingContext}${addressClue}${descriptionOverride}

GUIDING PRINCIPLES:
1. IMAGE A (AERIAL) IS THE ANCHOR: North is strictly at the top. Use this to identify the building footprint and architectural features.
2. THE WALKWAY RULE (MANDATORY): Trace the walkway from the public sidewalk. The edge it leads to is the architectural FRONT, even if a garage faces a different side or has a house number (e.g., 3016).
3. CORNER LOTS & COMPLEXES: Do not default to the garage. Garages often face secondary streets or rear alleys. The primary entrance is defined by the porch, large glazing, or walkway porch.

TASK SEQUENCE:
Step 0: Quality & Construction Check. 
   - If Image A is too blurry to see building edges, set image_quality="blurry", final_orientation="UNCLEAR_IMAGE", and stop.
   - If the site is a dirt lot, shows only a foundation, or is a framed structure without a finished roof/walls (Under Construction), set is_under_construction=true, final_orientation="UNDER_CONSTRUCTION", and stop.
Step 1: Aerial Analysis. Identify the FRONT wall using the Walkway Rule. Determine its compass orientation from the North-up frame.
Step 2: Street View Verification. Identify what Image B shows (Front Door, Garage, or Side). Check if this matches your Step 1 conclusion.
Step 3: Resolve Ambiguity. If the camera heading (${streetViewHeading != null ? `${streetViewHeading}°` : 'N/A'}) points at the wall you identified as the front, then street_view_shows_front is TRUE and the orientation is opposite to the heading.
Step 4: Finalize Result. Set final_orientation, azimuth_degrees, and property_layout_type.
⚠️ CUL-DE-SAC CUE: Check the AERIAL lot shape. If it is pie-shaped (narrow at street, wide at back) on a rounded dead-end, it is a cul_de_sac. Even if the Street View looks like a straight street (which might be a back/side road), the aerial lot shape is ground truth for layout.

ADDITIONAL ANALYSIS:
- Privacy: Assess neighboring sightlines into the backyard/pool (e.g., second-story windows).
- Coverage: Estimate % Lot Coverage (Hardscape vs. Pervious).
- Site Features (Vastu/Feng Shui): Identify location of Pool, Garage, and Open Yard relative to the house (N, NE, E, SE, S, SW, W, NW).
- Buyer Pro/Con: One punchy sentence for each based on the above.

EXPLANATION FORMAT:
Briefly state: (1) Aerial observations (Walkway/Entrance), (2) Street View verification vs. Heading, (3) Final Azimuth & Rationale.
`.trim();
}

// ─── Aerial-Only Prompt (No Street View) ──────────────────────────────────────

/**
 * Prompt used when ONLY the aerial satellite image is available.
 */
export function buildOrientationPromptAerialOnly(address?: string, description?: string | null): string {
    const addressClue = address ? `\nPROPERTY ADDRESS: "${address}"\nAddress street may border the side or rear. Look for internal lanes in complexes.` : '';
    const descriptionOverride = buildDescriptionHint(description);

    return `
You are a spatial analysis expert. I am providing one high-resolution Aerial Satellite image (North-up).
${addressClue}${descriptionOverride}

GUIDING PRINCIPLES:
1. NORTH IS UP: Use the strict top-of-frame as 0° North.
2. WALKWAY RULE: The architectural front is where the pedestrian path from the street leads.
3. CONTEXT CUES: For townhomes/complexes, fronts typically face internal courtyards or private drives, not busy arterial roads.

TASK:
1. Identify the architectural FRONT entrance using the Walkway Rule. If no path is visible, use the facade with the primary porch/landscaping.
2. Determine the compass direction the FRONT wall points toward.
3. Assess Privacy (neighbor sightlines), Lot Coverage (Hardscape %), and Site Features (Pool/Garage/Yard directions).
4. Provide a brief Feng Shui/Vastu tip if the orientation is auspicious (e.g., North/East).

EXPLANATION FORMAT:
State which side was chosen as the front (and why) and the resulting azimuth.
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
            description: 'ONE or TWO sentences on what this facing direction typically means for a home. MANDATORY: every sentence MUST use a hedging word — "often", "typically", "may", "tends to", "can", "in many cases".'
        },
        street_view_shows_front: {
            type: Type.BOOLEAN,
            description: 'REQUIRED when street view is available. Set to true if Image B is the FRONT (main entrance). Set to false if it is side/back. Base this on your aerial/walkway analysis.',
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

// ─── Legacy Aliases ───────────────────────────────────────────────────────────

export const ORIENTATION_PROMPT_DUAL = buildOrientationPromptDual();
export const ORIENTATION_PROMPT_AERIAL_ONLY = buildOrientationPromptAerialOnly();
export const ORIENTATION_PROMPT = ORIENTATION_PROMPT_DUAL;

// ─── Final Reinforcement (Appended in code) ──────────────────────────────────

export function getDualPromptFinalInstructions(streetViewHeading?: number | null): string {
    return `
FINAL REMINDER:
1. WALKWAY RULE: The side where the path from the street leads to a door is the FRONT.
2. DIRECTION: Output the direction the FRONT WALL points (away from the house).
3. AMBIGUITY: If Image B shows the front door, use the heading ${streetViewHeading != null ? `${streetViewHeading}°` : 'provided'} to derive the exact azimuth. If Image B shows a garage but the front door is elsewhere, street_view_shows_front must be FALSE.
4. CONFIDENCE: Be low/medium if the image is soft or cues are conflicting.
`.trim();
}
