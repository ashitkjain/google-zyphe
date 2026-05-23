
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
        // Switched to gemini-2.5-flash as requested by user.
        // Higher tiers and concurrency available in 2.5 series.
        flash: 'gemini-2.5-flash',
        flashLite: 'gemini-2.5-flash-lite',
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
            key: (import.meta as any).env?.VITE_RAPIDAPI_KEY || process.env.VITE_RAPIDAPI_KEY || '',
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
            key: (import.meta as any).env?.VITE_RAPIDAPI_KEY || process.env.VITE_RAPIDAPI_KEY || '',
            host: 'us-zipcodes.p.rapidapi.com',
            endpoint: '/get',
            path: '/codes'
        }
    },
    usHousingApi: {
        key: (import.meta as any).env?.VITE_RAPIDAPI_KEY || process.env.VITE_RAPIDAPI_KEY || '',
        host: 'us-housing-market-data1.p.rapidapi.com'
    },
    realEstateApi: {
        key: (import.meta as any).env?.VITE_REALESTATEAPI_KEY || process.env.VITE_REALESTATEAPI_KEY || '',
        baseUrl: (import.meta as any).env?.DEV ? '/realestateapi-proxy/v2' : 'https://api.realestateapi.com/v2',
    },
    radar: {
        key: (import.meta as any).env?.VITE_RADAR_KEY || process.env.VITE_RADAR_KEY || ''
    },
    gemini: {
        key: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ""
    },
    maps: {
        key: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || ""
    },
    groq: {
        key: (import.meta as any).env?.VITE_GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || ''
    },
    howLoud: {
        key: (import.meta as any).env?.VITE_HOWLOUD_API_KEY || process.env.VITE_HOWLOUD_API_KEY || ''
    },
    rentcast: {
        key: (import.meta as any).env?.VITE_RENTCAST_KEY || process.env.VITE_RENTCAST_KEY || '',
        baseUrl: 'https://api.rentcast.io/v1'
    },
    foursquare: {
        key: (import.meta as any).env?.VITE_FOURSQUARE_API_KEY || process.env.VITE_FOURSQUARE_API_KEY || ''
    },
    tomorrow: {
        key: (import.meta as any).env?.VITE_TOMORROW_API_KEY || process.env.VITE_TOMORROW_API_KEY || ''
    },
    concierge: {
        zoomRoomId: '82485671234' // Placeholder Zoom Meeting ID
    }
};
