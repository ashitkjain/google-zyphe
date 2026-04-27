import { Type } from "@google/genai";

export const getBuyerStoryWeightsPrompt = (
    whoYouAre: string,
    dailyRituals: string,
    mustHaves: string,
    corePriorities: string,
    readiness: string
) => {
    return `
You are an expert real estate matchmaker. 
Your goal is to translate a buyer's personal story into mathematical weights for our matching engine.
We score all properties across 16 core "Buyer DNA" dimensions on a scale of 0-100.
To find the perfect match, we need to know how IMPORTANT each of these 16 dimensions is to THIS specific buyer.

### THE BUYER'S STORY
1. Who they are: ${whoYouAre || "Not provided"}
2. Daily rituals & lifestyle: ${dailyRituals || "Not provided"}
3. Must-haves & Deal-breakers: ${mustHaves || "Not provided"}
4. Core Priorities: ${corePriorities || "Not provided"}
5. Readiness: ${readiness || "Not provided"}

### YOUR TASK
Based ONLY on the buyer's story, assign an IMPORTANCE WEIGHT (0 to 10) for each of the 16 dimensions below.
- 0-2: Completely irrelevant (They don't care at all, or explicitly want to avoid paying for it).
- 3-4: Low importance (Nice to have, but barely moves the needle).
- 5: Average importance (Standard baseline expectation).
- 6-7: Above average (They mentioned it, but it's not a strict dealbreaker).
- 8-9: Highly important (They specifically requested features related to this as a primary goal).
- 10: Non-negotiable dealbreaker (They will not buy a home if this dimension scores poorly).

### THE 16 SHARED DIMENSIONS
1. valueAndCost: Value & Cost to Own (Price, HOA, taxes, appreciation)
2. incomePotential: Income Potential (ADU, STR, rental yield)
3. marketLeverage: Market Leverage (Seller motivation, DOM, distress)
4. turnkeyVsProject: Turnkey vs. Project (Condition, renovation upside, move-in ready)
5. aestheticsAndVibe: Aesthetics & Vibe (Natural light, sunset porches, cohesive design, architectural charm)
6. kitchenAndBaths: Kitchen & Baths (Modernity, layout, appliances)
7. spaceAndLayout: Space & Layout (Sqft, open concept for hosting, split bedrooms)
8. systemsAndEco: Systems & Eco (New roof, new HVAC, solar panels, EV charging, sustainable architecture)
9. yardAndOutdoor: Yard & Outdoor Living (Large fenced yard, pet-friendly spaces, pool, outdoor kitchen)
10. lotSettingAndPrivacy: Lot Setting & Privacy (Cul-de-sac, views, zero rear neighbors, quiet street)
11. walkabilityAndVibe: Walkability & Local Vibe (Walkable cafes, sidewalks, near parks)
12. commuteAndWfh: Commute & Remote Work (Dedicated/closed-door home office, gigabit fiber, near highway or BART/transit)
13. familyAndSchools: Family & Schools (8-10/10 schools, near family parks, safe play areas)
14. multiGenAndAging: Multi-Gen & Aging in Place (Single-story living, downstairs primary suite, in-law/multi-gen setups, elevator)
15. neighborhoodQuality: Neighborhood Quality & Safety (Safety, pride of ownership, well-maintained streets)
16. climateAndGeoRisks: Climate & Geo Risks (Low wildfire risk, flood zones, fault lines)

Return the output as a JSON object where the keys are exactly as named above, and the value is the integer weight from 0 to 10.
    `;
};

export const buyerStoryWeightsSchema = {
    type: Type.OBJECT,
    properties: {
        valueAndCost: { type: Type.INTEGER, description: "Weight 0-10" },
        incomePotential: { type: Type.INTEGER, description: "Weight 0-10" },
        marketLeverage: { type: Type.INTEGER, description: "Weight 0-10" },
        turnkeyVsProject: { type: Type.INTEGER, description: "Weight 0-10" },
        aestheticsAndVibe: { type: Type.INTEGER, description: "Weight 0-10" },
        kitchenAndBaths: { type: Type.INTEGER, description: "Weight 0-10" },
        spaceAndLayout: { type: Type.INTEGER, description: "Weight 0-10" },
        systemsAndEco: { type: Type.INTEGER, description: "Weight 0-10" },
        yardAndOutdoor: { type: Type.INTEGER, description: "Weight 0-10" },
        lotSettingAndPrivacy: { type: Type.INTEGER, description: "Weight 0-10" },
        walkabilityAndVibe: { type: Type.INTEGER, description: "Weight 0-10" },
        commuteAndWfh: { type: Type.INTEGER, description: "Weight 0-10" },
        familyAndSchools: { type: Type.INTEGER, description: "Weight 0-10" },
        multiGenAndAging: { type: Type.INTEGER, description: "Weight 0-10" },
        neighborhoodQuality: { type: Type.INTEGER, description: "Weight 0-10" },
        climateAndGeoRisks: { type: Type.INTEGER, description: "Weight 0-10" }
    },
    required: [
        "valueAndCost", "incomePotential", "marketLeverage", "turnkeyVsProject", "aestheticsAndVibe",
        "kitchenAndBaths", "spaceAndLayout", "systemsAndEco", "yardAndOutdoor", "lotSettingAndPrivacy",
        "walkabilityAndVibe", "commuteAndWfh", "familyAndSchools", "multiGenAndAging", "neighborhoodQuality",
        "climateAndGeoRisks"
    ]
};
