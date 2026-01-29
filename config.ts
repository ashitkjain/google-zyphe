
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
        key: "AIzaSyBEPZ14POfqhB2wgfqAsgXkzuVPy2w-l90"
    }
};
