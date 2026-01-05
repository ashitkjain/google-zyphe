import { GoogleGenAI, Type } from "@google/genai";
import { PropertyData, AIAnalysisResult, CustomAIAnalysisResult, NeighborhoodAnalysis, CommunityPulseResult, ComprehensiveAnalysisResult } from "../types";

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

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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

export const analyzeNeighborhood = async (mapImageUrl: string, propertyAddress: string): Promise<NeighborhoodAnalysis> => {
  const { data, mimeType } = await urlToBase64(mapImageUrl);
  
  const prompt = `You are a neighborhood and location analyst. Return a JSON object for property: ${propertyAddress}. 
  Focus on street layout, neighborhood density, amenities, transportation, and general area characteristics.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data, mimeType } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          neighborhood_features: {
            type: Type.OBJECT,
            properties: {
              street_layout_and_traffic: { type: Type.STRING },
              sidewalks_and_pedestrian_infra: { type: Type.STRING },
              proximity_to_greenery_and_water: { type: Type.STRING },
              neighborhood_density: { type: Type.STRING },
              walkability_indicators: { type: Type.STRING },
              topography: { type: Type.STRING },
              development_patterns: { type: Type.STRING },
              nearby_amenities: { type: Type.STRING },
              transportation_access: { type: Type.STRING },
              general: { type: Type.STRING }
            },
            required: ["general", "neighborhood_density", "transportation_access"]
          }
        },
        required: ["overview", "neighborhood_features"]
      }
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text) as NeighborhoodAnalysis;
};

export const analyzeCommunityPulse = async (address: string, cityState: string): Promise<CommunityPulseResult> => {
  const prompt = `Task: Act as a specialized neighborhood research assistant for the property located at ${address}, ${cityState}. 
  Your mission is to provide an authentic "Community Pulse" report by synthesizing real resident perspectives, local forum sentiment, news, and area-specific reviews.
  
  Instructions:

Collect and summarize credible, real-world opinions and insights about this location from multiple independent sources.

Required sources (use as many as relevant):
- Reddit (city or neighborhood subreddits)
- Trulia neighborhood reviews
- Niche.com neighborhood reviews
- City-Data forums
- Google Maps reviews (area & nearby amenities)
- Local news or Patch.com
- Public crime or safety reports
- School review platforms (GreatSchools, Niche)

Return your response as a JSON object with exactly this structure. Each section MUST include a "sources" array:

{
  "what_residents_like": {
    "summary": "<positive aspects: what residents love, community vibe, friendliness, diversity>",
    "points": ["<point 1>", "<point 2>"],
    "sources": ["reddit.com", "trulia.com"]
  },
  "common_complaints": {
    "summary": "<negative aspects: complaints, noise, traffic, parking issues>",
    "points": ["<complaint 1>", "<complaint 2>"],
    "sources": ["reddit.com", "trulia.com"]
  },
  "safety_and_concerns": {
    "summary": "<safety perception, crime concerns, red flags, recurring warnings>",
    "points": ["<point 1>", "<point 2>"],
    "sources": ["reddit.com", "trulia.com"]
  },
  "schools_family_friendliness": {
    "summary": "<school quality and family-friendliness>",
    "points": ["<point 1>", "<point 2>"],
    "sources": ["reddit.com", "trulia.com"]
  },
  "lifestyle_convenience": {
    "summary": "<walkability, commute, remote work suitability, daily convenience>",
    "points": ["<point 1>", "<point 2>"],
    "sources": ["reddit.com", "trulia.com"]
  },
  "investment_insights": {
    "summary": "<rental demand, tenant profile, resale desirability, market trends>",
    "points": ["<insight 1>", "<insight 2>"],
    "sources": ["reddit.com", "trulia.com"]
  }
}

IMPORTANT: Each section's "sources" array must contain the names of specific sources used in that section. Do not include inline citations in the points text. 
AVOID REPEATING the same information across different sections.

Source requirements:
- Each section must have its own sources array with full URLs
- Prefer recent sources (last 2–3 years)
- If no reliable sources found for a section, use an empty sources array []

Tone: Neutral, evidence-based, buyer-oriented. Avoid marketing language.

Respond ONLY with the JSON object, no additional text or markdown formatting.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
      // responseMimeType: "application/json" is NOT supported when tools are used with gemini-2.5-flash
    }
  });

  const text = response.text || "{}";
  return parseJSONSafely(text) as CommunityPulseResult;
};

export const analyzePropertyImages = async (imageUrls: string[]): Promise<CustomAIAnalysisResult> => {
  const selectedImages = imageUrls.slice(0, 15);
  const imageParts = await Promise.all(selectedImages.map(async (url) => {
    const { data, mimeType } = await urlToBase64(url);
    return { inlineData: { data, mimeType } };
  }));

  const prompt = `You are a property analyst. Provide a detailed, objective JSON report based on the visuals.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [{ text: prompt }, ...imageParts] },
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          report_title: { type: Type.STRING },
          home_interior: {
            type: Type.OBJECT,
            properties: {
              overall_description: { type: Type.STRING },
              design_style: {
                type: Type.OBJECT,
                properties: {
                  style: { type: Type.STRING },
                  reasoning: { type: Type.STRING }
                },
                required: ["style", "reasoning"]
              },
              color_and_materials: { type: Type.STRING },
              lighting: { type: Type.STRING },
              spatial_flow: { type: Type.STRING },
              staging_and_furnishings: { type: Type.STRING },
              condition_and_finish: { type: Type.STRING },
              suggested_lifestyle: {
                type: Type.OBJECT,
                properties: {
                  lifestyle: { type: Type.STRING },
                  buyer_type: { type: Type.STRING }
                },
                required: ["lifestyle", "buyer_type"]
              }
            },
            required: ["overall_description", "design_style"]
          },
          room_highlights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                room_name: { type: Type.STRING },
                floor: { type: Type.STRING },
                description: { type: Type.STRING },
                potential_improvements: { type: Type.STRING }
              },
              required: ["room_name", "description"]
            }
          },
          exterior_and_neighborhood: {
            type: Type.OBJECT,
            properties: {
              exterior_and_lot_appeal: {
                type: Type.OBJECT,
                properties: {
                  architecture_style: { type: Type.STRING },
                  curb_appeal: { type: Type.STRING },
                  backyard_and_patio: { type: Type.STRING }
                },
                required: ["architecture_style", "curb_appeal"]
              },
              views_privacy_orientation: {
                type: Type.OBJECT,
                properties: {
                  views: { type: Type.STRING },
                  orientation: { type: Type.STRING },
                  privacy: { type: Type.STRING }
                },
                required: ["views", "privacy"]
              }
            },
            required: ["exterior_and_lot_appeal"]
          }
        },
        required: ["home_interior", "room_highlights", "exterior_and_neighborhood"]
      }
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text) as CustomAIAnalysisResult;
};

export const analyzeComprehensive = async (property: PropertyData, visual: CustomAIAnalysisResult): Promise<ComprehensiveAnalysisResult> => {
  const PROPERTY_DETAILS = JSON.stringify(property, null, 2);
  const VISUAL_ANALYSIS = JSON.stringify(visual, null, 2);

  const prompt = `You are an AI-powered home buying assistant, tasked with generating a comprehensive and compelling analysis of a residential property. 
Your goal is to provide a detailed, narrative-style, realtor written, professional report to a home buyer, based on a combination of provided - 

1. property information ${PROPERTY_DETAILS}, 
2. image analysis - ${VISUAL_ANALYSIS}, and 
3. online research. 

Instructions:
Persona: Act as a knowledgeable and unbiased real estate analyst.
Narrative Style: Write in a flowing, descriptive paragraph style in a compelling tone that engages a potential buyer. Avoid bullet points or lists in the main sections.
Data Integration: Synthesize all provided data (property details, images, map analysis) with information you gather from your online searches. It is important to not miss important details.
No Duplication: Ensure that each section contains unique and distinct content. Do not repeat the same information across different headings.
Numerical Ranges: When showing ranges, use the format "3-5" or "$25-$35," not "35" or "$2535."
Citations: Do not include citations like [1] or [3] in the final output.
Avoid putting days count (like days on market) that would make a few days old generated report inaccurate.
 
To complete this task, you must use your internal search tools to find the necessary data. 
Prioritize authoritative and recent sources.

For example, use your search tools to gather additional data for :
Future Development: Search for zoning, permits, or upcoming developments by using the property address and the city/county name.
Market & Neighborhood: Research current market trends, neighborhood demographics, rental demand, and appreciation rates for the area.

**CRITICAL: You MUST respond with a valid JSON object only. No markdown, no code fences, no additional text before or after the JSON.**
Deduplicate information across JSON sections.

Response content should include 

"summary": "150-200 word summary with key highlights. Use **bold** for critical decision factors such as: direction facing, quiet street, excellent school district, natural light, move-in ready, and any other key highlights.",
  "detailed_analysis": {
    "location_neighborhood": "Based on the provided property facts and description, map analysis and your knowledge, write a short paragraph describing proximity to schools, highways, parks, public transport options, and shops. Note the Walk Score, neighborhood character (e.g., young professionals, families), and local safety data. Include commute times to major work hubs, access to public transport, and any upcoming local development. Add any information about the community amenities that you can find. Discuss local appreciation trends, vacancy risk, and saturation of short-term rentals. Use **bold** for key highlights like distances, scores, and important features.",
    "outdoors_view_quality": "Using the provided photo and map analysis, write a short paragraph evaluating views (e.g., yard, hills, ocean) and the level of privacy. Assess the backyard, patio, or balcony for usability. Mention fencing, surface types, and sun exposure. Highlight any coastal erosion concerns or sea-level projections if relevant. Use **bold** for key highlights like view types, privacy level, and notable outdoor features.",
    "visual_appeal_condition": "Summarize the visual appeal and condition from provided information, like the provided property photo analysis, facts and description, including a paragraph commenting on finishes, natural lighting, cleanliness, and style (e.g., Mediterranean, Modern). Assess the apparent condition of the roof, windows, and major systems. Describe the emotional feel of the home. Use **bold** for key highlights like style, condition ratings, and standout features.",
    "privacy_layout": "Based on the provided images and map analysis, write a short paragraph assessing separation from neighbors, landscaping, window placement, lot shape, and interior room layout. Mention potential for an Accessory Dwelling Unit (ADU), zoning constraints, and expansion possibilities. Use **bold** for key highlights like lot size, privacy level, and expansion potential.",
    "climate_resilience": "Using the provided climate risk scores, insurance recommendations, existing knowledge and your search results, write a short paragraph indicating whether the home lies within a FEMA flood zone, wildfire-prone area, or has earthquake risk. Discuss how these risks might affect insurance premiums and highlight any resilience features the home may possess. Evaluate the long-term climate stability of the region. Use **bold** for key highlights like risk scores, zone designations, and resilience features.",
    "additional_considerations": "Write a short paragraph including information on garage capacity, storage, smart home features, HVAC quality, internet speed availability, HOA rules, and any historical permit data discovered during your search. Include any other market or neighborhood details or information provided that is not yet covered. Use **bold** for key highlights like capacities, fees, and notable features."
  },
  "lifestyle_fit": {
    "families": "Write a paragraph, explaining reasons, about suitability for kids, nearby parks, schools, and neighborhood safety. Consider School Quality & Proximity, Nearby Parks & Playgrounds, Neighborhood Safety, Community & Social Life, Traffic & Street Safety, Access to Childcare & Libraries, Noise Levels. Use **bold** for key highlights like school ratings, park distances, and safety scores.",
    "professionals": "Write a paragraph, explaining reasons, about commute convenience, suitability for remote work, and fast internet access. Consider Commute Time, Remote Work Suitability, Internet Connectivity, Coworking Spaces Nearby, Local Amenities, Neighborhood Vibe, Time Zone Flexibility. Use **bold** for key highlights like commute times, internet speeds, and workspace features.",
    "retirees": "Write a paragraph, explaining reasons, about single-level access, accessibility low-maintenance features, and proximity to hospitals and trails. Consider Accessibility, Low-Maintenance Living, Healthcare Proximity, Recreation & Wellness, Safety & Peacefulness, Public Transport Options, Social Opportunities. Use **bold** for key highlights like accessibility features, hospital distances, and maintenance level.",
    "investors": "Write a paragraph, explaining reasons, about the home's investment potential, rental demand (short-term and long-term), and local appreciation rate. Consider Rental Demand, Appreciation Rate, Market Liquidity, Neighborhood Development Plans, HOA Rules & Fees, Property Taxes & Insurance, Condition & Renovation Potential. Use **bold** for key highlights like appreciation rates, rental yields, and investment metrics."
  },
  "risks_considerations": "Write a paragraph highlighting any concerns regarding: Location (Crime rate, noise, environmental hazards, lack of essential services, zoning or future development changes), Property Condition (Age and state of roof, foundation, plumbing/electrical, HVAC, outdated layout, accessibility issues, storage/parking limits, energy inefficiency), Financial (Overpricing compared to comps, high property taxes, HOA fees/restrictions, rental market volatility, low appreciation potential, high insurance costs), Lifestyle Fit (Mismatch with buyer's needs, limited amenities, long commute, noise pollution), Legal/Compliance (Title disputes, unpermitted work, restrictive ordinances), Any other risk factors mentioned in the provided information. Use **bold** for critical risk factors and warning items.",
  "buyer_recommendation": "Write a concluding paragraph that includes the ideal buyer type(s), any urgency factors for a purchase, and the median time to sell in the area. Add any leverage if the property has been in market for long. Use **bold** for key recommendations and urgency factors."

Return your response as a JSON object with the following structure:
{
  "summary": "string",
  "detailed_analysis": {
    "location_neighborhood": "string",
    "outdoors_view_quality": "string",
    "visual_appeal_condition": "string",
    "privacy_layout": "string",
    "climate_resilience": "string",
    "additional_considerations": "string"
  },
  "lifestyle_fit": {
    "families": "string",
    "professionals": "string",
    "retirees": "string",
    "investors": "string"
  },
  "risks_considerations": "string",
  "buyer_recommendation": "string"
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      // responseMimeType: "application/json" is NOT supported when tools are used with gemini-2.5-flash
      thinkingConfig: { thinkingBudget: 4000 }
    }
  });

  const text = response.text || "{}";
  return parseJSONSafely(text) as ComprehensiveAnalysisResult;
};