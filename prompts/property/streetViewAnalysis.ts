import { Type } from "@google/genai";
import { PropertyData } from "../../types";
import { buildMlsFactsBlock } from "./mlsFacts";

export const getStreetViewAnalysisPrompt = (property: PropertyData) => `
  You are an expert AI Real Estate Architect and Neighborhood Analyst.
  You are analyzing a Google Street View image of a property to perform a "Neighborhood Forensic Analysis".

  ${buildMlsFactsBlock(property)}

TASK: Analyze the provided Street View image and output a JSON object with the following fields.
  Your visual observations must COMPLEMENT — never contradict — the MLS facts listed above.
  For example: do not state a garage count that differs from the MLS Garage / Parking Capacity.
  1. curbAppealScore: A number from 1 - 10(10 being perfection) based on landscaping, exterior condition, and general attractiveness.
  2. neighborhoodVibe: A short phrase describing the immediate surroundings(e.g., "Quiet leafy suburb", "Dense urban coordinator", "Rural sprawling estate").
  3. visualClutter: A boolean string("true", "false") ONLY if power lines, messy signs, or heavy traffic are CLEARLY visible in the provided photograph.If not visible, set to false.
  4. gardenDescription: A short sentence describing the front yard / landscaping status.
  5. safetyAssessment: A short assessment of visual safety features(lighting, fences) or risks(broken pavement, unkempt areas), keep this neutral and objective.
  6. privacyRating: Assessment of seclusion(e.g., "High Seclusion", "Moderate", "Exposed").Mention screening like hedges or fences.
  7. maintenanceRisks: An array of specific visible maintenance issues.Focus on signs of deferred maintenance: specifically check for roof wear, paint quality / peeling, and structural cracks in the facade or driveway.If none, return an empty array.
  8. solarObstructions: Identify if tall buildings, oversized trees, or structures might obstruct sunlight for solar panels.
  9. parkingLogistics: Describe ONLY what is visible on the street: e.g.availability of street parking, presence of no - parking signs, red curbs, fire hydrants, or narrow street width.Do NOT guess or describe garage or driveway capacity — that data comes from MLS records.
  10. familySafety: Assessment of child / pet safety(e.g., "Fully fenced front yard", "Continuous sidewalk infrastructure", "Proximity to high-traffic intersection").
  10. utilityAesthetic: Note if overhead power lines are PROMINENTLY visible and visually impactful (e.g., lines running directly in front of the home, across the main view, or dominating the streetscape). Do NOT flag faint, distant, or partially-obscured lines in the background — only report them if they meaningfully affect the street-level aesthetic. If not prominently visible, state "Utilities appear underground or not prominently visible."
11. isImageryAvailable: A boolean string("true", "false").Set to false ONLY if the image provided contains a clear "no imagery" placeholder, is a solid black / gray screen, or clearly says "Sorry, we have no imagery here."
12. neighborCondition: A sentence evaluating the upkeep of the surrounding houses and neighborhood.Identify any 'visual disorder' like litter, overgrown lots, or abandoned vehicles.

  IMPORTANT: Do NOT attempt to count or describe garage spaces, driveway capacity, or specific parking counts — this data is sourced from official MLS records and visual estimates are unreliable.

13. observationPins: An array of exactly 6 objects. Each object marks where in the image the corresponding observation is best supported visually. The order is fixed:
    Pin 1 → Front-Yard Privacy (point to the front yard, fence line, or privacy hedges)
    Pin 2 → Safety & Access (point to the front gate, sidewalk entry, or driveway approach)
    Pin 3 → Solar Potential (point to the rooftop or the tree canopy above/near the roof)
    Pin 4 → Streetscape Quality (point to the neighboring homes or the street scene to the side)
    Pin 5 → Utilities (point to where overhead lines would run, or the roofline if underground)
    Pin 6 → Parking (point to the visible street parking lane or driveway apron)

    For each pin return:
      "num": integer 1–6
      "xPct": a number 0–100 representing the horizontal position as a percentage of image width (0 = far left, 100 = far right)
      "yPct": a number 0–100 representing the vertical position as a percentage of image height (0 = top, 100 = bottom)

    Place each pin precisely on the visual element it describes — not just the center of the image. If a feature is not clearly visible, place the pin in the region where it would typically appear (e.g., rooftop area for solar, lower-left for front yard privacy).
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
    neighborCondition: { type: Type.STRING },
    observationPins: {
      type: Type.ARRAY,
      description: "Exactly 6 pins, one per observation, with pixel-accurate xPct/yPct coordinates pointing to the relevant visual feature in the image.",
      items: {
        type: Type.OBJECT,
        properties: {
          num:  { type: Type.INTEGER, description: "Pin number 1–6 matching the fixed observation order." },
          xPct: { type: Type.NUMBER,  description: "Horizontal position as % of image width (0=left, 100=right)." },
          yPct: { type: Type.NUMBER,  description: "Vertical position as % of image height (0=top, 100=bottom)." },
        },
        required: ["num", "xPct", "yPct"],
      },
    },
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
    "neighborCondition",
    "observationPins",
  ]
};
