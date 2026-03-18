
/**
 * Application Configuration
 * Centrally manages feature flags and caching behaviors.
 */

/**
 * States the tool is currently enabled for.
 * Zip resolution and city dropdowns are filtered to these state codes only.
 */
export const SUPPORTED_STATES: string[] = ['CA'];

/**
 * Maps full state names (lowercase) → abbreviation for SUPPORTED_STATES only.
 * Used to match Firestore keys like "California" against SUPPORTED_STATES ['CA'].
 */
export const STATE_NAME_MAP: Record<string, string> = {
    'california': 'CA',
};

export const APP_CONFIG = {
    caching: {
        visual_analysis: true,
        image_quality: true,
        investment_research: true,
    },
    models: {
        flash: 'gemini-2.0-flash',
        flashLite: 'gemini-2.5-flash-preview-05-20',
    },
    roleTabs: {
        buyer: ['interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'schools', 'satellitary', 'pulse', 'city_neighborhoods', 'image_analysis', 'investment', 'deep_research', 'context_graph'],
        seller: ['image_analysis', 'quality'],
        realtor: ['interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'schools', 'satellitary', 'pulse', 'city_neighborhoods', 'image_analysis', 'investment', 'quality', 'storage_registry', 'deep_research', 'context_graph'],
        investor: ['deep_research', 'executive_summary', 'interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'schools', 'satellitary', 'pulse', 'city_neighborhoods', 'image_analysis', 'investment', 'quality', 'storage_registry', 'market_analysis', 'opportunity_discovery', 'industry_research', 'product_market_fit', 'post_close_intelligence', 'technical_papers', 'technical_media', 'context_graph'],
        auditor: ['interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'schools', 'satellitary', 'pulse', 'city_neighborhoods', 'deep_research', 'context_graph'],
        admin: ['interior', 'rooms', 'exterior_and_neighborhood', 'neighborhood', 'schools', 'satellitary', 'pulse', 'city_neighborhoods', 'image_analysis', 'investment', 'quality', 'deep_research', 'context_graph'],
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
        key: (import.meta as any).env?.VITE_GROQ_API_KEY || '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'
    },
    howLoud: {
        // Free tier: 2,500 req/mo — https://howloud.com/developers
        key: (import.meta as any).env?.VITE_HOWLOUD_API_KEY || 'JsFtv3UqoZ2kI6qwB0JmA6TAKmor9pZ741M0VyZc'
    },
    rentcast: {
        key: '38f6f00236fc4a14b6d462cf97c611d6',
        baseUrl: 'https://api.rentcast.io/v1'
    },
    foursquare: {
        key: (import.meta as any).env?.VITE_FOURSQUARE_API_KEY || 'fsq3_placeholder_key'
    }
};
