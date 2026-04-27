import { buildMlsFactsBlock } from "./mlsFacts.js";

export const getInvestmentResearchPrompt = (property) => `
  Persona: Act as a veteran Real Estate Investment Strategist and Short-Term Rental (STR) Specialist.
  Task: Conduct a property-specific investment research report for the address ${property.address} for the year 2026.

  ${buildMlsFactsBlock(property)}
  GROUNDING RULE: Treat every fact in the "KNOWN MLS / LISTING FACTS" block above as authoritative data from RapidAPI. Never contradict these values.

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
