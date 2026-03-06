/**
 * Tax Record Lookup Prompt
 *
 * A lightweight Gemini prompt that uses Google Search grounding to look up
 * the official living area (sqft) from county tax/assessor records for a
 * single property. This is much cheaper than the full comp normalization
 * prompt and is used as a fallback when no cached tax_sqft exists.
 */

export const TAX_RECORD_LOOKUP_SYSTEM_INSTRUCTION =
    'You are a real estate data specialist. Your ONLY task is to find the official living area square footage from public tax/assessor records. Always return valid JSON.';

export const TAX_RECORD_LOOKUP_PROMPT = (
    address: string,
    city?: string,
    state?: string,
    county?: string,
    apn?: string,
    listingSqft?: number,
) => `Task: Find the **official Living Area (Total Finished Area)** from county TAX/ASSESSOR RECORDS for this property.

Property: ${address}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}
${apn ? `APN: ${apn}` : ''}
${listingSqft ? `Listing Sqft: ${listingSqft.toLocaleString()} sf` : ''}

Instructions:
1. Use Google Search to find the TAX RECORD / ASSESSOR RECORD for this property. Try these sources IN ORDER:
   a. County Assessor / Tax Assessor website (search "${address} ${county || ''} county assessor parcel")
   b. Redfin "Public Facts" section (search "${address} redfin public facts")
   c. Zillow "Public Facts" or "Home Facts" (search "${address} zillow public facts")
   d. Realtor.com property details

2. Extract the "Total Living Area", "Finished Area", "Building Area", or "Gross Living Area" from the TAX RECORD.
   - This is the OFFICIAL public record value, NOT the listing/MLS square footage.
   - If the tax record says 912 but the listing says 1,812 — return 912.
   - If you cannot find a tax record value from ANY source, return null.

3. Also extract the year built and lot size from tax records if available.

Return ONLY valid JSON (no markdown, no code fences):
{
  "tax_sqft": number or null,
  "tax_year_built": number or null,
  "tax_lot_sqft": number or null,
  "source": "string describing where you found it (e.g. 'Alameda County Assessor', 'Redfin Public Facts')",
  "confidence": "high" | "medium" | "low"
}`;

export const TAX_RECORD_LOOKUP_SCHEMA = {
    type: 'object',
    properties: {
        tax_sqft: { type: 'number', description: 'Living area from tax records in sqft' },
        tax_year_built: { type: 'number', description: 'Year built from tax records' },
        tax_lot_sqft: { type: 'number', description: 'Lot size from tax records in sqft' },
        source: { type: 'string', description: 'Source of the data' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
    required: ['tax_sqft', 'source', 'confidence'],
};

export interface TaxRecordLookupResult {
    tax_sqft: number | null;
    tax_year_built?: number | null;
    tax_lot_sqft?: number | null;
    source: string;
    confidence: 'high' | 'medium' | 'low';
}
