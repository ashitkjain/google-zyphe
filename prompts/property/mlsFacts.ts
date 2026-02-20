import { PropertyData } from "../../types";

/**
 * Builds a "KNOWN MLS FACTS" block from RapidAPI / Zillow housing data.
 * Injected into prompts so Gemini never contradicts authoritative source-of-truth fields.
 */
export function buildMlsFactsBlock(property: PropertyData): string {
    const r = property.resoFacts;
    const lines: string[] = [];

    // Core listing facts
    if (property.address) lines.push(`• Address: ${property.address}`);
    if (property.homeType) lines.push(`• Property Type: ${property.homeType}`);
    if (property.homeStatus) lines.push(`• Listing Status: ${property.homeStatus}`);
    if (property.price) lines.push(`• List Price: $${property.price.toLocaleString()}`);
    if (property.bedrooms) lines.push(`• Bedrooms: ${property.bedrooms}`);
    if (property.bathrooms) lines.push(`• Bathrooms: ${property.bathrooms}`);
    if (property.livingAreaValue) lines.push(`• Living Area: ${property.livingAreaValue.toLocaleString()} sqft`);
    if (property.lotSize) lines.push(`• Lot Size: ${property.lotSize}`);
    if (property.yearBuilt) lines.push(`• Year Built: ${property.yearBuilt}`);

    // Garage & parking — frequently mis-guessed by vision models
    const garage = r?.garageParkingCapacity ?? null;
    if (garage !== null && garage !== undefined)
        lines.push(`• Garage/Parking Capacity: ${garage} car(s)`);

    // Structure & finishes
    if (r?.architecturalStyle) lines.push(`• Architectural Style: ${r.architecturalStyle}`);
    if (r?.constructionMaterials) lines.push(`• Construction Materials: ${r.constructionMaterials}`);
    if (r?.roofType) lines.push(`• Roof Type: ${r.roofType}`);
    if (r?.flooring) lines.push(`• Flooring: ${r.flooring}`);
    if (r?.basement) lines.push(`• Basement: ${r.basement}`);
    if (r?.foundationDetails) lines.push(`• Foundation: ${r.foundationDetails}`);

    // Systems
    if (r?.heating) lines.push(`• Heating: ${r.heating}`);
    if (r?.cooling) lines.push(`• Cooling: ${r.cooling}`);
    if (r?.utilities) lines.push(`• Utilities: ${r.utilities}`);
    if (r?.sewer) lines.push(`• Sewer: ${r.sewer}`);
    if (r?.waterSource) lines.push(`• Water Source: ${r.waterSource}`);

    // Exterior & lot
    if (r?.exteriorFeatures) lines.push(`• Exterior Features: ${r.exteriorFeatures}`);
    if (r?.fencing) lines.push(`• Fencing: ${r.fencing}`);
    if (r?.lotFeatures) lines.push(`• Lot Features: ${r.lotFeatures}`);

    // HOA / community
    if (property.resoFacts?.feesAndDues) lines.push(`• HOA / Fees & Dues: ${r?.feesAndDues}`);

    // Environmental / neighbourhood scores
    if (property.noiseScore != null)
        lines.push(`• Noise Score: ${property.noiseScore}/100 (HowLoud SoundScore — 50=loud, 100=quiet)${property.noiseScoreDesc ? `: ${property.noiseScoreDesc}` : ''}`);
    if (property.crimeScore != null || property.crimeGrade)
        lines.push(`• Crime Safety Score: ${property.crimeScore ?? 'N/A'}${property.crimeGrade ? ` (Grade: ${property.crimeGrade})` : ''}`);

    // Description (last — longest field)
    if (property.description)
        lines.push(`• MLS Description:\n  "${property.description.trim()}"`);

    if (lines.length === 0) return "";

    return `
============================
KNOWN MLS / LISTING FACTS (Source of Truth from RapidAPI housing data)
You MUST treat every fact below as ground truth. Do NOT contradict, restate incorrectly, or make assumptions that conflict with any of these values in your response.
============================
${lines.join("\n")}
============================
`;
}
