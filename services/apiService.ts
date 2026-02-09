
import { PropertyData, RadarGeocodeResponse, PropertyComp } from "../types";
import { savePropertyToCloud, getPropertyFromCloud } from "./firebaseService";
import { APP_CONFIG } from "../config";
import { logAPICall, updateAPICall } from "./firebase/api_logs";
import { auth } from "./firebase/config";
import { getGoogleDataFromCloud, saveGoogleDataToCloud } from "./firebaseService";
import { analyzeStreetView, analyzePollen } from "./geminiService";
import { calculateSolarPotential } from "../utils/solarCalculations";

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

const formatAddress = (addr: any): string => {
  if (typeof addr === 'string') return addr;
  if (addr && typeof addr === 'object') {
    const { streetAddress, city, state, zipcode, zipCode } = addr;
    const parts = [
      streetAddress,
      city,
      state,
      zipcode || zipCode
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : JSON.stringify(addr);
  }
  return String(addr || "Unknown Address");
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

  const firstResult = geocodeData.addresses[0];
  if (!firstResult) throw new Error("No address found for the provided query.");

  const coordinates = { latitude: firstResult.latitude, longitude: firstResult.longitude };

  const zoomOutUrl = `https://api.radar.io/maps/static?publishableKey=${RADAR_API_KEY}&center=${coordinates.latitude},${coordinates.longitude}&zoom=15&width=1024&height=1024&style=radar-default-v1&scale=1&markers=color:0x000257%7C${coordinates.latitude},${coordinates.longitude}`;
  const zoomInUrl = `https://api.radar.io/maps/static?publishableKey=${RADAR_API_KEY}&center=${coordinates.latitude},${coordinates.longitude}&zoom=20&width=2048&height=2048&style=radar-default-v1&scale=1&markers=color:0x000257%7C${coordinates.latitude},${coordinates.longitude}`;

  return {
    coordinates,
    formattedAddress: firstResult.formattedAddress,
    components: {
      street: firstResult.street,
      city: firstResult.city,
      state: firstResult.state,
      zipCode: firstResult.postalCode,
      country: firstResult.country,
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

  const url = `https://${RAPID_API_HOST}/images?zpid=${zpid}`;
  const promise = (async () => {
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

export const fetchSolarData = async (lat: number, lng: number): Promise<any> => {
  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
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

export const fetchAirQuality = async (lat: number, lng: number): Promise<any> => {
  const url = `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${MAPS_API_KEY}`;

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

export const fetchPollenData = async (lat: number, lng: number): Promise<any> => {
  // We use forecast:lookup to get today's pollen info
  const url = `https://pollen.googleapis.com/v1/forecast:lookup?key=${MAPS_API_KEY}&location.latitude=${lat}&location.longitude=${lng}&days=1`;
  console.log(`[Pollen API] Fetching pollen data for ${lat}, ${lng} from URL: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Pollen API] Error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log("[Pollen API] Successful response:", data);

    const today = data.dailyInfo?.[0]; // Day 0 is "today"
    if (!today) return null;

    // Grass, Tree, Weed types usually available. We pick the highest or simplify.
    // The API returns distinct types like grass, tree, weed.
    // We'll extract a simplified summary.

    // Find the max index info
    const maxPollen = today.pollenTypeInfo?.reduce((prev: any, current: any) => {
      return (prev.indexInfo?.value || 0) > (current.indexInfo?.value || 0) ? prev : current;
    });

    return {
      score: maxPollen?.indexInfo?.value,
      category: maxPollen?.indexInfo?.category,
      description: maxPollen?.indexInfo?.indexDescription,
      dominantPollenType: maxPollen?.displayName,
      // Pass along the raw technical data for Gemini analysis
      pollenTypeInfo: today.pollenTypeInfo,
      plantInfo: today.plantInfo
    };

  } catch (e) {
    console.error("Failed to fetch pollen data", e);
    return null;
  }
};

export const fetchPropertyDataFull = async (addressOrZpid: string, isZpid: boolean = false, onStep?: (step: string) => void): Promise<PropertyData> => {
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

      // Relaxed ZPID check:
      // If we can't find it there, try to fallback or generate one (though risky). 
      // Ideally we want a real ID.
      const rawZpid = data.zpid ? String(data.zpid) : (data.props?.zpid ? String(data.props.zpid) : undefined);

      if (!rawZpid) {
        console.warn("API Warning: Response missing 'zpid' at root. Proceeding with limited data.", JSON.stringify(data, null, 2));
      }

      if (!isZpid && rawZpid) {
        const cached = await getPropertyFromCloud(String(rawZpid));
        if (cached) {
          mappedData = cached;
          console.log("[fetchPropertyDataFull] Found cached property data for found ZPID:", rawZpid);
        }
      }

      if (!mappedData) {
        mappedData = {
          address: formatAddress(data.address || data.props?.address || addressOrZpid),
          city: (data.address && typeof data.address === 'object') ? data.address.city : (data.props?.address?.city || undefined),
          state: (data.address && typeof data.address === 'object') ? data.address.state : (data.props?.address?.state || undefined),
          zipCode: (data.address && typeof data.address === 'object') ? (data.address.zipcode || data.address.zipCode) : (data.props?.address?.zipCode || data.props?.address?.zipcode || undefined),
          zpid: rawZpid ? String(rawZpid) : undefined,
          homeStatus: data.homeStatus || data.props?.homeStatus || "OFF_MARKET",
          homeType: data.homeType || data.props?.homeType || "SINGLE_FAMILY",
          livingAreaValue: extractNumericValue(data.livingAreaValue || data.livingArea || data.props?.livingArea),
          bedrooms: extractNumericValue(data.bedrooms || data.props?.bedrooms),
          bathrooms: extractNumericValue(data.bathrooms || data.props?.bathrooms),
          yearBuilt: extractNumericValue(data.yearBuilt || data.props?.yearBuilt),
          lotSize: safeStringify(data.resoFacts?.lotSize || data.props?.resoFacts?.lotSize) || "N/A",
          price: extractNumericValue(data.price || data.zestimate || data.props?.price),
          zestimate: extractNumericValue(data.zestimate || data.props?.zestimate),
          rentZestimate: extractNumericValue(data.rentZestimate || data.props?.rentZestimate),
          annualHomeownersInsurance: extractNumericValue(data.annualHomeownersInsurance),
          windRiskScore: extractNumericValue(data.climate?.windSources?.primary?.riskScore),
          floodRiskScore: extractNumericValue(data.climate?.floodSources?.primary?.riskScore),
          fireRiskScore: extractNumericValue(data.climate?.fireSources?.primary?.riskScore),
          heatRiskScore: extractNumericValue(data.climate?.heatRiskScore),
          description: data.description || data.props?.description || "No description available.",
          images: Array.isArray(data.images) ? data.images : (data.props?.images || []),
          schools: Array.isArray(data.schools) ? data.schools : (data.props?.schools || []),
          listedDate: data.onMarketDate || data.listedDate || data.props?.onMarketDate || data.daysOnZillow || 0,
          priceHistory: (Array.isArray(data.priceHistory) ? data.priceHistory : (data.props?.priceHistory || [])).map((item: any) => ({
            date: item.date || "N/A",
            price: extractNumericValue(item.price),
            event: item.event || "Price Change"
          })),
          resoFacts: {
            flooring: safeStringify(data.resoFacts?.flooring),
            foundationDetails: safeStringify(data.resoFacts?.foundationDetails),
            rooms: safeStringify(data.resoFacts?.rooms),
            roomTypes: safeStringify(data.resoFacts?.roomTypes),
            feesAndDues: safeStringify(data.resoFacts?.feesAndDues),
            exteriorFeatures: safeStringify(data.resoFacts?.exteriorFeatures),
            architecturalStyle: safeStringify(data.resoFacts?.architecturalStyle),
            garageParkingCapacity: extractNumericValue(data.resoFacts?.garageParkingCapacity),
            lotFeatures: safeStringify(data.resoFacts?.lotFeatures),
            roofType: safeStringify(data.resoFacts?.roofType),
            daysOnZillow: extractNumericValue(data.daysOnZillow || data.resoFacts?.daysOnZillow),
            constructionMaterials: safeStringify(data.resoFacts?.constructionMaterials),
            fireplaceFeatures: safeStringify(data.resoFacts?.fireplaceFeatures),
            appliances: safeStringify(data.resoFacts?.appliances),
            fencing: safeStringify(data.resoFacts?.fencing),
            cooling: safeStringify(data.resoFacts?.cooling),
            laundryFeatures: safeStringify(data.resoFacts?.laundryFeatures),
            heating: safeStringify(data.resoFacts?.heating),
            basement: safeStringify(data.resoFacts?.basement),
            utilities: safeStringify(data.resoFacts?.utilities),
            sewer: safeStringify(data.resoFacts?.sewer),
            waterSource: safeStringify(data.resoFacts?.waterSource),
            securityFeatures: safeStringify(data.resoFacts?.securityFeatures),
            windowFeatures: safeStringify(data.resoFacts?.windowFeatures),
            roomFeatures: safeStringify(data.resoFacts?.roomFeatures),
          },
          coordinates: data.longitude && data.latitude ? { latitude: data.latitude, longitude: data.longitude } : undefined
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
          // IMPORTANT: Update address to the clean, normalized version from Radar
          // This ensures our fallback cache key is consistent.
          if (geocoded.formattedAddress) {
            mappedData.address = geocoded.formattedAddress;
          }
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
      if (cachedEnvData?.solarData) {
        mappedData.solarData = cachedEnvData.solarData;
      } else {
        onStep?.("Analyzing solar potential...");
        mappedData.solarData = await fetchSolarData(mappedData.coordinates.latitude, mappedData.coordinates.longitude);
      }

      // 2. Air Quality
      if (cachedEnvData?.airQuality) {
        mappedData.airQuality = cachedEnvData.airQuality;
      } else {
        onStep?.("Fetching air quality data...");
        mappedData.airQuality = await fetchAirQuality(mappedData.coordinates.latitude, mappedData.coordinates.longitude);
      }

      // 3. Pollen (New Feature)
      if (cachedEnvData?.pollen?.analysis) {
        mappedData.pollen = cachedEnvData.pollen;
      } else {
        onStep?.("Fetching pollen data...");
        const pollenRaw = await fetchPollenData(mappedData.coordinates.latitude, mappedData.coordinates.longitude);

        if (pollenRaw) {
          onStep?.("Analyzing allergy profile...");
          try {
            const userId = auth?.currentUser?.uid || "unknown";
            const pollenAnalysis = await analyzePollen(pollenRaw, mappedData, userId);
            mappedData.pollen = {
              ...pollenRaw,
              analysis: pollenAnalysis.data
            };
          } catch (e) {
            console.warn("Pollen analysis failed, using raw data only:", e);
            mappedData.pollen = pollenRaw;
          }
        }
      }

      // 4. AI Street View Analysis (Refined with Forensic Analysis)
      if (cachedEnvData?.streetViewAnalysis?.imageUrl && cachedEnvData?.streetViewAnalysis?.privacyRating) {
        console.log("[fetchPropertyDataFull] Using cached Forensic Street View analysis.");
        mappedData.streetViewAnalysis = cachedEnvData.streetViewAnalysis;
      } else {
        onStep?.("Analyzing curb appeal with AI...");
        // We use the address instead of coordinates because Google's geocoder is often 
        // better at finding the frontage of the house than raw parcel coordinates.
        // We use radius=100 to find the nearest panorama.
        // We remove heading/pitch to let Google auto-center on the address.
        const encodedAddress = encodeURIComponent(mappedData.address);
        console.log(`[fetchPropertyDataFull] ${cachedEnvData?.streetViewAnalysis ? 'Re-analyzing' : 'Analyzing'} Street View for: ${mappedData.address}`);

        const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&fov=90&radius=100&source=outdoor&return_error_code=true&key=${MAPS_API_KEY}`;

        try {
          const userId = auth?.currentUser?.uid || "unknown";
          const svAnalysis = await analyzeStreetView(streetViewUrl, mappedData, userId);
          mappedData.streetViewAnalysis = svAnalysis.data;
          console.log("[fetchPropertyDataFull] Street View analysis complete. Image URL:", mappedData.streetViewAnalysis?.imageUrl);
        } catch (e: any) {
          console.warn("[fetchPropertyDataFull] Street View not available or analysis failed. Skipping.", e.message || e);
        }
      }

      // Save back to cache if we fetched anything new (merges with existing)
      // Save back to cache if we fetched anything new (merges with existing)
      if (storageKey) {
        console.log(`[EnvironmentalCache] Saving data to cache key: ${storageKey}`);
        await saveGoogleDataToCloud(storageKey, {
          solarData: mappedData.solarData,
          airQuality: mappedData.airQuality,
          pollen: mappedData.pollen,
          streetViewAnalysis: mappedData.streetViewAnalysis,
          // We store the ZPID if we have it, but the doc ID might be the address hash
          zpid: mappedData.zpid || storageKey
        });
      } else {
        console.warn("[EnvironmentalCache] Skipping save: No ZPID or Address available for key.");
      } // End of if (mappedData.coordinates) usage for environmental data
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
  return fetchPropertyDataFull(address, false);
};
