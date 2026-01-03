
export interface PropertyData {
  zpid?: string;
  address: string;
  homeStatus?: string;
  homeType?: string;
  livingAreaValue?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  lotSize?: string;
  description?: string;
  price?: number;
  zestimate?: number;
  rentZestimate?: number;
  propertyTaxRate?: number;
  annualHomeownersInsurance?: number;
  windRiskScore?: number;
  floodRiskScore?: number;
  fireRiskScore?: number;
  heatRiskScore?: number;
  schools?: School[];
  nearbyHomes?: any[];
  homeInsights?: any;
  timeOnZillow?: number;
  resoFacts?: ResoFacts;
  images?: string[]; // Added for property photos
}

export interface School {
  name: string;
  level: string;
  rating: string | number;
  distance: string;
}

export interface ResoFacts {
  flooring?: string;
  foundationDetails?: string;
  rooms?: string;
  feesAndDues?: string;
  exteriorFeatures?: string;
  architecturalStyle?: string;
  garageParkingCapacity?: number | string;
  lotFeatures?: string;
  roofType?: string;
  daysOnZillow?: number;
  zoningDescription?: string;
  constructionMaterials?: string;
  fireplaceFeatures?: string;
  appliances?: string;
  fencing?: string;
  cooling?: string;
  laundryFeatures?: string;
  heating?: string;
  mlsid?: string;
  utilities?: string;
  basement?: string;
}

export interface AIAnalysisResult {
  buyerAnalysis: string;
  sellerStrategy: string;
  realtorPitch: string;
  marketOutlook: string;
}

export interface LogEntry {
  timestamp: string;
  service: string;
  type: 'request' | 'response' | 'error';
  content: any;
}
