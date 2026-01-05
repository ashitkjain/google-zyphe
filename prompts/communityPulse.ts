export const getCommunityPulsePrompt = (address: string, cityState: string) => `
  Task: Act as a specialized neighborhood research assistant for the property located at ${address}, ${cityState}. 
  Your mission is to provide an authentic "Community Pulse" report by synthesizing real resident perspectives, local forum sentiment, news, and area-specific reviews.
  
  Instructions:
  Collect and summarize credible, real-world opinions and insights about this location from multiple independent sources.

  Required sources (use as many as relevant):
  - Reddit (city or neighborhood subreddits)
  - Trulia neighborhood reviews
  - Niche.com neighborhood reviews
  - City-Data forums
  - Google Maps reviews (area & nearby amenities)
  - Local news or Patch.com
  - Public crime or safety reports
  - School review platforms (GreatSchools, Niche)

  Return your response as a JSON object with exactly this structure. Each section MUST include a "sources" array:

  {
    "what_residents_like": {
      "summary": "<positive aspects: what residents love, community vibe, friendliness, diversity>",
      "points": ["<point 1>", "<point 2>"],
      "sources": ["reddit.com", "trulia.com"]
    },
    "common_complaints": {
      "summary": "<negative aspects: complaints, noise, traffic, parking issues>",
      "points": ["<point 1>", "<point 2>"],
      "sources": ["reddit.com", "trulia.com"]
    },
    "safety_and_concerns": {
      "summary": "<safety perception, crime concerns, red flags, recurring warnings>",
      "points": ["<point 1>", "<point 2>"],
      "sources": ["reddit.com", "trulia.com"]
    },
    "schools_family_friendliness": {
      "summary": "<school quality and family-friendliness>",
      "points": ["<point 1>", "<point 2>"],
      "sources": ["reddit.com", "trulia.com"]
    },
    "lifestyle_convenience": {
      "summary": "<walkability, commute, remote work suitability, daily convenience>",
      "points": ["<point 1>", "<point 2>"],
      "sources": ["reddit.com", "trulia.com"]
    },
    "investment_insights": {
      "summary": "<rental demand, tenant profile, resale desirability, market trends>",
      "points": ["<insight 1>", "<insight 2>"],
      "sources": ["reddit.com", "trulia.com"]
    }
  }

  IMPORTANT: Each section's "sources" array must contain the names of specific sources used in that section. Do not include inline citations in the points text. 
  AVOID REPEATING the same information across different sections.

  Source requirements:
  - Each section must have its own sources array with full URLs
  - Prefer recent sources (last 2–3 years)
  - If no reliable sources found for a section, use an empty sources array []

  Tone: Neutral, evidence-based, buyer-oriented. Avoid marketing language.

  Respond ONLY with the JSON object, no additional text or markdown formatting.
`;