/**
 * Context Graph Factor Names
 *
 * Single source of truth for the Factor ID → Name mapping used throughout the app.
 * Firestore context graphs store factors as {i, t} (id, tags) without names,
 * so this map resolves them to human-readable labels.
 *
 * Used by:
 * - ContextGraphView (display)
 * - ExploreTab / BrowseByCitySection (buyer matching)
 * - Buyer story extraction prompt (AI extraction guide)
 */

export const FACTOR_NAMES: Record<number, string> = {
    1: 'Price', 2: 'HOA', 4: 'Carrying Cost', 5: 'Seller Motivation', 6: 'ADU Potential', 7: 'STR', 8: 'Rental Yield', 9: 'Appreciation',
    14: 'Sqft', 17: 'Home Office', 19: 'Foundation', 20: 'Construction Era', 21: 'Move-In Ready', 22: 'Renovation Upside',
    23: 'Architecture', 24: 'Natural Light', 25: 'Open Concept', 26: 'Kitchen', 27: 'Bathroom', 28: 'Flooring', 29: 'Ceilings', 30: 'Finishes',
    31: 'Fenced Yard', 32: 'Outdoor Entertainment', 33: 'Privacy', 34: 'Curb Appeal', 35: 'Topography', 36: 'View', 37: 'Street Noise',
    38: 'Visual Clutter', 39: 'Yard Space', 40: 'Low Maintenance', 41: 'Exterior Style', 42: 'Commute', 43: 'Walkability', 44: 'Greenery', 45: 'Sidewalks',
    46: 'Fire Risk', 47: 'Flood Risk', 48: 'Solar', 49: 'Pollen', 50: 'HVAC', 51: 'Orientation/Vastu', 52: 'Air Quality', 54: 'Slope',
    57: 'WFH Score', 58: 'Multi-Gen', 59: 'Laundry', 60: 'Water/Air Systems', 61: 'Security', 62: 'Presentation',
    64: 'Job Hubs', 65: 'Dev Impact', 66: 'Soil/Geo', 67: 'Luxury Finishes', 68: 'Backyard Potential', 69: 'Streetscape', 70: 'Market Momentum',
    71: 'Development', 72: 'Complaints', 73: 'Satisfaction', 74: 'Safety', 75: 'Market Velocity', 76: 'Internet', 77: 'Noise', 78: 'Drought', 79: 'Disasters',
    80: 'Professional Fit', 81: 'Family Fit', 82: 'Senior Fit', 83: 'Neighborhood', 84: 'Walkable Amenities', 85: 'Medical', 86: 'EV Infrastructure',
    87: 'Pet Friendly', 88: 'Dining Scene', 89: 'Market Signals', 90: 'Growth Catalysts', 91: 'Investment Risk', 92: 'Market Friction', 93: 'Zoning',
    94: 'Street Character', 95: 'Curbside Risks', 96: 'Landscaping', 97: 'Parking', 98: 'Neighborhood Condition',
    100: 'Agent Highlights', 101: 'Schools', 102: 'Sentiment', 103: 'Market Narrative', 104: 'Condition', 105: 'Convenience',
    106: 'Seismic', 107: 'Flood Zone', 108: 'Sqft Discrepancy', 109: 'Lot Verification', 110: 'Listing Flags', 111: 'Distressed Signal',
    113: 'Room Character', 114: 'Interior Vibe', 115: 'Materials', 116: 'Layout', 120: 'Amenities Profile', 112: 'FEMA',
    121: 'Microclimate', 122: 'Census Demographics'
};

/** Unique factor names as an array (for use in prompts) */
export const FACTOR_NAME_LIST = [...new Set(Object.values(FACTOR_NAMES))];

/**
 * City-level factor IDs — extracted ONCE per city from deep_investment_research
 * and community_pulse, then merged into property context graphs at read time.
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
