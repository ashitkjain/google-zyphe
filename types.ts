

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'buyer' | 'seller' | 'realtor';
  address?: string;
  createdAt: any;
}

export interface PropertyData {
  zpid?: string;
  address: string;
  city?: string;
  homeStatus?: string;
  homeType?: string;
  livingAreaValue?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yearBuilt?: number | null;
  lotSize?: string;
  description?: string;
  price?: number | null;
  zestimate?: number | null;
  rentZestimate?: number | null;
  propertyTaxRate?: number | null;
  annualHomeownersInsurance?: number | null;
  windRiskScore?: number | null;
  floodRiskScore?: number | null;
  fireRiskScore?: number | null;
  heatRiskScore?: number | null;
  walkScore?: number | null;
  walkScoreDesc?: string;
  transitScore?: number | null;
  transitScoreDesc?: string;
  bikeScore?: number | null;
  bikeScoreDesc?: string;
  schools?: School[];
  nearbyHomes?: any[];
  homeInsights?: any;
  timeOnZillow?: number | null;
  resoFacts?: ResoFacts;
  images?: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  mapZoomIn?: string;
  mapZoomOut?: string;
  listedDate?: string | number;
  comps?: PropertyComp[];
  priceHistory?: PriceHistoryItem[];
  // AI fields for cloud caching
  analysis?: AIAnalysisResult;
  visual_analysis?: CustomAIAnalysisResult;
  comprehensive_analysis?: ComprehensiveAnalysisResult;
}

export interface PropertyComp {
  zpid: string;
  address: string;
  price?: number | null;
  listPrice?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  livingAreaValue?: number | null;
  yearBuilt?: number | null;
  distance?: number | null;
  daysOnMarket?: number | null;
  status?: string;
  images?: string[];
  homeType?: string;
  lastSoldPrice?: number | null;
  lastSoldDate?: string;
  lotSize?: string;
  lotAreaValue?: number | null;
  lotAreaUnit?: string;
  garageSpaces?: number | null;
  pricePerSqFt?: number | null;
  description?: string;
  hoaFees?: number | null;
}

export interface PriceHistoryItem {
  date: string;
  price: number | null;
  event: string;
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
  roomTypes?: string;
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
  sewer?: string;
  waterSource?: string;
  basement?: string;
  securityFeatures?: string;
  windowFeatures?: string;
  roomFeatures?: string;
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

export interface ImageQualityPoint {
  text: string;
  image_indices: number[];
}

export interface ImageQualityCategory {
  rating: string;
  observations: ImageQualityPoint[];
  issues: ImageQualityPoint[];
}

export interface ImageQualityAnalysisResult {
  overall_score: {
    score: number;
    summary: string;
  };
  top_photos: Array<{
    image_index: number;
    label: string;
    justification: string;
  }>;
  lighting_and_color: ImageQualityCategory;
  staging_and_clutter: ImageQualityCategory;
  composition: ImageQualityCategory;
  delete_list: {
    count: number;
    reasons: string[];
    image_indices: number[];
    description: string;
  };
  action_plan: {
    priority_actions: string[];
    editing_suggestions: string[];
    reshoot_suggestions: string[];
  };
}

export interface InvestmentResearchResult {
  market_performance: {
    occupancy_rate: string;
    adr: string;
    summary: string;
  };
  competitor_gaps: {
    friction_points: string[];
    praised_amenities: string[];
    standout_recommendations: string;
  };
  regulatory_updates: {
    laws_and_zoning: string;
    permit_caps: string;
    summary: string;
  };
  demand_drivers: Array<{
    event: string;
    date: string;
    pricing_impact: string;
  }>;
  revenue_projection_2026: Array<{
    period: string;
    projected_revenue: string;
    occupancy_estimate: string;
  }>;
  web_sources: Array<{
    title: string;
    url: string;
  }>;
}

export interface BiddingStrategyResult {
  property_specifics: {
    days_on_market: string;
    listing_history: string[] | string;
    price_changes: string;
  };
  zip_code_benchmarks: {
    median_days_on_market: string;
  };
  inventory_pressure: {
    months_of_supply: string;
    market_category: 'Strong Seller' | 'Balanced' | 'Buyer-Friendly' | string;
    pressure_analysis: string;
  };
  offer_velocity: {
    velocity_status: string;
    recent_offer_trends: string;
  };
  negotiation_strategy: {
    leverage_analysis: string;
    suggested_offer_tactics: string[];
    calculated_discount_strategy: string;
  };
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
  image_quality_analysis?: ImageQualityAnalysisResult;
  investment_research?: InvestmentResearchResult;
  bidding_strategy?: BiddingStrategyResult;
}

export interface ComprehensiveAnalysisResult {
  summary: string;
  detailed_analysis: {
    location_neighborhood: string;
    outdoors_view_quality: string;
    visual_appeal_condition: string;
    privacy_layout: string;
    climate_resilience: string;
    additional_considerations: string;
  };
  risks_considerations: string;
}

export interface LogEntry {
  timestamp: string;
  service: string;
  type: 'request' | 'response' | 'error' | 'info';
  content: any;
}
