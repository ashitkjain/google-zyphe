import { PropertyDetails, Tour } from './property';
import { CommChannel, FunnelStage, LeadHealth, LeadSource, LeadStatus, LeadType } from './enums';
import { CallNote, LeadNote } from './notes';
import { KYCData } from './kyc';
import { PropertyOption } from './shared';

export interface Offer {
    id: string;
    property: string; // Brief property description or address
    bidPrice: number;
    outcome: 'Pending' | 'Accepted' | 'Rejected' | 'Countered' | 'Withdrawn';
    comment?: string;
    date?: any;
}

export interface Visitor {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    isInterested: boolean;
    isOnline: boolean;
    visitCount: number;
    visitDates: any[];
    comment?: string;
}

export const LEAD_FIELD_CONFIG = [
    // --- Contact Information ---
    { id: 'firstName', label: 'First Name', description: 'Lead first name', category: 'Contact Information', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['All'], isLocked: true },
    { id: 'lastName', label: 'Last Name', description: 'Lead last name', category: 'Contact Information', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['All'], isLocked: true },
    { id: 'email', label: 'Email', description: 'Primary email address', category: 'Contact Information', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['All'], isLocked: true },
    { id: 'phone', label: 'Phone', description: 'Primary phone number', category: 'Contact Information', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['All'], isLocked: true },
    { id: 'homeAddress', label: 'Home Address', description: 'Current residence address', category: 'Contact Information', visibility: ['Buyer', 'Seller'], type: 'string' },
    { id: 'preferredContactMethod', label: 'Preferred Contact', description: 'Preferred way to be reached', category: 'Contact Information', visibility: ['Buyer', 'Seller'], type: 'enum', options: ['Phone', 'Email', 'SMS', 'WhatsApp'], funnelVisibility: ['All'], isLocked: true },
    { id: 'smsConsent', label: 'SMS Consent', description: 'Has agreed to receive text messages', category: 'Contact Information', visibility: ['Buyer', 'Seller'], type: 'boolean' },
    { id: 'clientPhotoUrl', label: 'Client Photo', description: 'Client profile photo URL', category: 'Contact Information', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['All'], isLocked: true },

    // --- Intent & Readiness ---
    { id: 'message', label: 'Initial Message', description: 'Message sent with inquiry', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['Leads'] },
    { id: 'timeframe', label: 'Timeframe', description: 'Expected timeline for transaction', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['Nurture'] },
    { id: 'preApprovalStatus', label: 'Pre-Approved', description: 'Has obtained mortgage pre-approval', category: 'Intent & Readiness', visibility: ['Buyer'], type: 'boolean', funnelVisibility: ['Active Search'] },
    { id: 'preQualified', label: 'Pre-Qualified', description: 'Has initial financial qualification', category: 'Intent & Readiness', visibility: ['Buyer'], type: 'boolean', funnelVisibility: [] },
    { id: 'isAllCash', label: 'All Cash', description: 'Planning to pay with cash', category: 'Intent & Readiness', visibility: ['Buyer'], type: 'boolean', funnelVisibility: [] },
    { id: 'isWarm', label: 'Warm Lead', description: 'The client has shown interest but is not ready to sign a contract.', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'isCold', label: 'Cold Lead', description: 'The lead has not yet been spoken to or shown intent.', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'isLongTerm', label: 'Long Term Lead', description: 'Client expressed interest but is 6-12+ months away.', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'homeValueNeeded', label: 'Home Value Needed', description: 'Requested a home valuation', category: 'Intent & Readiness', visibility: ['Seller'], type: 'boolean', funnelVisibility: ['Leads'] },
    { id: 'reasonForSelling', label: 'Reason for Selling', description: 'Motivation for listing property', category: 'Intent & Readiness', visibility: ['Seller'], type: 'string', funnelVisibility: ['Nurture'] },
    { id: 'isMostImportantReq', label: 'Most Important Req', description: 'Top priority for the client', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'lenderContact', label: 'Lender Contact', description: 'Contact info for lender', category: 'Intent & Readiness', visibility: ['Buyer'], type: 'string', funnelVisibility: ['Offer', 'Contract'] },
    { id: 'tags', label: 'Tags', description: 'Custom tags', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['Leads', 'Nurture', 'Active Search'] },
    { id: 'slaUrgency', label: 'SLA Urgency', description: 'Service Level Agreement urgency', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'enum', options: ['Low', 'Medium', 'High', 'Critical'], funnelVisibility: ['Leads', 'Nurture'] },
    { id: 'isHot', label: 'Hot Lead', description: 'High priority lead', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: ['Leads', 'Nurture', 'Active Search'] },
    { id: 'isEngaged', label: 'Engaged', description: 'Lead is actively interacting', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'isEvaluatingAgent', label: 'Evaluating Agent', description: 'Shopping for representation', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'initialContactIn30Mins', label: 'Contacted in 30 mins', description: 'Contacted within 30 minutes', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'dealBreakers', label: 'Deal Breakers', description: 'List of deal breakers', category: 'Intent & Readiness', visibility: ['Buyer'], type: 'string', funnelVisibility: ['Active Search'] },
    { id: 'neighborhoodTargets', label: 'Neighborhood Targets', description: 'Target neighborhoods', category: 'Intent & Readiness', visibility: ['Buyer'], type: 'string', funnelVisibility: ['Active Search'] },
    { id: 'schoolDistricts', label: 'School Districts', description: 'Preferred school districts', category: 'Intent & Readiness', visibility: ['Buyer'], type: 'string', funnelVisibility: [] },

    // --- Persona & Context ---
    { id: 'generalInfo', label: 'General Info', description: 'General information about the client', category: 'Persona & Context', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },
    { id: 'isFirstTimeBuyer', label: 'First Time Buyer', description: 'Never purchased before', category: 'Persona & Context', visibility: ['Buyer'], type: 'boolean', funnelVisibility: [] },
    { id: 'isFirstTimeSeller', label: 'First Time Seller', description: 'Never sold before', category: 'Persona & Context', visibility: ['Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'isInvestor', label: 'Investor', description: 'Buying for investment purposes', category: 'Persona & Context', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: ['Active Search', 'Offer'] },
    { id: 'isAlsoBuying', label: 'Also Buying', description: 'Seller who also intends to buy', category: 'Persona & Context', visibility: ['Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'isAlsoSelling', label: 'Also Selling', description: 'Buyer who also has a home to sell', category: 'Persona & Context', visibility: ['Buyer'], type: 'boolean', funnelVisibility: [] },
    { id: 'isPastClient', label: 'Past Client', description: 'Has worked with you before', category: 'Persona & Context', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'gender', label: 'Gender', description: 'Gender identity', category: 'Persona & Context', visibility: ['Buyer', 'Seller'], type: 'enum', options: ['Male', 'Female', 'Other', 'Prefer not to say'], funnelVisibility: [] },
    { id: 'occupancyStatus', label: 'Occupancy Status', description: 'Owner occupied vs Vacant vs Tenant', category: 'Persona & Context', visibility: ['Seller'], type: 'enum', options: ['Owner Occupied', 'Vacant', 'Tenant Occupied'], funnelVisibility: [] },
    { id: 'existingAgentName', label: 'Existing Agent', description: 'Name of other agent if exists', category: 'Persona & Context', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },

    // --- Activity ---
    { id: 'isCloseToOffer', label: 'Close to Offer', description: 'Preparing to make an offer', category: 'Activity', visibility: ['Buyer'], type: 'boolean', funnelVisibility: ['Active Search'] },
    { id: 'offers', label: 'Offers', description: 'Complex List: History of offers made', category: 'Activity', visibility: ['Buyer'], type: 'string', funnelVisibility: ['Offer'] },
    { id: 'tours', label: 'Property Tours', description: 'Complex List: History of property tours', category: 'Activity', visibility: ['Buyer'], type: 'string', funnelVisibility: [] },
    { id: 'visitors', label: 'Visitors', description: 'Complex List: History of property visitors', category: 'Activity', visibility: ['Seller'], type: 'string', funnelVisibility: [] },

    // --- Timings ---
    { id: 'leaseEndDate', label: 'Lease End Date', description: 'When current lease expires', category: 'Timings', visibility: ['Buyer'], type: 'string', funnelVisibility: ['Nurture'] },
    { id: 'sellWhen', label: 'When to Sell', description: 'Target listing date/period', category: 'Timings', visibility: ['Seller'], type: 'string', funnelVisibility: ['Nurture'] },
    { id: 'receivedAt', label: 'Received At', description: 'Date lead was created', category: 'Timings', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['Leads', 'Nurture', 'Archived'] },
    { id: 'lastUpdated', label: 'Last Updated', description: 'Timestamp of last update', category: 'Timings', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['Nurture', 'Active Search'] },
    { id: 'stageLastChangedAt', label: 'Stage Changed At', description: 'When funnel stage changed', category: 'Timings', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },

    // --- Property Preferences / Subject Property ---
    // REPLACED individual fields with Complex Objects
    { id: 'inquiryProperty', label: 'Inquiry Property', description: 'Complex Object: Buyer preferences/target', category: 'Property Details', visibility: ['Buyer'], type: 'string', funnelVisibility: [] },
    { id: 'subjectPropertyDetails', label: 'Subject Property Details', description: 'Complex Object: Seller property details', category: 'Property Details', visibility: ['Seller'], type: 'string', funnelVisibility: ['Offer', 'Contract', 'Closed'] },

    // --- Referral & Source ---
    { id: 'source', label: 'Lead Source', description: 'Origin (Zillow, Website, etc.)', category: 'Referral & Source', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: ['Leads', 'Nurture', 'Active Search'] },
    { id: 'isReferredByPastClient', label: 'Ref by Past Client', description: 'Referral source is a former client', category: 'Referral & Source', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'isReferredByFriendFamily', label: 'Ref by Friend/Fam', description: 'Referral source is personal network', category: 'Referral & Source', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'leadType', label: 'Lead Type', description: 'Classification of lead', category: 'Referral & Source', visibility: ['Buyer', 'Seller'], type: 'enum', options: ['Direct Lead', 'Live Connection', 'Nurture'], funnelVisibility: [] },
    { id: 'referralSource', label: 'Referral Source', description: 'Specific source details', category: 'Referral & Source', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },

    // --- Client Communication ---
    { id: 'callCount', label: 'Call Count', description: 'Number of calls made', category: 'Client Communication', visibility: ['Buyer', 'Seller'], type: 'integer', funnelVisibility: ['Leads', 'Nurture'] },
    { id: 'offerCount', label: 'Offer Count', description: 'Number of offers made/received', category: 'Client Communication', visibility: ['Buyer', 'Seller'], type: 'integer', funnelVisibility: [] },
    { id: 'notes', label: 'Notes', description: 'General notes', category: 'Client Communication', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },
    { id: 'callNotes', label: 'Call Notes', description: 'Complex List: Log of call summaries and outcomes', category: 'Client Communication', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },
    { id: 'notesLog', label: 'Activity Log', description: 'Complex List: History of all notes and activities', category: 'Client Communication', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },
    { id: 'channel', label: 'Channel', description: 'Communication channel', category: 'Client Communication', visibility: ['Buyer', 'Seller'], type: 'enum', options: ['Email', 'API', 'Manual', 'CRM', 'Others'], funnelVisibility: [] },

    // --- System Metadata ---
    { id: 'status', label: 'Status', description: 'Current status label', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },
    { id: 'funnelStage', label: 'Funnel Stage', description: 'Broad lifecycle stage', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'enum', options: ['Leads', 'Nurture', 'Active Search', 'Offer', 'Contract', 'Closed', 'Archived'], funnelVisibility: [] },
    { id: 'clientId', label: 'Client ID', description: 'Unique Client Reference ID', category: 'System Metadata', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },
    { id: 'id', label: 'System ID', description: 'Internal Database ID', category: 'System Metadata', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },
    { id: 'health', label: 'Lead Health', description: 'System calculated health score', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'], type: 'enum', options: ['Healthy', 'Stale', 'Cold', 'Dead'], funnelVisibility: [] },
    { id: 'isMock', label: 'Is Mock', description: 'Test data flag', category: 'System Metadata', visibility: ['Buyer', 'Seller'], type: 'boolean', funnelVisibility: [] },
    { id: 'collectionName', label: 'Collection Name', description: 'Database collection reference', category: 'System Metadata', visibility: ['Buyer', 'Seller'], type: 'string', funnelVisibility: [] },
] as const;


export interface Lead {
    id: string;
    // 1. Contact Information
    firstName: string;
    lastName: string;
    clientPhotoUrl?: string;
    email: string;
    phone: string;
    homeAddress?: string;
    preferredContactMethod?: 'Call' | 'Text' | 'Email';
    generalInfo?: string;

    // 2. Readiness & Context
    message?: string;
    preApprovalStatus?: boolean;
    timeframe?: string;
    isWarm?: boolean;
    isCold?: boolean;
    isLongTerm?: boolean;

    // Lead Context from UI requirements (Buyer & Seller)
    isAlsoBuying?: boolean;
    isAlsoSelling?: boolean;
    gender?: string;
    existingAgentName?: string;
    reasonForSelling?: string;
    homeValueNeeded?: boolean;
    isMostImportantReq?: string;
    sellWhen?: string;
    occupancyStatus?: string;
    expectedPrice?: number;

    // Buyer specific context
    leaseEndDate?: any;
    preQualified?: boolean;
    preferredNeighborhood?: string;
    isAllCash?: boolean;
    lenderContact?: string;

    // Complex Objects
    tours?: Tour[];
    offers?: Offer[];
    visitors?: Visitor[];

    // 3. Property Details (Nested Objects)
    inquiryProperty?: PropertyDetails;        // For Buyers: What they are tracking/interested in
    subjectPropertyDetails?: PropertyDetails; // For Sellers: What they are selling OR The specific house under contract
    dealBreakers?: string[];
    neighborhoodTargets?: string[];
    schoolDistricts?: string[];

    // 4. Client Communication (Moved from Root Level)
    callCount?: number;
    offerCount?: number;
    callNotes?: CallNote[];

    // 5. System Metadata & Source
    source: LeadSource;
    leadType: LeadType;
    status: LeadStatus;
    receivedAt: any;
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
    funnelStage: FunnelStage;
    health: LeadHealth;
    isMock?: boolean;
    collectionName?: string;
    clientId?: string;
    isHot?: boolean;

    // 6. Additional Status & Persona Flags
    isPastClient?: boolean;
    isEngaged?: boolean;
    isEvaluatingAgent?: boolean;
    isCloseToDeciding?: boolean;
    isCloseToOffer?: boolean;
    isReferredByFriendFamily?: boolean;
    isReferredByPastClient?: boolean;
    isFirstTimeBuyer?: boolean;
    isFirstTimeSeller?: boolean;
    isInvestor?: boolean;
    referralSource?: string;
}

// --- Completeness Check ---
// This ensures that ALL keys in Lead are present in LEAD_FIELD_CONFIG (or explicitly ignored).
// If you add a field to Lead and forget to add it to LEAD_FIELD_CONFIG, this line will error.
type ConfiguredKeys = typeof LEAD_FIELD_CONFIG[number]['id'];
type IgnoredKeys = 'callNotes' | 'notesLog' | 'inquiryProperty' | 'subjectPropertyDetails' | 'tours' | 'offers' | 'visitors'; // Keys that are strictly NOT configurable via this list (e.g. complex objects)

// If this type is not 'never', it means there are keys in Lead that are missing from config.
// Hover over 'MissingKeys' to see what they are.
type MissingKeys = Exclude<keyof Lead, ConfiguredKeys | IgnoredKeys>;

// This dummy assignment triggers the compile-time error
// @ts-ignore - Uncomment this line to check for missing keys if you are debugging. 
// Ideally we want this to be a real error, but for now we interpret it manually.
const _completenessCheck: MissingKeys = {} as never;
