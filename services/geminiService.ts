import { GoogleGenAI } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult } from "../types";
import { getPropertyAnalysisPrompt, propertyAnalysisSchema } from "../prompts/propertyAnalysis";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/neighborhoodAnalysis";
import { getCommunityPulsePrompt, communityPulseSchema } from "../prompts/communityPulse";
import { getPropertyImagesPrompt, propertyImagesSchema } from "../prompts/propertyImages";
import { getComprehensiveAnalysisPrompt, comprehensiveAnalysisSchema } from "../prompts/comprehensiveAnalysis";

// Always use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    model: "gemini-3-flash-preview",
    contents: getPropertyAnalysisPrompt(property),
    config: {
      responseMimeType: "application/json",
      responseSchema: propertyAnalysisSchema
    }
  });

  return JSON.parse(response.text || "{}") as AIAnalysisResult;
};

export const analyzeNeighborhood = async (mapImageUrl: string, property: PropertyData): Promise<NeighborhoodAnalysis> => {
  const { data, mimeType } = await urlToBase64(mapImageUrl);
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: getNeighborhoodAnalysisPrompt(property) },
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

export const analyzeCommunityPulse = async (property: PropertyData): Promise<CommunityPulseResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: getCommunityPulsePrompt(property),
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: communityPulseSchema
    }
  });

  return JSON.parse(response.text || "{}") as CommunityPulseResult;
};

export const analyzePropertyImages = async (imageUrls: string[], property: PropertyData): Promise<CustomAIAnalysisResult> => {
  const selectedImages = imageUrls.slice(0, 15);
  const imageParts = await Promise.all(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType } };
  }));

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: [{ text: getPropertyImagesPrompt(property) }, ...imageParts] },
    config: { 
      responseMimeType: "application/json",
      responseSchema: propertyImagesSchema
    }
  });

  return JSON.parse(response.text || "{}") as CustomAIAnalysisResult;
};

export const analyzeComprehensive = async (property: PropertyData, visual: CustomAIAnalysisResult): Promise<ComprehensiveAnalysisResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: getComprehensiveAnalysisPrompt(property, visual),
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: comprehensiveAnalysisSchema,
      thinkingConfig: { thinkingBudget: 4000 }
    }
  });

  return JSON.parse(response.text || "{}") as ComprehensiveAnalysisResult;
};
