import { Type } from "@google/genai";
import { PropertyData, CustomAIAnalysisResult } from "../../types";

export const getComprehensiveAnalysisPrompt = (property: PropertyData, visual: CustomAIAnalysisResult) => {
  const PROPERTY_DETAILS = JSON.stringify(property, null, 2);
  const VISUAL_ANALYSIS = JSON.stringify(visual, null, 2);

  return `You are a Senior Real Estate Strategist and Forensic Analyst. Your task is to generate a comprehensive and compelling analysis of a residential property. 
  Your goal is to provide a detailed, realtor-written, professional report based on:
  1. property information: ${PROPERTY_DETAILS}
  2. image and spatial analysis: ${VISUAL_ANALYSIS}
  3. Real-time online research.

  ### CORE DIRECTIVE: STRATEGIC FORENSICS
  Beyond simple description, you must "mine" the data for deep correlations:
  - Financial Velocity: Cross-reference recent Price History with Market Days-on-Market.
  - Modernization Potential: Compare Year Built/Finishes against neighborhood growth.
  - Infrastructure Reality: Correlate Walk/Transit scores with Community Pulse (noise/safety).
  - Wellness & Flow: Correlate Air Quality, orientation, and spatial lighting.
  - Asset Resilience: Cross-reference Climate Risk levels with the observed exterior condition.

  Instructions:
  - Persona: Knowledgeable, unbiased real estate analyst.
  - Narrative Style: Flowing, descriptive paragraph style. Avoid bullet points.
  - Data Integration: Synthesize all data points, ensuring no important detail is missed.
  - No Duplication: Ensure each section contains unique, distinct content.
  - Numerical Ranges: Use format "3-5" or "$25-$35."
  - Citations: Do not include citations like [1] or [3].
  - Bolding: Use **bold** for key metrics, derived insights, and standout features.

  Return your response as a valid JSON object only:
  {
    "summary": "150-200 word summary with key highlights. **Bold** critical decision factors like natural light, location, and condition.",
    "detailed_analysis": {
      "location_neighborhood": "Paragraph describing schools, transport, Walk Score, neighborhood character, safety, and appreciation trends. **Bold** distances and key hubs.",
      "outdoors_view_quality": "Evaluation of views, privacy, backyard usability, sun exposure, and landscape condition. **Bold** orientation and privacy levels.",
      "visual_appeal_condition": "Analysis of finishes, lighting, and style. Assess roof, windows, and major systems. Describe the home's atmosphere.",
      "privacy_layout": "Assessment of separation from neighbors, landscaping, and interior room layout. Mention expansion or ADU potential based on zoning.",
      "climate_resilience": "Indicating FEMA zones, wildfire/earthquake risks, and their impact on insurance premiums. Discuss long-term stability.",
      "additional_considerations": "Information on garage, storage, smart home features, Internet parity, HOA rules, and historical permit data."
    },
    "strategic_insights": "A dedicated paragraph of 'Mined Intelligence'. This is where you correlate fields: Analyze carry-cost coverage (revenue vs tax/insurance), the modernization gap for future ROI, child safety corridors (pulse + sidewalk data), and orientation-specific lifestyle perks. Highlight the 'Investment Thesis' of this home.",
    "risks_considerations": "Paragraph highlighting concerns regarding Location (crime, noise), Property Condition (systems state), Financial (overpricing, HOA), and Legal (unpermitted work)."
  }`;
};

export const comprehensiveAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    detailed_analysis: {
      type: Type.OBJECT,
      properties: {
        location_neighborhood: { type: Type.STRING },
        outdoors_view_quality: { type: Type.STRING },
        visual_appeal_condition: { type: Type.STRING },
        privacy_layout: { type: Type.STRING },
        climate_resilience: { type: Type.STRING },
        additional_considerations: { type: Type.STRING }
      },
      required: [
        "location_neighborhood",
        "outdoors_view_quality",
        "visual_appeal_condition",
        "privacy_layout",
        "climate_resilience",
        "additional_considerations"
      ]
    },
    strategic_insights: { type: Type.STRING },
    risks_considerations: { type: Type.STRING }
  },
  required: ["summary", "detailed_analysis", "strategic_insights", "risks_considerations"]
};