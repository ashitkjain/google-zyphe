
import { Type } from "@google/genai";
import { PropertyData } from "../types";

export const getInvestmentResearchPrompt = (property: PropertyData) => `
  Persona: Act as a veteran Short-Term Rental (STR) investment analyst and professional Airbnb Superhost.
  Task: Conduct a comprehensive market research report for an Airbnb property at ${property.address} for the year 2026.
  
  Research Objectives:
  1. Market Performance: Search for current 2026 occupancy rates and Average Nightly Rates (ADR) for ${property.bedrooms || 2}-bedroom properties in the neighborhood of ${property.address}.
  2. Competitor Gaps: Browse recent 2025–2026 guest reviews for top-performing local listings. Identify frequent "friction points" (complaints) and highly-praised amenities I should include to stand out.
  3. Regulatory Updates: Check for any new 2026 short-term rental laws, zoning changes, or permit caps in the city where this property is located.
  4. Demand Drivers: Identify major local events (concerts, festivals, conferences) scheduled for the next 6 months that will drive peak pricing.
  
  Output Format: Return valid JSON in the following structure:
  {
    "market_performance": { "occupancy_rate": "string", "adr": "string", "summary": "string" },
    "competitor_gaps": { "friction_points": ["string"], "praised_amenities": ["string"], "standout_recommendations": "string" },
    "regulatory_updates": { "laws_and_zoning": "string", "permit_caps": "string", "summary": "string" },
    "demand_drivers": [{ "event": "string", "date": "string", "pricing_impact": "string" }],
    "revenue_projection_2026": [{ "period": "string", "projected_revenue": "string", "occupancy_estimate": "string" }],
    "web_sources": [{ "title": "string", "url": "string" }]
  }
`;

export const investmentResearchSchema = {
    type: Type.OBJECT,
    properties: {
        market_performance: {
            type: Type.OBJECT,
            properties: {
                occupancy_rate: { type: Type.STRING },
                adr: { type: Type.STRING },
                summary: { type: Type.STRING }
            },
            required: ["occupancy_rate", "adr", "summary"]
        },
        competitor_gaps: {
            type: Type.OBJECT,
            properties: {
                friction_points: { type: Type.ARRAY, items: { type: Type.STRING } },
                praised_amenities: { type: Type.ARRAY, items: { type: Type.STRING } },
                standout_recommendations: { type: Type.STRING }
            },
            required: ["friction_points", "praised_amenities", "standout_recommendations"]
        },
        regulatory_updates: {
            type: Type.OBJECT,
            properties: {
                laws_and_zoning: { type: Type.STRING },
                permit_caps: { type: Type.STRING },
                summary: { type: Type.STRING }
            },
            required: ["laws_and_zoning", "permit_caps", "summary"]
        },
        demand_drivers: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    event: { type: Type.STRING },
                    date: { type: Type.STRING },
                    pricing_impact: { type: Type.STRING }
                },
                required: ["event", "date", "pricing_impact"]
            }
        },
        revenue_projection_2026: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    period: { type: Type.STRING },
                    projected_revenue: { type: Type.STRING },
                    occupancy_estimate: { type: Type.STRING }
                },
                required: ["period", "projected_revenue", "occupancy_estimate"]
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
    required: [
        "market_performance",
        "competitor_gaps",
        "regulatory_updates",
        "demand_drivers",
        "revenue_projection_2026",
        "web_sources"
    ]
};
