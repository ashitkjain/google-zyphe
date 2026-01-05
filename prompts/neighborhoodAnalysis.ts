import { Type } from "@google/genai";

export const getNeighborhoodAnalysisPrompt = (propertyAddress: string) => `
  You are an expert Spatial Analyst and Urban Planning Consultant. 
  
  I am providing you with map imagery (satellite/map views) for the property at: ${propertyAddress}.
  
  TASK:
  Analyze the provided map images in detail. Your analysis should be based primarily on the visual evidence in the maps, combined with your general knowledge of urban geography.
  
  INSTRUCTIONS:
  1. STREET LAYOUT: Identify the street pattern (e.g., quiet cul-de-sac, grid system, busy arterial proximity). Note traffic flow indicators.
  2. DENSITY & LAND USE: Evaluate the neighborhood density. Are homes tightly packed? Are there large lots? Are there commercial or industrial buffers nearby?
  3. GREENERY & BLUE SPACE: Identify visible parks, wooded areas, walking trails, or bodies of water in the immediate vicinity.
  4. INFRASTRUCTURE: Look for sidewalks, crosswalks, and pedestrian-friendly features. Identify public transit stops or parking availability if visible.
  5. TOPOGRAPHY: Note any significant slopes, hills, or unique geographical features visible in the map context.
  6. DEVELOPMENT: Assess the age and style of surrounding development based on the roof patterns and parcel layouts.

  Return the response as a single JSON object matching the requested schema. Ensure the "overview" provides a high-level summary of the "vibe" found in the imagery.
`;

export const neighborhoodAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    overview: { 
      type: Type.STRING, 
      description: "A professional summary of the neighborhood's character and location value based on the map visuals." 
    },
    neighborhood_features: {
      type: Type.OBJECT,
      properties: {
        street_layout_and_traffic: { type: Type.STRING, description: "Analysis of street patterns and traffic flow." },
        sidewalks_and_pedestrian_infra: { type: Type.STRING, description: "Presence and quality of pedestrian paths." },
        proximity_to_greenery_and_water: { type: Type.STRING, description: "Access to parks, forests, or water." },
        neighborhood_density: { type: Type.STRING, description: "Evaluation of how crowded or spacious the area is." },
        walkability_indicators: { type: Type.STRING, description: "Visual cues for ease of walking." },
        topography: { type: Type.STRING, description: "Analysis of land elevation and slopes." },
        development_patterns: { type: Type.STRING, description: "Types of building layouts and age indicators." },
        nearby_amenities: { type: Type.STRING, description: "Retail, dining, and service clusters identified." },
        transportation_access: { type: Type.STRING, description: "Road connectivity and transit proximity." },
        general: { type: Type.STRING, description: "Any other standout spatial observations." }
      },
      required: [
        "street_layout_and_traffic",
        "neighborhood_density", 
        "transportation_access",
        "proximity_to_greenery_and_water",
        "general"
      ]
    }
  },
  required: ["overview", "neighborhood_features"]
};