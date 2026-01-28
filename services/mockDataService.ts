
import { Lead, CRMTask, CommTemplate, Transaction } from '../types';
import { generateMockLead, generateMockTransaction } from './mockData';

export const getInitialMockLeads = (): Lead[] => {
    const leads: Lead[] = [];

    // --- BUYERS (Total 20) ---
    // Leads: 10
    for (let i = 0; i < 10; i++) leads.push(generateMockLead('Buyer', 'New', 'Leads', `mock_buyer_lead_${i}`));
    // Nurture: 5
    for (let i = 0; i < 5; i++) leads.push(generateMockLead('Buyer', 'Meeting Fixed', 'Nurture', `mock_buyer_nurture_${i}`));
    // Active Search: 3
    for (let i = 0; i < 3; i++) leads.push(generateMockLead('Buyer', 'Actively Searching', 'Active Search', `mock_buyer_active_${i}`));
    // Offer: 2
    for (let i = 0; i < 2; i++) leads.push(generateMockLead('Buyer', 'Offer Submitted', 'Offer', `mock_buyer_offer_${i}`));


    // --- SELLERS (Total 10) ---
    // Leads: 5
    for (let i = 0; i < 5; i++) leads.push(generateMockLead('Seller', 'New', 'Leads', `mock_seller_lead_${i}`));
    // Nurture: 3
    for (let i = 0; i < 3; i++) leads.push(generateMockLead('Seller', 'Meeting Fixed', 'Nurture', `mock_seller_nurture_${i}`));
    // Active Search: 2
    for (let i = 0; i < 2; i++) leads.push(generateMockLead('Seller', 'Showing', 'Active Search', `mock_seller_active_${i}`));
    // Offer: 1
    leads.push(generateMockLead('Seller', 'Offer Received', 'Offer', `mock_seller_offer_0`));
    // Contract: 1
    leads.push(generateMockLead('Seller', 'In Contract', 'Contract', `mock_seller_closing_0`));

    // --- ARCHIVED LEADS (Total 20) ---
    const archivedLeads: Lead[] = MOCK_ARCHIVED_DATA.map(l => {
        const nameParts = l.fullName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        return {
            id: l.id,
            clientId: l.id, // Ensure clientId is set
            firstName,
            lastName,
            email: l.primaryContact.email,
            phone: l.primaryContact.phone,
            status: 'Archived', // Explicitly set status matching FunnelStage
            source: l.source,
            leadType: l.leadType as any, // Cast to LeadType
            funnelStage: 'Archived',
            receivedAt: new Date(l.receivedAt),
            lastUpdated: new Date(),
            health: 'Stale',
            engagementScore: 'None',
            isMock: true,
            collectionName: 'leads',

            // Map search criteria
            searchCriteria: {
                locations: l.searchCriteria.locations,
                priceMin: 0,
                priceMax: l.searchCriteria.priceMax,
                mustHaves: '',
                dealBreakers: ''
            },

            // Default financial vitals
            financialVitals: {
                budgetMax: l.searchCriteria.priceMax,
                preApprovalStatus: false, // Default
                isAllCash: false, // Default
            },

            // Other fields
            leadInfo: {
                ...l.leadInfo,
                referralType: 'Direct',
                campaign: 'None'
            },
            notes: l.leadInfo.customerMessage,

            // Flat accessors for UI compatibility
            legalName: l.fullName,
            subjectProperty: l.searchCriteria.locations,
            propertyAddress: l.searchCriteria.locations,

            realtorId: 'mock_realtor', // Will be overwritten by seeder
        } as unknown as Lead;
    });

    return [...leads, ...archivedLeads];
};

const MOCK_ARCHIVED_DATA = [
    // --- BUYERS (10) ---
    { id: 'L-B01', fullName: 'Sarah Miller', receivedAt: new Date(Date.now() - 86400000 * 45).toISOString(), source: 'Zillow', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 45).toISOString(), searchCriteria: { locations: 'Denver, CO', priceMax: 750000 }, primaryContact: { email: 'sarah.m@example.com', phone: '+15551234567' }, leadInfo: { customerMessage: 'Looking for 3bd in Denver.' } },
    { id: 'L-B02', fullName: 'Mike Johnson', receivedAt: new Date(Date.now() - 86400000 * 120).toISOString(), source: 'Realtor.com', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 120).toISOString(), searchCriteria: { locations: 'Aurora, CO', priceMax: 500000 }, primaryContact: { email: 'mike.j@example.com', phone: '+15559876543' }, leadInfo: { customerMessage: 'Investment property interest.' } },
    { id: 'L-B03', fullName: 'Jennifer Davis', receivedAt: new Date(Date.now() - 86400000 * 14).toISOString(), source: 'Open House', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 14).toISOString(), searchCriteria: { locations: 'Boulder, CO', priceMax: 850000 }, primaryContact: { email: 'jen.d@example.com', phone: '+15554567890' }, leadInfo: { customerMessage: 'Visited 123 Main St.' } },
    { id: 'L-B04', fullName: 'Robert Chen', receivedAt: new Date(Date.now() - 86400000 * 180).toISOString(), source: 'Referral', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 180).toISOString(), searchCriteria: { locations: 'Cherry Creek, CO', priceMax: 1200000 }, primaryContact: { email: 'r.chen@example.com', phone: '+15557890123' }, leadInfo: { customerMessage: 'Ghosted after 2 showings.' } },
    { id: 'L-B05', fullName: 'Amanda Wilson', receivedAt: new Date(Date.now() - 86400000 * 60).toISOString(), source: 'Website', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 60).toISOString(), searchCriteria: { locations: 'Lakewood, CO', priceMax: 500000 }, primaryContact: { email: 'amanda.w@example.com', phone: '+15551112233' }, leadInfo: { customerMessage: 'First time homebuyer.' } },
    { id: 'L-B06', fullName: 'David Lee', receivedAt: new Date(Date.now() - 86400000 * 90).toISOString(), source: 'Zillow', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 90).toISOString(), searchCriteria: { locations: 'Denver, CO', priceMax: 450000 }, primaryContact: { email: 'david.l@example.com', phone: '+15552223344' }, leadInfo: { customerMessage: 'Looking for condo.' } },
    { id: 'L-B07', fullName: 'Emma Thompson', receivedAt: new Date(Date.now() - 86400000 * 200).toISOString(), source: 'Realtor.com', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 200).toISOString(), searchCriteria: { locations: 'Highlands Ranch, CO', priceMax: 900000 }, primaryContact: { email: 'emma.t@example.com', phone: '+15553334455' }, leadInfo: { customerMessage: 'Relocating.' } },
    { id: 'L-B08', fullName: 'James Garcia', receivedAt: new Date(Date.now() - 86400000 * 30).toISOString(), source: 'Referral', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 30).toISOString(), searchCriteria: { locations: 'Arvada, CO', priceMax: 700000 }, primaryContact: { email: 'james.g@example.com', phone: '+15554445566' }, leadInfo: { customerMessage: 'Pre-approved but picky.' } },
    { id: 'L-B09', fullName: 'Sophia Martinez', receivedAt: new Date(Date.now() - 86400000 * 25).toISOString(), source: 'Open House', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 25).toISOString(), searchCriteria: { locations: 'Golden, CO', priceMax: 0 }, primaryContact: { email: 'sophia.m@example.com', phone: '+15555556677' }, leadInfo: { customerMessage: 'Just looking.' } },
    { id: 'L-B10', fullName: 'William Brown', receivedAt: new Date(Date.now() - 86400000 * 300).toISOString(), source: 'Website', leadType: 'Buyer', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 300).toISOString(), searchCriteria: { locations: 'Centennial, CO', priceMax: 600000 }, primaryContact: { email: 'bill.b@example.com', phone: '+15556667788' }, leadInfo: { customerMessage: 'Inactive.' } },

    // --- SELLERS (5) ---
    { id: 'L-S01', fullName: 'Linda Taylor', receivedAt: new Date(Date.now() - 86400000 * 40).toISOString(), source: 'Home Valuation', leadType: 'Seller', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 40).toISOString(), searchCriteria: { locations: 'Parker, CO', priceMax: 850000 }, primaryContact: { email: 'linda.t@example.com', phone: '+15559998877' }, leadInfo: { customerMessage: 'Thinking of selling.' } },
    { id: 'L-S02', fullName: 'Richard Anderson', receivedAt: new Date(Date.now() - 86400000 * 100).toISOString(), source: 'Referral', leadType: 'Seller', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 100).toISOString(), searchCriteria: { locations: 'Boulder, CO', priceMax: 1100000 }, primaryContact: { email: 'rich.a@example.com', phone: '+15558887766' }, leadInfo: { customerMessage: 'Delayed selling.' } },
    { id: 'L-S03', fullName: 'Patricia Thomas', receivedAt: new Date(Date.now() - 86400000 * 150).toISOString(), source: 'Direct Mail', leadType: 'Seller', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 150).toISOString(), searchCriteria: { locations: 'Thornton, CO', priceMax: 650000 }, primaryContact: { email: 'pat.t@example.com', phone: '+15557776655' }, leadInfo: { customerMessage: 'Testing the waters.' } },
    { id: 'L-S04', fullName: 'Charles Jackson', receivedAt: new Date(Date.now() - 86400000 * 10).toISOString(), source: 'Zillow', leadType: 'Seller', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 10).toISOString(), searchCriteria: { locations: 'Englewood, CO', priceMax: 400000 }, primaryContact: { email: 'charles.j@example.com', phone: '+15556665544' }, leadInfo: { customerMessage: 'Inherited property.' } },
    { id: 'L-S05', fullName: 'Barbara White', receivedAt: new Date(Date.now() - 86400000 * 20).toISOString(), source: 'Website', leadType: 'Seller', funnelStage: 'Archived', lastActivity: new Date(Date.now() - 86400000 * 20).toISOString(), searchCriteria: { locations: 'Littleton, CO', priceMax: 750000 }, primaryContact: { email: 'barb.w@example.com', phone: '+15555554433' }, leadInfo: { customerMessage: 'Looking to downsize.' } }
];

export const getInitialMockTasks = (realtorId: string): CRMTask[] => [
    { id: 'mt_1', realtorId, name: 'Call Sarah Miller', comment: 'Follow up on Zillow inquiry', dueDate: new Date(Date.now() + 3600000), status: 'Pending', priority: 'Urgent', isMock: true } as any,
    { id: 'mt_2', realtorId, name: 'Send analysis to David', comment: 'He liked the modern kitchen in Malibu house', dueDate: new Date(Date.now() + 7200000), status: 'Pending', priority: 'High', isMock: true } as any,
    { id: 'mt_3', realtorId, name: 'Schedule showing', comment: '456 Oak St for the Ross family', dueDate: new Date(Date.now() + 86400000), status: 'Pending', priority: 'Normal', isMock: true } as any
];

export const getInitialMockTemplates = (realtorId: string): CommTemplate[] => [
    { id: 'tpl_1', name: 'Initial Introduction', content: "Hi {{name}}, this is {{realtor}} from Zyphe AI. I saw you were looking at several listings in the northwest suburbs. I'd love to help you find the perfect match!", channel: 'SMS', category: 'Introduction', isMock: true },
    { id: 'tpl_2', name: 'Property Analysis Follow-up', content: "Hello {{name}}, following up on the AI analysis of {{address}}. Based on the data, this property is {{sentiment}}. Would you like to schedule a viewing?", channel: 'Email', category: 'Follow-up', isMock: true },
    { id: 'tpl_3', name: 'Viewing Scheduled', content: "Confirmation: We're set to view {{address}} at {{time}}. I'll meet you at the front entrance. See you soon!", channel: 'SMS', category: 'Viewing', isMock: true }
];

export const getInitialMockTransactions = (realtorId: string): Transaction[] => {
    const transactions: Transaction[] = [];
    // Link this to our mock seller who IS in the 'Contract' stage (mock_seller_closing_0)
    transactions.push(generateMockTransaction('SELL', realtorId, 'mock_seller_closing_0', 'mock_tx_sell_1'));
    return transactions;
};
