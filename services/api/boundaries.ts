const boundaryCache: Record<string, any> = {};

/**
 * Fetch city/locality boundary GeoJSON from OpenStreetMap Nominatim
 */
export async function fetchCityBoundary(city: string, state: string = 'California'): Promise<any | null> {
    const cacheKey = `${city}-${state}`.toLowerCase();
    if (boundaryCache[cacheKey]) {
        return boundaryCache[cacheKey];
    }

    try {
        // Using 'q' instead of 'city' is often more robust for various locality types
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ', ' + state)}&format=json&polygon_geojson=1&limit=1`;
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Zyphe-Real-Estate-App' // Nominatim requires a user agent
            }
        });

        if (!response.ok) throw new Error('Boundary fetch failed');
        
        const data = await response.json();
        
        if (data && data.length > 0 && data[0].geojson) {
            const result = {
                type: 'Feature',
                geometry: data[0].geojson,
                properties: {
                    name: city,
                    displayName: data[0].display_name
                },
                bbox: data[0].boundingbox // [south, north, west, east]
            };
            
            boundaryCache[cacheKey] = result;
            return result;
        }
        
        return null;
    } catch (error) {
        console.error('Error fetching city boundary:', error);
        return null;
    }
}
