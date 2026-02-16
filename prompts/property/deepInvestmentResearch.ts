import { Type } from "@google/genai";
import { PropertyData } from "../../types";

export const getDeepInvestmentResearchPrompt = (property: PropertyData) => `
  # Institutional Deep Investment Research
  Location: ${property.city}, ${property.state} (USA)
  
  ## Research Objective
  Synthesize a high-fidelity investment thesis for residential real estate in this specific market. Focus on data-driven insights that a sophisticated investor would require to deploy capital.
  
  ## Required Analysis Modules:
  1. **Macroeconomic Indicators**: Current local inflation, employment rate trends (major employers), and regional GDP growth.
  2. **Real Estate Market Dynamics**: Historical price appreciation (5yr/10yr), inventory levels (Months of Supply), and Median Days on Market (DOM) trends.
  3. **Demographic & Sociographic Shifts**: Migration patterns, population growth rates, and school district rankings.
  4. **Infrastructure & Development**: Upcoming transit projects, major commercial developments, and zoning changes.
  5. **Investment Outlook**: Explicitly state the 12-month (Short-Term) versus 5-year (Long-Term) perspective.
  6. **Micro-Markets**: Identify 3-4 distinct neighborhoods or sub-markets within ${property.city}.
  7. **Local Risks**: Investigate specific risks (Flood, Fire, etc.) and educational infrastructure.
  
  ## Output Constraint:
  You MUST return a JSON object with a "structured_report" field matching the specified schema. 
  For EACH category, you MUST provide a "visual_hint" which is a description of a relevant chart, graph, or picture that would best illustrate the data in that section (e.g., "A line chart showing the 5-year trend of inventory vs median price").
  The "content" field should still contain the full Markdown summary for fallback, but most analysis should be categorized in "structured_report".
  Do NOT just list sources. Analyze the data.
`;

export const deepInvestmentResearchSchema = {
  type: Type.OBJECT,
  properties: {
    content: {
      type: Type.STRING,
      description: "Full markdown-formatted research report with analysis and sources."
    },
    structured_report: {
      type: Type.OBJECT,
      properties: {
        macroeconomic_indicators: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            details: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_hint: { type: Type.STRING, description: "Description of a relevant chart or image for macroeconomics." }
          },
          required: ["summary", "details", "visual_hint"]
        },
        market_dynamics: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            details: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_hint: { type: Type.STRING, description: "Description of a relevant chart for market dynamics." }
          },
          required: ["summary", "details", "visual_hint"]
        },
        demographic_shifts: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            details: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_hint: { type: Type.STRING, description: "Description of a relevant chart for demographics." }
          },
          required: ["summary", "details", "visual_hint"]
        },
        infrastructure_and_development: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            details: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_hint: { type: Type.STRING, description: "Description of a relevant image or chart for development." }
          },
          required: ["summary", "details", "visual_hint"]
        },
        investment_outlook: {
          type: Type.OBJECT,
          properties: {
            short_term: { type: Type.STRING },
            long_term: { type: Type.STRING },
            visual_hint: { type: Type.STRING, description: "Description of a visual for the outlook." }
          },
          required: ["short_term", "long_term", "visual_hint"]
        },
        micro_markets: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              profile: { type: Type.STRING },
              investment_thesis: { type: Type.STRING },
              visual_hint: { type: Type.STRING, description: "Description of a visual for this micro-market." }
            },
            required: ["name", "profile", "investment_thesis", "visual_hint"]
          }
        },
        local_risks: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            risk_factors: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_hint: { type: Type.STRING, description: "Description of a risk map or chart." }
          },
          required: ["summary", "risk_factors", "visual_hint"]
        }
      },
      required: [
        "macroeconomic_indicators",
        "market_dynamics",
        "demographic_shifts",
        "infrastructure_and_development",
        "investment_outlook",
        "micro_markets",
        "local_risks"
      ]
    }
  },
  required: ["content", "structured_report"]
};
