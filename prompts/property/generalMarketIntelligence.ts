
import { Type } from "@google/genai";
import { PropertyData } from "../../types";

export const getGeneralMarketIntelligencePrompt = (property: PropertyData) => `
  Persona: Act as a veteran Real Estate Investment Strategist.
  Task: Conduct a general market and neighborhood intelligence report for the city of ${property.city}, ${property.state} for the year 2026.
  
  Research Objectives:
  1. Market Dynamics & Appreciation: Analyze 3-year historical appreciation and projected 2026 growth for this city. Include average "Days on Market" (DOM) for recent sales.
  2. Competitor Gaps & Amenities: Identify "friction points" in local STRs/LTRs and highly-praised amenities (e.g., EV charging, home office) that increase value in this local market.
  3. Regulatory & Neighborhood Growth: Check for new 2026 rental laws (STR and LTR), zoning shifts, and major upcoming infrastructure or commercial developments (e.g., new tech hubs, transit).
  
  Output Format: Return valid JSON in the following structure:
  {
    "market_dynamics": { "historical_appreciation": "string", "projected_growth": "string", "days_on_market": "string" },
    "competitor_gaps": { "friction_points": ["string"], "praised_amenities": ["string"], "recommendations": "string" },
    "regulatory_and_growth": { "laws_and_zoning": "string", "upcoming_developments": "string", "summary": "string" },
    "demand_drivers": [{ "event": "string", "date": "string", "impact": "string" }],
    "web_sources": [{ "title": "string", "url": "string" }]
  }

  Respond ONLY with the raw JSON object, no additional text or markdown formatting.
`;

export const generalMarketIntelligenceSchema = {
    type: Type.OBJECT,
    properties: {
        market_dynamics: {
            type: Type.OBJECT,
            properties: {
                historical_appreciation: { type: Type.STRING },
                projected_growth: { type: Type.STRING },
                days_on_market: { type: Type.STRING }
            },
            required: ["historical_appreciation", "projected_growth", "days_on_market"]
        },
        competitor_gaps: {
            type: Type.OBJECT,
            properties: {
                friction_points: { type: Type.ARRAY, items: { type: Type.STRING } },
                praised_amenities: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendations: { type: Type.STRING }
            },
            required: ["friction_points", "praised_amenities", "recommendations"]
        },
        regulatory_and_growth: {
            type: Type.OBJECT,
            properties: {
                laws_and_zoning: { type: Type.STRING },
                upcoming_developments: { type: Type.STRING },
                summary: { type: Type.STRING }
            },
            required: ["laws_and_zoning", "upcoming_developments", "summary"]
        },
        demand_drivers: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    event: { type: Type.STRING },
                    date: { type: Type.STRING },
                    impact: { type: Type.STRING }
                },
                required: ["event", "date", "impact"]
            }
        },
        web_sources: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    url: { type: Type.STRING }
                },
                required: ["title", "url"]
            }
        }
    },
    required: ["market_dynamics", "competitor_gaps", "regulatory_and_growth", "demand_drivers", "web_sources"]
};
