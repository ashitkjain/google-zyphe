import { Type } from "@google/genai";

/**
 * City-Level Neighborhood Miner Prompt
 *
 * Runs ONCE per city to catalog ALL residential neighborhoods with
 * full identity data (character, pricing, features, HOA, etc.)
 * AND live Nextdoor community intelligence (topics, events, sentiment).
 *
 * Results are cached in Firestore `cities/{cityStateKey}/index/neighborhoods`
 * and reused for lightweight per-property matching, eliminating
 * redundant Gemini calls across properties in the same city.
 */

export const getCityNeighborhoodMinerPrompt = (city: string, state: string) => {
    const stateSlug = state.toLowerCase().trim();
    const citySlug = city.toLowerCase().trim().replace(/\s+/g, '-');

    return `
Act as a comprehensive neighborhood intelligence tool specializing in residential area identification and Nextdoor community analysis.

TASK: Identify and catalog ALL known residential neighborhoods in ${city}, ${state}, enriched with live Nextdoor community data.

═══════════════════════════════════════════════════════
STEP 1 — DISCOVER NEIGHBORHOODS
═══════════════════════════════════════════════════════
Use Google Search to find EVERY residential neighborhood, subdivision, and named community in ${city}, ${state}.
- Use names that residents, real estate agents, and MLS listings actually use (Zillow/Redfin/Nextdoor names, not just county records).
- Include both established (1960s-1990s) and newer (2000s+) communities.
- Include small subdivisions and HOA communities, not just large area names.
- Focus on RESIDENTIAL neighborhoods — exclude commercial zones, road names, and mall areas.

═══════════════════════════════════════════════════════
STEP 2 — ENRICH WITH NEXTDOOR DATA
═══════════════════════════════════════════════════════
For each neighborhood discovered in Step 1, collect two types of Nextdoor data:

2A. RANKINGS PAGE — Use this for official scores (friendliness, affordability, city rank):
  Search: site:nextdoor.com/rankings best-places-to-live ${city} ${state}
  URL:    https://nextdoor.com/rankings/best-places-to-live/${citySlug}--${stateSlug}/

  From this page, extract for each neighborhood that appears:
  • Numeric city rank (#1 = highest rated overall)
  • Friendliness score (as rated by Nextdoor residents — record EXACTLY as shown)
  • Affordability score (as rated by Nextdoor residents — record EXACTLY as shown)
  • Home ownership percentage

  NOTE: Not all neighborhoods will appear here (e.g. gated/premium communities like Ruby Hill may
  be absent). That is expected — record nextdoor_found: true but leave ranking fields null for those.

2B. INDIVIDUAL NEIGHBORHOOD SEARCH — Use this for topics, description, and events:
  Search: site:nextdoor.com "{neighborhood name}" ${city}
  Examples:
    - site:nextdoor.com "Ruby Hill" ${city}
    - site:nextdoor.com "Birdland" ${city}
    - site:nextdoor.com "Val Vista" ${city}

  From these results, extract:
  • description        — Nextdoor's neighborhood description blurb
  • key_topics         — Top 3-5 discussion topics/categories with 1-2 sentence summaries each
                         (e.g. "Outdoor Activities & Gear", "Safety Alerts", "City & Park Updates")
  • upcoming_events    — Any specific upcoming events with name + date
  • local_events_count — Approximate event count ("3", "10+", "Unknown")

  For neighborhoods NOT on the rankings page, infer:
  • friendliness_score  — 1-10, based on topic tone and community post variety
  • affordability_score — 1-10, based on price tier relative to city (10 = most affordable)
  • overall_city_rank   — Qualitative: "Top 5 most active", "Mid-tier", "Lower activity"

  • nextdoor_url — Construct as: https://nextdoor.com/neighborhood/{slug}--${citySlug}--${stateSlug}/
                   where {slug} = neighborhood name lowercased, spaces → hyphens

If no Nextdoor results are found at all for a neighborhood, set nextdoor_found: false.

═══════════════════════════════════════════════════════
STEP 3 — COMPILE FULL NEIGHBORHOOD PROFILE
═══════════════════════════════════════════════════════
For each neighborhood, combine real estate data + Nextdoor data:
   - Physical character (architecture, era, community type, home/lot sizes)
   - Price positioning within the city (Entry-Level → Ultra-Luxury)
   - HOA details if applicable
   - Unique physical features (trails, views, parks, proximity to landmarks)
   - Full Nextdoor community intelligence (from Step 2)

═══════════════════════════════════════════════════════
STEP 4 — CITY SUMMARY
═══════════════════════════════════════════════════════
Provide a "city_summary" (3-5 paragraphs) covering:
  - Overall residential landscape
  - Key trade-offs between neighborhoods (price vs lot size, schools vs commute, newer vs established)
  - Which neighborhoods rank highest on Nextdoor for community engagement and friendliness
  - Practical buying guidance for a prospective buyer deciding between neighborhoods

ORDERING: Sort neighborhoods by price tier (Entry-Level first, Ultra-Luxury last).

CRITICAL COMPLIANCE RULE: Do NOT include ANY information about demographic composition, racial/ethnic makeup, religious institutions, age distribution, household types, or familial characteristics of residents. Focus EXCLUSIVELY on physical property characteristics, market data, infrastructure, geography, and community activity. This is required for Fair Housing Act and FEHA compliance.

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
            description: "3-5 paragraph summary of the city's residential landscape including which neighborhoods rank highest on Nextdoor for community engagement, key trade-offs, and practical buying guidance."
        },
        neighborhoods: {
            type: Type.ARRAY,
            description: "All identified residential neighborhoods in the city, enriched with Nextdoor community data.",
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
                        description: "Where the name was sourced from: 'Real Estate / MLS', 'Nextdoor', 'Google Maps', 'County Records', 'Community Forums', etc."
                    },

                    // ── Physical Character ──────────────────────────────────
                    character: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING, description: "2-3 sentence description of the neighborhood's physical character." },
                            architectural_style: { type: Type.STRING, description: "Dominant home style (e.g., 'Mediterranean Revival', 'Ranch-style', 'Contemporary')." },
                            era_built: { type: Type.STRING, description: "When most homes were built (e.g., '1970s-1980s', '2005-2015')." },
                            community_type: { type: Type.STRING, description: "One of: 'Gated Community', 'HOA Community', 'Open Neighborhood', 'Master-Planned', 'Rural/Estate'." },
                            typical_home_size: { type: Type.STRING, description: "Typical home size range (e.g., '1,800 - 2,500 sqft')." },
                            typical_lot_size: { type: Type.STRING, description: "Typical lot size range (e.g., '6,000 - 8,000 sqft')." },
                        },
                        required: ["description"]
                    },

                    // ── Pricing ─────────────────────────────────────────────
                    price_context: {
                        type: Type.OBJECT,
                        properties: {
                            tier: { type: Type.STRING, description: "One of: 'Entry-Level', 'Mid-Range', 'Upper Mid-Range', 'Premium', 'Ultra-Luxury'." },
                            typical_range: { type: Type.STRING, description: "Typical active listing price range (e.g., '$1.2M - $1.8M')." },
                            city_rank: { type: Type.NUMBER, description: "Price rank within the city — 1 = most affordable, higher = more expensive." },
                            context: { type: Type.STRING, description: "1-2 sentences on how this neighborhood is positioned within the city's market." }
                        },
                        required: ["tier", "typical_range"]
                    },

                    // ── HOA ─────────────────────────────────────────────────
                    hoa: {
                        type: Type.OBJECT,
                        properties: {
                            has_hoa: { type: Type.BOOLEAN, description: "Whether this neighborhood has an HOA." },
                            monthly_fee: { type: Type.STRING, description: "Monthly HOA fee range if known (e.g., '$150 - $250/mo')." },
                            covers: { type: Type.STRING, description: "What the HOA fee covers (e.g., 'landscaping, pool, tennis courts')." },
                            notable_rules: { type: Type.STRING, description: "Any notable HOA restrictions buyers should know." }
                        },
                        required: ["has_hoa"]
                    },

                    // ── Physical Features ────────────────────────────────────
                    infrastructure_quality: {
                        type: Type.STRING,
                        description: "2-3 sentence assessment of physical infrastructure (roads, sidewalks, streetlights, parks)."
                    },
                    upcoming_changes: {
                        type: Type.STRING,
                        description: "Any planned developments, zoning changes, or infrastructure projects. Say 'None known' if nothing found."
                    },
                    unique_features: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "2-5 physical features that make this neighborhood stand out (e.g., 'Adjacent to Shadow Cliffs Regional Park', 'Hillside views of Tri-Valley')."
                    },

                    // ── Nextdoor Community Intelligence ─────────────────────
                    nextdoor: {
                        type: Type.OBJECT,
                        description: "Live community intelligence sourced from the neighborhood's Nextdoor page.",
                        properties: {
                            found: {
                                type: Type.BOOLEAN,
                                description: "Whether a Nextdoor page was found for this neighborhood."
                            },
                            url: {
                                type: Type.STRING,
                                description: "The Nextdoor URL checked (e.g., 'https://nextdoor.com/neighborhood/ruby-hill--pleasanton--ca/')."
                            },
                            description: {
                                type: Type.STRING,
                                description: "Official neighborhood description as shown on the Nextdoor page."
                            },
                            friendliness_score: {
                                type: Type.NUMBER,
                                description: "Community friendliness/engagement score on a 1-10 scale based on Nextdoor activity, reviews, and tone. 10 = extremely friendly and active."
                            },
                            affordability_score: {
                                type: Type.NUMBER,
                                description: "Affordability score on a 1-10 scale based on home prices relative to city average. 10 = most affordable in the city."
                            },
                            home_ownership_pct: {
                                type: Type.STRING,
                                description: "Estimated percentage of owner-occupied homes (e.g., '78%') if available on Nextdoor or from public data."
                            },
                            local_events_count: {
                                type: Type.STRING,
                                description: "Approximate number of local events listed on Nextdoor (e.g., '3', '10+', '20+'). Use 'Unknown' if not available."
                            },
                            upcoming_events: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING, description: "Event name." },
                                        date: { type: Type.STRING, description: "Event date or date range (e.g., 'April 12, 2025')." },
                                        description: { type: Type.STRING, description: "Brief description of the event." }
                                    },
                                    required: ["name"]
                                },
                                description: "Specific upcoming events found on the Nextdoor neighborhood page."
                            },
                            key_topics: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        topic: { type: Type.STRING, description: "Topic name (e.g., 'Outdoor Activities & Gear', 'Safety Alerts', 'Lost & Found Pets', 'City & Park Updates')." },
                                        description: { type: Type.STRING, description: "1-2 sentence summary of what neighbors discuss under this topic." }
                                    },
                                    required: ["topic"]
                                },
                                description: "Top 3-6 discussion topics/categories currently active on this neighborhood's Nextdoor page."
                            },
                            overall_city_rank: {
                                type: Type.STRING,
                                description: "Qualitative ranking of this neighborhood within the city on Nextdoor (e.g., 'Top 3 most active', 'Mid-tier engagement', 'Lower activity'). Based on post volume and event count relative to other neighborhoods in the city."
                            }
                        },
                        required: ["found", "url"]
                    }
                },
                required: ["neighborhood_name", "alternative_names", "source_type", "character", "price_context", "nextdoor"]
            }
        }
    },
    required: ["city", "state", "total_neighborhoods", "city_summary", "neighborhoods"]
};

// ── TypeScript types ──────────────────────────────────────────────────────────

export interface NextdoorUpcomingEvent {
    name: string;
    date?: string;
    description?: string;
}

export interface NextdoorKeyTopic {
    topic: string;
    description?: string;
}

export interface NeighborhoodNextdoorData {
    found: boolean;
    url: string;
    description?: string;
    friendliness_score?: number;
    affordability_score?: number;
    home_ownership_pct?: string;
    local_events_count?: string;
    upcoming_events?: NextdoorUpcomingEvent[];
    key_topics?: NextdoorKeyTopic[];
    overall_city_rank?: string;
}

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
        city_rank?: number;
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
    nextdoor: NeighborhoodNextdoorData;
}

export interface CityNeighborhoodsResult {
    city: string;
    state: string;
    total_neighborhoods: number;
    city_summary: string;
    neighborhoods: CityNeighborhoodEntry[];
}
