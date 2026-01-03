
import { PropertyData } from "../types";

// Note: Using the key provided in the prompt example for demonstration
const RAPID_API_KEY = "ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f";
const RAPID_API_HOST = "us-housing-market-data1.p.rapidapi.com";

const getCache = <T>(key: string): T | null => {
  const cached = sessionStorage.getItem(`prop_cache_${key}`);
  return cached ? JSON.parse(cached) : null;
};

const setCache = (key: string, data: any) => {
  sessionStorage.setItem(`prop_cache_${key}`, JSON.stringify(data));
};

/**
 * Safely extracts a numeric value from potential API response types.
 * API sometimes returns a number, sometimes an object like { value: 5, label: 'Moderate', max: 10 }
 */
const extractNumericValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'value' in val) {
    const numeric = Number(val.value);
    return isNaN(numeric) ? 0 : numeric;
  }
  return 0;
};

/**
 * Converts various API field types (arrays, objects, numbers) into a displayable string
 * to prevent React "object as child" errors while ensuring data is shown.
 */
const safeStringify = (val: any): string | undefined => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    return val.map(item => (typeof item === 'object' ? JSON.stringify(item) : item)).join(', ');
  }
  if (typeof val === 'object') {
    // If it's a simple object with a 'label' or 'text' property, use that.
    if ('label' in val) return String(val.label);
    if ('text' in val) return String(val.text);
    return JSON.stringify(val);
  }
  return String(val);
};

export const normalizeAddress = async (address: string): Promise<string> => {
  try {
    const cacheKey = `normalize_${address}`;
    const cached = getCache<string>(cacheKey);
    if (cached) return cached;

    // Simulate Radar API normalization
    await new Promise(r => setTimeout(r, 400));
    setCache(cacheKey, address);
    return address;
  } catch (e) {
    console.error("Radar normalization failed", e);
    return address;
  }
};

export const fetchPropertyImages = async (zpid: string): Promise<string[]> => {
  try {
    const cacheKey = `images_${zpid}`;
    const cached = getCache<string[]>(cacheKey);
    if (cached) {
      console.log(`📦 Returning cached images for zpid: ${zpid}`);
      return cached;
    }

    console.log(`📸 Fetching real images for zpid: ${zpid}`);
    const response = await fetch(`https://us-housing-market-data1.p.rapidapi.com/images?zpid=${zpid}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPID_API_HOST,
        'x-rapidapi-key': RAPID_API_KEY,
      },
    });

    if (!response.ok) throw new Error(`Images API error: ${response.status}`);
    
    const data = await response.json();
    const images = Array.isArray(data) ? data : (data.images || []);
    
    setCache(cacheKey, images);
    return images;
  } catch (error) {
    console.error("Error fetching images:", error);
    return [];
  }
};

export const fetchPropertyData = async (address: string): Promise<PropertyData> => {
  const cacheKey = `data_${address}`;
  const cached = getCache<PropertyData>(cacheKey);
  if (cached) {
    console.log(`📦 Returning cached property data for: ${address}`);
    return cached;
  }

  const response = await fetch(`https://us-housing-market-data1.p.rapidapi.com/property?address=${encodeURIComponent(address)}`, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPID_API_HOST,
      'x-rapidapi-key': RAPID_API_KEY,
    },
  });

  if (!response.ok) throw new Error(`Property API error: ${response.status}`);
  
  const data = await response.json();
  
  // Map API response to our internal PropertyData structure
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
    heatRiskScore: extractNumericValue(data.climate?.heatSources?.primary?.riskScore),
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
    }
  };

  setCache(cacheKey, mappedData);
  return mappedData;
};
