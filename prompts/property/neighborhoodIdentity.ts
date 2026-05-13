import { Type } from "@google/genai";

/**
 * Lightweight grounded prompt for neighborhood identification and intelligence.
 *
 * Uses Gemini 3 Flash Preview + Google Search grounding to identify
 * the social/micro-level neighborhood name and gather intelligence
 * that our other prompts don't cover.
 *
 * What this prompt provides (that others don't):
 *   - Social neighborhood name (Birdland, Vintage Hills, Ruby Hill, etc.)
 *   - Neighborhood character (architecture, era, community type)
 *   - HOA / community governance details
 *   - Price positioning within the city
 *   - Upcoming development / changes
 *   - Unique physical features of the neighborhood
 *
 * What other prompts already cover (DO NOT duplicate):
 *   - POI / amenities → neighborhoodAnalysis.ts (Google Places + map vision)
 *   - Community sentiment / complaints → communityPulse.ts (grounded, city-level)
 *   - Lifestyle fit assessment → lifestyleFit.ts (property-level, MLS + visual)
 *   - School analysis → schoolsAnalysis.ts (grounded, per-school)
 *   - Street view / curb appeal → streetViewAnalysis.ts (visual)
 *
 * FAIR HOUSING COMPLIANCE:
 *   This prompt intentionally EXCLUDES any demographic, racial, ethnic, religious,
 *   or familial status information to comply with FEHA, Federal Fair Housing Act,
 *   and NAR Code of Ethics. Focus is strictly on physical characteristics,
 *   market data, and infrastructure.
 */

export const getNeighborhoodIdentityPrompt = (address: string, city: string, state: string, description?: string) => {
    const descriptionBlock = description
        ? `\nLISTING DESCRIPTION (from the listing agent — check this FIRST for neighborhood name clues):\n"${description.slice(0, 1500)}"\n`
        : '';

    return `
Act as a neighborhood intelligence tool specializing in micro-level residential neighborhood identification.

TASK: Identify the specific, social-level neighborhood name and gather unique intelligence for the address below.

ADDRESS: ${address}, ${city}, ${state}
${descriptionBlock}
INSTRUCTIONS:
1. FIRST, check the listing description above (if provided) for any neighborhood, subdivision, or community name the agent mentioned. Agents often reference the neighborhood by name — use this as a strong signal.
2. THEN, use Google Search grounding to verify and enrich the name — find the "social name" that residents, real estate agents, and locals actually use (e.g., 'Birdland', 'Vintage Hills', 'Ruby Hill', 'Kottinger Ranch', 'Del Prado').
3. IGNORE broad city-level names (e.g., just "Pleasanton" or "Dublin") — drill down to the micro-neighborhood.
4. If multiple names exist (e.g., a subdivision within a larger neighborhood), list the most specific one as primary and others as alternatives.
5. If no social name is found, return the legal subdivision or tract name from county records.

ADDITIONAL INTELLIGENCE (provide ONLY information you can verify via search — do NOT fabricate):

6. NEIGHBORHOOD CHARACTER: What's the architectural style? When was it built? Is it gated, HOA-governed, or open? What are the typical lot sizes and home sizes?
7. PRICE CONTEXT: Where does this neighborhood sit in the city's price hierarchy? (Entry-level, mid-range, premium, ultra-luxury?) What's the typical price range?
8. HOA DETAILS: If there's an HOA, what are the fees and what do they cover? Any notable rules?
9. NEIGHBORHOOD QUALITY: Focus on INFRASTRUCTURE and PHYSICAL aspects only — road conditions, landscaping quality, noise levels, traffic patterns, parking, street lighting, sidewalks, and overall maintenance level.
10. DEVELOPMENT & CHANGES: Any upcoming developments, construction, or zoning changes that could affect this neighborhood?
11. UNIQUE FEATURES: Physical features that make this neighborhood stand out — trails, private parks, views, proximity to specific landmarks, water features, green belts, etc.

CRITICAL COMPLIANCE RULE: Do NOT include ANY information about the demographic composition, racial/ethnic makeup, religious institutions, age distribution, household types, or familial characteristics of residents. Focus EXCLUSIVELY on physical property characteristics, market data, infrastructure, and geography. This is required for Fair Housing Act and FEHA compliance.

Return ONLY valid JSON matching the schema. Be concise but specific.
`.trim();
};

export const neighborhoodIdentitySchema = {
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
                description: { type: Type.STRING, description: "2-3 sentence description of the neighborhood's physical character — architecture, landscaping, lot sizes, and overall feel." },
                architectural_style: { type: Type.STRING, description: "Dominant home style (e.g., 'Mediterranean Revival', 'Ranch-style', 'Modern Tract')." },
                era_built: { type: Type.STRING, description: "When most homes were built (e.g., '1970s-1980s', '2005-2010')." },
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
                typical_range: { type: Type.STRING, description: "Typical price range for homes in this neighborhood (e.g., '$1.2M - $1.8M')." },
                context: { type: Type.STRING, description: "1-2 sentences on how this neighborhood is positioned within the city's market." }
            },
            required: ["tier", "typical_range"]
        },
        hoa: {
            type: Type.OBJECT,
            properties: {
                has_hoa: { type: Type.BOOLEAN, description: "Whether this neighborhood has an HOA." },
                monthly_fee: { type: Type.STRING, description: "Monthly HOA fee if known (e.g., '$150/month')." },
                covers: { type: Type.STRING, description: "What the HOA covers (landscaping, pool, clubhouse, etc.)." },
                notable_rules: { type: Type.STRING, description: "Any notable HOA restrictions or rules." }
            },
            required: ["has_hoa"]
        },
        infrastructure_quality: {
            type: Type.STRING,
            description: "Assessment of physical infrastructure: road conditions, sidewalks, street lighting, landscaping quality, noise levels, and overall maintenance (2-3 sentences). Focus ONLY on physical attributes."
        },
        upcoming_changes: {
            type: Type.STRING,
            description: "Any planned developments, construction, or zoning changes near this neighborhood. Must be a single flat text string, NOT a structured JSON object. Say 'None known' if nothing found."
        },
        unique_features: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-5 physical features that make this neighborhood stand out (e.g., 'Private community trail system', 'Views of Pleasanton Ridge', 'Walking distance to downtown Main Street')."
        }
    },
    required: ["neighborhood_name", "alternative_names", "source_type", "character", "price_context"]
};

// ── TypeScript result type ────────────────────────────────────────────────────

export interface NeighborhoodIdentityResult {
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
