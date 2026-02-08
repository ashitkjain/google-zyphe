
import { SchemaType, Type } from "@google/genai";

export const getStreetViewAnalysisPrompt = () => `
  You are an expert AI Real Estate Architect and Neighborhood Analyst. 
  You are analyzing a Google Street View image of a property to perform a "Neighborhood Forensic Analysis".
  
  Please analyze the provided Street View image and output a JSON object with the following:
  1. curbAppealScore: A number from 1-10 (10 being perfection) based on landscaping, exterior condition, and general attractiveness.
  2. architecturalStyle: A concise string identifying the style (e.g., "Mid-Century Modern", "Victorian", "Contemporary Craftsman").
  3. neighborhoodVibe: A short phrase describing the immediate surroundings (e.g., "Quiet leafy suburb", "Dense urban coordinator", "Rural sprawling estate").
  4. visualClutter: A boolean string ("true", "false") if there are power lines, messy signs, or heavy traffic visible in front of the house.
  5. gardenDescription: A short sentence describing the front yard/landscaping status.
  6. safetyAssessment: A short assessment of visual safety features (lighting, fences) or risks (broken pavement, unkempt areas), keep this neutral and objective.
  7. privacyRating: Assessment of seclusion (e.g., "High Seclusion", "Moderate", "Exposed"). Mention screening like hedges or fences.
  8. maintenanceRisks: An array of specific visible maintenance issues (e.g., ["Roof moss", "Driveway cracks", "Peeling paint"]). If none, return an empty array.
  9. solarObstructions: Identify if tall buildings, oversized trees, or structures might obstruct sunlight for solar panels.
  10. parkingLogistics: Deep analysis of parking (e.g., "3-car deep driveway", "Attached 2-car garage", "Restricted street parking").
  11. familySafety: Assessment of child/pet safety (e.g., "Fully fenced front yard", "Continuous sidewalk infrastructure", "Proximity to high-traffic intersection").
  12. utilityAesthetic: Note if utilities are underground or if there are overhead power lines.
`;

export const streetViewAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    curbAppealScore: { type: Type.NUMBER },
    architecturalStyle: { type: Type.STRING },
    neighborhoodVibe: { type: Type.STRING },
    visualClutter: { type: Type.BOOLEAN },
    gardenDescription: { type: Type.STRING },
    safetyAssessment: { type: Type.STRING },
    privacyRating: { type: Type.STRING },
    maintenanceRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
    solarObstructions: { type: Type.STRING },
    parkingLogistics: { type: Type.STRING },
    familySafety: { type: Type.STRING },
    utilityAesthetic: { type: Type.STRING }
  },
  required: [
    "curbAppealScore",
    "architecturalStyle",
    "neighborhoodVibe",
    "visualClutter",
    "gardenDescription",
    "safetyAssessment",
    "privacyRating",
    "maintenanceRisks",
    "solarObstructions",
    "parkingLogistics",
    "familySafety",
    "utilityAesthetic"
  ]
};
