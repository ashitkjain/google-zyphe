
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
  images?: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  mapZoomIn?: string;
  mapZoomOut?: string;
}

export interface RadarGeocodeResponse {
  coordinates: {
    latitude: number;
    longitude: number;
  };
  formattedAddress: string;
  components: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  mapZoomIn?: string;
  mapZoomOut?: string;
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

export interface NeighborhoodAnalysis {
  overview: string;
  neighborhood_features: {
    street_layout_and_traffic: string;
    sidewalks_and_pedestrian_infra: string;
    proximity_to_greenery_and_water: string;
    neighborhood_density: string;
    walkability_indicators: string;
    topography: string;
    development_patterns: string;
    nearby_amenities: string;
    transportation_access: string;
    general: string;
  }
}

export interface CommunityPulseSection {
  summary: string;
  points: string[];
  sources: string[];
}

export interface CommunityPulseResult {
  what_residents_like: CommunityPulseSection;
  common_complaints: CommunityPulseSection;
  safety_and_concerns: CommunityPulseSection;
  schools_family_friendliness: CommunityPulseSection;
  lifestyle_convenience: CommunityPulseSection;
  investment_insights: CommunityPulseSection;
}

export interface CustomAIAnalysisResult {
  report_title: string;
  home_interior: {
    overall_description: string;
    design_style: {
      style: string;
      reasoning: string;
    };
    color_and_materials: string;
    lighting: string;
    spatial_flow: string;
    staging_and_furnishings: string;
    condition_and_finish: string;
    suggested_lifestyle: {
      lifestyle: string;
      buyer_type: string;
    };
  };
  room_highlights: Array<{
    room_name: string;
    floor: string;
    description: string;
    potential_improvements: string;
  }>;
  exterior_and_neighborhood: {
    exterior_and_lot_appeal: {
      architecture_style: string;
      curb_appeal: string;
      backyard_and_patio: string;
    };
    views_privacy_orientation: {
      views: string;
      orientation: string;
      privacy: string;
    };
  };
  neighborhood?: NeighborhoodAnalysis;
  community_pulse?: CommunityPulseResult;
}

export interface LogEntry {
  timestamp: string;
  service: string;
  type: 'request' | 'response' | 'error';
  content: any;
}
