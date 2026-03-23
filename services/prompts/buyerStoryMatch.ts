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
}

export interface ExtractedCriteria {
    mustHaves: string[];
    niceToHaves: string[];
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
 */
export const buildExtractionPrompt = (buyerStory: string): string =>
    `Extract ALL buyer requirements from this story. Be thorough — capture everything mentioned.

"${buyerStory}"

## EXTRACTION RULES
- price_min / price_max: convert to dollars ($1M = 1000000, $1.5M = 1500000). If only one number, set both to it.
- beds / baths: extract as minimum requirements (0 if not mentioned)
- home_type: SINGLE_FAMILY | TOWNHOUSE | CONDO | "" (empty if not specified)
- must_haves: things the buyer explicitly NEEDS, REQUIRES, or states as important. Extract EVERY requirement as text.
- nice_to_haves: things the buyer PREFERS or would LIKE but aren't deal-breakers. Extract as text.
- relevant_factor_ids: from the FACTOR ID MAP below, return the IDs of ALL factors that are relevant to this buyer's requirements. Include factors for BOTH must_haves AND nice_to_haves.

## FACTOR ID MAP
Each property in our database is analyzed across these dimensions. Return the numeric IDs of factors the buyer cares about:
${buildFactorIdReference()}

## DIMENSIONS TO LOOK FOR
${FACTOR_NAME_LIST.join(', ')}

Also capture: work from home, remote work, bike commute, raised beds, fruit trees, garden, sustainability, daycare, EV charging, trails, hiking, and any other buyer-specific requirements not in the list above.

Capture EVERY requirement and preference as a separate item. Do not summarize or merge similar items.`;

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
    summaries: PropertySummary[]
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

    return `Score each property 0-100 against the buyer story. You MUST base your answers ONLY on the context data provided below. Do NOT guess or assume anything not explicitly stated in the data.

## BUYER STORY
${buyerStory}

## MUST-HAVES (weight heavily, earlier = more important)
${mustHavesList || 'None specified'}

## NICE-TO-HAVES (lower weight, earlier = more important)
${niceToHavesList || 'None specified'}

## PROPERTIES (${summaries.length})
${propertyBlocks}

## SCORING RULES
- score: 0-100 match quality based on the context data provided
- Must-haves weigh 3× more than nice-to-haves
- Earlier items in each list are more important than later ones
- reasons: cite SPECIFIC facts from the context data that match the buyer's criteria
- misses: ONLY list criteria that the context data EXPLICITLY CONTRADICTS. If the data is silent on a criterion (no mention either way), do NOT list it as a miss. Absence of data is NOT a miss.
- highlight: one factual sentence summarizing the match
- Neutral tone. Return ALL ${summaries.length} properties.`;
};
