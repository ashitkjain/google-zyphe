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

  1. OVERVIEW: Write a professional summary of the neighborhood's character and location value. Cover street layout, density, greenery, infrastructure, topography, development patterns, and nearby amenities. If the Property Description indicates the home is part of an HOA or planned community, mention HOA amenities (pools, clubhouses, fitness centers, etc.).
  2. VISUAL POI EXTRACTION: Meticulously analyze the "Zoom Out" map image to extract ALL visible text labels.
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

  Return the response as a single JSON object matching the requested schema. 
  Ensure the "overview" provides a high-level summary of the "vibe" found in the imagery${places ? ', enriched with the specific Google Places venue data provided above' : ''}.
`;
};

export const neighborhoodAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    overview: {
      type: Type.STRING,
      description: "A professional summary of the neighborhood's character and location value based on the map visuals, covering street layout, density, greenery, infrastructure, topography, development patterns, and amenities."
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
    }
  },
  required: ["overview"]
};