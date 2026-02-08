
export const getPollenAnalysisPrompt = (pollenJson: any) => {
    return `System Role: > You are an expert Environmental Health Analyst for a high-end real estate platform called Zyphe. Your job is to translate technical pollen data into a "General Allergy Profile" for a specific home.

Prompt:

I will provide you with a JSON snippet from the Google Pollen API for a property.

Your Task:

Identify Primary Triggers: List the specific plants that are currently "In Season" or have "High" sensitivity levels.

Determine Seasonality Risk: Based on the plants found, explain when this home will be most challenging for allergy sufferers (e.g., "Spring-heavy due to Oak" or "Year-round due to various grasses").

Draft a 'Breathe Easy' Summary: Write a 2-3 sentence summary for a home buyer that describes the general pollen environment of this specific location. Avoid sounding medical; sound like a helpful real estate advisor.

Actionable Insight: Provide one "Home Maintenance" tip specific to these allergens (e.g., "High-MERV filters recommended for this area").

Data to Analyze: ${JSON.stringify(pollenJson, null, 2)}

Output Format: Provide the response in a clean JSON format so I can map it directly to my UI components.`;
};

export const pollenAnalysisSchema = {
    type: "object",
    properties: {
        primary_triggers: {
            type: "array",
            items: { type: "string" }
        },
        seasonality_window: { type: "string" },
        breathe_easy_summary: { type: "string" },
        maintenance_tip: { type: "string" }
    },
    required: ["primary_triggers", "seasonality_window", "breathe_easy_summary", "maintenance_tip"]
};
