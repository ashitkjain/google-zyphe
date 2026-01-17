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
export const MOCK_TAGS = ["Urgent", "Cash Buyer", "First-time", "Investor", "Relocation"];

// Helper to get random item from array
export const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const getRandomSubset = <T>(arr: T[], count: number): T[] => arr.sort(() => 0.5 - Math.random()).slice(0, count);

// Helper constants
const MOCK_MESSAGES = [
    "I'm interested in viewing this property.",
    "Can you tell me more about the neighborhood?",
    "I'm looking to buy in the next 3 months.",
    "Is this property still available?",
    "I'd like to schedule a tour for this weekend."
];

const MOCK_TIMEFRAMES = ["ASAP", "1-3 Months", "3-6 Months", "6-12 Months", "1+ Year"];
const MOCK_TAGS_POOL = ["Urgent", "Cash Buyer", "First-time", "Investor", "Relocation", "Luxury", "Fixer-upper", "Waterfront"];
const MOCK_NEIGHBORHOODS = ["Downtown", "Cherry Creek", "Capitol Hill", "Highlands", "Washington Park"];
const MOCK_SCHOOLS = ["East High", "Cherry Creek High", "Denver South", "George Washington"];
const MOCK_DEAL_BREAKERS = ["No Garage", "Busy Street", "Needs Renovation", "Small Yard", "No POOL"];
const MOCK_LENDERS = ["Chase Bank", "Wells Fargo", "Rocket Mortgage", "Local Credit Union"];
const MOCK_REASONS_SELLING = ["Upgrading", "Downsizing", "Job Relocation", "Divorce", "Financial"];
const MOCK_OCCUPANCY = ['Owner Occupied', 'Vacant', 'Tenant Occupied'];

export const generateMockLead = (type: 'Buyer' | 'Seller', status?: string, funnelStage?: string): any => {
    const firstName = getRandom(MOCK_FIRST_NAMES);
    const lastName = getRandom(MOCK_LAST_NAMES);
    const streetNum = Math.floor(100 + Math.random() * 900);
    const streetName = getRandom(MOCK_STREETS);
    const city = getRandom(MOCK_CITIES);
    const fullAddress = `${streetNum} ${streetName}, ${city}, CO 80202`;
    const isBuyer = type === 'Buyer';
    const isSeller = type === 'Seller';

    const receivedDate = new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)); // Last 90 days

    return {
        id: `mock_${Math.random().toString(36).substr(2, 9)}`,

        // 1. Contact Information
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${getRandom(MOCK_GMAIL_DOMAINS)}`,
        phone: `(555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
        homeAddress: fullAddress,
        preferredContactMethod: getRandom(['Call', 'Text', 'Email']),
        smsConsent: Math.random() > 0.3, // 70% chance of consent
        clientPhotoUrl: Math.random() > 0.7 ? `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random` : undefined,

        // 2. Readiness & Context
        message: getRandom(MOCK_MESSAGES),
        timeframe: getRandom(MOCK_TIMEFRAMES),
        preApprovalStatus: isBuyer ? Math.random() > 0.6 : undefined,
        preQualified: isBuyer ? Math.random() > 0.5 : undefined,
        isAllCash: isBuyer ? Math.random() > 0.8 : undefined, // 20% chance
        isWarm: Math.random() > 0.6,
        isCold: Math.random() > 0.8,
        isLongTerm: Math.random() > 0.8,

        homeValueNeeded: isSeller ? Math.random() > 0.4 : undefined,
        reasonForSelling: isSeller ? getRandom(MOCK_REASONS_SELLING) : undefined,
        isMostImportantReq: Math.random() > 0.7,
        lenderContact: isBuyer && Math.random() > 0.5 ? getRandom(MOCK_LENDERS) : undefined,
        tags: getRandomSubset(MOCK_TAGS_POOL, Math.floor(Math.random() * 4)),

        slaUrgency: getRandom(['low', 'medium', 'high']),
        isHot: Math.random() > 0.85,
        isEngaged: Math.random() > 0.4,
        isEvaluatingAgent: Math.random() > 0.7,
        initialContactIn30Mins: Math.random() > 0.5,

        // Buyer specifics
        dealBreakers: isBuyer && Math.random() > 0.7 ? getRandomSubset(MOCK_DEAL_BREAKERS, 2) : undefined,
        neighborhoodTargets: isBuyer ? getRandomSubset(MOCK_NEIGHBORHOODS, 2) : undefined,
        schoolDistricts: isBuyer && Math.random() > 0.6 ? getRandomSubset(MOCK_SCHOOLS, 1) : undefined,

        // 3. Persona & Context
        generalInfo: `Looking for a ${isBuyer ? 'home' : 'buyer'} in the ${city} area.`,
        isFirstTimeBuyer: isBuyer ? Math.random() > 0.6 : undefined,
        isFirstTimeSeller: isSeller ? Math.random() > 0.6 : undefined,
        isInvestor: Math.random() > 0.85,
        isAlsoBuying: isSeller ? Math.random() > 0.4 : undefined,
        isAlsoSelling: isBuyer ? Math.random() > 0.3 : undefined,
        isPastClient: Math.random() > 0.9,
        gender: getRandom(['Male', 'Female', 'Prefer not to say']),
        occupancyStatus: isSeller ? getRandom(MOCK_OCCUPANCY) : undefined,
        existingAgentName: Math.random() > 0.8 ? "Competitor Agent" : undefined,

        // 4. Activity
        isCloseToOffer: isBuyer ? Math.random() > 0.7 : undefined,
        // (Complex lists like offers/tours/visitors left as empty/undefined for basic mock generation simplicity, 
        // can be expanded if specific UI needs them populated with objects)

        // 5. Timings
        leaseEndDate: isBuyer && Math.random() > 0.7 ? new Date(Date.now() + Math.random() * 10000000000) : undefined,
        sellWhen: isSeller ? getRandom(MOCK_TIMEFRAMES) : undefined,
        receivedAt: receivedDate,
        lastUpdated: new Date(),
        stageLastChangedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)),

        // 6. Referral & Source
        source: getRandom(MOCK_SOURCES),
        isReferredByPastClient: Math.random() > 0.85,
        isReferredByFriendFamily: Math.random() > 0.85,
        leadType: type,
        referralSource: Math.random() > 0.8 ? "John Doe" : undefined,

        // 7. Client Communication
        callCount: Math.floor(Math.random() * 10),
        offerCount: isBuyer ? Math.floor(Math.random() * 3) : undefined,
        channel: getRandom(['Email', 'Manual', 'CRM']),

        // 8. Properties
        inquiryProperty: isBuyer ? {
            minPrice: 300000,
            maxPrice: 800000,
            bedrooms: Math.floor(2 + Math.random() * 3),
            bathrooms: Math.floor(1 + Math.random() * 3),
            preferredNeighborhood: getRandom(MOCK_NEIGHBORHOODS)
        } : undefined,
        subjectPropertyDetails: isSeller ? {
            address: fullAddress,
            propertyType: 'Single Family',
            bedrooms: Math.floor(2 + Math.random() * 3),
            bathrooms: Math.floor(1 + Math.random() * 3),
        } : undefined,

        // 9. System
        status: status || 'New',
        funnelStage: funnelStage || 'Leads',
        health: getRandom(['Active', 'Stale', 'Dormant', 'Responsive']),
        isMock: true,
        collectionName: 'leads',
        clientId: Math.random() > 0.9 ? `client_${Math.floor(Math.random() * 1000)}` : undefined,
    };
};
