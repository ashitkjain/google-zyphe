import { APP_CONFIG } from '../../config';
import { logAPICall, updateAPICall } from '../firebase/api_logs';
import { auth } from '../firebase/config';
import { RadarGeocodeResponse } from '../../types';

const RADAR_API_KEY = APP_CONFIG.radar.key;
const MAPS_API_KEY = APP_CONFIG.maps.key;

export const normalizeAddress = async (address: string, zpid?: string): Promise<RadarGeocodeResponse> => {
    const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}`;
    const geocodeLogId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid: zpid,
        address: address,
        api_name: 'Radar',
        endpoint: 'geocode/forward',
        params: { address },
        status: 'pending'
    });
    const start = Date.now();

    const geocodeResponse = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': RADAR_API_KEY,
            'Content-Type': 'application/json',
        },
        cache: 'no-store'
    });

    if (geocodeLogId) {
        updateAPICall(geocodeLogId, {
            status: geocodeResponse.ok ? 'completed' : 'failed',
            response_time_ms: Date.now() - start,
            error: geocodeResponse.ok ? undefined : `Status ${geocodeResponse.status}`
        });
    }
    if (!geocodeResponse.ok) {
        throw new Error(`Radar API error: ${geocodeResponse.status}`);
    }

    const geocodeData = await geocodeResponse.json();

    const results = geocodeData.addresses || [];
    if (results.length === 0) throw new Error('No address found for the provided query.');

    // SMART RESOLUTION: If multiple results, try to match city or zip code mentioned in query
    let selectedResult = results[0];
    const queryLower = address.toLowerCase();
    const zipMatch = address.match(/\b\d{5}\b/);
    const targetZip = zipMatch ? zipMatch[0] : null;

    if (results.length > 1) {
        // 1. Try Zip Match (Strongest Signal)
        if (targetZip) {
            const bestZip = results.find((r: any) => r.postalCode === targetZip);
            if (bestZip) {
                selectedResult = bestZip;
            }
        }

        // 2. Try City Match (Backup Signal)
        if (selectedResult === results[0]) {
            const cityMatch = results.find((r: any) =>
                r.city && queryLower.includes(r.city.toLowerCase())
            );
            if (cityMatch) selectedResult = cityMatch;
        }
    }

    const coordinates = { latitude: selectedResult.latitude, longitude: selectedResult.longitude };
    const formattedAddress = selectedResult.formattedAddress;

    const zoomOutUrl = `https://api.radar.io/maps/static?publishableKey=${RADAR_API_KEY}&center=${coordinates.latitude},${coordinates.longitude}&zoom=15&width=1024&height=1024&style=radar-default-v1&scale=1&markers=color:0x000257%7C${coordinates.latitude},${coordinates.longitude}`;
    const zoomInUrl = `https://api.radar.io/maps/static?publishableKey=${RADAR_API_KEY}&center=${coordinates.latitude},${coordinates.longitude}&zoom=20&width=2048&height=2048&style=radar-default-v1&scale=1&markers=color:0x000257%7C${coordinates.latitude},${coordinates.longitude}`;

    return {
        coordinates,
        formattedAddress,
        components: {
            street: selectedResult.street,
            city: selectedResult.city,
            state: selectedResult.state,
            zipCode: selectedResult.postalCode,
            country: selectedResult.country,
        },
        mapZoomIn: zoomInUrl,
        mapZoomOut: zoomOutUrl
    };
};
