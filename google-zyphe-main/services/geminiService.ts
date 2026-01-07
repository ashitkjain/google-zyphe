import { GoogleGenAI } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult } from "../types";
import { getPropertyAnalysisPrompt, propertyAnalysisSchema } from "../prompts/propertyAnalysis";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/neighborhoodAnalysis";
import { getCommunityPulsePrompt, communityPulseSchema } from "../prompts/communityPulse";
import { getPropertyImagesPrompt, propertyImagesSchema } from "../prompts/propertyImages";
import { getComprehensiveAnalysisPrompt } from "../prompts/comprehensiveAnalysis";

// Single source of truth for the model name as requested
export const GEMINI_MODEL = 'gemini-2.5-flash';

// Custom error to pass raw response back for logging
export class AiResponseError extends Error {
  rawResponse: string;
  constructor(message: string, rawResponse: string) {
    super(message);
    this.rawResponse = rawResponse;
    this.name = "AiResponseError";
  }
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Robust JSON extraction helper that handles markdown code blocks,
 * text preambles, and outermost structure identification.
 */
function extractJson<T>(text: string | undefined): T {
  if (!text) throw new AiResponseError("Empty response from AI", "");
  
  const cleaned = text.trim();
  
  // Helper to attempt parsing
  const tryParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  };

  // 1. Direct attempt
  let result = tryParse(cleaned);
  if (result) return result;

  // 2. Try to extract from markdown code blocks
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    result = tryParse(match[1].trim());
    if (result) return result;
  }
  
  // 3. Try to find the first '{' and last '}' (Object)
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    result = tryParse(cleaned.substring(firstBrace, lastBrace + 1));
    if (result) return result;
  }

  // 4. Try to find the first '[' and last ']' (Array)
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    result = tryParse(cleaned.substring(firstBracket, lastBracket + 1));
    if (result) return result;
  }
  
  throw new AiResponseError("Could not parse AI response as JSON", text);
}

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
  const prompt = getPropertyAnalysisPrompt(property);
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: propertyAnalysisSchema
    }
  });

  return extractJson<AIAnalysisResult>(response.text);
};

export const analyzeNeighborhood = async (mapImageUrl: string, property: PropertyData): Promise<NeighborhoodAnalysis> => {
  const { data, mimeType } = await urlToBase64(mapImageUrl);
  const prompt = getNeighborhoodAnalysisPrompt(property);
  
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data, mimeType } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: neighborhoodAnalysisSchema
    }
  });

  return extractJson<NeighborhoodAnalysis>(response.text);
};

export const analyzeCommunityPulse = async (property: PropertyData): Promise<CommunityPulseResult> => {
  const prompt = getCommunityPulsePrompt(property);
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  return extractJson<CommunityPulseResult>(response.text);
};

export const analyzePropertyImages = async (imageUrls: string[], property: PropertyData): Promise<CustomAIAnalysisResult> => {
  const selectedImages = imageUrls.slice(0, 15);
  const hasImages = selectedImages.length > 0;

  const imageParts = await Promise.all(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType } };
  }));

  const textInstruction = hasImages 
    ? getPropertyImagesPrompt(property)
    : `${getPropertyImagesPrompt(property)}\n\nNOTE: No photographs were provided for this property. Perform analysis based on detailed specifications.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: { parts: [{ text: textInstruction }, ...imageParts] },
    config: { 
      responseMimeType: "application/json",
      responseSchema: propertyImagesSchema
    }
  });

  return extractJson<CustomAIAnalysisResult>(response.text);
};

export const analyzeComprehensive = async (property: PropertyData, visual: CustomAIAnalysisResult): Promise<ComprehensiveAnalysisResult> => {
  const prompt = getComprehensiveAnalysisPrompt(property, visual);
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 16000 }
    }
  });

  return extractJson<ComprehensiveAnalysisResult>(response.text);
};