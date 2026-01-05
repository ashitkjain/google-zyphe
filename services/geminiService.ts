import { GoogleGenAI } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult } from "../types";
import { getPropertyAnalysisPrompt, propertyAnalysisSchema } from "../prompts/propertyAnalysis";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/neighborhoodAnalysis";
import { getCommunityPulsePrompt } from "../prompts/communityPulse";
import { propertyImagesPrompt, propertyImagesSchema } from "../prompts/propertyImages";
import { getComprehensiveAnalysisPrompt } from "../prompts/comprehensiveAnalysis";

// Always use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to clean and parse JSON from the model's text response.
 * Handles cases where the model might include markdown code fences or conversational filler.
 */
const parseJSONSafely = (text: string) => {
  try {
    // Look for the first occurrence of '{' and the last occurrence of '}'
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1) {
      const jsonCandidate = text.substring(startIndex, endIndex + 1);
      return JSON.parse(jsonCandidate);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from AI response:", text);
    throw new Error("AI returned an invalid data format. Please try again.");
  }
};

async function urlToBase64(url: string): Promise<{ data: string, mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({ data: base64String, mimeType: blob.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const analyzeProperty = async (property: PropertyData): Promise<AIAnalysisResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: getPropertyAnalysisPrompt(property),
    config: {
      responseMimeType: "application/json",
      responseSchema: propertyAnalysisSchema
    }
  });

  return JSON.parse(response.text || "{}") as AIAnalysisResult;
};

export const analyzeNeighborhood = async (mapImageUrl: string, propertyAddress: string): Promise<NeighborhoodAnalysis> => {
  const { data, mimeType } = await urlToBase64(mapImageUrl);
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { text: getNeighborhoodAnalysisPrompt(propertyAddress) },
        { inlineData: { data, mimeType } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: neighborhoodAnalysisSchema
    }
  });

  return JSON.parse(response.text || "{}") as NeighborhoodAnalysis;
};

export const analyzeCommunityPulse = async (address: string, cityState: string): Promise<CommunityPulseResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: getCommunityPulsePrompt(address, cityState),
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  return parseJSONSafely(response.text || "{}") as CommunityPulseResult;
};

export const analyzePropertyImages = async (imageUrls: string[]): Promise<CustomAIAnalysisResult> => {
  const selectedImages = imageUrls.slice(0, 15);
  const imageParts = await Promise.all(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType } };
  }));

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [{ text: propertyImagesPrompt }, ...imageParts] },
    config: { 
      responseMimeType: "application/json",
      responseSchema: propertyImagesSchema
    }
  });

  return JSON.parse(response.text || "{}") as CustomAIAnalysisResult;
};

export const analyzeComprehensive = async (property: PropertyData, visual: CustomAIAnalysisResult): Promise<ComprehensiveAnalysisResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: getComprehensiveAnalysisPrompt(property, visual),
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 4000 }
    }
  });

  return parseJSONSafely(response.text || "{}") as ComprehensiveAnalysisResult;
};