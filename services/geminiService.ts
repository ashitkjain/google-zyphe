
import { GoogleGenAI } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult, ImageQualityAnalysisResult } from "../types.ts";
import { getPropertyAnalysisPrompt, propertyAnalysisSchema } from "../prompts/propertyAnalysis.ts";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/neighborhoodAnalysis.ts";
import { getCommunityPulsePrompt, communityPulseSchema } from "../prompts/communityPulse.ts";
import { getPropertyImagesPrompt, propertyImagesSchema } from "../prompts/propertyImages.ts";
import { getComprehensiveAnalysisPrompt } from "../prompts/comprehensiveAnalysis.ts";

// Updated to gemini-2.5-flash for significantly faster response times as requested.
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

// Lazy initialization of the Gemini API client
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) {
    const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

/**
 * Robust JSON extraction helper that handles various formatting anomalies.
 */
function extractJson<T>(text: string | undefined): T {
  if (!text) throw new AiResponseError("Empty response from AI", "");
  
  // Remove zero-width spaces, BOM, and other non-printable chars that can break JSON.parse
  let cleaned = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  
  const tryParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  };

  // 1. Try direct parse
  let result = tryParse(cleaned);
  if (result) return result;

  // 2. Try to find content inside markdown code blocks
  const markdownMatches = [...cleaned.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (const match of markdownMatches) {
    if (match[1]) {
      result = tryParse(match[1].trim());
      if (result) return result;
    }
  }

  // 3. Greedy substring extraction (Object)
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    // Attempt to find the largest valid JSON object within the braces
    for (let end = lastBrace; end > firstBrace; end--) {
      const candidate = cleaned.substring(firstBrace, end + 1);
      result = tryParse(candidate);
      if (result) return result;
    }
  }

  // 4. Greedy substring extraction (Array)
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    for (let end = lastBracket; end > firstBracket; end--) {
      const candidate = cleaned.substring(firstBracket, end + 1);
      result = tryParse(candidate);
      if (result) return result;
    }
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
  const ai = getAi();
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
  const ai = getAi();
  
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
  const ai = getAi();
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
  const ai = getAi();

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
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      // Reduced thinking budget for faster overall generation time with 2.5 Flash
      thinkingConfig: { thinkingBudget: 4000 }
    }
  });

  return extractJson<ComprehensiveAnalysisResult>(response.text);
};

export const analyzeImageQuality = async (imageUrls: string[]): Promise<ImageQualityAnalysisResult> => {
  const ai = getAi();
  const selectedImages = imageUrls.slice(0, 15);
  
  const imageParts = await Promise.all(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType } };
  }));

  const prompt = `I am uploading photos for a new property listing. Please perform a comprehensive audit of the entire gallery and return your analysis as a JSON object with exactly this structure:

{
  "overall_score": {
    "score": <number 0-100>,
    "summary": "<brief explanation of the score>"
  },
  "top_photos": {
    "count": <number>,
    "description": "<which photos are strongest and why>",
    "recommendations": ["<recommendation 1>", "<recommendation 2>"]
  },
  "lighting_and_color": {
    "rating": "<Good/Fair/Poor>",
    "observations": ["<observation 1>", "<observation 2>"],
    "issues": ["<issue 1>", "<issue 2>"]
  },
  "staging_and_clutter": {
    "rating": "<Good/Fair/Poor>",
    "observations": ["<observation 1>", "<observation 2>"],
    "issues": ["<issue 1>", "<issue 2>"]
  },
  "composition": {
    "rating": "<Good/Fair/Poor>",
    "observations": ["<observation 1>", "<observation 2>"],
    "issues": ["<issue 1>", "<issue 2>"]
  },
  "delete_list": {
    "count": <number>,
    "reasons": ["<reason 1>", "<reason 2>"],
    "description": "<which photos should be removed and why>"
  },
  "action_plan": {
    "priority_actions": ["<action 1>", "<action 2>", "<action 3>"],
    "editing_suggestions": ["<suggestion 1>", "<suggestion 2>"],
    "reshoot_suggestions": ["<suggestion 1>", "<suggestion 2>"]
  }
}

Respond ONLY with the JSON object, no additional text or markdown formatting.

Here are the photos:`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: {
      parts: [
        { text: prompt },
        ...imageParts
      ]
    },
    config: {
      responseMimeType: "application/json"
    }
  });

  return extractJson<ImageQualityAnalysisResult>(response.text);
};
