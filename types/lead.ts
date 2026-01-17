import { CommChannel, ConnectionType, FunnelStage, LeadHealth, LeadSource, LeadStatus, LeadType } from './enums';
import { CallNote, LeadNote } from './notes';
import { KYCData } from './kyc';
import { PropertyOption } from './shared';

export const LEAD_FIELD_CONFIG: PropertyOption[] = [
    // --- Contact Information ---
    { id: 'firstName', label: 'First Name', description: 'Lead first name', category: 'Contact Information', visibility: ['Buyer', 'Seller'] },
    { id: 'lastName', label: 'Last Name', description: 'Lead last name', category: 'Contact Information', visibility: ['Buyer', 'Seller'] },
    { id: 'email', label: 'Email', description: 'Primary email address', category: 'Contact Information', visibility: ['Buyer', 'Seller'] },
    { id: 'phone', label: 'Phone', description: 'Primary phone number', category: 'Contact Information', visibility: ['Buyer', 'Seller'] },
    { id: 'homeAddress', label: 'Home Address', description: 'Current residence address', category: 'Contact Information', visibility: ['Buyer', 'Seller'] },
    { id: 'preferredContactMethod', label: 'Preferred Contact', description: 'Preferred way to be reached', category: 'Contact Information', visibility: ['Buyer', 'Seller'] },
    { id: 'smsConsent', label: 'SMS Consent', description: 'Has agreed to receive text messages', category: 'Contact Information', visibility: ['Buyer', 'Seller'] },
    { id: 'avatarUrl', label: 'Avatar URL', description: 'Profile picture URL', category: 'Contact Information', visibility: ['Buyer', 'Seller'] },

    // --- Intent & Readiness ---
    { id: 'message', label: 'Initial Message', description: 'Message sent with inquiry', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'] },
    { id: 'timeframe', label: 'Timeframe', description: 'Expected timeline for transaction', category: 'Intent & Readiness', visibility: ['Buyer', 'Seller'] },
    { id: 'preApprovalStatus', label: 'Pre-Approved', description: 'Has obtained mortgage pre-approval', category: 'Intent & Readiness', visibility: ['Buyer'] },
    { id: 'preQualified', label: 'Pre-Qualified', description: 'Has initial financial qualification', category: 'Intent & Readiness', visibility: ['Buyer'] },
    { id: 'isAllCash', label: 'All Cash', description: 'Planning to pay with cash', category: 'Intent & Readiness', visibility: ['Buyer'] },
    { id: 'budgetRange', label: 'Budget Range', description: 'Target price range', category: 'Intent & Readiness', visibility: ['Buyer'] },
    { id: 'homeValueNeeded', label: 'Home Value Needed', description: 'Requested a home valuation', category: 'Intent & Readiness', visibility: ['Seller'] },
    { id: 'reasonForSelling', label: 'Reason for Selling', description: 'Motivation for listing property', category: 'Intent & Readiness', visibility: ['Seller'] },
    { id: 'sellWhen', label: 'When to Sell', description: 'Target listing date/period', category: 'Intent & Readiness', visibility: ['Seller'] },
    { id: 'mostImportantToSeller', label: 'Most Important Req', description: 'Top priority for the seller', category: 'Intent & Readiness', visibility: ['Seller'] },
    { id: 'dealStage', label: 'Deal Stage', description: 'Current stage of the deal', category: 'Intent & Readiness', visibility: ['Buyer'] },
    { id: 'dealStatus', label: 'Deal Status', description: 'Won/Lost status', category: 'Intent & Readiness', visibility: ['Buyer'] },
    { id: 'leaseEndDate', label: 'Lease End Date', description: 'When current lease expires', category: 'Intent & Readiness', visibility: ['Buyer'] },

    // --- Persona & Context ---
    { id: 'isHot', label: 'Hot Lead', description: 'High priority lead', category: 'Persona & Context', visibility: ['Buyer', 'Seller'] },
    { id: 'isFirstTimeBuyer', label: 'First Time Buyer', description: 'Never purchased before', category: 'Persona & Context', visibility: ['Buyer'] },
    { id: 'isFirstTimeSeller', label: 'First Time Seller', description: 'Never sold before', category: 'Persona & Context', visibility: ['Seller'] },
    { id: 'isInvestor', label: 'Investor', description: 'Buying for investment purposes', category: 'Persona & Context', visibility: ['Buyer', 'Seller'] },
    { id: 'isAlsoBuying', label: 'Also Buying', description: 'Seller who also intends to buy', category: 'Persona & Context', visibility: ['Seller'] },
    { id: 'isAlsoSelling', label: 'Also Selling', description: 'Buyer who also has a home to sell', category: 'Persona & Context', visibility: ['Buyer'] },
    { id: 'hasHomeToSell', label: 'Has Home to Sell', description: 'Lead owns a property they need to sell', category: 'Persona & Context', visibility: ['Buyer'] },
    { id: 'isPastClient', label: 'Past Client', description: 'Has worked with you before', category: 'Persona & Context', visibility: ['Buyer', 'Seller'] },
    { id: 'gender', label: 'Gender', description: 'Gender identity', category: 'Persona & Context', visibility: ['Buyer', 'Seller'] },
    { id: 'occupancyStatus', label: 'Occupancy Status', description: 'Owner occupied vs Vacant vs Tenant', category: 'Persona & Context', visibility: ['Seller'] },
    { id: 'existingAgentName', label: 'Existing Agent', description: 'Name of other agent if exists', category: 'Persona & Context', visibility: ['Buyer', 'Seller'] },

    // --- Activity ---
    { id: 'isEngaged', label: 'Engaged', description: 'Lead is actively interacting', category: 'Activity', visibility: ['Buyer', 'Seller'] },
    { id: 'isEvaluatingAgent', label: 'Evaluating Agent', description: 'Shopping for representation', category: 'Activity', visibility: ['Buyer', 'Seller'] },
    { id: 'isCloseToDeciding', label: 'Close to Deciding', description: 'Nearing a decision point', category: 'Activity', visibility: ['Buyer', 'Seller'] },
    { id: 'isCloseToOffer', label: 'Close to Offer', description: 'Preparing to make an offer', category: 'Activity', visibility: ['Buyer'] },
    { id: 'initialContactIn30Mins', label: 'Fast Response', description: 'Contacted within 30 minutes', category: 'Activity', visibility: ['Buyer', 'Seller'] },
    { id: 'tourRequestDate', label: 'Tour Date', description: 'Requested date for viewing', category: 'Activity', visibility: ['Buyer'] },
    { id: 'tourRequestTime', label: 'Tour Time', description: 'Requested time for viewing', category: 'Activity', visibility: ['Buyer'] },
    { id: 'callCount', label: 'Call Count', description: 'Number of calls made', category: 'Activity', visibility: ['Buyer', 'Seller'] },
    { id: 'offerCount', label: 'Offer Count', description: 'Number of offers made/received', category: 'Activity', visibility: ['Buyer', 'Seller'] },

    // --- Property Preferences / Subject Property ---
    { id: 'propertyAddress', label: 'Target Property', description: 'Address of property of interest', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'subjectProperty', label: 'Subject Property', description: 'The specific property being transacted', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'preferredNeighborhood', label: 'Preferred Area', description: 'Desired neighborhood or zone', category: 'Property Details', visibility: ['Buyer'] },
    { id: 'propertyType', label: 'Property Type', description: 'SFH, Condo, Townhouse, etc.', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'bedrooms', label: 'Bedrooms', description: 'Number of bedrooms', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'bathrooms', label: 'Bathrooms', description: 'Number of bathrooms', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'sqft', label: 'Square Feet', description: 'Living area size', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'price', label: 'Price (Actual)', description: 'Contract or Listing Price', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'expectedPrice', label: 'Expected Price', description: 'Seller\'s desired price', category: 'Property Details', visibility: ['Seller'] },
    { id: 'minPrice', label: 'Min Price', description: 'Budget floor', category: 'Property Details', visibility: ['Buyer'] },
    { id: 'maxPrice', label: 'Max Price', description: 'Budget ceiling', category: 'Property Details', visibility: ['Buyer'] },
    { id: 'mlsNumber', label: 'MLS Number', description: 'Multiple Listing Service ID', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'zpid', label: 'Zillow ID', description: 'Zillow Property ID', category: 'Property Details', visibility: ['Buyer', 'Seller'] },
    { id: 'daysOnZillow', label: 'Days on Zillow', description: 'Time listed on Zillow', category: 'Property Details', visibility: ['Buyer', 'Seller'] },

    // --- Referral & Source ---
    { id: 'source', label: 'Lead Source', description: 'Origin (Zillow, Website, etc.)', category: 'Referral & Source', visibility: ['Buyer', 'Seller'] },
    { id: 'isReferredByPastClient', label: 'Ref by Past Client', description: 'Referral source is a former client', category: 'Referral & Source', visibility: ['Buyer', 'Seller'] },
    { id: 'isReferredByFriendFamily', label: 'Ref by Friend/Fam', description: 'Referral source is personal network', category: 'Referral & Source', visibility: ['Buyer', 'Seller'] },
    { id: 'leadType', label: 'Lead Type', description: 'Classification of lead', category: 'Referral & Source', visibility: ['Buyer', 'Seller'] },
    { id: 'connectionType', label: 'Connection Type', description: 'Method of connection', category: 'Referral & Source', visibility: ['Buyer', 'Seller'] },
    { id: 'referralSource', label: 'Referral Source', description: 'Specific source details', category: 'Referral & Source', visibility: ['Buyer', 'Seller'] },

    // --- System Metadata ---
    { id: 'status', label: 'Status', description: 'Current status label', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'funnelStage', label: 'Funnel Stage', description: 'Broad lifecycle stage', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'receivedAt', label: 'Received At', description: 'Date lead was created', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'lastTouch', label: 'Last Touch', description: 'Last interaction timestamp', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'clientId', label: 'Client ID', description: 'Unique Client Reference ID', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'id', label: 'System ID', description: 'Internal Database ID', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'notes', label: 'Notes', description: 'General notes', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'tags', label: 'Tags', description: 'Custom tags', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'slaUrgency', label: 'SLA Urgency', description: 'Service Level Agreement urgency', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'assignedTo', label: 'Assigned To', description: 'Agent assigned to lead', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'channel', label: 'Channel', description: 'Communication channel', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'lastUpdated', label: 'Last Updated', description: 'Timestamp of last update', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'stageLastChangedAt', label: 'Stage Changed At', description: 'When funnel stage changed', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'smsConsentTimestamp', label: 'SMS Consent Time', description: 'When SMS consent was given', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'health', label: 'Lead Health', description: 'System calculated health score', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'isMock', label: 'Is Mock', description: 'Test data flag', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'archivedAt', label: 'Archived At', description: 'When lead was archived', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'activatedAt', label: 'Activated At', description: 'When lead became active', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'closedAt', label: 'Closed At', description: 'When transaction closed', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'collectionName', label: 'Collection Name', description: 'Database collection reference', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'callNotes', label: 'Call Notes', description: 'Complex List: Log of call summaries and outcomes', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'notesLog', label: 'Activity Log', description: 'Complex List: History of all notes and activities', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
    { id: 'kyc', label: 'KYC Data', description: 'Complex Object: Know Your Client verification data', category: 'System Metadata', visibility: ['Buyer', 'Seller'] },
];


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
    isAllCash?: boolean;

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
    isHot?: boolean;

    // 5. Additional Status & Persona Flags
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
}
