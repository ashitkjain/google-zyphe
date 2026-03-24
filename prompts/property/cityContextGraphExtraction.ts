/**
 * City-Level Context Graph Extraction Prompt
 * 
 * Extracts the 14 city/neighborhood-level factors ONCE per city from
 * deep_investment_research and community_pulse data. These factors are
 * identical across all properties in a city, so extracting them once
 * saves ~50K tokens per property.
 */

import { Type } from "@google/genai";
import { CITY_LEVEL_FACTOR_IDS, FACTOR_NAMES } from "../../constants/contextGraphFactors";

export interface CityContextGraphResult {
    city: string;
    extractedAt: string;
    factors: { id: number; tags: string[] }[];
    summary: {
        marketOverview: string;
        communityHighlights: string;
    };
}

/**
 * Build the minimal context for city-level factor extraction.
 * Only includes deep_investment_research and community_pulse — no property data.
 */
export const buildCityContextGraphContext = (
    city: string,
    state: string,
    deepInvestmentResearch: any | null,
    communityPulse: any | null,
) => {
    // Strip web sources / citations to save tokens
    let cleanDeepResearch = null;
    if (deepInvestmentResearch) {
        const { citations, web_sources, ...kept } = deepInvestmentResearch;
        cleanDeepResearch = kept;
    }

    let cleanPulse = null;
    if (communityPulse) {
        const cleaned = { ...communityPulse };
        for (const section of Object.values(cleaned)) {
            if (section && typeof section === 'object' && 'sources' in section) {
                delete (section as any).sources;
            }
        }
        cleanPulse = cleaned;
    }

    return {
        city,
        state,
        deepInvestmentResearch: cleanDeepResearch,
        communityPulse: cleanPulse,
    };
};

/**
 * Build the factor reference for the prompt — only city-level factor definitions.
 */
const buildCityFactorReference = (): string => {
    return CITY_LEVEL_FACTOR_IDS
        .map(id => `${id}=${FACTOR_NAMES[id] || `Factor ${id}`}`)
        .join(', ');
};

export const getCityContextGraphPrompt = (context: any): string => {
    return `You are a real estate market analyst. Extract city/market-level decision factors from the research data below.

These factors apply equally to ALL properties in ${context.city}, ${context.state}. They describe the market, community, and neighborhood — not any individual property.

## FACTOR DEFINITIONS

### Historical & Market (9, 70, 75)
9. **Historical Appreciation**: YoY and 5-year price appreciation trends from macroeconomic_indicators and market_dynamics. Tags: specific %s, trend direction.
70. **Market Momentum**: Cross-reference median DOM with inventory. Low inventory + low DOM (<20) = Seller's Market. Low inventory + high DOM (>30) = Stagnant. Include median DOM and months of supply. Classify: Seller's/Balanced/Buyer's/Stagnant.
75. **Market Velocity (DOM)**: MEDIAN Days on Market for the city/area. Fast = <14 days, Moderate = 14-30, Slow = >30. Include the actual DOM number.

### Community & Neighborhood (71-74)
71. **Development Maturity**: "New Build Area", "Established", or describe the blend (e.g. "Transitional — older homes + new infill"). Never just "Mixed".
72. **Resident Complaint Profile**: Top 1-2 recurring complaints from community_pulse.common_complaints.
73. **Resident Satisfaction Drivers**: Top 1-2 things residents love from community_pulse.what_residents_like.
74. **Perceived Neighborhood Safety**: Resident-reported safety sentiment from community_pulse.safety_and_concerns.

### Investment Intelligence (89-93)
89. **Market Signals**: Market direction concepts: "Seller's Market", "Low Inventory", "3% YoY Growth", etc. 3-8 tags.
90. **Growth Catalysts**: Upcoming drivers: "BART Extension 2026", "New Tech Campus", etc. 3-8 tags.
91. **Investment Risk Factors**: Risk concepts: "Seismic Zone", "Drought Risk", "FAIR Plan Insurance", etc. 3-8 tags.
92. **Market Friction**: Drawbacks: "Long SF Commute", "Limited Transit", "No Nightlife", etc. 3-8 tags.
93. **Zoning & Regulatory Perks**: Zoning advantages: "ADU-Friendly", "No STR Ban", "Prop 13 Transfer", etc. 3-8 tags.

### Community Sentiment (102-103)
102. **Resident Sentiment Concepts**: Overall sentiment concepts from community_pulse. 3-8 tags.
103. **Market Narrative Concepts**: Narrative concepts: "Tech Worker Suburb", "Family-Oriented", etc. 3-8 tags.

## CITY DATA

\`\`\`json
${JSON.stringify(context, null, 0)}
\`\`\`

## OUTPUT FORMAT

Return a JSON object:
{
  "city": "${context.city}",
  "extractedAt": "ISO timestamp",
  "factors": [
    { "id": 70, "tags": ["Seller's Market", "12 Days Median DOM", "Low Inventory"] },
    ...
  ],
  "summary": {
    "marketOverview": "1-2 sentence market overview",
    "communityHighlights": "1-2 sentence community highlights"
  }
}

RULES:
- Extract ALL 14 factors listed above (IDs: ${CITY_LEVEL_FACTOR_IDS.join(', ')})
- If data is missing for a factor, use tags: ["Data Not Available"]
- Tags: 2-8 short labels (1-4 words each) with specific numbers and categories
- Be specific — include actual percentages, DOM numbers, and trend data
`;
};

export const cityContextGraphSchema = {
    type: Type.OBJECT,
    properties: {
        city: { type: Type.STRING },
        extractedAt: { type: Type.STRING },
        factors: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.NUMBER },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["id", "tags"]
            }
        },
        summary: {
            type: Type.OBJECT,
            properties: {
                marketOverview: { type: Type.STRING },
                communityHighlights: { type: Type.STRING }
            },
            required: ["marketOverview", "communityHighlights"]
        }
    },
    required: ["city", "extractedAt", "factors", "summary"]
};
