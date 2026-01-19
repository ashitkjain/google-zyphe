
import { Lead, CRMTask, CommTemplate } from '../types';

import { generateMockLead } from './mockData';

export const getInitialMockLeads = (): Lead[] => {
    const leads: Lead[] = [];

    // --- LEADS (10) ---
    for (let i = 0; i < 5; i++) leads.push(generateMockLead('Buyer', 'New', 'Leads'));
    for (let i = 0; i < 5; i++) leads.push(generateMockLead('Seller', 'New', 'Leads'));

    // --- NURTURE (7) ---
    for (let i = 0; i < 4; i++) leads.push(generateMockLead('Buyer', 'Meeting Fixed', 'Nurture'));
    for (let i = 0; i < 3; i++) leads.push(generateMockLead('Seller', 'Meeting Fixed', 'Nurture'));

    // --- ACTIVE SEARCH (5) ---
    for (let i = 0; i < 3; i++) leads.push(generateMockLead('Buyer', 'Actively Searching', 'Active Search'));
    for (let i = 0; i < 2; i++) leads.push(generateMockLead('Seller', 'Showing', 'Active Search'));

    // --- OFFER (3) ---
    for (let i = 0; i < 2; i++) leads.push(generateMockLead('Buyer', 'Offer Submitted', 'Offer'));
    leads.push(generateMockLead('Seller', 'Offer Received', 'Offer'));

    // --- CONTRACT (1) ---
    leads.push(generateMockLead('Buyer', 'In Contract', 'Contract'));

    // --- CLOSED (2) ---
    leads.push(generateMockLead('Buyer', 'Closed-Won', 'Closed')); // Assuming 'Closed' stage exists in logic even if not in config
    leads.push(generateMockLead('Seller', 'Closed-Won', 'Closed'));

    // Add some specific high urgency leads for testing
    const urgencyLead = generateMockLead('Buyer', 'New', 'Leads');
    urgencyLead.fullName = "Urgency Tester"; // Updated from firstName/lastName
    urgencyLead.engagementScore = 'Hot'; // Updated from slaUrgency
    urgencyLead.motivation = "I need to buy ASAP!"; // Updated from message
    leads.push(urgencyLead);

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
