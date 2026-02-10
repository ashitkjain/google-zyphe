
import { PropertyData, CustomAIAnalysisResult } from "../types";

/**
 * Optimizes the PropertyData object for AI context injection.
 * Filters out low-value API metadata, technical keys, ancient history, and null values
 * to reduce token usage and noise.
 */
export const optimizePropertyForAi = (property: PropertyData): Partial<PropertyData> => {
    if (!property) return {};

    // 1. Create a shallow clone and drop known "blocklist" fields
    const {
        zpid,
        feed_property_id,
        alternate_ids,
        images,
        coordinates,
        mapZoomIn,
        mapZoomOut,
        nearbyHomes,
        comps, // Drop comps - not needed for narrative description
        ...keptData
    } = property;

    // 2. Handle Price History (Keep last 5 years only, limit to TOP 3 entries)
    let optimizedHistory = undefined;
    if (property.priceHistory && Array.isArray(property.priceHistory)) {
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

        optimizedHistory = property.priceHistory
            .filter(h => {
                const d = new Date(h.date);
                return !isNaN(d.getTime()) && d >= fiveYearsAgo;
            })
            .slice(0, 3);
    }

    // 3. Construct candidate and prune heavy technical sub-structures
    const candidate: any = {
        ...keptData,
        priceHistory: optimizedHistory,
    };

    // Prune Air Quality (keep only high-level)
    if (candidate.airQuality) {
        delete candidate.airQuality.pollutants;
        delete candidate.airQuality.recommendations;
    }

    // Prune Solar Data (keep only relevant metrics)
    if (candidate.solarData) {
        delete candidate.solarData.solarPanels;
        if (candidate.solarData.wholeRoofStats) {
            delete candidate.solarData.wholeRoofStats.sunshineQuantiles;
        }
    }

    // Prune Pollen
    if (candidate.pollen) {
        delete candidate.pollen.raw_data;
    }

    return cleanObject(candidate);
};

/**
 * Optimizes the Visual Analysis result for the final Comprehensive Narrative.
 * Removes raw image-by-image analysis and technical audits to focus on synthesized insights.
 */
export const optimizeVisualForAi = (visual: CustomAIAnalysisResult): Partial<CustomAIAnalysisResult> => {
    if (!visual) return {};

    const {
        image_by_image_analysis, // Huge token hog, redundant for narrative
        image_quality_analysis, // Technical audit, not needed for description
        ...kept
    } = visual;

    // Further prune sub-objects
    if (kept.general_market_intelligence) {
        delete (kept.general_market_intelligence as any).web_sources;
    }

    return kept;
};

// Helper: Recursively remove empty/null values
function cleanObject(obj: any): any {
    if (obj === null || obj === undefined || obj === '') return undefined;

    if (Array.isArray(obj)) {
        if (obj.length === 0) return undefined;
        // Recurse on array items
        const cleanedArr = obj.map(cleanObject).filter(v => v !== undefined);
        return cleanedArr.length > 0 ? cleanedArr : undefined;
    }

    if (typeof obj === 'object') {
        const result: any = {};
        let hasKeys = false;
        for (const key in obj) {
            const cleaned = cleanObject(obj[key]);
            if (cleaned !== undefined) {
                result[key] = cleaned;
                hasKeys = true;
            }
        }
        return hasKeys ? result : undefined;
    }

    return obj;
}
