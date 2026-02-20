
import { SchemaType, Type } from "@google/genai";

export const getStreetViewAnalysisPrompt = () => `
  You are an expert AI Real Estate Architect and Neighborhood Analyst. 
  You are analyzing a Google Street View image of a property to perform a "Neighborhood Forensic Analysis".
  
  Please analyze the provided Street View image and output a JSON object with the following:
  1. curbAppealScore: A number from 1-10 (10 being perfection) based on landscaping, exterior condition, and general attractiveness.
  2. neighborhoodVibe: A short phrase describing the immediate surroundings (e.g., "Quiet leafy suburb", "Dense urban coordinator", "Rural sprawling estate").
  3. visualClutter: A boolean string ("true", "false") ONLY if power lines, messy signs, or heavy traffic are CLEARLY visible in the provided photograph. If not visible, set to false.
  4. gardenDescription: A short sentence describing the front yard/landscaping status.
  5. safetyAssessment: A short assessment of visual safety features (lighting, fences) or risks (broken pavement, unkempt areas), keep this neutral and objective.
  6. privacyRating: Assessment of seclusion (e.g., "High Seclusion", "Moderate", "Exposed"). Mention screening like hedges or fences.
  7. maintenanceRisks: An array of specific visible maintenance issues. Focus on signs of deferred maintenance: specifically check for roof wear, paint quality/peeling, and structural cracks in the facade or driveway. If none, return an empty array.
  8. solarObstructions: Identify if tall buildings, oversized trees, or structures might obstruct sunlight for solar panels.
  9. parkingLogistics: Deep analysis of parking (e.g., "3-car deep driveway", "Attached 2-car garage", "Restricted street parking").
  10. familySafety: Assessment of child/pet safety (e.g., "Fully fenced front yard", "Continuous sidewalk infrastructure", "Proximity to high-traffic intersection").
  11. utilityAesthetic: Note if overhead power lines are VISIBLY present. Do not assume or guess; if you don't see them, state they are underground.
  12. isImageryAvailable: A boolean string ("true", "false"). Set to false ONLY if the image provided contains a clear "no imagery" placeholder, is a solid black/gray screen, or clearly says "Sorry, we have no imagery here."
  13. neighborCondition: A sentence evaluating the upkeep of the surrounding houses and neighborhood. Identify any 'visual disorder' like litter, overgrown lots, or abandoned vehicles.
`;

export const streetViewAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    curbAppealScore: { type: Type.NUMBER },
    neighborhoodVibe: { type: Type.STRING },
    visualClutter: { type: Type.BOOLEAN },
    gardenDescription: { type: Type.STRING },
    safetyAssessment: { type: Type.STRING },
    privacyRating: { type: Type.STRING },
    maintenanceRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
    solarObstructions: { type: Type.STRING },
    parkingLogistics: { type: Type.STRING },
    familySafety: { type: Type.STRING },
    utilityAesthetic: { type: Type.STRING },
    isImageryAvailable: { type: Type.BOOLEAN },
    neighborCondition: { type: Type.STRING }
  },
  required: [
    "curbAppealScore",
    "neighborhoodVibe",
    "visualClutter",
    "gardenDescription",
    "safetyAssessment",
    "privacyRating",
    "maintenanceRisks",
    "solarObstructions",
    "parkingLogistics",
    "familySafety",
    "utilityAesthetic",
    "isImageryAvailable",
    "neighborCondition"
  ]
};
