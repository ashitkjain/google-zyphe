import { Type } from "@google/genai";
import { PropertyData, CustomAIAnalysisResult } from "../../types";
import { buildMlsFactsBlock } from "./mlsFacts";

export const getComprehensiveAnalysisPrompt = (property: PropertyData, visual: CustomAIAnalysisResult) => {
  const PROPERTY_DETAILS = JSON.stringify(property, null, 2);
  const VISUAL_ANALYSIS = JSON.stringify(visual, null, 2);
  const schoolsData = (visual as any)?.schools_intelligence;
  const SCHOOLS_CONTEXT = schoolsData ? JSON.stringify(schoolsData, null, 2) : null;

  return `You are an AI-powered home buying assistant, tasked with generating a comprehensive and compelling analysis of a residential property. 
  Your goal is to provide a detailed, narrative-style, realtor written, professional report to a home buyer, based on a combination of provided - 

  ${buildMlsFactsBlock(property)}
  ${property.orientation_ai ? `\n  ORIENTATION AI GROUNDING (STRICT): The property has been analyzed to face: ${property.orientation_ai.final_orientation}. You MUST use this as the authoritative source of truth for the property's "direction facing" or "orientation" throughout the report. If this contradicts other image analysis, this orientation data takes precedence.` : ''}

  CRITICAL GROUNDING RULE: Every fact in the "KNOWN MLS / LISTING FACTS" block above is authoritative source-of-truth data from RapidAPI. You MUST not contradict any of these values anywhere in your response — including bedroom count, bathroom count, sqft, year built, garage capacity, description mentions, and price. Your response must be consistent with all of them.

  Additional context:
  1. property information ${PROPERTY_DETAILS}, 
  2. image analysis - ${VISUAL_ANALYSIS}, and 
  3. online research.
  ${SCHOOLS_CONTEXT ? `4. Schools Intelligence Data - ${SCHOOLS_CONTEXT}` : ''}

  ### STRATEGIC FORENSICS (NEW DIRECTIVE)
  While maintaining the high detail requested in the sections below, you must also act as a Senior Real Estate Strategist to "mine" the data for deep correlations:
  - Financial Velocity: Cross-reference recent Price History with Market Days-on-Market to signal seller motivation or leverage.
  - Modernization Potential: Compare the Year Built and visual finishes against neighborhood growth trends to identify "Value-Add" or equity-building potential.
  - Infrastructure Reality: Correlate Walk/Transit scores and sidewalk quality with Community Pulse (noise/safety) to determine if the high score lives up to the reality.
  - Wellness & Flow: Correlate local Air Quality, the homes orientation (facing direction), and internal spatial lighting for a wellness-centric narrative.
  - Asset Resilience: Cross-reference Climate Risk levels (Flood/Fire) with visual observations of the home's exterior (Roofing/Siding) to identify upcoming insurance or maintenance liabilities.

  Instructions:
  Persona: Act as a knowledgeable and unbiased real estate analyst.
  Narrative Style: Write in a flowing, descriptive paragraph style in a compelling tone, avoiding subjective praise, that engages a potential buyer. Avoid bullet points or lists in the main sections.
  Data Integration: Synthesize all provided data (property details, images, map analysis) with information you gather from your online searches. It is important to not miss important details.
  No Duplication: Ensure that each section contains unique and distinct content. Do not repeat the same information across different headings.
  Numerical Ranges: When showing ranges, use the format "3-5" or "$25-$35," not "35" or "$2535."
  Citations: Do not include citations like [1] or [3] in the final output.
  Avoid putting days count (like days on market) that would make a few days old generated report inaccurate.
  Interior Objectivity: When summarizing interiors, maintain a neutral, factual but compelling tone. Avoid all marketing fluff or subjective praise.
  
  To complete this task, you must use your internal search tools to find the necessary data. 
  Prioritize authoritative and recent sources.

  For example, use your search tools to gather additional data for :
  Future Development: Search for zoning, permits, or upcoming developments by using the property address and the city/county name.
  Market & Neighborhood: Research current market trends, neighborhood demographics, rental demand, and appreciation rates for the area.

  **CRITICAL: You MUST respond with a valid JSON object only. No markdown, no code fences, no additional text before or after the JSON.**
  Deduplicate information across JSON sections.

  Return your response as a JSON object with the following structure:
  {
    "summary": "150-200 word summary with key highlights. Use **bold** for critical decision factors such as: direction facing, quiet street, excellent school district, natural light, investment potential, visual appeal and condition, outdoor views, move-in ready, and any other key highlights.",
    "detailed_analysis": {
      "visual_appeal_condition": "Summarize the visual appeal and condition from provided information, like the provided property photo analysis, facts and description, including a paragraph commenting on finishes, natural lighting, cleanliness, and style (e.g., Mediterranean, Modern). Assess the apparent condition of the roof, windows, and major systems. Describe the physical atmosphere of the home. Use **bold** for key highlights like style, condition ratings, and standout features.",
      "outdoors_view_quality": "Using the provided properties data, photo and map analysis, write a short paragraph evaluating views (e.g., yard, hills, ocean) and the level of privacy. Assess the backyard, patio, or balcony for usability. Mention fencing, surface types, pollution and pollen levels and sun exposure (including solar readiness). Highlight any coastal erosion concerns or sea-level projections if relevant. Use **bold** for key highlights like view types, privacy level, and notable outdoor features.",
      "community_pulse": "Summarize the local sentiment using provided community pulse data. Specifically highlight 'what residents like' (e.g., quiet streets, friendly neighbors, local events) and 'common complaints' (e.g., traffic, parking, noise). Provide a narrative on the 'vibe' of living in this specific area. Use **bold** for key sentiment highlights.",
    },
    "risks_considerations": "Write a paragraph highlighting any concerns regarding: Location (Crime rate, noise, environmental hazards, lack of essential services, zoning or future development changes), Property Condition (Age and state of roof, foundation, plumbing/electrical, HVAC, outdated layout, accessibility issues, storage/parking limits, energy inefficiency), Financial (Overpricing compared to comps, high property taxes, HOA fees/restrictions, rental market volatility, low appreciation potential, high insurance costs), Infrastructure (limited transit, long distance to hubs, noise pollution), Legal/Compliance (Title disputes, unpermitted work, restrictive ordinances), Any other risk factors mentioned in the provided information. Use **bold** for critical risk factors and warning items.",
    "interior_summary": {
      "interior_summary": "Neutral, factual summary of the overall home interior (4-5 objective sentences), focusing on layout, spatial flow, and material consistency. CRITICAL: Avoid all sales-oriented language, marketing fluff, or subjective adjectives like 'stunning' or 'gorgeous'.",
      "rooms_summary": "Neutral, factual summary of the individual identifiable rooms and spaces (4-5 objective sentences), focusing on the character, features, and functionality. CRITICAL: Avoid subjective or salesy language.",
      "vibe": "Objective description of the aesthetic atmosphere and physical character using neutral terminology (e.g., 'minimalist and utilitarian', 'traditional with heavy ornamentation').",
      "objective_tags": ["Purely descriptive, objective tags such as 'hardwood-floors', 'recessed-lighting', 'vaulted-ceilings', 'stainless-appliances'."]
    },
    "property_fit_scores": {
      "entertain": "Evaluate (0-100): Based on open layout, yard size, chef's kitchen, and nearby dining/entertainment options.",
      "commute": "Evaluate (0-100): Based on transit access, proximity to major roads/highways, and commute scores.",
      "schools": "Evaluate (0-100): Based on nearby school ratings and district desirability.",
      "walkability": "Evaluate (0-100): Based on walk scores, sidewalk presence, and proximity to shops or parks.",
      "quiet": "Evaluate (0-100): Based on street type, community pulse, and distance from major highways or noise pollution.",
      "tech": "Evaluate (0-100): Based on mentions of smart home features, updated appliances, EV charging, or solar readiness."
    },
    "schools_summary": "3-5 sentence summary of the nearby schools landscape. Mention the school district, key assigned schools and their ratings, whether this is a desirable zone, and any standout positives or concerns. Use the provided Schools Intelligence Data if available. Use **bold** for school names and ratings."
  }
  \`;
};

export const comprehensiveAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    detailed_analysis: {
      type: Type.OBJECT,
      properties: {
        visual_appeal_condition: { type: Type.STRING },
        outdoors_view_quality: { type: Type.STRING },
        community_pulse: { type: Type.STRING }
      },
      required: [
        "visual_appeal_condition",
        "outdoors_view_quality",
        "community_pulse"
      ]
    },
    risks_considerations: { type: Type.STRING },
    interior_summary: {
      type: Type.OBJECT,
      properties: {
        interior_summary: { type: Type.STRING },
        rooms_summary: { type: Type.STRING },
        vibe: { type: Type.STRING },
        objective_tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      },
      required: ["interior_summary", "rooms_summary", "vibe", "objective_tags"]
    },
    property_fit_scores: {
      type: Type.OBJECT,
      properties: {
        entertain: { type: Type.INTEGER },
        commute: { type: Type.INTEGER },
        schools: { type: Type.INTEGER },
        walkability: { type: Type.INTEGER },
        quiet: { type: Type.INTEGER },
        tech: { type: Type.INTEGER }
      },
      required: ["entertain", "commute", "schools", "walkability", "quiet", "tech"]
    },
    schools_summary: { type: Type.STRING }
  },
  required: ["summary", "detailed_analysis", "risks_considerations", "interior_summary", "property_fit_scores", "schools_summary"]
};