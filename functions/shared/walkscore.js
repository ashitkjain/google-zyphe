'use strict';

/**
 * Walk & Transit Score API (RapidAPI)
 */

async function fetchScores(zpid, keys, logger = null) {
    const RAPID_API_KEY = keys.rapidapi_key;
    const RAPID_API_HOST = keys.rapidapi_host || 'us-housing-market-data1.p.rapidapi.com';

    if (!RAPID_API_KEY) return null;

    const url = `https://${RAPID_API_HOST}/walkAndTransitScore?zpid=${zpid}`;
    
    try {
        if (logger) logger.logAPICall('rapidapi', 'walkAndTransitScore', zpid);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-host': RAPID_API_HOST,
                'x-rapidapi-key': RAPID_API_KEY,
            }
        });

        if (!response.ok) return null;
        const data = await response.json();

        return {
            walkScore: data.walkScore?.walkscore || null,
            walkScoreDesc: data.walkScore?.description || null,
            transitScore: data.transitScore?.transit_score || null,
            transitScoreDesc: data.transitScore?.description || null,
            bikeScore: data.bikeScore?.bikescore || null,
            bikeScoreDesc: data.bikeScore?.description || null,
        };
    } catch (e) {
        console.warn(`[WalkScore] Fetch failed for ${zpid}:`, e.message);
        return null;
    }
}

module.exports = {
    fetchScores
};
