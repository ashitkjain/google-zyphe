/**
 * Context Graph Factor Extraction Prompt
 * 
 * Sends optimized property data to Gemini and extracts the 70 decision factors
 * that power the buyer context graph.
 */

import { Type } from "@google/genai";
import { PropertyData, CustomAIAnalysisResult, ComprehensiveAnalysisResult } from "../../types";
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

export const getContextGraphExtractionPrompt = (context: any) => `
You are a real estate data analyst. Your task is to extract structured decision factors from property data.

Given the property data below, extract values for ALL 70 decision factors. For each factor, return:
- The factor ID (1-70)
- A concise value (the extracted or computed answer)
- A confidence score: "high" (directly from data), "medium" (inferred), "low" (insufficient data)
- Optional tags: 1-3 short labels that could be used as graph node values (e.g., "Luxury", "Turn-key", "High Solar Yield")

## FACTOR DEFINITIONS

### Financial & Market (1-10)
1. **Price Bracket**: Classify price as "Entry" (<$800K), "Mid" ($800K-$1.5M), "Luxury" (>$1.5M) — use property.price
2. **HOA Friction**: Extract monthly HOA fee amount and any notable restrictions — use resoFacts.feesAndDues
3. **Insurance Viability**: Flag if fire risk is high (score >= 7) suggesting FAIR Plan necessity — use annualHomeownersInsurance + fireRiskScore
4. **True Carrying Cost**: Estimate monthly cost = mortgage (at 7%) + taxes + HOA + insurance — computed from price, propertyTaxRate, HOA, insurance
5. **Seller Motivation**: Assess from price drops in priceHistory and days on market — use priceHistory + timeOnZillow/daysOnZillow
6. **ADU / House-Hacking Potential**: Extract any mentions of ADU, granny flat, guest house potential — use deep_investment_research
7. **Short-Term Rental Legality**: Extract STR restrictions, zoning friction — use deep_investment_research
8. **Long-Term Rental Yield**: Compute (rentZestimate × 12) / price as gross yield % — use rentZestimate + price
9. **Historical Appreciation**: Extract historical appreciation rate — use general_market_intelligence
10. **Bidding War Probability**: Assess from DOM, inventory, supply/demand — use market data + timeOnZillow

### Structural & Size (11-20)
11. **Property Typology**: Direct from homeType (SingleFamily, Condo, Townhouse, etc.)
12. **Bedroom Count**: Direct from bedrooms
13. **Bathroom Ratio**: bathrooms count and whether there's a guest half-bath
14. **Usable Square Footage**: Direct from livingAreaValue
15. **Lot Size / Acreage**: Direct from lotSize
16. **Single-Story Flow**: Infer if single story from room_highlights floor assignments + resoFacts
17. **Dedicated Home Office**: Look for Den/Office/Library in roomTypes or AI room descriptions
18. **Garage & Parking Capacity**: Direct from resoFacts.garageParkingCapacity
19. **Foundation Type**: Basement vs Slab — use resoFacts.foundationDetails
20. **Construction Era**: Classify yearBuilt into "Pre-War" (<1945), "Mid-Century" (1945-1975), "80s-90s" (1976-1999), "2000s" (2000-2015), "New Build" (>2015)

### Interior Design & Visual (21-30)
21. **Move-In Readiness**: Assess from condition_and_finish — "Turn-key" vs "Needs Work"
22. **Fixer-Upper / TLC**: Extract mentions of dated, needs updates, cosmetic work needed
23. **Architectural Style**: From design_style.style — Mediterranean, Craftsman, Contemporary, etc.
24. **Natural Light / Brightness**: From lighting description — "Sun-drenched", "Dark", "Skylight-enhanced"
25. **Open-Concept Flow**: From spatial_flow — open concept vs compartmentalized
26. **Kitchen Caliber**: Extract kitchen quality descriptors — "Chef's kitchen", "Builder grade", "Renovated"
27. **Primary Suite Luxury**: Extract master/primary suite features — "Spa bath", "Walk-in closet", "Suite"
28. **Flooring Material**: From resoFacts.flooring — Hardwood, Carpet, Tile, Laminate
29. **Ceiling Volume**: Look for vaulted, cathedral, soaring, double-height mentions
30. **Color Palette Warmth**: From color_and_materials — Warm, Neutral, Cool, Bold

### Outdoor & Lot (31-40)
31. **Fenced Yard (Pets/Kids)**: From resoFacts.fencing + AI backyard analysis
32. **Outdoor Entertaining**: Extract outdoor features — Pergola, Patio, Outdoor kitchen, Fire pit
33. **Private Pool / Spa**: From MLS + AI analysis
34. **Neighbor Privacy**: From streetViewAnalysis.privacyRating
35. **Curb Appeal Score**: From streetViewAnalysis.curbAppealScore (numeric 1-10)
36. **View Quality**: From views_privacy_orientation — Hills, Golf course, City, None
37. **Street Typology**: From neighborhood orientation — Cul-de-sac, Corner lot, Through street
38. **Visual Clutter / Wires**: From streetViewAnalysis.visualClutter + utilityAesthetic
39. **Usable Lawn Space**: From gardenDescription — "Room for kids", "Compact", "No yard"
40. **Low-Maintenance Yard**: Drought-tolerant, artificial turf, minimal landscaping

### Location & Community (41-45)
41. **School District Quality**: From schools array — extract highest GreatSchools rating
42. **School Matriculation Power**: From deep_investment_research school intelligence
43. **Walkability (15-Min City)**: Direct from walkScore + walkScoreDesc
44. **Proximity to Greenery**: From neighborhood_features.proximity_to_greenery_and_water
45. **Family Safety / Sidewalks**: From streetViewAnalysis.familySafety

### Environmental & Sustainability (46-50)
46. **Wildfire Risk**: Direct from fireRiskScore (1-10 scale)
47. **Flood Risk**: Direct from floodRiskScore (1-10 scale)
48. **Solar Yield Potential**: From solarData — classify as "High" (>15k kWh), "Medium" (8-15k), "Low" (<8k)
49. **Allergen / Pollen Safety**: From pollen.score + dominantPollenType
50. **HVAC Quality / Air Filtration**: From resoFacts.heating/cooling — Central Air vs Window, filtration

### Advanced Intelligence (51-70)
51. **Home Orientation / Facing**: From neighborhood.orientation.final_orientation — "North-facing", "South-facing" — critical for Vastu Shastra, Feng Shui, and natural light preferences
52. **Specific Allergen Triggers**: From pollen.analysis.primary_triggers — specific allergens like "Juniper", "Oak" — matches buyers with allergies away from problem zones
53. **Micro-Particulate Load**: From airQuality.pollutants — specifically pm25 or o3 concentrations for buyers with asthma or respiratory concerns
54. **Topography & Elevation**: From neighborhood_features.topography — "Flat" vs "Rolling hills" — impacts yard usability, drainage, and aging-in-place
55. **Carbon Offset Potential**: From solarData.estimatedSolarProduction.carbonOffsetTons — appeals to ESG/Eco-conscious buyers
56. **Utility Aesthetic / Wires**: From streetViewAnalysis.utilityAesthetic — "Underground utilities" vs "Overhead power lines" — subconscious turn-off
57. **Street Parking Logistics**: From streetViewAnalysis.parkingLogistics — "Ample street parking" vs "Driveway only" — critical for multi-car families
58. **Sidewalk Continuity & Safety**: From streetViewAnalysis.familySafety — "Continuous sidewalks" — essential for strollers, dog owners, retirees
59. **Street Layout & Traffic**: From neighborhood_features.street_layout_and_traffic — quiet "Cul-de-sac" vs busy "Arterial" road
60. **Neighborhood Visual Clutter**: From streetViewAnalysis.visualClutter — messy neighboring yards or chaotic streetscapes
61. **Multi-Gen / ADU Readiness**: From description + resoFacts.roomTypes — "downstairs bedroom/full bath", "separate entrance", "Basement Full"
62. **Laundry Logistics**: From resoFacts.laundryFeatures — "Inside/Laundry Room" (desired) vs "In Garage" (dealbreaker for many)
63. **Water & Air Quality Systems**: From resoFacts.appliances + heating — "Water Softener", "Water Filter System", "Zoned HVAC"
64. **Life Safety & Security Infra**: From resoFacts.securityFeatures — "Fire Sprinkler System", "Double Strapped Water Heater" — mitigates FAIR plan costs
65. **Digital Presentation Quality**: From image_quality_analysis.overall_score + staging_and_clutter — find "Ugly Ducklings" with high structural value but bad photos
66. **AI-Suggested Sweat Equity**: From room_highlights[].potential_improvements — "Add kitchen island", "Add pergola" — perfect for flippers
67. **Solar Obstruction Friction**: From streetViewAnalysis.solarObstructions — "Large tree potentially obstructs" — kills solar panel ROI
68. **Proximity to Sticky Job Hubs**: From general_market_intelligence.demand_drivers — links to specific corporate HQs for tenant stability
69. **Future Megaprojects**: From general_market_intelligence.upcoming_developments — "IKEA Opening 2026", "Valley Link Transit Project"
70. **Severe Geo-Risks**: From deep_investment_research.local_risks — soil liquefaction, dam inundation zones — hidden tail-risk

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
    ...all 70 factors...
  ],
  "summary": {
    "topStrengths": ["Top 3-5 property strengths as buyer-facing phrases"],
    "topConcerns": ["Top 3-5 concerns or risks"],
    "buyerProfile": "Brief description of ideal buyer profile for this property"
  }
}

CRITICAL RULES:
- Extract ALL 70 factors. If data is missing, set value to "Data not available" and confidence to "low"
- Tags should be short, reusable labels (1-3 words each) suitable for graph nodes
- Be specific with values - include numbers, percentages, and descriptors
- The summary should synthesize the factors into actionable buyer intelligence
`;

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

// ── Result Type ───────────────────────────────────────────

export interface ExtractedFactor {
    id: number;
    name: string;
    value: string;
    confidence: 'high' | 'medium' | 'low';
    tags: string[];
}

export interface ContextGraphExtractionResult {
    address: string;
    extractedAt: string;
    factors: ExtractedFactor[];
    summary: {
        topStrengths: string[];
        topConcerns: string[];
        buyerProfile: string;
    };
}
