'use strict';

const POLLEN_ANALYSIS_SCHEMA = {
    type: 'object',
    properties: {
        primary_triggers:      { type: 'array', items: { type: 'string' }, description: 'Plants currently in season or at high sensitivity' },
        seasonality_risk:      { type: 'string', description: 'When this home will be most challenging for allergy sufferers' },
        breathe_easy_summary:  { type: 'string', description: '2-3 sentence summary of the pollen environment for a home buyer' },
        actionable_insight:    { type: 'string', description: 'One home maintenance tip specific to these allergens' },
    },
    required: ['breathe_easy_summary', 'seasonality_risk', 'primary_triggers', 'actionable_insight'],
};

function getPollenAnalysisPrompt(pollenJson) {
    return `You are an Environmental Health Analyst for a real estate platform. Translate this pollen data into a general allergy profile for a home buyer.

Instructions:
- primary_triggers: list plants currently "In Season" or at "High" sensitivity
- seasonality_risk: explain when this home is most challenging for allergy sufferers (e.g. "Spring-heavy due to Oak")
- breathe_easy_summary: 2-3 sentences describing the pollen environment — helpful real estate advisor tone, not medical
- actionable_insight: one home maintenance tip specific to these allergens (e.g. "High-MERV filters recommended")

Pollen data:
${JSON.stringify(pollenJson, null, 2)}`;
}

module.exports = { getPollenAnalysisPrompt, POLLEN_ANALYSIS_SCHEMA };
