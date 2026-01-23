import { serverTimestamp } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult, ImageQualityAnalysisResult, InvestmentResearchResult, BiddingStrategyResult, LeadReactivationResult } from "../types";
import { getPropertyAnalysisPrompt, propertyAnalysisSchema } from "../prompts/propertyAnalysis";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/neighborhoodAnalysis";
import { getCommunityPulsePrompt, communityPulseSchema } from "../prompts/communityPulse";
import { getPropertyImagesPrompt, propertyImagesSchema } from "../prompts/propertyImages";
import { getComprehensiveAnalysisPrompt } from "../prompts/comprehensiveAnalysis";
import { getImageQualityAnalysisPrompt, imageQualityAnalysisSchema } from "../prompts/imageQualityAnalysis";
import { getInvestmentResearchPrompt, investmentResearchSchema } from "../prompts/investmentResearch";
import { biddingStrategyPrompt } from "../prompts/biddingStrategy";
import { getLeadReactivationPrompt, leadReactivationSchema } from "../prompts/leadReactivation";
import { APP_CONFIG } from "../config";
import { logLLMCall, updateLLMCall } from "./firebase/llm_logs";

// Use config for model selection
export const GEMINI_MODEL = APP_CONFIG.models.default;
export const BIDDING_MODEL = APP_CONFIG.models.bidding_strategy;

const groundingTool = { googleSearch: {} };

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

function extractMetadata(response: any) {
  const candidate = response.candidates?.[0];
  return {
    usage_metadata: response.usageMetadata || null,
    safety_ratings: candidate?.safetyRatings || null,
    finish_reason: candidate?.finishReason || null,
    citation_metadata: candidate?.citationMetadata || null,
  };
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
    throw error;
  }
}

export const analyzeProperty = async (property: PropertyData, userId: string = "unknown"): Promise<AIAnalysisResult> => {
  const prompt = getPropertyAnalysisPrompt(property);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "propertyAnalysis.ts",
      llm_name: GEMINI_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: propertyAnalysisSchema
      }
    });

    const responseText = response.text;
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return extractJson<AIAnalysisResult>(responseText);
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update LLM error log:", err));
    }
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzeNeighborhood = async (mapImageUrl: string, property: PropertyData, userId: string = "unknown"): Promise<NeighborhoodAnalysis> => {
  const { data, mimeType } = await urlToBase64(mapImageUrl);
  const prompt = getNeighborhoodAnalysisPrompt(property);
  let logId: string | null = null;
  const sanitizedPrompt = {
    text: prompt,
    image: { mimeType, data: "<BASE64_IMAGE_DATA_OMITTED>" }
  };

  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "neighborhoodAnalysis.ts",
      llm_name: GEMINI_MODEL,
      raw_payload: sanitizedPrompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

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

    const responseText = response.text;
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return extractJson<NeighborhoodAnalysis>(responseText);
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update LLM error log:", err));
    }
    if (error instanceof AiResponseError) {
      error.prompt = sanitizedPrompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", sanitizedPrompt);
  }
};

export const analyzeCommunityPulse = async (property: PropertyData, userId: string = "unknown"): Promise<CommunityPulseResult> => {
  const prompt = getCommunityPulsePrompt(property);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "communityPulse.ts",
      llm_name: GEMINI_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [groundingTool],
        temperature: 1.0
      }
    });

    const responseText = response.text;
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return extractJson<CommunityPulseResult>(responseText);
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update LLM error log:", err));
    }
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzePropertyImages = async (imageUrls: string[], property: PropertyData, userId: string = "unknown"): Promise<CustomAIAnalysisResult> => {
  const selectedImages = imageUrls.slice(0, 15);
  const ai = getAi();
  let logId: string | null = null;

  const imageResults = await Promise.allSettled(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType } };
  }));

  const imageParts = imageResults
    .filter((result): result is PromiseFulfilledResult<{ inlineData: { data: string; mimeType: string } }> => result.status === 'fulfilled')
    .map(result => result.value);

  const successfulImages = imageParts.length > 0;
  const textInstruction = successfulImages
    ? getPropertyImagesPrompt(property)
    : `${getPropertyImagesPrompt(property)}\n\nNOTE: No photographs were provided for this property. Perform analysis based on detailed specifications.`;

  const requestPayload = { text: textInstruction, image_count: imageParts.length };

  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "propertyImages.ts",
      llm_name: GEMINI_MODEL,
      raw_payload: requestPayload,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts: [{ text: textInstruction }, ...imageParts] },
      config: {
        responseMimeType: "application/json",
        responseSchema: propertyImagesSchema
      }
    });

    const responseText = response.text;
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return extractJson<CustomAIAnalysisResult>(responseText);
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update LLM error log:", err));
    }

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

export const analyzeComprehensive = async (property: PropertyData, visual: CustomAIAnalysisResult, userId: string = "unknown"): Promise<ComprehensiveAnalysisResult> => {
  const prompt = getComprehensiveAnalysisPrompt(property, visual);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "comprehensiveAnalysis.ts",
      llm_name: GEMINI_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [groundingTool],
        temperature: 1.0,
      }
    });
    const responseText = response.text;
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return extractJson<ComprehensiveAnalysisResult>(responseText);
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update LLM error log:", err));
    }
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzeImageQuality = async (imageUrls: string[], userId: string = "unknown"): Promise<ImageQualityAnalysisResult> => {
  const ai = getAi();
  const selectedImages = imageUrls.slice(0, 15);
  let logId: string | null = null;

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
  const requestPayload = { text: prompt, image_count: imageParts.length };

  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "imageQualityAnalysis.ts",
      llm_name: GEMINI_MODEL,
      raw_payload: requestPayload,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

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

    const responseText = response.text;
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return extractJson<ImageQualityAnalysisResult>(responseText);
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update LLM error log:", err));
    }

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

export const analyzeInvestmentResearch = async (property: PropertyData, userId: string = "unknown"): Promise<InvestmentResearchResult> => {
  const prompt = getInvestmentResearchPrompt(property);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "investmentResearch.ts",
      llm_name: GEMINI_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [groundingTool],
        temperature: 1.0
      }
    });

    const responseText = response.text;
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return extractJson<InvestmentResearchResult>(responseText);
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update LLM error log:", err));
    }
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzeBiddingStrategy = async (property: PropertyData, userId: string = "unknown"): Promise<BiddingStrategyResult> => {
  const prompt = biddingStrategyPrompt(property);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "biddingStrategy.ts",
      llm_name: BIDDING_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: BIDDING_MODEL,
      contents: prompt,
      config: {
        tools: [groundingTool],
        temperature: 1.0
      }
    });

    const responseText = response.text;
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return extractJson<BiddingStrategyResult>(responseText);
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update LLM error log:", err));
    }
    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};

export const analyzeLeadDatabase = async (rawData: string, userId: string = "unknown"): Promise<{ result: LeadReactivationResult; llmCallId?: string }> => {
  const prompt = getLeadReactivationPrompt(rawData);
  let logId: string | null = null;

  try {
    // 1. Log the request immediately
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "leadReactivation.ts",
      llm_name: GEMINI_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    console.log(`[${new Date().toISOString()}] AI REQUEST: analyzeLeadDatabase`);

    // 2. Execute the AI call
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: leadReactivationSchema
      }
    });

    const responseText = response.text;
    console.log(`[${new Date().toISOString()}] AI RESPONSE RECEIVED: analyzeLeadDatabase. LogId present: ${!!logId}`);

    // 3. Update the log with the response
    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update AI log:", err));
    }

    return {
      result: extractJson<LeadReactivationResult>(responseText),
      llmCallId: logId || undefined
    };
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] AI ERROR: analyzeLeadDatabase`, error);

    // 4. Update the log with the error
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update AI error log:", err));
    }

    if (error instanceof AiResponseError) {
      error.prompt = prompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", prompt);
  }
};
