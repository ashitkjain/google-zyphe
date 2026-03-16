import { Type } from "@google/genai";
import { PropertyData } from "../../types";
import { CustomAIAnalysisResult, StreetViewAnalysisResult } from "../../types/ai";

/**
 * Deep lifestyle fit analysis prompt.
 *
 * Unlike the existing lifestyleInsights prompt (which focuses on neighborhood/location),
 * this prompt evaluates how the PROPERTY ITSELF fits three distinct buyer lifestyles
 * using MLS data, visual AI analysis of photos, and street view analysis.
 */

export const LIFESTYLE_FIT_CATEGORIES = [
    { key: 'working_professionals', icon: 'fa-briefcase', label: 'Working Professionals', color: 'sky', bg: 'bg-sky-100', text: 'text-sky-600' },
    { key: 'families_with_kids', icon: 'fa-children', label: 'Families with Kids', color: 'blue', bg: 'bg-blue-100', text: 'text-blue-600' },
    { key: 'seniors', icon: 'fa-heart-pulse', label: 'Seniors', color: 'rose', bg: 'bg-rose-100', text: 'text-rose-600' },
] as const;

// ── Helper: extract concise visual summary for prompt context ────────────────

function buildVisualContext(visual: CustomAIAnalysisResult | null, streetView: StreetViewAnalysisResult | null): string {
    if (!visual && !streetView) return 'No visual analysis available.';
    const parts: string[] = [];

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

function buildMLSContext(property: PropertyData): string {
    const parts: string[] = [];

    parts.push(`PROPERTY BASICS:
- Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}
- Type: ${property.homeType || 'N/A'}
- Bedrooms: ${property.bedrooms ?? 'N/A'} | Bathrooms: ${property.bathrooms ?? 'N/A'}
- Living area: ${property.livingAreaValue ? `${property.livingAreaValue.toLocaleString()} sqft` : 'N/A'}
- Lot size: ${property.lotSize || 'N/A'}
- Year built: ${property.yearBuilt || 'N/A'}
- Price: ${property.price ? `$${property.price.toLocaleString()}` : 'N/A'}`);

    const rf = property.resoFacts;
    if (rf) {
        const features: string[] = [];
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
        if (features.length) parts.push(`HOME FEATURES:\n${features.map(f => `- ${f}`).join('\n')}`);
    }

    if (property.hoa) {
        parts.push(`HOA: ${property.hoa.name || 'Yes'}${property.hoa.fee ? ` — ${property.hoa.fee}` : ''}`);
    }

    const scores: string[] = [];
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

// ── Main prompt ───────────────────────────────────────────────────────────────

export const getLifestyleFitPrompt = (
    property: PropertyData,
    visual: CustomAIAnalysisResult | null,
    streetView: StreetViewAnalysisResult | null
) => `
You are an expert residential property analyst who specializes in matching homes to buyer lifestyles. You have been given detailed MLS listing data, AI analysis of the property's interior/exterior photos, and street view analysis.

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
Consider: bedroom count and layout, backyard safety and play space, proximity to highly-rated schools, family-friendly neighborhood (cul-de-sac, low traffic), storage space, mudroom/entryway, kitchen size for family cooking, bathroom count, parks/playgrounds nearby, pool (safety AND fun), fencing, floor durability (vs. delicate flooring), childproofing difficulty, school bus access, room for future growth.

## 3. SENIORS (retirees, aging-in-place, downsizers)
Consider: single-story or elevator access, step-free entry, wide doorways/hallways, grab bar potential in bathrooms, walk-in shower vs. tub-only, low-maintenance exterior, flat terrain, proximity to medical facilities & pharmacies, quiet neighborhood, walkable errands (grocery, post office), manageable lot size, HOA covering exterior maintenance, natural light for wellbeing, slip-resistant flooring, emergency services response time.

For each category, provide:
- **verdict**: One of "Excellent Fit", "Good Fit", "Moderate Fit", "Poor Fit", "Not Recommended"
- **summary**: 3-4 sentence overview of how the property fits this lifestyle
- **strengths**: Array of 3-5 specific strengths (reference actual property features/rooms from the data)
- **concerns**: Array of 2-4 specific concerns or deal-breakers
- **tip**: One practical tip or modification that could improve the fit

Respond ONLY with valid JSON matching the schema. Do NOT wrap in markdown.
`;

// ── JSON Schema ───────────────────────────────────────────────────────────────

const lifestyleCategorySchema = {
    type: Type.OBJECT,
    properties: {
        verdict: { type: Type.STRING, description: "One of: Excellent Fit, Good Fit, Moderate Fit, Poor Fit, Not Recommended." },
        summary: { type: Type.STRING, description: "3-4 sentence assessment of property fit for this lifestyle." },
        strengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 specific strengths of this property for this lifestyle."
        },
        concerns: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-4 specific concerns or deal-breakers for this lifestyle."
        },
        tip: { type: Type.STRING, description: "One practical tip or modification to improve fit." }
    },
    required: ["verdict", "summary", "strengths", "concerns", "tip"]
};

export const lifestyleFitSchema = {
    type: Type.OBJECT,
    properties: {
        working_professionals: lifestyleCategorySchema,
        families_with_kids: lifestyleCategorySchema,
        seniors: lifestyleCategorySchema,
    },
    required: ["working_professionals", "families_with_kids", "seniors"]
};

// ── TypeScript result type ────────────────────────────────────────────────────

export interface LifestyleFitCategory {
    verdict: string;
    summary: string;
    strengths: string[];
    concerns: string[];
    tip: string;
}

export interface LifestyleFitResult {
    working_professionals: LifestyleFitCategory;
    families_with_kids: LifestyleFitCategory;
    seniors: LifestyleFitCategory;
}
