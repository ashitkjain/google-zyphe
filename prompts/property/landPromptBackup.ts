/**
 * BACKUP of the original Land Utility Prompt (text-only, no tools).
 * Superseded by landUtility.ts which uses Gemini function calling + USGS/Google elevation APIs.
 * Kept for reference only.
 */

export const getLandPromptBackup = (
    eligibleCount: number,
    subjectInfo: string,
    compsList: any[]
): string => {
    return `Role: Senior Real Estate Appraiser and Land Use Architect for Zyphe.ai.
Objective: Generate a normalized CMA for ${eligibleCount} properties by verifying square footage integrity and estimating usable lot utility.

Subject Property: ${subjectInfo}

Comp List:
${JSON.stringify(compsList, null, 2)}

USABLE LOT ESTIMATION
1. ZONING: Identify the Zoning District and search for the specific Setback and Lot Coverage requirements.
2. TOPOGRAPHIC SLOPE ANALYSIS: For the Subject and each Comp:
   a. Use Google Search to find the Elevation of the property address and the elevation of the street 100 feet behind it.
      - Calculate Slope: Subtract the lower elevation from the higher elevation and divide by the distance (Rise/Run).
       - Assign Category:
        * Flat: < 5% grade (e.g., property sits on a flat bench).
        * Moderate: 6-15% grade.
        * Steep: 16-30% grade.
        * Heavy: >= 30% grade (e.g., land drops sharply, legally unbuildable).
      - In your output, state in the topography field: 'Inferred as [Category] based on [X] feet of elevation change over [Y] feet of lot depth.'
      - NEVER return "Unknown" as the topography. Always infer using this method.
      - IMPORTANT: Ignore marketing descriptions for topography. If the lot size is > 30,000 sq ft and the elevation change exceeds 20 feet over the first 100 feet of depth, classify strictly as Heavy Slope.
   e. CROSS-CHECK: If a comp is within 0.5 miles of the subject and in the same hillside neighborhood, its slope should be SIMILAR to the subject unless there is clear evidence otherwise (e.g., the comp is on a flat plateau while the subject is on a hillside). Do NOT default to "Flat" without verifying via elevation data. A comp in the same hilly area as a Heavy-slope subject should NOT be reported as Flat unless you have specific elevation data proving it.

Return ONLY valid JSON (no markdown, no code fences):
{
  "subject_audit": {
    "tax_sqft": number or null,
    "zoning_district": "string",
    "topography": "string",
    "slope_percent": number or null,
    "slope_category": "Flat | Moderate | Steep | Heavy",
    "topo_source_url": "string or null (URL used for topographic data)",
    "notes": "string"
  },
  "properties": [
    {
      "address": "string",
      "zpid": "string",
      "lot_utility": {"gross_lot_sqft": number or null, "zoning_district": "string", "topography": "string", "slope_percent": number or null, "slope_category": "Flat | Moderate | Steep | Heavy", "topo_source_url": "string or null","notes": "string"},
    }
  ],
  "confidence_score": number 1-10
}`;
};
