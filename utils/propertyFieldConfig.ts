/**
 * Centralized field configuration for property data auditing.
 *
 * Single source of truth for:
 * - Which resoFacts sub-fields are audited for source-null detection
 * - The ALLOWED_HOME_TYPES allowlist for property type filtering
 *
 * Imported by:
 *   services/api/property.ts       → builds _fetchMeta.fieldsNull
 *   services/smokeTest.ts          → maps fieldsNull to sourceNull checks
 *   utils/propertyValidation.ts    → isSupportedPropertyType
 */

// ── resoFacts sub-field audit ──────────────────────────────────────────────────
// These are optional RESO fields that listing agents may or may not populate.
// When resoFacts is present in the API response, any sub-field absent here
// is recorded as source-confirmed-null (grey N/A in smoke test, not a warning).

export const RESO_AUDITED_SUBFIELDS = [
    'interiorFeatures',
    'electric',
    'stories',
    'parkingFeatures',
    'propertyCondition',
] as const;

export type ResoAuditedSubfield = (typeof RESO_AUDITED_SUBFIELDS)[number];

/**
 * Returns the dotted key used in _fetchMeta.fieldsNull for a resoFacts sub-field.
 * e.g.  resoFieldKey('interiorFeatures') → 'resoFacts.interiorFeatures'
 */
export const resoFieldKey = (subfield: string): string => `resoFacts.${subfield}`;
