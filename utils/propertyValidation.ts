/**
 * Property Data Validation — Central rules for property intake quality.
 * 
 * Used at ingestion (CityDataTab) and at search time (ExploreTab buyer matching)
 * to ensure only valid, complete properties flow through the pipeline.
 */

// ── Allowed property types ──────────────────────────────────────────
export const ALLOWED_HOME_TYPES = ['SINGLE_FAMILY', 'TOWNHOUSE', 'CONDO'];

// ── Ghost listing detection ─────────────────────────────────────────

/**
 * Detects "ghost" listings — new construction model-home plans,
 * community placeholders, or entries without real street addresses.
 * 
 * Examples that get flagged:
 * - "Plan 1 Plan, Larkspur at Francis Ranch"
 * - "Residence 1 Plan, Parkton"
 * - "Pleasanton, CA 94588 US" (no street number)
 */
export const isGhostListing = (item: any): boolean => {
    const addr = item.location?.address?.line || item.address || item.streetAddress || item.full_address || '';
    const addrLower = addr.toLowerCase().trim();

    // New construction model-home plans and community placeholders
    if (/^(plan\s+\d|residence\s+\d+\s+plan|homesite|lot\s+\d)/i.test(addrLower)) return true;

    return false;
};

/**
 * Only allow Single Family, Townhouse, and Condo listings.
 * Uses an allowlist: if homeType is set and not in ALLOWED_HOME_TYPES, block it.
 * This handles all variants (LOT, LAND, LOT_LAND, VACANT_LAND, MULTI_FAMILY, etc.)
 * without maintaining a separate blocklist.
 * If no type info, let it through (will be filtered when data is enriched).
 */
export const isSupportedPropertyType = (item: any): boolean => {
    const ht = item.homeType || '';
    if (!ht) return true; // no type info yet — let it through
    return ALLOWED_HOME_TYPES.includes(ht);
};

// ── Essential data completeness check ───────────────────────────────

/**
 * Checks that a property has the minimum required data fields:
 * - Valid street address (starts with a number)
 * - Price (list price or zestimate)
 * - Bedrooms
 * - Living area / sqft
 * 
 * Works with both raw listing data (from API/cache) and
 * context graph data (from Firestore context_graph collection).
 */
export const hasEssentialData = (item: any): boolean => {
    // Resolve fields from either listing format or context graph format
    const addr = item.address
        || item.location?.address?.line
        || item.streetAddress
        || item.full_address
        || '';

    const price = item.price
        || item.list_price
        || item.listPrice
        || item.zestimate
        || item.keyMetrics?.price
        || 0;

    const beds = item.beds
        || item.bedrooms
        || item.keyMetrics?.beds
        || 0;

    const sqft = item.sqft
        || item.livingArea
        || item.livingAreaValue
        || item.keyMetrics?.sqft
        || 0;

    // Must have a real street address (starts with a number)
    const hasStreetAddress = /^\d/.test(addr.trim());

    return hasStreetAddress && price > 0 && beds > 0 && sqft > 0;
};

// ── Combined validation ─────────────────────────────────────────────

/**
 * Full validation: not a ghost, supported type, and has essential data.
 * Use this as the single entry point when you want all checks.
 */
export const isValidProperty = (item: any): boolean => {
    return isSupportedPropertyType(item) && hasEssentialData(item);
};
