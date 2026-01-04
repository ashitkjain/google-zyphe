
import { PropertyData, RadarGeocodeResponse, CustomAIAnalysisResult } from "../types";

const RAPID_API_KEY = "ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f";
const RAPID_API_HOST = "us-housing-market-data1.p.rapidapi.com";

// Radar Key provided by user
const RADAR_API_KEY = "prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb";

// 14 days in milliseconds
const CACHE_EXPIRATION_MS = 14 * 24 * 60 * 60 * 1000;

interface CacheWrapper<T> {
  data: T;
  timestamp: number;
}

export const getCache = <T>(key: string): T | null => {
  const cached = localStorage.getItem(`zyphe_cache_${key}`);
  if (!cached) return null;

  try {
    const wrapper: CacheWrapper<T> = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is expired (14 days)
    if (now - wrapper.timestamp > CACHE_EXPIRATION_MS) {
      localStorage.removeItem(`zyphe_cache_${key}`);
      console.log(`Cache expired for key: ${key}`);
      return null;
    }
    
    return wrapper.data;
  } catch (e) {
    return null;
  }
};

export const setCache = (key: string, data: any) => {
  const wrapper: CacheWrapper<any> = {
    data,
    timestamp: Date.now()
  };
  localStorage.setItem(`zyphe_cache_${key}`, JSON.stringify(wrapper));
};

const extractNumericValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'value' in val) {
    const numeric = Number(val.value);
    return isNaN(numeric) ? 0 : numeric;
  }
  return 0;
};

const safeStringify = (val: any): string | undefined => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    return val.map(item => (typeof item === 'object' ? JSON.stringify(item) : item)).join(', ');
  }
  if (typeof val === 'object') {
    if ('label' in val) return String(val.label);
    if ('text' in val) return String(val.text);
    return JSON.stringify(val);
  }
  return String(val);
};

export const normalizeAddress = async (address: string): Promise<RadarGeocodeResponse> => {
  const normalizedKey = address.trim().toLowerCase();
  const cached = getCache<RadarGeocodeResponse>(`radar_${normalizedKey}`);
  if (cached) {
    console.log('Using cached Radar geocode for:', normalizedKey);
    return cached;
  }

  const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}`;
  console.log('>>> RADAR GEOCODE REQUEST:', {
    url,
    method: 'GET',
    headers: {
      'Authorization': `${RADAR_API_KEY.substring(0, 12)}...`,
      'Content-Type': 'application/json'
    }
  });

  const geocodeResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': RADAR_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  const geocodeData = await geocodeResponse.json();
  console.log('<<< RADAR GEOCODE RESPONSE:', {
    status: geocodeResponse.status,
    statusText: geocodeResponse.statusText,
    data: geocodeData
  });

  if (!geocodeResponse.ok) {
    throw new Error(`Radar API error: ${geocodeResponse.status} - ${geocodeData?.meta?.message || geocodeResponse.statusText}`);
  }
  
  if (!geocodeData.addresses || geocodeData.addresses.length === 0) {
    throw new Error('No geocoding results found for the provided address');
  }

  const firstResult = geocodeData.addresses[0];
  const coordinates = {
    latitude: firstResult.latitude,
    longitude: firstResult.longitude,
  };

  const zoomOutUrl = `https://api.radar.io/maps/static?publishableKey=${RADAR_API_KEY}&center=${coordinates.latitude},${coordinates.longitude}&zoom=15&width=1024&height=1024&style=radar-default-v1&scale=1&markers=color:0x000257%7C${coordinates.latitude},${coordinates.longitude}`;
  const zoomInUrl = `https://api.radar.io/maps/static?publishableKey=${RADAR_API_KEY}&center=${coordinates.latitude},${coordinates.longitude}&zoom=20&width=2048&height=2048&style=radar-default-v1&scale=1&markers=color:0x000257%7C${coordinates.latitude},${coordinates.longitude}`;

  const result: RadarGeocodeResponse = {
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

  setCache(`radar_${normalizedKey}`, result);
  return result;
};

export const fetchPropertyImages = async (zpid: string): Promise<string[]> => {
  try {
    const cached = getCache<string[]>(`images_${zpid}`);
    if (cached) {
      console.log('Using cached images for ZPID:', zpid);
      return cached;
    }

    const url = `https://us-housing-market-data1.p.rapidapi.com/images?zpid=${zpid}`;
    console.log('>>> HOUSING IMAGES REQUEST:', { url });

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPID_API_HOST,
        'x-rapidapi-key': RAPID_API_KEY,
      },
    });

    const data = await response.json();
    console.log('<<< HOUSING IMAGES RESPONSE:', { status: response.status, data });

    if (!response.ok) throw new Error(`Images API error: ${response.status}`);
    
    const images = Array.isArray(data) ? data : (data.images || []);
    
    setCache(`images_${zpid}`, images);
    return images;
  } catch (error) {
    console.error("Error fetching images:", error);
    return [];
  }
};

export const fetchPropertyData = async (address: string): Promise<PropertyData> => {
  const normalizedKey = address.trim().toLowerCase();
  const cached = getCache<PropertyData>(`data_${normalizedKey}`);
  if (cached) {
    console.log('Using cached Housing data for:', normalizedKey);
    return cached;
  }

  const url = `https://us-housing-market-data1.p.rapidapi.com/property?address=${encodeURIComponent(address)}`;
  console.log('>>> HOUSING PROPERTY REQUEST:', { url });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPID_API_HOST,
      'x-rapidapi-key': RAPID_API_KEY,
    },
  });

  const data = await response.json();
  console.log('<<< HOUSING PROPERTY RESPONSE:', { status: response.status, data });

  if (!response.ok) throw new Error(`Property API error: ${response.status}`);
  
  const mappedData: PropertyData = {
    address: typeof data.address === 'string' ? data.address : address,
    zpid: String(data.zpid || ""),
    homeStatus: typeof data.homeStatus === 'string' ? data.homeStatus : "UNKNOWN",
    homeType: typeof data.homeType === 'string' ? data.homeType : "SINGLE_FAMILY",
    livingAreaValue: extractNumericValue(data.livingAreaValue || data.livingArea),
    bedrooms: extractNumericValue(data.bedrooms),
    bathrooms: extractNumericValue(data.bathrooms),
    yearBuilt: extractNumericValue(data.yearBuilt),
    lotSize: safeStringify(data.resoFacts?.lotSize) || "N/A",
    price: extractNumericValue(data.price || data.zestimate),
    zestimate: extractNumericValue(data.zestimate),
    rentZestimate: extractNumericValue(data.rentZestimate),
    annualHomeownersInsurance: extractNumericValue(data.annualHomeownersInsurance),
    windRiskScore: extractNumericValue(data.climate?.windSources?.primary?.riskScore),
    floodRiskScore: extractNumericValue(data.climate?.floodSources?.primary?.riskScore),
    fireRiskScore: extractNumericValue(data.climate?.fireSources?.primary?.riskScore),
    heatRiskScore: extractNumericValue(data.climate?.heatRiskScore),
    description: typeof data.description === 'string' ? data.description : "No description available.",
    schools: Array.isArray(data.schools) ? data.schools : [],
    resoFacts: {
      flooring: safeStringify(data.resoFacts?.flooring),
      foundationDetails: safeStringify(data.resoFacts?.foundationDetails),
      rooms: safeStringify(data.resoFacts?.rooms),
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
    }
  };

  setCache(`data_${normalizedKey}`, mappedData);
  return mappedData;
};
