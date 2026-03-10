import { z } from "zod";

/**
 * Prompt for Gemini Deep Neighborhood Search using Google Grounding.
 * This tool is designed to bypass API result limits (20/50) by performing
 * recursive web searches to build a high-density POI list.
 */
export const getNeighborhoodDeepSearchPrompt = (address: string, city: string, state: string) => {
    return `
Perform an exhaustive deep search for 50+ unique points of interest (POIs) surrounding the property at ${address}, ${city}, ${state}.

Your goal is to maximize data density. Use Google Search grounding to find specific businesses, landmarks, and amenities that might be missed by standard database lookups. 

Organize your findings into the following categories:
- dining: Restaurants, cafes, bars, bakeries.
- shopping: Retail stores, groceries, malls, convenience.
- parks: Public parks, trails, playgrounds, recreation areas.
- transit: Bus stops, train stations, bike shares, major highway access points.
- fitness: Gyms, yoga studios, sports courts, pools.
- schools: Public/private K-12, colleges, daycares.
- medical: Hospitals, clinics, pharmacies, dentists.
- community: Libraries, places of worship, community centers, post offices.
- others: Any other notable local landmarks.

For each POI, provide:
1. name: Exact business or landmark name.
2. type: Specific category label (e.g., "Artisan Bakery", "State Park").
3. distance_miles: Estimated straight-line distance from ${address} (be as precise as possible, e.g., 0.3).
4. highlights: A short 1-sentence note about why this place is notable or its rating/popularity if available.

Also, provide a 'neighborhood_summary' (max 60 words) that describes the overall "vibe" and walkability of this specific micro-neighborhood.

Return the data in the specified JSON schema.
  `.trim();
};

export const neighborhoodDeepSearchSchema = {
    type: "object",
    properties: {
        neighborhood_summary: { type: "string" },
        pois: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    category: {
                        type: "string",
                        enum: ["dining", "shopping", "parks", "transit", "fitness", "schools", "medical", "community", "others"]
                    },
                    distance_miles: { type: "number" },
                    highlights: { type: "string" }
                },
                required: ["name", "type", "category", "distance_miles"]
            }
        }
    },
    required: ["neighborhood_summary", "pois"]
};
