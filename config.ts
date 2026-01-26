
/**
 * Application Configuration
 * Centrally manages feature flags and caching behaviors.
 */
export const APP_CONFIG = {
    caching: {
        visual_analysis: true,
        image_quality: true,
        investment_research: true,
        bidding_strategy: false, // Explicitly disabled as per user request
    },
    models: {
        default: 'gemini-2.0-flash',
        bidding_strategy: 'gemini-2.0-flash', // Reverted to Flash as per user request
    },
    roleTabs: {
        buyer: ['interior', 'rooms', 'exterior', 'neighborhood', 'pulse', 'investment', 'bidding'],
        seller: ['quality'],
        realtor: ['interior', 'rooms', 'exterior', 'neighborhood', 'pulse', 'quality', 'investment', 'bidding']
    }
};
