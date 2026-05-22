/**
 * Buyer Story Matching Prompts
 *
 * Contains the Gemini prompt templates used by the Zyphe AI buyer story
 * search feature. Extracted here for easy iteration and testing.
 */

import type { TaxonomyEntry } from '../../types/contextGraph';

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
    /** Full taxonomy entries — {name, tags, value} triplets for buyer matching */
    factors: TaxonomyEntry[];
    /** Factor IDs that this property actually has computed in its context graph */
    computedFactorIds?: number[];
}

export interface ExtractedCriteria {
    mustHaves: string[];
    niceToHaves: string[];
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

/**
 * Prompt to extract structured filter criteria from a free-text buyer story.
 * Focused on extracting practical filter values that map directly to UI controls.
 * Must-haves and nice-to-haves are still extracted for the matching prompt.
 */
export const buildExtractionPrompt = (buyerStory: string, persona?: PersonaContext): string => {
    let personaBlock = '';
    if (persona && (persona.personaProfile || persona.whoYouAre || persona.selectedAnchors?.length)) {
        const parts: string[] = ['## BUYER PERSONA (use to infer filter values the buyer may not have explicitly stated)'];
        if (persona.personaProfile) parts.push(`Profile type: ${persona.personaProfile}`);
        if (persona.whoYouAre) parts.push(`Life stage & background: ${persona.whoYouAre}`);
        if (persona.dailyRituals) parts.push(`Daily lifestyle: ${persona.dailyRituals}`);
        if (persona.whatElseMatters) parts.push(`Other priorities: ${persona.whatElseMatters}`);
        if (persona.selectedAnchors?.length) parts.push(`Priority anchors: ${persona.selectedAnchors.join(', ')}`);
        if (persona.homeType) parts.push(`Preferred home type: ${persona.homeType}`);
        personaBlock = parts.join('\n') + '\n\n';
    }

    return `Extract buyer requirements from this story as FILTER VALUES + a requirements list.

"${buyerStory}"

${personaBlock}## WHAT TO EXTRACT

### FILTERS (map directly to search filters)
- price_min / price_max: convert to dollars ($1M = 1000000, $1.5M = 1500000). REQUIRED — if only one number, set both to it. If "around X" or "budget X", set both to that value.
- beds: minimum bedrooms required (0 if not mentioned)
- baths: minimum bathrooms required (0 if not mentioned)
- home_type: SINGLE_FAMILY | TOWNHOUSE | CONDO | "" (empty if not specified or if multiple types acceptable)
- stories: exact number of stories required (0 if not mentioned). Only set if the buyer explicitly mentions single-story, two-story, etc.
- min_school_rating: minimum school rating 1-10 (0 if not mentioned). Set if buyer mentions school quality, e.g. "top-rated schools" → 8, "8+ rated schools" → 8, "good schools" → 7. Leave 0 if schools not mentioned.

### REQUIREMENTS (used for detailed AI matching later)
- must_haves: things the buyer explicitly NEEDS, REQUIRES, or states as important. Each as a separate text item.
- nice_to_haves: things the buyer PREFERS or would LIKE but aren't deal-breakers. Each as a separate text item.
  * If persona context is available, infer 2-3 additional nice-to-haves from lifestyle. Prefix each with "[Inferred]".
- search_summary: 2-3 sentence readable summary starting with "Searching for..." that covers price, type, key requirements.

## RULES
- Price is REQUIRED. If truly no price mentioned, set both to 0.
- For filters (stories, min_school_rating): only set non-zero if you can do so ACCURATELY from the text. When in doubt, leave as 0.
- Capture EVERY requirement as a separate must_have or nice_to_have item.`;
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

    if (s.factors.length > 0) {
        const factorLines = s.factors.map(f => {
            const tagStr = f.tags.join(', ');
            const line = tagStr ? `${f.name}: ${tagStr}` : f.name;
            return f.value ? `  - ${line} — ${f.value}` : `  - ${line}`;
        });
        lines.push(`Context Data:\n${factorLines.join('\n')}`);
    }

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
    if (persona && (persona.personaProfile || persona.selectedAnchors?.length || persona.homeType)) {
        // NOTE: The chapter text (whoYouAre, dailyRituals, dreamSpace, whatElseMatters)
        // is already included verbatim in the BUYER STORY section above.
        // Only include metadata that adds NEW signal beyond the story text.
        const parts: string[] = ['## BUYER PERSONA (use alongside the buyer story above to assess LIFESTYLE FIT)'];
        if (persona.personaProfile) parts.push(`Profile type: ${persona.personaProfile}`);
        if (persona.selectedAnchors?.length) parts.push(`Priority anchors: ${persona.selectedAnchors.join(', ')}`);
        if (persona.homeType) parts.push(`Preferred home type: ${persona.homeType}`);
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
- For each property, reason step by step:
  1. Go through each MUST-HAVE and check: does the context data, city context, or your area knowledge confirm, contradict, or have no info?
  2. Go through each NICE-TO-HAVE the same way
  3. Use the BUYER STORY and BUYER PERSONA sections to match the buyer's lifestyle against ALL relevant context data factors. For example: workplace → Commute/Job Hubs, pets → Pet Friendly/Fenced Yard, age → Senior Fit/Family Fit, hobbies → Walkability/Dining Scene, etc.
  4. Compute the score based on match/miss ratio, weighting must-haves 3× more than nice-to-haves, and earlier items more than later ones
- score: 0-100 match quality
- PRIORITIZE the context data provided for each property for property-specific facts (layout, finishes, lot size, noise, etc.)
- Use the CITY & AREA CONTEXT section for city-wide facts like commute times, school quality, and walkability — these apply equally to all properties.
- You MAY use your general knowledge to supplement further if needed.
- However, do NOT fabricate property-specific details that are not in the context data. If the context data says nothing about a property's kitchen, do not assume it has a modern kitchen.
- pros: array of 3–5 concrete strings, each one specific why-it-fits point for THIS buyer. No ✅ prefix needed — just the text. Example: ["Single-story layout matches age-in-place needs", "Proximity to medical facilities (1.4mi)", "Low-maintenance lot suits retired lifestyle"]
- cons: array of 2–3 concrete strings, each one specific where-it-falls-short point. Example: ["Standard kitchen lacks modern finishes buyer wants", "No covered patio", "Moderate street noise may not suit quiet preference"]
- persona_note: ONE sentence about lifestyle/persona fit drawn from the buyer story. Example: "As retired empty nesters who walk daily, the nearby trails align perfectly with their routine."
- match_writeup: a SHORT paragraph (2-3 sentences) synthesizing the overall fit — tone, feel, and decision-framing. Do NOT repeat the pros/cons verbatim. This is the "editorial voice" summary. Be specific and conversational.
- score: 0-100 match quality
- Neutral tone. Return ALL ${summaries.length} properties.`;
};
