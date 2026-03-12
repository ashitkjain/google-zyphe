import { Type } from "@google/genai";

export const getInteriorSummaryPrompt = (home_interior: any, room_highlights: any[]) => `
  You are an objective real estate data analyst. Your task is to provide a neutral, factual summary of a property's interior based on detailed visual analysis.
  
  DATA INPUT:
  Interior Overview:
  ${JSON.stringify(home_interior, null, 2)}

  Room Details:
  ${JSON.stringify(room_highlights, null, 2)}

  INSTRUCTIONS:
  1. Provide an overall interior summary in 4-5 objective sentences, focusing on layout, spatial flow, and material consistency.
  2. Provide a specific rooms summary in 4-5 objective sentences, focusing on the character, features, and functionality of individual identifiable spaces.
  3. Identify the aesthetic "vibe" and atmosphere using neutral terminology (e.g., "minimalist and utilitarian", "traditional with heavy ornamentation", "modern open-concept with industrial accents").
  4. Generate a set of purely descriptive, objective tags (e.g., "hardwood-floors", "recessed-lighting", "vaulted-ceilings", "stainless-appliances").
  5. CRITICAL: Avoid all sales-oriented language, marketing fluff, or subjective adjectives like "stunning", "gorgeous", "beautiful", "perfect", or "charming". 
  6. Focus on the actual physical attributes and the resulting spatial atmosphere.

  "Return the response as a single JSON object that conforms to the following schema:
  {
    "interior_summary": "Neutral, factual summary of the overall home interior (2-3 sentences).",
    "rooms_summary": "Neutral, factual summary of the individual rooms and spaces (2-3 sentences).",
    "vibe": "Objective description of the aesthetic atmosphere and physical character.",
    "objective_tags": ["array", "of", "descriptive", "tags"]
  }
`;

export const interiorSummarySchema = {
  type: Type.OBJECT,
  properties: {
    interior_summary: {
      type: Type.STRING,
      description: "A 2-3 sentence neutral, factual synthesis of the overall interiorExperience."
    },
    rooms_summary: {
      type: Type.STRING,
      description: "A 2-3 sentence neutral, factual synthesis of the specific identifiable rooms."
    },
    vibe: {
      type: Type.STRING,
      description: "Objective characterization of the interior's aesthetic and atmosphere."
    },
    objective_tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of purely descriptive, attribute-based tags."
    }
  },
  required: ["interior_summary", "rooms_summary", "vibe", "objective_tags"]
};
