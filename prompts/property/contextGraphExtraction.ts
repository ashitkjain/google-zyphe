/**
 * Context Graph Factor Extraction Prompt
 * 
 * Sends optimized property data to Gemini and extracts the 88 decision factors
 * that power the buyer context graph.
 */

import { Type } from "@google/genai";
import {
    PropertyData,
    CustomAIAnalysisResult,
    ComprehensiveAnalysisResult,
    ContextGraphExtractionResult,
    ExtractedFactor
} from "../../types";
import { optimizePropertyForAi, optimizeVisualForAi } from "../../utils/aiOptimization";
import { DISTRESS_MARKERS } from "./distressAnalysis";

// ── Build context specifically for graph extraction ──────

export const buildGraphExtractionContext = (
    property: PropertyData,
    visual: CustomAIAnalysisResult | null,
    comprehensive: ComprehensiveAnalysisResult | null
) => {
    const optimizedProperty = optimizePropertyForAi(property);

    // Strip noise from visual: no image-by-image, no image quality, no web sources
    // Also strip city-level data (deep_investment_research, community_pulse, etc.)
    // — these are now extracted once per city via city_context_graph
    let optimizedVisual: any = null;
    if (visual) {
        const {
            image_by_image_analysis,
            image_quality_analysis,
            ...kept
        } = visual;
        optimizedVisual = kept;
    }

    // Comprehensive narrative (slim version)
    const narrative = comprehensive ? {
        summary: comprehensive.summary,
        detailedAnalysis: comprehensive.detailed_analysis,
        strategicInsights: comprehensive.strategic_insights,
        risksAndConsiderations: comprehensive.risks_considerations,
    } : null;

    // Parcel Validation — measured slope, ArcGIS lot, validation flags
    const parcelValidation = (property as any).parcelValidation ? {
        slopePercent: (property as any).parcelValidation.slopePercent,
        slopeCategory: (property as any).parcelValidation.slopeCategory,
        uphillDir: (property as any).parcelValidation.uphillDir,
        flags: ((property as any).parcelValidation.flags ?? []).map((f: any) => ({
            check: f.check, severity: f.severity, finding: f.finding,
        })),
    } : null;

    // Measured parcel data from ArcGIS (root-level fields)
    const parcelData = (property as any).parcelAreaSqft ? {
        arcgisAreaSqft: (property as any).parcelAreaSqft,
        parcelApn: (property as any).parcelApn,
        parcelCounty: (property as any).parcelCounty,
    } : null;

    // Orientation from satellite AI analysis
    const orientationAI = (property as any).orientation_ai ? {
        final_orientation: (property as any).orientation_ai.final_orientation,
        azimuth_degrees: (property as any).orientation_ai.azimuth_degrees,

        feng_shui_vastu: (property as any).orientation_ai.feng_shui_vastu,
        buyer_pro: (property as any).orientation_ai.buyer_pro,
        buyer_con: (property as any).orientation_ai.buyer_con,
    } : null;

    // Tax sqft (from ArcGIS or Gemini lookup)
    const taxSqft = (property as any).taxSqft ?? null;

    const result = {
        listingDescription: property.description,
        property: optimizedProperty,
        schools: property.schools?.map(s => ({ name: s.name, rating: s.rating, distance: s.distance, level: s.level })),
        visualAnalysis: optimizedVisual,
        narrativeReport: narrative,
        parcelValidation,
        parcelData,
        orientationAI,
        taxSqft,
    };

    // Diagnostic: log section sizes to identify bloat
    const sectionSizes: Record<string, number> = {};
    for (const [key, val] of Object.entries(result)) {
        sectionSizes[key] = val ? JSON.stringify(val).length : 0;
    }
    const totalChars = Object.values(sectionSizes).reduce((a, b) => a + b, 0);
    console.log(`[Context Graph] Section sizes (~${Math.round(totalChars / 4000)}K tokens total):`,
        Object.entries(sectionSizes)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([k, v]) => `${k}: ${Math.round(v / 1000)}K chars (~${Math.round(v / 4000)}K tok)`)
            .join(' | ')
    );

    // If property is big, log its sub-sections
    if (sectionSizes.property > 100000) {
        const propSubs: Record<string, number> = {};
        for (const [key, val] of Object.entries(optimizedProperty)) {
            propSubs[key] = val ? JSON.stringify(val).length : 0;
        }
        console.log(`[Context Graph] Property sub-sections (top 15):`,
            Object.entries(propSubs)
                .filter(([, v]) => v > 500)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([k, v]) => `${k}: ${Math.round(v / 1000)}K`)
                .join(' | ')
        );
    }

    // If visual is big, log its sub-sections
    if (optimizedVisual && sectionSizes.visualAnalysis > 100000) {
        const visSubs: Record<string, number> = {};
        for (const [key, val] of Object.entries(optimizedVisual)) {
            visSubs[key] = val ? JSON.stringify(val).length : 0;
        }
        console.log(`[Context Graph] Visual sub-sections:`,
            Object.entries(visSubs)
                .filter(([, v]) => v > 1000)
                .sort(([, a], [, b]) => b - a)
                .map(([k, v]) => `${k}: ${Math.round(v / 1000)}K`)
                .join(' | ')
        );
    }

    return result;
};

// ── Prompt ─────────────────────────────────────────────────

export const getContextGraphExtractionPrompt = (context: any, skipIds: number[] = []) => {
    const skipNote = skipIds.length > 0
        ? `\nNOTE: Factors ${skipIds.join(', ')} have already been computed from structured data. SKIP these IDs entirely — do NOT include them in your response. Only return factors NOT in this list.\n`
        : '';

    return `
You are a real estate data analyst. These factors will be used for SEMANTIC BUYER MATCHING — a buyer
describes what they want in natural language, and Gemini (an LLM) matches their story against these tags
to score and rank properties. Tags must therefore read as natural, self-contained property attributes
that an LLM can reliably map to buyer requirements like "I need a home office", "top-rated schools",
or "south-facing backyard for my vegetable garden".
${skipNote}
Given the property data below, extract structured decision factors. For each factor, return:
- The factor ID (no name needed)
- Value: A concise, 1-2 sentence human-readable summary of the factor's state for this specific property (e.g., "Recently renovated with modern quartz counters and hardwood floors. Features high-end stainless steel appliances.")
- Tags: 2-6 labels, each exactly 2-5 words. Every tag must be:
  (a) SELF-CONTAINED — meaningful without reading other tags or the factor name
  (b) SPECIFIC — include qualifiers, locations, materials, measurements
  (c) SEARCH-READY — phrased as a natural property attribute a buyer would describe
  (d) NON-REDUNDANT — no two tags in the same factor should overlap in meaning

  GOOD tags: ["Ground floor home office", "Dedicated WFH den", "Fiber internet available"]
  BAD tags: ["Office", "Work from home"] ← 1 word; redundant pair (same idea twice)

  GOOD tags: ["South-facing skylights", "Floor-to-ceiling windows", "All-day natural light"]
  BAD tags: ["Natural Light", "Bright home"] ← restates factor name; vague duplicate

  GOOD tags: ["Hardwood floors main level", "Tile in all bathrooms", "Carpet in bedrooms"]
  BAD tags: ["Hardwood", "Nice floors"] ← too short; generic

  GOOD tags: ["Move-in ready condition", "Recently renovated kitchen", "Fresh interior paint"]
  BAD tags: ["Turn-key", "Move-in ready"] ← redundant pair saying same thing

- BREVITY IS CRITICAL. No filler. Only return factors with meaningful data.

## FACTOR DEFINITIONS

### Financial & Market (1-10)
1. **Price Bracket**: Determine if property is "Entry-Level", "Mid-Range", or "Luxury" based on price ($).
2. **HOA Friction**: Determine if HOA is "High", "Low", or "No HOA". Tag with monthly fee if found.
3. **Property Tax**: Estimated tax rate or annual amount.
4. **Estimated Carrying Cost**: Total monthly cost (Mortgage + Tax + HOA + Ins) as a single tag (e.g. ~$8K/mo).
5. **Seller Motivation**: Look for "motivated", "price cut", "back on market", or high days on market (DOM).
6. **ADU / House-Hacking Potential**: Look for "ADU", "Guest House", "In-law suite", "Basement apartment", "Zoned for 2 units", "R-2", "Duplex potential", "Full bath in basement", "Second kitchen", "Large lot with side access" in listingDescription OR visualAnalysis.deep_investment_research. If the lot is >8000 sqft and zoning allows, tag as "High Potential".
7. **STR Viability**: Analyze visualAnalysis.property_investment. Tags = "High Yield", "Strict HOA", "Zoned STR", "Primary Residence Only", "Seasonal Demand".
8. **LTR Yield Potential**: Tags = "Cap Rate > 5%", "Cash Flow Positive", "Turnkey Rental". Value = Monthly rent estimate from visualAnalysis.property_investment or property.rentZestimate.
9. **Appreciation Signal (City)**: From visualAnalysis.general_market_intelligence. Tags = "Historical 5%+", "New Dev Nearby", "Supply Constrained".
10. **Market Momentum**: Identify if area is "Rising" or "Stable" from visualAnalysis.general_market_intelligence. Value = 1-sentence trend.

### Structural & Size (11-20)
11. **Primary Bedroom Location**: "Ground Floor" vs "Upper Level".
12. **Lot Size / Utility**: Usable yard space vs steep/oversized lots.
13. **Parking Capacity**: Total spaces (Driveway + Street).
14. **Usable Square Footage**: Categorize as "Compact", "Mid-Size", "Spacious", or "Estate".
15. **Ceiling Height**: "High", "Vaulted", or "Standard".
16. **Single-Story Flow**: One floor vs multi-story.
17. **Dedicated Home Office**: Look for "Den", "Office", "Library", or "Study" in roomTypes or description.
18. **Garage Capacity**: "2-Car Garage", "Attached", "Detached", etc.
19. **Foundation & Storage**: Basement, Crawl Space, or Slab — use resoFacts. Just use the type as a tag (e.g. "Slab").
20. **Construction Era**: "Pre-War", "Mid-Century", "80s-90s", "New Build".

### Interior Design & Visual (21-30)
21. **Move-In Readiness**: "Turn-key" if renovated/new/updated, "Mint" if well-maintained, "Needs Work" if TLC/Fixer mentioned. From listingDescription or resoFacts.propertyCondition or visualAnalysis.condition_and_finish or room_highlights.
22. **Renovation Upside**: High if condition is "Needs cosmetic updates" but structural era is good.
23. **Architecture**: Mediterranean, Craftsman, Modern, Tudor, etc. (from visualAnalysis or architecturalStyle). Use only the specific style names as tags (e.g. "Modern", "Tudor") and do NOT include the word "Style" unless it is part of a standard name.
24. **Natural Light / Brightness**: From visualAnalysis.interior_analysis or listingDescription ("Skylights", "Large windows", "South facing").
25. **Open-Concept Flow**: Check if "Open concept" or "Vaulted" or "Great room" mentioned in visualAnalysis.interior_analysis or listingDescription or room_highlights.
26. **Kitchen Profile**: Combines caliber ("Chef's") with materials ("Quartz counters"). From visualAnalysis.room_highlights or listingDescription.
27. **Bathroom Profile**: Luxury finishes ("Soaking tub"). From visualAnalysis.room_highlights or listingDescription.
28. **Flooring Material**: Hardwood, Carpet, Tile, etc. From visualAnalysis.interior_analysis or listingDescription or property.resoFacts.flooring.
29. **Ceiling Volume**: "High/Vaulted" if mentioned in listingDescription or visualAnalysis.interior_analysis.
30. **Interior Finishes**: Wall colors, Trim, Shutters. From visualAnalysis.condition_and_finish or listingDescription.

### Outdoor & Lot (31-40)
31. **Fenced Yard**: Check resoFacts.fencing or backyard_and_patio analysis.
32. **Outdoor Entertainment**: Look for "Pool", "Spa", "Patio", "Deck", "Outdoor Kitchen" in exterior analysis or description.
33. **Privacy Level**: From lot layout and neighbor proximity.
34. **Curb Appeal**: Synthesize from streetViewAnalysis, visual analysis exterior_and_lot_appeal, and listing description. Value = overall rating (e.g. "Excellent — 9/10", "Good — 7/10", "Average — 5/10"). Tags = descriptive concepts like "Well-Maintained", "Mature Landscaping", "Fresh Paint", "Dated Exterior", "Overgrown", "Attractive Entry". Generate 3-6 tags.
35. **Topography**: "Flat" vs "Hillside" from neighborhood analysis or description.
36. **View Quality**: Hills, City Lights, Water, or None.
37. **Street Noise / Traffic**: "Quiet" if Cul-de-sac, "Moderate" if through street, "High" if arterial.
38. **Visual Clutter**: Overhead wires, messy neighbors, or busy streetscape (from streetViewAnalysis).
39. **Yard Space**: "Large Backyard", "Courtyard", "Zero Lot Line".
40. **Xeriscape / Low Maintenance**: Drought-tolerant or synthetic turf mentioned.

### Location & Community (41-45)
41. **Exterior Finish**: Identify siding type (Stucco, Wood, Brick, Vinyl).
42. **Commute Convenience**: Proximity to highways or transit hubs mentioned in neighborhood description.
43. **Walkability**: Mention ped-friendly features or proximity to shops/dining.
44. **Greenery Proximity**: "Park adjacent" or "Near trails" from neighborhood features.
45. **Sidewalk Continuity**: Presence of sidewalks and overall street safety vibe.

### Environmental & Efficiency (46-50)
46. **Wildfire Risk**: Determine if "High Risk" or "Urban Safety Zone".
47. **Flood Risk**: Check for "Flood zone" or "Near creek".
48. **Solar Potential / Efficiency**: Look for panels or "Southern exposure".
49. **Pollen & Allergy Profile**: High if "Mature pines/oaks" mentioned.
50. **HVAC Quality**: "Central Air", "Split system", or "No AC".

### Advanced Intelligence (51-70)
51. **Front Orientation / Vastu**: Facing direction + favorability (e.g. "East-Facing morning sun").
52. **Air Quality Profile**: "Clean Air Zone" vs "Near Industrial/Freeway".
53. **Neighborhood Ranking**: General placement in local market (e.g. "Premier Enclave", "Established Neighborhood").
54. **Topography & Elevation**: Slope % + Backyard facing direction.
55. **Transit Accessibility**: "Walk to Rail", "Bus Nearby", or "Car-Dependent".
56. **Commute Difficulty**: "Quick Highway Access" vs "Local Traffic Bottlenecks".
57. **Work-From-Home Score**: Dedicated office + Fiber/High-speed internet mentions.
58. **Multi-Gen Utility**: Downstairs Bed/Bath or separate entry for in-laws.
59. **Laundry Logistics**: "Inside Laundry Room", "Hookups Only", or "Garage Shared".
60. **Water / Air Systems**: Softeners, RO filters, or Zoned HVAC mentioned.
61. **Security Infrastructure**: Gated, Security system, or Cameras.
65. **Development Impact**: Nearby construction, new developments, or zoning changes.
67. **Luxury Finish Level**: High-end details like crown molding, wide plank floors, designer fixtures.
68. **Backyard Potential**: Room for ADU or pool if not already present.
70. **Market Velocity**: How fast homes are selling in this specific micro-market.

### Community & Market Intelligence (71-75)
71. **Development Status**: Assessment of area maturity (Established vs Developing).
72. **Community Complaints**: Note common gripes (parking, noise, litter) if mentioned.
73. **Community Satisfaction**: Positive vibes, friendly neighbors, or cohesive community.
74. **Neighborhood Safety**: Perceived safety from lighting, condition, and security.
75. **Market Signals**: Buy/Sell volume and specific local catalysts.

### Infrastructure & Environment (76-79)
76. **Internet Connectivity**: Mentions of Fiber, Giga-speed, or dead zones.
77. **Noise Pollution**: Traffic, plane, or construction noise notes.
78. **Drought Resistance**: Low-water landscaping or efficient irrigation.
79. **Disaster Resilience**: Fire-resistant siding, seismic retrofitting, or flood prep.


### Neighborhood & Amenities (83-88)
83. **Social Fabric**: Demographic vibe (Professionals, Families, Retirees).
84. **Walkable Amenities**: Specific nearby cafes, parks, or shops.
85. **Medical Proximity**: Nearby hospitals or specialist centers.
86. **EV Infrastructure**: Presence of chargers or suitability for installation.
88. **Dining & Entertainment Scene**: From google_places.walkable.dining — count, average rating, and variety. \"Vibrant\" if 5+ walkable with avg 4.0+ rating. \"Sparse\" if car required.

### Investment Intelligence (89-93)
89. **Market Indicators**: Buy/Sell volume and supply/demand signals.
90. **Growth Catalysts**: New businesses, transit lines, or developments.
91. **Investment Risk**: Identify specific property or neighborhood risks.
92. **Market Friction**: Zoning issues, inventory shortages, or legal hurdles.
93. **Zoning**: Development constraints and allowed usage.

### Street View Intelligence (94-98) — Tags are the primary output. Generate 3-8 concept tags per factor from streetViewAnalysis data.
94. **Street Character**: From streetViewAnalysis.neighborhoodVibe + safetyAssessment + familySafety. Tags = street concepts like "Tree-Lined Street", "Quiet Cul-de-sac", "Well-Lit", "Wide Streets", "Speed Bumps", "Dead End". Value = overall street character.
95. **Curbside Risks**: From streetViewAnalysis.maintenanceRisks. Tags = visible risk concepts like "Aging Roof Shingles", "Cracked Driveway", "Peeling Paint", "Dated Facade", "Missing Gutters". Value = risk severity (None/Minor/Moderate/Major).
96. **Landscaping Profile**: From streetViewAnalysis.gardenDescription. Tags = landscaping concepts like "Mature Oaks", "Drought-Tolerant", "Stone Pathway", "Manicured Lawn", "Rose Garden", "Native Plants". Value = landscaping quality.
97. **Parking Setup**: From streetViewAnalysis.parkingLogistics. Tags = parking concepts like "2-Car Garage", "Wide Driveway", "Street Parking", "RV Parking", "Circular Drive". Value = parking summary.
98. **Neighborhood Condition**: From streetViewAnalysis.neighborCondition. Tags = neighborhood concepts like "Well-Maintained Neighborhood", "Consistent Style", "Tidy Yards", "Fresh Paint", "Mixed Condition". Value = condition assessment.

### Agent Description Concepts (100)
100. **Agent Highlights**: Deep-mine property.description (MLS listing) for ALL buyer-relevant details. Extract:
  - **Recent upgrades** with specifics: "New Roof 2023", "Kitchen Remodel $80K", "Tankless Water Heater", "Dual-Pane Windows"
  - **Unique features** not captured by other factors: "Wine Cellar", "Tesla Charger", "Whole-House Fan", "Water Softener", "Built-In Speakers", "Smart Home System"
  - **Lot & location gems**: "Corner Lot", "No Rear Neighbors", "Greenbelt Adjacent", "Cul-de-sac", "Flag Lot"
  - **Income/ADU potential**: "ADU Permitted", "Separate Entrance", "Casita", "Home Office Suite", "Permitted Addition"
  - **Seller signals**: "Motivated Seller", "Estate Sale", "Relocating", "Price Reduced", "Bring All Offers"
  - **Lifestyle cues**: "Entertainer's Backyard", "Chef's Kitchen", "Resort-Style Pool", "Indoor-Outdoor Living"
  - **Red flags in agent language**: "As-Is", "Investor Special", "Needs TLC", "Deferred Maintenance", "Cash Only"
  Value = single most impactful highlight. Generate 15-25 tags — be thorough, this is the richest text source.

### School Intelligence (101)
101. **School Concepts**: From the provided 'schools' array. For each school, generate tags with name + rating (e.g. "Amador Valley 10/10"). Include "Desirable School Zone" if ratings are 8+, and proximity tags ("Walking Distance", "Under 1mi"). Value = Overall district quality + top school name. Generate 5-12 tags.

### Community Sentiment & Condition (102-105) — Tags are the primary output. Generate 3-8 concept tags.
102. **Sentiment Analysis**: Buzz and perceived value from community reports.
103. **Market Narrative**: Local news and community pulse on real estate trends.
104. **Condition & Renovation Concepts**: From visual analysis condition_and_finish + room_highlights potential_improvements. Tags = condition concepts like "Needs Kitchen Update", "New Roof", "Original Hardwood", "Remodeled Bathrooms", "Dated HVAC". Value = overall condition.
105. **Lifestyle Convenience Concepts**: From google_places + walkScore + community_pulse. Tags = convenience concepts like "Walkable Dining", "Near BART", "Great Dog Parks", "Close to Costco", "Farmer's Market". Value = top convenience.

### Distressed & Opportunity Signals (111)
111. **Distressed Sale Signal**: Scan property.description for explicit distress markers.
   - Tags = return ONLY the markers semantically identified from this list: [${DISTRESS_MARKERS.join(", ")}].
   - Search for both literal keyword matches and semantic equivalents (e.g. "needs massive repair" = "Fixer-Upper", "bank owned" = "Bank-owned").
   - If none are found, tags MUST be [].
   - Value = "true" if any distress signals are present, "false" if none are found.

### Interior Room Intelligence (113-116) — From visualAnalysis room_highlights. Tags are the primary output.
113. **Room-by-Room Character**: For EACH room found in room_highlights, generate 2-3 descriptive concept tags prefixed with the room name (e.g. "Kitchen: Updated Cabinets", "Living Room: Brick Fireplace", "Primary Bed: Walk-In Closet", "Laundry: Full-Size W/D"). Scan ALL rooms — do not skip any. Do NOT repeat the same feature across multiple rooms (e.g. if "Vinyl Flooring" appears in every room, tag it once under the first room or under factor 115 instead). Focus on features that matter to buyers: storage, natural light, updates vs dated, special fixtures, layout flow, outdoor access, and standout details. Value = number of rooms detected + overall impression (e.g. "9 rooms — cohesive modern updates"). Generate 8-20 tags total depending on how many rooms exist.
114. **Interior Vibe & Quality**: Synthesize across ALL room_highlights + condition_and_finish + design overview. Value = a single-sentence interior vibe statement (e.g. "Clean transitional style with neutral tones and modern updates throughout" or "Classic suburban home with original finishes showing their age"). Tags = quality + style concepts like "Turn-Key", "Recently Updated", "Neutral Palette", "Cohesive Design", "Mixed Quality", "Transitional Style", "Modern Finishes", "Move-In Ready". Generate 5-10 tags.
115. **Flooring & Materials Palette**: From room_highlights + condition_and_finish. Tags = material concepts found across the home like "Vinyl Plank", "Hardwood", "Tile", "Carpet", "Granite Counters", "Wood Cabinets", "Stainless Steel", "Marble". Value = dominant flooring type. Generate 4-8 tags.
116. **Spatial Flow & Layout**: From room_highlights + spatial descriptions. Tags = layout concepts like "Open Floor Plan", "Split Bedrooms", "Indoor-Outdoor Flow", "Single Story", "Two-Story", "Formal Dining Separate", "Kitchen Open to Living", "Jack-and-Jill Bath", "En-Suite Primary". Value = layout summary. Generate 4-8 tags.

108. **Sqft Discrepancy**: Compare 'taxSqft' field vs 'property.livingAreaValue'. If diff > 100, tag as "Discrepancy: [X] sqft". Also look for "Addition not permitted" or "Buyer to verify sqft" in listingDescription.
109. **Lot Boundary Verification**: Check listingDescription for "Encroachments", "Easements", "Fenced past property line", or "Shared driveway". Value = status of boundaries.
110. **Zoning Flexibility**: Look for "ADU allowed", "R-2", "Multi-unit potential", "Lot can be split". Tag as "High Flexibility" if lot is large.

### Location Logistics (120-122)
120. **Nearby Places Profile**: Highlight specific key brands nearby (Costco, Target, Starbucks).
121. **Microclimate Profile**: "Fog belt", "Sun-drenched", or "Windy ridge" details.
122. **Demographic Snapshot**: Wealth, education, or age trends in the immediate tract.

## PROPERTY DATA

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

## OUTPUT FORMAT

Return a JSON object with this structure:
{
  "address": "full address",
  "factors": [
    {
      "id": 23,
      "value": "Modern architectural style with floor-to-ceiling glass and a flat roof design. The exterior features a mix of cedar siding and concrete panels.",
      "tags": ["Modern flat roof", "Floor-to-ceiling glass", "Minimalist exterior"]
    },
    ...
  ],
  "summary": {
    "topStrengths": ["Top 3-5 property strengths as buyer-facing phrases"],
    "topConcerns": ["Top 3-5 concerns or risks"],
    "propertyHighlight": "1-2 sentence summary of what this property is best suited for based on its features — e.g. 'Move-in ready with top-rated schools within walking distance and a spacious backyard'. Focus on PROPERTY attributes only. Do NOT describe or profile potential buyers."
  }
}

CRITICAL RULES:
- Extract ALL non-skipped factors. If NO information is found for a factor (total absence of data), return tags: [] (empty array). Do NOT use any filler text like "Data Not Available".
- Tags are the ONLY output per factor — all context must live in the tags themselves
- Each tag must be 2-5 words. Single-word tags are FORBIDDEN — they are too ambiguous for semantic matching
- No two tags within the same factor may overlap in meaning or say the same thing differently
- Generate 2-6 tags per factor. For factors 89-105, generate 4-8 rich concept tags
- Embed actual numbers directly in tags: "85 walk score", "$450/mo HOA", "6% LTR yield", "2-car attached garage"
- Write tags as natural property attributes a buyer would say, not internal classifications
- The summary should synthesize the factors into actionable buyer intelligence
`;
};
// ── Response Schema ───────────────────────────────────────

const factorSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.NUMBER, description: "Factor ID" },
        value: { type: Type.STRING, description: "Exactly one human-readable sentence summarizing the factor." },
        tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-6 semantic matching tags, each 2-5 words. Self-contained, non-redundant, search-ready natural language phrases."
        }
    },
    required: ["id", "value", "tags"]
};

const summarySchema = {
    type: Type.OBJECT,
    properties: {
        topStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        topConcerns: { type: Type.ARRAY, items: { type: Type.STRING } },
        propertyHighlight: { type: Type.STRING, description: "Property-focused summary of standout features and use cases. Do NOT describe or profile potential buyers." }
    },
    required: ["topStrengths", "topConcerns", "propertyHighlight"]
};

export const contextGraphExtractionSchema = {
    type: Type.OBJECT,
    properties: {
        address: { type: Type.STRING },
        factors: { type: Type.ARRAY, items: factorSchema },
        summary: summarySchema
    },
    required: ["address", "factors", "summary"]
};

