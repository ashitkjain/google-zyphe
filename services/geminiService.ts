
import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis } from "../types";
import { getCache, setCache } from "./apiService";

// Always use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeProperty = async (property: PropertyData): Promise<AIAnalysisResult> => {
  const prompt = `
    Perform a deep, intelligent real estate analysis for the following property:
    Address: ${property.address}
    Price: $${property.price || property.zestimate}
    Type: ${property.homeType}
    Details: ${property.bedrooms} beds, ${property.bathrooms} baths, ${property.livingAreaValue} sqft
    Year Built: ${property.yearBuilt}
    Description: ${property.description}
    Risk Factors: Wind(${property.windRiskScore}), Flood(${property.floodRiskScore}), Fire(${property.fireRiskScore}), Heat(${property.heatRiskScore})
    
    Please provide:
    1. A detailed analysis for a potential buyer (pros and cons).
    2. A strategic recommendation for a seller (how to maximize value).
    3. A compelling marketing pitch for a realtor.
    4. A short market outlook for this specific type of property in this area.
  `;

  // Use gemini-3-flash-preview for basic text tasks
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          buyerAnalysis: { type: Type.STRING },
          sellerStrategy: { type: Type.STRING },
          realtorPitch: { type: Type.STRING },
          marketOutlook: { type: Type.STRING }
        },
        required: ["buyerAnalysis", "sellerStrategy", "realtorPitch", "marketOutlook"]
      }
    }
  });

  // Extracting text output from GenerateContentResponse using .text property.
  const text = response.text || "{}";
  return JSON.parse(text) as AIAnalysisResult;
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

/**
 * Generates a stable cache key from the map URL. 
 * Since Radar URLs include center coords and zoom, they are perfect for identifying a neighborhood area.
 */
const getNeighborhoodCacheKey = (url: string) => {
  return `nb_analysis_${btoa(url).substring(0, 32)}`;
};

export const analyzeNeighborhood = async (mapImageUrl: string, propertyAddress: string): Promise<NeighborhoodAnalysis> => {
  // Check internal cache first to save Gemini tokens and improve latency
  const cacheKey = getNeighborhoodCacheKey(mapImageUrl);
  const cached = getCache<NeighborhoodAnalysis>(cacheKey);
  if (cached) {
    console.log('Using cached neighborhood analysis for map URL');
    return cached;
  }

  const { data, mimeType } = await urlToBase64(mapImageUrl);
  
  const prompt = `You are a neighborhood and location analyst. Focus on street context, plot positioning, and surrounding neighborhood features from map analysis.

Return a JSON object with the following schema (no other text):

{
  "overview": "A detailed 2-3 sentence high-level summary of the area's character and vibe.",
  "neighborhood_features": {
    "street_layout_and_traffic": "Road types, intersection patterns, potential traffic flow.",
    "sidewalks_and_pedestrian_infra": "Visible walkways, pedestrian accessibility.",
    "proximity_to_greenery_and_water": "Visible green spaces, parks, trailheads, landscaping, water bodies etc.",
    "neighborhood_density": "Housing density, lot sizes, spacing between homes.",
    "walkability_indicators": "Proximity to amenities, grid vs suburban layout.",
    "topography": "Hills, slopes, elevation changes visible.",
    "development_patterns": "New vs established neighborhoods, construction activity.",
    "nearby_amenities": "Schools, shopping, recreational facilities etc visible on map, as well as your knowledge.",
    "transportation_access": "Major roads, highway access, airports, public transit proximity.",
    "general": "Street parking, driveways, nearby parking areas, proximity to cultural communities, neighborhood vibe etc."
  }
}

Analyze these map images for property: ${propertyAddress}
ZOOMED OUT view - broader area context for neighborhood analysis

Focus on street layout, neighborhood density, amenities, transportation, and general area characteristics.`;

  // Use gemini-3-flash-preview for multimodal tasks
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data, mimeType } }
      ]
    },
    config: {
      responseMimeType: "application/json"
    }
  });

  // Extracting text output from GenerateContentResponse using .text property.
  const text = response.text || "{}";
  const result = JSON.parse(text) as NeighborhoodAnalysis;

  // Save to cache
  setCache(cacheKey, result);
  
  return result;
};

export const analyzePropertyImages = async (imageUrls: string[]): Promise<CustomAIAnalysisResult> => {
  // Limit to 15 images to avoid token limits or context overflow for a quick analysis
  const selectedImages = imageUrls.slice(0, 15);
  const imageParts = await Promise.all(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return {
      inlineData: {
        data,
        mimeType
      }
    };
  }));

  const prompt = `You are an unbiased property inspector and architectural analyst. Your task is to provide an extremely detailed, high-wordcount, and objective report on the property based on the visual evidence.

Return the response as a single JSON object that conforms to the following schema. 

CRITICAL: The tone must be neutral, factual, and observational. Avoid sales-oriented language, "fluff," or overly positive marketing adjectives.

{
  "report_title": "Real Estate Property Analysis",
  "home_interior": {
    "overall_description": "A long, neutral, observational description (2 paragraphs) of the home's interior, focusing on factual layout and atmosphere without sales bias.",
    "design_style": {
      "style": "The specific identified style.",
      "reasoning": "A detailed paragraph explaining the architectural and design cues found in the photos that support this classification using neutral terminology."
    },
    "color_and_materials": "A comprehensive paragraph describing the full color palette, specific flooring types, countertop materials, cabinetry finishes, and wall textures observed in a factual manner.",
    "lighting": "A detailed paragraph analyzing both natural light (window placement, exposure) and artificial lighting (fixtures, recessed lighting) based on visual evidence.",
    "spatial_flow": "A detailed paragraph describing the floor plan layout (open vs defined), how rooms connect, and the logical navigation of the home.",
    "staging_and_furnishings": "A neutral analysis of the furniture or virtual staging, focusing on how it populates the space and demonstrates scale.",
    "condition_and_finish": "An objective assessment of the home's maintenance state, identifying wear, tear, or the quality level of finishes without marketing spin.",
    "suggested_lifestyle": {
      "lifestyle": "Objective description of the likely intended use.",
      "buyer_type": "Factual description of the demographic best suited for this configuration."
    }
  },
  "room_highlights": [
    {
      "room_name": "Name of room",
      "floor": "Floor level",
      "description": "Detailed multi-sentence description of features and layout. Maintain a strictly neutral and observational tone.",
      "potential_improvements": "Actionable, objective designer-level advice for practical improvements to this specific room."
    }
  ],
  "exterior_and_neighborhood": {
    "exterior_and_lot_appeal": {
      "architecture_style": "Detailed architectural analysis of the exterior features.",
      "curb_appeal": "Objective review of the landscaping, entryway, and exterior condition.",
      "backyard_and_patio": "Factual description of outdoor spaces, hardscaping, fencing, and vegetation."
    },
    "views_privacy_orientation": {
      "views": "Objective description of observed sightlines from the property.",
      "orientation": "Orientation and sun exposure analysis based on visual cues.",
      "privacy": "Factual privacy assessment relative to adjacent properties."
    }
  }
}

INSTRUCTIONS:
1. Only analyze rooms for which images are provided.
2. Use professional, objective, and precise terminology.
3. Be specific about materials (e.g., 'white shaker-style cabinets' instead of 'white cabinets').
4. AVOID sales words like "stunning," "gorgeous," "dream home," "perfect for," or "unbelievable."
5. Focus on the facts of what is visible in the images.`;

  // Use gemini-3-flash-preview for multimodal tasks
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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

  // Extracting text output from GenerateContentResponse using .text property.
  const text = response.text || "{}";
  return JSON.parse(text) as CustomAIAnalysisResult;
};
