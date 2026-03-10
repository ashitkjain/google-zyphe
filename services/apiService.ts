
import { PropertyData, RadarGeocodeResponse, PropertyComp } from "../types";
import { savePropertyToCloud, getPropertyFromCloud, getUserProfile } from "./firebaseService";
import { APP_CONFIG } from "../config";
import { logAPICall, updateAPICall } from "./firebase/api_logs";
import { auth } from "./firebase/config";
import { getGoogleDataFromCloud, saveGoogleDataToCloud } from "./firebaseService";
import { analyzeStreetView, analyzePollen } from "./geminiService";
import { calculateSolarPotential } from "../utils/solarCalculations";
import { fetchResoPropertyData } from "./resoService";

const RAPID_API_KEY = APP_CONFIG.usHousingApi.key;
const RAPID_API_HOST = APP_CONFIG.usHousingApi.host;
const RADAR_API_KEY = APP_CONFIG.radar.key;
const MAPS_API_KEY = APP_CONFIG.maps.key;
const FOURSQUARE_API_KEY = APP_CONFIG.foursquare.key;

// In-memory deduplication for concurrent requests
const ongoingRequests = new Map<string, Promise<any>>();

const extractNumericValue = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    if (cleaned === '') return null;
    const numeric = Number(cleaned);
    return isNaN(numeric) ? null : numeric;
  }
  if (val && typeof val === 'object' && 'value' in val) {
    const cleaned = String(val.value).replace(/[^0-9.-]/g, '');
    if (cleaned === '') return null;
    const numeric = Number(cleaned);
    return isNaN(numeric) ? null : numeric;
  }
  return null;
};

/**
 * Centralized formatting logic for property addresses.
 * Reconciles different schemas from Radar, Zillow, RESO, and manual search feeds.
 */
export const formatAddress = (addr: any): string => {
  if (typeof addr === 'string') {
    // If it's a numeric ID (ZPID), it's not a valid display address string
    if (/^\d+$/.test(addr)) return "";
    return addr;
  }

  if (addr && typeof addr === 'object') {
    // Collect all possible address component keys from various providers
    const {
      streetAddress, line,
      city,
      state, state_code, stateCode,
      zipcode, zipCode, postal_code
    } = addr;

    const street = streetAddress || line || "";
    const resolvedCity = city || "";
    const resolvedState = state || state_code || stateCode || "";
    const resolvedZip = zipcode || zipCode || postal_code || "";

    // GUARD: If the street field already contains city/state/zip info
    // (common in Zillow responses), just return it as-is to avoid duplication
    // like "4152 Kevin St, Dublin, CA 94568, dublin, California, 94568"
    if (street && resolvedCity) {
      const streetLower = street.toLowerCase();
      if (streetLower.includes(resolvedCity.toLowerCase())) {
        return street; // Already contains city info, return as-is
      }
    }

    const parts = [street, resolvedCity, resolvedState, resolvedZip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : "";
  }
  return "";
};

const safeStringify = (val: any): string | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    if (val.length > 0 && typeof val[0] === 'object') {
      return JSON.stringify(val);
    }
    return val.map(item => (typeof item === 'object' ? JSON.stringify(item) : item)).join(', ');
  }
  if (typeof val === 'object') {
    if ('label' in val) return String(val.label);
    if ('text' in val) return String(val.text);
    return JSON.stringify(val);
  }
  return String(val);
};

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
  if (results.length === 0) throw new Error("No address found for the provided query.");

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

export const fetchScores = async (zpid: string): Promise<{
  walkScore?: number, walkScoreDesc?: string,
  transitScore?: number, transitScoreDesc?: string,
  bikeScore?: number, bikeScoreDesc?: string
}> => {
  const cacheKey = `scores-${zpid}`;
  if (ongoingRequests.has(cacheKey)) return ongoingRequests.get(cacheKey)!;

  const url = `https://${RAPID_API_HOST}/walkAndTransitScore?zpid=${zpid}`;
  const promise = (async () => {
    try {
      const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid: zpid,
        api_name: 'RapidAPI',
        endpoint: 'walkAndTransitScore',
        params: { zpid },
        status: 'pending'
      });
      const start = Date.now();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': RAPID_API_HOST,
          'x-rapidapi-key': RAPID_API_KEY,
        },
        cache: 'no-store'
      });

      if (logId) {
        updateAPICall(logId, {
          status: response.ok ? 'completed' : 'failed',
          response_time_ms: Date.now() - start,
          error: response.ok ? undefined : `Status ${response.status}`
        });
      }

      if (!response.ok) return {};
      const data = await response.json();

      return {
        walkScore: extractNumericValue(data.walkScore?.walkscore),
        walkScoreDesc: data.walkScore?.description,
        transitScore: extractNumericValue(data.transitScore?.transit_score),
        transitScoreDesc: data.transitScore?.description,
        bikeScore: extractNumericValue(data.bikeScore?.bikescore),
        bikeScoreDesc: data.bikeScore?.description,
      };
    } catch (e) {
      console.error("Failed to fetch walk/transit scores", e);
      return {};
    }
  })();

  ongoingRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    ongoingRequests.delete(cacheKey);
  }
};

export const fetchPropertyComps = async (zpid: string): Promise<PropertyComp[]> => {
  const cacheKey = `comps-${zpid}`;
  if (ongoingRequests.has(cacheKey)) return ongoingRequests.get(cacheKey)!;

  const url = `https://${RAPID_API_HOST}/propertyComps?zpid=${zpid}`;
  const promise = (async () => {
    try {
      const logId = await logAPICall({
        user_id: auth?.currentUser?.uid || 'unknown',
        zpid: zpid,
        api_name: 'RapidAPI',
        endpoint: 'propertyComps',
        params: { zpid },
        status: 'pending'
      });
      const start = Date.now();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': RAPID_API_HOST,
          'x-rapidapi-key': RAPID_API_KEY,
        },
        cache: 'no-store'
      });
      if (logId) {
        updateAPICall(logId, {
          status: response.ok ? 'completed' : 'failed',
          response_time_ms: Date.now() - start,
          error: response.ok ? undefined : `Status ${response.status}`
        });
      }

      if (!response.ok) return [];
      const data = await response.json();

      let comps: any[] = [];
      if (Array.isArray(data)) comps = data;
      else if (data.comps && Array.isArray(data.comps)) comps = data.comps;
      else if (data.props?.comps && Array.isArray(data.props.comps)) comps = data.props.comps;

      return comps.map((c: any) => {
        const price = extractNumericValue(c.price);
        const livingArea = extractNumericValue(c.livingAreaValue || c.livingArea);
        const ppsf = price > 0 && livingArea > 0 ? Math.round(price / livingArea) : undefined;

        return {
          zpid: String(c.zpid),
          address: formatAddress(c.address),
          price: price,
          listPrice: extractNumericValue(c.listPrice || c.originalPrice),
          bedrooms: extractNumericValue(c.bedrooms),
          bathrooms: extractNumericValue(c.bathrooms),
          livingAreaValue: livingArea,
          yearBuilt: extractNumericValue(c.yearBuilt),
          distance: extractNumericValue(c.distance),
          daysOnMarket: extractNumericValue(c.daysOnMarket || c.daysOnZillow),
          status: c.homeStatus || c.statusText || c.status,
          images: Array.isArray(c.images) ? c.images : [c.imgSrc].filter(Boolean),
          homeType: c.homeType,
          lastSoldPrice: extractNumericValue(c.lastSoldPrice || c.last_sold_price),
          lastSoldDate: c.lastSoldDate || c.last_sold_date,
          lotAreaValue: extractNumericValue(c.lotAreaValue),
          lotAreaUnit: c.lotAreaUnit,
          lotSize: c.lotAreaValue ? `${c.lotAreaValue} ${c.lotAreaUnit || 'sqft'}` : undefined,
          garageSpaces: extractNumericValue(c.garageSpaces),
          pricePerSqFt: ppsf,
          description: c.description || c.hsh_notes,
          hoaFees: extractNumericValue(c.hoaFee || c.monthlyHoaFee)
        };
      }).slice(0, 6);
    } catch (e) {
      console.error("Failed to fetch property comps", e);
      return [];
    }
  })();

  ongoingRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    ongoingRequests.delete(cacheKey);
  }
};

export const fetchPropertyImages = async (zpid: string, retries = 3): Promise<string[]> => {
  const cacheKey = `images-${zpid}`;
  if (ongoingRequests.has(cacheKey)) return ongoingRequests.get(cacheKey)!;

  const promise = (async () => {
    // Hybrid Logic: Try RESO first if keys exist
    const uid = auth?.currentUser?.uid;
    if (uid) {
      const profile = await getUserProfile(uid);
      const resoConfig = profile?.realtor?.resoConfig;
      if (resoConfig) {
        try {
          const resoData = await fetchResoPropertyData(resoConfig, zpid, true);
          if (resoData && resoData.images && resoData.images.length > 0) {
            console.log("[fetchPropertyImages] RESO Image Success:", zpid);
            return resoData.images;
          }
        } catch (e) {
          console.warn("[RESO] Image fetch failed, falling back:", e);
        }
      }
    }

    const url = `https://${RAPID_API_HOST}/images?zpid=${zpid}`;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const logId = await logAPICall({
          user_id: auth?.currentUser?.uid || 'unknown',
          zpid: zpid,
          api_name: 'RapidAPI',
          endpoint: 'images',
          params: { zpid, attempt },
          status: 'pending'
        });
        const start = Date.now();

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPID_API_HOST,
            'x-rapidapi-key': RAPID_API_KEY,
          },
          cache: 'no-store'
        });

        if (logId) {
          updateAPICall(logId, {
            status: response.ok ? 'completed' : 'failed',
            response_time_ms: Date.now() - start,
            error: response.ok ? undefined : `Status ${response.status}`
          });
        }

        if (!response.ok) {
          if (response.status === 429 && attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          throw new Error(`Images API Error: ${response.status}`);
        }

        const data = await response.json();

        let images: any[] = [];
        if (Array.isArray(data)) images = data;
        else if (data.images && Array.isArray(data.images)) images = data.images;
        else if (data.props?.images && Array.isArray(data.props.images)) images = data.props.images;
        else if (data.property?.images && Array.isArray(data.property.images)) images = data.property.images;
        else if (data.photos && Array.isArray(data.photos)) images = data.photos;
        else if (data.props?.photos && Array.isArray(data.props.photos)) images = data.props.photos;
        else if (data.property?.photos && Array.isArray(data.property.photos)) images = data.property.photos;

        return images.map((img: any) => {
          if (typeof img === 'string') return img;
          if (typeof img === 'object' && img !== null) {
            return img.url || img.uri || img.src || img.href || JSON.stringify(img);
          }
          return String(img);
        }).filter(img => typeof img === 'string' && img.startsWith('http'));

      } catch (e) {
        if (attempt === retries) {
          console.error(`Final attempt to fetch images failed for ZPID ${zpid}:`, e);
          return [];
        }
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }
    return [];
  })();

  ongoingRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    ongoingRequests.delete(cacheKey);
  }
};

export const fetchSolarData = async (lat: number, lng: number, zpid?: string, address?: string): Promise<any> => {
  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${MAPS_API_KEY}`;

  const logId = await logAPICall({
    user_id: auth?.currentUser?.uid || 'unknown',
    zpid,
    address,
    api_name: 'Google Solar',
    endpoint: 'findClosest',
    params: { lat, lng },
    status: 'pending'
  });
  const start = Date.now();

  try {
    const response = await fetch(url);

    if (logId) {
      updateAPICall(logId, {
        status: response.ok ? 'completed' : 'failed',
        response_time_ms: Date.now() - start,
        error: response.ok ? undefined : `Status ${response.status}`
      });
    }

    if (!response.ok) {
      console.warn(`[Solar API] Error or no data for this location: ${response.status}`);
      return null;
    }
    const data = await response.json();
    if (!data.solarPotential) return null;

    // We explicitly only extract the high-level metrics and a LEAN version of the panel data.
    // solarPanels and solarPanelConfigs arrays can be multiple MBs.
    // We only keep the yearlyEnergyDcKwh for each panel to allow accurate calculations.
    const {
      maxSunshineHoursPerYear,
      carbonOffsetFactorKgPerMwh,
      wholeRoofStats,
      panelCapacityWatts,
      solarPanels
    } = data.solarPotential;

    const solarDataLean = {
      maxSunshineHoursPerYear,
      carbonOffsetFactorKgPerMwh,
      panelCapacityWatts,
      solarPanels: (solarPanels || []).map((p: any) => ({
        yearlyEnergyDcKwh: p.yearlyEnergyDcKwh
      })),
      wholeRoofStats
    };

    const production = calculateSolarPotential(solarDataLean);

    return {
      maxSunshineHoursPerYear,
      carbonOffsetFactorKgPerMwh,
      estimatedSolarProduction: production,
      wholeRoofStats: wholeRoofStats ? {
        areaMeters2: wholeRoofStats.areaMeters2,
        sunshineQuantiles: wholeRoofStats.sunshineQuantiles,
        groundAreaMeters2: wholeRoofStats.groundAreaMeters2
      } : undefined
    };
  } catch (e) {
    console.error("Failed to fetch solar data", e);
    return null;
  }
};

export const fetchAirQuality = async (lat: number, lng: number, zpid?: string, address?: string): Promise<any> => {
  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${MAPS_API_KEY}`;

  const logId = await logAPICall({
    user_id: auth?.currentUser?.uid || 'unknown',
    zpid,
    address,
    api_name: 'Google AirQuality',
    endpoint: 'lookup',
    params: { lat, lng },
    status: 'pending'
  });
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location: {
          latitude: lat,
          longitude: lng
        },
        extraComputations: [
          "HEALTH_RECOMMENDATIONS",
          "DOMINANT_POLLUTANT_CONCENTRATION",
          "POLLUTANT_CONCENTRATION"
        ],
        languageCode: "en"
      })
    });

    if (logId) {
      updateAPICall(logId, {
        status: response.ok ? 'completed' : 'failed',
        response_time_ms: Date.now() - start,
        error: response.ok ? undefined : `Status ${response.status}`
      });
    }

    if (!response.ok) {
      console.warn(`[Air Quality API] Error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log("[Air Quality API] Successful response:", data);

    const uaqi = data.indexes?.find((idx: any) => idx.code === "uaqi") || data.indexes?.[0];

    return {
      aqi: uaqi?.aqi,
      category: uaqi?.category,
      dominantPollutant: data.dominantPollutant,
      recommendations: {
        general: data.healthRecommendations?.generalPopulation,
        sensitiveGroups: data.healthRecommendations?.sensitiveGroups
      },
      pollutants: data.pollutants?.map((p: any) => ({
        name: p.code,
        fullName: p.displayName,
        concentration: p.concentration?.value,
        unit: p.concentration?.units
      }))
    };
  } catch (e) {
    console.error("Failed to fetch air quality data", e);
    return null;
  }
};

export const fetchPollenData = async (lat: number, lng: number, zpid?: string, address?: string): Promise<any> => {
  const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${MAPS_API_KEY}&location.latitude=${lat}&location.longitude=${lng}&days=1`;

  const logId = await logAPICall({
    user_id: auth?.currentUser?.uid || 'unknown',
    zpid,
    address,
    api_name: 'Google Pollen',
    endpoint: 'lookup',
    params: { lat, lng },
    status: 'pending'
  });
  const start = Date.now();

  try {
    const response = await fetch(url);

    if (logId) {
      updateAPICall(logId, {
        status: response.ok ? 'completed' : 'failed',
        response_time_ms: Date.now() - start,
        error: response.ok ? undefined : `Status ${response.status}`
      });
    }

    if (!response.ok) {
      console.warn(`[Pollen API] Error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('[Pollen API] Successful response:', data);

    const today = data.dailyInfo?.[0];
    if (!today) return null;

    const maxPollen = today.pollenTypeInfo?.reduce((prev: any, current: any) => {
      return (prev.indexInfo?.value || 0) > (current.indexInfo?.value || 0) ? prev : current;
    });

    return {
      score: maxPollen?.indexInfo?.value,
      category: maxPollen?.indexInfo?.category,
      description: maxPollen?.indexInfo?.indexDescription,
      dominantPollenType: maxPollen?.displayName,
      pollenTypeInfo: today.pollenTypeInfo,
      plantInfo: today.plantInfo
    };

  } catch (e) {
    console.error('Failed to fetch pollen data', e);
    return null;
  }
};

// ─── Noise Score (HowLoud SoundScore) ────────────────────────────────────────
// Free tier: 2,500 req/mo — https://howloud.com/developers
// Response: { status:"OK", result:[{ score, scoretext, traffic, traffictext, local, localtext, airports, airportstext }] }
export const fetchNoiseScore = async (
  lat: number,
  lng: number,
  zpid?: string,
  address?: string
): Promise<{
  score: number | null;
  description: string | null;
  trafficScore: number | null;
  trafficDesc: string | null;
  localScore: number | null;
  localDesc: string | null;
  airportScore: number | null;
  airportDesc: string | null;
} | null> => {
  const logId = await logAPICall({
    user_id: auth?.currentUser?.uid || 'unknown',
    zpid,
    address,
    api_name: 'HowLoud',
    endpoint: 'score',
    params: { lat, lng },
    status: 'pending'
  });
  const start = Date.now();

  try {
    // HowLoud blocks CORS — route through Cloud Function proxy (onRequest with explicit CORS headers).
    const { auth: firebaseAuth } = await import('./firebase/config');
    const idToken = firebaseAuth?.currentUser
      ? await firebaseAuth.currentUser.getIdToken()
      : null;

    if (!idToken) {
      console.warn('[HowLoud] No auth token available — skipping noise score.');
      return null;
    }

    const proxyUrl = 'https://us-central1-zyphe-af0bf.cloudfunctions.net/proxyNoiseScore';
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ lat, lng }),
    });

    const data = await response.json();

    if (logId) {
      updateAPICall(logId, { status: 'completed', response_time_ms: Date.now() - start });
    }

    // HowLoud response: { status:"OK", result:[{ score, scoretext, traffic, traffictext, local, localtext, airports, airportstext }] }
    // result is an ARRAY — use index [0]
    if (data?.status !== 'OK' || !Array.isArray(data?.result) || data.result.length === 0) {
      console.warn('[HowLoud] Unexpected response:', data);
      return null;
    }

    const row = data.result[0];
    return {
      score: extractNumericValue(row.score ?? null),
      description: row.scoretext ?? null,
      trafficScore: extractNumericValue(row.traffic ?? null),
      trafficDesc: row.traffictext ?? null,
      localScore: extractNumericValue(row.local ?? null),
      localDesc: row.localtext ?? null,
      airportScore: extractNumericValue(row.airports ?? null),
      airportDesc: row.airportstext ?? null,
    };
  } catch (e: any) {
    if (logId) {
      updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: e.message });
    }
    console.error('[HowLoud] Failed to fetch noise score via proxy:', e);
    return null;
  }

};



// ─── Neighborhood Places (Google Places API — Nearby Search) ─────────────────
// Uses the new Places API with field masking (Basic SKU: $32/1K requests).
// Returns grouped amenity counts and top venues for neighborhood context.
export interface NearbyPlace {
  name: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryTypeDisplayName?: string;
  priceLevel?: string;
  googleMapsUri?: string;
  distanceMeters?: number;
  isAiExtracted?: boolean;
  source?: 'google' | 'foursquare';
}

export interface NeighborhoodCategorySet {
  dining: NearbyPlace[];
  shopping: NearbyPlace[];
  parks: NearbyPlace[];
  transit: NearbyPlace[];
  fitness: NearbyPlace[];
  schools: NearbyPlace[];
  medical?: NearbyPlace[];
  community?: NearbyPlace[];
  others?: NearbyPlace[];
}

export interface NeighborhoodPlaces extends NeighborhoodCategorySet {
  walkable: NeighborhoodCategorySet;
  drivable: NeighborhoodCategorySet;
  fetchedAt: number;
  sources?: string[];
  isUnified?: boolean;
}

const PLACE_CATEGORY_QUERIES: {
  key: keyof Omit<NeighborhoodPlaces, 'fetchedAt'>;
  types: string[];
  radius: number
}[] = [
    { key: 'dining', types: ['restaurant', 'cafe', 'bakery'], radius: 1500 },
    { key: 'shopping', types: ['shopping_mall', 'supermarket', 'grocery_store'], radius: 5000 },
    { key: 'parks', types: ['park', 'playground', 'hiking_area'], radius: 5000 },
    { key: 'transit', types: ['transit_station', 'parking', 'electric_vehicle_charging_station'], radius: 5000 },
    { key: 'fitness', types: ['gym'], radius: 5000 },
    { key: 'schools', types: ['school', 'primary_school'], radius: 3000 },
    { key: 'medical', types: ['hospital'], radius: 5000 },
    { key: 'community', types: ['library', 'police', 'fire_station', 'bank'], radius: 5000 },
    { key: 'others', types: ['stadium', 'night_club', 'liquor_store'], radius: 5000 },
  ];


const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const fetchNearbyPlaces = async (
  lat: number,
  lng: number,
  zpid?: string,
  address?: string,
  existingData?: NeighborhoodPlaces | null,
  forceRefresh: boolean = false
): Promise<NeighborhoodPlaces | null> => {
  const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';
  const FIELD_MASK = 'places.displayName,places.types,places.rating,places.userRatingCount,places.priceLevel,places.googleMapsUri,places.primaryTypeDisplayName,places.location';

  const logId = await logAPICall({
    user_id: auth?.currentUser?.uid || 'unknown',
    zpid,
    address,
    api_name: 'Dual-Mode Google Places (Walk/Drive)',
    endpoint: 'searchNearby',
    params: { lat, lng },
    status: 'pending'
  });
  const start = Date.now();

  try {
    const [walkRes, driveRes] = await Promise.all([
      // 1. Walkable POIs: Primary focus on proximity
      fetch(PLACES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': MAPS_API_KEY!,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: [
            "cafe", "bakery", "restaurant", "park", "playground",
            "hiking_area", "school", "primary_school", "library",
            "gym", "grocery_store", "bank"
          ],
          maxResultCount: 20,
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lng }, radius: 1500.0 }
          },
          rankPreference: "DISTANCE"
        })
      }).catch(() => null),

      // 2. Drivable POIs: Focus on major amenities and infrastructure
      fetch(PLACES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': MAPS_API_KEY!,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes: [
            "supermarket", "shopping_mall", "hospital", "police",
            "fire_station", "transit_station", "parking", "electric_vehicle_charging_station",
            "stadium", "night_club", "liquor_store"
          ],
          maxResultCount: 20,
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lng }, radius: 5000.0 }
          }
        })
      }).catch(() => null)
    ]);

    const processPlaces = async (res: Response | null) => {
      if (!res || !res.ok) return [];
      const data = await res.json();
      return (data.places || []).map((p: any) => ({
        name: p.displayName?.text || 'Unknown',
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        types: p.types || [],
        primaryTypeDisplayName: p.primaryTypeDisplayName?.text,
        priceLevel: p.priceLevel,
        googleMapsUri: p.googleMapsUri,
        source: 'google',
        location: p.location,
        distanceMeters: p.location ? calculateHaversineDistance(lat, lng, p.location.latitude, p.location.longitude) : undefined
      }));
    };

    const walkPlaces = await processPlaces(walkRes as Response);
    const drivePlacesRaw = await processPlaces(driveRes as Response);

    // Deduplicate: If it's in walk, remove from drive
    const walkNames = new Set(walkPlaces.map(p => p.name.toLowerCase().trim()));
    const drivePlaces = drivePlacesRaw.filter(p => !walkNames.has(p.name.toLowerCase().trim()));

    // Consolidate raw data for the bucketing logic (top-level union)
    const rawGooglePlaces: NearbyPlace[] = [...walkPlaces, ...drivePlaces];

    const createCategorySet = (places: NearbyPlace[]): NeighborhoodCategorySet => {
      const set: NeighborhoodCategorySet = {
        dining: [], shopping: [], parks: [], transit: [], fitness: [], schools: [],
        medical: [], community: [], others: []
      };

      const seenGlobal = new Set<string>(); // Prevent same place in multiple categories

      // Match specific categories first
      PLACE_CATEGORY_QUERIES.filter(q => q.key !== 'others').forEach(({ key, types, radius }) => {
        const bucket: NearbyPlace[] = [];
        places.forEach(p => {
          const normalized = p.name.toLowerCase().trim();
          if (seenGlobal.has(normalized)) return;

          const isWithinRadius = (p.distanceMeters || 0) <= radius;
          if (!isWithinRadius) return;

          const pTypes = (p.types || []).map(t => t.toLowerCase());
          const matchesGoogle = types.some(t => pTypes.includes(t.toLowerCase())) ||
            (key === 'community' && pTypes.includes('establishment') && (p.name.toLowerCase().includes('church') || p.name.toLowerCase().includes('hall')));

          if (matchesGoogle) {
            seenGlobal.add(normalized);
            bucket.push(p);
          }
        });
        (set as any)[key] = bucket.slice(0, 15);
      });

      // Catch-all for 'others' (things not matched above)
      const othersBucket: NearbyPlace[] = [];
      places.forEach(p => {
        const normalized = p.name.toLowerCase().trim();
        if (seenGlobal.has(normalized)) return;

        const othersQuery = PLACE_CATEGORY_QUERIES.find(q => q.key === 'others');
        const radius = othersQuery?.radius || 5000;
        if ((p.distanceMeters || 0) <= radius) {
          seenGlobal.add(normalized);
          othersBucket.push(p);
        }
      });
      set.others = othersBucket.slice(0, 15);

      return set;
    };

    const result: NeighborhoodPlaces = {
      ...createCategorySet(rawGooglePlaces),
      walkable: createCategorySet(walkPlaces),
      drivable: createCategorySet(drivePlaces),
      fetchedAt: Date.now(),
      sources: ["google"],
      isUnified: true
    };

    if (logId) {
      updateAPICall(logId, { status: 'completed', response_time_ms: Date.now() - start });
    }

    return result;
  } catch (e: any) {
    if (logId) {
      updateAPICall(logId, { status: 'failed', response_time_ms: Date.now() - start, error: e.message });
    }
    console.error('[Places API] Failed to fetch nearby places:', e);
    return null;
  }
};


export const fetchPropertyDataFull = async (addressOrZpid: string, isZpid: boolean = false, forceEnvironment: boolean = false, onStep?: (step: string) => void, skipImages: boolean = false): Promise<PropertyData> => {
  const cacheKey = `data-full-${addressOrZpid}`;
  // if (ongoingRequests.has(cacheKey)) return ongoingRequests.get(cacheKey)!;

  const promise = (async () => {
    let mappedData: PropertyData | null = null;

    if (isZpid) {
      const cached = await getPropertyFromCloud(addressOrZpid);
      if (cached) {
        mappedData = cached;
        console.log("[fetchPropertyDataFull] Found cached property data for ZPID:", addressOrZpid);
      }
    }

    if (!mappedData) {
      // Hybrid Ingest Logic: Try RESO Web API first if the user (Realtor) has provided keys
      const uid = auth?.currentUser?.uid;
      if (uid) {
        const profile = await getUserProfile(uid);
        const resoConfig = profile?.realtor?.resoConfig;

        if (resoConfig) {
          onStep?.('Accessing RESO Web API...');
          try {
            const resoData = await fetchResoPropertyData(resoConfig, addressOrZpid, isZpid);
            if (resoData) {
              console.log("[fetchPropertyDataFull] RESO API Success:", addressOrZpid);
              mappedData = resoData;
            }
          } catch (e) {
            console.warn("[RESO] Fetch failed, falling back to legacy ingest:", e);
          }
        }
      }
    }

    if (!mappedData) {
      const url = isZpid
        ? `https://${RAPID_API_HOST}/property?zpid=${addressOrZpid}`
        : `https://${RAPID_API_HOST}/property?address=${encodeURIComponent(addressOrZpid)}`;

      let response;
      let retries = 3;
      for (let attempt = 1; attempt <= retries; attempt++) {
        onStep?.(`Fetching property facts... ${attempt > 1 ? `(Retry ${attempt - 1})` : ''}`);

        const logId = await logAPICall({
          user_id: auth?.currentUser?.uid || 'unknown',
          zpid: isZpid ? addressOrZpid : undefined,
          address: isZpid ? undefined : addressOrZpid,
          api_name: 'RapidAPI',
          endpoint: 'property',
          params: { addressOrZpid, isZpid, attempt },
          status: 'pending'
        });
        const start = Date.now();

        response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': RAPID_API_HOST,
            'x-rapidapi-key': RAPID_API_KEY,
          },
          cache: 'no-store'
        });

        if (logId) {
          updateAPICall(logId, {
            status: response.ok ? 'completed' : 'failed',
            response_time_ms: Date.now() - start,
            error: response.ok ? undefined : `Status ${response.status}`
          });
        }

        if (response.ok) break;

        if (response.status === 429 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[API] Rate limit (429) hit on attempt ${attempt}. Retrying in ${delay / 1000}s...`);
          onStep?.(`Rate limit hit. Retrying in ${delay / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw new Error(`Property API error: ${response.status}`);
      }

      if (!response || !response.ok) throw new Error(`Property API error: ${response?.status || 'Unknown'}`);
      const data = await response.json();

      // Universal ZPID extraction: Check root, property wrapper, or props wrapper
      const rawZpid = data.zpid || data.property?.zpid || data.props?.zpid;
      const zpidStr = rawZpid ? String(rawZpid) : undefined;

      if (!zpidStr) {
        console.warn("API Warning: Response missing 'zpid'. Proceeding with limited data.", JSON.stringify(data, null, 2));
      }

      if (!isZpid && zpidStr) {
        const cached = await getPropertyFromCloud(zpidStr);
        if (cached) {
          mappedData = cached;
          console.log("[fetchPropertyDataFull] Found cached property data for found ZPID:", zpidStr);
        }
      }

      if (!mappedData) {
        const root = data.property || data.props || data;
        const addrRoot = root.address || data.address;

        mappedData = {
          address: formatAddress(addrRoot) || (isZpid ? "" : addressOrZpid),
          city: (addrRoot && typeof addrRoot === 'object') ? addrRoot.city : undefined,
          state: (addrRoot && typeof addrRoot === 'object') ? addrRoot.state : undefined,
          zipCode: (addrRoot && typeof addrRoot === 'object') ? (addrRoot.zipcode || addrRoot.zipCode) : undefined,
          zpid: zpidStr,
          homeStatus: root.homeStatus,
          homeType: root.homeType,
          listingSubType: root.listingSubType ?? null,
          livingAreaValue: extractNumericValue(root.livingAreaValue || root.livingArea),
          bedrooms: extractNumericValue(root.bedrooms),
          bathrooms: extractNumericValue(root.bathrooms),
          yearBuilt: extractNumericValue(root.yearBuilt),
          lotSize: safeStringify(root.resoFacts?.lotSize || root.lotSize) || "N/A",
          price: extractNumericValue(root.price || root.listPrice),
          zestimate: extractNumericValue(root.zestimate),
          rentZestimate: extractNumericValue(root.rentZestimate),
          annualHomeownersInsurance: extractNumericValue(root.annualHomeownersInsurance),
          windRiskScore: extractNumericValue(root.climate?.windSources?.primary?.riskScore),
          floodRiskScore: extractNumericValue(root.climate?.floodSources?.primary?.riskScore),
          fireRiskScore: extractNumericValue(root.climate?.fireSources?.primary?.riskScore),
          heatRiskScore: extractNumericValue(root.climate?.heatRiskScore),
          description: root.description || "No description available.",
          images: Array.isArray(root.images) ? root.images : (Array.isArray(root.photos) ? root.photos : []),
          schools: Array.isArray(root.schools) ? root.schools : [],
          listedDate: root.datePosted || null,
          priceHistory: (Array.isArray(root.priceHistory) ? root.priceHistory : []).map((item: any) => ({
            date: item.date || "N/A",
            price: extractNumericValue(item.price),
            event: item.event || "Price Change"
          })),
          resoFacts: {
            flooring: safeStringify(root.resoFacts?.flooring),
            foundationDetails: safeStringify(root.resoFacts?.foundationDetails),
            rooms: safeStringify(root.resoFacts?.rooms),
            roomTypes: safeStringify(root.resoFacts?.roomTypes),
            feesAndDues: safeStringify(root.resoFacts?.feesAndDues),
            exteriorFeatures: safeStringify(root.resoFacts?.exteriorFeatures),
            architecturalStyle: safeStringify(root.resoFacts?.architecturalStyle),
            garageParkingCapacity: extractNumericValue(root.resoFacts?.garageParkingCapacity),
            lotFeatures: safeStringify(root.resoFacts?.lotFeatures),
            roofType: safeStringify(root.resoFacts?.roofType),
            daysOnZillow: extractNumericValue(root.daysOnZillow || root.resoFacts?.daysOnZillow),
            constructionMaterials: safeStringify(root.resoFacts?.constructionMaterials),
            fireplaceFeatures: safeStringify(root.resoFacts?.fireplaceFeatures),
            appliances: safeStringify(root.resoFacts?.appliances),
            fencing: safeStringify(root.resoFacts?.fencing),
            cooling: safeStringify(root.resoFacts?.cooling),
            laundryFeatures: safeStringify(root.resoFacts?.laundryFeatures),
            heating: safeStringify(root.resoFacts?.heating),
            basement: safeStringify(root.resoFacts?.basement),
            utilities: safeStringify(root.resoFacts?.utilities),
            sewer: safeStringify(root.resoFacts?.sewer),
            waterSource: safeStringify(root.resoFacts?.waterSource),
            securityFeatures: safeStringify(root.resoFacts?.securityFeatures),
            windowFeatures: safeStringify(root.resoFacts?.windowFeatures),
            roomFeatures: safeStringify(root.resoFacts?.roomFeatures),
          }, // end resoFacts
          // ─── HOA / Association ─────────────────────────────────────────────
          hoa: (() => {
            const rf = root.resoFacts;
            if (!rf) return undefined;
            // Primary source: associations array (richest data)
            const assoc = Array.isArray(rf.associations) && rf.associations.length > 0
              ? rf.associations[0]
              : null;
            const name = assoc?.name || rf.associationName || undefined;
            const fee = assoc?.feeFrequency || rf.associationFee || undefined;
            const phone = assoc?.phone || rf.associationPhone || undefined;
            const amenities: string[] = Array.isArray(rf.associationAmenities) ? rf.associationAmenities.filter(Boolean) : [];
            const feeIncludes: string[] = Array.isArray(rf.associationFeeIncludes) ? rf.associationFeeIncludes.filter(Boolean) : [];
            if (!name && !fee && amenities.length === 0) return undefined;
            return { name, fee, phone, amenities, feeIncludes };
          })(),
          coordinates: root.longitude && root.latitude ? { latitude: root.latitude, longitude: root.longitude } : undefined,
          attribution: root.attributionInfo || data.attributionInfo ? {
            listingAgentName: (root.attributionInfo || data.attributionInfo)?.agentName,
            listingAgentNumber: data.attributionInfo?.agentPhoneNumber || data.props?.attributionInfo?.agentPhoneNumber,
            brokerageName: data.attributionInfo?.brokerageName || data.props?.attributionInfo?.brokerageName,
            mlsName: data.attributionInfo?.mlsName || data.props?.attributionInfo?.mlsName,
            mlsId: data.attributionInfo?.mlsId || data.props?.attributionInfo?.mlsId,
          } : undefined
        }; // End of mappedData assignment
      } // End of (!mappedData) block - API Fetching
    }

    // At this point, mappedData is populated either from Cache or API.
    // Now we proceed to augment it with environmental data if needed.
    if (!mappedData) {
      throw new Error("Failed to resolve property data.");
    }

    // Ensure fallback coordinate geocoding runs if needed (even for cached data if they are missing)
    if ((!mappedData.coordinates || !mappedData.mapZoomOut) && mappedData.address) {
      try {
        console.log("[Solar Fallback] Geocoding address for solar data...");
        const geocoded = await normalizeAddress(mappedData.address, mappedData.zpid);
        if (geocoded.coordinates) {
          mappedData.coordinates = geocoded.coordinates;
          mappedData.mapZoomIn = geocoded.mapZoomIn;
          mappedData.mapZoomOut = geocoded.mapZoomOut;
          // NOTE: We intentionally do NOT overwrite mappedData.address here.
          // The address identity is resolved upstream (in App.tsx performSearch).
          // Overwriting it here caused city-flipping bugs (e.g., Dublin → Pleasanton)
          // because Radar's geocoder may return a neighboring city as its top result.
        }
      } catch (e) {
        console.warn("[Solar Fallback] Failed to geocode address:", e);
      }
    }

    if (mappedData.zpid) {
      onStep?.("Loading property data...");

      // Parallelise all independent data fetches so round-trips overlap.
      const needsImages = !skipImages && (!mappedData.images || mappedData.images.length === 0);
      const storageKeyForEnv = mappedData.zpid || (mappedData.address ? mappedData.address.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined);
      const coordsForPlaces = mappedData.coordinates;

      // Cache guard for Google Places: skip if already fetched within 30 days.
      // neighborhoodPlaces is now stored in google_environmental_data (not the properties doc).
      // We pre-fetch the env doc here so we can check the TTL and reuse it as cachedEnvEarly.
      const envDocForPlaces = storageKeyForEnv ? await getGoogleDataFromCloud(storageKeyForEnv).catch(() => null) : null;
      const cachedPlaces = (envDocForPlaces as any)?.neighborhoodPlaces as NeighborhoodPlaces | undefined;
      const placesCachedAt = cachedPlaces?.fetchedAt;
      const placesFresh = placesCachedAt && (Date.now() - placesCachedAt) < 30 * 24 * 60 * 60 * 1000; // 30 days

      // TRIGGER LOGIC: 
      // 1. Missing data? Fetch.
      // 2. Stale data (>30d)? Fetch.
      // 3. User forced refresh? Fetch.
      // 4. Legacy Data (Missing Foursquare integration flag)? Fetch.
      const needsPlacesFetch = coordsForPlaces && (!placesFresh || forceEnvironment || !cachedPlaces?.isUnified);

      const [scores, images, comps, nearbyPlaces] = await Promise.all([
        fetchScores(mappedData.zpid),
        needsImages ? fetchPropertyImages(mappedData.zpid) : Promise.resolve(mappedData.images ?? []),
        fetchPropertyComps(mappedData.zpid),
        needsPlacesFetch
          ? fetchNearbyPlaces(coordsForPlaces!.latitude, coordsForPlaces!.longitude, mappedData.zpid, mappedData.address, cachedPlaces, forceEnvironment).catch(() => null)
          : Promise.resolve(cachedPlaces ?? null),
      ]);

      // Reuse the already-fetched env doc (avoids a second Firestore read later).
      const cachedEnvEarly = envDocForPlaces;


      mappedData.walkScore = scores.walkScore;
      mappedData.walkScoreDesc = scores.walkScoreDesc;
      mappedData.transitScore = scores.transitScore;
      mappedData.transitScoreDesc = scores.transitScoreDesc;
      mappedData.bikeScore = scores.bikeScore;
      mappedData.bikeScoreDesc = scores.bikeScoreDesc;
      if (needsImages && images.length > 0) mappedData.images = images;
      mappedData.comps = comps;
      // Serve POI data to the UI from whichever is fresher (new fetch or cached env doc).
      const placesForUI = nearbyPlaces ?? cachedPlaces ?? null;
      if (placesForUI) mappedData.neighborhoodPlaces = placesForUI;

      // Fire-and-forget save — don't block the rest of the pipeline on a write.
      // neighborhoodPlaces is now persisted to google_environmental_data, NOT the properties doc.
      if (nearbyPlaces && needsPlacesFetch) {
        saveGoogleDataToCloud(String(mappedData.zpid), { neighborhoodPlaces: nearbyPlaces })
          .catch(e => console.warn('[fetchPropertyDataFull] Places save to env doc failed:', e));
      }
      savePropertyToCloud(mappedData.zpid, mappedData).catch(e => console.warn('[fetchPropertyDataFull] Non-blocking save failed:', e));

      // Hand off the pre-fetched env cache to the environmental block below.
      (mappedData as any).__cachedEnvEarly = cachedEnvEarly;

    } // End of if (mappedData.zpid)

    // INDEPENDENT ENVIRONMENTAL CHECK:
    // Even if we don't have a ZPID, if we have coordinates, we can fetch Solar/Air/Pollen/AI.
    if (mappedData.coordinates) {

      // SMART CACHING STRATEGY:
      // We use ZPID if available, otherwise we generate a consistent key from the normalized address.
      const storageKey = mappedData.zpid || (mappedData.address ? mappedData.address.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined);

      // Google Maps Platform Terms of Service Caching Limits (TTLs)
      const TTL_SOLAR = 30 * 24 * 60 * 60 * 1000;      // 30 Days (Solar API)
      const TTL_AIR_QUALITY = 24 * 60 * 60 * 1000;    // 24 Hours (Air Quality API - dynamic)
      const TTL_POLLEN = 365 * 24 * 60 * 60 * 1000;        // 365 Days (Pollen API 'Today's Forecast' permitted cache)
      const TTL_NOISE = 30 * 24 * 60 * 60 * 1000;       // 30 Days (HowLoud - stable)

      const isCacheExpired = (lastUpdated: any, ttl: number) => {
        if (!lastUpdated) return true;
        const now = Date.now();
        const updatedMs = lastUpdated.toMillis ? lastUpdated.toMillis() : new Date(lastUpdated).getTime();
        return (now - updatedMs) > ttl;
      };

      // Re-use the env cache already fetched in parallel above (if available), otherwise fetch now.
      let cachedEnvData: any = (mappedData as any).__cachedEnvEarly ?? null;
      delete (mappedData as any).__cachedEnvEarly;
      if (!cachedEnvData && storageKey) {
        try {
          console.log(`[EnvironmentalCache] Checking cache for key: ${storageKey}`);
          cachedEnvData = await getGoogleDataFromCloud(storageKey);
        } catch (e) {
          console.warn("Failed to check cached environmental data", e);
        }
      }
      if (cachedEnvData) onStep?.("Checking data freshness...");

      const lat = mappedData.coordinates.latitude;
      const lng = mappedData.coordinates.longitude;

      // Determine which environmental data needs a fresh fetch vs is still valid from cache.
      const needsSolar = !cachedEnvData?.solarData || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_SOLAR);
      const needsAirQual = !cachedEnvData?.airQuality || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_AIR_QUALITY);
      const needsPollen = !cachedEnvData?.pollen?.analysis || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_POLLEN);
      const needsNoise = cachedEnvData?.noiseScore == null || forceEnvironment || isCacheExpired(cachedEnvData.lastUpdated, TTL_NOISE);

      if (needsSolar || needsAirQual || needsPollen || needsNoise) {
        onStep?.("Fetching environmental data...");
      }

      // Fire all missing fetches in parallel — each resolves independently.
      const [freshSolar, freshAirQual, freshPollenRaw, freshNoise] = await Promise.all([
        needsSolar ? fetchSolarData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
        needsAirQual ? fetchAirQuality(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
        needsPollen ? fetchPollenData(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
        needsNoise ? fetchNoiseScore(lat, lng, mappedData.zpid, mappedData.address) : Promise.resolve(null),
      ]);

      // 1. Solar
      mappedData.solarData = needsSolar ? freshSolar : cachedEnvData.solarData;

      // 2. Air Quality
      mappedData.airQuality = needsAirQual ? freshAirQual : cachedEnvData.airQuality;

      // 3. Pollen — if fresh raw data arrived, run Gemini analysis on it
      if (needsPollen) {
        if (freshPollenRaw) {
          try {
            const userId = auth?.currentUser?.uid || 'unknown';
            const pollenAnalysis = await analyzePollen(freshPollenRaw, mappedData, userId);
            mappedData.pollen = { ...freshPollenRaw, analysis: pollenAnalysis.data };
          } catch (e) {
            console.warn('Pollen analysis failed, using raw data only:', e);
            mappedData.pollen = freshPollenRaw;
          }
        }
      } else {
        mappedData.pollen = cachedEnvData.pollen;
      }

      // 4. Noise
      if (needsNoise && freshNoise) {
        mappedData.noiseScore = freshNoise.score;
        mappedData.noiseScoreDesc = freshNoise.description ?? undefined;
        mappedData.noiseTrafficScore = freshNoise.trafficScore;
        mappedData.noiseTrafficDesc = freshNoise.trafficDesc ?? undefined;
        mappedData.noiseLocalScore = freshNoise.localScore;
        mappedData.noiseLocalDesc = freshNoise.localDesc ?? undefined;
        mappedData.noiseAirportScore = freshNoise.airportScore;
        mappedData.noiseAirportDesc = freshNoise.airportDesc ?? undefined;
      } else if (!needsNoise) {
        mappedData.noiseScore = cachedEnvData.noiseScore;
        mappedData.noiseScoreDesc = cachedEnvData.noiseScoreDesc;
        mappedData.noiseTrafficScore = cachedEnvData.noiseTrafficScore;
        mappedData.noiseTrafficDesc = cachedEnvData.noiseTrafficDesc;
        mappedData.noiseLocalScore = cachedEnvData.noiseLocalScore;
        mappedData.noiseLocalDesc = cachedEnvData.noiseLocalDesc;
        mappedData.noiseAirportScore = cachedEnvData.noiseAirportScore;
        mappedData.noiseAirportDesc = cachedEnvData.noiseAirportDesc;
      }


      // 4. AI Street View Analysis
      if (cachedEnvData?.streetViewAnalysis?.imageUrl && cachedEnvData?.streetViewAnalysis?.privacyRating && !forceEnvironment) {
        console.log("[fetchPropertyDataFull] Using cached Street View analysis.");
        mappedData.streetViewAnalysis = cachedEnvData.streetViewAnalysis;
      } else {
        onStep?.("Analyzing curb appeal with AI...");

        // If this is a forced re-analysis, clear stale Firestore entry first
        if (forceEnvironment && storageKey && cachedEnvData?.streetViewAnalysis) {
          console.log("[fetchPropertyDataFull] Clearing stale streetViewAnalysis from cache before re-analysis.");
          await saveGoogleDataToCloud(storageKey, { streetViewAnalysis: undefined });
          mappedData.streetViewAnalysis = undefined;
        }

        const encodedAddress = encodeURIComponent(mappedData.address);

        // Check Street View Metadata API first — free JSON call, no image quota.
        // status === "OK" means imagery exists. ZERO_RESULTS / NOT_FOUND = skip AI entirely.
        let imageryAvailable = false;
        try {
          const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodedAddress}&radius=100&source=outdoor&key=${MAPS_API_KEY}`;
          const metaResponse = await fetch(metaUrl);
          if (metaResponse.ok) {
            const meta = await metaResponse.json();
            imageryAvailable = meta.status === 'OK';
            console.log(`[fetchPropertyDataFull] Street View metadata status: ${meta.status} for ${mappedData.address}`);
          }
        } catch (metaErr: any) {
          console.warn("[fetchPropertyDataFull] Street View metadata check failed, skipping.", metaErr.message);
        }

        if (imageryAvailable) {
          const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${encodedAddress}&fov=90&radius=100&source=outdoor&return_error_code=true&key=${MAPS_API_KEY}`;
          try {
            const userId = auth?.currentUser?.uid || "unknown";
            const svAnalysis = await analyzeStreetView(streetViewUrl, mappedData, userId);
            mappedData.streetViewAnalysis = svAnalysis.data;
            console.log("[fetchPropertyDataFull] Street View analysis complete. Image URL:", mappedData.streetViewAnalysis?.imageUrl);
          } catch (e: any) {
            console.warn("[fetchPropertyDataFull] Street View analysis failed.", e.message || e);
          }
        } else {
          console.log("[fetchPropertyDataFull] No Street View imagery available — skipping AI analysis.");
          mappedData.streetViewAnalysis = undefined;
        }
      }



      // Save back to cache (merge with existing)
      if (storageKey) {
        console.log(`[EnvironmentalCache] Saving data to cache key: ${storageKey}`);
        await saveGoogleDataToCloud(storageKey, {
          solarData: mappedData.solarData,
          airQuality: mappedData.airQuality,
          pollen: mappedData.pollen,
          streetViewAnalysis: mappedData.streetViewAnalysis,
          noiseScore: mappedData.noiseScore ?? null,
          noiseScoreDesc: mappedData.noiseScoreDesc ?? null,
          noiseTrafficScore: mappedData.noiseTrafficScore ?? null,
          noiseTrafficDesc: mappedData.noiseTrafficDesc ?? null,
          noiseLocalScore: mappedData.noiseLocalScore ?? null,
          noiseLocalDesc: mappedData.noiseLocalDesc ?? null,
          noiseAirportScore: mappedData.noiseAirportScore ?? null,
          noiseAirportDesc: mappedData.noiseAirportDesc ?? null,
          zpid: mappedData.zpid || storageKey
        });
      } else {
        console.warn('[EnvironmentalCache] Skipping save: No ZPID or Address available for key.');
      }
    }

    // Final save attempt if we have a ZPID (in case we added environmental data)
    if (mappedData.zpid) {
      await savePropertyToCloud(mappedData.zpid, mappedData);
    }

    return mappedData;
  })();

  ongoingRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    ongoingRequests.delete(cacheKey);
  }
};

export const fetchPropertyData = async (address: string, forceRefresh: boolean = true): Promise<PropertyData> => {
  return fetchPropertyDataFull(address, false, false);
};

/**
 * Lightweight property specs fetch — RapidAPI only. No Google APIs, no Gemini,
 * no images, no environmental data. Returns core fields for comp enrichment.
 */
export const fetchPropertySpecs = async (zpid: string): Promise<Record<string, any> | null> => {
  const url = `https://${RAPID_API_HOST}/property?zpid=${zpid}`;
  const logId = await logAPICall({
    user_id: auth?.currentUser?.uid || 'unknown',
    zpid,
    api_name: 'RapidAPI',
    endpoint: 'property-specs',
    params: { zpid },
    status: 'pending'
  });
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPID_API_HOST,
        'x-rapidapi-key': RAPID_API_KEY,
      },
      cache: 'no-store'
    });
    if (!response.ok) {
      await logAPICall({ user_id: auth?.currentUser?.uid || 'unknown', zpid, api_name: 'RapidAPI', endpoint: 'property-specs', params: { zpid }, status: 'failed', response_time_ms: Date.now() - start, error: `HTTP ${response.status}` });
      return null;
    }
    const data = await response.json();
    await logAPICall({ user_id: auth?.currentUser?.uid || 'unknown', zpid, api_name: 'RapidAPI', endpoint: 'property-specs', params: { zpid }, status: 'completed', response_time_ms: Date.now() - start });
    const root = data.property || data.props || data;
    const addrRoot = root.address || data.address;
    return {
      zpid,
      address: formatAddress(addrRoot) || undefined,
      city: addrRoot?.city,
      state: addrRoot?.state,
      zipCode: addrRoot?.zipcode || addrRoot?.zipCode,
      homeStatus: root.homeStatus,
      homeType: root.homeType,
      bedrooms: extractNumericValue(root.bedrooms),
      bathrooms: extractNumericValue(root.bathrooms),
      livingAreaValue: extractNumericValue(root.livingAreaValue || root.livingArea),
      yearBuilt: extractNumericValue(root.yearBuilt),
      lotSize: safeStringify(root.resoFacts?.lotSize || root.lotSize) || undefined,
      price: extractNumericValue(root.price || root.listPrice),
      zestimate: extractNumericValue(root.zestimate),
      rentZestimate: extractNumericValue(root.rentZestimate),
      lastSoldDate: root.datePosted || null,
      coordinates: root.longitude && root.latitude ? { latitude: root.latitude, longitude: root.longitude } : undefined,
    };
  } catch (e: any) {
    console.warn(`[fetchPropertySpecs] ${zpid} failed:`, e.message);
    return null;
  }
};
