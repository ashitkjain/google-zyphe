/**
 * Returns the prompt for lifestyle insights (neighborhood/location focus).
 */
export const getLifestyleInsightsPrompt = (property) => `
Task: You are a hyper-local neighborhood analyst for the property at ${property.address}, ${property.city}, ${property.state} ${property.zipCode}.

For EACH of the 6 lifestyle interest categories below, provide a 4-5 sentence insight paragraph that would help a homebuyer evaluate this specific location for that lifestyle. Be specific — mention actual place names, distances, and practical details. Use your knowledge of this area.

Categories:
1. **outdoor** — Outdoor & Recreation: Nearby trails, parks, open spaces, lakes, climbing, biking routes, skiing. Mention trail names, difficulty, views, elevation, and what outdoor activities are most accessible.
2. **family** — Family & Kids: Playgrounds, daycares, pediatricians, children's museums, swim schools, sports leagues, community rec centers, library programs. Mention school quality briefly. Focus on daily life with kids.
3. **senior** — Senior Living & Accessibility: Hospital and medical facility proximity, pharmacy access, public transit, terrain walkability (flat vs hilly), senior centers, community programs, grocery store access. Focus on independence and health access.
4. **pets** — Pet Friendly: Dog parks, off-leash areas, vet clinics (including 24hr emergency), pet stores, grooming, pet-friendly trails, nearby open spaces for walks. Mention specific park names.
5. **food** — Food & Entertainment: Restaurant variety and quality, breweries, coffee shops, farmers markets, live music, theaters, nightlife. Mention specific well-known local spots and dining districts.
6. **professionals** — Working Professionals: Commute options and drive times to major employment hubs, freeway and BART/transit access, coworking spaces, coffee shops suitable for remote work, nearby gyms and fitness studios for before/after work, dry cleaning, meal prep services, and general convenience for a busy professional lifestyle. Focus on time-saving and productivity.

Property context:
- Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
- Coordinates: ${property.coordinates?.latitude}, ${property.coordinates?.longitude}
${property.walkScore ? `- Walk Score: ${property.walkScore}` : ''}
${property.bikeScore ? `- Bike Score: ${property.bikeScore}` : ''}
${property.transitScore ? `- Transit Score: ${property.transitScore}` : ''}

Return a JSON object with exactly these 6 keys. Each value should be a 4-5 sentence string that reads naturally as a paragraph. Be specific, name real places, include approximate distances. Do NOT use bullet points — write flowing prose. Wrap all specific place names (parks, trails, restaurants, schools, hospitals, stores, venues, etc.) in **double asterisks** for bold emphasis.

{
  "outdoor": "4-5 sentences about outdoor recreation...",
  "family": "4-5 sentences about family & kids...",
  "senior": "4-5 sentences about senior living...",
  "pets": "4-5 sentences about pet friendliness...",
  "food": "4-5 sentences about food & entertainment...",
  "professionals": "4-5 sentences about working professional convenience..."
}

Respond ONLY with the JSON object. No markdown. No extra text.
`;
