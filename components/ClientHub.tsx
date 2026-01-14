import React, { useState, useEffect, useRef } from 'react';
import { getRealtorClients, getClientActivity, persistCommMessage, updateSmsConsent, updateFunnelStage, seedMockData, getLeads, getTasks, getTemplates, updateLead, activateLeadToCollection, addPipelineNote, getPipelineNotes, updatePipelineNote, deletePipelineNote } from '../services/firebaseService';
import { UserProfile, Lead, LeadNote, CRMTask, CommMessage, CommTemplate, FunnelStage, PipelineNote } from '../types';
import { DropResult } from '@hello-pangea/dnd';
import Logo from './Logo';
import LeadsList from './LeadsList';

// Sub-components
import ClientNetwork from './client-hub/ClientNetwork';
import PipelineBoard from './client-hub/PipelineBoard';
import EditLeadModal from './client-hub/EditLeadModal';
import TaskBoard from './client-hub/TaskBoard';
import CommHub from './client-hub/CommHub';
import PropertiesPortfolio from './client-hub/PropertiesPortfolio';

interface Props {
    realtorId: string;
    onBack: () => void;
}

type HubTab = 'clients' | 'leads' | 'pipeline' | 'tasks' | 'comms';

const ClientHub: React.FC<Props> = ({ realtorId, onBack }) => {
    const [activeTab, setActiveTab] = useState<HubTab>('leads');
    const [pipelineSubTab, setPipelineSubTab] = useState<'buying' | 'selling'>('buying');
    const [clients, setClients] = useState<UserProfile[]>([]);
    const [selectedClient, setSelectedClient] = useState<UserProfile | Lead | null>(null);
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

    // Pipeline Notes State
    const [pipelineNotes, setPipelineNotes] = useState<PipelineNote[]>([]);
    const [pendingNote, setPendingNote] = useState<{ leadId: string, color: string } | null>(null);

    useEffect(() => {
        const initializeHubData = async () => {
            setLoadingData(true);

            // 1. Fetch Existing Data
            const _incoming = await getLeads(realtorId, ['leads']);
            const _buyers = await getLeads(realtorId, ['buyers']);
            const _sellers = await getLeads(realtorId, ['sellers']);
            let _leads = [..._incoming, ..._buyers, ..._sellers];
            let _tasks = await getTasks(realtorId);
            let _templates = await getTemplates(realtorId);
            let _notes = await getPipelineNotes(realtorId);

            // 2. Define Mock Data (Always available for potential seeding)
            console.log("[ClientHub] Seeding initial mock data...");
            const initialLeads: Lead[] = [
                // --- Incoming Pool (leads collection) ---
                {
                    id: 'mock_1', name: 'Alice Cooper', email: 'alice.c@example.com', phone: '(555) 123-0001',
                    preferredContactMethod: 'Email', source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'New', receivedAt: new Date(Date.now() - 600000), slaUrgency: 'high', funnelStage: 'Inquiry',
                    health: 'Active', message: "New inquiry from Zillow for the downtown condo.", isMock: true, collectionName: 'leads',
                    minPrice: 400000, maxPrice: 600000
                },
                {
                    id: 'mock_2', name: 'Bob Marley', email: 'bob.m@example.com', phone: '(555) 123-0002',
                    preferredContactMethod: 'Text', source: 'Website', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'New', receivedAt: new Date(Date.now() - 3600000), slaUrgency: 'high', funnelStage: 'Inquiry',
                    health: 'Active', message: "Just registered on the website.", isMock: true, collectionName: 'leads',
                    minPrice: 800000, maxPrice: 1200000
                },

                // --- Buying Pipeline (buyers collection) ---
                {
                    id: 'mock_buy_1', name: 'Sarah Miller', email: 'sarah.m@gmail.com', phone: '(555) 123-4567',
                    source: 'Zillow', leadType: 'Buyer', status: 'Active', receivedAt: new Date(Date.now() - 7200000),
                    slaUrgency: 'high', funnelStage: 'Nurture', health: 'Active', minPrice: 3800000, maxPrice: 4500000,
                    propertyAddress: '123 Luxury Way, Beverly Hills', isMock: true, collectionName: 'buyers', connectionType: 'Direct Lead'
                },
                {
                    id: 'mock_buy_2', name: 'David Chen', email: 'd.chen@outlook.com', phone: '(555) 987-6543',
                    source: 'Zillow', leadType: 'Buyer', status: 'Active', receivedAt: new Date(Date.now() - 3600000),
                    slaUrgency: 'medium', funnelStage: 'Active', health: 'Active', minPrice: 1100000, maxPrice: 1400000,
                    propertyAddress: '789 Sunset Blvd, Hollywood', isMock: true, collectionName: 'buyers', connectionType: 'Direct Lead'
                },
                {
                    id: 'mock_buy_3', name: 'James Wilson', email: 'j.wilson@example.com', phone: '(555) 222-3344',
                    source: 'Zillow', leadType: 'Buyer', status: 'Active', receivedAt: new Date(Date.now() - 86400000 * 2),
                    slaUrgency: 'medium', funnelStage: 'Offer', health: 'Active', minPrice: 750000, maxPrice: 900000,
                    propertyAddress: 'Downtown Loft #4B', isMock: true, collectionName: 'buyers', connectionType: 'Direct Lead'
                },
                {
                    id: 'mock_buy_4', name: 'Patricia Anderson', email: 'patricia.a@example.com', phone: '(555) 555-6677',
                    source: 'Zillow', leadType: 'Buyer', status: 'Active', receivedAt: new Date(Date.now() - 86400000 * 30),
                    slaUrgency: 'low', funnelStage: 'UnderContract', health: 'Active', minPrice: 500000, maxPrice: 600000,
                    propertyAddress: '123 Pine St, Cityville', isMock: true, collectionName: 'buyers', connectionType: 'Direct Lead'
                },
                {
                    id: 'mock_buy_5', name: 'Noah Garcia', email: 'noah.g@example.com', phone: '(555) 999-0011',
                    source: 'Referral', leadType: 'Buyer', status: 'Active', receivedAt: new Date(Date.now() - 86400000),
                    slaUrgency: 'high', funnelStage: 'Closed', health: 'Active', minPrice: 700000, maxPrice: 800000,
                    propertyAddress: '456 Oak Ln, Suburbia', isMock: true, collectionName: 'buyers', connectionType: 'Direct Lead'
                },

                // --- Selling Pipeline (sellers collection) ---
                {
                    id: 'mock_sell_1', name: 'Michael Ross', email: 'mross@legal.com', phone: '(555) 555-0199',
                    source: 'Website', leadType: 'Seller', status: 'Active', receivedAt: new Date(Date.now() - 18000000),
                    slaUrgency: 'low', funnelStage: 'Nurture', health: 'Active', price: 1250000,
                    propertyAddress: 'Santa Monica Beachfront Condo', isMock: true, collectionName: 'sellers', connectionType: 'Direct Lead'
                },
                {
                    id: 'mock_sell_2', name: 'Linda Martinez', email: 'linda.m@example.com', phone: '(555) 333-4455',
                    source: 'Referral', leadType: 'Seller', status: 'Active', receivedAt: new Date(Date.now() - 86400000 * 3),
                    slaUrgency: 'high', funnelStage: 'Active', health: 'Active', price: 650000,
                    propertyAddress: '456 Maple Dr, Suburbia', isMock: true, collectionName: 'sellers', connectionType: 'Direct Lead'
                },
                {
                    id: 'mock_sell_3', name: 'Robert Taylor', email: 'rtaylor@example.com', phone: '(555) 444-5566',
                    source: 'Website', leadType: 'Seller', status: 'Active', receivedAt: new Date(Date.now() - 86400000 * 5),
                    slaUrgency: 'high', funnelStage: 'Offer', health: 'Active', price: 925000,
                    propertyAddress: '789 Oak Ln, Countryside', isMock: true, collectionName: 'sellers', connectionType: 'Direct Lead'
                },
                {
                    id: 'mock_sell_4', name: 'Olivia Brown', email: 'olivia.b@example.com', phone: '(555) 888-9900',
                    source: 'Website', leadType: 'Seller', status: 'Active', receivedAt: new Date(Date.now() - 14400000),
                    slaUrgency: 'medium', funnelStage: 'UnderContract', health: 'Active', price: 450000,
                    propertyAddress: 'Garden Villa #12', isMock: true, collectionName: 'sellers', connectionType: 'Direct Lead'
                },
                {
                    id: 'mock_sell_5', name: 'Charlie Day', email: 'charlie.d@example.com', phone: '(555) 123-0003',
                    source: 'Facebook', leadType: 'Seller', status: 'Active', receivedAt: new Date(Date.now() - 7200000),
                    slaUrgency: 'medium', funnelStage: 'Closed', health: 'Active', price: 320000,
                    propertyAddress: 'Modern Loft A', isMock: true, collectionName: 'sellers', connectionType: 'Direct Lead'
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

            // Check if we need to seed (if any mock leads are missing OR in wrong collection)
            const shouldSeed = initialLeads.some(l => {
                const existing = _leads.find(ex => ex.id === l.id);
                return !existing || (l.collectionName && existing.collectionName !== l.collectionName);
            });

            if (shouldSeed) {
                console.log("[ClientHub] Missing mock data detected. Seeding...");
                await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates);

                // Re-fetch after seeding
                const _newLeads = await getLeads(realtorId, ['leads']);
                const _newBuyers = await getLeads(realtorId, ['buyers']);
                const _newSellers = await getLeads(realtorId, ['sellers']);
                _leads = [..._newLeads, ..._newBuyers, ..._newSellers];
                _tasks = await getTasks(realtorId);
                _templates = await getTemplates(realtorId);
            }

            setLeads(_leads);
            setTasks(_tasks);
            setTemplates(_templates);
            setPipelineNotes(_notes);
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
            if (!selectedClient || !('uid' in selectedClient)) {
                setClientActivity({ favorites: [], views: [] });
                setMessages([]);
                return;
            }
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
        if (!newMessage.trim() || !selectedClient || !('uid' in selectedClient)) return;

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
        if (!selectedClient || !('uid' in selectedClient)) return;
        const success = await updateSmsConsent(selectedClient.uid, true);
        if (success) {
            setSelectedClient({ ...selectedClient, smsConsent: true });
        }
    };

    const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
        // Handle Archive/Activate Logic
        const currentLead = leads.find(l => l.id === leadId);
        if (currentLead) {
            // Activating: Move to buyers/sellers collection
            if (updates.activatedAt && currentLead.status === 'New') {
                const updatedLead = { ...currentLead, ...updates };
                setIsSavingLead(true);
                const success = await activateLeadToCollection(updatedLead);
                if (success) {
                    setLeads(prev => prev.map(l => l.id === leadId ? {
                        ...l,
                        ...updates,
                        funnelStage: 'Nurture',
                        status: 'Active',
                        collectionName: currentLead.leadType === 'Seller' ? 'sellers' : 'buyers'
                    } : l));
                    setEditingLead(null);
                } else {
                    alert('Failed to activate lead. Please try again.');
                }
                setIsSavingLead(false);
                return;
            }

            // Archiving
            if (updates.status === 'Archived' && currentLead.status !== 'Archived') {
                updates.archivedAt = new Date();
            }
            // Activating (backup if triggered otherwise)
            else if (currentLead.status === 'Archived' && updates.status && updates.status !== 'Archived') {
                updates.activatedAt = new Date();
            }
            // Closing
            if (['Closed-Won', 'Closed-Lost'].includes(updates.status || '') && !['Closed-Won', 'Closed-Lost'].includes(currentLead.status)) {
                updates.closedAt = new Date();
            }
        }

        // Determine collection
        const lead = currentLead || leads.find(l => l.id === leadId);
        let collectionName = lead?.collectionName || 'leads';

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
        const success = await updateLead(leadId, updates, collectionName);
        if (!success) {
            // Revert on failure
            setLeads(previousLeads);
            alert('Failed to save changes. Please try again.');
        }
        setIsSavingLead(false);
    };

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId, combine } = result;

        // Custom Note Handling (Palette Drop onto Lead)
        if (draggableId.startsWith('note-') && combine) {
            const leadId = combine.draggableId;
            const colorMap: any = {
                'note-yellow': 'bg-[#ffff88] text-slate-800 border-[#eeee77]',
                'note-blue': 'bg-[#7afaff] text-slate-800 border-[#69e9ee]',
                'note-pink': 'bg-[#ff7eb9] text-white border-[#ee6da8]',
                'note-green': 'bg-[#a7ffeb] text-slate-800 border-[#96eee0]',
            };
            setPendingNote({ leadId, color: colorMap[draggableId] || 'bg-yellow-100' });
            return;
        }

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStage = destination.droppableId as FunnelStage;
        const leadId = draggableId;
        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        // Optimistically update the UI
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, funnelStage: newStage } : l));

        // Persist to database (in the correct collection)
        const collectionName = lead.leadType === 'Seller' ? 'sellers' : 'buyers';
        const success = await updateLead(leadId, { funnelStage: newStage }, collectionName);
        if (!success) {
            console.error("Failed to update lead stage");
            setLeads(leads);
        }
    };

    const handleSavePipelineNote = async (content: string) => {
        if (!pendingNote || !content.trim()) return;

        const newNoteObj: Partial<PipelineNote> = {
            leadId: pendingNote.leadId,
            realtorId,
            content: content,
            color: pendingNote.color,
            timestamp: new Date()
        };

        const noteId = await addPipelineNote(newNoteObj);
        if (noteId) {
            setPipelineNotes(prev => [...prev, { ...newNoteObj, id: noteId } as PipelineNote]);
            setPendingNote(null);
        } else {
            alert("Failed to save note.");
        }
    };

    const handleUpdatePipelineNote = async (noteId: string, updates: Partial<PipelineNote>) => {
        // Optimistic update
        setPipelineNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates } : n));

        const success = await updatePipelineNote(noteId, updates);
        if (!success) {
            alert("Failed to update note.");
            // Ideally revert here but for brevity we'll stick to simple error
        }
    };

    const handleDeletePipelineNote = async (noteId: string) => {
        // Optimistic update
        setPipelineNotes(prev => prev.filter(n => n.id !== noteId));

        const success = await deletePipelineNote(noteId);
        if (!success) {
            alert("Failed to delete note.");
        }
    };

    const handleCreateLead = (initialUpdates?: Partial<Lead>) => {
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
            health: 'Active',
            ...initialUpdates
        };
        setEditingLead(newLead);
        setNewNote('');
    };

    const tabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'leads', label: 'Leads', icon: 'fa-bullseye' },
        { id: 'pipeline', label: 'Pipeline', icon: 'fa-diagram-project' },
        { id: 'clients', label: 'Clients', icon: 'fa-user-group' },
        { id: 'tasks', label: 'Tasks', icon: 'fa-check-double' },
        { id: 'comms', label: 'Connect', icon: 'fa-comments' },
    ];

    return (
        <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col animate-in fade-in duration-500 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Top Header / Tab Bar */}
            <header className="bg-slate-900 px-8 py-0 flex items-center justify-between border-b border-white/5 shadow-2xl relative z-50">
                <div className="flex items-center gap-12">
                    <div className="flex items-center gap-6 py-4">
                        <Logo size={90} onClick={onBack} className="cursor-pointer transition-transform hover:scale-105" />
                        <div className="h-8 w-px bg-white/10"></div>
                        <div className="flex flex-col">
                            <h1 className="text-white font-black text-2xl tracking-tighter">Client Hub</h1>
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
                    <ClientNetwork
                        clients={clients}
                        manualContacts={leads}
                        selectedClient={selectedClient}
                        setSelectedClient={setSelectedClient}
                        clientActivity={clientActivity}
                        loadingClients={loadingClients}
                        loadingActivity={loadingActivity}
                    />
                )}

                {activeTab === 'leads' && (
                    <LeadsList
                        leads={leads}
                        onUpdateLead={(id, updates) => handleUpdateLead(id, updates)}
                        onViewLead={(lead) => setEditingLead(lead)}
                        onCreateLead={handleCreateLead}
                        notes={pipelineNotes}
                        pendingNote={pendingNote}
                        setPendingNote={setPendingNote}
                        handleSaveNote={handleSavePipelineNote}
                        handleUpdateNote={handleUpdatePipelineNote}
                        handleDeleteNote={handleDeletePipelineNote}
                        handleDragEnd={handleDragEnd}
                    />
                )}

                {activeTab === 'pipeline' && (
                    <PipelineBoard
                        subTab={pipelineSubTab}
                        setSubTab={setPipelineSubTab}
                        leads={leads}
                        notes={pipelineNotes}
                        pendingNote={pendingNote}
                        setPendingNote={setPendingNote}
                        handleSaveNote={handleSavePipelineNote}
                        handleUpdateNote={handleUpdatePipelineNote}
                        handleDeleteNote={handleDeletePipelineNote}
                        setEditingLead={setEditingLead}
                        handleDragEnd={handleDragEnd}
                        handleCreateLead={handleCreateLead}
                    />
                )}

                {activeTab === 'tasks' && (
                    <TaskBoard tasks={tasks} />
                )}

                {activeTab === 'comms' && (
                    <CommHub
                        messages={messages}
                        newMessage={newMessage}
                        setNewMessage={setNewMessage}
                        activeChannel={activeChannel}
                        setActiveChannel={setActiveChannel}
                        scrollRef={scrollRef}
                        selectedClient={selectedClient as UserProfile}
                        realtorId={realtorId}
                        handleSendMessage={handleSendMessage}
                        handleGrantConsent={handleGrantConsent}
                        templates={templates}
                    />
                )}


            </div>

            {/* Lead Edit Modal */}
            {editingLead && (
                <EditLeadModal
                    editingLead={editingLead}
                    setEditingLead={setEditingLead}
                    leads={leads}
                    handleUpdateLead={handleUpdateLead}
                    isSavingLead={isSavingLead}
                    newNote={newNote}
                    setNewNote={setNewNote}
                />
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
        </div>
    );
};

export default ClientHub;
