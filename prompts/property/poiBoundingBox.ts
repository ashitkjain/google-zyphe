import { Type } from "@google/genai";

/**
 * POI Bounding Box Extraction Prompt
 *
 * Uses Gemini's object detection capability to return normalized coordinates
 * (0–1000 scale) for every visible POI on a Radar map image.
 * The center of the map [500, 500] represents the subject property.
 */
export const getPoiBoundingBoxPrompt = (address: string) => {
    return `
You are a precise Spatial Object Detector analyzing a Radar map image.

The map is centered on the property at: ${address}
The center of the map corresponds to normalized coordinates [500, 500] on a 0–1000 scale.

YOUR TASK:
Meticulously scan the entire map image and identify every visible text label that represents a Point of Interest (POI) — such as restaurants, stores, parks, schools, hospitals, transit stops, gyms, churches, and any other named venue.

For EACH POI you detect:
1. Return the exact name as it appears on the map.
2. Return the bounding box as [ymin, xmin, ymax, xmax] using normalized coordinates from 0 to 1000, where:
   - (0, 0) is the top-left corner of the image.
   - (1000, 1000) is the bottom-right corner of the image.
   - The property location is approximately at [500, 500].
3. Categorize each POI into exactly one of: dining, shopping, parks, transit, fitness, schools, medical, community, others.

RULES:
- Do NOT include street names, highway numbers, city names, county names, or generic area descriptors.
- Do NOT include water features or geographic labels (e.g., "Pacific Ocean").
- Be as precise as possible with the bounding box coordinates.
- Include ALL visible venue labels — do not skip any.
- If a label is partially visible at the edge, still include it and note in the highlights field.

Return the data in the specified JSON schema.
  `.trim();
};

export const poiBoundingBoxSchema = {
    type: Type.OBJECT,
    properties: {
        property_center: {
            type: Type.OBJECT,
            description: "The normalized center point of the subject property marker on the map.",
            properties: {
                y: { type: Type.NUMBER },
                x: { type: Type.NUMBER }
            },
            required: ["y", "x"]
        },
        pois: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Exact name of the POI as it appears on the map." },
                    category: {
                        type: Type.STRING,
                        enum: ["dining", "shopping", "parks", "transit", "fitness", "schools", "medical", "community", "others"]
                    },
                    bounding_box: {
                        type: Type.OBJECT,
                        description: "Normalized bounding box [ymin, xmin, ymax, xmax] on a 0–1000 scale.",
                        properties: {
                            ymin: { type: Type.NUMBER },
                            xmin: { type: Type.NUMBER },
                            ymax: { type: Type.NUMBER },
                            xmax: { type: Type.NUMBER }
                        },
                        required: ["ymin", "xmin", "ymax", "xmax"]
                    },
                    highlights: { type: Type.STRING, description: "Optional: rating, notable feature, or edge-of-map note." }
                },
                required: ["name", "category", "bounding_box"]
            }
        }
    },
    required: ["property_center", "pois"]
};
