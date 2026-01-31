
import { Type } from "@google/genai";
import { PropertyData } from "../../types";

export const getInvestmentResearchPrompt = (property: PropertyData) => `
  Persona: Act as a veteran Real Estate Investment Strategist and Short-Term Rental (STR) Specialist.
  Task: Conduct a property-specific investment research report for the address ${property.address} for the year 2026.
  
  Research Objectives:
  1. Short-Term Rental (STR) Market: Search for current 2026 occupancy rates and Average Nightly Rates (ADR) for ${property.bedrooms || 2}-bedroom properties in the neighborhood.
  2. Long-Term Rental (LTR) Analysis: Estimate the 2026 monthly market rent for a 12-month lease. Compare the stability of LTR vs the higher yield of STR for this specific property.

  Output Format: Return valid JSON in the following structure:
  {
    "str_performance": { "occupancy_rate": "string", "adr": "string", "annual_revenue_projection": "string" },
    "ltr_analysis": { "monthly_rent": "string", "vacancy_rate": "string", "comparison_summary": "string" }
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
        }
    },
    required: ["str_performance", "ltr_analysis"]
};
