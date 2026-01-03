
import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, AIAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeProperty = async (property: PropertyData): Promise<AIAnalysisResult> => {
  const prompt = `
    Perform a deep, intelligent real estate analysis for the following property:
    Address: ${property.address}
    Price: $${property.price || property.zestimate}
    Type: ${property.homeType}
    Details: ${property.bedrooms} beds, ${property.bathrooms} baths, ${property.livingAreaValue} sqft
    Year Built: ${property.yearBuilt}
    Description: ${property.description}
    Risk Factors: Wind(${property.windRiskScore}), Flood(${property.floodRiskScore}), Fire(${property.fireRiskScore}), Heat(${property.heatRiskScore})
    
    Please provide:
    1. A detailed analysis for a potential buyer (pros and cons).
    2. A strategic recommendation for a seller (how to maximize value).
    3. A compelling marketing pitch for a realtor.
    4. A short market outlook for this specific type of property in this area.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          buyerAnalysis: { type: Type.STRING },
          sellerStrategy: { type: Type.STRING },
          realtorPitch: { type: Type.STRING },
          marketOutlook: { type: Type.STRING }
        },
        required: ["buyerAnalysis", "sellerStrategy", "realtorPitch", "marketOutlook"]
      }
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text) as AIAnalysisResult;
};
