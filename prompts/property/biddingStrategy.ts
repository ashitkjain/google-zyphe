
import { PropertyData } from "../../types";

export const biddingStrategyPrompt = (property: PropertyData) => {
  const address = property.address;
  const price = property.price ? `$${property.price.toLocaleString()}` : "Not listed";
  const zestimate = property.zestimate ? `$${property.zestimate.toLocaleString()}` : "N/A";
  const homeType = property.homeType || "Property";
  const beds = property.bedrooms || "?";
  const baths = property.bathrooms || "?";
  // Dynamic DOM Calculation
  let dom = "Unknown";
  const listedDate = property.listedDate;
  if (listedDate) {
    if (typeof listedDate === 'number' && listedDate < 10000) {
      // Likely already days
      dom = String(listedDate);
    } else {
      const listedTimestamp = typeof listedDate === 'string' ? Date.parse(listedDate) : listedDate;
      if (!isNaN(listedTimestamp)) {
        const diffDays = Math.floor((Date.now() - listedTimestamp) / (1000 * 60 * 60 * 24));
        dom = String(Math.max(0, diffDays));
      }
    }
  }

  if (dom === "Unknown") {
    dom = String(property.timeOnZillow || property.resoFacts?.daysOnZillow || "Unknown");
  }

  // Extended DOM Calculation (True Market Age)
  let extendedDom = dom;
  if (property.priceHistory && property.priceHistory.length > 0) {
    // Find the earliest listing event
    const listingEvents = property.priceHistory
      .filter(item => item.event?.toLowerCase().includes('listed'))
      .sort((a, b) => {
        const dateA = Date.parse(a.date);
        const dateB = Date.parse(b.date);
        return dateA - dateB;
      });

    if (listingEvents.length > 0) {
      const earliestListing = listingEvents[0];
      const earliestTimestamp = Date.parse(earliestListing.date);
      if (!isNaN(earliestTimestamp)) {
        const totalDiffDays = Math.floor((Date.now() - earliestTimestamp) / (1000 * 60 * 60 * 24));
        extendedDom = String(Math.max(0, totalDiffDays));
      }
    }
  }

  // Dynamic Context
  const city = property.city || property.address.split(',')[1]?.trim() || "the local city";
  const currentDate = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Comps Context
  const compsContext = (property.comps && property.comps.length > 0)
    ? `\n\n### [RECENT COMPARABLE SALES] (Grounded Data)\n${property.comps.map(c => `- ${c.address}: Sold $${c.price?.toLocaleString()} ${c.listPrice ? `(List: $${c.listPrice?.toLocaleString()})` : ''} on ${c.lastSoldDate}. DOM: ${c.daysOnMarket || 'N/A'}. PPSF: $${c.pricePerSqFt || 'N/A'}. Specs: ${c.bedrooms}bd/${c.bathrooms}ba, ${c.livingAreaValue}sf, ${c.lotSize || 'N/A'} lot, ${c.garageSpaces || 0} car garage. Status: ${c.status || 'Sold'}. Notes: ${c.description || 'None'}`).join('\n')}`
    : "No comparable sales data available for this specific property.";

  const description = property.description ? `\n\nListing Description Summary: ${property.description.substring(0, 1000)}...` : "";

  // Price History Context
  const priceHistoryContext = (property.priceHistory && property.priceHistory.length > 0)
    ? `\n\n### [TRANSACTIONAL PRICE HISTORY] (Grounded Data)\n${property.priceHistory.map(item => `- ${item.date}: ${item.event} at $${item.price?.toLocaleString() || 'N/A'}`).join('\n')}`
    : "";

  return `[SYSTEM INSTRUCTION] Act as a Real Estate Quantitative Analyst. Your objective is to perform a deep-dive "Grounded Market Analysis" using your integrated Google Search tool, the provided Comparable Sales, and the raw Transactional Price History to access real-time ${currentDate} data.

[USER INPUT] Analyze the property at: **${address}**

**Internal Baseline Data:**
- **Current Listing Price:** ${price}
- **Zestimate:** ${zestimate}
- **MLS Sequence DOM (Current Listing):** ${dom} days
- **Extended DOM (True Market Age):** ${extendedDom} days
- **Context:** (${homeType}, ${beds} beds, ${baths} baths)${description}${compsContext}${priceHistoryContext}

### [STEP 1: DATA RETRIEVAL INSTRUCTIONS]
1. **Listing Search:** Use Google Search to find this property on Redfin, Zillow, and Realtor.com. Confirm/Extract the Current List Price and Total DOM. Use the provided [TRANSACTIONAL PRICE HISTORY] as the primary source for your price_changes analysis and listing_history JSON array.
2. **MLS Offer Velocity Search:** Search for current citywide "Average Offers per Listing" data for ${city} in ${currentDate}. Use sources like Redfin Market Insights, Compass reports, or local Realtor associations.
   - *Self-Correction:* If specific city data is missing, use a conservative baseline for ${city} in early 2026 (typically 3-5 offers for 'fresh' listings in active markets).
3. **Market Benchmarks:** Extract the ZIP code's **Median Days on Market (DOM)** and inventory levels.

### [STEP 2: COMPUTATIONAL METHODOLOGY]
1. **Establish Baseline:** Start with the reported MLS citywide average offers for ${city}.
2. **Apply Velocity Decay Logic (ANCHOR TO EXTENDED DOM):** 
   - Use **${extendedDom} days (Extended DOM)** as the primary anchor for market age.
   - If Extended DOM is **< 14 days**: Use the 100% Baseline (High Velocity).
   - If Property DOM is **15-30 days**: Reduce baseline by 50% (Medium Velocity).
   - If Property DOM is **> 30 days** (or > Zip Median): Reduce baseline to **0-1 active offers** (Low Velocity/Stale).
3. **Inventory Pressure Logic:** Find 'Months of Supply.'
   - **< 3 months:** Categorize as **'Seller Pressure'**.
   - **4-6 months:** Categorize as **'Balanced'**.
   - **> 6 months:** Categorize as **'Buyer Advantage'**.

### [STEP 4: COMPARATIVE MARKET ANALYSIS (CMA) VALUATION]
1. **Analyze Provided Comps:** Calculate the **Average Sold PPSF** of the provided comparable sales.
2. **Subject-Adjusted Valuation:** 
   - Start with the Average Comp PPSF and multiply by the subject's square footage (${property.livingAreaValue}sqft) to get a baseline.
   - Adjust for physical deltas:
     - Add/Subtract $\sim$10k-25k per bedroom/bathroom difference.
     - Adjust for lot size differences if significant.
3. **Determine Market Value:** 
   - Synthesize the Adjusted Baseline with your search results for city-wide market appreciation since the comps sold.
   - This "Subject-Adjusted CMA Value" is your anchor for determining if the property is overpriced (High Leverage) or fair value (Low Leverage).

### [STEP 5: WRITING STYLE & JSON STRUCTURE]
- **MANDATORY:** Use **full, grammatically complete professional sentences**. 
- **SOURCE CITATION:** Explicitly cite sources (e.g., "Compass report," "Redfin Market Insights").
- **COMP_ANALYSIS:** You MUST explicitly reference the provided Comparable Sales in the Leverage Analysis and Discount Strategy sections.
- **OUTPUT:** You MUST respond in strict JSON format using this exact structure:

{
  "property_specifics": {
    "days_on_market": "Property Status: 3-5 sentences comparing ${dom} days (Current Listing) to ${extendedDom} days (True Market Age). Explicitly call out if the house is stale despite a 'new' status due to price history/relisting (<80 words).",
    "listing_history": ["formatted event strings as a JSON array"],
    "price_changes": "3-5 complete sentences summarizing the historical price trajectory (<80 words)."
  },
  "zip_code_benchmarks": {
    "median_days_on_market": "3-5 sentences reporting the cited ZIP Median DOM and how ${dom} days compares to it (<80 words)."
  },
  "inventory_pressure": {
    "months_of_supply": "numeric months",
    "market_category": "Seller Pressure | Balanced | Buyer Advantage",
    "pressure_analysis": "3-5 sentences with CITED SOURCE explaining the inventory categorization logic (<80 words)."
  },
  "offer_velocity": {
    "velocity_status": "High Velocity | Medium Velocity | Low Velocity (Stale)",
    "recent_offer_trends": "Direct MLS Context: 3-5 sentences reporting citywide average offers vs. the predicted offers for this house based on the age-based Velocity Decay math in ${city} for ${currentDate} (<80 words)."
  },
  "negotiation_strategy": {
    "leverage_analysis": "3-5 sentences comparing the subject's specs and list price to the Average comp PPSF and adjusted CMA value to calculate leverage (<80 words).",
    "suggested_offer_tactics": ["detailed tactical recommendations as a JSON array"],
    "calculated_discount_strategy": "Negotiation Gap: 3-5 sentences suggesting a specific offer price or seller credit based on the delta between the $${price} List Price and the calculated Subject-Adjusted CMA Value (<80 words)."
  }
}

[EXECUTION] Ground all results in ${currentDate} data. Use the comps to perform a professional-grade CMA valuation.`;
};
