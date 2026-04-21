/**
 * Property Decision Policies — Centralized business logic for property classification and analysis eligibility.
 */

export const PROPERTY_TYPES = {
    SINGLE_FAMILY: 'SINGLE_FAMILY',
    TOWNHOUSE: 'TOWNHOUSE',
    CONDO: 'CONDO',
} as const;

export const ALLOWED_HOME_TYPES = Object.values(PROPERTY_TYPES);

/**
 * Single Family Detached homes — homeType is exactly 'SINGLE_FAMILY' in our schema.
 */
export const isSingleFamily = (item: { homeType?: string | null }): boolean =>
    item.homeType === PROPERTY_TYPES.SINGLE_FAMILY;

/**
 * Townhouse properties — homeType is exactly 'TOWNHOUSE' in our schema.
 */
export const isTownhome = (item: { homeType?: string | null }): boolean =>
    item.homeType === PROPERTY_TYPES.TOWNHOUSE;

/**
 * Consolidated policy for Orientation Analysis eligibility.
 * Rules:
 * 1. Must be a Single Family home or a Townhouse.
 * 2. Must have a valid street address.
 */
export const isTargetForOrientationAnalysis = (prop: {
    homeType?: string | null;
    address?: string | null;
}): { target: boolean; reason?: string } => {
    const isSFD = isSingleFamily(prop);
    const isTH = isTownhome(prop);
    const isGhost = isGhostListing(prop);

    if (isGhost) {
        return { target: false, reason: 'Property is a placeholder/ghost listing' };
    }

    if (!isSFD && !isTH) {
        return { target: false, reason: 'Property type must be Single Family or Townhome' };
    }

    const addr = (prop.address || '').trim();
    const hasStreetNumber = /^\d/.test(addr);

    if (!addr || !hasStreetNumber) {
        return { target: false, reason: 'Property is missing a specific street address (number required)' };
    }

    return { target: true };
};

/**
 * Checks if the Orientation analysis result is clear/conclusive.
 */
export const isOrientationClear = (orientationAi: any): boolean => {
    if (!orientationAi || !orientationAi.final_orientation) return false;
    const final = orientationAi.final_orientation;
    return final !== 'UNCLEAR' && final !== 'UNCLEAR_IMAGE';
};

/**
 * Checks if a property is a "ghost" or placeholder listing.
 */
export const isGhostListing = (item: { address?: string | null }): boolean => {
    const addr = (item.address || '').toLowerCase().trim();
    return /^(plan\s+\d|residence\s+\d+\s+plan|homesite|lot\s+\d)/i.test(addr);
};

/**
 * Essential data completeness policy for full analysis.
 */
export const hasEssentialData = (item: {
    address?: string | null;
    price?: number | null;
    bedrooms?: number | null;
    livingAreaValue?: number | null;
}): boolean => {
    const addr = item.address || '';
    const price = item.price || 0;
    const beds = item.bedrooms || 0;
    const sqft = item.livingAreaValue || 0;

    // Must have a real street address (starts with a number)
    const hasStreetAddress = /^\d/.test(addr.trim());

    return hasStreetAddress && price > 0 && beds > 0 && sqft > 0;
};

/**
 * Only allow Single Family, Townhouse, and Condo listings for general intake.
 */
export const isSupportedPropertyType = (item: { homeType?: string | null }): boolean => {
    const ht = item.homeType;
    if (!ht) return true; // No type info yet — let it through
    return [PROPERTY_TYPES.SINGLE_FAMILY, PROPERTY_TYPES.TOWNHOUSE, PROPERTY_TYPES.CONDO].includes(ht as any);
};

/**
 * Full validation: not a ghost, supported type, and has essential data.
 */
export const isValidProperty = (item: any): boolean => {
    return isSupportedPropertyType(item) && !isGhostListing(item) && hasEssentialData(item);
};
