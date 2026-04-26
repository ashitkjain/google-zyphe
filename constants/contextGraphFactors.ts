/**
 * Context Graph Factor Names
 *
 * Single source of truth for the Factor ID → Name mapping used throughout the app.
 * Firestore context graphs store factors as {i, t} (id, tags) to save space,
 * so this registry resolves them to human-readable labels and typed structures.
 */

export const FACTOR_NAMES: Record<number, string> = {
    1: 'Price', 2: 'HOA', 4: 'Carrying Cost', 5: 'Seller Motivation', 6: 'ADU Potential', 7: 'STR', 8: 'Rental Yield', 9: 'Appreciation',
    14: 'Living Area', 17: 'Home Office', 19: 'Foundation', 20: 'Construction Era', 21: 'Move-In Ready', 22: 'Renovation Upside',
    23: 'Architecture', 24: 'Natural Light', 25: 'Open Concept', 26: 'Kitchen', 27: 'Bathroom', 28: 'Flooring', 29: 'Ceilings', 30: 'Finishes',
    31: 'Fenced Yard', 32: 'Outdoor Entertainment', 33: 'Privacy', 34: 'Curb Appeal', 35: 'Topography', 36: 'View',
    38: 'Visual Clutter', 39: 'Yard Space', 40: 'Low Maintenance', 41: 'Exterior Style', 42: 'Commute', 43: 'Walkability', 44: 'Greenery', 45: 'Sidewalks',
    46: 'Fire Risk', 47: 'Flood Risk', 48: 'Solar', 49: 'Pollen', 50: 'HVAC', 51: 'Orientation/Vastu', 52: 'Air Quality', 54: 'Slope',
    57: 'WFH Score', 58: 'Multi-Gen', 59: 'Laundry', 60: 'Water/Air Systems', 61: 'Security', 62: 'Presentation',
    64: 'Job Hubs', 65: 'Any nearby development', 66: 'Soil/Geo', 67: 'Luxury Finishes', 68: 'Backyard Potential', 69: 'Streetscape', 70: 'Market Momentum',
    71: 'Development', 72: 'Complaints', 73: 'Satisfaction', 74: 'Safety', 75: 'Market Velocity', 76: 'Internet', 77: 'Noise', 78: 'Drought', 79: 'Disasters',
    80: 'Professional Fit', 81: 'Family Fit', 82: 'Senior Fit', 83: 'Neighborhood', 84: 'Walkable Amenities', 85: 'Medical', 86: 'EV Infrastructure',
    88: 'Dining Scene', 89: 'Market Signals', 90: 'Growth Catalysts', 91: 'Investment Risk', 92: 'Market Friction', 93: 'Zoning',
    94: 'Street Character', 95: 'Curbside Risks', 96: 'Landscaping', 97: 'Parking', 98: 'Neighborhood Condition',
    100: 'Agent Highlights', 101: 'Schools', 102: 'Sentiment', 103: 'Market Narrative', 104: 'Condition', 105: 'Convenience',
    106: 'Seismic', 107: 'Flood Zone', 108: 'Sqft Discrepancy', 109: 'Lot Verification', 110: 'Listing Flags', 111: 'Distressed Signal',
    113: 'Room Character', 114: 'Interior Vibe', 115: 'Materials', 116: 'Layout', 120: 'Nearby Places Profile', 112: 'FEMA',
    121: 'Microclimate', 122: 'City Economic Profile'
};

/** Unique factor names as an array (for use in prompts) */
export const FACTOR_NAME_LIST = [...new Set(Object.values(FACTOR_NAMES))];

/**
 * Factors that are no longer supported or represent duplicate/low-value data.
 * These are filtered out during storage and masked in the UI.
 */
export const DELETED_FACTOR_IDS = new Set([3, 10, 11, 12, 13, 15, 16, 18, 37, 53, 55, 56, 62, 63, 66, 69, 78, 87, 107, 110, 112, 117, 118, 119]);

/**
 * Factors computed directly from property fields (no AI needed).
 * Used to instruct the AI to skip these during extraction.
 */
export const PRECOMPUTED_FACTOR_IDS = [1, 2, 4, 5, 7, 8, 14, 16, 18, 20, 21, 28, 30, 33, 39, 41, 43, 46, 47, 48, 49, 50, 51, 52, 54, 59, 65, 76, 77, 79, 80, 81, 82, 83, 84, 85, 86, 106, 108, 109, 111, 120, 121, 122];

/**
 * City-level factor IDs — merged into property context graphs at read time.
 * These are identical across all properties in the same city.
 */
export const CITY_LEVEL_FACTOR_IDS: number[] = [
    9,   // Appreciation
    70,  // Market Momentum
    71,  // Development Maturity
    72,  // Complaints
    73,  // Satisfaction
    74,  // Safety (perceived)
    75,  // Market Velocity (DOM)
    89,  // Market Signals
    90,  // Growth Catalysts
    91,  // Investment Risk
    92,  // Market Friction
    93,  // Zoning
    102, // Sentiment
    103, // Market Narrative
];

export interface ContextGraphExtractionResult {
    factors: any[];
    summary: {
        topStrengths: string[];
        topConcerns: string[];
        propertyHighlight: string;
    };
    keyMetrics?: any;
    extractedAt: string;
}

export interface ExtractedFactor {
    id: number;
    name: string;
    value?: string;
    tags: string[];
}

/**
 * Resolves any factor format (compact {i,t,v} or full {id,name,tags}) into a 
 * standardized ExtractedFactor object.
 */
export const resolveFactor = (f: any): ExtractedFactor | null => {
    if (!f) return null;
    
    // Support both compact format {i, t, v} and legacy format {id, name, tags}
    const id = f.i || f.id;
    if (id == null) return null;
    
    const tags = f.t || f.tags || [];
    const value = f.v || f.value || '';
    const name = f.name || FACTOR_NAMES[id] || `Factor ${id}`;
    
    return {
        id,
        name,
        value,
        tags: Array.isArray(tags) ? tags : []
    };
};

/**
 * Returns a human-readable string representation of a factor.
 * Used for simple displays like badges or lists.
 */
export const expandFactor = (f: any): string => {
    const resolved = resolveFactor(f);
    if (!resolved) return typeof f === 'string' ? f : '';
    
    if (resolved.tags.length > 0) {
        return `${resolved.name}: ${resolved.tags.join(', ')}`;
    }
    if (resolved.value) {
        return `${resolved.name}: ${resolved.value}`;
    }
    return resolved.name;
};

/**
 * Merges city-level factors into a property's context graph result.
 * Ensures that city-wide intelligence (appreciation, sentiment, etc.) 
 * is correctly combined with property-specific insights at read-time.
 */
export const mergeCityFactors = (propertyGraph: ContextGraphExtractionResult, cityGraph: any): ContextGraphExtractionResult => {
    if (!cityGraph?.factors || !Array.isArray(cityGraph.factors)) return propertyGraph;
    
    // Create a set of city-level factor IDs to merge
    const cityIds = new Set(CITY_LEVEL_FACTOR_IDS);
    
    // Find factors from cityGraph that are in the cityIds set
    const cityFactors = cityGraph.factors.filter((f: any) => {
        const id = f.i || f.id;
        return id != null && cityIds.has(id);
    });
    
    if (cityFactors.length === 0) return propertyGraph;
    
    // Merge: Property factors take precedence. If a city factor exists but is already 
    // present in property factors, keep the property factor.
    const merged = [...(propertyGraph.factors || [])];
    const propertyIds = new Set(merged.map(f => f.i || f.id));
    
    for (const cf of cityFactors) {
        const id = cf.i || cf.id;
        if (!propertyIds.has(id)) {
            merged.push(cf);
        }
    }
    
    // Maintain consistent sort order
    merged.sort((a, b) => {
        const idA = a.i || a.id || 0;
        const idB = b.i || b.id || 0;
        return idA - idB;
    });
    
    return {
        ...propertyGraph,
        factors: merged
    };
};
