
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
            ...l,
            receivedAt: new Date(l.receivedAt), // Convert string to Date
            lastUpdated: new Date(l.lastUpdated || Date.now()),
            health: 'Stale',
            isMock: true,
            collectionName: 'leads',

            // Ensure required nested fields are present
            financialVitals: l.financialVitals ? {
                preApprovalStatus: false,
                isAllCash: false,
                ...l.financialVitals
            } : undefined,
            searchCriteria: l.searchCriteria ? {
                mustHaves: '',
                dealBreakers: '',
                ...l.searchCriteria
            } : undefined,

            // Flat accessors for UI
            firstName,
            lastName,
            email: l.primaryContact.email,
            phone: l.primaryContact.phone,
            legalName: l.fullName,
            subjectProperty: l.searchCriteria.locations,
            propertyAddress: l.searchCriteria.locations,
        } as Lead;
    });

    return [...leads, ...archivedLeads];
};

const MOCK_ARCHIVED_DATA = [
    {
        "id": "archived_lead_1",
        "fullName": "James Wilson",
        "primaryContact": {
            "phone": "555-0101",
            "email": "j.wilson@email.com",
            "homeAddress": "98102"
        },
        "searchCriteria": {
            "locations": "Seattle, Capitol Hill"
        },
        "source": "Zillow",
        "receivedAt": "2023-03-12",
        "lastUpdated": "2023-06-15",
        "financialVitals": {
            "budgetMax": 1200000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Wants a modern condo with a view. Pre-approved but hesitant on rates."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_2",
        "fullName": "Sarah Thompson",
        "primaryContact": {
            "phone": "555-0102",
            "email": "sarah.t@gmail.com",
            "homeAddress": "98004"
        },
        "searchCriteria": {
            "locations": "Bellevue, Westway"
        },
        "source": "Referral",
        "receivedAt": "2022-11-05",
        "lastUpdated": "2023-01-20",
        "financialVitals": {
            "budgetMax": 2500000
        },
        "leadType": "Seller",
        "leadInfo": {
            "customerMessage": "Moving to California. Home needs minor staging before listing."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_3",
        "fullName": "Michael Chen",
        "primaryContact": {
            "phone": "555-0103",
            "email": "mchen88@outlook.com",
            "homeAddress": "98052"
        },
        "searchCriteria": {
            "locations": "Redmond, Education Hill"
        },
        "source": "Facebook",
        "receivedAt": "2023-06-20",
        "lastUpdated": "2023-09-10",
        "financialVitals": {
            "budgetMax": 950000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "First-time buyer. Looking for 3+ bedrooms near Microsoft."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_4",
        "fullName": "Emily Rodriguez",
        "primaryContact": {
            "phone": "555-0104",
            "email": "emily.rod@yahoo.com",
            "homeAddress": "98034"
        },
        "searchCriteria": {
            "locations": "Kirkland, Juanita"
        },
        "source": "Direct Mail",
        "receivedAt": "2023-01-15",
        "lastUpdated": "2023-04-02",
        "financialVitals": {
            "budgetMax": 1100000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Relocating for work. Needs a yard for two dogs."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_5",
        "fullName": "David Miller",
        "primaryContact": {
            "phone": "555-0105",
            "email": "dmiller_builds@email.com",
            "homeAddress": "98402"
        },
        "searchCriteria": {
            "locations": "Tacoma"
        },
        "source": "Google",
        "receivedAt": "2023-07-30",
        "lastUpdated": "2023-11-20",
        "financialVitals": {
            "budgetMax": 650000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Investor looking for multi-family units or fix-and-flips."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_6",
        "fullName": "Jessica Lee",
        "primaryContact": {
            "phone": "555-0106",
            "email": "jlee.design@me.com",
            "homeAddress": "98029"
        },
        "searchCriteria": {
            "locations": "Issaquah, Highlands"
        },
        "source": "Zillow",
        "receivedAt": "2023-02-10",
        "lastUpdated": "2023-05-25",
        "financialVitals": {
            "budgetMax": 1400000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Upsizing from a townhouse. Prefers new construction."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_7",
        "fullName": "Robert Garcia",
        "primaryContact": {
            "phone": "555-0107",
            "email": "rgarcia_wa@protonmail.com",
            "homeAddress": "98058"
        },
        "searchCriteria": {
            "locations": "Renton"
        },
        "source": "Referral",
        "receivedAt": "2022-09-14",
        "lastUpdated": "2022-12-01",
        "financialVitals": {
            "budgetMax": 800000
        },
        "leadType": "Seller",
        "leadInfo": {
            "customerMessage": "Downsizing after retirement. Ready to list once they find a smaller place."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_8",
        "fullName": "Amanda White",
        "primaryContact": {
            "phone": "555-0108",
            "email": "awhite.home@email.com",
            "homeAddress": "98021"
        },
        "searchCriteria": {
            "locations": "Bothel, Canyon Park"
        },
        "source": "Facebook",
        "receivedAt": "2023-05-02",
        "lastUpdated": "2023-08-14",
        "financialVitals": {
            "budgetMax": 900000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Searching for a quiet cul-de-sac. Needs a dedicated home office."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_9",
        "fullName": "William Taylor",
        "primaryContact": {
            "phone": "555-0109",
            "email": "wtaylor.pro@gmail.com",
            "homeAddress": "98119"
        },
        "searchCriteria": {
            "locations": "Seattle, Queen Anne"
        },
        "source": "Instagram",
        "receivedAt": "2023-08-18",
        "lastUpdated": "2023-10-05",
        "financialVitals": {
            "budgetMax": 1750000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "High-end buyer. Interested in historic homes with original character."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_10",
        "fullName": "Linda Martinez",
        "primaryContact": {
            "phone": "555-0110",
            "email": "lmartinez_77@yahoo.com",
            "homeAddress": "98031"
        },
        "searchCriteria": {
            "locations": "Kent"
        },
        "source": "Zillow",
        "receivedAt": "2023-04-12",
        "lastUpdated": "2023-07-22",
        "financialVitals": {
            "budgetMax": 700000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Looking for a starter home. Budget is strict."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_11",
        "fullName": "Thomas Anderson",
        "primaryContact": {
            "phone": "555-0111",
            "email": "tanderson.neo@email.com",
            "homeAddress": "98074"
        },
        "searchCriteria": {
            "locations": "Sammamish"
        },
        "source": "Google",
        "receivedAt": "2023-01-25",
        "lastUpdated": "2023-05-10",
        "financialVitals": {
            "budgetMax": 2200000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Wants a large lot near the lake. Cash buyer potential."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_12",
        "fullName": "Karen Brown",
        "primaryContact": {
            "phone": "555-0112",
            "email": "kbrown.re@outlook.com",
            "homeAddress": "98117"
        },
        "searchCriteria": {
            "locations": "Seattle, Ballard"
        },
        "source": "Referral",
        "receivedAt": "2022-12-08",
        "lastUpdated": "2023-03-15",
        "financialVitals": {
            "budgetMax": 1100000
        },
        "leadType": "Seller",
        "leadInfo": {
            "customerMessage": "Inherited property. Emotional sale. Needs guidance on repairs."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_13",
        "fullName": "Christopher Scott",
        "primaryContact": {
            "phone": "555-0113",
            "email": "cscott.it@gmail.com",
            "homeAddress": "98006"
        },
        "searchCriteria": {
            "locations": "Bellevue, Somerset"
        },
        "source": "Zillow",
        "receivedAt": "2023-07-05",
        "lastUpdated": "2023-09-28",
        "financialVitals": {
            "budgetMax": 1800000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Priority on school district ranking. Needs 4 bedrooms."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_14",
        "fullName": "Elizabeth Moore",
        "primaryContact": {
            "phone": "555-0114",
            "email": "emoore.arts@me.com",
            "homeAddress": "98033"
        },
        "searchCriteria": {
            "locations": "Kirkland, Totem Lake"
        },
        "source": "Facebook",
        "receivedAt": "2023-03-19",
        "lastUpdated": "2023-06-30",
        "financialVitals": {
            "budgetMax": 850000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Single professional. Wants a low-maintenance condo near transit."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_15",
        "fullName": "Daniel Harris",
        "primaryContact": {
            "phone": "555-0115",
            "email": "dharris_const@email.com",
            "homeAddress": "98133"
        },
        "searchCriteria": {
            "locations": "Shoreline"
        },
        "source": "Direct Mail",
        "receivedAt": "2023-05-25",
        "lastUpdated": "2023-08-10",
        "financialVitals": {
            "budgetMax": 1050000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "General contractor. Looking for a \"diamond in the rough\" to renovate."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_16",
        "fullName": "Jennifer Clark",
        "primaryContact": {
            "phone": "555-0116",
            "email": "jclark.nurse@yahoo.com",
            "homeAddress": "98036"
        },
        "searchCriteria": {
            "locations": "Lynnwood"
        },
        "source": "Google",
        "receivedAt": "2022-10-15",
        "lastUpdated": "2023-01-12",
        "financialVitals": {
            "budgetMax": 750000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Shift worker. Quiet neighborhood is a must."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_17",
        "fullName": "Matthew Lewis",
        "primaryContact": {
            "phone": "555-0117",
            "email": "mlewis_tech@gmail.com",
            "homeAddress": "98103"
        },
        "searchCriteria": {
            "locations": "Seattle, Fremont"
        },
        "source": "Instagram",
        "receivedAt": "2023-09-02",
        "lastUpdated": "2023-11-15",
        "financialVitals": {
            "budgetMax": 1300000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Tech worker. Wants to be walk-distance to coffee shops and parks."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_18",
        "fullName": "Susan Hall",
        "primaryContact": {
            "phone": "555-0118",
            "email": "shall.homes@outlook.com",
            "homeAddress": "98072"
        },
        "searchCriteria": {
            "locations": "Woodinville"
        },
        "source": "Referral",
        "receivedAt": "2023-02-28",
        "lastUpdated": "2023-06-05",
        "financialVitals": {
            "budgetMax": 1600000
        },
        "leadType": "Seller",
        "leadInfo": {
            "customerMessage": "Moving to a retirement community. Custom-built home with a large garden."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_19",
        "fullName": "Andrew Young",
        "primaryContact": {
            "phone": "555-0119",
            "email": "ayoung_dev@email.com",
            "homeAddress": "98201"
        },
        "searchCriteria": {
            "locations": "Everett"
        },
        "source": "Zillow",
        "receivedAt": "2023-04-05",
        "lastUpdated": "2023-07-10",
        "financialVitals": {
            "budgetMax": 600000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Looking for a fixer-upper with potential for an ADU."
        },
        "funnelStage": "Archived",
        "status": "New"
    },
    {
        "id": "archived_lead_20",
        "fullName": "Barbara Adams",
        "primaryContact": {
            "phone": "555-0120",
            "email": "badams.law@me.com",
            "homeAddress": "98004"
        },
        "searchCriteria": {
            "locations": "Bellevue, Enatai"
        },
        "source": "Google",
        "receivedAt": "2023-06-12",
        "lastUpdated": "2023-09-01",
        "financialVitals": {
            "budgetMax": 3500000
        },
        "leadType": "Buyer",
        "leadInfo": {
            "customerMessage": "Luxury buyer looking for waterfront or high-end estate."
        },
        "funnelStage": "Archived",
        "status": "New"
    }
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
