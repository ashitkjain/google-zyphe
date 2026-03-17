import { Type } from "@google/genai";

/**
 * Lightweight Neighborhood Matcher Prompt
 *
 * Ultra-cheap (~100 tokens in, ~10 tokens out) prompt that asks Gemini
 * to pick which neighborhood a property belongs to from a pre-mined list.
 * 
 * This replaces the expensive full neighborhood identity call when
 * city-level data already exists in the cache.
 */

export const getNeighborhoodMatcherPrompt = (
    address: string,
    city: string,
    state: string,
    neighborhoodNames: string[],
    description?: string
) => {
    const descBlock = description
        ? `\nLISTING DESCRIPTION (check for neighborhood name clues):\n"${description.slice(0, 800)}"\n`
        : '';

    return `
Identify which neighborhood this property belongs to.

ADDRESS: ${address}, ${city}, ${state}
${descBlock}
KNOWN NEIGHBORHOODS IN ${city.toUpperCase()}:
${neighborhoodNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

INSTRUCTIONS:
1. First check the listing description for any neighborhood or subdivision name mentioned by the agent.
2. Use the address and your knowledge to identify the correct neighborhood from the list above.
3. Return EXACTLY one neighborhood name from the list. Do not invent new names.
4. If the property doesn't clearly fit any listed neighborhood, pick the closest match.

Return ONLY valid JSON matching the schema.
`.trim();
};

export const neighborhoodMatcherSchema = {
    type: Type.OBJECT,
    properties: {
        matched_neighborhood: {
            type: Type.STRING,
            description: "The exact neighborhood name from the provided list that this property belongs to."
        },
        confidence: {
            type: Type.STRING,
            description: "One of: 'high', 'medium', 'low'. High = name found in listing or address is definitively in the neighborhood. Medium = strong geographic inference. Low = best guess."
        },
        reasoning: {
            type: Type.STRING,
            description: "Brief explanation of why this neighborhood was selected (1 sentence)."
        }
    },
    required: ["matched_neighborhood", "confidence"]
};

export interface NeighborhoodMatchResult {
    matched_neighborhood: string;
    confidence: 'high' | 'medium' | 'low';
    reasoning?: string;
}
