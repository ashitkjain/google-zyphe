import { serverTimestamp } from "firebase/firestore";
import { GoogleGenAI } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult, ImageQualityAnalysisResult, PropertySpecificInvestmentResult, GeneralMarketIntelligenceResult, BiddingStrategyResult, LeadReactivationResult, AIResponseWithUsage, AIUsage } from "../types";
import { getPropertyAnalysisPrompt, propertyAnalysisSchema } from "../prompts/property/propertyAnalysis";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/property/neighborhoodAnalysis";
import { getCommunityPulsePrompt, communityPulseSchema } from "../prompts/property/communityPulse";
import { getPropertyImagesPrompt, propertyImagesSchema } from "../prompts/property/propertyImages";
import { getComprehensiveAnalysisPrompt, comprehensiveAnalysisSchema } from "../prompts/property/comprehensiveAnalysis";
import { getInvestmentResearchPrompt, investmentResearchSchema } from "../prompts/property/investmentResearch";
import { getGeneralMarketIntelligencePrompt, generalMarketIntelligenceSchema } from "../prompts/property/generalMarketIntelligence";
import { biddingStrategyPrompt } from "../prompts/property/biddingStrategy";
import { getLeadReactivationPrompt, leadReactivationSchema } from "../prompts/client/leadReactivation";
import { getLeadTransformationPrompt } from "../prompts/client/leadTransformation";
import { getGuideGenerationPrompt, guideGenerationSchema, GuideResult } from "../prompts/client/guideGeneration";
import { getDailyPulsePrompt, dailyPulseSchema } from "../prompts/leads/dailyPulse";
import { Lead } from "../types";
import { DailyPulseResult } from "../types/ai";
import { APP_CONFIG } from "../config";
import { logLLMCall, updateLLMCall } from "./firebase/llm_logs";
import { optimizePropertyForAi } from "../utils/aiOptimization";

// Use config for model selection
export const FLASH_MODEL = APP_CONFIG.models.flash;
export const FLASH_LITE_MODEL = APP_CONFIG.models.flashLite;
export const GEMINI_MODEL = FLASH_LITE_MODEL; // Legacy fallback
export const CHAT_MODEL = FLASH_LITE_MODEL;

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
export const getAi = () => {
  if (!aiInstance) {
    const apiKey = APP_CONFIG.gemini.key;
    if (!apiKey) throw new Error("Gemini API Key missing");

    // Explicitly hit Google directly to avoid routing/proxy issues on various hosts
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        baseUrl: "https://generativelanguage.googleapis.com"
      }
    });
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
  const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

  return {
    usage_metadata: usage,
    safety_ratings: candidate?.safetyRatings || null,
    finish_reason: candidate?.finishReason || null,
    citation_metadata: candidate?.citationMetadata || null,
  };
}

const MODEL_PRICING: Record<string, { input: number, output: number }> = {
  // Paid Tier (Standard) Pricing per 1M tokens (for prompts <= 128k)
  'gemini-1.5-flash': { input: 0.10 / 1000000, output: 0.40 / 1000000 },
  'gemini-1.5-pro': { input: 1.25 / 1000000, output: 5.00 / 1000000 },
  'gemini-2.0-flash': { input: 0.10 / 1000000, output: 0.40 / 1000000 },
  'gemini-2.0-flash-lite': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
  'gemini-2.5-flash': { input: 0.10 / 1000000, output: 0.40 / 1000000 },
  'gemini-2.5-flash-lite': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
  'gemini-2.0-pro-exp': { input: 1.25 / 1000000, output: 5.00 / 1000000 },
};

function calculateUsage(response: any, modelName: string): AIUsage {
  const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  const pricing = MODEL_PRICING[modelName] || MODEL_PRICING['gemini-1.5-flash'];

  // Basic calculation. Note: Pro pricing doubles for prompts > 128k, 
  // but for real estate snippets we are almost always < 128k.
  const cost = (usage.promptTokenCount * pricing.input) + (usage.candidatesTokenCount * pricing.output);

  return {
    promptTokens: usage.promptTokenCount,
    candidatesTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount,
    cost: Number(cost.toFixed(6)),
    model: modelName
  };
}

export async function urlToBase64(url: string): Promise<{ data: string, mimeType: string }> {
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

export const analyzeProperty = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<AIAnalysisResult>> => {
  const prompt = getPropertyAnalysisPrompt(optimizePropertyForAi(property) as PropertyData);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      zpid: property.zpid,
      prompt_filename: "propertyAnalysis.ts",
      llm_name: FLASH_LITE_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: FLASH_LITE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: propertyAnalysisSchema
      }
    });

    const responseText = response.text;
    const usage = calculateUsage(response, FLASH_LITE_MODEL);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return {
      data: extractJson<AIAnalysisResult>(responseText),
      usage
    };
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

export const analyzeNeighborhood = async (mapImageUrl: string, property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<NeighborhoodAnalysis>> => {
  const { data, mimeType } = await urlToBase64(mapImageUrl);
  const prompt = getNeighborhoodAnalysisPrompt(optimizePropertyForAi(property) as PropertyData);
  let logId: string | null = null;
  const sanitizedPrompt = {
    text: prompt,
    image: { mimeType, data: "<BASE64_IMAGE_DATA_OMITTED>" }
  };

  try {
    logId = await logLLMCall({
      user_id: userId,
      zpid: property.zpid,
      prompt_filename: "neighborhoodAnalysis.ts",
      llm_name: FLASH_MODEL,
      raw_payload: sanitizedPrompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
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
    const usage = calculateUsage(response, FLASH_MODEL);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return {
      data: extractJson<NeighborhoodAnalysis>(responseText),
      usage
    };
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

export const analyzeCommunityPulse = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<CommunityPulseResult>> => {
  const prompt = getCommunityPulsePrompt(optimizePropertyForAi(property) as PropertyData);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      zpid: property.zpid,
      prompt_filename: "communityPulse.ts",
      llm_name: FLASH_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: {
        tools: [groundingTool],
        temperature: 1.0
      }
    });

    const responseText = response.text;
    const usage = calculateUsage(response, FLASH_MODEL);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return {
      data: extractJson<CommunityPulseResult>(responseText),
      usage
    };
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

export const analyzePropertyImages = async (imageUrls: string[], property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<CustomAIAnalysisResult>> => {
  const selectedImages = imageUrls; // Sending all images to Gemini
  const ai = getAi();
  let logId: string | null = null;

  const imageResults = await Promise.allSettled(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType }, url };
  }));

  const successfulResults = imageResults
    .filter((result): result is PromiseFulfilledResult<{ inlineData: { data: string; mimeType: string }, url: string }> => result.status === 'fulfilled')
    .map(result => result.value);

  const imageParts = successfulResults.map(r => ({ inlineData: r.inlineData }));
  const imageTokens = successfulResults.map((r, i) => `Image ${i + 1} [TOKEN: ${r.url}]`).join('\n');

  const successfulImages = imageParts.length > 0;
  const basePrompt = getPropertyImagesPrompt(optimizePropertyForAi(property) as PropertyData);
  const textInstruction = successfulImages
    ? `${basePrompt}\n\nIMAGE TOKENS FOR YOUR REFERENCE:\n${imageTokens}`
    : `${basePrompt}\n\nNOTE: No photographs were provided for this property. Perform analysis based on detailed specifications.`;

  const requestPayload = { text: textInstruction, image_count: imageParts.length };

  try {
    logId = await logLLMCall({
      user_id: userId,
      zpid: property.zpid,
      prompt_filename: "propertyImages.ts",
      llm_name: FLASH_LITE_MODEL,
      raw_payload: requestPayload,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const response = await ai.models.generateContent({
      model: FLASH_LITE_MODEL,
      contents: { parts: [{ text: textInstruction }, ...imageParts] },
      config: {
        responseMimeType: "application/json",
        responseSchema: propertyImagesSchema
      }
    });

    const responseText = response.text;
    const usage = calculateUsage(response, FLASH_LITE_MODEL);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return {
      data: extractJson<CustomAIAnalysisResult>(responseText),
      usage
    };
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

export const analyzeComprehensive = async (property: PropertyData, visual: CustomAIAnalysisResult, userId: string = "unknown"): Promise<AIResponseWithUsage<ComprehensiveAnalysisResult>> => {
  const prompt = getComprehensiveAnalysisPrompt(optimizePropertyForAi(property) as PropertyData, visual);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      zpid: property.zpid,
      prompt_filename: "comprehensiveAnalysis.ts",
      llm_name: FLASH_LITE_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: FLASH_LITE_MODEL,
      contents: prompt,
      config: {
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: comprehensiveAnalysisSchema
      }
    });
    const responseText = response.text;
    const usage = calculateUsage(response, FLASH_LITE_MODEL);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return {
      data: extractJson<ComprehensiveAnalysisResult>(responseText),
      usage
    };
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error instanceof AiResponseError ? error.rawResponse : error.message,
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

export const analyzeInvestmentResearch = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<PropertySpecificInvestmentResult>> => {
  const prompt = getInvestmentResearchPrompt(optimizePropertyForAi(property) as PropertyData);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      zpid: property.zpid,
      prompt_filename: "investmentResearch.ts",
      llm_name: FLASH_LITE_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: FLASH_LITE_MODEL,
      contents: prompt,
      config: {
        tools: [groundingTool],
        temperature: 1.0
      }
    });

    const responseText = response.text;
    const usage = calculateUsage(response, FLASH_LITE_MODEL);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return {
      data: extractJson<PropertySpecificInvestmentResult>(responseText),
      usage
    };
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

export const analyzeGeneralMarketIntelligence = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<GeneralMarketIntelligenceResult>> => {
  const prompt = getGeneralMarketIntelligencePrompt(optimizePropertyForAi(property) as PropertyData);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      zpid: property.zpid,
      prompt_filename: "generalMarketIntelligence.ts",
      llm_name: FLASH_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: {
        tools: [groundingTool],
        temperature: 1.0
      }
    });

    const responseText = response.text;
    const usage = calculateUsage(response, FLASH_MODEL);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return {
      data: extractJson<GeneralMarketIntelligenceResult>(responseText),
      usage
    };
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

export const analyzeBiddingStrategy = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<BiddingStrategyResult>> => {
  const prompt = biddingStrategyPrompt(optimizePropertyForAi(property) as PropertyData);
  let logId: string | null = null;
  try {
    logId = await logLLMCall({
      user_id: userId,
      zpid: property.zpid,
      prompt_filename: "biddingStrategy.ts",
      llm_name: FLASH_MODEL,
      raw_payload: prompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: FLASH_MODEL,
      contents: prompt,
      config: {
        tools: [groundingTool],
        temperature: 1.0
      }
    });

    const responseText = response.text;
    const usage = calculateUsage(response, FLASH_MODEL);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update LLM log:", err));
    }

    return {
      data: extractJson<BiddingStrategyResult>(responseText),
      usage
    };
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

export const transformLeadCsv = async (csvData: string, userId: string = "unknown"): Promise<string> => {
  const prompt = getLeadTransformationPrompt(csvData);
  let logId: string | null = null;

  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "leadTransformation.ts",
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
        temperature: 0.1, // Low temperature for consistent CSV formatting
        responseMimeType: "text/plain"
      }
    });

    const responseText = response.text;

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update AI log:", err));
    }

    return responseText;
  } catch (error: any) {
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

import { functions } from './firebase/config';
import { httpsCallable } from 'firebase/functions';

export const convertDocumentToCsv = async (fileBase64: string, mimeType: string, userId: string = "unknown"): Promise<{ csv: string; usage: any }> => {
  try {
    if (!functions) {
      throw new Error("Firebase Functions not initialized. Check your config.");
    }

    const processDoc = httpsCallable(functions, 'processDocumentWithDocumentAI');
    const result: any = await processDoc({ fileBase64, mimeType });

    return {
      csv: result.data.csv,
      usage: { totalTokens: 0, cost: 0.05 } // Document AI fixed cost approx logic, or just 0
    };

  } catch (error: any) {
    console.error("Document AI Error:", error);
    throw new Error(error.message || "Failed to process document with Document AI.");
  }
};

export const generateGuide = async (category: string, title: string, userId: string = "unknown"): Promise<GuideResult> => {
  const prompt = getGuideGenerationPrompt(category, title);
  let logId: string | null = null;

  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "guideGeneration.ts",
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
        temperature: 0.7,
      }
    });

    const responseText = response.text;

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update AI log:", err));
    }

    return extractJson<GuideResult>(responseText);
  } catch (error: any) {
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

export const generateGuideImage = async (category: string, title: string, topicSlug: string, guideSlug: string, userId: string = "unknown"): Promise<string | null> => {
  // Use static public assets instead of dynamic generation
  // Images are stored in /public/guide-images/{topicSlug}/{guideSlug}.png
  const imagePath = `/guide-images/${topicSlug}/${guideSlug}.png`;

  // Check if image exists by attempting to fetch it
  try {
    const response = await fetch(imagePath, { method: 'HEAD' });
    if (response.ok) {
      console.log(`[Image] Using static image: ${imagePath}`);
      return imagePath;
    }
  } catch (error) {
    // Image doesn't exist, that's okay
  }

  console.log(`[Image] No image found for: ${topicSlug}/${guideSlug}`);
  return null;
};

export const generateDailyPulse = async (leads: Lead[], userId: string = "unknown"): Promise<AIResponseWithUsage<DailyPulseResult>> => {
  const { systemInstruction, prompt: userPrompt } = getDailyPulsePrompt(leads);
  const combinedPrompt = `${systemInstruction}\n\n${userPrompt}`;
  let logId: string | null = null;
  const modelToUse = FLASH_MODEL;

  try {
    logId = await logLLMCall({
      user_id: userId,
      prompt_filename: "dailyPulse.ts",
      llm_name: modelToUse,
      raw_payload: combinedPrompt,
      raw_response: null,
      status: 'pending',
      request_sent_at: serverTimestamp()
    });

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
      config: {
        temperature: 1.0,
        responseMimeType: "application/json",
        responseSchema: dailyPulseSchema as any
      }
    });

    const responseText = response.text;
    const usage = calculateUsage(response, modelToUse);

    if (logId) {
      updateLLMCall(logId, {
        raw_response: responseText,
        status: 'completed',
        response_received_at: serverTimestamp(),
        usage_metadata: response.usageMetadata,
        estimated_cost: usage.cost,
        ...extractMetadata(response)
      }).catch(err => console.error("Failed to update AI log:", err));
    }

    return {
      data: extractJson<DailyPulseResult>(responseText),
      usage
    };
  } catch (error: any) {
    if (logId) {
      updateLLMCall(logId, {
        raw_response: error.message,
        status: 'failed',
        error: error.stack || error.message,
        response_received_at: serverTimestamp()
      }).catch(err => console.error("Failed to update AI error log:", err));
    }

    if (error instanceof AiResponseError) {
      error.prompt = combinedPrompt;
      throw error;
    }
    throw new AiResponseError(error.message, "Raw API Error", combinedPrompt);
  }
};
