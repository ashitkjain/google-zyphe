export const leadReactivationSchema = {
    type: "object",
    properties: {
        market_baseline: {
            type: "object",
            properties: {
                rate_environment: { type: "string" },
                inventory_outlook: { type: "string" }
            },
            required: ["rate_environment", "inventory_outlook"]
        },
        segments: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    segment_name: { type: "string" },
                    reasons_for_stale: { type: "string" },
                    optimal_hook: { type: "string" },
                    cadence: {
                        type: "object",
                        properties: {
                            day_1_sms: { type: "string" },
                            day_4_email: { type: "string" }
                        },
                        required: ["day_1_sms", "day_4_email"]
                    }
                },
                required: ["segment_name", "reasons_for_stale", "optimal_hook", "cadence"]
            }
        }
    },
    required: ["market_baseline", "segments"]
};

export const getLeadReactivationPrompt = (rawData: string) => {
    return `System Role: You are a Real Estate Data Scientist and Senior Growth Strategist.

Step 1: Market Calibration (January 2026)
Before analyzing the leads, synthesize the current housing market climate for early 2026. Focus specifically on:
Mortgage Rates: The shift from the 2024/25 highs to the current 2026 "stable" rates.
Inventory Levels: Current national and regional trends (Buyer vs. Seller leverage).
Consumer Sentiment: The "Great Housing Reset" and why buyers are re-entering now.

Step 2: Lead Data Analysis
Analyze the provided raw spreadsheet data. Use the Market Calibration from Step 1 to determine why each lead went stale and which "market shift" (e.g., lower rates, more inventory) is most likely to bring them back.

Step 3: Output Strategy
Create a structured reactivation plan. If a Zip Code or City is available, make the templates hyper-local by referencing local inventory or price stability.

Raw Lead Data:
<raw_data>
${rawData}
</raw_data>

Constraint: Return ONLY a valid JSON object with the specified structure.`;
};
