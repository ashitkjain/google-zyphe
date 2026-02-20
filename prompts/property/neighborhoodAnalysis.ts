import { Type } from "@google/genai";
import { PropertyData } from "../../types";
import { buildMlsFactsBlock } from "./mlsFacts";

export const getNeighborhoodAnalysisPrompt = (property: PropertyData) => `
  You are an expert Spatial Analyst and Urban Planning Consultant. 
   
  I am providing you with two map images for the property at: ${property.address}.
  - Image 1 (Zoom In): A close-up view showing the property parcel, home marker, and immediate street.
  - Image 2 (Zoom Out): A broader view of the neighborhood context.

  ${buildMlsFactsBlock(property)}

  IMPORTANT RULE: You MUST treat every fact in the "KNOWN MLS / LISTING FACTS" block above as ground truth.
  Do NOT contradict or make assumptions that conflict with any of those values in your response — including the property description.

  TASK:
  Analyze the provided map images in detail. Your analysis should be based primarily on visual evidence in the maps.
  
  INSTRUCTIONS:

  1. ORIENTATION ANALYSIS:
     Determine the direction the house is facing following these steps precisely:
     - STEP 1 (Text Analysis — HIGHEST PRIORITY): Carefully scan the entire "Property Description" above for an EXPLICIT statement of the home's facing direction or orientation. Only trigger on language that directly describes where the FRONT of the home or its ENTRANCE faces. Valid triggers include:
       * "north-facing", "south-facing", "east-facing", "west-facing" (with or without hyphens)
       * "faces north/south/east/west", "facing north/south/east/west"
       * "front faces [direction]", "front door faces [direction]", "entrance faces [direction]"
       * "east-facing entrance", "south facing lot", "vastu-compliant [direction]"
       * "[direction] exposure", "facing [direction] per MLS"
       DO NOT trigger on compass directions that appear in these NON-orientation contexts:
       * Locations of nearby features — e.g. "overlooking the fairway to the south", "backing to a north-facing greenbelt", "views to the west", "on the south side of the road"
       * Lot position descriptions — e.g. "corner lot", "south side of the property", "positioned on the [direction] end"
       * Street names that contain directions — e.g. "North Main Street", "East Avenue"
       * Interior room descriptions — e.g. "north-facing master bedroom window"
       IF AND ONLY IF you find explicit home/entrance facing language — use that as the DEFINITIVE final_orientation and quote the exact phrase in orientation_explanation. DO NOT perform visual analysis below.
       IF the description mentions compass directions ONLY in the non-orientation contexts above — treat Step 1 as NO MATCH and proceed to Step 2.
     - STEP 2 (Visual Analysis — Fallback ONLY): Only use this if Step 1 found NO explicit facing language. Analyze the Zoom In map image to determine which direction the front of the home faces:
       * MAP ORIENTATION: Top = North, Right = East, Bottom = South, Left = West. Diagonals: Top-Right = Northeast, Top-Left = Northwest, Bottom-Right = Southeast, Bottom-Left = Southwest.
       * STEP A — Find the closest point: Identify the home's address street in the map. For CURVED or DIAGONAL streets, locate the specific segment that is CLOSEST to the home marker (do not average the whole street — zoom in mentally to just the nearest bend or segment).
       * STEP B — Determine the LOCAL street direction at that closest segment: Describe how that specific segment runs as a compass direction pair (e.g., "Northwest to Southeast", "East to West", "North-Northeast to South-Southwest"). Use the map orientation (top=North) strictly.
       * STEP C — Determine the home's position relative to the street: State which side of the street the home marker sits on, using ONLY compass terms (e.g., "Southwest of the street", "North of the street"). DO NOT use left/right/above/below.
       * STEP D — Infer facing direction using the PERPENDICULAR-TO-STREET rule:
         The front of the home faces TOWARD the street. Draw an imaginary perpendicular line from the home marker to the nearest point on the street — the direction that line points (home → street) is the facing direction.
         Cardinal examples:
           - Street runs E-W, home is NORTH of street → faces South
           - Street runs E-W, home is SOUTH of street → faces North
           - Street runs N-S, home is EAST of street → faces West
           - Street runs N-S, home is WEST of street → faces East
         Diagonal examples (the most common real-world case):
           - Street runs NW-SE, home is SOUTHWEST of street → faces Northeast
           - Street runs NW-SE, home is NORTHEAST of street → faces Southwest
           - Street runs NE-SW, home is NORTHWEST of street → faces Southeast
           - Street runs NE-SW, home is SOUTHEAST of street → faces Northwest
         For streets that are slightly off-axis (e.g., NNW-SSE), apply the same logic and choose the closest 8-point compass direction for the result.
       NOTE FOR CURVED STREETS: If the street curves, analyze ONLY the segment immediately adjacent to the home marker (where the driveway or lot boundary meets the street). Do NOT average across the entire curve — the relevant segment is ~50–100m of street nearest the home.

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
        home_position_relative_to_street: { type: Type.STRING, description: "Position of the home in relation to the street using compass directions only — e.g. 'North of the street', 'South of the street', 'East of the street', 'West of the street'. Do NOT use left/right/above/below." },
        final_orientation: { type: Type.STRING, description: "The deduced direction the front of the house faces. Must be a short compass direction ONLY — e.g. 'North', 'South', 'East', 'West', 'Northeast', 'Southwest', etc. Do NOT include any explanation here; put all reasoning in orientation_explanation." },
        orientation_explanation: { type: Type.STRING, description: "Detailed reasoning explaining how the orientation was determined, referencing specific map elements or text clues." }
      },
      required: ["final_orientation", "orientation_explanation"]
    }
  },
  required: ["overview", "neighborhood_features", "orientation"]
};