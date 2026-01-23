export const leadReactivationSchema = {
    type: "object",
    properties: {
        summary: {
            type: "object",
            properties: {
                total_leads: { type: "number" },
                markets_detected: { type: "number" },
                high_priority: { type: "number" },
                recommended_daily_volume: { type: "number" },
                primary_strategy: { type: "string" }
            },
            required: ["total_leads", "markets_detected", "high_priority", "recommended_daily_volume", "primary_strategy"]
        },
        global_settings: {
            type: "object",
            properties: {
                default_channel: { type: "string" },
                send_window: { type: "string" },
                timezone: { type: "string" },
                opt_out_text: { type: "string" }
            },
            required: ["default_channel", "send_window", "timezone", "opt_out_text"]
        },
        market_context: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    market_name: { type: "string" },
                    rates_trend: { type: "string", enum: ["rising", "flat", "declining"] },
                    inventory_trend: { type: "string", enum: ["rising", "flat", "declining"] },
                    avg_days_on_market: { type: "string", enum: ["short", "normal", "long"] },
                    buyer_leverage_notes: { type: "string" },
                    confidence: { type: "string", enum: ["high", "medium", "low"] }
                },
                required: ["market_name", "rates_trend", "inventory_trend", "avg_days_on_market", "buyer_leverage_notes", "confidence"]
            }
        },
        lead_plans: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    lead_id: { type: "string" },
                    market: { type: "string" },
                    priority_score: { type: "number" },
                    staleness_reason: { type: "string", enum: ["rates", "inventory", "timing", "life_event", "unknown"] },
                    recommended_channel: { type: "string", enum: ["sms", "email"] },
                    tone: { type: "string", enum: ["low_pressure", "friendly", "professional"] },
                    first_touch: {
                        type: "object",
                        properties: {
                            send_after_days: { type: "number" },
                            message: { type: "string" }
                        },
                        required: ["send_after_days", "message"]
                    },
                    sequence: {
                        type: "object",
                        properties: {
                            enabled: { type: "boolean" },
                            steps: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        day_offset: { type: "number" },
                                        channel: { type: "string", enum: ["sms", "email"] },
                                        message: { type: "string" }
                                    },
                                    required: ["day_offset", "channel", "message"]
                                }
                            }
                        },
                        required: ["enabled", "steps"]
                    }
                },
                required: ["lead_id", "market", "priority_score", "staleness_reason", "recommended_channel", "tone", "first_touch", "sequence"]
            }
        }
    },
    required: ["summary", "global_settings", "market_context", "lead_plans"]
};

export const getLeadReactivationPrompt = (rawData: string) => {
    return `You are an AI operations planner for a real estate lead reactivation platform.

Your task is to analyze an uploaded CSV of stale real estate leads and produce a structured, machine-executable action plan that an automated outreach system can run without human interpretation.

The system supports:
- SMS and Email outreach
- Multi-step sequences
- Lead prioritization
- Market-aware messaging
- Agent tone personalization
- Compliance rules (opt-out, business hours)
- Event tracking (sent, delivered, reply)

DO NOT write explanations.
DO NOT write prose outside message fields.
DO NOT fabricate precise statistics or percentages.
OUTPUT VALID JSON ONLY.

────────────────────────────
INPUT
────────────────────────────
You will receive a CSV file where each row represents a lead.
Leads may belong to DIFFERENT MARKETS (cities, zip codes, or metro areas).

Columns may include:
- lead_id or email or phone (use the best unique identifier)
- name
- phone
- email
- city / area / zip / market
- budget
- lead_source
- last_contact_date
- notes (optional)

Assume all leads are stale (no contact for 60+ days).

────────────────────────────
MARKET SEGMENTATION (CRITICAL)
────────────────────────────
1. Identify the market for EACH lead using the most specific available location field.
2. Group leads by market.
3. Treat EACH market independently.
4. NEVER mix market assumptions across markets.
5. If a lead’s market is ambiguous, classify it as "unknown_market" and apply conservative messaging.

────────────────────────────
MARKET INTELLIGENCE REQUIREMENT
────────────────────────────
For EACH DISTINCT MARKET identified in the CSV, independently gather or conservatively infer current housing market context using public knowledge, regional seasonality, and typical buyer behavior.

For EACH market, derive:
- market_name: string
- rates_trend: rising | flat | declining
- inventory_trend: rising | flat | declining
- avg_days_on_market: short | normal | long
- buyer_leverage_notes: one-sentence explanation
- confidence: high | medium | low

Rules:
- Do NOT fabricate precise numbers.
- If data is weak or uncertain, infer cautiously and set confidence to medium or low.
- Markets with low confidence MUST use softer observational language.

────────────────────────────
GOAL
────────────────────────────
Maximize reply rate and conversation restarts.

For EACH lead:
1. Assign a reactivation priority score (0–1)
2. Infer the most likely reason the lead went cold
3. Choose the optimal outreach channel
4. Generate a compliant first message
5. Decide whether the lead enters a follow-up sequence
6. Schedule timing and tone
7. Ensure messaging references ONLY the lead’s OWN market context

────────────────────────────
PLANNING RULES
────────────────────────────
- Every outbound message MUST reference at least ONE factor from the lead’s own market context
- NEVER reference data from another market
- SMS must be under 240 characters
- No “just checking in”
- No pressure or urgency language
- One clear reason to reply per message
- Use cautious language if market confidence is low
- Send only during business hours
- Include opt-out language once per sequence
- Stop automation immediately upon reply

────────────────────────────
RAW DATA
────────────────────────────
Analyze the property data provided below. 
- Delimiter: Pipe character (|)
- Text Formatting: Commas within cells are part of the data (e.g., in addresses or feature lists).
- Pricing: Handle mixed formats (e.g., $1.2M and 1,200,000) as numerical values.

<raw_data>
${rawData}
</raw_data>

────────────────────────────
OUTPUT FORMAT (STRICT)
────────────────────────────
Return a single JSON object with the specified structure. Ensure market_context is an array of objects.`;
};
