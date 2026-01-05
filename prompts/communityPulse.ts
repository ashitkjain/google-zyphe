import { PropertyData } from "../types";

export const getCommunityPulsePrompt = (property: PropertyData) => `
  Task: Act as a specialized neighborhood research assistant for the following property:
  ${JSON.stringify(property, null, 2)}

  Your mission is to provide an authentic "Community Pulse" report by synthesizing real resident perspectives, local forum sentiment, news, and area-specific reviews.
  
  Instructions:
  Collect and summarize credible, real-world opinions and insights about this location from multiple independent sources.

  Required sources (use as many as relevant):
  - Reddit (city or neighborhood subreddits)
  - Trulia neighborhood reviews
  - Niche.com neighborhood reviews
  - City-Data forums
  - Google Maps reviews (area & nearby amenities)
  - Local news or Patch.com
  - Public crime or safety reports, CrimeMapping.com
  - School review platforms (GreatSchools, Niche)

  Source requirements:
  - Each section MUST include a "sources" array with Footnote Style	Text of source like niche, patch.com, crmemapping.com at the bottom. 
  - Do not show URL wrapper like googlevertex
  - Prefer recent sources (last 2–3 years)
  - If no reliable sources found for a section, use an empty sources array []

  Tone: Neutral, evidence-based, buyer-oriented. Avoid marketing language.

  Return your response as a JSON object with exactly this structure. 

  {
    "what_residents_like": {
      "summary": "<positive aspects: what residents love, community vibe, friendliness, diversity>",
      "sources": []
    },
    "common_complaints": {
      "summary": "<negative aspects: complaints, noise, traffic, parking issues>",
      "sources": []
    },
    "safety_and_concerns": {
      "summary": "<safety perception, crime concerns, red flags, recurring warnings>",
      "sources": []
    },
    "schools_family_friendliness": {
      "summary": "<school quality and family-friendliness>",
      "sources": []
    },
    "lifestyle_convenience": {
      "summary": "<walkability, commute, remote work suitability, daily convenience>",
      "sources": []
    },
    "investment_insights": {
      "summary": "<rental demand, tenant profile, resale desirability, market trends>",
      "sources": []
    }
  }

  AVOID REPEATING the same information across different sections.

  Respond ONLY with the JSON object, no additional text or markdown formatting.`;