
/**
 * Application Configuration
 * Centrally manages feature flags and caching behaviors.
 */
export const APP_CONFIG = {
    caching: {
        visual_analysis: true,
        image_quality: true,
        investment_research: true,
    },
    models: {
        flash: 'gemini-2.0-flash',
    },
    roleTabs: {
        buyer: ['interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'pulse', 'image_analysis', 'investment', 'deep_research', 'context_graph'],
        seller: ['image_analysis', 'quality'],
        realtor: ['interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'pulse', 'image_analysis', 'investment', 'quality', 'storage_registry', 'deep_research', 'context_graph'],
        investor: ['deep_research', 'executive_summary', 'interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'pulse', 'image_analysis', 'investment', 'quality', 'storage_registry', 'market_analysis', 'opportunity_discovery', 'industry_research', 'product_market_fit', 'post_close_intelligence', 'technical_papers', 'technical_media', 'context_graph'],
        tester: ['interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'pulse', 'deep_research', 'context_graph'],
    },
    rapidapi: {
        realtyInUsApi: {
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
        },
        zipCodesApi: {
            key: 'ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f',
            host: 'us-zipcodes.p.rapidapi.com',
            endpoint: '/get',
            path: '/codes'
        }
    },
    usHousingApi: {
        key: 'ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f',
        host: 'us-housing-market-data1.p.rapidapi.com'
    },
    radar: {
        key: 'prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb'
    },
    gemini: {
        key: "AIzaSyCNXiqET26-cMRpoM9vttl13SfiA4ifQu4"
    },
    maps: {
        key: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyCQ-OcGRDMK8nGmCMzpuxHT0Y9vJgqajRI"
    },
    groq: {
        key: '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'
    }
};
