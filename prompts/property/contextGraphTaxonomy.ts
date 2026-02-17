/**
 * Context Graph Taxonomy Prompt
 *
 * Sends all city-level + property-level analysis data to Gemini Deep Research
 * and asks it to analyze the data and propose a context graph taxonomy
 * (nodes and edges) optimized for buyer search and property recommendations.
 *
 * Usage:
 *   1. Export city data via scripts/exportCityData.ts → JSON blob
 *   2. Paste into Gemini Deep Research along with this prompt
 *   3. Receive proposed taxonomy → iterate → codify into types/contextGraph.ts
 */

export const getContextGraphTaxonomyPrompt = (cityName: string, stateName: string) => `
# MISSION

You are a Knowledge Graph Architect. I am giving you the complete property intelligence dataset for **${cityName}, ${stateName}** from our real estate platform. This dataset contains multi-layered analysis across many dimensions — from AI-driven visual analysis of property photos, to investment research, community sentiment, climate risk, solar potential, and more.

Your task: **Study this data thoroughly, then design a Context Graph Taxonomy (Nodes and Edges) that would power buyer search and property recommendations.**

---

# ABOUT THE DATA

The attached JSON contains real, production data organized at two levels:

## City-Level Data (shared across all properties in ${cityName})
- **Community Pulse** — AI-synthesized resident sentiment from web sources: what people like about the city, common complaints, safety concerns, school opinions, lifestyle convenience, and investment outlook. Each section includes a summary, bullet points, and source URLs.
- **General Market Intelligence** — Market dynamics (appreciation trends, projected growth, days on market), competitor gaps (friction points, praised amenities), regulatory/zoning landscape, upcoming developments, and demand drivers (events with dates and impact).
- **Deep Investment Research** — Institutional-grade analysis including macroeconomic indicators, market dynamics with historical chart data, local risk factors, investment outlook (short/long term), financial pro forma (purchase price, gross rent, expenses breakdown, NOI, cap rate), value-add strategies (ADU, rehab with costs and incremental rent), school intelligence (rating vs. performance gaps), and comparative analysis vs. neighboring markets.
- **Zip Code Listings** — Active property listings per zip code with location, price, and descriptions.

## Property-Level Data (per analyzed property)
- **Core MLS Data** — Address, city, state, zip, home type, bedrooms, bathrooms, sqft, lot size, year built, price, Zestimate, rent Zestimate, tax rate, insurance, description, days on market, listing date.
- **Detailed Facts (ResoFacts)** — Flooring, foundation, room types, exterior features, architectural style, garage capacity, lot features, roof, construction materials, fireplace, appliances, fencing, cooling, heating, laundry, utilities, sewer, water source, basement, security features, windows.
- **Visual AI Analysis (from property photos)** — Overall interior analysis (design style with reasoning, color/materials palette, lighting quality, spatial flow, staging assessment, condition/finish level). Room-by-room highlights with name, floor, description, and improvement suggestions. Exterior analysis (architecture, curb appeal, backyard/patio, views, privacy).
- **Neighborhood Analysis (from satellite/street imagery)** — Overview, street layout & traffic, sidewalks, proximity to greenery/water, density, topography, development patterns, nearby amenities, home orientation relative to street.
- **Street View Analysis** — Curb appeal score (1-10), architectural style, neighborhood vibe description, visual clutter flag, garden description, safety assessment, privacy rating, maintenance risks, solar obstructions, parking logistics, family safety, utility aesthetic.
- **Image Quality Analysis** — Overall quality score, top photos identified, lighting/color rating, staging/clutter rating, composition rating, delete-worthy photos, and action plan (priority actions, editing suggestions, reshoot recommendations).
- **Climate & Environmental** — Wind risk (0-10), flood risk (0-10), fire risk (0-10), heat risk (0-10), air quality (AQI, category, dominant pollutant, individual pollutant concentrations, health recommendations), pollen (score, category, dominant type, seasonal analysis).
- **Solar Data** — Max sunshine hours/year, panel capacity watts, estimated production (panel count, system capacity kW, annual kWh, carbon offset tons), whole roof stats (area, sunshine quantiles).
- **Walk/Transit/Bike Scores** — Numeric scores with descriptive labels for walkability, transit access, and bikeability.
- **Schools** — Nearby schools with name, level (Elementary/Middle/High), rating (1-10), and distance.
- **Investment Analysis (property-specific)** — Short-term rental performance (occupancy rate, ADR, annual revenue), long-term rental analysis (monthly rent, vacancy rate, comparison).
- **Bidding Strategy** — Days on market context, listing history, price changes, zip code median DOM, inventory pressure (months of supply, market category), offer velocity, negotiation leverage, suggested tactics, calculated discount strategy.
- **Comparable Sales** — Nearby recently sold properties with address, price, beds/baths, sqft, year built, distance, DOM, price per sqft, last sold price/date, HOA.
- **Price History** — Historical price events (listings, sales, price changes) with dates.
- **Comprehensive Analysis** — Strategic summary combining all data: visual appeal, privacy/layout assessment, outdoor quality, location rating, community pulse synthesis, climate resilience, and overall risks.

---

# WHAT I NEED FROM YOU

## 1. Deep Data Analysis

First, thoroughly examine every field, every nested object, and every array in the attached data. Identify:
- What **entities** naturally emerge (properties, neighborhoods, schools, markets, risks, etc.)
- What **relationships** exist between entities (a property is located in a neighborhood, is zoned for a school, has comparable sales, faces climate risks, etc.)
- What **attributes** are most meaningful for discriminating between properties from a buyer's perspective
- What **derived/computed values** would be valuable but aren't in the raw data (e.g., composite scores, relative rankings, similarity metrics)

## 2. Proposed Context Graph Taxonomy

Based on your analysis, propose a complete graph taxonomy:

### Nodes
For each node type, provide:
- **Name** — e.g., \`Property\`, \`Neighborhood\`, \`School\`
- **Description** — what this node represents and why it matters for buyer search
- **Core Properties** — which fields from the data map to this node (use exact field paths from the JSON)
- **Derived Properties** — computed values that should be materialized on the node
- **Example Instance** — one concrete example from the Pleasanton data

### Edges
For each edge type, provide:
- **Name** — e.g., \`LOCATED_IN\`, \`COMPARABLE_TO\`
- **Source → Target** — which node types this connects
- **Description** — what relationship this captures and why it matters
- **Properties** — attributes on the edge itself (e.g., distance, similarity score, strength)
- **How to compute** — how to determine if this edge exists between two nodes, using the data

### Tag / Label System
Propose a system of **semantic tags** that can be applied to Property nodes to enable faceted search. These should be human-readable labels extracted or inferred from the data. Group them into logical dimensions.

For example (this is just inspiration, propose your own based on what you see in the data):
- A property might be tagged: \`[Chef's Kitchen, Open-Concept, Sun-Drenched, Turn-Key, Low Fire Risk, GreatSchools 9+, STR-Viable]\`
- A buyer could search: "Show me turn-key homes with chef's kitchens near top-rated schools with low climate risk"

## 3. Search & Recommendation Queries

Show 15+ natural-language queries that this graph would enable, categorized by buyer persona:
- **First-time buyer** — budget-conscious, school-focused
- **Move-up buyer** — lifestyle upgrade, space, premium finishes
- **Investor** — yield-focused, value-add, STR potential
- **Relocating professional** — commute, walkability, neighborhood vibe
- **Downsizer/retiree** — single-story, low maintenance, walkable

For each query, sketch the graph traversal (which nodes and edges are touched).

## 4. Data Quality Assessment

As you analyze the data, note:
- **Rich areas** — where the data is exceptionally detailed and graph-ready
- **Sparse areas** — where data is shallow or missing for key decisions
- **Redundancy** — where the same insight appears in multiple places
- **Priority additions** — what data sources should be added next, ranked by impact on buyer search quality

---

# OUTPUT FORMAT

Structure your response as a comprehensive Markdown document:

\`\`\`
## 1. Data Analysis Summary
[Your observations about the data — what's rich, what's sparse, what patterns you see]

## 2. Node Catalog
### NODE: [Name]
- Description: ...
- Core Properties: field_path_1, field_path_2, ...
- Derived Properties: computed_field_1 (formula), ...
- Example: ...
[Repeat for each node type]

## 3. Edge Catalog
### EDGE: [NAME]
- [Source] → [Target]
- Description: ...
- Properties: ...
- Computation: ...
[Repeat for each edge type]

## 4. Tag / Label System
### Dimension: [Name]
| Tag | Extracted From | Logic |
|-----|---------------|-------|
| ... | ... | ... |
[Repeat for each dimension]

## 5. Search & Recommendation Queries
### Persona: [Name]
1. "query text" → traversal: Property --EDGE--> Node --EDGE--> Node
[Repeat]

## 6. Data Quality & Roadmap
| Priority | Gap | Impact | Suggested Source |
|----------|-----|--------|------------------|
| ... | ... | ... | ... |
\`\`\`

---

# IMPORTANT NOTES

- **Be data-driven, not theoretical.** Every node, edge, and tag you propose must be grounded in fields you can actually see in the attached JSON. If you propose something aspirational (not in the data), explicitly flag it as "FUTURE" with a suggested data source.
- **Think like a buyer.** The graph exists to help someone find their next home. Every design decision should pass the test: "Would a buyer ever search or filter by this?"
- **Optimize for recommendations.** Beyond search, this graph should power: "If you liked Property A, you'll love Property B" — so think about what makes two properties similar or complementary.
- **Be exhaustive.** Don't stop at the obvious nodes (Property, City). Think about nodes for specific concepts like Investment Scenarios, Risk Profiles, Lifestyle Clusters, and Market Trends that a buyer implicitly cares about.
`;
