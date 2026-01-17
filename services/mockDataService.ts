
import { Lead, CRMTask, CommTemplate } from '../types';

export const getInitialMockLeads = (): Lead[] => [
    // --- LEADS (10) ---
    {
        id: 'lead_1', clientPhotoUrl: 'https://i.pravatar.cc/150?img=11', firstName: 'James', lastName: 'Wilson', email: 'james.w@example.com', phone: '(555) 123-4567',
        homeAddress: '8822 Ridgewood Dr, Los Angeles, CA 90034',
        source: 'Zillow', leadType: 'Buyer', status: 'New', receivedAt: new Date(Date.now() - 3600000),
        slaUrgency: 'high', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 450000, maxPrice: 550000, preferredNeighborhood: 'Northside' },
        message: "I'd like to see properties in Northside area.",
        callCount: 2,
        notesLog: [
            { id: 'nl_1', type: 'call', timestamp: new Date(Date.now() - 3600000), note: 'Initial introduction call. Discussed preferred neighborhoods.', callNumber: 1, outcome: 'Connected' },
            { id: 'nl_2', type: 'call', timestamp: new Date(Date.now() - 1800000), note: 'Sent neighborhood list via text.', callNumber: 2, outcome: 'Text' }
        ]
    },
    {
        id: 'lead_2', clientPhotoUrl: 'https://i.pravatar.cc/150?img=5', firstName: 'Sarah', lastName: 'Miller', email: 'sarah.m@example.com', phone: '(555) 234-5678',
        homeAddress: '155 N Lake Ave, Pasadena, CA 91101',
        source: 'Website', leadType: 'Buyer', status: 'Qualified', receivedAt: new Date(Date.now() - 7200000),
        slaUrgency: 'medium', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 800000, maxPrice: 950000, preferredNeighborhood: 'Downtown' },
        preQualified: true,
        callCount: 1,
        notesLog: [
            { id: 'nl_3', type: 'call', timestamp: new Date(Date.now() - 7200000), note: 'Left voicemail regarding pre-approval.', callNumber: 1, outcome: 'Voicemail' }
        ]
    },
    {
        id: 'lead_3', clientPhotoUrl: 'https://i.pravatar.cc/150?img=13', firstName: 'Robert', lastName: 'Taylor', email: 'robert.t@example.com', phone: '(555) 345-6789',
        homeAddress: '789 Oak Ln, Beverly Hills, CA 90210',
        source: 'Facebook', leadType: 'Seller', status: 'New', receivedAt: new Date(Date.now() - 10800000),
        slaUrgency: 'low', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 1200000,
        subjectPropertyDetails: { address: '789 Oak Ln, Beverly Hills' },
        reasonForSelling: 'Downsizing'
    },
    {
        id: 'lead_4', clientPhotoUrl: 'https://i.pravatar.cc/150?img=9', firstName: 'Emily', lastName: 'Davis', email: 'emily.d@example.com', phone: '(555) 456-7890',
        homeAddress: '4200 Sepulveda Blvd, Culver City, CA 90230',
        source: 'Manual', leadType: 'Buyer', status: 'New', receivedAt: new Date(Date.now() - 86400000),
        slaUrgency: 'high', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 300000, maxPrice: 400000, preferredNeighborhood: 'Westside' }
    },
    {
        id: 'lead_5', clientPhotoUrl: 'https://i.pravatar.cc/150?img=14', firstName: 'Michael', lastName: 'Brown', email: 'michael.b@example.com', phone: '(555) 567-8901',
        homeAddress: '123 Pine St, Glendale, CA 91206',
        source: 'Zillow', leadType: 'Seller', status: 'Qualified', receivedAt: new Date(Date.now() - 172800000),
        slaUrgency: 'medium', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 650000,
        subjectPropertyDetails: { address: '123 Pine St, Glendale' },
        homeValueNeeded: true
    },
    {
        id: 'lead_6', clientPhotoUrl: 'https://i.pravatar.cc/150?img=16', firstName: 'Jessica', lastName: 'Anderson', email: 'jessica.a@example.com', phone: '(555) 678-9012',
        homeAddress: '3300 W 6th St, Los Angeles, CA 90020',
        source: 'Instagram', leadType: 'Buyer', status: 'New', receivedAt: new Date(Date.now() - 259200000),
        slaUrgency: 'low', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 500000, maxPrice: 600000 },
        tags: ['First-Time'],
        callCount: 1,
        notesLog: [
            { id: 'nl_4', type: 'call', timestamp: new Date(Date.now() - 259200000), note: 'Followed up via email with community guide.', callNumber: 1, outcome: 'Email' }
        ]
    },
    {
        id: 'lead_7', clientPhotoUrl: 'https://i.pravatar.cc/150?img=15', firstName: 'David', lastName: 'Thomas', email: 'david.t@example.com', phone: '(555) 789-0123',
        homeAddress: '900 Wilshire Blvd, Los Angeles, CA 90017',
        source: 'Google', leadType: 'Buyer', status: 'New', receivedAt: new Date(Date.now() - 345600000),
        slaUrgency: 'medium', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 700000, maxPrice: 850000 }
    },
    {
        id: 'lead_8', clientPhotoUrl: 'https://i.pravatar.cc/150?img=20', firstName: 'Linda', lastName: 'Jackson', email: 'linda.j@example.com', phone: '(555) 890-1234',
        homeAddress: '456 Maple Dr, Pasadena, CA 91105',
        source: 'Direct', leadType: 'Seller', status: 'New', receivedAt: new Date(Date.now() - 432000000),
        slaUrgency: 'low', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 950000,
        subjectPropertyDetails: { address: '456 Maple Dr, Pasadena' }
    },
    {
        id: 'lead_9', clientPhotoUrl: 'https://i.pravatar.cc/150?img=33', firstName: 'Christopher', lastName: 'White', email: 'chris.w@example.com', phone: '(555) 901-2345',
        homeAddress: '111 Santa Monica Blvd, Santa Monica, CA 90401',
        source: 'Zillow', leadType: 'Buyer', status: 'Qualified', receivedAt: new Date(Date.now() - 518400000),
        slaUrgency: 'high', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 400000, maxPrice: 500000 },
        preQualified: true
    },
    {
        id: 'lead_10', clientPhotoUrl: 'https://i.pravatar.cc/150?img=24', firstName: 'Barbara', lastName: 'Harris', email: 'barbara.h@example.com', phone: '(555) 012-3456',
        homeAddress: '202 Birch Ave, Burbank, CA 91506',
        source: 'Website', leadType: 'Seller', status: 'Qualified', receivedAt: new Date(Date.now() - 604800000),
        slaUrgency: 'medium', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 1100000,
        subjectPropertyDetails: { address: '202 Birch Ave, Burbank' }
    },
    {
        id: 'lead_11', clientPhotoUrl: 'https://i.pravatar.cc/150?img=32', firstName: 'Urgency', lastName: 'Tester (Flash)', email: 'flash@example.com', phone: '(555) 999-1111',
        homeAddress: '123 Flash St, Los Angeles, CA 90001',
        source: 'Zillow', leadType: 'Buyer', status: 'New', receivedAt: new Date(Date.now() - 600000), // 10 mins ago
        slaUrgency: 'high', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        message: "I am a test lead from 10 mins ago. I should be flashing!"
    },
    {
        id: 'lead_12', clientPhotoUrl: 'https://i.pravatar.cc/150?img=44', firstName: 'Urgency', lastName: 'Tester (Red)', email: 'red@example.com', phone: '(555) 999-2222',
        homeAddress: '456 Red Way, Los Angeles, CA 90002',
        source: 'Website', leadType: 'Seller', status: 'New', receivedAt: new Date(Date.now() - 1620000), // 27 mins ago
        slaUrgency: 'high', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 500000,
        subjectPropertyDetails: { address: '456 Red Way, LA' },
        message: "I am a test lead from 27 mins ago. I should be deep red!"
    },

    // --- NURTURE (7) ---
    {
        id: 'nurture_1', clientPhotoUrl: 'https://i.pravatar.cc/150?img=53', firstName: 'Thomas', lastName: 'Martin', email: 'thomas.m@example.com', phone: '(555) 111-2222',
        homeAddress: '555 Spring St, Los Angeles, CA 90013',
        source: 'Referral', leadType: 'Buyer', status: 'Meeting Fixed', receivedAt: new Date(Date.now() - 1209600000),
        slaUrgency: 'low', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 550000, maxPrice: 650000 },
        notes: 'Follow up after summer vacation.'
    },
    {
        id: 'nurture_2', clientPhotoUrl: 'https://i.pravatar.cc/150?img=26', firstName: 'Susan', lastName: 'Thompson', email: 'susan.t@example.com', phone: '(555) 222-3333',
        homeAddress: '303 Ash Rd, Torrance, CA 90501',
        source: 'Facebook', leadType: 'Seller', status: 'Meeting Fixed', receivedAt: new Date(Date.now() - 1814400000),
        slaUrgency: 'medium', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 750000,
        subjectPropertyDetails: { address: '303 Ash Rd, Torrance' }
    },
    {
        id: 'nurture_3', clientPhotoUrl: 'https://i.pravatar.cc/150?img=59', firstName: 'Kevin', lastName: 'Garcia', email: 'kevin.g@example.com', phone: '(555) 333-4444',
        homeAddress: '777 Sunset Blvd, West Hollywood, CA 90046',
        source: 'Zillow', leadType: 'Buyer', status: 'Broker Agreement Sent', receivedAt: new Date(Date.now() - 2419200000),
        slaUrgency: 'medium', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 400000, maxPrice: 500000 }
    },
    {
        id: 'nurture_4', clientPhotoUrl: 'https://i.pravatar.cc/150?img=32', firstName: 'Karen', lastName: 'Martinez', email: 'karen.m@example.com', phone: '(555) 444-5555',
        homeAddress: '101 Cedar St, Irvine, CA 92602',
        source: 'Website', leadType: 'Seller', status: 'Broker Agreement Sent', receivedAt: new Date(Date.now() - 3024000000),
        slaUrgency: 'low', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 850000,
        subjectPropertyDetails: { address: '101 Cedar St, Irvine' }
    },
    {
        id: 'nurture_5', clientPhotoUrl: 'https://i.pravatar.cc/150?img=68', firstName: 'Daniel', lastName: 'Robinson', email: 'daniel.r@example.com', phone: '(555) 555-6666',
        homeAddress: '400 Main St, Venice, CA 90291',
        source: 'Google', leadType: 'Buyer', status: 'Meeting Fixed', receivedAt: new Date(Date.now() - 3628800000),
        slaUrgency: 'medium', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 900000, maxPrice: 1100000 }
    },
    {
        id: 'nurture_6', clientPhotoUrl: 'https://i.pravatar.cc/150?img=44', firstName: 'Lisa', lastName: 'Clark', email: 'lisa.c@example.com', phone: '(555) 666-7777',
        homeAddress: '555 Walnut Pl, Riverside, CA 92501',
        source: 'Direct', leadType: 'Seller', status: 'Meeting Fixed', receivedAt: new Date(Date.now() - 4233600000),
        slaUrgency: 'low', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 500000,
        subjectPropertyDetails: { address: '555 Walnut Pl, Riverside' }
    },
    {
        id: 'nurture_7', clientPhotoUrl: 'https://i.pravatar.cc/150?img=52', firstName: 'Paul', lastName: 'Rodriguez', email: 'paul.r@example.com', phone: '(555) 777-8888',
        homeAddress: '222 Hollywood Blvd, Hollywood, CA 90028',
        source: 'Referral', leadType: 'Buyer', status: 'Meeting Fixed', receivedAt: new Date(Date.now() - 4838400000),
        slaUrgency: 'medium', funnelStage: 'Nurture', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 600000, maxPrice: 700000 }
    },

    // --- ACTIVE SEARCH (5) ---
    {
        id: 'active_1', clientPhotoUrl: 'https://i.pravatar.cc/150?img=49', firstName: 'Nancy', lastName: 'Lewis', email: 'nancy.l@example.com', phone: '(555) 888-9999',
        homeAddress: '800 Abbot Kinney Blvd, Venice, CA 90291',
        source: 'Zillow', leadType: 'Buyer', status: 'Actively Searching', receivedAt: new Date(Date.now() - 5443200000),
        slaUrgency: 'high', funnelStage: 'Active', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 750000, maxPrice: 900000, preferredNeighborhood: 'Santa Monica' }
    },
    {
        id: 'active_2', clientPhotoUrl: 'https://i.pravatar.cc/150?img=55', firstName: 'George', lastName: 'Lee', email: 'george.l@example.com', phone: '(555) 999-0000',
        homeAddress: '666 Ocean Ave, Santa Monica, CA 90402',
        source: 'Website', leadType: 'Seller', status: 'Showing', receivedAt: new Date(Date.now() - 6048000000),
        slaUrgency: 'high', funnelStage: 'Active', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 1300000,
        subjectPropertyDetails: { address: '666 Ocean Ave, Santa Monica' }
    },
    {
        id: 'active_3', clientPhotoUrl: 'https://i.pravatar.cc/150?img=47', firstName: 'Sandra', lastName: 'Walker', email: 'sandra.w@example.com', phone: '(555) 000-1111',
        homeAddress: '999 Rodeo Dr, Beverly Hills, CA 90212',
        source: 'Referral', leadType: 'Buyer', status: 'Broker Agreement Signed', receivedAt: new Date(Date.now() - 6652800000),
        slaUrgency: 'medium', funnelStage: 'Active', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 500000, maxPrice: 650000 }
    },
    {
        id: 'active_4', clientPhotoUrl: 'https://i.pravatar.cc/150?img=60', firstName: 'Steven', lastName: 'Hall', email: 'steven.h@example.com', phone: '(555) 111-3333',
        homeAddress: '777 Hill St, Los Angeles, CA 90014',
        source: 'Website', leadType: 'Seller', status: 'Broker Agreement Signed', receivedAt: new Date(Date.now() - 7257600000),
        slaUrgency: 'medium', funnelStage: 'Active', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 800000,
        subjectPropertyDetails: { address: '777 Hill St, Los Angeles' }
    },
    {
        id: 'active_5', clientPhotoUrl: 'https://i.pravatar.cc/150?img=45', firstName: 'Margaret', lastName: 'Allen', email: 'margaret.a@example.com', phone: '(555) 222-4444',
        homeAddress: '333 Broadway, Santa Monica, CA 90401',
        source: 'Google', leadType: 'Buyer', status: 'Actively Searching', receivedAt: new Date(Date.now() - 7862400000),
        slaUrgency: 'high', funnelStage: 'Active', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 1200000, maxPrice: 1500000 }
    },

    // --- OFFER (3) ---
    {
        id: 'offer_1', clientPhotoUrl: 'https://i.pravatar.cc/150?img=12', firstName: 'Brian', lastName: 'Young', email: 'brian.y@example.com', phone: '(555) 333-5555',
        homeAddress: '1212 Pico Blvd, Santa Monica, CA 90405',
        source: 'Zillow', leadType: 'Buyer', status: 'Offer Submitted', receivedAt: new Date(Date.now() - 8467200000),
        slaUrgency: 'high', funnelStage: 'Offer', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 600000, maxPrice: 700000 },
        subjectPropertyDetails: { address: '543 Park Way, Glendale' }
    },
    {
        id: 'offer_2', clientPhotoUrl: 'https://i.pravatar.cc/150?img=65', firstName: 'Dorothy', lastName: 'Hernandez', email: 'dorothy.h@example.com', phone: '(555) 444-6666',
        homeAddress: '234 View Rd, Pasadena, CA 91103',
        source: 'Facebook', leadType: 'Seller', status: 'Offer Received', receivedAt: new Date(Date.now() - 9072000000),
        slaUrgency: 'high', funnelStage: 'Offer', health: 'Active', isMock: true, collectionName: 'leads',
        expectedPrice: 950000,
        subjectPropertyDetails: { address: '234 View Rd, Pasadena' }
    },
    {
        id: 'offer_3', clientPhotoUrl: 'https://i.pravatar.cc/150?img=3', firstName: 'Jason', lastName: 'King', email: 'jason.k@example.com', phone: '(555) 555-7777',
        homeAddress: '4321 Ventura Blvd, Studio City, CA 91604',
        source: 'Referral', leadType: 'Buyer', status: 'Offer Submitted', receivedAt: new Date(Date.now() - 9676800000),
        slaUrgency: 'high', funnelStage: 'Offer', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 850000, maxPrice: 1000000 },
        subjectPropertyDetails: { address: '890 Sunset Blvd, LA' }
    },

    // --- CONTRACT (1) ---
    {
        id: 'contract_1', clientPhotoUrl: 'https://i.pravatar.cc/150?img=28', firstName: 'Michelle', lastName: 'Carter', email: 'michelle.c@example.com', phone: '(555) 888-4444',
        homeAddress: '9876 Wilshire Blvd, Beverly Hills, CA 90210',
        source: 'Referral', leadType: 'Buyer', status: 'In Contract', receivedAt: new Date(Date.now() - 10281600000),
        slaUrgency: 'high', funnelStage: 'Contract', health: 'Active', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 1500000, maxPrice: 2000000 },
        subjectPropertyDetails: {
            address: '1234 Luxury Lane, Malibu',
            price: 1850000,
            bedrooms: 4,
            bathrooms: 3,
            sqft: 3200,
            propertyType: 'Single Family',
            mlsNumber: 'MLS-2024-1234'
        },
        stageLastChangedAt: new Date(Date.now() - 604800000), // 1 week ago
        clientId: 'C-M1C4R'
    },

    // --- CLOSED (2) ---
    {
        id: 'closed_1', clientPhotoUrl: 'https://i.pravatar.cc/150?img=10', firstName: 'Donna', lastName: 'Wright', email: 'donna.w@example.com', phone: '(555) 666-8888',
        homeAddress: '6543 La Cienega Blvd, Los Angeles, CA 90035',
        source: 'Google', leadType: 'Buyer', status: 'Closed-Won', receivedAt: new Date(Date.now() - 15552000000),
        slaUrgency: 'low', funnelStage: 'Closed', health: 'Responsive', isMock: true, collectionName: 'leads',
        inquiryProperty: { minPrice: 500000, maxPrice: 600000 },
        closedAt: new Date()
    },
    {
        id: 'closed_2', clientPhotoUrl: 'https://i.pravatar.cc/150?img=69', firstName: 'Kenneth', lastName: 'Lopez', email: 'kenneth.l@example.com', phone: '(555) 777-9999',
        homeAddress: '12000 Riverside Dr, Valley Village, CA 91607',
        source: 'Direct', leadType: 'Seller', status: 'Closed-Won', receivedAt: new Date(Date.now() - 15638400000),
        slaUrgency: 'low', funnelStage: 'Closed', health: 'Responsive', isMock: true, collectionName: 'leads',
        expectedPrice: 1200000,
        closedAt: new Date()
    }
];

export const getInitialMockTasks = (realtorId: string): CRMTask[] => [
    { id: 'mt_1', realtorId, title: 'Call Sarah Miller', description: 'Follow up on Zillow inquiry', dueDate: new Date(Date.now() + 3600000), status: 'Pending', priority: 'Urgent', type: 'Call', isMock: true },
    { id: 'mt_2', realtorId, title: 'Send analysis to David', description: 'He liked the modern kitchen in Malibu house', dueDate: new Date(Date.now() + 7200000), status: 'Pending', priority: 'High', type: 'Email', isMock: true },
    { id: 'mt_3', realtorId, title: 'Schedule showing', description: '456 Oak St for the Ross family', dueDate: new Date(Date.now() + 86400000), status: 'Pending', priority: 'Normal', type: 'Showing', isMock: true }
];

export const getInitialMockTemplates = (realtorId: string): CommTemplate[] => [
    { id: 'tpl_1', name: 'Initial Introduction', content: "Hi {{name}}, this is {{realtor}} from Zyphe AI. I saw you were looking at several listings in the northwest suburbs. I'd love to help you find the perfect match!", channel: 'SMS', category: 'Introduction', isMock: true },
    { id: 'tpl_2', name: 'Property Analysis Follow-up', content: "Hello {{name}}, following up on the AI analysis of {{address}}. Based on the data, this property is {{sentiment}}. Would you like to schedule a viewing?", channel: 'Email', category: 'Follow-up', isMock: true },
    { id: 'tpl_3', name: 'Viewing Scheduled', content: "Confirmation: We're set to view {{address}} at {{time}}. I'll meet you at the front entrance. See you soon!", channel: 'SMS', category: 'Viewing', isMock: true }
];
