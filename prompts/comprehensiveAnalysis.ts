import { Type } from "@google/genai";
import { PropertyData, CustomAIAnalysisResult } from "../types";

export const getComprehensiveAnalysisPrompt = (property: PropertyData, visual: CustomAIAnalysisResult) => {
  const PROPERTY_DETAILS = JSON.stringify(property, null, 2);
  const VISUAL_ANALYSIS = JSON.stringify(visual, null, 2);

  return `You are an AI-powered home buying assistant, tasked with generating a comprehensive and compelling analysis of a residential property. 
  Your goal is to provide a detailed, narrative-style, realtor written, professional report to a home buyer, based on a combination of provided - 

  1. property information ${PROPERTY_DETAILS}, 
  2. image analysis - ${VISUAL_ANALYSIS}, and 
  3. online research. 

  Instructions:
  Persona: Act as a knowledgeable and unbiased real estate analyst.
  Narrative Style: Write in a flowing, descriptive paragraph style in a compelling tone that engages a potential buyer. Avoid bullet points or lists in the main sections.
  Data Integration: Synthesize all provided data (property details, images, map analysis) with information you gather from your online searches.
  No Duplication: Ensure that each section contains unique and distinct content.
  Numerical Ranges: When showing ranges, use the format "3-5" or "$25-$35".
  Citations: Do not include citations like [1] or [3] in the final output.
  
  Use your search tools to find data on future development, market trends, and climate risks specific to the address.
`;
};

export const comprehensiveAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    detailed_analysis: {
      type: Type.OBJECT,
      properties: {
        location_neighborhood: { type: Type.STRING },
        outdoors_view_quality: { type: Type.STRING },
        visual_appeal_condition: { type: Type.STRING },
        privacy_layout: { type: Type.STRING },
        climate_resilience: { type: Type.STRING },
        additional_considerations: { type: Type.STRING }
      },
      required: ["location_neighborhood", "outdoors_view_quality", "visual_appeal_condition", "privacy_layout", "climate_resilience", "additional_considerations"]
    },
    lifestyle_fit: {
      type: Type.OBJECT,
      properties: {
        families: { type: Type.STRING },
        professionals: { type: Type.STRING },
        retirees: { type: Type.STRING },
        investors: { type: Type.STRING }
      },
      required: ["families", "professionals", "retirees", "investors"]
    },
    risks_considerations: { type: Type.STRING },
    buyer_recommendation: { type: Type.STRING }
  },
  required: ["summary", "detailed_analysis", "lifestyle_fit", "risks_considerations", "buyer_recommendation"]
};
