
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getRealtorClients, getClientActivity, persistCommMessage, updateSmsConsent, updateFunnelStage, seedMockData, getLeads, getTasks, getTemplates, updateLead } from '../services/firebaseService';
import { UserProfile, Lead, LeadNote, Transaction, CRMTask, ActivityNote, CommMessage, CommThread, CommTemplate, FunnelStage, LeadHealth } from '../types';
import Logo from './Logo';
import LeadsList from './LeadsList';

interface Props {
    realtorId: string;
    onBack: () => void;
}

type HubTab = 'clients' | 'leads' | 'properties' | 'pipelines' | 'tasks' | 'comms';




const ClientHub: React.FC<Props> = ({ realtorId, onBack }) => {
    const [activeTab, setActiveTab] = useState<HubTab>('leads');
    const [clients, setClients] = useState<UserProfile[]>([]);
    const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
    const [clientActivity, setClientActivity] = useState<{ favorites: any[], views: any[] }>({ favorites: [], views: [] });
    const [loadingClients, setLoadingClients] = useState(true);
    const [loadingActivity, setLoadingActivity] = useState(false);

    // Communication Hub State
    const [messages, setMessages] = useState<CommMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [activeChannel, setActiveChannel] = useState<'SMS' | 'Email'>('SMS');
    const scrollRef = useRef<HTMLDivElement>(null);

    const [leads, setLeads] = useState<Lead[]>([]);
    const [tasks, setTasks] = useState<CRMTask[]>([]);
    const [templates, setTemplates] = useState<CommTemplate[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [newNote, setNewNote] = useState('');
    const [isSavingLead, setIsSavingLead] = useState(false);
    const [showStatusInfo, setShowStatusInfo] = useState(false);


    useEffect(() => {
        const initializeHubData = async () => {
            setLoadingData(true);

            // 1. Fetch Existing Data
            let _leads = await getLeads(realtorId);
            let _tasks = await getTasks(realtorId);
            let _templates = await getTemplates(realtorId);

            // 2. Define Mock Data (Always available for potential seeding)
            console.log("[ClientHub] Seeding initial mock data...");
            const initialLeads: Lead[] = [
                {
                    id: 'mock_1',
                    name: 'Sarah Miller',
                    email: 'sarah.m@gmail.com',
                    phone: '(555) 123-4567',
                    preferredContactMethod: 'Text',
                    source: 'Zillow',
                    leadType: 'Buyer',
                    connectionType: 'Live Connection',
                    status: 'Active',
                    receivedAt: new Date(Date.now() - 7200000), // 2 hours ago
                    slaUrgency: 'high',
                    preApprovalStatus: true,
                    timeframe: '1-3 months',
                    funnelStage: 'Inquiry',
                    health: 'Active',
                    propertyAddress: '123 Luxury Way, Beverly Hills',
                    price: 4250000,
                    propertyType: 'Single Family',
                    bedrooms: 4,
                    bathrooms: 3.5,
                    sqft: 3200,
                    message: "I'd like to see this home tomorrow at 5 PM",
                    tourRequestDate: new Date(Date.now() + 86400000),
                    tourRequestTime: '5:00 PM',
                    isMock: true
                },
                {
                    id: 'mock_2',
                    name: 'David Chen',
                    email: 'd.chen@outlook.com',
                    phone: '(555) 987-6543',
                    preferredContactMethod: 'Call',
                    source: 'Zillow',
                    leadType: 'Buyer',
                    connectionType: 'Direct Lead',
                    status: 'Connected',
                    receivedAt: new Date(Date.now() - 3600000),
                    slaUrgency: 'medium',
                    funnelStage: 'Nurture',
                    health: 'Stale',
                    message: "Is this property still available? I'm interested in the modern features shown in the photos.",
                    isMock: true
                },
                {
                    id: 'mock_4',
                    name: 'Elena Rodriguez',
                    email: 'elena.rodriguez@gmail.com',
                    phone: '(555) 444-3322',
                    preferredContactMethod: 'Text',
                    source: 'Zillow',
                    leadType: 'Buyer',
                    connectionType: 'Direct Lead',
                    status: 'New',
                    receivedAt: new Date(Date.now() - 300000),
                    slaUrgency: 'high',
                    funnelStage: 'Inquiry',
                    health: 'Active',
                    propertyAddress: '789 Sunset Blvd, Hollywood',
                    price: 1150000,
                    message: "Found this on Zillow. I have a pre-approval letter and would like to schedule a virtual tour this weekend.",
                    tourRequestDate: new Date(Date.now() + 172800000),
                    tourRequestTime: '10:00 AM',
                    isMock: true
                },
                {
                    id: 'mock_3',
                    name: 'Michael Ross',
                    email: 'mross@legal.com',
                    phone: '(555) 555-0199',
                    preferredContactMethod: 'Email',
                    source: 'Website',
                    leadType: 'Seller',
                    connectionType: 'Nurture',
                    status: 'New',
                    receivedAt: new Date(Date.now() - 18000000),
                    slaUrgency: 'low',
                    funnelStage: 'Nurture',
                    health: 'Dormant',
                    message: "Looking for an expert to list my condo in Santa Monica.",
                    isMock: true
                },
                {
                    id: 'mock_5',
                    name: 'James Wilson',
                    email: 'j.wilson@example.com',
                    phone: '(555) 222-3344',
                    preferredContactMethod: 'Email',
                    source: 'Zillow',
                    leadType: 'Buyer',
                    connectionType: 'Direct Lead',
                    status: 'Qualified',
                    receivedAt: new Date(Date.now() - 86400000 * 2),
                    slaUrgency: 'medium',
                    funnelStage: 'Nurture',
                    health: 'Active',
                    message: "Looking for a 3bd condo in downtown with a view.",
                    timeframe: '3-6 months',
                    maxPrice: 850000,
                    isMock: true
                },
                {
                    id: 'mock_6',
                    name: 'Linda Martinez',
                    email: 'linda.m@example.com',
                    phone: '(555) 333-4455',
                    preferredContactMethod: 'Call',
                    source: 'Referral',
                    leadType: 'Seller',
                    connectionType: 'Live Connection',
                    status: 'Appointment Scheduled',
                    receivedAt: new Date(Date.now() - 86400000 * 3),
                    slaUrgency: 'high',
                    funnelStage: 'Active',
                    health: 'Active',
                    message: "Meeting scheduled for listing consultation next Tuesday.",
                    propertyAddress: '456 Maple Dr, Suburbia',
                    price: 650000,
                    isMock: true
                },
                {
                    id: 'mock_7',
                    name: 'Robert Taylor',
                    email: 'rtaylor@example.com',
                    phone: '(555) 444-5566',
                    preferredContactMethod: 'Email',
                    source: 'Website',
                    leadType: 'Seller',
                    connectionType: 'Live Connection',
                    status: 'Listing Agreement Sent/Signed',
                    receivedAt: new Date(Date.now() - 86400000 * 5),
                    slaUrgency: 'high',
                    funnelStage: 'UnderContract',
                    health: 'Active',
                    message: "Listing agreement sent for digest signature. Waiting for return.",
                    propertyAddress: '789 Oak Ln, Countryside',
                    price: 925000,
                    isMock: true
                },
                {
                    id: 'mock_8',
                    name: 'Patricia Anderson',
                    email: 'patricia.a@example.com',
                    phone: '(555) 555-6677',
                    preferredContactMethod: 'Text',
                    source: 'Zillow',
                    leadType: 'Buyer',
                    connectionType: 'Nurture',
                    status: 'Closed-Won',
                    receivedAt: new Date(Date.now() - 86400000 * 30),
                    slaUrgency: 'low',
                    funnelStage: 'Closed',
                    health: 'Dormant',
                    message: "Closed on 123 Pine St. Sending thank you gift.",
                    propertyAddress: '123 Pine St, Cityville',
                    price: 550000,
                    closedAt: new Date(Date.now() - 86400000 * 5), // Closed 5 days ago
                    isMock: true
                },
                {
                    id: 'mock_9',
                    name: 'John Doe',
                    email: 'johndoe@example.com',
                    phone: '(555) 666-7788',
                    preferredContactMethod: 'Call',
                    source: 'Facebook',
                    leadType: 'Buyer',
                    connectionType: 'Direct Lead',
                    status: 'Attempted to Contact',
                    receivedAt: new Date(Date.now() - 86400000),
                    slaUrgency: 'medium',
                    funnelStage: 'Inquiry',
                    health: 'Stale',
                    message: "Left voicemail. No response yet.",
                    isMock: true
                },
                {
                    id: 'mock_10',
                    name: 'Ethan Smith',
                    email: 'ethan.s@example.com',
                    phone: '(555) 777-8899',
                    preferredContactMethod: 'Text',
                    source: 'Zillow',
                    leadType: 'Buyer',
                    connectionType: 'Direct Lead',
                    status: 'Active',
                    receivedAt: new Date(Date.now() - 3600000 * 2),
                    slaUrgency: 'high',
                    funnelStage: 'Active',
                    health: 'Active',
                    message: "Looking for a home with a large backyard.",
                    isMock: true
                },
                {
                    id: 'mock_11',
                    name: 'Olivia Brown',
                    email: 'olivia.b@example.com',
                    phone: '(555) 888-9900',
                    preferredContactMethod: 'Email',
                    source: 'Website',
                    leadType: 'Seller',
                    connectionType: 'Live Connection',
                    status: 'Qualified',
                    receivedAt: new Date(Date.now() - 14400000),
                    slaUrgency: 'medium',
                    funnelStage: 'Nurture',
                    health: 'Active',
                    message: "Thinking about selling in the spring.",
                    isMock: true
                },
                {
                    id: 'mock_12',
                    name: 'Noah Garcia',
                    email: 'noah.g@example.com',
                    phone: '(555) 999-0011',
                    preferredContactMethod: 'Call',
                    source: 'Referral',
                    leadType: 'Buyer',
                    connectionType: 'Direct Lead',
                    status: 'Active',
                    receivedAt: new Date(Date.now() - 86400000),
                    slaUrgency: 'high',
                    funnelStage: 'Active',
                    health: 'Active',
                    message: "Ready to move in 30 days.",
                    isMock: true
                },
                {
                    id: 'mock_13',
                    name: 'Ava Martinez',
                    email: 'ava.m@example.com',
                    phone: '(555) 000-1122',
                    preferredContactMethod: 'Text',
                    source: 'Facebook',
                    leadType: 'Buyer',
                    connectionType: 'Nurture',
                    status: 'Qualified',
                    receivedAt: new Date(Date.now() - 86400000 * 1.5),
                    slaUrgency: 'medium',
                    funnelStage: 'Active',
                    health: 'Active',
                    message: "Interested in new construction homes.",
                    isMock: true
                },
                {
                    id: 'mock_14',
                    name: 'William Davis',
                    email: 'william.d@example.com',
                    phone: '(555) 111-2233',
                    preferredContactMethod: 'Email',
                    source: 'Website',
                    leadType: 'Buyer',
                    connectionType: 'Direct Lead',
                    status: 'Active',
                    receivedAt: new Date(Date.now() - 7200000),
                    slaUrgency: 'high',
                    funnelStage: 'Active',
                    health: 'Active',
                    message: "Wants to see the luxury listing on Hilltop.",
                    isMock: true
                },
                // --- Bucket: NEW (5 New Leads) ---
                {
                    id: 'mock_15', name: 'Alice Cooper', email: 'alice.c@example.com', phone: '(555) 123-0001',
                    preferredContactMethod: 'Email', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'New', receivedAt: new Date(Date.now() - 600000), slaUrgency: 'high', funnelStage: 'Inquiry',
                    health: 'Active', message: "New inquiry from Zillow for the downtown condo.", isMock: true
                },
                {
                    id: 'mock_16', name: 'Bob Marley', email: 'bob.m@example.com', phone: '(555) 123-0002',
                    preferredContactMethod: 'Text', source: 'Website', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'New', receivedAt: new Date(Date.now() - 3600000), slaUrgency: 'high', funnelStage: 'Inquiry',
                    health: 'Active', message: "Just registered on the website.", isMock: true
                },
                {
                    id: 'mock_17', name: 'Charlie Day', email: 'charlie.d@example.com', phone: '(555) 123-0003',
                    preferredContactMethod: 'Call', source: 'Facebook', leadType: 'Seller', connectionType: 'Direct Lead',
                    status: 'New', receivedAt: new Date(Date.now() - 7200000), slaUrgency: 'medium', funnelStage: 'Inquiry',
                    health: 'Active', message: "Facebook lead interested in a home valuation.", isMock: true
                },
                {
                    id: 'mock_18', name: 'Diana Ross', email: 'diana.r@example.com', phone: '(555) 123-0004',
                    preferredContactMethod: 'Text', source: 'Referral', leadType: 'Buyer', connectionType: 'Live Connection',
                    status: 'New', receivedAt: new Date(Date.now() - 14400000), slaUrgency: 'high', funnelStage: 'Inquiry',
                    health: 'Active', message: "Referred by a past client.", isMock: true
                },
                {
                    id: 'mock_19', name: 'Edward Norton', email: 'edward.n@example.com', phone: '(555) 123-0005',
                    preferredContactMethod: 'Email', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'New', receivedAt: new Date(Date.now() - 86400000), slaUrgency: 'medium', funnelStage: 'Inquiry',
                    health: 'Active', message: "Interested in a tour this weekend.", isMock: true
                },
                // --- Bucket: ACTIVE (5 New Active Leads) ---
                {
                    id: 'mock_20', name: 'Fiona Apple', email: 'fiona.a@example.com', phone: '(555) 234-0001',
                    preferredContactMethod: 'Email', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Qualified', receivedAt: new Date(Date.now() - 86400000 * 5), slaUrgency: 'medium', funnelStage: 'Nurture',
                    health: 'Active', message: "Prefers modern kitchens.", isMock: true
                },
                {
                    id: 'mock_21', name: 'George Harrison', email: 'george.h@example.com', phone: '(555) 234-0002',
                    preferredContactMethod: 'Call', source: 'Website', leadType: 'Seller', connectionType: 'Live Connection',
                    status: 'Connected', receivedAt: new Date(Date.now() - 86400000 * 10), slaUrgency: 'medium', funnelStage: 'Active',
                    health: 'Active', message: "Discussing listing price.", isMock: true
                },
                {
                    id: 'mock_22', name: 'Hannah Montana', email: 'hannah.m@example.com', phone: '(555) 234-0003',
                    preferredContactMethod: 'Text', source: 'Referral', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Attempted to Contact', receivedAt: new Date(Date.now() - 86400000 * 2), slaUrgency: 'high', funnelStage: 'Inquiry',
                    health: 'Stale', message: "Called twice, no answer.", isMock: true
                },
                {
                    id: 'mock_23', name: 'Ian Wright', email: 'ian.w@example.com', phone: '(555) 234-0004',
                    preferredContactMethod: 'Call', source: 'Facebook', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Appointment Scheduled', receivedAt: new Date(Date.now() - 86400000 * 4), slaUrgency: 'high', funnelStage: 'Active',
                    health: 'Active', message: "Showing scheduled for Saturday.", isMock: true
                },
                {
                    id: 'mock_24', name: 'Justin Bieber', email: 'justin.b@example.com', phone: '(555) 234-0005',
                    preferredContactMethod: 'Text', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Listing Agreement Sent/Signed', receivedAt: new Date(Date.now() - 86400000 * 7), slaUrgency: 'high', funnelStage: 'Active',
                    health: 'Active', message: "Papers signed, moving to contract.", isMock: true
                },
                // --- Bucket: CLOSED (5 New Closed Leads) ---
                {
                    id: 'mock_25', name: 'Kelly Clarkson', email: 'kelly.c@example.com', phone: '(555) 345-0001',
                    preferredContactMethod: 'Email', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Closed-Won', receivedAt: new Date(Date.now() - 86400000 * 60), closedAt: new Date(Date.now() - 86400000 * 10),
                    slaUrgency: 'low', funnelStage: 'Closed', health: 'Dormant', message: "Deal closed successfully!", isMock: true
                },
                {
                    id: 'mock_26', name: 'Liam Neeson', email: 'liam.n@example.com', phone: '(555) 345-0002',
                    preferredContactMethod: 'Call', source: 'Website', leadType: 'Seller', connectionType: 'Live Connection',
                    status: 'Closed-Lost', receivedAt: new Date(Date.now() - 86400000 * 45), closedAt: new Date(Date.now() - 86400000 * 20),
                    slaUrgency: 'low', funnelStage: 'Closed', health: 'Dormant', message: "Decided not to sell.", isMock: true
                },
                {
                    id: 'mock_27', name: 'Megan Fox', email: 'megan.f@example.com', phone: '(555) 345-0003',
                    preferredContactMethod: 'Text', source: 'Referral', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Closed-Won', receivedAt: new Date(Date.now() - 86400000 * 90), closedAt: new Date(Date.now() - 86400000 * 5),
                    slaUrgency: 'low', funnelStage: 'Closed', health: 'Dormant', message: "Happy new homeowner.", isMock: true
                },
                {
                    id: 'mock_28', name: 'Nick Jonas', email: 'nick.j@example.com', phone: '(555) 345-0004',
                    preferredContactMethod: 'Call', source: 'Facebook', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Closed-Won', receivedAt: new Date(Date.now() - 86400000 * 30), closedAt: new Date(Date.now() - 86400000 * 2),
                    slaUrgency: 'low', funnelStage: 'Closed', health: 'Dormant', message: "Quick cash close.", isMock: true
                },
                {
                    id: 'mock_29', name: 'Oprah Winfrey', email: 'oprah.w@example.com', phone: '(555) 345-0005',
                    preferredContactMethod: 'Email', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Closed-Lost', receivedAt: new Date(Date.now() - 86400000 * 70), closedAt: new Date(Date.now() - 86400000 * 15),
                    slaUrgency: 'low', funnelStage: 'Closed', health: 'Dormant', message: "Bought with another agent.", isMock: true
                },
                // --- Bucket: ARCHIVED (5 New Archived Leads) ---
                {
                    id: 'mock_30', name: 'Peter Parker', email: 'peter.p@example.com', phone: '(555) 456-0001',
                    preferredContactMethod: 'Text', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Archived', receivedAt: new Date(Date.now() - 86400000 * 120), archivedAt: new Date(Date.now() - 86400000 * 30),
                    slaUrgency: 'low', funnelStage: 'Inquiry', health: 'Dormant', message: "Unsubscribed.", isMock: true
                },
                {
                    id: 'mock_31', name: 'Quentin Tarantino', email: 'quentin.t@example.com', phone: '(555) 456-0002',
                    preferredContactMethod: 'Email', source: 'Website', leadType: 'Seller', connectionType: 'Live Connection',
                    status: 'Archived', receivedAt: new Date(Date.now() - 86400000 * 150), archivedAt: new Date(Date.now() - 86400000 * 40),
                    slaUrgency: 'low', funnelStage: 'Inquiry', health: 'Dormant', message: "Moved out of state.", isMock: true
                },
                {
                    id: 'mock_32', name: 'Rihanna', email: 'rihanna@example.com', phone: '(555) 456-0003',
                    preferredContactMethod: 'Call', source: 'Facebook', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Archived', receivedAt: new Date(Date.now() - 86400000 * 200), archivedAt: new Date(Date.now() - 86400000 * 50),
                    slaUrgency: 'low', funnelStage: 'Inquiry', health: 'Dormant', message: "Not interested anymore.", isMock: true
                },
                {
                    id: 'mock_33', name: 'Steve Jobs', email: 'steve.j@example.com', phone: '(555) 456-0004',
                    preferredContactMethod: 'Text', source: 'Referral', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Archived', receivedAt: new Date(Date.now() - 86400000 * 180), archivedAt: new Date(Date.now() - 86400000 * 60),
                    slaUrgency: 'low', funnelStage: 'Inquiry', health: 'Dormant', message: "Invalid phone number.", isMock: true
                },
                {
                    id: 'mock_34', name: 'Taylor Swift', email: 'taylor.s@example.com', phone: '(555) 456-0005',
                    preferredContactMethod: 'Email', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'Archived', receivedAt: new Date(Date.now() - 86400000 * 250), archivedAt: new Date(Date.now() - 86400000 * 70),
                    slaUrgency: 'low', funnelStage: 'Inquiry', health: 'Dormant', message: "Too many spam calls.", isMock: true
                }
            ];

            const initialTasks: CRMTask[] = [
                { id: 'mt_1', realtorId, title: 'Call Sarah Miller', description: 'Follow up on Zillow inquiry', dueDate: new Date(Date.now() + 3600000), status: 'Pending', priority: 'Urgent', type: 'Call', isMock: true },
                { id: 'mt_2', realtorId, title: 'Send analysis to David', description: 'He liked the modern kitchen in Malibu house', dueDate: new Date(Date.now() + 7200000), status: 'Pending', priority: 'High', type: 'Email', isMock: true },
                { id: 'mt_3', realtorId, title: 'Schedule showing', description: '456 Oak St for the Ross family', dueDate: new Date(Date.now() + 86400000), status: 'Pending', priority: 'Normal', type: 'Showing', isMock: true }
            ];

            const initialTemplates: CommTemplate[] = [
                { id: 'tpl_1', name: 'Initial Introduction', content: "Hi {{name}}, this is {{realtor}} from Zyphe AI. I saw you were looking at several listings in the northwest suburbs. I'd love to help you find the perfect match!", channel: 'SMS', category: 'Introduction', isMock: true },
                { id: 'tpl_2', name: 'Property Analysis Follow-up', content: "Hello {{name}}, following up on the AI analysis of {{address}}. Based on the data, this property is {{sentiment}}. Would you like to schedule a viewing?", channel: 'Email', category: 'Follow-up', isMock: true },
                { id: 'tpl_3', name: 'Viewing Scheduled', content: "Confirmation: We're set to view {{address}} at {{time}}. I'll meet you at the front entrance. See you soon!", channel: 'SMS', category: 'Viewing', isMock: true }
            ];

            // Check if we need to seed (if any mock leads are missing)
            const existingIds = new Set(_leads.map(l => l.id));
            const shouldSeed = initialLeads.some(l => !existingIds.has(l.id));

            if (shouldSeed) {
                console.log("[ClientHub] Missing mock data detected. Seeding...");
                await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates);

                // Re-fetch after seeding
                _leads = await getLeads(realtorId);
                _tasks = await getTasks(realtorId);
                _templates = await getTemplates(realtorId);
            }

            setLeads(_leads);
            setTasks(_tasks);
            setTemplates(_templates);
            setLoadingData(false);
        };
        initializeHubData();
    }, [realtorId]);

    useEffect(() => {
        const fetchClients = async () => {
            setLoadingClients(true);
            const data = await getRealtorClients(realtorId);
            setClients(data);
            if (data.length > 0) {
                setSelectedClient(data[0]);
            }
            setLoadingClients(false);
        };
        fetchClients();
    }, [realtorId]);

    useEffect(() => {
        const fetchActivity = async () => {
            if (!selectedClient) return;
            setLoadingActivity(true);
            const data = await getClientActivity(selectedClient.uid);
            setClientActivity(data);

            // Mock initial messages
            setMessages([
                { id: 'm1', threadId: 't1', senderId: selectedClient.uid, receiverId: realtorId, content: "Hi, I'm interested in the 123 Maple St property you shared.", timestamp: new Date(Date.now() - 3600000), channel: 'SMS', status: 'sent' },
                { id: 'm2', threadId: 't1', senderId: realtorId, receiverId: selectedClient.uid, content: "Great! I just pulled the AI market report for it. It looks like a solid investment.", timestamp: new Date(Date.now() - 3000000), channel: 'SMS', status: 'delivered' },
                { id: 'm3', threadId: 't1', senderId: selectedClient.uid, receiverId: realtorId, content: "Thanks! Can we see it tomorrow?", timestamp: new Date(Date.now() - 500000), channel: 'SMS', status: 'sent' },
            ]);

            setLoadingActivity(false);
        };
        fetchActivity();
    }, [selectedClient, realtorId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedClient) return;

        const msg: Partial<CommMessage> = {
            threadId: 't1',
            senderId: realtorId,
            receiverId: selectedClient.uid,
            content: newMessage,
            channel: activeChannel,
            status: 'sent'
        };

        // UI Optimistic Update
        const localMsg: CommMessage = { ...msg, id: Date.now().toString(), timestamp: new Date() } as CommMessage;
        setMessages([...messages, localMsg]);
        setNewMessage('');

        // Persist to Firestore
        await persistCommMessage(msg, selectedClient.uid);
    };

    const handleGrantConsent = async () => {
        if (!selectedClient) return;
        const success = await updateSmsConsent(selectedClient.uid, true);
        if (success) {
            setSelectedClient({ ...selectedClient, smsConsent: true });
        }
    };

    const handleUpdateStage = async (stage: FunnelStage) => {
        if (!selectedClient) return;
        const success = await updateFunnelStage(selectedClient.uid, stage);
        if (success) {
            setSelectedClient({ ...selectedClient, funnelStage: stage });
        }
    };



    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };



    const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
        // Handle Archive/Activate Logic
        const currentLead = leads.find(l => l.id === leadId);
        if (currentLead) {
            // Archiving
            if (updates.status === 'Archived' && currentLead.status !== 'Archived') {
                updates.archivedAt = new Date();
            }
            // Activating
            else if (currentLead.status === 'Archived' && updates.status && updates.status !== 'Archived') {
                updates.activatedAt = new Date();
            }
            // Closing
            if (['Closed-Won', 'Closed-Lost'].includes(updates.status || '') && !['Closed-Won', 'Closed-Lost'].includes(currentLead.status)) {
                updates.closedAt = new Date();
            }
        }

        // Optimistic Update
        const previousLeads = [...leads];
        const leadExists = leads.some(l => l.id === leadId);
        if (leadExists) {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
        } else {
            // New Lead
            setLeads(prev => [{ ...updates, id: leadId } as Lead, ...prev]);
        }
        setEditingLead(null); // Close overlay if open

        setIsSavingLead(true);
        const success = await updateLead(leadId, updates);
        if (!success) {
            // Revert on failure
            setLeads(previousLeads);
            alert('Failed to save changes. Please try again.');
        }
        setIsSavingLead(false);
    };

    const handleCreateLead = () => {
        const newLead: Lead = {
            id: `lead_${Date.now()}`,
            name: '',
            email: '',
            phone: '',
            status: 'New',
            receivedAt: new Date(),
            source: 'Manual',
            leadType: 'Buyer',
            connectionType: 'Direct Lead',
            slaUrgency: 'medium',
            funnelStage: 'Inquiry',
            health: 'Active'
        };
        setEditingLead(newLead);
        setNewNote('');
    };



    const tabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'leads', label: 'Leads', icon: 'fa-bullseye' },
        { id: 'pipelines', label: 'Pipelines', icon: 'fa-route' },
        { id: 'clients', label: 'Clients', icon: 'fa-user-group' },
        { id: 'properties', label: 'Properties', icon: 'fa-house-chimney' },
        { id: 'tasks', label: 'Tasks', icon: 'fa-check-double' },
        { id: 'comms', label: 'Connect', icon: 'fa-comments' },
    ];

    // Helper for Lead Urgency Colors
    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'high': return 'rose';
            case 'medium': return 'amber';
            default: return 'emerald';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col animate-in fade-in duration-500 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Top Header / Tab Bar */}
            <header className="bg-slate-900 px-8 py-0 flex items-center justify-between border-b border-white/5 shadow-2xl relative z-50">
                <div className="flex items-center gap-12">
                    <div className="flex items-center gap-6 py-4">
                        <Logo size={90} onClick={onBack} className="cursor-pointer transition-transform hover:scale-105" />
                        <div className="h-8 w-px bg-white/10"></div>
                        <div className="flex flex-col">
                            <h1 className="text-white font-black text-2xl tracking-tighter">ClientHub</h1>
                        </div>
                    </div>

                    <nav className="flex items-center h-[72px]">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`relative h-full flex items-center gap-3 px-6 text-[11px] font-bold uppercase tracking-widest transition-all group overflow-hidden ${activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <i className={`fa-solid ${tab.icon} transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-indigo-500' : 'text-slate-500'}`}></i>
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-bottom border-t border-indigo-400/50"></div>
                                )}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">AI Integration Active</span>
                    </div>
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-2 text-white font-black uppercase tracking-widest text-[10px] bg-indigo-600 px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                    >
                        <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
                        Exit Hub
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {activeTab === 'clients' && (
                    <>
                        {/* Clients Sidebar */}
                        <div className="w-85 bg-white border-r border-slate-200 flex flex-col h-full shadow-2xl relative z-40">
                            <div className="p-8 border-b border-slate-100 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <i className="fa-solid fa-users text-indigo-500"></i>
                                        Your Network
                                    </h3>
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500">{clients.length}</span>
                                </div>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="Search by name, email, or area..."
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-2xl outline-none text-xs font-semibold transition-all shadow-inner"
                                    />
                                    <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-indigo-500"></i>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {loadingClients ? (
                                    <div className="p-12 text-center text-slate-200">
                                        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
                                    </div>
                                ) : clients.map((client) => (
                                    <button
                                        key={client.uid}
                                        onClick={() => setSelectedClient(client)}
                                        className={`w-full text-left p-5 rounded-[2rem] transition-all relative group ${selectedClient?.uid === client.uid
                                            ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200 translate-x-1'
                                            : 'hover:bg-slate-50 text-slate-600 hover:translate-x-1'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${selectedClient?.uid === client.uid ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                                {client.displayName?.[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm truncate leading-tight">{client.displayName}</div>
                                                <div className={`text-[9px] uppercase font-black tracking-widest mt-1 ${selectedClient?.uid === client.uid ? 'text-white/60' : 'text-slate-400'}`}>
                                                    {client.role} • Active Today
                                                </div>
                                            </div>
                                            {selectedClient?.uid === client.uid && (
                                                <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-lg shadow-white/50"></div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Clients Main Content */}
                        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8FAFC]">
                            {selectedClient ? (
                                <>
                                    <div className="p-10 bg-white border-b border-slate-200/60 shadow-sm relative z-10 flex items-center justify-between">
                                        <div className="flex items-center gap-8">
                                            <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center text-3xl font-black text-indigo-600 shadow-xl shadow-indigo-100 border border-indigo-100/50">
                                                {selectedClient.displayName?.[0]}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedClient.displayName}</h2>
                                                    <span className="px-3 py-1 bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                                                        {selectedClient.role}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <span className="text-slate-500 font-medium text-sm flex items-center gap-2">
                                                        <i className="fa-solid fa-envelope text-indigo-400"></i> {selectedClient.email}
                                                    </span>
                                                    <span className="text-slate-200">|</span>
                                                    <span className="text-slate-500 font-medium text-sm flex items-center gap-2">
                                                        <i className="fa-solid fa-phone text-indigo-400"></i> {selectedClient.phoneNumber || 'No phone'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-indigo-500 group shadow-sm">
                                                <span className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition-transform">{clientActivity.favorites.length}</span>
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Favorites</span>
                                            </button>
                                            <button className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center transition-all hover:border-indigo-500 group shadow-sm">
                                                <span className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition-transform">
                                                    {clientActivity.views.reduce((acc, curr) => acc + (curr.viewCount || 1), 0)}
                                                </span>
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Hits</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-10">
                                        {/* Client DNA Section */}
                                        <div className="bg-indigo-900 rounded-[3rem] p-8 mb-10 text-white relative overflow-hidden shadow-2xl">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                                            <div className="relative z-10 flex items-center justify-between">
                                                <div className="space-y-4 max-w-2xl">
                                                    <div className="flex items-center gap-3">
                                                        <div className="px-3 py-1 bg-amber-500 text-slate-900 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">AI Persona Insight</div>
                                                        <h3 className="text-xl font-black tracking-tight">Modern Luxury Seeker</h3>
                                                    </div>
                                                    <p className="text-indigo-100 text-sm leading-relaxed font-medium">
                                                        Based on {selectedClient.displayName}'s recent behavior, they are focusing on properties with <span className="font-bold text-white">open floor plans</span> and <span className="font-bold text-white">smart home integration</span>. They typically view properties in the <span className="font-bold text-amber-400">$800k-$1.2M range</span>, specifically in the northwest suburbs.
                                                    </p>
                                                    <div className="flex gap-3">
                                                        {['Modern Kitchen', 'Backyard Deck', 'School Score > 8'].map((tag, i) => (
                                                            <span key={i} className="px-4 py-2 bg-white/10 rounded-xl text-[10px] font-bold border border-white/10">{tag}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-5xl font-black text-amber-500 tracking-tighter">88%</div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mt-1">Intent Score</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                            {/* Interactive Timeline of Interest */}
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between px-2">
                                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                        Engagement Stream
                                                    </h3>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{clientActivity.views.length} Data Points</span>
                                                </div>

                                                {loadingActivity ? (
                                                    <div className="flex items-center justify-center p-20"><i className="fa-solid fa-circle-notch fa-spin text-4xl text-slate-200"></i></div>
                                                ) : clientActivity.views.length === 0 ? (
                                                    <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-slate-100">
                                                        <p className="text-slate-400 font-medium">No activity recorded yet.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {clientActivity.views.map((view, i) => (
                                                            <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all flex items-center justify-between group">
                                                                <div className="flex items-center gap-5 flex-1 min-w-0">
                                                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-indigo-500 font-black shrink-0 border border-slate-100">
                                                                        {view.viewCount || 1}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <h4 className="font-bold text-slate-900 text-sm truncate">{view.address}</h4>
                                                                        <div className="flex items-center gap-3 mt-1">
                                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDate(view.timestamp)}</span>
                                                                            <span className="opacity-10 text-slate-900">•</span>
                                                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 font-bold">Repeat View</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all transform translate-x-4 group-hover:translate-x-0">
                                                                    <i className="fa-solid fa-chevron-right text-xs"></i>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* High-Value Favorites */}
                                            <div className="space-y-6">
                                                <div className="flex items-center justify-between px-2">
                                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                                        Top Interests
                                                    </h3>
                                                    <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">Download List</button>
                                                </div>

                                                {clientActivity.favorites.length === 0 ? (
                                                    <div className="bg-white rounded-[2rem] p-16 text-center shadow-sm border border-slate-100">
                                                        <p className="text-slate-400 font-medium">No properties favorited yet.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-4">
                                                        {clientActivity.favorites.map((fav, i) => (
                                                            <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm hover:shadow-xl transition-all flex items-center gap-6 group">
                                                                <div className="w-20 h-20 rounded-2xl bg-slate-100 shrink-0 overflow-hidden relative border border-slate-200">
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                                                    <i className="fa-solid fa-camera text-slate-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></i>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-bold text-slate-900 text-sm truncate">{fav.address}</h4>
                                                                    <div className="flex items-center gap-3 mt-1.5">
                                                                        <span className="text-lg font-black text-emerald-600">${fav.price?.toLocaleString() || '---'}</span>
                                                                        <span className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded text-[9px] font-black uppercase tracking-widest border border-rose-100">Saved</span>
                                                                    </div>
                                                                </div>
                                                                <button className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                                                    <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50">
                                    <div className="w-48 h-48 bg-white rounded-[3rem] shadow-2xl shadow-indigo-100 flex items-center justify-center mb-10 border border-slate-100 animate-bounce-slow">
                                        <i className="fa-solid fa-users text-6xl text-slate-100"></i>
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Access Your Network</h2>
                                    <p className="text-slate-500 font-medium text-center max-w-sm mt-4 text-base leading-relaxed">
                                        Select a partner or client from the sidebar to visualize their property journey and AI insights.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Leads Tab */}
                {/* Leads Tab */}
                {activeTab === 'leads' && (
                    <LeadsList
                        leads={leads}
                        onUpdateLead={(id, updates) => handleUpdateLead(id, updates)}
                        onViewLead={(lead) => setEditingLead(lead)}
                        onCreateLead={handleCreateLead}
                    />
                )}

                {/* Properties Portfolio */}
                {activeTab === 'properties' && (
                    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
                        <div className="p-10 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                            <div className="space-y-1">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Market Portfolio</h2>
                                <div className="flex items-center gap-3">
                                    <span className="text-slate-500 font-medium text-sm">Managing listings, interests, and active transactions</span>
                                </div>
                            </div>
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                                {['Market Heat', 'My Listings', 'Transactions'].map((sub) => (
                                    <button key={sub} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'Market Heat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 xl:grid-cols-3 gap-10">
                            {/* Market Heat - Top 10 Trending */}
                            <div className="xl:col-span-2 space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                                        <i className="fa-solid fa-fire-flame-curved text-orange-500"></i>
                                        Trending Properties
                                    </h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                        { address: '123 Luxury Way, Beverly Hills', price: '$4,250,000', hits: 156, growth: '+22%', img: 'house1' },
                                        { address: '456 Modern Ave, Malibu', price: '$2,800,000', hits: 89, growth: '+12%', img: 'house2' },
                                        { address: '789 Sunset Blvd, Hollywood', price: '$1,150,000', hits: 245, growth: '+45%', img: 'house3' },
                                        { address: '101 Ocean Drive, Santa Monica', price: '$3,400,000', hits: 67, growth: '-5%', img: 'house4' },
                                    ].map((prop, i) => (
                                        <div key={i} className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-200/60 shadow-sm hover:shadow-2xl transition-all group cursor-pointer active:scale-98">
                                            <div className="h-48 bg-slate-100 flex items-center justify-center relative border-b border-slate-100">
                                                <i className="fa-solid fa-house-chimney text-4xl text-slate-200 group-hover:scale-110 transition-transform"></i>
                                                <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                                                    {prop.hits} Views
                                                </div>
                                            </div>
                                            <div className="p-6">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-slate-900 truncate flex-1">{prop.address}</h4>
                                                    <span className="text-emerald-600 font-black ml-4">{prop.growth}</span>
                                                </div>
                                                <div className="text-xl font-black text-indigo-600">{prop.price}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Sidebar - Recent Transaction Checklist */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Closing Roadmap</h3>
                                </div>
                                <div className="bg-white rounded-[3rem] p-8 border border-slate-200/60 shadow-xl space-y-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-indigo-900 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-900/20">
                                            <i className="fa-solid fa-file-invoice-dollar"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">123 Maple St</div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Escrow • Stage 4/6</div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            { label: 'Initial Inspection', status: 'Completed' },
                                            { label: 'Loan Approval', status: 'Completed' },
                                            { label: 'Appraisal Report', status: 'Action' },
                                            { label: 'Title Search', status: 'Pending' },
                                            { label: 'Closing Docs', status: 'Pending' },
                                        ].map((step, i) => (
                                            <div key={i} className="flex items-center gap-4 group">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${step.status === 'Completed' ? 'bg-emerald-500 border-emerald-500 text-white' :
                                                    step.status === 'Action' ? 'bg-white border-amber-500 text-amber-500 animate-pulse' : 'bg-white border-slate-200 text-slate-200'
                                                    }`}>
                                                    {step.status === 'Completed' ? <i className="fa-solid fa-check text-[10px]"></i> : <div className="w-1.5 h-1.5 rounded-full bg-current"></div>}
                                                </div>
                                                <span className={`text-xs font-bold transition-colors ${step.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{step.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="w-full py-4 bg-slate-50 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-slate-100 hover:bg-slate-900 hover:text-white transition-all">
                                        Open Transaction Vault
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pipelines Tab */}
                {activeTab === 'pipelines' && (
                    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
                        <div className="p-10 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Deal Pipelines</h2>
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                                {['Buyers', 'Sellers'].map((sub) => (
                                    <button key={sub} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'Buyers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto p-10 flex gap-8 whitespace-nowrap scrollbar-thin scrollbar-thumb-indigo-100">
                            {[
                                { stage: 'Leads', color: 'slate', cards: ['Sarah Miller', 'David Chen'] },
                                { stage: 'Showing', color: 'indigo', cards: ['Elena Rodriguez'] },
                                { stage: 'Offers', color: 'rose', cards: ['Michael Ross'] },
                                { stage: 'Contract', color: 'emerald', cards: ['Jessica Park'] },
                                { stage: 'Closed', color: 'amber', cards: ['The Garcias'] },
                            ].map((col, i) => (
                                <div key={i} className="min-w-[320px] max-w-[320px] flex flex-col gap-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                                            <div className={`w-1.5 h-1.5 rounded-full bg-${col.color}-500`}></div>
                                            {col.stage}
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-300">{col.cards.length}</span>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        {col.cards.map((card, j) => (
                                            <div key={j} className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:scale-[1.02] cursor-grab active:cursor-grabbing transition-all border-l-4" style={{ borderColor: `var(--color-${col.color}-500)` }}>
                                                <div className="font-bold text-slate-900 text-sm mb-2">{card}</div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex -space-x-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-50 border border-white text-[8px] flex items-center justify-center font-bold text-slate-400 shadow-sm">AI</div>
                                                    </div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Next: Call</div>
                                                </div>
                                            </div>
                                        ))}
                                        <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[2rem] text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-indigo-300 hover:text-indigo-500 transition-all">
                                            + Add Potential
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tasks Tab */}
                {activeTab === 'tasks' && (
                    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
                        <div className="p-10 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Today's Focus</h2>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 animate-pulse flex items-center gap-2">
                                    <i className="fa-solid fa-brain text-indigo-500"></i> AI Priority Sorting Active
                                </span>
                                <button className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10">Add Task</button>
                            </div>
                        </div>

                        <div className="flex-1 p-10 max-w-5xl mx-auto w-full overflow-y-auto">
                            <div className="space-y-6">
                                {tasks.map((task) => (
                                    <div key={task.id} className="bg-white p-8 rounded-[3rem] border border-slate-200/60 shadow-xl group hover:border-indigo-200 transition-all flex items-center gap-8 relative overflow-hidden">
                                        <div className={`absolute top-0 left-0 w-2 h-full ${task.priority === 'Urgent' ? 'bg-rose-500' : task.priority === 'High' ? 'bg-amber-500' : 'bg-indigo-500'}`}></div>
                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                            <i className={`fa-solid ${task.type === 'Call' ? 'fa-phone' : task.type === 'Email' ? 'fa-envelope' : 'fa-calendar'} text-2xl`}></i>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-1">
                                                <h4 className="text-xl font-black text-slate-900 tracking-tight">{task.title}</h4>
                                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${task.priority === 'Urgent' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                    }`}>{task.priority}</span>
                                            </div>
                                            <p className="text-slate-500 font-medium">{task.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Due {formatDate(task.dueDate)}</div>
                                            <button className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95">Complete Item</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Communication Hub Tab */}
                {activeTab === 'comms' && (
                    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
                        <div className="p-10 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                            <div className="flex items-center gap-6">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Connect</h2>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button
                                        onClick={() => setActiveChannel('SMS')}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeChannel === 'SMS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        SMS
                                    </button>
                                    <button
                                        onClick={() => setActiveChannel('Email')}
                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeChannel === 'Email' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        Email
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2">
                                    {['Call Logs', 'Recordings', 'Templates'].map((btn, i) => (
                                        <button key={i} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm">{btn}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Combined Timeline & Chat */}
                            <div className="flex-1 flex flex-col h-full border-r border-slate-200/60">
                                <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 scroll-smooth">
                                    {/* Timeline Mixins */}
                                    {/* SMS Consent Banner */}
                                    {activeChannel === 'SMS' && !selectedClient?.smsConsent && (
                                        <div className="flex justify-center mb-8">
                                            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 max-w-xl shadow-xl shadow-amber-500/5 flex items-center gap-8 animate-in zoom-in duration-500">
                                                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                                                    <i className="fa-solid fa-shield-halved text-2xl"></i>
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest mb-1">SMS Consent Required</h4>
                                                    <p className="text-xs font-bold text-amber-700 leading-relaxed">
                                                        Federal regulations require explicit consent before sending SMS. Would you like to record {selectedClient?.displayName}'s consent for recording and messaging?
                                                    </p>
                                                    <div className="flex gap-3 mt-4">
                                                        <button
                                                            onClick={handleGrantConsent}
                                                            className="px-6 py-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
                                                        >
                                                            Record Consent
                                                        </button>
                                                        <button className="px-6 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 transition-all">
                                                            Learn More
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Merged View: Timeline Events + Messages */}
                                    {messages.map((msg, i) => (
                                        <div key={msg.id} className={`flex ${msg.senderId === realtorId ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                            <div className={`max-w-[70%] group relative`}>
                                                <div className={`p-6 rounded-[2rem] shadow-xl ${msg.senderId === realtorId
                                                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200'
                                                    : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-slate-200'
                                                    }`}>
                                                    <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                                                    <div className={`text-[8px] font-black uppercase tracking-widest mt-2 flex items-center gap-2 ${msg.senderId === realtorId ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                        {formatDate(msg.timestamp)} • {msg.channel}
                                                        {msg.senderId === realtorId && <i className={`fa-solid fa-check-double ${msg.status === 'read' ? 'text-emerald-400' : ''}`}></i>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Auto-Logged Activity Item */}
                                    <div className="flex items-center gap-6 px-10 py-6 bg-indigo-50 rounded-[2.5rem] border border-indigo-100 border-dashed relative">
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0">
                                            <i className="fa-solid fa-bolt"></i>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">System Audit • Auto-Logged</div>
                                            <p className="text-xs font-bold text-indigo-900">Sarah viewed 123 Maple St (4th time). Suggesting follow-up via SMS.</p>
                                        </div>
                                        <button className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:underline">View Properties</button>
                                    </div>
                                </div>

                                {/* Message Input Area */}
                                <div className="p-8 bg-white border-t border-slate-200/60">
                                    <div className="flex items-center gap-4 mb-4">
                                        <select className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all">
                                            <option>Quick Templates</option>
                                            {templates.map(t => <option key={t.id}>{t.name}</option>)}
                                        </select>
                                        <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all">
                                            <i className="fa-solid fa-paperclip"></i> Attach Discovery
                                        </button>
                                    </div>
                                    <div className="relative flex items-center gap-4">
                                        <div className="flex-1 relative">
                                            <textarea
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                placeholder={`Type your ${activeChannel} message...`}
                                                className="w-full pl-6 pr-12 py-4 bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 rounded-[2rem] outline-none text-sm font-medium transition-all shadow-inner resize-none min-h-[60px]"
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                            />
                                            <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-200 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                                                <i className="fa-solid fa-microphone text-xs"></i>
                                            </button>
                                        </div>
                                        <button
                                            onClick={handleSendMessage}
                                            className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95"
                                        >
                                            <i className="fa-solid fa-paper-plane text-lg"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Sidebar: Contextual Info */}
                            <div className="w-80 bg-[#F8FAFC] p-8 space-y-8 hidden xl:block">
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact Insights</h3>
                                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500">Last Call</span>
                                            <span className="text-xs font-black text-slate-900">Yesterday</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500">Wait Time</span>
                                            <span className="text-xs font-black text-emerald-500">4 mins</span>
                                        </div>
                                        <div className="h-px bg-slate-100"></div>
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[9px] font-black uppercase text-slate-400">Common Snippets</span>
                                            <div className="flex flex-wrap gap-2">
                                                {['Schedule Showing', 'Pricing Info', 'Neighborhood'].map(s => (
                                                    <button key={s} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[8px] font-black uppercase text-slate-500 hover:border-indigo-500 transition-all">{s}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Call Summary AI</h3>
                                    <div className="bg-indigo-900 p-6 rounded-[2rem] shadow-xl text-white">
                                        <p className="text-[10px] font-medium leading-relaxed opacity-80">
                                            "Client mentioned they are pre-approved but want to see the backyard personally before making an offer on any property."
                                        </p>
                                        <div className="mt-4 flex items-center gap-2">
                                            <i className="fa-solid fa-robot text-amber-500 text-[10px]"></i>
                                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-300">Extracted from Call #402</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Lead Edit Modal */}
            {editingLead && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">{leads.some(l => l.id === editingLead.id) ? 'Edit Lead Data' : 'Create New Lead'}</h3>
                                <p className="text-sm text-slate-500 font-medium">
                                    {leads.some(l => l.id === editingLead.id) ? `Update profile for ${editingLead.name}` : 'Enter basic contact and property details'}
                                </p>
                            </div>
                            <button onClick={() => setEditingLead(null)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editingLead.name}
                                        onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        defaultValue={editingLead.email}
                                        onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={editingLead.phone}
                                        onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        placeholder="(555) 000-0000"
                                    />
                                </div>
                                <div className="space-y-2 relative">
                                    <div className="flex items-center gap-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lead Status</label>
                                        <div
                                            className="inline-flex self-center text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowStatusInfo(!showStatusInfo);
                                            }}
                                        >
                                            <i className="fa-solid fa-circle-info text-[10px]"></i>
                                        </div>
                                    </div>

                                    {showStatusInfo && (
                                        <div className="absolute top-6 left-0 w-80 bg-white shadow-xl rounded-xl border border-slate-200 p-4 z-50 mt-2 text-left cursor-default" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Status Definitions</h4>
                                                <button onClick={() => setShowStatusInfo(false)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                                {[
                                                    ["New", "Leads added to the system but not yet engaged."],
                                                    ["Qualified", "Prospect meets criteria and is actively looking to buy/sell."],
                                                    ["Attempted to Contact", "Agent has tried to reach out (call, email)."],
                                                    ["Connected", "Successful initial contact made, prospect is aware and responding."],
                                                    ["Appointment Scheduled", "A specific meeting or showing is booked."],
                                                    ["Listing Agreement Sent/Signed", "For sellers, formal agreement is in process or completed."],
                                                    ["Active", "Actively working with them on a transaction."],
                                                    ["Closed-Won", "The deal is finalized."],
                                                    ["Closed-Lost", "The lead is no longer viable, with reasons tracked."],
                                                    ["Archived", "Not currently working; may be unsubscribed from marketing."]
                                                ].map(([status, desc]) => (
                                                    <div key={status} className="text-xs">
                                                        <div className="font-bold text-indigo-900 mb-0.5">{status}</div>
                                                        <div className="text-slate-500 leading-snug">{desc}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <select
                                        defaultValue={editingLead.status}
                                        onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as any })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                                    >
                                        {['New', 'Qualified', 'Attempted to Contact', 'Connected', 'Appointment Scheduled', 'Listing Agreement Sent/Signed', 'Active', 'Closed-Won', 'Closed-Lost', 'Archived'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lead Type</label>
                                    <select
                                        defaultValue={editingLead.leadType}
                                        onChange={(e) => setEditingLead({ ...editingLead, leadType: e.target.value as any })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                                    >
                                        {['Buyer', 'Seller', 'Rental', 'Mortgage'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Preferred Contact</label>
                                    <select
                                        defaultValue={editingLead.preferredContactMethod || 'Text'}
                                        onChange={(e) => setEditingLead({ ...editingLead, preferredContactMethod: e.target.value as any })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                                    >
                                        {['Call', 'Text', 'Email'].map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Subject Property Address</label>
                                    <input
                                        type="text"
                                        defaultValue={editingLead.propertyAddress}
                                        onChange={(e) => setEditingLead({ ...editingLead, propertyAddress: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        placeholder="123 Example St, City, State"
                                    />
                                </div>

                                {/* Property Details Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Property Type</label>
                                        <input
                                            type="text"
                                            defaultValue={editingLead.propertyType}
                                            onChange={(e) => setEditingLead({ ...editingLead, propertyType: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                            placeholder="Single Family"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">MLS Number</label>
                                        <input
                                            type="text"
                                            defaultValue={editingLead.mlsNumber}
                                            onChange={(e) => setEditingLead({ ...editingLead, mlsNumber: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                            placeholder="MLS12345"
                                        />
                                    </div>
                                </div>

                                {/* Property Specs Row */}
                                <div className="grid grid-cols-4 gap-4 col-span-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Price ($)</label>
                                        <input
                                            type="number"
                                            defaultValue={editingLead.price}
                                            onChange={(e) => setEditingLead({ ...editingLead, price: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Beds</label>
                                        <input
                                            type="number"
                                            defaultValue={editingLead.bedrooms}
                                            onChange={(e) => setEditingLead({ ...editingLead, bedrooms: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Baths</label>
                                        <input
                                            type="number"
                                            defaultValue={editingLead.bathrooms}
                                            onChange={(e) => setEditingLead({ ...editingLead, bathrooms: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sq Ft</label>
                                        <input
                                            type="number"
                                            defaultValue={editingLead.sqft}
                                            onChange={(e) => setEditingLead({ ...editingLead, sqft: Number(e.target.value) })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Lead Readiness / Timeframe</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 1-3 months"
                                        defaultValue={editingLead.timeframe}
                                        onChange={(e) => setEditingLead({ ...editingLead, timeframe: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">User Message</label>
                                <textarea
                                    defaultValue={editingLead.message}
                                    onChange={(e) => setEditingLead({ ...editingLead, message: e.target.value })}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none min-h-[80px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes Log</label>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-3">
                                    {editingLead.notesLog && editingLead.notesLog.length > 0 ? (
                                        editingLead.notesLog.map((note) => (
                                            <div key={note.id} className="bg-white p-3 rounded-lg border border-slate-100 text-xs shadow-sm">
                                                <div className="flex justify-between text-slate-400 text-[10px] mb-1">
                                                    <span>{new Date(note.timestamp).toLocaleString()}</span>
                                                    <span>{note.author || 'System'}</span>
                                                </div>
                                                <div className="text-slate-700 whitespace-pre-wrap">{note.content}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center text-slate-400 italic text-xs py-4">No notes recorded yet.</div>
                                    )}
                                </div>
                                <textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    rows={2}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none mt-2"
                                    placeholder="Add a new note..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tags</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {editingLead.tags?.map((tag, index) => (
                                        <span key={index} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold flex items-center gap-2">
                                            {tag}
                                            <button onClick={() => {
                                                const newTags = editingLead.tags?.filter((_, i) => i !== index);
                                                setEditingLead({ ...editingLead, tags: newTags });
                                            }} className="hover:text-indigo-800"><i className="fa-solid fa-xmark"></i></button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder="Add tag and press Enter..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value.trim();
                                            if (val) {
                                                const currentTags = editingLead.tags || [];
                                                if (!currentTags.includes(val)) {
                                                    setEditingLead({ ...editingLead, tags: [...currentTags, val] });
                                                }
                                                e.currentTarget.value = '';
                                            }
                                        }
                                    }}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                />
                            </div>

                            {/* System Fields */}
                            <div className="grid grid-cols-2 gap-4 col-span-2 pt-4 border-t border-slate-100">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assigned To</label>
                                    <input
                                        type="text"
                                        defaultValue={editingLead.assignedTo}
                                        onChange={(e) => setEditingLead({ ...editingLead, assignedTo: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        placeholder="Team Member"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Channel</label>
                                    <select
                                        defaultValue={editingLead.channel || 'Manual'}
                                        onChange={(e) => setEditingLead({ ...editingLead, channel: e.target.value as any })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                                    >
                                        {['Email', 'API', 'Manual', 'CRM', 'Others'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2 text-xs text-slate-400 text-right">
                                    Last Updated: {editingLead.lastUpdated ? new Date(editingLead.lastUpdated).toLocaleString() : 'Never'}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 flex items-center justify-between">
                            <button onClick={() => setEditingLead(null)} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-all underline underline-offset-4">Cancel Changes</button>
                            <button
                                onClick={() => {
                                    if (editingLead) {
                                        // Mandatory Validation
                                        if (!editingLead.name.trim() || !editingLead.phone.trim()) {
                                            alert("Name and Phone Number are mandatory fields.");
                                            return;
                                        }

                                        const updatedLead = { ...editingLead };

                                        // Handle New Note
                                        if (newNote.trim()) {
                                            const noteEntry: LeadNote = {
                                                id: crypto.randomUUID(),
                                                content: newNote.trim(),
                                                timestamp: new Date().toISOString(),
                                                author: 'User'
                                            };
                                            updatedLead.notesLog = [...(updatedLead.notesLog || []), noteEntry];
                                            updatedLead.notes = newNote.trim(); // Update latest note for list view
                                        }

                                        handleUpdateLead(updatedLead.id, updatedLead);
                                        setNewNote(''); // Clear input
                                        setEditingLead(null);
                                    }
                                }}
                                disabled={isSavingLead}
                                className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] text-xs font-black shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3"
                            >
                                {isSavingLead ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                                {isSavingLead ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
          50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s infinite;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
        </div >
    );
};

export default ClientHub;
