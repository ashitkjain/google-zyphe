
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
        default: 'gemini-2.5-flash',
        bidding_strategy: 'gemini-2.5-flash', // Reverted to Flash as per user request
    },
    roleTabs: {
        buyer: ['interior', 'rooms', 'exterior', 'neighborhood', 'pulse', 'image_analysis', 'investment', 'bidding'],
        seller: ['quality', 'image_analysis'],
        realtor: ['interior', 'rooms', 'exterior', 'neighborhood', 'pulse', 'quality', 'image_analysis', 'investment', 'bidding']
    }
};
