import { Type } from "@google/genai";

export const propertyImagesPrompt = `
  You are an expert real estate agent and interior design critic. Your task is to provide a comprehensive, detailed, and actionable report on the property.
I'm sharing a set of images of a residential property.
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
    "staging_and_furnishings": "How the furnishings support the scale, function, and appeal of the space.",
    "condition_and_finish": "Expert opinion on the home's overall condition and finish quality (e.g., turnkey, dated, high-end).",
    "suggested_lifestyle": {
      "lifestyle": "[e.g., entertaining, relaxed family life, luxury retreat]",
      "buyer_type": "[e.g., families, young professionals, downsizers]"
    }
  },
  "room_highlights": [
    {
      "room_name": "[e.g., Kitchen, Master Bedroom, Living Room]",
      "floor": "[e.g., Ground Floor]",
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
      "orientation": "Orientation of the home and sun exposure (e.g., south-facing backyard).",
      "privacy": "Degree of privacy from neighbors and the street."
    }
  }
}
INSTRUCTIONS:

First analyze each image and describe what you see in each one, in this format -
Image 1 : Is it a room ? What room is it ? What does it show ?
Image 2 : Is it a room ? What room is it ? What does it show ?
And so on.

After that collate this response and organize it into three sections:

IMPORTANT ;  Only analyze those rooms for which the images have been provided

📝 Home Interior
Write a unified, lifestyle-oriented description that captures how a buyer might experience the interior as they walk through. Include:
Overall design style (modern, traditional, transitional, etc.) and consistency throughout the home
Color palette and material choices (e.g., wood floors, stone countertops, custom cabinetry)
Quality of natural light, window placement, and artificial lighting
Spatial flow and layout—open concept, defined spaces, or hybrid
How staging or furnishings support scale, function, and emotional appeal
Condition and finish quality—noting if the home feels turnkey, dated, or high-end
What lifestyle the home suggests (entertaining, relaxed family life, luxury retreat)
The likely buyer type (e.g., families, young professionals, downsizers)
Write this in a natural, emotionally resonant tone suitable for a real estate listing or brochure.

📌 Room & Feature Highlights
List and briefly describe the standout rooms and interior features based on the images, only if images have been provided

Use a bulleted list or short paragraph per room/space.
🌳 Exterior & Neighborhood Overview
Create a natural-flowing narrative that captures the curb appeal, backyard, surrounding environment, and street/neighborhood context. Include:
🏠 Exterior & Lot Appeal
Architecture style and condition of home exterior
Front yard, landscaping, driveway, garage, and entryway features
Backyard or patio: space, landscaping, privacy, seating areas, fences, pool/spa
🌇 Views, Privacy, & Orientation
Scenic views, orientation of the home (e.g., south-facing backyard, sunset exposure)
Degree of privacy from neighbors or streets
Sunlight exposure based on shadows or compass cues
🚗 Neighborhood & Street-Level Insights
Condition of the street, sidewalks, and general neighborhood upkeep
Quality and appearance of nearby homes
Proximity to schools, parks, cafes, shops, transit, trails
Visibility of potential noise sources (highways, trains, commercial buildings)
Overall safety, walkability, and family-friendliness based on visible cues
Write this as a natural, lifestyle-based narrative, helping the reader imagine not just the house, but life in and around it.

Additional Notes:
Do not repeat information across sections unless it's especially important.
Use language that helps a buyer visualize daily life in this home
If anything is unclear or not visible in the images, say so gracefully ("appears to be…", "not clearly visible")`;

export const propertyImagesSchema = {
  type: Type.OBJECT,
  properties: {
    report_title: { type: Type.STRING, description: "Professional title for the analysis." },
    image_by_image_analysis: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list describing what is seen in each image (e.g., 'Image 1: Master bedroom with floor-to-ceiling windows')."
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
        staging_and_furnishings: { type: Type.STRING, description: "How furnishings support scale and functional appeal." },
        condition_and_finish: { type: Type.STRING, description: "Turnkey vs dated assessment and finish quality." },
        suggested_lifestyle: {
          type: Type.OBJECT,
          properties: {
            lifestyle: { type: Type.STRING, description: "e.g., entertaining, luxury retreat" },
            buyer_type: { type: Type.STRING, description: "e.g., families, young professionals, downsizers" }
          },
          required: ["lifestyle", "buyer_type"]
        }
      },
      required: ["overall_description", "design_style", "color_and_materials", "lighting", "spatial_flow", "staging_and_furnishings", "condition_and_finish", "suggested_lifestyle"]
    },
    room_highlights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          room_name: { type: Type.STRING },
          floor: { type: Type.STRING },
          description: { type: Type.STRING, description: "Standout features and selling points." },
          potential_improvements: { type: Type.STRING, description: "Suggestions for enhancements or alternative uses." }
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
            orientation: { type: Type.STRING, description: "Sun exposure and compass orientation cues." },
            privacy: { type: Type.STRING, description: "Degree of privacy from neighbors and street." }
          },
          required: ["views", "orientation", "privacy"]
        },
        neighborhood_street_insights: {
          type: Type.STRING,
          description: "Narrative on street condition, safety, upkeep of nearby homes, and proximity to visible amenities/noise."
        }
      },
      required: ["exterior_and_lot_appeal", "views_privacy_orientation", "neighborhood_street_insights"]
    }
  },
  required: ["report_title", "image_by_image_analysis", "home_interior", "room_highlights", "exterior_and_neighborhood"]
};