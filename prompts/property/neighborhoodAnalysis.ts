import { Type } from "@google/genai";
import { PropertyData } from "../../types";
import { buildMlsFactsBlock } from "./mlsFacts";
import type { NeighborhoodPlaces } from "../../services/apiService";

/** Converts raw NeighborhoodPlaces data into a concise textual summary for Gemini. */
const buildPlacesContextBlock = (places: NeighborhoodPlaces): string => {
  const LABELS: Record<string, { label: string; radius: string }> = {
    dining: { label: 'Dining (Restaurants/Cafes)', radius: '800m' },
    shopping: { label: 'Shopping & Groceries', radius: '2.5km' },
    parks: { label: 'Parks & Green Space', radius: '1.2km' },
    transit: { label: 'Transit Stops', radius: '1.5km' },
    fitness: { label: 'Gyms & Fitness', radius: '1.5km' },
    schools: { label: 'Schools', radius: '2km' },
    medical: { label: 'Medical (Hospitals/Doctors)', radius: '2km' },
    community: { label: 'Community & Civic', radius: '2km' },
  };

  const lines: string[] = [];
  for (const [key, { label, radius }] of Object.entries(LABELS)) {
    const list = (places as any)[key] as { name: string; rating?: number }[];
    if (!list || list.length === 0) {
      lines.push(`  • ${label} (within ${radius}): None found`);
      continue;
    }
    const topNames = list
      .slice(0, 3)
      .map(p => p.rating ? `${p.name} (⭐${p.rating.toFixed(1)})` : p.name)
      .join(', ');
    const more = list.length > 3 ? ` + ${list.length - 3} more` : '';
    lines.push(`  • ${label} (within ${radius}): ${list.length} found — e.g. ${topNames}${more}`);
  }

  return `
--- LIVE GOOGLE PLACES DATA (as of this analysis) ---
The following amenity data was retrieved from the Google Places API for this exact location.
Use it to ground your "nearby_amenities" and "overview" fields with specific, factual venue references.
Do NOT contradict these counts or names in your response.

${lines.join('\n')}
--- END GOOGLE PLACES DATA ---`;
};

export const getNeighborhoodAnalysisPrompt = (property: PropertyData, places?: NeighborhoodPlaces) => {
  const placesBlock = places ? buildPlacesContextBlock(places) : '';
  return `
  You are an expert Spatial Analyst and Urban Planning Consultant. 
   
  I am providing you with two map images for the property at: ${property.address}.
  - Image 1 (Zoom In): A close-up view showing the property parcel, home marker, and immediate street.
  - Image 2 (Zoom Out): A broader view of the neighborhood context.

  ${buildMlsFactsBlock(property)}
  ${placesBlock}

  IMPORTANT RULE: You MUST treat every fact in the "KNOWN MLS / LISTING FACTS" block above as ground truth.
  Do NOT contradict or make assumptions that conflict with any of those values in your response — including the property description.

  TASK:
  Analyze the provided map images in detail. Your analysis should be based primarily on visual evidence in the maps.
  
  INSTRUCTIONS:

  1. STREET LAYOUT: Identify the street pattern (e.g., quiet cul-de-sac, grid system, busy arterial proximity). Note traffic flow indicators.
  2. DENSITY & LAND USE: Evaluate the neighborhood density. Are homes tightly packed? Are there large lots? Are there commercial or industrial buffers nearby?
  3. GREENERY & BLUE SPACE: Identify visible parks, wooded areas, walking trails, or bodies of water in the immediate vicinity.
  4. INFRASTRUCTURE: Look for sidewalks, crosswalks, and pedestrian-friendly features.
  5. TOPOGRAPHY: Note any significant slopes, hills, or unique geographical features visible in the map context.
  6. DEVELOPMENT: Assess the age and style of surrounding development based on the roof patterns and parcel layouts.
  7. VISUAL POI EXTRACTION: Meticulously analyze the "Zoom Out" map image to extract ALL visible text labels.
     - FIRST, list EVERY text label you can read on the map (labels for venues, stores, parks, etc.).
     - SECOND, filter out street names and broad region names (e.g. city name, county name, or general area names like "East Bay").
     - THIRD, categorize EVERY unique venue label found in step 1 into the "visual_poi" object fields. 
     - CRITICAL CATEGORIZATION RULES (Use this Taxonomy):
          * DINING: Restaurants, Cafes, Coffee Shops, Fast Food, Bars, Bakeries, Pizzerias, Bistros.
          * SHOPPING: Groceries (Safeway, Whole Foods, Trader Joes), Pharmacies (CVS, Walgreens), Retailers (Target, Walmart, Apple), Malls, Department Stores, Boutiques, Hardware (Home Depot).
          * MEDICAL: Hospitals, Clinics, Dental Offices, Urgent Care, Optical, Specialists (e.g., Kaiser, Sutter Health).
          * COMMUNITY: Places of Worship (Church, Temple), Civic (Post Office, Library, Police, Fire), Community Centers, Town Halls, Civic Hubs.
          * PARKS: Parks, Trails, Nature Reserves, Playgrounds, Beaches, Gardens.
          * FITNESS: Gyms, Yoga Studios, Health Clubs, Sports Courts, Arenas.
          * TRANSIT: Stations, Transit Hubs, Terminals, Major Bus Stops.
          * OTHERS: Only for major unique landmarks (Monuments, Historic Sites) that fit nowhere else.
      - PROHIBITED: Do NOT include street names, highway numbers, city/county names, or generic area descriptors in these categories.
     - EVERY single unique detected label from step 1 MUST be categorized into exactly one "visual_poi" field. No label should be left uncategorized.
     - Include these extracted names in the "map_labels" field as a raw list for verification.
      - FOURTH, for EACH POI you categorized, also estimate its normalized center position on the "Zoom Out" map image.
        Coordinates use a 0-1000 scale where [0,0] is the top-left corner and [1000,1000] is the bottom-right.
        The property marker (center of the map) is approximately at [500, 500].
        Return these in the "visual_poi_positions" array as objects with name, center_y, and center_x.
  8. AMENITIES: Identify retail, dining, HOA amenities and service clusters nearby. 
     IMPORTANT: If the Property Description indicates the home is part of an HOA or planned community, specifically include the list of HOA amenities (pools, clubhouses, fitness centers, etc.) in your response.

  Return the response as a single JSON object matching the requested schema. 
  Ensure the "overview" provides a high-level summary of the "vibe" found in the imagery${places ? ', enriched with the specific Google Places venue data provided above' : ''}.
`;
};

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
    map_labels: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A raw list of all non-street text labels identified from the map images."
    },
    visual_poi: {
      type: Type.OBJECT,
      description: "Points of Interest extracted directly from visual map analysis.",
      properties: {
        dining: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Restaurants, Cafes, Coffee shops, etc." },
        shopping: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Groceries, Pharmacies, Retail Stores, Malls, Boutiques, etc." },
        parks: { type: Type.ARRAY, items: { type: Type.STRING } },
        transit: { type: Type.ARRAY, items: { type: Type.STRING } },
        fitness: { type: Type.ARRAY, items: { type: Type.STRING } },
        schools: { type: Type.ARRAY, items: { type: Type.STRING } },
        medical: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Dentists, Hospitals, Doctors, Clinics, etc." },
        community: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Places of worship, Police, Fire stations, Libraries, Community centers, etc." },
        others: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    visual_poi_positions: {
      type: Type.ARRAY,
      description: "Normalized center positions (0-1000 scale) for each visually extracted POI on the Zoom Out map. The property is at approximately [500, 500].",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Exact POI name as listed in visual_poi" },
          center_y: { type: Type.NUMBER, description: "Normalized Y coordinate (0=top, 1000=bottom)" },
          center_x: { type: Type.NUMBER, description: "Normalized X coordinate (0=left, 1000=right)" }
        },
        required: ["name", "center_y", "center_x"]
      }
    }
  },
  required: ["overview", "neighborhood_features"]
};