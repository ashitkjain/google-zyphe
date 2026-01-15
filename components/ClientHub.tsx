import React, { useState, useEffect, useRef } from 'react';
import { getRealtorClients, getClientActivity, persistCommMessage, updateSmsConsent, updateFunnelStage, seedMockData, getLeads, getTasks, getTemplates, updateLead, addPipelineNote, getPipelineNotes, updatePipelineNote, deletePipelineNote, saveUserProfile, getUserProfile } from '../services/firebaseService';
import { UserProfile, Lead, LeadNote, CRMTask, CommMessage, CommTemplate, FunnelStage, PipelineNote, LeadStatus } from '../types';
import { DropResult } from '@hello-pangea/dnd';
import Logo from './Logo';
import LeadsList from './LeadsList';

// Sub-components
import ClientNetwork from './client-hub/ClientNetwork';
import EditLeadModal from './client-hub/EditLeadModal';
import TaskBoard from './client-hub/TaskBoard';
import KYCModal from './client-hub/KYCModal';
import StatusSettings from './client-hub/StatusSettings';
import { StatusOption } from '../types';
import { isTerminalStatus, getFunnelStageForStatus, getStatusOptions } from '../services/statusService';
import WhiteboardTab from './client-hub/WhiteboardTab';
import ClosingDashboard from './client-hub/ClosingDashboard';

interface Props {
    realtorId: string;
    realtorName: string;
    onSignOut: () => void;
    onBack: () => void;
}

type HubTab = 'clients' | 'leads' | 'tasks' | 'comms' | 'settings' | 'whiteboard' | 'closing';

const ClientHub: React.FC<Props> = ({ realtorId, realtorName, onSignOut, onBack }) => {
    const [activeTab, setActiveTab] = useState<HubTab>('leads');
    const [clients, setClients] = useState<UserProfile[]>([]);
    const [selectedClient, setSelectedClient] = useState<UserProfile | Lead | null>(null);
    const [clientActivity, setClientActivity] = useState<{ favorites: any[], views: any[] }>({ favorites: [], views: [] });
    const [loadingClients, setLoadingClients] = useState(true);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [realtorProfile, setRealtorProfile] = useState<UserProfile | null>(null);

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
    const [kycLead, setKycLead] = useState<Lead | null>(null);
    const [newNote, setNewNote] = useState('');
    const [isSavingLead, setIsSavingLead] = useState(false);

    // Pipeline Notes State
    const [pipelineNotes, setPipelineNotes] = useState<PipelineNote[]>([]);
    const [pendingNote, setPendingNote] = useState<{ leadId: string, color: string } | null>(null);

    useEffect(() => {
        // Global listener for KYC modal
        (window as any).dispatchKYCEvent = (lead: Lead) => {
            setKycLead(lead);
        };
        return () => {
            (window as any).dispatchKYCEvent = undefined;
        };
    }, []);

    useEffect(() => {
        const initializeHubData = async () => {
            setLoadingData(true);

            // 1. Fetch Existing Data
            let _leads = await getLeads(realtorId, ['leads']);
            let _tasks = await getTasks(realtorId);
            let _templates = await getTemplates(realtorId);
            let _notes = await getPipelineNotes(realtorId);

            // 2. Define Mock Data (Always available for potential seeding)
            console.log("[ClientHub] Seeding initial mock data...");
            const initialLeads: Lead[] = []; // DISABLED HARDCODED DATA
            /*
            const initialLeads: Lead[] = [
                // --- NEW BUYER LEADS ---
                // Today (New)
                {
                    id: 'clean_buy_1', firstName: 'Alice', lastName: 'New', email: 'alice.new@example.com', phone: '(555) 001-0001',
                    source: 'Zillow', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'New', receivedAt: new Date(), slaUrgency: 'high', funnelStage: 'Leads',
                    health: 'Active', message: "Interested in the downtown loft.", isMock: true, collectionName: 'leads',
                    minPrice: 400000, maxPrice: 500000, budgetRange: "$400k - $500k",
                    isAlsoSelling: true, preQualified: true, preferredNeighborhood: 'Downtown',
                    tags: ['Priority', 'Loft-Lover'], notes: 'Very motivated to find a place by next month.',
                    notesLog: [
                        { id: 'm1', content: 'Very motivated to find a place by next month.', timestamp: new Date(), author: 'Realtor', color: 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]' },
                        { id: 'm2', content: 'Scheduled a call for tomorrow at 10 AM.', timestamp: new Date(), author: 'Realtor', color: 'bg-[#7afaff] text-slate-800 border-[#69e9ee] shadow-[5px_5px_7px_rgba(33,33,33,.1)]' }
                    ]
                },
                // Past Week (3 days ago)
                {
                    id: 'clean_buy_2', firstName: 'Bob', lastName: 'Week', email: 'bob.week@example.com', phone: '(555) 001-0002',
                    source: 'Website', leadType: 'Buyer', connectionType: 'Direct Lead',
                    status: 'New', receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                    slaUrgency: 'medium', funnelStage: 'Inquiry', health: 'Active', isMock: true, collectionName: 'leads',
                    minPrice: 600000, maxPrice: 750000, budgetRange: "$600k - $750k",
                    isAlsoSelling: false, preQualified: false, preferredNeighborhood: 'Westside',
                    tags: ['First-Time-Buyer'], notes: 'Waiting for pre-approval letter.'
                },
                // ... (rest of old mock data commented out)
                {
                    id: 'clean_archived_1', firstName: 'Harry', lastName: 'Old', email: 'harry.old@example.com', phone: '(555) 999-9999',
                    source: 'Zillow', leadType: 'Buyer', status: 'Archived', receivedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                    slaUrgency: 'low', funnelStage: 'Inquiry', health: 'Dormant', isMock: true, collectionName: 'leads', connectionType: 'Direct Lead',
                    isAlsoSelling: false, preQualified: false, tags: ['Archived'], notes: 'No longer looking in this area.'
                }
            ];
            */

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

            // Check if we need to seed (if any mock leads are missing, in wrong collection, or missing KYC data)
            const shouldSeed = initialLeads.some(l => {
                const existing = _leads.find(ex => ex.id === l.id);
                if (!existing) return true;
                if (l.collectionName && existing.collectionName !== l.collectionName) return true;
                if (l.kyc && !existing.kyc) return true; // New check for KYC data
                return false;
            });

            if (shouldSeed) {
                console.log("[ClientHub] Missing mock data detected. Seeding...");
                await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates);

                // Re-fetch after seeding
                _leads = await getLeads(realtorId, ['leads']);
                _tasks = await getTasks(realtorId);
                _templates = await getTemplates(realtorId);
            }

            // Forced Merge: Ensure local state has mock data even if Firestore is slightly behind 
            // This is safer for development UX
            const finalLeads = _leads.map(lead => {
                if (lead.isMock) {
                    const mockTemplate = initialLeads.find(l => l.id === lead.id);
                    if (mockTemplate) {
                        return { ...lead, ...mockTemplate };
                    }
                }
                return lead;
            });

            setLeads(finalLeads);
            setTasks(_tasks);
            setTemplates(_templates);
            setLoadingData(false);

            // Refresh selectedClient to ensure it has the latest data (including KYC)
            setSelectedClient(prev => {
                if (!prev) return null;
                const prevId = 'uid' in prev ? (prev as any).uid : (prev as any).id;
                const updated = finalLeads.find(l => l.id === prevId);
                // For users, they might be in the 'clients' state (which we haven't updated here as it's separate)
                // but since Sarah is a lead, this will work for her.
                return updated || prev;
            });
        };
        initializeHubData();
    }, [realtorId]);

    useEffect(() => {
        const fetchRealtorProfile = async () => {
            const profile = await getUserProfile(realtorId);
            setRealtorProfile(profile);
        };
        fetchRealtorProfile();
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
        const currentLead = leads.find(l => l.id === leadId);
        if (currentLead) {
            // Automatically sync funnelStage if status is changing
            if (updates.status && updates.status !== currentLead.status) {
                updates.funnelStage = getFunnelStageForStatus(updates.status, currentLead.leadType, realtorProfile?.settings) as any;
            }

            // Archiving
            if (updates.status === 'Archived' && currentLead.status !== 'Archived') {
                updates.archivedAt = new Date();
            }
            else if (currentLead.status === 'Archived' && updates.status && updates.status !== 'Archived') {
                updates.activatedAt = new Date();
            }

            if (isTerminalStatus(updates.status || '', currentLead.leadType, realtorProfile?.settings) && !isTerminalStatus(currentLead.status, currentLead.leadType, realtorProfile?.settings)) {
                updates.closedAt = new Date();
            }
        }

        const lead = currentLead || leads.find(l => l.id === leadId);
        // All leads are now in the 'leads' collection
        let collectionName = 'leads';

        const previousLeads = [...leads];
        const leadExists = leads.some(l => l.id === leadId);
        if (leadExists) {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
        } else {
            setLeads(prev => [{ ...updates, id: leadId } as Lead, ...prev]);
        }
        setEditingLead(null);

        setIsSavingLead(true);
        const success = await updateLead(leadId, updates, collectionName);
        if (!success) {
            setLeads(previousLeads);
            alert('Failed to save changes. Please try again.');
        }
        setIsSavingLead(false);
    };

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        // Custom Note Handling (Palette Drop onto Lead)
        if (draggableId.startsWith('note-') && destination && destination.droppableId !== 'palette' && destination.droppableId !== 'palette-buyer' && destination.droppableId !== 'palette-seller') {
            const leadId = destination.droppableId;
            // Extract base ID (e.g., 'note-yellow' from 'note-yellow-buyer')
            const baseNoteId = draggableId.split('-').slice(0, 2).join('-');

            const colorMap: any = {
                'note-yellow': 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
                'note-blue': 'bg-[#7afaff] text-slate-800 border-[#69e9ee] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
                'note-pink': 'bg-[#ff7eb9] text-white border-[#ee6da8] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
                'note-green': 'bg-[#a7ffeb] text-slate-800 border-[#96eee0] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
            };

            setPendingNote({
                leadId,
                color: colorMap[baseNoteId] || 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]'
            });
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
        // All leads are now in the 'leads' collection
        const collectionName = 'leads';
        const success = await updateLead(leadId, { funnelStage: newStage }, collectionName);
        if (!success) {
            console.error("Failed to update lead stage");
            setLeads(leads);
        }
    };


    const handleAddNote = async (leadId: string, content: string, color: string) => {
        if (!content.trim()) return;

        const newNoteObj: Partial<PipelineNote> = {
            leadId: leadId,
            realtorId,
            content: content,
            color: color,
            timestamp: new Date()
        };

        const noteId = await addPipelineNote(newNoteObj);
        if (noteId) {
            const finalNote = { ...newNoteObj, id: noteId } as PipelineNote;
            setPipelineNotes(prev => [...prev, finalNote]);

            // Sync with Lead's notesLog
            const lead = leads.find(l => l.id === leadId);
            if (lead) {
                const updatedNotesLog = [...(lead.notesLog || []), {
                    id: noteId,
                    content: content,
                    timestamp: new Date(),
                    author: realtorName,
                    color: color
                }];
                handleUpdateLead(lead.id, { notesLog: updatedNotesLog, notes: content });

                // Also update editingLead if it's the same lead
                if (editingLead && editingLead.id === leadId) {
                    setEditingLead({ ...editingLead, notesLog: updatedNotesLog, notes: content });
                }
            }
        }
        return noteId;
    };

    const handleSavePipelineNote = async (content: string) => {
        if (!pendingNote || !content.trim()) return;
        await handleAddNote(pendingNote.leadId, content, pendingNote.color);
        setPendingNote(null);
    };

    const handleUpdatePipelineNote = async (noteId: string, updates: Partial<PipelineNote>) => {
        // Optimistic update
        setPipelineNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates } : n));

        // Sync with Lead's notesLog
        const note = pipelineNotes.find(n => n.id === noteId);
        if (note) {
            const lead = leads.find(l => l.id === note.leadId);
            if (lead && lead.notesLog) {
                const updatedNotesLog = lead.notesLog.map(n => n.id === noteId ? { ...n, ...updates } : n);
                handleUpdateLead(lead.id, { notesLog: updatedNotesLog });

                if (editingLead && editingLead.id === lead.id) {
                    setEditingLead({ ...editingLead, notesLog: updatedNotesLog });
                }
            }
        }

        const success = await updatePipelineNote(noteId, updates);
        if (!success) {
            alert("Failed to update note.");
        }
    };

    const handleDeletePipelineNote = async (noteId: string) => {
        // Sync with Lead's notesLog first
        const note = pipelineNotes.find(n => n.id === noteId);
        if (note) {
            const lead = leads.find(l => l.id === note.leadId);
            if (lead && lead.notesLog) {
                const updatedNotesLog = lead.notesLog.filter(n => n.id !== noteId);
                handleUpdateLead(lead.id, { notesLog: updatedNotesLog });

                if (editingLead && editingLead.id === lead.id) {
                    setEditingLead({ ...editingLead, notesLog: updatedNotesLog });
                }
            }
        }

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
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            status: 'New',
            receivedAt: new Date(),
            source: 'Manual',
            leadType: 'Buyer',
            connectionType: 'Direct Lead',
            slaUrgency: 'medium',
            funnelStage: 'Leads',
            health: 'Active',
            ...initialUpdates
        };
        setEditingLead(newLead);
        setNewNote('');
    };

    const tabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'leads', label: 'Funnel', icon: 'fa-bullseye' },
        { id: 'closing', label: 'Closing', icon: 'fa-file-invoice-dollar' },
        { id: 'clients', label: 'Clients', icon: 'fa-user-group' },
        { id: 'tasks', label: 'Tasks', icon: 'fa-check-double' },
        { id: 'whiteboard', label: 'Whiteboard', icon: 'fa-pen-to-square' },
        { id: 'settings', label: 'Statuses', icon: 'fa-sliders' },
    ];

    const handleSaveKYC = async (updates: any) => {
        if (!kycLead) return;
        const _isUser = 'uid' in kycLead;

        if (_isUser) {
            // Mapping back normalized fields for UserProfile
            const normalizedUpdates = { ...updates };
            if (updates.name) {
                normalizedUpdates.displayName = updates.name;
                delete normalizedUpdates.name;
            }
            if (updates.phone) {
                normalizedUpdates.phoneNumber = updates.phone;
                delete normalizedUpdates.phone;
            }

            // Update UserProfile
            const uid = (kycLead as UserProfile).uid;
            setClients(prev => prev.map(c => c.uid === uid ? { ...c, ...normalizedUpdates } : c));
            await saveUserProfile(uid, normalizedUpdates);
        } else {
            // Update Lead
            const leadId = (kycLead as Lead).id;
            handleUpdateLead(leadId, updates);
        }
        setKycLead(null);
    };

    const handleUpdateStatuses = async (buyerStatuses: StatusOption[], sellerStatuses: StatusOption[]) => {
        const success = await saveUserProfile(realtorId, {
            settings: {
                leadStatuses: {
                    buyer: buyerStatuses,
                    seller: sellerStatuses
                }
            }
        });

        if (success === true) {
            setRealtorProfile(prev => prev ? {
                ...prev,
                settings: {
                    ...prev.settings,
                    leadStatuses: {
                        buyer: buyerStatuses,
                        seller: sellerStatuses
                    }
                }
            } : null);
            alert("Settings saved successfully.");
        } else {
            alert("Failed to save settings.");
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

                <div className="flex items-center gap-8">
                    <div className="flex flex-col items-end">
                        <span className="text-white font-black text-sm tracking-tight">{realtorName}</span>
                        <button
                            onClick={onSignOut}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors mt-0.5 group/signout cursor-pointer"
                        >
                            <i className="fa-solid fa-right-from-bracket text-[10px] text-white group-hover/signout:-translate-x-0.5 transition-all"></i>
                            Sign Out
                        </button>
                    </div>

                    <button
                        onClick={onBack}
                        className="group flex items-center gap-2 text-white font-black uppercase tracking-widest text-[10px] bg-indigo-600 px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 border border-indigo-500/30"
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
                        onUpdateKYC={handleSaveKYC}
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
                        realtorSettings={realtorProfile?.settings}
                    />
                )}


                {activeTab === 'closing' && (
                    <ClosingDashboard />
                )}

                {activeTab === 'tasks' && (
                    <TaskBoard tasks={tasks} />
                )}

                {activeTab === 'settings' && (
                    <StatusSettings
                        realtorId={realtorId}
                        onUpdateStatuses={handleUpdateStatuses}
                        initialBuyerStatuses={realtorProfile?.settings?.leadStatuses?.buyer}
                        initialSellerStatuses={realtorProfile?.settings?.leadStatuses?.seller}
                    />
                )}

                {activeTab === 'whiteboard' && (
                    <WhiteboardTab userId={realtorId} />
                )}

            </div>

            {/* Lead Edit Modal */}
            {
                editingLead && (
                    <EditLeadModal
                        editingLead={editingLead}
                        setEditingLead={setEditingLead}
                        leads={leads}
                        handleUpdateLead={handleUpdateLead}
                        isSavingLead={isSavingLead}
                        newNote={newNote}
                        setNewNote={setNewNote}
                        realtorSettings={realtorProfile?.settings}
                        handleAddNote={handleAddNote}
                        handleDeleteNote={handleDeletePipelineNote}
                    />
                )
            }


            {/* KYC Modal */}
            {
                kycLead && (
                    <KYCModal
                        lead={kycLead}
                        onClose={() => setKycLead(null)}
                        onSave={handleSaveKYC}
                    />
                )
            }

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes bounce-slow {
                  0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
                  50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
                }
                .animate-bounce-slow {
                  animation: bounce-slow 4s infinite;
                }
                /* Custom Scrollbar Styling */
                ::-webkit-scrollbar {
                  width: 10px;
                  height: 12px;
                }
                ::-webkit-scrollbar-track {
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  border-radius: 12px;
                }
                ::-webkit-scrollbar-thumb {
                  background: #94a3b8;
                  border-radius: 12px;
                  border: 3px solid #f8fafc;
                }
                ::-webkit-scrollbar-thumb:hover {
                  background: #475569;
                }

                /* Firefox */
                * {
                  scrollbar-width: thin;
                  scrollbar-color: #94a3b8 #f8fafc;
                }
              `}} />
        </div >
    );
};

export default ClientHub;
