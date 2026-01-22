import { CommChannel, FunnelStage, LeadHealth, LeadSource, LeadStatus, LeadType } from '../types/enums';
import { Transaction, TransactionParty, TransactionType, TransactionStatus } from '../types/transaction';
// Note: We are generating data matching the NEW Lead schema in types/lead.ts

export const MOCK_FIRST_NAMES = [
    "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
    "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
    "Matthew", "Margaret", "Anthony", "Betty", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Dorothy", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna"
];

export const MOCK_LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker"
];

export const MOCK_GMAIL_DOMAINS = ["gmail.com"];
export const MOCK_STREETS = ["Main St", "Oak Ave", "Pine Rd", "Maple Dr", "Cedar Ln"];
export const MOCK_CITIES = ["Denver", "Boulder", "Aurora", "Colorado Springs", "Fort Collins"];
export const MOCK_SOURCES = ["Zillow", "Realtor.com", "Referral", "Website", "Direct", "Google", "Facebook", "Instagram"];

// New Mock Data Helpers
const MOCK_CAMPAIGNS = ["Spring Promo", "First-Time Buyer Seminar", "Facebook Ad #4", "Referral Program", "None"];
const MOCK_REFERRAL_TYPES = ["Agent", "Client", "Friend", "Vendor"];
const MOCK_MOTIVATIONS = [
    "Need more space for growing family.",
    "Relocating for a new job in Denver.",
    "Downsizing after kids moved out.",
    "Want to build equity closer to downtown.",
    "Looking for an investment property."
];
const MOCK_LOCATIONS = ["Denver", "Cherry Creek", "Highlands", "LoDo", "RiNo"];
const MOCK_MUST_HAVES = ["3+ Bedrooms", "Garage", "Large Yard", "Modern Kitchen", "Home Office"];
const MOCK_DEAL_BREAKERS = ["Busy Road", "No Parking", "Power Lines", "HOA > $500", "Basement Issues"];

const MOCK_COMMENTS = [
    "Client loved the open floor plan but hated the backyard.",
    "Price is a bit high for the condition.",
    "Perfect location, but needs too much work.",
    "Ready to move forward if seller gives concession.",
    "Checking with lender on rate lock before proceeding."
];
export const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const getRandomSubset = <T>(arr: T[], count: number): T[] => arr.sort(() => 0.5 - Math.random()).slice(0, count);



export const generateMockLead = (type: LeadType, status?: LeadStatus, funnelStage?: FunnelStage, customId?: string): any => {
    const firstName = getRandom(MOCK_FIRST_NAMES);
    const lastName = getRandom(MOCK_LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const streetNum = Math.floor(100 + Math.random() * 900);
    const streetName = getRandom(MOCK_STREETS);
    const city = getRandom(MOCK_CITIES);
    const fullAddress = `${streetNum} ${streetName}, ${city}, CO 80202`;

    // Derived values
    const isBuyer = type === 'Buyer';
    const isSeller = type === 'Seller';
    const receivedDate = new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000));
    const preferredMethod = getRandom(['Phone', 'Email', 'SMS', 'WhatsApp']);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${getRandom(MOCK_GMAIL_DOMAINS)}`;
    const phone = `(555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
        id: customId || `mock_${Math.random().toString(36).substr(2, 9)}`,

        // --- Phase 1: Contact ---
        fullName,
        primaryContactInfo: {
            email,
            phone,
            preferredMethod,
            clientPhotoUrl: Math.random() > 0.7 ? `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random` : undefined,
            homeAddress: fullAddress
        },
        leadInfo: {
            referralType: getRandom(MOCK_REFERRAL_TYPES),
            campaign: getRandom(MOCK_CAMPAIGNS),
            customerMessage: Math.random() > 0.5 ? "I'm interested in viewing properties near the Highlands area." : "Looking for a home with a large backyard and modern kitchen.",
            earnestMoneyDue: "$5,000 within 3 days",
            mutualAcceptance: "Pending seller signature",
            dueDiligence: "Inspections scheduled for next Tuesday",
            closingInfo: "Targeting late next month for move-in",
            inquiryProperty: {
                address: fullAddress,
                mlsId: `MLS-${Math.floor(Math.random() * 900000) + 100000}`,
                otherInfo: "Inquired via Zillow"
            }
        },
        engagementScore: getRandom(['Cold', 'Warm', 'Hot', 'Stale']),

        // --- Phase 2: Nurture ---
        motivation: getRandom(MOCK_MOTIVATIONS),
        targetTimeline: getRandom(['ASAP', '1-3 Months', '3-6 Months', '6-12 Months', 'Just Browsing']),
        personaProfile: getRandom(['First-Time', 'Investor', 'Past Client', 'Relocation']),
        leaseEndDate: isBuyer && Math.random() > 0.5 ? new Date(Date.now() + Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000) : undefined,
        nurtureLog: [
            {
                CallDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
                CommChannel: getRandom(['Text', 'Email', 'Phone', 'In-person']),
                Note: "Discussed timeline and budget."
            }
        ],
        callCount: Math.floor(Math.random() * 8) + 1,

        // --- Phase 3: Active Search ---
        financialVitals: isBuyer ? {
            preApprovalStatus: Math.random() > 0.5,
            isAllCash: Math.random() > 0.8,
            budgetMax: Math.floor(400000 + Math.random() * 1000000)
        } : undefined,
        searchCriteria: isBuyer ? {
            locations: getRandomSubset(MOCK_LOCATIONS, 2).join(', '),
            mustHaves: getRandomSubset(MOCK_MUST_HAVES, 2).join(', '),
            dealBreakers: getRandomSubset(MOCK_DEAL_BREAKERS, 1).join(', ')
        } : undefined,
        listingStatus: isSeller ? {
            homeAddress: fullAddress,
            estimatedValue: Math.floor(500000 + Math.random() * 500000),
            occupancyStatus: getRandom(['Owner Occupied', 'Vacant', 'Tenant Occupied'])
        } : undefined,
        tourFeedback: isBuyer ? [
            { propertyAddress: "123 Mock St", rating: 4, feedback: "Loved the kitchen, yard was too small." }
        ] : undefined,
        tours: isBuyer ? [
            { propertyAddress: "456 Oak Street", date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), status: 'Scheduled' },
            { propertyAddress: "789 Pine Avenue", date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), status: 'Completed' }
        ] : undefined,
        visitors: isSeller ? [
            { name: "John Doe", visitCount: 1, isInterested: true },
            { name: "Jane Smith", visitCount: 2, isInterested: false }
        ] : undefined,

        // --- Phase 4: Offer/Contract ---
        activeOffer: (isBuyer || isSeller) && funnelStage === 'Offer' ? {
            price: Math.floor(450000 + Math.random() * 100000),
            earnestMoney: 5000,
            contingencies: ['Inspection', 'Appraisal'],
            offerDate: new Date()
        } : undefined,
        historicalOffers: isBuyer && Math.random() > 0.6 ? [
            {
                propertyAddress: "789 Old St",
                offerPrice: 420000,
                rejectionDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                rejectionReason: getRandom(['Price', 'Terms', 'Financing', 'Timing', 'Multiple Offers']),
                agentNotes: "Client moved on to better property."
            }
        ] : undefined,
        offers: (isBuyer || isSeller) && funnelStage === 'Offer' ? [
            {
                property: "123 Mock St",
                bidPrice: 520000,
                outcome: 'Pending',
                date: new Date(),
                comment: getRandom(MOCK_COMMENTS)
            }
        ] : undefined,
        transactionTeam: funnelStage === 'Contract' ? {
            lenderPOC: "Sarah Lender",
            escrowOfficer: "Bob Escrow",
            coopAgent: "Alice Agent"
        } : undefined,
        criticalDates: funnelStage === 'Contract' ? {
            inspectionEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            appraisalDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        } : undefined,
        closingHealth: funnelStage === 'Contract' ? getRandom(['On Track', 'Delayed', 'At Risk', 'Rescinded']) : undefined,
        // --- System ---
        status: status || (() => {
            if (funnelStage === 'Leads') return getRandom(['New', 'Qualified', 'Attempted to Contact']);
            if (funnelStage === 'Nurture') return getRandom(['Meeting Fixed', 'Broker Agreement Sent']);
            if (funnelStage === 'Active Search') return getRandom(['Broker Agreement Signed', 'Actively Searching', 'Showing']);
            if (funnelStage === 'Offer') return 'Offer';
            if (funnelStage === 'Contract' || funnelStage === 'Closed') return 'In Contract';
            return 'New';
        })(),

        // --- Lifecycle Tracking ---
        staleWarningDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        stageHistory: [
            {
                fromStage: 'Leads',
                toStage: funnelStage || 'Leads',
                enteredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
            }
        ],

        // --- System ---
        funnelStage: funnelStage || 'Leads',
        receivedAt: receivedDate,
        leadType: type,
        health: getRandom(['Active', 'Stale', 'Dormant', 'Responsive']),
        isMock: true,
        collectionName: 'leads',
        clientId: `client_${Math.floor(Math.random() * 1000)}`,
        lastUpdated: new Date(),

        // --- Flat Accessors for UI (Satisfying LeadsList expectations) ---
        firstName,
        lastName,
        email,
        phone,
        preferredContactMethod: preferredMethod,
        source: getRandom(MOCK_SOURCES),
        createdDate: receivedDate,
        legalName: fullName,
        subjectProperty: fullAddress,
        propertyAddress: fullAddress,
    };
};

export const generateMockTransaction = (type: TransactionType, realtorId: string, clientId?: string, customId?: string): Transaction => {
    const streetNum = Math.floor(100 + Math.random() * 900);
    const streetName = getRandom(MOCK_STREETS);
    const city = getRandom(MOCK_CITIES);
    const fullAddress = `${streetNum} ${streetName}, ${city}, CO 80202`;

    return {
        id: customId || `mock_tx_${Math.random().toString(36).substr(2, 9)}`,
        realtorId,
        clientId,
        type,
        status: getRandom(['ACTIVE', 'PENDING_SIGNATURES', 'UNDER_CONTRACT', 'CLOSED']),
        property: {
            address: fullAddress,
            zpid: `zpid_${Math.floor(Math.random() * 1000000)}`
        },
        apn: `APN-${Math.floor(Math.random() * 1000000)}`,
        state: 'CO',
        purchase_price: Math.floor(500000 + Math.random() * 1000000),
        close_of_escrow_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        commission: "2.5%",
        important_dates: {
            acceptance_date: new Date(),
            contingency_removal_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        },
        created_at: new Date(),
        updated_at: new Date()
    };
};

export const generateMockTransactionParties = (transactionId: string): Partial<TransactionParty>[] => {
    return [
        {
            role: 'BUYER',
            display_name: getRandom(MOCK_FIRST_NAMES) + ' ' + getRandom(MOCK_LAST_NAMES),
            email: 'buyer@example.com',
            phone: '555-0101',
            address: getRandom(MOCK_CITIES) + ', CO',
            signing_required: true,
            signer_order: 1
        },
        {
            role: 'SELLER',
            display_name: getRandom(MOCK_FIRST_NAMES) + ' ' + getRandom(MOCK_LAST_NAMES),
            email: 'seller@example.com',
            phone: '555-0102',
            address: getRandom(MOCK_CITIES) + ', CO',
            signing_required: true,
            signer_order: 1
        },
        {
            role: 'AGENT',
            display_name: 'Alice Agent',
            email: 'alice@agency.com',
            phone: '555-0104',
            address: 'Real Estate Office',
            signing_required: true,
            signer_order: 2
        },
        {
            role: 'ESCROW',
            display_name: 'Western Title & Escrow',
            email: 'closings@westerntitle.com',
            phone: '555-9988',
            signing_required: false
        }
    ];
};

export const generateMockTransactionDocuments = (transactionId: string) => {
    return [
        {
            name: 'Purchase Agreement (RPA)',
            status: 'Completed',
            comments: 'Signed by all parties',
            category: 'Contract'
        },
        {
            name: 'Agency Disclosure (AD)',
            status: 'Completed',
            comments: '',
            category: 'Disclosure'
        },
        {
            name: 'Transfer Disclosure Statement (TDS)',
            status: 'Pending',
            comments: 'Waiting on seller signature',
            category: 'Disclosure'
        },
        {
            name: 'Preliminary Title Report',
            status: 'Completed',
            comments: 'Clear title confirmed',
            category: 'Title'
        },
        {
            name: 'Home Inspection Report',
            status: 'Completed',
            comments: 'Received, no major issues',
            category: 'Inspection'
        },
        {
            name: 'HOA Documents',
            status: 'Pending',
            comments: 'Requested from management co.',
            category: 'HOA'
        }
    ];
};
