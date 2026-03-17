import { Type } from "@google/genai";

/**
 * City-Level Neighborhood Miner Prompt
 *
 * Runs ONCE per city to catalog ALL residential neighborhoods with
 * full identity data (character, pricing, features, HOA, etc.).
 *
 * Results are cached in Firestore `city_neighborhoods/{cityStateKey}`
 * and reused for lightweight per-property matching, eliminating
 * redundant Gemini calls across properties in the same city.
 */

export const getCityNeighborhoodMinerPrompt = (city: string, state: string) => {
    return `
Act as a comprehensive neighborhood intelligence tool specializing in residential area identification and analysis.

TASK: Identify and catalog ALL known residential neighborhoods, subdivisions, and communities in ${city}, ${state}.

INSTRUCTIONS:
1. Use Google Search grounding to find EVERY residential neighborhood, subdivision, and named community in ${city}.
2. For each neighborhood, provide:
   - The "social name" that residents, real estate agents, and locals actually use
   - Alternative names (subdivision name, tract name, historical name)
   - Physical character (architecture, era, community type, home/lot sizes)
   - Price positioning within the city (Entry-Level through Ultra-Luxury)
   - HOA details if applicable
   - Unique physical features (trails, views, parks, proximity to landmarks)
3. Be EXHAUSTIVE — include small subdivisions, newer developments, and established neighborhoods alike.
4. Order neighborhoods roughly by price tier (Entry-Level first, Ultra-Luxury last).
5. ALSO provide a "city_summary" that:
   - Gives an overall summary of the residential landscape in ${city}
   - Explains the key trade-offs between neighborhoods (e.g. price vs lot size, schools vs commute, newer vs established)
   - Provides practical buying guidance: how should a prospective buyer go about deciding which neighborhood to buy a home in?
   - Highlights any neighborhood clusters or corridors that share similar characteristics
   - Keep this to 3-5 paragraphs, written in a helpful, advisory tone

IMPORTANT RULES:
- Focus on RESIDENTIAL neighborhoods only (not commercial districts).
- Include both established (1960s-1990s) and newer (2000s+) communities.
- For "social names," use the name agents list on MLS/Zillow/Redfin, not just official county names.
- If a neighborhood has both a subdivision name and a broader area name, list both.

CRITICAL COMPLIANCE RULE: Do NOT include ANY information about demographic composition, racial/ethnic makeup, religious institutions, age distribution, household types, or familial characteristics of residents. Focus EXCLUSIVELY on physical property characteristics, market data, infrastructure, and geography. This is required for Fair Housing Act and FEHA compliance.

Return ONLY valid JSON matching the schema.
`.trim();
};

export const cityNeighborhoodMinerSchema = {
    type: Type.OBJECT,
    properties: {
        city: { type: Type.STRING, description: "City name." },
        state: { type: Type.STRING, description: "State abbreviation." },
        total_neighborhoods: { type: Type.NUMBER, description: "Total number of neighborhoods identified." },
        city_summary: {
            type: Type.STRING,
            description: "3-5 paragraph summary of the city's residential landscape. Covers how neighborhoods compare, key trade-offs (price vs lot size, schools vs commute, newer vs established), practical buying guidance for prospective buyers on how to decide which neighborhood to buy in, and any notable neighborhood clusters or corridors."
        },
        neighborhoods: {
            type: Type.ARRAY,
            description: "All identified residential neighborhoods in the city.",
            items: {
                type: Type.OBJECT,
                properties: {
                    neighborhood_name: {
                        type: Type.STRING,
                        description: "The most specific social/residential neighborhood name that locals and real estate agents use."
                    },
                    alternative_names: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Other known names for this neighborhood (subdivision name, tract name, historical name)."
                    },
                    source_type: {
                        type: Type.STRING,
                        description: "Where the name was sourced from: 'Real Estate / Google Maps', 'County Records', 'Community Forums', etc."
                    },
                    character: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING, description: "2-3 sentence description of the neighborhood's physical character." },
                            architectural_style: { type: Type.STRING, description: "Dominant home style (e.g., 'Mediterranean Revival', 'Ranch-style')." },
                            era_built: { type: Type.STRING, description: "When most homes were built (e.g., '1970s-1980s')." },
                            community_type: { type: Type.STRING, description: "One of: 'Gated Community', 'HOA Community', 'Open Neighborhood', 'Master-Planned', 'Rural/Estate'." },
                            typical_home_size: { type: Type.STRING, description: "Typical home size range (e.g., '1,800 - 2,500 sqft')." },
                            typical_lot_size: { type: Type.STRING, description: "Typical lot size range (e.g., '6,000 - 8,000 sqft')." },
                        },
                        required: ["description"]
                    },
                    price_context: {
                        type: Type.OBJECT,
                        properties: {
                            tier: { type: Type.STRING, description: "One of: 'Entry-Level', 'Mid-Range', 'Upper Mid-Range', 'Premium', 'Ultra-Luxury'." },
                            typical_range: { type: Type.STRING, description: "Typical price range (e.g., '$1.2M - $1.8M')." },
                            context: { type: Type.STRING, description: "1-2 sentences on how this neighborhood is positioned within the city's market." }
                        },
                        required: ["tier", "typical_range"]
                    },
                    hoa: {
                        type: Type.OBJECT,
                        properties: {
                            has_hoa: { type: Type.BOOLEAN, description: "Whether this neighborhood has an HOA." },
                            monthly_fee: { type: Type.STRING, description: "Monthly HOA fee if known." },
                            covers: { type: Type.STRING, description: "What the HOA covers." },
                            notable_rules: { type: Type.STRING, description: "Any notable HOA restrictions." }
                        },
                        required: ["has_hoa"]
                    },
                    infrastructure_quality: {
                        type: Type.STRING,
                        description: "Assessment of physical infrastructure (2-3 sentences). Focus ONLY on physical attributes."
                    },
                    upcoming_changes: {
                        type: Type.STRING,
                        description: "Any planned developments or zoning changes. Say 'None known' if nothing found."
                    },
                    unique_features: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "2-5 physical features that make this neighborhood stand out."
                    }
                },
                required: ["neighborhood_name", "alternative_names", "source_type", "character", "price_context"]
            }
        }
    },
    required: ["city", "state", "total_neighborhoods", "city_summary", "neighborhoods"]
};

// ── TypeScript types ──────────────────────────────────────────────────────────

export interface CityNeighborhoodEntry {
    neighborhood_name: string;
    alternative_names: string[];
    source_type: string;
    character: {
        description: string;
        architectural_style?: string;
        era_built?: string;
        community_type?: string;
        typical_home_size?: string;
        typical_lot_size?: string;
    };
    price_context: {
        tier: string;
        typical_range: string;
        context?: string;
    };
    hoa?: {
        has_hoa: boolean;
        monthly_fee?: string;
        covers?: string;
        notable_rules?: string;
    };
    infrastructure_quality?: string;
    upcoming_changes?: string;
    unique_features?: string[];
}

export interface CityNeighborhoodsResult {
    city: string;
    state: string;
    total_neighborhoods: number;
    city_summary: string;
    neighborhoods: CityNeighborhoodEntry[];
}
