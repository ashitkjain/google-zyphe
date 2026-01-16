

export interface StatusOption {
  label: string;
  description: string;
  isDefault?: boolean;
  funnelStage?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'buyer' | 'seller' | 'realtor';
  address?: string;
  realtorId?: string;
  phoneNumber?: string;
  assignedTo?: string; // For team scaling
  smsConsent?: boolean;
  smsConsentTimestamp?: any;
  funnelStage?: FunnelStage;
  health?: LeadHealth;
  conversionDate?: any; // Date they moved from Lead to Client
  minPrice?: number;
  maxPrice?: number;
  isMock?: boolean;
  createdAt?: any;
  kyc?: KYCData;
  settings?: {
    leadStatuses?: {
      buyer: StatusOption[];
      seller: StatusOption[];
    };
    columnSettings?: {
      [key: string]: string[]; // Keyed by 'LeadType:FunnelStage' or just 'LeadType'
    };
  };
}

export type LeadSource = 'Zillow' | 'Realtor.com' | 'Facebook' | 'Website' | 'Manual' | 'Referral' | 'Instagram' | 'Google' | 'Direct';
export type LeadStatus = string; // Changed from union to string to support custom statuses

export type FunnelStage =
  | 'Leads'         // Initial inquiry/Lead
  | 'Nurture'       // Long-term follow-up
  | 'Active Search' // Currently viewing homes
  | 'Offer'         // Offer submitted
  | 'Contract'      // Under contract
  | 'Closed'        // Deal finalized
  | 'Archived';      // Hidden/Archived leads

export type LeadHealth = 'Active' | 'Stale' | 'Dormant' | 'Responsive';

export type LeadType = 'Buyer' | 'Seller' | 'Rental' | 'Mortgage';
export type ConnectionType = 'Direct Lead' | 'Live Connection' | 'Nurture';

export interface LeadNote {
  id: string;
  content: string;
  timestamp: any;
  author?: string;
  color?: string;
  isDone?: boolean;
  isUrgent?: boolean;
}

export interface ShortlistedProperty {
  id: string;
  address: string;
  price: number;
  isHot?: boolean;
}

export interface ActivityEvent {
  id: string;
  address: string; // Or "Phone Call", "Office Meeting"
  timestamp: any;
  viewCount?: number;
  type: 'Property View' | 'Meeting' | 'Call' | 'Other';
}

export interface DocumentChecklistItem {
  id: string;
  name: string;
  status: 'Signed' | 'Pending' | 'Missing';
}

export interface CallNote {
  callNumber: number; // Which call this note is for (1st, 2nd, 3rd, etc.)
  note: string;
  timestamp: any;
  duration?: number; // Call duration in seconds
  outcome?: 'Connected' | 'Voicemail' | 'No Answer' | 'Busy' | 'Wrong Number';
}

export interface KYCData {
  // 1. Client Profiles & Preferences
  dealBreakers?: string[];
  neighborhoodTargets?: string[];
  schoolDistricts?: string[];
  lenderName?: string;
  lenderContact?: string;
  isAllCash?: boolean;
  birthdays?: string; // Flexible format for now
  homeAnniversary?: string;
  familyPetsDetails?: string;
  communicationPreferenceNotes?: string;

  // 2. Lead Management
  leadScore?: number;
  nurtureDetail?: 'Cold' | 'Warm' | 'Hot';
  slaMinutesTarget?: number;

  // 3. Transaction Pipeline
  transactionStage?: 'Listing' | 'Under Contract' | 'Inspection' | 'Appraisal' | 'Closing';
  inspectionDeadline?: any;
  appraisalDeadline?: any;
  loanCommitmentDeadline?: any;
  documentChecklist?: DocumentChecklistItem[];

  // 4. Manual Agent Entries
  shortlist?: ShortlistedProperty[];
  activityFeed?: ActivityEvent[];
}

export interface Lead {
  id: string;
  // 1. Contact Information
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  email: string;
  phone: string;
  homeAddress?: string;
  preferredContactMethod?: 'Call' | 'Text' | 'Email';

  // 2. Readiness & Context
  message?: string;
  preApprovalStatus?: boolean;
  timeframe?: string;
  hasHomeToSell?: boolean;
  tourRequestDate?: any;
  tourRequestTime?: string;

  // Lead Context from UI requirements (Buyer & Seller)
  isAlsoBuying?: boolean;
  isAlsoSelling?: boolean;
  gender?: string;
  existingAgentName?: string;
  reasonForSelling?: string;
  homeValueNeeded?: boolean;
  mostImportantToSeller?: string;
  sellWhen?: string;
  occupancyStatus?: string;
  expectedPrice?: number;

  // Buyer specific context
  dealStage?: string;
  leaseEndDate?: any;
  preQualified?: boolean;
  budgetRange?: string;
  preferredNeighborhood?: string;
  dealStatus?: 'Won' | 'Lost' | string;

  // 3. Property Details (Subject Property)
  propertyAddress?: string;
  zpid?: string;
  price?: number;
  minPrice?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  maxPrice?: number;
  callCount?: number;
  callNotes?: CallNote[]; // Notes for specific calls (sparse - not all calls need notes)

  daysOnZillow?: number;
  mlsNumber?: string;
  subjectProperty?: string; // The actual property being transacted (initially populated from propertyAddress)
  offerCount?: number; // Number of offers made (for buyers) or received (for sellers)

  // 4. System Metadata & Source
  source: LeadSource; // e.g. Zillow, Trulia, etc.
  leadType: LeadType;
  connectionType: ConnectionType;
  status: LeadStatus;
  receivedAt: any;
  lastTouch?: any;
  slaUrgency: 'low' | 'medium' | 'high';
  assignedTo?: string;
  channel?: 'Email' | 'API' | 'Manual' | 'CRM' | 'Others';
  lastUpdated?: any;
  tags?: string[];
  notes?: string;
  stageLastChangedAt?: any;
  initialContactIn30Mins?: boolean;
  notesLog?: LeadNote[];
  smsConsent?: boolean;
  smsConsentTimestamp?: any;
  funnelStage: FunnelStage;
  health: LeadHealth;
  isMock?: boolean;
  archivedAt?: any;
  activatedAt?: any;
  closedAt?: any;
  collectionName?: string;
  kyc?: KYCData;
  clientId?: string;
}

export interface JourneyEvent {
  id: string;
  clientId: string;
  fromStage: FunnelStage;
  toStage: FunnelStage;
  timestamp: any;
  reason?: string;
  realtorId: string;
}

export interface Transaction {
  id: string;
  clientId: string;
  address: string;
  price: number;
  status: 'Pre-Listing' | 'Active' | 'Under Contract' | 'Closed' | 'Cancelled';
  commission?: number;
  closeDate?: any;
  checklist: CRMTask[];
}

export interface CRMTask {
  id: string;
  clientId?: string;
  realtorId: string;
  title: string;
  description?: string;
  dueDate: any;
  status: 'Pending' | 'Completed';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  type: 'Call' | 'Email' | 'Showing' | 'Follow-up' | 'Closing';
  isMock?: boolean;
}

export type ReminderRuleCategory = 'lead' | 'buyer' | 'seller' | 'relationship';
export type ReminderRuleUrgency = 'high' | 'medium' | 'low';
export type ReminderRuleOperator = '>' | '<' | '=' | '>=' | '<=' | 'exists' | 'not_exists' | 'contains';

export interface ReminderRule {
  id: string;
  name: string;

  // Human-readable display (shown in UI)
  trigger: string;
  condition: string;

  // Executable mappings (for backend processing)
  triggerField?: string; // e.g., 'leads.receivedAt', 'leads.offerAcceptedAt'
  conditionField?: string; // e.g., 'leads.lastTouch', 'leads.tourBookedAt'
  operator?: ReminderRuleOperator; // e.g., '>', '<', '=', 'exists'
  value?: string | number; // e.g., '5 minutes', '24 hours', 2
  comparisonField?: string; // For comparing two fields, e.g., 'NOW()' or 'leads.updatedAt'

  urgency: ReminderRuleUrgency;
  category: ReminderRuleCategory;
  suggested_action: string;
  suggested_message: string;
  enabled: boolean;
  realtorId: string;
}

export interface PipelineNote {
  id: string;
  leadId: string;
  realtorId: string;
  content: string;
  color: string;
  timestamp: any;
  isDone?: boolean;
  isUrgent?: boolean;
}

export interface ActivityNote {
  id: string;
  clientId: string;
  authorId: string;
  content: string;
  timestamp: any;
  type: 'Note' | 'Email' | 'Call' | 'SMS' | 'System';
}

export type CommChannel = 'SMS' | 'Email' | 'Call';

export interface CommMessage {
  id: string;
  threadId: string;
  senderId: string;   // Maps to User.uid or Realtor.uid
  receiverId: string; // Maps to User.uid or Realtor.uid
  content: string;
  timestamp: any;
  channel: CommChannel;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  providerId?: string; // e.g. Telnyx Message ID
  recordingUrl?: string; // For call logs/voicemail drops
  attachments?: string[];
  clientId?: string;   // Direct mapping to the consumer
  realtorId?: string;  // Direct mapping to the agent
}

export interface CommThread {
  id: string;
  clientId: string;
  realtorId: string;
  lastMessage?: string;
  lastTimestamp?: any;
  channel: CommChannel;
  unreadCount: number;
}

export interface CommTemplate {
  id: string;
  name: string;
  content: string;
  channel: CommChannel;
  category: 'Follow-up' | 'Introduction' | 'Viewing' | 'Closing';
  isMock?: boolean;
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
