import { FunnelStage, LeadHealth, LeadStatus, LeadType } from './enums';

// Sub-types for Complex Objects
export interface Property {
    address: string;
    mlsId?: string;
    otherInfo?: string;
}

export interface PrimaryContact {
    email: string;
    phone: string;
    preferredMethod: 'Phone' | 'Email' | 'SMS' | 'WhatsApp';
    smsConsent?: boolean;
    clientPhotoUrl?: string;
    homeAddress?: string;
}

export interface LeadInfo {
    origin: string;
    referralType: string;
    campaign: string;
    createdDate: Date;
    leadType: 'Buyer' | 'Seller';
}

export interface NurtureLogEntry {
    lastCallDate: Date;
    callCount: number;
    lastNote: string;
}

export interface FinancialVitals {
    preApprovalStatus: boolean;
    isAllCash: boolean; // Computed or user input
    budgetMax: number;
}

export interface SearchCriteria {
    locations: string[];
    mustHaves: string[];
    dealBreakers: string[];
}

export interface ListingStatus {
    property: Property;
    estimatedValue: number;
    occupancyStatus: string;
}

export interface TourFeedback {
    property: Property;
    rating: number;
    feedback: string;
}

export interface ActiveOffer {
    property: Property;
    price: number;
    earnestMoney: number;
    contingencies: string[];
    offerDate: Date;
}

export interface HistoricalOffer {
    propertyAddress: string;
    offerPrice: number;
    rejectionDate: Date;
    rejectionReason: 'Price' | 'Terms' | 'Financing' | 'Timing' | 'Inspection/Appraisal' | 'Multiple Offers' | 'Lost to Cash';
    agentNotes: string;
}

export interface TransactionTeam {
    lenderPOC: string;
    escrowOfficer: string;
    coopAgent: string;
}

export interface CriticalDates {
    inspectionEnd: Date;
    appraisalDate: Date;
    closingDate: Date;
}

export interface StageHistoryEntry {
    fromStage: FunnelStage;
    toStage: FunnelStage;
    enteredAt: Date;
    exitedAt?: Date;
}


export interface TourLogEntry {
    propertyAddress: string;
    date: Date;
    status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
}

export interface VisitorLogEntry {
    name: string;
    visitCount: number;
    isInterested: boolean;
}

export interface OfferLogEntry {
    id?: string;
    property: string;
    bidPrice: number;
    outcome: 'Pending' | 'Accepted' | 'Rejected' | 'Countered' | 'Withdrawn';
    date: Date;
    comment?: string;
}

export const LEAD_FIELD_CONFIG = [
    // --- Phase 1: Contact & Discovery (Stage: Leads) ---

    {
        id: 'fullName',
        label: 'Full Name',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'string',
        isLocked: true,
        description: "The client's full legal name."
    },
    {
        id: 'primaryContact',
        label: 'Primary Contact Info',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Essential contact details including email, phone, and preferences.",
        fields: [
            { name: 'email', type: 'string', description: 'Primary email address' },
            { name: 'phone', type: 'string', description: 'Primary phone number' },
            { name: 'preferredMethod', type: 'enum', description: 'Preferred contact method', options: ['Phone', 'Email', 'SMS', 'WhatsApp'] },
            { name: 'smsConsent', type: 'boolean', description: 'Consent to receive SMS' },
            { name: 'clientPhotoUrl', type: 'url', description: 'Link to profile photo' },
            { name: 'homeAddress', type: 'string', description: 'Current home address' }
        ],
        funnelVisibility: ['All']
    },
    {
        id: 'leadInfo',
        label: 'Lead Info',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Source and origin details for attribution.",
        fields: [
            { name: 'origin', type: 'string', description: 'Source of the lead' },
            { name: 'referralType', type: 'string', description: 'Type of referral' },
            { name: 'campaign', type: 'string', description: 'Marketing campaign' },
            { name: 'createdDate', type: 'date', description: 'Date lead was created' },
            { name: 'leadType', type: 'enum', description: 'Buyer or Seller', options: ['Buyer', 'Seller'] }
        ],
        funnelVisibility: ['Leads']
    },
    {
        id: 'engagementScore',
        label: 'Lead Temperature',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['Cold', 'Warm', 'Hot', 'Stale'],
        description: "Subjective rating of lead interest level.",
        funnelVisibility: ['Leads', 'Nurture']
    },
    {
        id: 'leadStatus',
        label: 'Lead Status',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['New', 'Qualified', 'Attempted to Contact'],
        description: "Specific status tracker for the Leads funnel stage.",
        funnelVisibility: ['Leads']
    },
    {
        id: 'nurtureStatus',
        label: 'Nurture Status',
        category: 'Nurture',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['Meeting Fixed', 'Broker Agreement Sent'],
        description: "Specific status tracker for the Nurture funnel stage.",
        funnelVisibility: ['Nurture']
    },
    {
        id: 'activeSearchStatus',
        label: 'Active Search Status',
        category: 'Active Search',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['Broker Agreement Signed', 'Actively Searching', 'Showing'],
        description: "Specific status tracker for the Active Search funnel stage.",
        funnelVisibility: ['Active Search']
    },
    {
        id: 'offerStatus',
        label: 'Offer Status',
        category: 'Offer',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['Offer Submitted', 'Offer Received'],
        description: "Specific status tracker for the Offer funnel stage.",
        funnelVisibility: ['Offer']
    },
    {
        id: 'closingStatus',
        label: 'Closing Status',
        category: 'Closing',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['In Contract', 'On Track', 'Delayed', 'At Risk', 'Rescinded'],
        description: "Specific status tracker for the Closing/Contract funnel stage.",
        funnelVisibility: ['Contract']
    },

    // --- Phase 2: Relationship Building (Stage: Nurture) ---
    {
        id: 'motivation',
        label: 'Motivation & Why',
        category: 'Nurture',
        visibility: ['Buyer', 'Seller'],
        type: 'string',
        description: "The core reason the client is buying or selling.",
        funnelVisibility: ['Nurture']
    },
    {
        id: 'targetTimeline',
        label: 'Target Window',
        category: 'Nurture',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['ASAP', '1-3 Months', '3-6 Months', '6-12 Months', 'Just Browsing'],
        description: "Desired timeframe for closing a transaction.",
        funnelVisibility: ['Nurture']
    },
    {
        id: 'personaProfile',
        label: 'Client Persona',
        category: 'Nurture',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['First-Time', 'Investor', 'Past Client', 'Relocation'],
        description: "Categorization of the client type.",
        funnelVisibility: ['Nurture']
    },
    {
        id: 'leaseEndDate',
        label: 'Lease End Date',
        category: 'Nurture',
        visibility: ['Buyer'],
        type: 'date',
        description: "Date the client's current lease ends.",
        funnelVisibility: ['Nurture', 'Active Search']
    },
    {
        id: 'sellWhen',
        label: 'When to Sell',
        category: 'Nurture',
        visibility: ['Seller'],
        type: 'string',
        description: "Client's target timeframe for listing their home.",
        funnelVisibility: ['Nurture']
    },
    {
        id: 'nurtureLog',
        label: 'Communication History',
        category: 'Nurture',
        visibility: ['Buyer', 'Seller'],
        type: 'list',
        description: "History of calls and notes during the nurture phase.",
        fields: [
            { name: 'lastCallDate', type: 'date', description: 'Date of last call' },
            { name: 'callCount', type: 'integer', description: 'Total calls made' },
            { name: 'lastNote', type: 'string', description: 'Last interaction note' }
        ],
        funnelVisibility: ['Nurture', 'Active Search']
    },

    // --- Phase 3: Property Hunting (Stage: Active Search) ---
    {
        id: 'financialVitals',
        label: 'Buying Power',
        category: 'Nurture',
        visibility: ['Buyer'],
        type: 'object',
        description: "Qualification status and budget details.",
        fields: [
            { name: 'preApprovalStatus', type: 'boolean', description: 'Is pre-approved?' },
            { name: 'isAllCash', type: 'boolean', description: 'Cash buyer?' },
            { name: 'budgetMax', type: 'currency', description: 'Max budget' }
        ],
        funnelVisibility: ['Active Search']
    },
    {
        id: 'searchCriteria',
        label: 'Hard Requirements',
        category: 'Nurture',
        visibility: ['Buyer'],
        type: 'object',
        description: "Location, price, and feature requirements.",
        fields: [
            { name: 'locations', type: 'list<string>', description: 'Target locations' },
            { name: 'mustHaves', type: 'list<string>', description: 'Must have features' },
            { name: 'dealBreakers', type: 'list<string>', description: 'Deal breakers' }
        ],
        funnelVisibility: ['Active Search']
    },
    {
        id: 'listingStatus',
        label: 'Listing Readiness',
        category: 'Nurture',
        visibility: ['Seller'],
        type: 'object',
        description: "Details about the property being sold.",
        fields: [
            { name: 'homeAddress', type: 'string', description: 'Property address' },
            { name: 'estimatedValue', type: 'currency', description: 'Estimated value' },
            { name: 'occupancyStatus', type: 'string', description: 'Occupancy status' }
        ],
        funnelVisibility: ['Active Search']
    },
    {
        id: 'tourFeedback',
        label: 'Showing Activity',
        category: 'Active Search',
        visibility: ['Buyer'],
        type: 'list',
        description: "Log of properties visited and client reactions.",
        fields: [
            { name: 'propertyAddress', type: 'string', description: 'Address toured' },
            { name: 'rating', type: 'integer', description: 'Rating (1-5)' },
            { name: 'feedback', type: 'string', description: 'Client feedback' }
        ],
        funnelVisibility: ['Active Search']
    },

    // --- Phase 4: Transaction Management (Stage: Offer & Contract) ---
    {
        id: 'activeOffer',
        label: 'Current Offer Terms',
        category: 'Offer',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Details of the offer currently in play.",
        fields: [
            { name: 'price', type: 'currency', description: 'Offer price' },
            { name: 'earnestMoney', type: 'currency', description: 'EMD amount' },
            { name: 'contingencies', type: 'list<string>', description: 'List of contingencies' },
            { name: 'offerDate', type: 'date', description: 'Date offer made' }
        ],
        funnelVisibility: ['Offer']
    },
    {
        id: 'historicalOffers',
        label: 'Offer History & Rejections',
        category: 'Active Search',
        visibility: ['Buyer', 'Seller'],
        type: 'list',
        description: "Log of past offers that were rejected or withdrawn.",
        fields: [
            { name: 'propertyAddress', type: 'string', description: 'Property address' },
            { name: 'offerPrice', type: 'currency', description: 'Offer price' },
            { name: 'rejectionDate', type: 'date', description: 'Date rejected' },
            { name: 'rejectionReason', type: 'enum', description: 'Reason for rejection', options: ['Price', 'Terms', 'Financing', 'Timing', 'Inspection/Appraisal', 'Multiple Offers', 'Lost to Cash'] },
            { name: 'agentNotes', type: 'string', description: 'Notes' }
        ],
        funnelVisibility: ['Offer', 'Contract', 'Archived']
    },
    {
        id: 'transactionTeam',
        label: 'Deal Partners',
        category: 'Closing',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Contact info for external partners on this deal.",
        fields: [
            { name: 'lenderPOC', type: 'string', description: 'Lender contact' },
            { name: 'escrowOfficer', type: 'string', description: 'Escrow officer' },
            { name: 'coopAgent', type: 'string', description: 'Cooperating agent' }
        ],
        funnelVisibility: ['Offer', 'Contract']
    },
    {
        id: 'tours',
        label: 'Property Tours Log',
        category: 'Active Search',
        visibility: ['Buyer'],
        type: 'list',
        description: 'Scheduled and completed property tours.',
        fields: [
            { name: 'propertyAddress', type: 'string', description: 'Address to tour' },
            { name: 'date', type: 'date', description: 'Date of tour' },
            { name: 'status', type: 'enum', description: 'Scheduled/Completed/Cancelled', options: ['Scheduled', 'Completed', 'Cancelled', 'No Show'] }
        ],
        funnelVisibility: ['Active Search']
    },
    {
        id: 'visitors',
        label: 'Property Visitors',
        category: 'Active Search',
        visibility: ['Seller'],
        type: 'list',
        description: 'Visitors log for open houses or showings.',
        fields: [
            { name: 'name', type: 'string', description: 'Visitor Name' },
            { name: 'visitCount', type: 'integer', description: 'Number of visits' },
            { name: 'isInterested', type: 'boolean', description: 'Marked as interested' }
        ],
        funnelVisibility: ['Active Search']
    },
    {
        id: 'offers',
        label: 'Offers Activity',
        category: 'Offer',
        visibility: ['Buyer', 'Seller'],
        type: 'list',
        description: 'List of all offers made or received.',
        fields: [
            { name: 'property', type: 'string', description: 'Property Address' },
            { name: 'bidPrice', type: 'currency', description: 'Bid Amount' },
            { name: 'outcome', type: 'enum', description: 'Pending/Accepted/Rejected', options: ['Pending', 'Accepted', 'Rejected', 'Countered', 'Withdrawn'] },
            { name: 'date', type: 'date', description: 'Date of offer' },
            { name: 'comment', type: 'string', description: 'Notes' }
        ],
        funnelVisibility: ['Offer']
    },
    {
        id: 'criticalDates',
        label: 'Escrow Countdown',
        category: 'Closing',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Key deadlines and milestones for the transaction.",
        fields: [
            { name: 'inspectionEnd', type: 'date', description: 'Inspection deadline' },
            { name: 'appraisalDate', type: 'date', description: 'Appraisal deadline' },
            { name: 'closingDate', type: 'date', description: 'Closing date' }
        ],
        funnelVisibility: ['Contract']
    },

] as const;

export const LEAD_STAGE_LIFECYCLE_CONFIG = [
    // --- Lifecycle Tracking ---
    {
        id: 'stageHistory',
        label: 'Stage History Log',
        category: 'System Metadata',
        visibility: ['Buyer', 'Seller'],
        type: 'list',
        description: 'Historical log of every stage move with duration.',
        fields: [
            { name: 'fromStage', type: 'enum', description: 'Previous stage' },
            { name: 'toStage', type: 'enum', description: 'New stage' },
            { name: 'enteredAt', type: 'timestamp', description: 'Entry time' },
            { name: 'exitedAt', type: 'timestamp', description: 'Exit time' }
        ],
        funnelVisibility: ['All']
    },

    {
        id: 'staleWarningDate',
        label: 'Follow-up Deadline',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'date',
        description: 'System calculated date when the lead is considered "Stale" for this stage.',
        funnelVisibility: ['Leads', 'Nurture', 'Active Search']
    },

] as const;


export interface Lead {
    id: string;

    // --- Phase 1 ---
    fullName?: string;
    primaryContact?: PrimaryContact;
    leadInfo?: LeadInfo;
    engagementScore?: 'Cold' | 'Warm' | 'Hot' | 'Stale';

    // --- Phase 2 ---
    motivation?: string;
    targetTimeline?: 'ASAP' | '1-3 Months' | '3-6 Months' | '6-12 Months' | 'Just Browsing';
    personaProfile?: 'First-Time' | 'Investor' | 'Past Client' | 'Relocation';
    leaseEndDate?: Date;
    sellWhen?: string;
    nurtureLog?: NurtureLogEntry[];

    // --- Phase 3 ---
    financialVitals?: FinancialVitals;
    searchCriteria?: SearchCriteria;
    listingStatus?: ListingStatus;
    tourFeedback?: TourFeedback[];
    tours?: TourLogEntry[];
    visitors?: VisitorLogEntry[];

    // --- Phase 4 ---
    activeOffer?: ActiveOffer;
    offers?: OfferLogEntry[];
    historicalOffers?: HistoricalOffer[];
    transactionTeam?: TransactionTeam;
    criticalDates?: CriticalDates;
    closingStatus?: 'In Contract' | 'On Track' | 'Delayed' | 'At Risk' | 'Rescinded';
    leadStatus?: 'New' | 'Qualified' | 'Attempted to Contact';
    nurtureStatus?: 'Meeting Fixed' | 'Broker Agreement Sent';
    activeSearchStatus?: 'Broker Agreement Signed' | 'Actively Searching' | 'Showing';
    offerStatus?: 'Offer Submitted' | 'Offer Received';

    // --- System Metadata (Maintained for App Logic) ---
    status: LeadStatus;
    funnelStage: FunnelStage;
    receivedAt: any;
    leadType: LeadType;
    health: LeadHealth;

    // --- Lifecycle Tracking ---
    stageHistory?: StageHistoryEntry[];

    staleWarningDate?: Date;

    // Legacy / Shared fields that might be used by generic components
    // Legacy / Shared fields that might be used by generic components
    firstName?: string;
    lastName?: string;
    email?: string; // Flat accessor for primaryContact.email
    phone?: string; // Flat accessor for primaryContact.phone
    source?: string; // Flat accessor for leadInfo.origin
    notes?: string;
    notesLog?: any[];
    isAlsoSelling?: boolean;
    isAlsoBuying?: boolean;
    preQualified?: boolean;
    homeValueNeeded?: boolean;
    price?: number;
    preferredNeighborhood?: string;
    callCount?: number;
    initialContactIn30Mins?: boolean;
    isHot?: boolean;
    tags?: string[];
    message?: string;
    timeframe?: string;
    preferredContactMethod?: string;
    callNotes?: any[];

    // Lifecycle
    stageLastChangedAt?: any;
    archivedAt?: any;
    activatedAt?: any;
    closedAt?: any;
    subjectProperty?: string;
    propertyAddress?: string;
    avatarUrl?: string;
    slaUrgency?: string;

    lastUpdated?: any;
    isMock?: boolean;
    collectionName?: string;
    clientId?: string;
    clientPhotoUrl?: string; // Flat accessor

    // Deprecated / Mapped fields (keeping some for potential backward compat or strict adherence to new schema)
    // Ideally we remove everything else.
}

// --- Completeness Check ---
export type ConfiguredKeys = typeof LEAD_FIELD_CONFIG[number]['id'];

// If you need to ignore strict checking for some keys:
// type IgnoredKeys = 'id' | 'status' | 'funnelStage' | 'receivedAt' | 'leadType' | 'health' | 'lastUpdated' | 'isMock' | 'collectionName' | 'clientId';
// type MissingKeys = Exclude<keyof Lead, ConfiguredKeys | IgnoredKeys>;
// const _completenessCheck: MissingKeys = {} as never;
