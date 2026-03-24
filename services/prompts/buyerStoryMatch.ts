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
- dealbreakers: ONLY the 0-2 LOCATION-LEVEL requirements that define WHERE the property must be. Each dealbreaker is an object with:
    - "requirement": short description (e.g. "Wine country location")
    - "type": one of:
      * "location" — area/region requirement (wine country, waterfront, rural, beachfront, mountain, lake, ski-in/ski-out). These describe WHERE the property should be, not a feature of the property itself. ONLY this type should be a dealbreaker.
      * "verifiable" — maps to a property data point we already analyze (schools, noise, walkability, fire risk). Do NOT put these here — put them in must_haves instead.
      * "runtime" — needs buyer-specific computation (commute to a specific workplace, distance to a specific school). Do NOT put these here — put them in must_haves instead.
    - "factor_id": set to 0 (only location type goes here).
  IMPORTANT: Only use dealbreakers for geographic/area mismatches where the CITY or REGION itself cannot satisfy the need. Things like commute time, school quality, fire risk, walkability — these VARY by property and may not be computed yet. Put those in must_haves, not dealbreakers. If we don't have data to say either way, we should NOT filter out the property.
- relevant_factor_ids: from the FACTOR ID MAP below, return the IDs of ALL factors that are relevant to this buyer's requirements. Include factors for BOTH must_haves AND nice_to_haves.
- search_summary: a SHORT readable prose (2-3 sentences max) starting with "Searching for..." that summarizes the buyer's key requirements in plain English. Weave together the price, property type, must-haves, and top nice-to-haves naturally. Example: "Searching for a single-story home in the $1.2M–$1.65M range with 2+ beds, a modern kitchen, and a quiet, walkable neighborhood. Proximity to medical facilities and low-maintenance landscaping are also important."

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

// ── City Context Resolution Prompt ────────────────────────────────────────────

/**
 * Builds a prompt to resolve city/neighborhood-level questions ONCE
 * instead of per-property. Uses Google Search grounding to look up
 * real-world data like commute times, school districts, etc.
 *
 * Examples of questions this resolves:
 * - "Commute from Pleasanton to Apple Park" → "~35 min via I-680/I-880"
 * - "Pleasanton school district quality"    → "Top-rated Pleasanton USD"
 * - "Is Pleasanton walkable?"               → "Moderate, suburban layout"
 */
export const buildCityContextPrompt = (
    city: string,
    mustHaves: string[],
    niceToHaves: string[],
    persona?: PersonaContext
): string => {
    // Combine all requirements to identify city/neighborhood-level questions
    const allReqs = [...mustHaves, ...niceToHaves];
    const personaHints: string[] = [];
    if (persona?.dailyRituals) personaHints.push(persona.dailyRituals);
    if (persona?.whatElseMatters) personaHints.push(persona.whatElseMatters);

    return `You are researching the city "${city}" to help a home buyer evaluate properties there. Answer the following questions about the city/area that apply to ALL properties in ${city}, not individual homes.

## BUYER REQUIREMENTS
${allReqs.map((r, i) => `${i + 1}. ${r}`).join('\n')}
${personaHints.length > 0 ? `\nBuyer context: ${personaHints.join('. ')}` : ''}

## TASK
For each buyer requirement above, determine if it can be answered at the CITY or NEIGHBORHOOD level (shared by all properties). If so, provide a factual answer. Skip requirements that are property-specific (like "big backyard" or "modern kitchen").

Focus on:
- **Commute**: If the buyer mentions a workplace, employer, or commute destination, look up the typical drive time from ${city} to that destination. Include both rush hour and off-peak estimates.
- **Schools**: Overall school district rating for ${city}, notable schools, ranking.
- **Safety**: Crime rates, neighborhood safety reputation.
- **Walkability**: General walkability of ${city}, transit access, bike-friendliness.
- **Lifestyle**: Dining, parks, trails, cultural amenities available in ${city}.
- **Demographics**: Family-friendliness, age demographics, community character.

For each answer, provide:
- "question": the requirement being addressed
- "answer": factual answer with specifics (distances, times, ratings, names)
- "source": "search" if from Google Search, "knowledge" if from your training data
- "confidence": "high", "medium", or "low"

Only include items you can answer with reasonable confidence. Skip items that vary too much by specific street or property.`;
};

// ── Matching Prompt ───────────────────────────────────────────────────────────

/**
 * Builds the full Gemini prompt to score properties against a buyer story.
 */
export const buildMatchingPrompt = (
    buyerStory: string,
    extracted: ExtractedCriteria,
    summaries: PropertySummary[],
    persona?: PersonaContext,
    cityContext?: string
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
        const parts: string[] = ['## WHO WE ARE (use to assess LIFESTYLE FIT — does this home match who these buyers are?)'];
        if (persona.personaProfile) parts.push(`Profile: ${persona.personaProfile}`);
        if (persona.whoYouAre) parts.push(`Background: ${persona.whoYouAre}`);
        if (persona.dailyRituals) parts.push(`Daily life: ${persona.dailyRituals}`);
        if (persona.dreamSpace) parts.push(`Dream home vision: ${persona.dreamSpace}`);
        if (persona.whatElseMatters) parts.push(`Other priorities: ${persona.whatElseMatters}`);
        if (persona.selectedAnchors?.length) parts.push(`Priority anchors: ${persona.selectedAnchors.join(', ')}`);
        if (persona.homeType) parts.push(`Preferred home type: ${persona.homeType}`);
        personaBlock = parts.join('\n') + '\n\n';
    }

    const cityContextBlock = cityContext
        ? `## CITY & AREA CONTEXT (applies to ALL properties — pre-researched)\n${cityContext}\n\n`
        : '';

    return `Score each property 0-100 against the buyer story.

## BUYER STORY
${buyerStory}

${personaBlock}${cityContextBlock}## MUST-HAVES (weight heavily, earlier = more important)
${mustHavesList || 'None specified'}

## NICE-TO-HAVES (lower weight, earlier = more important)
${niceToHavesList || 'None specified'}

## PROPERTIES (${summaries.length})
${propertyBlocks}

## SCORING RULES
- For each property, reason step by step:
  1. Go through each MUST-HAVE and check: does the context data, city context, or your area knowledge confirm, contradict, or have no info?
  2. Go through each NICE-TO-HAVE the same way
  3. If WHO WE ARE section is provided, match the persona against ALL relevant context data factors, including lifestyle. For example: workplace → Commute/Job Hubs, pets → Pet Friendly/Fenced Yard, age → Senior Fit/Family Fit, hobbies → Walkability/Dining Scene, etc.
  4. Compute the score based on match/miss ratio, weighting must-haves 3× more than nice-to-haves, and earlier items more than later ones
- score: 0-100 match quality
- PRIORITIZE the context data provided for each property for property-specific facts (layout, finishes, lot size, noise, etc.)
- Use the CITY & AREA CONTEXT section for city-wide facts like commute times, school quality, and walkability — these apply equally to all properties.
- You MAY use your general knowledge to supplement further if needed.
- However, do NOT fabricate property-specific details that are not in the context data. If the context data says nothing about a property's kitchen, do not assume it has a modern kitchen.
- reasons: cite SPECIFIC facts — from context data, city context, or your area knowledge — that match the buyer's criteria
- misses: list criteria that are CONTRADICTED by the data, city context, or your area knowledge. If no source addresses a criterion, do NOT list it as a miss and do NOT reduce the score — absence of data is not evidence of a problem.
- CRITICAL: If a criterion has no data available (not computed, not in context graph, not in city context, not in your knowledge), treat it as NEUTRAL — do not penalize or reward.
- match_summary: 2-3 sentence prose that naturally weaves together what this property offers and where it falls short for THIS buyer. Write in third person ("This home..."). Be specific and conversational, not a bulleted list in sentence form.
- highlight: one factual sentence summarizing the match
- Neutral tone. Return ALL ${summaries.length} properties.`;
};
