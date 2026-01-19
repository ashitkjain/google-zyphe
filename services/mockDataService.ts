
import { Lead, CRMTask, CommTemplate } from '../types';

import { generateMockLead } from './mockData';

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
    // Offer: 1 (Skipping Active Search as requested)
    leads.push(generateMockLead('Seller', 'Offer Received', 'Offer', `mock_seller_offer_0`));
    // Closing: 1
    leads.push(generateMockLead('Seller', 'In Contract', 'Closing', `mock_seller_closing_0`));

    return leads;
};

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
