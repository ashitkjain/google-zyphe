
import { Type } from "@google/genai";
import { PropertyData } from "../../types";
import { buildMlsFactsBlock } from "./mlsFacts";

export const getPropertyAnalysisPrompt = (property: PropertyData) => `
  Perform a deep, intelligent real estate analysis for the following property:

  ${buildMlsFactsBlock(property)}

  Above is the authoritative MLS data from RapidAPI. Treat every value as ground truth — do not contradict any of it.
  Additional mobility context: Walk Score(${property.walkScore || 'N/A'}), Transit Score(${property.transitScore || 'N/A'}), Bike Score(${property.bikeScore || 'N/A'})
  Risk Factors: Wind(${property.windRiskScore}), Flood(${property.floodRiskScore}), Fire(${property.fireRiskScore}), Heat(${property.heatRiskScore})
  
  Please provide:
  1. A detailed analysis for a potential buyer (pros and cons).
  2. A strategic recommendation for a seller (how to maximize value).
  3. A compelling marketing pitch for a realtor.
  4. A short market outlook for this specific type of property in this area.
`;

export const propertyAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    buyerAnalysis: { type: Type.STRING },
    sellerStrategy: { type: Type.STRING },
    realtorPitch: { type: Type.STRING },
    marketOutlook: { type: Type.STRING }
  },
  required: ["buyerAnalysis", "sellerStrategy", "realtorPitch", "marketOutlook"]
};
