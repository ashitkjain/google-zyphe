/**
 * Context Graph Types
 *
 * TaxonomyEntry is the unified representation of a property factor:
 *   {factor, tags, value} — the canonical taxonomy unit used for storage,
 *   buyer matching, and display throughout the app.
 */

import type { FactorType } from '../constants/contextGraphFactors';

/**
 * A single taxonomy entry — one dimension of a property's profile.
 * Stored compactly as {i, t, v} in Firestore; resolved to this shape at read time.
 */
export interface TaxonomyEntry {
    id: number;
    name: string;
    type: FactorType;
    tags: string[];
    value: string;
}

/**
 * The full taxonomy for a property — all extracted and precomputed factors
 * resolved into TaxonomyEntry shape.
 */
export type PropertyTaxonomy = TaxonomyEntry[];
