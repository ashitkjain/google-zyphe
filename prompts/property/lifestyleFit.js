function buildVisualContext(visual, streetView) {
    if (!visual && !streetView) return 'No visual analysis available.';
    const parts = [];

    const int = visual?.interior_synthesis || visual?.home_interior;
    const ext = visual?.exterior_synthesis || visual?.exterior_and_neighborhood;

    let roomHighlights = [];
    if (visual?.photos && Array.isArray(visual.photos)) {
        roomHighlights = visual.photos
            .filter(p => p.analysis && !p.mirror_of && !['Front Yard', 'Backyard', 'Aerial View', 'Floor Plan', 'Other'].includes(p.group_label))
            .map(p => ({
                room_name: p.room_label || p.group_label || 'Interior Room',
                floor: 'Main Floor',
                description: p.analysis
            }));
    } else if (visual?.room_highlights) {
        roomHighlights = visual.room_highlights;
    }

    if (int) {
        parts.push(`INTERIOR ANALYSIS:
- Overall: ${int.overall_description || 'N/A'}
- Design style: ${int.design_style?.style || 'N/A'} — ${int.design_style?.reasoning || ''}
- Color & materials: ${int.color_and_materials || 'N/A'}
- Lighting: ${int.lighting || 'N/A'}
- Spatial flow: ${int.spatial_flow || 'N/A'}
- Condition & finish: ${int.condition_and_finish || 'N/A'}`);
    }

    if (roomHighlights?.length) {
        const rooms = roomHighlights.slice(0, 10).map(r =>
            `  • ${r.room_name} (${r.floor || 'Main Floor'}): ${r.description}${r.potential_improvements ? ` | Improvements: ${r.potential_improvements}` : ''}`
        ).join('\n');
        parts.push(`ROOMS BREAKDOWN:\n${rooms}`);
    }

    if (ext) {
        const appeal = ext.exterior_and_lot_appeal || ext;
        const views = ext.views_privacy_orientation || ext;
        parts.push(`EXTERIOR ANALYSIS:
- Architecture: ${appeal.architecture_style || 'N/A'}
- Curb appeal: ${appeal.curb_appeal || 'N/A'}
- Backyard/patio: ${appeal.backyard_and_patio || 'N/A'}
- Views: ${views.views || 'N/A'}
- Privacy: ${views.privacy || 'N/A'}`);
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
        if (rf.parkingFeatures)       features.push(`Parking: ${rf.parkingFeatures}`);
        if (rf.basement)              features.push(`Basement: ${rf.basement}`);
        if (rf.flooring)              features.push(`Flooring: ${rf.flooring}`);
        if (rf.heating)               features.push(`Heating: ${rf.heating}`);
        if (rf.cooling)               features.push(`Cooling: ${rf.cooling}`);
        if (rf.laundryFeatures)       features.push(`Laundry: ${rf.laundryFeatures}`);
        if (rf.fireplaceFeatures)     features.push(`Fireplace: ${rf.fireplaceFeatures}`);
        if (rf.fencing)               features.push(`Fencing: ${rf.fencing}`);
        if (rf.securityFeatures)      features.push(`Security: ${rf.securityFeatures}`);
        if (rf.lotFeatures)           features.push(`Lot features: ${rf.lotFeatures}`);
        if (rf.appliances)            features.push(`Appliances: ${rf.appliances}`);
        if (rf.architecturalStyle)    features.push(`Architectural style: ${rf.architecturalStyle}`);
        if (rf.stories)               features.push(`Total stories: ${rf.stories}`);
        if (rf.interiorFeatures)      features.push(`Interior features: ${rf.interiorFeatures}`);
        if (rf.exteriorFeatures)      features.push(`Exterior features: ${rf.exteriorFeatures}`);
        if (rf.windowFeatures)        features.push(`Windows: ${rf.windowFeatures}`);
        if (rf.propertyCondition)     features.push(`Property condition: ${rf.propertyCondition}`);
        if (rf.utilities)             features.push(`Utilities: ${rf.utilities}`);
        if (rf.electric)              features.push(`Electric: ${rf.electric}`);
        if (features.length) parts.push(`HOME FEATURES:\n${features.map(f => `- ${f}`).join('\n')}`);

        // Room inventory
        const roomTypes = rf.roomTypes || rf.rooms;
        if (roomTypes) {
            parts.push(`ROOM INVENTORY: ${Array.isArray(roomTypes) ? roomTypes.join(', ') : roomTypes}`);
        }
    }

    if (property.hoa) {
        parts.push(`HOA: ${property.hoa.name || 'Yes'}${property.hoa.fee ? ` — ${property.hoa.fee}` : ''}`);
    }

    const scores = [];
    if (property.walkScore != null)    scores.push(`Walk Score: ${property.walkScore}`);
    if (property.bikeScore != null)    scores.push(`Bike Score: ${property.bikeScore}`);
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

function buildEnvironmentalContext(env) {
    if (!env) return '';
    const parts = [];

    // Noise
    const noiseLines = [];
    if (env.noiseScore != null)         noiseLines.push(`Overall score: ${env.noiseScore}/100 — ${env.noiseScoreDesc || ''}`);
    if (env.noiseLocalScore != null)    noiseLines.push(`Local ambient: ${env.noiseLocalScore}/100 — ${env.noiseLocalDesc || ''}`);
    if (env.noiseTrafficScore != null)  noiseLines.push(`Traffic noise: ${env.noiseTrafficScore}/100 — ${env.noiseTrafficDesc || ''}`);
    if (env.noiseAirportScore != null)  noiseLines.push(`Airport noise: ${env.noiseAirportScore}/100 — ${env.noiseAirportDesc || ''}`);
    if (noiseLines.length) parts.push(`NOISE ENVIRONMENT:\n${noiseLines.map(l => `- ${l}`).join('\n')}`);

    // Air quality
    if (env.airQuality) {
        const aq = env.airQuality;
        const lines = [`AQI: ${aq.aqi} — ${aq.category}`];
        if (aq.recommendations?.general)        lines.push(`General: ${aq.recommendations.general}`);
        if (aq.recommendations?.sensitiveGroups) lines.push(`Sensitive groups: ${aq.recommendations.sensitiveGroups}`);
        parts.push(`AIR QUALITY:\n${lines.map(l => `- ${l}`).join('\n')}`);
    }

    // Pollen
    if (env.pollen) {
        const p = env.pollen;
        const lines = [`Current level: ${p.category} (score ${p.score}/5) — dominant: ${p.dominantPollenType}`];
        if (p.analysis?.breathe_easy_summary) lines.push(p.analysis.breathe_easy_summary);
        if (p.analysis?.seasonality_window)   lines.push(`Season: ${p.analysis.seasonality_window}`);
        parts.push(`POLLEN:\n${lines.map(l => `- ${l}`).join('\n')}`);
    }

    // Broadband
    if (env.broadband) {
        const bb = env.broadband;
        const lines = [];
        if (bb.topDownloadMbps)  lines.push(`Best available: ${bb.topDownloadMbps} Mbps down`);
        if (bb.hasFiber != null) lines.push(`Fiber available: ${bb.hasFiber ? 'Yes' : 'No'}`);
        if (bb.has5G != null)    lines.push(`5G coverage: ${bb.has5G ? 'Yes' : 'No'}`);
        if (bb.internetProviders?.length) {
            const top = bb.internetProviders.slice(0, 3).map(p => `${p.name} (${p.technology}, ${p.maxDownloadMbps}↓/${p.maxUploadMbps}↑ Mbps)`).join(', ');
            lines.push(`Top providers: ${top}`);
        }
        if (lines.length) parts.push(`BROADBAND:\n${lines.map(l => `- ${l}`).join('\n')}`);
    }

    // EV chargers
    if (env.evChargers) {
        const ev = env.evChargers;
        const lines = [];
        if (ev.closestDistanceMi != null) lines.push(`Nearest charger: ${ev.closestDistanceMi} mi — ${ev.closestStationName || ''}`);
        if (ev.totalStations != null)     lines.push(`Stations within area: ${ev.totalStations} (${ev.totalPorts || 0} total ports, ${ev.dcFastPorts || 0} DC fast)`);
        if (lines.length) parts.push(`EV CHARGING:\n${lines.map(l => `- ${l}`).join('\n')}`);
    }

    // Seismic / flood / disasters
    if (env.historical_disasters) {
        const hd = env.historical_disasters;
        const lines = [];
        if (hd.seismicZone?.riskLevel)  lines.push(`Seismic risk: ${hd.seismicZone.riskLevel} (design category ${hd.seismicZone.designCategory})`);
        if (hd.floodZone)               lines.push(`Flood zone: ${hd.floodZone}`);
        if (hd.femaDeclarations?.length) lines.push(`FEMA declarations nearby: ${hd.femaDeclarations.length}`);
        if (hd.earthquakes?.length) {
            const recent = hd.earthquakes[0];
            lines.push(`Recent earthquake: ${recent.title} — ${recent.distanceMi} mi away (${recent.date})`);
        }
        if (lines.length) parts.push(`HAZARDS:\n${lines.map(l => `- ${l}`).join('\n')}`);
    }

    // Drought
    if (env.drought) {
        const d = env.drought;
        if (d.severity) {
            parts.push(`DROUGHT: ${d.severity} (level ${d.severityLevel}/4) — ${d.countyName || ''}`);
        }
    }

    return parts.join('\n\n');
}

export const getLifestyleFitPrompt = (property, visual, streetView, envData = null, comprehensive = null) => `
You are an expert residential property analyst who specializes in matching homes to buyer lifestyles. You have been given MLS listing data, AI visual analysis, street view analysis, environmental data, and pre-synthesized property intelligence.
${comprehensive ? `\nADDITIONAL CONTEXT (Comprehensive Analysis Summary):\n${comprehensive}\n` : ''}

Your task: evaluate how well this SPECIFIC PROPERTY fits each of the three lifestyle categories below. Consider BOTH the property itself (layout, features, condition, rooms) AND its location/neighborhood context. Be honest — call out both strengths and deal-breakers.

═══════════════════════════════════════════════════════════════════
${buildMLSContext(property)}

═══════════════════════════════════════════════════════════════════
${buildVisualContext(visual, streetView)}

═══════════════════════════════════════════════════════════════════
${envData ? buildEnvironmentalContext(envData) + '\n\n═══════════════════════════════════════════════════════════════════' : ''}

For EACH of the 3 lifestyle categories, produce a structured assessment:

## 1. WORKING PROFESSIONALS (singles, couples, DINK households)
Consider: home office space, commute (freeway/transit access), modern kitchen for quick meals, low-maintenance yard, garage for a nice car, proximity to gyms/coffee shops/restaurants, smart home features, open floor plan for entertaining, broadband speed for WFH, natural light in work areas, noise levels for video calls, EV charging access, guest room for visitors.

## 2. FAMILIES WITH KIDS (young families, growing families, multi-generational)
Consider: bedroom count and layout, backyard safety and play space, proximity to highly-rated schools, family-friendly neighborhood (cul-de-sac, low traffic), storage space, mudroom/entryway, kitchen size for family cooking, bathroom count, parks/playgrounds nearby, pool (safety AND fun), fencing, floor durability, pollen/air quality for kids, school bus access, room for future growth.

## 3. SENIORS (retirees, aging-in-place, downsizers)
Consider: single-story or elevator access, step-free entry, wide doorways/hallways, grab bar potential in bathrooms, walk-in shower vs tub-only, low-maintenance exterior, flat terrain, proximity to medical facilities & pharmacies, quiet neighborhood, air quality and pollen sensitivity, walkable errands, manageable lot size, HOA covering exterior maintenance, seismic/hazard risk, natural light for wellbeing, slip-resistant flooring.

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
