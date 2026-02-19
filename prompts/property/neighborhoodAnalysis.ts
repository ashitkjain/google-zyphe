import { Type } from "@google/genai";
import { PropertyData } from "../../types";

export const getNeighborhoodAnalysisPrompt = (property: { address: string; description?: string }) => `
  You are an expert Spatial Analyst and Urban Planning Consultant. 
   
  I am providing you with two map images for the property at: ${property.address}.
  - Image 1 (Zoom In): A close-up view showing the property parcel, home marker, and immediate street.
  - Image 2 (Zoom Out): A broader view of the neighborhood context.

  Property Description:
  ${property.description || "No description provided."}

  TASK:
  Analyze the provided map images in detail. Your analysis should be based primarily on visual evidence in the maps.
  
  INSTRUCTIONS:

  1. ORIENTATION ANALYSIS:
     Determine the direction the house is facing following these steps precisely:
     - STEP 1 (Text Analysis — HIGHEST PRIORITY): Carefully scan the entire "Property Description" above for ANY mention of the home's facing direction or orientation. This includes — but is not limited to — these phrasings:
       * "north-facing", "south-facing", "east-facing", "west-facing" (with or without hyphens)
       * "faces north/south/east/west"
       * "facing east/west/north/south"
       * "front faces [direction]", "front door faces [direction]", "entrance faces [direction]"
       * "east-facing entrance", "south facing lot", "vastu-compliant [direction]"
       * "facing [direction] per MLS", "[direction] exposure"
       * Any compass direction (North, South, East, West, Northeast, Northwest, Southeast, Southwest) used in the context of the home's front, entrance, or lot orientation
       IF YOU FIND ANY SUCH MENTION — use that as the DEFINITIVE final_orientation and report exactly which phrase you found in orientation_explanation. DO NOT perform the visual analysis below. This text clue always overrides the map.
     - STEP 2 (Visual Analysis — Fallback ONLY): Only use this if the "Property Description" has ZERO mentions of orientation, facing direction, or compass direction in context of the home. If so, analyze the Zoom In map image:
       * Assume top of the map image is North, right is East, left is West, bottom is South.
       * Identify the Key Elements: Locate the home marker and the labeled street (matching the home address street).
       * At the point the home street is closest to the home (street can be changing direction in the map, so we need the directions where it is closest to the home) -
       * Step A: Determine the direction in which the home street runs (e.g., East-West, North-South or a diagonal like Northeast-Southwest) where it is closest to the home.
       * Step B: Observe the home marker's position in relation to the home street (Is it above, below, right, left etc. of the street?) where it is closest to the street.
       * Step C: Infer the Facing Direction:
         - If street is East-West and house marker is below the home street, front faces North.
         - If street is North-South and house marker is left of the home street, front faces East.
         - Apply this exact logic to diagonal directions.

  2. STREET LAYOUT: Identify the street pattern (e.g., quiet cul-de-sac, grid system, busy arterial proximity). Note traffic flow indicators.
  3. DENSITY & LAND USE: Evaluate the neighborhood density. Are homes tightly packed? Are there large lots? Are there commercial or industrial buffers nearby?
  4. GREENERY & BLUE SPACE: Identify visible parks, wooded areas, walking trails, or bodies of water in the immediate vicinity.
  5. INFRASTRUCTURE: Look for sidewalks, crosswalks, and pedestrian-friendly features.
  6. TOPOGRAPHY: Note any significant slopes, hills, or unique geographical features visible in the map context.
  7. DEVELOPMENT: Assess the age and style of surrounding development based on the roof patterns and parcel layouts.
  8. AMENITIES: Identify retail, dining, HOA amenities and service clusters nearby. 
     IMPORTANT: If the Property Description indicates the home is part of an HOA or planned community, specifically include the list of HOA amenities (pools, clubhouses, fitness centers, etc.) in your response.

  Return the response as a single JSON object matching the requested schema. 
  Ensure the "orientation" block includes your step-by-step reasoning in "orientation_explanation", explaining exactly how you arrived at the final direction based on the map visuals or property description.
  Ensure the "overview" provides a high-level summary of the "vibe" found in the imagery.
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
        topography: { type: Type.STRING, description: "Analysis of land elevation and slopes." },
        development_patterns: { type: Type.STRING, description: "Types of building layouts and age indicators." },
        nearby_amenities: { type: Type.STRING, description: "Retail, dining, and service clusters identified, including HOA/Community amenities if applicable." },
        general: { type: Type.STRING, description: "Any other standout spatial observations." }
      },
      required: [
        "street_layout_and_traffic",
        "sidewalks_and_pedestrian_infra",
        "proximity_to_greenery_and_water",
        "neighborhood_density",
        "topography",
        "development_patterns",
        "nearby_amenities",
        "general"
      ]
    },
    orientation: {
      type: Type.OBJECT,
      properties: {
        street_direction: { type: Type.STRING, description: "e.g., East-West, North-South, etc." },
        home_position_relative_to_street: { type: Type.STRING, description: "Position of the home in relation to the street (above/north of the street, below/south of the street, right/east of the street, left/west of the street, etc.)" },
        final_orientation: { type: Type.STRING, description: "The deduced direction the front of the house faces (North, South, etc.)" },
        orientation_explanation: { type: Type.STRING, description: "Detailed reasoning explaining how the orientation was determined, referencing specific map elements or text clues." }
      },
      required: ["final_orientation", "orientation_explanation"]
    }
  },
  required: ["overview", "neighborhood_features", "orientation"]
};