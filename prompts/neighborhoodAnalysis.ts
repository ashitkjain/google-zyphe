import { Type } from "@google/genai";
import { PropertyData } from "../types";

export const getNeighborhoodAnalysisPrompt = (property: PropertyData) => `
  You are an expert Spatial Analyst and Urban Planning Consultant. 
  
  I am providing you with map imagery (satellite/map views) and property data for:
  ${JSON.stringify(property, null, 2)}
  
  TASK:
  Analyze the provided map images and property context in detail. Your analysis should be based primarily on the visual evidence in the maps, combined with the property facts provided and your general knowledge of urban geography.
  
  INSTRUCTIONS:
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
  Return the response as a single JSON object matching the requested schema. Ensure the "overview" provides a high-level summary of the "vibe" found in the imagery and data.
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