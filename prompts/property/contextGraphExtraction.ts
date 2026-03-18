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

// ── Build context specifically for graph extraction ──────

export const buildGraphExtractionContext = (
    property: PropertyData,
    visual: CustomAIAnalysisResult | null,
    comprehensive: ComprehensiveAnalysisResult | null
) => {
    const optimizedProperty = optimizePropertyForAi(property);

    // Strip noise from visual: no image-by-image, no image quality, no web sources
    let optimizedVisual: any = null;
    if (visual) {
        // Strip general_market_intelligence — all market data now comes from deep_investment_research
        const { image_by_image_analysis, image_quality_analysis, general_market_intelligence, ...kept } = visual;
        // Remove sources / citations from nested research objects
        if (kept.deep_investment_research) {
            delete (kept.deep_investment_research as any).citations;
            delete (kept.deep_investment_research as any).web_sources;
        }
        // Remove community_pulse sources to save tokens (just keep summaries/points)
        if (kept.community_pulse) {
            for (const section of Object.values(kept.community_pulse)) {
                if (section && typeof section === 'object' && 'sources' in section) {
                    delete (section as any).sources;
                }
            }
        }
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

    return {
        property: optimizedProperty,
        visualAnalysis: optimizedVisual,
        narrativeReport: narrative,
        parcelValidation,
        parcelData,
        orientationAI,
        taxSqft,
    };
};

// ── Prompt ─────────────────────────────────────────────────

export const getContextGraphExtractionPrompt = (context: any, skipIds: number[] = []) => {
    const skipNote = skipIds.length > 0
        ? `\nNOTE: Factors ${skipIds.join(', ')} have already been computed from structured data. SKIP these IDs entirely — do NOT include them in your response. Only return factors NOT in this list.\n`
        : '';

    return `
You are a real estate data analyst. Your task is to extract structured decision factors from property data.
${skipNote}
Given the property data below, extract values for the required decision factors. For each factor, return:
- The factor ID
- A concise value (maximum 10 words — use fragments, numbers, and labels, not full sentences)


- Tags: short labels (1-3 words each) suitable for graph nodes. For factors 89-105, tags are the PRIMARY output — generate 3-8 concept tags per factor.

## FACTOR DEFINITIONS

### Financial & Market (1-10)
1. SKIP (precomputed).
2. SKIP (precomputed).
3. SKIP (precomputed).
4. SKIP (precomputed).
5. SKIP (precomputed).
6. **ADU / House-Hacking Potential**: Look for "guest house", "basement", "separate entrance", "ADU", or "cottage" in description OR deep_research.
7. SKIP (precomputed).
8. SKIP (precomputed).
9. **Historical Appreciation**: From deep_investment_research.macroeconomic_indicators and market_dynamics (look for YoY/5yr appreciation trend, price growth data). Fallback to general_market_intelligence.market_dynamics.historical_appreciation.
10. SKIP (precomputed).

### Structural & Size (11-20)
11. SKIP (precomputed).
12. SKIP (precomputed).
13. SKIP (precomputed).
14. SKIP (precomputed).
15. SKIP (precomputed).
16. SKIP (precomputed).
17. **Dedicated Home Office**: Look for "Den", "Office", "Library", or "Study" in roomTypes or description.
18. SKIP (precomputed).
19. **Foundation & Storage**: Basement, Crawl Space, or Slab — use resoFacts.
20. SKIP (precomputed).

### Interior Design & Visual (21-30)
21. **Move-In Readiness**: "Turn-key" if renovated/new, "Mint" if well-maintained, "Needs Work" if TLC/Fixer mentioned.
22. **Renovation Upside**: High if condition is "Needs cosmetic updates" but structural era is good.
23. **Architectural Style**: Mediterranean, Craftsman, Modern, etc. (from visualAnalysis or architecturalStyle).
24. **Natural Light / Brightness**: From lighting description. If missing, look for "Skylights", "Large windows", "South facing" in description.
25. **Open-Concept Flow**: Check if "Open concept" or "Vaulted" mentioned in interior analysis or description.
26. **Kitchen Profile**: Combines caliber ("Chef's", "Standard") with specific materials ("Wood cabinets", "Quartz counters", "Gas range"). From visualAnalysis.
27. **Bathroom Profile**: Combines luxury ("Spa-like") with specific finishes ("Tile floors", "Wood vanities", "Soaking tub").
28. SKIP (precomputed).
29. **Ceiling Volume**: "High/Vaulted" if mentioned in description or spatial_flow.
30. **Interior Finishes**: Wall colors ("Neutral", "Warm"), Trim ("Crown molding"), and Window treatments ("Shutters", "Blinds").

### Outdoor & Lot (31-40)
31. **Fenced Yard**: Check resoFacts.fencing or backyard_and_patio analysis.
32. **Outdoor Entertainment**: Look for "Pool", "Spa", "Patio", "Deck", "Outdoor Kitchen" in exterior analysis or description.
33. SKIP (precomputed).
34. **Curb Appeal**: Synthesize from streetViewAnalysis, visual analysis exterior_and_lot_appeal, and listing description. Value = overall rating (e.g. "Excellent — 9/10", "Good — 7/10", "Average — 5/10"). Tags = descriptive concepts like "Well-Maintained", "Mature Landscaping", "Fresh Paint", "Dated Exterior", "Overgrown", "Attractive Entry". Generate 3-6 tags.
35. **Topography**: "Flat" vs "Hillside" from neighborhood analysis or description.
36. **View Quality**: Hills, City Lights, Water, or None.
37. **Street Noise / Traffic**: "Quiet" if Cul-de-sac, "Moderate" if through street, "High" if arterial.
38. **Visual Clutter**: Overhead wires, messy neighbors, or busy streetscape (from streetViewAnalysis).
39. SKIP (precomputed).
40. **Xeriscape / Low Maintenance**: Drought-tolerant or synthetic turf mentioned.

### Location & Community (41-45)
41. **Exterior Style & Architecture**: From visual analysis exterior_and_lot_appeal. Tags = architecture style (e.g. "Craftsman", "Ranch", "Mediterranean", "Colonial"), exterior materials ("Stucco", "Brick", "Wood Siding"), and notable curb features ("Mature Landscaping", "Inviting Entry", "New Roof", "Fresh Paint"). Value = architecture style + overall impression. Generate 3-8 tags.
42. **Commute Convenience**: Proximity to highways or transit hubs mentioned in neighborhood description.
43. SKIP (precomputed).
44. **Greenery Proximity**: "Park adjacent" or "Near trails" from neighborhood features.
45. **Sidewalk Continuity**: From streetViewAnalysis.familySafety or pedestrian_infra.

### Environmental (46-50)
46. SKIP (precomputed).
47. SKIP (precomputed).
48. SKIP (precomputed).
49. SKIP (precomputed).
50. SKIP (precomputed).

### Advanced Intelligence (51-70)
51. **Front Orientation / Vastu**: From orientation_ai data. Value = facing direction + buyer pro/con (e.g. "East-Facing — morning sun, favorable Vastu"). Tags = direction tag ("East-Facing"), favorability ("Favorable Orientation"), and Vastu/Feng Shui note if relevant. If orientation_ai is not available, return "Data not available". Generate 2-4 tags.
52. SKIP (precomputed).
53. SKIP (precomputed).
54. **Topography & Elevation**: From parcelValidation slope data. Value = slope % + category + uphill direction + backyard facing (e.g. "8% slope (Moderate), uphill NE, backyard faces SW"). Tags = slope category, flat/steep indicators, south-facing backyard if applicable. If no slope data, return "Data not available". Generate 2-4 tags.
55. SKIP (precomputed).
56. SKIP (precomputed).
57. **Work-From-Home Score**: Dedicated office + Fiber/High-speed internet mentions.
58. **Multi-Gen Utility**: Downstairs Bed/Bath or separate entry for in-laws. If home is single-story (no stairs, resoFacts says Single Story, or all rooms on Floor 1), add "Single-Story Living" as a tag.
59. SKIP (precomputed).
60. **Water / Air Systems**: Softeners, RO filters, or Zoned HVAC mentioned.
61. **Security Infrastructure**: Gated, Security system, or Cameras.
62. **Digital Presentation**: Quality of staging and photos (find "Hidden Gems").
63. **Solar ROI Obstructors**: Large trees or neighbors blocking roof sunshine.
64. **Job Hub Connectivity**: Proximity to major corporate campuses (Google, Apple, etc.).
65. **Upcoming Dev Impact**: From deep_investment_research.investment_outlook.long_term and local_risks — look for mentions of new construction, transit projects, or commercial development nearby. Fallback to general_market_intelligence.regulatory_and_growth.upcoming_developments.
66. **Soil / Geo Consistency**: Soil type or liquefaction risk from deep_research.
67. **Luxury Finish Level**: High-end details like crown molding, wide plank floors, designer fixtures.
68. **Backyard Potential**: Room for ADU or pool if not already present.
69. **Streetscape Aesthetic**: Underground utilities vs overhead wires.
70. **Market Momentum**: From deep_investment_research.market_dynamics and macroeconomic_indicators. CRITICAL: Do NOT label as "Seller's Market" based on low inventory alone — you MUST cross-reference median Days on Market (DOM). Low inventory + low DOM (<20) = Seller's Market. Low inventory + high DOM (>30) = Stagnant/Balanced (low supply AND low demand). Include median DOM and months of supply in value. Classify as: Seller's Market / Balanced / Buyer's Market / Stagnant. Fallback to general_market_intelligence.

### Community & Market Intelligence (71-75)
71. **Development Maturity**: From neighborhood_features.development_patterns. Classify as \"New Build Area\" (modern rooflines, recent construction), \"Established\" (mature trees, older homes, stable community), or if neither clearly applies, describe the actual blend — e.g. \"Transitional — older homes + new infill\", \"Gentrifying — renovated alongside original stock\", \"Suburban Sprawl — tract homes from multiple eras\". Never use just \"Mixed\" — always qualify what the mix is.
72. **Resident Complaint Profile**: From community_pulse.common_complaints. Summarize the top 1-2 recurring complaints residents raise (e.g., "HOA strictness", "Traffic congestion", "Noise from nearby road"). This is a hidden risk signal not visible in listing data.
73. **Resident Satisfaction Drivers**: From community_pulse.what_residents_like. Summarize the top 1-2 things residents love about living here (e.g., "Top schools", "Quiet streets", "Walkable to downtown"). Indicates retention and long-term desirability.
74. **Perceived Neighborhood Safety**: From community_pulse.safety_and_concerns. Resident-reported safety sentiment ("Very Safe", "Generally Safe", "Mixed", "Concerns Noted"). Distinct from security infrastructure — this is how residents actually feel.
75. **Market Velocity (DOM)**: From deep_investment_research.market_dynamics — find the MEDIAN Days on Market (DOM) for the city/area. Look in chart_data (metric2/value2 series), summary text, and details for DOM figures. Value = "Fast/Moderate/Slow — X days median DOM". Fast = <14 days, Moderate = 14-30 days, Slow = >30 days. Tags = speed label + DOM number. Do NOT use the listing's own daysOnZillow — this must be the MARKET-LEVEL median.

### Infrastructure & Environment (76-79)
76. SKIP (precomputed).
77. SKIP (precomputed).
78. SKIP (precomputed).
79. SKIP (precomputed).


### Neighborhood & Amenities (83-88)
83. SKIP (precomputed).
84. SKIP (precomputed).
85. SKIP (precomputed).
86. SKIP (precomputed).
87. **Pet Friendliness**: Combine neighborhoodPlaces.parks (dog parks, off-leash areas) + property features (fenced yard, dog door). Also look for vet clinics in nearby places.
88. **Dining & Entertainment Scene**: From neighborhoodPlaces.walkable.dining — count, average rating, and variety. \"Vibrant\" if 5+ walkable with avg 4.0+ rating. \"Sparse\" if car required.

### Investment Intelligence (89-93) — Tags are the primary output. Generate 3-8 concept tags per factor.
89. **Market Signals**: From deep_investment_research.market_dynamics + macroeconomic_indicators. Tags = market concepts like "Seller's Market", "Low Inventory", "3% YoY Growth", "Rising Rates", "Declining DOM". Value = overall market direction (Appreciating/Cooling/Flat).
90. **Growth Catalysts**: From deep_investment_research.investment_outlook + macroeconomic_indicators. Tags = upcoming drivers like "BART Extension 2026", "Tesla HQ Expansion", "New Tech Campus", "Rezoning Vote". Value = strongest catalyst.
91. **Investment Risk Factors**: From deep_investment_research.local_risks + macroeconomic_indicators. Tags = risk concepts like "Seismic Zone", "Drought Risk", "FAIR Plan Insurance", "Declining Tax Base". Value = top risk.
92. **Market Friction**: From deep_investment_research.competitor_gaps.friction_points + community_pulse. Tags = drawbacks like "Long SF Commute", "Limited Transit", "No Nightlife", "HOA Restrictions", "Airport Noise". Value = biggest friction.
93. **Zoning & Regulatory Perks**: From deep_investment_research.investment_outlook + property_investment.value_add_strategies. Tags = zoning advantages like "ADU-Friendly", "No STR Ban", "Prop 13 Transfer", "R-1 Zoning". Value = strongest perk.

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
101. **School Concepts**: From schools_intelligence and schools data. For each of the top 3 schools, generate tags with school name + rating (e.g. "Amador Valley 10/10"), school type if non-public ("Charter", "Private"), test scores ("85% Proficient"), student-teacher ratio ("22:1 Small Classes"), AP/IB programs, graduation rate, and extracurriculars ("STEM/Robotics", "Strong Athletics"). Also include district name, "Desirable School Zone" if applicable, and proximity tags ("Walking Distance", "Schools Under 1mi"). Value = top school name + rating + district. Generate 5-12 tags.

### Community Sentiment & Condition (102-105) — Tags are the primary output. Generate 3-8 concept tags.
102. **Resident Sentiment Concepts**: From community_pulse (all sections). Tags = sentiment concepts like "Love the Schools", "Quiet Community", "Great Parks", "HOA Issues", "Traffic Concerns". Value = overall sentiment.
103. **Market Narrative Concepts**: From deep_investment_research (all sections). Tags = narrative concepts like "Tech Worker Suburb", "Family-Oriented", "Investor-Friendly", "Appreciation Play", "Cash Flow Market". Value = dominant narrative.
104. **Condition & Renovation Concepts**: From visual analysis condition_and_finish + room_highlights potential_improvements. Tags = condition concepts like "Needs Kitchen Update", "New Roof", "Original Hardwood", "Remodeled Bathrooms", "Dated HVAC". Value = overall condition.
105. **Lifestyle Convenience Concepts**: From neighborhoodPlaces + walkScore + community_pulse. Tags = convenience concepts like "Walkable Dining", "Near BART", "Great Dog Parks", "Close to Costco", "Farmer's Market". Value = top convenience.

### Distressed & Opportunity Signals (111)
111. **Distressed Sale Signal**: Analyze property.description, priceHistory, daysOnMarket, condition_and_finish, and deep_investment_research for distress indicators. Tags = distress concepts like "Foreclosure/REO", "As-Is Sale", "Estate Sale", "Probate", "Short Sale", "Investor Special", "Bank-Owned", "Price Slashed 3x", "Deferred Maintenance", "Vacant Property", "Court-Ordered", "Fixer-Upper". Value = distress level (None/Mild/Moderate/Heavy). Generate 3-8 tags if any distress signals found.

### Interior Room Intelligence (113-116) — From visualAnalysis room_highlights. Tags are the primary output.
113. **Room-by-Room Character**: For EACH room found in room_highlights, generate 2-3 descriptive concept tags prefixed with the room name (e.g. "Kitchen: Updated Cabinets", "Living Room: Brick Fireplace", "Primary Bed: Walk-In Closet", "Laundry: Full-Size W/D"). Scan ALL rooms — do not skip any. Do NOT repeat the same feature across multiple rooms (e.g. if "Vinyl Flooring" appears in every room, tag it once under the first room or under factor 115 instead). Focus on features that matter to buyers: storage, natural light, updates vs dated, special fixtures, layout flow, outdoor access, and standout details. Value = number of rooms detected + overall impression (e.g. "9 rooms — cohesive modern updates"). Generate 8-20 tags total depending on how many rooms exist.
114. **Interior Vibe & Quality**: Synthesize across ALL room_highlights + condition_and_finish + design overview. Value = a single-sentence interior vibe statement (e.g. "Clean transitional style with neutral tones and modern updates throughout" or "Classic suburban home with original finishes showing their age"). Tags = quality + style concepts like "Turn-Key", "Recently Updated", "Neutral Palette", "Cohesive Design", "Mixed Quality", "Transitional Style", "Modern Finishes", "Move-In Ready". Generate 5-10 tags.
115. **Flooring & Materials Palette**: From room_highlights + condition_and_finish. Tags = material concepts found across the home like "Vinyl Plank", "Hardwood", "Tile", "Carpet", "Granite Counters", "Wood Cabinets", "Stainless Steel", "Marble". Value = dominant flooring type. Generate 4-8 tags.
116. **Spatial Flow & Layout**: From room_highlights + spatial descriptions. Tags = layout concepts like "Open Floor Plan", "Split Bedrooms", "Indoor-Outdoor Flow", "Single Story", "Two-Story", "Formal Dining Separate", "Kitchen Open to Living", "Jack-and-Jill Bath", "En-Suite Primary". Value = layout summary. Generate 4-8 tags.

## PROPERTY DATA

\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

## OUTPUT FORMAT

Return a JSON object with this structure:
{
  "address": "full address",
  "extractedAt": "ISO timestamp",
  "factors": [
    {
      "id": 1,
      "name": "Price Bracket",
      "value": "Luxury - $2.1M",

      "tags": ["Luxury", "$2M+"]
    },
    ...all factors...
  ],
  "summary": {
    "topStrengths": ["Top 3-5 property strengths as buyer-facing phrases"],
    "topConcerns": ["Top 3-5 concerns or risks"],
    "propertyHighlight": "1-2 sentence summary of what this property is best suited for based on its features — e.g. 'Move-in ready with top-rated schools within walking distance and a spacious backyard'. Focus on PROPERTY attributes only. Do NOT describe or profile potential buyers."
  }
}

CRITICAL RULES:
- Extract ALL non-skipped factors. If data is missing, set value to "Data not available"
- value MUST be 10 words or fewer — use fragments and labels, never full sentences (e.g. "Luxury — $2.1M" not "This property is in the luxury tier at $2.1M")
- Tags must NEVER repeat or paraphrase the value. Tags add NEW concepts beyond what the value states:
  - ✅ value: "Walk Score 85 — Very Walkable" → tags: ["Transit Rich", "Errands on Foot"] (new concepts)
  - ❌ value: "Walk Score 85 — Very Walkable" → tags: ["Very Walkable", "WS 85"] (repeats value)
  - ✅ value: "Luxury — $2.1M" → tags: ["Top 5% Price", "Premium Market"] (categorization)
  - ❌ value: "Luxury — $2.1M" → tags: ["Luxury", "$2.1M"] (repeats value)
- Tags should be short, reusable labels (1-3 words each) suitable for search indexing and graph nodes
- For factors 89-105: tags are the PRIMARY output — generate 3-8 rich concept tags per factor from the source data
- Be specific with values - include numbers, percentages, and descriptors
- The summary should synthesize the factors into actionable buyer intelligence
`;
};
// ── Response Schema ───────────────────────────────────────

const factorSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.NUMBER, description: "Factor ID (1-111)" },
        name: { type: Type.STRING, description: "Factor name" },
        value: { type: Type.STRING, description: "Extracted or computed value (max 10 words)" },


        tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "1-8 short labels for graph nodes. For factors 89-105, generate 3-8 concept tags."
        }
    },
    required: ["id", "name", "value", "tags"]
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
        extractedAt: { type: Type.STRING },
        factors: { type: Type.ARRAY, items: factorSchema },
        summary: summarySchema
    },
    required: ["address", "extractedAt", "factors", "summary"]
};

