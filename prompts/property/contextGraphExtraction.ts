/**
 * Context Graph Factor Extraction Prompt
 * 
 * Sends optimized property data to Gemini and extracts the 75 decision factors
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
        const { image_by_image_analysis, image_quality_analysis, ...kept } = visual;
        // Remove sources / citations from nested research objects
        if (kept.general_market_intelligence) {
            delete (kept.general_market_intelligence as any).web_sources;
        }
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

    return {
        property: optimizedProperty,
        visualAnalysis: optimizedVisual,
        narrativeReport: narrative,
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
- The factor ID (1-75)
- A concise value (maximum 10 words — use fragments, numbers, and labels, not full sentences)
- A confidence score: "high" (directly from data), "medium" (inferred), "low" (insufficient data)
- Optional tags: 1-3 short labels that could be used as graph node values (e.g., "Luxury", "Turn-key", "High Solar Yield")

## FACTOR DEFINITIONS

### Financial & Market (1-10)
1. **Price Bracket**: Classify price as "Entry" (<$800K), "Mid" ($800K-$1.5M), "Luxury" (>$1.5M). If price missing, use Zestimate.
2. **HOA Friction**: Extract amount from resoFacts.feesAndDues or hoaFees. If "None" or missing, set to "None/Low".
3. **Insurance Viability**: Flag if fireRiskScore >= 7 OR property is in high-risk zone mentioned in description.
4. **True Carrying Cost**: Estimate monthly cost: Mortgage (Price @ 7%, 30yr) + (Taxes/12) + HOA + (Insurance/12). 
5. **Seller Motivation**: High if price cuts in priceHistory OR daysOnMarket > 90. Otherwise "Standard".
6. **ADU / House-Hacking Potential**: Look for "guest house", "basement", "separate entrance", "ADU", or "cottage" in description OR deep_research.
7. **STR Viability**: Combine legality + performance. Check deep_research/zoningDescription for STR restrictions. Then add occupancy/ADR from property_investment.str_performance. Format: "[Legal/Restricted/Unknown] — [occ]% occ @ $[adr]/night" or "Restricted — STR not permitted".
8. **Long-Term Rental Yield**: (rentZestimate × 12) / price. If rentZestimate missing, use 0.05 average yield.
9. **Historical Appreciation**: Use general_market_intelligence. If missing, use city-wide defaults from deep_research.
10. **Listing Urgency**: Assess if "Hot Home" from description or price history (back on market, etc.)

### Structural & Size (11-20)
11. **Property Typology**: From homeType (SingleFamily, Condo, etc.).
12. **Bedroom Count**: Direct from bedrooms.
13. **Bathroom Ratio**: bathrooms count. Identify "Half Bath" for guest use.
14. **Usable Square Footage**: Direct from livingAreaValue.
15. **Lot Size / Acreage**: Direct from lotSize value.
16. **Single-Story Living**: "Yes" if no stairs mentioned OR room_highlights only on "Floor 1" OR resoFacts says Single Story.
17. **Dedicated Home Office**: Look for "Den", "Office", "Library", or "Study" in roomTypes or description.
18. **Garage & Parking Capacity**: From resoFacts.garageParkingCapacity or garageSpaces.
19. **Foundation & Storage**: Basement, Crawl Space, or Slab — use resoFacts.
20. **Construction Era**: Pre-War (<1945), Mid-Century (1945-75), 80s-90s, 2000s, New Build (>2015).

### Interior Design & Visual (21-30)
21. **Move-In Readiness**: "Turn-key" if renovated/new, "Mint" if well-maintained, "Needs Work" if TLC/Fixer mentioned.
22. **Renovation Upside**: High if condition is "Needs cosmetic updates" but structural era is good.
23. **Architectural Style**: Mediterranean, Craftsman, Modern, etc. (from visualAnalysis or architecturalStyle).
24. **Natural Light / Brightness**: From lighting description. If missing, look for "Skylights", "Large windows", "South facing" in description.
25. **Open-Concept Flow**: Check if "Open concept" or "Vaulted" mentioned in interior analysis or description.
26. **Kitchen Caliber**: "Chef's" if wolf/subzero/gas mentioned, "Modern" if stainless/quartz, "Original" if dated.
27. **Primary Suite Luxury**: Look for "Dual vanities", "Walk-in", "Soaking tub" in room_highlights or description.
28. **Flooring Material**: From resoFacts.flooring (Hardwood, Tile, Carpet).
29. **Ceiling Volume**: "High/Vaulted" if mentioned in description or spatial_flow.
30. **Color Palette**: Neutral, Warm, Bold, etc. (from visualAnalysis).

### Outdoor & Lot (31-40)
31. **Fenced Yard**: Check resoFacts.fencing or backyard_and_patio analysis.
32. **Outdoor Entertainment**: Look for "Pool", "Spa", "Patio", "Deck", "Outdoor Kitchen" in exterior analysis or description.
33. **Privacy Level**: From streetViewAnalysis.privacyRating or views_privacy_orientation.
34. **Curb Appeal**: From streetViewAnalysis.curbAppealScore. If missing, use exterior_and_lot_appeal.
35. **Topography**: "Flat" vs "Hillside" from neighborhood analysis or description.
36. **View Quality**: Hills, City Lights, Water, or None.
37. **Street Noise / Traffic**: "Quiet" if Cul-de-sac, "Moderate" if through street, "High" if arterial.
38. **Visual Clutter**: Overhead wires, messy neighbors, or busy streetscape (from streetViewAnalysis).
39. **Usable Yard Space**: "Large Level Yard" vs "Steep" vs "Compact".
40. **Xeriscape / Low Maintenance**: Drought-tolerant or synthetic turf mentioned.

### Location & Community (41-45)
41. **School Quality (Max)**: Highest rating from schools array (e.g., "9/10").
42. **Commute Convenience**: Proximity to highways or transit hubs mentioned in neighborhood description.
43. **Walkability**: Direct from walkScore. "Walkable" if > 70.
44. **Greenery Proximity**: "Park adjacent" or "Near trails" from neighborhood features.
45. **Sidewalk Continuity**: From streetViewAnalysis.familySafety or pedestrian_infra.

### Advanced Intelligence (51-70)
51. **Vastu / Feng Shui Readiness**: Home orientation (North/South facing) — use neighborhood.orientation.
52. **Asthma / Respiratory Safety**: Check airQuality.aqi and pm25 load.
53. **Pollen Sensitivity**: Classify triggers like Oak, Grass, etc., from pollen analysis.
54. **Family-Friendly Level**: "High" if Cul-de-sac + Sidewalks + Backyard + Good Schools.
55. **Renewable Potential**: Solar production potential (High/Med/Low) from solarData.
56. **EV Readiness**: Look for "240V", "Level 2", or EV charger in garage description.
57. **Work-From-Home Score**: Dedicated office + Fiber/High-speed internet mentions.
58. **Multi-Gen Utility**: Downstairs Bed/Bath or separate entry for in-laws.
59. **Laundry Logistics**: "Indoor/Separate Room" vs "Garage/Hallway".
60. **Water / Air Systems**: Softeners, RO filters, or Zoned HVAC mentioned.
61. **Security Infrastructure**: Gated, Security system, or Cameras.
62. **Digital Presentation**: Quality of staging and photos (find "Hidden Gems").
63. **Solar ROI Obstructors**: Large trees or neighbors blocking roof sunshine.
64. **Job Hub Connectivity**: Proximity to major corporate campuses (Google, Apple, etc.).
65. **Upcoming Dev Impact**: Nearby construction/development from general_market_intelligence.
66. **Soil / Geo Consistency**: Soil type or liquefaction risk from deep_research.
67. **Luxury Finish Level**: High-end details like crown molding, wide plank floors, designer fixtures.
68. **Backyard Potential**: Room for ADU or pool if not already present.
69. **Streetscape Aesthetic**: Underground utilities vs overhead wires.
70. **Market Momentum**: Appreciating vs cooling micro-market indicators.

### Community & Market Intelligence (71-75)
71. **Development Maturity**: From neighborhood_features.development_patterns. Classify as "New Build Area" (modern rooflines, recent construction), "Established" (mature trees, older homes), or "Mixed". Affects infrastructure quality, community cohesion, and resale trajectory.
72. **Resident Complaint Profile**: From community_pulse.common_complaints. Summarize the top 1-2 recurring complaints residents raise (e.g., "HOA strictness", "Traffic congestion", "Noise from nearby road"). This is a hidden risk signal not visible in listing data.
73. **Resident Satisfaction Drivers**: From community_pulse.what_residents_like. Summarize the top 1-2 things residents love about living here (e.g., "Top schools", "Quiet streets", "Walkable to downtown"). Indicates retention and long-term desirability.
74. **Perceived Neighborhood Safety**: From community_pulse.safety_and_concerns. Resident-reported safety sentiment ("Very Safe", "Generally Safe", "Mixed", "Concerns Noted"). Distinct from security infrastructure — this is how residents actually feel.
75. **Market Velocity (DOM)**: From general_market_intelligence.market_dynamics.days_on_market. City-level median days on market. "Fast" if < 14 days, "Moderate" 14-30, "Slow" > 30. Signals buyer urgency and negotiation leverage.

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
      "confidence": "high",
      "tags": ["Luxury", "$2M+"]
    },
    ...all 75 factors...
  ],
  "summary": {
    "topStrengths": ["Top 3-5 property strengths as buyer-facing phrases"],
    "topConcerns": ["Top 3-5 concerns or risks"],
    "buyerProfile": "Brief description of ideal buyer profile for this property"
  }
}

CRITICAL RULES:
- Extract ALL 75 factors. If data is missing, set value to "Data not available" and confidence to "low"
- value MUST be 10 words or fewer — use fragments and labels, never full sentences (e.g. "Luxury — $2.1M" not "This property is in the luxury tier at $2.1M")
- Tags should be short, reusable labels (1-3 words each) suitable for graph nodes
- Be specific with values - include numbers, percentages, and descriptors
- The summary should synthesize the factors into actionable buyer intelligence
`;
};
// ── Response Schema ───────────────────────────────────────

const factorSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.NUMBER, description: "Factor ID (1-70)" },
        name: { type: Type.STRING, description: "Factor name" },
        value: { type: Type.STRING, description: "Extracted or computed value" },
        confidence: { type: Type.STRING, description: "high, medium, or low" },
        tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "1-3 short labels for graph nodes"
        }
    },
    required: ["id", "name", "value", "confidence", "tags"]
};

const summarySchema = {
    type: Type.OBJECT,
    properties: {
        topStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        topConcerns: { type: Type.ARRAY, items: { type: Type.STRING } },
        buyerProfile: { type: Type.STRING }
    },
    required: ["topStrengths", "topConcerns", "buyerProfile"]
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

