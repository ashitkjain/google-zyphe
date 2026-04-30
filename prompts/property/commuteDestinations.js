/**
 * Commute Destinations prompt (JS Mirror of commuteDestinations.ts)
 */

export const getCommuteDestinationsPrompt = (params) => {
    const { city, state } = params;

    return `
You are a local transit and economic researcher.
TASK: Identify the top 4 primary commute or high-traffic destinations for residents of ${city}, ${state}.

CONTEXT:
We need to show potential homebuyers where people in this specific city typically commute to for work, major shopping, or regional travel (airports).

DESTINATION TYPES:
1. Major employment hubs (Financial districts, tech campuses, industrial parks).
2. Major regional airports.
3. Significant downtown centers of nearby larger cities.

FOR EACH DESTINATION:
- Name: Human-readable name (e.g., "Downtown San Francisco", "SJC Airport", "Apple Park").
- Why: 1-sentence reason why it's a top destination for ${city} residents.
- Typical Route: Mention the primary highway or transit line used (e.g., "via I-580", "via BART Blue Line").
- search_query: A PRECISE string for Google Maps (e.g., "Salesforce Tower, San Francisco, CA" instead of "Downtown SF", or "Googleplex, Mountain View, CA" instead of "Silicon Valley"). This MUST be a specific location or well-known landmark to ensure Distance Matrix works correctly.

RULES:
- Return EXACTLY 4 destinations.
- Be specific to ${city}, ${state}. For example, if it's a bedroom community, identify the major cities people commute to.
- Return valid JSON matching the schema.
`.trim();
};

export const commuteDestinationsSchema = {
    type: "OBJECT",
    properties: {
        destinations: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    name: { type: "STRING", description: "Name of the destination" },
                    description: { type: "STRING", description: "Why it's a top destination and primary route info" },
                    search_query: { type: "STRING", description: "A specific string to use for Google Maps Place search to get coordinates" }
                },
                required: ["name", "description", "search_query"]
            },
            minItems: 4,
            maxItems: 4
        }
    },
    required: ["destinations"]
};
