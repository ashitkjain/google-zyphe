import { Type } from "@google/genai";
import { PropertyData } from "../../types";

export const LIFESTYLE_TOPICS = [
    { key: 'outdoor', icon: 'fa-mountain-sun', label: 'Outdoor & Recreation', color: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-600' },
    { key: 'family', icon: 'fa-children', label: 'Family & Kids', color: 'blue', bg: 'bg-blue-100', text: 'text-blue-600' },
    { key: 'senior', icon: 'fa-heart-pulse', label: 'Senior Living', color: 'rose', bg: 'bg-rose-100', text: 'text-rose-600' },
    { key: 'pets', icon: 'fa-paw', label: 'Pet Friendly', color: 'amber', bg: 'bg-amber-100', text: 'text-amber-600' },
    { key: 'food', icon: 'fa-utensils', label: 'Food & Entertainment', color: 'violet', bg: 'bg-violet-100', text: 'text-violet-600' },
    { key: 'professionals', icon: 'fa-briefcase', label: 'Working Professionals', color: 'sky', bg: 'bg-sky-100', text: 'text-sky-600' },
] as const;

export const getLifestyleInsightsPrompt = (property: PropertyData) => `
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

Return a JSON object with exactly these 6 keys. Each value should be a 4-5 sentence string that reads naturally as a paragraph. Be specific, name real places, include approximate distances. Do NOT use bullet points — write flowing prose. Wrap all specific place names (parks, trails, restaurants, schools, hospitals, stores, venues, etc.) in **double asterisks** for bold emphasis — e.g. **Shadow Cliffs Regional Recreation Area**.

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

export const lifestyleInsightsSchema = {
    type: Type.OBJECT,
    properties: {
        outdoor: { type: Type.STRING, description: "4-5 sentence insight about outdoor recreation near this property." },
        family: { type: Type.STRING, description: "4-5 sentence insight about family & kids amenities." },
        senior: { type: Type.STRING, description: "4-5 sentence insight about senior living suitability." },
        pets: { type: Type.STRING, description: "4-5 sentence insight about pet friendliness." },
        food: { type: Type.STRING, description: "4-5 sentence insight about food & entertainment." },
        professionals: { type: Type.STRING, description: "4-5 sentence insight about convenience for busy working professionals." },
    },
    required: ["outdoor", "family", "senior", "pets", "food", "professionals"]
};
