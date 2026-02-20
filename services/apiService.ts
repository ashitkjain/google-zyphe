
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
// Score: 50 (very loud) → 100 (very quiet)
export const fetchNoiseScore = async (
  lat: number,
  lng: number,
  zpid?: string,
  address?: string
): Promise<{ score: number | null; description: string | null } | null> => {
  const howLoudKey = APP_CONFIG.howLoud.key;
  if (!howLoudKey) {
    console.warn('[HowLoud] No API key configured — skipping noise score.');
    return null;
  }

  const url = `https://api.howloud.com/score?lat=${lat}&lng=${lng}`;
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
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-api-key': howLoudKey },
    });

    if (logId) {
      updateAPICall(logId, {
        status: response.ok ? 'completed' : 'failed',
        response_time_ms: Date.now() - start,
        error: response.ok ? undefined : `Status ${response.status}`
      });
    }

    if (!response.ok) {
      console.warn(`[HowLoud] Error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('[HowLoud] Response:', data);

    // HowLoud returns result[0].score and result[0].text
    const result = Array.isArray(data?.result) ? data.result[0] : data;
    const score = extractNumericValue(result?.score ?? result?.soundscore ?? null);
    const description: string | null = result?.text ?? result?.description ?? null;

    return { score, description };
  } catch (e) {
    console.error('[HowLoud] Failed to fetch noise score:', e);
    return null;
  }
};

// ─── Crime Score (FBI Crime Data Explorer — api.data.gov) ────────────────────
// Free & unlimited — official UCR data from local law enforcement agencies.
// Strategy: 1) find agency ORI for city/state, 2) fetch offense summary, 3) grade by crime rate.
export const fetchCrimeScore = async (
  lat: number,
  lng: number,
  address: string,
  zpid?: string,
  city?: string,
  state?: string
): Promise<{ score: number | null; grade: string | null } | null> => {
  const { key, baseUrl } = APP_CONFIG.fbiCde;
  if (!key) {
    console.warn('[FBI CDE] No API key configured — skipping crime score.');
    return null;
  }
  if (!city || !state) {
    console.warn('[FBI CDE] Missing city or state — cannot look up agency ORI.');
    return null;
  }

  try {
    // Step 1: Find the local police department ORI for this city/state
    const agencyUrl = `${baseUrl}/api/agencies/byStateAbbr/${encodeURIComponent(state)}?api_key=${key}`;
    const logId = await logAPICall({
      user_id: auth?.currentUser?.uid || 'unknown',
      zpid,
      address,
      api_name: 'FBI CDE',
      endpoint: 'agencies/byStateAbbr',
      params: { city, state },
      status: 'pending'
    });
    const start = Date.now();

    const agencyResp = await fetch(agencyUrl);
    if (logId) {
      updateAPICall(logId, {
        status: agencyResp.ok ? 'completed' : 'failed',
        response_time_ms: Date.now() - start,
        error: agencyResp.ok ? undefined : `Status ${agencyResp.status}`
      });
    }
    if (!agencyResp.ok) {
      console.warn(`[FBI CDE] Agency lookup failed: ${agencyResp.status}`);
      return null;
    }

    const agencies: any[] = await agencyResp.json();
    // Find the city's police dept (agency_type_name = "City")
    const cityNorm = city.toLowerCase().trim();
    const match = agencies.find((a: any) =>
      a.city_name?.toLowerCase()?.trim() === cityNorm &&
      (a.agency_type_name === 'City' || a.agency_type_name === 'Municipality')
    ) || agencies.find((a: any) =>
      a.city_name?.toLowerCase()?.trim() === cityNorm
    );

    if (!match?.ori) {
      console.warn(`[FBI CDE] No agency found for ${city}, ${state}`);
      return null;
    }

    const ori = match.ori;
    console.log(`[FBI CDE] Found ORI for ${city}, ${state}: ${ori}`);

    // Step 2: Fetch summarized offenses for this agency (latest available year)
    const offenseUrl = `${baseUrl}/api/summarized/agencies/${ori}/offenses?api_key=${key}`;
    const offenseLogId = await logAPICall({
      user_id: auth?.currentUser?.uid || 'unknown',
      zpid,
      address,
      api_name: 'FBI CDE',
      endpoint: 'summarized/agencies/offenses',
      params: { ori },
      status: 'pending'
    });
    const offenseStart = Date.now();

    const offenseResp = await fetch(offenseUrl);
    if (offenseLogId) {
      updateAPICall(offenseLogId, {
        status: offenseResp.ok ? 'completed' : 'failed',
        response_time_ms: Date.now() - offenseStart,
        error: offenseResp.ok ? undefined : `Status ${offenseResp.status}`
      });
    }
    if (!offenseResp.ok) {
      console.warn(`[FBI CDE] Offense fetch failed: ${offenseResp.status}`);
      return null;
    }

    const offenseData = await offenseResp.json();
    console.log('[FBI CDE] Offense data:', offenseData);

    // offenseData.data is an array of yearly records; pick the most recent
    const records: any[] = Array.isArray(offenseData?.data)
      ? offenseData.data
      : Array.isArray(offenseData)
        ? offenseData
        : [];

    if (records.length === 0) {
      console.warn('[FBI CDE] No offense records returned.');
      return null;
    }

    // Sort descending by year and pick the latest
    const latest = records.sort((a, b) => (b.data_year ?? 0) - (a.data_year ?? 0))[0];
    const population: number = latest?.population ?? match?.population ?? 100000;
    const violent: number = latest?.violent_crime ?? 0;
    const property: number = latest?.property_crime ?? 0;
    const totalCrimes = violent + property;

    // Crimes per 1,000 residents
    const ratePer1k = population > 0 ? (totalCrimes / population) * 1000 : 0;

    // US national average ~≈ 25 crimes/1k (2022). Thresholds:
    // < 10   → A+  97
    // < 18   → A   88
    // < 28   → B   74
    // < 40   → C   58
    // < 60   → D   42
    // ≥ 60   → F   20
    let grade: string;
    let score: number;
    if (ratePer1k < 10) { grade = 'A+'; score = 97; }
    else if (ratePer1k < 18) { grade = 'A'; score = 88; }
    else if (ratePer1k < 28) { grade = 'B'; score = 74; }
    else if (ratePer1k < 40) { grade = 'C'; score = 58; }
    else if (ratePer1k < 60) { grade = 'D'; score = 42; }
    else { grade = 'F'; score = 20; }

    console.log(`[FBI CDE] ${city}: rate=${ratePer1k.toFixed(1)}/1k → grade=${grade} score=${score}`);
    return { score, grade };

  } catch (e) {
    console.error('[FBI CDE] Failed to fetch crime score:', e);
    return null;
  }
};


export const fetchPropertyDataFull = async (addressOrZpid: string, isZpid: boolean = false, forceEnvironment: boolean = false, onStep?: (step: string) => void): Promise<PropertyData> => {
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
          listedDate: root.onMarketDate || root.listedDate || root.daysOnZillow || 0,
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
          },
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
      onStep?.("Syncing mobility scores...");
      const scores = await fetchScores(mappedData.zpid);
      mappedData.walkScore = scores.walkScore;
      mappedData.walkScoreDesc = scores.walkScoreDesc;
      mappedData.transitScore = scores.transitScore;
      mappedData.transitScoreDesc = scores.transitScoreDesc;
      mappedData.bikeScore = scores.bikeScore;
      mappedData.bikeScoreDesc = scores.bikeScoreDesc;

      onStep?.("Fetching image gallery...");
      if (!mappedData.images || mappedData.images.length === 0) {
        const images = await fetchPropertyImages(mappedData.zpid);
        mappedData.images = images;
      }

      onStep?.("Fetching comparable sales...");
      const comps = await fetchPropertyComps(mappedData.zpid);
      mappedData.comps = comps;

      if (mappedData.coordinates) {
        // Moved environmental logic outside of ZPID check
      }

      await savePropertyToCloud(mappedData.zpid, mappedData);
    } // End of if (mappedData.zpid)

    // INDEPENDENT ENVIRONMENTAL CHECK:
    // Even if we don't have a ZPID, if we have coordinates, we can fetch Solar/Air/Pollen/AI.
    if (mappedData.coordinates) {

      // SMART CACHING STRATEGY:
      // We use ZPID if available, otherwise we generate a consistent key from the normalized address.
      const storageKey = mappedData.zpid || (mappedData.address ? mappedData.address.toLowerCase().replace(/[^a-z0-9]/g, '_') : undefined);

      let cachedEnvData: any = null;
      if (storageKey) {
        try {
          console.log(`[EnvironmentalCache] Checking cache for key: ${storageKey}`);
          cachedEnvData = await getGoogleDataFromCloud(storageKey);
          if (cachedEnvData) onStep?.("Loaded existing environmental data...");
        } catch (e) {
          console.warn("Failed to check cached environmental data", e);
        }
      }

      // 1. Solar Data
      if (cachedEnvData?.solarData && !forceEnvironment) {
        mappedData.solarData = cachedEnvData.solarData;
      } else {
        onStep?.("Analyzing solar potential...");
        mappedData.solarData = await fetchSolarData(mappedData.coordinates.latitude, mappedData.coordinates.longitude, mappedData.zpid, mappedData.address);
      }

      // 2. Air Quality
      if (cachedEnvData?.airQuality && !forceEnvironment) {
        mappedData.airQuality = cachedEnvData.airQuality;
      } else {
        onStep?.("Fetching air quality data...");
        mappedData.airQuality = await fetchAirQuality(mappedData.coordinates.latitude, mappedData.coordinates.longitude, mappedData.zpid, mappedData.address);
      }

      // 3. Pollen
      if (cachedEnvData?.pollen?.analysis && !forceEnvironment) {
        mappedData.pollen = cachedEnvData.pollen;
      } else {
        onStep?.('Fetching pollen data...');
        const pollenRaw = await fetchPollenData(mappedData.coordinates.latitude, mappedData.coordinates.longitude, mappedData.zpid, mappedData.address);

        if (pollenRaw) {
          onStep?.('Analyzing allergy profile...');
          try {
            const userId = auth?.currentUser?.uid || 'unknown';
            const pollenAnalysis = await analyzePollen(pollenRaw, mappedData, userId);
            mappedData.pollen = {
              ...pollenRaw,
              analysis: pollenAnalysis.data
            };
          } catch (e) {
            console.warn('Pollen analysis failed, using raw data only:', e);
            mappedData.pollen = pollenRaw;
          }
        }
      }

      // 4. Noise Score (HowLoud SoundScore) — cached 30 days
      if (cachedEnvData?.noiseScore != null && !forceEnvironment) {
        mappedData.noiseScore = cachedEnvData.noiseScore;
        mappedData.noiseScoreDesc = cachedEnvData.noiseScoreDesc;
      } else {
        onStep?.('Fetching noise score...');
        const noise = await fetchNoiseScore(
          mappedData.coordinates.latitude,
          mappedData.coordinates.longitude,
          mappedData.zpid,
          mappedData.address
        );
        if (noise) {
          mappedData.noiseScore = noise.score;
          mappedData.noiseScoreDesc = noise.description ?? undefined;
        }
      }

      // 5. Crime Score — cached 30 days
      if (cachedEnvData?.crimeScore != null && !forceEnvironment) {
        mappedData.crimeScore = cachedEnvData.crimeScore;
        mappedData.crimeGrade = cachedEnvData.crimeGrade;
      } else {
        onStep?.('Fetching crime data (FBI CDE)...');
        const crime = await fetchCrimeScore(
          mappedData.coordinates.latitude,
          mappedData.coordinates.longitude,
          mappedData.address || '',
          mappedData.zpid,
          mappedData.city,
          mappedData.state
        );
        if (crime) {
          mappedData.crimeScore = crime.score;
          mappedData.crimeGrade = crime.grade ?? undefined;
        }
      }

      // 4. AI Street View Analysis
      if (cachedEnvData?.streetViewAnalysis?.imageUrl && cachedEnvData?.streetViewAnalysis?.privacyRating && !forceEnvironment) {
        console.log("[fetchPropertyDataFull] Using cached Forensic Street View analysis.");
        mappedData.streetViewAnalysis = cachedEnvData.streetViewAnalysis;
      } else {
        onStep?.("Analyzing curb appeal with AI...");
        const encodedAddress = encodeURIComponent(mappedData.address);
        const lat = mappedData.coordinates?.latitude;
        const lng = mappedData.coordinates?.longitude;
        console.log(`[fetchPropertyDataFull] ${cachedEnvData?.streetViewAnalysis ? 'Re-analyzing' : 'Analyzing'} Street View for: ${mappedData.address}`);

        // Build candidate URLs to try in order
        const candidateUrls: string[] = [
          // Primary: address-based, narrow radius, outdoor only
          `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&fov=90&radius=100&source=outdoor&return_error_code=true&key=${MAPS_API_KEY}`,
          // Fallback 1: wider radius, no source restriction (picks any panorama nearby)
          `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&fov=90&radius=500&return_error_code=true&key=${MAPS_API_KEY}`,
        ];

        // Fallback 2: raw coordinates if available
        if (lat && lng) {
          candidateUrls.push(
            `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&fov=90&radius=500&return_error_code=true&key=${MAPS_API_KEY}`
          );
        }

        const userId = auth?.currentUser?.uid || "unknown";
        let analysisSucceeded = false;

        for (let i = 0; i < candidateUrls.length; i++) {
          const url = candidateUrls[i];
          const label = i === 0 ? 'primary' : `fallback-${i}`;
          try {
            console.log(`[fetchPropertyDataFull] Trying Street View (${label}): ${url}`);
            const svAnalysis = await analyzeStreetView(url, mappedData, userId);
            mappedData.streetViewAnalysis = svAnalysis.data;
            console.log(`[fetchPropertyDataFull] Street View analysis complete (${label}). Image URL:`, mappedData.streetViewAnalysis?.imageUrl);
            analysisSucceeded = true;
            break; // success — stop trying
          } catch (e: any) {
            const is404 = e.message?.includes('404') || e.message?.includes('ZERO_RESULTS') || e.message?.includes('Status 4');
            console.warn(`[fetchPropertyDataFull] Street View (${label}) failed: ${e.message || e}`);
            if (!is404 || i === candidateUrls.length - 1) {
              // Non-image error (network / AI failure) or exhausted all candidates — give up
              break;
            }
            // 404/no imagery → try next candidate
          }
        }

        if (!analysisSucceeded) {
          console.warn("[fetchPropertyDataFull] No Street View imagery available for this address. Section will be hidden.");
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
          crimeScore: mappedData.crimeScore ?? null,
          crimeGrade: mappedData.crimeGrade ?? null,
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
