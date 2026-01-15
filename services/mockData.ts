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
    return {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${getRandom(MOCK_GMAIL_DOMAINS)}`,
        phone: `555-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
        leadType: type,
        status: status || 'New',
        funnelStage: funnelStage || 'Leads',
        source: getRandom(MOCK_SOURCES),
        tags: getRandomSubset(MOCK_TAGS, Math.floor(Math.random() * 3)),
        propertyAddress: type === 'Seller' ? `${Math.floor(100 + Math.random() * 900)} ${getRandom(MOCK_STREETS)}, ${getRandom(MOCK_CITIES)}` : undefined,
        preferences: type === 'Buyer' ? {
            beds: Math.floor(2 + Math.random() * 3),
            baths: Math.floor(1 + Math.random() * 3),
            priceRange: { min: 300000, max: 800000 }
        } : undefined,
        createdAt: new Date(),
        lastUpdated: new Date(),
        callCount: Math.floor(Math.random() * 11),
        lastContactedAt: new Date(Date.now() - Math.floor(Math.random() * 1000000000))
    };
};
