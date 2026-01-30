
import { Type } from "@google/genai";
import { PropertyData } from "../types";

export const getInvestmentResearchPrompt = (property: PropertyData) => `
  Persona: Act as a veteran Real Estate Investment Strategist and Short-Term Rental (STR) Specialist.
  Task: Conduct a comprehensive investment research report for the property at ${property.address} for the year 2026.
  
  Research Objectives:
  1. Short-Term Rental (STR) Market: Search for current 2026 occupancy rates and Average Nightly Rates (ADR) for ${property.bedrooms || 2}-bedroom properties in the neighborhood.
  2. Long-Term Rental (LTR) Analysis: Estimate the 2026 monthly market rent for a 12-month lease. Compare the stability of LTR vs the higher yield of STR for this specific property.
  3. Market Dynamics & Appreciation: Analyze 3-year historical appreciation and projected 2026 growth for this zip code. Include average "Days on Market" (DOM) for recent sales.
  4. Investment Metrics: Provide estimated Cap Rate, Rent-to-Price ratio, and Cash-on-Cash return (assuming standard 25% down payment and current interest rates).
  5. Competitor Gaps & Amenities: Identify "friction points" in local STRs/LTRs and highly-praised amenities (e.g., EV charging, home office) that increase value.
  6. Regulatory & Neighborhood Growth: Check for new 2026 rental laws (STR and LTR), zoning shifts, and major upcoming infrastructure or commercial developments (e.g., new tech hubs, transit).
  
  Output Format: Return valid JSON in the following structure:
  {
    "str_performance": { "occupancy_rate": "string", "adr": "string", "annual_revenue_projection": "string" },
    "ltr_analysis": { "monthly_rent": "string", "vacancy_rate": "string", "comparison_summary": "string" },
    "investment_metrics": { "cap_rate": "string", "rent_to_price_ratio": "string", "cash_on_cash_return": "string" },
    "market_dynamics": { "historical_appreciation": "string", "projected_growth": "string", "days_on_market": "string" },
    "competitor_gaps": { "friction_points": ["string"], "praised_amenities": ["string"], "recommendations": "string" },
    "regulatory_and_growth": { "laws_and_zoning": "string", "upcoming_developments": "string", "summary": "string" },
    "demand_drivers": [{ "event": "string", "date": "string", "impact": "string" }],
    "web_sources": [{ "title": "string", "url": "string" }]
  }

  Respond ONLY with the raw JSON object, no additional text or markdown formatting.
`;

export const investmentResearchSchema = {
    type: Type.OBJECT,
    properties: {
        str_performance: {
            type: Type.OBJECT,
            properties: {
                occupancy_rate: { type: Type.STRING },
                adr: { type: Type.STRING },
                annual_revenue_projection: { type: Type.STRING }
            },
            required: ["occupancy_rate", "adr", "annual_revenue_projection"]
        },
        ltr_analysis: {
            type: Type.OBJECT,
            properties: {
                monthly_rent: { type: Type.STRING },
                vacancy_rate: { type: Type.STRING },
                comparison_summary: { type: Type.STRING }
            },
            required: ["monthly_rent", "vacancy_rate", "comparison_summary"]
        },
        investment_metrics: {
            type: Type.OBJECT,
            properties: {
                cap_rate: { type: Type.STRING },
                rent_to_price_ratio: { type: Type.STRING },
                cash_on_cash_return: { type: Type.STRING }
            },
            required: ["cap_rate", "rent_to_price_ratio", "cash_on_cash_return"]
        },
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
    required: [
        "str_performance",
        "ltr_analysis",
        "investment_metrics",
        "market_dynamics",
        "competitor_gaps",
        "regulatory_and_growth",
        "demand_drivers",
        "web_sources"
    ]
};
