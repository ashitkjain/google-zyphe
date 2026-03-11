import { Type } from "@google/genai";

/**
 * Extracts key market insights from a Deep Investment Research report.
 * Uses Gemini Flash for fast, cheap extraction (~$0.001).
 */
export const getDeepResearchInsightsPrompt = (reportContent: string) => `
You are a real estate data analyst. Extract precise market insights from this institutional investment research report.

RESEARCH REPORT:
${reportContent}

EXTRACTION RULES:
- "executive_summary": Extract exactly 1-2 sentences that capture the core investment thesis from the Executive Summary section. Do NOT paraphrase heavily — stay close to the original language.
- "median_price_range": The median price or price range mentioned in the Real Estate Market Dynamics section (e.g. "$1.2M–$1.5M" or "$850,000"). Include the dollar sign.
- "ppsf_benchmark": The Price Per Square Foot benchmark (e.g. "$650/sf" or "$480–$550/sf"). Include the dollar sign and "/sf" suffix.
- "months_of_supply": The months of supply figure (e.g. "1.8 months" or "2.1–2.5 months"). Include "months" suffix.
- "dom_range": The Days on Market range or average (e.g. "14–21 days" or "18 days"). Include "days" suffix.
- "risk_tags": Extract 3-6 short risk labels from the Local Risks & Insurance section. These should be terse tags, not full sentences (e.g. "FAIR Plan Exposure", "High Fire Severity Zone", "Dam Inundation Zone", "Insurance Premium Escalation", "Prop 13 Tax Reset").

If a specific data point is not found in the report, use "N/A" for string fields.
Return ONLY the JSON object.
`;

export const deepResearchInsightsSchema = {
    type: Type.OBJECT,
    properties: {
        executive_summary: {
            type: Type.STRING,
            description: "1-2 sentence investment thesis from the Executive Summary"
        },
        median_price_range: {
            type: Type.STRING,
            description: "Median price or price range (e.g. '$1.2M–$1.5M')"
        },
        ppsf_benchmark: {
            type: Type.STRING,
            description: "Price per square foot benchmark (e.g. '$650/sf')"
        },
        months_of_supply: {
            type: Type.STRING,
            description: "Months of housing supply (e.g. '1.8 months')"
        },
        dom_range: {
            type: Type.STRING,
            description: "Days on Market range (e.g. '14–21 days')"
        },
        risk_tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-6 short risk labels (e.g. 'FAIR Plan Exposure')"
        }
    },
    required: ["executive_summary", "median_price_range", "ppsf_benchmark", "months_of_supply", "dom_range", "risk_tags"]
};
