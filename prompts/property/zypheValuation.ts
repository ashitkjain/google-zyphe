
import { Type } from '@google/genai';
import type { SaleComp } from '../../components/client-hub/PropertyCompsTab';

// ─────────────────────────────────────────────────────────────────────────────
// Types -----------------------------------------------------------------------

export interface ZypheValuationInput {
    /** Full address of the subject property, e.g. "27663 La Porte Ave, Hayward, CA 94545" */
    subjectAddress: string;
    /** City + State, e.g. "Hayward, CA" */
    cityState: string;
    /** Zip code of the subject, e.g. "94545" */
    zipCode: string;
    /** Subject property data — any fields available (beds, baths, sqft, yearBuilt, remarks, etc.) */
    subjectData: Record<string, any>;
    /**
     * Sold comps from Rentcast /properties, each enriched with a pre-computed
     * daysSinceSale value (integer days from lastSaleDate to today).
     */
    comps: (SaleComp & { daysSinceSale: number })[];
    /** ISO date string for "today" so Gemini knows what the reference date is */
    today: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt ----------------------------------------------------------------------

export const getZypheValuationPrompt = ({
    subjectAddress,
    cityState,
    zipCode,
    subjectData,
    comps,
    today,
}: ZypheValuationInput): string => `
Role: Act as a Senior Real Estate Investment Analyst and Broker. You are the logic engine for Zyphe.
Your task is to provide a "Condition-Adjusted Valuation" for a property using a combination of live market research and hard historical data.
Reference date (today): ${today}

──────────────────────────────────────────────────────────────
STEP 1 — LOCAL MARKET INTELLIGENCE (Search Required)
──────────────────────────────────────────────────────────────
Conduct a search for real estate market conditions as of ${today} for ${cityState}, ZIP ${zipCode}. Identify:

1. 1-Year Value Change: % increase or decrease in home values over the last year.
2. Pace of Market: Current median Days on Market (DOM) or Days to Pending.
3. Inventory Status: Months of Supply → classify as Buyer's Market, Seller's Market, or Balanced.

──────────────────────────────────────────────────────────────
STEP 2 — SUBJECT PROPERTY & COMPS
──────────────────────────────────────────────────────────────
Subject Property Address: ${subjectAddress}
Subject Data:
${JSON.stringify(subjectData, null, 2)}

Sold Comps (last 180 days, each includes daysSinceSale = days from sale date to ${today}):
${JSON.stringify(comps, null, 2)}

──────────────────────────────────────────────────────────────
STEP 3 — APPLIED ZYPHE LOGIC (The Audit)
──────────────────────────────────────────────────────────────

A) EXCLUSION LOGIC
   - Exclude any comp whose squareFootage is more than ±20% of the subject's squareFootage (GLA filter).
   - Exclude comps built in a different era: do not compare pre-1980 to post-2000 homes.
   - List every excluded comp and the exact reason.

B) TIME-ADJUSTMENT
   - For any retained comp where daysSinceSale > 90, apply the local YoY % correction you found in Step 1
     to normalize the comp price to ${today} dollars.
   - Show which comps were adjusted and by how much.

C) DISTRESS DETECTION
   - Scan the Subject Data's "publicRemarks", "description", or any text field for keywords:
     "as-is", "short sale", "cash only", "REO", "bank owned", "fixer", "distressed".
   - If found, apply a 10–15% Liquidity Discount to the final valuation vs. turnkey neighbors,
     and explain the discount in the narrative.

──────────────────────────────────────────────────────────────
STEP 4 — OUTPUT
──────────────────────────────────────────────────────────────
Respond ONLY with this JSON object. No markdown, no extra text.

{
  "verified_local_trend": string,         // 1-sentence summary of Step 1 findings, e.g. "Hayward is in a 6.6% annual correction phase with 32 DOM and balanced inventory."
  "yoy_change_pct": number,               // e.g. -6.6 or +4.2
  "market_condition": string,             // "Seller's Market" | "Buyer's Market" | "Balanced"
  "median_dom": number,                   // median days on market found in Step 1

  "estimated_value": number,              // final point estimate in dollars
  "value_range_low": number,
  "value_range_high": number,
  "confidence_score": number,             // 0–100

  "distress_discount_applied": boolean,
  "distress_discount_pct": number,        // 0 if not applied
  "distress_keywords_found": [string],    // empty array if none

  "comps_retained": number,
  "audit_log": [                          // one entry per excluded or adjusted comp
    {
      "address": string,
      "action": "excluded" | "adjusted",
      "reason": string,
      "adjustment_pct": number | null     // null for excluded comps
    }
  ],

  "expert_narrative": string              // exactly 2 paragraphs: valuation rationale + negotiation strategy
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Schema ----------------------------------------------------------------------

export const zypheValuationSchema = {
    type: Type.OBJECT,
    properties: {
        verified_local_trend: { type: Type.STRING },
        yoy_change_pct: { type: Type.NUMBER },
        market_condition: { type: Type.STRING },
        median_dom: { type: Type.NUMBER },

        estimated_value: { type: Type.NUMBER },
        value_range_low: { type: Type.NUMBER },
        value_range_high: { type: Type.NUMBER },
        confidence_score: { type: Type.NUMBER },

        distress_discount_applied: { type: Type.BOOLEAN },
        distress_discount_pct: { type: Type.NUMBER },
        distress_keywords_found: { type: Type.ARRAY, items: { type: Type.STRING } },

        comps_retained: { type: Type.NUMBER },
        audit_log: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    address: { type: Type.STRING },
                    action: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    adjustment_pct: { type: Type.NUMBER },
                },
                required: ['address', 'action', 'reason'],
            },
        },

        expert_narrative: { type: Type.STRING },
    },
    required: [
        'verified_local_trend', 'yoy_change_pct', 'market_condition', 'median_dom',
        'estimated_value', 'value_range_low', 'value_range_high', 'confidence_score',
        'distress_discount_applied', 'distress_discount_pct', 'distress_keywords_found',
        'comps_retained', 'audit_log', 'expert_narrative',
    ],
};
