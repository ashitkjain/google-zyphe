
import { SchemaType, Type } from "@google/genai";

export const getStreetViewAnalysisPrompt = () => `
  You are an expert AI Real Estate Architect and Neighborhood Analyst. 
  You are analyzing a Google Street View image of a property to assess its "Vibe", "Curb Appeal", and "Architectural Style".
  
  Please analyze the provided Street View image and output a JSON object with the following:
  1. curbAppealScore: A number from 1-10 (10 being perfection) based on landscaping, exterior condition, and general attractiveness.
  2. architecturalStyle: A concise string identifying the style (e.g., "Mid-Century Modern", "Victorian", "Contemporary Craftsman").
  3. neighborhoodVibe: A short phrase describing the immediate surroundings (e.g., "Quiet leafy suburb", "Dense urban coordinator", "Rural sprawling estate").
  4. visualClutter: A boolean string ("true", "false") if there are power lines, messy signs, or heavy traffic visible in front of the house.
  5. gardenDescription: A short sentence describing the front yard/landscaping status.
  6. safetyAssessment: A very short assessment of visual safety features (lighting, fences) or risks (broken pavement, unkempt areas), keep this neutral and objective.
`;

export const streetViewAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        curbAppealScore: { type: Type.NUMBER },
        architecturalStyle: { type: Type.STRING },
        neighborhoodVibe: { type: Type.STRING },
        visualClutter: { type: Type.BOOLEAN },
        gardenDescription: { type: Type.STRING },
        safetyAssessment: { type: Type.STRING }
    },
    required: ["curbAppealScore", "architecturalStyle", "neighborhoodVibe", "visualClutter", "gardenDescription", "safetyAssessment"]
};
