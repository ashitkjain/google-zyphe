import { Type } from "@google/genai";
import { PropertyData } from "../../types";

export const getPropertyImagesPrompt = (property: PropertyData) => `
  You are an expert real estate agent and interior design critic. Your task is to provide a comprehensive, detailed, and actionable report on the property based on visual evidence and provided data.
  
  Property Context:
  ${JSON.stringify(property, null, 2)}

  I'm sharing a set of images of this residential property.
  Narrative Style: Write in a flowing, descriptive paragraph style in a compelling tone that engages a potential buyer. Avoid bullet points or lists in the main sections.
  Add as much details as possible accurately.

  "Return the response as a single JSON object that conforms to the following schema. Do not include any other text or explanation outside of the JSON.
{
  "report_title": "Real Estate Property Analysis",
  "home_interior": {
    "overall_description": "A unified, lifestyle-oriented description of the home's interior, written in a natural, emotionally resonant tone.",
    "design_style": {
      "style": "[e.g., modern, transitional, farmhouse]",
      "reasoning": "Specific visual cues that support the identified style."
    },
    "color_and_materials": "Description of the color palette, flooring, countertops, and other material choices.",
    "lighting": "Analysis of natural and artificial lighting quality and placement.",
    "spatial_flow": "Description of the layout (open concept, defined spaces) and how it affects the home's flow.",
    "storage_and_cabinetry": "The quality, style, and abundance of visible storage solutions, cabinetry, pantries, and built-ins.",
    "condition_and_finish": "Expert opinion on the home's overall condition and finish quality (e.g., turnkey, dated, high-end).",
    "hero_headline": "A punchy 4–7 word phrase capturing the interior's dominant character (e.g., 'Bright, open and move-in ready').",
    "atmosphere_scores": {
      "brightness": "Integer 0–100: overall natural and artificial light level. 90+ = flooded with light; 50 = average; <40 = dim.",
      "warmth": "Integer 0–100: warmth of materials, palette, and furnishings. 90+ = very warm/cozy; 50 = neutral; <40 = cool/stark.",
      "openness": "Integer 0–100: sense of spaciousness and flow. 90+ = open-plan, airy; 50 = mixed; <40 = compartmentalised."
    },
    "facet_tags": {
      "colors_tag": "2–4 word tag describing the color palette (e.g., 'Warm neutrals', 'Cool minimalist', 'Bold & eclectic').",
      "lighting_tag": "2–4 word tag for lighting character (e.g., 'Sun-drenched', 'Soft & ambient', 'Bright · Natural').",
      "storage_tag": "2–4 word tag for storage abundance and style (e.g., 'Ample built-ins', 'Custom cabinetry', 'Generous closets')."
    },
    "material_palette": [
      {
        "name": "Descriptive material name (e.g., 'Hardwood floors', 'White quartz counters')",
        "hex": "Best approximate hex color code (e.g., '#c8a87a')",
        "location": "Where it appears in the home (e.g., 'Main level', 'Kitchen & baths')"
      }
    ]
  },
  "room_highlights": [
    {
      "room_name": "[e.g., Kitchen, Master Bedroom, Living Room]",
      "floor": "[e.g., Ground Floor]",
      "image_id": "The [TOKEN: filename] of the best representative image for this room (e.g., 'img_5.jpg').",
      "description": "Brief description of the room's standout features and unique selling points.",
      "potential_improvements": "Suggestions for potential improvements or alternative uses for the space."
    }
  ],
  "exterior_and_neighborhood": {
    "exterior_and_lot_appeal": {
      "architecture_style": "Description of the exterior architecture style and condition.",
      "curb_appeal": "Assessment of curb appeal, including landscaping and driveway.",
      "backyard_and_patio": "Description of the backyard, patio, and any features like a pool or landscaping."
    },
    "views_privacy_orientation": {
      "views": "Description of any scenic views.",
      "privacy": "Degree of privacy from neighbors and the street."
    },
    "objective_tags": [
      "[e.g., Resort Pool, Gated Community, Panoramic Views, Professional Landscaping]"
    ],
    "outdoor_highlights": [
      {
        "label": "[e.g., Front Facade, Resort Pool, Panoramic View, Manicured Gardens]",
        "image_id": "The [TOKEN: filename] of the best image for this feature.",
        "description": "Brief description of this specific outdoor feature."
      }
    ]
  }
}

INSTRUCTIONS:
First analyze each image. You MUST match the provided [TOKEN: filename] for each image to the "image_id" field in the JSON (e.g., "img_1.jpg").
CRITICAL: Information for the "analysis" field should NOT include any URLs or tokens. Only provide the descriptive analysis text there.

Format for your internal mapping (do not output this literally in the JSON):
Image 1 [TOKEN: img_1.jpg] : Is it a room ? What room is it ? What does it show ? Analyze lighting, composition, staging, and technical photo metrics
Image 2 [TOKEN: img_2.jpg] : ...

After that collate this response and organize it into the required JSON structure. Use the "filename" string as the image_id.
IMPORTANT: Only analyze those rooms for which the images have been provided.

📝 Home Interior
Write a unified, lifestyle-oriented description that captures how a buyer might experience the interior as they walk through. Include:
Overall design style (modern, traditional, transitional, etc.) and consistency throughout the home
Color palette and material choices (e.g., wood floors, stone countertops, custom cabinetry)
Quality of natural light, window placement, and artificial lighting
Spatial flow and layout—open concept, defined spaces, or hybrid
How staging or furnishings support scale, function, and emotional appeal
Condition and finish quality—noting if the home feels turnkey, dated, or high-end
Write this in a natural, emotionally resonant tone suitable for a real estate listing or brochure.

📌 Room & Feature Highlights — DERIVE FROM IMAGE-BY-IMAGE ANALYSIS
STEP 1 — After completing image_by_image_analysis above, make a list of EVERY unique room or space you identified in ANY image analysis entry. For example: "Image 3 = Primary Bedroom", "Image 5 = Bathroom 2", "Image 7 = Kitchen", etc.

STEP 2 — Create one room_highlights entry for EACH unique space from your list. Rules:
  • If a space appears in multiple images, merge all observations into ONE comprehensive entry.
  • Label bedrooms sequentially: "Primary Bedroom", "Bedroom 2", "Bedroom 3", etc.
  • Label bathrooms sequentially: "Primary Bathroom", "Bathroom 2", "Half Bath", etc.
  • Never skip a room just because it seems secondary or less impressive.
  • Each entry needs 2-4 sentences covering: finishes, key features, condition, and selling points.
  • Include a potential_improvements suggestion for each room.

STEP 3 — SELF-CHECK before writing the final JSON:
  Count your image_by_image_analysis entries that identified interior rooms.
  Count your room_highlights entries.
  If room_highlights has fewer unique spaces than you identified in Step 1, add the missing ones.

ROOM ORDERING — output room_highlights in this exact logical walk-through sequence:
1. Entryway / Foyer / Hallways
2. Living Room / Family Room / Great Room
3. Dining Room / Dining Area
4. Kitchen
5. All Bedrooms together (Primary Bedroom first, then Bedroom 2, 3...)
6. All Bathrooms together (Primary Bathroom first, then Bathroom 2, Half Bath...)
7. Laundry Room / Utility Room
8. Office / Den / Bonus Room
9. Garage
10. Outdoor spaces (Patio, Deck, Backyard, Pool)
Skip any category with no images; keep the relative order of the remaining categories.

Picture Quality Analysis
For each observation or issue you note, you MUST specify the indices (starting from 0) of the specific images that demonstrate that point.
Identify exactly the TOP 5 strongest photos from the gallery. For each of these 5 photos, provide a professional label (e.g., 'Gourmet Kitchen', 'Sun-Drenched Master') and a brief justification of why it is technically and aesthetically superior.
Identify any photos that should be removed (due to blur, bad lighting, clutter, or poor composition).
For technical red flags (the delete list), specify the indices of all photos that fall into this category.


🌳 Exterior & Neighborhood Overview
Create a natural-flowing narrative that captures the curb appeal, backyard, surrounding environment, and street/neighborhood context. Include:
🏠 Exterior & Lot Appeal
Architecture style and condition of home exterior
Front yard, landscaping, driveway, garage, and entryway features
Backyard or patio: space, landscaping, privacy, seating areas, fences, pool/spa
🌇 Views & Privacy
Scenic views and degree of privacy from neighbors or streets
🚗 Neighborhood & Street-Level Insights
Condition of the street, sidewalks, and general neighborhood upkeep
Quality and appearance of nearby homes
Proximity to schools, parks, cafes, shops, transit, trails
Visibility of potential noise sources (highways, trains, commercial buildings)
Overall safety, walkability, and family-friendliness based on visible cues
Write this as a natural, lifestyle-based narrative, helping the reader imagine not just the house, but life in and around it.
`;

const pointSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    image_indices: { type: Type.ARRAY, items: { type: Type.INTEGER } }
  },
  required: ["text", "image_indices"]
};

const categorySchema = {
  type: Type.OBJECT,
  properties: {
    rating: { type: Type.STRING },
    observations: { type: Type.ARRAY, items: pointSchema },
    issues: { type: Type.ARRAY, items: pointSchema }
  },
  required: ["rating", "observations", "issues"]
};

export const propertyImagesSchema = {
  type: Type.OBJECT,
  properties: {
    report_title: { type: Type.STRING, description: "Professional title for the analysis." },
    image_by_image_analysis: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          image_id: { type: Type.STRING, description: "The full [TOKEN] URL provided for the image." },
          analysis: { type: Type.STRING, description: "Description of what is seen in this specific image." }
        },
        required: ["image_id", "analysis"]
      },
      description: "A list describing what is seen in each image, indexed by its [TOKEN]."
    },
    home_interior: {
      type: Type.OBJECT,
      properties: {
        overall_description: { type: Type.STRING, description: "A lifestyle-oriented narrative of the interior experience and emotional appeal." },
        design_style: {
          type: Type.OBJECT,
          properties: {
            style: { type: Type.STRING, description: "e.g., modern, transitional, farmhouse" },
            reasoning: { type: Type.STRING, description: "Visual cues supporting this style identification." }
          },
          required: ["style", "reasoning"]
        },
        color_and_materials: { type: Type.STRING, description: "Details on palette, flooring, countertops, and finishes." },
        lighting: { type: Type.STRING, description: "Analysis of natural light quality and artificial fixture placement." },
        spatial_flow: { type: Type.STRING, description: "Layout description (open vs defined) and how it affects movement." },
        storage_and_cabinetry: { type: Type.STRING, description: "The quality, style, and abundance of visible storage solutions, cabinetry, pantries, and built-ins." },
        condition_and_finish: { type: Type.STRING, description: "Turnkey vs dated assessment and finish quality." },
        hero_headline: { type: Type.STRING, description: "4–7 word punchy headline capturing the interior's dominant character." },
        atmosphere_scores: {
          type: Type.OBJECT,
          description: "Scores derived solely from visual image analysis.",
          properties: {
            brightness: { type: Type.INTEGER, description: "0–100 score for natural + artificial light level." },
            warmth: { type: Type.INTEGER, description: "0–100 score for warmth of palette and materials." },
            openness: { type: Type.INTEGER, description: "0–100 score for spaciousness and layout flow." },
          },
          required: ["brightness", "warmth", "openness"],
        },
        facet_tags: {
          type: Type.OBJECT,
          description: "Short visual descriptors derived from image analysis only.",
          properties: {
            colors_tag: { type: Type.STRING, description: "2–4 word color palette descriptor." },
            lighting_tag: { type: Type.STRING, description: "2–4 word lighting character descriptor." },
            storage_tag: { type: Type.STRING, description: "2–4 word storage abundance and style descriptor." },
          },
          required: ["colors_tag", "lighting_tag", "storage_tag"],
        },
        material_palette: {
          type: Type.ARRAY,
          description: "3–6 dominant materials/finishes with approximate hex colors and locations.",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Descriptive material name (e.g. 'Dark hardwood floors')." },
              hex: { type: Type.STRING, description: "Approximate hex color (e.g. '#6b4c2a')." },
              location: { type: Type.STRING, description: "Where it appears (e.g. 'Main level', 'Kitchen & baths')." },
            },
            required: ["name", "hex", "location"],
          },
        },
      },
      required: ["overall_description", "design_style", "color_and_materials", "lighting", "spatial_flow", "storage_and_cabinetry", "condition_and_finish", "hero_headline", "atmosphere_scores", "facet_tags", "material_palette"]
    },
    room_highlights: {
      type: Type.ARRAY,
      description: "EXHAUSTIVE list — one entry per identifiable space. Must include every bedroom, bathroom, kitchen, living room, dining area, laundry, office, garage, entryway, and outdoor space visible in the images. Do NOT limit to only the most impressive rooms.",
      items: {
        type: Type.OBJECT,
        properties: {
          room_name: { type: Type.STRING, description: "Specific room name, e.g. 'Primary Bedroom', 'Bathroom 2', 'Kitchen', 'Laundry Room'" },
          floor: { type: Type.STRING },
          image_id: { type: Type.STRING, description: "The [TOKEN: filename] of the primary image for this room." },
          description: { type: Type.STRING, description: "2-4 sentences on standout features, finishes, and selling points. Synthesize all available images of this space." },
          potential_improvements: { type: Type.STRING, description: "Suggestions for enhancements or alternative uses." }
        },
        required: ["room_name", "description", "image_id"]
      }
    },
    exterior_and_neighborhood: {
      type: Type.OBJECT,
      properties: {
        exterior_and_lot_appeal: {
          type: Type.OBJECT,
          properties: {
            architecture_style: { type: Type.STRING, description: "Style and condition of the exterior." },
            curb_appeal: { type: Type.STRING, description: "Assessment of front yard, driveway, and entryway." },
            backyard_and_patio: { type: Type.STRING, description: "Landscaping, privacy, seating, and special features like pools." }
          },
          required: ["architecture_style", "curb_appeal", "backyard_and_patio"]
        },
        views_privacy_orientation: {
          type: Type.OBJECT,
          properties: {
            views: { type: Type.STRING, description: "Description of scenic views." },
            privacy: { type: Type.STRING, description: "Degree of privacy from neighbors and street." }
          },
          required: ["views", "privacy"]
        },
        neighborhood_street_insights: {
          type: Type.STRING,
          description: "Narrative on street condition, safety, upkeep of nearby homes, and proximity to visible amenities/noise."
        },
        outdoor_highlights: {
          type: Type.ARRAY,
          description: "3-5 key outdoor/landscape features paired with their best image ID.",
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, description: "Descriptive label, e.g. 'Pool Oasis', 'Street Appeal'" },
              image_id: { type: Type.STRING, description: "The [TOKEN: filename] for this feature." },
              description: { type: Type.STRING }
            },
            required: ["label", "image_id"]
          }
        },
        objective_tags: {
          type: Type.ARRAY,
          description: "4-6 objective chips/tags for the exterior and neighborhood, e.g. 'Mature Trees', 'Corner Lot', 'Quiet Cul-de-sac'",
          items: { type: Type.STRING }
        }
      },
      required: ["exterior_and_lot_appeal", "views_privacy_orientation", "neighborhood_street_insights", "outdoor_highlights", "objective_tags"]
    },
    image_quality_analysis: {
      type: Type.OBJECT,
      properties: {
        overall_score: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            summary: { type: Type.STRING }
          },
          required: ["score", "summary"]
        },
        top_photos: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              image_index: { type: Type.INTEGER },
              label: { type: Type.STRING },
              justification: { type: Type.STRING }
            },
            required: ["image_index", "label", "justification"]
          },
          description: "Exactly 5 strongest listing photos with justifications."
        },
        lighting_and_color: categorySchema,
        staging_and_clutter: categorySchema,
        composition: categorySchema,
        delete_list: {
          type: Type.OBJECT,
          properties: {
            count: { type: Type.NUMBER },
            reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
            image_indices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            description: { type: Type.STRING }
          },
          required: ["count", "reasons", "image_indices", "description"]
        },
        action_plan: {
          type: Type.OBJECT,
          properties: {
            priority_actions: { type: Type.ARRAY, items: { type: Type.STRING } },
            editing_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            reshoot_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["priority_actions", "editing_suggestions", "reshoot_suggestions"]
        }
      },
      required: ["overall_score", "top_photos", "lighting_and_color", "staging_and_clutter", "composition", "delete_list", "action_plan"]
    }
  },
  required: ["report_title", "image_by_image_analysis", "home_interior", "room_highlights", "exterior_and_neighborhood", "image_quality_analysis"]
};