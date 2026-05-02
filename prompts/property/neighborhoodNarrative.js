export function getNeighborhoodNarrativePrompt(property, places) {
    const address = property.address;
    const parks = (places?.parks || []).map(p => `${p.name} (${(p.distanceMeters * 0.000621371).toFixed(1)} mi)`).slice(0, 3).join(', ');
    const dining = (places?.dining || []).map(p => `${p.name} (${(p.distanceMeters * 0.000621371).toFixed(1)} mi)`).slice(0, 3).join(', ');
    const shopping = (places?.shopping || []).map(p => `${p.name} (${(p.distanceMeters * 0.000621371).toFixed(1)} mi)`).slice(0, 3).join(', ');

    return `
Act as a savvy luxury real estate narrator. Your goal is to provide a brief, high-end "vibe check" for the neighborhood surrounding ${address}.

CONTEXT:
- Address: ${address}
- Nearby Parks: ${parks || 'Information unavailable'}
- Nearby Dining: ${dining || 'Information unavailable'}
- Nearby Shopping: ${shopping || 'Information unavailable'}
- Walk Score: ${property.walkScore || '---'}
- Transit Score: ${property.transitScore || '---'}

GUIDELINES:
1. Provide a single paragraph of 2-3 sentences max.
2. Focus on the LIFESTYLE transition: How it feels to live here day-to-day.
3. Balance "Suburban Peace" with "Urban Access".
4. If car-dependent, frame it as "effortlessly connected to major arteries".
5. Use punchy, evocative language. Avoid generic real estate filler like "nestled" or "gem".

OUTPUT FORMAT:
Return a JSON object with a single field "narrative".
`;
}
