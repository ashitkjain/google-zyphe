export const getPropertyImagesPrompt = (property) => `
  You are an expert real estate agent and interior design critic. Your task is to provide a comprehensive, detailed, and actionable report on the property based on visual evidence and provided data.
  
  Property Context:
  ${JSON.stringify(property, null, 2)}

  I'm sharing a set of images of this residential property.
  Narrative Style: Write in a flowing, descriptive paragraph style in a compelling tone that engages a potential buyer. Avoid bullet points or lists in the main sections.
  Add as much details as possible accurately.

  Return the response as a single JSON object. Do not include any other text or explanation outside of the JSON.
{
  "report_title": "Real Estate Property Analysis",
  "home_interior": {
    "overall_description": "A unified, lifestyle-oriented description of the home's interior.",
    "design_style": {
      "style": "[e.g., modern, transitional, farmhouse]",
      "reasoning": "Specific visual cues that support the identified style."
    },
    "color_and_materials": "Description of the color palette, flooring, countertops, and other material choices.",
    "lighting": "Analysis of natural and artificial lighting quality and placement.",
    "spatial_flow": "Description of the layout and how it affects the home's flow.",
    "staging_and_furnishings": "How the furnishings support the scale, function, and appeal of the space.",
    "condition_and_finish": "Expert opinion on the home's overall condition and finish quality.",
    "hero_headline": "A punchy 4-7 word phrase capturing the interior's dominant character.",
    "atmosphere_scores": {
      "brightness": 75,
      "warmth": 65,
      "openness": 80
    },
    "facet_tags": {
      "colors_tag": "2-4 word tag for color palette",
      "lighting_tag": "2-4 word tag for lighting",
      "staging_tag": "2-4 word tag for staging style"
    },
    "material_palette": [
      { "name": "Material name", "hex": "#c8a87a", "location": "Where it appears" }
    ],
    "interior_summary": "Neutral, factual 4-5 sentence summary of interior layout and materials",
    "rooms_summary": "Neutral, factual 4-5 sentence summary of identifiable rooms",
    "vibe": "Objective aesthetic atmosphere description",
    "objective_tags": ["hardwood-floors", "recessed-lighting", "etc"]
  },
  "room_highlights": [
    {
      "room_name": "[e.g., Kitchen, Master Bedroom, Living Room]",
      "floor": "[e.g., Ground Floor]",
      "image_id": "img_1.jpg",
      "description": "Brief description of the room's standout features.",
      "potential_improvements": "Suggestions for improvements."
    }
  ],
  "exterior_and_neighborhood": {
    "exterior_and_lot_appeal": {
      "architecture_style": "Description of exterior architecture style and condition.",
      "curb_appeal": "Assessment of curb appeal, including landscaping and driveway.",
      "backyard_and_patio": "Description of the backyard, patio, and any features like a pool."
    },
    "views_privacy_orientation": {
      "views": "Description of any scenic views.",
      "privacy": "Degree of privacy from neighbors and the street."
    },
    "neighborhood_street_insights": "Narrative on street condition, safety, upkeep of nearby homes, and proximity to visible amenities or noise sources.",
    "objective_tags": ["e.g., Resort Pool, Gated Community, Panoramic Views"],
    "outdoor_highlights": [
      {
        "label": "[e.g., Front Facade, Resort Pool]",
        "image_id": "img_1.jpg",
        "description": "Brief description of this outdoor feature."
      }
    ]
  }
}

INSTRUCTIONS:
First analyze each image. Match the provided filename for each image to the "image_id" field in the JSON.

After that collate this response and organize it into the required JSON structure.
IMPORTANT: Only analyze those rooms for which the images have been provided.

Room Ordering — output room_highlights in this logical sequence:
1. Entryway / Foyer / Hallways
2. Living Room / Family Room / Great Room
3. Dining Room / Dining Area
4. Kitchen
5. All Bedrooms (Primary Bedroom first, then Bedroom 2, 3...)
6. All Bathrooms (Primary Bathroom first, then Bathroom 2, Half Bath...)
7. Laundry Room / Utility Room
8. Office / Den / Bonus Room
9. Garage
10. Outdoor spaces (Patio, Deck, Backyard, Pool)

Exterior & Neighborhood: Create a natural-flowing narrative that captures the curb appeal, backyard, surrounding environment, and street/neighborhood context.
`;
