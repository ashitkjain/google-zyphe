function buildVisualContext(visual, streetView) {
    if (!visual && !streetView) return 'No visual analysis available.';
    const parts = [];

    if (visual?.home_interior) {
        const int = visual.home_interior;
        parts.push(`INTERIOR ANALYSIS:
- Overall: ${int.overall_description || 'N/A'}
- Design style: ${int.design_style?.style || 'N/A'} — ${int.design_style?.reasoning || ''}
- Color & materials: ${int.color_and_materials || 'N/A'}
- Lighting: ${int.lighting || 'N/A'}
- Spatial flow: ${int.spatial_flow || 'N/A'}
- Condition & finish: ${int.condition_and_finish || 'N/A'}`);
    }

    if (visual?.room_highlights?.length) {
        const rooms = visual.room_highlights.slice(0, 8).map(r =>
            `  • ${r.room_name} (${r.floor}): ${r.description}${r.potential_improvements ? ` | Improvements: ${r.potential_improvements}` : ''}`
        ).join('\n');
        parts.push(`ROOMS BREAKDOWN:\n${rooms}`);
    }

    if (visual?.exterior_and_neighborhood) {
        const ext = visual.exterior_and_neighborhood;
        parts.push(`EXTERIOR ANALYSIS:
- Architecture: ${ext.exterior_and_lot_appeal?.architecture_style || 'N/A'}
- Curb appeal: ${ext.exterior_and_lot_appeal?.curb_appeal || 'N/A'}
- Backyard/patio: ${ext.exterior_and_lot_appeal?.backyard_and_patio || 'N/A'}
- Views: ${ext.views_privacy_orientation?.views || 'N/A'}
- Privacy: ${ext.views_privacy_orientation?.privacy || 'N/A'}`);
    }

    if (streetView) {
        parts.push(`STREET VIEW ANALYSIS:
- Curb appeal score: ${streetView.curbAppealScore}/10
- Neighborhood vibe: ${streetView.neighborhoodVibe || 'N/A'}
- Family safety: ${streetView.familySafety || 'N/A'}
- Privacy: ${streetView.privacyRating || 'N/A'}
- Parking: ${streetView.parkingLogistics || 'N/A'}
- Garden: ${streetView.gardenDescription || 'N/A'}
- Neighbor condition: ${streetView.neighborCondition || 'N/A'}
- Maintenance risks: ${(streetView.maintenanceRisks || []).join(', ') || 'None noted'}`);
    }

    return parts.join('\n\n');
}

function buildMLSContext(property) {
    const parts = [];

    parts.push(`PROPERTY BASICS:
- Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
- Type: ${property.homeType || 'N/A'}
- Bedrooms: ${property.bedrooms ?? 'N/A'} | Bathrooms: ${property.bathrooms ?? 'N/A'}
- Living area: ${property.livingAreaValue ? `${property.livingAreaValue.toLocaleString()} sqft` : 'N/A'}
- Lot size: ${property.lotSize || 'N/A'}
- Year built: ${property.yearBuilt || 'N/A'}
- Stories: ${property.resoFacts?.stories ?? property.stories ?? 'N/A'}
- Price: ${property.price ? `$${property.price.toLocaleString()}` : 'N/A'}`);

    const rf = property.resoFacts;
    if (rf) {
        const features = [];
        if (rf.garageParkingCapacity) features.push(`Garage capacity: ${rf.garageParkingCapacity}`);
        if (rf.basement) features.push(`Basement: ${rf.basement}`);
        if (rf.flooring) features.push(`Flooring: ${rf.flooring}`);
        if (rf.heating) features.push(`Heating: ${rf.heating}`);
        if (rf.cooling) features.push(`Cooling: ${rf.cooling}`);
        if (rf.laundryFeatures) features.push(`Laundry: ${rf.laundryFeatures}`);
        if (rf.fireplaceFeatures) features.push(`Fireplace: ${rf.fireplaceFeatures}`);
        if (rf.fencing) features.push(`Fencing: ${rf.fencing}`);
        if (rf.securityFeatures) features.push(`Security: ${rf.securityFeatures}`);
        if (rf.lotFeatures) features.push(`Lot features: ${rf.lotFeatures}`);
        if (rf.appliances) features.push(`Appliances: ${rf.appliances}`);
        if (rf.architecturalStyle) features.push(`Architectural style: ${rf.architecturalStyle}`);
        if (rf.stories) features.push(`Total stories: ${rf.stories}`);
        if (features.length) parts.push(`HOME FEATURES:\n${features.map(f => `- ${f}`).join('\n')}`);
    }

    if (property.hoa) {
        parts.push(`HOA: ${property.hoa.name || 'Yes'}${property.hoa.fee ? ` — ${property.hoa.fee}` : ''}`);
    }

    const scores = [];
    if (property.walkScore != null) scores.push(`Walk Score: ${property.walkScore}`);
    if (property.bikeScore != null) scores.push(`Bike Score: ${property.bikeScore}`);
    if (property.transitScore != null) scores.push(`Transit Score: ${property.transitScore}`);
    if (scores.length) parts.push(`WALKABILITY: ${scores.join(' | ')}`);

    if (property.schools?.length) {
        const schoolList = property.schools.slice(0, 5).map(s =>
            `  • ${s.name} (${s.level}) — Rating: ${s.rating}/10, Distance: ${s.distance}`
        ).join('\n');
        parts.push(`NEARBY SCHOOLS:\n${schoolList}`);
    }

    return parts.join('\n\n');
}

export const getLifestyleFitPrompt = (property, visual, streetView, comprehensive = null) => `
You are an expert residential property analyst who specializes in matching homes to buyer lifestyles. You have been given detailed MLS listing data, AI analysis of the property's interior/exterior photos, and street view analysis.
${comprehensive ? `\nADDITIONAL CONTEXT (Comprehensive Analysis Summary):\n${comprehensive}\n` : ''}

Your task: evaluate how well this SPECIFIC PROPERTY fits each of the three lifestyle categories below. Consider BOTH the property itself (layout, features, condition, rooms) AND its location/neighborhood. Be honest — call out both strengths and deal-breakers.

═══════════════════════════════════════════════════════════════════
${buildMLSContext(property)}

═══════════════════════════════════════════════════════════════════
${buildVisualContext(visual, streetView)}
═══════════════════════════════════════════════════════════════════

For EACH of the 3 lifestyle categories, produce a structured assessment:

## 1. WORKING PROFESSIONALS (singles, couples, DINK households)
Consider: home office space, commute (freeway/transit access), modern kitchen for quick meals, low-maintenance yard, garage for a nice car, proximity to gyms/coffee shops/restaurants, smart home features, open floor plan for entertaining, Wi-Fi-friendly layout, natural light in work areas, noise levels for video calls, guest room for visitors.

## 2. FAMILIES WITH KIDS (young families, growing families, multi-generational)
Consider: bedroom count and layout, backyard safety and play space, proximity to highly-rated schools, family-friendly neighborhood (cul-de-sac, low traffic), storage space, mudroom/entryway, kitchen size for family cooking, bathroom count, parks/playgrounds nearby, pool (safety AND fun), fencing, floor durability, childproofing difficulty, school bus access, room for future growth.

## 3. SENIORS (retirees, aging-in-place, downsizers)
Consider: single-story or elevator access, step-free entry, wide doorways/hallways, grab bar potential in bathrooms, walk-in shower vs tub-only, low-maintenance exterior, flat terrain, proximity to medical facilities & pharmacies, quiet neighborhood, walkable errands, manageable lot size, HOA covering exterior maintenance, natural light for wellbeing, slip-resistant flooring.

For each category, provide:
- **verdict**: One of "Excellent Fit", "Good Fit", "Moderate Fit", "Poor Fit", "Not Recommended"
- **summary**: 3-4 sentence overview of how the property fits this lifestyle
- **strengths**: Array of 3-5 specific strengths (reference actual property features from the data)
- **concerns**: Array of 2-4 specific concerns or deal-breakers
- **tip**: One practical tip or modification that could improve the fit

Respond ONLY with valid JSON matching this structure:
{
  "working_professionals": { "verdict": "...", "summary": "...", "strengths": [], "concerns": [], "tip": "..." },
  "families_with_kids": { "verdict": "...", "summary": "...", "strengths": [], "concerns": [], "tip": "..." },
  "seniors": { "verdict": "...", "summary": "...", "strengths": [], "concerns": [], "tip": "..." }
}

Do NOT wrap in markdown. Respond ONLY with the JSON object.
`;
