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
  4. **Infrastructure & Development**: Upcoming transit projects, major commercial developments (e.g., new tech hubs, hospitals, or retail centers), and zoning changes.
  5. **Short-Term/Long-Term Outlook**: Explicitly state the 12-month versus 5-year investment perspective.
  
  ## Output Format:
  - Generate a professional Markdown report.
  - Use clear headings and bullet points.
  - Include a "Sources & Grounding" section at the end of the content field listing the primary research points used.
  - STICK TO THE SCHEMA: All research and analysis MUST be contained within the "content" field of the JSON object.
`;

export const deepInvestmentResearchSchema = {
  type: Type.OBJECT,
  properties: {
    content: {
      type: Type.STRING,
      description: "Full markdown-formatted research report with analysis and sources."
    }
  },
  required: ["content"]
};
