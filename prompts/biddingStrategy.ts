
import { PropertyData } from "../types";

export const biddingStrategyPrompt = (property: PropertyData) => {
    const address = property.address;
    const currentPrice = property.price ? `$${property.price.toLocaleString()}` : "Contact for Price";
    const zestimate = property.zestimate ? `$${property.zestimate.toLocaleString()}` : "N/A";
    const daysOnZillow = property.timeOnZillow || property.resoFacts?.daysOnZillow || "N/A";

    return `Act as a Data-Driven Real Estate Consultant. I am evaluating a property at **${address}** and need a Bidding Strategy Report based on current January 2026 market data.

Contextual Data provided to you:
- Listed Price: ${currentPrice}
- Zestimate: ${zestimate}
- Days on Zillow (from cache): ${daysOnZillow}

Please search for and provide the following:
1. **Property Specifics:** What is the current 'Days on Market' (DOM) for this exact listing? List any price changes, listing pauses, or previous 'pending' statuses that fell through.
2. **ZIP Code Benchmarks:** Search for current market trends in this specific ZIP code. What is the **Median Sale-to-List Ratio** and the **Median Days on Market** for this area?
3. **Inventory Pressure:** Find the current 'Months of Supply' for this city or county. Categorize the market as 'Strong Seller,' 'Balanced,' or 'Buyer-Friendly' based on whether the supply is below 3 months, 4–6 months, or above 6 months.
4. **Offer Velocity:** Based on recent local news or market reports from late 2025/early 2026, how many offers are 'hot' homes in this neighborhood currently receiving?
5. **The Negotiation Gap:** Compare the property's DOM to the ZIP code's median. If the property is 'stale' (older than the median), suggest a calculated discount or seller credit strategy (e.g., mortgage rate buy-down) I should use in my offer.

You MUST respond in strict JSON format.

{
  "property_specifics": {
    "days_on_market": "string",
    "listing_history": ["string"],
    "price_changes": "string"
  },
  "zip_code_benchmarks": {
    "median_sale_to_list_ratio": "string",
    "median_days_on_market": "string"
  },
  "inventory_pressure": {
    "months_of_supply": "string",
    "market_category": "Strong Seller | Balanced | Buyer-Friendly",
    "pressure_analysis": "string"
  },
  "offer_velocity": {
    "velocity_status": "string",
    "recent_offer_trends": "string"
  },
  "negotiation_strategy": {
    "leverage_analysis": "string",
    "suggested_offer_tactics": ["string"],
    "calculated_discount_strategy": "string"
  }
}`;
};
