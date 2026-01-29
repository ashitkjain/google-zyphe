
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
        seller: ['image_analysis', 'quality'],
        realtor: ['interior', 'rooms', 'exterior', 'neighborhood', 'pulse', 'image_analysis', 'investment', 'bidding', 'quality']
    },
    rapidapi: {
        key: 'ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f',
        host: 'realty-in-us.p.rapidapi.com',
        endpoints: {
            list: '/properties/v3/list',
            autoComplete: '/locations/v2/auto-complete'
        },
        defaults: {
            limit: 200,
            offset: 0,
            status: ["for_sale", "ready_to_build"],
            sort: {
                direction: "desc",
                field: "list_date"
            }
        }
    }
};
