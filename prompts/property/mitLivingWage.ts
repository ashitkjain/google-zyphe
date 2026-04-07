import { Type } from "@google/genai";

/**
 * MIT Living Wage Calculator prompt.
 *
 * Uses Gemini with Google Search grounding to fetch data from:
 *   Metro (preferred): https://livingwage.mit.edu/metros/{metroCode}
 *   County (fallback):  https://livingwage.mit.edu/counties/{countyFips}
 *
 * MIT supports metro-level data for most major US CBSAs — use that when available
 * as it's more representative of actual local costs.
 *
 * Target family type: 2 Adults, 2 Children (Both Working).
 * This column shows child care costs (unlike "1 Working" where one parent stays home)
 * and represents the typical dual-income home-buying family.
 * NOTE: MIT reports per-adult wages for the "Both Working" column — household total = 2×.
 */

export interface MitLivingWageParams {
    city?: string;
    county?: string;
    state: string;
    /** 5-digit county FIPS — e.g. "06001" for Alameda */
    countyFips?: string;
    /**
     * OMB Core-Based Statistical Area (CBSA) code — e.g. "41860" for SF-Oakland-Fremont.
     * When provided the prompt will use the metro URL first.
     */
    metroCode?: string;
    /** Human-readable metro name — e.g. "San Francisco-Oakland-Fremont, CA" */
    metroName?: string;
}

export const getMitLivingWagePrompt = (params: MitLivingWageParams): string => {
    const { city, county, state, countyFips, metroCode, metroName } = params;

    const metroUrl  = metroCode  ? `https://livingwage.mit.edu/metros/${metroCode}`   : null;
    const countyUrl = countyFips ? `https://livingwage.mit.edu/counties/${countyFips}` : null;

    const locationLabel =
        metroName  ? `${metroName} metro` :
        city       ? `${city}, ${state} (${county ? county + ' County' : state})` :
        county     ? `${county} County, ${state}` :
        state;

    // Build the URL strategy block shown to Gemini
    let urlStrategy: string;
    if (metroUrl && countyUrl) {
        urlStrategy = `
STEP 1 — Try the METRO page first (more representative of local costs):
  URL: ${metroUrl}
  ${metroName ? `This covers the ${metroName} CBSA.` : ''}

  If the metro page 404s or has no data, fall back to:

STEP 2 — County page:
  URL: ${countyUrl}
  This is for ${county || 'the county'}, ${state}.

Record which URL you actually used in the \`source_url\` field, and set \`geographic_level\` to either "metro" or "county".`.trim();
    } else if (metroUrl) {
        urlStrategy = `
URL: ${metroUrl}
${metroName ? `This covers the ${metroName} CBSA.` : ''}
Set \`geographic_level\` to "metro".
If this page is missing data, search: site:livingwage.mit.edu "${county || city}" ${state} and use whatever page has the most complete data.`.trim();
    } else if (countyUrl) {
        urlStrategy = `
Start with the county page: ${countyUrl}
Before using it, also check if MIT has a metro-level page for ${city || county}, ${state} by searching:
  site:livingwage.mit.edu "${city || county}" living wage metro
If a metro page exists and has complete data, prefer it and set \`geographic_level\` to "metro".
Otherwise use the county page and set \`geographic_level\` to "county".`.trim();
    } else {
        urlStrategy = `
Search for the MIT Living Wage Calculator page for ${locationLabel}.
First check for a metro-level page (https://livingwage.mit.edu/metros/…), then fall back to a county page (https://livingwage.mit.edu/counties/…).
Set \`geographic_level\` accordingly.`.trim();
    }

    return `
You are a cost-of-living research assistant with access to live web search.

TASK: Fetch the MIT Living Wage Calculator data for ${locationLabel}.

═══════════════════════════════════════════════════════
URL STRATEGY (metro preferred over county)
═══════════════════════════════════════════════════════
${urlStrategy}

═══════════════════════════════════════════════════════
DATA TO EXTRACT
═══════════════════════════════════════════════════════
From the "Typical Expenses" table, extract EXACT numbers for the family type:
  "2 Adults, 2 Children" — BOTH WORKING column.

  IMPORTANT about the "Both Working" column:
  - MIT shows the wage each adult must individually earn (not the household total)
  - Household annual income = the per-adult figure × 2 × 2080
  - The expense figures (food, housing, etc.) are HOUSEHOLD totals (not per-adult)
  - Child care IS included in this column (unlike "1 Working" where one stays home)

Extract:
  1.  Living wage per adult (hourly) — what each adult must earn
  2.  Household annual living wage = per-adult hourly × 2 × 2080
  3.  Food costs (annual household)
  4.  Child Care costs (annual household)
  5.  Medical / Health care (annual household)
  6.  Housing (annual household)
  7.  Transportation (annual household)
  8.  Civic (annual — clothing, personal care, civic engagement, entertainment)
  9.  Broadband / Internet & mobile (annual — record 0 if not separately listed)
  10. Other / Miscellaneous (annual household)
  11. Required annual household income BEFORE taxes

Also extract for reference:
  - Poverty wage (hourly)
  - State or local minimum wage (hourly)

RULES:
- Use ONLY the "2 Adults, 2 Children" column where BOTH ADULTS ARE WORKING
- Record EXACT values from the page — do not estimate or interpolate
- If the page shows monthly figures, multiply by 12 to get annual
- living_wage_hourly = per-adult hourly wage (what each adult must earn)
- annual_living_wage = household total (per-adult × 2 × 2080)
- all expense figures are household annual totals
- source_url = the exact MIT URL you used
- geographic_level = "metro" if you used a metro page, "county" if you used a county page
- Include the data last-updated date shown on the page

Return ONLY valid JSON matching the schema.
`.trim();
};

// ─── Response Schema ──────────────────────────────────────────────────────────

export const mitLivingWageSchema = {
    type: Type.OBJECT,
    properties: {
        county:   { type: Type.STRING, description: "County name (e.g. 'Alameda')" },
        state:    { type: Type.STRING, description: "State abbreviation (e.g. 'CA')" },
        metro:    { type: Type.STRING, description: "Metro/CBSA name if a metro page was used (e.g. 'San Francisco-Oakland-Fremont, CA'). Omit if county page was used." },
        geographic_level: { type: Type.STRING, description: "'metro' or 'county' — indicates which MIT page was used" },
        family_type:  { type: Type.STRING, description: "Always: '2 Adults, 2 Children (Both Working)'" },
        source_url:   { type: Type.STRING, description: "Exact MIT Living Wage URL used (metro or county)" },
        data_updated: { type: Type.STRING, description: "Date the MIT data was last updated (e.g. 'February 15, 2026')" },

        living_wage_hourly: { type: Type.NUMBER, description: "Per-adult living wage $/hr — what each adult in the household must earn" },
        annual_living_wage: { type: Type.NUMBER, description: "Household annual living wage = per-adult hourly × 2 × 2080" },

        expenses: {
            type: Type.OBJECT,
            properties: {
                food:          { type: Type.NUMBER, description: "Annual food cost ($)" },
                child_care:    { type: Type.NUMBER, description: "Annual child care cost ($)" },
                medical:       { type: Type.NUMBER, description: "Annual medical / health care cost ($)" },
                housing:       { type: Type.NUMBER, description: "Annual housing cost ($)" },
                transportation:{ type: Type.NUMBER, description: "Annual transportation cost ($)" },
                civic:         { type: Type.NUMBER, description: "Annual civic cost — clothing, personal care, entertainment ($)" },
                broadband:     { type: Type.NUMBER, description: "Annual internet & mobile / broadband cost ($). Use 0 if not separately listed." },
                other:         { type: Type.NUMBER, description: "Annual other / miscellaneous cost ($)" },
                required_annual_income_before_taxes: { type: Type.NUMBER, description: "Required annual income before taxes ($)" },
            },
            required: ["food", "child_care", "medical", "housing", "transportation", "civic", "broadband", "other", "required_annual_income_before_taxes"]
        },

        reference: {
            type: Type.OBJECT,
            description: "Reference wages for context",
            properties: {
                poverty_wage_hourly:  { type: Type.NUMBER, description: "Poverty wage $/hr" },
                minimum_wage_hourly:  { type: Type.NUMBER, description: "State/local minimum wage $/hr" },
            }
        },

        gemini_summary: {
            type: Type.STRING,
            description: "2-3 sentence narrative: what these costs mean for a dual-income family with 2 children considering this location. Mention the per-adult wage required, total household income needed, and how child care compares to housing as cost drivers."
        }
    },
    required: ["county", "state", "geographic_level", "family_type", "source_url", "living_wage_hourly", "annual_living_wage", "expenses", "gemini_summary"]
};

// ─── TypeScript types ─────────────────────────────────────────────────────────

export interface MitLivingWageExpenses {
    food: number;
    child_care: number;
    medical: number;
    housing: number;
    transportation: number;
    civic: number;
    broadband: number;
    other: number;
    required_annual_income_before_taxes: number;
}

export interface MitLivingWageResult {
    county: string;
    state: string;
    metro?: string;
    geographic_level: 'metro' | 'county';
    /** Always '2 Adults, 2 Children (Both Working)' */
    family_type: string;
    source_url: string;
    data_updated?: string;
    /** Per-adult hourly wage — what each adult must earn */
    living_wage_hourly: number;
    /** Household annual total = per-adult × 2 × 2080 */
    annual_living_wage: number;
    expenses: MitLivingWageExpenses;
    reference?: {
        poverty_wage_hourly?: number;
        minimum_wage_hourly?: number;
    };
    gemini_summary: string;
}
