import { Type } from "@google/genai";
import { PropertyData } from "../types";

export const getCommunityPulsePrompt = (property: PropertyData) => `
  Task: Act as a specialized neighborhood research assistant for the following property:
  ${JSON.stringify(property, null, 2)}

  Your mission is to provide an authentic "Community Pulse" report by synthesizing real resident perspectives, local forum sentiment, news, and area-specific reviews.
  
  Instructions:
  Collect and summarize credible, real-world opinions and insights about this location from multiple independent sources like Reddit, Trulia, Niche, City-Data, and local news.

  Source requirements:
  - Each section MUST include a "summary" paragraph.
  - Each section MUST include a "points" array with 3-5 specific bullet point observations.
  - Each section MUST include a "sources" array with simple text names of the sources (e.g., "Reddit", "Niche.com").
  - Do not use URL wrappers.
  - Prefer recent sources (last 2–3 years).
  - If no reliable sources found for a section, use an empty sources array [].

  Tone: Neutral, evidence-based, buyer-oriented. Avoid marketing language.
`;

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
