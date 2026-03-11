import { Type } from "@google/genai";
import { PropertyData } from "../../types";

export const getDeepInvestmentResearchPrompt = (property: PropertyData) => `
  # Institutional Deep Investment Research
  Location: ${property.city}, ${property.state} (USA)
  
  ## Research Objective
  Synthesize a high-fidelity investment thesis for residential real estate in this specific market. Focus on data-driven insights that a sophisticated investor would require to deploy capital.
  
  ## Required Analysis Modules:
  1. **Macroeconomic Indicators**: Institutional focus on Innovation Corridors, major regional employers (e.g. Biotech, Life Sciences), and Return-to-Office (RTO) impact on the local economy.
  2. **Real Estate Market Dynamics**: Quantitative snapshot including Median Price, Price per Square Foot benchmarks, Months of Supply, and Days on Market (DOM) velocity. Mention "Seller Discretionary Concessions".
  3. **Value-Add Strategy (The Alpha)**: Specific focus on Accessory Dwelling Unit (ADU) intensification and cosmetic rehabilitation potential.
  4. **School Intelligence**: Arbitrage between algorithmic ratings (GreatSchools) and actual academic proficiency/matriculation performance.
  5. **Local Risks & Insurance**: The insurability crisis (FAIR Plan), specific environmental zones (Dam Inundation, High Fire Severity), and regulatory growth caps.
  6. **Regional Grid**: Comparative analysis with exactly 3-4 neighboring or competing markets (e.g. for Pleasanton, compare Dublin, San Ramon, Livermore).
  7. **Investment Scenarios**: Explicitly model the "Base Case" (Soft Landing), "Bear Case" (Stagflation), and "Bull Case" (AI/Innovation Boom).
  8. **Financial Pro-Forma**: A detailed numerical P&L for a representative single-family asset (Gross Income, Taxes, Insurance, Maintenance, Management, NOI, and Cap Rate).
  
  ## Output Constraint:
  You MUST return a JSON object with a "structured_report" field matching the specified schema. 
  
  CRITICAL - CONTENT FIELD:
  The "content" field MUST contain the full high-fidelity Markdown memorandum (at least 1500 words). 
  - Start with "## Executive Summary" as a markdown H2 heading (NOT "Executive Summary & Leading Paragraph").
  - Immediately follow with 3-5 key bullet points summarizing the investment thesis. Do NOT include a trailing summary paragraph after the bullet points.
  - Then proceed with detailed analysis sections using ## headings, and end with Sources. 
  
  CRITICAL - SOURCE MAPPING:
  In the "citations" field of the structured report, you MUST provide a mapping for every [cite: N] used in the content. Include the "id" (e.g. "1"), "name" (e.g. "NAR 2024 Market Report"), and "url" if available.
  
  CRITICAL - STRUCTURED DATA:
  For Market Dynamics: Provide TWO series: "Median Price" (USD) and "Days on Market" (days) in the chart_data field.
  Use institutional terminology: "Negative Leverage", "Flight to Quality", "Information Asymmetry", "Cap Rate Compression".
`;

export const deepInvestmentResearchSchema = {
  type: Type.OBJECT,
  properties: {
    content: {
      type: Type.STRING,
      description: "Full institutional memorandum (Markdown)."
    },
    structured_report: {
      type: Type.OBJECT,
      properties: {
        macroeconomic_indicators: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            details: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_hint: { type: Type.STRING },
            chart_data: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                metric1: { type: Type.STRING },
                points: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.NUMBER }
                    },
                    required: ["label", "value"]
                  }
                }
              },
              required: ["title", "metric1", "points"]
            }
          },
          required: ["summary", "details", "visual_hint"]
        },
        market_dynamics: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            details: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_hint: { type: Type.STRING },
            chart_data: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                metric1: { type: Type.STRING },
                metric2: { type: Type.STRING },
                points: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      value: { type: Type.NUMBER },
                      value2: { type: Type.NUMBER }
                    },
                    required: ["label", "value", "value2"]
                  }
                }
              },
              required: ["title", "metric1", "metric2", "points"]
            }
          },
          required: ["summary", "details", "visual_hint", "chart_data"]
        },
        pro_forma: {
          type: Type.OBJECT,
          properties: {
            purchase_price: { type: Type.NUMBER },
            gross_rent: { type: Type.NUMBER },
            expenses: {
              type: Type.OBJECT,
              properties: {
                property_tax: { type: Type.NUMBER },
                insurance: { type: Type.NUMBER },
                maintenance: { type: Type.NUMBER },
                management: { type: Type.NUMBER },
                vacancy: { type: Type.NUMBER }
              },
              required: ["property_tax", "insurance", "maintenance", "management", "vacancy"]
            },
            noi: { type: Type.NUMBER },
            cap_rate: { type: Type.NUMBER }
          },
          required: ["purchase_price", "gross_rent", "expenses", "noi", "cap_rate"]
        },
        value_add_strategies: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              est_cost: { type: Type.STRING },
              est_incremental_rent: { type: Type.STRING }
            },
            required: ["name", "description", "est_cost", "est_incremental_rent"]
          }
        },
        school_intelligence: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            rating_vs_performance_gap: { type: Type.STRING },
            proficiency_metrics: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "rating_vs_performance_gap", "proficiency_metrics"]
        },
        comparative_analysis: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              market: { type: Type.STRING },
              median_price: { type: Type.STRING },
              inventory_age: { type: Type.STRING },
              school_quality: { type: Type.STRING },
              primary_draw: { type: Type.STRING }
            },
            required: ["market", "median_price", "inventory_age", "school_quality", "primary_draw"]
          }
        },
        investment_outlook: {
          type: Type.OBJECT,
          properties: {
            short_term: { type: Type.STRING },
            long_term: { type: Type.STRING }
          },
          required: ["short_term", "long_term"]
        },
        local_risks: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            risk_factors: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_hint: { type: Type.STRING }
          },
          required: ["summary", "risk_factors"]
        },
        citations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              url: { type: Type.STRING }
            },
            required: ["id", "name"]
          }
        }
      },
      required: ["macroeconomic_indicators", "market_dynamics", "local_risks"],
    },
  },
  required: ["content", "structured_report"],
};
