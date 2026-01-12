
import { PropertyData } from "../types";

export const biddingStrategyPrompt = (property: PropertyData) => {
    const address = property.address;
    const currentPrice = property.price ? `$${property.price.toLocaleString()}` : "N/A";
    const zestimate = property.zestimate ? `$${property.zestimate.toLocaleString()}` : "N/A";
    const dom = property.timeOnZillow || property.resoFacts?.daysOnZillow || "N/A";
    const description = property.description || "No description provided.";
    const homeType = property.homeType || "Single Family Home";
    const area = property.livingAreaValue ? `${property.livingAreaValue} sqft` : "N/A";

    return `Act as a Behavioral Economist and Tier-1 Real Estate Negotiator. I am evaluating a property at **${address}**.

### CRITICAL CONTEXT:
- **Listing Price:** ${currentPrice}
- **Zestimate:** ${zestimate}
- **Days on Market (DOM):** ${dom}
- **Property Type:** ${homeType}
- **Size:** ${area}
- **Listing Description Extract:** ${description.substring(0, 500)}...

### YOUR MISSION:
Generate a specialized Bidding Strategy Report specifically optimized for the current January 2026 economic landscape. You must use Google Search to cross-reference hyper-local inventory dynamics.

### SEARCH INSTRUCTIONS:
1. Search for: "${address} listing history" to find previous price drops or "Back on Market" events.
2. Search for: "Real estate inventory months of supply in [ZIP/City/County]" for current January 2026 data.
3. Search for: "Median Sale-to-List ratio [ZIP Code]" to determine if homes are selling above or below asking.

### PROVIDE THE FOLLOWING ANALYSIS:

1. **The 'Negotiation Leverage' Score (1–10):** 
   - 10 = Buyer has total Control (High DOM, stale, price drops, high inventory).
   - 1 = Seller has total Control (Multiple offers, low DOM, extreme scarcity).
   - Explain exactly why you picked this score.

2. **Desperation Detection:** 
   - Analyze the listing description and history for keywords signaling high motivation (e.g., "Motivated," "Relocating," "Estate Sale," "Price Reduced Again").

3. **Macro/Micro Benchmark:**
   - How does this specific property's DOM compare to the 2026 ZIP code average?
   - What is the current 'Months of Supply' for this specific area?

4. **Tiered Bidding Scenarios (Scenario Matrix):**
   - **Scenario A: The 'Low-Ball' Aggressive Bid:** Used if leverage is 7-10. Suggest price and non-contingent terms.
   - **Scenario B: The 'Fair-Market' Balanced Bid:** Used if leverage is 4-6. Best chance of acceptance without overpaying.
   - **Scenario C: The 'Safe-Seal' Defensive Bid:** Used if leverage is 1-3. How to win in a bidding war without a massive price spike (e.g., Escalation Clauses, Fast Close).

5. **Advanced 'Invisible' Terms:**
   - Suggest 3 non-financial concessions (e.g., lease-back options, appraisal gap coverage, inspection 'info only') that would appeal to this specific seller profile.

### JSON RESPONSE FORMAT (STRICT):
{
  "property_specifics": {
    "days_on_market": "string",
    "listing_history": ["string"],
    "price_changes": "string (analysis of drops/history)"
  },
  "zip_code_benchmarks": {
    "median_sale_to_list_ratio": "string",
    "median_days_on_market": "string"
  },
  "inventory_pressure": {
    "months_of_supply": "string",
    "market_category": "Strong Seller | Balanced | Buyer-Friendly",
    "pressure_analysis": "Narrative analysis of current local inventory trends."
  },
  "offer_velocity": {
    "velocity_status": "Calculating leverage score (e.g., Score: 8/10)",
    "recent_offer_trends": "Analysis of how many offers typical neighborhood homes are seeing in early 2026."
  },
  "negotiation_strategy": {
    "leverage_analysis": "Comprehensive report on who holds the cards and why.",
    "suggested_offer_tactics": [
       "Scenario A: [Detailed Price & Terms]",
       "Scenario B: [Detailed Price & Terms]",
       "Scenario C: [Detailed Price & Terms]"
    ],
    "calculated_discount_strategy": "Specific recommendation on price adjustment or seller credits (e.g., 2/1 Rate Buy-down request)."
  }
}`;
};
