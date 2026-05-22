import { GoogleGenAI } from "@google/genai";
import { getDaysOnMarket } from '../utils/property';
import { serverTimestamp } from "firebase/firestore";
import {
  PropertyData,
  CustomAIAnalysisResult,
  NeighborhoodAnalysis,
  CommunityPulseResult,
  ComprehensiveAnalysisResult,
  ImageQualityAnalysisResult,
  PropertySpecificInvestmentResult,
  GeneralMarketIntelligenceResult,
  DeepInvestmentResearchResult,
  DeepResearchInsights,

  LeadReactivationResult,
  AIResponseWithUsage,
  AIUsage,
  ContextGraphExtractionResult
} from "../types";
import { getNeighborhoodAnalysisPrompt, neighborhoodAnalysisSchema } from "../prompts/property/neighborhoodAnalysis";
import { getCommunityPulsePrompt, communityPulseSchema } from "../prompts/property/communityPulse";
import { getLifestyleInsightsPrompt, lifestyleInsightsSchema } from "../prompts/property/lifestyleInsights";
import { getPropertyImagesPrompt, propertyImagesSchema } from "../prompts/property/propertyImages";
import { getComprehensiveAnalysisPrompt, comprehensiveAnalysisSchema } from "../prompts/property/comprehensiveAnalysis";
import { getInvestmentResearchPrompt, investmentResearchSchema } from "../prompts/property/investmentResearch";
import { getGeneralMarketIntelligencePrompt, generalMarketIntelligenceSchema } from "../prompts/property/generalMarketIntelligence";
import { getDeepInvestmentResearchPrompt, deepInvestmentResearchSchema } from "../prompts/property/deepInvestmentResearch";
import { getDeepResearchInsightsPrompt, deepResearchInsightsSchema } from "../prompts/property/deepResearchInsights";

import { getInteriorSummaryPrompt, interiorSummarySchema } from "../prompts/property/interiorSummary";
import { getCommuteDestinationsPrompt, commuteDestinationsSchema, CommuteDestinationsResult } from "../prompts/property/commuteDestinations";
import { buildGraphExtractionContext, getContextGraphExtractionPrompt, contextGraphExtractionSchema } from "../prompts/property/contextGraphExtraction";
import { buildCityContextGraphContext, getCityContextGraphPrompt, cityContextGraphSchema, CityContextGraphResult } from "../prompts/property/cityContextGraphExtraction";
import { getBuyerDnaCompressionPrompt, buyerDnaCompressionSchema } from "../prompts/property/buyerDnaCompression";
import { precomputeDataFactors } from "../utils/contextGraphPrecompute";
import { DELETED_FACTOR_IDS, PRECOMPUTED_FACTOR_IDS } from "../constants/contextGraphFactors";

import {
  getCommunityPulseFromCloud,
  getGeneralMarketIntelligenceFromCloud,
  getDeepInvestmentResearchFromCloud,
  setCityResearchFlag,
  saveCommunityPulseToCloud,
  saveGeneralMarketIntelligenceToCloud,
  saveDeepInvestmentResearchToCloud,
  saveCityNeighborhoodsToCloud,
  getCityNeighborhoodsFromCloud,
  getPropertiesByCity
} from "./firebase/properties";
import { generateCityStateKey } from "./firebase/config";

import { getLeadReactivationPrompt, leadReactivationSchema } from "../prompts/client/leadReactivation";
import { getLeadTransformationPrompt } from "../prompts/client/leadTransformation";
import { getGuideGenerationPrompt, guideGenerationSchema, GuideResult } from "../prompts/client/guideGeneration";
import { getDailyPulsePrompt, dailyPulseSchema } from "../prompts/leads/dailyPulse";
import { Lead, CRMTask, CalendarEvent } from "../types";
import { executePythonDeepResearch } from "./pythonResearchService";
import { DailyPulseResult, PollenAnalysisResult } from "../types/ai";
import { getPollenAnalysisPrompt, pollenAnalysisSchema } from "../prompts/property/pollenAnalysis";
import { getNeighborhoodNarrativePrompt, neighborhoodNarrativeSchema } from "../prompts/property/neighborhoodNarrative";
import { getMitLivingWagePrompt, mitLivingWageSchema, MitLivingWageResult, MitLivingWageParams } from "../prompts/property/mitLivingWage";
import { APP_CONFIG } from "../config";
import { logLLMCall, updateLLMCall } from "./firebase/llm_logs";
import { optimizePropertyForAi, optimizeVisualForAi } from "../utils/aiOptimization";



// Use config for model selection
export const FLASH_MODEL = APP_CONFIG.models.flash;
export const FLASH_LITE_MODEL = APP_CONFIG.models.flashLite;
export const GEMINI_MODEL = FLASH_MODEL;
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
let lastUsedKey: string | null = null;

export const getAi = async () => {
    const currentKey = APP_CONFIG.gemini.key;
    
    // If first time or key has been updated (e.g. patched by loader)
    if (!aiInstance || currentKey !== lastUsedKey) {
        // Load all API keys from Firestore if we don't have a key yet
        if (!currentKey) {
            const { loadApiKeys } = await import('./apiKeyLoader');
            await loadApiKeys();
        }

        let apiKey = APP_CONFIG.gemini.key;
        if (!apiKey) {
            apiKey = process.env.VITE_GEMINI_API_KEY || '';
            if (apiKey) (APP_CONFIG as any).gemini.key = apiKey;
        }

        if (!apiKey) {
            console.warn('[Gemini] API Key missing. Service will likely fail.');
        }

        // Explicitly hit Google directly to avoid routing/proxy issues
        aiInstance = new GoogleGenAI({
            apiKey: apiKey || '',
            httpOptions: {
                baseUrl: "https://generativelanguage.googleapis.com"
            }
        });
        lastUsedKey = apiKey;
        if (apiKey) {
            console.log(`[Gemini] AI client initialized with key ending in ...${apiKey.slice(-4)}`);
        }
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

  // Strip markdown bold markers (**text**) inside string values
  cleaned = cleaned.replace(/\*\*/g, '');

  const tryParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  };

  // Repair helper: fix common LLM JSON malformations
  const repairJson = (str: string): string => {
    let result = '';
    let inString = false;
    let escaped = false;
    
    // Pass 1: Handle escaped characters and literal newlines in strings
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (escaped) { result += ch; escaped = false; continue; }
      if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
      if (ch === '"') { inString = !inString; result += ch; continue; }
      if (inString && (ch === '\n' || ch === '\r')) { result += '\\n'; continue; }
      if (inString && ch === '\t') { result += '\\t'; continue; }
      result += ch;
    }

    // Pass 2: Aggressive structural fixes
    // 1. Remove trailing commas before } or ]
    result = result.replace(/,\s*([}\]])/g, '$1');
    
    // 2. Fix missing commas between property values and next keys
    // Example: "key": "value" "next_key" -> "key": "value", "next_key"
    // Matches: [quote, digit, boolean, or closing bracket/brace] followed by whitespace/newline then another quote
    result = result.replace(/("|\d|true|false|null|\]|\})\s*\n?\s*"/g, '$1,\n"');
    
    // 3. Fix double commas or comma-brace mismatches
    result = result.replace(/,+/g, ',');
    result = result.replace(/\{,/g, '{');
    result = result.replace(/\[,/g, '[');
    result = result.replace(/,}/g, '}');
    result = result.replace(/,]/g, ']');

    return result;
  };

  // 1. Try direct parse
  let result = tryParse(cleaned);
  if (result) return result;

  // 1b. Try repaired parse
  result = tryParse(repairJson(cleaned));
  if (result) return result;

  // 2. Try to find content inside markdown code blocks
  const markdownMatches = [...cleaned.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (const match of markdownMatches) {
    if (match[1]) {
      const candidate = match[1].trim();
      result = tryParse(candidate) || tryParse(repairJson(candidate));
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
          result = tryParse(candidate) || tryParse(repairJson(candidate));
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

// Global concurrency semaphore to manage rate limits across parallel tasks
let currentActiveRequests = 0;
const MAX_CONCURRENT_REQUESTS = 2; // Strict limit to protect Free/Low tier quotas
const requestQueue: (() => void)[] = [];

const throttleRequest = async () => {
  if (currentActiveRequests < MAX_CONCURRENT_REQUESTS) {
    currentActiveRequests++;
    return;
  }
  return new Promise<void>((resolve) => {
    requestQueue.push(resolve);
  });
};

const releaseRequest = () => {
  currentActiveRequests--;
  if (requestQueue.length > 0) {
    currentActiveRequests++;
    const next = requestQueue.shift();
    if (next) next();
  }
};

export const executeGeminiRequest = async <T>(
  params: {
    model: string;
    contents: any;
    config?: any;
    userId?: string;
    promptFilename: string;
    zpid?: string;
    address?: string;
    extractResultJson?: boolean;
    schema?: any;
    imageUrls?: string[];
    skipWatchdog?: boolean;  // Skip logging + token counting for parallel batch calls
  }
): Promise<{ data: T; usage: AIUsage; sources?: { url: string; title: string }[] | null; rawResponse: any }> => {
  const { model, contents, config, userId, promptFilename, zpid, address, extractResultJson, schema, imageUrls, skipWatchdog } = params;
  console.log(`[Gemini] Starting ${promptFilename} (model: ${model}, skipWatchdog: ${!!skipWatchdog})`);
  const ai = await getAi();

  const logId = skipWatchdog ? null : await logLLMCall({
    user_id: userId || "unknown",
    zpid,
    address,
    prompt_filename: promptFilename,
    llm_name: model,
    raw_payload: {
      contents: dehydratePayload(contents),
      system_instruction: config?.systemInstruction,
      tools: config?.tools
    },
    raw_response: null,
    status: 'pending',
    request_sent_at: serverTimestamp()
  });

  // Apply concurrency throttling
  await throttleRequest();

  try {
    // Helper: sleep with jitter
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const isRateLimitError = (e: any) =>
      e?.status === 429 ||
      e?.code === 429 ||
      String(e?.message || '').includes('429') ||
      String(e?.message || '').toLowerCase().includes('resource_exhausted') ||
      String(e?.message || '').toLowerCase().includes('resource exhausted');

    const MAX_RETRIES = 6;
    let attempt = 0;

    // spread out parallel batch calls to avoid immediate synchronized 429s
    if (skipWatchdog) {
      await sleep(Math.random() * 3000);
    }

    while (true) {
      try {
        // 1. WATCHDOG: Token Limit Enforcement (skip for parallel batch calls)
        const formattedContents = Array.isArray(contents)
          ? contents
          : (contents && typeof contents === 'object' && 'parts' in contents)
            ? [contents]
            : [{ parts: [{ text: String(contents) }] }];

        let finalConfig: any;
        if (skipWatchdog) {
          finalConfig = { ...config };
        } else {
          const instructionPart = config?.systemInstruction ? { parts: [{ text: config.systemInstruction }] } : undefined;
          const tokenCountResponse = await (ai.models as any).countTokens({
            model,
            contents: formattedContents,
            systemInstruction: instructionPart
          });

          const inputTokens = tokenCountResponse.totalTokens;
          const MAX_TOTAL_TOKENS = 150000;

          if (inputTokens > MAX_TOTAL_TOKENS) {
            throw new Error(`Input token count (${inputTokens}) exceeds hard limit of ${MAX_TOTAL_TOKENS}`);
          }

          const remainingTokens = Math.max(0, MAX_TOTAL_TOKENS - inputTokens);
          finalConfig = {
            ...config,
            maxOutputTokens: Math.min(config?.maxOutputTokens || 16384, remainingTokens)
          };
        }

        const hasSearchTool = config?.tools?.some((t: any) => t.google_search_retrieval || t.googleSearch);
        const isGemini3 = model.startsWith('gemini-3');

        if (schema && (!hasSearchTool || isGemini3)) {
          finalConfig.responseMimeType = "application/json";
          if (isGemini3 && hasSearchTool) {
            finalConfig.responseJsonSchema = schema;
          } else {
            finalConfig.responseSchema = schema;
          }
        }

        // 3. Perform Generation
        console.log(`[Gemini] Calling generateContent for ${promptFilename}...`);
        const result = await (ai.models as any).generateContent({
          model: model,
          contents: formattedContents,
          config: finalConfig,
        });

        console.log(`[Gemini] Response received for ${promptFilename}`);
        const responseText = typeof result.text === 'function' ? result.text() : result.text;
        const usage = calculateUsage(result, model);

        const finishReason = result.candidates?.[0]?.finishReason;
        if (!responseText) {
          console.error(`[Gemini] Empty response for ${promptFilename}. finishReason=${finishReason}`);
        }

        // 4. Extract data
        let data: T;
        try {
          data = extractResultJson ? extractJson<T>(responseText) : responseText as unknown as T;
        } catch (parseErr: any) {
          console.error(`[Gemini] JSON parse failed for ${promptFilename}. Raw output:`, responseText);
          throw parseErr;
        }

        const metadata = extractMetadata(result);

        // 5. Update Log
        if (logId) {
          await updateLLMCall(logId, {
            raw_response: responseText,
            status: 'completed',
            response_received_at: serverTimestamp(),
            usage_metadata: (result.usageMetadata as any),
            estimated_cost: usage.cost,
            ...metadata
          });
        }

        return {
          data,
          usage,
          sources: metadata.sources,
          rawResponse: result
        };
      } catch (error: any) {
        if (isRateLimitError(error) && attempt < MAX_RETRIES) {
          attempt++;
          const baseDelay = Math.pow(2, attempt) * 2000;
          const jitter = Math.random() * 2000;
          const delay = baseDelay + jitter;
          console.warn(`[Gemini] 429 rate limit hit (${promptFilename}), releasing slot and retrying in ${Math.round(delay / 1000)}s...`);

          // CRITICAL: Release the semaphore slot while we sleep so we don't block other requests
          releaseRequest();
          await sleep(delay);
          await throttleRequest();
          continue;
        }

        if (logId) {
          await updateLLMCall(logId, {
            raw_response: error.message,
            status: 'failed',
            error: error.stack || String(error),
            response_received_at: serverTimestamp()
          });
        }

        if (error instanceof AiResponseError) throw error;
        throw new AiResponseError(error.message || "AI Execution Error", "ERROR", contents);
      }
    }
  } finally {
    releaseRequest();
  }
};



function extractMetadata(response: any) {
  const candidate = response.candidates?.[0];
  const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

  // Extract grounding sources from Google Search tool
  const groundingMetadata = candidate?.groundingMetadata;
  const groundingChunks = groundingMetadata?.groundingChunks || [];
  const sources = groundingChunks
    .filter((chunk: any) => chunk.web?.uri)
    .map((chunk: any) => ({
      url: chunk.web.uri,
      title: chunk.web.title || ''
    }));

  return {
    usage_metadata: usage,
    safety_ratings: candidate?.safetyRatings || null,
    finish_reason: candidate?.finishReason || null,
    citation_metadata: candidate?.citationMetadata || null,
    grounding_metadata: groundingMetadata || null,
    sources: sources.length > 0 ? sources : null,
  };
}

const MODEL_PRICING: Record<string, { input: number, output: number, cached?: number }> = {
  'gemini-2.5-flash': { input: 0.10 / 1000000, output: 0.40 / 1000000, cached: 0.01 / 1000000 },
  'gemini-2.5-flash-lite': { input: 0.075 / 1000000, output: 0.30 / 1000000, cached: 0.01 / 1000000 },
  'gemini-1.5-pro': { input: 1.25 / 1000000, output: 5.00 / 1000000, cached: 0.3125 / 1000000 },
  'gemini-2.0-pro-exp': { input: 1.25 / 1000000, output: 5.00 / 1000000 },
  'gemini-3-flash-preview': { input: 0.10 / 1000000, output: 0.40 / 1000000 },
};

function calculateUsage(response: any, modelName: string): AIUsage {
  const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };
  const pricing = MODEL_PRICING[modelName] || MODEL_PRICING['gemini-2.5-flash'];

  // Basic calculation. Adjust for cached tokens if present.
  const cachedTokens = usage.cachedContentTokenCount || 0;
  const regularTokens = usage.promptTokenCount - cachedTokens;

  const cost = (regularTokens * pricing.input) +
    (cachedTokens * (pricing as any).cached || pricing.input) +
    (usage.candidatesTokenCount * pricing.output);

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
    // 1. Aggressive Proxy for known CORS-restricted domains in BROWSER environment
    const isFirebase = url.includes("firebasestorage.googleapis.com");
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser && !isFirebase && (url.includes("maps.googleapis.com") || url.includes("api.radar.io") || url.includes("zillowstatic.com") || url.includes("rent.net") || url.includes("static.com"))) {
      console.log(`[urlToBase64] Domain detected for proxy in browser: ${url}`);
      try {
        const { functions } = await import('./firebase/config');
        const { httpsCallable } = await import('firebase/functions');
        if (functions) {
          const proxyFunc = httpsCallable(functions, 'proxyStreetViewImage');
          const result: any = await proxyFunc({ url });
          return { data: result.data.base64, mimeType: result.data.mimeType };
        }
      } catch (proxyError: any) {
        console.warn("[urlToBase64] Proxy fetch failed:", proxyError.message);
      }
    }

    // 2. Standard direct fetch (with proxy fallback for any failure)
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }
      const blob = await response.blob();
      const mimeType = blob.type;

      // Browser fallback (FileReader)
      if (typeof FileReader !== 'undefined') {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            if (!result) { reject(new Error("Empty result from FileReader")); return; }
            const base64String = result.split(',')[1];
            resolve({ data: base64String, mimeType });
          };
          reader.onerror = () => reject(new Error("FileReader failed"));
          reader.readAsDataURL(blob);
        });
      } else {
        // Node.js fallback (Buffer)
        const arrayBuffer = await blob.arrayBuffer();
        const base64String = Buffer.from(arrayBuffer).toString('base64');
        return { data: base64String, mimeType };
      }
    } catch (e: any) {
      console.log(`[urlToBase64] Direct fetch failed for ${url}: ${e.message}. Attempting proxy as last resort...`);
      try {
        const { functions } = await import('./firebase/config');
        const { httpsCallable } = await import('firebase/functions');
        if (functions) {
          const proxyFunc = httpsCallable(functions, 'proxyStreetViewImage');
          const result: any = await proxyFunc({ url });
          return { data: result.data.base64, mimeType: result.data.mimeType };
        }
      } catch (proxyErr: any) {
        throw new Error(`Both direct and proxy fetch failed: ${proxyErr.message}`);
      }
      throw e;
    }
  } catch (error: any) {
    console.warn(`Image fetch failed for ${url}:`, error.message);
    throw error;
  }
}


export const analyzeNeighborhood = async (mapZoomIn: string, mapZoomOut: string, property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<NeighborhoodAnalysis>> => {
  const [img1, img2] = await Promise.all([
    urlToBase64(mapZoomIn),
    urlToBase64(mapZoomOut)
  ]);

  const prompt = getNeighborhoodAnalysisPrompt(property, (property as any).google_places ?? undefined);

  return executeGeminiRequest<NeighborhoodAnalysis>({
    model: FLASH_MODEL,
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data: img1.data, mimeType: img1.mimeType } },
        { inlineData: { data: img2.data, mimeType: img2.mimeType } }
      ]
    },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "neighborhoodAnalysis.ts",
    extractResultJson: true,
    schema: neighborhoodAnalysisSchema,
    imageUrls: [mapZoomIn, mapZoomOut]
  });
};

export const analyzeNeighborhoodNarrative = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<{ narrative: string }>> => {
  const prompt = getNeighborhoodNarrativePrompt(property, (property as any).google_places);

  console.log(`[Neighborhood Narrative] Starting for ${property.address}...`);

  return executeGeminiRequest<{ narrative: string }>({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: { temperature: 0.7 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "neighborhoodNarrative.ts",
    extractResultJson: true,
    schema: neighborhoodNarrativeSchema
  });
};



export const analyzeCommunityPulse = async (property: PropertyData, userId: string = "unknown", zpid?: string, onLog?: (msg: string) => void): Promise<AIResponseWithUsage<CommunityPulseResult>> => {
  const prompt = getCommunityPulsePrompt(optimizePropertyForAi(property) as PropertyData);

  onLog?.(`[Community Pulse] Running with gemini-2.5-flash + Google Search grounding for ${property.city}...`);
  console.log(`[Community Pulse] Starting for ${property.city}, ${property.state}...`);

  return executeGeminiRequest<CommunityPulseResult>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { tools: [groundingTool], temperature: 0.7 },
    userId,
    zpid: zpid || property.zpid,
    address: property.address,
    promptFilename: "communityPulse.ts",
    extractResultJson: true,
    schema: communityPulseSchema
  });
};

export const analyzeCommuteDestinations = async (city: string, state: string, userId: string = "unknown"): Promise<AIResponseWithUsage<CommuteDestinationsResult>> => {
  const prompt = getCommuteDestinationsPrompt({ city, state });

  console.log(`[Commute Destinations] Starting for ${city}, ${state}...`);

  return executeGeminiRequest<CommuteDestinationsResult>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { tools: [groundingTool], temperature: 0.5 },
    userId,
    promptFilename: "commuteDestinations.ts",
    extractResultJson: true,
    schema: commuteDestinationsSchema
  });
};

export interface LifestyleInsightsResult {
  outdoor: string;
  family: string;
  senior: string;
  pets: string;
  food: string;
  professionals: string;
}

export const analyzeLifestyleInsights = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<LifestyleInsightsResult>> => {
  const prompt = getLifestyleInsightsPrompt(optimizePropertyForAi(property) as PropertyData);

  console.log(`[Lifestyle Insights] Starting for ${property.address}...`);

  return executeGeminiRequest<LifestyleInsightsResult>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { tools: [groundingTool], temperature: 0.7 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "lifestyleInsights.ts",
    extractResultJson: true,
    schema: lifestyleInsightsSchema
  });
};

export const analyzeLifestyleFit = async (
  property: PropertyData,
  visual: CustomAIAnalysisResult | null,
  streetView: any | null,
  userId: string = "unknown",
  comprehensiveSummary: string | null = null
): Promise<{ data: any; usage?: any }> => {
  const { getLifestyleFitPrompt, lifestyleFitSchema } = await import("../prompts/property/lifestyleFit");
  const prompt = getLifestyleFitPrompt(
    optimizePropertyForAi(property) as PropertyData,
    visual ? optimizeVisualForAi(visual) as CustomAIAnalysisResult : null,
    streetView,
    comprehensiveSummary
  );

  console.log(`[Lifestyle Fit] Starting for ${property.address}...`);

  return executeGeminiRequest<any>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.5 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "lifestyleFit.ts",
    extractResultJson: true,
    schema: lifestyleFitSchema
  });
};

export const analyzeSchool = async (school: any, property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<any>> => {
  const { getSchoolAnalysisPrompt, schoolAnalysisSchema } = await import("../prompts/property/schoolsAnalysis");
  const prompt = getSchoolAnalysisPrompt(school, optimizePropertyForAi(property) as PropertyData);

  console.log(`[Schools Intelligence] Analyzing: ${school.name}...`);

  return executeGeminiRequest<any>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { tools: [groundingTool], temperature: 0.5 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "schoolsAnalysis.ts",
    extractResultJson: true,
    schema: schoolAnalysisSchema
  });
};

// ── City-Level Context Graph ──────────────────────────────────────────────

export const extractCityContextGraph = async (
  city: string,
  state: string,
  deepInvestmentResearch: any | null,
  communityPulse: any | null,
  userId: string = "unknown"
): Promise<AIResponseWithUsage<CityContextGraphResult>> => {
  const context = buildCityContextGraphContext(city, state, deepInvestmentResearch, communityPulse);
  const prompt = getCityContextGraphPrompt(context);

  console.log(`[City Context Graph] Extracting 14 city-level factors for ${city}, ${state}...`);

  const result = await executeGeminiRequest<CityContextGraphResult>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.3, maxOutputTokens: 4096 },
    userId,
    promptFilename: "cityContextGraphExtraction.ts",
    extractResultJson: true,
    schema: cityContextGraphSchema
  });

  if (result.data) {
    result.data.lastUpdated = new Date();
  }
  return result;
};

// ── Property-Level Context Graph ──────────────────────────────────────────

export const extractContextGraphFactors = async (
  property: PropertyData,
  visual: CustomAIAnalysisResult | null,
  comprehensive: ComprehensiveAnalysisResult | null,
  visionExtension: any | null = null,
  userId: string = "unknown"
): Promise<AIResponseWithUsage<ContextGraphExtractionResult>> => {
  // 1. Pre-compute the 35 pure-data factors client-side (no AI tokens)
  const precomputed = precomputeDataFactors(property, visual, comprehensive);

  // 2. Determine which factors were ACTUALLY successful (not blank) to skip in AI prompt
  const successfulSkipIds = Array.from(precomputed.entries())
    .filter(([, f]) => (f.tags && f.tags.length > 0) || (f.value && f.value.trim().length > 0))
    .map(([id]) => id);

  console.log(`[Context Graph] Pre-computed ${precomputed.size} factors. Skipping ${successfulSkipIds.length} successful factors in AI prompt.`);

  // 3. Build context and prompt, telling AI to skip only successfully pre-computed IDs
  const context = buildGraphExtractionContext(property, visual, comprehensive, visionExtension);
  const prompt = getContextGraphExtractionPrompt(context, successfulSkipIds);

  console.log(`[Context Graph] Requesting AI for remaining ${111 - successfulSkipIds.length} factors for ${property.address}...`);

  // 3. Call Gemini for the remaining factors
  const aiResult = await executeGeminiRequest<ContextGraphExtractionResult>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.3, maxOutputTokens: 32768 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "contextGraphExtraction.ts",
    extractResultJson: true,
    schema: contextGraphExtractionSchema
  });

  // 4. Merge: pre-computed factors take precedence, AI fills the rest
  const aiFactors: any[] = aiResult.data?.factors ?? [];
  const mergedFactors = [...aiFactors];

  for (const [id, factor] of precomputed.entries()) {
    const hasData = (factor.tags && factor.tags.length > 0) || (factor.value && factor.value.trim().length > 0);
    if (!hasData) continue;

    const existingIdx = mergedFactors.findIndex(f => f.id === id);
    if (existingIdx >= 0) {
      // Replace AI version with our accurate computed version
      mergedFactors[existingIdx] = factor;
    } else {
      mergedFactors.push(factor);
    }
  }

  // Sort by factor ID for consistent ordering
  mergedFactors.sort((a, b) => a.id - b.id);

  // 5. Build keyMetrics — hard numbers for downstream filter queries (zero AI)
  const hoaRaw = property.resoFacts?.feesAndDues;
  // Extract the first dollar/number pattern — old regex stripped all non-digits and concatenated multiple numbers
  const hoaNum = (() => {
    if (!hoaRaw) return null;
    const s = String(hoaRaw);
    // If it's already a plain number, use it directly
    if (typeof hoaRaw === 'number') return hoaRaw;
    // Match first dollar amount or standalone number (e.g. "$62.99", "250", "62.99/month")
    const match = s.match(/\$?([\d,]+(?:\.\d+)?)/);
    if (!match) return null;
    const val = parseFloat(match[1].replace(/,/g, ''));
    return isNaN(val) || val <= 0 ? null : val;
  })();
  const garageRaw = property.resoFacts?.garageParkingCapacity;
  const garageSpaces = garageRaw != null ? (typeof garageRaw === 'number' ? garageRaw : parseInt(String(garageRaw)) || null) : null;
  const schoolMinRating = property.schools?.length ? Math.min(...property.schools.map(s => typeof s.rating === 'number' ? s.rating : parseFloat(String(s.rating)) || 0)) : null;
  const price = property.price ?? property.zestimate;
  const sqft = property.livingAreaValue;

  const keyMetrics: any = {
    price: price ?? null,
    sqft: sqft ?? null,
    pricePerSqft: price && sqft ? Math.round(price / sqft) : null,
    beds: property.bedrooms ?? null,
    baths: property.bathrooms ?? null,
    lotSqft: (property as any).parcelAreaSqft ?? null,
    yearBuilt: property.yearBuilt ?? null,
    dom: getDaysOnMarket(property.listedDate, property.timeOnZillow ?? property.resoFacts?.daysOnZillow),
    hoaMonthly: hoaNum,
    walkScore: property.walkScore ?? null,
    transitScore: property.transitScore ?? null,
    noiseScore: property.noiseScore ?? null,
    schoolMinRating,
    fireRisk: property.fireRiskScore ?? null,
    floodRisk: property.floodRiskScore ?? null,
    windRisk: property.windRiskScore ?? null,
    heatRisk: property.heatRiskScore ?? null,
    stories: property.resoFacts?.stories ?? null,
    garageSpaces,
  };


  // 6. Remove deleted/suppressed factors — never store or send downstream
  const cleanedFactors = mergedFactors.filter(f => !DELETED_FACTOR_IDS.has(f.id));

  // 7. Compact: shorten keys {id→i, tags→t} to save tokens. No value field.
  // Cast to any[] — compact {i,t} is the serialization format; resolveFactor() expands it at read time.
  const compactFactors = cleanedFactors.map(f => ({
    i: f.id,
    v: f.value ?? '',
    t: f.tags ?? []
  })) as any[];

  // 8. PASS 2: Compress the granular factors into the 16 "Buyer DNA" buckets
  console.log(`[Context Graph] Pass 2: Compressing ${compactFactors.length} factors into 16 Buyer DNA dimensions for ${property.address}...`);
  let buyerDna: any = null;
  let usage = aiResult.usage;
  try {
    const dnaPrompt = getBuyerDnaCompressionPrompt(compactFactors);
    const dnaResult = await executeGeminiRequest<any>({
      model: FLASH_LITE_MODEL,
      contents: dnaPrompt,
      config: { temperature: 0.2, maxOutputTokens: 2048 },
      userId,
      zpid: property.zpid,
      address: property.address,
      promptFilename: "buyerDnaCompression.ts",
      extractResultJson: true,
      schema: buyerDnaCompressionSchema
    });
    buyerDna = dnaResult.data;
    // Accumulate token usage
    if (dnaResult.usage && usage) {
      usage = {
        ...usage,
        promptTokens: (usage.promptTokens || 0) + (dnaResult.usage.promptTokens || 0),
        candidatesTokens: (usage.candidatesTokens || 0) + (dnaResult.usage.candidatesTokens || 0),
        totalTokens: (usage.totalTokens || 0) + (dnaResult.usage.totalTokens || 0)
      };
    }
  } catch (dnaError) {
    console.error("[Context Graph] Pass 2 (Buyer DNA Compression) Failed:", dnaError);
    // Proceed without it so we don't crash the whole pipeline, but log the error.
  }

  return {
    ...aiResult,
    usage,
    data: {
      ...aiResult.data,
      factors: compactFactors,
      buyerDna: buyerDna ?? undefined,
      keyMetrics,
      lastUpdated: new Date()
    }
  };
};

export const analyzePropertyImages = async (imageUrls: string[], property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<CustomAIAnalysisResult>> => {
  const selectedImages = imageUrls;

  const imageResults = await Promise.allSettled(selectedImages.map(async (url) => {
    try {
      const { data, mimeType } = await urlToBase64(url);
      return { inlineData: { data, mimeType }, url };
    } catch (e: any) {
      console.warn(`[analyzePropertyImages] Failed to process image: ${url}`, e.message);
      throw e;
    }
  }));

  const successfulResults = imageResults
    .filter((result): result is PromiseFulfilledResult<{ inlineData: { data: string; mimeType: string }, url: string }> => result.status === 'fulfilled')
    .map(result => result.value);

  console.log(`[analyzePropertyImages] Image Processing Summary: ${successfulResults.length}/${selectedImages.length} images successful.`);
  if (successfulResults.length === 0 && selectedImages.length > 0) {
    console.error("[analyzePropertyImages] CRITICAL: 0 images were successfully converted to base64. AI will have no visual context.");
  }

  const imageParts = successfulResults.map(r => ({ inlineData: r.inlineData }));
  const tokenMap: Record<string, string> = {};
  const imageTokens = successfulResults.map((r, i) => {
    // Extract filename from Firebase URL or fallback to index
    // Firebase format: ...%2Fimg_1.jpg?alt=...
    let filename = `IMAGE_${i + 1}`;
    try {
      const decoded = decodeURIComponent(r.url);
      const parts = decoded.split('/');
      const lastPart = parts[parts.length - 1].split('?')[0];
      if (lastPart && lastPart.includes('.')) {
        filename = lastPart;
      }
    } catch (e) { }

    tokenMap[filename] = r.url;
    return `Image ${i + 1} [TOKEN: ${filename}]`;
  }).join('\n');

  const successfulImages = imageParts.length > 0;
  const basePrompt = getPropertyImagesPrompt(optimizePropertyForAi(property) as PropertyData);
  const textInstruction = successfulImages
    ? `${basePrompt}\n\nIMAGE TOKENS FOR YOUR REFERENCE:\n${imageTokens}`
    : `${basePrompt}\n\nNOTE: No photographs were provided for this property. Perform analysis based on detailed specifications.`;

  const response = await executeGeminiRequest<CustomAIAnalysisResult>({
    model: FLASH_MODEL, // Upgrade to 2.0 Flash for complex multi-image analysis
    contents: { parts: [{ text: textInstruction }, ...imageParts] },
    config: {
      maxOutputTokens: 16384,
      temperature: 0.1 // Lower temperature for more consistent JSON structure
    },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "propertyImages.ts",
    extractResultJson: true,
    schema: propertyImagesSchema,
    imageUrls: selectedImages
  });

  // Post-process: Map PHOTO_IDs back to full URLs
  if (response.data) {
    // 1. Image by image analysis
    if (response.data.image_by_image_analysis) {
      response.data.image_by_image_analysis = response.data.image_by_image_analysis.map(item => ({
        ...item,
        image_id: tokenMap[item.image_id] || item.image_id
      }));
    }

    // 2. Image quality top photos
    if (response.data.image_quality_analysis?.top_photos) {
      response.data.image_quality_analysis.top_photos = response.data.image_quality_analysis.top_photos.map(p => {
        // AI might provide "img_1.jpg" in image_index or label
        const filename = String(p.image_index || p.label);
        const lookupKey = typeof p.image_index === 'number' ? `img_${p.image_index}.jpg` : filename;

        return {
          ...p,
          image_url: tokenMap[lookupKey] || tokenMap[filename] || ""
        };
      });
    }
  }

  return response;
};

export const analyzeComprehensive = async (property: PropertyData, visual: CustomAIAnalysisResult, userId: string = "unknown"): Promise<AIResponseWithUsage<ComprehensiveAnalysisResult>> => {
  const optimizedProp = optimizePropertyForAi(property) as PropertyData;
  const optimizedVisual = optimizeVisualForAi(visual) as CustomAIAnalysisResult;

  const prompt = getComprehensiveAnalysisPrompt(optimizedProp, optimizedVisual);
  return executeGeminiRequest<ComprehensiveAnalysisResult>({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: { temperature: 0.7 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "comprehensiveAnalysis.ts",
    extractResultJson: true,
    schema: comprehensiveAnalysisSchema
  });
};

export const analyzeInteriorSummary = async (visual: CustomAIAnalysisResult, userId: string = "unknown", zpid?: string, address?: string): Promise<AIResponseWithUsage<any>> => {
  const prompt = getInteriorSummaryPrompt(visual.home_interior, visual.room_highlights || []);
  return executeGeminiRequest<any>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.1 },
    userId,
    zpid,
    address,
    promptFilename: "interiorSummary.ts",
    extractResultJson: true,
    schema: interiorSummarySchema
  });
};

export const analyzeInvestmentResearch = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<PropertySpecificInvestmentResult>> => {
  const prompt = getInvestmentResearchPrompt(optimizePropertyForAi(property) as PropertyData);
  return executeGeminiRequest<PropertySpecificInvestmentResult>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 1.0 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "investmentResearch.ts",
    extractResultJson: true,
    schema: investmentResearchSchema
  });
};

export const analyzeDeepInvestmentResearch = async (property: PropertyData, userId: string = "unknown", zpid?: string, onLog?: (msg: string) => void): Promise<AIResponseWithUsage<DeepInvestmentResearchResult>> => {
  const prompt = getDeepInvestmentResearchPrompt(optimizePropertyForAi(property) as PropertyData);

  onLog?.(`[Python Deep Research] Offloading Deep Research task to Python Engine...`);
  console.log(`[Python Deep Research] Starting Deep Investment Research for ${property.city}...`);
  const { data } = await executePythonDeepResearch<DeepInvestmentResearchResult>(prompt, deepInvestmentResearchSchema, {
    userId,
    zpid,
    address: property.address,
    promptFilename: "deepInvestmentResearch.ts"
  });

  const usage: AIUsage = {
    promptTokens: 0,
    candidatesTokens: 0,
    totalTokens: 0,
    cost: 0.10,
    model: "deep-research-pro-preview"
  };

  return {
    data,
    usage
  };
};

/**
 * Extracts key market insights from a deep investment research report.
 * Uses Flash for speed (~1s) and cost (~$0.001).
 */
export const extractDeepResearchInsights = async (reportContent: string, userId: string = "unknown", cityStateKey?: string): Promise<AIResponseWithUsage<DeepResearchInsights>> => {
  const prompt = getDeepResearchInsightsPrompt(reportContent);

  return executeGeminiRequest<DeepResearchInsights>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.1 },
    userId,
    zpid: cityStateKey || 'city-level',
    address: cityStateKey || 'Global',
    promptFilename: "deepResearchInsights.ts",
    extractResultJson: true,
    schema: deepResearchInsightsSchema
  });
};

export const analyzeGeneralMarketIntelligence = async (property: PropertyData, userId: string = "unknown", zpid?: string, onLog?: (msg: string) => void): Promise<AIResponseWithUsage<GeneralMarketIntelligenceResult>> => {
  const prompt = getGeneralMarketIntelligencePrompt(optimizePropertyForAi(property) as PropertyData);

  onLog?.(`[Python Deep Research] Offloading Market Intelligence task to Python Engine...`);
  console.log(`[Python Deep Research] Starting Market Intelligence for ${property.city}...`);
  const { data } = await executePythonDeepResearch<GeneralMarketIntelligenceResult>(prompt, generalMarketIntelligenceSchema, {
    userId,
    zpid,
    address: property.address,
    promptFilename: "generalMarketIntelligence.ts"
  });

  const usage: AIUsage = {
    promptTokens: 0,
    candidatesTokens: 0,
    totalTokens: 0,
    cost: 0.10,
    model: "deep-research-pro-preview"
  };

  return {
    data,
    usage
  };
};

/**
 * Runs Community Pulse and General Market Intelligence in parallel in the background.
 * Uses grounding (Deep Research) and tracks status per city.
 */
export const runBackgroundCityResearch = async (property: PropertyData, userId: string = "unknown", onLog?: (msg: string) => void): Promise<{ status: 'started' | 'skipped', cityStateKey: string, promise?: Promise<void> }> => {
  const { city, state } = property;
  const cityStateKey = generateCityStateKey(city, state);

  if (!cityStateKey) {
    console.warn("[runBackgroundCityResearch] Missing city/state for research", { city, state });
    return { status: 'skipped', cityStateKey: 'unknown' };
  }

  // 1. Check if already running or completed (within last 6 hours)
  const [pulseRecord, marketRecord, deepRecord] = await Promise.all([
    getCommunityPulseFromCloud(cityStateKey),
    getGeneralMarketIntelligenceFromCloud(cityStateKey),
    getDeepInvestmentResearchFromCloud(cityStateKey)
  ]);

  const now = Date.now();
  const getAge = (rec: any) => rec?.lastRan ? (now - (rec.lastRan.seconds * 1000)) : Infinity;

  // Stale check: if it's 'running' but started > 10 mins ago, it likely crashed
  const isStale = (rec: any) => rec?.status === 'running' && getAge(rec) > 10 * 60 * 1000;

  const isCurrentlyRunning = (deepRecord?.status === 'running' && !isStale(deepRecord));

  if (isCurrentlyRunning) {
    onLog?.(`[runBackgroundCityResearch] Deep research currently running for ${cityStateKey}. Waiting for existing process.`);
    return { status: 'skipped', cityStateKey };
  }

  // 2. Define the Research Task
  const promise = (async () => {
    try {
      onLog?.(`[runBackgroundCityResearch] Starting Deep Investment research for: ${cityStateKey}`);
      await setCityResearchFlag(cityStateKey, 'running');

      // Run Deep Research + City Neighborhood Mining in parallel
      const existingNeighborhoods = await getCityNeighborhoodsFromCloud(cityStateKey);
      const needsNeighborhoodMining = !existingNeighborhoods?.neighborhoods?.length;

      const tasks: Promise<any>[] = [
        analyzeDeepInvestmentResearch(property, userId, cityStateKey, onLog)
      ];

      if (needsNeighborhoodMining && city && state) {
        onLog?.(`[runBackgroundCityResearch] No cached neighborhoods for ${city}. Mining in parallel...`);
        tasks.push(
          mineCityNeighborhoods(city, state, userId, onLog).catch(err => {
            console.warn(`[runBackgroundCityResearch] Neighborhood mining failed (non-blocking):`, err.message);
            onLog?.(`[runBackgroundCityResearch] Neighborhood mining failed: ${err.message}`);
            return null;
          })
        );
      } else if (!needsNeighborhoodMining) {
        onLog?.(`[runBackgroundCityResearch] City neighborhoods already cached (${existingNeighborhoods.neighborhoods.length} neighborhoods).`);
      }

      const [deepRes] = await Promise.all(tasks);

      onLog?.(`[runBackgroundCityResearch] Deep Research successful for ${cityStateKey}. Saving results...`);

      await saveDeepInvestmentResearchToCloud(cityStateKey, deepRes.data);

      onLog?.(`[runBackgroundCityResearch] Deep Intelligence synchronized for ${cityStateKey}.`);
    } catch (error: any) {
      onLog?.(`[runBackgroundCityResearch] Failed for ${cityStateKey}: ${error.message || String(error)}`);
      await setCityResearchFlag(cityStateKey, 'failed', error.message || String(error));
      throw error;
    }
  })();

  return { status: 'started', cityStateKey, promise };
};



export const analyzeLeadDatabase = async (rawData: string, userId: string = "unknown"): Promise<{ result: LeadReactivationResult; llmCallId?: string }> => {
  // 1. Cheap extraction pass to find cities represented in the CSV
  // Using a fast pass to extract unique City, State pairs (max 20)
  let marketResearch: Record<string, any> = {};
  try {
    const extractionPrompt = `Extract the unique city and state pairs from this lead CSV. 
    Format as a JSON array of strings: ["City, ST", "City, ST"]. 
    Only return common markets. Limit to top 10.
    CSV:
    ${rawData.substring(0, 5000)}`; // First 5k chars is enough to find representation

    const { data: cities } = await executeGeminiRequest<string[]>({
      model: FLASH_LITE_MODEL,
      contents: extractionPrompt,
      userId,
      promptFilename: "cityExtractionForReactivation.ts",
      extractResultJson: true,
      skipWatchdog: true
    });

    if (Array.isArray(cities)) {
      const researchTasks = cities.map(async (cityState) => {
        const [c, s] = cityState.split(',').map(v => v.trim());
        if (c && s) {
          const key = generateCityStateKey(c, s);
          const research = await getDeepInvestmentResearchFromCloud(key);
          if (research && research.structured_report) {
            marketResearch[cityState] = {
              dynamics: research.structured_report.market_dynamics.summary,
              outlook: research.structured_report.investment_outlook,
              risks: research.structured_report.local_risks.summary
            };
          }
        }
      });
      await Promise.all(researchTasks);
    }
  } catch (err) {
    console.warn("[Reactivation] Failed to pre-fetch market research, proceeding with general knowledge:", err);
  }

  // 2. Full Reactivation Analysis (now grounded in research)
  const prompt = getLeadReactivationPrompt(rawData, marketResearch);
  const { data: result } = await executeGeminiRequest<LeadReactivationResult>({
    model: GEMINI_MODEL,
    contents: prompt,
    userId,
    promptFilename: "leadReactivation.ts",
    extractResultJson: true,
    schema: leadReactivationSchema
  });

  return { result };
};

export const transformLeadCsv = async (csvData: string, userId: string = "unknown"): Promise<string> => {
  const prompt = getLeadTransformationPrompt(csvData);
  const { data } = await executeGeminiRequest<string>({
    model: FLASH_MODEL,
    contents: prompt,
    userId,
    promptFilename: "leadTransformation.ts"
  });
  return data;
};

import { getNeighborhoodIdentityPrompt, neighborhoodIdentitySchema, NeighborhoodIdentityResult } from "../prompts/property/neighborhoodIdentity";
import {
  getCityNeighborhoodMinerPrompt, cityNeighborhoodMinerSchema, CityNeighborhoodsResult,
  getCityNeighborhoodDiscoveryPrompt, cityNeighborhoodDiscoverySchema,
  getCityNeighborhoodEnrichPrompt,
} from "../prompts/city/cityNeighborhoodMiner";
import { getNeighborhoodMatcherPrompt, neighborhoodMatcherSchema, NeighborhoodMatchResult } from "../prompts/property/neighborhoodMatcher";

/**
 * Mine ALL neighborhoods for a city using a two-pass approach:
 *  - Pass 1: Discover ALL neighborhood names cheaply (small output, exhaustive)
 *  - Pass 2: Enrich in batches of 10 with full detail (character, pricing, HOA, Nextdoor)
 * Results cached in Firestore. Falls back to single-pass if Pass 1 yields nothing.
 */
export const mineCityNeighborhoods = async (
  city: string,
  state: string,
  userId: string = "unknown",
  onLog?: (msg: string) => void
): Promise<AIResponseWithUsage<CityNeighborhoodsResult>> => {
  const cityStateKey = generateCityStateKey(city, state);
  if (!cityStateKey) throw new Error(`Invalid city/state: ${city}, ${state}`);

  onLog?.(`[City Neighborhoods] Mining all neighborhoods for ${city}, ${state}...`);

  // ── Step 0: Gather existing neighborhood tags from properties ────────────
  onLog?.(`[City Neighborhoods] Step 0: Checking existing property data for neighborhood tags...`);
  const properties = await getPropertiesByCity(city, 200);
  const existingHoodNames = new Set<string>();
  properties.forEach(p => {
    if (p.neighborhood && p.neighborhood.trim().length > 0) {
      existingHoodNames.add(p.neighborhood.trim());
    }
  });
  const knownFromProperties = Array.from(existingHoodNames);
  if (knownFromProperties.length > 0) {
    onLog?.(`[City Neighborhoods] Found ${knownFromProperties.length} neighborhoods already tagged in properties: ${knownFromProperties.slice(0, 5).join(', ')}${knownFromProperties.length > 5 ? '...' : ''}`);
  }

  // ── Pass 1: Discover all neighborhood names ──────────────────────────────
  onLog?.(`[City Neighborhoods] Pass 1: Discovering all neighborhood names...`);
  const discoveryPrompt = getCityNeighborhoodDiscoveryPrompt(city, state, knownFromProperties);

  const discoveryResult = await executeGeminiRequest<{ city: string; state: string; neighborhoods: { name: string; tier: string; has_hoa?: boolean; source?: string; latitude: number; longitude: number }[] }>({
    model: FLASH_LITE_MODEL,
    contents: discoveryPrompt,
    config: { tools: [groundingTool], temperature: 0.2, maxOutputTokens: 8192 },
    userId,
    zpid: cityStateKey,
    address: `${city}, ${state}`,
    promptFilename: "cityNeighborhoodMiner.ts",
    extractResultJson: true,
    schema: cityNeighborhoodDiscoverySchema,
    skipWatchdog: true,
  });

  const discovered = discoveryResult.data?.neighborhoods || [];

  // Ensure "known" neighborhoods are definitely in the list, even if Gemini missed them in Pass 1
  knownFromProperties.forEach(name => {
    const alreadyPresent = discovered.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (!alreadyPresent) {
      onLog?.(`[City Neighborhoods] Forcing inclusion of property-tagged neighborhood: ${name}`);
      discovered.push({
        name,
        tier: 'Mid-Range', // Default
        latitude: 0,       // Batch enrichment will try to find real ones
        longitude: 0,
        source: 'Property Tag'
      });
    }
  });

  onLog?.(`[City Neighborhoods] Pass 1 complete: found ${discovered.length} neighborhood names.`);

  if (discovered.length === 0) {
    // Fallback to single-pass if discovery failed
    onLog?.(`[City Neighborhoods] Pass 1 returned nothing — falling back to single-pass mining.`);
    const prompt = getCityNeighborhoodMinerPrompt(city, state);
    const result = await executeGeminiRequest<CityNeighborhoodsResult>({
      model: FLASH_LITE_MODEL,
      contents: prompt,
      config: { tools: [groundingTool], temperature: 0.3, maxOutputTokens: 32768 },
      userId, zpid: cityStateKey, address: `${city}, ${state}`,
      promptFilename: "cityNeighborhoodMiner.ts",
      extractResultJson: true, schema: cityNeighborhoodMinerSchema, skipWatchdog: true,
    });
    if (result.data?.neighborhoods?.length) {
      await saveCityNeighborhoodsToCloud(cityStateKey, result.data);
      onLog?.(`[City Neighborhoods] ✓ Fallback cached ${result.data.neighborhoods.length} neighborhoods.`);
    }
    return result;
  }

  // ── Pass 2: Enrich in batches of 10 ─────────────────────────────────────
  const BATCH_SIZE = 10;
  const names = discovered.map(n => n.name);
  const allEnriched: any[] = [];
  let lastUsage = discoveryResult.usage;

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const batch = names.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(names.length / BATCH_SIZE);
    onLog?.(`[City Neighborhoods] Pass 2: Enriching batch ${batchNum}/${totalBatches} (${batch.length} neighborhoods)...`);

    const enrichPrompt = getCityNeighborhoodEnrichPrompt(city, state, batch);
    const enrichSchema = {
      ...cityNeighborhoodMinerSchema,
      properties: {
        ...cityNeighborhoodMinerSchema.properties,
        neighborhoods: cityNeighborhoodMinerSchema.properties.neighborhoods,
      }
    };

    try {
      const enrichResult = await executeGeminiRequest<CityNeighborhoodsResult>({
        model: FLASH_LITE_MODEL,
        contents: enrichPrompt,
        config: { tools: [groundingTool], temperature: 0.3, maxOutputTokens: 16384 },
        userId, zpid: cityStateKey, address: `${city}, ${state}`,
        promptFilename: "cityNeighborhoodMiner.ts",
        extractResultJson: true, schema: enrichSchema, skipWatchdog: true,
      });

      const enriched = enrichResult.data?.neighborhoods || [];
      allEnriched.push(...enriched);
      lastUsage = enrichResult.usage;
      onLog?.(`[City Neighborhoods] Batch ${batchNum} enriched ${enriched.length} neighborhoods.`);
    } catch (e: any) {
      onLog?.(`[City Neighborhoods] Batch ${batchNum} failed: ${e.message}. Using discovery data for these.`);
      // Fall back to basic data from Pass 1 for this batch
      batch.forEach(name => {
        const basic = discovered.find(n => n.name === name);
        if (basic) allEnriched.push({
          neighborhood_name: basic.name,
          alternative_names: [],
          source_type: basic.source || 'Real Estate / MLS',
          character: { description: `Residential neighborhood in ${city}, ${state}.` },
          price_context: { tier: basic.tier, typical_range: 'N/A' },
          hoa: { has_hoa: basic.has_hoa ?? false },
          nextdoor: { found: false, url: '' },
        });
      });
    }

    // Brief pause between batches to avoid rate limiting
    if (i + BATCH_SIZE < names.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  onLog?.(`[City Neighborhoods] Pass 2 complete: ${allEnriched.length} neighborhoods enriched.`);

  // ── Assemble final result ────────────────────────────────────────────────
  const finalData: CityNeighborhoodsResult = {
    city,
    state,
    total_neighborhoods: allEnriched.length,
    city_summary: '',  // Will be filled by a follow-up call if needed
    neighborhoods: allEnriched,
  };

  await saveCityNeighborhoodsToCloud(cityStateKey, finalData);
  onLog?.(`[City Neighborhoods] ✓ Cached ${allEnriched.length} neighborhoods for ${city}.`);

  return { data: finalData, usage: lastUsage };
};

/**
 * Lightweight property-to-neighborhood matcher.
 * Sends only the address + list of known names to Gemini Flash (no grounding needed).
 * ~50x cheaper than a full identity call.
 */
const matchPropertyToNeighborhood = async (
  property: PropertyData,
  neighborhoodNames: string[],
  userId: string = "unknown"
): Promise<AIResponseWithUsage<NeighborhoodMatchResult>> => {
  const prompt = getNeighborhoodMatcherPrompt(
    property.address || "Subject Property",
    property.city || "",
    property.state || "",
    neighborhoodNames,
    property.description || undefined
  );

  console.log(`[Neighborhood Matcher] Matching ${property.address} against ${neighborhoodNames.length} known neighborhoods...`);

  return executeGeminiRequest<NeighborhoodMatchResult>({
    model: FLASH_MODEL,
    contents: prompt,
    config: { temperature: 0.1 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "neighborhoodMatcher.ts",
    extractResultJson: true,
    schema: neighborhoodMatcherSchema
  });
};

/**
 * Two-tier neighborhood identity analysis:
 * 1. Check city-level cache → lightweight match if available (~$0.0001)
 * 2. Fallback to full grounded identity call if no cache (~$0.005)
 */
export const analyzeNeighborhoodIdentity = async (property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<NeighborhoodIdentityResult>> => {
  const { address, city, state } = property;

  // ── Tier 1: Try city-level cache + lightweight match ──
  const cityKey = generateCityStateKey(city, state);
  if (cityKey) {
    try {
      const cityData = await getCityNeighborhoodsFromCloud(cityKey);
      if (cityData?.neighborhoods?.length) {
        const names = cityData.neighborhoods.map((n: any) => n.neighborhood_name);
        console.log(`[Neighborhood Identity] Found ${names.length} cached neighborhoods for ${city}. Running lightweight match...`);

        const matchResult = await matchPropertyToNeighborhood(property, names, userId);
        const matchedName = matchResult.data?.matched_neighborhood;

        if (matchedName) {
          // Find the full cached entry
          const cachedEntry = cityData.neighborhoods.find(
            (n: any) => n.neighborhood_name.toLowerCase() === matchedName.toLowerCase()
          );

          if (cachedEntry) {
            console.log(`[Neighborhood Identity] ✓ Matched to "${matchedName}" from city cache (confidence: ${matchResult.data?.confidence}).`);
            return {
              data: cachedEntry as NeighborhoodIdentityResult,
              usage: matchResult.usage
            };
          }
        }
        console.log(`[Neighborhood Identity] Lightweight match failed for "${matchedName}". Falling back to full analysis.`);
      }
    } catch (err) {
      console.warn(`[Neighborhood Identity] City cache lookup failed, falling back to full analysis:`, err);
    }
  }

  // ── Tier 2: Full grounded identity call (fallback) ──
  const prompt = getNeighborhoodIdentityPrompt(
    address || "Subject Property",
    city || "",
    state || "",
    property.description || undefined
  );

  console.log(`[Neighborhood Identity] Using full Gemini 3 Flash + Google Grounding for ${address}...`);

  return executeGeminiRequest<NeighborhoodIdentityResult>({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: { tools: [groundingTool], temperature: 0.3 },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "neighborhoodIdentity.ts",
    extractResultJson: true,
    schema: neighborhoodIdentitySchema
  });
};


import { getStreetViewAnalysisPrompt, streetViewAnalysisSchema } from "../prompts/property/streetViewAnalysis";
import { StreetViewAnalysisResult } from "../types";
import { uploadImageToStorage, deleteFileFromStorage } from "../services/firebaseService";

export const analyzeStreetView = async (imageUrl: string, property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<StreetViewAnalysisResult>> => {
  const { data, mimeType } = await urlToBase64(imageUrl);
  const prompt = getStreetViewAnalysisPrompt(property);

  // 1. Run AI Analysis
  const aiResponse = await executeGeminiRequest<StreetViewAnalysisResult>({
    model: FLASH_MODEL,
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data, mimeType } }
      ]
    },
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "streetViewAnalysis.ts",
    extractResultJson: true,
    schema: streetViewAnalysisSchema
  });

  // 2. Permanently Store Image in Firebase Storage
  try {
    // Fixed path — overwrites any existing file rather than accumulating timestamped duplicates
    const storagePath = `properties/${property.zpid || 'unknown'}/maps/street_view.jpg`;
    // Delete the old file first so re-analysis never serves a stale cached URL
    await deleteFileFromStorage(storagePath);
    console.log(`[analyzeStreetView] Storing street view image to: ${storagePath}`);
    const permanentImageUrl = await uploadImageToStorage(`data:${mimeType};base64,${data}`, storagePath);

    console.log("[analyzeStreetView] Permanent image URL generated:", permanentImageUrl);

    // Add the image URL to the result
    if (aiResponse.data) {
      aiResponse.data.imageUrl = permanentImageUrl;
    }
  } catch (storageError: any) {
    console.warn("[analyzeStreetView] Failed to store image permanently:", storageError.message || storageError);
    // Continue anyway so we don't block the analysis if storage fails
  }

  return aiResponse;
};

export const analyzePollen = async (pollenRawData: any, property: PropertyData, userId: string = "unknown"): Promise<AIResponseWithUsage<PollenAnalysisResult>> => {
  const prompt = getPollenAnalysisPrompt(pollenRawData);
  return executeGeminiRequest<PollenAnalysisResult>({
    model: FLASH_MODEL,
    contents: prompt,
    userId,
    zpid: property.zpid,
    address: property.address,
    promptFilename: "pollenAnalysis.ts",
    extractResultJson: true,
    schema: pollenAnalysisSchema
  });
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
  const { data } = await executeGeminiRequest<GuideResult>({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { tools: [groundingTool], temperature: 0.7 },
    userId,
    promptFilename: "guideGeneration.ts",
    extractResultJson: true,
    schema: guideGenerationSchema
  });
  return data;
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

export const generateDailyPulse = async (leads: Lead[], userId: string = "unknown", tasks: CRMTask[] = [], calendarEvents: CalendarEvent[] = []): Promise<AIResponseWithUsage<DailyPulseResult>> => {
  const { systemInstruction, prompt: userPrompt } = getDailyPulsePrompt(leads, tasks, calendarEvents);
  const combinedPrompt = `${systemInstruction}\n\n${userPrompt}`;
  const modelToUse = FLASH_MODEL;

  const { data: aiResult, usage } = await executeGeminiRequest<DailyPulseResult>({
    model: modelToUse,
    contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
    userId,
    promptFilename: "dailyPulse.ts",
    extractResultJson: true,
    schema: dailyPulseSchema
  });

  // Filter Tasks and Events locally as requested
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const threeDaysFromToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 23, 59, 59, 999);

  const parseDate = (val: any): Date => {
    if (!val) return new Date(0);
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds !== undefined) return new Date(val.seconds * 1000);
    return new Date(val);
  };

  const localTodayTasks = tasks
    .filter(t => {
      const d = parseDate(t.dueDate);
      return d >= startOfToday && d <= endOfToday && t.status !== 'DONE' && t.status !== 'Completed';
    })
    .map(t => ({ name: t.name, priority: t.priority }));

  const localUpcomingTasks = tasks
    .filter(t => {
      const d = parseDate(t.dueDate);
      return d > endOfToday && d <= threeDaysFromToday && t.status !== 'DONE' && t.status !== 'Completed';
    })
    .map(t => ({
      name: t.name,
      dueDate: parseDate(t.dueDate).toISOString().split('T')[0]
    }));

  const localTodayMeetings = calendarEvents
    .filter(e => {
      const d = parseDate(e.start);
      return d >= startOfToday && d <= endOfToday;
    })
    .map(e => ({
      title: e.title,
      time: parseDate(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      client: e.client || ''
    }));

  return {
    data: {
      ...aiResult,
      todayTasks: localTodayTasks,
      upcomingTasks: localUpcomingTasks,
      todayMeetings: localTodayMeetings
    },
    usage
  };
};

/**
 * Helper to remove massive base64 strings from payloads before logging to Firestore.
 */
function dehydratePayload(payload: any): any {
  if (!payload) return payload;

  // If it's the standard Gemini parts array/object
  if (typeof payload === 'object') {
    const clean = JSON.parse(JSON.stringify(payload)); // Deep clone

    const walk = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      if (obj.inlineData && obj.inlineData.data) {
        obj.inlineData.data = `[BASE64_DATA_REMOVED_SIZE_${obj.inlineData.data.length}]`;
      }

      for (const key in obj) {
        if (typeof obj[key] === 'object') walk(obj[key]);
      }
    };

    walk(clean);
    return clean;
  }

  return payload;
}

// ── MIT Living Wage Lookup ────────────────────────────────────────────────────

/**
 * Fetches MIT Living Wage Calculator data using Gemini + Google Search grounding.
 * Targets the "2 Adults, 2 Children (Both Working)" family type.
 *
 * Cache strategy:
 *   1. Check Firestore (metro → county, 300-day TTL)
 *   2. On miss → call Gemini + Google Search grounding
 *   3. Save result back to Firestore keyed by metroCode or countyFips
 *
 * @param params  - Location params including optional metroCode/metroName for metro-first lookup
 * @param userId  - Firebase UID for logging
 */
export const fetchMitLivingWage = async (
  params: MitLivingWageParams,
  userId: string = 'unknown'
): Promise<{ data: MitLivingWageResult; sources?: { url: string; title: string }[] | null; fromCache: boolean }> => {
  const { saveLivingWageToCloud, getLivingWageFromCloud } = await import('./firebase/properties');

  // Quality gate: cached docs must have living_wage_hourly + expenses to be usable
  const isLivingWageComplete = (cached: any): boolean =>
    !!(cached?.living_wage_hourly && cached?.expenses && typeof cached.expenses === 'object');

  // ── 1. Cache check (metro preferred, county fallback) ────────────────────
  if (params.metroCode) {
    const cached = await getLivingWageFromCloud(params.metroCode, 'metro');
    if (cached) {
      if (isLivingWageComplete(cached)) {
        console.log(`[MIT Living Wage] ✓ Cache hit (metro ${params.metroCode})`);
        return { data: cached as MitLivingWageResult, fromCache: true };
      }
      console.warn(`[MIT Living Wage] Cached metro doc is incomplete (missing expenses) — re-fetching for ${params.metroCode}`);
    }
  }
  if (params.countyFips) {
    const cached = await getLivingWageFromCloud(params.countyFips, 'county');
    if (cached) {
      if (isLivingWageComplete(cached)) {
        console.log(`[MIT Living Wage] ✓ Cache hit (county FIPS ${params.countyFips})`);
        return { data: cached as MitLivingWageResult, fromCache: true };
      }
      console.warn(`[MIT Living Wage] Cached county doc is incomplete (missing expenses) — re-fetching for ${params.countyFips}`);
    }
  }

  // ── 2. Gemini + Search grounding ─────────────────────────────────────────
  const prompt = getMitLivingWagePrompt(params);
  const locationTag = params.metroName
    ? `metro: ${params.metroName}`
    : `${params.county || params.city} County, ${params.state} (FIPS: ${params.countyFips || 'unknown'})`;
  console.log(`[MIT Living Wage] Cache miss — fetching for ${locationTag}...`);

  const result = await executeGeminiRequest<MitLivingWageResult>({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: { tools: [groundingTool], temperature: 0.1 },
    userId,
    promptFilename: 'mitLivingWage.ts',
    extractResultJson: true,
    schema: mitLivingWageSchema,
  });

  // ── 3. Save to Firestore ──────────────────────────────────────────────────
  if (result.data) {
    const geoLevel = result.data.geographic_level ?? (params.metroCode ? 'metro' : 'county');
    const cacheKey = geoLevel === 'metro'
      ? (params.metroCode || params.countyFips || '')
      : (params.countyFips || params.metroCode || '');

    if (cacheKey) {
      saveLivingWageToCloud(cacheKey, geoLevel, result.data)
        .then(r => {
          if (r.success) console.log(`[MIT Living Wage] Saved to Firestore (${geoLevel} ${cacheKey})`);
          else console.warn(`[MIT Living Wage] Save failed: ${r.error}`);
        })
        .catch(e => console.warn('[MIT Living Wage] Save error:', e));
    }
  }

  return { data: result.data, sources: result.sources, fromCache: false };
};
