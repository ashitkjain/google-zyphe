
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
    // Nurture: 3
    for (let i = 0; i < 3; i++) leads.push(generateMockLead('Seller', 'Meeting Fixed', 'Nurture', `mock_seller_nurture_${i}`));
    // Active Search: 2
    for (let i = 0; i < 2; i++) leads.push(generateMockLead('Seller', 'Showing', 'Active Search', `mock_seller_active_${i}`));
    // Offer: 1 (Skipping Active Search as requested) -- Wait, now we are adding it back
    leads.push(generateMockLead('Seller', 'Offer Received', 'Offer', `mock_seller_offer_0`));
    // Contract: 1
    leads.push(generateMockLead('Seller', 'In Contract', 'Contract', `mock_seller_closing_0`));

    return leads;
};

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
    transactions.push(generateMockTransaction('BUY', realtorId, undefined, 'mock_tx_buy_1'));
    // Link this one to our mock seller in closing
    transactions.push(generateMockTransaction('SELL', realtorId, 'mock_seller_closing_0', 'mock_tx_sell_1'));
    transactions.push(generateMockTransaction('BUY', realtorId, undefined, 'mock_tx_buy_2'));
    return transactions;
};
