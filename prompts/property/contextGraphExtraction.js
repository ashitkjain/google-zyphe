/**
 * Context Graph Factor Extraction Prompt (JS backend version)
 * Note: property is already optimized by intelBatch._optimizeProperty before being passed here.
 */

export const buildGraphExtractionContext = (property, visual, comprehensive) => {
    // Strip noisy fields from visual
    let optimizedVisual = null;
    if (visual && typeof visual === 'object') {
        const { image_by_image_analysis, image_quality_analysis, ...kept } = visual;
        optimizedVisual = kept;
    }

    const narrative = comprehensive ? {
        summary: comprehensive.summary,
        detailedAnalysis: comprehensive.detailed_analysis,
        strategicInsights: comprehensive.strategic_insights,
        risksAndConsiderations: comprehensive.risks_considerations,
    } : null;

    const parcelValidation = property.parcelValidation ? {
        slopePercent: property.parcelValidation.slopePercent,
        slopeCategory: property.parcelValidation.slopeCategory,
        uphillDir: property.parcelValidation.uphillDir,
        flags: (property.parcelValidation.flags ?? []).map(f => ({
            check: f.check, severity: f.severity, finding: f.finding,
        })),
    } : null;

    const parcelData = property.parcelAreaSqft ? {
        arcgisAreaSqft: property.parcelAreaSqft,
        parcelApn: property.parcelApn,
        parcelCounty: property.parcelCounty,
    } : null;

    const orientationAI = property.orientation_ai ? {
        final_orientation: property.orientation_ai.final_orientation,
        azimuth_degrees: property.orientation_ai.azimuth_degrees,
        feng_shui_vastu: property.orientation_ai.feng_shui_vastu,
        buyer_pro: property.orientation_ai.buyer_pro,
        buyer_con: property.orientation_ai.buyer_con,
    } : null;

    return {
        listingDescription: property.description,
        property,
        schools: property.schools?.map(s => ({ name: s.name, rating: s.rating, distance: s.distance, level: s.level })),
        visualAnalysis: optimizedVisual,
        narrativeReport: narrative,
        parcelValidation,
        parcelData,
        orientationAI,
        taxSqft: property.taxSqft ?? null,
    };
};

export const getContextGraphExtractionPrompt = (context, skipIds = []) => {
    const skipNote = skipIds.length > 0
        ? `\nNOTE: Factors ${skipIds.join(', ')} have already been computed from structured data. SKIP these IDs entirely — do NOT include them in your response. Only return factors NOT in this list.\n`
        : '';

    return `
You are a real estate data analyst. These factors will be used for SEMANTIC BUYER MATCHING — a buyer
describes what they want in natural language, and an LLM matches their story against these tags
to score and rank properties. Tags must read as natural, self-contained property attributes.
${skipNote}
Given the property data below, extract structured decision factors. For each factor, return:
- The factor ID (no name needed)
- Value: A concise, 1-2 sentence human-readable summary of the factor's state for this specific property
- Tags: 2-6 labels, each exactly 2-5 words. Every tag must be:
  (a) SELF-CONTAINED — meaningful without reading other tags or the factor name
  (b) SPECIFIC — include qualifiers, locations, materials, measurements
  (c) SEARCH-READY — phrased as a natural property attribute a buyer would describe
  (d) NON-REDUNDANT — no two tags in the same factor should overlap in meaning

GOOD tags: ["Ground floor home office", "Dedicated WFH den", "Fiber internet available"]
BAD tags: ["Office", "Work from home"] ← 1 word; redundant pair

Return valid JSON with this structure:
{
  "factors": [
    { "id": 1, "value": "...", "tags": ["tag1", "tag2"] },
    ...
  ]
}

Property data:
${JSON.stringify(context, null, 2)}

CRITICAL: Respond ONLY with the raw JSON object. No markdown, no code fences, no extra text.
`;
};
