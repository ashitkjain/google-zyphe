
import { GoogleGenAI } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult, ImageQualityAnalysisResult, InvestmentResearchResult, BiddingStrategyResult } from "../types";
import { getPropertyAnalysisPrompt, propertyAnalysisSchema } from "../prompts/propertyAnalysis";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/neighborhoodAnalysis";
import { getCommunityPulsePrompt, communityPulseSchema } from "../prompts/communityPulse";
import { getPropertyImagesPrompt, propertyImagesSchema } from "../prompts/propertyImages";
import { getComprehensiveAnalysisPrompt } from "../prompts/comprehensiveAnalysis";
import { getImageQualityAnalysisPrompt, imageQualityAnalysisSchema } from "../prompts/imageQualityAnalysis";
import { getInvestmentResearchPrompt, investmentResearchSchema } from "../prompts/investmentResearch";
import { biddingStrategyPrompt } from "../prompts/biddingStrategy";

// Set to gemini-2.5-flash everywhere as requested.
export const GEMINI_MODEL = 'gemini-2.5-flash';

// Custom error to pass raw response back for logging
export class AiResponseError extends Error {
  rawResponse: string;
  prompt: any;
  constructor(message: string, rawResponse: string, prompt?: any) {
    super(message);
    this.rawResponse = rawResponse;
    this.prompt = prompt;
    this.name = "AiResponseError";
  }
}

// Lazy initialization of the Gemini API client
let aiInstance: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiInstance) {
    // API key is correctly pulled from process.env.API_KEY
    const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || "";
    if (!apiKey) {
      console.error("Missing API Key. Checked process.env.API_KEY.");
      throw new AiResponseError(
        "API Key is missing. Please create a .env file in the project root with 'GEMINI_API_KEY=your_key_here'.",
        "Missing Configuration"
      );
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

/**
 * Enhanced JSON extraction helper.
 * Uses a greedy backtracking strategy to find valid JSON objects/arrays 
 * even if the model appends trailing garbage or extra braces.
 */
function extractJson<T>(text: string | undefined): T {
  if (!text) throw new AiResponseError("Empty response from AI", "");

  // Safeguard: Ensure text is a string
  if (typeof text !== 'string') {
    throw new AiResponseError(`Invalid response type: ${typeof text}`, String(text));
  }

  // Clean basic non-printable characters
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
      const candidate = match[1].trim();
      result = tryParse(candidate);
      if (result) return result;
    }
  }

  // 3. Greedy Object Extraction with Backtracking
  // Handles the case where the LLM might output: { "json": true } } (extra brace)
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      // Iterate backwards from the last closing brace to find the valid JSON structure
      for (let end = lastBrace; end > firstBrace; end--) {
        if (cleaned[end] === '}') {
          const candidate = cleaned.substring(firstBrace, end + 1);
          result = tryParse(candidate);
          if (result) return result;
        }
      }
    }
  }

  // 4. Greedy Array Extraction with Backtracking
  const firstBracket = cleaned.indexOf('[');
  if (firstBracket !== -1) {
    const lastBracket = cleaned.lastIndexOf(']');
    if (lastBracket > firstBracket) {
      for (let end = lastBracket; end > firstBracket; end--) {
        if (cleaned[end] === ']') {
          const candidate = cleaned.substring(firstBracket, end + 1);
          result = tryParse(candidate);
          if (result) return result;
        }
      }
    }
  }

  throw new AiResponseError("Could not parse AI response as JSON", text);
}

async function urlToBase64(url: string): Promise<{ data: string, mimeType: string }> {
  try {
    // Attempt with explicit CORS mode to detect blocking
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (!result) {
          reject(new Error("Empty result from FileReader"));
          return;
        }
        const base64String = result.split(',')[1];
        resolve({ data: base64String, mimeType: blob.type });
      };
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    console.warn(`Image fetch failed for ${url}:`, error.message);
    // Return a signal or rethrow. 
    // Rethrowing allows the caller to handle it (e.g., skip the image).
    // But since the current caller uses Promise.all, one failure fails all.
    // We should probably modify the caller to handle failures.
    throw error;
  }
}

export const analyzeProperty = async (property: PropertyData): Promise<AIAnalysisResult> => {
  const prompt = getPropertyAnalysisPrompt(property);
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: propertyAnalysisSchema
      }
    });

    // Use response.text directly (property, not a method)
    return extractJson<AIAnalysisResult>(response.text);
  } catch (error: any) {
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzeNeighborhood = async (mapImageUrl: string, property: PropertyData): Promise<NeighborhoodAnalysis> => {
  const { data, mimeType } = await urlToBase64(mapImageUrl);
  const prompt = getNeighborhoodAnalysisPrompt(property);
  try {
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

    // Use response.text directly
    return extractJson<NeighborhoodAnalysis>(response.text);
  } catch (error: any) {
    // Sanitize image data for logging
    const sanitizedPrompt = {
      text: prompt,
      image: { mimeType, data: "<BASE64_IMAGE_DATA_OMITTED>" }
    };

    if (error instanceof AiResponseError) {
      error.prompt = sanitizedPrompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", sanitizedPrompt);
  }
};

export const analyzeCommunityPulse = async (property: PropertyData): Promise<CommunityPulseResult> => {
  const prompt = getCommunityPulsePrompt(property);
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    // Use response.text directly
    return extractJson<CommunityPulseResult>(response.text);
  } catch (error: any) {
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzePropertyImages = async (imageUrls: string[], property: PropertyData): Promise<CustomAIAnalysisResult> => {
  const selectedImages = imageUrls.slice(0, 15);
  const hasImages = selectedImages.length > 0;
  const ai = getAi();

  const imageResults = await Promise.allSettled(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType } };
  }));

  const imageParts = imageResults
    .filter((result): result is PromiseFulfilledResult<{ inlineData: { data: string; mimeType: string } }> => result.status === 'fulfilled')
    .map(result => result.value);

  const successfulImages = imageParts.length > 0;
  if (!successfulImages && selectedImages.length > 0) {
    console.warn("All images failed to load (likely CORS restrictions). Falling back to text-only analysis.");
  }

  const textInstruction = successfulImages
    ? getPropertyImagesPrompt(property)
    : `${getPropertyImagesPrompt(property)}\n\nNOTE: No photographs were provided for this property. Perform analysis based on detailed specifications.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts: [{ text: textInstruction }, ...imageParts] },
      config: {
        responseMimeType: "application/json",
        responseSchema: propertyImagesSchema
      }
    });

    // Use response.text directly
    return extractJson<CustomAIAnalysisResult>(response.text);
  } catch (error: any) {
    // Sanitize image data for logging
    const sanitizedPrompt = {
      text: textInstruction,
      images: `${imageParts.length} images (data omitted)`
    };

    if (error instanceof AiResponseError) {
      error.prompt = sanitizedPrompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", sanitizedPrompt);
  }
};

export const analyzeComprehensive = async (property: PropertyData, visual: CustomAIAnalysisResult): Promise<ComprehensiveAnalysisResult> => {
  const prompt = getComprehensiveAnalysisPrompt(property, visual);
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Reduced thinking budget for faster overall generation time
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });

    // Use response.text directly
    return extractJson<ComprehensiveAnalysisResult>(response.text);
  } catch (error: any) {
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzeImageQuality = async (imageUrls: string[]): Promise<ImageQualityAnalysisResult> => {
  const ai = getAi();
  const selectedImages = imageUrls.slice(0, 15);

  const imageResults = await Promise.allSettled(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType } };
  }));

  const imageParts = imageResults
    .filter((result): result is PromiseFulfilledResult<{ inlineData: { data: string; mimeType: string } }> => result.status === 'fulfilled')
    .map(result => result.value);

  if (imageParts.length === 0) {
    throw new AiResponseError("Could not load any images for quality analysis (likely CORS)", "");
  }

  const prompt = getImageQualityAnalysisPrompt();

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          { text: prompt },
          ...imageParts
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: imageQualityAnalysisSchema
      }
    });

    // Use response.text directly
    return extractJson<ImageQualityAnalysisResult>(response.text);
  } catch (error: any) {
    // Sanitize image data for logging
    const sanitizedPrompt = {
      text: prompt,
      images: `${imageParts.length} images (data omitted)`
    };

    if (error instanceof AiResponseError) {
      error.prompt = sanitizedPrompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", sanitizedPrompt);
  }
};
export const analyzeInvestmentResearch = async (property: PropertyData): Promise<InvestmentResearchResult> => {
  const prompt = getInvestmentResearchPrompt(property);
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
        // Note: JSON schema is incompatible with Tool Use, so we rely on extractJson
      }
    });

    return extractJson<InvestmentResearchResult>(response.text);
  } catch (error: any) {
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzeBiddingStrategy = async (property: PropertyData): Promise<BiddingStrategyResult> => {
  const prompt = biddingStrategyPrompt(property);
  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return extractJson<BiddingStrategyResult>(response.text);
  } catch (error: any) {
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};
