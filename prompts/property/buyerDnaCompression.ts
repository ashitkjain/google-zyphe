import { Type } from "@google/genai";
import { FACTOR_NAMES } from "../../constants/contextGraphFactors";

export const getBuyerDnaCompressionPrompt = (factors: any[]) => {
    // Convert compact factors into readable text for the AI
    const readableFactors = factors.map(f => {
        const id = f.i || f.id;
        const name = FACTOR_NAMES[id] || `Factor ${id}`;
        const tags = f.t || f.tags || [];
        const value = f.v || f.value || '';
        return `- ${name}: ${value} [Tags: ${tags.join(', ')}]`;
    }).join('\n');

    return `
You are an expert real estate data analyst. 
We have extracted ${factors.length} granular data points about a property.
Your job is to COMPRESS this data into 16 core "Buyer DNA" dimensions that realtors use to match buyers with homes.

Here are the granular factors extracted for this property:
${readableFactors}

### TASK
For EACH of the 16 dimensions below, provide a Score (0-100) and a rich, detailed 1-2 sentence Summary.

### SCORING CALIBRATION RUBRIC
Please use a balanced, realistic 0-100 scale. A score of 50 represents a perfectly average, standard home. Use the full range of scores fairly based on the evidence.
- 0-20: POOR / SEVERE DEFICIENCY. Active liability (e.g., massive HOA, gut rehab needed, busy highway noise, severe fire risk).
- 21-40: BELOW AVERAGE. Functional but dated or lacking (e.g., original 1980s kitchen, small yard, long commute, 3/10 schools).
- 41-59: NEUTRAL / AVERAGE / MISSING DATA. Standard builder grade, typical condition. **If there is NO data, default to exactly 50.**
- 60-79: GOOD / ABOVE AVERAGE. Attractive features, solid condition, nice area (e.g., move-in ready, updated 5 years ago, nice curb appeal).
- 80-92: EXCELLENT. Highly desirable, premium features (e.g., brand new chef's kitchen, top 9/10 schools, large private lot).
- 93-100: EXCEPTIONAL. Best-in-class, luxury, or perfection in this category (e.g., custom high-end remodel, 10/10 schools + walking distance).

### SUMMARY GUIDELINES (DO NOT LOSE DETAILS)
The summary must be dense with specific facts. DO NOT write generic fluff like "The home has nice updates." 
INSTEAD, pull the specific tags from the granular factors: "Renovated in 2023 with quartz counters, a new roof, and updated HVAC."
Preserve specific numbers, materials, and measurements where they add value. If there's no data, just say "No data available."

### THE 16 DIMENSIONS & SCORING RULES
1. valueAndCost: Value & Cost to Own. Score drops for high HOA, high taxes. Score rises for no HOA, below-market price, strong appreciation.
2. incomePotential: Score rises for ADUs, permitted STRs, high cap rates. Score drops for strict rental restrictions.
3. marketLeverage: Score rises for high days-on-market, motivated seller, distress signals (buyer has leverage). Score drops for hot market/multiple offers.
4. turnkeyVsProject: Score 90+ for new construction/full remodel. Score 20 for fixer-upper/TLC needed.
5. aestheticsAndVibe: Score 80+ for abundant natural light, sunset porches, cohesive design, architectural charm.
6. kitchenAndBaths: Score 90+ for high-end appliances, quartz/marble, soaking tubs, recent remodels.
7. spaceAndLayout: Score rises for high/vaulted ceilings, open concept for hosting, split bedrooms. Drops for cramped/awkward flow.
8. systemsAndEco: Score rises for new roof, new HVAC, solar panels, EV charging, sustainable architecture. Drops for aging systems.
9. yardAndOutdoor: Score 80+ for large fenced yard, pet-friendly spaces, pool, outdoor kitchen. Drops for zero lot line or no yard.
10. lotSettingAndPrivacy: Score 90+ for cul-de-sac, views, zero rear neighbors, quiet street. Drops for busy street, road noise, zero privacy.
11. walkabilityAndVibe: Score 80+ for walkable cafes, sidewalks, near parks. Drops for car-dependent locations.
12. commuteAndWfh: Score 80+ for dedicated/closed-door home office, gigabit fiber, near highway or BART/transit. 
13. familyAndSchools: Score 90+ for 8-10/10 schools, near family parks, safe play areas. 
14. multiGenAndAging: Score rises heavily for single-story living (no stairs), downstairs primary suite, in-law/multi-gen setups, elevator. (Default 50 if none).
15. neighborhoodQuality: Score 80+ for safety, pride of ownership, well-maintained streets. Drops for visual clutter, unsafe areas.
16. climateAndGeoRisks: Score rises for low risk. Score drops for high wildfire risk, flood zones, fault lines.

Return the output as a JSON object where the keys are exactly as named above.
    `;
};

export const buyerDnaCompressionSchema = {
    type: Type.OBJECT,
    properties: {
        valueAndCost: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        incomePotential: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        marketLeverage: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        turnkeyVsProject: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        aestheticsAndVibe: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        kitchenAndBaths: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        spaceAndLayout: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        systemsAndEco: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        yardAndOutdoor: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        lotSettingAndPrivacy: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        walkabilityAndVibe: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        commuteAndWfh: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        familyAndSchools: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        multiGenAndAging: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        neighborhoodQuality: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] },
        climateAndGeoRisks: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, summary: { type: Type.STRING } }, required: ["score", "summary"] }
    },
    required: [
        "valueAndCost", "incomePotential", "marketLeverage", "turnkeyVsProject", "aestheticsAndVibe",
        "kitchenAndBaths", "spaceAndLayout", "systemsAndEco", "yardAndOutdoor", "lotSettingAndPrivacy",
        "walkabilityAndVibe", "commuteAndWfh", "familyAndSchools", "multiGenAndAging", "neighborhoodQuality",
        "climateAndGeoRisks"
    ]
};
