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
    clientPhotoUrl?: string;
    homeAddress?: string;
}

export interface LeadInfo {
    referralType: string;
    campaign: string;
    customerMessage?: string;
    earnestMoneyDue?: string;
    mutualAcceptance?: string;
    dueDiligence?: string;
    closingInfo?: string;
    inquiryProperty?: Property;
    budgetRange?: string;
}

export interface NurtureLogEntry {
    CallDate: Date;
    CommChannel: 'Text' | 'Email' | 'Phone' | 'In-person';
    Note: string;
}

export interface FinancialVitals {
    preApprovalStatus: boolean;
    isAllCash: boolean; // Computed or user input
    budgetMax: number;
}

export interface SearchCriteria {
    locations: string;
    mustHaves: string;
    dealBreakers: string;
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
        id: 'leadType',
        label: 'Lead Type',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['Buyer', 'Seller'],
        description: "Whether the lead is a Buyer or Seller.",
        funnelVisibility: [] // None, as requested
    },
    {
        id: 'source',
        label: 'Lead Source',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'string',
        description: "The origin of the lead.",
        funnelVisibility: ['Leads']
    },
    {
        id: 'status',
        label: 'Status',
        category: 'General',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: [
            'New', 'Qualified', 'Attempted to Contact',
            'Meeting Fixed', 'Broker Agreement Sent',
            'Broker Agreement Signed', 'Actively Searching', 'Showing',
            'Offer',
            'In Contract'
        ],
        description: 'Current status of the client in the pipeline',
        funnelVisibility: ['All'],
        isLocked: false
    },
    {
        id: 'receivedAt',
        label: 'Created Date',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'date',
        description: 'Date lead was created',
        funnelVisibility: [] // None, as requested
    },
    {
        id: 'legalName',
        label: 'Legal Name',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'string',
        description: 'Client legal name',
        funnelVisibility: [] // None, as requested
    },
    {
        id: 'primaryContact',
        label: 'Primary Contact Info',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Essential contact details including email, phone, and preferences.",
        fields: [
            { name: 'email', label: 'Email Address', type: 'string', description: 'Primary email address', funnelVisibility: ['All'] },
            { name: 'phone', label: 'Phone Number', type: 'string', description: 'Primary phone number', funnelVisibility: ['All'] },
            { name: 'preferredMethod', label: 'Preferred Contact Method', type: 'enum', description: 'Preferred contact method', options: ['Phone', 'Email', 'SMS', 'WhatsApp'], funnelVisibility: ['All'] },
            { name: 'clientPhotoUrl', label: 'Client Photo URL', type: 'url', description: 'Link to profile photo', funnelVisibility: ['All'] },
            { name: 'homeAddress', label: 'Home Address', type: 'string', description: 'Current home address', funnelVisibility: [] }
        ],
    },
    {
        id: 'leadInfo',
        label: 'Lead Info',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Source and origin details for the lead.",
        fields: [
            { name: 'referralType', label: 'Referral Type', type: 'string', description: 'Type of referral', funnelVisibility: ['Leads'] },
            { name: 'campaign', label: 'Marketing Campaign', type: 'string', description: 'Marketing campaign', funnelVisibility: ['Leads'] },
            { name: 'customerMessage', label: 'Customer Message', type: 'string', description: 'Message from customer', funnelVisibility: ['Leads'] },
            { name: 'earnestMoneyDue', label: 'Earnest Money Due', type: 'string', description: 'EMD due details', funnelVisibility: ['Leads'] },
            { name: 'mutualAcceptance', label: 'Mutual Acceptance', type: 'string', description: 'Mutual acceptance details', funnelVisibility: ['Leads'] },
            { name: 'dueDiligence', label: 'Due Diligence', type: 'string', description: 'Due diligence details', funnelVisibility: ['Leads'] },
            { name: 'closingInfo', label: 'Closing Info', type: 'string', description: 'Closing information', funnelVisibility: ['Leads'] },
            {
                name: 'inquiryProperty',
                label: 'Inquiry Property',
                type: 'object',
                description: 'Property of interest',
                funnelVisibility: ['Leads'],
                fields: [
                    { name: 'address', label: 'Property Address', type: 'string', funnelVisibility: ['Leads'] },
                    { name: 'mlsId', label: 'MLS ID', type: 'string', funnelVisibility: ['Leads'] },
                    { name: 'otherInfo', label: 'Other Info', type: 'string', funnelVisibility: ['Leads'] }
                ]
            },
            { name: 'budgetRange', label: 'Budget Range', type: 'string', description: 'Desired price range', funnelVisibility: ['Leads', 'Nurture', 'Active Search'] }
        ],
    },
    {
        id: 'engagementScore',
        label: 'Lead Temperature',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['Cold', 'Warm', 'Hot', 'Stale'],
        description: "Subjective rating of lead interest level.",
        funnelVisibility: ['Leads']
    },


    // --- Phase 2: Relationship Building (Stage: Nurture) ---
    {
        id: 'motivation',
        label: 'Motivation & Why',
        category: 'Nurture',
        visibility: ['Buyer', 'Seller'],
        type: 'string',
        description: "The core reason the client is buying or selling.",
        funnelVisibility: ['Leads', 'Nurture']
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
            { name: 'CallDate', label: 'Call Date', type: 'date', description: 'Date of call', funnelVisibility: ['Leads', 'Nurture', 'Active Search'] },
            { name: 'CommChannel', label: 'Communication Channel', type: 'enum', description: 'Method of communication', options: ['Text', 'Email', 'Phone', 'In-person'], funnelVisibility: ['Leads', 'Nurture', 'Active Search'] },
            { name: 'Note', label: 'Notes', type: 'string', description: 'Summary of Discussion', funnelVisibility: ['Leads', 'Nurture', 'Active Search'] }
        ],
    },
    {
        id: 'callCount',
        label: 'Communication Count',
        category: 'Nurture',
        visibility: ['Buyer', 'Seller'],
        type: 'integer',
        description: 'Total count of communication with the client.',
        funnelVisibility: ['Nurture', 'Active Search']
    },

    // --- Phase 3: Property Hunting (Stage: Active Search) ---
    {
        id: 'financialVitals',
        label: 'Buying Power',
        category: 'Active Search',
        visibility: ['Buyer'],
        type: 'object',
        description: "Qualification status and budget details.",
        fields: [
            { name: 'preApprovalStatus', label: 'Pre-Approval Status', type: 'boolean', description: 'Is pre-approved?', funnelVisibility: ['Nurture', 'Active Search'] },
            { name: 'isAllCash', label: 'All Cash Buyer', type: 'boolean', description: 'Cash buyer?', funnelVisibility: ['Nurture', 'Active Search'] },
            { name: 'budgetMax', label: 'Maximum Budget', type: 'currency', description: 'Max budget', funnelVisibility: ['Nurture', 'Active Search'] }
        ],
    },
    {
        id: 'searchCriteria',
        label: 'Hard Requirements',
        category: 'Active Search',
        visibility: ['Buyer'],
        type: 'object',
        description: "Location, price, and feature requirements.",
        fields: [
            { name: 'locations', label: 'Target Locations', type: 'string', description: 'Target locations', funnelVisibility: ['Nurture', 'Active Search'] },
            { name: 'mustHaves', label: 'Must-Have Features', type: 'string', description: 'Must have features', funnelVisibility: ['Nurture', 'Active Search'] },
            { name: 'dealBreakers', label: 'Deal Breakers', type: 'string', description: 'Deal breakers', funnelVisibility: ['Nurture', 'Active Search'] }
        ],
    },
    {
        id: 'listingStatus',
        label: 'Listing Readiness',
        category: 'Active Search',
        visibility: ['Seller'],
        type: 'object',
        description: "Details about the property being sold.",
        fields: [
            { name: 'homeAddress', label: 'Property Address', type: 'string', description: 'Property address', funnelVisibility: ['Nurture', 'Active Search'] },
            { name: 'estimatedValue', label: 'Estimated Value', type: 'currency', description: 'Estimated value', funnelVisibility: ['Nurture', 'Active Search'] },
            { name: 'occupancyStatus', label: 'Occupancy Status', type: 'string', description: 'Occupancy status', funnelVisibility: ['Nurture', 'Active Search'] }
        ],
    },
    {
        id: 'tourFeedback',
        label: 'Showing Activity',
        category: 'Active Search',
        visibility: ['Buyer'],
        type: 'list',
        description: "Log of properties visited and client reactions.",
        funnelVisibility: ['Active Search'], // Added visibility
        fields: [
            { name: 'propertyAddress', label: 'Property Address', type: 'string', description: 'Address toured', funnelVisibility: ['Active Search'] },
            { name: 'rating', label: 'Rating', type: 'integer', description: 'Rating (1-5)', funnelVisibility: ['Active Search'] },
            { name: 'feedback', label: 'Client Feedback', type: 'string', description: 'Client feedback', funnelVisibility: ['Active Search'] }
        ],
    },

    // --- Phase 4: Transaction Management (Stage: Offer & Contract) ---
    {
        id: 'activeOffer',
        label: 'Current Offer Terms',
        category: 'Offer',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Details of the offer currently in play.",
        funnelVisibility: ['Offer'],
        fields: [
            { name: 'price', label: 'Offer Price', type: 'currency', description: 'Offer price', funnelVisibility: ['Offer'] },
            { name: 'earnestMoney', label: 'Earnest Money Deposit', type: 'currency', description: 'EMD amount', funnelVisibility: ['Offer'] },
            { name: 'contingencies', label: 'Contingencies', type: 'list<string>', description: 'List of contingencies', funnelVisibility: ['Offer'] },
            { name: 'offerDate', label: 'Offer Date', type: 'date', description: 'Date offer made', funnelVisibility: ['Offer'] }
        ],
    },
    {
        id: 'historicalOffers',
        label: 'Offer History & Rejections',
        category: 'Active Search',
        visibility: ['Buyer', 'Seller'],
        type: 'list',
        description: "Log of past offers that were rejected or withdrawn.",
        funnelVisibility: ['Active Search'],
        fields: [
            { name: 'propertyAddress', label: 'Property Address', type: 'string', description: 'Property address', funnelVisibility: ['Active Search'] },
            { name: 'offerPrice', label: 'Offer Price', type: 'currency', description: 'Offer price', funnelVisibility: ['Active Search'] },
            { name: 'rejectionDate', label: 'Rejection Date', type: 'date', description: 'Date rejected', funnelVisibility: ['Active Search'] },
            { name: 'rejectionReason', label: 'Rejection Reason', type: 'enum', description: 'Reason for rejection', options: ['Price', 'Terms', 'Financing', 'Timing', 'Inspection/Appraisal', 'Multiple Offers', 'Lost to Cash'], funnelVisibility: ['Active Search'] },
            { name: 'agentNotes', label: 'Agent Notes', type: 'string', description: 'Notes', funnelVisibility: ['Active Search'] }
        ],
    },
    {
        id: 'transactionTeam',
        label: 'Deal Partners',
        category: 'Closing',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Contact info for external partners on this deal.",
        funnelVisibility: ['Closing'],
        fields: [
            { name: 'lenderPOC', label: 'Lender Contact', type: 'string', description: 'Lender contact', funnelVisibility: ['Closing'] },
            { name: 'escrowOfficer', label: 'Escrow Officer', type: 'string', description: 'Escrow officer', funnelVisibility: ['Closing'] },
            { name: 'coopAgent', label: 'Cooperating Agent', type: 'string', description: 'Cooperating agent', funnelVisibility: ['Closing'] }
        ],
    },
    {
        id: 'tours',
        label: 'Property Tours Log',
        category: 'Active Search',
        visibility: ['Buyer'],
        type: 'list',
        description: 'Scheduled and completed property tours.',
        funnelVisibility: ['Active Search'],
        fields: [
            { name: 'propertyAddress', label: 'Property Address', type: 'string', description: 'Address to tour', funnelVisibility: ['Active Search'] },
            { name: 'date', label: 'Tour Date', type: 'date', description: 'Date of tour', funnelVisibility: ['Active Search'] },
            { name: 'status', label: 'Tour Status', type: 'enum', description: 'Scheduled/Completed/Cancelled', options: ['Scheduled', 'Completed', 'Cancelled', 'No Show'], funnelVisibility: ['Active Search'] }
        ],
    },
    {
        id: 'visitors',
        label: 'Property Visitors',
        category: 'Active Search',
        visibility: ['Seller'],
        type: 'list',
        description: 'Visitors log for open houses or showings.',
        funnelVisibility: ['Active Search'],
        fields: [
            { name: 'name', label: 'Visitor Name', type: 'string', description: 'Visitor Name', funnelVisibility: ['Active Search'] },
            { name: 'visitCount', label: 'Visit Count', type: 'integer', description: 'Number of visits', funnelVisibility: ['Active Search'] },
            { name: 'isInterested', label: 'Interested', type: 'boolean', description: 'Marked as interested', funnelVisibility: ['Active Search'] }
        ],
    },
    {
        id: 'offers',
        label: 'Offers Activity',
        category: 'Offer',
        visibility: ['Buyer', 'Seller'],
        type: 'list',
        description: 'List of all offers made or received.',
        funnelVisibility: ['Offer'],
        fields: [
            { name: 'property', label: 'Property Address', type: 'string', description: 'Property Address', funnelVisibility: ['Offer'] },
            { name: 'bidPrice', label: 'Bid Amount', type: 'currency', description: 'Bid Amount', funnelVisibility: ['Offer'] },
            { name: 'outcome', label: 'Outcome', type: 'enum', description: 'Pending/Accepted/Rejected', options: ['Pending', 'Accepted', 'Rejected', 'Countered', 'Withdrawn'], funnelVisibility: ['Offer'] },
            { name: 'date', label: 'Offer Date', type: 'date', description: 'Date of offer', funnelVisibility: ['Offer'] },
            { name: 'comment', label: 'Notes', type: 'string', description: 'Notes', funnelVisibility: ['Offer'] }
        ],
    },
    {
        id: 'criticalDates',
        label: 'Escrow Countdown',
        category: 'Closing',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: "Key deadlines and milestones for the transaction.",
        funnelVisibility: ['Closing'],
        fields: [
            { name: 'inspectionEnd', label: 'Inspection Deadline', type: 'date', description: 'Inspection deadline', funnelVisibility: ['Closing'] },
            { name: 'appraisalDate', label: 'Appraisal Date', type: 'date', description: 'Appraisal deadline', funnelVisibility: ['Closing'] },
            { name: 'closingDate', label: 'Closing Date', type: 'date', description: 'Closing date', funnelVisibility: ['Closing'] }
        ],
    },
    {
        id: 'closingHealth',
        label: 'Closing Health',
        category: 'Closing',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['On Track', 'Delayed', 'At Risk', 'Rescinded'],
        description: "Status health tracking for closing phase.",
        funnelVisibility: ['Closing']
    },

] as const;

export const LEAD_STAGE_LIFECYCLE_CONFIG = [
    // --- Lifecycle Tracking ---
    {
        id: 'funnelStage',
        label: 'Funnel Stage',
        category: 'General',
        visibility: ['Buyer', 'Seller'],
        type: 'enum',
        options: ['Leads', 'Nurture', 'Active Search', 'Offer', 'Closing', 'Closed', 'Archived'],
        description: 'Current stage in the sales pipeline',
        funnelVisibility: ['All'],
        isLocked: true
    },
    {
        id: 'stageHistory',
        label: 'Stage History Log',
        category: 'General',
        visibility: ['Buyer', 'Seller'],
        type: 'list',
        description: 'Historical log of every stage move with duration.',
        funnelVisibility: [], // Hidden from card grid
        fields: [
            { name: 'fromStage', label: 'From Stage', type: 'enum', description: 'Previous stage', funnelVisibility: [] },
            { name: 'toStage', label: 'To Stage', type: 'enum', description: 'New stage', funnelVisibility: [] },
            { name: 'enteredAt', label: 'Entered At', type: 'timestamp', description: 'Entry time', funnelVisibility: [] },
            { name: 'exitedAt', label: 'Exited At', type: 'timestamp', description: 'Exit time', funnelVisibility: [] }
        ],
    },

    {
        id: 'staleWarningDate',
        label: 'Follow-up Deadline',
        category: 'Leads',
        visibility: ['Buyer', 'Seller'],
        type: 'date',
        description: 'Deadline to follow up with the lead',
        funnelVisibility: ['Leads']
    },

    // Hidden system fields - these exist in the data model but should not be visible in the UI
    {
        id: 'clientId',
        label: 'Client ID',
        category: 'General',
        visibility: ['Buyer', 'Seller'],
        type: 'string',
        description: 'Unique Client Reference ID',
        funnelVisibility: []
    },
    {
        id: 'id',
        label: 'System ID',
        category: 'General',
        visibility: ['Buyer', 'Seller'],
        type: 'string',
        description: 'Internal Database ID',
        funnelVisibility: [],
        isLocked: true
    },
    {
        id: 'isMock',
        label: 'Is Mock',
        category: 'General',
        visibility: ['Buyer', 'Seller'],
        type: 'boolean',
        description: 'Test data flag',
        funnelVisibility: [],
        isLocked: true
    },
    {
        id: 'collectionName',
        label: 'Collection Name',
        category: 'General',
        visibility: ['Buyer', 'Seller'],
        type: 'string',
        description: 'Database collection reference',
        funnelVisibility: [],
        isLocked: true
    },
    {
        id: 'realtorComments',
        label: 'Realtor Comments',
        category: 'General',
        visibility: ['Buyer', 'Seller'],
        type: 'object',
        description: 'Sticky notes / comments added by the realtor.',
        funnelVisibility: ['Leads', 'Nurture', 'Active Search', 'Offer', 'Contract', 'Closed & Archived'],
        fields: [
            { name: 'notes', label: 'Notes', type: 'string', funnelVisibility: ['All'] },
            { name: 'date', label: 'Date', type: 'date', funnelVisibility: ['All'] },
            { name: 'color', label: 'Post it color', type: 'enum', options: ['yellow', 'blue', 'red', 'green'], funnelVisibility: ['All'] }
        ]
    }
] as const;


export interface RealtorComment {
    note: string;
    color: 'yellow' | 'blue' | 'red' | 'green';
    date: Date | any;
}

export interface StickyNote {
    x: number;
    y: number;
    rotation: number;
    content: string;
}

export interface RealtorNoteHistoryEntry {
    date: any;
    text: string;
    color: string;
}

export interface Lead {
    stickyNotes?: StickyNote[];
    realtorNotes?: RealtorNoteHistoryEntry[];
    realtorComments?: RealtorComment;
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
    closingHealth?: 'On Track' | 'Delayed' | 'At Risk' | 'Rescinded';

    // --- General (Maintained for App Logic) ---
    status: LeadStatus;
    funnelStage: FunnelStage;
    receivedAt: any;
    leadType: LeadType;
    health: LeadHealth;

    // --- Lifecycle Tracking ---
    stageHistory?: StageHistoryEntry[];
    daysInStage?: number;
    currentStage?: FunnelStage;

    staleWarningDate?: Date;

    // Legacy / Shared fields that might be used by generic components
    // Legacy / Shared fields that might be used by generic components
    firstName?: string;
    lastName?: string;
    email?: string; // Flat accessor for primaryContact.email
    phone?: string; // Flat accessor for primaryContact.phone
    source?: string; // Flat accessor for leadInfo.origin
    createdDate?: any; // New top-level field
    legalName?: string; // New top-level field
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
