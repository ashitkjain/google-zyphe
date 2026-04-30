# Zyphe AI: Infrastructure & Intelligence Audit

This document provides a comprehensive technical audit of the Zyphe platform's intelligence layer, including Gemini AI models, prompts, triggers, and external API dependencies.

## 1. Core Property Intelligence (Batch Processing)

These pipelines run asynchronously when properties are imported or updated in bulk.

| Prompt / Function | Trigger Logic | Model | Est. Tokens | Primary Files |
| :--- | :--- | :--- | :--- | :--- |
| **Visual AI Analysis** | Analyzes property photos for interior quality, room types, and condition. | gemini-2.5-flash | 15k - 40k | `intelBatch.js`, `prompts/property/propertyImages.ts` |
| **Lifestyle Insights** | Uses Google Search grounding to identify neighborhood vibe and amenities. | gemini-2.5-flash | 40k - 75k | `intelBatch.js`, `prompts/property/lifestyleInsights.ts` |
| **Lifestyle Fit** | Synthesizes lifestyle data against buyer preferences for a compatibility score. | gemini-2.5-flash | 15k - 25k | `intelBatch.js`, `prompts/property/lifestyleFit.ts` |
| **Neighborhood Identity** | Determines neighborhood character and mapping using tract maps and surveyor data. | gemini-2.5-flash | 20k - 30k | `neighborhoodBatch.js`, `prompts/city/neighborhoodAnalysis.ts` |
| **Property Orientation (v30)** | Multi-modal analysis of satellite and street view to determine house facing. | gemini-2.5-flash | 15k - 25k | `orientationBatch.js`, `shared/propertyUtils.js` |
| **Investment Analysis** | Economic breakdown, rental estimates, and micro-market dynamics. | gemini-2.5-flash | 20k - 40k | `intelBatch.js`, `prompts/property/investmentResearch.ts` |
| **Context Graph Extraction** | High-density data extraction (111 factors) for the Buyer DNA graph. | gemini-2.5-flash | 60k - 100k | `geminiService.ts`, `prompts/property/contextGraphExtraction.ts` |
| **Street Insights** | Visual analysis of the streetscape, traffic, and curb appeal from Street View. | gemini-2.5-flash | 12k - 18k | `shared/propertyUtils.js`, `prompts/property/streetInsights.ts` |

## 2. Real-Time & UI Intelligence (On-Demand)

Triggered by user interaction within the platform.

| Tool / Component | Trigger Logic | Intelligence Tier | Est. Tokens | Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **Commute Analysis** | Grounded search for specific destinations and route sentiment. | gemini-2.0-flash-lite | 30k - 50k | `index.js`, `CommuteTab.tsx` |
| **Zyphe Valuation (ARV)** | Normalizes comparables and calculates adjusted market value. | gemini-2.0-flash-lite | 15k - 25k | `PropertyCompsTab.tsx`, `geminiService.ts` |
| **Land Utility / Slope** | Calculates buildable area and topographical constraints. | gemini-2.0-flash-lite | 10k - 15k | `PropertyInvestmentTab.tsx` |
| **Comp Normalization** | Feature-by-feature comparison of subject vs. comp properties. | gemini-2.0-flash-lite | 8k - 12k | `ComparablesTable.tsx` |
| **Lead Transformation** | Transcribes and extracts intent from SMS and voice transcripts. | gemini-2.0-flash-lite | 5k - 10k | `CommunicationHub.tsx` |
| **Interior Room Summary** | Aggregates room-level data into a narrative property overview. | gemini-2.0-flash-lite | 5k - 10k | `PropertyOverviewTab.tsx` |
| **Guide Generation** | Creates custom technical manuals based on user search context. | gemini-2.5-flash | 30k - 60k | `GuidesTab.tsx`, `guideGeneration.ts` |

## 3. External Infrastructure & API Mapping

The foundational data sources that feed the intelligence layers.

| Provider / API | Implementation Path | Role in Pipeline | Core Data Fields |
| :--- | :--- | :--- | :--- |
| **MLS (RapidAPI)** | `propertyBatch.js` | Baseline Source | Price, beds, baths, sqft, description, history |
| **Google Solar API** | `geminiService.ts` | Sustainability | Solar production (kWh), roof geometry, sunshine hrs |
| **Radar Geocoding** | `propertyUtils.js` | Geographic Anchor | Address normalization, lat/lng, map centering |
| **Google Air Quality** | `propertyUtils.js` | Environmental | AQI, pollutants, health recommendations |
| **FEMA National Risk Index** | `propertyUtils.js` | Hazard Risk | Multi-hazard scores (Heat, Wind, Fire, Flood) |
| **FEMA Flood API** | `propertyUtils.js` | Hazard Risk | High-res flood zone mapping |
| **USGS Seismic** | `propertyUtils.js` | Hazard Risk | Earthquake design categories & history |
| **HowLoud Noise** | `functions/proxy` | Environmental | Traffic, airport, and neighborhood noise scores |
| **Google Document AI** | `index.js (Parser)` | Document OCR | Data extraction from listing PDF disclosures |
| **Telnyx (SMS)** | `index.js` | Communication | Real-time SMS ingestion and lead capture |

*   **US Housing Market Data (RapidAPI)**: Fallback source for property history and basic specs. 
    *   *Note: Climate risk data was previously sourced here but has been migrated to free FEMA NRI sources to save $35/mo.*

## 4. Model Specification & Tiers

| Tier | Model | Strategy | Target Latency |
| :--- | :--- | :--- | :--- |
| **Batch High-Perf** | `gemini-2.5-flash` | High-concurrency throughput | < 10s per item |
| **Real-Time Lite** | `gemini-2.0-flash-lite` | Low-cost, fast interaction | < 2s response |
| **Embedding** | `text-embedding-004` | Semantic search & RAG | < 500ms |

## 5. Token Usage & Cost Management

*   **Prompt Caching**: Implemented for `Lifestyle Insights` and `Neighborhood Identity` where context is shared.
*   **Token Truncation**: Inputs capped at 128k for long descriptions; images resized to 1024px before encoding.
*   **Usage Logging**: Every call is tracked via `UsageLogger` to monitor concurrency and daily cost thresholds.
