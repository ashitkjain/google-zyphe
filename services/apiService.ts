import { PropertyData, RadarGeocodeResponse } from "../types";
import { savePropertyToCloud, getPropertyByAddress } from "./firebaseService";

// Security: Use environment variables for sensitive API keys
const RAPID_API_KEY = process.env.RAPID_API_KEY || "ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f";
const RAPID_API_HOST = process.env.RAPID_API_HOST || "us-housing-market-data1.p.rapidapi.com";
const RADAR_API_KEY = process.env.RADAR_API_KEY || "prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb";

const extractNumericValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'value' in val) {
    const numeric = Number(val.value);
    return isNaN(numeric) ? 0 : numeric;
  }
  return 0;
};

const safeStringify = (val: any): string | null => {
  if (val === null || val === undefined) return null;
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
  const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}`;
  const geocodeResponse = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': RADAR_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  const geocodeData = await geocodeResponse.json();
  if (!geocodeResponse.ok) {
    throw new Error(`Radar API error: ${geocodeResponse.status}`);
  }
  
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

export const fetchPropertyData = async (address: string): Promise<PropertyData> => {
  // Check Firebase Cloud Cache
  const cloudCached = await getPropertyByAddress(address);
  if (cloudCached) {
    return cloudCached as PropertyData;
  }

  // Fetch from External Housing API
  const url = `https://us-housing-market-data1.p.rapidapi.com/property?address=${encodeURIComponent(address)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPID_API_HOST,
      'x-rapidapi-key': RAPID_API_KEY,
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Property API error: ${response.status}`);
  
  const mappedData: PropertyData = {
    address: typeof data.address === 'string' ? data.address : address,
    zpid: String(data.zpid || ""),
    homeStatus: data.homeStatus || "UNKNOWN",
    homeType: data.homeType || "SINGLE_FAMILY",
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
    description: data.description || "No description available.",
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

  if (mappedData.zpid) {
    savePropertyToCloud(mappedData.zpid, mappedData);
  }

  return mappedData;
};

export const fetchPropertyImages = async (zpid: string): Promise<string[]> => {
  const url = `https://us-housing-market-data1.p.rapidapi.com/images?zpid=${zpid}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPID_API_HOST,
      'x-rapidapi-key': RAPID_API_KEY,
    },
  });

  const data = await response.json();
  if (!response.ok) return [];
  
  const images = Array.isArray(data) ? data : (data.images || []);
  return images;
};
