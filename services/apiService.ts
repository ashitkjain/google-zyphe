
import { PropertyData, RadarGeocodeResponse } from "../types.ts";
import { savePropertyToCloud } from "./firebaseService.ts";

const RAPID_API_KEY = process.env.RAPID_API_KEY || "ba288e5526msh3083368751f58bdp1edc70jsn2c0645803d3f";
const RAPID_API_HOST = process.env.RAPID_API_HOST || "us-housing-market-data1.p.rapidapi.com";
const RADAR_API_KEY = process.env.RADAR_API_KEY || "prj_live_pk_eef2517d56b63939d892c06a7dac57af7f2278cb";

const extractNumericValue = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const numeric = Number(val.replace(/[^0-9.-]/g, ''));
    return isNaN(numeric) ? 0 : numeric;
  }
  if (val && typeof val === 'object' && 'value' in val) {
    const numeric = Number(String(val.value).replace(/[^0-9.-]/g, ''));
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
    cache: 'no-store'
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

export const fetchScores = async (zpid: string): Promise<{ 
  walkScore?: number, walkScoreDesc?: string,
  transitScore?: number, transitScoreDesc?: string,
  bikeScore?: number, bikeScoreDesc?: string 
}> => {
  const url = `https://us-housing-market-data1.p.rapidapi.com/walkAndTransitScore?zpid=${zpid}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPID_API_HOST,
        'x-rapidapi-key': RAPID_API_KEY,
      },
      cache: 'no-store'
    });
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
};

export const fetchPropertyImages = async (zpid: string, retries = 3): Promise<string[]> => {
  const url = `https://us-housing-market-data1.p.rapidapi.com/images?zpid=${zpid}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
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
        if (response.status === 429 && attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error(`Images API Error: ${response.status}`);
      }

      const data = await response.json();
      
      let images: any[] = [];
      if (Array.isArray(data)) {
        images = data;
      } else if (data.images && Array.isArray(data.images)) {
        images = data.images;
      } else if (data.props?.images && Array.isArray(data.props.images)) {
        images = data.props.images;
      } else if (data.property?.images && Array.isArray(data.property.images)) {
        images = data.property.images;
      }

      return images.map((img: any) => {
        if (typeof img === 'string') return img;
        if (typeof img === 'object' && img !== null) {
          return img.url || img.uri || img.src || JSON.stringify(img);
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
};

/**
 * Combined fetch that ensures all sub-data is retrieved before returning
 */
export const fetchPropertyDataFull = async (addressOrZpid: string, isZpid: boolean = false, onStep?: (step: string) => void): Promise<PropertyData> => {
  const url = isZpid 
    ? `https://us-housing-market-data1.p.rapidapi.com/property?zpid=${addressOrZpid}`
    : `https://us-housing-market-data1.p.rapidapi.com/property?address=${encodeURIComponent(addressOrZpid)}`;
  
  onStep?.("Fetching property facts...");
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': RAPID_API_HOST,
      'x-rapidapi-key': RAPID_API_KEY,
    },
    cache: 'no-store'
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Property API error: ${response.status}`);
  
  const rawZpid = isZpid ? addressOrZpid : (data.zpid || data.props?.zpid || (data.properties && data.properties[0]?.zpid));

  const mappedData: PropertyData = {
    address: data.address || data.props?.address || addressOrZpid,
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
    schools: Array.isArray(data.schools) ? data.schools : (data.props?.schools || []),
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
      utilities: safeStringify(data.resoFacts?.utilities),
      sewer: safeStringify(data.resoFacts?.sewer),
      waterSource: safeStringify(data.resoFacts?.waterSource),
    }
  };

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
    const images = await fetchPropertyImages(mappedData.zpid);
    mappedData.images = images;
    
    await savePropertyToCloud(mappedData.zpid, mappedData);
  }

  return mappedData;
};

// Legacy support for address only if needed
export const fetchPropertyData = async (address: string, forceRefresh: boolean = true): Promise<PropertyData> => {
  return fetchPropertyDataFull(address, false);
};
