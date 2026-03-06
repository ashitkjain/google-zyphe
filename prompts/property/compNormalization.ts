/**
 * Comp Normalization Prompt & Schema
 *
 * Used by PropertyCompsTab to normalize sale comparables against
 * tax/public records via Gemini with Google Search grounding.
 */

export const COMP_NORMALIZATION_SYSTEM_INSTRUCTION =
    'You are a senior real estate data architect. Always return valid JSON. Use Google Search to verify tax records and public facts for each comp.';

export const COMP_NORMALIZATION_PROMPT = (
    compCount: number,
    subjectInfo: string,
    subjectDescription: string,
    compsJson: string,
) => `Role: Senior Real Estate Data Architect for Zyphe.ai.
Task: Normalize a list of ${compCount} comparables against official records.

Subject Property: ${subjectInfo}${subjectDescription ? `\nSubject Description: ${subjectDescription}` : ''}

Comps Data:
${compsJson}

Instructions:
1. GROUNDING: For the SUBJECT PROPERTY and each comp, use Google Search to find tax and public record data. Try these sources IN ORDER until you find the "Total Living Area" or "Building SqFt":
   a. County Assessor / Tax Assessor website (search "[address] [county] assessor parcel")
   b. Redfin "Public Facts" section (search "[address] redfin")
   c. Zillow "Public Facts" or "Home Facts" section (search "[address] zillow public facts")
   d. Realtor.com "Property Details" section
   CRITICAL: The "tax_sqft" field MUST be the actual square footage from TAX/ASSESSOR RECORDS ONLY — this is the official "Total Living Area" or "Building Area" from public records. It should NEVER equal the listing sqft unless the tax record genuinely matches. If the tax record says 912 but the listing says 1,812, return 912. If no public record sqft can be found from any source, return null.
2. DATA EXTRACTION: Extract "Total Living Area" from the Tax Record vs. the Listing for both the subject property AND each comp. The tax_sqft is the PUBLIC RECORD value — do NOT substitute or override it with the listing sqft.
3. PHANTOM ANALYSIS: Identify if "Listing SqFt" > "Tax SqFt" by more than 10%. If yes, flag as "Unpermitted Utility."
4. NORMALIZATION: Calculate the "Adjusted $/SqFt" by dividing the Sold Price by the HIGHER of the two square footage numbers (reflecting the buyer's actual price for total utility).
5. FEATURE ADJUSTMENTS: For the SUBJECT PROPERTY and EVERY comp, list ONLY features that DIRECTLY IMPACT VALUATION. Use SHORT labels (max 3 words each, no sentences or descriptions). Examples: "Pool", "Bay view", "ADU", "Updated kitchen", "Fire damage", "Corner lot", "Solar panels", "3-car garage". NEVER include basic property attributes that are already tracked separately: NO "Year built", NO "Lot size", NO "Square footage", NO "Bedrooms", NO "Bathrooms". Maximum 6 features per property. IMPORTANT: Semantically deduplicate — each feature must represent a UNIQUE concept. Do NOT include two features that mean the same thing. For example, "Fixer upper" and "Needs renovation" are the same concept — pick one. "Duplex configuration" and "Duplex potential" are the same — pick one. "Fire damage" and "Fixer-upper" overlap — keep only the more specific one.
6. INCLUSION RECOMMENDATION: For each comp, determine if it should be included in calculating the average $/sqft for the subject property valuation. Exclude comps that are distressed, have major condition differences, or have unreliable data. Give a brief reason for exclusion.

Return ONLY valid JSON with this schema (no markdown, no code fences):
{
  "subject_audit": {
    "tax_sqft": number or null,
    "adjustments": ["short valuation-impacting feature labels only, max 3 words each, max 8 items, e.g. 'Pool', 'Bay view', 'Fire damage', 'Updated kitchen'"]
  },
  "comp_analysis": [
    {
      "address": "string",
      "zpid": "string",
      "tax_sqft": number or null,
      "listing_sqft": number or null,
      "normalized_psf": number or null,
      "adjustments": ["list of factors"],
      "confidence_score": number 1-10,
      "risk_flag": boolean,
      "include_in_avg": boolean,
      "exclude_reason": "string or null"
    }
  ]
}`;

export const COMP_NORMALIZATION_SCHEMA = {
    type: 'object',
    properties: {
        subject_audit: {
            type: 'object',
            properties: {
                tax_sqft: { type: 'number' },
                adjustments: { type: 'array', items: { type: 'string' } },
            },
        },
        comp_analysis: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    address: { type: 'string' },
                    zpid: { type: 'string' },
                    tax_sqft: { type: 'number' },
                    listing_sqft: { type: 'number' },
                    normalized_psf: { type: 'number' },
                    adjustments: { type: 'array', items: { type: 'string' } },
                    confidence_score: { type: 'number' },
                    risk_flag: { type: 'boolean' },
                    include_in_avg: { type: 'boolean' },
                    exclude_reason: { type: 'string' },
                },
                required: ['address', 'zpid', 'normalized_psf', 'include_in_avg'],
            },
        },
    },
    required: ['subject_audit', 'comp_analysis'],
};
