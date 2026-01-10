
import { Type } from "@google/genai";

export const getImageQualityAnalysisPrompt = () => `
  I am uploading photos for a new property listing. Please perform a comprehensive audit of the entire gallery and return your analysis as a JSON object.
  
  TASK:
  Analyze lighting, composition, staging, and technical photo metrics across all provided images.
  For each observation or issue you note, you MUST specify the indices (starting from 0) of the specific images that demonstrate that point.
  
  Identify exactly the TOP 5 strongest photos from the gallery. For each of these 5 photos, provide a professional label (e.g., 'Gourmet Kitchen', 'Sun-Drenched Master') and a brief justification of why it is technically and aesthetically superior.

  Identify any photos that should be removed (due to blur, bad lighting, clutter, or poor composition).
  For technical red flags (the delete list), specify the indices of all photos that fall into this category.

  Respond ONLY with the JSON object.
  
  Here are the photos:
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

export const imageQualityAnalysisSchema = {
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
  required: [
    "overall_score", 
    "top_photos", 
    "lighting_and_color", 
    "staging_and_clutter", 
    "composition", 
    "delete_list", 
    "action_plan"
  ]
};
