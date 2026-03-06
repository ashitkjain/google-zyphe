/**
 * Distress Analysis & Value-Add prompt + schema for AI-driven identification of
 * distressed / motivated-seller properties and forced appreciation potential.
 */

export const DISTRESS_PROMPT = (mlsData: string) => `Role: Act as a Senior Real Estate Investment Analyst specializing in distressed assets and value-add opportunities. You are the intelligence engine for Zyphe.

Task: Analyze the provided MLS listing data to identify "Distress Signals" and "Forced Appreciation Potential."

Step 1: Market Intelligence (Search Grounding)
Perform a search for the most recent real estate data for the property's city/zip. Identify:

The local Price Correction Factor.

The median Days on Market (DOM).

Current ROI Benchmarks for 2026 (e.g., Minor Kitchen Refresh, ADU value-add).

Step 2: Distress 'Red Flag' Analysis
Scan the text, using semantics looking for intention, for the following indicators:

Financial: Short sale, REO, bank-owned, court approval, pre-foreclosure, auction.

Condition: As-is, contractor special, handyman, mold, foundation, teardown, probate, deferred maintenance, cash-only.

Motivation: Must sell, relocating, quick sale, bring all offers, estate sale.

Timing: Back on market (BOM), 2nd/3rd chance, failed inspections, high DOM.

Step 3: Value-Add & ARV Analysis
2026 ROI Reference Logic:
- For 'Original' kitchens, prioritize 'Minor Refresh' (Cabinet Paint/Hardware/Appliances) @ 113% ROI.
- For dated exteriors, prioritize 'Garage/Entry Doors' @ >200% ROI.
- For properties with >6k sqft lots or large garages, flag 'ADU Conversion' as a High-Yield Play (~80% cost recovery + $2,500/mo rent potential).
- DE-PRIORITIZE: Major structural changes or pools (Low ROI <50%).
Completed Upgrades: Identify finished Structural, Systemic, or Cosmetic work.

The Profit Gap: Identify missing "High ROI" projects missing from the home.

ADU Potential: Scan for lot size or specific ADU/In-law unit mentions.

Step 4: JSON Output Requirement

IMPORTANT — "estimated_arv_premium" explanation:
This is the estimated dollar amount the property's After-Repair Value (ARV) would increase above its current list price if ALL suggested renovations were completed. Base this on local market comps and the ROI benchmarks from Step 1. For example, if a $400k home could gain $60k from a kitchen refresh and garage door replacement, return 60000. Always return a positive integer, never 0.

IMPORTANT — "arv_breakdown" explanation:
Provide an itemized breakdown of how you arrived at the estimated_arv_premium. Each item should include the renovation name, estimated cost, estimated value added to the home, and the ROI percentage. This makes the ARV estimate transparent and auditable. List each project as a separate object in the array.

{
"distress_score": <1-10>,
"primary_indicators": ["<string>", ...],
"hidden_risks": "<string>",
"renovation_strategy": "<Format as two bullet-point sections:\n• UPGRADES ALREADY MADE: List each completed upgrade from the description as a bullet (e.g., • New roof (2024), • Updated kitchen with quartz countertops). If none mentioned, write '• None identified from listing'.\n• SUGGESTED UPGRADES: List each high-ROI renovation opportunity as a bullet with estimated impact (e.g., • Minor kitchen refresh — highest ROI at 113%, • ADU conversion — $2,500/mo rental potential). Focus on actionable, specific items.\nKeep each bullet concise — one line per item.>",
"estimated_arv_premium": <number>,
"arv_breakdown": [{"item": "<renovation name>", "estimated_cost": <number>, "value_add": <number>, "roi_pct": <number>}, ...]
}

MLS Data to Analyze:
${mlsData}`;

export const DISTRESS_SCHEMA = {
    type: 'object',
    properties: {
        distress_score: { type: 'number' },
        primary_indicators: { type: 'array', items: { type: 'string' } },
        hidden_risks: { type: 'string' },
        renovation_strategy: { type: 'string' },
        estimated_arv_premium: { type: 'number' },
        arv_breakdown: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    item: { type: 'string' },
                    estimated_cost: { type: 'number' },
                    value_add: { type: 'number' },
                    roi_pct: { type: 'number' },
                },
                required: ['item', 'estimated_cost', 'value_add', 'roi_pct'],
            },
        },
    },
    required: ['distress_score', 'primary_indicators', 'hidden_risks', 'renovation_strategy', 'estimated_arv_premium', 'arv_breakdown'],
};
