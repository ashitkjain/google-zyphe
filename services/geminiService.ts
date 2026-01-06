
import { GoogleGenAI } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult } from "../types";
import { getPropertyAnalysisPrompt, propertyAnalysisSchema } from "../prompts/propertyAnalysis";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/neighborhoodAnalysis";
import { getCommunityPulsePrompt, communityPulseSchema } from "../prompts/communityPulse";
import { getPropertyImagesPrompt, propertyImagesSchema } from "../prompts/propertyImages";
import { getComprehensiveAnalysisPrompt, comprehensiveAnalysisSchema } from "../prompts/comprehensiveAnalysis";

// Always use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function extractJson<T>(text: string | undefined): T {
  if (!text) return {} as T;
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e2) {}
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (e3) {}
    }
    throw new Error("Could not parse AI response as JSON");
  }
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

export const analyzeNeighborhood = async (mapImageUrl: string, property: PropertyData): Promise<NeighborhoodAnalysis> => {
  const { data, mimeType } = await urlToBase64(mapImageUrl);
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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
    model: 'gemini-2.5-flash',
    contents: getCommunityPulsePrompt(property) + "\n\nIMPORTANT: Output ONLY valid JSON. Do not include markdown code blocks or additional text.",
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
    : `${getPropertyImagesPrompt(property)}\n\nNOTE: No photographs were provided for this property because it is currently off-market. Please perform your analysis based EXCLUSIVELY on the detailed property description and specifications provided in the JSON context. Infer design style and condition from the text and list attributes.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [{ text: textInstruction }, ...imageParts] },
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
    contents: getComprehensiveAnalysisPrompt(property, visual) + "\n\nIMPORTANT: Output ONLY valid JSON. Do not include markdown code blocks or additional text.",
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 4000 }
    }
  });

  return extractJson<ComprehensiveAnalysisResult>(response.text);
};
