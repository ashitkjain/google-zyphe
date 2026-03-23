/**
 * Buyer Story Matching Prompts
 *
 * Contains the Gemini prompt templates used by the Zyphe AI buyer story
 * search feature. Extracted here for easy iteration and testing.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PropertySummary {
    zpid: string;
    address: string;
    summary?: {
        propertyHighlight?: string;
        topStrengths?: string[];
        topWeaknesses?: string[];
    };
    keyMetrics?: {
        price?: number;
        beds?: number;
        baths?: number;
        sqft?: number;
    };
    factors: string[];
    /** Factor IDs that this property actually has computed in its context graph */
    computedFactorIds?: number[];
}

export interface ExtractedCriteria {
    mustHaves: string[];
    niceToHaves: string[];
}

/**
 * A dealbreaker extracted from the buyer story.
 *
 * type:
 *   - "location"    → area-level requirement (wine country, waterfront, rural).
 *                     These will NEVER appear in a context graph because they
 *                     describe the region, not the property.
 *   - "verifiable"  → maps to a specific context graph factor (e.g., schools,
 *                     noise, walkability). Can be checked if the factor exists.
 *   - "runtime"     → needs buyer-specific computation (commute to Apple Park,
 *                     distance to a specific school). Not pre-computed.
 */
export interface Dealbreaker {
    requirement: string;
    type: 'location' | 'verifiable' | 'runtime';
    /** If type=verifiable, the context graph factor ID this maps to */
    factorId?: number;
}

/**
 * Structured persona context from the "My Story" intake form.
 * Gives the AI deep understanding of WHO the buyer is — not just what they typed.
 */
export interface PersonaContext {
    personaProfile?: string;        // e.g. "First-Time", "Investor", "Past Client", "Relocation"
    whoYouAre?: string;             // Chapter 01: household, life stage, background
    dailyRituals?: string;          // Chapter 02: commute, routines, lifestyle
    dreamSpace?: string;            // Chapter 03: architectural / emotional anchors
    whatElseMatters?: string;       // Chapter 04: schools, commute, deal-breakers
    selectedAnchors?: string[];     // Priority tags selected by the user
    homeType?: string;              // e.g. "Single Family", "Condo", "Townhouse"
}

// ── Extraction Prompt ─────────────────────────────────────────────────────────

import { FACTOR_NAMES, FACTOR_NAME_LIST } from '../../constants/contextGraphFactors';

/**
 * Builds a compact factor ID reference for the extraction prompt.
 * Format: "17=Home Office, 42=Commute, 43=Walkability, ..."
 */
const buildFactorIdReference = (): string =>
    Object.entries(FACTOR_NAMES)
        .map(([id, name]) => `${id}=${name}`)
        .join(', ');

/**
 * Prompt to extract structured buyer criteria from a free-text story.
 * Uses context graph factor IDs+names so the model can output precise IDs
 * for JS-level filtering of guaranteed mismatches.
 *
 * When persona context is provided, Gemini is instructed to infer IMPLICIT
 * needs from the buyer's life stage / lifestyle — not just explicit text.
 */
export const buildExtractionPrompt = (buyerStory: string, persona?: PersonaContext): string => {
    let personaBlock = '';
    if (persona && (persona.personaProfile || persona.whoYouAre || persona.selectedAnchors?.length)) {
        const parts: string[] = ['## BUYER PERSONA (use this to INFER implicit needs beyond what the story explicitly states)'];
        if (persona.personaProfile) parts.push(`Profile type: ${persona.personaProfile}`);
        if (persona.whoYouAre) parts.push(`Life stage & background: ${persona.whoYouAre}`);
        if (persona.dailyRituals) parts.push(`Daily lifestyle: ${persona.dailyRituals}`);
        if (persona.dreamSpace) parts.push(`Architectural vision: ${persona.dreamSpace}`);
        if (persona.whatElseMatters) parts.push(`Other priorities: ${persona.whatElseMatters}`);
        if (persona.selectedAnchors?.length) parts.push(`Selected priority anchors: ${persona.selectedAnchors.join(', ')}`);
        if (persona.homeType) parts.push(`Preferred home type: ${persona.homeType}`);
        personaBlock = parts.join('\n') + '\n\n';
    }

    return `Extract ALL buyer requirements from this story. Be thorough — capture everything mentioned.

"${buyerStory}"

${personaBlock}## EXTRACTION RULES
- price_min / price_max: convert to dollars ($1M = 1000000, $1.5M = 1500000). If only one number, set both to it.
- beds / baths: extract as minimum requirements (0 if not mentioned)
- home_type: SINGLE_FAMILY | TOWNHOUSE | CONDO | "" (empty if not specified)
- must_haves: things the buyer explicitly NEEDS, REQUIRES, or states as important. Extract EVERY requirement as text.
- nice_to_haves: things the buyer PREFERS or would LIKE but aren't deal-breakers. Extract as text.
- dealbreakers: the 1-3 FUNDAMENTAL requirements that define the entire search. Each dealbreaker is an object with:
    - "requirement": short description (e.g. "Wine country location")
    - "type": one of:
      * "location" — area/region requirement (wine country, waterfront, rural, beachfront, mountain). These describe WHERE the property should be, not a feature of the property itself.
      * "verifiable" — maps to a property data point we already analyze (schools, noise, walkability, fire risk). Set factor_id to the matching FACTOR ID from the map below.
      * "runtime" — needs buyer-specific computation we haven't pre-computed (commute to a specific workplace, distance to a specific school, proximity to a specific location).
    - "factor_id": (only for type=verifiable) the numeric ID from the FACTOR ID MAP below. Set to 0 for location and runtime types.
  Do NOT include generic preferences (modern kitchen, backyard) — only requirements so fundamental that without them the property is a complete non-starter.
- relevant_factor_ids: from the FACTOR ID MAP below, return the IDs of ALL factors that are relevant to this buyer's requirements. Include factors for BOTH must_haves AND nice_to_haves.

## PERSONA-AWARE INFERENCE
If a BUYER PERSONA section is provided above, use it to INFER additional requirements the buyer may not have explicitly stated. For example:
- "Empty nesters in their 60s" → infer: single-story preference, age-in-place friendly, proximity to medical facilities, low maintenance
- "Family with young children" → infer: school quality, safe neighborhood, backyard, family-friendly area
- "Tech couple, one works from home" → infer: home office space, good internet infrastructure, commute time matters
- "Investor" → infer: ROI potential, rental yield, ADU potential, cap rate
- "Relocating from another city" → infer: walkability, community feel, transition-friendly neighborhood
Add these inferred needs to nice_to_haves (NOT must_haves) unless the buyer explicitly stated them.

## FACTOR ID MAP
Each property in our database is analyzed across these dimensions. Return the numeric IDs of factors the buyer cares about:
${buildFactorIdReference()}

## DIMENSIONS TO LOOK FOR
${FACTOR_NAME_LIST.join(', ')}

Also capture: work from home, remote work, bike commute, raised beds, fruit trees, garden, sustainability, daycare, EV charging, trails, hiking, and any other buyer-specific requirements not in the list above.

Capture EVERY requirement and preference as a separate item. Do not summarize or merge similar items.`;
};

// ── Property Formatting ───────────────────────────────────────────────────────

/**
 * Formats a property summary into a readable text block for the prompt.
 */
export const formatPropertyBlock = (s: PropertySummary): string => {
    const lines = [`### ${s.address} (zpid: ${s.zpid})`];

    if (s.keyMetrics) {
        const km = s.keyMetrics;
        lines.push(
            `Price: ${km.price ? '$' + Number(km.price).toLocaleString() : 'N/A'} | ` +
            `Beds: ${km.beds || 'N/A'} | Baths: ${km.baths || 'N/A'} | Sqft: ${km.sqft || 'N/A'}`
        );
    }

    if (s.summary?.propertyHighlight) lines.push(`Highlight: ${s.summary.propertyHighlight}`);
    if (s.summary?.topStrengths?.length) lines.push(`Strengths: ${s.summary.topStrengths.join('; ')}`);
    if (s.summary?.topWeaknesses?.length) lines.push(`Weaknesses: ${s.summary.topWeaknesses.join('; ')}`);
    if (s.factors.length > 0) lines.push(`Context Data:\n${s.factors.map(f => `  - ${f}`).join('\n')}`);

    return lines.join('\n');
};

// ── Matching Prompt ───────────────────────────────────────────────────────────

/**
 * Builds the full Gemini prompt to score properties against a buyer story.
 */
export const buildMatchingPrompt = (
    buyerStory: string,
    extracted: ExtractedCriteria,
    summaries: PropertySummary[],
    persona?: PersonaContext
): string => {
    const mustHavesList = extracted.mustHaves
        .map((m, i) => `${i + 1}. ${m}`)
        .join('\n');

    const niceToHavesList = extracted.niceToHaves
        .map((n, i) => `${i + 1}. ${n}`)
        .join('\n');

    const propertyBlocks = summaries
        .map(formatPropertyBlock)
        .join('\n\n---\n\n');

    let personaBlock = '';
    if (persona && (persona.personaProfile || persona.whoYouAre)) {
        const parts: string[] = ['## BUYER PERSONA'];
        if (persona.personaProfile) parts.push(`Type: ${persona.personaProfile}`);
        if (persona.whoYouAre) parts.push(`Background: ${persona.whoYouAre}`);
        if (persona.dailyRituals) parts.push(`Lifestyle: ${persona.dailyRituals}`);
        if (persona.selectedAnchors?.length) parts.push(`Priority anchors: ${persona.selectedAnchors.join(', ')}`);
        personaBlock = parts.join('\n') + '\n\n';
    }

    return `Score each property 0-100 against the buyer story.

## BUYER STORY
${buyerStory}

${personaBlock}## MUST-HAVES (weight heavily, earlier = more important)
${mustHavesList || 'None specified'}

## NICE-TO-HAVES (lower weight, earlier = more important)
${niceToHavesList || 'None specified'}

## PROPERTIES (${summaries.length})
${propertyBlocks}

## SCORING RULES
- score: 0-100 match quality
- PRIORITIZE the context data provided for each property for property-specific facts (layout, finishes, lot size, noise, etc.)
- You MAY use your general knowledge of the city, area, and neighborhood to supplement scoring — for example, school district quality, commute corridors, walkability, geographic region, local amenities, and neighborhood character. This is encouraged.
- However, do NOT fabricate property-specific details that are not in the context data. If the context data says nothing about a property's kitchen, do not assume it has a modern kitchen.
- Must-haves weigh 3× more than nice-to-haves
- Earlier items in each list are more important than later ones
- If a BUYER PERSONA section is provided, use it as scoring context: a property that fits the buyer's LIFE STAGE and LIFESTYLE should score higher even if not every feature was explicitly listed. For example, a single-story home scores higher for empty nesters even if they didn't explicitly mention it.
- reasons: cite SPECIFIC facts — from context data or your area knowledge — that match the buyer's criteria
- misses: list criteria that are CONTRADICTED by the data or your area knowledge. If neither the data nor your knowledge addresses a criterion, do NOT list it as a miss.
- highlight: one factual sentence summarizing the match
- Neutral tone. Return ALL ${summaries.length} properties.`;
};
