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
export const MOCK_SOURCES = ["Zillow", "Redfin", "Referral", "Website", "Walk-in"];
export const MOCK_TAGS = ["Urgent", "Cash Buyer", "First-time", "Investor", "Relocation"];

// Helper to get random item from array
export const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const getRandomSubset = <T>(arr: T[], count: number): T[] => arr.sort(() => 0.5 - Math.random()).slice(0, count);

export const generateMockLead = (type: 'Buyer' | 'Seller', status?: string, funnelStage?: string): any => {
    const firstName = getRandom(MOCK_FIRST_NAMES);
    const lastName = getRandom(MOCK_LAST_NAMES);
    const streetNum = Math.floor(100 + Math.random() * 900);
    const streetName = getRandom(MOCK_STREETS);
    const city = getRandom(MOCK_CITIES);
    const fullAddress = `${streetNum} ${streetName}, ${city}, CO 80202`;

    return {
        id: `mock_${Math.random().toString(36).substr(2, 9)}`,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${getRandom(MOCK_GMAIL_DOMAINS)}`,
        phone: `(555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
        homeAddress: fullAddress,
        leadType: type,
        connectionType: 'Direct Lead',
        status: status || 'New',
        funnelStage: funnelStage || 'Leads',
        source: getRandom(MOCK_SOURCES),
        tags: getRandomSubset(MOCK_TAGS, Math.floor(Math.random() * 3)),
        inquiryProperty: type === 'Buyer' ? {
            minPrice: 300000,
            maxPrice: 800000,
            bedrooms: Math.floor(2 + Math.random() * 3),
            bathrooms: Math.floor(1 + Math.random() * 3),
            preferredNeighborhood: getRandom(MOCK_STREETS)
        } : undefined,
        subjectPropertyDetails: type === 'Seller' ? {
            address: fullAddress,
            propertyType: 'Single Family',
            bedrooms: Math.floor(2 + Math.random() * 3),
            bathrooms: Math.floor(1 + Math.random() * 3),
        } : undefined,
        receivedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000)),
        lastUpdated: new Date(),
        callCount: Math.floor(Math.random() * 6),
        slaUrgency: getRandom(['low', 'medium', 'high']),
        health: getRandom(['new', 'engaged', 'active', 'cold', 'stale']),
        isMock: true,
        collectionName: 'leads'
    };
};
