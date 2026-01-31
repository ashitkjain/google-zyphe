import { Type } from "@google/genai";
import { PropertyData } from "../../types";

export const getCommunityPulsePrompt = (property: PropertyData) => `
    Task: Act as a specialized neighborhood research assistant for the city of ${property.city}, ${property.state}.

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
      "summary": "<safety perception, crime concerns, red flags, recurring warnings, environmental and infrastructure risks: industrial proximity, light pollution, drainage issues, or significant public works projects>",
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


const sectionSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Detailed summary of resident sentiment and feedback." },
    points: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 key highlight points for this section."
    },
    sources: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of source names used for this section."
    }
  },
  required: ["summary", "points", "sources"]
};

export const communityPulseSchema = {
  type: Type.OBJECT,
  properties: {
    what_residents_like: sectionSchema,
    common_complaints: sectionSchema,
    safety_and_concerns: sectionSchema,
    schools_family_friendliness: sectionSchema,
    lifestyle_convenience: sectionSchema,
    investment_insights: sectionSchema
  },
  required: [
    "what_residents_like",
    "common_complaints",
    "safety_and_concerns",
    "schools_family_friendliness",
    "lifestyle_convenience",
    "investment_insights"
  ]
};